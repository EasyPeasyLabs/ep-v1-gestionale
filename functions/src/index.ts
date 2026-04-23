import { onCall, onRequest, HttpsError, CallableRequest, Request, Response } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, FirestoreEvent, QueryDocumentSnapshot, Change } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Inizializzazione Globale (Richiesta per Firebase Functions v2)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Importazione helper per date (condiviso con il resto del progetto)
import { isItalianHoliday } from "../../utils/dateUtils";
import { Supplier, Location, Course, SubscriptionType } from "../../types";
import { TransportOptions } from "nodemailer";

interface Bundle {
    bundleId: string;
    subscriptionId: string;
    name: string;
    publicName: string;
    description: string;
    price: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    minAge: number;
    maxAge: number;
    availableSeats: number;
    isFull: boolean;
    includedSlots: {
        courseId: string;
        type: string;
        startTime: string;
        endTime: string;
        dayOfWeek: number;
    }[];
}

// Helper rimosso perché l'inizializzazione è ora globale
function getAdmin() {
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
}, async (request: CallableRequest) => {
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
            } as TransportOptions,
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Error sending email:", errorMessage);
        throw new Error(`Email sending failed: ${errorMessage}`);
    }
});

// --- HELPER PER INVIO NOTIFICHE PUSH ---
async function sendPushToAllTokens(title: string, body: string, extraData: Record<string, string>) {
    try {
        const firebase = getAdmin();
        const tokensSnapshot = await firebase.firestore().collection("fcm_tokens").get();
        const tokens: string[] = [];

        tokensSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
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
            response.responses.forEach((resp: admin.messaging.SendResponse, idx: number) => {
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Error sending push notifications:", message);
    }
}

// --- TRIGGER NOTIFICHE PUSH PER NUOVI LEAD ---
export const onLeadCreated = onDocumentCreated({
    region: "europe-west1",
    document: "incoming_leads/{leadId}"
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { [key: string]: string }>) => {
    const firebase = getAdmin();
    const snapshot = event.data;
    if (!snapshot) return;

    const leadData = snapshot.data();
    // const nome = leadData.nome || leadData.firstName || 'Nuovo';
    // const cognome = leadData.cognome || leadData.lastName || 'Contatto';

    let sede = '';
    const locationId = leadData.selectedLocation || leadData.sede;
    if (locationId) {
        try {
            const suppliersSnap = await firebase.firestore().collection('suppliers').get();
            for (const doc of suppliersSnap.docs) {
                const supplierData = doc.data();
                const loc = (supplierData as Supplier).locations?.find((l: Location) => l.id === locationId);
                if (loc) { sede = loc.name; break; }
            }
        } catch (e) { logger.error("Error resolving location name:", e); }
    }
    if (!sede) {
        const payloadSede = leadData.locationName || leadData.nomeSede || leadData.selectedLocation || leadData.sede;
        if (payloadSede && typeof payloadSede === 'string') sede = payloadSede.trim();
    }

});

// --- API RICEZIONE LEAD V2 (PROGETTO B) ---
export const receiveLeadV2 = onRequest({
    region: "europe-west1",
    cors: true
}, async (req: Request, res: Response) => {
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Error saving lead v2:", message);
        res.status(500).json({ error: "Internal Server Error", details: message });
    }
});

// --- API PUBBLICA PER PAGINA ESTERNA (PROGETTO B) - V5 (CORE REFACTORING) ---
export const getPublicSlotsV5 = onRequest({
    region: "europe-west1",
    cors: true
}, async (req: Request, res: Response) => {
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

        const activeSubs: SubscriptionType[] = [];
        subsSnap.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const sub = doc.data() as SubscriptionType;
            if (sub.isPubliclyVisible !== false) {
                activeSubs.push({ ...sub, id: doc.id });
            }
        });

        const locationsMap = new Map<string, Location>();
        locationsSnap.forEach(doc => locationsMap.set(doc.id, doc.data() as Location));

        const results: {
            id: string;
            name: string;
            address: string;
            city: string;
            googleMapsLink: string;
            bundles: Bundle[];
        }[] = [];
        const locationBundlesGrouped = new Map<string, Bundle[]>();

        // 2. Filtro Corsi per Età (se fornita) e Matching con Bundle
        coursesSnap.forEach(doc => {
            const course = doc.data() as Course;
            course.id = doc.id;
            const loc = locationsMap.get(course.locationId);
            if (!loc) return;

            // Filtro Età Rigoroso
            if (age !== null && (age < course.minAge || age > course.maxAge)) return;

            // Matching con SubscriptionTypes (Bundles)
            // Un bundle è compatibile se ha almeno un gettone del tipo del corso
            const compatibleSubs = activeSubs.filter(sub => {
                const hasLegacyToken = (course.slotType === 'LAB' && sub.labCount > 0) ||
                                       (course.slotType === 'SG' && sub.sgCount > 0) ||
                                       (course.slotType === 'EVT' && sub.evtCount > 0);

                const hasNewToken = sub.tokens && Array.isArray(sub.tokens) && sub.tokens.some(t => t.type === course.slotType && t.count > 0);

                // Gestione speciale per i corsi ibridi LAB+SG (se il bundle fornisce o LAB o SG)
                const hasCompositeToken = course.slotType === 'LAB+SG' && sub.tokens && sub.tokens.some(t => (t.type === 'LAB' || t.type === 'SG') && t.count > 0);
                
                const hasToken = hasLegacyToken || hasNewToken || hasCompositeToken;
                
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
                const groupKey = `${course.locationId}_${sub.id}_${course.dayOfWeek}_${course.startTime.replace(':', '')}`;        
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

                // Per bundle multi-slot (se esistessero nello stesso orario), prendiamo il minimo
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
            if (loc) {
                results.push({
                    id: locId,
                    name: loc.name,
                    address: loc.address || '',
                    city: loc.city || '',
                    googleMapsLink: loc.googleMapsLink || '',
                    bundles: bundles
                });
            }
        });

        res.status(200).json({ success: true, data: results });
    } catch (error: unknown) {
        logger.error("Error in getPublicSlotsV5:", error);
        res.status(500).json({ error: "Failed to fetch slots v5" });
    }
});

// --- API PROXY PER GOOGLE BOOKS (PROGETTO B) ---
export const proxyGoogleBooks = onRequest({
    region: "europe-west1",
    cors: true
}, async (req: Request, res: Response) => {
    if (req.method !== "GET") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const query = req.query.q;
    if (!query) {
        res.status(400).json({ error: "Missing query parameter" });
        return;
    }

    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query as string)}&maxResults=1`);
        
        if (!response.ok) {
            res.status(response.status).json({ error: "Google Books API error" });
            return;
        }

        const data = await response.json();
        res.json(data);
    } catch (error: unknown) {
        logger.error("Error proxying Google Books:", error);
        res.status(500).json({ error: "Failed to fetch from Google Books" });
    }
});

// --- FUNZIONI MANCANTI (REINTEGRATE) ---

export const getEnrollmentData = onCall({ region: "europe-west1", cors: true }, async (request: CallableRequest) => {
    const firebase = getAdmin();
    const { leadId } = request.data;
    if (!leadId) throw new HttpsError("invalid-argument", "Missing leadId");

    try {
        const db = firebase.firestore();
        
        // 1. Recupero Lead e Verifica Esistenza
        const leadSnap = await db.collection("incoming_leads").doc(leadId).get();
        if (!leadSnap.exists) {
            throw new HttpsError("not-found", "Lead non trovato");
        }
        const leadData = { id: leadSnap.id, ...leadSnap.data() as Record<string, unknown> };

        // 2. Controllo Iscrizioni Esistenti (Anti-duplicazione)
        // Cerchiamo un enrollment con lo stesso email del lead o ID lead se tracciato
        const existingEnrSnap = await db.collection("enrollments")
            .where("email", "==", leadData.email)
            .where("childName", "==", leadData.childName)
            .where("status", "in", ["active", "Active", "pending", "Pending", "confirmed", "Confirmed"])
            .limit(1).get();

        if (!existingEnrSnap.empty) {
            return { existingEnrollment: { id: existingEnrSnap.docs[0].id, ...existingEnrSnap.docs[0].data() } };
        }

        // 3. Recupero Dati di Sistema (Parallel)
        const [companySnap, subsSnap, suppliersSnap] = await Promise.all([
            db.collection("settings").doc("company").get(),
            db.collection("subscriptionTypes").get(),
            db.collection("suppliers").where("isDeleted", "==", false).get()
        ]);

        const subscriptions = subsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() as SubscriptionType }))
            .filter((s) => s.statusConfig?.status === 'active' && s.isPubliclyVisible !== false);

        const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 4. Return Data for EnrollmentPortal
        return { 
            lead: leadData, 
            company: companySnap.data(),
            subscriptions: subscriptions,
            suppliers: suppliers
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Error in getEnrollmentData:", error);
        throw new HttpsError("internal", message); 
    }
});

export const processEnrollment = onCall({ region: "europe-west1", cors: true }, async (request: CallableRequest) => {
    const firebase = getAdmin();
    const db = firebase.firestore();
    const { leadId, clientData, enrollmentData, transactionData, invoiceData } = request.data;

    if (!leadId) throw new HttpsError("invalid-argument", "Missing leadId");

    try {
        return await db.runTransaction(async (transaction) => {
            // 1. Validazione Prezzo Server-Side (Security Shield)
            const subRef = db.collection("subscriptionTypes").doc(enrollmentData.subscriptionTypeId);
            const subSnap = await transaction.get(subRef);
            if (!subSnap.exists) throw new Error("Tipo abbonamento non trovato.");

            const sub = subSnap.data() as SubscriptionType;
            const basePrice = sub.price || 0;
            const stampPrice = basePrice >= 77 ? 2 : 0;
            const totalPrice = basePrice + stampPrice;

            // 1.1 MOTORE DI MATCHING CORSO (FASE A)
            const mainAppt = enrollmentData.appointments?.[0];
            const dayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
            const slotDayName = mainAppt?.time?.split(',')[0].trim() || dayNames[mainAppt?.dayOfWeek || 0];
            const targetDayIndex = dayNames.indexOf(slotDayName);

            let matchedCourseId = "manual";
            if (targetDayIndex !== -1 && mainAppt?.startTime) {
                const coursesSnap = await db.collection("courses")
                    .where("locationId", "==", enrollmentData.locationId)
                    .where("dayOfWeek", "==", targetDayIndex)
                    .where("startTime", "==", mainAppt.startTime)
                    .limit(1).get();

                if (!coursesSnap.empty) {
                    matchedCourseId = coursesSnap.docs[0].id;
                    logger.info(`[matcher] Iscrizione collegata al corso ${matchedCourseId}`);
                } else {
                    logger.warn(`[matcher] Nessun corso trovato per ${enrollmentData.locationName} il ${slotDayName} alle ${mainAppt.startTime}. Fallback su manual.`);
                }
            }

            // 2. Creazione o Aggiornamento Cliente (Basato su Email) con Tag Management (FASE D)
            let clientId = "";
            let childId = ""; // ID del figlio specifico per questa iscrizione
            const clientsSnap = await db.collection("clients")
                .where("email", "==", clientData.email.toLowerCase())
                .limit(1).get();

            // Scomposizione Indirizzo Tassonomica (per compatibilità Gestionale)
            const structuredAddress = {
                address: clientData.address || "",
                city: clientData.city || "",
                zipCode: clientData.zipCode || clientData.zip || "",
                province: clientData.province || ""
            };

            // Mappatura strutturata dei Figli (Evitiamo il collasso nelle note)
            const structuredChildren = (clientData.children || []).map((child: Record<string, unknown>) => {
                const id = child.id as string || `child_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                // Memorizziamo l'ID del figlio corrispondente al nome nell'iscrizione
                if (!childId || child.name === enrollmentData.childName) childId = id;

                return {
                    id: id,
                    name: child.name || "",
                    firstName: child.name?.split(' ')[0] || "",
                    lastName: child.name?.split(' ').slice(1).join(' ') || "",
                    dateOfBirth: child.dateOfBirth || "",
                    age: child.age || 0,
                    notes: child.notes || "",
                    tags: child.tags || [],
                    rating: child.rating || { learning: 0, behavior: 0, attendance: 0, hygiene: 0 }
                };
            });

            if (!clientsSnap.empty) {
                const clientDoc = clientsSnap.docs[0];
                clientId = clientDoc.id;
                const existingData = clientDoc.data();
                const currentTags = existingData.tags || [];

                // Rimuoviamo LEAD e aggiungiamo GENITORE
                const updatedTags = Array.from(new Set(
                    currentTags
                        .filter((t: string) => t.toUpperCase() !== 'LEAD')
                        .concat(['GENITORE'])
                ));

                // Fusione intelligente dei figli per evitare duplicati o sovrascritture distruttive
                const mergedChildren = [...(existingData.children || [])];
                structuredChildren.forEach((newChild: Record<string, unknown>) => {
                    const existingChild = mergedChildren.find((c: Record<string, unknown>) =>
                        (c.name as string)?.toLowerCase() === (newChild.name as string)?.toLowerCase()
                    );
                    if (!existingChild) {
                        mergedChildren.push(newChild);
                    } else {
                        // Se esiste già, usiamo il suo ID reale
                        if (newChild.name === enrollmentData.childName) childId = existingChild.id;
                    }
                });

                transaction.update(db.collection("clients").doc(clientId), {
                    firstName: clientData.firstName,
                    lastName: clientData.lastName,
                    phone: clientData.phone,
                    taxCode: clientData.taxCode,
                    ...structuredAddress,
                    children: mergedChildren,
                    tags: updatedTags,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const clientRef = db.collection("clients").doc();
                clientId = clientRef.id;
                transaction.set(clientRef, {
                    ...clientData,
                    id: clientId,
                    email: clientData.email.toLowerCase(),
                    ...structuredAddress,
                    children: structuredChildren,
                    tags: ['GENITORE'],
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // 3. Creazione Iscrizione Arricchita (FASE B)
            const enrRef = db.collection("enrollments").doc();

            // Arricchimento appointments per evitare N/D nel frontend
            const enrichedAppointments = (enrollmentData.appointments || []).map((app: Record<string, unknown>) => ({
                ...app,
                dayOfWeek: targetDayIndex,
                startTime: (app.startTime as string) || mainAppt?.startTime || "16:00",
                endTime: (app.endTime as string) || mainAppt?.endTime || "17:00",
                locationId: enrollmentData.locationId,
                locationName: enrollmentData.locationName,
                locationColor: enrollmentData.locationColor || "#6366f1",
                childName: enrollmentData.childName
            }));

            const finalEnrollment = {
                ...enrollmentData,
                id: enrRef.id,
                clientId: clientId,
                childId: childId, // COLLEGAMENTO CRUCIALE PER MODALE
                courseId: matchedCourseId, // Collegamento al corso reale per visibilità liste/archivio
                price: totalPrice,
                startTime: enrichedAppointments[0]?.startTime || "16:00",
                endTime: enrichedAppointments[0]?.endTime || "17:00",
                appointments: enrichedAppointments,
                status: (enrollmentData.status || 'Active'), // Manteniamo Case-Sensitive
                source: 'portal',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                startDate: admin.firestore.FieldValue.serverTimestamp()
            };
            transaction.set(enrRef, finalEnrollment);
            // 4. Creazione Transazione (con allocationId)
            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
                ...transactionData,
                id: transRef.id,
                clientId: clientId,
                relatedEnrollmentId: enrRef.id,
                amount: totalPrice,
                allocationId: enrollmentData.locationId,
                allocationName: enrollmentData.locationName,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 5. Creazione Fattura (se prevista)
            if (invoiceData) {
                const invRef = db.collection("invoices").doc();
                transaction.set(invRef, {
                    ...invoiceData,
                    id: invRef.id,
                    clientId: clientId,
                    relatedEnrollmentId: enrRef.id,
                    totalAmount: totalPrice,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // 6. Generazione Automatica Lezioni (Physical Lesson Engine - FASE C)
            if (targetDayIndex !== -1) {
                let firstDate = "";
                
                if (matchedCourseId !== "manual") {
                    // NUOVA ARCHITETTURA: Aggiungi l'allievo alle lezioni esistenti del corso
                    // Normalizzazione data odierna (Italia) per evitare slittamenti UTC
                    const todayItaly = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Rome"}));
                    const todayStr = todayItaly.toISOString().split('T')[0];

                    const courseLessonsQuery = db.collection("lessons")
                        .where("courseId", "==", matchedCourseId)
                        .where("date", ">=", todayStr)
                        .orderBy("date", "asc")
                        .limit(enrollmentData.lessonsTotal || sub.lessons || 1);
                        
                    const courseLessonsSnap = await transaction.get(courseLessonsQuery);
                    
                    if (!courseLessonsSnap.empty) {
                        firstDate = courseLessonsSnap.docs[0].data().date;
                        courseLessonsSnap.forEach(docSnap => {
                            const lessonData = docSnap.data();
                            const attendees = lessonData.attendees || [];
                            attendees.push({
                                enrollmentId: enrRef.id,
                                childName: enrollmentData.childName,
                                status: 'Scheduled'
                            });
                            transaction.update(docSnap.ref, { attendees });
                        });
                    }
                } else {
                    // VECCHIA ARCHITETTURA (Fallback per manuali)
                    const currentLessonDate = new Date();
                    while (currentLessonDate.getDay() !== targetDayIndex) {
                        currentLessonDate.setDate(currentLessonDate.getDate() + 1);
                    }

                    const lessonsToCreate = enrollmentData.lessonsTotal || sub.lessons || 1;
                    let createdCount = 0;

                    while (createdCount < lessonsToCreate) {
                        const dateStr = currentLessonDate.toISOString().split('T')[0];
                        if (!isItalianHoliday(currentLessonDate)) {
                            const lessonRef = db.collection("lessons").doc();
                            transaction.set(lessonRef, {
                                id: lessonRef.id,
                                enrollmentId: enrRef.id,
                                courseId: matchedCourseId,
                                locationId: enrollmentData.locationId,
                                locationName: enrollmentData.locationName,
                                locationColor: enrollmentData.locationColor || "#6366f1",
                                date: dateStr,
                                startTime: enrichedAppointments[0]?.startTime || "16:00",
                                endTime: enrichedAppointments[0]?.endTime || "17:00",
                                childName: enrollmentData.childName,
                                status: 'Scheduled',
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            if (createdCount === 0) firstDate = dateStr;
                            createdCount++;
                        }
                        currentLessonDate.setDate(currentLessonDate.getDate() + 7);
                    }
                }

                // Aggiorna la data di inizio dell'iscrizione
                if (firstDate) {
                    transaction.update(enrRef, { startDate: firstDate });
                }
            }

            // 7. Aggiornamento Lead
            transaction.update(db.collection("incoming_leads").doc(leadId), {
                status: 'processed',
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                relatedEnrollmentId: enrRef.id,
                relatedClientId: clientId
            });

            // 8. Notifica Push
            try {
                const title = "🚀 Nuova Iscrizione!";
                const body = `${finalEnrollment.childName} si è iscritto a ${finalEnrollment.locationName} (${finalEnrollment.subscriptionName})`;
                await sendPushToAllTokens(title, body, {
                    enrollmentId: enrRef.id,
                    type: 'enrollment',
                    click_action: 'ENROLLMENTS'
                });
            } catch (pushErr) {
                logger.error("Error sending push notification:", pushErr);
            }

            return { success: true, enrollmentId: enrRef.id, clientId };
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error("Error in processEnrollment:", e);
        throw new HttpsError("internal", message);
    }
});
export const suggestBookTags = onCall({ region: "europe-west1", cors: true }, async () => {
    return { target: ["piccoli"], category: ["testo & immagini"], theme: ["società"] };
});

export const checkPeriodicNotifications = onSchedule({ schedule: "* * * * *", timeZone: "Europe/Rome", region: "europe-west1" }, async () => {
    logger.info("Checking periodic notifications...");
});

export const onEnrollmentCreated = onDocumentCreated({ 
    region: "europe-west1", 
    document: "enrollments/{id}" 
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { [key: string]: string }>) => {
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
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { [key: string]: string }>) => {
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
}, async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { [key: string]: string }>) => {
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
export const enrollmentGateway = onRequest({ region: "europe-west1", cors: true }, async (req: Request, res: Response) => {
    const firebase = getAdmin();
    const leadId = req.query.id as string;
    
    if (!leadId) {
        return res.status(400).send("ID Iscrizione mancante");
    }

    try {
        const db = firebase.firestore();
        const leadSnap = await db.collection("incoming_leads").doc(leadId).get();
        
        if (!leadSnap.exists) {
            return res.status(404).send("Iscrizione non trovata o scaduta.");
        }

        const lead = leadSnap.data() as Record<string, unknown>;
        const nomeAllievo = lead.childName || lead.nome || "Allievo";
        const sede = lead.selectedLocation || lead.locationName || "EasyPeasy Lab";
        
        // Costruiamo i Meta Tag dinamici per l'anteprima WhatsApp/Social
        const title = `Completa l'iscrizione di ${nomeAllievo}`;
        const description = `Ciao ${lead.nome || 'Genitore'}, mancano pochissimi passi per confermare il posto presso ${sede}.`;
        
        const appBase = process.env.APP_URL || "https://ep-v1-gestionale.vercel.app";
        const portalBase = process.env.PORTAL_URL || "https://ep-portal-chi.vercel.app";
        
        const logoUrl = `${appBase}/lemon_logo_150px.png`;
        
        // URL del portale reale (Progetto C) - Ritorno alla logica Hash per compatibilità HashRouter
        const portalUrl = `${portalBase}/?id=${leadId}#/iscrizione`;

        const html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Dynamic Open Graph Tags -->
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${logoUrl}">
    <meta property="og:url" content="${portalUrl}">
    <meta property="og:type" content="website">
    
    <!-- Twitter Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${logoUrl}">

    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #111827; }
        .card { background: white; padding: 2rem; border-radius: 1.5rem; shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 90%; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #4f46e5; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; }
        p { color: #6b7280; font-size: 0.875rem; }
    </style>

    <!-- Redirect immediato -->
    <script>
        window.location.href = "${portalUrl}";
    </script>
    <meta http-equiv="refresh" content="2;url=${portalUrl}">
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h1>Reindirizzamento in corso...</h1>
        <p>Ti stiamo portando al modulo di iscrizione di <strong>${nomeAllievo}</strong>.</p>
        <p style="margin-top: 1rem; font-size: 0.75rem;">Se non vieni reindirizzato, <a href="${portalUrl}" style="color: #4f46e5; font-weight: bold;">clicca qui</a>.</p>
    </div>
</body>
</html>
        `;

        res.status(200).set('Content-Type', 'text/html').send(html);

    } catch (err: unknown) {
        logger.error("Error in enrollmentGateway:", err);
        res.status(500).send("Errore interno del server");
    }
});
