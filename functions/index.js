
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// Questa funzione gira sui server di Google ogni minuto
exports.checkPeriodicNotifications = onSchedule({
    schedule: "* * * * *",
    timeZone: "Europe/Rome",
    region: "europe-west1", 
}, async (event) => {
    
    // 1. Calcola Ora e Giorno corrente in Italia
    const now = new Date();
    // Convert to Rome Timezone Object to ensure correct hour/day even if server is UTC
    const romeTimeStr = now.toLocaleString("en-US", { timeZone: "Europe/Rome" });
    const romeTime = new Date(romeTimeStr);
    
    const currentHour = romeTime.getHours().toString().padStart(2, '0') + ':' + romeTime.getMinutes().toString().padStart(2, '0');
    const currentDay = romeTime.getDay(); // 0 = Sunday, 1 = Monday, ... (Standard JS)

    console.log(`[DEBUG v4] Rome Time: ${romeTime.toISOString()} | Hour: ${currentHour} | Day Index: ${currentDay}`);

    const notificationsToSend = []; 

    // --- STEP A: RECUPERA TOKEN UTENTI ---
    const allTokens = [];
    
    try {
        const tokensSnapshot = await db.collection('fcm_tokens').get();
        tokensSnapshot.forEach(doc => {
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
        const rulesSnapshot = await db.collection('notification_rules').where('enabled', '==', true).get();
        
        if (rulesSnapshot.empty) {
            console.log("[DEBUG] Nessuna regola attiva trovata.");
        }

        for (const doc of rulesSnapshot.docs) {
            const rule = doc.data();
            
            // Verifica Giorno e Ora
            // rule.days deve essere array di interi [0..6]
            if (rule.days && rule.days.includes(currentDay) && rule.time === currentHour) {
                console.log(`[DEBUG] MATCH REGOLA: ${rule.label} (${rule.id})`);
                
                let count = 0;
                let messageBody = rule.description;
                let shouldSend = false;

                try {
                    if (rule.isCustom) {
                        // REGOLA PERSONALIZZATA (Promemoria)
                        shouldSend = true;
                    } 
                    else if (rule.id === 'payment_required') {
                        const snap = await db.collection('enrollments').where('status', '==', 'Pending').get();
                        count = snap.size;
                        if (count > 0) {
                            messageBody = `Ci sono ${count} iscrizioni in attesa di pagamento.`;
                            shouldSend = true;
                        }
                    } 
                    else if (rule.id === 'expiry') {
                        const snap = await db.collection('enrollments').where('status', '==', 'Active').get();
                        const nextWeek = new Date(romeTime);
                        nextWeek.setDate(romeTime.getDate() + 7);
                        
                        count = snap.docs.filter(d => {
                            const end = new Date(d.data().endDate);
                            return end >= romeTime && end <= nextWeek;
                        }).length;
                        
                        if (count > 0) {
                            messageBody = `${count} iscrizioni scadranno nei prossimi 7 giorni.`;
                            shouldSend = true;
                        }
                    }
                    else if (rule.id === 'balance_due') {
                        const snap = await db.collection('invoices')
                            .where('isGhost', '==', true)
                            .where('status', '==', 'Draft')
                            .where('isDeleted', '==', false)
                            .get();
                        
                        const thirtyDaysAgo = new Date(romeTime);
                        thirtyDaysAgo.setDate(romeTime.getDate() - 30);
                        
                        count = snap.docs.filter(d => {
                            const created = new Date(d.data().issueDate);
                            return created <= thirtyDaysAgo;
                        }).length;

                        if (count > 0) {
                            messageBody = `${count} acconti attendono il saldo da oltre 30 giorni.`;
                            shouldSend = true;
                        }
                    }
                    else if (rule.id === 'low_lessons') {
                        const snap = await db.collection('enrollments').where('status', '==', 'Active').get();
                        count = snap.docs.filter(d => (d.data().lessonsRemaining || 0) <= 2).length;
                        
                        if (count > 0) {
                            messageBody = `${count} allievi hanno quasi finito le lezioni.`;
                            shouldSend = true;
                        }
                    }
                    else if (rule.id === 'institutional_billing') {
                        const snap = await db.collection('quotes').where('status', '==', 'Paid').get();
                        let dueCount = 0;
                        const threshold = new Date(romeTime);
                        threshold.setDate(romeTime.getDate() + 45); 

                        snap.docs.forEach(qDoc => {
                            const installments = qDoc.data().installments || [];
                            installments.forEach(inst => {
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
                                link: '/',
                                ruleId: rule.id
                            }
                        });
                    } 

                } catch (err) {
                    console.error(`[ERROR] Errore logica regola ${rule.id}:`, err);
                }
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
        notificationsToSend.forEach(note => {
            allTokens.forEach(token => {
                messages.push({
                    token: token,
                    notification: {
                        title: note.title,
                        body: note.body,
                    },
                    data: note.data,
                    webpush: {
                        fcmOptions: {
                            link: note.data.link
                        },
                        notification: {
                            icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png',
                            badge: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
                        }
                    }
                });
            });
        });

        if (messages.length > 0) {
            try {
                // Batch send (max 500 per batch recommended, simplified here)
                const response = await messaging.sendEach(messages);
                console.log(`[SUCCESS] Inviati ${response.successCount} messaggi. Falliti: ${response.failureCount}`);
            } catch (e) {
                console.error("[ERROR] Invio FCM fallito:", e);
            }
        }
    }
});
    