import { db } from "../firebase/config";
import { collection, getDocs, getDocsFromServer, addDoc, where, query, doc, updateDoc, getDoc, getDocFromServer, writeBatch, arrayUnion } from "firebase/firestore";
import { AppointmentStatus, EnrollmentStatus, ClientType, DocumentStatus } from "../types";
import { isItalianHoliday } from "../utils/dateUtils";
import { getSchoolClosures } from "./calendarService";
import { getLocations, getAllCourses } from "./courseService";
import { getSuppliers } from "./supplierService";
const getEnrollmentCollectionRef = () => collection(db, "enrollments");
const bookStudentIntoCourseLessons = async (enrollmentId, courseId, clientId, childId, childName, startDate, totalLessons, quotas) => {
  const lessonsRef = collection(db, "lessons");
  const q = query(
    lessonsRef,
    where("courseId", "==", courseId)
  );
  const snap = await getDocs(q);
  const lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => {
    const cleanLDate = l.date.split("T")[0];
    const cleanSDate = startDate.split("T")[0];
    return cleanLDate >= cleanSDate;
  }).sort((a, b) => a.date.localeCompare(b.date));
  const batch = writeBatch(db);
  let bookedCount = 0;
  const tokenUsage = {};
  let finalEndDate = startDate;
  const attendee = {
    clientId,
    childId,
    childName,
    enrollmentId,
    status: "Scheduled"
  };
  for (const lesson of lessons) {
    if (bookedCount >= totalLessons) break;
    const type = lesson.slotType || "LAB";
    const currentUsage = tokenUsage[type] || 0;
    if (quotas && quotas[type] !== void 0) {
      if (currentUsage >= quotas[type]) continue;
    }
    const lessonDocRef = doc(db, "lessons", lesson.id);
    const isAlreadyBooked = (lesson.attendees || []).some((a) => a.enrollmentId === enrollmentId);
    if (isAlreadyBooked) continue;
    lesson.attendees = [...lesson.attendees || [], attendee];
    batch.update(lessonDocRef, {
      attendees: arrayUnion(attendee)
    });
    tokenUsage[type] = currentUsage + 1;
    bookedCount++;
    finalEndDate = lesson.date;
  }
  if (bookedCount > 0) {
    await batch.commit();
  }
  const bookedLessons = lessons.filter(
    (l) => (l.attendees || []).some((a) => a.enrollmentId === enrollmentId)
  );
  return {
    bookedCount,
    tokenUsage,
    finalEndDate,
    bookedLessons
  };
};
const docToEnrollment = (doc2) => {
  return { id: doc2.id, ...doc2.data() };
};
const getEnrollmentsForClient = async (clientId) => {
  const q = query(getEnrollmentCollectionRef(), where("clientId", "==", clientId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToEnrollment);
};
const getActiveLocationForClient = async (clientId) => {
  try {
    const enrollments = await getEnrollmentsForClient(clientId);
    const activeEnr = enrollments.find(
      (e) => e.status === EnrollmentStatus.Active && e.locationId && e.locationId !== "unassigned"
    );
    if (activeEnr) {
      return { id: activeEnr.locationId, name: activeEnr.locationName };
    }
    return null;
  } catch (e) {
    console.warn("Smart Link Error:", e);
    return null;
  }
};
const getAllEnrollments = async () => {
  const snapshot = await getDocs(getEnrollmentCollectionRef());
  return snapshot.docs.map(docToEnrollment);
};
const addEnrollment = async (enrollment) => {
  const docRef = await addDoc(getEnrollmentCollectionRef(), enrollment);
  return docRef.id;
};
const createInstitutionalEnrollment = async (quote, selectedLessons, projectName, shouldGenerateInvoices = true) => {
  const batch = writeBatch(db);
  const enrollmentData = {
    clientId: quote.clientId,
    clientType: ClientType.Institutional,
    childId: "institutional-student",
    // Convenzione per allievi enti
    childName: projectName,
    isAdult: false,
    isQuoteBased: true,
    relatedQuoteId: quote.id,
    subscriptionTypeId: "quote-based",
    subscriptionName: `Progetto: ${quote.quoteNumber}`,
    price: quote.totalAmount,
    supplierId: "multiple",
    supplierName: "Ente Istituzionale",
    locationId: "institutional",
    locationName: "Sedi Progetto",
    locationColor: "#3C3C52",
    appointments: selectedLessons.map((l) => ({
      lessonId: l.id,
      date: l.date,
      startTime: l.startTime,
      endTime: l.endTime,
      locationId: "institutional",
      locationName: l.locationName,
      locationColor: l.locationColor,
      childName: projectName,
      status: "Scheduled"
    })),
    lessonsTotal: selectedLessons.length,
    lessonsRemaining: selectedLessons.length,
    startDate: selectedLessons.length > 0 ? selectedLessons[0].date : quote.issueDate,
    endDate: selectedLessons.length > 0 ? selectedLessons[selectedLessons.length - 1].date : quote.expiryDate,
    status: EnrollmentStatus.Active,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const newEnrRef = doc(collection(db, "enrollments"));
  batch.set(newEnrRef, enrollmentData);
  selectedLessons.forEach((l) => {
    const lessonRef = doc(db, "lessons", l.id);
    const attendee = {
      clientId: quote.clientId,
      childId: "institutional",
      childName: projectName,
      enrollmentId: newEnrRef.id,
      status: AppointmentStatus.Scheduled
    };
    batch.update(lessonRef, {
      attendees: arrayUnion(attendee),
      // Uso arrayUnion per supportare iscrizioni multiple
      description: `${projectName} (${quote.quoteNumber})`
    });
  });
  if (shouldGenerateInvoices) {
    const quoteRef = doc(db, "quotes", quote.id);
    batch.update(quoteRef, { status: DocumentStatus.Paid });
  }
  await batch.commit();
  return newEnrRef.id;
};
const generateTheoreticalAppointments = (startDate, totalLessons, locationId, locationName, locationColor, startTime, endTime, childName, comboConfigs, weeklyPlan, courseStartDate, targetDayOfWeek) => {
  const appointments = [];
  const startObj = new Date(startDate);
  startObj.setHours(12, 0, 0, 0);
  const current = new Date(startObj);
  if (targetDayOfWeek !== void 0) {
    while (current.getDay() !== targetDayOfWeek) {
      current.setDate(current.getDate() + 1);
    }
  }
  let loops = 0;
  let count = 0;
  while (count < totalLessons && loops < 100) {
    if (!isItalianHoliday(current)) {
      let sTime = startTime;
      let eTime = endTime;
      let aType = "LAB";
      if (comboConfigs && comboConfigs.LAB && comboConfigs.SG && weeklyPlan) {
        const referenceDate = new Date(courseStartDate || startDate);
        referenceDate.setHours(12, 0, 0, 0);
        const msPerWeek = 7 * 24 * 60 * 60 * 1e3;
        const weeksSinceStart = Math.floor(
          (current.getTime() - referenceDate.getTime()) / msPerWeek
        );
        const planSize = Object.keys(weeklyPlan).length || 4;
        const weekNum = weeksSinceStart % planSize + 1;
        const plannedType = weeklyPlan[weekNum] || "LAB";
        if (plannedType === "LAB") {
          sTime = comboConfigs.LAB.startTime;
          eTime = comboConfigs.LAB.endTime;
          aType = "LAB";
        } else {
          sTime = comboConfigs.SG.startTime;
          eTime = comboConfigs.SG.endTime;
          aType = "SG";
        }
      }
      appointments.push({
        lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        date: current.toISOString(),
        startTime: sTime,
        endTime: eTime,
        locationId,
        locationName,
        locationColor,
        childName,
        status: "Scheduled",
        type: aType
      });
      count++;
    }
    current.setDate(current.getDate() + 7);
    loops++;
  }
  return appointments;
};
const updateEnrollment = async (id, enrollment, regenerateCalendar = false) => {
  if (!id) throw new Error("ID iscrizione mancante per aggiornamento");
  const enrollmentDoc = doc(db, "enrollments", id);
  const oldSnap = await getDoc(enrollmentDoc);
  if (!oldSnap.exists()) return;
  const oldData = oldSnap.data();
  if (regenerateCalendar && enrollment.courseId && enrollment.courseId !== "manual") {
    const batch = writeBatch(db);
    if (oldData.courseId) {
      const courseLessonsQuery = query(collection(db, "lessons"), where("courseId", "==", oldData.courseId));
      const courseLessonsSnap = await getDocs(courseLessonsQuery);
      courseLessonsSnap.forEach((lessonDoc) => {
        const lessonData = lessonDoc.data();
        if (lessonData.attendees && lessonData.attendees.some((a) => a.enrollmentId === id)) {
          const newAttendees = lessonData.attendees.filter((a) => a.enrollmentId !== id);
          batch.update(lessonDoc.ref, { attendees: newAttendees });
        }
      });
    }
    await batch.commit();
    await updateDoc(enrollmentDoc, enrollment);
    const targetCourseId = enrollment.courseId;
    let startTime = enrollment.appointments?.[0]?.startTime || oldData.appointments?.[0]?.startTime || "";
    let endTime = enrollment.appointments?.[0]?.endTime || oldData.appointments?.[0]?.endTime || "";
    if (targetCourseId && targetCourseId !== "manual") {
      try {
        const courseSnap = await getDoc(doc(db, "courses", targetCourseId));
        if (courseSnap.exists()) {
          const courseData = courseSnap.data();
          startTime = courseData.startTime || startTime;
          endTime = courseData.endTime || endTime;
        }
      } catch (e) {
        console.warn("[UpdateEnrollment] Impossibile leggere corso, uso orari di fallback:", e);
      }
    }
    if (!startTime) startTime = "09:00";
    if (!endTime) endTime = "10:00";
    const dayOfWeek = new Date(enrollment.startDate || oldData.startDate).getDay();
    await activateEnrollmentWithLocation(
      id,
      enrollment.supplierId || oldData.supplierId || "unassigned",
      enrollment.supplierName || oldData.supplierName || "",
      enrollment.locationId || oldData.locationId || "unassigned",
      enrollment.locationName || oldData.locationName || "Sede",
      enrollment.locationColor || oldData.locationColor || "#ccc",
      dayOfWeek,
      startTime,
      endTime
    );
    return;
  }
  if (regenerateCalendar && enrollment.startDate && enrollment.lessonsTotal) {
    const oldAppointments = oldData.appointments || [];
    const historyMap = /* @__PURE__ */ new Map();
    oldAppointments.forEach((a) => {
      const k = a.date.split("T")[0];
      historyMap.set(k, a);
    });
    const refApp = oldAppointments.length > 0 ? oldAppointments[0] : null;
    const locId = enrollment.locationId || oldData.locationId || "unassigned";
    const locName = enrollment.locationName || oldData.locationName || "Sede Non Definita";
    const locColor = enrollment.locationColor || oldData.locationColor || "#ccc";
    const timeSource = enrollment.appointments && enrollment.appointments.length > 0 ? enrollment.appointments[0] : refApp;
    const startTime = timeSource?.startTime || "16:00";
    const endTime = timeSource?.endTime || "18:00";
    const childName = enrollment.childName || oldData.childName;
    const targetDay = new Date(enrollment.startDate).getDay();
    const theoreticalSchedule = generateTheoreticalAppointments(
      enrollment.startDate,
      enrollment.lessonsTotal,
      locId,
      locName,
      locColor,
      startTime,
      endTime,
      childName,
      void 0,
      // comboConfigs
      void 0,
      // weeklyPlan
      void 0,
      // courseStartDate
      targetDay
      // targetDayOfWeek
    );
    const mergedAppointments = theoreticalSchedule.map((newApp) => {
      const key = newApp.date.split("T")[0];
      const historicalMatch = historyMap.get(key);
      if (historicalMatch) {
        return {
          ...newApp,
          lessonId: historicalMatch.lessonId,
          status: historicalMatch.status
        };
      } else {
        return newApp;
      }
    });
    enrollment.appointments = mergedAppointments;
    const used = mergedAppointments.filter((a) => a.status === "Present").length;
    enrollment.lessonsRemaining = Math.max(0, enrollment.lessonsTotal - used);
    if (mergedAppointments.length > 0) {
      mergedAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      enrollment.startDate = mergedAppointments[0].date;
      enrollment.endDate = mergedAppointments[mergedAppointments.length - 1].date;
    }
  }
  await updateDoc(enrollmentDoc, enrollment);
};
const deleteEnrollment = async (id) => {
  const batch = writeBatch(db);
  const enrollmentRef = doc(db, "enrollments", id);
  const enrollmentSnap = await getDoc(enrollmentRef);
  let courseId = null;
  if (enrollmentSnap.exists()) {
    const enrData = enrollmentSnap.data();
    courseId = enrData.courseId;
  }
  batch.delete(enrollmentRef);
  try {
    const oldLessonsQuery = query(collection(db, "lessons"), where("enrollmentId", "==", id));
    const oldLessonsSnap = await getDocs(oldLessonsQuery);
    oldLessonsSnap.forEach((lessonDoc) => {
      batch.delete(lessonDoc.ref);
    });
    console.log(`Deep Delete: Cleaning up ${oldLessonsSnap.size} old lessons for enrollment ${id}`);
  } catch (error) {
    console.error("Error during deep delete of old lessons:", error instanceof Error ? error.message : error);
  }
  if (courseId) {
    try {
      const courseLessonsQuery = query(collection(db, "lessons"), where("courseId", "==", courseId));
      const courseLessonsSnap = await getDocs(courseLessonsQuery);
      let updatedCount = 0;
      courseLessonsSnap.forEach((lessonDoc) => {
        const lessonData = lessonDoc.data();
        if (lessonData.attendees && lessonData.attendees.some((a) => a.enrollmentId === id)) {
          const newAttendees = lessonData.attendees.filter((a) => a.enrollmentId !== id);
          batch.update(lessonDoc.ref, { attendees: newAttendees });
          updatedCount++;
        }
      });
      console.log(`Deep Delete: Removed attendee from ${updatedCount} course lessons for enrollment ${id}`);
    } catch (error) {
      console.error("Error during cleanup of course lessons:", error instanceof Error ? error.message : error);
    }
  }
  await batch.commit();
};
const bonificaAppointments = async () => {
  console.log("Inizio bonifica chirurgica appointments...");
  const enrollmentsSnap = await getDocs(collection(db, "enrollments"));
  let updatedCount = 0;
  const batch = writeBatch(db);
  let operationsInBatch = 0;
  const lessonsRef = collection(db, "lessons");
  const lessonsSnap = await getDocs(lessonsRef);
  const lessonDocs = lessonsSnap.docs;
  for (const docSnap of enrollmentsSnap.docs) {
    const data = docSnap.data();
    if (data.appointments && data.appointments.length > 0) {
      const originalCount = data.appointments.length;
      const preservedApps = (data.appointments || []).filter((app) => {
        if (app.status === "Present" || app.status === "Absent" || app.status === "Suspended" || app.recoveryId) return true;
        if (data.clientType === ClientType.Institutional && data.relatedQuoteId && app.status === "Scheduled") {
          return true;
        }
        if (data.courseId && data.courseId !== "manual") {
          const hasLesson = lessonDocs.some((ld) => {
            const l = ld.data();
            return l.courseId === data.courseId && l.date.split("T")[0] === app.date.split("T")[0] && l.startTime === app.startTime && l.attendees?.some((att) => att.enrollmentId === docSnap.id);
          });
          if (hasLesson) return false;
        }
        return true;
      });
      if (preservedApps.length !== originalCount) {
        batch.update(docSnap.ref, { appointments: preservedApps });
        updatedCount++;
        operationsInBatch++;
      }
      if (operationsInBatch >= 450) {
        await batch.commit();
        operationsInBatch = 0;
      }
    }
  }
  if (operationsInBatch > 0) {
    await batch.commit();
  }
  await recuperoIntegraleDati();
  console.log(`Bonifica e Ripristino completati. ${updatedCount} iscrizioni sanate.`);
  return updatedCount;
};
const recuperoIntegraleDati = async () => {
  console.log("[Recovery] Avvio Motore di Ripristino...");
  const [enrollmentsSnap, lessonsSnap, coursesSnap, subTypesSnap] = await Promise.all([
    getDocs(collection(db, "enrollments")),
    getDocs(collection(db, "lessons")),
    getDocs(collection(db, "courses")),
    getDocs(collection(db, "subscriptionTypes"))
  ]);
  const enrMap = new Map(enrollmentsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const subTypesMap = new Map(subTypesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const lessonDocs = lessonsSnap.docs;
  const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const batch = writeBatch(db);
  let counter = 0;
  for (const lessonDoc of lessonDocs) {
    const lesson = lessonDoc.data();
    if (!lesson.attendees || lesson.attendees.length === 0) {
      if (lesson.courseId === "manual" || !lesson.courseId) {
        batch.delete(lessonDoc.ref);
      }
      continue;
    }
    const validAttendees = lesson.attendees.filter((att) => {
      const enr = enrMap.get(att.enrollmentId || "");
      if (!enr) return true;
      if (enr.courseId && enr.courseId !== "manual") return true;
      const subType = subTypesMap.get(enr.subscriptionTypeId);
      const allowedDays = subType?.allowedDays || [];
      if (allowedDays.length === 0) return true;
      const dateParts = lesson.date.split("T")[0].split("-").map(Number);
      const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const dayOfWeek = d.getDay();
      return allowedDays.includes(dayOfWeek);
    });
    if (validAttendees.length === 0) {
      batch.delete(lessonDoc.ref);
      for (const att of lesson.attendees) {
        if (att.enrollmentId) {
          const e = enrMap.get(att.enrollmentId);
          if (e) {
            const updatedApps = (e.appointments || []).filter((a) => a.lessonId !== lessonDoc.id);
            batch.update(doc(db, "enrollments", e.id), { appointments: updatedApps });
          }
        }
      }
    } else if (validAttendees.length !== lesson.attendees.length) {
      batch.update(lessonDoc.ref, { attendees: validAttendees });
    }
  }
  for (const lessonDoc of lessonDocs) {
    const lesson = lessonDoc.data();
    if (!lesson.attendees || lesson.attendees.length === 0) continue;
    for (const attendee of lesson.attendees) {
      if (!attendee.enrollmentId) continue;
      const enr = enrMap.get(attendee.enrollmentId);
      if (!enr) continue;
      const exists = (enr.appointments || []).some(
        (app) => app.lessonId === lessonDoc.id || app.date.split("T")[0] === lesson.date.split("T")[0] && app.startTime === lesson.startTime
      );
      if (!exists) {
        const newApp = {
          lessonId: lessonDoc.id,
          date: lesson.date,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          locationId: lesson.locationId || enr.locationId,
          locationName: lesson.locationName,
          locationColor: lesson.locationColor,
          childName: attendee.childName,
          status: attendee.status || AppointmentStatus.Scheduled,
          type: lesson.slotType
        };
        const updatedApps = [...enr.appointments || [], newApp].sort((a, b) => a.date.localeCompare(b.date));
        batch.update(doc(db, "enrollments", enr.id), { appointments: updatedApps });
        enr.appointments = updatedApps;
        counter++;
      }
    }
  }
  for (const enr of enrMap.values()) {
    if (enr.status === EnrollmentStatus.Active && enr.lessonsTotal > 0) {
      const currentCount = (enr.appointments || []).length;
      if (currentCount < enr.lessonsTotal) {
        const remaining = enr.lessonsTotal - currentCount;
        let recoveredApps = [];
        if (enr.clientType === ClientType.Institutional && enr.relatedQuoteId) {
          const quoteDoc = await getDoc(doc(db, "quotes", enr.relatedQuoteId));
          if (quoteDoc.exists()) {
            const quote = quoteDoc.data();
            const installments = quote.installments || [];
            const existingDates = new Set((enr.appointments || []).map((a) => a.date.split("T")[0]));
            const missingDates = installments.map((i) => i.dueDate.split("T")[0]).filter((date) => !existingDates.has(date)).sort().slice(0, remaining);
            recoveredApps = missingDates.map((date) => ({
              lessonId: "ghost-" + Date.now() + Math.random().toString(36).substr(2, 5),
              date: date + "T12:00:00Z",
              startTime: "10:00",
              // Default per istituzionali
              endTime: "12:00",
              locationId: enr.locationId || "institutional",
              locationName: enr.locationName || "Sede Istituzionale",
              locationColor: enr.locationColor || "#3C3C52",
              childName: enr.childName,
              status: AppointmentStatus.Scheduled
            }));
          }
        } else if (enr.courseId && enr.courseId !== "manual") {
          const course = courses.find((c) => c.id === enr.courseId);
          const lastDate = enr.appointments && enr.appointments.length > 0 ? enr.appointments[enr.appointments.length - 1].date : enr.startDate;
          recoveredApps = generateTheoreticalAppointments(
            lastDate,
            remaining + 1,
            enr.locationId,
            enr.locationName,
            enr.locationColor,
            course?.startTime || "09:00",
            course?.endTime || "10:00",
            enr.childName,
            course?.comboConfigs,
            course?.weeklyPlan,
            enr.startDate,
            course?.dayOfWeek
          ).slice(1);
        }
        if (recoveredApps.length > 0) {
          const updatedApps = [...enr.appointments || [], ...recoveredApps].sort((a, b) => a.date.localeCompare(b.date));
          batch.update(doc(db, "enrollments", enr.id), { appointments: updatedApps });
          enr.appointments = updatedApps;
          counter++;
        }
      }
    }
  }
  for (const enr of enrMap.values()) {
    const originalLength = enr.appointments?.length || 0;
    if (originalLength === 0) continue;
    const subType = subTypesMap.get(enr.subscriptionTypeId);
    const allowedDays = subType?.allowedDays || [];
    const finalApps = (enr.appointments || []).filter((app, index, self) => {
      const appDateStr = app.date.split("T")[0];
      const duplicateIndex = self.findIndex(
        (t) => t.date.split("T")[0] === appDateStr && t.startTime === app.startTime
      );
      if (duplicateIndex !== index) return false;
      if (enr.courseId === "manual" || !enr.courseId) {
        if (allowedDays.length > 0 && !app.recoveryId) {
          const dateParts = appDateStr.split("-").map(Number);
          const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
          const dayOfWeek = d.getDay();
          if (!allowedDays.includes(dayOfWeek)) {
            if (app.status === "Scheduled" || !app.status || !app.lessonId && (app.status === "Present" || app.status === "Absent")) return false;
          }
        }
      }
      return true;
    });
    if (finalApps.length !== originalLength) {
      batch.update(doc(db, "enrollments", enr.id), { appointments: finalApps });
      counter++;
    }
  }
  if (counter > 0) {
    await batch.commit();
    console.log(`[Recovery] Ripristinati/Sanati ${counter} blocchi dati.`);
  }
};
const syncEnrollmentFromLessonUpdate = async (lessonId, lessonUpdate) => {
  if (!lessonUpdate.date && !lessonUpdate.startTime && !lessonUpdate.endTime && !lessonUpdate.locationName) return;
  let attendeesFromDB = [];
  try {
    const lessonRef = doc(db, "lessons", lessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) return;
    attendeesFromDB = lessonSnap.data().attendees || [];
  } catch (e) {
    console.warn("[SyncLessonUpdate] Impossibile leggere lesson dal DB:", e);
    return;
  }
  if (attendeesFromDB.length === 0) return;
  const batch = writeBatch(db);
  let updatedCount = 0;
  for (const attendee of attendeesFromDB) {
    if (attendee.enrollmentId) {
      const enrRef = doc(db, "enrollments", attendee.enrollmentId);
      const enrSnap = await getDoc(enrRef);
      if (enrSnap.exists()) {
        const enrData = enrSnap.data();
        let modified = false;
        const newApps = (enrData.appointments || []).map((app) => {
          if (app.lessonId === lessonId) {
            modified = true;
            return {
              ...app,
              date: lessonUpdate.date || app.date,
              startTime: lessonUpdate.startTime || app.startTime,
              endTime: lessonUpdate.endTime || app.endTime,
              locationName: lessonUpdate.locationName || app.locationName,
              locationColor: lessonUpdate.locationColor || app.locationColor
            };
          }
          return app;
        });
        if (modified) {
          batch.update(enrRef, { appointments: newApps });
          updatedCount++;
        }
      }
    }
  }
  if (updatedCount > 0) {
    await batch.commit();
    console.log(`[Sync] Updated ${updatedCount} enrollments from manual lesson update.`);
  }
};
const syncEnrollmentFromLessonDeletion = async (lessonId, lessonDetails) => {
  const q = query(collection(db, "enrollments"), where("status", "in", ["active", "confirmed", "pending"]));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let updatedCount = 0;
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.appointments) return;
    let matchedByHardLink = false;
    let matchedByFuzzy = false;
    data.appointments.forEach((a) => {
      if (a.lessonId === lessonId) matchedByHardLink = true;
      else if (lessonDetails) {
        const matchDate = a.date.split("T")[0] === lessonDetails.date.split("T")[0];
        const matchTime = a.startTime === lessonDetails.startTime;
        const matchLoc = (a.locationName || "").trim().toLowerCase() === (lessonDetails.locationName || "").trim().toLowerCase();
        if (matchDate && matchTime && matchLoc) matchedByFuzzy = true;
      }
    });
    const hasMatch = matchedByHardLink || matchedByFuzzy;
    if (matchedByFuzzy && !matchedByHardLink) {
      console.warn(
        `[Sync][FUZZY] Rimozione lezione ${lessonId} su enrollment ${docSnap.id} via fuzzy match (data/ora/sede). Verificare manualmente se il collegamento \xE8 corretto.`
      );
    }
    if (hasMatch) {
      const newApps = data.appointments.filter((a) => {
        if (a.lessonId === lessonId) return false;
        if (lessonDetails) {
          const matchDate = a.date.split("T")[0] === lessonDetails.date.split("T")[0];
          const matchTime = a.startTime === lessonDetails.startTime;
          const matchLoc = (a.locationName || "").trim().toLowerCase() === (lessonDetails.locationName || "").trim().toLowerCase();
          if (matchDate && matchTime && matchLoc) return false;
        }
        return true;
      });
      batch.update(docSnap.ref, { appointments: newApps });
      updatedCount++;
    }
  });
  if (updatedCount > 0) {
    await batch.commit();
    console.log(`[Sync] Removed deleted lesson ${lessonId} (and matching slots) from ${updatedCount} enrollments.`);
  }
};
const resyncInstitutionalEnrollment = async (enrollmentId) => {
  if (!enrollmentId) throw new Error("ID iscrizione mancante per resync");
  try {
    const enrollmentRef = doc(db, "enrollments", enrollmentId);
    const enrollmentSnap = await getDocFromServer(enrollmentRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrData = enrollmentSnap.data();
    const startDate = new Date(enrData.startDate);
    const endDate = new Date(enrData.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("Date iscrizione non valide. Impossibile ottimizzare la ricerca.");
    }
    const rangeStart = new Date(startDate);
    rangeStart.setDate(rangeStart.getDate() - 60);
    const rangeEnd = new Date(endDate);
    rangeEnd.setDate(rangeEnd.getDate() + 60);
    const rangeStartStr = rangeStart.toISOString().split("T")[0];
    const rangeEndStr = rangeEnd.toISOString().split("T")[0];
    console.log(`[Resync] Query range (Network Only): ${rangeStartStr} to ${rangeEndStr}`);
    const lessonsRef = collection(db, "lessons");
    const q = query(
      lessonsRef,
      where("date", ">=", rangeStartStr),
      where("date", "<=", rangeEndStr)
    );
    const lessonsSnap = await getDocsFromServer(q);
    const allLessonsInWindow = lessonsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    console.log(`[Resync] Fetched ${allLessonsInWindow.length} potential lessons from server.`);
    let linkedLessons = allLessonsInWindow.filter((l) => l.attendees && l.attendees.some((a) => a.enrollmentId === enrollmentId));
    if (linkedLessons.length === 0) {
      console.log(`[Resync] Nessun hard-link trovato. Avvio ricerca per nome progetto: "${enrData.childName}"`);
      const projectNameLower = enrData.childName.trim().toLowerCase();
      const candidates = allLessonsInWindow.filter(
        (l) => (l.description || "").toLowerCase().includes(projectNameLower) || (l.childName || "").toLowerCase().includes(projectNameLower)
      );
      if (candidates.length > 0) {
        console.log(`[Resync] Trovate ${candidates.length} lezioni orfane compatibili. Eseguo healing...`);
        const batch = writeBatch(db);
        candidates.forEach((l) => {
          const attendees = l.attendees || [];
          const cleanAttendees = attendees.filter((a) => a.childName !== enrData.childName);
          cleanAttendees.push({
            clientId: enrData.clientId,
            childId: "institutional",
            childName: enrData.childName,
            enrollmentId
            // Questo è il link mancante che ripristiniamo
          });
          batch.update(doc(db, "lessons", l.id), { attendees: cleanAttendees });
        });
        await batch.commit();
        linkedLessons = candidates;
      }
    }
    if (linkedLessons.length === 0) {
      return 0;
    }
    linkedLessons.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const newAppointments = linkedLessons.map((l) => ({
      lessonId: l.id,
      date: l.date,
      startTime: l.startTime,
      endTime: l.endTime,
      locationId: "institutional",
      // Manteniamo la logica di raggruppamento
      locationName: l.locationName,
      locationColor: l.locationColor,
      childName: enrData.childName,
      // Use Enrollment project name
      status: "Scheduled"
    }));
    await updateDoc(enrollmentRef, {
      appointments: newAppointments,
      lessonsTotal: newAppointments.length,
      lessonsRemaining: newAppointments.length,
      // O calcola in base a stato lezione se avessimo 'completed' su lesson
      startDate: newAppointments[0].date,
      endDate: newAppointments[newAppointments.length - 1].date
    });
    return newAppointments.length;
  } catch (e) {
    console.error("Critical Resync Error:", e instanceof Error ? e.message : e);
    throw e;
  }
};
const registerAbsence = async (enrollmentId, appointmentLessonId, strategy, manualDetails, cachedClosures, isNewArchitecture) => {
  if (!appointmentLessonId) throw new Error("ID lezione mancante per assenza");
  if (!enrollmentId) throw new Error("Impossibile gestire assenza: ID iscrizione mancante");
  if (isNewArchitecture) {
    const lessonRef = doc(db, "lessons", appointmentLessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
    const lessonData = lessonSnap.data();
    const attendees = [...lessonData.attendees || []];
    let attendeeIndex = attendees.findIndex((a) => a.enrollmentId === enrollmentId);
    if (attendeeIndex === -1) {
      const enrRef = doc(db, "enrollments", enrollmentId);
      const enrSnap = await getDoc(enrRef);
      if (enrSnap.exists()) {
        const enrData = enrSnap.data();
        const newAttendee = {
          clientId: enrData.clientId || "",
          childId: enrData.childId || enrData.id || "",
          childName: enrData.childName || "Allievo",
          enrollmentId,
          status: "Scheduled"
        };
        attendees.push(newAttendee);
        attendeeIndex = attendees.length - 1;
      } else {
        throw new Error("Allievo non trovato nell'archivio");
      }
    }
    if ((strategy === "recover_auto" || strategy === "recover_manual") && attendees[attendeeIndex].recoveryId) {
      console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
      return;
    }
    attendees[attendeeIndex].status = "Absent";
    await updateDoc(lessonRef, { attendees });
    await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, "Absent");
    return;
  }
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === appointmentLessonId);
  if (appIndex === -1) throw new Error("Lezione non trovata");
  const previousStatus = appointments[appIndex].status;
  if ((strategy === "recover_auto" || strategy === "recover_manual") && appointments[appIndex].recoveryId) {
    console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
    return;
  }
  appointments[appIndex].status = "Absent";
  let newLessonsRemaining = enrollment.lessonsRemaining;
  if (previousStatus === "Present") {
    newLessonsRemaining += 1;
  }
  if (strategy === "lost") {
    newLessonsRemaining -= 1;
  }
  newLessonsRemaining = Math.max(0, Math.min(enrollment.lessonsTotal, newLessonsRemaining));
  if (strategy === "recover_auto" || strategy === "recover_manual") {
    const originalApp = appointments[appIndex];
    let newAppointment = null;
    const recoveryId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    if (strategy === "recover_manual" && manualDetails) {
      newAppointment = {
        lessonId: recoveryId,
        date: new Date(manualDetails.date).toISOString(),
        startTime: manualDetails.startTime,
        endTime: manualDetails.endTime,
        locationId: manualDetails.locationId,
        locationName: manualDetails.locationName,
        locationColor: manualDetails.locationColor,
        childName: originalApp.childName,
        status: "Scheduled",
        recoveredLessonId: originalApp.lessonId
      };
    } else {
      const closures = cachedClosures || await getSchoolClosures();
      const closedDates = new Set(closures.map((c) => c.date.split("T")[0]));
      const sortedApps = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const lastApp = sortedApps[sortedApps.length - 1];
      const nextDate = new Date(lastApp.date);
      const originalDayOfWeek = new Date(originalApp.date).getDay();
      let foundDate = false;
      let safetyCounter = 0;
      while (!foundDate && safetyCounter < 52) {
        nextDate.setDate(nextDate.getDate() + 1);
        const isoDate = nextDate.toISOString().split("T")[0];
        if (nextDate.getDay() === originalDayOfWeek && !isItalianHoliday(nextDate) && !closedDates.has(isoDate)) {
          foundDate = true;
        }
        safetyCounter++;
      }
      if (foundDate) {
        newAppointment = {
          lessonId: recoveryId,
          date: nextDate.toISOString(),
          startTime: originalApp.startTime,
          endTime: originalApp.endTime,
          locationId: originalApp.locationId,
          locationName: originalApp.locationName,
          locationColor: originalApp.locationColor,
          childName: originalApp.childName,
          status: "Scheduled",
          recoveredLessonId: originalApp.lessonId
        };
      }
    }
    if (newAppointment) {
      appointments[appIndex].recoveryId = recoveryId;
      appointments.push(newAppointment);
    }
  }
  appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let newEndDate = enrollment.endDate;
  if (appointments.length > 0) {
    newEndDate = appointments[appointments.length - 1].date;
  }
  await updateDoc(enrollmentDocRef, {
    appointments,
    lessonsRemaining: newLessonsRemaining,
    endDate: newEndDate
  });
};
const calculateRemainingCounters = (enrollment, appointments) => {
  const labCount = enrollment.labCount || 0;
  const sgCount = enrollment.sgCount || 0;
  const evtCount = enrollment.evtCount || 0;
  const readCount = enrollment.readCount || 0;
  const lessonsTotal = enrollment.lessonsTotal || 0;
  const labAttended = appointments.filter((a) => a.type === "LAB" && a.status === "Present").length;
  const sgAttended = appointments.filter((a) => a.type === "SG" && a.status === "Present").length;
  const evtAttended = appointments.filter((a) => a.type === "EVT" && a.status === "Present").length;
  const readAttended = appointments.filter((a) => a.type === "READ" && a.status === "Present").length;
  const totalAttended = appointments.filter((a) => a.status === "Present").length;
  return {
    lessonsRemaining: Math.max(0, lessonsTotal - totalAttended),
    labRemaining: Math.max(0, labCount - labAttended),
    sgRemaining: Math.max(0, sgCount - sgAttended),
    evtRemaining: Math.max(0, evtCount - evtAttended),
    readRemaining: Math.max(0, readCount - readAttended)
  };
};
const syncAttendanceToEnrollmentCache = async (enrollmentId, lessonId, status) => {
  if (!enrollmentId) return;
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) return;
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  let appIndex = appointments.findIndex((a) => a.lessonId === lessonId);
  if (appIndex === -1) {
    try {
      const lessonRef = doc(db, "lessons", lessonId);
      const lessonSnap = await getDoc(lessonRef);
      if (lessonSnap.exists()) {
        const l = lessonSnap.data();
        const newApp = {
          lessonId,
          date: l.date,
          startTime: l.startTime,
          endTime: l.endTime,
          locationId: l.locationId || enrollment.locationId || "unknown",
          locationName: l.locationName || enrollment.locationName,
          locationColor: l.locationColor || enrollment.locationColor,
          childName: enrollment.childName,
          status,
          type: l.slotType
        };
        appointments.push(newApp);
        appIndex = appointments.length - 1;
      } else {
        return;
      }
    } catch (e) {
      console.warn("[SyncCache] Impossibile costruire appointment dalla lesson:", e);
      return;
    }
  } else {
    appointments[appIndex] = { ...appointments[appIndex], status };
  }
  const newCounters = calculateRemainingCounters(enrollment, appointments);
  await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};
const registerPresence = async (enrollmentId, appointmentLessonId, isNewArchitecture) => {
  if (!appointmentLessonId) throw new Error("ID lezione mancante per presenza");
  if (!enrollmentId) {
    if (isNewArchitecture) {
      const lessonRef = doc(db, "lessons", appointmentLessonId);
      const lessonSnap = await getDoc(lessonRef);
      if (lessonSnap.exists()) {
        const lessonData = lessonSnap.data();
        const attendees = [...lessonData.attendees || []];
        attendees.findIndex((a) => !a.enrollmentId && a.childName);
      }
    }
    throw new Error("Impossibile sincronizzare: ID iscrizione mancante");
  }
  if (isNewArchitecture) {
    const lessonRef = doc(db, "lessons", appointmentLessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
    const lessonData = lessonSnap.data();
    const attendees = [...lessonData.attendees || []];
    let attendeeIndex = attendees.findIndex((a) => a.enrollmentId === enrollmentId);
    if (attendeeIndex === -1) {
      const enrRef = doc(db, "enrollments", enrollmentId);
      const enrSnap = await getDoc(enrRef);
      if (enrSnap.exists()) {
        const enrData = enrSnap.data();
        const newAttendee = {
          clientId: enrData.clientId || "",
          childId: enrData.childId || enrData.id || "",
          childName: enrData.childName || "Allievo",
          enrollmentId,
          status: "Scheduled"
        };
        attendees.push(newAttendee);
        attendeeIndex = attendees.length - 1;
      } else {
        throw new Error("Allievo non trovato nell'archivio");
      }
    }
    if (attendees[attendeeIndex].status === "Present") return;
    attendees[attendeeIndex].status = "Present";
    await updateDoc(lessonRef, { attendees });
    await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, "Present");
    return;
  }
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === appointmentLessonId);
  if (appIndex === -1) throw new Error("Lezione non trovata");
  if (appointments[appIndex].status === "Present") return;
  appointments[appIndex].status = "Present";
  appointments[appIndex].locationId = enrollment.locationId;
  appointments[appIndex].locationName = enrollment.locationName;
  appointments[appIndex].locationColor = enrollment.locationColor;
  const newCounters = calculateRemainingCounters(enrollment, appointments);
  await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};
const resetAppointmentStatus = async (enrollmentId, appointmentLessonId, isNewArchitecture) => {
  if (!enrollmentId) throw new Error("Impossibile resettare: ID iscrizione mancante");
  if (isNewArchitecture) {
    const lessonRef = doc(db, "lessons", appointmentLessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
    const lessonData = lessonSnap.data();
    const attendees = [...lessonData.attendees || []];
    let attendeeIndex = attendees.findIndex((a) => a.enrollmentId === enrollmentId);
    if (attendeeIndex === -1) {
      const enrRef = doc(db, "enrollments", enrollmentId);
      const enrSnap = await getDoc(enrRef);
      if (enrSnap.exists()) {
        const enrData = enrSnap.data();
        const newAttendee = {
          clientId: enrData.clientId || "",
          childId: enrData.childId || enrData.id || "",
          childName: enrData.childName || "Allievo",
          enrollmentId,
          status: "Scheduled"
        };
        attendees.push(newAttendee);
        attendeeIndex = attendees.length - 1;
      } else {
        throw new Error("Allievo non trovato nell'archivio");
      }
    }
    attendees[attendeeIndex].status = "Scheduled";
    await updateDoc(lessonRef, { attendees });
    await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, "Scheduled");
    return;
  }
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === appointmentLessonId);
  if (appIndex === -1) throw new Error("Lezione non trovata");
  appointments[appIndex].status = "Scheduled";
  const newCounters = calculateRemainingCounters(enrollment, appointments);
  await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};
const deleteAppointment = async (enrollmentId, appointmentLessonId, isNewArchitecture) => {
  if (!appointmentLessonId) throw new Error("ID lezione mancante per cancellazione");
  if (!enrollmentId) throw new Error("Impossibile eliminare: ID iscrizione mancante");
  if (isNewArchitecture) {
    const lessonRef = doc(db, "lessons", appointmentLessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
    const lessonData = lessonSnap.data();
    const attendees = lessonData.attendees || [];
    const newAttendees = attendees.filter((a) => a.enrollmentId !== enrollmentId);
    await updateDoc(lessonRef, { attendees: newAttendees });
    return;
  }
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === appointmentLessonId);
  if (appIndex === -1) throw new Error("Lezione non trovata");
  appointments.splice(appIndex, 1);
  const newCounters = calculateRemainingCounters(enrollment, appointments);
  await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};
const toggleAppointmentStatus = async (enrollmentId, appointmentLessonId, isNewArchitecture) => {
  if (!enrollmentId) throw new Error("Impossibile cambiare stato: ID iscrizione mancante");
  if (isNewArchitecture) {
    const lessonRef = doc(db, "lessons", appointmentLessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
    const lessonData = lessonSnap.data();
    const attendees = [...lessonData.attendees || []];
    let attendeeIndex = attendees.findIndex((a) => a.enrollmentId === enrollmentId);
    if (attendeeIndex === -1) {
      const enrRef = doc(db, "enrollments", enrollmentId);
      const enrSnap = await getDoc(enrRef);
      if (enrSnap.exists()) {
        const enrData = enrSnap.data();
        const newAttendee = {
          clientId: enrData.clientId || "",
          childId: enrData.childId || enrData.id || "",
          childName: enrData.childName || "Allievo",
          enrollmentId,
          status: "Scheduled"
        };
        attendees.push(newAttendee);
        attendeeIndex = attendees.length - 1;
      } else {
        throw new Error("Allievo non trovato nell'archivio");
      }
    }
    const currentStatus2 = attendees[attendeeIndex].status;
    let nextStatus = currentStatus2;
    if (currentStatus2 === "Present") {
      nextStatus = "Absent";
    } else if (currentStatus2 === "Absent") {
      nextStatus = "Present";
    } else if (currentStatus2 === "Scheduled") {
      nextStatus = "Present";
    }
    attendees[attendeeIndex].status = nextStatus;
    await updateDoc(lessonRef, { attendees });
    await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, nextStatus);
    return;
  }
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === appointmentLessonId);
  if (appIndex === -1) throw new Error("Lezione non trovata");
  const currentStatus = appointments[appIndex].status;
  if (currentStatus === "Present") {
    appointments[appIndex].status = "Absent";
  } else if (currentStatus === "Absent") {
    appointments[appIndex].status = "Present";
  } else if (currentStatus === "Scheduled") {
    appointments[appIndex].status = "Present";
  }
  const newCounters = calculateRemainingCounters(enrollment, appointments);
  await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};
const addRecoveryLessons = async (enrollmentId, startDate, startTime, endTime, numberOfLessons, locationName, locationColor) => {
  if (!enrollmentId) throw new Error("ID iscrizione mancante per recupero");
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  const appointments = [...enrollment.appointments || []];
  const childName = enrollment.childName;
  const currentDate = new Date(startDate);
  let generatedCount = 0;
  while (generatedCount < numberOfLessons) {
    if (!isItalianHoliday(currentDate)) {
      const newAppointment = {
        lessonId: `REC-${Date.now()}-${generatedCount}`,
        date: currentDate.toISOString(),
        startTime,
        endTime,
        locationId: enrollment.locationId,
        locationName,
        locationColor,
        childName,
        status: "Scheduled"
      };
      appointments.push(newAppointment);
      generatedCount++;
    }
    currentDate.setDate(currentDate.getDate() + 7);
  }
  appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const newEndDate = appointments.length > 0 ? appointments[appointments.length - 1].date : enrollment.endDate;
  await updateDoc(enrollmentDocRef, { appointments, endDate: newEndDate });
};
const migrateHistoricalEnrollments = async () => {
  const snapshot = await getDocs(getEnrollmentCollectionRef());
  let updatedCount = 0;
  let errorCount = 0;
  const batch = writeBatch(db);
  let batchSize = 0;
  for (const docSnap of snapshot.docs) {
    try {
      const enr = docSnap.data();
      const appointments = [...enr.appointments || []];
      let modified = false;
      const newApps = appointments.map((app) => {
        const appDate = app.date.split("T")[0];
        let type = app.type || "LAB";
        if (enr.clientType === ClientType.Institutional || enr.isQuoteBased) {
          type = "INST";
        } else if (appDate === "2026-02-22") {
          type = "EVT";
        } else if (appDate === "2026-02-21" && app.startTime === "09:30" && app.endTime === "12:30") {
          type = "SG";
        } else if (appDate === "2026-02-28" && app.startTime === "09:30" && app.endTime === "12:30") {
          type = "SG";
        } else if ((appDate === "2026-02-07" || appDate === "2026-02-14") && app.startTime === "10:00" && app.endTime === "11:00") {
          type = "LAB";
        } else if (new Date(appDate) <= /* @__PURE__ */ new Date("2026-02-06")) {
          type = "LAB";
        }
        if (app.type !== type) {
          modified = true;
          return { ...app, type };
        }
        return app;
      });
      const labCount = newApps.filter((a) => a.type === "LAB").length;
      const sgCount = newApps.filter((a) => a.type === "SG").length;
      const evtCount = newApps.filter((a) => a.type === "EVT").length;
      const readCount = newApps.filter((a) => a.type === "READ").length;
      const labAttended = newApps.filter((a) => a.type === "LAB" && a.status === "Present").length;
      const sgAttended = newApps.filter((a) => a.type === "SG" && a.status === "Present").length;
      const evtAttended = newApps.filter((a) => a.type === "EVT" && a.status === "Present").length;
      const readAttended = newApps.filter((a) => a.type === "READ" && a.status === "Present").length;
      const needsUpdate = modified || enr.labCount === void 0 || enr.sgCount === void 0 || enr.evtCount === void 0 || enr.readCount === void 0;
      if (needsUpdate) {
        const updateData = {
          appointments: newApps,
          labCount,
          sgCount,
          evtCount,
          readCount,
          labRemaining: Math.max(0, labCount - labAttended),
          sgRemaining: Math.max(0, sgCount - sgAttended),
          evtRemaining: Math.max(0, evtCount - evtAttended),
          readRemaining: Math.max(0, readCount - readAttended)
        };
        batch.update(docSnap.ref, updateData);
        batchSize++;
        updatedCount++;
      }
      if (batchSize >= 400) {
        await batch.commit();
        batchSize = 0;
      }
    } catch (e) {
      console.error(`Error migrating enrollment ${docSnap.id}:`, e instanceof Error ? e.message : e);
      errorCount++;
    }
  }
  if (batchSize > 0) {
    await batch.commit();
  }
  return { updated: updatedCount, errors: errorCount };
};
const activateEnrollmentWithLocation = async (enrollmentId, supplierId, supplierName, locationId, locationName, locationColor, dayOfWeek, startTime, endTime) => {
  const enrollmentDocRef = doc(db, "enrollments", enrollmentId);
  const enrollmentSnap = await getDoc(enrollmentDocRef);
  if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
  const enrollment = enrollmentSnap.data();
  let comboConfigs = void 0;
  let weeklyPlan = void 0;
  if (enrollment.courseId) {
    const courseSnap = await getDoc(doc(db, "courses", enrollment.courseId));
    if (courseSnap.exists()) {
      const courseData = courseSnap.data();
      if (courseData.slotType === "LAB+SG") {
        comboConfigs = courseData.comboConfigs;
        weeklyPlan = courseData.weeklyPlan;
      }
    }
  }
  const currentDate = new Date(enrollment.startDate);
  while (currentDate.getDay() !== dayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  let labUsed = 0;
  let sgUsed = 0;
  let finalEndDate = enrollment.endDate;
  let appointments = [];
  let courseDayOfWeek = void 0;
  if (enrollment.courseId) {
    const courseRef = doc(db, "courses", enrollment.courseId);
    const courseSnap = await getDoc(courseRef);
    if (courseSnap.exists()) {
      const courseData = courseSnap.data();
      courseDayOfWeek = courseData.dayOfWeek;
    }
    const quotasObj = {};
    const anyEnr = enrollment;
    if (anyEnr.tokens && anyEnr.tokens.length > 0) {
      anyEnr.tokens.forEach((t) => {
        quotasObj[t.type] = t.count;
      });
    } else {
      if (enrollment.labCount) quotasObj["LAB"] = enrollment.labCount;
      if (enrollment.sgCount) quotasObj["SG"] = enrollment.sgCount;
      if (enrollment.evtCount) quotasObj["EVT"] = enrollment.evtCount;
      if (enrollment.readCount) quotasObj["READ"] = enrollment.readCount;
    }
    const bookingResult = await bookStudentIntoCourseLessons(
      enrollmentId,
      enrollment.courseId,
      enrollment.clientId,
      enrollment.childId,
      enrollment.childName,
      currentDate.toISOString(),
      enrollment.lessonsTotal,
      quotasObj
    );
    labUsed = bookingResult.tokenUsage["LAB"] || 0;
    sgUsed = bookingResult.tokenUsage["SG"] || 0;
    finalEndDate = bookingResult.finalEndDate;
    let bookedLessons = bookingResult.bookedLessons || [];
    bookedLessons = bookedLessons.sort((a, b) => a.date.localeCompare(b.date)).slice(0, enrollment.lessonsTotal);
    const now = /* @__PURE__ */ new Date();
    appointments = bookedLessons.map((l) => {
      const attendee = l.attendees?.find((a) => a.enrollmentId === enrollmentId);
      let status = attendee?.status || AppointmentStatus.Scheduled;
      const lessonDate = new Date(l.date);
      const isPast = lessonDate.getTime() < now.getTime() - 24 * 60 * 60 * 1e3;
      if (isPast && status === AppointmentStatus.Scheduled) {
        status = AppointmentStatus.Absent;
      }
      return {
        lessonId: l.id,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        locationId,
        locationName,
        locationColor,
        childName: enrollment.childName,
        status,
        type: l.slotType
      };
    });
    if (appointments.length < enrollment.lessonsTotal) {
      const missingCount = enrollment.lessonsTotal - appointments.length;
      let nextDateObj = new Date(currentDate);
      nextDateObj.setHours(12, 0, 0, 0);
      if (appointments.length > 0) {
        const lastDate = appointments[appointments.length - 1].date;
        nextDateObj = new Date(lastDate);
        nextDateObj.setHours(12, 0, 0, 0);
        let found = false;
        let failsafe = 0;
        while (!found && failsafe < 100) {
          nextDateObj.setDate(nextDateObj.getDate() + 7);
          if (!isItalianHoliday(nextDateObj)) {
            found = true;
          }
          failsafe++;
        }
      }
      const theoreticalMissing = generateTheoreticalAppointments(
        nextDateObj.toISOString(),
        missingCount,
        locationId,
        locationName,
        locationColor,
        startTime,
        endTime,
        enrollment.childName,
        comboConfigs,
        weeklyPlan,
        currentDate.toISOString(),
        // courseStartDate
        courseDayOfWeek
        // targetDayOfWeek
      );
      appointments = [...appointments, ...theoreticalMissing];
    }
    if (appointments.length > 0) {
      appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      finalEndDate = appointments[appointments.length - 1].date;
    }
  } else {
    appointments = generateTheoreticalAppointments(
      currentDate.toISOString(),
      enrollment.lessonsTotal,
      locationId,
      locationName,
      locationColor,
      startTime,
      endTime,
      enrollment.childName,
      comboConfigs,
      weeklyPlan,
      void 0,
      // courseStartDate
      dayOfWeek
      // targetDayOfWeek
    );
    if (comboConfigs) {
      labUsed = appointments.filter((a) => a.type === "LAB").length;
      sgUsed = appointments.filter((a) => a.type === "SG").length;
    }
    if (appointments.length > 0) {
      finalEndDate = appointments[appointments.length - 1].date;
    }
  }
  await updateDoc(enrollmentDocRef, {
    supplierId,
    supplierName,
    locationId,
    locationName,
    locationColor,
    appointments,
    // Sarà vuoto per i corsi, pieno per i custom
    labUsed,
    sgUsed,
    labRemaining: (enrollment.labCount || 0) - labUsed,
    sgRemaining: (enrollment.sgCount || 0) - sgUsed,
    startDate: currentDate.toISOString(),
    endDate: finalEndDate,
    status: EnrollmentStatus.Active
  });
};
const bulkUpdateLocation = async (enrollmentIds, fromDate, newLocationId, newLocationName, newLocationColor, newStartTime, newEndTime) => {
  const batch = writeBatch(db);
  const fromDateObj = new Date(fromDate);
  fromDateObj.setHours(0, 0, 0, 0);
  for (const id of enrollmentIds) {
    const docRef = doc(db, "enrollments", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const enr = snap.data();
      const appointments = (enr.appointments || []).map((app) => {
        const appDate = new Date(app.date);
        if (appDate >= fromDateObj && app.status !== "Present" && app.status !== "Absent") {
          return {
            ...app,
            locationId: newLocationId,
            locationName: newLocationName,
            locationColor: newLocationColor,
            startTime: newStartTime || app.startTime,
            endTime: newEndTime || app.endTime
          };
        }
        return app;
      });
      batch.update(docRef, {
        locationId: newLocationId,
        locationName: newLocationName,
        locationColor: newLocationColor,
        appointments
      });
    }
  }
  await batch.commit();
};
const suspendLessonsForClosure = async (closureDate) => {
  const batch = writeBatch(db);
  const targetDateStr = closureDate.split("T")[0];
  const enrollmentsSnapshot = await getDocs(getEnrollmentCollectionRef());
  enrollmentsSnapshot.docs.forEach((docSnap) => {
    const enr = docSnap.data();
    if (enr.appointments && enr.appointments.length > 0) {
      let modified = false;
      const newApps = enr.appointments.map((app) => {
        const appDateStr = app.date.split("T")[0];
        if (appDateStr === targetDateStr && app.status === "Scheduled") {
          modified = true;
          return { ...app, status: "Suspended" };
        }
        return app;
      });
      if (modified) {
        batch.update(docSnap.ref, { appointments: newApps });
      }
    }
  });
  const lessonsCollectionRef = collection(db, "lessons");
  const lessonsSnapshot = await getDocs(lessonsCollectionRef);
  lessonsSnapshot.docs.forEach((docSnap) => {
    const lesson = docSnap.data();
    const lessonDateStr = lesson.date.split("T")[0];
    if (lessonDateStr !== targetDateStr) return;
    const updates = {};
    if (!lesson.description.startsWith("[SOSPESO]")) {
      updates.description = `[SOSPESO] ${lesson.description}`;
    }
    if (lesson.attendees && lesson.attendees.length > 0) {
      const updatedAttendees = lesson.attendees.map(
        (a) => a.status === "Scheduled" ? { ...a, status: "Suspended" } : a
      );
      updates.attendees = updatedAttendees;
    }
    if (Object.keys(updates).length > 0) {
      batch.update(docSnap.ref, updates);
    }
  });
  await batch.commit();
};
const restoreSuspendedLessons = async (closureDate) => {
  const batch = writeBatch(db);
  const targetDateStr = closureDate.split("T")[0];
  const enrollmentsSnapshot = await getDocs(getEnrollmentCollectionRef());
  enrollmentsSnapshot.docs.forEach((docSnap) => {
    const enr = docSnap.data();
    if (enr.appointments && enr.appointments.length > 0) {
      let modified = false;
      const newApps = enr.appointments.map((app) => {
        const appDateStr = app.date.split("T")[0];
        if (appDateStr === targetDateStr && app.status === "Suspended") {
          modified = true;
          return { ...app, status: "Scheduled" };
        }
        return app;
      });
      if (modified) {
        batch.update(docSnap.ref, { appointments: newApps });
      }
    }
  });
  const lessonsCollectionRef = collection(db, "lessons");
  const lessonsSnapshot = await getDocs(lessonsCollectionRef);
  lessonsSnapshot.docs.forEach((docSnap) => {
    const lesson = docSnap.data();
    const lessonDateStr = lesson.date.split("T")[0];
    if (lessonDateStr !== targetDateStr) return;
    const updates = {};
    if (lesson.description.startsWith("[SOSPESO]")) {
      updates.description = lesson.description.replace("[SOSPESO] ", "").replace("[SOSPESO]", "").trim();
    }
    if (lesson.attendees && lesson.attendees.length > 0) {
      const updatedAttendees = lesson.attendees.map(
        (a) => a.status === "Suspended" ? { ...a, status: "Scheduled" } : a
      );
      updates.attendees = updatedAttendees;
    }
    if (Object.keys(updates).length > 0) {
      batch.update(docSnap.ref, updates);
    }
  });
  await batch.commit();
};
const rescheduleSuspendedLesson = async (enrollmentId, lessonId, newDate, strategy) => {
  const enrRef = doc(db, "enrollments", enrollmentId);
  const snap = await getDoc(enrRef);
  if (!snap.exists()) return;
  const enr = snap.data();
  const appointments = [...enr.appointments || []];
  const appIndex = appointments.findIndex((a) => a.lessonId === lessonId);
  if (appIndex === -1) return;
  const originalApp = appointments[appIndex];
  let targetDateObj = /* @__PURE__ */ new Date();
  if (strategy === "move_to_date") {
    targetDateObj = new Date(newDate);
  } else {
    const sortedApps = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastApp = sortedApps[sortedApps.length - 1];
    const lastDate = new Date(lastApp.date);
    const candidateDate = new Date(lastDate);
    candidateDate.setDate(candidateDate.getDate() + 7);
    while (isItalianHoliday(candidateDate)) {
      candidateDate.setDate(candidateDate.getDate() + 7);
    }
    targetDateObj = candidateDate;
  }
  const newApp = {
    ...originalApp,
    date: targetDateObj.toISOString(),
    status: "Scheduled"
  };
  appointments[appIndex] = newApp;
  appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const newEndDate = appointments[appointments.length - 1].date;
  await updateDoc(enrRef, { appointments, endDate: newEndDate });
};
const fixSingleEnrollment = async (enr) => {
  try {
    const courses = await getAllCourses();
    const locations = await getLocations();
    const suppliers = await getSuppliers();
    let courseId = enr.courseId;
    const locationId = enr.locationId;
    if ((!courseId || courseId === "manual") && locationId && locationId !== "unassigned") {
      const startDate = new Date(enr.startDate);
      if (!isNaN(startDate.getTime())) {
        const dayOfWeek = startDate.getDay();
        let matchingCourse = courses.find(
          (c) => c.locationId === locationId && c.dayOfWeek === dayOfWeek
        );
        if (!matchingCourse) {
          matchingCourse = courses.find((c) => c.locationId === locationId);
        }
        if (matchingCourse) courseId = matchingCourse.id;
      }
    }
    if (courseId && courseId !== "manual") {
      const course = courses.find((c) => c.id === courseId);
      if (course) {
        const location = locations.find((l) => l.id === course.locationId);
        const supplier = suppliers.find((s) => s.id === location?.supplierId);
        await activateEnrollmentWithLocation(
          enr.id,
          location?.supplierId || enr.supplierId || "unassigned",
          supplier?.companyName || enr.supplierName || "",
          course.locationId,
          location?.name || enr.locationName || "Sede",
          location?.color || enr.locationColor || "#ccc",
          course.dayOfWeek,
          course.startTime,
          course.endTime
        );
        return true;
      }
    }
    if (locationId && locationId !== "unassigned") {
      let startTime = enr.appointments?.[0]?.startTime || "";
      let endTime = enr.appointments?.[0]?.endTime || "";
      if (!startTime && enr.id) {
        try {
          const futureLessonsQ = query(
            collection(db, "lessons"),
            where("courseId", "==", enr.courseId || ""),
            where("date", ">=", (/* @__PURE__ */ new Date()).toISOString())
          );
          const futureLessonsSnap = await getDocs(futureLessonsQ);
          if (!futureLessonsSnap.empty) {
            const firstLesson = futureLessonsSnap.docs[0].data();
            startTime = firstLesson.startTime;
            endTime = firstLesson.endTime;
          }
        } catch {
        }
      }
      if (!startTime) {
        console.warn(`[ActivateFallback] Orario non trovato per enrollment ${enr.id}, uso 09:00.`);
        startTime = "09:00";
        endTime = "10:00";
      }
      const dayOfWeek = new Date(enr.startDate || (/* @__PURE__ */ new Date()).toISOString()).getDay();
      await activateEnrollmentWithLocation(
        enr.id,
        enr.supplierId || "unassigned",
        enr.supplierName || "",
        locationId,
        enr.locationName || "Sede",
        enr.locationColor || "#ccc",
        dayOfWeek,
        startTime,
        endTime
      );
      return true;
    }
  } catch (err) {
    console.error(`Error fixing enrollment ${enr.id}:`, err);
  }
  return false;
};
const autoFixEnrollments = async () => {
  console.log("[Auto-Fix] Avvio scansione iscrizioni problematiche...");
  const snapshot = await getDocs(getEnrollmentCollectionRef());
  const allEnrollments = snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
  const problematic = allEnrollments.filter((e) => {
    const hasNoApps = !e.appointments || e.appointments.length === 0;
    const hasND = e.appointments?.[0]?.startTime === "N/D";
    const isPending = e.status === EnrollmentStatus.Pending;
    return (isPending || hasNoApps || hasND) && e.status !== EnrollmentStatus.Completed && e.status !== EnrollmentStatus.Expired;
  });
  console.log(`[Auto-Fix] Trovate ${problematic.length} iscrizioni potenzialmente da sanare.`);
  if (problematic.length === 0) return { fixed: 0, total: 0 };
  const courses = await getAllCourses();
  const locations = await getLocations();
  const suppliers = await getSuppliers();
  let fixedCount = 0;
  for (const enr of problematic) {
    try {
      let courseId = enr.courseId;
      const locationId = enr.locationId;
      if ((!courseId || courseId === "manual") && locationId && locationId !== "unassigned") {
        const startDate = new Date(enr.startDate);
        if (!isNaN(startDate.getTime())) {
          const dayOfWeek = startDate.getDay();
          let matchingCourse = courses.find(
            (c) => c.locationId === locationId && c.dayOfWeek === dayOfWeek
          );
          if (!matchingCourse) {
            matchingCourse = courses.find((c) => c.locationId === locationId);
          }
          if (matchingCourse) {
            courseId = matchingCourse.id;
          }
        }
      }
      if (courseId && courseId !== "manual") {
        const course = courses.find((c) => c.id === courseId);
        if (course) {
          const location = locations.find((l) => l.id === course.locationId);
          const supplier = suppliers.find((s) => s.id === location?.supplierId);
          await activateEnrollmentWithLocation(
            enr.id,
            location?.supplierId || enr.supplierId || "unassigned",
            supplier?.companyName || enr.supplierName || "",
            course.locationId,
            location?.name || enr.locationName || "Sede",
            location?.color || enr.locationColor || "#ccc",
            course.dayOfWeek,
            course.startTime,
            course.endTime
          );
          fixedCount++;
        }
      } else if (locationId && locationId !== "unassigned") {
        const startTime = "16:00";
        const endTime = "18:00";
        const dayOfWeek = new Date(enr.startDate).getDay();
        await activateEnrollmentWithLocation(
          enr.id,
          enr.supplierId || "unassigned",
          enr.supplierName || "",
          locationId,
          enr.locationName || "Sede",
          enr.locationColor || "#ccc",
          dayOfWeek,
          startTime,
          endTime
        );
        fixedCount++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error auto-fixing enrollment ${enr.id}:`, msg);
    }
  }
  return { fixed: fixedCount, total: problematic.length };
};
export {
  activateEnrollmentWithLocation,
  addEnrollment,
  addRecoveryLessons,
  autoFixEnrollments,
  bonificaAppointments,
  bookStudentIntoCourseLessons,
  bulkUpdateLocation,
  createInstitutionalEnrollment,
  deleteAppointment,
  deleteEnrollment,
  fixSingleEnrollment,
  getActiveLocationForClient,
  getAllEnrollments,
  getEnrollmentsForClient,
  migrateHistoricalEnrollments,
  recuperoIntegraleDati,
  registerAbsence,
  registerPresence,
  rescheduleSuspendedLesson,
  resetAppointmentStatus,
  restoreSuspendedLessons,
  resyncInstitutionalEnrollment,
  suspendLessonsForClosure,
  syncEnrollmentFromLessonDeletion,
  syncEnrollmentFromLessonUpdate,
  toggleAppointmentStatus,
  updateEnrollment
};
