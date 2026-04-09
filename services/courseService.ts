import { db } from '../firebase/config';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { Course, CourseInput, Location, Lesson, RecurrenceConfig } from '../types';
import { isItalianHoliday } from '../utils/dateUtils';

const COURSES_COLLECTION = 'courses';
const LOCATIONS_COLLECTION = 'locations';
const LESSONS_COLLECTION = 'lessons';

export const getLocations = async (): Promise<Location[]> => {
    const q = query(collection(db, LOCATIONS_COLLECTION));
    const snapshot = await getDocs(q);
    
    const locs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Location))
        .filter(l => l.status !== 'closed');

    // Deduplicate by name and city to avoid visual duplicates in dropdowns
    const uniqueMap = new Map<string, Location>();
    locs.forEach(l => {
        const nameKey = (l.name || '').trim().toLowerCase();
        const cityKey = (l.city || '').trim().toLowerCase();
        const key = `${nameKey}_${cityKey}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, l);
        }
    });

    return Array.from(uniqueMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const getOpenCourses = async (): Promise<Course[]> => {
    const q = query(collection(db, COURSES_COLLECTION), where('status', '==', 'open'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
};

export const getCourseById = async (id: string): Promise<Course | null> => {
    const docRef = doc(db, COURSES_COLLECTION, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Course : null;
};

export const getCoursesByLocation = async (locationId: string): Promise<Course[]> => {
    const q = query(
        collection(db, COURSES_COLLECTION), 
        where('locationId', '==', locationId)
    );
    const snapshot = await getDocs(q);
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    
    // Sort in-memory to avoid composite index requirements
    return courses.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
    });
};

export const createCourse = async (course: CourseInput): Promise<string> => {
    const courseRef = doc(collection(db, COURSES_COLLECTION));
    await setDoc(courseRef, {
        ...course,
        activeEnrollmentsCount: 0,
        status: 'open',
        updatedAt: serverTimestamp()
    });
    return courseRef.id;
};

export const updateCourse = async (id: string, updates: Partial<Course>): Promise<void> => {
    const courseRef = doc(db, COURSES_COLLECTION, id);
    await updateDoc(courseRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteCourse = async (id: string): Promise<void> => {
    const courseRef = doc(db, COURSES_COLLECTION, id);
    await deleteDoc(courseRef);
};

export const toggleCourseStatus = async (id: string, currentStatus: 'open' | 'closed'): Promise<void> => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    await updateCourse(id, { status: newStatus });
};

/**
 * Verifica se una data è attiva in base alla configurazione di ricorrenza.
 */
export const isCourseActiveOnDate = (date: Date, config?: RecurrenceConfig): boolean => {
    if (!config) return true;

    if (config.type === 'monthly_pattern' && config.activeMonths) {
        const month = date.getMonth() + 1; // 1-12
        if (!config.activeMonths.includes(month)) return false;
    }

    if (config.blackoutPeriods) {
        const dateStr = date.toISOString().split('T')[0];
        for (const period of config.blackoutPeriods) {
            if (dateStr >= period.start && dateStr <= period.end) return false;
        }
    }

    return true;
};

/**
 * Controlla se ci sono iscrizioni attive in mesi che si stanno per disattivare.
 */
export const checkCourseConflicts = async (courseId: string, newActiveMonths: number[]): Promise<{ month: number, count: number }[]> => {
    const q = query(
        collection(db, 'enrollments'),
        where('courseId', '==', courseId),
        where('status', 'in', ['active', 'confirmed', 'pending'])
    );
    
    const snapshot = await getDocs(q);

    // Se non ci sono iscrizioni attive, non ci sono conflitti
    if (snapshot.empty) return [];

    const activeEnrollmentsCount = snapshot.size;
    const removedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => !newActiveMonths.includes(m));
    
    return removedMonths.map(m => ({ month: m, count: activeEnrollmentsCount }));
};

/**
 * Sincronizza le lezioni di un corso: elimina quelle future e le rigenera.
 */
export const syncCourseLessons = async (courseId: string, course: Course, locationName: string, locationColor: string): Promise<void> => {
    // 1. Elimina lezioni future per questo corso
    const now = new Date().toISOString();
    const q = query(
        collection(db, LESSONS_COLLECTION),
        where('courseId', '==', courseId),
        where('date', '>=', now)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
        // Eliminiamo solo se non ci sono presenze già segnate (attendees vuoti)
        // o se l'utente ha confermato l'impatto (gestito a monte)
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // 2. Rigenera lezioni
    await generateCourseLessons(courseId, course, locationName, locationColor);
};

/**
 * Genera le lezioni (scatole vuote) per un corso, basandosi sulle sue regole e sul periodo di validità.
 */
export const generateCourseLessons = async (courseId: string, course: Course, locationName: string, locationColor: string): Promise<void> => {
    if (!course.startDate || !course.endDate) {
        console.warn(`Impossibile generare lezioni per il corso ${courseId}: startDate o endDate mancanti.`);
        return;
    }

    const startObj = new Date(course.startDate);
    startObj.setHours(12, 0, 0, 0); // Evita problemi di fuso orario
    const endObj = new Date(course.endDate);
    endObj.setHours(12, 0, 0, 0);

    // Trova il primo giorno utile che corrisponde a dayOfWeek
    const current = new Date(startObj);
    while (current.getDay() !== course.dayOfWeek) {
        current.setDate(current.getDate() + 1);
    }

    const batch = writeBatch(db);
    let lessonsGenerated = 0;
    const MAX_LESSONS = 100; // Limite di sicurezza

    while (current <= endObj && lessonsGenerated < MAX_LESSONS) {
        if (!isItalianHoliday(current) && isCourseActiveOnDate(current, course.recurrenceConfig)) {
            let sTime = course.startTime;
            let eTime = course.endTime;
            let aType = course.slotType;
            let cap = course.capacity;

            if (course.slotType === 'LAB+SG' && course.comboConfigs && course.weeklyPlan) {
                const day = current.getDate();
                const weekNum = Math.ceil(day / 7);
                const plannedType = course.weeklyPlan[weekNum] || 'LAB';
                
                if (plannedType === 'LAB' && course.comboConfigs.LAB) {
                    sTime = course.comboConfigs.LAB.startTime;
                    eTime = course.comboConfigs.LAB.endTime;
                    aType = 'LAB';
                    cap = course.comboConfigs.LAB.capacity;
                } else if (plannedType === 'SG' && course.comboConfigs.SG) {
                    sTime = course.comboConfigs.SG.startTime;
                    eTime = course.comboConfigs.SG.endTime;
                    aType = 'SG';
                    cap = course.comboConfigs.SG.capacity;
                }
            }

            const lessonRef = doc(collection(db, LESSONS_COLLECTION));
            const lessonData: Lesson = {
                id: lessonRef.id,
                courseId: courseId,
                date: current.toISOString(),
                startTime: sTime,
                endTime: eTime,
                locationId: course.locationId,
                locationName: locationName,
                locationColor: locationColor,
                description: `Lezione ${aType}`,
                attendees: [],
                slotType: aType,
                maxCapacity: cap
            };

            batch.set(lessonRef, lessonData);
            lessonsGenerated++;
        }
        current.setDate(current.getDate() + 7);
    }

    if (lessonsGenerated > 0) {
        await batch.commit();
        console.log(`Generate ${lessonsGenerated} lezioni per il corso ${courseId}`);
    }
};
