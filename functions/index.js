
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
    region: "europe-west1", // Imposta la regione più vicina (es. Belgio per bassa latenza EU)
}, async (event) => {
    
    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    const options = { timeZone: "Europe/Rome", hour12: false };
    
    // Formatta l'ora come HH:mm (es. "09:30")
    const currentHour = now.toLocaleTimeString("it-IT", { ...options, hour: "2-digit", minute: "2-digit" });
    
    // Ottieni il giorno della settimana (0=Domenica, 1=Lunedì...)
    // Attenzione: getDay() in locale dipende dal server, usiamo toLocaleString per sicurezza
    const dayString = now.toLocaleString("en-US", { ...options, weekday: 'short' }); // Sun, Mon, Tue...
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[dayString];

    console.log(`[Planner Check] Checking for: Day ${currentDay}, Time ${currentHour}`);

    // 2. Recupera i Check da Firestore
    const checksSnapshot = await db.collection('periodicChecks').get();
    
    const notificationsToSend = [];

    checksSnapshot.forEach(doc => {
        const check = doc.data();
        
        // Verifica se il check è abilitato (pushEnabled), se il giorno corrisponde e se l'ora corrisponde
        if (check.pushEnabled && check.daysOfWeek.includes(currentDay) && check.startTime === currentHour) {
            notificationsToSend.push({
                title: `EP Planner: ${check.category}`,
                body: check.note || `È ora del controllo: ${check.subCategory || check.category}`,
                icon: 'https://ep-v1-gestionale.web.app/lemon_logo_150px.png' // URL assoluto necessario
            });
        }
    });

    if (notificationsToSend.length === 0) {
        console.log("Nessuna notifica pianificata per adesso.");
        return;
    }

    // 3. Recupera tutti i device token salvati
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
        console.log("Nessun dispositivo registrato a cui inviare notifiche.");
        return;
    }

    // 4. Invia le notifiche
    const sendPromises = [];
    
    for (const notif of notificationsToSend) {
        const message = {
            notification: {
                title: notif.title,
                body: notif.body,
            },
            webpush: {
                notification: {
                    icon: notif.icon,
                    requireInteraction: true,
                    click_action: "https://ep-v1-gestionale.web.app/" // Apre l'app al click
                }
            },
            tokens: tokens // Multicast message
        };

        sendPromises.push(messaging.sendMulticast(message));
    }

    try {
        const responses = await Promise.all(sendPromises);
        responses.forEach((resp, idx) => {
            console.log(`Inviata notifica ${idx + 1}: ${resp.successCount} successi, ${resp.failureCount} errori.`);
            if (resp.failureCount > 0) {
                const failedTokens = [];
                resp.responses.forEach((r, i) => {
                    if (!r.success) failedTokens.push(tokens[i]);
                });
                console.log('Token falliti (da pulire in futuro):', failedTokens);
                // Qui si potrebbe aggiungere logica per rimuovere token non più validi dal DB
            }
        });
    } catch (error) {
        console.error("Errore durante l'invio delle notifiche:", error);
    }
});
