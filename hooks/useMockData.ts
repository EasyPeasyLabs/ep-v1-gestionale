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
    getDoc,
    setDoc,
    getDocs,
    limit,
    where
} from "firebase/firestore";
// FIX: Import new types for Laboratori, Durate, Listini, Iscrizioni, CRM, and LaboratorioTipoDef
import type { Cliente, Fornitore, SedeAnagrafica, Attivita, Materiale, PropostaCommerciale, AttivitaTipoDef, ConfigurazioneAzienda, GenitoreAnagrafica, FiglioAnagrafica, FornitoreAnagrafica, AttivitaAnagrafica, Laboratorio, LaboratorioTipoDef, TimeSlot, Iscrizione, MovimentoFinance, InterazioneCRM, Documento, DocumentoTipoDef, TimeSlotDef, ListinoDef, RelazioneDef, Promemoria, Durata } from '../types';
import { IscrizioneStato, PromemoriaStato, TipoMovimento, CentroDiCosto, ImputazioneOperativa } from '../types';

// Helper function to recursively convert Firestore Timestamps to ISO strings.
// This prevents "circular structure" errors when using JSON.stringify on the data.
const convertTimestamps = (data: any): any => {
    if (!data) {
        return data;
    }
    // Check if it's a Firestore Timestamp
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    // If it's an array, map over it and recurse
    if (Array.isArray(data)) {
        return data.map(convertTimestamps);
    }
    // If it's a non-null object, recurse on its properties
    if (typeof data === 'object' && data !== null) {
        const newObj: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObj[key] = convertTimestamps(data[key]);
            }
        }
        return newObj;
    }
    // It's a primitive, return as is
    return data;
};


export function useMockData() {
    const [clienti, setClienti] = useState<Cliente[]>([]);
    const [genitori, setGenitori] = useState<GenitoreAnagrafica[]>([]);
    const [figli, setFigli] = useState<FiglioAnagrafica[]>([]);
    const [fornitori, setFornitori] = useState<Fornitore[]>([]);
    const [fornitoriAnagrafica, setFornitoriAnagrafica] = useState<FornitoreAnagrafica[]>([]);
    const [sedi, setSedi] = useState<SedeAnagrafica[]>([]);
    const [attivitaAnagrafica, setAttivitaAnagrafica] = useState<AttivitaAnagrafica[]>([]);
    const [attivita, setAttivita] = useState<Attivita[]>([]);
    const [attivitaTipi, setAttivitaTipi] = useState<AttivitaTipoDef[]>([]);
    const [materiali, setMateriali] = useState<Materiale[]>([]);
    const [proposte, setProposte] = useState<PropostaCommerciale[]>([]);
    const [configurazione, setConfigurazione] = useState<ConfigurazioneAzienda | null>(null);
    const [laboratori, setLaboratori] = useState<Laboratorio[]>([]);
    const [laboratoriTipi, setLaboratoriTipi] = useState<LaboratorioTipoDef[]>([]);
    const [iscrizioni, setIscrizioni] = useState<Iscrizione[]>([]);
    const [movimenti, setMovimenti] = useState<MovimentoFinance[]>([]);
    const [interazioni, setInterazioni] = useState<InterazioneCRM[]>([]);
    const [documenti, setDocumenti] = useState<Documento[]>([]);
    const [documentiTipi, setDocumentiTipi] = useState<DocumentoTipoDef[]>([]);
    const [timeSlotsDef, setTimeSlotsDef] = useState<TimeSlotDef[]>([]);
    const [listiniDef, setListiniDef] = useState<ListinoDef[]>([]);
    const [relazioni, setRelazioni] = useState<RelazioneDef[]>([]);
    const [promemoria, setPromemoria] = useState<Promemoria[]>([]);
    const [durate, setDurate] = useState<Durata[]>([]);


    useEffect(() => {
        const createSubscription = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderField?: string) => {
            const collRef = collection(db, collectionName);
            const q = orderField ? query(collRef, orderBy(orderField, 'asc')) : query(collRef);
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if ('docs' in snapshot) {
                    const data = snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
                    setter(data);
                }
            });
            return unsubscribe;
        };

        const unsubClienti = createSubscription('clienti', setClienti, 'lastModified');
        const unsubGenitori = createSubscription('genitori', setGenitori, 'lastModified');
        const unsubFigli = createSubscription('figli', setFigli, 'lastModified');
        const unsubFornitori = createSubscription('fornitori', setFornitori, 'lastModified');
        const unsubFornitoriAnagrafica = createSubscription('fornitoriAnagrafica', setFornitoriAnagrafica, 'lastModified');
        const unsubSedi = createSubscription('sedi', setSedi, 'lastModified');
        const unsubAttivitaAnagrafica = createSubscription('attivitaAnagrafica', setAttivitaAnagrafica, 'lastModified');
        const unsubAttivita = createSubscription('attivita', setAttivita);
        const unsubAttivitaTipi = createSubscription('attivitaTipi', setAttivitaTipi, 'nome');
        const unsubMateriali = createSubscription('materiali', setMateriali, 'lastModified');
        const unsubProposte = createSubscription('proposte', setProposte, 'dataEmissione');
        const unsubLaboratori = createSubscription('laboratori', setLaboratori, 'codice');
        const unsubLaboratoriTipi = createSubscription('laboratoriTipi', setLaboratoriTipi, 'tipo');
        const unsubIscrizioni = createSubscription('iscrizioni', setIscrizioni, 'codice');
        const unsubMovimenti = createSubscription('movimenti', setMovimenti, 'data');
        const unsubInterazioni = createSubscription('interazioni', setInterazioni, 'data');
        const unsubDocumenti = createSubscription('documenti', setDocumenti, 'dataCreazione');
        const unsubDocumentiTipi = createSubscription('documentiTipi', setDocumentiTipi, 'nome');
        const unsubTimeSlotsDef = createSubscription('timeSlotsDef', setTimeSlotsDef, 'valoreInMinuti');
        const unsubListiniDef = createSubscription('listiniDef', setListiniDef, 'tipo');
        const unsubRelazioni = createSubscription('relazioni', setRelazioni, 'nome');
        const unsubPromemoria = createSubscription('promemoria', setPromemoria, 'dataScadenza');
        const unsubDurate = createSubscription('durate', setDurate, 'nome');

        
        const configRef = doc(db, 'configurazione', 'main');
        const unsubConfig = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                setConfigurazione({ id: docSnap.id, ...convertTimestamps(docSnap.data()) } as ConfigurazioneAzienda);
            } else {
                setConfigurazione(null);
            }
        });

        return () => {
            unsubClienti();
            unsubGenitori();
            unsubFigli();
            unsubFornitori();
            unsubFornitoriAnagrafica();
            unsubSedi();
            unsubAttivitaAnagrafica();
            unsubAttivita();
            unsubAttivitaTipi();
            unsubMateriali();
            unsubProposte();
            unsubConfig();
            unsubLaboratori();
            unsubLaboratoriTipi();
            unsubIscrizioni();
            unsubMovimenti();
            unsubInterazioni();
            unsubDocumenti();
            unsubDocumentiTipi();
            unsubTimeSlotsDef();
            unsubListiniDef();
            unsubRelazioni();
            unsubPromemoria();
            unsubDurate();
        };
    }, []);

    // Generic CRUD helpers
    const addDocument = useCallback(async (collectionName: string, data: object) => {
        try {
            const docRef = await addDoc(collection(db, collectionName), data);
            return docRef.id;
        } catch (error) {
            console.error(`Errore durante l'aggiunta del documento a '${collectionName}': `, error);
            alert(`Impossibile aggiungere l'elemento. Causa: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Controlla la console per i dettagli.`);
            return null;
        }
    }, []);

    const updateDocument = useCallback(async (collectionName: string, id: string, data: object) => {
        if (!id) {
            console.error(`Attempted to update a document in '${collectionName}' with a missing ID.`);
            alert("Operazione non riuscita: ID del documento non valido.");
            return;
        }
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error(`Errore durante l'aggiornamento del documento in '${collectionName}' (ID: ${id}): `, error);
            alert(`Impossibile aggiornare l'elemento. Causa: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Controlla la console per i dettagli.`);
        }
    }, []);

    const deleteDocument = useCallback(async (collectionName: string, id: string) => {
        if (!id) {
            console.error(`Attempted to delete a document from '${collectionName}' with a missing ID.`);
            alert("Operazione non riuscita: ID del documento non valido.");
            return;
        }
        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (error) {
            console.error("Errore durante l'eliminazione del documento: ", error);
            alert(`Impossibile eliminare l'elemento. Causa: ${error instanceof Error ? error.message : 'Errore sconosciuto'}. Controlla la console per i dettagli.`);
        }
    }, []);

    // Configurazione update
    const updateConfigurazione = useCallback(async (configData: Omit<ConfigurazioneAzienda, 'id'>) => {
        const configRef = doc(db, 'configurazione', 'main');
        await setDoc(configRef, configData, { merge: true });
    }, []);


    // Genitori CRUD
    const addGenitore = useCallback((genitore: Omit<GenitoreAnagrafica, 'id'>) => {
        const genitoreWithTimestamp = { ...genitore, lastModified: new Date().toISOString() };
        return addDocument('genitori', genitoreWithTimestamp);
    }, [addDocument]);
    
    const updateGenitore = useCallback((updatedGenitore: GenitoreAnagrafica) => {
        const { id, ...data } = updatedGenitore;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('genitori', id, dataWithTimestamp);
    }, [updateDocument]);
    
    const deleteGenitore = useCallback((genitoreId: string) => deleteDocument('genitori', genitoreId), [deleteDocument]);

    // Figli CRUD
    const addFiglio = useCallback((figlio: Omit<FiglioAnagrafica, 'id'>) => {
        const figlioWithTimestamp = { ...figlio, lastModified: new Date().toISOString() };
        return addDocument('figli', figlioWithTimestamp);
    }, [addDocument]);
    
    const updateFiglio = useCallback((updatedFiglio: FiglioAnagrafica) => {
        const { id, ...data } = updatedFiglio;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('figli', id, dataWithTimestamp);
    }, [updateDocument]);
    
    const deleteFiglio = useCallback((figlioId: string) => deleteDocument('figli', figlioId), [deleteDocument]);

    // FornitoriAnagrafica CRUD
    const addFornitoreAnagrafica = useCallback((fornitore: Omit<FornitoreAnagrafica, 'id'>) => {
        const fornitoreWithTimestamp = { ...fornitore, lastModified: new Date().toISOString() };
        addDocument('fornitoriAnagrafica', fornitoreWithTimestamp);
    }, [addDocument]);
    
    const updateFornitoreAnagrafica = useCallback((updatedFornitore: FornitoreAnagrafica) => {
        const { id, ...data } = updatedFornitore;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('fornitoriAnagrafica', id, dataWithTimestamp);
    }, [updateDocument]);
    
    const deleteFornitoreAnagrafica = useCallback((fornitoreId: string) => deleteDocument('fornitoriAnagrafica', fornitoreId), [deleteDocument]);

    // Sedi CRUD
    const addSede = useCallback((sede: Omit<SedeAnagrafica, 'id'>) => {
        const sedeWithTimestamp = { ...sede, lastModified: new Date().toISOString() };
        addDocument('sedi', sedeWithTimestamp);
    }, [addDocument]);

    const updateSede = useCallback((updatedSede: SedeAnagrafica) => {
        const { id, ...data } = updatedSede;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('sedi', id, dataWithTimestamp);
    }, [updateDocument]);

    const deleteSede = useCallback((sedeId: string) => deleteDocument('sedi', sedeId), [deleteDocument]);
    
    // Attività Anagrafica CRUD
    const addAttivitaAnagrafica = useCallback((attivita: Omit<AttivitaAnagrafica, 'id'>) => {
        const attivitaWithTimestamp = { ...attivita, lastModified: new Date().toISOString() };
        addDocument('attivitaAnagrafica', attivitaWithTimestamp);
    }, [addDocument]);

    const updateAttivitaAnagrafica = useCallback((updatedAttivita: AttivitaAnagrafica) => {
        const { id, ...data } = updatedAttivita;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('attivitaAnagrafica', id, dataWithTimestamp);
    }, [updateDocument]);

    const deleteAttivitaAnagrafica = useCallback((attivitaId: string) => deleteDocument('attivitaAnagrafica', attivitaId), [deleteDocument]);


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
    const addFornitore = useCallback((fornitore: Omit<Fornitore, 'id'>) => {
        const fornitoreWithTimestamp = { ...fornitore, lastModified: new Date().toISOString() };
        addDocument('fornitori', fornitoreWithTimestamp);
    }, [addDocument]);

    const updateFornitore = useCallback((updatedFornitore: Fornitore) => {
        const { id, ...data } = updatedFornitore;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('fornitori', id, dataWithTimestamp);
    }, [updateDocument]);
    const deleteFornitore = useCallback((fornitoreId: string) => deleteDocument('fornitori', fornitoreId), [deleteDocument]);

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
    const addMateriale = useCallback((mat: Omit<Materiale, 'id'>) => {
        const matWithTimestamp = { ...mat, lastModified: new Date().toISOString() };
        return addDocument('materiali', matWithTimestamp);
    }, [addDocument]);
    const updateMateriale = useCallback((updatedMat: Materiale) => {
        const { id, ...data } = updatedMat;
        const dataWithTimestamp = { ...data, lastModified: new Date().toISOString() };
        updateDocument('materiali', id, dataWithTimestamp);
    }, [updateDocument]);
    const deleteMateriale = useCallback((matId: string) => deleteDocument('materiali', matId), [deleteDocument]);

    // Proposte CRUD
    const addProposta = useCallback((prop: Omit<PropostaCommerciale, 'id'>) => addDocument('proposte', prop), [addDocument]);
    const updateProposta = useCallback((updatedProp: PropostaCommerciale) => {
        const { id, ...data } = updatedProp;
        updateDocument('proposte', id, data);
    }, [updateDocument]);
    const deleteProposta = useCallback((propId: string) => deleteDocument('proposte', propId), [deleteDocument]);

    // Laboratori CRUD
    const addLaboratorio = useCallback((lab: Omit<Laboratorio, 'id'>) => addDocument('laboratori', lab), [addDocument]);
    const updateLaboratorio = useCallback((updatedLab: Laboratorio) => {
        const { id, ...data } = updatedLab;
        updateDocument('laboratori', id, data);
    }, [updateDocument]);
    const deleteLaboratorio = useCallback((labId: string) => deleteDocument('laboratori', labId), [deleteDocument]);

    const addLaboratorioTipo = useCallback((tipo: Omit<LaboratorioTipoDef, 'id'>) => addDocument('laboratoriTipi', tipo), [addDocument]);
    const updateLaboratorioTipo = useCallback((updatedTipo: LaboratorioTipoDef) => {
        const { id, ...data } = updatedTipo;
        updateDocument('laboratoriTipi', id, data);
    }, [updateDocument]);
    const deleteLaboratorioTipo = useCallback((tipoId: string) => deleteDocument('laboratoriTipi', tipoId), [deleteDocument]);

    const addTimeSlot = useCallback(async (labId: string, ts: Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>) => {
        const labDocRef = doc(db, 'laboratori', labId);
        const labDoc = await getDoc(labDocRef);
        if (labDoc.exists()) {
            const labData = labDoc.data() as Laboratorio;
            const maxOrdine = (labData.timeSlots || []).reduce((max, slot) => Math.max(max, slot.ordine), 0);
            const newSlot: TimeSlot = {
                ...ts,
                id: `ts_${Date.now()}`,
                laboratorioId: labId,
                ordine: maxOrdine + 1,
            };
            const updatedSlots = [...(labData.timeSlots || []), newSlot].sort((a,b) => a.ordine - b.ordine);
            await updateDoc(labDocRef, { timeSlots: updatedSlots });
        }
    }, []);

    const updateTimeSlot = useCallback(async (labId: string, updatedTs: TimeSlot) => {
        const labDocRef = doc(db, 'laboratori', labId);
        const labDoc = await getDoc(labDocRef);
        if (labDoc.exists()) {
            const labData = labDoc.data() as Laboratorio;
            const updatedSlots = (labData.timeSlots || []).map(ts => ts.id === updatedTs.id ? updatedTs : ts);
            await updateDoc(labDocRef, { timeSlots: updatedSlots });
        }
    }, []);

    const deleteTimeSlot = useCallback(async (labId: string, tsId: string) => {
        const labDocRef = doc(db, 'laboratori', labId);
        const labDoc = await getDoc(labDocRef);
        if (labDoc.exists()) {
            const labData = labDoc.data() as Laboratorio;
            const updatedSlots = (labData.timeSlots || []).filter(ts => ts.id !== tsId);
            await updateDoc(labDocRef, { timeSlots: updatedSlots });
        }
    }, []);
    
    // Promemoria CRUD
    const addPromemoria = useCallback((p: Omit<Promemoria, 'id'>) => addDocument('promemoria', p), [addDocument]);
    const updatePromemoria = useCallback((updatedP: Promemoria) => {
        const { id, ...data } = updatedP;
        updateDocument('promemoria', id, data);
    }, [updateDocument]);
    const deletePromemoriaByIscrizioneId = useCallback(async (iscrizioneId: string) => {
        const q = query(collection(db, 'promemoria'), where('iscrizioneId', '==', iscrizioneId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
            await deleteDocument('promemoria', doc.id);
        });
    }, [deleteDocument]);

    // Iscrizioni CRUD
    const addIscrizione = useCallback(async (isc: Omit<Iscrizione, 'id' | 'codice'>) => {
        const collRef = collection(db, 'iscrizioni');
        const q = query(collRef, orderBy('codice', 'desc'), limit(1));
        const lastDocSnap = await getDocs(q);
        let nextCodiceNum = 1;
        if (!lastDocSnap.empty) {
            const lastCodice = lastDocSnap.docs[0].data().codice;
            nextCodiceNum = parseInt(lastCodice.split('-')[1]) + 1;
        }
        const newCodice = `ISC-${String(nextCodiceNum).padStart(3, '0')}`;
        
        const newIscrizioneId = await addDocument('iscrizioni', {...isc, codice: newCodice});
        
        if (newIscrizioneId) {
            const lab = laboratori.find(l => l.id === isc.laboratorioId);
            if (lab && lab.timeSlots.length > 0) {
                const lastTimeSlot = [...lab.timeSlots].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
                const scadenzaDate = new Date(lastTimeSlot.data);
                
                const newPromemoria: Omit<Promemoria, 'id'> = {
                    iscrizioneId: newIscrizioneId,
                    genitoreId: isc.clienteId,
                    laboratorioCodice: lab.codice,
                    dataScadenza: scadenzaDate.toISOString().split('T')[0],
                    stato: PromemoriaStato.ATTIVO
                };
                await addPromemoria(newPromemoria);
            }

            const genitore = genitori.find(g => g.id === isc.clienteId);
            if (genitore) {
                const updatedIscrizioniIds = [...(genitore.iscrizioniIds || []), newIscrizioneId];
                await updateGenitore({ ...genitore, iscrizioniIds: updatedIscrizioniIds });
            }
        }
    }, [addDocument, laboratori, genitori, addPromemoria, updateGenitore]);

    const updateIscrizione = useCallback(async (updatedIsc: Iscrizione) => {
        const { id, ...data } = updatedIsc;
        await updateDocument('iscrizioni', id, data);

        if (updatedIsc.stato === IscrizioneStato.PAGATO) {
            const q = query(collection(db, 'movimenti'), where('iscrizioneId', '==', id));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                const genitore = genitori.find(g => g.id === updatedIsc.clienteId);
                const lab = laboratori.find(l => l.id === updatedIsc.laboratorioId);
                const descrizione = `Pagamento Iscrizione ${updatedIsc.codice} - ${genitore?.cognome || 'N/A'} - Lab: ${lab?.codice || 'N/A'}`;

                const newMovimento: Omit<MovimentoFinance, 'id'> = {
                    data: new Date().toISOString().split('T')[0],
                    descrizione: descrizione,
                    tipo: TipoMovimento.ENTRATA,
                    importo: updatedIsc.importo,
                    centroDiCosto: CentroDiCosto.OPERATIVO,
                    imputazione: ImputazioneOperativa.LABORATORIO,
                    iscrizioneId: id
                };
                await addDocument('movimenti', newMovimento);
            }
        }
    }, [updateDocument, addDocument, genitori, laboratori]);

    const deleteIscrizione = useCallback(async (iscId: string) => {
        const iscrizioneDoc = await getDoc(doc(db, 'iscrizioni', iscId));
        if (!iscrizioneDoc.exists()) return;
        const iscrizioneData = iscrizioneDoc.data() as Iscrizione;
    
        await deletePromemoriaByIscrizioneId(iscId);

        const qMov = query(collection(db, 'movimenti'), where('iscrizioneId', '==', iscId));
        const movSnapshot = await getDocs(qMov);
        movSnapshot.forEach(async (movDoc) => {
            await deleteDocument('movimenti', movDoc.id);
        });
    
        const genitore = genitori.find(g => g.id === iscrizioneData.clienteId);
        if (genitore && genitore.iscrizioniIds) {
            const updatedIscrizioniIds = genitore.iscrizioniIds.filter(id => id !== iscId);
            await updateGenitore({ ...genitore, iscrizioniIds: updatedIscrizioniIds });
        }
    
        await deleteDocument('iscrizioni', iscId);
    }, [deleteDocument, deletePromemoriaByIscrizioneId, genitori, updateGenitore]);


    // FIX: Add CRUD functions for finance movements
    const addMovimento = useCallback((mov: Omit<MovimentoFinance, 'id'>) => addDocument('movimenti', mov), [addDocument]);
    const updateMovimento = useCallback((updatedMov: MovimentoFinance) => {
        const { id, ...data } = updatedMov;
        updateDocument('movimenti', id, data);
    }, [updateDocument]);
    const deleteMovimento = useCallback((movId: string) => deleteDocument('movimenti', movId), [deleteDocument]);

    // FIX: Add CRUD functions for CRM interazioni
    const addInterazione = useCallback((interazione: Omit<InterazioneCRM, 'id'>) => addDocument('interazioni', interazione), [addDocument]);
    const updateInterazione = useCallback((updatedInterazione: InterazioneCRM) => {
        const { id, ...data } = updatedInterazione;
        updateDocument('interazioni', id, data);
    }, [updateDocument]);
    const deleteInterazione = useCallback((interazioneId: string) => deleteDocument('interazioni', interazioneId), [deleteDocument]);


    // FIX: Add CRUD functions for documenti
    const addDocumento = useCallback((docu: Omit<Documento, 'id'>) => addDocument('documenti', docu), [addDocument]);
    const updateDocumento = useCallback((updatedDocu: Documento) => {
        const { id, ...data } = updatedDocu;
        updateDocument('documenti', id, data);
    }, [updateDocument]);
    const deleteDocumento = useCallback((docuId: string) => deleteDocument('documenti', docuId), [deleteDocument]);

    // Documenti Tipi CRUD
    const addDocumentoTipo = useCallback((tipo: Omit<DocumentoTipoDef, 'id'>) => addDocument('documentiTipi', tipo), [addDocument]);
    const updateDocumentoTipo = useCallback((updatedTipo: DocumentoTipoDef) => {
        const { id, ...data } = updatedTipo;
        updateDocument('documentiTipi', id, data);
    }, [updateDocument]);
    const deleteDocumentoTipo = useCallback((tipoId: string) => deleteDocument('documentiTipi', tipoId), [deleteDocument]);

    // TimeSlotDef CRUD
    const addTimeSlotDef = useCallback((def: Omit<TimeSlotDef, 'id'>) => addDocument('timeSlotsDef', def), [addDocument]);
    const updateTimeSlotDef = useCallback((updatedDef: TimeSlotDef) => {
        const { id, ...data } = updatedDef;
        updateDocument('timeSlotsDef', id, data);
    }, [updateDocument]);
    const deleteTimeSlotDef = useCallback((defId: string) => deleteDocument('timeSlotsDef', defId), [deleteDocument]);

    // ListinoDef CRUD
    const addListinoDef = useCallback((def: Omit<ListinoDef, 'id'>) => addDocument('listiniDef', def), [addDocument]);
    const updateListinoDef = useCallback((updatedDef: ListinoDef) => {
        const { id, ...data } = updatedDef;
        updateDocument('listiniDef', id, data);
    }, [updateDocument]);
    const deleteListinoDef = useCallback((defId: string) => deleteDocument('listiniDef', defId), [deleteDocument]);

    // FIX: Add CRUD functions for the legacy Durate micro-app.
    // Durate CRUD
    const addDurata = useCallback((dur: Omit<Durata, 'id'>) => addDocument('durate', dur), [addDocument]);
    const updateDurata = useCallback((updatedDur: Durata) => {
        const { id, ...data } = updatedDur;
        updateDocument('durate', id, data);
    }, [updateDocument]);
    const deleteDurata = useCallback((durId: string) => deleteDocument('durate', durId), [deleteDocument]);

    // Relazioni CRUD
    const addRelazione = useCallback((rel: Omit<RelazioneDef, 'id'>) => addDocument('relazioni', rel), [addDocument]);
    const updateRelazione = useCallback((updatedRel: RelazioneDef) => {
        const { id, ...data } = updatedRel;
        updateDocument('relazioni', id, data);
    }, [updateDocument]);
    const deleteRelazione = useCallback((relId: string) => deleteDocument('relazioni', relId), [deleteDocument]);

    const updateDocumentForRelation = useCallback(async (collectionName: string, item: any) => {
        const { id, ...data } = item;
        if (!id) {
            console.error(`ID mancante per l'aggiornamento nella collezione ${collectionName}`);
            return;
        }
        
        const collectionsWithTimestamp = ['genitori', 'figli', 'fornitoriAnagrafica', 'sedi', 'attivitaAnagrafica', 'materiali'];
        const dataToUpdate = collectionsWithTimestamp.includes(collectionName)
            ? { ...data, lastModified: new Date().toISOString() }
            : data;
            
        await updateDocument(collectionName, id, dataToUpdate);
    }, [updateDocument]);


    return {
        clienti, addCliente, updateCliente, deleteCliente,
        genitori, addGenitore, updateGenitore, deleteGenitore,
        figli, addFiglio, updateFiglio, deleteFiglio,
        fornitori, addFornitore, updateFornitore, deleteFornitore,
        fornitoriAnagrafica, addFornitoreAnagrafica, updateFornitoreAnagrafica, deleteFornitoreAnagrafica,
        sedi, addSede, updateSede, deleteSede,
        attivitaAnagrafica, addAttivitaAnagrafica, updateAttivitaAnagrafica, deleteAttivitaAnagrafica,
        attivita, addAttivita, updateAttivita, deleteAttivita,
        attivitaTipi, addAttivitaTipo, deleteAttivitaTipo,
        materiali, addMateriale, updateMateriale, deleteMateriale,
        proposte, addProposta, updateProposta, deleteProposta,
        configurazione, updateConfigurazione,
        laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio,
        laboratoriTipi, addLaboratorioTipo, updateLaboratorioTipo, deleteLaboratorioTipo,
        addTimeSlot, updateTimeSlot, deleteTimeSlot,
        iscrizioni, addIscrizione, updateIscrizione, deleteIscrizione,
        movimenti, addMovimento, updateMovimento, deleteMovimento,
        interazioni, addInterazione, updateInterazione, deleteInterazione,
        documenti, addDocumento, updateDocumento, deleteDocumento,
        documentiTipi, addDocumentoTipo, updateDocumentoTipo, deleteDocumentoTipo,
        timeSlotsDef, addTimeSlotDef, updateTimeSlotDef, deleteTimeSlotDef,
        listiniDef, addListinoDef, updateListinoDef, deleteListinoDef,
        relazioni, addRelazione, updateRelazione, deleteRelazione,
        updateDocumentForRelation,
        promemoria, addPromemoria, updatePromemoria,
        durate, addDurata, updateDurata, deleteDurata,
    };
}