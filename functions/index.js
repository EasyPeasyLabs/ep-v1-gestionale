
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// Questa funzione gira sui server di Google ogni minuto
// Cron: * * * * * (Ogni minuto)
exports.checkPeriodicNotifications = onSchedule({
    schedule: "* * * * *",
    timeZone: "Europe/Rome",
    region: "europe-west1", 
}, async (event) => {
    
    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    const options = { timeZone: "Europe/Rome", hour12: false };
    const currentHour = now.toLocaleTimeString("it-IT", { ...options, hour: "2-digit", minute: "2-digit" });
    
    const dayString = now.toLocaleString("en-US", { ...options, weekday: 'short' });
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[dayString];

    console.log(`[Time Check] Day ${currentDay}, Time ${currentHour}`);

    const sendPromises = [];
    const notificationsToSend = []; // Array misto: { tokens: [], title, body, icon, tag }

    // --- STEP A: RECUPERA TOKEN E ORGANIZZA PER UTENTE ---
    // Mappa: userId -> [tokens]
    const userTokensMap = {};
    const allTokens = [];
    
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    tokensSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.token) {
            allTokens.push(data.token);
            if (data.userId) {
                if (!userTokensMap[data.userId]) userTokensMap[data.userId] = [];
                userTokensMap[data.userId].push(data.token);
            }
        }
    });

    if (allTokens.length === 0) {
        console.log("Nessun dispositivo registrato.");
        return;
    }

    // --- STEP B: CONTROLLI PERIODICI (GLOBALI) ---
    // Inviati a TUTTI i dispositivi registrati (Admin/Staff)
    const checksSnapshot = await db.collection('periodicChecks').get();
    checksSnapshot.forEach(doc => {
        const check = doc.data();
        if (check.pushEnabled && check.daysOfWeek.includes(currentDay) && check.startTime === currentHour) {
            notificationsToSend.push({
                tokens: allTokens, // Broadcast
                title: `EP Planner: ${check.category}`,
                body: check.note || `È ora del controllo: ${check.subCategory || check.category}`,
                tag: `planner-${doc.id}`,
                icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
            });
        }
    });

    // --- STEP C: FOCUS MODE (PERSONALE) ---
    // Inviati SOLO all'utente specifico
    const prefsSnapshot = await db.collection('user_preferences')
        .where('focusConfig.enabled', '==', true)
        .get();

    prefsSnapshot.forEach(doc => {
        const prefs = doc.data();
        const config = prefs.focusConfig;
        const userId = doc.id; // L'ID del documento user_preferences corrisponde allo userId

        if (config && config.days.includes(currentDay) && config.time === currentHour) {
            const targetTokens = userTokensMap[userId];
            
            if (targetTokens && targetTokens.length > 0) {
                notificationsToSend.push({
                    tokens: targetTokens, // Unicast/Multicast to user devices only
                    title: "🔔 Focus Mode Attiva",
                    body: "È il momento del tuo briefing quotidiano. Tocca per aprire la Dashboard.",
                    tag: 'focus-mode',
                    icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
                });
            } else {
                console.log(`Focus Mode trigger per user ${userId} ma nessun token trovato.`);
            }
        }
    });

    // --- STEP D: INVIO ---
    for (const notif of notificationsToSend) {
        const message = {
            notification: {
                title: notif.title,
                body: notif.body,
            },
            webpush: {
                headers: {
                    Urgency: "high" // Fondamentale per svegliare Android in Doze mode
                },
                notification: {
                    icon: notif.icon,
                    badge: notif.icon,
                    tag: notif.tag,
                    renotify: true, // Suona anche se c'è già una notifica con lo stesso tag
                    requireInteraction: true // Rimane a schermo
                },
                fcm_options: {
                    link: "https://ep-v1-gestionale.vercel.app/"
                }
            },
            tokens: notif.tokens
        };

        sendPromises.push(messaging.sendMulticast(message));
    }

    // --- STEP E: PULIZIA TOKEN INVALIDI ---
    try {
        const responses = await Promise.all(sendPromises);
        const failedTokens = new Set(); // Set per unicità

        // Analizza risposte per trovare token scaduti
        responses.forEach((resp, idx) => {
            if (resp.failureCount > 0) {
                const usedTokens = notificationsToSend[idx].tokens;
                resp.responses.forEach((r, tokenIdx) => {
                    if (!r.success) {
                        const errCode = r.error.code;
                        if (errCode === 'messaging/invalid-registration-token' || 
                            errCode === 'messaging/registration-token-not-registered') {
                            failedTokens.add(usedTokens[tokenIdx]);
                        }
                    }
                });
            }
        });

        if (failedTokens.size > 0) {
            console.log(`Rilevati ${failedTokens.size} token non validi. Pulizia...`);
            const batch = db.batch();
            failedTokens.forEach(t => {
                const ref = db.collection('fcm_tokens').doc(t);
                batch.delete(ref);
            });
            await batch.commit();
        }

        console.log(`Inviate ${notificationsToSend.length} tipologie di notifica.`);
    } catch (error) {
        console.error("Errore critico invio notifiche:", error);
    }
});
