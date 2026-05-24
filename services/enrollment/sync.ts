
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    getDoc, 
    getDocsFromServer,
    getDocFromServer,
    doc, 
    updateDoc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { 
    Enrollment, 
    Lesson, 
    LessonInput,
    Appointment,
    LessonAttendee
} from '../../types';

export const syncEnrollmentFromLessonUpdate = async (lessonId: string, lessonUpdate: Partial<LessonInput>) => {
    if (!lessonUpdate.date && !lessonUpdate.startTime && !lessonUpdate.endTime && !lessonUpdate.locationName) return;

    let attendeesFromDB: LessonAttendee[] = [];
    try {
        const lessonRef = doc(db, 'lessons', lessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) return;
        attendeesFromDB = (lessonSnap.data() as Lesson).attendees || [];
    } catch (e) {
        console.warn('[SyncLessonUpdate] Impossibile leggere lesson dal DB:', e);
        return;
    }

    if (attendeesFromDB.length === 0) return;

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const attendee of attendeesFromDB) {
        if (attendee.enrollmentId) {
            const enrRef = doc(db, 'enrollments', attendee.enrollmentId);
            const enrSnap = await getDoc(enrRef);
            if (enrSnap.exists()) {
                const enrData = enrSnap.data() as Enrollment;
                let modified = false;
                const newApps = (enrData.appointments || []).map(app => {
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
    }
};

export const syncEnrollmentFromLessonDeletion = async (lessonId: string, lessonDetails?: { date: string, startTime: string, locationName: string }) => {
    const q = query(collection(db, 'enrollments'), where('status', 'in', ['active', 'confirmed', 'pending']));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    let updatedCount = 0;

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Enrollment;
        if (!data.appointments) return;

        let matchedByHardLink = false;
        let matchedByFuzzy = false;

        data.appointments.forEach(a => {
            if (a.lessonId === lessonId) matchedByHardLink = true;
            else if (lessonDetails) {
                const matchDate = a.date.split('T')[0] === lessonDetails.date.split('T')[0];
                const matchTime = a.startTime === lessonDetails.startTime;
                const matchLoc = (a.locationName || '').trim().toLowerCase() === (lessonDetails.locationName || '').trim().toLowerCase();
                if (matchDate && matchTime && matchLoc) matchedByFuzzy = true;
            }
        });

        const hasMatch = matchedByHardLink || matchedByFuzzy;

        if (hasMatch) {
            const newApps = data.appointments.filter(a => {
                if (a.lessonId === lessonId) return false;
                if (lessonDetails) {
                    const matchDate = a.date.split('T')[0] === lessonDetails.date.split('T')[0];
                    const matchTime = a.startTime === lessonDetails.startTime;
                    const matchLoc = (a.locationName || '').trim().toLowerCase() === (lessonDetails.locationName || '').trim().toLowerCase();
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
    }
};

export const resyncInstitutionalEnrollment = async (enrollmentId: string): Promise<number> => {
    if (!enrollmentId) throw new Error("ID iscrizione mancante per resync");
    try {
        const enrollmentRef = doc(db, 'enrollments', enrollmentId);
        const enrollmentSnap = await getDocFromServer(enrollmentRef);
        if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
        const enrData = enrollmentSnap.data() as Enrollment;

        const startDate = new Date(enrData.startDate);
        const endDate = new Date(enrData.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("Date iscrizione non valide");
        }

        const rangeStart = new Date(startDate); rangeStart.setDate(rangeStart.getDate() - 60);
        const rangeEnd = new Date(endDate); rangeEnd.setDate(rangeEnd.getDate() + 60);

        const rangeStartStr = rangeStart.toISOString().split('T')[0]; 
        const rangeEndStr = rangeEnd.toISOString().split('T')[0];

        const lessonsRef = collection(db, 'lessons');
        const q = query(
            lessonsRef, 
            where('date', '>=', rangeStartStr),
            where('date', '<=', rangeEndStr)
        );

        const lessonsSnap = await getDocsFromServer(q);
        const allLessonsInWindow = lessonsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Lesson));

        let linkedLessons = allLessonsInWindow.filter(l => l.attendees && l.attendees.some(a => a.enrollmentId === enrollmentId));

        if (linkedLessons.length === 0) {
            const projectNameLower = enrData.childName.trim().toLowerCase();
            const candidates = allLessonsInWindow.filter(l => 
                (l.description || '').toLowerCase().includes(projectNameLower) ||
                (l.childName || '').toLowerCase().includes(projectNameLower)
            );

            if (candidates.length > 0) {
                const batch = writeBatch(db);
                candidates.forEach(l => {
                    const attendees = l.attendees || [];
                    const cleanAttendees = attendees.filter(a => a.childName !== enrData.childName);
                    cleanAttendees.push({
                        clientId: enrData.clientId,
                        childId: 'institutional',
                        childName: enrData.childName,
                        enrollmentId: enrollmentId
                    });
                    batch.update(doc(db, 'lessons', l.id), { attendees: cleanAttendees });
                });
                await batch.commit();
                linkedLessons = candidates;
            }
        }

        if (linkedLessons.length === 0) return 0;

        linkedLessons.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const newAppointments: Appointment[] = linkedLessons.map(l => ({
            lessonId: l.id,
            date: l.date,
            startTime: l.startTime,
            endTime: l.endTime,
            locationId: 'institutional',
            locationName: l.locationName,
            locationColor: l.locationColor,
            childName: enrData.childName,
            status: 'Scheduled'
        }));

        await updateDoc(enrollmentRef, {
            appointments: newAppointments,
            lessonsTotal: newAppointments.length,
            lessonsRemaining: newAppointments.length,
            startDate: newAppointments[0].date,
            endDate: newAppointments[newAppointments.length - 1].date
        });

        return newAppointments.length;
    } catch (e) {
        console.error("Critical Resync Error:", e);
        throw e;
    }
};
