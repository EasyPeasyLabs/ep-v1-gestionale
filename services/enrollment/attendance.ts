
import { db } from '../../firebase/config';
import { 
    doc, 
    getDoc, 
    updateDoc 
} from 'firebase/firestore';
import { 
    Enrollment, 
    Lesson, 
    LessonAttendee, 
    Appointment, 
    AppointmentStatus, 
    SchoolClosure
} from '../../types';
import { isItalianHoliday } from '../../utils/dateUtils';
import { getSchoolClosures } from './core';

export const calculateRemainingCounters = (enrollment: Enrollment, appointments: Appointment[]) => {
    const labCount = enrollment.labCount || 0;
    const sgCount = enrollment.sgCount || 0;
    const evtCount = enrollment.evtCount || 0;
    const readCount = enrollment.readCount || 0;
    const lessonsTotal = enrollment.lessonsTotal || 0;

    const labAttended  = appointments.filter(a => a.type === 'LAB'  && a.status === 'Present').length;
    const sgAttended   = appointments.filter(a => a.type === 'SG'   && a.status === 'Present').length;
    const evtAttended  = appointments.filter(a => a.type === 'EVT'  && a.status === 'Present').length;
    const readAttended = appointments.filter(a => a.type === 'READ' && a.status === 'Present').length;

    const totalAttended = appointments.filter(a => a.status === 'Present').length;

    return {
        lessonsRemaining: Math.max(0, lessonsTotal - totalAttended),
        labRemaining: Math.max(0, labCount - labAttended),
        sgRemaining: Math.max(0, sgCount - sgAttended),
        evtRemaining: Math.max(0, evtCount - evtAttended),
        readRemaining: Math.max(0, readCount - readAttended)
    };
};

export const syncAttendanceToEnrollmentCache = async (enrollmentId: string, lessonId: string, status: AppointmentStatus | string) => {
    if (!enrollmentId) return;
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) return;
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    let appIndex = appointments.findIndex(a => a.lessonId === lessonId);
    
    if (appIndex === -1) {
        try {
            const lessonRef = doc(db, 'lessons', lessonId);
            const lessonSnap = await getDoc(lessonRef);
            if (lessonSnap.exists()) {
                const l = lessonSnap.data() as Lesson;
                const newApp: Appointment = {
                    lessonId,
                    date: l.date,
                    startTime: l.startTime,
                    endTime: l.endTime,
                    locationId: l.locationId || enrollment.locationId || 'unknown',
                    locationName: l.locationName || enrollment.locationName,
                    locationColor: l.locationColor || enrollment.locationColor,
                    childName: enrollment.childName,
                    status: status as AppointmentStatus,
                    type: l.slotType
                };
                appointments.push(newApp);
                appIndex = appointments.length - 1;
            } else {
                return;
            }
        } catch (e) {
            console.warn('[SyncCache] Impossibile costruire appointment dalla lesson:', e);
            return;
        }
    } else {
        appointments[appIndex] = { ...appointments[appIndex], status: status as AppointmentStatus };
    }

    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const registerPresence = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (!appointmentLessonId) throw new Error("ID lezione mancante per presenza");
    if (!enrollmentId) throw new Error("Impossibile sincronizzare: ID iscrizione mancante");

    if (isNewArchitecture) {
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = [...(lessonData.attendees || [])];
        let attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) {
            const enrRef = doc(db, 'enrollments', enrollmentId);
            const enrSnap = await getDoc(enrRef);
            if (enrSnap.exists()) {
                const enrData = enrSnap.data();
                const newAttendee: LessonAttendee = {
                    clientId: enrData.clientId || '',
                    childId: enrData.childId || enrData.id || '',
                    childName: enrData.childName || 'Allievo',
                    enrollmentId,
                    status: 'Scheduled'
                };
                attendees.push(newAttendee);
                attendeeIndex = attendees.length - 1;
            } else {
                throw new Error("Allievo non trovato nell'archivio");
            }
        }

        if (attendees[attendeeIndex].status === 'Present') return;
        
        attendees[attendeeIndex].status = 'Present';
        await updateDoc(lessonRef, { attendees });
        await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, 'Present');
        return;
    }

    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    if (appointments[appIndex].status === 'Present') return;
    
    appointments[appIndex].status = 'Present';
    appointments[appIndex].locationId = enrollment.locationId;
    appointments[appIndex].locationName = enrollment.locationName;
    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const registerAbsence = async (
    enrollmentId: string, 
    appointmentLessonId: string, 
    strategy: 'lost' | 'recover_auto' | 'recover_manual',
    manualDetails?: { date: string, startTime: string, endTime: string, locationId: string, locationName: string, locationColor: string },
    cachedClosures?: SchoolClosure[],
    isNewArchitecture?: boolean
): Promise<void> => {
    if (!appointmentLessonId) throw new Error("ID lezione mancante per assenza");
    if (!enrollmentId) throw new Error("Impossibile gestire assenza: ID iscrizione mancante");

    if (isNewArchitecture) {
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = [...(lessonData.attendees || [])];
        let attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) {
            const enrRef = doc(db, 'enrollments', enrollmentId);
            const enrSnap = await getDoc(enrRef);
            if (enrSnap.exists()) {
                const enrData = enrSnap.data();
                const newAttendee: LessonAttendee = {
                    clientId: enrData.clientId || '',
                    childId: enrData.childId || enrData.id || '',
                    childName: enrData.childName || 'Allievo',
                    enrollmentId,
                    status: 'Scheduled'
                };
                attendees.push(newAttendee);
                attendeeIndex = attendees.length - 1;
            } else {
                throw new Error("Allievo non trovato nell'archivio");
            }
        }
        
        if ((strategy === 'recover_auto' || strategy === 'recover_manual') && attendees[attendeeIndex].recoveryId) {
            console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
            return;
        }

        attendees[attendeeIndex].status = 'Absent';
        await updateDoc(lessonRef, { attendees });
        await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, 'Absent');
        return;
    }

    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    const previousStatus = appointments[appIndex].status;

    if ((strategy === 'recover_auto' || strategy === 'recover_manual') && appointments[appIndex].recoveryId) {
        console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
        return;
    }

    appointments[appIndex].status = 'Absent';

    let newLessonsRemaining = enrollment.lessonsRemaining;

    if (previousStatus === 'Present') {
        newLessonsRemaining += 1;
    }

    if (strategy === 'lost') {
        newLessonsRemaining -= 1;
    } 

    newLessonsRemaining = Math.max(0, Math.min(enrollment.lessonsTotal, newLessonsRemaining));

    if (strategy === 'recover_auto' || strategy === 'recover_manual') {
        const originalApp = appointments[appIndex];
        let newAppointment: Appointment | null = null;
        const recoveryId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        if (strategy === 'recover_manual' && manualDetails) {
            newAppointment = {
                lessonId: recoveryId,
                date: new Date(manualDetails.date).toISOString(),
                startTime: manualDetails.startTime,
                endTime: manualDetails.endTime,
                locationId: manualDetails.locationId,
                locationName: manualDetails.locationName,
                locationColor: manualDetails.locationColor,
                childName: originalApp.childName,
                status: 'Scheduled',
                recoveredLessonId: originalApp.lessonId
            };
        } else {
            const closures = cachedClosures || await getSchoolClosures();
            const closedDates = new Set(closures.map(c => c.date.split('T')[0]));

            const sortedApps = [...appointments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const lastApp = sortedApps[sortedApps.length - 1];
            
            const nextDate = new Date(lastApp.date);
            const originalDayOfWeek = new Date(originalApp.date).getDay();
            let foundDate = false;
            let safetyCounter = 0;
            
            while (!foundDate && safetyCounter < 52) { 
                nextDate.setDate(nextDate.getDate() + 1);
                const isoDate = nextDate.toISOString().split('T')[0];

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
                    status: 'Scheduled',
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

export const resetAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (!enrollmentId) throw new Error("Impossibile resettare: ID iscrizione mancante");
    
    if (isNewArchitecture) {
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = [...(lessonData.attendees || [])];
        let attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) {
            const enrRef = doc(db, 'enrollments', enrollmentId);
            const enrSnap = await getDoc(enrRef);
            if (enrSnap.exists()) {
                const enrData = enrSnap.data();
                const newAttendee: LessonAttendee = {
                    clientId: enrData.clientId || '',
                    childId: enrData.childId || enrData.id || '',
                    childName: enrData.childName || 'Allievo',
                    enrollmentId,
                    status: 'Scheduled'
                };
                attendees.push(newAttendee);
                attendeeIndex = attendees.length - 1;
            } else {
                throw new Error("Allievo non trovato nell'archivio");
            }
        }
        
        attendees[attendeeIndex].status = 'Scheduled';
        await updateDoc(lessonRef, { attendees });
        await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, 'Scheduled');
        return;
    }

    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    appointments[appIndex].status = 'Scheduled';
    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const deleteAppointment = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (!appointmentLessonId) throw new Error("ID lezione mancante per cancellazione");
    if (!enrollmentId) throw new Error("Impossibile eliminare: ID iscrizione mancante");
    if (isNewArchitecture) {
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const newAttendees = attendees.filter(a => a.enrollmentId !== enrollmentId);
        
        await updateDoc(lessonRef, { attendees: newAttendees });
        return;
    }

    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    appointments.splice(appIndex, 1);
    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const toggleAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (!enrollmentId) throw new Error("Impossibile cambiare stato: ID iscrizione mancante");
    
    if (isNewArchitecture) {
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = [...(lessonData.attendees || [])];
        let attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        const statusFlow: Record<string, string> = {
            'Scheduled': 'Present',
            'Present': 'Absent',
            'Absent': 'Scheduled'
        };
        
        if (attendeeIndex === -1) {
            const enrRef = doc(db, 'enrollments', enrollmentId);
            const enrSnap = await getDoc(enrRef);
            if (enrSnap.exists()) {
                const enrData = enrSnap.data();
                const newAttendee: LessonAttendee = {
                    clientId: enrData.clientId || '',
                    childId: enrData.childId || enrData.id || '',
                    childName: enrData.childName || 'Allievo',
                    enrollmentId,
                    status: 'Scheduled'
                };
                attendees.push(newAttendee);
                attendeeIndex = attendees.length - 1;
            } else {
                throw new Error("Allievo non trovato nell'archivio");
            }
        }
        
        const currentStatus = attendees[attendeeIndex].status || 'Scheduled';
        const nextStatus = statusFlow[currentStatus as string] || 'Scheduled';
        
        attendees[attendeeIndex].status = nextStatus;
        await updateDoc(lessonRef, { attendees });
        await syncAttendanceToEnrollmentCache(enrollmentId, appointmentLessonId, nextStatus as AppointmentStatus);
        return;
    }

    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    const statusFlow: Record<string, string> = {
        'Scheduled': 'Present',
        'Present': 'Absent',
        'Absent': 'Scheduled'
    };
    
    const currentStatus = appointments[appIndex].status || 'Scheduled';
    const nextStatus = statusFlow[currentStatus as string] || 'Scheduled';
    
    appointments[appIndex].status = nextStatus;
    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const addRecoveryLessons = async (
    enrollmentId: string, 
    startDate: string, 
    startTime: string, 
    endTime: string,
    numberOfLessons: number,
    locationName: string,
    locationColor: string
): Promise<void> => {
    if (!enrollmentId) throw new Error("ID iscrizione mancante per recupero");
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const childName = enrollment.childName;
    const currentDate = new Date(startDate);
    let generatedCount = 0;
    while (generatedCount < numberOfLessons) {
        if (!isItalianHoliday(currentDate)) {
            const newAppointment: Appointment = {
                lessonId: `REC-${Date.now()}-${generatedCount}`,
                date: currentDate.toISOString(),
                startTime: startTime,
                endTime: endTime,
                locationId: enrollment.locationId, 
                locationName: locationName, 
                locationColor: locationColor,
                childName: childName,
                status: 'Scheduled'
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
