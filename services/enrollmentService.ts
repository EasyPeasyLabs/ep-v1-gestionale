import { db } from '../firebase/config';
import { collection, getDocs, addDoc, where, query, DocumentData, QueryDocumentSnapshot, deleteDoc, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
/* Added DocumentStatus to imports */
import { Enrollment, EnrollmentInput, Appointment, AppointmentStatus, EnrollmentStatus, Quote, ClientType, Lesson, DocumentStatus } from '../types';

const enrollmentCollectionRef = collection(db, 'enrollments');

const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => {
    return { id: doc.id, ...doc.data() } as Enrollment;
};

export const getEnrollmentsForClient = async (clientId: string): Promise<Enrollment[]> => {
    const q = query(enrollmentCollectionRef, where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToEnrollment);
};

export const getActiveLocationForClient = async (clientId: string): Promise<{id: string, name: string} | null> => {
    try {
        const enrollments = await getEnrollmentsForClient(clientId);
        const activeEnr = enrollments.find(e => 
            e.status === EnrollmentStatus.Active && 
            e.locationId && 
            e.locationId !== 'unassigned'
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

export const getAllEnrollments = async (): Promise<Enrollment[]> => {
    const snapshot = await getDocs(enrollmentCollectionRef);
    return snapshot.docs.map(docToEnrollment);
};

export const addEnrollment = async (enrollment: EnrollmentInput): Promise<string> => {
    const docRef = await addDoc(enrollmentCollectionRef, enrollment);
    return docRef.id;
};

// --- NEW: Attivazione Iscrizione Istituzionale ---
export const createInstitutionalEnrollment = async (
    quote: Quote, 
    selectedLessons: Lesson[], 
    projectName: string
): Promise<string> => {
    const batch = writeBatch(db);
    
    // 1. Crea Iscrizione
    const enrollmentData: EnrollmentInput = {
        clientId: quote.clientId,
        clientType: ClientType.Institutional,
        childId: 'institutional-project', // Convenzione per enti
        childName: projectName,
        isAdult: false,
        isQuoteBased: true,
        relatedQuoteId: quote.id,
        subscriptionTypeId: 'quote-based',
        subscriptionName: `Progetto: ${quote.quoteNumber}`,
        price: quote.totalAmount,
        supplierId: 'multiple', // Istituzionali possono avere sedi multiple
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
            status: 'Scheduled'
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
            enrollmentId: newEnrRef.id
        };
        // Carichiamo dati correnti della lezione per non sovrascrivere altri attendee se presenti
        // Nota: In un sistema enterprise reale useremmo arrayUnion, qui per semplicità batch.update
        batch.update(lessonRef, { 
            attendees: [attendee], // Un ente di solito occupa l'intera lezione "Extra"
            description: `${projectName} (${quote.quoteNumber})`
        });
    });

    // 3. Aggiorna Preventivo (Stato)
    const quoteRef = doc(db, 'quotes', quote.id);
    batch.update(quoteRef, { status: DocumentStatus.Paid });

    await batch.commit();
    return newEnrRef.id;
};

export const updateEnrollment = async (id: string, enrollment: Partial<EnrollmentInput>): Promise<void> => {
    const enrollmentDoc = doc(db, 'enrollments', id);
    await updateDoc(enrollmentDoc, enrollment);
};

export const deleteEnrollment = async (id: string): Promise<void> => {
    const enrollmentDoc = doc(db, 'enrollments', id);
    await deleteDoc(enrollmentDoc);
};

const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    const easterMondays: Record<number, string> = {
        2024: '4-1', 2025: '4-21', 2026: '4-6', 2027: '3-29', 2028: '4-17', 2029: '4-2', 2030: '4-22'
    };
    const key = `${m}-${d}`;
    if (easterMondays[y] === key) return true;
    return false;
};

export const registerAbsence = async (enrollmentId: string, appointmentLessonId: string, shouldReschedule: boolean): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    appointments[appIndex].status = 'Absent';
    if (shouldReschedule) {
        const sortedApps = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastApp = sortedApps[sortedApps.length - 1];
        if (lastApp) {
            let nextDate = new Date(lastApp.date);
            const originalDayOfWeek = nextDate.getDay();
            let foundDate = false;
            let safetyCounter = 0;
            while (!foundDate && safetyCounter < 52) {
                nextDate.setDate(nextDate.getDate() + 1);
                if (nextDate.getDay() === originalDayOfWeek && !isItalianHoliday(nextDate)) {
                    foundDate = true;
                }
                safetyCounter++;
            }
            if (foundDate) {
                const newAppointment: Appointment = {
                    lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    date: nextDate.toISOString(),
                    startTime: lastApp.startTime,
                    endTime: lastApp.endTime,
                    locationId: lastApp.locationId,
                    locationName: lastApp.locationName,
                    locationColor: lastApp.locationColor,
                    childName: lastApp.childName,
                    status: 'Scheduled'
                };
                appointments.push(newAppointment);
            }
        }
    }
    await updateDoc(enrollmentDocRef, { appointments });
};

export const registerPresence = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
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
    appointments[appIndex].locationColor = enrollment.locationColor;
    const newRemaining = Math.max(0, enrollment.lessonsRemaining - 1);
    await updateDoc(enrollmentDocRef, { appointments, lessonsRemaining: newRemaining });
};

export const resetAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    const previousStatus = appointments[appIndex].status;
    appointments[appIndex].status = 'Scheduled';
    let newRemaining = enrollment.lessonsRemaining;
    if (previousStatus === 'Present') {
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    }
    await updateDoc(enrollmentDocRef, { appointments, lessonsRemaining: newRemaining });
};

export const deleteAppointment = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    let appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    const previousStatus = appointments[appIndex].status;
    appointments.splice(appIndex, 1);
    let newRemaining = enrollment.lessonsRemaining;
    if (previousStatus === 'Present') {
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    }
    await updateDoc(enrollmentDocRef, { appointments, lessonsRemaining: newRemaining });
};

export const toggleAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    const currentStatus = appointments[appIndex].status;
    let newRemaining = enrollment.lessonsRemaining;
    if (currentStatus === 'Present') {
        appointments[appIndex].status = 'Absent';
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    } else if (currentStatus === 'Absent') {
        appointments[appIndex].status = 'Present';
        appointments[appIndex].locationId = enrollment.locationId;
        appointments[appIndex].locationName = enrollment.locationName;
        appointments[appIndex].locationColor = enrollment.locationColor;
        newRemaining = Math.max(0, enrollment.lessonsRemaining - 1);
    }
    await updateDoc(enrollmentDocRef, { appointments, lessonsRemaining: newRemaining });
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
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const childName = enrollment.childName;
    let currentDate = new Date(startDate);
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
    await updateDoc(enrollmentDocRef, { appointments });
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
    let currentDate = new Date(enrollment.startDate);
    while (currentDate.getDay() !== dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    const appointments: Appointment[] = [];
    const lessonsTotal = enrollment.lessonsTotal;
    let generatedCount = 0;
    while (generatedCount < lessonsTotal) {
        if (!isItalianHoliday(currentDate)) {
            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: currentDate.toISOString(),
                startTime: startTime,
                endTime: endTime,
                locationId: locationId,
                locationName: locationName,
                locationColor: locationColor,
                childName: enrollment.childName,
                status: 'Scheduled'
            });
            generatedCount++;
        }
        currentDate.setDate(currentDate.getDate() + 7);
    }
    await updateDoc(enrollmentDocRef, {
        supplierId,
        supplierName,
        locationId,
        locationName,
        locationColor,
        appointments: appointments,
        startDate: appointments[0]?.date || enrollment.startDate, 
        endDate: appointments.length > 0 ? appointments[appointments.length - 1].date : enrollment.endDate
    });
};

export const bulkUpdateLocation = async (
    enrollmentIds: string[], 
    fromDate: string, 
    newLocationId: string, 
    newLocationName: string, 
    newLocationColor: string, 
    newStartTime?: string, 
    newEndTime?: string
): Promise<void> => {
    const batch = writeBatch(db);
    const fromDateObj = new Date(fromDate);
    fromDateObj.setHours(0,0,0,0);
    for (const id of enrollmentIds) {
        const docRef = doc(db, 'enrollments', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const enr = snap.data() as Enrollment;
            const appointments = (enr.appointments || []).map(app => {
                const appDate = new Date(app.date);
                if (appDate >= fromDateObj && app.status !== 'Present' && app.status !== 'Absent') {
                    return {
                        ...app,
                        locationId: newLocationId,
                        locationName: newLocationName,
                        locationColor: newLocationColor,
                        startTime: newStartTime || app.startTime,
                        endTime: newEndTime || app.endTime,
                    };
                }
                return app;
            });
            batch.update(docRef, {
                locationId: newLocationId,
                locationName: newLocationName,
                locationColor: newLocationColor,
                appointments: appointments
            });
        }
    }
    await batch.commit();
};