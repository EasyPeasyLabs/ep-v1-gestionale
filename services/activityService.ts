import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { Activity, ActivityInput, LessonActivity } from '../types';

// --- Activities (Libreria) ---
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


// --- Lesson Activities (Storico/Registro) ---
const lessonActivityCollectionRef = collection(db, 'lesson_activities');

export const getLessonActivities = async (lessonIds: string[]): Promise<LessonActivity[]> => {
    if (lessonIds.length === 0) return [];
    // Firestore "in" query is limited to 10. Se > 10, bisogna fare chunking o prendere tutto e filtrare.
    // Per semplicità e volume dati previsto, prendiamo tutto per ora (o filtriamo per data se avessimo campo data indicizzato)
    // Qui facciamo una query semplice e filtriamo in memoria per semplicità implementation.
    
    const snapshot = await getDocs(lessonActivityCollectionRef);
    const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonActivity));
    return all.filter(la => lessonIds.includes(la.lessonId));
};

export const saveLessonActivities = async (lessonIds: string[], activityIds: string[], date: string): Promise<void> => {
    const batch = writeBatch(db);
    
    // 1. Troviamo se esistono già entry per queste lezioni (per aggiornarle invece di duplicarle)
    const existingSnapshot = await getDocs(lessonActivityCollectionRef);
    const existingMap = new Map<string, string>(); // lessonId -> docId
    existingSnapshot.docs.forEach(d => {
        const data = d.data() as LessonActivity;
        existingMap.set(data.lessonId, d.id);
    });

    lessonIds.forEach(lessonId => {
        const docId = existingMap.get(lessonId);
        if (docId) {
            // Update existing
            const ref = doc(db, 'lesson_activities', docId);
            batch.update(ref, { activityIds: activityIds });
        } else {
            // Create new
            const ref = doc(lessonActivityCollectionRef);
            batch.set(ref, {
                lessonId,
                activityIds,
                date
            });
        }
    });

    await batch.commit();
};