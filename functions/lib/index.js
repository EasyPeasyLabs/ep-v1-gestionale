"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicSlotsV2 = exports.enrollmentGateway = exports.onEnrollmentCreated = exports.onLeadCreated = exports.sendEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const googleapis_1 = require("googleapis");
const nodemailer = __importStar(require("nodemailer"));
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const gmailClientId = (0, params_1.defineSecret)("GMAIL_CLIENT_ID");
const gmailClientSecret = (0, params_1.defineSecret)("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = (0, params_1.defineSecret)("GMAIL_REFRESH_TOKEN");
const SENDER_EMAIL = "labeasypeasy@gmail.com";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
exports.sendEmail = (0, https_1.onCall)({
    region: "europe-west1",
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
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
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
            },
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
    }
    catch (error) {
        const err = error;
        logger.error("Error sending email:", err);
        throw new Error(`Email sending failed: ${err.message}`);
    }
});
async function sendPushToAllTokens(title, body, extraData) {
    try {
        const tokensSnapshot = await admin.firestore().collection("fcm_tokens").get();
        const tokens = [];
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
        const message = {
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
            const failedTokens = [];
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
    }
    catch (error) {
        logger.error("Error sending push notifications:", error);
    }
}
exports.onLeadCreated = (0, firestore_1.onDocumentCreated)({
    region: "europe-west1",
    document: "incoming_leads/{leadId}"
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
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
exports.onEnrollmentCreated = (0, firestore_1.onDocumentCreated)({
    region: "europe-west1",
    document: "enrollments/{enrollmentId}"
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
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
    }
    else {
        invoiceReminderBody = `Emetti fattura per ${childName} - Importo: ${price}€.`;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    await sendPushToAllTokens(invoiceReminderTitle, invoiceReminderBody, {
        enrollmentId: event.params.enrollmentId,
        type: 'invoice_reminder',
        needsStampDuty: String(needsStampDuty)
    });
});
exports.enrollmentGateway = (0, https_1.onRequest)({
    region: "europe-west1",
    cors: true
}, async (req, res) => {
    const id = req.query.id || req.path.split('/').pop();
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
    
    <!-- Open Graph / WhatsApp Preview -->
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
        // Redirezione immediata al portale reale nel Progetto A
        // L'utente non vedrà mai l'URL tecnico del Gestionale nel messaggio WhatsApp
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
exports.getPublicSlotsV2 = (0, https_1.onRequest)({
    region: "europe-west1",
    cors: true
}, async (req, res) => {
    try {
        const suppliersSnap = await admin.firestore().collection('suppliers').where('isDeleted', '==', false).get();
        const enrollmentsSnap = await admin.firestore().collection('enrollments')
            .where('status', 'in', ['active', 'pending', 'confirmed'])
            .get();
        const occupancyMap = new Map();
        enrollmentsSnap.forEach(doc => {
            const data = doc.data();
            const locId = data.locationId;
            const appts = data.appointments || [];
            if (locId && appts.length > 0) {
                const mainAppt = appts[0];
                if (mainAppt && mainAppt.dayOfWeek && mainAppt.startTime) {
                    const key = `${locId}_${mainAppt.dayOfWeek}_${mainAppt.startTime}`;
                    const currentCount = occupancyMap.get(key) || 0;
                    occupancyMap.set(key, currentCount + 1);
                }
            }
        });
        const results = [];
        logger.info(`Found ${suppliersSnap.size} suppliers and ${enrollmentsSnap.size} active enrollments.`);
        suppliersSnap.forEach(doc => {
            const supplierData = doc.data();
            const locations = supplierData.locations || [];
            locations.forEach((loc) => {
                if (loc.isPubliclyVisible === false || loc.closedAt) {
                    return;
                }
                const locationCapacity = loc.capacity ? parseInt(String(loc.capacity)) : 15;
                const allSlots = loc.availability || [];
                const visibleSlots = allSlots.filter((slot) => {
                    return slot.isPubliclyVisible !== false;
                }).map((s) => {
                    const minAge = s.minAge !== undefined ? parseFloat(String(s.minAge)) : 0;
                    const maxAge = s.maxAge !== undefined ? parseFloat(String(s.maxAge)) : 99;
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
    }
    catch (error) {
        logger.error("Error fetching public slots v2:", error);
        res.status(500).json({ error: "Failed to fetch slots" });
    }
});
//# sourceMappingURL=index.js.map