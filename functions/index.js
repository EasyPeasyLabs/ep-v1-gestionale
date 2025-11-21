
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
    region: "europe-west1", // Standard Firebase region (Belgium)
}, async (event) => {
    
    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    const options = { timeZone: "Europe/Rome", hour12: false };
    
    // Formatta l'ora come HH:mm (es. "09:30")
    const currentHour = now.toLocaleTimeString("it-IT", { ...options, hour: "2-digit", minute: "2-digit" });
    
    // Ottieni il giorno della settimana (0=Domenica, 1=Lunedì...)
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
                icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png' 
            });
        }
    });

    if (notificationsToSend.length === 0) {
        console.log("Nessuna notifica pianificata per adesso.");
        return;
    }

    // 3. Recupera tutti i device token salvati
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    
    if (tokensSnapshot.empty) {
        console.log("Nessun dispositivo registrato a cui inviare notifiche.");
        return;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    console.log(`Trovati ${tokens.length} dispositivi target.`);

    // 4. Invia le notifiche (Configurazione Web Push Pura per PWA)
    const sendPromises = [];
    
    for (const notif of notificationsToSend) {
        const message = {
            notification: {
                title: notif.title,
                body: notif.body,
            },
            // Configurazione Web Push specifica per PWA (Android Chrome & Desktop)
            webpush: {
                headers: {
                    Urgency: "high" // Importante per Android Doze mode
                },
                notification: {
                    icon: notif.icon,
                    badge: notif.icon,
                    requireInteraction: true, // La notifica rimane visibile finché l'utente non interagisce
                    // Azioni al click gestite dal Service Worker o fcm_options
                },
                fcm_options: {
                    link: "https://ep-v1-gestionale.vercel.app/"
                }
            },
            data: {
                link: "https://ep-v1-gestionale.vercel.app/" // Fallback data payload
            },
            tokens: tokens // Multicast message
        };

        sendPromises.push(messaging.sendMulticast(message));
    }

    // 5. Gestione Risultati e Pulizia Token Invalidi
    try {
        const responses = await Promise.all(sendPromises);
        const failedTokens = [];

        responses.forEach((resp) => {
            if (resp.failureCount > 0) {
                resp.responses.forEach((r, i) => {
                    if (!r.success) {
                        // Raccoglie i token non più validi
                        failedTokens.push(tokens[i]);
                    }
                });
            }
        });

        if (failedTokens.length > 0) {
            console.log(`Rilevati ${failedTokens.length} token non validi. Avvio pulizia...`);
            const batch = db.batch();
            failedTokens.forEach(t => {
                const ref = db.collection('fcm_tokens').doc(t);
                batch.delete(ref);
            });
            await batch.commit();
            console.log("Pulizia token completata.");
        }

        console.log("Ciclo notifiche completato.");
    } catch (error) {
        console.error("Errore durante l'invio delle notifiche:", error);
    }
});
