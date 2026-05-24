
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    writeBatch 
} from 'firebase/firestore';
import { 
    Enrollment, 
    Lesson, 
    Appointment, 
    AppointmentStatus 
} from '../../types';
import { getEnrollmentCollectionRef } from './core';
import { isItalianHoliday } from '../../utils/dateUtils';

export const suspendLessonsForClosure = async (closureDate: string): Promise<void> => {
    const batch = writeBatch(db);
    const targetDateStr = closureDate.split('T')[0];

    const enrollmentsSnapshot = await getDocs(getEnrollmentCollectionRef());
    enrollmentsSnapshot.docs.forEach(docSnap => {
        const enr = docSnap.data() as Enrollment;
        if (enr.appointments && enr.appointments.length > 0) {
            let modified = false;
            const newApps = enr.appointments.map(app => {
                const appDateStr = app.date.split('T')[0];
                if (appDateStr === targetDateStr && app.status === 'Scheduled') {
                    modified = true;
                    return { ...app, status: 'Suspended' as AppointmentStatus };
                }
                return app;
            });
            if (modified) {
                batch.update(docSnap.ref, { appointments: newApps });
            }
        }
    });

    const lessonsCollectionRef = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsCollectionRef);
    lessonsSnapshot.docs.forEach(docSnap => {
        const lesson = docSnap.data() as Lesson;
        const lessonDateStr = lesson.date.split('T')[0];
        if (lessonDateStr !== targetDateStr) return;

        const updates: Partial<Lesson> = {};
        if (!lesson.description.startsWith('[SOSPESO]')) {
            updates.description = `[SOSPESO] ${lesson.description}`;
        }

        if (lesson.attendees && lesson.attendees.length > 0) {
            const updatedAttendees = lesson.attendees.map(a =>
                a.status === 'Scheduled' ? { ...a, status: 'Suspended' as AppointmentStatus } : a
            );
            updates.attendees = updatedAttendees;
        }

        if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
        }
    });

    await batch.commit();
};

export const restoreSuspendedLessons = async (closureDate: string): Promise<void> => {
    const batch = writeBatch(db);
    const targetDateStr = closureDate.split('T')[0];

    const enrollmentsSnapshot = await getDocs(getEnrollmentCollectionRef());
    enrollmentsSnapshot.docs.forEach(docSnap => {
        const enr = docSnap.data() as Enrollment;
        if (enr.appointments && enr.appointments.length > 0) {
            let modified = false;
            const newApps = enr.appointments.map(app => {
                const appDateStr = app.date.split('T')[0];
                if (appDateStr === targetDateStr && app.status === 'Suspended') {
                    modified = true;
                    return { ...app, status: 'Scheduled' as AppointmentStatus };
                }
                return app;
            });
            if (modified) {
                batch.update(docSnap.ref, { appointments: newApps });
            }
        }
    });

    const lessonsCollectionRef = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsCollectionRef);
    lessonsSnapshot.docs.forEach(docSnap => {
        const lesson = docSnap.data() as Lesson;
        const lessonDateStr = lesson.date.split('T')[0];
        if (lessonDateStr !== targetDateStr) return;

        const updates: Partial<Lesson> = {};
        if (lesson.description.startsWith('[SOSPESO]')) {
            updates.description = lesson.description
                .replace('[SOSPESO] ', '')
                .replace('[SOSPESO]', '')
                .trim();
        }

        if (lesson.attendees && lesson.attendees.length > 0) {
            const updatedAttendees = lesson.attendees.map(a =>
                a.status === 'Suspended' ? { ...a, status: 'Scheduled' as AppointmentStatus } : a
            );
            updates.attendees = updatedAttendees;
        }

        if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
        }
    });

    await batch.commit();
};

export const rescheduleSuspendedLesson = async (
    enrollmentId: string, 
    lessonId: string, 
    newDate: string, 
    strategy: 'move_to_date' | 'append_end'
): Promise<void> => {
    const enrRef = doc(db, 'enrollments', enrollmentId);
    const snap = await getDoc(enrRef);
    if (!snap.exists()) return;
    
    const enr = snap.data() as Enrollment;
    const appointments = [...(enr.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === lessonId);
    if (appIndex === -1) return;

    const originalApp = appointments[appIndex];
    let targetDateObj = new Date();

    if (strategy === 'move_to_date') {
        targetDateObj = new Date(newDate);
    } else {
        const sortedApps = [...appointments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastApp = sortedApps[sortedApps.length - 1];
        const lastDate = new Date(lastApp.date);
        
        const candidateDate = new Date(lastDate);
        candidateDate.setDate(candidateDate.getDate() + 7);
        while (isItalianHoliday(candidateDate)) {
            candidateDate.setDate(candidateDate.getDate() + 7);
        }
        targetDateObj = candidateDate;
    }

    const newApp: Appointment = {
        ...originalApp,
        date: targetDateObj.toISOString(),
        status: 'Scheduled',
    };

    appointments[appIndex] = newApp;
    appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const newEndDate = appointments[appointments.length - 1].date;

    await updateDoc(enrRef, { appointments, endDate: newEndDate });
};
