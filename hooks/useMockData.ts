
import { useState, useCallback } from 'react';
import { ClienteClasse, ClienteTipo, ClienteStato, FornitoreTipo } from '../types';
import type { Cliente, Fornitore, Sede } from '../types';

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
            { id: 'sede_01', nome: 'Sala Arcobaleno', indirizzo: { via: 'Via Garibaldi', civico: '5', cap: '00153', citta: 'Roma', provincia: 'RM' }, capienzaMassima: 15, fasciaEta: '0-6 anni', costoNoloOra: 50 },
            { id: 'sede_02', nome: 'Sala Girasole', indirizzo: { via: 'Via Garibaldi', civico: '5', cap: '00153', citta: 'Roma', provincia: 'RM' }, capienzaMassima: 10, fasciaEta: '0-3 anni', costoNoloOra: 40 },
        ]
    }
];

export function useMockData() {
    const [clienti, setClienti] = useState<Cliente[]>(initialClienti);
    const [fornitori, setFornitori] = useState<Fornitore[]>(initialFornitori);

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
    const addSede = useCallback((fornitoreId: string, sede: Omit<Sede, 'id'>) => {
        const newSede = { ...sede, id: `new_sede_${Date.now()}`};
        setFornitori(prev => prev.map(f => {
            if (f.id === fornitoreId) {
                return { ...f, sedi: [...f.sedi, newSede] };
            }
            return f;
        }));
    }, []);

    const updateSede = useCallback((fornitoreId: string, updatedSede: Sede) => {
        setFornitori(prev => prev.map(f => {
            if (f.id === fornitoreId) {
                return { ...f, sedi: f.sedi.map(s => s.id === updatedSede.id ? updatedSede : s) };
            }
            return f;
        }));
    }, []);

    const deleteSede = useCallback((fornitoreId: string, sedeId: string) => {
        setFornitori(prev => prev.map(f => {
            if (f.id === fornitoreId) {
                return { ...f, sedi: f.sedi.filter(s => s.id !== sedeId) };
            }
            return f;
        }));
    }, []);


    return {
        clienti, addCliente, updateCliente, deleteCliente,
        fornitori, addFornitore, updateFornitore, deleteFornitore,
        addSede, updateSede, deleteSede
    };
}