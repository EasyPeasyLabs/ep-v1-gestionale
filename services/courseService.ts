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
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { Course, CourseInput, Location } from '../types';

const COURSES_COLLECTION = 'courses';
const LOCATIONS_COLLECTION = 'locations';

export const getLocations = async (): Promise<Location[]> => {
    const q = query(collection(db, LOCATIONS_COLLECTION), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
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
        where('locationId', '==', locationId),
        orderBy('dayOfWeek', 'asc'),
        orderBy('startTime', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
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
