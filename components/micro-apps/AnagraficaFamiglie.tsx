import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon, AlertIcon } from '../icons/Icons';
import { EMPTY_GENITORE_ANAGRAFICA, EMPTY_FIGLIO_ANAGRAFICA } from '../../constants';
import { GenitoreAnagrafica, FiglioAnagrafica, Indirizzo, Iscrizione, PromemoriaStato } from '../../types';

// --- FORM COMPONENT FOR GENITORE ---
const GenitoreForm: React.FC<{
    genitore: GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'>,
    onSave: (genitore: GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'>) => void,
    onCancel: () => void
}> = ({ genitore, onSave, onCancel }) => {
    const [formData, setFormData] = useState(genitore);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleIndirizzoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            indirizzo: {
                ...(prev.indirizzo as Indirizzo),
                [name]: value
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="cognome" name="cognome" label="Cognome" value={formData.cognome} onChange={handleChange} required />
                    <Input id="nome" name="nome" label="Nome" value={formData.nome} onChange={handleChange} required />
                </div>
                <Input id="codiceFiscale" name="codiceFiscale" label="Codice Fiscale" value={formData.codiceFiscale} onChange={handleChange} required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input id="email" name="email" label="Email" type="email" value={formData.email} onChange={handleChange} />
                     <Input id="telefono" name="telefono" label="Telefono" value={formData.telefono} onChange={handleChange} />
                </div>
                <div className="pt-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Indirizzo di Residenza</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div className="md:col-span-2">
                            <Input id="via" name="via" label="Via / Piazza" value={formData.indirizzo.via} onChange={handleIndirizzoChange} />
                        </div>
                        <Input id="civico" name="civico" label="N. Civico" value={formData.indirizzo.civico} onChange={handleIndirizzoChange} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <Input id="cap" name="cap" label="CAP" value={formData.indirizzo.cap} onChange={handleIndirizzoChange} />
                        <Input id="citta" name="citta" label="Città" value={formData.indirizzo.citta} onChange={handleIndirizzoChange} />
                        <Input id="provincia" name="provincia" label="Provincia" value={formData.indirizzo.provincia} onChange={handleIndirizzoChange} />
                    </div>
                </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Genitore</Button>
            </div>
        </form>
    );
};

// --- FORM COMPONENT FOR FIGLIO ---
const FiglioForm: React.FC<{
    figlio: FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'>,
    onSave: (figlio: FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'>) => void,
    onCancel: () => void
}> = ({ figlio, onSave, onCancel }) => {
    const [formData, setFormData] = useState(figlio);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input id="nome" name="nome" label="Nome" value={formData.nome} onChange={handleChange} required />
                <Input id="eta" name="eta" label="Età (es. 5 anni)" value={formData.eta} onChange={handleChange} required />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Figlio</Button>
            </div>
        </form>
    );
};


// --- MAIN COMPONENT ---
export const AnagraficaFamiglie: React.FC = () => {
    const { genitori, figli, addGenitore, updateGenitore, deleteGenitore, addFiglio, updateFiglio, iscrizioni, laboratori, promemoria } = useMockData();
    const [selectedGenitoreId, setSelectedGenitoreId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isGenitoreModalOpen, setIsGenitoreModalOpen] = useState(false);
    const [editingGenitore, setEditingGenitore] = useState<GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'> | null>(null);
    
    const [isFiglioModalOpen, setIsFiglioModalOpen] = useState(false);
    const [editingFiglio, setEditingFiglio] = useState<FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'> | null>(null);

    const filteredGenitori = useMemo(() => {
        return genitori.filter(g =>
            `${g.cognome} ${g.nome}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [genitori, searchTerm]);

    const selectedGenitore = useMemo(() => {
        if (!selectedGenitoreId) return null;
        return genitori.find(g => g.id === selectedGenitoreId) || null;
    }, [selectedGenitoreId, genitori]);

    const { associatedFigli, availableFigli } = useMemo(() => {
        if (!selectedGenitore) return { associatedFigli: [], availableFigli: [] };
        const associatedIds = new Set(selectedGenitore.figliIds || []);
        const associated = figli.filter(f => associatedIds.has(f.id));
        const available = figli.filter(f => !associatedIds.has(f.id));
        return { associatedFigli: associated, availableFigli: available };
    }, [selectedGenitore, figli]);

    const genitoreIscrizioniDetails = useMemo(() => {
        const map = new Map<string, { codice: string, scadenza: boolean }[]>();
        genitori.forEach(g => {
            const iscrizioniAttive = (g.iscrizioniIds || [])
                .map(iscId => iscrizioni.find(i => i.id === iscId))
                .filter(Boolean) as Iscrizione[];
            
            const details = iscrizioniAttive.map(isc => {
                const prom = promemoria.find(p => p.iscrizioneId === isc.id);
                let scadenza = false;
                if (prom && prom.stato === PromemoriaStato.ATTIVO) {
                    const oggi = new Date();
                    oggi.setHours(0, 0, 0, 0);
                    const scadenzaDate = new Date(prom.dataScadenza);
                    const diffTime = scadenzaDate.getTime() - oggi.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7 && diffDays >= 0) { // Considera in scadenza da 7 giorni prima
                        scadenza = true;
                    }
                }
                return {
                    codice: laboratori.find(l => l.id === isc.laboratorioId)?.codice || 'N/D',
                    scadenza
                };
            });
            map.set(g.id, details);
        });
        return map;
    }, [genitori, iscrizioni, promemoria, laboratori]);

    // --- GENITORE HANDLERS ---
    const handleOpenGenitoreModal = (genitore?: GenitoreAnagrafica) => {
        setEditingGenitore(genitore || EMPTY_GENITORE_ANAGRAFICA);
        setIsGenitoreModalOpen(true);
    };

    const handleSaveGenitore = (genitoreData: GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'>) => {
        if ('id' in genitoreData && genitoreData.id) {
            updateGenitore(genitoreData as GenitoreAnagrafica);
        } else {
            addGenitore(genitoreData as Omit<GenitoreAnagrafica, 'id'>);
        }
        setIsGenitoreModalOpen(false);
    };

    const handleDeleteGenitore = (genitore: GenitoreAnagrafica) => {
        if (window.confirm(`Sei sicuro di voler eliminare ${genitore.nome} ${genitore.cognome}? L'operazione non può essere annullata.`)) {
            deleteGenitore(genitore.id);
            if(selectedGenitoreId === genitore.id) {
                setSelectedGenitoreId(null);
            }
        }
    };

    // --- FIGLIO HANDLERS ---
    const handleOpenFiglioModal = (figlio?: FiglioAnagrafica) => {
        setEditingFiglio(figlio || EMPTY_FIGLIO_ANAGRAFICA);
        setIsFiglioModalOpen(true);
    };
    
    const handleSaveFiglio = async (figlioData: FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'>) => {
        if ('id' in figlioData && figlioData.id) {
            updateFiglio(figlioData as FiglioAnagrafica);
        } else {
            if (!selectedGenitore) return;
            const newFiglioId = await addFiglio(figlioData as Omit<FiglioAnagrafica, 'id'>);
            if (newFiglioId) {
                handleAssociateFiglio(newFiglioId);
            }
        }
        setIsFiglioModalOpen(false);
    };

    // --- RELATIONSHIP HANDLERS ---
    const handleAssociateFiglio = (figlioId: string) => {
        if (!selectedGenitore) return;
        const currentIds = selectedGenitore.figliIds || [];
        if (currentIds.includes(figlioId)) return;
        const newIds = [...currentIds, figlioId];
        updateGenitore({ ...selectedGenitore, figliIds: newIds });
    };

    const handleDisassociateFiglio = (figlioId: string) => {
        if (!selectedGenitore) return;
        const currentIds = selectedGenitore.figliIds || [];
        const newIds = currentIds.filter((id: string) => id !== figlioId);
        updateGenitore({ ...selectedGenitore, figliIds: newIds });
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h2 className="text-xl font-semibold">Genitori</h2>
                    <Button onClick={() => handleOpenGenitoreModal()} icon={<PlusIcon />} size="sm">Nuovo</Button>
                </div>
                <Input id="search-genitore" label="" placeholder="Cerca genitore..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-2" />
                <div className="overflow-y-auto space-y-1 -mr-2 pr-2">
                    {filteredGenitori.map(g => {
                        const iscrizioniDetails = genitoreIscrizioniDetails.get(g.id) || [];
                        const isScadenza = iscrizioniDetails.some(d => d.scadenza);
                        return (
                            <div key={g.id} className={`group p-2 rounded-md cursor-pointer ${selectedGenitoreId === g.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onClick={() => setSelectedGenitoreId(g.id)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isScadenza && <AlertIcon className="h-5 w-5 text-yellow-400" />}
                                        <span className={selectedGenitoreId === g.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>{g.cognome} {g.nome}</span>
                                    </div>
                                    <div className="hidden group-hover:flex items-center">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenGenitoreModal(g); }} className={`p-1 rounded ${selectedGenitoreId === g.id ? 'hover:bg-blue-500' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}><PencilIcon className="h-4 w-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteGenitore(g); }} className={`p-1 rounded ${selectedGenitoreId === g.id ? 'hover:bg-blue-500' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}><TrashIcon className="h-4 w-4 text-red-500" /></button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1 pl-1">
                                    {iscrizioniDetails.map((d, i) => (
                                        <span key={i} className={`text-xs font-mono px-1.5 py-0.5 rounded ${selectedGenitoreId === g.id ? 'bg-blue-400 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>{d.codice}</span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
                {!selectedGenitore ? (
                    <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                        <p className="text-gray-500">Seleziona un genitore per gestire i figli.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                             <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-700">Figli Associati</h3>
                             <div className="overflow-y-auto space-y-2 -mr-2 pr-2">
                                {associatedFigli.map(f => (
                                    <div key={f.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span>{f.nome} ({f.eta})</span>
                                        <div className="flex items-center gap-1">
                                            <Button onClick={() => handleOpenFiglioModal(f)} size="sm" variant="secondary">Modifica</Button>
                                            <Button onClick={() => handleDisassociateFiglio(f.id)} size="sm" variant="secondary">Disassocia</Button>
                                        </div>
                                    </div>
                                ))}
                                {associatedFigli.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Nessun figlio associato.</p>}
                             </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                             <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
                                <h3 className="text-lg font-semibold">Aggiungi Figli</h3>
                                <Button onClick={() => handleOpenFiglioModal()} size="sm" variant="primary" icon={<PlusIcon />}>Nuovo</Button>
                            </div>
                            <div className="overflow-y-auto space-y-2 -mr-2 pr-2">
                                {availableFigli.map(f => (
                                    <div key={f.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span>{f.nome} ({f.eta})</span>
                                        <Button onClick={() => handleAssociateFiglio(f.id)} size="sm">Associa</Button>
                                    </div>
                                ))}
                                {availableFigli.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Tutti i figli sono già associati.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isGenitoreModalOpen && editingGenitore && (
                <Modal isOpen={isGenitoreModalOpen} onClose={() => setIsGenitoreModalOpen(false)} title={'id' in editingGenitore ? 'Modifica Genitore' : 'Nuovo Genitore'}>
                    <GenitoreForm genitore={editingGenitore} onSave={handleSaveGenitore} onCancel={() => setIsGenitoreModalOpen(false)} />
                </Modal>
            )}
             {isFiglioModalOpen && editingFiglio && (
                <Modal isOpen={isFiglioModalOpen} onClose={() => setIsFiglioModalOpen(false)} title={'id' in editingFiglio && editingFiglio.id ? 'Modifica Figlio' : 'Nuovo Figlio'}>
                    <FiglioForm figlio={editingFiglio} onSave={handleSaveFiglio} onCancel={() => setIsFiglioModalOpen(false)} />
                </Modal>
            )}
        </div>
    );
};