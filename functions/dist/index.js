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

// ../utils/dateUtils.ts
var toLocalISOString = (date) => {
  const offset = date.getTimezoneOffset() * 6e4;
  const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 10);
  return localISOTime;
};
var getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(year, month - 1, day);
};
var getItalianHolidays = (year) => {
  const holidays = {
    [`${year}-01-01`]: "Capodanno",
    [`${year}-01-06`]: "Epifania",
    [`${year}-04-25`]: "Liberazione",
    [`${year}-05-01`]: "Lavoro",
    [`${year}-06-02`]: "Repubblica",
    [`${year}-08-15`]: "Ferragosto",
    [`${year}-11-01`]: "Ognissanti",
    [`${year}-12-08`]: "Immacolata",
    [`${year}-12-25`]: "Natale",
    [`${year}-12-26`]: "S. Stefano"
  };
  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays[toLocalISOString(easter)] = "Pasqua";
  holidays[toLocalISOString(easterMonday)] = "Pasquetta";
  return holidays;
};
var isItalianHoliday = (date) => {
  const year = date.getFullYear();
  const dateStr = toLocalISOString(date);
  const holidays = getItalianHolidays(year);
  return !!holidays[dateStr];
};

// src/index.ts
var import_firestore2 = require("firebase-functions/v2/firestore");
if (admin.apps.length === 0) {
  admin.initializeApp();
}
function getAdmin() {
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
        const groupKey = `${course.locationId}_${sub.id}_${course.dayOfWeek}_${course.startTime.replace(":", "")}`;
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
  if (!leadId) throw new import_https.HttpsError("invalid-argument", "Missing leadId");
  try {
    const db = firebase.firestore();
    const leadSnap = await db.collection("incoming_leads").doc(leadId).get();
    if (!leadSnap.exists) {
      throw new import_https.HttpsError("not-found", "Lead non trovato");
    }
    const leadData = { id: leadSnap.id, ...leadSnap.data() };
    const existingEnrSnap = await db.collection("enrollments").where("email", "==", leadData.email).where("childName", "==", leadData.childName).where("status", "in", ["active", "Active", "pending", "Pending", "confirmed", "Confirmed"]).limit(1).get();
    if (!existingEnrSnap.empty) {
      return { existingEnrollment: { id: existingEnrSnap.docs[0].id, ...existingEnrSnap.docs[0].data() } };
    }
    const [companySnap, subsSnap, suppliersSnap] = await Promise.all([
      db.collection("settings").doc("company").get(),
      db.collection("subscriptionTypes").get(),
      db.collection("suppliers").where("isDeleted", "==", false).get()
    ]);
    const subscriptions = subsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((s) => s.statusConfig?.status === "active" && s.isPubliclyVisible !== false);
    const suppliers = suppliersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return {
      lead: leadData,
      company: companySnap.data(),
      subscriptions,
      suppliers
    };
  } catch (e) {
    logger.error("Error in getEnrollmentData:", e);
    throw new import_https.HttpsError("internal", e.message);
  }
});
var processEnrollment = (0, import_https.onCall)({ region: "europe-west1", cors: true }, async (request) => {
  const firebase = getAdmin();
  const db = firebase.firestore();
  const { leadId, clientData, enrollmentData, transactionData, invoiceData } = request.data;
  if (!leadId) throw new import_https.HttpsError("invalid-argument", "Missing leadId");
  try {
    return await db.runTransaction(async (transaction) => {
      const subRef = db.collection("subscriptionTypes").doc(enrollmentData.subscriptionTypeId);
      const subSnap = await transaction.get(subRef);
      if (!subSnap.exists) throw new Error("Tipo abbonamento non trovato.");
      const sub = subSnap.data();
      const basePrice = sub.price || 0;
      const stampPrice = basePrice >= 77 ? 2 : 0;
      const totalPrice = basePrice + stampPrice;
      const mainAppt = enrollmentData.appointments?.[0];
      const dayNames = ["Domenica", "Luned\xEC", "Marted\xEC", "Mercoled\xEC", "Gioved\xEC", "Venerd\xEC", "Sabato"];
      const slotDayName = mainAppt?.time?.split(",")[0].trim() || dayNames[mainAppt?.dayOfWeek || 0];
      const targetDayIndex = dayNames.indexOf(slotDayName);
      let matchedCourseId = "manual";
      if (targetDayIndex !== -1 && mainAppt?.startTime) {
        const coursesSnap = await db.collection("courses").where("locationId", "==", enrollmentData.locationId).where("dayOfWeek", "==", targetDayIndex).where("startTime", "==", mainAppt.startTime).limit(1).get();
        if (!coursesSnap.empty) {
          matchedCourseId = coursesSnap.docs[0].id;
          logger.info(`[matcher] Iscrizione collegata al corso ${matchedCourseId}`);
        } else {
          logger.warn(`[matcher] Nessun corso trovato per ${enrollmentData.locationName} il ${slotDayName} alle ${mainAppt.startTime}. Fallback su manual.`);
        }
      }
      let clientId = "";
      let childId = "";
      const clientsSnap = await db.collection("clients").where("email", "==", clientData.email.toLowerCase()).limit(1).get();
      const structuredAddress = {
        address: clientData.address || "",
        city: clientData.city || "",
        zipCode: clientData.zipCode || clientData.zip || "",
        province: clientData.province || ""
      };
      const structuredChildren = (clientData.children || []).map((child) => {
        const id = child.id || `child_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        if (!childId || child.name === enrollmentData.childName) childId = id;
        return {
          id,
          name: child.name || "",
          firstName: child.name?.split(" ")[0] || "",
          lastName: child.name?.split(" ").slice(1).join(" ") || "",
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
        const updatedTags = Array.from(new Set(
          currentTags.filter((t) => t.toUpperCase() !== "LEAD").concat(["GENITORE"])
        ));
        const mergedChildren = [...existingData.children || []];
        structuredChildren.forEach((newChild) => {
          const existingChild = mergedChildren.find(
            (c) => c.name?.toLowerCase() === newChild.name?.toLowerCase()
          );
          if (!existingChild) {
            mergedChildren.push(newChild);
          } else {
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
          tags: ["GENITORE"],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      const enrRef = db.collection("enrollments").doc();
      const enrichedAppointments = (enrollmentData.appointments || []).map((app) => ({
        ...app,
        dayOfWeek: targetDayIndex,
        startTime: app.startTime || mainAppt?.startTime || "16:00",
        endTime: app.endTime || mainAppt?.endTime || "17:00",
        locationId: enrollmentData.locationId,
        locationName: enrollmentData.locationName,
        locationColor: enrollmentData.locationColor || "#6366f1",
        childName: enrollmentData.childName
      }));
      const finalEnrollment = {
        ...enrollmentData,
        id: enrRef.id,
        clientId,
        childId,
        // COLLEGAMENTO CRUCIALE PER MODALE
        courseId: matchedCourseId,
        // Collegamento al corso reale per visibilità liste/archivio
        price: totalPrice,
        appointments: enrichedAppointments,
        status: enrollmentData.status || "Active",
        // Manteniamo Case-Sensitive
        source: "portal",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        startDate: admin.firestore.FieldValue.serverTimestamp()
      };
      transaction.set(enrRef, finalEnrollment);
      const transRef = db.collection("transactions").doc();
      transaction.set(transRef, {
        ...transactionData,
        id: transRef.id,
        clientId,
        relatedEnrollmentId: enrRef.id,
        amount: totalPrice,
        allocationId: enrollmentData.locationId,
        allocationName: enrollmentData.locationName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      if (invoiceData) {
        const invRef = db.collection("invoices").doc();
        transaction.set(invRef, {
          ...invoiceData,
          id: invRef.id,
          clientId,
          relatedEnrollmentId: enrRef.id,
          totalAmount: totalPrice,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      if (targetDayIndex !== -1) {
        let currentLessonDate = /* @__PURE__ */ new Date();
        while (currentLessonDate.getDay() !== targetDayIndex) {
          currentLessonDate.setDate(currentLessonDate.getDate() + 1);
        }
        const lessonsToCreate = enrollmentData.lessonsTotal || sub.lessons || 1;
        let createdCount = 0;
        let firstDate = "";
        while (createdCount < lessonsToCreate) {
          const dateStr = currentLessonDate.toISOString().split("T")[0];
          if (!isItalianHoliday(currentLessonDate)) {
            const lessonRef = db.collection("lessons").doc();
            transaction.set(lessonRef, {
              id: lessonRef.id,
              enrollmentId: enrRef.id,
              courseId: matchedCourseId,
              // OBBLIGATORIO PER GETTONIERA
              locationId: enrollmentData.locationId,
              locationName: enrollmentData.locationName,
              locationColor: enrollmentData.locationColor || "#6366f1",
              date: dateStr,
              startTime: enrichedAppointments[0]?.startTime || "16:00",
              endTime: enrichedAppointments[0]?.endTime || "17:00",
              childName: enrollmentData.childName,
              status: "Scheduled",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (createdCount === 0) firstDate = dateStr;
            createdCount++;
          }
          currentLessonDate.setDate(currentLessonDate.getDate() + 7);
        }
        if (firstDate) {
          transaction.update(enrRef, { startDate: firstDate });
        }
      }
      transaction.update(db.collection("incoming_leads").doc(leadId), {
        status: "processed",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        relatedEnrollmentId: enrRef.id,
        relatedClientId: clientId
      });
      try {
        const title = "\u{1F680} Nuova Iscrizione!";
        const body = `${finalEnrollment.childName} si \xE8 iscritto a ${finalEnrollment.locationName} (${finalEnrollment.subscriptionName})`;
        await sendPushToAllTokens(title, body, {
          enrollmentId: enrRef.id,
          type: "enrollment",
          click_action: "ENROLLMENTS"
        });
      } catch (pushErr) {
        logger.error("Error sending push notification:", pushErr);
      }
      return { success: true, enrollmentId: enrRef.id, clientId };
    });
  } catch (e) {
    logger.error("Error in processEnrollment:", e);
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
  const oldRemaining = before.lessonsRemaining !== void 0 ? before.lessonsRemaining : before.labRemaining || 0;
  const newRemaining = after.lessonsRemaining !== void 0 ? after.lessonsRemaining : after.labRemaining || 0;
  const oldCourseId = before.courseId || before.selectedCourseId;
  const newCourseId = after.courseId || after.selectedCourseId;
  const isActive = (s) => ["active", "Active", "confirmed", "Confirmed", "pending", "Pending"].includes(s);
  const wasValid = isActive(oldStatus) && oldRemaining > 0;
  const isValid = isActive(newStatus) && newRemaining > 0;
  if (oldCourseId !== newCourseId) {
    if (oldCourseId && wasValid) {
      try {
        await db.collection("courses").doc(oldCourseId).update({
          activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Decremented old course ${oldCourseId} due to course move`);
      } catch (e) {
        logger.error(`Error decrementing old course ${oldCourseId}:`, e);
      }
    }
    if (newCourseId && isValid) {
      try {
        await db.collection("courses").doc(newCourseId).update({
          activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Incremented new course ${newCourseId} due to course move`);
      } catch (e) {
        logger.error(`Error incrementing new course ${newCourseId}:`, e);
      }
    }
  } else if (newCourseId) {
    if (!wasValid && isValid) {
      await db.collection("courses").doc(newCourseId).update({
        activeEnrollmentsCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`Incremented course ${newCourseId} (became valid)`);
    } else if (wasValid && !isValid) {
      await db.collection("courses").doc(newCourseId).update({
        activeEnrollmentsCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`Decremented course ${newCourseId} (became invalid)`);
    }
  }
});
var enrollmentGateway = (0, import_https.onRequest)({ region: "europe-west1", cors: true }, async (req, res) => {
  const firebase = getAdmin();
  const leadId = req.query.id;
  if (!leadId) {
    return res.status(400).send("ID Iscrizione mancante");
  }
  try {
    const db = firebase.firestore();
    const leadSnap = await db.collection("incoming_leads").doc(leadId).get();
    if (!leadSnap.exists) {
      return res.status(404).send("Iscrizione non trovata o scaduta.");
    }
    const lead = leadSnap.data();
    const nomeAllievo = lead.childName || lead.nome || "Allievo";
    const sede = lead.selectedLocation || lead.locationName || "EasyPeasy Lab";
    const title = `Completa l'iscrizione di ${nomeAllievo}`;
    const description = `Ciao ${lead.nome || "Genitore"}, mancano pochissimi passi per confermare il posto presso ${sede}.`;
    const logoUrl = "https://ep-v1-gestionale.vercel.app/lemon_logo_150px.png";
    const portalUrl = `https://ep-portal-chi.vercel.app/?id=${leadId}#/iscrizione`;
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
    res.status(200).set("Content-Type", "text/html").send(html);
  } catch (err) {
    logger.error("Error in enrollmentGateway:", err);
    res.status(500).send("Errore interno del server");
  }
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
