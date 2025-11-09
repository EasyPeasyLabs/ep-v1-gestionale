import { useState, useCallback } from 'react';
import { ClienteClasse, ClienteTipo, ClienteStato, FornitoreTipo, AttivitaStato, AttivitaTipo, MaterialeUbicazione, TimeSlotStato, TipoMovimento, CentroDiCosto, ImputazioneLavoro, ImputazionePersonale, DocumentoTipo, DocumentoStato, PropostaStato, InterazioneTipo } from '../types';
import type { Cliente, Fornitore, Sede, Laboratorio, Attivita, Materiale, MovimentoFinance, Documento, PropostaCommerciale, InterazioneCRM } from '../types';

const initialClienti: Cliente[] = [
    {
        id: 'fam_01',
        classe: ClienteClasse.PRIVATO,
        tipo: ClienteTipo.FAMIGLIA,
        stato: ClienteStato.ATTIVO,
        rating: 4,
        dati: {
            genitore1: { cognome: 'Rossi', nome: 'Mario', codiceFiscale: 'RSSMRA80A01H501U', indirizzo: { via: 'Via Roma', civico: '10', cap: '00100', citta: 'Roma', provincia: 'RM' }, telefono: '3331234567', email: 'mario.rossi@email.com' },
            figli: [{ nome: 'Giulia', eta: '3 anni' }]
        }
    },
    {
        id: 'az_01',
        classe: ClienteClasse.PRIVATO,
        tipo: ClienteTipo.AZIENDA,
        stato: ClienteStato.ATTIVO,
        rating: 5,
        dati: { ragioneSociale: 'Asilo Bimbi Felici', partitaIva: '12345678901', indirizzo: { via: 'Viale Europa', civico: '25', cap: '20100', citta: 'Milano', provincia: 'MI' }, telefono: '02123456', email: 'info@bimbi-felici.it', referente: 'Paola Verdi' },
        bambini: { quantita: 25, fasciaEta: '2 anni' }
    }
];

const initialFornitori: Fornitore[] = [
    {
        id: 'for_01',
        classe: ClienteClasse.PRIVATO,
        tipo: FornitoreTipo.AZIENDA,
        stato: ClienteStato.ATTIVO,
        rating: 5,
        dati: { ragioneSociale: 'Spazio Polifunzionale S.r.l.', partitaIva: '09876543210', indirizzo: { via: 'Via Garibaldi', civico: '5', cap: '00153', citta: 'Roma', provincia: 'RM' }, telefono: '06987654', email: 'info@spazio.it', referente: 'Luca Bianchi' },
        sedi: [
            { id: 'sede_01', fornitoreId: 'for_01', nome: 'Sala Arcobaleno', indirizzo: { via: 'Via Garibaldi', civico: '5', cap: '00153', citta: 'Roma', provincia: 'RM' }, capienzaMassima: 15, fasciaEta: '0-6 anni', costoNoloOra: 50 },
            { id: 'sede_02', fornitoreId: 'for_01', nome: 'Sala Girasole', indirizzo: { via: 'Via Garibaldi', civico: '5', cap: '00153', citta: 'Roma', provincia: 'RM' }, capienzaMassima: 10, fasciaEta: '0-3 anni', costoNoloOra: 40 },
        ]
    }
];

const initialLaboratori: Laboratorio[] = [
    {
        id: 'lab_01',
        codice: 'ARC.LUN.10:00',
        sedeId: 'sede_01',
        dataInizio: '2024-09-02',
        dataFine: '2024-09-23',
        prezzoListino: 120,
        costoAttivita: 20,
        costoLogistica: 15,
        timeSlots: [
            { id: 'ts_01', laboratorioId: 'lab_01', stato: TimeSlotStato.PROGRAMMATO, data: '2024-09-02', ordine: 1, iscritti: 8 },
            { id: 'ts_02', laboratorioId: 'lab_01', stato: TimeSlotStato.PROGRAMMATO, data: '2024-09-09', ordine: 2, iscritti: 8 },
            { id: 'ts_03', laboratorioId: 'lab_01', stato: TimeSlotStato.PROGRAMMATO, data: '2024-09-16', ordine: 3, iscritti: 8 },
            { id: 'ts_04', laboratorioId: 'lab_01', stato: TimeSlotStato.PROGRAMMATO, data: '2024-09-23', ordine: 4, iscritti: 8 },
        ]
    }
];

const initialAttivita: Attivita[] = [
    { id: 'att_01', stato: AttivitaStato.APPROVATA, tipo: AttivitaTipo.MUSICA, titolo: 'Canzoni con le marionette', materiali: ['mat_01', 'mat_02'], rating: 5 },
    { id: 'att_02', stato: AttivitaStato.PIANIFICATA, tipo: AttivitaTipo.LETTURA, titolo: 'Il piccolo bruco mai sazio', materiali: ['mat_03'], rating: 4 },
];

const initialMateriali: Materiale[] = [
    { id: 'mat_01', nome: 'Marionetta Leone', descrizione: 'Marionetta a mano', unitaMisura: 'pz', quantita: 1, prezzoAbituale: 15, ubicazione: MaterialeUbicazione.HOME },
    { id: 'mat_02', nome: 'Ukulele', descrizione: 'Ukulele soprano per bambini', unitaMisura: 'pz', quantita: 1, prezzoAbituale: 30, ubicazione: MaterialeUbicazione.HOME },
    { id: 'mat_03', nome: 'Libro "Il piccolo bruco mai sazio"', descrizione: 'Edizione cartonata', unitaMisura: 'pz', quantita: 2, prezzoAbituale: 12, ubicazione: MaterialeUbicazione.HOME },
];

const initialMovimenti: MovimentoFinance[] = [
    { id: 'mov_01', tipo: TipoMovimento.ENTRATA, centroDiCosto: CentroDiCosto.LAVORO, imputazione: ImputazioneLavoro.CLIENTI, descrizione: 'Iscrizione Lab Settembre - Fam. Rossi', importo: 120, data: '2024-09-01' },
    { id: 'mov_02', tipo: TipoMovimento.USCITA, centroDiCosto: CentroDiCosto.LAVORO, imputazione: ImputazioneLavoro.FORNITORI, descrizione: 'Affitto Sala Arcobaleno - Settembre', importo: 200, data: '2024-09-01' },
    { id: 'mov_03', tipo: TipoMovimento.USCITA, centroDiCosto: CentroDiCosto.PERSONALE, imputazione: ImputazionePersonale.TEMPO_LIBERO, descrizione: 'Cena fuori', importo: 50, data: '2024-09-03' },
];

const initialDocumenti: Documento[] = [
    { id: 'doc_01', nome: 'Contratto Asilo Bimbi Felici 2024', tipo: DocumentoTipo.CONTRATTO, stato: DocumentoStato.FIRMATO, dataCreazione: '2024-08-15', associatoA: { id: 'az_01', tipo: 'cliente', nome: 'Asilo Bimbi Felici' }, contenuto: '...' },
    { id: 'doc_02', nome: 'Ricevuta Iscrizione Fam. Rossi', tipo: DocumentoTipo.RICEVUTA, stato: DocumentoStato.PAGATO, dataCreazione: '2024-09-01', associatoA: { id: 'fam_01', tipo: 'cliente', nome: 'Fam. Rossi' }, contenuto: '...' }
];

const initialProposte: PropostaCommerciale[] = [
    { id: 'prop_01', codice: 'PREV-2024-001', clienteId: 'az_01', dataEmissione: '2024-08-01', dataScadenza: '2024-08-31', stato: PropostaStato.ACCETTATA, servizi: [{id: 's1', descrizione: 'Ciclo 4 laboratori musicali', quantita: 1, prezzoUnitario: 450 }], totale: 450 }
];

const initialInterazioni: InterazioneCRM[] = [
    { id: 'crm_01', clienteId: 'az_01', data: '2024-07-20T10:00:00Z', tipo: InterazioneTipo.TELEFONATA, oggetto: 'Primo contatto per lab autunnali', descrizione: 'Chiamata con Paola Verdi, molto interessata. Inviare preventivo.', followUp: '2024-08-01' }
];


export function useMockData() {
    const [clienti, setClienti] = useState<Cliente[]>(initialClienti);
    const [fornitori, setFornitori] = useState<Fornitore[]>(initialFornitori);
    const [laboratori, setLaboratori] = useState<Laboratorio[]>(initialLaboratori);
    const [attivita, setAttivita] = useState<Attivita[]>(initialAttivita);
    const [materiali, setMateriali] = useState<Materiale[]>(initialMateriali);
    const [movimenti, setMovimenti] = useState<MovimentoFinance[]>(initialMovimenti);
    const [documenti, setDocumenti] = useState<Documento[]>(initialDocumenti);
    const [proposte, setProposte] = useState<PropostaCommerciale[]>(initialProposte);
    const [interazioni, setInterazioni] = useState<InterazioneCRM[]>(initialInterazioni);

    // Clienti CRUD
    const addCliente = useCallback((cliente: Omit<Cliente, 'id'>) => {
        setClienti(prev => [...prev, { ...cliente, id: `new_${Date.now()}` } as Cliente]);
    }, []);
    const updateCliente = useCallback((updatedCliente: Cliente) => {
        setClienti(prev => prev.map(c => c.id === updatedCliente.id ? updatedCliente : c));
    }, []);
    const deleteCliente = useCallback((clienteId: string) => {
        setClienti(prev => prev.filter(c => c.id !== clienteId));
    }, []);
    
    // Fornitori CRUD
    const addFornitore = useCallback((fornitore: Omit<Fornitore, 'id' | 'sedi'>) => {
        const newFornitore = { ...fornitore, id: `new_for_${Date.now()}`, sedi: [] } as Fornitore;
        setFornitori(prev => [...prev, newFornitore]);
    }, []);
    const updateFornitore = useCallback((updatedFornitore: Fornitore) => {
        setFornitori(prev => prev.map(f => f.id === updatedFornitore.id ? updatedFornitore : f));
    }, []);
    const deleteFornitore = useCallback((fornitoreId: string) => {
        setFornitori(prev => prev.filter(f => f.id !== fornitoreId));
    }, []);

    // Sedi CRUD
    const addSede = useCallback((fornitoreId: string, sede: Omit<Sede, 'id'|'fornitoreId'>) => {
        const newSede: Sede = { ...sede, id: `new_sede_${Date.now()}`, fornitoreId };
        setFornitori(prev => prev.map(f => f.id === fornitoreId ? { ...f, sedi: [...f.sedi, newSede] } : f));
    }, []);
    const updateSede = useCallback((fornitoreId: string, updatedSede: Sede) => {
        setFornitori(prev => prev.map(f => f.id === fornitoreId ? { ...f, sedi: f.sedi.map(s => s.id === updatedSede.id ? updatedSede : s) } : f));
    }, []);
    const deleteSede = useCallback((fornitoreId: string, sedeId: string) => {
        setFornitori(prev => prev.map(f => f.id === fornitoreId ? { ...f, sedi: f.sedi.filter(s => s.id !== sedeId) } : f));
    }, []);

    // Laboratori CRUD
    const addLaboratorio = useCallback((lab: Omit<Laboratorio, 'id'>) => {
        setLaboratori(prev => [...prev, { ...lab, id: `new_lab_${Date.now()}` }]);
    }, []);
    const updateLaboratorio = useCallback((updatedLab: Laboratorio) => {
        setLaboratori(prev => prev.map(l => l.id === updatedLab.id ? updatedLab : l));
    }, []);
    const deleteLaboratorio = useCallback((labId: string) => {
        setLaboratori(prev => prev.filter(l => l.id !== labId));
    }, []);

    // Attivita CRUD
    const addAttivita = useCallback((act: Omit<Attivita, 'id'>) => {
        setAttivita(prev => [...prev, { ...act, id: `new_act_${Date.now()}` }]);
    }, []);
    const updateAttivita = useCallback((updatedAct: Attivita) => {
        setAttivita(prev => prev.map(a => a.id === updatedAct.id ? updatedAct : a));
    }, []);
    const deleteAttivita = useCallback((actId: string) => {
        setAttivita(prev => prev.filter(a => a.id !== actId));
    }, []);
    
    // Materiali CRUD
    const addMateriale = useCallback((mat: Omit<Materiale, 'id'>) => {
        setMateriali(prev => [...prev, { ...mat, id: `new_mat_${Date.now()}` }]);
    }, []);
    const updateMateriale = useCallback((updatedMat: Materiale) => {
        setMateriali(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
    }, []);
    const deleteMateriale = useCallback((matId: string) => {
        setMateriali(prev => prev.filter(m => m.id !== matId));
    }, []);

    // Finance CRUD
    const addMovimento = useCallback((mov: Omit<MovimentoFinance, 'id'>) => {
        setMovimenti(prev => [...prev, { ...mov, id: `new_mov_${Date.now()}` }].sort((a, b) => b.data.localeCompare(a.data)));
    }, []);
    const updateMovimento = useCallback((updatedMov: MovimentoFinance) => {
        setMovimenti(prev => prev.map(m => m.id === updatedMov.id ? updatedMov : m).sort((a, b) => b.data.localeCompare(a.data)));
    }, []);
    const deleteMovimento = useCallback((movId: string) => {
        setMovimenti(prev => prev.filter(m => m.id !== movId));
    }, []);

    // Documenti CRUD
    const addDocumento = useCallback((doc: Omit<Documento, 'id'>) => {
        setDocumenti(prev => [...prev, { ...doc, id: `new_doc_${Date.now()}` }].sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione)));
    }, []);
    const updateDocumento = useCallback((updatedDoc: Documento) => {
        setDocumenti(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d).sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione)));
    }, []);
    const deleteDocumento = useCallback((docId: string) => {
        setDocumenti(prev => prev.filter(d => d.id !== docId));
    }, []);

    // Proposte CRUD
    const addProposta = useCallback((prop: Omit<PropostaCommerciale, 'id'>) => {
        setProposte(prev => [...prev, { ...prop, id: `new_prop_${Date.now()}` }].sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione)));
    }, []);
    const updateProposta = useCallback((updatedProp: PropostaCommerciale) => {
        setProposte(prev => prev.map(p => p.id === updatedProp.id ? updatedProp : p).sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione)));
    }, []);
    const deleteProposta = useCallback((propId: string) => {
        setProposte(prev => prev.filter(p => p.id !== propId));
    }, []);

    // Interazioni CRM CRUD
    const addInterazione = useCallback((int: Omit<InterazioneCRM, 'id'>) => {
        setInterazioni(prev => [...prev, { ...int, id: `new_int_${Date.now()}` }].sort((a, b) => b.data.localeCompare(a.data)));
    }, []);
    const updateInterazione = useCallback((updatedInt: InterazioneCRM) => {
        setInterazioni(prev => prev.map(i => i.id === updatedInt.id ? updatedInt : i).sort((a, b) => b.data.localeCompare(a.data)));
    }, []);
    const deleteInterazione = useCallback((intId: string) => {
        setInterazioni(prev => prev.filter(i => i.id !== intId));
    }, []);

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