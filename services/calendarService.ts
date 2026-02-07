
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, writeBatch, query, where } from '@firebase/firestore';
import { Lesson, LessonInput, SchoolClosure } from '../types';

const lessonCollectionRef = collection(db, 'lessons');
const closuresCollectionRef = collection(db, 'school_closures');

const docToLesson = (doc: QueryDocumentSnapshot<DocumentData>): Lesson => {
    const data = doc.data();
    return { id: doc.id, ...data } as Lesson;
};

export const getLessons = async (): Promise<Lesson[]> => {
    const snapshot = await getDocs(lessonCollectionRef);
    return snapshot.docs.map(docToLesson);
};

export const addLesson = async (lessonItem: LessonInput): Promise<string> => {
    const docRef = await addDoc(lessonCollectionRef, lessonItem);
    return docRef.id;
};

export const addLessonsBatch = async (lessons: LessonInput[]): Promise<string[]> => {
    const batch = writeBatch(db);
    const ids: string[] = [];
    
    lessons.forEach(lesson => {
        const lessonRef = doc(lessonCollectionRef);
        batch.set(lessonRef, lesson);
        ids.push(lessonRef.id);
    });
    
    await batch.commit();
    return ids;
};

export const updateLesson = async (id: string, lessonItem: Partial<LessonInput>): Promise<void> => {
    const lessonDoc = doc(db, 'lessons', id);
    await updateDoc(lessonDoc, lessonItem);
};

export const deleteLesson = async (id: string): Promise<void> => {
    const lessonDoc = doc(db, 'lessons', id);
    await deleteDoc(lessonDoc);
};

// --- SCHOOL CLOSURES ---

export const getSchoolClosures = async (): Promise<SchoolClosure[]> => {
    const snapshot = await getDocs(closuresCollectionRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SchoolClosure));
};

export const addSchoolClosure = async (date: string, reason: string): Promise<string> => {
    const docRef = await addDoc(closuresCollectionRef, { date, reason, createdAt: new Date().toISOString() });
    return docRef.id;
};

export const deleteSchoolClosure = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'school_closures', id));
};