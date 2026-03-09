const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

// --- HELPER DI INIZIALIZZAZIONE ---
// Questa funzione viene chiamata all'interno di OGNI Cloud Function
// per garantire che l'app sia inizializzata solo quando serve.
function getServices() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return {
    db: admin.firestore(),
    messaging: admin.messaging()
  };
}

const daysOfWeekMap = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// --- CONFIGURAZIONE SICUREZZA ---
// IMPORTANTE: In produzione, utilizzare firebase functions:secrets:set per gestire questa chiave.
// Per questo sprint, utilizziamo una costante definita qui.
// Questa chiave deve corrispondere ESATTAMENTE a quella usata dal ProjectB per inviare i dati.
const API_SHARED_SECRET = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";

// --- FUNZIONE 1: ENDPOINT API PUBBLICO (Nuova) ---
// Url previsto: https://europe-west1-ep-gestionale-v1.cloudfunctions.net/receiveLead
exports.receiveLead = onRequest(
  {
    region: "europe-west1",
    cors: true, // Abilita CORS se necessario per chiamate client-side (opzionale per server-to-server ma utile per debug)
    maxInstances: 10,
  },
  async (req, res) => {
    // Inizializza servizi
    const { db } = getServices();

    // 1. Gestione Manuale CORS (Preflight & Headers)
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    // 2. Controllo Metodo
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // 3. Controllo Sicurezza (Bearer Token)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing Bearer Token" });
    }

    const token = authHeader.split("Bearer ")[1];
    if (token !== API_SHARED_SECRET) {
      // Simuliamo un ritardo per prevenire timing attacks (opzionale ma best practice)
      await new Promise((resolve) => setTimeout(resolve, 200));
      return res.status(403).json({ error: "Forbidden: Invalid API Key" });
    }

    // 4. Validazione Payload JSON
    const data = req.body;

    // Controlli minimi obbligatori
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Bad Request: Invalid JSON body" });
    }

    // Qui puoi definire i campi obbligatori che ProjectB DEVE inviare
    const requiredFields = ["email"]; // Es. almeno l'email è richiesta
    const missing = requiredFields.filter((field) => !data[field]);

    if (missing.length > 0) {
      return res
        .status(400)
        .json({
          error: `Bad Request: Missing required fields: ${missing.join(", ")}`,
        });
    }

    // 5. Controllo Duplicati (Deduplication)
    // Cerchiamo lead pendenti con la stessa email
    const leadsRef = db.collection("incoming_leads");
    const duplicateQuery = await leadsRef
      .where("email", "==", data.email)
      .where("status", "==", "pending")
      .get();

    if (!duplicateQuery.empty) {
      // Filtriamo in memoria per childName (se presente) per gestire case-insensitivity
      // e distinguere fratelli iscritti dallo stesso genitore
      const duplicate = duplicateQuery.docs.find((doc) => {
        const lead = doc.data();
        if (data.childName && lead.childName) {
          return (
            data.childName.trim().toLowerCase() ===
            lead.childName.trim().toLowerCase()
          );
        }
        // Se non c'è childName, assumiamo sia lo stesso lead (es. genitore senza figlio specificato)
        return true;
      });

      if (duplicate) {
        console.log(`[API] Duplicate lead detected: ${duplicate.id}`);
        return res.status(200).json({
          success: true,
          message: "Lead already received (duplicate).",
          referenceId: duplicate.id,
          isDuplicate: true,
        });
      }
    }

    try {
      // 6. Persistenza su Firestore
      // Adattamento del payload dal formato Progetto B al formato atteso da LeadsPage.tsx
      
      // Mappatura giorni della settimana per formattare lo slot come stringa
      const daysMap = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
      
      let formattedSlot = "Orario non specificato";
      if (data.selectedSlot && typeof data.selectedSlot === 'object') {
          const dayName = daysMap[data.selectedSlot.dayOfWeek] || "";
          formattedSlot = `${dayName} ${data.selectedSlot.startTime || ''} - ${data.selectedSlot.endTime || ''}`.trim();
      } else if (typeof data.selectedSlot === 'string') {
          formattedSlot = data.selectedSlot; // Fallback se arriva già come stringa
      }

      const leadDoc = {
        // Dati base
        nome: data.nome || "",
        cognome: data.cognome || "",
        email: data.email || "",
        telefono: data.telefono || "",
        childName: data.childName || "",
        childAge: data.childAge ? String(data.childAge) : "", // LeadsPage si aspetta una stringa
        
        // Dati Sede e Slot adattati per LeadsPage.tsx
        selectedLocation: data.locationName || data.selectedLocation || "Sede non specificata",
        selectedSlot: formattedSlot,
        
        // Altri dati
        notes: data.notes || "",
        privacyAccepted: data.privacyAccepted || false,
        marketingAccepted: data.marketingAccepted || false,
        
        // Campi di sistema
        source: "projectB_api",
        status: "pending", // pending | processed | rejected
        createdAt: new Date().toISOString(), // CRITICO: LeadsPage ordina per 'createdAt', non 'receivedAt'
        
        // Campi di utilità per ricerca e debug
        searchableName: ((data.nome || "") + " " + (data.cognome || "")).toLowerCase(),
        metadata: {
          userAgent: req.headers["user-agent"],
          ip: req.ip,
          originalLocationId: data.locationId || null, // Salviamo l'ID originale per usi futuri
          originalSlotData: data.selectedSlot || null  // Salviamo l'oggetto originale per usi futuri
        },
      };

      const docRef = await db.collection("incoming_leads").add(leadDoc);

      console.log(`[API] Lead ricevuto e salvato con ID: ${docRef.id}`);

      // 7. Risposta al mittente
      return res.status(200).json({
        success: true,
        message: "Lead received and stored successfully.",
        referenceId: docRef.id,
      });
    } catch (error) {
      console.error("[API] Error saving lead:", error);
      return res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  },
);

// --- FUNZIONE 1.1: ENDPOINT DISPONIBILITÀ SEDI (Nuova - V2 Pubblica) ---
// Url previsto: https://europe-west1-ep-gestionale-v1.cloudfunctions.net/getPublicSlots
exports.getPublicSlots = onRequest(
  {
    region: "europe-west1",
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    // Inizializza servizi
    const { db } = getServices();

    // 1. Gestione Manuale CORS (Preflight & Headers)
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    // 2. Controllo Metodo
    if (req.method !== "GET") {
      return res.status(405).send("Method Not Allowed");
    }

    // 3. NESSUN Controllo Bearer Token (Funzione Pubblica)

    try {
      // 4. Recupero Fornitori, Iscrizioni e Abbonamenti
      const [suppliersSnap, enrollmentsSnap, subscriptionsSnap] = await Promise.all([
          db.collection("suppliers").where("isDeleted", "==", false).get(),
          db.collection("enrollments").where("status", "in", ["active", "pending", "confirmed", "Active", "Pending", "Confirmed"]).get(),
          db.collection("subscriptionTypes").get()
      ]);

      // 5. Filtra Abbonamenti Pubblici
      const activeSubs = [];
      subscriptionsSnap.forEach(doc => {
          const sub = doc.data();
          if (sub.isPubliclyVisible !== false) {
              activeSubs.push({ id: doc.id, ...sub });
          }
      });

      // 6. Costruisci Mappa Occupazione per Bundle: { "locationId_dayOfWeek_subscriptionId": count }
      const occupancyMap = new Map();

      enrollmentsSnap.forEach(doc => {
          const data = doc.data();
          const locId = data.locationId;
          const subId = data.subscriptionTypeId;
          const appts = data.appointments || [];
          const lessonsRemaining = data.lessonsRemaining !== undefined ? Number(data.lessonsRemaining) : 1;

          // Consideriamo solo iscrizioni con lezioni residue (non esaurite)
          if (locId && subId && appts.length > 0 && lessonsRemaining > 0) {
              const mainAppt = appts[0]; 
              if (mainAppt && (mainAppt.dayOfWeek !== undefined)) {
                  const day = typeof mainAppt.dayOfWeek === 'string' ? parseInt(mainAppt.dayOfWeek) : mainAppt.dayOfWeek;
                  const key = `${locId}_${day}_${subId}`;
                  const currentCount = occupancyMap.get(key) || 0;
                  occupancyMap.set(key, currentCount + 1);
              }
          }
      });

      const results = [];
      logger.info(`[getPublicSlots] Found ${suppliersSnap.size} suppliers, ${enrollmentsSnap.size} enrollments, ${activeSubs.length} active subs.`);

      suppliersSnap.forEach(doc => {
          const supplierData = doc.data();
          const locations = supplierData.locations || [];

          locations.forEach((loc) => {
              // Filtro Visibilità Sede
              if (loc.isPubliclyVisible === false || loc.closedAt) {
                  return; 
              }

              // Capacità Sede (Default 15 se non specificata)
              const locationCapacity = loc.capacity ? parseInt(String(loc.capacity)) : 15;

              // Filtro e Processamento Slot Fisici
              const allSlots = loc.availability || [];
              const visibleSlots = allSlots.filter((slot) => {
                  return slot.isPubliclyVisible !== false;
              }).map((s) => {
                  const minAge = s.minAge !== undefined ? parseFloat(String(s.minAge)) : 0;
                  const maxAge = s.maxAge !== undefined ? parseFloat(String(s.maxAge)) : 99;
                  return {
                      dayOfWeek: typeof s.dayOfWeek === 'string' ? parseInt(s.dayOfWeek) : s.dayOfWeek,
                      startTime: s.startTime,
                      endTime: s.endTime,
                      type: s.type || 'LAB',
                      minAge: isNaN(minAge) ? 0 : minAge,
                      maxAge: isNaN(maxAge) ? 99 : maxAge,
                  };
              });

              // Raggruppa slot per giorno
              const slotsByDay = {};
              visibleSlots.forEach(s => {
                  if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
                  slotsByDay[s.dayOfWeek].push(s);
              });

              const locationBundles = [];

              // Motore di Incrocio (Matching Engine)
              for (const dayStr in slotsByDay) {
                  const dayOfWeek = parseInt(dayStr);
                  const daySlots = slotsByDay[dayStr];

                  activeSubs.forEach(sub => {
                      // Verifica giorni consentiti dall'abbonamento
                      if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
                          if (!sub.allowedDays.includes(dayOfWeek)) {
                              return; // Salta se il giorno non è permesso
                          }
                      }

                      const requiresLab = (sub.labCount || 0) > 0;
                      const requiresSg = (sub.sgCount || 0) > 0;
                      const requiresEvt = (sub.evtCount || 0) > 0;

                      // Ignora abbonamenti che non richiedono slot fisici
                      if (!requiresLab && !requiresSg && !requiresEvt) {
                          return; 
                      }

                      const hasLab = daySlots.some(s => (s.type || '').toUpperCase() === 'LAB');
                      const hasSg = daySlots.some(s => (s.type || '').toUpperCase() === 'SG');
                      const hasEvt = daySlots.some(s => (s.type || '').toUpperCase() === 'EVT');

                      // Se la sede in questo giorno offre tutti gli slot richiesti dall'abbonamento
                      if ((!requiresLab || hasLab) && (!requiresSg || hasSg) && (!requiresEvt || hasEvt)) {
                          
                          const includedSlots = daySlots.filter(s => 
                              (requiresLab && (s.type || '').toUpperCase() === 'LAB') || 
                              (requiresSg && (s.type || '').toUpperCase() === 'SG') || 
                              (requiresEvt && (s.type || '').toUpperCase() === 'EVT')
                          );

                          // Calcolo età min/max del pacchetto (intersezione più restrittiva)
                          let bundleMinAge = 0;
                          let bundleMaxAge = 99;
                          includedSlots.forEach(s => {
                              if (s.minAge > bundleMinAge) bundleMinAge = s.minAge;
                              if (s.maxAge < bundleMaxAge) bundleMaxAge = s.maxAge;
                          });
                          if (bundleMinAge > bundleMaxAge) bundleMaxAge = bundleMinAge; // Fallback di sicurezza

                          // Calcolo Disponibilità (Bundle-Level Logic)
                          const occupancyKey = `${loc.id}_${dayOfWeek}_${sub.id}`;
                          const occupiedSeats = occupancyMap.get(occupancyKey) || 0;
                          const availableSeats = Math.max(0, locationCapacity - occupiedSeats);

                          locationBundles.push({
                              bundleId: sub.id,
                              name: sub.name,
                              description: sub.description || '',
                              price: sub.price || 0,
                              dayOfWeek: dayOfWeek,
                              minAge: bundleMinAge,
                              maxAge: bundleMaxAge,
                              capacity: locationCapacity,
                              enrolledCount: occupiedSeats,
                              availableSeats: availableSeats,
                              isFull: availableSeats === 0,
                              includedSlots: includedSlots.map(s => ({
                                  type: s.type,
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  minAge: s.minAge,
                                  maxAge: s.maxAge
                              }))
                          });
                      }
                  });
              }

              if (locationBundles.length > 0) {
                  results.push({
                      id: loc.id,
                      name: loc.name,
                      address: loc.address || '',
                      city: loc.city || supplierData.city || '',
                      googleMapsLink: loc.googleMapsLink || '',
                      bundles: locationBundles
                  });
              }
          });
      });

      return res.status(200).json({ success: true, data: results });
    } catch (error) {
      console.error("[API] Error fetching public slots:", error);
      return res
        .status(500)
        .json({ error: "Internal Server Error", details: error.message });
    }
  },
);

// --- FUNZIONE 2: CRON JOB NOTIFICHE (Esistente) ---
// Questa funzione gira sui server di Google ogni minuto
exports.checkPeriodicNotifications = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Europe/Rome",
    region: "europe-west1",
  },
  async (event) => {
    // Inizializza servizi
    const { db, messaging } = getServices();

    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value;
    
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    
    const currentHour = `${hour === '24' ? '00' : hour}:${minute}`;
    
    // Creiamo una data UTC usando i valori locali per ottenere il giorno della settimana corretto
    const romeDateUTC = new Date(Date.UTC(year, month - 1, day));
    const currentDay = romeDateUTC.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    
    const todayStr = `${year}-${month}-${day}`;

    console.log(
      `[DEBUG v5] Rome Time: ${todayStr} ${currentHour} | Day Index: ${currentDay}`,
    );

    const notificationsToSend = [];

    // --- STEP A: RECUPERA TOKEN UTENTI ---
    const allTokens = [];

    try {
      const tokensSnapshot = await db.collection("fcm_tokens").get();
      tokensSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.token) {
          allTokens.push(data.token);
        }
      });
    } catch (e) {
      console.error("Error fetching tokens:", e);
      return;
    }

    if (allTokens.length === 0) {
      console.log("[DEBUG] Nessun token registrato.");
      return;
    }

    // --- STEP B: CHECK RULES (NUOVO SISTEMA) ---
    try {
      const rulesSnapshot = await db
        .collection("notification_rules")
        .where("enabled", "==", true)
        .get();

      if (rulesSnapshot.empty) {
        console.log("[DEBUG] Nessuna regola attiva trovata.");
      }

      for (const doc of rulesSnapshot.docs) {
        const rule = doc.data();

        // Verifica Giorno e Ora
        // rule.days deve essere array di interi [0..6]
        if (rule.days && rule.days.includes(currentDay)) {
          // Calcoliamo la differenza in minuti tra l'ora attuale e l'ora della regola
          const [ruleHour, ruleMinute] = (rule.time || "00:00")
            .split(":")
            .map(Number);
          const [currHour, currMinute] = currentHour.split(":").map(Number);
          const ruleTotalMinutes = ruleHour * 60 + ruleMinute;
          const currTotalMinutes = currHour * 60 + currMinute;

          const diffMinutes = currTotalMinutes - ruleTotalMinutes;

          // Se siamo entro 5 minuti dall'orario previsto e non abbiamo ancora inviato oggi
          const lastSentDate = rule.lastSentDate;

          if (
            diffMinutes >= 0 &&
            diffMinutes <= 5 &&
            lastSentDate !== todayStr
          ) {
            console.log(`[DEBUG] MATCH REGOLA: ${rule.label} (${rule.id})`);

            // Aggiorniamo subito il db per evitare invii doppi
            await doc.ref.update({ lastSentDate: todayStr });

            let count = 0;
            let messageBody = rule.description;
            let shouldSend = false;

            try {
              if (rule.isCustom) {
                // REGOLA PERSONALIZZATA (Promemoria)
                shouldSend = true;
              } else if (rule.id === "payment_required") {
                const snap = await db
                  .collection("enrollments")
                  .where("status", "==", "Pending")
                  .get();
                count = snap.size;
                if (count > 0) {
                  messageBody = `Ci sono ${count} iscrizioni in attesa di pagamento.`;
                  shouldSend = true;
                }
              } else if (rule.id === "expiry") {
                const snap = await db
                  .collection("enrollments")
                  .where("status", "==", "Active")
                  .get();
                const nextWeek = new Date(now);
                nextWeek.setDate(now.getDate() + 7);

                count = snap.docs.filter((d) => {
                  const end = new Date(d.data().endDate);
                  return end >= now && end <= nextWeek;
                }).length;

                if (count > 0) {
                  messageBody = `${count} iscrizioni scadranno nei prossimi 7 giorni.`;
                  shouldSend = true;
                }
              } else if (rule.id === "balance_due") {
                const snap = await db
                  .collection("invoices")
                  .where("isGhost", "==", true)
                  .where("status", "==", "Draft")
                  .where("isDeleted", "==", false)
                  .get();

                const thirtyDaysAgo = new Date(now);
                thirtyDaysAgo.setDate(now.getDate() - 30);

                count = snap.docs.filter((d) => {
                  const created = new Date(d.data().issueDate);
                  return created <= thirtyDaysAgo;
                }).length;

                if (count > 0) {
                  messageBody = `${count} acconti attendono il saldo da oltre 30 giorni.`;
                  shouldSend = true;
                }
              } else if (rule.id === "low_lessons") {
                const snap = await db
                  .collection("enrollments")
                  .where("status", "==", "Active")
                  .get();
                count = snap.docs.filter(
                  (d) => (d.data().lessonsRemaining || 0) <= 2,
                ).length;

                if (count > 0) {
                  messageBody = `${count} allievi hanno quasi finito le lezioni.`;
                  shouldSend = true;
                }
              } else if (rule.id === "institutional_billing") {
                const snap = await db
                  .collection("quotes")
                  .where("status", "==", "Paid")
                  .get();
                let dueCount = 0;
                const threshold = new Date(now);
                threshold.setDate(now.getDate() + 45);

                snap.docs.forEach((qDoc) => {
                  const installments = qDoc.data().installments || [];
                  installments.forEach((inst) => {
                    if (!inst.isPaid) {
                      const due = new Date(inst.dueDate);
                      if (due >= now && due <= threshold) dueCount++;
                    }
                  });
                });
                count = dueCount;
                if (count > 0) {
                  messageBody = `${count} rate di progetti istituzionali in scadenza a breve.`;
                  shouldSend = true;
                }
              }

              // Preparazione messaggio
              if (shouldSend && rule.pushEnabled) {
                notificationsToSend.push({
                  title: `EP Alert: ${rule.label}`,
                  body: messageBody,
                  data: {
                    link: "/",
                    ruleId: rule.id,
                  },
                });
              }
            } catch (err) {
              console.error(`[ERROR] Errore logica regola ${rule.id}:`, err);
            }
          } // Chiude if (diffMinutes >= 0 && diffMinutes <= 5 && lastSentDate !== todayStr)
        }
      }
    } catch (e) {
      console.error("Error processing rules:", e);
    }

    // --- STEP C: INVIO MASSIVO ---
    if (notificationsToSend.length > 0 && allTokens.length > 0) {
      const messages = [];

      // Crea un messaggio per ogni combinazione (Notifica x Token)
      // Nota: FCM Multicast è meglio, ma qui usiamo sendAll per chiarezza
      notificationsToSend.forEach((note) => {
        allTokens.forEach((token) => {
          messages.push({
            token: token,
            notification: {
              title: note.title,
              body: note.body,
            },
            data: note.data,
            android: {
              priority: "high",
            },
            apns: {
              payload: {
                aps: {
                  "content-available": 1,
                },
              },
              headers: {
                "apns-priority": "10",
              },
            },
            webpush: {
              headers: {
                Urgency: "high",
              },
              fcmOptions: {
                link: note.data.link,
              },
              notification: {
                icon: "https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png",
                badge:
                  "https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png",
              },
            },
          });
        });
      });

      if (messages.length > 0) {
        try {
          // Batch send (max 500 per batch recommended, simplified here)
          const response = await messaging.sendEach(messages);
          console.log(
            `[SUCCESS] Inviati ${response.successCount} messaggi. Falliti: ${response.failureCount}`,
          );
        } catch (e) {
          console.error("[ERROR] Invio FCM fallito:", e);
        }
      }
    }
  },
);

// --- FUNZIONE 3: INVIO EMAIL (Nuova) ---
const gmailClientId = defineSecret("GMAIL_CLIENT_ID");
const gmailClientSecret = defineSecret("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = defineSecret("GMAIL_REFRESH_TOKEN");
const gmailSenderEmail = defineSecret("GMAIL_SENDER_EMAIL");

exports.sendEmail = onCall({
    region: "europe-west1",
    cors: true,
    secrets: [gmailClientId, gmailClientSecret, gmailRefreshToken, gmailSenderEmail]
}, async (request) => {
    // Lazy load dependencies to prevent cold start timeouts
    const { google } = require("googleapis");
    const nodemailer = require("nodemailer");

    const REDIRECT_URI = "https://developers.google.com/oauthplayground";

    const { to, subject, html, attachments } = request.data;

    if (!to || !subject || !html) {
        throw new HttpsError("invalid-argument", "Missing required fields: to, subject, html");
    }

    try {
        const clientId = gmailClientId.value();
        const clientSecret = gmailClientSecret.value();
        const refreshToken = gmailRefreshToken.value();
        const senderEmail = gmailSenderEmail.value();

        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
        oAuth2Client.setCredentials({ refresh_token: refreshToken });

        // 1. Ottieni Access Token fresco
        const accessToken = await oAuth2Client.getAccessToken();
        if (!accessToken.token) {
            throw new Error("Failed to generate access token");
        }

        // 2. Configura Nodemailer con OAuth2
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: senderEmail,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                accessToken: accessToken.token,
            },
        });

        // 3. Prepara gli allegati (se presenti)
        const mailOptions = {
            from: `Lab Easy Peasy <${senderEmail}>`,
            to: Array.isArray(to) ? to.join(",") : to,
            subject: subject,
            html: html,
            attachments: attachments || [],
        };

        // 4. Invia Email
        const info = await transporter.sendMail(mailOptions);
        
        logger.info("Email sent successfully:", info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        logger.error("Error sending email:", error);
        throw new HttpsError("internal", `Email sending failed: ${error.message}`);
    }
});
