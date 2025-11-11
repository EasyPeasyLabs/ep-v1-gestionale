
// FIX: Add React to imports to provide the React namespace for types.
import React, { useState, useCallback, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    getDoc
} from "firebase/firestore";
import type { Cliente, Fornitore, Sede, Laboratorio, Attivita, Materiale, MovimentoFinance, Documento, PropostaCommerciale, InterazioneCRM, TimeSlot, Durata, AttivitaTipoDef, Listino, Iscrizione } from '../types';

export function useMockData() {
    const [clienti, setClienti] = useState<Cliente[]>([]);
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [durate, setDurate] = useState<Durata[]>([]);
    const [laboratori, setLaboratori] = useState<Laboratorio[]>([]);
    const [listini, setListini] = useState<Listino[]>([]);
    const [iscrizioni, setIscrizioni] = useState<Iscrizione[]>([]);
    const [attivita, setAttivita] = useState<Attivita[]>([]);
    const [attivitaTipi, setAttivitaTipi] = useState<AttivitaTipoDef[]>([]);
    const [materiali, setMateriali] = useState<Materiale[]>([]);
    const [movimenti, setMovimenti] = useState<MovimentoFinance[]>([]);
    const [documenti, setDocumenti] = useState<Documento[]>([]);
    const [proposte, setProposte] = useState<PropostaCommerciale[]>([]);
    const [interazioni, setInterazioni] = useState<InterazioneCRM[]>([]);

    useEffect(() => {
        const createSubscription = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderField?: string) => {
            const collRef = collection(db, collectionName);
            const q = orderField ? query(collRef, orderBy(orderField, 'desc')) : query(collRef);
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setter(data);
            });
            return unsubscribe;
        };

        const unsubClienti = createSubscription('clienti', setClienti, 'lastModified');
        const unsubFornitori = createSubscription('fornitori', setFornitori, 'lastModified');
        const unsubDurate = createSubscription('durate', setDurate);
        const unsubLaboratori = createSubscription('laboratori', setLaboratori);
        const unsubListini = createSubscription('listini', setListini);
        const unsubIscrizioni = createSubscription('iscrizioni', setIscrizioni, 'scadenza');
        const unsubAttivita = createSubscription('attivita', setAttivita);
        const unsubAttivitaTipi = createSubscription('attivitaTipi', setAttivitaTipi, 'nome');
        const unsubMateriali = createSubscription('materiali', setMateriali);
        const unsubMovimenti = createSubscription('movimenti', setMovimenti, 'data');
        const unsubDocumenti = createSubscription('documenti', setDocumenti, 'dataCreazione');
        const unsubProposte = createSubscription('proposte', setProposte, 'dataEmissione');
        const unsubInterazioni = createSubscription('interazioni', setInterazioni, 'data');

        return () => {
            unsubClienti();
            unsubFornitori();
            unsubDurate();
            unsubLaboratori();
            unsubListini();
            unsubIscrizioni();
            unsubAttivita();
            unsubAttivitaTipi();
            unsubMateriali();
            unsubMovimenti();
            unsubDocumenti();
            unsubProposte();
            unsubInterazioni();
        };
    }, []);

    // Generic CRUD helpers
    const addDocument = useCallback(async (collectionName: string, data: object) => {
        await addDoc(collection(db, collectionName), data);
    }, []);

    const updateDocument = useCallback(async (collectionName: string, id: string, data: object) => {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, data);
    }, []);

    const deleteDocument = useCallback(async (collectionName: string, id: string) => {
        // BUG FIX: Added a guard to prevent Firebase errors when trying to delete a document with an empty ID.
        // This can happen in race conditions where the UI tries to delete an item before its ID is synced from Firestore.
        if (!id) {
            console.error(`Attempted to delete a document from '${collectionName}' with a missing ID.`);
            alert("Operazione non riuscita: ID del documento non valido.");
            return;
        }
        try {
            await deleteDoc(doc(db, collectionName, id));
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
    const addFornitore = useCallback((fornitore: Omit<Fornitore, 'id' | 'sedi'>) => {
        const fornitoreWithTimestamp = { ...fornitore, sedi: [], lastModified: new Date().toISOString() };
        addDocument('fornitori', fornitoreWithTimestamp);
    }, [addDocument]);

    const updateFornitore = useCallback((updatedFornitore: Fornitore) => {
        const { id, ...data } = updatedFornitore;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('fornitori', id, dataWithTimestamp);
    }, [updateDocument]);
    const deleteFornitore = useCallback((fornitoreId: string) => deleteDocument('fornitori', fornitoreId), [deleteDocument]);

    // Sedi CRUD
    const addSede = useCallback(async (fornitoreId: string, sede: Omit<Sede, 'id'|'fornitoreId'>) => {
        const newSede: Sede = { ...sede, id: `sede_${Date.now()}`, fornitoreId };
        const fornitoreRef = doc(db, 'fornitori', fornitoreId);
        const fornitoreSnap = await getDoc(fornitoreRef);
        if (fornitoreSnap.exists()) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            await updateDoc(fornitoreRef, { sedi: [...(fornitoreData.sedi || []), newSede] });
        }
    }, []);
    const updateSede = useCallback(async (fornitoreId: string, updatedSede: Sede) => {
        const fornitoreRef = doc(db, 'fornitori', fornitoreId);
        const fornitoreSnap = await getDoc(fornitoreRef);
        if (fornitoreSnap.exists()) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            const updatedSedi = fornitoreData.sedi.map(s => s.id === updatedSede.id ? updatedSede : s);
            await updateDoc(fornitoreRef, { sedi: updatedSedi });
        }
    }, []);
    const deleteSede = useCallback(async (fornitoreId: string, sedeId: string) => {
       const fornitoreRef = doc(db, 'fornitori', fornitoreId);
        const fornitoreSnap = await getDoc(fornitoreRef);
        if (fornitoreSnap.exists()) {
            const fornitoreData = fornitoreSnap.data() as Fornitore;
            const updatedSedi = fornitoreData.sedi.filter(s => s.id !== sedeId);
            await updateDoc(fornitoreRef, { sedi: updatedSedi });
        }
    }, []);

    // Durate CRUD
    const addDurata = useCallback((dur: Omit<Durata, 'id'>) => addDocument('durate', dur), [addDocument]);
    const updateDurata = useCallback((updatedDur: Durata) => {
        const { id, ...data } = updatedDur;
        updateDocument('durate', id, data);
    }, [updateDocument]);
    const deleteDurata = useCallback((durId: string) => deleteDocument('durate', durId), [deleteDocument]);

    // Laboratori CRUD
    const addLaboratorio = useCallback((lab: Omit<Laboratorio, 'id'>) => addDocument('laboratori', lab), [addDocument]);
    const updateLaboratorio = useCallback((updatedLab: Laboratorio) => {
        const { id, ...data } = updatedLab;
        updateDocument('laboratori', id, data);
    }, [updateDocument]);
    const deleteLaboratorio = useCallback((labId: string) => deleteDocument('laboratori', labId), [deleteDocument]);
    
    // Date Helpers for cascading update
    const parseDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };
    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // TimeSlot CRUD (within Laboratorio)
    const updateCascadingTimeSlots = useCallback(async (laboratorioId: string, movedTimeSlotId: string, newDateStr: string) => {
        const laboratorioRef = doc(db, 'laboratori', laboratorioId);
        const laboratorioSnap = await getDoc(laboratorioRef);

        if (!laboratorioSnap.exists()) {
            console.error("Laboratorio non trovato!");
            return;
        }

        const laboratorioData = laboratorioSnap.data() as Laboratorio;
        const originalTimeSlots = [...laboratorioData.timeSlots].sort((a, b) => a.ordine - b.ordine);

        const movedSlotIndex = originalTimeSlots.findIndex(ts => ts.id === movedTimeSlotId);
        if (movedSlotIndex === -1) {
            console.error("Time slot da spostare non trovato!");
            return;
        }

        const movedSlotOriginal = originalTimeSlots[movedSlotIndex];
        const oldDate = parseDate(movedSlotOriginal.data);
        const newDate = parseDate(newDateStr);

        const diffTime = newDate.getTime() - oldDate.getTime();
        
        if (diffTime === 0) return; // No change

        const updatedTimeSlots = originalTimeSlots.map((ts, index) => {
            if (index >= movedSlotIndex) {
                const currentDate = parseDate(ts.data);
                const updatedDate = new Date(currentDate.getTime() + diffTime);
                return {
                    ...ts,
                    data: formatDate(updatedDate)
                };
            }
            return ts;
        });

        // Recalculate dataInizio and dataFine based on the actual slots
        const sortedSlots = updatedTimeSlots.sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
        const newDataInizio = sortedSlots.length > 0 ? sortedSlots[0].data : laboratorioData.dataInizio;
        const newDataFine = sortedSlots.length > 0 ? sortedSlots[sortedSlots.length - 1].data : laboratorioData.dataFine;

        await updateDoc(laboratorioRef, { 
            timeSlots: updatedTimeSlots,
            dataInizio: newDataInizio,
            dataFine: newDataFine 
        });
    }, []);

    const addTimeSlot = useCallback(async (laboratorioId: string, timeSlot: Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>) => {
        const laboratorioRef = doc(db, 'laboratori', laboratorioId);
        const laboratorioSnap = await getDoc(laboratorioRef);
        if (laboratorioSnap.exists()) {
            const laboratorioData = laboratorioSnap.data() as Laboratorio;
            const newTimeSlot: TimeSlot = {
                ...timeSlot,
                id: `ts_${Date.now()}`,
                laboratorioId,
                ordine: (laboratorioData.timeSlots || []).length + 1,
            };
            const updatedTimeSlots = [...(laboratorioData.timeSlots || []), newTimeSlot];
            await updateDoc(laboratorioRef, { timeSlots: updatedTimeSlots });
        }
    }, []);

    const updateTimeSlot = useCallback(async (laboratorioId: string, updatedTimeSlot: TimeSlot) => {
        const laboratorioRef = doc(db, 'laboratori', laboratorioId);
        const laboratorioSnap = await getDoc(laboratorioRef);
        if (laboratorioSnap.exists()) {
            const laboratorioData = laboratorioSnap.data() as Laboratorio;
            const updatedTimeSlots = laboratorioData.timeSlots.map(ts => ts.id === updatedTimeSlot.id ? updatedTimeSlot : ts);
            await updateDoc(laboratorioRef, { timeSlots: updatedTimeSlots });
        }
    }, []);
    
    const deleteTimeSlot = useCallback(async (laboratorioId: string, timeSlotId: string) => {
       const laboratorioRef = doc(db, 'laboratori', laboratorioId);
        const laboratorioSnap = await getDoc(laboratorioRef);
        if (laboratorioSnap.exists()) {
            const laboratorioData = laboratorioSnap.data() as Laboratorio;
            const updatedTimeSlots = laboratorioData.timeSlots.filter(ts => ts.id !== timeSlotId);
            const reorderedTimeSlots = updatedTimeSlots.map((ts, index) => ({...ts, ordine: index + 1}));
            await updateDoc(laboratorioRef, { timeSlots: reorderedTimeSlots });
        }
    }, []);

    // Listini CRUD
    const addListino = useCallback((list: Omit<Listino, 'id'>) => addDocument('listini', list), [addDocument]);
    const updateListino = useCallback((updatedList: Listino) => {
        const { id, ...data } = updatedList;
        updateDocument('listini', id, data);
    }, [updateDocument]);
    const deleteListino = useCallback((listId: string) => deleteDocument('listini', listId), [deleteDocument]);

    // Iscrizioni CRUD
    const addIscrizione = useCallback((isc: Omit<Iscrizione, 'id'>) => addDocument('iscrizioni', isc), [addDocument]);
    const updateIscrizione = useCallback((updatedIsc: Iscrizione) => {
        const { id, ...data } = updatedIsc;
        updateDocument('iscrizioni', id, data);
    }, [updateDocument]);
    const deleteIscrizione = useCallback((iscId: string) => deleteDocument('iscrizioni', iscId), [deleteDocument]);


    // Attivita CRUD
    const addAttivita = useCallback((act: Omit<Attivita, 'id'>) => addDocument('attivita', act), [addDocument]);
    const updateAttivita = useCallback((updatedAct: Attivita) => {
        const { id, ...data } = updatedAct;
        updateDocument('attivita', id, data);
    }, [updateDocument]);
    const deleteAttivita = useCallback((actId: string) => deleteDocument('attivita', actId), [deleteDocument]);
    
    // Attivita Tipi CRUD
    const addAttivitaTipo = useCallback((tipo: Omit<AttivitaTipoDef, 'id'>) => addDocument('attivitaTipi', tipo), [addDocument]);
    const deleteAttivitaTipo = useCallback((tipoId: string) => deleteDocument('attivitaTipi', tipoId), [deleteDocument]);

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
        durate, addDurata, updateDurata, deleteDurata,
        laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio,
        addTimeSlot, updateTimeSlot, deleteTimeSlot, updateCascadingTimeSlots,
        listini, addListino, updateListino, deleteListino,
        iscrizioni, addIscrizione, updateIscrizione, deleteIscrizione,
        attivita, addAttivita, updateAttivita, deleteAttivita,
        attivitaTipi, addAttivitaTipo, deleteAttivitaTipo,
        materiali, addMateriale, updateMateriale, deleteMateriale,
        movimenti, addMovimento, updateMovimento, deleteMovimento,
        documenti, addDocumento, updateDocumento, deleteDocumento,
        proposte, addProposta, updateProposta, deleteProposta,
        interazioni, addInterazione, updateInterazione, deleteInterazione,
    };
}
