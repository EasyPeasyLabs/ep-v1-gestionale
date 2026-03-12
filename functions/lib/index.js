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
exports.checkPeriodicNotifications = exports.receiveLeadV2 = exports.getPublicSlotsV2 = exports.enrollmentGateway = exports.onEnrollmentCreated = exports.onLeadCreated = exports.processEnrollment = exports.getEnrollmentData = exports.sendEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const API_SHARED_SECRET = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
const gmailClientId = (0, params_1.defineSecret)("GMAIL_CLIENT_ID");
const gmailClientSecret = (0, params_1.defineSecret)("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = (0, params_1.defineSecret)("GMAIL_REFRESH_TOKEN");
const gmailSenderEmail = (0, params_1.defineSecret)("GMAIL_SENDER_EMAIL");
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
exports.sendEmail = (0, https_1.onCall)({
    region: "europe-west1",
    cors: true,
    secrets: [gmailClientId, gmailClientSecret, gmailRefreshToken, gmailSenderEmail]
}, async (request) => {
    const { google } = await Promise.resolve().then(() => __importStar(require("googleapis")));
    const nodemailer = await Promise.resolve().then(() => __importStar(require("nodemailer")));
    const { to, subject, html, attachments } = request.data;
    if (!to || !subject || !html) {
        throw new Error("Missing required fields: to, subject, html");
    }
    try {
        const clientId = gmailClientId.value();
        const clientSecret = gmailClientSecret.value();
        const refreshToken = gmailRefreshToken.value();
        const senderEmail = gmailSenderEmail.value();
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
                user: senderEmail,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
                accessToken: accessToken.token,
            },
        });
        const mailOptions = {
            from: `Lab Easy Peasy <${senderEmail}>`,
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
        logger.error("Error sending email:", error?.message || error);
        throw new Error(`Email sending failed: ${error?.message || 'Unknown error'}`);
    }
});
function toLocalISOString(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function getEasterDate(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}
function isItalianHoliday(date) {
    const year = date.getFullYear();
    const dateStr = toLocalISOString(date);
    const holidays = {
        [`${year}-01-01`]: 'Capodanno', [`${year}-01-06`]: 'Epifania', [`${year}-04-25`]: 'Liberazione',
        [`${year}-05-01`]: 'Lavoro', [`${year}-06-02`]: 'Repubblica', [`${year}-08-15`]: 'Ferragosto',
        [`${year}-11-01`]: 'Ognissanti', [`${year}-12-08`]: 'Immacolata', [`${year}-12-25`]: 'Natale',
        [`${year}-12-26`]: 'S. Stefano'
    };
    const easter = getEasterDate(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays[toLocalISOString(easter)] = 'Pasqua';
    holidays[toLocalISOString(easterMonday)] = 'Pasquetta';
    return !!holidays[dateStr];
}
function calculateEnrollmentDates(selectedSlot, lessonsTotal) {
    const parts = selectedSlot.split(',');
    const dayName = parts[0].trim();
    const timePart = parts.length > 1 ? parts[1].trim() : '16:30 - 18:00';
    const timeParts = timePart.split('-');
    const startTime = timeParts[0].trim();
    const endTime = timeParts.length > 1 ? timeParts[1].trim() : '18:00';
    const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const targetDay = daysMap.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
    const now = new Date();
    const startDate = new Date(now);
    if (targetDay !== -1) {
        const currentDay = startDate.getDay();
        let distance = targetDay - currentDay;
        if (distance < 0)
            distance += 7;
        startDate.setDate(startDate.getDate() + distance);
    }
    while (isItalianHoliday(startDate)) {
        startDate.setDate(startDate.getDate() + 7);
    }
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    let validSlots = 1;
    let loops = 0;
    while (validSlots < (lessonsTotal || 1) && loops < 100) {
        endDate.setDate(endDate.getDate() + 7);
        if (!isItalianHoliday(endDate))
            validSlots++;
        loops++;
    }
    endDate.setHours(23, 59, 59, 999);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString(), firstLessonDate: startDate.toISOString(), startTime, endTime };
}
exports.getEnrollmentData = (0, https_1.onCall)({ region: "europe-west1", cors: true }, async (request) => {
    const { leadId } = request.data;
    if (!leadId)
        throw new Error("Missing leadId");
    const db = admin.firestore();
    const [leadSnap, companySnap, subsSnap, suppliersSnap] = await Promise.all([
        db.collection('incoming_leads').doc(leadId).get(),
        db.collection('settings').doc('company_info').get(),
        db.collection('subscriptionTypes').get(),
        db.collection('suppliers').where('isDeleted', '==', false).get()
    ]);
    if (!leadSnap.exists)
        throw new Error("Lead non trovato");
    const leadData = leadSnap.data();
    if (leadData?.status === 'converted' && leadData?.relatedEnrollmentId) {
        const enrSnap = await db.collection('enrollments').doc(leadData.relatedEnrollmentId).get();
        return { success: true, alreadyConverted: true, enrollment: enrSnap.data() };
    }
    const companyInfo = companySnap.exists ? companySnap.data() : null;
    const subscriptionTypes = [];
    subsSnap.forEach(doc => {
        const data = doc.data();
        if (data.statusConfig?.status === 'active' && data.isPubliclyVisible !== false) {
            subscriptionTypes.push({ id: doc.id, ...data });
        }
    });
    const locations = [];
    suppliersSnap.forEach(doc => {
        const data = doc.data();
        const locs = data.locations || [];
        locs.forEach((l) => {
            if (!l.closedAt && l.isPubliclyVisible !== false) {
                locations.push({
                    id: l.id, name: l.name, address: l.address || '', city: l.city || '', color: l.color,
                    availability: l.availability || []
                });
            }
        });
    });
    return { success: true, lead: { id: leadSnap.id, ...leadData }, companyInfo, subscriptionTypes, locations };
});
exports.processEnrollment = (0, https_1.onCall)({ region: "europe-west1", cors: true }, async (request) => {
    const { leadId, formData } = request.data;
    if (!leadId || !formData)
        throw new Error("Dati mancanti");
    const db = admin.firestore();
    const leadRef = db.collection('incoming_leads').doc(leadId);
    return await db.runTransaction(async (transaction) => {
        const leadSnap = await transaction.get(leadRef);
        if (!leadSnap.exists)
            throw new Error("Lead non trovato");
        const leadData = leadSnap.data();
        if (leadData?.status === 'converted')
            throw new Error("Iscrizione già completata");
        const subRef = db.collection('subscriptionTypes').doc(formData.selectedSubscriptionId);
        const subSnap = await transaction.get(subRef);
        if (!subSnap.exists)
            throw new Error("Abbonamento non trovato");
        const sub = subSnap.data();
        const clientRef = db.collection('clients').doc();
        const childId = Math.random().toString(36).substring(2, 15);
        const clientData = {
            firstName: formData.parentFirstName, lastName: formData.parentLastName,
            email: formData.parentEmail, phone: formData.parentPhone, taxCode: formData.parentFiscalCode,
            address: `${formData.parentAddress}, ${formData.parentZip} ${formData.parentCity} (${formData.parentProvince})`,
            city: formData.parentCity,
            children: [{
                    id: childId, name: formData.childName, age: formData.childAge, dateOfBirth: formData.childDateOfBirth,
                    notes: '', notesHistory: [], tags: [], rating: { learning: 0, behavior: 0, attendance: 0, hygiene: 0 }
                }],
            status: 'Active', createdAt: new Date().toISOString(), source: 'portal'
        };
        transaction.set(clientRef, clientData);
        const dates = calculateEnrollmentDates(formData.selectedSlot, sub?.lessons || 0);
        const enrRef = db.collection('enrollments').doc();
        const enrollmentData = {
            clientId: clientRef.id, clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
            childId: childId, childName: formData.childName,
            subscriptionTypeId: formData.selectedSubscriptionId, subscriptionName: sub?.name || 'Abbonamento',
            locationId: formData.selectedLocationId || 'unassigned', locationName: formData.selectedLocationName || 'Sede Preferita',
            price: sub?.price || 0, lessonsTotal: sub?.lessons || 0, lessonsRemaining: sub?.lessons || 0,
            labCount: sub?.labCount || 0, sgCount: sub?.sgCount || 0, evtCount: sub?.evtCount || 0,
            labRemaining: sub?.labCount || 0, sgRemaining: sub?.sgCount || 0, evtRemaining: sub?.evtCount || 0,
            status: formData.paymentMethod === 'BankTransfer' || formData.paymentMethod === 'PayPal' ? 'active' : 'pending',
            startDate: dates.startDate, endDate: dates.endDate,
            appointments: [{
                    lessonId: Math.random().toString(36).substring(2, 15), date: dates.firstLessonDate,
                    startTime: dates.startTime, endTime: dates.endTime,
                    locationId: formData.selectedLocationId || 'unassigned', locationName: formData.selectedLocationName || 'Sede Preferita',
                    locationColor: '#6366f1', childName: formData.childName, status: 'Scheduled'
                }],
            createdAt: new Date().toISOString(), source: 'portal'
        };
        transaction.set(enrRef, enrollmentData);
        if (enrollmentData.status === 'active') {
            const transRef = db.collection('transactions').doc();
            transaction.set(transRef, {
                date: new Date().toISOString(), description: `Incasso Online - ${formData.childName} - ${sub?.name}`,
                amount: sub?.price || 0, type: 'income', category: 'Vendite',
                paymentMethod: formData.paymentMethod, status: 'completed',
                relatedEnrollmentId: enrRef.id, allocationId: formData.selectedLocationId,
                allocationName: formData.selectedLocationName, createdAt: new Date().toISOString()
            });
            if (formData.paymentMethod === 'BankTransfer') {
                const invRef = db.collection('invoices').doc();
                transaction.set(invRef, {
                    clientId: clientRef.id, clientName: `${formData.parentFirstName} ${formData.parentLastName}`,
                    issueDate: new Date().toISOString(), dueDate: new Date().toISOString(), status: 'pending_sdi',
                    paymentMethod: formData.paymentMethod, relatedEnrollmentId: enrRef.id,
                    items: [{ description: `Iscrizione ${formData.childName} - ${sub?.name}`, quantity: 1, price: sub?.price || 0 }],
                    totalAmount: sub?.price || 0, createdAt: new Date().toISOString()
                });
            }
        }
        transaction.update(leadRef, {
            status: 'converted', relatedEnrollmentId: enrRef.id, convertedAt: new Date().toISOString()
        });
        return { success: true, enrollmentId: enrRef.id };
    });
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
        logger.error("Error sending push notifications:", error?.message || error);
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
    let sede = '';
    const locationId = leadData.selectedLocation || leadData.sede;
    if (locationId) {
        try {
            const suppliersSnap = await admin.firestore().collection('suppliers').get();
            for (const doc of suppliersSnap.docs) {
                const supplierData = doc.data();
                const loc = supplierData.locations?.find((l) => l.id === locationId);
                if (loc) {
                    sede = loc.name;
                    break;
                }
            }
        }
        catch (e) {
            logger.error("Error resolving location name:", e);
        }
    }
    if (!sede) {
        const payloadSede = leadData.locationName || leadData.nomeSede || leadData.selectedLocation || leadData.sede;
        if (payloadSede && typeof payloadSede === 'string' && payloadSede.trim() !== '') {
            sede = payloadSede.trim();
        }
    }
    const title = "👤 Nuova Richiesta Web";
    let body = "";
    if (sede) {
        body = `${nome} ${cognome} ha richiesto informazioni per la sede di ${sede}. Contattalo subito!`;
    }
    else {
        body = `${nome} ${cognome} ha richiesto informazioni. Contattalo subito!`;
    }
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
    <meta property="og:title" content="Easy Peasy Labs" />
    <meta property="og:description" content="${id}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://ep-portal-chi.vercel.app/i/${id}" />
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
exports.getPublicSlotsV2 = (0, https_1.onRequest)({
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
        const activeSubs = [];
        subscriptionsSnap.forEach(doc => {
            const sub = doc.data();
            if (sub.isPubliclyVisible !== false) {
                activeSubs.push({ id: doc.id, ...sub });
            }
        });
        const occupancyMap = new Map();
        const now = new Date();
        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        enrollmentsSnap.forEach(doc => {
            const data = doc.data();
            const locId = data.locationId;
            const appts = data.appointments || [];
            const lessonsRemaining = data.lessonsRemaining !== undefined ? Number(data.lessonsRemaining) : 1;
            const status = data.status || 'pending';
            const isActive = ['active', 'pending', 'confirmed', 'Active', 'Pending', 'Confirmed'].includes(status);
            if (locId && appts.length > 0 && lessonsRemaining > 0 && isActive) {
                const occupiedSlotsThisWeek = new Set();
                appts.forEach((appt) => {
                    if (appt && appt.date && appt.startTime) {
                        const apptDate = new Date(appt.date);
                        if (apptDate >= startOfWeek && apptDate <= endOfWeek) {
                            const dayOfWeek = apptDate.getDay();
                            const key = `${locId}_${dayOfWeek}_${appt.startTime}`;
                            occupiedSlotsThisWeek.add(key);
                        }
                    }
                });
                if (occupiedSlotsThisWeek.size === 0) {
                    const futureAppts = appts.filter((a) => a.date && new Date(a.date) >= startOfWeek);
                    if (futureAppts.length > 0) {
                        const nextAppt = futureAppts[0];
                        const dayOfWeek = new Date(nextAppt.date).getDay();
                        const key = `${locId}_${dayOfWeek}_${nextAppt.startTime}`;
                        occupiedSlotsThisWeek.add(key);
                    }
                }
                occupiedSlotsThisWeek.forEach(key => {
                    occupancyMap.set(key, (occupancyMap.get(key) || 0) + 1);
                });
            }
        });
        const results = [];
        suppliersSnap.forEach(doc => {
            const supplierData = doc.data();
            const locations = supplierData.locations || [];
            locations.forEach((loc) => {
                if (loc.isPubliclyVisible === false || loc.closedAt)
                    return;
                const locationCapacity = loc.capacity ? parseInt(String(loc.capacity)) : 15;
                const allSlots = loc.availability || [];
                const visibleSlots = allSlots.filter((slot) => slot.isPubliclyVisible !== false).map((s) => {
                    let minAge = 0;
                    let maxAge = 99;
                    if (s.minAge !== undefined)
                        minAge = Number(s.minAge);
                    if (s.maxAge !== undefined)
                        maxAge = Number(s.maxAge);
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
                const slotsByDay = {};
                visibleSlots.forEach((s) => {
                    if (!slotsByDay[s.dayOfWeek])
                        slotsByDay[s.dayOfWeek] = [];
                    slotsByDay[s.dayOfWeek].push(s);
                });
                const locationBundles = [];
                for (const dayStr in slotsByDay) {
                    const dayOfWeek = parseInt(dayStr);
                    const daySlots = slotsByDay[dayStr];
                    activeSubs.forEach(sub => {
                        if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
                            if (!sub.allowedDays.includes(dayOfWeek)) {
                                return;
                            }
                        }
                        const requiresLab = (sub.labCount || 0) > 0;
                        const requiresSg = (sub.sgCount || 0) > 0;
                        const requiresEvt = (sub.evtCount || 0) > 0;
                        if (!requiresLab && !requiresSg && !requiresEvt) {
                            return;
                        }
                        const hasLab = daySlots.some(s => (s.type || '').toUpperCase() === 'LAB');
                        const hasSg = daySlots.some(s => (s.type || '').toUpperCase() === 'SG');
                        const hasEvt = daySlots.some(s => (s.type || '').toUpperCase() === 'EVT');
                        if ((!requiresLab || hasLab) && (!requiresSg || hasSg) && (!requiresEvt || hasEvt)) {
                            const includedSlots = daySlots.filter(s => (requiresLab && (s.type || '').toUpperCase() === 'LAB') ||
                                (requiresSg && (s.type || '').toUpperCase() === 'SG') ||
                                (requiresEvt && (s.type || '').toUpperCase() === 'EVT'));
                            let bundleMinAge = 0;
                            let bundleMaxAge = 99;
                            includedSlots.forEach(s => {
                                if (s.minAge > bundleMinAge)
                                    bundleMinAge = s.minAge;
                                if (s.maxAge < bundleMaxAge)
                                    bundleMaxAge = s.maxAge;
                            });
                            if (bundleMinAge > bundleMaxAge)
                                bundleMaxAge = bundleMinAge;
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
    }
    catch (error) {
        logger.error("Error fetching public slots v2:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch slots", details: error?.message });
    }
});
exports.receiveLeadV2 = (0, https_1.onRequest)({
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
    }
    catch (error) {
        logger.error("Error saving lead v2:", error?.message || error);
        res.status(500).json({ error: "Internal Server Error", details: error?.message });
    }
});
exports.checkPeriodicNotifications = (0, scheduler_1.onSchedule)({
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
        const getPart = (type) => parts.find(p => p.type === type)?.value;
        const currentHour = `${getPart('hour')}:${getPart('minute')}`;
        const romeDate = new Date(Date.UTC(Number(getPart('year')), Number(getPart('month')) - 1, Number(getPart('day'))));
        const currentDay = romeDate.getUTCDay();
        const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
        const tokensSnapshot = await db.collection("fcm_tokens").get();
        const allTokens = [];
        tokensSnapshot.forEach(doc => { if (doc.data().token)
            allTokens.push(doc.data().token); });
        if (allTokens.length === 0)
            return;
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
    }
    catch (error) {
        logger.error("Error in periodic notifications:", error?.message || error);
    }
});
//# sourceMappingURL=index.js.map