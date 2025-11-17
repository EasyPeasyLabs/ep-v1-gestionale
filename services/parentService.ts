
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Client, ClientInput } from '../types';

// La collezione su Firestore dovrebbe essere rinominata da 'parents' a 'clients'
const clientCollectionRef = collection(db, 'clients');

const docToClient = (doc: QueryDocumentSnapshot<DocumentData>): Client => {
    const data = doc.data();
    // È necessario un cast perché Firestore non conosce i tipi unione di TypeScript.
    // L'oggetto 'data' dovrebbe contenere il campo 'clientType' per la differenziazione.
    return { id: doc.id, ...data } as Client;
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
    // Firestore non permette di passare 'undefined' nei dati di aggiornamento.
    // Questa riga pulisce l'oggetto client da eventuali chiavi con valore undefined.
    const updateData = Object.fromEntries(Object.entries(client).filter(([_, v]) => v !== undefined));
    await updateDoc(clientDoc, updateData);
};

export const deleteClient = async (id: string): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await deleteDoc(clientDoc);
};