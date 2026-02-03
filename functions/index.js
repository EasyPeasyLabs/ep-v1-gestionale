
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

    console.log(`[DEBUG START] Server Time: ${now.toISOString()} | Rome: ${currentHour} | Day Index: ${currentDay} (${dayString})`);

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
        console.log("[DEBUG] Nessun dispositivo (token) trovato nel database fcm_tokens.");
        return;
    } else {
        console.log(`[DEBUG] Trovati ${allTokens.length} dispositivi totali collegati a ${Object.keys(userTokensMap).length} utenti.`);
    }

    // --- STEP B: CONTROLLI PERIODICI (GLOBALI) ---
    const checksSnapshot = await db.collection('periodicChecks').get();
    checksSnapshot.forEach(doc => {
        const check = doc.data();
        if (check.pushEnabled && check.daysOfWeek.includes(currentDay) && check.startTime === currentHour) {
            console.log(`[DEBUG] Planner Match: ${check.category}`);
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

    console.log(`[DEBUG] Analisi Focus Mode: trovati ${prefsSnapshot.size} utenti con focus attivo.`);

    prefsSnapshot.forEach(doc => {
        const prefs = doc.data();
        const config = prefs.focusConfig;
        const userId = doc.id; 

        // Logica robusta per confronto giorni (stringa o numero)
        const dayMatch = config.days.some(d => String(d) === String(currentDay));
        const timeMatch = config.time === currentHour;

        if (dayMatch && timeMatch) {
            console.log(`[DEBUG] MATCH TROVATO per utente ${userId}! Orario ${config.time} OK.`);
            const targetTokens = userTokensMap[userId];
            
            if (targetTokens && targetTokens.length > 0) {
                notificationsToSend.push({
                    tokens: targetTokens,
                    title: "🔔 Focus Mode Attiva",
                    body: "È il momento del tuo briefing quotidiano. Tocca per aprire la Dashboard.",
                    tag: 'focus-mode',
                    icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
                });
            } else {
                console.log(`[DEBUG] ERRORE: Match trovato per ${userId} ma nessun token dispositivo disponibile.`);
            }
        } else {
            // Log solo se l'orario è vicino per capire errori di fuso orario
            const configHour = parseInt(config.time.split(':')[0]);
            const serverHour = parseInt(currentHour.split(':')[0]);
            if (configHour === serverHour) {
                console.log(`[DEBUG] Analisi ${userId}: Config [${config.time}, Giorni ${config.days}] vs Server [${currentHour}, Giorno ${currentDay}] -> NO MATCH`);
            }
        }
    });

    if (notificationsToSend.length === 0) {
        console.log("[DEBUG] Nessuna notifica da inviare in questo minuto.");
        return;
    }

    // --- STEP D: INVIO ---
    for (const notif of notificationsToSend) {
        const message = {
            notification: {
                title: notif.title,
                body: notif.body,
            },
            webpush: {
                headers: {
                    Urgency: "high"
                },
                notification: {
                    icon: notif.icon,
                    badge: notif.icon,
                    tag: notif.tag,
                    renotify: true,
                    requireInteraction: true
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
        const failedTokens = new Set(); 

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
            console.log(`[DEBUG] Rilevati ${failedTokens.size} token obsoleti. Pulizia in corso...`);
            const batch = db.batch();
            failedTokens.forEach(t => {
                const ref = db.collection('fcm_tokens').doc(t);
                batch.delete(ref);
            });
            await batch.commit();
        }

        console.log(`[SUCCESS] Inviate con successo ${notificationsToSend.length} tipologie di notifica.`);
    } catch (error) {
        console.error("[ERROR] Errore critico invio notifiche:", error);
    }
});
