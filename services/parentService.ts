
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from '@firebase/firestore';
import { Client, ClientInput, ClientType, ParentClient } from '../types';

const clientCollectionRef = collection(db, 'clients');

const docToClient = (doc: QueryDocumentSnapshot<DocumentData>): Client => {
    const data = doc.data();
    const client = { id: doc.id, ...data } as Client;
    
    // Assicura che `children` sia sempre un array e abbia i nuovi campi
    if (client.clientType === ClientType.Parent) {
        const parent = client as ParentClient;
        
        if (!parent.children) {
            parent.children = [];
        } else {
            // Map existing children to new structure with defaults if missing
            parent.children = parent.children.map((c: any) => ({
                ...c,
                notes: c.notes || '',
                notesHistory: c.notesHistory || [],
                tags: c.tags || [],
                rating: c.rating || {
                    learning: 0,
                    behavior: 0,
                    attendance: 0,
                    hygiene: 0
                }
            }));
        }
        
        // Default values for new Parent fields (safety check)
        if (!parent.notes) parent.notes = '';
        if (!parent.notesHistory) parent.notesHistory = [];
        if (!parent.tags) parent.tags = [];
        if (!parent.rating) {
            parent.rating = {
                availability: 0,
                complaints: 0,
                churnRate: 0,
                distance: 0
            };
        }
    }
    
    return client;
};

export const getClients = async (): Promise<Client[]> => {
    const querySnapshot = await getDocs(clientCollectionRef);
    return querySnapshot.docs.map(docToClient);
};

export const addClient = async (client: ClientInput): Promise<string> => {
    const docRef = await addDoc(clientCollectionRef, { ...client, isDeleted: false });
    return docRef.id;
};

export const updateClient = async (id: string, client: Partial<ClientInput>): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await updateDoc(clientDoc, client);
};

// Soft Delete: sposta nel cestino
export const deleteClient = async (id: string): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await updateDoc(clientDoc, { isDeleted: true });
};

// Ripristina dal cestino
export const restoreClient = async (id: string): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await updateDoc(clientDoc, { isDeleted: false });
};

// Hard Delete: elimina fisicamente
export const permanentDeleteClient = async (id: string): Promise<void> => {
    const clientDoc = doc(db, 'clients', id);
    await deleteDoc(clientDoc);
};
