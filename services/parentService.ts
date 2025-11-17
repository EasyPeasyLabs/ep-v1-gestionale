
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Client, ClientInput, ParentClient } from '../types';

const clientCollectionRef = collection(db, 'clients');

const docToClient = (doc: QueryDocumentSnapshot<DocumentData>): Client => {
    const data = doc.data();
    // FIX: Add 'any' type to baseClient to resolve property access errors on an object with a dynamic shape from Firestore.
    const baseClient: any = { id: doc.id, ...data };
    
    // Assicura che `children` sia sempre un array, anche se non presente in Firestore
    if (baseClient.clientType === 'Parent' && !baseClient.children) {
        baseClient.children = [];
    }
    
    return baseClient as Client;
};

export const getClients = async (): Promise<Client[]> => {
    const querySnapshot = await getDocs(clientCollectionRef);
    return querySnapshot.docs.map(docToClient);
};

export const addClient = async (client: ClientInput): Promise<string> => {
    const docRef = await addDoc(clientCollectionRef, client);
    return docRef.id;
};

export const updateClient = async (id: string, client: Partial<ClientInput>): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    const updateData = Object.fromEntries(Object.entries(client).filter(([_, v]) => v !== undefined));
    await updateDoc(clientDoc, updateData);
};

export const deleteClient = async (id: string): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await deleteDoc(clientDoc);
};
