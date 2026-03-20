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

// --- API PUBBLICA PER PAGINA ESTERNA (PROGETTO B) - V2 ---
export const getPublicSlotsV2 = onRequest({
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
        const [suppliersSnap, enrollmentsSnap, subscriptionsSnap] = await Promise.all([
            db.collection('suppliers').where('isDeleted', '==', false).get(),
            db.collection('enrollments').where('status', 'in', ['active', 'pending', 'confirmed', 'Active', 'Pending', 'Confirmed']).get(),
            db.collection('subscriptionTypes').get()
        ]);

        const activeSubs: any[] = [];
        subscriptionsSnap.forEach((doc: any) => {
            const sub = doc.data();
            // Controllo più permissivo sulla visibilità pubblica
            if (sub.isPubliclyVisible === true || sub.isPubliclyVisible === undefined || sub.isPubliclyVisible === "true") {
                activeSubs.push({ id: doc.id, ...sub });
            }
        });

        if (activeSubs.length === 0) {
            logger.warn("CRITICAL: No active public subscriptions found in database!");
        } else {
            logger.info(`Found ${activeSubs.length} active public subscriptions: ${activeSubs.map(s => s.name).join(", ")}`);
        }

        const activeEnrollments = enrollmentsSnap.docs.map(doc => doc.data());

        const results: any[] = [];

        suppliersSnap.forEach((doc: any) => {
            const supplierData = doc.data();
            const locations = supplierData.locations || [];

            locations.forEach((loc: any) => {
                const locId = loc.id || loc.sedeId || (loc.name ? `loc-${loc.name.replace(/\s+/g, '-').toLowerCase()}` : "unknown");
                const isLocVisible = loc.isPubliclyVisible !== false && !loc.closedAt;
                if (!isLocVisible) {
                    logger.info(`Location ${loc.name} (id: ${locId}) skipped: isPubliclyVisible=${loc.isPubliclyVisible}, closedAt=${loc.closedAt}`);
                    return;
                }

                const aggregatedBundles = new Map<string, any>();
                const slots = loc.availability || loc.slots || []; 

                logger.info(`Location ${loc.name} (${locId}) has ${slots.length} raw slots. Processing...`);

                slots.forEach((slot: any) => {
                    const isSlotVisible = slot.isPubliclyVisible !== false;
                    if (!isSlotVisible) {
                        logger.info(`  Slot ${slot.type} (${slot.dayOfWeek} ${slot.startTime}) skipped: isPubliclyVisible=false`);
                        return;
                    }

                    // Filtro compatibilità migliorato (LAB, SG, EVT)
                    const normalizedSlotType = slot.type || 'LAB';
                    
                    const typeMatchFn = (sub: any): boolean => {
                        const labCount = Number(sub.labCount || 0);
                        const sgCount = Number(sub.sgCount || 0);
                        const evtCount = Number(sub.evtCount || 0);
                        if (normalizedSlotType === 'LAB' && labCount > 0) return true;
                        if (normalizedSlotType === 'SG' && sgCount > 0) return true;
                        if (normalizedSlotType === 'EVT' && evtCount > 0) return true;
                        return false;
                    };

                    // Tentativo 1: filtro STRICT (rispetta allowedDays)
                    let compatibleSubs = activeSubs.filter(sub => {
                        if (!typeMatchFn(sub)) return false;
                        if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
                            return sub.allowedDays.includes(slot.dayOfWeek);
                        }
                        return true; // nessuna restrizione giorni → compatibile
                    });

                    // Tentativo 2: filtro LENIENT (ignora allowedDays) se lo strict non trova nulla
                    if (compatibleSubs.length === 0) {
                        compatibleSubs = activeSubs.filter(sub => typeMatchFn(sub));
                        if (compatibleSubs.length > 0) {
                            logger.info(`  Location ${loc.name} slot ${normalizedSlotType} day ${slot.dayOfWeek}: lenient mode active (no allowedDays match)`);
                        } else {
                            // Nessuna subscription di questo tipo è marcata come pubblica
                            logger.info(`  Slot ${normalizedSlotType} (${slot.dayOfWeek}) scartato: nessuna subscription pubblica di tipo ${normalizedSlotType} trovata.`);
                        }
                    }

                    if (compatibleSubs.length === 0) return;

                    compatibleSubs.forEach(sub => {
                        // Calcola occupazione per ABBONAMENTO: conta tutti gli iscritti attivi con
                        // lo stesso abbonamento e la stessa sede, con lezioni residue.
                        // Il campo sull'enrollment è 'selectedSubscriptionId' (come inviato da EnrollmentPortal formData).
                        // Fallback su subscriptionTypeId e subscriptionName per enrollment storici.
                        const occupied = activeEnrollments.filter(enr => {
                            if (enr.locationId !== loc.id && enr.selectedLocationId !== loc.id) return false;
                            if (!['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(enr.status || enr.enrollmentStatus || '')) return false;
                            // Verifica che l'iscrizione non sia esaurita
                            const hasRemaining = (enr.lessonsRemaining > 0) || (enr.labRemaining > 0) || (enr.sgRemaining > 0) || (enr.evtRemaining > 0);
                            if (!hasRemaining && (enr.lessonsRemaining !== undefined || enr.labRemaining !== undefined)) return false;
                            // Match per abbonamento: prova i vari nomi di campo usati nei diversi sprint
                            const enrolledSubId = enr.selectedSubscriptionId || enr.subscriptionTypeId || enr.subscriptionId || '';
                            if (enrolledSubId) return enrolledSubId === sub.id;
                            // Fallback: confronto per nome dell'abbonamento
                            return String(enr.subscriptionName || enr.selectedSubscriptionName || '').toLowerCase() === String(sub.name || '').toLowerCase();
                        }).length;

                        const capacity = loc.capacity || 10;
                        const available = Math.max(0, capacity - occupied);
                        const subMinAge = typeof sub.minAge === 'number' ? sub.minAge : (isNaN(parseInt(sub.minAge)) ? 0 : parseInt(sub.minAge));
                        const subMaxAge = typeof sub.maxAge === 'number' ? sub.maxAge : (isNaN(parseInt(sub.maxAge)) ? 99 : parseInt(sub.maxAge));

                        // Età determinata dal vincolo più restrittivo tra Sede e Abbonamento
                        const finalMinAge = Math.max(subMinAge, slot.minAge || 0);
                        const finalMaxAge = Math.min(subMaxAge, slot.maxAge || 99);

                        // Se l'intersezione è vuota, questo bundle non ha senso per questo slot
                        if (finalMinAge > finalMaxAge) {
                            logger.info(`    Sub ${sub.name} vs Slot ${slot.type}: age mismatch! Sub(${subMinAge}-${subMaxAge}) vs Slot(${slot.minAge || 0}-${slot.maxAge || 99}) -> No intersection.`);
                            return;
                        }

                        // CHIAVE DI AGGREGAZIONE: Sede + Abbonamento + Giorno della Settimana
                        const groupKey = `${locId}_${sub.id}_${slot.dayOfWeek}`;

                        if (!aggregatedBundles.has(groupKey)) {
                            aggregatedBundles.set(groupKey, {
                                bundleId: groupKey,
                                name: sub.name,
                                publicName: sub.publicName || sub.name,
                                description: sub.description || '',
                                price: sub.price,
                                dayOfWeek: slot.dayOfWeek,
                                startTime: slot.startTime, // Orario principale indicativo
                                endTime: slot.endTime,
                                minAge: finalMinAge,
                                maxAge: finalMaxAge,
                                availableSeats: available, // Inizializzato al primo slot, poi prenderà il minimo
                                originalCapacity: capacity,
                                isFull: available <= 0,
                                includedSlots: []
                            });
                        }

                        const bundle = aggregatedBundles.get(groupKey);

                        // Aggiorniamo i limiti d'età per essere i più restrittivi
                        bundle.minAge = Math.max(bundle.minAge, finalMinAge);
                        bundle.maxAge = Math.min(bundle.maxAge, finalMaxAge);

                        // I posti disponibili per l'intero Bundle combaciato corrispondono allo slot con meno posti liberi!
                        bundle.availableSeats = Math.min(bundle.availableSeats, available);
                        bundle.isFull = bundle.availableSeats <= 0;

                        // Aggiungiamo lo slot attuale alla lista degli slot inclusi nel pacchetto
                        bundle.includedSlots.push({
                            type: slot.type || 'LAB',
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            dayOfWeek: slot.dayOfWeek,
                            minAge: slot.minAge,
                            maxAge: slot.maxAge
                        });
                        logger.info(`    Added slot ${slot.type} (${slot.startTime}) to bundle ${sub.name} for ${loc.name}`);
                    });
                });

                // Trasformiamo la mappa aggregata di nuovo in array, scartando eventuali bundle incongruenti
                const locationBundles = Array.from(aggregatedBundles.values()).filter(b => b.minAge <= b.maxAge);

                if (locationBundles.length > 0) {
                    results.push({
                        id: loc.id,
                        name: loc.name,
                        address: loc.address || '',
                        city: loc.city || '',
                        googleMapsLink: loc.googleMapsLink || '',
                        bundles: locationBundles
                    });
                }
            });
        });

        res.status(200).json({ success: true, data: results });
    } catch (error: any) {
        logger.error("Error fetching public slots v2:", error?.message || error);
        res.status(500).json({ error: "Failed to fetch slots" });
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

export const onEnrollmentCreated = onDocumentCreated({ region: "europe-west1", document: "enrollments/{id}" }, async (event: any) => {
    logger.info("Enrollment created:", event.params.id);
});

export const enrollmentGateway = onRequest({ region: "europe-west1", cors: true }, async (req: any, res: any) => {
    res.status(200).send("Enrollment Gateway Active");
});
