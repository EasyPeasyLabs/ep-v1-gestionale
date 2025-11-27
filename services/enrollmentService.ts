
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, where, query, DocumentData, QueryDocumentSnapshot, deleteDoc, doc, updateDoc, getDoc, writeBatch } from '@firebase/firestore';
import { Enrollment, EnrollmentInput, Appointment, AppointmentStatus, EnrollmentStatus } from '../types';

const enrollmentCollectionRef = collection(db, 'enrollments');

const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => {
    return { id: doc.id, ...doc.data() } as Enrollment;
};

export const getEnrollmentsForClient = async (clientId: string): Promise<Enrollment[]> => {
    const q = query(enrollmentCollectionRef, where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToEnrollment);
};

export const getAllEnrollments = async (): Promise<Enrollment[]> => {
    const snapshot = await getDocs(enrollmentCollectionRef);
    return snapshot.docs.map(docToEnrollment);
};


export const addEnrollment = async (enrollment: EnrollmentInput): Promise<string> => {
    const docRef = await addDoc(enrollmentCollectionRef, enrollment);
    return docRef.id;
};

export const updateEnrollment = async (id: string, enrollment: Partial<EnrollmentInput>): Promise<void> => {
    const enrollmentDoc = doc(db, 'enrollments', id);
    await updateDoc(enrollmentDoc, enrollment);
};

export const deleteEnrollment = async (id: string): Promise<void> => {
    const enrollmentDoc = doc(db, 'enrollments', id);
    await deleteDoc(enrollmentDoc);
};

// --- Gestione Assenze e Recuperi ---

// Helper per verificare se una data è una festività italiana standard
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1; // 1-12
    const y = date.getFullYear();

    // Date fisse
    if (d === 1 && m === 1) return true; // Capodanno
    if (d === 6 && m === 1) return true; // Epifania
    if (d === 25 && m === 4) return true; // Liberazione
    if (d === 1 && m === 5) return true; // Lavoro
    if (d === 2 && m === 6) return true; // Repubblica
    if (d === 15 && m === 8) return true; // Ferragosto
    if (d === 1 && m === 11) return true; // Ognissanti
    if (d === 8 && m === 12) return true; // Immacolata
    if (d === 25 && m === 12) return true; // Natale
    if (d === 26 && m === 12) return true; // S.Stefano

    // Pasqua e Pasquetta richiederebbero un calcolo complesso, 
    // per ora semplifichiamo omettendo o usando una libreria esterna in futuro.
    return false;
};

export const registerAbsence = async (enrollmentId: string, appointmentLessonId: string, shouldReschedule: boolean): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    
    // 1. Trova la lezione e segnala assenza
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");

    appointments[appIndex].status = 'Absent';

    let updatedData: Partial<Enrollment> = { appointments };

    // 2. Logica di Recupero (Slittamento Automatico) - Legacy logic
    // Se viene usata la modale di recupero manuale, questo flag potrebbe essere false
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
                    locationName: lastApp.locationName,
                    locationColor: lastApp.locationColor,
                    childName: lastApp.childName,
                    status: 'Scheduled'
                };
                appointments.push(newAppointment);
            }
        }
    }

    updatedData.appointments = appointments;
    await updateDoc(enrollmentDocRef, updatedData);
};

// --- Nuova funzione per recupero manuale (Modale Recupera) ---
export const addRecoveryLessons = async (
    enrollmentId: string, 
    startDate: string, // ISO Date String
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
    
    for (let i = 0; i < numberOfLessons; i++) {
        // Crea appuntamento
        const newAppointment: Appointment = {
            lessonId: `REC-${Date.now()}-${i}`, // ID univoco per recupero
            date: currentDate.toISOString(),
            startTime: startTime,
            endTime: endTime,
            locationName: locationName, // Può essere diversa dall'originale
            locationColor: locationColor,
            childName: childName,
            status: 'Scheduled'
        };
        appointments.push(newAppointment);

        // Avanza di una settimana per il prossimo recupero (se multiplo)
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // Ordina appuntamenti per data per pulizia
    appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Aggiorna DB
    await updateDoc(enrollmentDocRef, {
        appointments: appointments
    });
};


/**
 * AUTOMAZIONE "BACKEND": Consolida le lezioni passate.
 * Range: 'today', 'month', 'quarter'
 */
export const consolidateAppointments = async (range: 'today' | 'month' | 'quarter' = 'today'): Promise<number> => {
    const q = query(enrollmentCollectionRef, where("status", "==", EnrollmentStatus.Active));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    const now = new Date();
    
    // Calcola data limite indietro nel tempo
    const limitDate = new Date(now);
    limitDate.setHours(0,0,0,0);
    
    if (range === 'month') {
        limitDate.setDate(1); // Primo del mese
    } else if (range === 'quarter') {
        limitDate.setMonth(limitDate.getMonth() - 3);
    }
    // 'today' è il default (solo lezioni fino ad oggi/adesso)

    let updatesCount = 0;

    snapshot.docs.forEach(docSnap => {
        const enrollment = docSnap.data() as Enrollment;
        let needsUpdate = false;
        let newLessonsRemaining = enrollment.lessonsRemaining;
        
        const updatedAppointments = (enrollment.appointments || []).map(app => {
            const appDateTime = new Date(`${app.date.split('T')[0]}T${app.endTime}:00`);
            
            // Check se è nel range temporale selezionato E nel passato
            if (appDateTime < now && appDateTime >= limitDate && (!app.status || app.status === 'Scheduled')) {
                needsUpdate = true;
                newLessonsRemaining = Math.max(0, newLessonsRemaining - 1);
                return { ...app, status: 'Present' as AppointmentStatus };
            }
            return app;
        });

        if (needsUpdate) {
            batch.update(docSnap.ref, {
                appointments: updatedAppointments,
                lessonsRemaining: newLessonsRemaining
            });
            updatesCount++;
        }
    });

    if (updatesCount > 0) {
        await batch.commit();
    }
    
    return updatesCount;
};

// Funzione massiva per aggiornare location/orario da calendario
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
            const updatedApps = (enr.appointments || []).map(app => {
                if (new Date(app.date) >= fromDateObj) {
                    return {
                        ...app,
                        locationName: newLocationName,
                        locationColor: newLocationColor,
                        startTime: newStartTime || app.startTime,
                        endTime: newEndTime || app.endTime
                    };
                }
                return app;
            });
            
            // Aggiorna anche i metadati principali se tutte le lezioni future sono cambiate
            // Per semplicità, aggiorniamo sempre l'ultimo stato noto
            batch.update(docRef, {
                appointments: updatedApps,
                locationId: newLocationId,
                locationName: newLocationName,
                locationColor: newLocationColor
            });
        }
    }
    await batch.commit();
};
