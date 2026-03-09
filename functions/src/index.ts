import { onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { google } from "googleapis";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Inizializza Firebase Admin SDK
admin.initializeApp();

// --- CONFIGURAZIONE GMAIL OAUTH2 (SECRETS) ---
const gmailClientId = defineSecret("GMAIL_CLIENT_ID");
const gmailClientSecret = defineSecret("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = defineSecret("GMAIL_REFRESH_TOKEN");
const SENDER_EMAIL = "labeasypeasy@gmail.com";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

export const sendEmail = onCall({ 
    cors: true, 
    secrets: [gmailClientId, gmailClientSecret, gmailRefreshToken] 
}, async (request) => {
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
                user: SENDER_EMAIL,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                accessToken: accessToken.token,
            },
        });

        // 3. Prepara gli allegati (se presenti)
        const mailOptions = {
            from: `Lab Easy Peasy <${SENDER_EMAIL}>`,
            to: Array.isArray(to) ? to.join(",") : to,
            subject: subject,
            html: html,
            attachments: attachments || [],
        };

        // 4. Invia Email
        const info = await transporter.sendMail(mailOptions);
        
        logger.info("Email sent successfully:", info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error: unknown) {
        const err = error as Error;
        logger.error("Error sending email:", err);
        throw new Error(`Email sending failed: ${err.message}`);
    }
});

// --- HELPER PER INVIO NOTIFICHE PUSH ---
async function sendPushToAllTokens(title: string, body: string, extraData: Record<string, string>) {
    try {
        // Recupera tutti i token FCM registrati
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

        // Prepara il messaggio
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

        // Invia la notifica multicast
        const response = await admin.messaging().sendEachForMulticast(message);
        
        logger.info(`Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);

        // Gestione dei token non validi (pulizia)
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
    } catch (error) {
        logger.error("Error sending push notifications:", error);
    }
}

// Helper per formattare la data in italiano
const formatItalianDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        const dayName = days[date.getDay()];
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${dayName} ${day}/${month}`;
    } catch (e) {
        return 'Data non valida';
    }
};

// --- TRIGGER NOTIFICHE PUSH PER NUOVI LEAD ---
export const onLeadCreated = onDocumentCreated("incoming_leads/{leadId}", async (event) => {
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
export const onEnrollmentCreated = onDocumentCreated("enrollments/{enrollmentId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const enrData = snapshot.data();
    
    // Solo per iscrizioni da portale
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
    
    // 1. Notifica Base Iscrizione
    const title = isPaid ? "🎓 Nuova Iscrizione Portal (PAGATA)" : "🎓 Nuova Iscrizione Portal (DA SALDARE)";
    const body = `${clientName} ha iscritto ${childName} a ${subName}. Stato: ${isPaid ? 'Pagato' : 'In attesa di saldo'}.`;

    await sendPushToAllTokens(title, body, {
        enrollmentId: event.params.enrollmentId,
        type: 'enrollment',
        click_action: 'ENROLLMENTS'
    });

    // 2. Promemoria Incasso (se in sede)
    if (!isPaid) {
        const reminderTitle = "💰 Promemoria Incasso in Sede";
        const reminderBody = `Attenzione: ${childName} ha prenotato il posto. Ricordati di registrare l'incasso di ${price}€ al suo arrivo.`;
        
        // Ritardo minimo per non sovrapporre le notifiche
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sendPushToAllTokens(reminderTitle, reminderBody, {
            enrollmentId: event.params.enrollmentId,
            type: 'payment_reminder'
        });
    }

    // 3. Promemoria Fattura e Bollo Virtuale
    const needsStampDuty = price >= 77;
    const invoiceReminderTitle = needsStampDuty ? "⚠️ AVVISO BOLLO - Fatturazione" : "📄 Nuova Fattura da Emettere";
    
    let invoiceReminderBody = "";
    if (needsStampDuty) {
        const totalPrice = price + 2;
        invoiceReminderBody = `Emetti fattura per ${childName}. Importo ≥ 77€: verifica l'aggiunta dei 2€ di bollo (Totale dovuto: ${totalPrice}€).`;
    } else {
        invoiceReminderBody = `Emetti fattura per ${childName} - Importo: ${price}€.`;
    }

    // Ritardo per sequenzialità
    await new Promise(resolve => setTimeout(resolve, 2000));
    await sendPushToAllTokens(invoiceReminderTitle, invoiceReminderBody, {
        enrollmentId: event.params.enrollmentId,
        type: 'invoice_reminder',
        needsStampDuty: String(needsStampDuty)
    });
});

// --- API PUBBLICA PER PAGINA ESTERNA (PROGETTO B) - V2 ---
// Include calcolo posti disponibili e filtro età robusto
export const getPublicSlotsV2 = onRequest({ cors: true }, async (req, res) => {
    try {
        // 1. Recupera Fornitori Attivi
        const suppliersSnap = await admin.firestore().collection('suppliers').where('isDeleted', '==', false).get();
        
        // 2. Recupera TUTTE le iscrizioni attive per il calcolo posti (Ottimizzazione: una sola query)
        // Filtriamo per status 'active' (o altri status che occupano posto)
        const enrollmentsSnap = await admin.firestore().collection('enrollments')
            .where('status', 'in', ['active', 'pending', 'confirmed']) 
            .get();

        // 3. Costruisci Mappa Occupazione: { "locationId_day_startTime": count }
        const occupancyMap = new Map<string, number>();

        enrollmentsSnap.forEach(doc => {
            const data = doc.data();
            const locId = data.locationId;
            const appts = data.appointments || [];

            // Se l'iscrizione ha appuntamenti ricorrenti, contiamo l'occupazione
            // Assumiamo che appointments[0] definisca il giorno/ora ricorrente per semplicità
            // O iteriamo su tutti se l'iscrizione occupa più slot settimanali
            if (locId && appts.length > 0) {
                // Prendiamo il primo appuntamento come riferimento per il giorno/ora ricorrente
                // In un sistema più complesso, bisognerebbe analizzare la ricorrenza esatta
                const mainAppt = appts[0]; 
                if (mainAppt && mainAppt.dayOfWeek && mainAppt.startTime) {
                    const key = `${locId}_${mainAppt.dayOfWeek}_${mainAppt.startTime}`;
                    const currentCount = occupancyMap.get(key) || 0;
                    occupancyMap.set(key, currentCount + 1);
                }
            }
        });

        const results: any[] = [];
        logger.info(`Found ${suppliersSnap.size} suppliers and ${enrollmentsSnap.size} active enrollments.`);

        suppliersSnap.forEach(doc => {
            const supplierData = doc.data();
            const locations = supplierData.locations || [];

            locations.forEach((loc: any) => {
                // 1. Filtro Visibilità Sede
                if (loc.isPubliclyVisible === false || loc.closedAt) {
                    return; 
                }

                // Capacità Sede (Default 15 se non specificata)
                const locationCapacity = loc.capacity ? parseInt(String(loc.capacity)) : 15;

                // 2. Filtro e Processamento Slot
                const allSlots = loc.availability || [];
                const visibleSlots = allSlots.filter((slot: any) => {
                    return slot.isPubliclyVisible !== false;
                }).map((s: any) => {
                    // Normalizzazione Età
                    const minAge = s.minAge !== undefined ? parseFloat(String(s.minAge)) : 0;
                    const maxAge = s.maxAge !== undefined ? parseFloat(String(s.maxAge)) : 99;

                    // Calcolo Posti Disponibili
                    const key = `${loc.id}_${s.dayOfWeek}_${s.startTime}`;
                    const occupiedSeats = occupancyMap.get(key) || 0;
                    const availableSeats = Math.max(0, locationCapacity - occupiedSeats);
                    
                    return {
                        dayOfWeek: s.dayOfWeek,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        type: s.type || 'LAB',
                        minAge: isNaN(minAge) ? 0 : minAge,
                        maxAge: isNaN(maxAge) ? 99 : maxAge,
                        capacity: locationCapacity,
                        enrolledCount: occupiedSeats,
                        availableSeats: availableSeats,
                        isFull: availableSeats === 0
                    };
                });

                if (visibleSlots.length > 0) {
                    results.push({
                        id: loc.id,
                        name: loc.name,
                        address: loc.address || '',
                        city: loc.city || supplierData.city || '',
                        googleMapsLink: loc.googleMapsLink || '',
                        slots: visibleSlots
                    });
                }
            });
        });

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        logger.error("Error fetching public slots v2:", error);
        res.status(500).json({ error: "Failed to fetch slots" });
    }
});
