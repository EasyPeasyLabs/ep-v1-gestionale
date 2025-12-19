
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, where, query, DocumentData, QueryDocumentSnapshot, deleteDoc, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
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
// UPDATED: Include Pasquetta (2024-2030)
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

    // Pasquetta (Lunedì dell'Angelo) - Hardcoded 2024-2030 per semplicità
    const easterMondays: Record<number, string> = {
        2024: '4-1',  // 1 Aprile
        2025: '4-21', // 21 Aprile
        2026: '4-6',  // 6 Aprile
        2027: '3-29', // 29 Marzo
        2028: '4-17', // 17 Aprile
        2029: '4-2',  // 2 Aprile
        2030: '4-22'  // 22 Aprile
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
    
    // 1. Trova la lezione e segnala assenza
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");

    appointments[appIndex].status = 'Absent';

    // Se si recupera, lo slot non viene consumato, quindi lessonsRemaining non cambia.
    // Se NON si recupera mai più, teoricamente è perso, ma qui gestiamo solo lo status.
    
    let updatedData: Partial<Enrollment> = { appointments };

    // 2. Logica di Recupero (Slittamento Automatico)
    if (shouldReschedule) {
        const sortedApps = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastApp = sortedApps[sortedApps.length - 1];
        
        if (lastApp) {
            let nextDate = new Date(lastApp.date);
            const originalDayOfWeek = nextDate.getDay();
            
            let foundDate = false;
            let safetyCounter = 0;

            // Cerca la prima data utile che NON sia festiva
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
                    locationId: lastApp.locationId, // Preserva locationId
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

// --- Funzione per segnare PRESENZA (Consuma Slot) ---
export const registerPresence = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");

    // Evita di consumare due volte lo stesso slot
    if (appointments[appIndex].status === 'Present') return;

    appointments[appIndex].status = 'Present';
    
    // IMPORTANTE: Aggiorna location ID, Name e Color per storicizzare la sede della lezione.
    // Questo permette di calcolare i noli correttamente anche se lo studente cambia sede dopo.
    appointments[appIndex].locationId = enrollment.locationId;
    appointments[appIndex].locationName = enrollment.locationName;
    appointments[appIndex].locationColor = enrollment.locationColor;

    // Decrementa slot rimanenti
    const newRemaining = Math.max(0, enrollment.lessonsRemaining - 1);

    await updateDoc(enrollmentDocRef, { 
        appointments: appointments,
        lessonsRemaining: newRemaining
    });
};

// --- RESET STATO (Torna a Scheduled) ---
export const resetAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");

    const previousStatus = appointments[appIndex].status;
    
    // Reset status
    appointments[appIndex].status = 'Scheduled';

    let newRemaining = enrollment.lessonsRemaining;

    // Se era presente, restituiamo il credito (incrementa)
    if (previousStatus === 'Present') {
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    }
    // Se era assente, dipende se aveva generato recupero. 
    // Per semplicità chirurgica: resettiamo solo lo stato. Se era stato generato un recupero automatico, quello rimane come slot extra (manuale) o futuro. 
    // L'integrità perfetta richiederebbe il link all'ID del recupero, ma qui gestiamo il reset della singola lezione.

    await updateDoc(enrollmentDocRef, { 
        appointments: appointments,
        lessonsRemaining: newRemaining
    });
};

// --- DELETE APPOINTMENT (Elimina e Restituisce Credito) ---
export const deleteAppointment = async (enrollmentId: string, appointmentLessonId: string): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    let appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");

    const previousStatus = appointments[appIndex].status;
    
    // Rimuovi l'appuntamento dall'array
    appointments.splice(appIndex, 1);

    let newRemaining = enrollment.lessonsRemaining;

    // Se la lezione era stata consumata (Present), restituiamo il credito
    if (previousStatus === 'Present') {
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    }
    // Se era Scheduled o Absent (senza recupero consumato), il credito è salvo.
    // L'eliminazione libera semplicemente lo slot.

    await updateDoc(enrollmentDocRef, { 
        appointments: appointments,
        lessonsRemaining: newRemaining
    });
};

// --- TOGGLE STATO (Present <-> Absent) ---
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
        // Switch to Absent
        appointments[appIndex].status = 'Absent';
        // Restituisci il credito consumato dalla presenza
        newRemaining = Math.min(enrollment.lessonsTotal, enrollment.lessonsRemaining + 1);
    } else if (currentStatus === 'Absent') {
        // Switch to Present
        appointments[appIndex].status = 'Present';
        
        // Storicizza la location nel momento in cui diventa Presente
        appointments[appIndex].locationId = enrollment.locationId;
        appointments[appIndex].locationName = enrollment.locationName;
        appointments[appIndex].locationColor = enrollment.locationColor;
        
        // Consuma il credito
        newRemaining = Math.max(0, enrollment.lessonsRemaining - 1);
    }

    await updateDoc(enrollmentDocRef, { 
        appointments: appointments,
        lessonsRemaining: newRemaining
    });
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
    let generatedCount = 0;
    
    // UPDATED: Check festività
    while (generatedCount < numberOfLessons) {
        if (!isItalianHoliday(currentDate)) {
            // Crea appuntamento
            const newAppointment: Appointment = {
                lessonId: `REC-${Date.now()}-${generatedCount}`, // ID univoco per recupero
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
        // Avanza di una settimana
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // Ordina appuntamenti per data per pulizia
    appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Aggiorna DB
    await updateDoc(enrollmentDocRef, {
        appointments: appointments
    });
};


// --- NEW: Attivazione Iscrizione (Genera Appuntamenti) ---
// Usata quando si trascina un cartellino "Da Assegnare" in un recinto valido
export const activateEnrollmentWithLocation = async (
    enrollmentId: string,
    supplierId: string,
    supplierName: string,
    locationId: string,
    locationName: string,
    locationColor: string,
    dayOfWeek: number, // 0-6
    startTime: string,
    endTime: string
): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    
    // Calcola la data del primo appuntamento (startDate originale adjusted to dayOfWeek)
    let currentDate = new Date(enrollment.startDate);
    
    // Align to target day of week
    while (currentDate.getDay() !== dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const appointments: Appointment[] = [];
    const lessonsTotal = enrollment.lessonsTotal;
    let generatedCount = 0;

    // UPDATED: Ciclo con controllo festività
    // Continua finché non abbiamo generato N lezioni valide
    while (generatedCount < lessonsTotal) {
        if (!isItalianHoliday(currentDate)) {
            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: currentDate.toISOString(),
                startTime: startTime,
                endTime: endTime,
                locationId: locationId, // CRITICAL: Save LocationID
                locationName: locationName,
                locationColor: locationColor,
                childName: enrollment.childName,
                status: 'Scheduled'
            });
            generatedCount++;
        }
        // Passa sempre alla settimana successiva, che sia festiva o meno
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // Aggiorna Enrollment
    await updateDoc(enrollmentDocRef, {
        supplierId,
        supplierName,
        locationId,
        locationName,
        locationColor,
        appointments: appointments,
        // Aggiorna startDate con la prima data reale generata, e endDate con l'ultima
        startDate: appointments[0]?.date || enrollment.startDate, 
        endDate: appointments.length > 0 ? appointments[appointments.length - 1].date : enrollment.endDate
    });
};


// Funzione massiva per spostamento location/orario (Move Logic)
// UPDATED: Non splitta più l'iscrizione. Aggiorna semplicemente location e lezioni future.
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
            
            // 1. Identifica le lezioni future (da aggiornare)
            // Una lezione è futura se la sua data è >= alla data di spostamento
            const appointments = (enr.appointments || []).map(app => {
                const appDate = new Date(app.date);
                if (appDate >= fromDateObj && app.status !== 'Present' && app.status !== 'Absent') {
                    // Aggiorna location e orario se forniti
                    return {
                        ...app,
                        locationId: newLocationId, // CRITICAL: Update LocationID
                        locationName: newLocationName,
                        locationColor: newLocationColor,
                        startTime: newStartTime || app.startTime,
                        endTime: newEndTime || app.endTime,
                    };
                }
                return app;
            });

            // 2. Aggiorna l'iscrizione
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
