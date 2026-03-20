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
  getPublicSlotsV5: () => getPublicSlotsV5,
  onEnrollmentCreated: () => onEnrollmentCreated,
  onEnrollmentDeleted: () => onEnrollmentDeleted,
  onEnrollmentUpdated: () => onEnrollmentUpdated,
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
var import_firestore2 = require("firebase-functions/v2/firestore");
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
var getPublicSlotsV5 = (0, import_https.onRequest)({
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
    const age = req.query.age ? parseInt(req.query.age.toString()) : null;
    const [locationsSnap, coursesSnap, subsSnap] = await Promise.all([
      db.collection("locations").where("status", "==", "active").get(),
      db.collection("courses").where("status", "==", "open").get(),
      db.collection("subscriptionTypes").get()
    ]);
    const activeSubs = [];
    subsSnap.forEach((doc) => {
      const sub = doc.data();
      if (sub.isPubliclyVisible !== false) {
        activeSubs.push({ id: doc.id, ...sub });
      }
    });
    const locationsMap = /* @__PURE__ */ new Map();
    locationsSnap.forEach((doc) => locationsMap.set(doc.id, doc.data()));
    const results = [];
    const locationBundlesGrouped = /* @__PURE__ */ new Map();
    coursesSnap.forEach((doc) => {
      const course = doc.data();
      const loc = locationsMap.get(course.locationId);
      if (!loc) return;
      if (age !== null && (age < course.minAge || age > course.maxAge)) return;
      const compatibleSubs = activeSubs.filter((sub) => {
        const hasToken = course.slotType === "LAB" && sub.labCount > 0 || course.slotType === "SG" && sub.sgCount > 0 || course.slotType === "EVT" && sub.evtCount > 0;
        if (!hasToken) return false;
        if (sub.allowedDays && Array.isArray(sub.allowedDays) && sub.allowedDays.length > 0) {
          if (!sub.allowedDays.includes(course.dayOfWeek)) return false;
        }
        const subMinAge = sub.allowedAges?.min || sub.minAge || 0;
        const subMaxAge = sub.allowedAges?.max || sub.maxAge || 99;
        if (age !== null && (age < subMinAge || age > subMaxAge)) return false;
        return true;
      });
      compatibleSubs.forEach((sub) => {
        const groupKey = `${course.locationId}_${sub.id}_${course.dayOfWeek}`;
        if (!locationBundlesGrouped.has(course.locationId)) {
          locationBundlesGrouped.set(course.locationId, []);
        }
        const locBundles = locationBundlesGrouped.get(course.locationId);
        let bundle = locBundles.find((b) => b.bundleId === groupKey);
        const available = Math.max(0, course.capacity - course.activeEnrollmentsCount);
        if (!bundle) {
          bundle = {
            bundleId: groupKey,
            subscriptionId: sub.id,
            name: sub.name,
            publicName: sub.publicName || sub.name,
            description: sub.description || "",
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
    locationBundlesGrouped.forEach((bundles, locId) => {
      const loc = locationsMap.get(locId);
      results.push({
        id: loc.id,
        name: loc.name,
        address: loc.address || "",
        city: loc.city || "",
        googleMapsLink: loc.googleMapsLink || "",
        bundles
      });
    });
    res.status(200).json({ success: true, data: results });
  } catch (error2) {
    logger.error("Error in getPublicSlotsV5:", error2);
    res.status(500).json({ error: "Failed to fetch slots v5" });
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
var onEnrollmentCreated = (0, import_firestore.onDocumentCreated)({
  region: "europe-west1",
  document: "enrollments/{id}"
}, async (event) => {
  const firebase = getAdmin();
  const db = firebase.firestore();
  const enrollment = event.data?.data();
  if (!enrollment) return;
  logger.info(`Processing enrollment created: ${event.params.id}`);
  if (["active", "Active", "confirmed", "Confirmed", "pending", "Pending"].includes(enrollment.status)) {
    const courseId = enrollment.courseId || enrollment.selectedCourseId;
    if (courseId) {
      try {
        await db.collection("courses").doc(courseId).update({
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
var onEnrollmentDeleted = (0, import_firestore2.onDocumentDeleted)({
  region: "europe-west1",
  document: "enrollments/{id}"
}, async (event) => {
  const firebase = getAdmin();
  const db = firebase.firestore();
  const enrollment = event.data?.data();
  if (!enrollment) return;
  logger.info(`Processing enrollment deleted: ${event.params.id}`);
  if (["active", "Active", "confirmed", "Confirmed", "pending", "Pending"].includes(enrollment.status)) {
    const courseId = enrollment.courseId || enrollment.selectedCourseId;
    if (courseId) {
      try {
        await db.collection("courses").doc(courseId).update({
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
var onEnrollmentUpdated = (0, import_firestore2.onDocumentUpdated)({
  region: "europe-west1",
  document: "enrollments/{id}"
}, async (event) => {
  const firebase = getAdmin();
  const db = firebase.firestore();
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const oldStatus = before.status;
  const newStatus = after.status;
  const courseId = after.courseId || after.selectedCourseId || before.courseId || before.selectedCourseId;
  if (!courseId) return;
  const isActive = (s) => ["active", "Active", "confirmed", "Confirmed", "pending", "Pending"].includes(s);
  if (!isActive(oldStatus) && isActive(newStatus)) {
    await db.collection("courses").doc(courseId).update({
      activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else if (isActive(oldStatus) && !isActive(newStatus)) {
    await db.collection("courses").doc(courseId).update({
      activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});
var enrollmentGateway = (0, import_https.onRequest)({ region: "europe-west1", cors: true }, async (req, res) => {
  res.status(200).send("Enrollment Gateway Active");
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkPeriodicNotifications,
  enrollmentGateway,
  getEnrollmentData,
  getPublicSlotsV5,
  onEnrollmentCreated,
  onEnrollmentDeleted,
  onEnrollmentUpdated,
  onLeadCreated,
  processEnrollment,
  receiveLeadV2,
  sendEmail,
  suggestBookTags
});
