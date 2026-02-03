
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
    const options = { timeZone: "Europe/Rome", hour12: false };
    const currentHour = now.toLocaleTimeString("it-IT", { ...options, hour: "2-digit", minute: "2-digit" });
    
    const dayString = now.toLocaleString("en-US", { ...options, weekday: 'short' });
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[dayString];

    console.log(`[DEBUG v3] Server Time: ${now.toISOString()} | Rome: ${currentHour} | Day Index: ${currentDay}`);

    const sendPromises = [];
    const notificationsToSend = []; // Array misto: { tokens: [], title, body, icon, tag }

    // --- STEP A: RECUPERA TOKEN UTENTI ---
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
        console.log("[DEBUG] Nessun token registrato.");
        return;
    }

    // --- STEP B: CHECK RULES (NUOVO SISTEMA) ---
    const rulesSnapshot = await db.collection('notification_rules').where('enabled', '==', true).get();
    
    if (rulesSnapshot.empty) {
        console.log("[DEBUG] Nessuna regola attiva trovata.");
    }

    for (const doc of rulesSnapshot.docs) {
        const rule = doc.data();
        
        // Verifica Giorno e Ora
        if (rule.days.includes(currentDay) && rule.time === currentHour) {
            console.log(`[DEBUG] MATCH REGOLA: ${rule.label} (${rule.id})`);
            
            // ESECUZIONE LOGICA SPECIFICA PER TIPO
            let count = 0;
            let messageBody = rule.description;

            try {
                if (rule.id === 'payment_required') {
                    // Conta iscrizioni Pending
                    const snap = await db.collection('enrollments').where('status', '==', 'Pending').get();
                    count = snap.size;
                    if (count > 0) messageBody = `Ci sono ${count} iscrizioni in attesa di pagamento.`;
                } 
                else if (rule.id === 'expiry') {
                    // Conta scadenze prossime (es. 7 giorni)
                    // Nota: Query complessa su date, semplifichiamo prendendo tutte le attive e filtrando in memoria per semplicità nella function
                    const snap = await db.collection('enrollments').where('status', '==', 'Active').get();
                    const nextWeek = new Date(now);
                    nextWeek.setDate(now.getDate() + 7);
                    
                    count = snap.docs.filter(d => {
                        const end = new Date(d.data().endDate);
                        return end >= now && end <= nextWeek;
                    }).length;
                    
                    if (count > 0) messageBody = `${count} iscrizioni scadranno nei prossimi 7 giorni.`;
                }
                else if (rule.id === 'balance_due') {
                    // Fatture di acconto vecchie > 30gg
                    const snap = await db.collection('invoices')
                        .where('isGhost', '==', true)
                        .where('status', '==', 'Draft')
                        .where('isDeleted', '==', false)
                        .get();
                    
                    // Filter in memory for date diff > 30 days
                    const thirtyDaysAgo = new Date(now);
                    thirtyDaysAgo.setDate(now.getDate() - 30);
                    
                    count = snap.docs.filter(d => {
                        const created = new Date(d.data().issueDate);
                        return created <= thirtyDaysAgo;
                    }).length;

                    if (count > 0) messageBody = `${count} acconti attendono il saldo da oltre 30 giorni.`;
                }
                else if (rule.id === 'low_lessons') {
                    // Lezioni residue <= 2
                    // Firestore non supporta where con filtro numerico su tutti i documenti efficientemente senza indice,
                    // ma con volumi medi possiamo fare query + filter
                    const snap = await db.collection('enrollments').where('status', '==', 'Active').get();
                    count = snap.docs.filter(d => (d.data().lessonsRemaining || 0) <= 2).length;
                    
                    if (count > 0) messageBody = `${count} allievi hanno quasi finito le lezioni.`;
                }
                else if (rule.id === 'institutional_billing') {
                    // Billing enti: rate in scadenza
                    // Richiede analisi profonda dei preventivi
                    const snap = await db.collection('quotes').where('status', '==', 'Paid').get(); // Status Paid = Active for institutional logic usually
                    let dueCount = 0;
                    const threshold = new Date(now);
                    threshold.setDate(now.getDate() + 45); // 45gg lookahead

                    snap.docs.forEach(qDoc => {
                        const installments = qDoc.data().installments || [];
                        installments.forEach(inst => {
                            if (!inst.isPaid) {
                                const due = new Date(inst.dueDate);
                                if (due >= now && due <= threshold) dueCount++;
                            }
                        });
                    });
                    count = dueCount;
                    if (count > 0) messageBody = `${count} rate di progetti istituzionali in scadenza a breve.`;
                }

                // INVIO SE CI SONO RISULTATI
                if (count > 0 && rule.pushEnabled) {
                    notificationsToSend.push({
                        tokens: allTokens, // Broadcast agli admin
                        title: `EP Alert: ${rule.label}`,
                        body: messageBody,
                        tag: `rule-${rule.id}`,
                        icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
                    });
                } else if (count > 0 && !rule.pushEnabled) {
                    console.log(`[DEBUG] Match trovato (${count}) ma PUSH disabilitato per ${rule.id}`);
                }

            } catch (err) {
                console.error(`[ERROR] Errore esecuzione regola ${rule.id}:`, err);
            }
        }
    }

    // --- STEP C: FOCUS MODE (Manteniamo la logica esistente se non confligge) ---
    // (Opzionale: Potremmo migrare anche il Focus Mode nel nuovo sistema, ma per ora lo lasciamo separato come "Briefing Personale")
    const prefsSnapshot = await db.collection('user_preferences')
        .where('focusConfig.enabled', '==', true)
        .get();

    prefsSnapshot.forEach(doc => {
        const prefs = doc.data();
        const config = prefs.focusConfig;
        const userId = doc.id; 
        
        // Confronto stringa per sicurezza
        const dayMatch = config.days.some(d => String(d) === String(currentDay));
        const timeMatch = config.time === currentHour;

        if (dayMatch && timeMatch) {
            const targetTokens = userTokensMap[userId];
            if (targetTokens && targetTokens.length > 0) {
                notificationsToSend.push({
                    tokens: targetTokens,
                    title: "🔔 Focus Mode",
                    body: "Briefing quotidiano pronto. Tocca per aprire.",
                    tag: 'focus-mode',
                    icon: 'https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png'
                });
            }
        }
    });

    if (notificationsToSend.length === 0) {
        console.log("[DEBUG] Nessuna notifica da inviare.");
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
                headers: { Urgency: "high" },
                notification: {
                    icon: notif.icon,
                    tag: notif.tag,
                    renotify: true,
                    requireInteraction: true
                },
                fcm_options: { link: "https://ep-v1-gestionale.vercel.app/" }
            },
            tokens: notif.tokens
        };

        sendPromises.push(messaging.sendEachForMulticast(message));
    }

    // --- STEP E: PULIZIA ---
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
            console.log(`[DEBUG] Pulizia ${failedTokens.size} token invalidi.`);
            const batch = db.batch();
            failedTokens.forEach(t => {
                const ref = db.collection('fcm_tokens').doc(t);
                batch.delete(ref);
            });
            await batch.commit();
        }
        console.log(`[SUCCESS] Inviate ${notificationsToSend.length} notifiche.`);
    } catch (error) {
        console.error("[ERROR] Critical send error:", error);
    }
});
