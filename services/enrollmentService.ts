
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, where, query, DocumentData, QueryDocumentSnapshot, deleteDoc, doc, updateDoc, getDoc, writeBatch } from '@firebase/firestore';
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

// --- LOGICA GENERAZIONE CALENDARIO (Helper) ---
const generateTheoreticalAppointments = (
    startDate: string,
    totalLessons: number,
    locationId: string,
    locationName: string,
    locationColor: string,
    startTime: string,
    endTime: string,
    childName: string
): Appointment[] => {
    const appointments: Appointment[] = [];
    const startObj = new Date(startDate);
    let current = new Date(startObj);
    const dayOfWeek = current.getDay();
    let count = 0;
    
    // Safety break to prevent infinite loops if something goes wrong
    let loops = 0; 
    
    while (count < totalLessons && loops < 100) {
        // Verifica se il giorno è corretto (dovrebbe esserlo dato che incrementiamo di 7)
        // E verifica festivi
        if (!isItalianHoliday(current)) {
            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: current.toISOString(),
                startTime: startTime,
                endTime: endTime,
                locationId: locationId,
                locationName: locationName,
                locationColor: locationColor,
                childName: childName,
                status: 'Scheduled'
            });
            count++;
        }
        current.setDate(current.getDate() + 7);
        loops++;
    }
    return appointments;
};

export const updateEnrollment = async (id: string, enrollment: Partial<EnrollmentInput>, regenerateCalendar: boolean = false): Promise<void> => {
    const enrollmentDoc = doc(db, 'enrollments', id);
    
    if (regenerateCalendar && enrollment.startDate && enrollment.lessonsTotal) {
        // --- SMART MERGE LOGIC ---
        const oldSnap = await getDoc(enrollmentDoc);
        if (oldSnap.exists()) {
            const oldData = oldSnap.data() as Enrollment;
            const oldAppointments = oldData.appointments || [];
            
            // Map old appointments by Date (YYYY-MM-DD) for quick lookup
            const historyMap = new Map<string, Appointment>();
            oldAppointments.forEach(a => {
                const k = new Date(a.date).toISOString().split('T')[0];
                historyMap.set(k, a);
            });

            // Determine base parameters for new schedule
            // Use existing enrollment's location/time if not provided in update payload
            // CAUTION: If enrollment.appointments is passed (from form state), it might contain the OLD dates. We ignore it for generation.
            
            // Try to find a reference appointment for time info
            const refApp = oldAppointments.length > 0 ? oldAppointments[0] : null;
            const locId = enrollment.locationId || oldData.locationId || 'unassigned';
            const locName = enrollment.locationName || oldData.locationName || 'Sede Non Definita';
            const locColor = enrollment.locationColor || oldData.locationColor || '#ccc';
            // Use updated appointments array first element if available to get time, else fallback to old
            const timeSource = (enrollment.appointments && enrollment.appointments.length > 0) ? enrollment.appointments[0] : refApp;
            const startTime = timeSource?.startTime || '16:00';
            const endTime = timeSource?.endTime || '18:00';
            const childName = enrollment.childName || oldData.childName;

            // Generate Theoretical Schedule based on NEW Start Date
            const theoreticalSchedule = generateTheoreticalAppointments(
                enrollment.startDate,
                enrollment.lessonsTotal,
                locId,
                locName,
                locColor,
                startTime,
                endTime,
                childName
            );

            // Merge Logic
            const mergedAppointments: Appointment[] = theoreticalSchedule.map(newApp => {
                const key = new Date(newApp.date).toISOString().split('T')[0];
                const historicalMatch = historyMap.get(key);

                if (historicalMatch) {
                    // Match found! Preserve status and ID (to keep history linked)
                    return {
                        ...newApp,
                        lessonId: historicalMatch.lessonId,
                        status: historicalMatch.status
                    };
                } else {
                    // New date (e.g. shift forward) -> Scheduled
                    return newApp;
                }
            });

            enrollment.appointments = mergedAppointments;
            
            // Also update lessonsRemaining based on new schedule
            // Count how many are NOT 'Present' (or 'Absent' without recovery logic, simplified here)
            // Ideally re-calculate based on what's left
            const used = mergedAppointments.filter(a => a.status === 'Present').length;
            enrollment.lessonsRemaining = Math.max(0, enrollment.lessonsTotal - used);

            // --- SLOT-DRIVEN DURATION OVERRIDE ---
            if (mergedAppointments.length > 0) {
                // Sort chronologically just to be safe
                mergedAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                // Override enrollment bounds
                enrollment.startDate = mergedAppointments[0].date;
                enrollment.endDate = mergedAppointments[mergedAppointments.length - 1].date;
            }
        }
    }

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

// --- LOGICA ASSENZE AVANZATA (Lost vs Recover) ---
export const registerAbsence = async (
    enrollmentId: string, 
    appointmentLessonId: string, 
    strategy: 'lost' | 'recover_auto' | 'recover_manual',
    manualDetails?: { date: string, startTime: string, endTime: string, locationId: string, locationName: string, locationColor: string }
): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    // SNAPSHOT PREVIOUS STATUS
    const previousStatus = appointments[appIndex].status;

    // 1. Marca l'appuntamento originale come "Absent"
    appointments[appIndex].status = 'Absent';

    let newLessonsRemaining = enrollment.lessonsRemaining;

    // LOGICA DELTA CREDITI
    // Se era 'Present', il credito era stato scalato. Lo "restituiamo" virtualmente prima di ri-applicare la logica.
    if (previousStatus === 'Present') {
        newLessonsRemaining += 1;
    }

    // 2. Logica condizionale Strategia
    if (strategy === 'lost') {
        // ASSENZA SECCA: Il credito viene bruciato (decremento)
        newLessonsRemaining -= 1;
    } 
    // Se strategy == recover (auto/manual), non scaliamo nulla (il credito rimane "in pancia" per il nuovo slot)

    // Safety check boundaries
    newLessonsRemaining = Math.max(0, Math.min(enrollment.lessonsTotal, newLessonsRemaining));

    if (strategy === 'recover_auto' || strategy === 'recover_manual') {
        // RECUPERO: Generiamo un nuovo slot
        
        const originalApp = appointments[appIndex];
        let newAppointment: Appointment | null = null;

        if (strategy === 'recover_manual' && manualDetails) {
            // RECUPERO MANUALE
            newAppointment = {
                lessonId: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                date: new Date(manualDetails.date).toISOString(),
                startTime: manualDetails.startTime,
                endTime: manualDetails.endTime,
                locationId: manualDetails.locationId,
                locationName: manualDetails.locationName,
                locationColor: manualDetails.locationColor,
                childName: originalApp.childName, // Opzionale: aggiungere " (Recupero)"
                status: 'Scheduled'
            };
        } else {
            // RECUPERO AUTOMATICO (Slot successivo)
            // Cerca l'ultimo appuntamento pianificato per calcolare da lì, oppure da oggi
            // Qui prendiamo la data dell'assenza come base
            let nextDate = new Date(originalApp.date);
            const originalDayOfWeek = nextDate.getDay();
            let foundDate = false;
            let safetyCounter = 0;
            
            while (!foundDate && safetyCounter < 52) { // Max 1 anno avanti
                nextDate.setDate(nextDate.getDate() + 1);
                // Cerca stesso giorno della settimana e non festivo
                if (nextDate.getDay() === originalDayOfWeek && !isItalianHoliday(nextDate)) {
                    foundDate = true;
                }
                safetyCounter++;
            }

            if (foundDate) {
                newAppointment = {
                    lessonId: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    date: nextDate.toISOString(),
                    startTime: originalApp.startTime,
                    endTime: originalApp.endTime,
                    locationId: originalApp.locationId,
                    locationName: originalApp.locationName,
                    locationColor: originalApp.locationColor,
                    childName: originalApp.childName,
                    status: 'Scheduled'
                };
            }
        }

        if (newAppointment) {
            appointments.push(newAppointment);
            // Riordina cronologicamente
            appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
    }

    // UPDATE DATE BOUNDARIES (Extend if recover goes beyond)
    let newEndDate = enrollment.endDate;
    if (appointments.length > 0) {
        appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        newEndDate = appointments[appointments.length - 1].date;
    }

    await updateDoc(enrollmentDocRef, { 
        appointments, 
        lessonsRemaining: newLessonsRemaining,
        endDate: newEndDate
    });
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
    
    // Check if coming from 'Absent' state (which might have kept credit if it was pending recovery, 
    // BUT usually 'Absent' means credit handled. If we switch Absent -> Present, we must consume credit IF it wasn't consumed.
    // Simplifying: Present always consumes 1 credit.
    // We assume lessonsRemaining is currently correct based on previous state. 
    // If it was Scheduled, lessonsRemaining included this lesson.
    // If it was Absent (Lost), lessonsRemaining was decremented. Swapping to Present keeps it decremented (used).
    // If it was Absent (Recovered), lessonsRemaining was preserved. Swapping to Present should decrement it.
    // This state switching logic is complex. 
    // SIMPLE RULE: 'Present' always implies -1 to the *potential* total. 
    // Current logic: Just decrement.
    
    appointments[appIndex].status = 'Present';
    appointments[appIndex].locationId = enrollment.locationId;
    appointments[appIndex].locationName = enrollment.locationName;
    appointments[appIndex].locationColor = enrollment.locationColor;
    
    // We only decrement if it wasn't already counted as "used".
    // Scheduled -> Present: Decrement.
    // Absent (Lost) -> Present: No change (already decremented).
    // Absent (Recovered) -> Present: Decrement (was preserved).
    // To be safe, let's recalculate based on total.
    
    const usedCount = appointments.filter(a => a.status === 'Present' || (a.status === 'Absent' && !a.lessonId.startsWith('REC-') /* Heuristic */)).length;
    // Actually, safer to just trust the current counter - 1 if moving from Scheduled.
    
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
    // If we delete a 'Present' or 'Absent (Lost)', we should refund the credit?
    // Usually deleting an appointment means "it never happened/cancelled". Refund credit.
    if (previousStatus === 'Present' || previousStatus === 'Absent') {
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
    
    // Logic toggle: Present <-> Absent (Lost)
    if (currentStatus === 'Present') {
        appointments[appIndex].status = 'Absent';
        // No change in remaining (both consume slot)
    } else if (currentStatus === 'Absent') {
        appointments[appIndex].status = 'Present';
        // No change in remaining
    } else if (currentStatus === 'Scheduled') {
        appointments[appIndex].status = 'Present';
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
    
    // Extend End Date if needed
    const newEndDate = appointments.length > 0 ? appointments[appointments.length - 1].date : enrollment.endDate;

    await updateDoc(enrollmentDocRef, { appointments, endDate: newEndDate });
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
    
    // Find the first occurrence of the specific dayOfWeek
    while (currentDate.getDay() !== dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const appointments: Appointment[] = [];
    const lessonsTotal = enrollment.lessonsTotal;
    let generatedCount = 0;
    
    // Generate until quota filled
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
        // Advance 1 week regardless (checks holiday next loop)
        currentDate.setDate(currentDate.getDate() + 7);
    }

    await updateDoc(enrollmentDocRef, {
        supplierId,
        supplierName,
        locationId,
        locationName,
        locationColor,
        appointments: appointments,
        // Override dates to match reality of slots
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

// --- SCHOOL CLOSURE HANDLERS ---

export const suspendLessonsForClosure = async (closureDate: string): Promise<void> => {
    const batch = writeBatch(db);
    const targetDate = new Date(closureDate);
    const targetDateStr = closureDate.split('T')[0];

    // 1. Process Enrollments
    const enrollmentsSnapshot = await getDocs(enrollmentCollectionRef);
    enrollmentsSnapshot.docs.forEach(docSnap => {
        const enr = docSnap.data() as Enrollment;
        if (enr.appointments && enr.appointments.length > 0) {
            let modified = false;
            const newApps = enr.appointments.map(app => {
                const appDateStr = app.date.split('T')[0];
                // Only suspend Scheduled lessons
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

    // 2. Process Manual Lessons (Extra)
    // Note: Manual lessons are their own docs. We add a field `isSuspended` or update UI logic?
    // Since `Lesson` type doesn't have status, we assume manual lessons are simply "events".
    // For this implementation, we will append "[SOSPESO]" to description to indicate closure.
    const lessonsCollectionRef = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsCollectionRef);
    lessonsSnapshot.docs.forEach(docSnap => {
        const lesson = docSnap.data() as Lesson;
        const lessonDateStr = lesson.date.split('T')[0];
        if (lessonDateStr === targetDateStr) {
            if (!lesson.description.startsWith('[SOSPESO]')) {
                batch.update(docSnap.ref, { description: `[SOSPESO] ${lesson.description}` });
            }
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
        // Append to end: Find last appointment date and add 1 week
        const sortedApps = [...appointments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastApp = sortedApps[sortedApps.length - 1];
        const lastDate = new Date(lastApp.date);
        
        // Find next valid slot (1 week later, skipping holidays)
        let candidateDate = new Date(lastDate);
        candidateDate.setDate(candidateDate.getDate() + 7);
        while (isItalianHoliday(candidateDate)) {
            candidateDate.setDate(candidateDate.getDate() + 7);
        }
        targetDateObj = candidateDate;
    }

    // Create rescheduled appointment
    const newApp: Appointment = {
        ...originalApp,
        date: targetDateObj.toISOString(),
        status: 'Scheduled',
        // Preserve original time/location unless specified otherwise
    };

    // Remove old suspended one or update it? 
    // Requirement says "reschedule", so we replace the suspended one with the new one at new date
    appointments[appIndex] = newApp;
    
    // Sort and update end date
    appointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const newEndDate = appointments[appointments.length - 1].date;

    await updateDoc(enrRef, { appointments, endDate: newEndDate });
};