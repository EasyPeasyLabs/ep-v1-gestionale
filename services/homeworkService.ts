
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy } from '@firebase/firestore';
import { Homework, HomeworkInput } from '../types';

const homeworkCollectionRef = collection(db, 'homeworks');

const docToHomework = (doc: QueryDocumentSnapshot<DocumentData>): Homework => {
    const data = doc.data();
    return { id: doc.id, ...data } as Homework;
};

export const getHomeworks = async (): Promise<Homework[]> => {
    // Ordiniamo per data creazione descrescente di default
    const q = query(homeworkCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToHomework);
};

export const addHomework = async (homework: HomeworkInput): Promise<string> => {
    const homeworkWithTimestamp = {
        ...homework,
        createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(homeworkCollectionRef, homeworkWithTimestamp);
    return docRef.id;
};

export const updateHomework = async (id: string, homework: Partial<HomeworkInput>): Promise<void> => {
    const docRef = doc(db, 'homeworks', id);
    await updateDoc(docRef, homework);
};

export const deleteHomework = async (id: string): Promise<void> => {
    const docRef = doc(db, 'homeworks', id);
    await deleteDoc(docRef);
};