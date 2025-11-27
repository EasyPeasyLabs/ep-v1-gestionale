
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

// Helper interno per generare lezioni future (duplicato logico da EnrollmentForm per uso server-side)
const generateAppointmentsInternal = (startDate: Date, startTime: string, endTime: string, numLessons: number, locName: string, locColor: string, childName: string): Appointment[] => {
    const appointments: Appointment[] = [];
    let currentDate = new Date(startDate);
    let lessonsScheduled = 0;

    while (lessonsScheduled < numLessons) {
        appointments.push({
            lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            date: currentDate.toISOString(),
            startTime: startTime,
            endTime: endTime,
            locationName: locName,
            locationColor: locColor,
            childName: childName,
            status: 'Scheduled'
        });
        currentDate.setDate(currentDate.getDate() + 7);
        lessonsScheduled++;
    }
    return appointments;
};

// Funzione massiva per SPLIT e sposta location/orario da calendario
// Modifica Enterprise: Chiude le vecchie iscrizioni e ne crea di nuove per le lezioni residue
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
            // FIX: Recuperiamo esplicitamente l'ID dal documento, perché snap.data() non lo contiene.
            const data = snap.data();
            const originalId = snap.id;
            const enr = { ...data, id: originalId } as Enrollment;
            
            // 1. Filtra lezioni passate (da mantenere nella vecchia iscrizione)
            // Consideriamo passate tutte le lezioni con data < fromDate
            const oldAppointments = (enr.appointments || []).filter(app => {
                const appDate = new Date(app.date);
                return appDate < fromDateObj;
            });

            // 2. Calcola lezioni rimanenti
            // Se lezioni totali erano 10, e ne ho fatte 4 (oldAppointments), ne devo generare 6 nuove.
            const futureAppointmentsCount = (enr.appointments || []).length - oldAppointments.length;
            
            if (futureAppointmentsCount <= 0) {
                // Se non ci sono lezioni future, aggiorniamo solo i metadati della corrente (opzionale)
                // oppure saltiamo. Per ora saltiamo perché non c'è nulla da "spostare".
                continue; 
            }

            // 3. Chiudi Vecchia Iscrizione
            // Data fine = giorno prima della modifica
            const closeDate = new Date(fromDateObj);
            closeDate.setDate(closeDate.getDate() - 1);

            batch.update(docRef, {
                appointments: oldAppointments,
                status: EnrollmentStatus.Completed,
                endDate: closeDate.toISOString(),
                // Lessons remaining va a 0 perché quelle rimanenti vengono spostate nella nuova
                lessonsRemaining: 0 
            });

            // 4. Crea Nuova Iscrizione (Continuazione)
            const newRef = doc(collection(db, 'enrollments'));
            
            // Genera nuovi appuntamenti con i nuovi orari/luoghi
            const startGenDate = new Date(fromDate); 
            // fromDate è la data effettiva del primo nuovo appuntamento
            
            const newAppointments = generateAppointmentsInternal(
                startGenDate,
                newStartTime || enr.appointments[0]?.startTime || '09:00', // Fallback se non c'è orario
                newEndTime || enr.appointments[0]?.endTime || '10:00',
                futureAppointmentsCount,
                newLocationName,
                newLocationColor,
                enr.childName
            );

            // Calcola nuova data fine stimata
            const lastAppDate = newAppointments.length > 0 ? newAppointments[newAppointments.length - 1].date : fromDate;
            
            const newEnrollment: Enrollment = {
                ...enr, // Copia tutti i campi (incluso note, rating, ecc.)
                id: newRef.id,
                startDate: fromDate, // Inizia dalla modifica
                endDate: lastAppDate, // Finisce quando finiscono le lezioni residue
                status: EnrollmentStatus.Active,
                locationId: newLocationId,
                locationName: newLocationName,
                locationColor: newLocationColor,
                appointments: newAppointments,
                lessonsTotal: futureAppointmentsCount, // Totale del nuovo pacchetto "residuo"
                lessonsRemaining: futureAppointmentsCount,
                price: 0, // Importante: Prezzo 0 perché già pagato nella precedente
                previousEnrollmentId: originalId, // Link alla storia (FIX: usa ID esplicito)
            };

            batch.set(newRef, newEnrollment);
        }
    }
    await batch.commit();
};
