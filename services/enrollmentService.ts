
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

    // 2. Logica di Recupero (Slittamento)
    if (shouldReschedule) {
        // Trova l'ultima lezione in programma (ignorando quelle cancellate o già assenti, basiamoci sulla data)
        // Ordiniamo per data per sicurezza
        const sortedApps = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastApp = sortedApps[sortedApps.length - 1];
        
        if (lastApp) {
            let nextDate = new Date(lastApp.date);
            const originalDayOfWeek = nextDate.getDay();
            
            let foundDate = false;
            let safetyCounter = 0;

            // Cerca la prossima data valida (stesso giorno della settimana, non festivo)
            while (!foundDate && safetyCounter < 52) { // Limite di sicurezza 1 anno
                nextDate.setDate(nextDate.getDate() + 1); // Avanza di un giorno
                
                if (nextDate.getDay() === originalDayOfWeek) {
                    // Trovato il giorno della settimana corretto. Controlla festività
                    if (!isItalianHoliday(nextDate)) {
                        foundDate = true;
                    }
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
                
                // NOTA: Non aggiorniamo più endDate qui per mantenere la data di scadenza contrattuale originale.
                // L'estensione verrà segnalata visivamente nell'interfaccia come "Recupero".
                // updatedData.endDate = nextDate.toISOString(); 
            }
        }
    }

    updatedData.appointments = appointments;
    await updateDoc(enrollmentDocRef, updatedData);
};


/**
 * AUTOMAZIONE "BACKEND": Consolida le lezioni passate.
 * Questa funzione simula il job notturno.
 * Cerca tutte le lezioni con status 'Scheduled' la cui data è passata (minore di oggi/ora).
 * Le imposta come 'Present' e decrementa il contatore lessonsRemaining.
 */
export const consolidateAppointments = async (): Promise<number> => {
    // 1. Ottieni tutte le iscrizioni attive
    const q = query(enrollmentCollectionRef, where("status", "==", EnrollmentStatus.Active));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    const now = new Date();
    let updatesCount = 0;

    snapshot.docs.forEach(docSnap => {
        const enrollment = docSnap.data() as Enrollment;
        let needsUpdate = false;
        let newLessonsRemaining = enrollment.lessonsRemaining;
        
        const updatedAppointments = (enrollment.appointments || []).map(app => {
            // Costruiamo la data/ora dell'appuntamento per confrontarla con ADESSO
            const appDateTime = new Date(`${app.date.split('T')[0]}T${app.endTime}:00`);
            
            // Se l'appuntamento è nel passato E lo stato è ancora 'Scheduled' (quindi non Absent o Cancelled)
            // Allora assumiamo che sia stato svolto regolarmente (Present)
            if (appDateTime < now && (!app.status || app.status === 'Scheduled')) {
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
