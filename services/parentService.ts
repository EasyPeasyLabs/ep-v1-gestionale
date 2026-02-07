
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Client, ClientInput, ClientType, ParentClient, InstitutionalClient } from '../types';

const clientCollectionRef = collection(db, 'clients');

const docToClient = (doc: QueryDocumentSnapshot<DocumentData>): Client => {
    const data = doc.data();
    // Inizializza l'oggetto base. Cast a 'any' temporaneo per flessibilità nel mapping.
    const client = { id: doc.id, ...data } as any;
    
    // 1. NORMALIZZAZIONE TIPO CLIENTE (Inferenza)
    // Se clientType manca, proviamo a dedurlo dai dati presenti
    if (!client.clientType) {
        if (client.type === 'parent' || client.type === 'institutional') {
            // Supporto legacy per campo 'type'
            client.clientType = client.type;
        } else if (client.firstName || client.lastName || client.taxCode || (client.children && client.children.length > 0)) {
            // Se ha nome, cognome, CF o figli, è sicuramente un Genitore
            client.clientType = ClientType.Parent;
        } else if (client.companyName || client.vatNumber) {
            // Se ha ragione sociale o P.IVA, è un Ente
            client.clientType = ClientType.Institutional;
        } else {
            // Fallback: se ha solo 'name' generico, assumiamo Genitore per default
            client.clientType = ClientType.Parent;
        }
    }

    // 2. SANITIZZAZIONE DATI (Prevenzione Campi Vuoti)
    if (client.clientType === ClientType.Parent) {
        const parent = client as ParentClient;
        
        // Mappatura fallback per nomi
        parent.firstName = parent.firstName || data.name || ''; // Usa 'name' se firstName manca
        parent.lastName = parent.lastName || '';
        
        parent.email = parent.email || '';
        parent.phone = parent.phone || '';
        parent.address = parent.address || '';
        
        // Gestione Array Figli
        if (!Array.isArray(parent.children)) {
            parent.children = [];
        } else {
            // Mappa e pulisce ogni figlio
            parent.children = parent.children.map((c: any) => ({
                id: c.id || Date.now().toString() + Math.random(),
                name: c.name || 'Senza Nome',
                age: c.age || '',
                dateOfBirth: c.dateOfBirth || undefined, // Mappatura nuovo campo opzionale
                notes: c.notes || '',
                notesHistory: Array.isArray(c.notesHistory) ? c.notesHistory : [],
                tags: Array.isArray(c.tags) ? c.tags : [],
                rating: c.rating || { learning: 0, behavior: 0, attendance: 0, hygiene: 0 }
            }));
        }
        
        // Valori di default
        if (!parent.rating) parent.rating = { availability: 0, complaints: 0, churnRate: 0, distance: 0 };
        
    } else {
        // Gestione Enti
        const inst = client as InstitutionalClient;
        inst.companyName = inst.companyName || data.name || 'Ente Senza Nome'; // Usa 'name' come fallback
        inst.vatNumber = inst.vatNumber || '';
        inst.email = inst.email || '';
        inst.phone = inst.phone || '';
    }
    
    // Campi comuni sicuri
    client.notesHistory = Array.isArray(client.notesHistory) ? client.notesHistory : [];
    client.tags = Array.isArray(client.tags) ? client.tags : [];
    
    return client as Client;
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
