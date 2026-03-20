var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  checkPeriodicNotifications: () => checkPeriodicNotifications,
  enrollmentGateway: () => enrollmentGateway,
  getEnrollmentData: () => getEnrollmentData,
  getPublicSlotsV2: () => getPublicSlotsV2,
  onEnrollmentCreated: () => onEnrollmentCreated,
  onLeadCreated: () => onLeadCreated,
  processEnrollment: () => processEnrollment,
  receiveLeadV2: () => receiveLeadV2,
  sendEmail: () => sendEmail,
  suggestBookTags: () => suggestBookTags
});
module.exports = __toCommonJS(index_exports);
var import_https = require("firebase-functions/v2/https");
var import_firestore = require("firebase-functions/v2/firestore");
var import_scheduler = require("firebase-functions/v2/scheduler");
var logger = __toESM(require("firebase-functions/logger"));
var import_params = require("firebase-functions/params");
var admin = __toESM(require("firebase-admin"));
function getAdmin() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin;
}
var API_SHARED_SECRET = "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
var gmailClientId = (0, import_params.defineSecret)("GMAIL_CLIENT_ID");
var gmailClientSecret = (0, import_params.defineSecret)("GMAIL_CLIENT_SECRET");
var gmailRefreshToken = (0, import_params.defineSecret)("GMAIL_REFRESH_TOKEN");
var SENDER_EMAIL = "labeasypeasy@gmail.com";
var REDIRECT_URI = "https://developers.google.com/oauthplayground";
var sendEmail = (0, import_https.onCall)({
  region: "europe-west1",
  cors: true,
  secrets: [gmailClientId, gmailClientSecret, gmailRefreshToken]
}, async (request) => {
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
        clientId,
        clientSecret,
        refreshToken,
        accessToken: accessToken.token
      }
    });
    const mailOptions = {
      from: `Lab Easy Peasy <${SENDER_EMAIL}>`,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      html,
      attachments: attachments || []
    };
    const info2 = await transporter.sendMail(mailOptions);
    logger.info("Email sent successfully:", info2.messageId);
    return { success: true, messageId: info2.messageId };
  } catch (error2) {
    logger.error("Error sending email:", error2?.message || error2);
    throw new Error(`Email sending failed: ${error2?.message || "Unknown error"}`);
  }
});
async function sendPushToAllTokens(title, body, extraData) {
  try {
    const firebase = getAdmin();
    const tokensSnapshot = await firebase.firestore().collection("fcm_tokens").get();
    const tokens = [];
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });
    if (tokens.length === 0) {
      logger.info("No FCM tokens found in database. Skipping notification.");
      return;
    }
    const message = {
      tokens,
      notification: { title, body },
      data: extraData,
      android: { notification: { icon: "stock_ticker_update", color: "#4f46e5" } },
      apns: { payload: { aps: { badge: 1, sound: "default" } } }
    };
    const response = await firebase.messaging().sendEachForMulticast(message);
    logger.info(`Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === "messaging/invalid-registration-token" || errorCode === "messaging/registration-token-not-registered") {
            failedTokens.push(tokens[idx]);
          }
        }
      });
      if (failedTokens.length > 0) {
        const batch = firebase.firestore().batch();
        failedTokens.forEach((token) => {
          batch.delete(firebase.firestore().collection("fcm_tokens").doc(token));
        });
        await batch.commit();
      }
    }
  } catch (error2) {
    logger.error("Error sending push notifications:", error2?.message || error2);
  }
}
var onLeadCreated = (0, import_firestore.onDocumentCreated)({
  region: "europe-west1",
  document: "incoming_leads/{leadId}"
}, async (event) => {
  const firebase = getAdmin();
  const snapshot = event.data;
  if (!snapshot) return;
  const leadData = snapshot.data();
  const nome = leadData.nome || leadData.firstName || "Nuovo";
  const cognome = leadData.cognome || leadData.lastName || "Contatto";
  let sede = "";
  const locationId = leadData.selectedLocation || leadData.sede;
  if (locationId) {
    try {
      const suppliersSnap = await firebase.firestore().collection("suppliers").get();
      for (const doc of suppliersSnap.docs) {
        const supplierData = doc.data();
        const loc = supplierData.locations?.find((l) => l.id === locationId);
        if (loc) {
          sede = loc.name;
          break;
        }
      }
    } catch (e) {
      logger.error("Error resolving location name:", e);
    }
  }
  if (!sede) {
    const payloadSede = leadData.locationName || leadData.nomeSede || leadData.selectedLocation || leadData.sede;
    if (payloadSede && typeof payloadSede === "string") sede = payloadSede.trim();
  }
  const title = "\u{1F464} Nuova Richiesta Web";
  let body = sede ? `${nome} ${cognome} ha richiesto informazioni per la sede di ${sede}. Contattalo subito!` : `${nome} ${cognome} ha richiesto informazioni. Contattalo subito!`;
});
var receiveLeadV2 = (0, import_https.onRequest)({
  region: "europe-west1",
  cors: true
}, async (req, res) => {
  const firebase = getAdmin();
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-bridge-key");
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const bridgeKey = req.headers["x-bridge-key"];
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;
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
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1e3);
    const existingLead = await db.collection("incoming_leads").where("email", "==", email.toLowerCase()).where("childName", "==", childName).where("createdAt", ">", sixHoursAgo.toISOString()).limit(1).get();
    if (!existingLead.empty) {
      res.status(200).json({ success: true, referenceId: existingLead.docs[0].id, duplicate: true });
      return;
    }
    const leadDoc = {
      ...data,
      nome: data.nome || data.parentFirstName || "",
      cognome: data.cognome || data.parentLastName || "",
      email,
      telefono: data.telefono || data.parentPhone || "",
      childName,
      childAge: data.childAge || "",
      source: "projectB_api_v2",
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    delete leadDoc.syncStatus;
    const docRef = await db.collection("incoming_leads").add(leadDoc);
    try {
      const dayNames = ["Domenica", "Luned\xEC", "Marted\xEC", "Mercoled\xEC", "Gioved\xEC", "Venerd\xEC", "Sabato"];
      let giornoBundle = "";
      if (data.selectedSlot && typeof data.selectedSlot.dayOfWeek === "number") {
        giornoBundle = dayNames[data.selectedSlot.dayOfWeek];
      } else if (data.selectedSlot && typeof data.selectedSlot.dayOfWeek === "string") {
        giornoBundle = data.selectedSlot.dayOfWeek;
      }
      const reqSede = data.selectedLocation || leadDoc.locationName || leadDoc.sede || "Sede";
      const reqTitle = "\u{1F464} Nuova Richiesta Web";
      const reqBody = giornoBundle ? `${leadDoc.nome} ${leadDoc.cognome} ha richiesto informazioni per il corso presso ${reqSede} del ${giornoBundle}. Contattalo subito!` : `${leadDoc.nome} ${leadDoc.cognome} ha richiesto informazioni per la sede di ${reqSede}. Contattalo subito!`;
      await sendPushToAllTokens(reqTitle, reqBody, {
        leadId: docRef.id,
        type: "lead",
        click_action: "WEB_REQUESTS"
      });
    } catch (fcmErr) {
      logger.error("Error sending immediate FCM in receiveLeadV2:", fcmErr);
    }
    res.status(200).json({ success: true, referenceId: docRef.id });
  } catch (error2) {
    logger.error("Error saving lead v2:", error2?.message || error2);
    res.status(500).json({ error: "Internal Server Error", details: error2?.message });
  }
});
var getPublicSlotsV2 = (0, import_https.onRequest)({
  region: "europe-west1",
  cors: true
}, async (req, res) => {
  const firebase = getAdmin();
  const bridgeKey = req.headers["x-bridge-key"];
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;
  if (bridgeKey !== API_SHARED_SECRET && bearerToken !== API_SHARED_SECRET) {
    res.status(403).json({ error: "Forbidden: Invalid API Key" });
    return;
  }
  try {
    const db = firebase.firestore();
    const [suppliersSnap, enrollmentsSnap, subscriptionsSnap] = await Promise.all([
      db.collection("suppliers").where("isDeleted", "==", false).get(),
      db.collection("enrollments").where("status", "in", ["active", "pending", "confirmed", "Active", "Pending", "Confirmed"]).get(),
      db.collection("subscriptionTypes").get()
    ]);
    const activeSubs = [];
    subscriptionsSnap.forEach((doc) => {
      const sub = doc.data();
      if (sub.isPubliclyVisible === true || sub.isPubliclyVisible === void 0 || sub.isPubliclyVisible === "true") {
        activeSubs.push({ id: doc.id, ...sub });
      }
    });
    if (activeSubs.length === 0) {
      logger.warn("CRITICAL: No active public subscriptions found in database!");
    } else {
      logger.info(`Found ${activeSubs.length} active public subscriptions: ${activeSubs.map((s) => s.name).join(", ")}`);
    }
    const activeEnrollments = enrollmentsSnap.docs.map((doc) => doc.data());
    const results = [];
    suppliersSnap.forEach((doc) => {
      const supplierData = doc.data();
      const locations = supplierData.locations || [];
      locations.forEach((loc) => {
        if (loc.isPubliclyVisible === false || loc.closedAt) return;
        const locationBundles = [];
        const slots = loc.availability || loc.slots || [];
        logger.info(`Location ${loc.name} has ${slots.length} raw slots`);
        slots.forEach((slot) => {
          if (slot.isPubliclyVisible === false) return;
          const compatibleSubs = activeSubs.filter((sub) => {
            if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
              if (!sub.allowedDays.includes(slot.dayOfWeek)) return false;
            }
            const labCount = Number(sub.labCount || 0);
            const sgCount = Number(sub.sgCount || 0);
            const evtCount = Number(sub.evtCount || 0);
            if (slot.type === "LAB" && labCount > 0) return true;
            if (slot.type === "SG" && sgCount > 0) return true;
            if (slot.type === "EVT" && evtCount > 0) return true;
            if (!slot.type) return true;
            return false;
          });
          compatibleSubs.forEach((sub) => {
            const occupied = activeEnrollments.filter((enr) => {
              if (enr.locationId !== loc.id || enr.status !== "active") return false;
              const hasRemaining = enr.lessonsRemaining > 0 || enr.labRemaining > 0 || enr.sgRemaining > 0 || enr.evtRemaining > 0;
              if (!hasRemaining) return false;
              return enr.appointments?.some((app) => {
                if (!app.date || !app.startTime) return false;
                let appDay = -1;
                try {
                  if (app.date.includes("T")) {
                    const [year, month, day] = app.date.split("T")[0].split("-");
                    if (year && month && day) {
                      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      appDay = dateObj.getDay();
                    }
                  }
                  if (appDay === -1) {
                    appDay = new Date(app.date).getDay();
                  }
                } catch (e) {
                  appDay = new Date(app.date).getDay();
                }
                return appDay === slot.dayOfWeek && app.startTime === slot.startTime;
              });
            }).length;
            const capacity = loc.capacity || 10;
            const available = Math.max(0, capacity - occupied);
            const subMinAge = typeof sub.minAge === "number" ? sub.minAge : isNaN(parseInt(sub.minAge)) ? 0 : parseInt(sub.minAge);
            const subMaxAge = typeof sub.maxAge === "number" ? sub.maxAge : isNaN(parseInt(sub.maxAge)) ? 99 : parseInt(sub.maxAge);
            const finalMinAge = Math.max(subMinAge, slot.minAge || 0);
            const finalMaxAge = Math.min(subMaxAge, slot.maxAge || 99);
            if (finalMinAge > finalMaxAge) return;
            locationBundles.push({
              bundleId: `${loc.id}_${sub.id}_${slot.dayOfWeek}_${slot.startTime.replace(":", "")}`,
              name: sub.name,
              publicName: sub.publicName || sub.name,
              description: sub.description || "",
              price: sub.price,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              minAge: finalMinAge,
              maxAge: finalMaxAge,
              availableSeats: available,
              originalCapacity: capacity,
              isFull: available <= 0,
              includedSlots: [{ type: slot.type || "LAB", startTime: slot.startTime, endTime: slot.endTime, minAge: slot.minAge, maxAge: slot.maxAge }]
            });
          });
        });
        if (locationBundles.length > 0) {
          results.push({
            id: loc.id,
            name: loc.name,
            address: loc.address || "",
            city: loc.city || "",
            googleMapsLink: loc.googleMapsLink || "",
            bundles: locationBundles
          });
        }
      });
    });
    res.status(200).json({ success: true, data: results });
  } catch (error2) {
    logger.error("Error fetching public slots v2:", error2?.message || error2);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});
var getEnrollmentData = (0, import_https.onCall)({ region: "europe-west1", cors: true }, async (request) => {
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
  } catch (e) {
    throw new import_https.HttpsError("internal", e.message);
  }
});
var processEnrollment = (0, import_https.onCall)({ region: "europe-west1", cors: true }, async (request) => {
  const firebase = getAdmin();
  const { leadId, formData } = request.data;
  const db = firebase.firestore();
  const batch = db.batch();
  try {
    const enrRef = db.collection("enrollments").doc();
    batch.set(enrRef, { ...formData, id: enrRef.id });
    await batch.commit();
    return { success: true, enrollmentId: enrRef.id };
  } catch (e) {
    throw new import_https.HttpsError("internal", e.message);
  }
});
var suggestBookTags = (0, import_https.onCall)({ region: "europe-west1", cors: true }, async (request) => {
  const { title } = request.data;
  return { target: ["piccoli"], category: ["testo & immagini"], theme: ["societ\xE0"] };
});
var checkPeriodicNotifications = (0, import_scheduler.onSchedule)({ schedule: "* * * * *", timeZone: "Europe/Rome", region: "europe-west1" }, async (event) => {
  const firebase = getAdmin();
  logger.info("Checking periodic notifications...");
});
var onEnrollmentCreated = (0, import_firestore.onDocumentCreated)({ region: "europe-west1", document: "enrollments/{id}" }, async (event) => {
  logger.info("Enrollment created:", event.params.id);
});
var enrollmentGateway = (0, import_https.onRequest)({ region: "europe-west1", cors: true }, async (req, res) => {
  res.status(200).send("Enrollment Gateway Active");
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkPeriodicNotifications,
  enrollmentGateway,
  getEnrollmentData,
  getPublicSlotsV2,
  onEnrollmentCreated,
  onLeadCreated,
  processEnrollment,
  receiveLeadV2,
  sendEmail,
  suggestBookTags
});
