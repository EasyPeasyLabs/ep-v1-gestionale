
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Parent, ParentInput } from '../types';

const parentCollectionRef = collection(db, 'parents');

const docToParent = (doc: QueryDocumentSnapshot<DocumentData>): Parent => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        children: data.children || [],
        subscriptions: data.subscriptions || [],
    };
};

export const getParents = async (): Promise<Parent[]> => {
    const querySnapshot = await getDocs(parentCollectionRef);
    return querySnapshot.docs.map(docToParent);
};

export const addParent = async (parent: ParentInput): Promise<string> => {
    const docRef = await addDoc(parentCollectionRef, parent);
    return docRef.id;
};

export const updateParent = async (id: string, parent: Partial<ParentInput>): Promise<void> => {
    const parentDoc = doc(db, 'parents', id);
    await updateDoc(parentDoc, parent);
};

export const deleteParent = async (id: string): Promise<void> => {
    const parentDoc = doc(db, 'parents', id);
    await deleteDoc(parentDoc);
};
