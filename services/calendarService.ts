import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, writeBatch } from 'firebase/firestore';
import { Lesson, LessonInput } from '../types';

const lessonCollectionRef = collection(db, 'lessons');

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

export const addLessonsBatch = async (lessons: LessonInput[]): Promise<void> => {
    const batch = writeBatch(db);
    lessons.forEach(lesson => {
        const lessonRef = doc(lessonCollectionRef);
        batch.set(lessonRef, lesson);
    });
    await batch.commit();
};

export const updateLesson = async (id: string, lessonItem: Partial<LessonInput>): Promise<void> => {
    const lessonDoc = doc(db, 'lessons', id);
    await updateDoc(lessonDoc, lessonItem);
};

export const deleteLesson = async (id: string): Promise<void> => {
    const lessonDoc = doc(db, 'lessons', id);
    await deleteDoc(lessonDoc);
};