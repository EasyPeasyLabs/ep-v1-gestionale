
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    writeBatch 
} from 'firebase/firestore';
import { 
    Enrollment, 
    Lesson, 
    Course, 
    SubscriptionType, 
    Appointment, 
    AppointmentStatus, 
    ClientType, 
    Quote, 
    LessonAttendee,
    EnrollmentStatus
} from '../../types';
import { generateTheoreticalAppointments } from './helpers';
import { getEnrollmentCollectionRef } from './core';
import { getAllCourses, getLocations } from '../courseService';
import { getSuppliers } from '../supplierService';
import { activateEnrollmentWithLocation } from './activation';

export const autoFixEnrollments = async (): Promise<{ fixed: number, total: number }> => {
    console.log("[Auto-Fix] Avvio scansione iscrizioni problematiche...");
    const snapshot = await getDocs(getEnrollmentCollectionRef());
    const allEnrollments = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Enrollment));
    
    const problematic = allEnrollments.filter((e) => {
        const hasNoApps = !e.appointments || e.appointments.length === 0;
        const hasND = e.appointments?.[0]?.startTime === "N/D";
        const isPending = e.status === EnrollmentStatus.Pending;
        return (isPending || hasNoApps || hasND) && e.status !== EnrollmentStatus.Completed && e.status !== EnrollmentStatus.Expired;
    });

    console.log(`[Auto-Fix] Trovate ${problematic.length} iscrizioni potenzialmente da sanare.`);
    if (problematic.length === 0) return { fixed: 0, total: allEnrollments.length };

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
                        enr.id || '',
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
            }
        } catch (e) {
            console.error(`[Auto-Fix Error] Iscrizione ${enr.id}:`, e);
        }
    }

    return { fixed: fixedCount, total: problematic.length };
};

export const recuperoIntegraleDati = async (): Promise<void> => {
    console.log("[Recovery] Avvio Motore di Ripristino...");
    const [enrollmentsSnap, lessonsSnap, coursesSnap, subTypesSnap] = await Promise.all([
        getDocs(collection(db, 'enrollments')),
        getDocs(collection(db, 'lessons')),
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'subscriptionTypes'))
    ]);

    const enrMap = new Map<string, Enrollment>(enrollmentsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Enrollment]));
    const subTypesMap = new Map<string, SubscriptionType>(subTypesSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as SubscriptionType]));
    const lessonDocs = lessonsSnap.docs;
    const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
    const batch = writeBatch(db);
    let counter = 0;

    // 1. SANIFICAZIONE FISICA (LESSONS MASTER)
    for (const lessonDoc of lessonDocs) {
        const lesson = lessonDoc.data() as Lesson;
        if (!lesson.attendees || lesson.attendees.length === 0) {
            if (lesson.courseId === 'manual' || !lesson.courseId) {
                 batch.delete(lessonDoc.ref);
            }
            continue;
        }

        const validAttendees = lesson.attendees.filter(att => {
            const enr = enrMap.get(att.enrollmentId || '');
            if (!enr) return true;
            if (enr.courseId && enr.courseId !== 'manual') return true; 

            const subType = subTypesMap.get(enr.subscriptionTypeId);
            const allowedDays = subType?.allowedDays || [];
            if (allowedDays.length === 0) return true;

            const dateParts = lesson.date.split('T')[0].split('-').map(Number);
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
                         const updatedApps = (e.appointments || []).filter(a => a.lessonId !== lessonDoc.id);
                         batch.update(doc(db, 'enrollments', e.id), { appointments: updatedApps });
                    }
                }
            }
        } else if (validAttendees.length !== lesson.attendees.length) {
            batch.update(lessonDoc.ref, { attendees: validAttendees });
        }
    }

    // 2. RIPRISTINO DA SOURCE B (Lessons) -> SOURCE A (Enrollments)
    for (const lessonDoc of lessonDocs) {
        const lesson = lessonDoc.data() as Lesson;
        if (!lesson.attendees || lesson.attendees.length === 0) continue;

        for (const attendee of lesson.attendees) {
            if (!attendee.enrollmentId) continue;
            
            const enr = enrMap.get(attendee.enrollmentId);
            if (!enr) continue;

            const exists = (enr.appointments || []).some(app => 
                app.lessonId === lessonDoc.id || 
                (app.date.split('T')[0] === lesson.date.split('T')[0] && app.startTime === lesson.startTime)
            );

            if (!exists) {
                const newApp: Appointment = {
                    lessonId: lessonDoc.id,
                    date: lesson.date,
                    startTime: lesson.startTime,
                    endTime: lesson.endTime,
                    locationId: lesson.locationId || enr.locationId,
                    locationName: lesson.locationName,
                    locationColor: lesson.locationColor,
                    childName: attendee.childName,
                    status: (attendee.status as AppointmentStatus) || AppointmentStatus.Scheduled,
                    type: lesson.slotType
                };

                const updatedApps = [...(enr.appointments || []), newApp].sort((a,b) => a.date.localeCompare(b.date));
                batch.update(doc(db, 'enrollments', enr.id), { appointments: updatedApps });
                enr.appointments = updatedApps;
                counter++;
            }
        }
    }

    // 3. GHOST RECOVERY & GAP FILLING
    for (const enr of enrMap.values()) {
        if (enr.status === EnrollmentStatus.Active && enr.lessonsTotal > 0) {
            const currentCount = (enr.appointments || []).length;
            
            if (currentCount < enr.lessonsTotal) {
                const remaining = enr.lessonsTotal - currentCount;
                let recoveredApps: Appointment[] = [];

                if (enr.clientType === ClientType.Institutional && enr.relatedQuoteId) {
                    const quoteDoc = await getDoc(doc(db, 'quotes', enr.relatedQuoteId));
                    if (quoteDoc.exists()) {
                        const quote = quoteDoc.data() as Quote;
                        const installments = quote.installments || [];
                        const existingDates = new Set((enr.appointments || []).map(a => a.date.split('T')[0]));
                        
                        const missingDates = installments
                            .map(i => i.dueDate.split('T')[0])
                            .filter(date => !existingDates.has(date))
                            .sort()
                            .slice(0, remaining);

                        recoveredApps = missingDates.map(date => ({
                            lessonId: 'ghost-' + Date.now() + Math.random().toString(36).substr(2, 5),
                            date: date + 'T12:00:00Z',
                            startTime: '10:00', 
                            endTime: '12:00',
                            locationId: enr.locationId || 'institutional',
                            locationName: enr.locationName || 'Sede Istituzionale',
                            locationColor: enr.locationColor || '#3C3C52',
                            childName: enr.childName,
                            status: AppointmentStatus.Scheduled
                        }));
                    }
                } 
                else if (enr.courseId && enr.courseId !== 'manual') {
                    const course = courses.find(c => c.id === enr.courseId);
                    const lastDate = enr.appointments && enr.appointments.length > 0 
                        ? enr.appointments[enr.appointments.length - 1].date 
                        : enr.startDate;

                    recoveredApps = generateTheoreticalAppointments(
                        lastDate,
                        remaining + 1,
                        enr.locationId,
                        enr.locationName,
                        enr.locationColor,
                        course?.startTime || '09:00',
                        course?.endTime || '10:00',
                        enr.childName,
                        course?.comboConfigs,
                        course?.weeklyPlan,
                        enr.startDate,
                        course?.dayOfWeek
                    ).slice(1);
                }

                if (recoveredApps.length > 0) {
                    const updatedApps = [...(enr.appointments || []), ...recoveredApps].sort((a,b) => a.date.localeCompare(b.date));
                    batch.update(doc(db, 'enrollments', enr.id), { appointments: updatedApps });
                    enr.appointments = updatedApps;
                    counter++;
                }
            }
        }
    }

    // 4. SANIFICAZIONE FINALE
    for (const enr of enrMap.values()) {
        const originalLength = enr.appointments?.length || 0;
        if (originalLength === 0) continue;

        const subType = subTypesMap.get(enr.subscriptionTypeId);
        const allowedDays = subType?.allowedDays || [];

        const finalApps = (enr.appointments || []).filter((app, index, self) => {
            const appDateStr = app.date.split('T')[0];
            
            const duplicateIndex = self.findIndex(t => 
                t.date.split('T')[0] === appDateStr && 
                t.startTime === app.startTime
            );
            if (duplicateIndex !== index) return false;

            if (enr.courseId === 'manual' || !enr.courseId) {
                if (allowedDays.length > 0 && !app.recoveryId) {
                    const dateParts = appDateStr.split('-').map(Number);
                    const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    const dayOfWeek = d.getDay();
                    if (!allowedDays.includes(dayOfWeek)) {
                         if (app.status === 'Scheduled' || !app.status || (!app.lessonId && (app.status === 'Present' || app.status === 'Absent'))) return false;
                    }
                }
            }

            return true;
        });

        if (finalApps.length !== originalLength) {
            batch.update(doc(db, 'enrollments', enr.id), { appointments: finalApps });
            counter++;
        }
    }

    if (counter > 0) {
        await batch.commit();
        console.log(`[Recovery] Ripristinati/Sanati ${counter} blocchi dati.`);
    }
};

export const bonificaAppointments = async (): Promise<number> => {
    const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));
    let updatedCount = 0;
    const batch = writeBatch(db);
    let operationsInBatch = 0;

    const lessonsSnap = await getDocs(collection(db, 'lessons'));
    const lessonDocs = lessonsSnap.docs;

    for (const docSnap of enrollmentsSnap.docs) {
        const data = docSnap.data() as Enrollment;
        
        if (data.appointments && data.appointments.length > 0) {
            const originalCount = data.appointments.length;
            
            const preservedApps = (data.appointments || []).filter(app => {
                if (app.status === 'Present' || app.status === 'Absent' || app.status === 'Suspended' || app.recoveryId) return true;
                
                if (data.clientType === ClientType.Institutional && data.relatedQuoteId && app.status === 'Scheduled') {
                    return true;
                }
                
                if (data.courseId && data.courseId !== 'manual') {
                    const hasLesson = lessonDocs.some(ld => {
                        const l = ld.data() as Lesson;
                        return l.courseId === data.courseId && 
                               l.date.split('T')[0] === app.date.split('T')[0] && 
                               l.startTime === app.startTime &&
                               l.attendees?.some((att: LessonAttendee) => att.enrollmentId === docSnap.id);
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
    return updatedCount;
};

export const migrateHistoricalEnrollments = async (): Promise<{ updated: number, errors: number }> => {
    const snapshot = await getDocs(collection(db, 'enrollments'));
    let updatedCount = 0;
    const errorCount = 0;

    const batch = writeBatch(db);
    let batchSize = 0;

    for (const docSnap of snapshot.docs) {
        try {
            const enr = docSnap.data() as Enrollment;
            const appointments = [...(enr.appointments || [])];
            let modified = false;
            const newApps = appointments.map(app => {
                const appDate = app.date.split('T')[0];
                let type = app.type || 'LAB'; 

                if (enr.clientType === ClientType.Institutional || enr.isQuoteBased) {
                    type = 'INST';
                } 
                else if (appDate === '2026-02-22') {
                    type = 'EVT';
                }
                else if (appDate === '2026-02-21' && app.startTime === '09:30' && app.endTime === '12:30') {
                    type = 'SG';
                }
                else if (appDate === '2026-02-28' && app.startTime === '09:30' && app.endTime === '12:30') {
                    type = 'SG';
                }
                else if ((appDate === '2026-02-07' || appDate === '2026-02-14') && app.startTime === '10:00' && app.endTime === '11:00') {
                    type = 'LAB';
                }
                else if (new Date(appDate) <= new Date('2026-02-06')) {
                    type = 'LAB';
                }

                if (app.type !== type) {
                    modified = true;
                    return { ...app, type };
                }
                return app;
            });

            const labCount = newApps.filter(a => a.type === 'LAB').length;
            const sgCount = newApps.filter(a => a.type === 'SG').length;
            const evtCount = newApps.filter(a => a.type === 'EVT').length;
            const readCount = newApps.filter(a => a.type === 'READ').length;

            const labAttended = newApps.filter(a => a.type === 'LAB' && a.status === 'Present').length;
            const sgAttended = newApps.filter(a => a.type === 'SG' && a.status === 'Present').length;
            const evtAttended = newApps.filter(a => a.type === 'EVT' && a.status === 'Present').length;
            const readAttended = newApps.filter(a => a.type === 'READ' && a.status === 'Present').length;

            const needsUpdate = modified || enr.labCount === undefined || enr.sgCount === undefined || enr.evtCount === undefined || enr.readCount === undefined;

            if (needsUpdate) {
                const updateData: Record<string, unknown> = {
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

                batch.update(docSnap.ref, updateData as any);
                batchSize++;
                updatedCount++;
            }

            if (batchSize >= 400) {
                await batch.commit();
                batchSize = 0;
            }
        } catch (e) {
            console.error("Migration error for enrollment", docSnap.id, e);
        }
    }
    
    if (batchSize > 0) {
        await batch.commit();
    }
    
    return { updated: updatedCount, errors: errorCount };
};
