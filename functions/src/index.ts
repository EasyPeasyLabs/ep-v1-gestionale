import { onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Inizializza Firebase Admin SDK solo se non già inizializzato
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// --- CONFIGURAZIONE SICUREZZA ---
const API_SHARED_SECRET = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";

// --- CONFIGURAZIONE GMAIL OAUTH2 (SECRETS) ---
const gmailClientId = defineSecret("GMAIL_CLIENT_ID");
const gmailClientSecret = defineSecret("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = defineSecret("GMAIL_REFRESH_TOKEN");
const SENDER_EMAIL = "labeasypeasy@gmail.com";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

// --- FUNZIONE: INVIO EMAIL (OTTIMIZZATA CON LAZY LOADING) ---
export const sendEmail = onCall({ 
    region: "europe-west1",
    cors: true, 
    secrets: [gmailClientId, gmailClientSecret, gmailRefreshToken] 
}, async (request) => {
    // Caricamento librerie pesanti solo all'esecuzione
    const { google } = await import("googleapis");
    const nodemailer = await import("nodemailer");

    const { to, subject, html, attachments } = request.data;

    if (!to || !subject || !html) {
        throw new Error("Missing required fields: to, subject, html");
    }

    try {
        const clientId = gmailClientId.value();
        const clientSecret = gmailClientSecret.value();
        const refreshToken = gmailRefreshToken.value();

        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
        oAuth2Client.setCredentials({ refresh_token: refreshToken });

        const accessToken = await oAuth2Client.getAccessToken();
        if (!accessToken.token) {
            throw new Error("Failed to generate access token");
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: SENDER_EMAIL,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                accessToken: accessToken.token,
            } as any,
        });

        const mailOptions = {
            from: `Lab Easy Peasy <${SENDER_EMAIL}>`,
            to: Array.isArray(to) ? to.join(",") : to,
            subject: subject,
            html: html,
            attachments: attachments || [],
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info("Email sent successfully:", info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error: any) {
        logger.error("Error sending email:", error?.message || error);
        throw new Error(`Email sending failed: ${error?.message || 'Unknown error'}`);
    }
});

// --- HELPER PER INVIO NOTIFICHE PUSH ---
async function sendPushToAllTokens(title: string, body: string, extraData: Record<string, string>) {
    try {
        const tokensSnapshot = await admin.firestore().collection("fcm_tokens").get();
        const tokens: string[] = [];
        
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) {
                tokens.push(data.token);
            }
        });

        if (tokens.length === 0) {
            logger.info("No FCM tokens found in database. Skipping notification.");
            return;
        }

        const message: admin.messaging.MulticastMessage = {
            tokens: tokens,
            notification: {
                title: title,
                body: body,
            },
            data: extraData,
            android: {
                notification: {
                    icon: 'stock_ticker_update',
                    color: '#4f46e5',
                },
            },
            apns: {
                payload: {
                    aps: {
                        badge: 1,
                        sound: 'default',
                    },
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        
        logger.info(`Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);

        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' || 
                        errorCode === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                logger.info(`Cleaning up ${failedTokens.length} invalid tokens...`);
                const batch = admin.firestore().batch();
                failedTokens.forEach(token => {
                    batch.delete(admin.firestore().collection("fcm_tokens").doc(token));
                });
                await batch.commit();
            }
        }
    } catch (error: any) {
        logger.error("Error sending push notifications:", error?.message || error);
    }
}

// --- TRIGGER NOTIFICHE PUSH PER NUOVI LEAD ---
export const onLeadCreated = onDocumentCreated({
    region: "europe-west1",
    document: "incoming_leads/{leadId}"
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const leadData = snapshot.data();
    const nome = leadData.nome || leadData.firstName || 'Nuovo';
    const cognome = leadData.cognome || leadData.lastName || 'Contatto';
    const sede = leadData.sede || leadData.selectedLocation || 'Sede non specificata';
    
    const title = "👤 Nuovo Contatto Web";
    const body = `${nome} ${cognome} ha richiesto informazioni per la sede di ${sede}. Contattalo subito!`;

    await sendPushToAllTokens(title, body, {
        leadId: event.params.leadId,
        type: 'lead',
        click_action: 'WEB_REQUESTS'
    });
});

// --- TRIGGER NOTIFICHE PUSH PER NUOVE ISCRIZIONI ---
export const onEnrollmentCreated = onDocumentCreated({
    region: "europe-west1",
    document: "enrollments/{enrollmentId}"
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const enrData = snapshot.data();
    
    if (enrData.source !== 'portal') {
        logger.info(`Enrollment ${event.params.enrollmentId} skipped (source: ${enrData.source || 'manual'})`);
        return;
    }
    
    const clientName = enrData.clientName || 'Genitore';
    const childName = enrData.childName || 'Allievo';
    const subName = enrData.subscriptionName || 'Abbonamento';
    const price = enrData.price || 0;
    const status = enrData.status || 'pending';
    const isPaid = status === 'active';
    
    const title = isPaid ? "🎓 Nuova Iscrizione Portal (PAGATA)" : "🎓 Nuova Iscrizione Portal (DA SALDARE)";
    const body = `${clientName} ha iscritto ${childName} a ${subName}. Stato: ${isPaid ? 'Pagato' : 'In attesa di saldo'}.`;

    await sendPushToAllTokens(title, body, {
        enrollmentId: event.params.enrollmentId,
        type: 'enrollment',
        click_action: 'ENROLLMENTS'
    });

    if (!isPaid) {
        const reminderTitle = "💰 Promemoria Incasso in Sede";
        const reminderBody = `Attenzione: ${childName} ha prenotato il posto. Ricordati di registrare l'incasso di ${price}€ al suo arrivo.`;
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sendPushToAllTokens(reminderTitle, reminderBody, {
            enrollmentId: event.params.enrollmentId,
            type: 'payment_reminder'
        });
    }

    const needsStampDuty = price >= 77;
    const invoiceReminderTitle = needsStampDuty ? "⚠️ AVVISO BOLLO - Fatturazione" : "📄 Nuova Fattura da Emettere";
    
    let invoiceReminderBody = "";
    if (needsStampDuty) {
        const totalPrice = price + 2;
        invoiceReminderBody = `Emetti fattura per ${childName}. Importo ≥ 77€: verifica l'aggiunta dei 2€ di bollo (Totale dovuto: ${totalPrice}€).`;
    } else {
        invoiceReminderBody = `Emetti fattura per ${childName} - Importo: ${price}€.`;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    await sendPushToAllTokens(invoiceReminderTitle, invoiceReminderBody, {
        enrollmentId: event.params.enrollmentId,
        type: 'invoice_reminder',
        needsStampDuty: String(needsStampDuty)
    });
});

// --- GATEWAY PER ISCRIZIONI (ISOLAMENTO DOMINIO & WHATSAPP PREVIEW) ---
export const enrollmentGateway = onRequest({ 
    region: "europe-west1",
    cors: true 
}, async (req, res) => {
    const id = req.query.id as string || req.path.split('/').pop();
    
    if (!id || id === 'i') {
        res.status(400).send("ID Iscrizione mancante.");
        return;
    }

    const logoUrl = "https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png";
    const destinationUrl = `https://ep-v1-gestionale.vercel.app/#/iscrizione?id=${id}`;

    const html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Easy Peasy Labs</title>
    <meta property="og:title" content="Easy Peasy Labs" />
    <meta property="og:description" content="${id}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://easypeasylabs.vercel.app/i/${id}" />
    <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f6f8fa; color: #3C3C52; }
        .loader { border: 4px solid #e5e7eb; border-top: 4px solid #3C3C52; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
    </style>
    <script>
        window.location.href = "${destinationUrl}";
    </script>
</head>
<body>
    <div style="text-align: center;">
        <div class="loader" style="margin: 0 auto 20px;"></div>
        <p>Caricamento modulo di iscrizione...</p>
    </div>
</body>
</html>
    `;
    res.status(200).send(html);
});

// --- API PUBBLICA PER PAGINA ESTERNA (PROGETTO B) - V2 ---
export const getPublicSlotsV2 = onRequest({ 
    region: "europe-west1",
    cors: true 
}, async (req, res) => {
    const authHeader = req.headers['x-bridge-key'];
    if (!authHeader || authHeader !== API_SHARED_SECRET) {
        res.status(403).json({ error: "Forbidden: Invalid API Key" });
        return;
    }

    try {
        const [suppliersSnap, enrollmentsSnap, subscriptionsSnap] = await Promise.all([
            admin.firestore().collection('suppliers').where('isDeleted', '==', false).get(),
            admin.firestore().collection('enrollments')
                .where('status', 'in', ['active', 'pending', 'confirmed', 'Active', 'Pending', 'Confirmed']) 
                .get(),
            admin.firestore().collection('subscriptionTypes').get()
        ]);

        const activeSubs: any[] = [];
        subscriptionsSnap.forEach(doc => {
            const sub = doc.data();
            if (sub.isPubliclyVisible !== false) {
                activeSubs.push({ id: doc.id, ...sub });
            }
        });

        const occupancyMap = new Map<string, number>();

        enrollmentsSnap.forEach(doc => {
            const data = doc.data();
            const locId = data.locationId;
            const appts = data.appointments || [];
            const lessonsRemaining = data.lessonsRemaining !== undefined ? Number(data.lessonsRemaining) : 1;

            if (locId && appts.length > 0 && lessonsRemaining > 0) {
                appts.forEach((appt: any) => {
                    if (appt && appt.dayOfWeek !== undefined && appt.startTime) {
                        const day = typeof appt.dayOfWeek === 'string' ? parseInt(appt.dayOfWeek) : appt.dayOfWeek;
                        const key = `${locId}_${day}_${appt.startTime}`;
                        occupancyMap.set(key, (occupancyMap.get(key) || 0) + 1);
                    }
                });
            }
        });

        const results: any[] = [];
        suppliersSnap.forEach(doc => {
            const supplierData = doc.data();
            const locations = supplierData.locations || [];
            locations.forEach((loc: any) => {
                if (loc.isPubliclyVisible === false || loc.closedAt) return;
                const locationCapacity = loc.capacity ? parseInt(String(loc.capacity)) : 15;
                
                // Filtro e Processamento Slot Fisici
                const allSlots = loc.availability || [];
                const visibleSlots = allSlots.filter((slot: any) => slot.isPubliclyVisible !== false).map((s: any) => {
                    let minAge = 0;
                    let maxAge = 99;
                    if (s.minAge !== undefined) minAge = Number(s.minAge);
                    if (s.maxAge !== undefined) maxAge = Number(s.maxAge);
                    if (s.minAge === undefined && s.maxAge === undefined && s.ageRange) {
                        const parts = String(s.ageRange).split('-');
                        if (parts.length === 2) {
                            minAge = parseFloat(parts[0]) || 0;
                            maxAge = parseFloat(parts[1]) || 99;
                        }
                    }
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
                const slotsByDay: Record<number, any[]> = {};
                visibleSlots.forEach((s: any) => {
                    if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
                    slotsByDay[s.dayOfWeek].push(s);
                });

                const locationBundles: any[] = [];

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
                            // Un bundle è disponibile solo se TUTTI i suoi slot fisici hanno posto.
                            // Prendiamo il minimo dei posti disponibili tra tutti gli slot inclusi.
                            let minAvailableSeatsInBundle = locationCapacity;
                            includedSlots.forEach(s => {
                                const occupancyKey = `${loc.id}_${dayOfWeek}_${s.startTime}`;
                                const occupiedSeats = occupancyMap.get(occupancyKey) || 0;
                                const available = Math.max(0, locationCapacity - occupiedSeats);
                                if (available < minAvailableSeatsInBundle) {
                                    minAvailableSeatsInBundle = available;
                                }
                            });

                            locationBundles.push({
                                bundleId: sub.id,
                                name: sub.name,
                                publicName: sub.publicName || sub.name,
                                description: sub.description || '',
                                price: sub.price || 0,
                                dayOfWeek: dayOfWeek,
                                minAge: bundleMinAge,
                                maxAge: bundleMaxAge,
                                capacity: locationCapacity,
                                availableSeats: minAvailableSeatsInBundle,
                                isFull: minAvailableSeatsInBundle === 0,
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
                        address: loc.address || loc.indirizzo || '',
                        city: loc.city || loc.citta || supplierData.city || '',
                        googleMapsLink: loc.googleMapsLink || '',
                        bundles: locationBundles 
                    });
                }
            });
        });
        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        logger.error("Error fetching public slots v2:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch slots", details: error?.message });
    }
});

// --- API RICEZIONE LEAD V2 (PROGETTO B) ---
export const receiveLeadV2 = onRequest({ 
    region: "europe-west1",
    cors: true 
}, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const authHeader = req.headers['x-bridge-key'];
    if (!authHeader || authHeader !== API_SHARED_SECRET) {
        res.status(403).json({ error: "Forbidden: Invalid API Key" });
        return;
    }

    try {
        const data = req.body;
        const leadDoc = {
            ...data,
            source: "projectB_api_v2",
            status: "pending",
            createdAt: new Date().toISOString()
        };

        const docRef = await admin.firestore().collection("incoming_leads").add(leadDoc);
        res.status(200).json({ success: true, referenceId: docRef.id });
    } catch (error: any) {
        logger.error("Error saving lead v2:", error?.message || error);
        res.status(500).json({ error: "Internal Server Error", details: error?.message });
    }
});

// --- CRON JOB NOTIFICHE PERIODICHE ---
export const checkPeriodicNotifications = onSchedule({
    schedule: "* * * * *",
    timeZone: "Europe/Rome",
    region: "europe-west1",
}, async (event) => {
    try {
        const db = admin.firestore();
        const now = new Date();
        
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Rome',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value;
        const currentHour = `${getPart('hour')}:${getPart('minute')}`;
        const romeDate = new Date(Date.UTC(Number(getPart('year')), Number(getPart('month')) - 1, Number(getPart('day'))));
        const currentDay = romeDate.getUTCDay();
        const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

        const tokensSnapshot = await db.collection("fcm_tokens").get();
        const allTokens: string[] = [];
        tokensSnapshot.forEach(doc => { if (doc.data().token) allTokens.push(doc.data().token); });
        if (allTokens.length === 0) return;

        const rulesSnapshot = await db.collection("notification_rules").where("enabled", "==", true).get();
        
        for (const doc of rulesSnapshot.docs) {
            const rule = doc.data();
            if (rule.days && rule.days.includes(currentDay)) {
                const [ruleH, ruleM] = (rule.time || "00:00").split(":").map(Number);
                const [currH, currM] = currentHour.split(":").map(Number);
                const diff = (currH * 60 + currM) - (ruleH * 60 + ruleM);

                if (diff >= 0 && diff <= 5 && rule.lastSentDate !== todayStr) {
                    await doc.ref.update({ lastSentDate: todayStr });
                    const message = {
                        tokens: allTokens,
                        notification: { title: `EP Alert: ${rule.label}`, body: rule.description },
                        data: { link: "/", ruleId: rule.id }
                    };
                    await admin.messaging().sendEachForMulticast(message);
                }
            }
        }
    } catch (error: any) {
        logger.error("Error in periodic notifications:", error?.message || error);
    }
});
