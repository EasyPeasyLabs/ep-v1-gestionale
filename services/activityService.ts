
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy } from '@firebase/firestore';
import { Activity, ActivityInput } from '../types';

const activityCollectionRef = collection(db, 'activities');

const docToActivity = (doc: QueryDocumentSnapshot<DocumentData>): Activity => {
    const data = doc.data();
    return { id: doc.id, ...data } as Activity;
};

export const getActivities = async (): Promise<Activity[]> => {
    const q = query(activityCollectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToActivity);
};

export const addActivity = async (activity: ActivityInput): Promise<string> => {
    // Aggiunge timestamp di creazione se non fornito
    const activityWithTimestamp = {
        ...activity,
        createdAt: activity.createdAt || new Date().toISOString()
    };
    const docRef = await addDoc(activityCollectionRef, activityWithTimestamp);
    return docRef.id;
};

export const updateActivity = async (id: string, activity: Partial<ActivityInput>): Promise<void> => {
    const activityDoc = doc(db, 'activities', id);
    await updateDoc(activityDoc, activity);
};

export const deleteActivity = async (id: string): Promise<void> => {
    const activityDoc = doc(db, 'activities', id);
    await deleteDoc(activityDoc);
};
