import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Helper per inizializzazione pigra (Lazy Initialization)
function getAdmin() {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    return admin;
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
}, async (request: any) => {
    getAdmin();
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
        if (!accessToken.token) throw new Error("Failed to generate access token");

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
        const firebase = getAdmin();
        const tokensSnapshot = await firebase.firestore().collection("fcm_tokens").get();
        const tokens: string[] = [];

        tokensSnapshot.forEach((doc: any) => {
            const data = doc.data();
            if (data.token) tokens.push(data.token);
        });

        if (tokens.length === 0) {
            logger.info("No FCM tokens found in database. Skipping notification.");
            return;
        }

        const message: admin.messaging.MulticastMessage = {
            tokens: tokens,
            notification: { title: title, body: body },
            data: extraData,
            android: { notification: { icon: 'stock_ticker_update', color: '#4f46e5' } },
            apns: { payload: { aps: { badge: 1, sound: 'default' } } },
        };

        const response = await firebase.messaging().sendEachForMulticast(message);
        logger.info(`Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);

        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp: any, idx: any) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                const batch = firebase.firestore().batch();
                failedTokens.forEach(token => {
                    batch.delete(firebase.firestore().collection("fcm_tokens").doc(token));
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
}, async (event: any) => {
    const firebase = getAdmin();
    const snapshot = event.data;
    if (!snapshot) return;

    const leadData = snapshot.data();
    const nome = leadData.nome || leadData.firstName || 'Nuovo';
    const cognome = leadData.cognome || leadData.lastName || 'Contatto';

    let sede = '';
    const locationId = leadData.selectedLocation || leadData.sede;
    if (locationId) {
        try {
            const suppliersSnap = await firebase.firestore().collection('suppliers').get();
            for (const doc of suppliersSnap.docs) {
                const supplierData = doc.data();
                const loc = supplierData.locations?.find((l: any) => l.id === locationId);
                if (loc) { sede = loc.name; break; }
            }
        } catch (e) { logger.error("Error resolving location name:", e); }
    }
    if (!sede) {
        const payloadSede = leadData.locationName || leadData.nomeSede || leadData.selectedLocation || leadData.sede;
        if (payloadSede && typeof payloadSede === 'string') sede = payloadSede.trim();
    }

    const title = "👤 Nuova Richiesta Web";
    let body = sede ? `${nome} ${cognome} ha richiesto informazioni per la sede di ${sede}. Contattalo subito!` : `${nome} ${cognome} ha richiesto informazioni. Contattalo subito!`;

    // FCM invocato nativamente da receiveLeadV2 per garanzia cronologica e testuale.
    /*
    await sendPushToAllTokens(title, body, {
        leadId: event.params.leadId,
        type: 'lead',
        click_action: 'WEB_REQUESTS'
    });
    */
});

// --- API RICEZIONE LEAD V2 (PROGETTO B) ---
export const receiveLeadV2 = onRequest({
    region: "europe-west1",
    cors: true
}, async (req: any, res: any) => {
    const firebase = getAdmin();
    if (req.method === "OPTIONS") {
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bridge-key');
        res.status(204).send('');
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const bridgeKey = req.headers['x-bridge-key'];
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (bridgeKey !== API_SHARED_SECRET && bearerToken !== API_SHARED_SECRET) {
        res.status(403).json({ error: "Forbidden: Invalid API Key" });
        return;
    }

    try {
        const data = req.body;
        const db = firebase.firestore();
        const email = data.email || data.parentEmail || "";
        const childName = data.childName || "";

        if (!email || !childName) {
            res.status(400).json({ error: "Email genitore e nome figlio sono obbligatori" });
            return;
        }

        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const existingLead = await db.collection("incoming_leads")
            .where("email", "==", email.toLowerCase())
            .where("childName", "==", childName)
            .where("createdAt", ">", sixHoursAgo.toISOString())
            .limit(1).get();

        if (!existingLead.empty) {
            res.status(200).json({ success: true, referenceId: existingLead.docs[0].id, duplicate: true });
            return;
        }

        const leadDoc = {
            ...data,
            nome: data.nome || data.parentFirstName || "",
            cognome: data.cognome || data.parentLastName || "",
            email: email,
            telefono: data.telefono || data.parentPhone || "",
            childName: childName,
            childAge: data.childAge || "",
            source: "projectB_api_v2",
            status: "pending",
            createdAt: new Date().toISOString()
        };

        // Rimuoviamo artefatti di sincronizzazione locali del Progetto B
        delete leadDoc.syncStatus;

        const docRef = await db.collection("incoming_leads").add(leadDoc);

        // --- INVIO NOTIFICA FCM (Sincrona e garantita, con il testo esatto) ---
        try {
            const dayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
            let giornoBundle = "";
            if (data.selectedSlot && typeof data.selectedSlot.dayOfWeek === 'number') {
                giornoBundle = dayNames[data.selectedSlot.dayOfWeek];
            } else if (data.selectedSlot && typeof data.selectedSlot.dayOfWeek === 'string') {
                giornoBundle = data.selectedSlot.dayOfWeek;
            }

            const reqSede = data.selectedLocation || leadDoc.locationName || leadDoc.sede || "Sede";
            const reqTitle = "👤 Nuova Richiesta Web";
            const reqBody = giornoBundle
                ? `${leadDoc.nome} ${leadDoc.cognome} ha richiesto informazioni per il corso presso ${reqSede} del ${giornoBundle}. Contattalo subito!`
                : `${leadDoc.nome} ${leadDoc.cognome} ha richiesto informazioni per la sede di ${reqSede}. Contattalo subito!`;

            await sendPushToAllTokens(reqTitle, reqBody, {
                leadId: docRef.id,
                type: 'lead',
                click_action: 'WEB_REQUESTS'
            });
        } catch (fcmErr) {
            logger.error("Error sending immediate FCM in receiveLeadV2:", fcmErr);
        }

        res.status(200).json({ success: true, referenceId: docRef.id });
    } catch (error: any) {
        logger.error("Error saving lead v2:", error?.message || error);
        res.status(500).json({ error: "Internal Server Error", details: error?.message });
    }
});

// --- API PUBBLICA PER PAGINA ESTERNA (PROGETTO B) - V5 (CORE REFACTORING) ---
export const getPublicSlotsV5 = onRequest({
    region: "europe-west1",
    cors: true
}, async (req: any, res: any) => {
    const firebase = getAdmin();
    const bridgeKey = req.headers['x-bridge-key'];
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    
    if (bridgeKey !== API_SHARED_SECRET && bearerToken !== API_SHARED_SECRET) {
        res.status(403).json({ error: "Forbidden: Invalid API Key" });
        return;
    }

    try {
        const db = firebase.firestore();
        const age = req.query.age ? parseInt(req.query.age.toString()) : null;

        // 1. Fetch Dati Fondamentali (Parallel)
        const [locationsSnap, coursesSnap, subsSnap] = await Promise.all([
            db.collection('locations').where('status', '==', 'active').get(),
            db.collection('courses').where('status', '==', 'open').get(),
            db.collection('subscriptionTypes').get()
        ]);

        const activeSubs: any[] = [];
        subsSnap.forEach((doc: any) => {
            const sub = doc.data();
            if (sub.isPubliclyVisible !== false) {
                activeSubs.push({ id: doc.id, ...sub });
            }
        });

        const locationsMap = new Map();
        locationsSnap.forEach(doc => locationsMap.set(doc.id, doc.data()));

        const results: any[] = [];
        const locationBundlesGrouped = new Map<string, any[]>();

        // 2. Filtro Corsi per Età (se fornita) e Matching con Bundle
        coursesSnap.forEach(doc => {
            const course = doc.data();
            const loc = locationsMap.get(course.locationId);
            if (!loc) return;

            // Filtro Età Rigoroso
            if (age !== null && (age < course.minAge || age > course.maxAge)) return;

            // Matching con SubscriptionTypes (Bundles)
            // Un bundle è compatibile se ha almeno un gettone del tipo del corso
            const compatibleSubs = activeSubs.filter(sub => {
                const hasToken = (course.slotType === 'LAB' && sub.labCount > 0) ||
                                 (course.slotType === 'SG' && sub.sgCount > 0) ||
                                 (course.slotType === 'EVT' && sub.evtCount > 0);
                
                if (!hasToken) return false;

                // Filtro giorni se definiti nel bundle
                if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
                    if (!sub.allowedDays.includes(course.dayOfWeek)) return false;
                }

                // Filtro età sub se definito (intersezione con corso)
                const subMinAge = sub.allowedAges?.min || sub.minAge || 0;
                const subMaxAge = sub.allowedAges?.max || sub.maxAge || 99;
                if (age !== null && (age < subMinAge || age > subMaxAge)) return false;

                return true;
            });

            compatibleSubs.forEach(sub => {
                const groupKey = `${course.locationId}_${sub.id}_${course.dayOfWeek}`;
                if (!locationBundlesGrouped.has(course.locationId)) {
                    locationBundlesGrouped.set(course.locationId, []);
                }
                
                const locBundles = locationBundlesGrouped.get(course.locationId)!;
                let bundle = locBundles.find(b => b.bundleId === groupKey);

                const available = Math.max(0, course.capacity - course.activeEnrollmentsCount);

                if (!bundle) {
                    bundle = {
                        bundleId: groupKey,
                        subscriptionId: sub.id,
                        name: sub.name,
                        publicName: sub.publicName || sub.name,
                        description: sub.description || '',
                        price: sub.price,
                        dayOfWeek: course.dayOfWeek,
                        startTime: course.startTime,
                        endTime: course.endTime,
                        minAge: Math.max(course.minAge, sub.allowedAges?.min || sub.minAge || 0),
                        maxAge: Math.min(course.maxAge, sub.allowedAges?.max || sub.maxAge || 99),
                        availableSeats: available,
                        isFull: available <= 0,
                        includedSlots: []
                    };
                    locBundles.push(bundle);
                }

                // Per bundle multi-slot (se esistessero), prendiamo il minimo della disponibilità
                bundle.availableSeats = Math.min(bundle.availableSeats, available);
                bundle.isFull = bundle.availableSeats <= 0;
                
                bundle.includedSlots.push({
                    courseId: course.id,
                    type: course.slotType,
                    startTime: course.startTime,
                    endTime: course.endTime,
                    dayOfWeek: course.dayOfWeek
                });
            });
        });

        // 3. Formattazione finale
        locationBundlesGrouped.forEach((bundles, locId) => {
            const loc = locationsMap.get(locId);
            results.push({
                id: loc.id,
                name: loc.name,
                address: loc.address || '',
                city: loc.city || '',
                googleMapsLink: loc.googleMapsLink || '',
                bundles: bundles
            });
        });

        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        logger.error("Error in getPublicSlotsV5:", error);
        res.status(500).json({ error: "Failed to fetch slots v5" });
    }
});

// --- FUNZIONI MANCANTI (REINTEGRATE) ---

export const getEnrollmentData = onCall({ region: "europe-west1", cors: true }, async (request: any) => {
    const firebase = getAdmin();
    const { leadId } = request.data;
    try {
        const db = firebase.firestore();
        const leadSnap = await db.collection("incoming_leads").doc(leadId).get();
        const [companySnap, subsSnap, suppliersSnap] = await Promise.all([
            db.collection("settings").doc("company").get(),
            db.collection("subscriptionTypes").get(),
            db.collection("suppliers").where("isDeleted", "==", false).get()
        ]);
        return { lead: leadSnap.data(), company: companySnap.data() };
    } catch (e: any) { throw new HttpsError("internal", e.message); }
});

export const processEnrollment = onCall({ region: "europe-west1", cors: true }, async (request: any) => {
    const firebase = getAdmin();
    const { leadId, formData } = request.data;
    const db = firebase.firestore();
    const batch = db.batch();
    try {
        const enrRef = db.collection("enrollments").doc();
        batch.set(enrRef, { ...formData, id: enrRef.id });
        await batch.commit();
        return { success: true, enrollmentId: enrRef.id };
    } catch (e: any) { throw new HttpsError("internal", e.message); }
});

export const suggestBookTags = onCall({ region: "europe-west1", cors: true }, async (request: any) => {
    const { title } = request.data;
    return { target: ["piccoli"], category: ["testo & immagini"], theme: ["società"] };
});

export const checkPeriodicNotifications = onSchedule({ schedule: "* * * * *", timeZone: "Europe/Rome", region: "europe-west1" }, async (event: any) => {
    const firebase = getAdmin();
    logger.info("Checking periodic notifications...");
});

export const onEnrollmentCreated = onDocumentCreated({ 
    region: "europe-west1", 
    document: "enrollments/{id}" 
}, async (event: any) => {
    const firebase = getAdmin();
    const db = firebase.firestore();
    const enrollment = event.data?.data();
    if (!enrollment) return;

    logger.info(`Processing enrollment created: ${event.params.id}`);

    // Solo se lo status è attivo/previsto contiamo l'occupazione
    if (['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(enrollment.status)) {
        const courseId = enrollment.courseId || enrollment.selectedCourseId;
        if (courseId) {
            try {
                await db.collection('courses').doc(courseId).update({
                    activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                logger.info(`Incremented occupancy for course ${courseId}`);
            } catch (e) {
                logger.error(`Failed to increment occupancy for course ${courseId}:`, e);
            }
        }
    }
});

import { onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";

export const onEnrollmentDeleted = onDocumentDeleted({ 
    region: "europe-west1", 
    document: "enrollments/{id}" 
}, async (event: any) => {
    const firebase = getAdmin();
    const db = firebase.firestore();
    const enrollment = event.data?.data();
    if (!enrollment) return;

    logger.info(`Processing enrollment deleted: ${event.params.id}`);

    if (['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(enrollment.status)) {
        const courseId = enrollment.courseId || enrollment.selectedCourseId;
        if (courseId) {
            try {
                await db.collection('courses').doc(courseId).update({
                    activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                logger.info(`Decremented occupancy for course ${courseId}`);
            } catch (e) {
                logger.error(`Failed to decrement occupancy for course ${courseId}:`, e);
            }
        }
    }
});

export const onEnrollmentUpdated = onDocumentUpdated({
    region: "europe-west1",
    document: "enrollments/{id}"
}, async (event: any) => {
    const firebase = getAdmin();
    const db = firebase.firestore();
    const before = event.data?.before.data();
    const after = event.data?.after.data();  
    if (!before || !after) return;

    const oldStatus = before.status;
    const newStatus = after.status;
    const oldRemaining = before.lessonsRemaining !== undefined ? before.lessonsRemaining : (before.labRemaining || 0);
    const newRemaining = after.lessonsRemaining !== undefined ? after.lessonsRemaining : (after.labRemaining || 0);

    const oldCourseId = before.courseId || before.selectedCourseId;
    const newCourseId = after.courseId || after.selectedCourseId;

    const isActive = (s: string) => ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(s);

    const wasValid = isActive(oldStatus) && oldRemaining > 0;
    const isValid = isActive(newStatus) && newRemaining > 0;

    // Caso 1: Cambio di Corso
    if (oldCourseId !== newCourseId) {
        // Decrementa vecchio se era valido
        if (oldCourseId && wasValid) {
            try {
                await db.collection('courses').doc(oldCourseId).update({
                    activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                logger.info(`Decremented old course ${oldCourseId} due to course move`);
            } catch (e) { logger.error(`Error decrementing old course ${oldCourseId}:`, e); }
        }
        // Incrementa nuovo se è valido
        if (newCourseId && isValid) {
            try {
                await db.collection('courses').doc(newCourseId).update({
                    activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                logger.info(`Incremented new course ${newCourseId} due to course move`);
            } catch (e) { logger.error(`Error incrementing new course ${newCourseId}:`, e); }
        }
    } 
    // Caso 2: Stesso corso, cambio validità (status o carnet)
    else if (newCourseId) {
        if (!wasValid && isValid) {
            await db.collection('courses').doc(newCourseId).update({
                activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info(`Incremented course ${newCourseId} (became valid)`);
        } else if (wasValid && !isValid) {
            await db.collection('courses').doc(newCourseId).update({
                activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info(`Decremented course ${newCourseId} (became invalid)`);
        }
    }
});
export const enrollmentGateway = onRequest({ region: "europe-west1", cors: true }, async (req: any, res: any) => {
    res.status(200).send("Enrollment Gateway Active");
});
