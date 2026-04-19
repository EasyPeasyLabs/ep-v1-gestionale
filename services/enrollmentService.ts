
import { db } from '../firebase/config';
import { collection, getDocs, getDocsFromServer, addDoc, where, query, DocumentData, QueryDocumentSnapshot, doc, updateDoc, getDoc, getDocFromServer, writeBatch, arrayUnion } from 'firebase/firestore';
/* Added DocumentStatus to imports */
import { Enrollment, EnrollmentInput, Appointment, AppointmentStatus, EnrollmentStatus, Quote, ClientType, Lesson, DocumentStatus, LessonInput, SchoolClosure, LessonAttendee, Course } from '../types';
import { isItalianHoliday } from '../utils/dateUtils';
import { getSchoolClosures } from './calendarService';
import { getOpenCourses, getLocations } from './courseService';
import { getSuppliers } from './supplierService';

const getEnrollmentCollectionRef = () => collection(db, 'enrollments');

// --- NUOVA ARCHITETTURA: PRENOTAZIONE NELLE LEZIONI ---
export const bookStudentIntoCourseLessons = async (
    enrollmentId: string,
    courseId: string,
    clientId: string,
    childId: string,
    childName: string,
    startDate: string,
    totalLessons: number,
    quotas?: { lab?: number, sg?: number, evt?: number, read?: number }
) => {
    const lessonsRef = collection(db, 'lessons');
    const q = query(
        lessonsRef,
        where('courseId', '==', courseId)
    );
    const snap = await getDocs(q);
    
    // Filtriamo e ordiniamo in memoria per evitare la necessità di indici compositi su Firestore
    const lessons = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Lesson))
        .filter(l => {
            const cleanLDate = l.date.split('T')[0];
            const cleanSDate = startDate.split('T')[0];
            return cleanLDate >= cleanSDate;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    const batch = writeBatch(db);
    let bookedCount = 0;
    let labUsed = 0;
    let sgUsed = 0;
    let evtUsed = 0;
    let readUsed = 0;
    let finalEndDate = startDate;

    const attendee: LessonAttendee = {
        clientId,
        childId,
        childName,
        enrollmentId,
        status: 'Scheduled'
    };

    for (const lesson of lessons) {
        if (bookedCount >= totalLessons) break;

        // Check quotas if provided
        if (quotas) {
            if (lesson.slotType === 'LAB' && quotas.lab !== undefined && labUsed >= quotas.lab) continue;
            if (lesson.slotType === 'SG' && quotas.sg !== undefined && sgUsed >= quotas.sg) continue;
            if (lesson.slotType === 'EVT' && quotas.evt !== undefined && evtUsed >= quotas.evt) continue;
            if (lesson.slotType === 'READ' && quotas.read !== undefined && readUsed >= quotas.read) continue;
        }

        const lessonDocRef = doc(db, 'lessons', lesson.id);
        
        // Controlla se l'allievo è già prenotato
        const isAlreadyBooked = (lesson.attendees || []).some(a => a.enrollmentId === enrollmentId);
        
        if (!isAlreadyBooked) {
            batch.update(lessonDocRef, {
                attendees: arrayUnion(attendee)
            });
        }

        if (lesson.slotType === 'LAB') labUsed++;
        else if (lesson.slotType === 'SG') sgUsed++;
        else if (lesson.slotType === 'EVT') evtUsed++;
        else if (lesson.slotType === 'READ') readUsed++;
        
        bookedCount++;
        finalEndDate = lesson.date;
    }

    if (bookedCount > 0) {
        await batch.commit();
    }

    return { bookedCount, labUsed, sgUsed, evtUsed, readUsed, finalEndDate };
};

const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => {
    return { id: doc.id, ...doc.data() } as Enrollment;
};

export const getEnrollmentsForClient = async (clientId: string): Promise<Enrollment[]> => {
    const q = query(getEnrollmentCollectionRef(), where("clientId", "==", clientId));
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
    const snapshot = await getDocs(getEnrollmentCollectionRef());
    return snapshot.docs.map(docToEnrollment);
};

export const addEnrollment = async (enrollment: EnrollmentInput): Promise<string> => {
    const docRef = await addDoc(getEnrollmentCollectionRef(), enrollment);
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
    childName: string,
    comboConfigs?: Course['comboConfigs'],
    weeklyPlan?: Record<number, string>
): Appointment[] => {
    const appointments: Appointment[] = [];
    const startObj = new Date(startDate);
    // FIX DATE SLIPPAGE: Force noon to avoid timezone shift on iterative adding
    startObj.setHours(12, 0, 0, 0);
    
    const current = new Date(startObj);
    
    // Safety break to prevent infinite loops if something goes wrong
    let loops = 0; 
    let count = 0;
    
    while (count < totalLessons && loops < 100) {
        // Verifica se il giorno è corretto (dovrebbe esserlo dato che incrementiamo di 7)
        // E verifica festivi (USING CENTRALIZED UTILS)
        if (!isItalianHoliday(current)) {
            let sTime = startTime;
            let eTime = endTime;
            let aType = 'LAB';

            if (comboConfigs && comboConfigs.LAB && comboConfigs.SG && weeklyPlan) {
                const day = current.getDate();
                const weekNum = Math.ceil(day / 7);
                const plannedType = weeklyPlan[weekNum] || 'LAB';
                
                if (plannedType === 'LAB') {
                    sTime = comboConfigs.LAB.startTime;
                    eTime = comboConfigs.LAB.endTime;
                    aType = 'LAB';
                } else {
                    sTime = comboConfigs.SG.startTime;
                    eTime = comboConfigs.SG.endTime;
                    aType = 'SG';
                }
            }

            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: current.toISOString(),
                startTime: sTime,
                endTime: eTime,
                locationId: locationId,
                locationName: locationName,
                locationColor: locationColor,
                childName: childName,
                status: 'Scheduled',
                type: aType
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
                const k = a.date.split('T')[0];
                historyMap.set(k, a);
            });

            // Determine base parameters for new schedule
            const refApp = oldAppointments.length > 0 ? oldAppointments[0] : null;
            const locId = enrollment.locationId || oldData.locationId || 'unassigned';
            const locName = enrollment.locationName || oldData.locationName || 'Sede Non Definita';
            const locColor = enrollment.locationColor || oldData.locationColor || '#ccc';
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
                const key = newApp.date.split('T')[0];
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
    const batch = writeBatch(db);
    
    // 1. Get Enrollment to know its courseId
    const enrollmentRef = doc(db, 'enrollments', id);
    const enrollmentSnap = await getDoc(enrollmentRef);
    let courseId = null;
    if (enrollmentSnap.exists()) {
        const enrData = enrollmentSnap.data() as Enrollment;
        courseId = enrData.courseId;
    }

    // 2. Delete Enrollment document
    batch.delete(enrollmentRef);
    
    // 3. Search and delete related Physical Lessons (Old Architecture)
    try {
        const oldLessonsQuery = query(collection(db, 'lessons'), where('enrollmentId', '==', id));
        const oldLessonsSnap = await getDocs(oldLessonsQuery);
        
        oldLessonsSnap.forEach((lessonDoc) => {
            batch.delete(lessonDoc.ref);
        });
        
        console.log(`Deep Delete: Cleaning up ${oldLessonsSnap.size} old lessons for enrollment ${id}`);
    } catch (error) {
        console.error("Error during deep delete of old lessons:", error instanceof Error ? error.message : error);
    }

    // 4. Remove attendee from Course Lessons (New Architecture)
    if (courseId) {
        try {
            const courseLessonsQuery = query(collection(db, 'lessons'), where('courseId', '==', courseId));
            const courseLessonsSnap = await getDocs(courseLessonsQuery);
            let updatedCount = 0;

            courseLessonsSnap.forEach((lessonDoc) => {
                const lessonData = lessonDoc.data() as Lesson;
                if (lessonData.attendees && lessonData.attendees.some(a => a.enrollmentId === id)) {
                    const newAttendees = lessonData.attendees.filter(a => a.enrollmentId !== id);
                    batch.update(lessonDoc.ref, { attendees: newAttendees });
                    updatedCount++;
                }
            });
            console.log(`Deep Delete: Removed attendee from ${updatedCount} course lessons for enrollment ${id}`);
        } catch (error) {
            console.error("Error during cleanup of course lessons:", error instanceof Error ? error.message : error);
        }
    }
    
    // 5. Commit all deletions atomically
    await batch.commit();
};

// --- SCRIPT DI BONIFICA (TRANSIZIONE ARCHITETTURA) ---
export const bonificaAppointments = async (): Promise<number> => {
    console.log("Inizio bonifica chirurgica appointments...");
    const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));
    let updatedCount = 0;
    const batch = writeBatch(db);
    let operationsInBatch = 0;

    for (const docSnap of enrollmentsSnap.docs) {
        const data = docSnap.data() as Enrollment;
        
        // UNIVERSAL BONIFICA: Applica a TUTTI i tipi di iscrizione (Corso, Manuale o Istituzionale)
        if (data.appointments && data.appointments.length > 0) {
            const originalCount = data.appointments.length;
            
            // 1. Forza la conservazione solo di presenze storiche e stati bloccati
            // 2. Rimuove appuntamenti Scheduled che non sono collegati a una lezione fisica
            const preservedApps = (data.appointments || []).filter(app => {
                // Se è già registrata una presenza/assenza o sospensione, NON TOCCARE
                if (app.status === 'Present' || app.status === 'Absent' || app.status === 'Suspended') return true;
                
                // Se l'iscrizione ha un corso, le lezioni Scheduled devono stare SOLO in Lessons
                // Se è manuale, verranno ripulite dalla deduplicazione del Registro e dal Recovery
                if (data.courseId && data.courseId !== 'manual') return false;
                
                return true;
            });
            
            if (preservedApps.length !== originalCount) {
                batch.update(docSnap.ref, { appointments: preservedApps });
                updatedCount++;
                operationsInBatch++;
            }
            
            if (operationsInBatch >= 450) {
                await batch.commit();
                operationsInBatch = 0;
            }
        }
    }
    
    if (operationsInBatch > 0) {
        await batch.commit();
    }
    
    // Avvia automaticamente il ripristino per tappare i buchi creati in precedenza
    await recuperoIntegraleDati();
    
    console.log(`Bonifica e Ripristino completati. ${updatedCount} iscrizioni sanate.`);
    return updatedCount;
};

// --- MOTORE DI RECUPERO INTEGRALE (REPOSITIONING SYSTEM) ---
export const recuperoIntegraleDati = async (): Promise<void> => {
    console.log("[Recovery] Avvio Motore di Ripristino...");
    const [enrollmentsSnap, lessonsSnap, coursesSnap] = await Promise.all([
        getDocs(collection(db, 'enrollments')),
        getDocs(collection(db, 'lessons')),
        getDocs(collection(db, 'courses'))
    ]);

    const enrMap = new Map<string, Enrollment>(enrollmentsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Enrollment]));
    const lessonDocs = lessonsSnap.docs;
    const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
    const batch = writeBatch(db);
    let counter = 0;

    // 1. Ripristino da Source B (Lessons) -> Source A (Enrollments)
    // Se un allievo è in una lezione fisica, DEVE avere l'appuntamento nel registro
    for (const lessonDoc of lessonDocs) {
        const lesson = lessonDoc.data() as Lesson;
        if (!lesson.attendees || lesson.attendees.length === 0) continue;

        for (const attendee of lesson.attendees) {
            if (!attendee.enrollmentId) continue;
            
            const enr = enrMap.get(attendee.enrollmentId);
            if (!enr) continue;

            const exists = (enr.appointments || []).some(app => 
                app.lessonId === lessonDoc.id || 
                (app.date.split('T')[0] === lesson.date.split('T')[0] && app.startTime === lesson.startTime)
            );

            if (!exists) {
                const newApp: Appointment = {
                    lessonId: lessonDoc.id,
                    date: lesson.date,
                    startTime: lesson.startTime,
                    endTime: lesson.endTime,
                    locationId: lesson.locationId || enr.locationId,
                    locationName: lesson.locationName,
                    locationColor: lesson.locationColor,
                    childName: attendee.childName,
                    status: (attendee.status as AppointmentStatus) || AppointmentStatus.Scheduled,
                    type: lesson.slotType
                };

                const updatedApps = [...(enr.appointments || []), newApp].sort((a,b) => a.date.localeCompare(b.date));
                batch.update(doc(db, 'enrollments', enr.id), { appointments: updatedApps });
                enr.appointments = updatedApps;
                counter++;
            }
        }
    }

    // 2. Ripristino Architetturale per Iscrizioni "Vuote" (Ghost Recovery)
    // Se un'iscrizione è attiva ma non ha appuntamenti, tentiamo di rigenerarli
    for (const enr of enrMap.values()) {
        if (enr.status === EnrollmentStatus.Active && (!enr.appointments || enr.appointments.length === 0)) {
            // Se legata a un corso, proviamo a ri-prenotarla
            if (enr.courseId && enr.courseId !== 'manual') {
                const course = courses.find(c => c.id === enr.courseId);
                if (course) {
                    console.log(`[Recovery] Rigenerazione appuntamenti per allievo ${enr.childName} (Corso: ${enr.courseId})`);
                    // Qui chiamiamo la logica di booking ma in batch se possibile
                    // Per ora, segnaliamo e ripristiniamo teorici se mancano i fisici
                    const startDate = enr.startDate;
                    const lessonsToGenerate = enr.lessonsRemaining || enr.lessonsTotal || 0;
                    
                    if (lessonsToGenerate > 0) {
                        // Generazione teorica di emergenza per ridare visibilità
                        const dummyApps = generateTheoreticalAppointments(
                            startDate,
                            lessonsToGenerate,
                            enr.locationId,
                            enr.locationName,
                            enr.locationColor,
                            course.startTime,
                            course.endTime,
                            enr.childName
                        );
                        batch.update(doc(db, 'enrollments', enr.id), { appointments: dummyApps });
                        enr.appointments = dummyApps;
                        counter++;
                    }
                }
            }
        }
    }

    // 3. Sanificazione Universale (Deduplicazione Totale - Indipendente dai nomi)
    for (const enr of enrMap.values()) {
        const originalLength = enr.appointments?.length || 0;
        if (originalLength === 0) continue;

        const cleanedApps = (enr.appointments || []).filter((app, index, self) => {
            const appDateStr = app.date.split('T')[0];
            
            // Deduplicazione per data/ora (Sorgente di verità univoca)
            const duplicateIndex = self.findIndex(t => 
                t.date.split('T')[0] === appDateStr && 
                t.startTime === app.startTime
            );

            // Per i progetti (SNUPY, BABY CLUB, PUTIGNANO, etc.), 
            // incrociamo con le lezioni fisiche master esistenti. 
            // Se esiste una lezione master per quel giorno/ora per questo allievo,
            // l'appuntamento slave (senza lessonId) deve sparire per evitare duplicati.
            const hasMasterLesson = lessonDocs.some(l => {
                const lessonData = l.data() as Lesson;
                return lessonData.date.split('T')[0] === appDateStr && 
                       lessonData.startTime === app.startTime &&
                       lessonData.attendees?.some((a: LessonAttendee) => a.enrollmentId === enr.id);
            });

            if (hasMasterLesson && !app.lessonId) return false;

            return duplicateIndex === index;
        });

        if (cleanedApps.length !== originalLength) {
            batch.update(doc(db, 'enrollments', enr.id), { appointments: cleanedApps });
            counter++;
        }
    }

    if (counter > 0) {
        await batch.commit();
        console.log(`[Recovery] Ripristinati/Sanati ${counter} blocchi dati.`);
    }
};

// --- SYNC ENGINE: Manual Lesson Update -> Enrollment Appointment Update ---
export const syncEnrollmentFromLessonUpdate = async (lessonId: string, lessonUpdate: Partial<LessonInput>) => {
    // Only proceed if critical fields changed (Date, Time, Location)
    if (!lessonUpdate.date && !lessonUpdate.startTime && !lessonUpdate.endTime && !lessonUpdate.locationName) return;

    if (lessonUpdate.attendees && lessonUpdate.attendees.length > 0) {
        const batch = writeBatch(db);
        let updatedCount = 0;

        for (const attendee of lessonUpdate.attendees) {
            if (attendee.enrollmentId) {
                const enrRef = doc(db, 'enrollments', attendee.enrollmentId);
                const enrSnap = await getDoc(enrRef);
                if (enrSnap.exists()) {
                    const enrData = enrSnap.data() as Enrollment;
                    // Find matching appointment by lessonId
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
            console.log(`[Sync] Updated ${updatedCount} enrollments from manual lesson update.`);
        }
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

        const hasMatch = data.appointments.some(a => {
            // 1. Match by lessonId (Hard Link)
            if (a.lessonId === lessonId) return true;
            
            // 2. Match by Slot (Fuzzy Link) - Only if details provided
            if (lessonDetails) {
                const matchDate = a.date.split('T')[0] === lessonDetails.date.split('T')[0];
                const matchTime = a.startTime === lessonDetails.startTime;
                const matchLoc = (a.locationName || '').trim().toLowerCase() === (lessonDetails.locationName || '').trim().toLowerCase();
                return matchDate && matchTime && matchLoc;
            }
            return false;
        });

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
        console.log(`[Sync] Removed deleted lesson ${lessonId} (and matching slots) from ${updatedCount} enrollments.`);
    }
};

// --- NEW: RESYNC FORZATO PER PROGETTI ISTITUZIONALI (OPTIMIZED) ---
// Questa funzione interroga SOLO la finestra temporale rilevante per evitare Transport Error (Full Table Scan).
export const resyncInstitutionalEnrollment = async (enrollmentId: string): Promise<number> => {
    try {
        const enrollmentRef = doc(db, 'enrollments', enrollmentId);
        // FORCE SERVER FETCH: Bypass cache to avoid stale data or cache deadlock
        const enrollmentSnap = await getDocFromServer(enrollmentRef);
        if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
        const enrData = enrollmentSnap.data() as Enrollment;

        // 1. Calcola finestra temporale con buffer di 60gg
        const startDate = new Date(enrData.startDate);
        const endDate = new Date(enrData.endDate);
        
        // Safety check se date mancanti
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("Date iscrizione non valide. Impossibile ottimizzare la ricerca.");
        }

        const rangeStart = new Date(startDate); rangeStart.setDate(rangeStart.getDate() - 60);
        const rangeEnd = new Date(endDate); rangeEnd.setDate(rangeEnd.getDate() + 60);

        // FIX: Uso split per avere solo YYYY-MM-DD
        // Questo garantisce compatibilità sia con date salvate come "2026-02-01" che "2026-02-01T..."
        const rangeStartStr = rangeStart.toISOString().split('T')[0]; 
        const rangeEndStr = rangeEnd.toISOString().split('T')[0];

        console.log(`[Resync] Query range (Network Only): ${rangeStartStr} to ${rangeEndStr}`);

        // 2. Query Ottimizzata (Server-Side Filtering)
        const lessonsRef = collection(db, 'lessons');
        const q = query(
            lessonsRef, 
            where('date', '>=', rangeStartStr),
            where('date', '<=', rangeEndStr)
        );

        // FORCE SERVER FETCH: Bypass cache
        const lessonsSnap = await getDocsFromServer(q);
        const allLessonsInWindow = lessonsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Lesson));

        console.log(`[Resync] Fetched ${allLessonsInWindow.length} potential lessons from server.`);

        // 3. Filtro "Hard Link" in memoria (su dataset ridotto)
        let linkedLessons = allLessonsInWindow.filter(l => l.attendees && l.attendees.some(a => a.enrollmentId === enrollmentId));

        // 4. Logica "Self-Healing": Se non troviamo lezioni linkate, cerchiamo lezioni "orfane" 
        // che corrispondono per nome progetto (spesso inserito nella descrizione)
        if (linkedLessons.length === 0) {
            console.log(`[Resync] Nessun hard-link trovato. Avvio ricerca per nome progetto: "${enrData.childName}"`);
            
            const projectNameLower = enrData.childName.trim().toLowerCase();
            
            // Candidati: Lezioni manuali che contengono il nome progetto
            const candidates = allLessonsInWindow.filter(l => 
                (l.description || '').toLowerCase().includes(projectNameLower) ||
                (l.childName || '').toLowerCase().includes(projectNameLower)
            );

            if (candidates.length > 0) {
                console.log(`[Resync] Trovate ${candidates.length} lezioni orfane compatibili. Eseguo healing...`);
                const batch = writeBatch(db);
                
                // Ripariamo le lezioni aggiungendo l'attendee corretto
                candidates.forEach(l => {
                    const attendees = l.attendees || [];
                    // Evita duplicati se già presente ma magari senza enrollmentId
                    const cleanAttendees = attendees.filter(a => a.childName !== enrData.childName);
                    
                    cleanAttendees.push({
                        clientId: enrData.clientId,
                        childId: 'institutional',
                        childName: enrData.childName,
                        enrollmentId: enrollmentId // Questo è il link mancante che ripristiniamo
                    });

                    batch.update(doc(db, 'lessons', l.id), { attendees: cleanAttendees });
                });
                
                await batch.commit();
                // Aggiorniamo la lista linkedLessons con i candidati riparati
                linkedLessons = candidates;
            }
        }

        if (linkedLessons.length === 0) {
            return 0; // Nessuna lezione trovata nemmeno col self-healing
        }

        // Sort Chronologically
        linkedLessons.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Rebuild Appointments
        const newAppointments: Appointment[] = linkedLessons.map(l => ({
            lessonId: l.id,
            date: l.date,
            startTime: l.startTime,
            endTime: l.endTime,
            locationId: 'institutional', // Manteniamo la logica di raggruppamento
            locationName: l.locationName,
            locationColor: l.locationColor,
            childName: enrData.childName, // Use Enrollment project name
            status: 'Scheduled'
        }));

        // Update Enrollment
        await updateDoc(enrollmentRef, {
            appointments: newAppointments,
            lessonsTotal: newAppointments.length,
            lessonsRemaining: newAppointments.length, // O calcola in base a stato lezione se avessimo 'completed' su lesson
            startDate: newAppointments[0].date,
            endDate: newAppointments[newAppointments.length - 1].date
        });

        return newAppointments.length;
    } catch (e) {
        console.error("Critical Resync Error:", e instanceof Error ? e.message : e);
        throw e; // Rilancia per la UI
    }
};

// --- LOGICA ASSENZE AVANZATA (Lost vs Recover) ---
export const registerAbsence = async (
    enrollmentId: string, 
    appointmentLessonId: string, 
    strategy: 'lost' | 'recover_auto' | 'recover_manual',
    manualDetails?: { date: string, startTime: string, endTime: string, locationId: string, locationName: string, locationColor: string },
    cachedClosures?: SchoolClosure[],
    isNewArchitecture?: boolean
): Promise<void> => {
    if (isNewArchitecture) {
        // NUOVA ARCHITETTURA: Aggiorna lo stato nell'array attendees della Lesson
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) throw new Error("Allievo non trovato nella lezione");
        
        // PREVENZIONE DUPLICATI
        if ((strategy === 'recover_auto' || strategy === 'recover_manual') && attendees[attendeeIndex].recoveryId) {
            console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
            return;
        }

        attendees[attendeeIndex].status = 'Absent';
        
        // TODO: Implementare logica di recupero (creazione nuova Lesson o inserimento in Lesson esistente)
        // Per ora ci limitiamo a segnare l'assenza
        if (strategy === 'recover_auto' || strategy === 'recover_manual') {
            console.warn("Recupero non ancora implementato per la nuova architettura");
        }

        await updateDoc(lessonRef, { attendees });
        return;
    }

    // VECCHIA ARCHITETTURA (Fallback)
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    
    if (appIndex === -1) throw new Error("Lezione non trovata");
    
    // SNAPSHOT PREVIOUS STATUS
    const previousStatus = appointments[appIndex].status;

    // PREVENZIONE DUPLICATI: Se stiamo chiedendo un recupero ma l'appuntamento ha già un recoveryId, 
    // significa che è già stato gestito. Interrompiamo per evitare doppioni.
    if ((strategy === 'recover_auto' || strategy === 'recover_manual') && appointments[appIndex].recoveryId) {
        console.warn("[EnrollmentService] Tentativo di recupero duplicato ignorato per lessonId:", appointmentLessonId);
        return;
    }

    // 1. Marca l'appuntamento originale come "Absent"
    appointments[appIndex].status = 'Absent';

    let newLessonsRemaining = enrollment.lessonsRemaining;

    // LOGICA DELTA CREDITI
    if (previousStatus === 'Present') {
        newLessonsRemaining += 1;
    }

    // 2. Logica condizionale Strategia
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
            // RECUPERO AUTOMATICO: Slitta alla prima settimana disponibile DOPO l'ultima lezione programmata
            const closures = cachedClosures || await getSchoolClosures();
            const closedDates = new Set(closures.map(c => c.date.split('T')[0]));

            // Trova l'ultima data programmata attualmente per determinare il punto di accodamento
            const sortedApps = [...appointments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const lastApp = sortedApps[sortedApps.length - 1];
            
            const nextDate = new Date(lastApp.date);
            const originalDayOfWeek = new Date(originalApp.date).getDay();
            let foundDate = false;
            let safetyCounter = 0;
            
            while (!foundDate && safetyCounter < 52) { 
                nextDate.setDate(nextDate.getDate() + 1);
                const isoDate = nextDate.toISOString().split('T')[0];

                // Cerca lo stesso giorno della settimana dell'originale, DOPO l'ultima lezione, non festivo e NON chiusura
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
            // Link the original absence to this recovery
            appointments[appIndex].recoveryId = recoveryId;
            appointments.push(newAppointment);
        }
    }

    // Sort always to find the real end date
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

const calculateRemainingCounters = (enrollment: Enrollment, appointments: Appointment[]) => {
    const labCount = enrollment.labCount || 0;
    const sgCount = enrollment.sgCount || 0;
    const evtCount = enrollment.evtCount || 0;
    const readCount = enrollment.readCount || 0;

    const labAttended = appointments.filter(a => (a.type === 'LAB' || !a.type) && a.status === 'Present').length;
    const sgAttended = appointments.filter(a => a.type === 'SG' && a.status === 'Present').length;
    const evtAttended = appointments.filter(a => a.type === 'EVT' && a.status === 'Present').length;
    const readAttended = appointments.filter(a => a.type === 'READ' && a.status === 'Present').length;

    const totalAttended = appointments.filter(a => a.status === 'Present').length;

    return {
        lessonsRemaining: Math.max(0, enrollment.lessonsTotal - totalAttended),
        labRemaining: Math.max(0, labCount - labAttended),
        sgRemaining: Math.max(0, sgCount - sgAttended),
        evtRemaining: Math.max(0, evtCount - evtAttended),
        readRemaining: Math.max(0, readCount - readAttended)
    };
};

export const registerPresence = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (isNewArchitecture) {
        // NUOVA ARCHITETTURA: Aggiorna lo stato nell'array attendees della Lesson
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) throw new Error("Allievo non trovato nella lezione");
        if (attendees[attendeeIndex].status === 'Present') return;
        
        attendees[attendeeIndex].status = 'Present';
        
        await updateDoc(lessonRef, { attendees });
        return;
    }

    // VECCHIA ARCHITETTURA (Fallback)
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
    
    const newCounters = calculateRemainingCounters(enrollment, appointments);
    await updateDoc(enrollmentDocRef, { appointments, ...newCounters });
};

export const resetAppointmentStatus = async (enrollmentId: string, appointmentLessonId: string, isNewArchitecture?: boolean): Promise<void> => {
    if (isNewArchitecture) {
        // NUOVA ARCHITETTURA: Aggiorna lo stato nell'array attendees della Lesson
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) throw new Error("Allievo non trovato nella lezione");
        
        attendees[attendeeIndex].status = 'Scheduled';
        
        await updateDoc(lessonRef, { attendees });
        return;
    }

    // VECCHIA ARCHITETTURA (Fallback)
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
    if (isNewArchitecture) {
        // NUOVA ARCHITETTURA: Rimuovi l'allievo dall'array attendees della Lesson
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const newAttendees = attendees.filter(a => a.enrollmentId !== enrollmentId);
        
        await updateDoc(lessonRef, { attendees: newAttendees });
        return;
    }

    // VECCHIA ARCHITETTURA (Fallback)
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
    if (isNewArchitecture) {
        // NUOVA ARCHITETTURA: Aggiorna lo stato nell'array attendees della Lesson
        const lessonRef = doc(db, 'lessons', appointmentLessonId);
        const lessonSnap = await getDoc(lessonRef);
        if (!lessonSnap.exists()) throw new Error("Lezione non trovata");
        
        const lessonData = lessonSnap.data() as Lesson;
        const attendees = lessonData.attendees || [];
        const attendeeIndex = attendees.findIndex(a => a.enrollmentId === enrollmentId);
        
        if (attendeeIndex === -1) throw new Error("Allievo non trovato nella lezione");
        
        const currentStatus = attendees[attendeeIndex].status;
        if (currentStatus === 'Present') {
            attendees[attendeeIndex].status = 'Absent';
        } else if (currentStatus === 'Absent') {
            attendees[attendeeIndex].status = 'Present';
        } else if (currentStatus === 'Scheduled') {
            attendees[attendeeIndex].status = 'Present';
        }
        
        await updateDoc(lessonRef, { attendees });
        return;
    }

    // VECCHIA ARCHITETTURA (Fallback)
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    const enrollment = enrollmentSnap.data() as Enrollment;
    const appointments = [...(enrollment.appointments || [])];
    const appIndex = appointments.findIndex(a => a.lessonId === appointmentLessonId);
    if (appIndex === -1) throw new Error("Lezione non trovata");
    const currentStatus = appointments[appIndex].status;
    
    if (currentStatus === 'Present') {
        appointments[appIndex].status = 'Absent';
    } else if (currentStatus === 'Absent') {
        appointments[appIndex].status = 'Present';
    } else if (currentStatus === 'Scheduled') {
        appointments[appIndex].status = 'Present';
    }

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

// --- MIGRAZIONE STORICA (Carnet & Tipi Slot) ---
export const migrateHistoricalEnrollments = async (): Promise<{ updated: number, errors: number }> => {
    const snapshot = await getDocs(getEnrollmentCollectionRef());
    let updatedCount = 0;
    let errorCount = 0;

    const batch = writeBatch(db);
    let batchSize = 0;

    for (const docSnap of snapshot.docs) {
        try {
            const enr = docSnap.data() as Enrollment;
            const appointments = [...(enr.appointments || [])];
            let modified = false;
            const newApps = appointments.map(app => {
                const appDate = app.date.split('T')[0];
                let type = app.type || 'LAB'; // Default Rule D: Tutto LAB prima del 6 Feb 2026

                // Regola B: Istituzionali
                if (enr.clientType === ClientType.Institutional || enr.isQuoteBased) {
                    type = 'INST';
                } 
                // Regola A: Evento 22 Febbraio 2026
                else if (appDate === '2026-02-22') {
                    type = 'EVT';
                }
                // Regola C: Carnet Febbraio 2026 (Specifici Slot SG)
                else if (appDate === '2026-02-21' && app.startTime === '09:30' && app.endTime === '12:30') {
                    type = 'SG';
                }
                else if (appDate === '2026-02-28' && app.startTime === '09:30' && app.endTime === '12:30') {
                    type = 'SG';
                }
                // Regola C: Carnet Febbraio 2026 (Specifici Slot LAB)
                else if ((appDate === '2026-02-07' || appDate === '2026-02-14') && app.startTime === '10:00' && app.endTime === '11:00') {
                    type = 'LAB';
                }
                // Regola D: Storico (Già coperto dal default 'LAB' sopra, ma esplicitiamo per chiarezza)
                else if (new Date(appDate) <= new Date('2026-02-06')) {
                    type = 'LAB';
                }

                if (app.type !== type) {
                    modified = true;
                    return { ...app, type };
                }
                return app;
            });

            // Ricalcolo Contatori
            const labCount = newApps.filter(a => a.type === 'LAB').length;
            const sgCount = newApps.filter(a => a.type === 'SG').length;
            const evtCount = newApps.filter(a => a.type === 'EVT').length;
            const readCount = newApps.filter(a => a.type === 'READ').length;

            const labAttended = newApps.filter(a => a.type === 'LAB' && a.status === 'Present').length;
            const sgAttended = newApps.filter(a => a.type === 'SG' && a.status === 'Present').length;
            const evtAttended = newApps.filter(a => a.type === 'EVT' && a.status === 'Present').length;
            const readAttended = newApps.filter(a => a.type === 'READ' && a.status === 'Present').length;

            // Update if appointments changed or if carnet counts are missing
            const needsUpdate = modified || enr.labCount === undefined || enr.sgCount === undefined || enr.evtCount === undefined || enr.readCount === undefined;

            if (needsUpdate) {
                const updateData: Record<string, unknown> = {
                    appointments: newApps,
                    labCount,
                    sgCount,
                    evtCount,
                    readCount,
                    labRemaining: Math.max(0, labCount - labAttended),
                    sgRemaining: Math.max(0, sgCount - sgAttended),
                    evtRemaining: Math.max(0, evtCount - evtAttended),
                    readRemaining: Math.max(0, readCount - readAttended)
                };

                batch.update(docSnap.ref, updateData);
                batchSize++;
                updatedCount++;
            }

            // Commit periodico per evitare limiti di batch di Firestore (500)
            if (batchSize >= 400) {
                await batch.commit();
                batchSize = 0;
            }
        } catch (e) {
            console.error(`Error migrating enrollment ${docSnap.id}:`, e instanceof Error ? e.message : e);
            errorCount++;
        }
    }

    if (batchSize > 0) {
        await batch.commit();
    }

    return { updated: updatedCount, errors: errorCount };
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

    // Align start date to the correct day of week
    const currentDate = new Date(enrollment.startDate);
    while (currentDate.getDay() !== dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    let labUsed = 0;
    let sgUsed = 0;
    let finalEndDate = enrollment.endDate;
    let appointments: Appointment[] = [];

    if (enrollment.courseId) {
        // NUOVA ARCHITETTURA: Prenotazione nelle LessonSession esistenti
        const bookingResult = await bookStudentIntoCourseLessons(
            enrollmentId,
            enrollment.courseId,
            enrollment.clientId,
            enrollment.childId,
            enrollment.childName,
            currentDate.toISOString(),
            enrollment.lessonsTotal,
            {
                lab: enrollment.labCount,
                sg: enrollment.sgCount,
                evt: enrollment.evtCount,
                read: enrollment.readCount
            }
        );
        
        labUsed = bookingResult.labUsed;
        sgUsed = bookingResult.sgUsed;
        finalEndDate = bookingResult.finalEndDate;

        // RECUPERO LEZIONI PER POPOLARE APPOINTMENTS (Cache per UI)
        const lessonsRef = collection(db, 'lessons');
        const q = query(
            lessonsRef,
            where('courseId', '==', enrollment.courseId)
        );
        const snap = await getDocs(q);
        
        // Filtriamo e ordiniamo in memoria per evitare indici compositi
        const startDateStr = currentDate.toISOString();
        const bookedLessons = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Lesson))
            .filter(l => l.date >= startDateStr && (l.attendees || []).some(a => a.enrollmentId === enrollmentId))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, enrollment.lessonsTotal);

        const now = new Date();
        appointments = bookedLessons.map(l => {
            const attendee = l.attendees?.find(a => a.enrollmentId === enrollmentId);
            let status = (attendee?.status as AppointmentStatus) || AppointmentStatus.Scheduled;
            
            // Distinguiamo correttamente: se la lezione è passata e l'allievo è appena stato aggiunto (Scheduled),
            // lo marchiamo come Absent per non falsare i crediti residui, a meno che non sia oggi.
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
    } else {
        // FALLBACK VECCHIA ARCHITETTURA (per iscrizioni custom senza corso)
        appointments = generateTheoreticalAppointments(
            currentDate.toISOString(),
            enrollment.lessonsTotal,
            locationId,
            locationName,
            locationColor,
            startTime,
            endTime,
            enrollment.childName,
            comboConfigs,
            weeklyPlan
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
        appointments: appointments, // Sarà vuoto per i corsi, pieno per i custom
        labUsed: labUsed,
        sgUsed: sgUsed,
        labRemaining: (enrollment.labCount || 0) - labUsed,
        sgRemaining: (enrollment.sgCount || 0) - sgUsed,
        startDate: currentDate.toISOString(), 
        endDate: finalEndDate,
        status: EnrollmentStatus.Active
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
    // CRITICAL: Usa toLocalISOString o split per evitare shift di fuso orario
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

    // Process Manual Lessons
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

export const restoreSuspendedLessons = async (closureDate: string): Promise<void> => {
    const batch = writeBatch(db);
    // CRITICAL FIX: Assicuriamoci di comparare solo la parte data YYYY-MM-DD
    // closureDate deve arrivare come YYYY-MM-DD o ISO string
    const targetDateStr = closureDate.split('T')[0];

    // 1. Process Enrollments (Revert Suspended -> Scheduled)
    const enrollmentsSnapshot = await getDocs(getEnrollmentCollectionRef());
    enrollmentsSnapshot.docs.forEach(docSnap => {
        const enr = docSnap.data() as Enrollment;
        if (enr.appointments && enr.appointments.length > 0) {
            let modified = false;
            const newApps = enr.appointments.map(app => {
                const appDateStr = app.date.split('T')[0];
                // Compare loose date
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

    // 2. Process Manual Lessons (Remove [SOSPESO])
    const lessonsCollectionRef = collection(db, 'lessons');
    const lessonsSnapshot = await getDocs(lessonsCollectionRef);
    lessonsSnapshot.docs.forEach(docSnap => {
        const lesson = docSnap.data() as Lesson;
        const lessonDateStr = lesson.date.split('T')[0];
        if (lessonDateStr === targetDateStr) {
            if (lesson.description.startsWith('[SOSPESO]')) {
                const restoredDesc = lesson.description.replace('[SOSPESO] ', '').replace('[SOSPESO]', '').trim();
                batch.update(docSnap.ref, { description: restoredDesc });
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

export const autoFixEnrollments = async (): Promise<{ fixed: number, total: number }> => {
    console.log("[Auto-Fix] Avvio scansione iscrizioni problematiche...");
    const snapshot = await getDocs(getEnrollmentCollectionRef());
    const allEnrollments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment));
    
    const problematic = allEnrollments.filter(e => {
        const hasNoApps = !e.appointments || e.appointments.length === 0;
        const hasND = e.appointments?.[0]?.startTime === 'N/D';
        const isPending = e.status === EnrollmentStatus.Pending;
        
        return (isPending || hasNoApps || hasND) &&
               e.status !== EnrollmentStatus.Completed &&
               e.status !== EnrollmentStatus.Expired;
    });

    console.log(`[Auto-Fix] Trovate ${problematic.length} iscrizioni potenzialmente da sanare.`);
    if (problematic.length === 0) return { fixed: 0, total: 0 };

    const courses = await getOpenCourses();
    const locations = await getLocations();
    const suppliers = await getSuppliers();

    let fixedCount = 0;

    for (const enr of problematic) {
        try {
            let courseId = enr.courseId;
            const locationId = enr.locationId;
            
            // 1. Try to find a course if missing
            if ((!courseId || courseId === 'manual') && locationId && locationId !== 'unassigned') {
                const startDate = new Date(enr.startDate);
                if (!isNaN(startDate.getTime())) {
                    const dayOfWeek = startDate.getDay();
                    let matchingCourse = courses.find(c => 
                        c.locationId === locationId && 
                        c.dayOfWeek === dayOfWeek
                    );
                    
                    // Fallback: se non c'è match esatto sul giorno, cerchiamo il primo corso disponibile in quella sede
                    if (!matchingCourse) {
                        matchingCourse = courses.find(c => c.locationId === locationId);
                    }

                    if (matchingCourse) {
                        courseId = matchingCourse.id;
                    }
                }
            }

            // 2. If we have a courseId or enough info, activate it
            if (courseId && courseId !== 'manual') {
                const course = courses.find(c => c.id === courseId);
                if (course) {
                    const location = locations.find(l => l.id === course.locationId);
                    const supplier = suppliers.find(s => s.id === location?.supplierId);

                    await activateEnrollmentWithLocation(
                        enr.id,
                        location?.supplierId || enr.supplierId || 'unassigned',
                        supplier?.companyName || enr.supplierName || '',
                        course.locationId,
                        location?.name || enr.locationName || 'Sede',
                        location?.color || enr.locationColor || '#ccc',
                        course.dayOfWeek,
                        course.startTime,
                        course.endTime
                    );
                    fixedCount++;
                }
            } else if (locationId && locationId !== 'unassigned') {
                // Fallback for manual without course but with location
                // We need a time. If missing, we use a default or try to infer.
                const startTime = '16:00';
                const endTime = '18:00';
                const dayOfWeek = new Date(enr.startDate).getDay();
                
                await activateEnrollmentWithLocation(
                    enr.id,
                    enr.supplierId || 'unassigned',
                    enr.supplierName || '',
                    locationId,
                    enr.locationName || 'Sede',
                    enr.locationColor || '#ccc',
                    dayOfWeek,
                    startTime,
                    endTime
                );
                fixedCount++;
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Error auto-fixing enrollment ${enr.id}:`, msg);
        }
    }

    return { fixed: fixedCount, total: problematic.length };
};
