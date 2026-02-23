const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

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
    // 1. Controllo Metodo
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // 2. Controllo Sicurezza (Bearer Token)
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

    // 3. Validazione Payload JSON
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

    try {
      // 4. Persistenza su Firestore
      // Salviamo nella collezione "buffer" per non sporcare i dati reali
      const leadDoc = {
        ...data,
        source: "projectB_api",
        status: "pending", // pending | processed | rejected
        receivedAt: new Date().toISOString(),
        // Aggiungiamo campi di utilità per ricerca
        searchableName: (data.nome + " " + data.cognome).toLowerCase(),
        metadata: {
          userAgent: req.headers["user-agent"],
          ip: req.ip,
        },
      };

      const docRef = await db.collection("incoming_leads").add(leadDoc);

      console.log(`[API] Lead ricevuto e salvato con ID: ${docRef.id}`);

      // 5. Risposta al mittente
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

// --- FUNZIONE 2: CRON JOB NOTIFICHE (Esistente) ---
// Questa funzione gira sui server di Google ogni minuto
exports.checkPeriodicNotifications = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Europe/Rome",
    region: "europe-west1",
  },
  async (event) => {
    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    // Convert to Rome Timezone Object to ensure correct hour/day even if server is UTC
    const romeTimeStr = now.toLocaleString("en-US", {
      timeZone: "Europe/Rome",
    });
    const romeTime = new Date(romeTimeStr);

    const currentHour =
      romeTime.getHours().toString().padStart(2, "0") +
      ":" +
      romeTime.getMinutes().toString().padStart(2, "0");
    const currentDay = romeTime.getDay(); // 0 = Sunday, 1 = Monday, ... (Standard JS)

    console.log(
      `[DEBUG v4] Rome Time: ${romeTime.toISOString()} | Hour: ${currentHour} | Day Index: ${currentDay}`,
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
          const todayStr = romeTime.toISOString().split("T")[0];
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
                const nextWeek = new Date(romeTime);
                nextWeek.setDate(romeTime.getDate() + 7);

                count = snap.docs.filter((d) => {
                  const end = new Date(d.data().endDate);
                  return end >= romeTime && end <= nextWeek;
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

                const thirtyDaysAgo = new Date(romeTime);
                thirtyDaysAgo.setDate(romeTime.getDate() - 30);

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
                const threshold = new Date(romeTime);
                threshold.setDate(romeTime.getDate() + 45);

                snap.docs.forEach((qDoc) => {
                  const installments = qDoc.data().installments || [];
                  installments.forEach((inst) => {
                    if (!inst.isPaid) {
                      const due = new Date(inst.dueDate);
                      if (due >= romeTime && due <= threshold) dueCount++;
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
