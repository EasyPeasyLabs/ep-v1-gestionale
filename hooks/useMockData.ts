import { useState, useCallback, useEffect } from 'react';
import { db } from '../firebaseConfig';
import type { Cliente, Fornitore, Sede, Laboratorio, Attivita, Materiale, MovimentoFinance, Documento, PropostaCommerciale, InterazioneCRM } from '../types';

export function useMockData() {
    const [clienti, setClienti] = useState<Cliente[]>([]);
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [laboratori, setLaboratori] = useState<Laboratorio[]>([]);
    const [attivita, setAttivita] = useState<Attivita[]>([]);
    const [materiali, setMateriali] = useState<Materiale[]>([]);
    const [movimenti, setMovimenti] = useState<MovimentoFinance[]>([]);
    const [documenti, setDocumenti] = useState<Documento[]>([]);
    const [proposte, setProposte] = useState<PropostaCommerciale[]>([]);
    const [interazioni, setInterazioni] = useState<InterazioneCRM[]>([]);

    useEffect(() => {
        const createSubscription = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderField?: string) => {
            // FIX: Use v8 syntax for queries
            const collRef = db.collection(collectionName);
            const q = orderField ? collRef.orderBy(orderField, 'desc') : collRef;
            
            const unsubscribe = q.onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setter(data);
            });
            return unsubscribe;
        };

        const unsubClienti = createSubscription('clienti', setClienti, 'lastModified');
        const unsubFornitori = createSubscription('fornitori', setFornitori);
        const unsubLaboratori = createSubscription('laboratori', setLaboratori);
        const unsubAttivita = createSubscription('attivita', setAttivita);
        const unsubMateriali = createSubscription('materiali', setMateriali);
        const unsubMovimenti = createSubscription('movimenti', setMovimenti, 'data');
        const unsubDocumenti = createSubscription('documenti', setDocumenti, 'dataCreazione');
        const unsubProposte = createSubscription('proposte', setProposte, 'dataEmissione');
        const unsubInterazioni = createSubscription('interazioni', setInterazioni, 'data');

        return () => {
            unsubClienti();
            unsubFornitori();
            unsubLaboratori();
            unsubAttivita();
            unsubMateriali();
            unsubMovimenti();
            unsubDocumenti();
            unsubProposte();
            unsubInterazioni();
        };
    }, []);

    // Generic CRUD helpers
    const addDocument = useCallback(async (collectionName: string, data: object) => {
        // FIX: Use v8 syntax for adding documents
        await db.collection(collectionName).add(data);
    }, []);

    const updateDocument = useCallback(async (collectionName: string, id: string, data: object) => {
        // FIX: Use v8 syntax for updating documents
        const docRef = db.collection(collectionName).doc(id);
        await docRef.update(data);
    }, []);

    const deleteDocument = useCallback(async (collectionName: string, id: string) => {
        try {
            // FIX: Use v8 syntax for deleting documents
            await db.collection(collectionName).doc(id).delete();
        } catch (error) {
            console.error("Errore durante l'eliminazione del documento: ", error);
            alert(`Impossibile eliminare l'elemento. Causa: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Controlla le regole di sicurezza di Firestore o la console per maggiori dettagli.`);
        }
    }, []);


    // Clienti CRUD
    const addCliente = useCallback((cliente: Omit<Cliente, 'id'>) => {
        const clienteWithTimestamp = { ...cliente, lastModified: new Date().toISOString() };
        addDocument('clienti', clienteWithTimestamp);
    }, [addDocument]);
    
    const updateCliente = useCallback((updatedCliente: Cliente) => {
        const { id, ...data } = updatedCliente;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('clienti', id, dataWithTimestamp);
    }, [updateDocument]);
    
    const deleteCliente = useCallback((clienteId: string) => deleteDocument('clienti', clienteId), [deleteDocument]);
    
    // Fornitori CRUD
    const addFornitore = useCallback((fornitore: Omit<Fornitore, 'id' | 'sedi'>) => addDocument('fornitori', {...fornitore, sedi: []}), [addDocument]);
    const updateFornitore = useCallback((updatedFornitore: Fornitore) => {
         const { id, ...data } = updatedFornitore;
         updateDocument('fornitori', id, data);
    }, [updateDocument]);
    const deleteFornitore = useCallback((fornitoreId: string) => deleteDocument('fornitori', fornitoreId), [deleteDocument]);

    // Sedi CRUD
    const addSede = useCallback(async (fornitoreId: string, sede: Omit<Sede, 'id'|'fornitoreId'>) => {
        const newSede: Sede = { ...sede, id: `sede_${Date.now()}`, fornitoreId };
        // FIX: Use v8 syntax to get and update document
        const fornitoreRef = db.collection('fornitori').doc(fornitoreId);
        const fornitoreSnap = await fornitoreRef.get();
        if (fornitoreSnap.exists) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            await fornitoreRef.update({ sedi: [...(fornitoreData.sedi || []), newSede] });
        }
    }, []);
    const updateSede = useCallback(async (fornitoreId: string, updatedSede: Sede) => {
        // FIX: Use v8 syntax to get and update document
        const fornitoreRef = db.collection('fornitori').doc(fornitoreId);
        const fornitoreSnap = await fornitoreRef.get();
        if (fornitoreSnap.exists) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            const updatedSedi = fornitoreData.sedi.map(s => s.id === updatedSede.id ? updatedSede : s);
            await fornitoreRef.update({ sedi: updatedSedi });
        }
    }, []);
    const deleteSede = useCallback(async (fornitoreId: string, sedeId: string) => {
       // FIX: Use v8 syntax to get and update document
       const fornitoreRef = db.collection('fornitori').doc(fornitoreId);
        const fornitoreSnap = await fornitoreRef.get();
        if (fornitoreSnap.exists) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            const updatedSedi = fornitoreData.sedi.filter(s => s.id !== sedeId);
            await fornitoreRef.update({ sedi: updatedSedi });
        }
    }, []);

    // Laboratori CRUD
    const addLaboratorio = useCallback((lab: Omit<Laboratorio, 'id'>) => addDocument('laboratori', lab), [addDocument]);
    const updateLaboratorio = useCallback((updatedLab: Laboratorio) => {
        const { id, ...data } = updatedLab;
        updateDocument('laboratori', id, data);
    }, [updateDocument]);
    const deleteLaboratorio = useCallback((labId: string) => deleteDocument('laboratori', labId), [deleteDocument]);

    // Attivita CRUD
    const addAttivita = useCallback((act: Omit<Attivita, 'id'>) => addDocument('attivita', act), [addDocument]);
    const updateAttivita = useCallback((updatedAct: Attivita) => {
        const { id, ...data } = updatedAct;
        updateDocument('attivita', id, data);
    }, [updateDocument]);
    const deleteAttivita = useCallback((actId: string) => deleteDocument('attivita', actId), [deleteDocument]);
    
    // Materiali CRUD
    const addMateriale = useCallback((mat: Omit<Materiale, 'id'>) => addDocument('materiali', mat), [addDocument]);
    const updateMateriale = useCallback((updatedMat: Materiale) => {
        const { id, ...data } = updatedMat;
        updateDocument('materiali', id, data);
    }, [updateDocument]);
    const deleteMateriale = useCallback((matId: string) => deleteDocument('materiali', matId), [deleteDocument]);

    // Finance CRUD
    const addMovimento = useCallback((mov: Omit<MovimentoFinance, 'id'>) => addDocument('movimenti', mov), [addDocument]);
    const updateMovimento = useCallback((updatedMov: MovimentoFinance) => {
        const { id, ...data } = updatedMov;
        updateDocument('movimenti', id, data);
    }, [updateDocument]);
    const deleteMovimento = useCallback((movId: string) => deleteDocument('movimenti', movId), [deleteDocument]);

    // Documenti CRUD
    const addDocumento = useCallback((docData: Omit<Documento, 'id'>) => addDocument('documenti', docData), [addDocument]);
    const updateDocumento = useCallback((updatedDoc: Documento) => {
        const { id, ...data } = updatedDoc;
        updateDocument('documenti', id, data);
    }, [updateDocument]);
    const deleteDocumento = useCallback((docId: string) => deleteDocument('documenti', docId), [deleteDocument]);

    // Proposte CRUD
    const addProposta = useCallback((prop: Omit<PropostaCommerciale, 'id'>) => addDocument('proposte', prop), [addDocument]);
    const updateProposta = useCallback((updatedProp: PropostaCommerciale) => {
        const { id, ...data } = updatedProp;
        updateDocument('proposte', id, data);
    }, [updateDocument]);
    const deleteProposta = useCallback((propId: string) => deleteDocument('proposte', propId), [deleteDocument]);

    // Interazioni CRM CRUD
    const addInterazione = useCallback((int: Omit<InterazioneCRM, 'id'>) => addDocument('interazioni', int), [addDocument]);
    const updateInterazione = useCallback((updatedInt: InterazioneCRM) => {
        const { id, ...data } = updatedInt;
        updateDocument('interazioni', id, data);
    }, [updateDocument]);
    const deleteInterazione = useCallback((intId: string) => deleteDocument('interazioni', intId), [deleteDocument]);

    return {
        clienti, addCliente, updateCliente, deleteCliente,
        fornitori, addFornitore, updateFornitore, deleteFornitore,
        addSede, updateSede, deleteSede,
        laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio,
        attivita, addAttivita, updateAttivita, deleteAttivita,
        materiali, addMateriale, updateMateriale, deleteMateriale,
        movimenti, addMovimento, updateMovimento, deleteMovimento,
        documenti, addDocumento, updateDocumento, deleteDocumento,
        proposte, addProposta, updateProposta, deleteProposta,
        interazioni, addInterazione, updateInterazione, deleteInterazione,
    };
}