import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { ScheduledClass, ScheduledClassInput } from '../types';

const classCollectionRef = collection(db, 'scheduledClasses');

const docToClass = (doc: QueryDocumentSnapshot<DocumentData>): ScheduledClass => {
    const data = doc.data();
    return { id: doc.id, ...data } as ScheduledClass;
};

export const getScheduledClasses = async (): Promise<ScheduledClass[]> => {
    const snapshot = await getDocs(classCollectionRef);
    return snapshot.docs.map(docToClass);
};

export const addScheduledClass = async (classItem: ScheduledClassInput): Promise<string> => {
    const docRef = await addDoc(classCollectionRef, classItem);
    return docRef.id;
};

export const updateScheduledClass = async (id: string, classItem: Partial<ScheduledClassInput>): Promise<void> => {
    const classDoc = doc(db, 'scheduledClasses', id);
    await updateDoc(classDoc, classItem);
};

export const deleteScheduledClass = async (id: string): Promise<void> => {
    const classDoc = doc(db, 'scheduledClasses', id);
    await deleteDoc(classDoc);
};
