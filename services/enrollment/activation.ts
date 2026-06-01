
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    writeBatch,
    query,
    where,
    arrayUnion
} from 'firebase/firestore';
import { 
    Enrollment, 
    Course, 
    Appointment, 
    AppointmentStatus, 
    EnrollmentStatus,
    Quote,
    ClientType,
    Lesson,
    EnrollmentInput,
    DocumentStatus
} from '../../types';
import { bookStudentIntoCourseLessons } from './bookingModule';
import { generateTheoreticalAppointments } from './helpers';
import { isItalianHoliday } from '../../utils/dateUtils';


export const createInstitutionalEnrollment = async (
    quote: Quote, 
    selectedLessons: Lesson[], 
    projectName: string,
    shouldGenerateInvoices: boolean = true
): Promise<string> => {
    const batch = writeBatch(db);
    
    // 1. Crea Iscrizione
    const enrollmentData: EnrollmentInput = {
        clientId: quote.clientId,
        clientType: ClientType.Institutional,
        childId: 'institutional-student',
        childName: projectName,
        isAdult: false,
        isQuoteBased: true,
        relatedQuoteId: quote.id,
        subscriptionTypeId: 'quote-based',
        subscriptionName: `Progetto: ${quote.quoteNumber}`,
        price: quote.totalAmount,
        supplierId: 'multiple', 
        supplierName: 'Ente Istituzionale',
        locationId: 'institutional',
        locationName: 'Sedi Progetto',
        locationColor: '#3C3C52',
        appointments: selectedLessons.map(l => ({
            lessonId: l.id,
            date: l.date,
            startTime: l.startTime,
            endTime: l.endTime,
            locationId: 'institutional',
            locationName: l.locationName,
            locationColor: l.locationColor,
            childName: projectName,
            status: AppointmentStatus.Scheduled
        })),
        lessonsTotal: selectedLessons.length,
        lessonsRemaining: selectedLessons.length,
        startDate: selectedLessons.length > 0 ? selectedLessons[0].date : quote.issueDate,
        endDate: selectedLessons.length > 0 ? selectedLessons[selectedLessons.length - 1].date : quote.expiryDate,
        status: EnrollmentStatus.Active,
        createdAt: new Date().toISOString()
    };

    const newEnrRef = doc(collection(db, 'enrollments'));
    batch.set(newEnrRef, enrollmentData);

    // 2. Aggiorna Lezioni (Link Referenziale)
    selectedLessons.forEach(l => {
        const lessonRef = doc(db, 'lessons', l.id);
        const attendee = {
            clientId: quote.clientId,
            childId: 'institutional',
            childName: projectName,
            enrollmentId: newEnrRef.id,
            status: AppointmentStatus.Scheduled
        };
        batch.update(lessonRef, { 
            attendees: arrayUnion(attendee),
            description: `${projectName} (${quote.quoteNumber})`
        });
    });

    if (shouldGenerateInvoices) {
        const quoteRef = doc(db, 'quotes', quote.id);
        batch.update(quoteRef, { status: DocumentStatus.Paid });
    }

    await batch.commit();
    return newEnrRef.id;
};

export const updateEnrollment = async (id: string, enrollment: Partial<EnrollmentInput>, regenerateCalendar: boolean = false): Promise<void> => {
    if (!id) throw new Error("ID iscrizione mancante per aggiornamento");
    const enrollmentDoc = doc(db, 'enrollments', id);
    
    const oldSnap = await getDoc(enrollmentDoc);
    if (!oldSnap.exists()) return;
    const oldData = oldSnap.data() as Enrollment;
    
    if (regenerateCalendar && enrollment.courseId && enrollment.courseId !== 'manual') {
        const batch = writeBatch(db);
        
        if (oldData.courseId) {
            const courseLessonsQuery = query(collection(db, 'lessons'), where('courseId', '==', oldData.courseId));
            const courseLessonsSnap = await getDocs(courseLessonsQuery);
            courseLessonsSnap.forEach((lessonDoc) => {
                const lessonData = lessonDoc.data() as Lesson;
                if (lessonData.attendees && lessonData.attendees.some(a => a.enrollmentId === id)) {
                    const newAttendees = lessonData.attendees.filter(a => a.enrollmentId !== id);
                    batch.update(lessonDoc.ref, { attendees: newAttendees });
                }
            });
        }
        await batch.commit();

        await updateDoc(enrollmentDoc, enrollment);

        const targetCourseId = enrollment.courseId;
        let startTime = enrollment.appointments?.[0]?.startTime || oldData.appointments?.[0]?.startTime || '';
        let endTime   = enrollment.appointments?.[0]?.endTime   || oldData.appointments?.[0]?.endTime   || '';

        if (targetCourseId && targetCourseId !== 'manual') {
            try {
                const courseSnap = await getDoc(doc(db, 'courses', targetCourseId));
                if (courseSnap.exists()) {
                    const courseData = courseSnap.data() as Course;
                    startTime = courseData.startTime || startTime;
                    endTime   = courseData.endTime   || endTime;
                }
            } catch (e) {
                console.warn('[UpdateEnrollment] Impossibile leggere corso, uso orari di fallback:', e);
            }
        }

        if (!startTime) startTime = '09:00';
        if (!endTime)   endTime   = '10:00';

        const dayOfWeek = new Date(enrollment.startDate || oldData.startDate).getDay();
        
        await activateEnrollmentWithLocation(
            id, 
            enrollment.supplierId || oldData.supplierId || 'unassigned', 
            enrollment.supplierName || oldData.supplierName || '', 
            enrollment.locationId || oldData.locationId || 'unassigned', 
            enrollment.locationName || oldData.locationName || 'Sede', 
            enrollment.locationColor || oldData.locationColor || '#ccc', 
            dayOfWeek, 
            startTime, 
            endTime
        );
        return;
    }

    if (regenerateCalendar && enrollment.startDate && enrollment.lessonsTotal) {
        const oldAppointments = oldData.appointments || [];
        const historyMap = new Map<string, Appointment>();
        oldAppointments.forEach(a => {
            const k = a.date.split('T')[0];
            historyMap.set(k, a);
        });

        const refApp = oldAppointments.length > 0 ? oldAppointments[0] : null;
        const locId = enrollment.locationId || oldData.locationId || 'unassigned';
        const locName = enrollment.locationName || oldData.locationName || 'Sede Non Definita';
        const locColor = enrollment.locationColor || oldData.locationColor || '#ccc';
        const timeSource = (enrollment.appointments && enrollment.appointments.length > 0) ? enrollment.appointments[0] : refApp;
        let startTime = timeSource?.startTime || '16:00';
        let endTime = timeSource?.endTime || '18:00';
        
        // Prioritize course's time as single source of truth
        const relatedCourseId = enrollment.courseId || oldData.courseId;
        if (relatedCourseId && relatedCourseId !== 'manual') {
            const courseSnap = await getDoc(doc(db, 'courses', relatedCourseId));
            if (courseSnap.exists()) {
                const courseData = courseSnap.data() as any;
                if (courseData.startTime && courseData.slotType !== 'LAB+SG') {
                    startTime = courseData.startTime;
                }
                if (courseData.endTime && courseData.slotType !== 'LAB+SG') {
                    endTime = courseData.endTime;
                }
            }
        }

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
            undefined,
            undefined,
            undefined,
            targetDay
        );

        const mergedAppointments: Appointment[] = theoreticalSchedule.map(newApp => {
            const key = newApp.date.split('T')[0];
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
        const used = mergedAppointments.filter(a => a.status === 'Present').length;
        enrollment.lessonsRemaining = Math.max(0, enrollment.lessonsTotal - used);

        if (mergedAppointments.length > 0) {
            mergedAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            enrollment.startDate = mergedAppointments[0].date;
            enrollment.endDate = mergedAppointments[mergedAppointments.length - 1].date;
        }
    }

    await updateDoc(enrollmentDoc, enrollment);
};

export const deleteEnrollment = async (id: string): Promise<void> => {
    const batch = writeBatch(db);
    const enrollmentRef = doc(db, 'enrollments', id);
    const enrollmentSnap = await getDoc(enrollmentRef);
    let courseId = null;
    if (enrollmentSnap.exists()) {
        const enrData = enrollmentSnap.data() as Enrollment;
        courseId = enrData.courseId;
    }

    batch.delete(enrollmentRef);
    
    try {
        const oldLessonsQuery = query(collection(db, 'lessons'), where('enrollmentId', '==', id));
        const oldLessonsSnap = await getDocs(oldLessonsQuery);
        oldLessonsSnap.forEach((lessonDoc) => {
            batch.delete(lessonDoc.ref);
        });
    } catch (error) {
        console.error("Error during deep delete of old lessons:", error);
    }

    if (courseId) {
        try {
            const courseLessonsQuery = query(collection(db, 'lessons'), where('courseId', '==', courseId));
            const courseLessonsSnap = await getDocs(courseLessonsQuery);
            courseLessonsSnap.forEach((lessonDoc) => {
                const lessonData = lessonDoc.data() as Lesson;
                if (lessonData.attendees && lessonData.attendees.some(a => a.enrollmentId === id)) {
                    const newAttendees = lessonData.attendees.filter(a => a.enrollmentId !== id);
                    batch.update(lessonDoc.ref, { attendees: newAttendees });
                }
            });
        } catch (error) {
            console.error("Error during cleanup of course lessons:", error);
        }
    }
    
    await batch.commit();
};

export const activateEnrollmentWithLocation = async (
    enrollmentId: string,
    supplierId: string,
    supplierName: string,
    locationId: string,
    locationName: string,
    locationColor: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string
): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    
    let comboConfigs = undefined;
    let weeklyPlan = undefined;
    if (enrollment.courseId) {
        const courseSnap = await getDoc(doc(db, 'courses', enrollment.courseId));
        if (courseSnap.exists()) {
            const courseData = courseSnap.data() as Course;
            if (courseData.slotType === 'LAB+SG') {
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
    let appointments: Appointment[] = [];
    let courseDayOfWeek: number | undefined = undefined;
    let actualStartTime = startTime;
    let actualEndTime = endTime;

    if (enrollment.courseId && enrollment.courseId !== 'manual') {
        const courseRef = doc(db, 'courses', enrollment.courseId);
        const courseSnap = await getDoc(courseRef);
        if (courseSnap.exists()) {
            const courseData = courseSnap.data() as any;
            courseDayOfWeek = courseData.dayOfWeek;
            
            // Prioritize course's time as single source of truth for standard slot types
            if (courseData.startTime && courseData.slotType !== 'LAB+SG') {
                actualStartTime = courseData.startTime;
            }
            if (courseData.endTime && courseData.slotType !== 'LAB+SG') {
                actualEndTime = courseData.endTime;
            }
        }

        const quotasObj: Record<string, number> = {};
        const anyEnr = enrollment as any;
        if (anyEnr.tokens && anyEnr.tokens.length > 0) {
            anyEnr.tokens.forEach((t: any) => { quotasObj[t.type] = t.count; });
        } else {
            if (enrollment.labCount) quotasObj['LAB'] = enrollment.labCount;
            if (enrollment.sgCount) quotasObj['SG'] = enrollment.sgCount;
            if (enrollment.evtCount) quotasObj['EVT'] = enrollment.evtCount;
            if (enrollment.readCount) quotasObj['READ'] = enrollment.readCount;
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
        
        labUsed = bookingResult.tokenUsage['LAB'] || 0;
        sgUsed = bookingResult.tokenUsage['SG'] || 0;
        finalEndDate = bookingResult.finalEndDate;

        let bookedLessons = bookingResult.bookedLessons || [];
        bookedLessons = bookedLessons.sort((a, b) => a.date.localeCompare(b.date)).slice(0, enrollment.lessonsTotal);

        const now = new Date();
        appointments = bookedLessons.map(l => {
            const attendee = l.attendees?.find(a => a.enrollmentId === enrollmentId);
            let status = (attendee?.status as AppointmentStatus) || AppointmentStatus.Scheduled;
            
            const lessonDate = new Date(l.date);
            const isPast = lessonDate.getTime() < (now.getTime() - 24 * 60 * 60 * 1000);
            if (isPast && status === AppointmentStatus.Scheduled) {
                status = AppointmentStatus.Absent;
            }

            return {
                lessonId: l.id,
                date: l.date,
                startTime: l.startTime,
                endTime: l.endTime,
                locationId: locationId,
                locationName: locationName,
                locationColor: locationColor,
                childName: enrollment.childName,
                status: status,
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
                actualStartTime,
                actualEndTime,
                enrollment.childName,
                comboConfigs,
                weeklyPlan,
                currentDate.toISOString(),
                courseDayOfWeek
            );
            
            appointments = [...appointments, ...theoreticalMissing];
        }

        if (appointments.length > 0) {
            appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            finalEndDate = appointments[appointments.length - 1].date;
        }
    } else {
        appointments = generateTheoreticalAppointments(
            currentDate.toISOString(),
            enrollment.lessonsTotal,
            locationId,
            locationName,
            locationColor,
            actualStartTime,
            actualEndTime,
            enrollment.childName,
            comboConfigs,
            weeklyPlan,
            undefined,
            dayOfWeek
        );
        
        if (comboConfigs) {
            labUsed = appointments.filter(a => a.type === 'LAB').length;
            sgUsed = appointments.filter(a => a.type === 'SG').length;
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
        startTime: actualStartTime,
        endTime: actualEndTime,
        appointments: appointments,
        labUsed: labUsed,
        sgUsed: sgUsed,
        labRemaining: (enrollment.labCount || 0) - labUsed,
        sgRemaining: (enrollment.sgCount || 0) - sgUsed,
        startDate: currentDate.toISOString(), 
        endDate: finalEndDate,
        status: EnrollmentStatus.Active
    });
};
