import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { EMPTY_ATTIVITA_ANAGRAFICA, EMPTY_MATERIALE, MATERIALE_UBICAZIONE_OPTIONS } from '../../constants';
import { AttivitaAnagrafica, Materiale } from '../../types';

// --- FORM COMPONENT FOR ATTIVITA ---
const AttivitaForm: React.FC<{ 
    attivita: AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'>, 
    onSave: (attivita: AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'>) => void, 
    onCancel: () => void 
}> = ({ attivita, onSave, onCancel }) => {
    const [formData, setFormData] = useState(attivita);

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
                <Input id="nome" name="nome" label="Nome Attività" value={formData.nome} onChange={handleChange} required />
                <Input id="fasciaEta" name="fasciaEta" label="Fascia d'età consigliata (es. 3-5 anni)" value={formData.fasciaEta} onChange={handleChange} required />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Attività</Button>
            </div>
        </form>
    );
};

// --- FORM COMPONENT FOR MATERIALE ---
const MaterialeForm: React.FC<{
    materiale: Materiale | Omit<Materiale, 'id'>,
    onSave: (mat: Materiale | Omit<Materiale, 'id'>) => void,
    onCancel: () => void
}> = ({ materiale, onSave, onCancel }) => {
    const [formData, setFormData] = useState(materiale);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = ['quantita', 'prezzoAbituale'].includes(name) ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <Input id="nome" name="nome" label="Nome Breve Materiale" value={formData.nome} onChange={handleChange} required />
                 <Input id="descrizione" name="descrizione" label="Descrizione" value={formData.descrizione} onChange={handleChange} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="quantita" name="quantita" label="Quantità" type="number" value={formData.quantita} onChange={handleChange} required />
                    <Input id="unitaMisura" name="unitaMisura" label="Unità di Misura" value={formData.unitaMisura} onChange={handleChange} required />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="prezzoAbituale" name="prezzoAbituale" label="Prezzo Abituale (€)" type="number" step="0.01" value={formData.prezzoAbituale} onChange={handleChange} />
                    <Select id="ubicazione" name="ubicazione" label="Ubicazione" options={MATERIALE_UBICAZIONE_OPTIONS} value={formData.ubicazione} onChange={handleChange} required />
                 </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Materiale</Button>
            </div>
        </form>
    );
};


// --- MAIN COMPONENT ---
export const AnagraficaDistinteBase: React.FC = () => {
    const { 
        attivitaAnagrafica, addAttivitaAnagrafica, updateAttivitaAnagrafica, deleteAttivitaAnagrafica,
        materiali, addMateriale, updateMateriale
    } = useMockData();
    const [selectedAttivitaId, setSelectedAttivitaId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isAttivitaModalOpen, setIsAttivitaModalOpen] = useState(false);
    const [editingAttivita, setEditingAttivita] = useState<AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'> | null>(null);
    
    const [isMaterialeModalOpen, setIsMaterialeModalOpen] = useState(false);
    const [editingMateriale, setEditingMateriale] = useState<Materiale | Omit<Materiale, 'id'> | null>(null);

    const filteredAttivita = useMemo(() => {
        return attivitaAnagrafica.filter(a =>
            a.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [attivitaAnagrafica, searchTerm]);

    const selectedAttivita = useMemo(() => {
        if (!selectedAttivitaId) return null;
        return attivitaAnagrafica.find(a => a.id === selectedAttivitaId) || null;
    }, [selectedAttivitaId, attivitaAnagrafica]);

    const { associatedMateriali, availableMateriali } = useMemo(() => {
        if (!selectedAttivita) return { associatedMateriali: [], availableMateriali: [] };
        const associatedIds = new Set(selectedAttivita.materialiIds || []);
        const associated = materiali.filter(m => associatedIds.has(m.id));
        const available = materiali.filter(m => !associatedIds.has(m.id));
        return { associatedMateriali: associated, availableMateriali: available };
    }, [selectedAttivita, materiali]);

    // --- ATTIVITA HANDLERS ---
    const handleOpenAttivitaModal = (attivita?: AttivitaAnagrafica) => {
        setEditingAttivita(attivita || EMPTY_ATTIVITA_ANAGRAFICA);
        setIsAttivitaModalOpen(true);
    };

    const handleSaveAttivita = (attivitaData: AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'>) => {
        if ('id' in attivitaData && attivitaData.id) {
            updateAttivitaAnagrafica(attivitaData as AttivitaAnagrafica);
        } else {
            addAttivitaAnagrafica(attivitaData as Omit<AttivitaAnagrafica, 'id'>);
        }
        setIsAttivitaModalOpen(false);
    };

    const handleDeleteAttivita = (attivita: AttivitaAnagrafica) => {
        if (window.confirm(`Sei sicuro di voler eliminare l'attività "${attivita.nome}"? L'operazione non può essere annullata.`)) {
            deleteAttivitaAnagrafica(attivita.id);
            if(selectedAttivitaId === attivita.id) {
                setSelectedAttivitaId(null);
            }
        }
    };

    // --- MATERIALE HANDLERS ---
    const handleOpenMaterialeModal = (materiale?: Materiale) => {
        setEditingMateriale(materiale || EMPTY_MATERIALE);
        setIsMaterialeModalOpen(true);
    };
    
    const handleSaveMateriale = async (materialeData: Materiale | Omit<Materiale, 'id'>) => {
        if ('id' in materialeData && materialeData.id) {
            updateMateriale(materialeData as Materiale);
        } else {
            if (!selectedAttivita) return;
            const newMaterialeId = await addMateriale(materialeData as Omit<Materiale, 'id'>);
            if (newMaterialeId) {
                handleAssociateMateriale(newMaterialeId);
            }
        }
        setIsMaterialeModalOpen(false);
    };

    // --- RELATIONSHIP HANDLERS ---
    const handleAssociateMateriale = (materialeId: string) => {
        if (!selectedAttivita) return;
        const currentIds = selectedAttivita.materialiIds || [];
        if (currentIds.includes(materialeId)) return;
        const newIds = [...currentIds, materialeId];
        updateAttivitaAnagrafica({ ...selectedAttivita, materialiIds: newIds });
    };

    const handleDisassociateMateriale = (materialeId: string) => {
        if (!selectedAttivita) return;
        const currentIds = selectedAttivita.materialiIds || [];
        const newIds = currentIds.filter((id: string) => id !== materialeId);
        updateAttivitaAnagrafica({ ...selectedAttivita, materialiIds: newIds });
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* LEFT PANEL: ATTIVITA LIST */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h2 className="text-xl font-semibold">Attività</h2>
                    <Button onClick={() => handleOpenAttivitaModal()} icon={<PlusIcon />} size="sm">Nuova</Button>
                </div>
                <Input id="search-attivita" label="" placeholder="Cerca attività..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-2" />
                <div className="overflow-y-auto space-y-1 -mr-2 pr-2">
                    {filteredAttivita.map(a => (
                        <div key={a.id} className={`group flex items-center justify-between p-2 rounded-md cursor-pointer ${selectedAttivitaId === a.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} onClick={() => setSelectedAttivitaId(a.id)}>
                            <span>{a.nome}</span>
                            <div className="hidden group-hover:flex items-center">
                                <button onClick={(e) => { e.stopPropagation(); handleOpenAttivitaModal(a); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><PencilIcon className="h-4 w-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAttivita(a); }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><TrashIcon className="h-4 w-4 text-red-500" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT PANEL: MATERIALI MANAGEMENT */}
            <div className="lg:col-span-2 space-y-6">
                {!selectedAttivita ? (
                    <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                        <p className="text-gray-500">Seleziona un'attività per gestire i materiali.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                             <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-700">Materiali Associati</h3>
                             <div className="overflow-y-auto space-y-2 -mr-2 pr-2">
                                {associatedMateriali.map(m => (
                                    <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span>{m.nome}</span>
                                        <div className="flex items-center gap-1">
                                            <Button onClick={() => handleOpenMaterialeModal(m)} size="sm" variant="secondary">Modifica</Button>
                                            <Button onClick={() => handleDisassociateMateriale(m.id)} size="sm" variant="secondary">Disassocia</Button>
                                        </div>
                                    </div>
                                ))}
                                {associatedMateriali.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Nessun materiale associato.</p>}
                             </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
                             <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
                                <h3 className="text-lg font-semibold">Aggiungi Materiali</h3>
                                <Button onClick={() => handleOpenMaterialeModal()} size="sm" variant="primary" icon={<PlusIcon />}>Nuovo</Button>
                            </div>
                            <div className="overflow-y-auto space-y-2 -mr-2 pr-2">
                                {availableMateriali.map(m => (
                                    <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                        <span>{m.nome}</span>
                                        <Button onClick={() => handleAssociateMateriale(m.id)} size="sm">Associa</Button>
                                    </div>
                                ))}
                                {availableMateriali.length === 0 && <p className="text-sm text-center text-gray-500 py-4">Tutti i materiali sono già associati.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {isAttivitaModalOpen && editingAttivita && (
                <Modal isOpen={isAttivitaModalOpen} onClose={() => setIsAttivitaModalOpen(false)} title={'id' in editingAttivita ? "Modifica Attività" : "Nuova Attività"}>
                    <AttivitaForm attivita={editingAttivita} onSave={handleSaveAttivita} onCancel={() => setIsAttivitaModalOpen(false)} />
                </Modal>
            )}
             {isMaterialeModalOpen && editingMateriale && (
                <Modal isOpen={isMaterialeModalOpen} onClose={() => setIsMaterialeModalOpen(false)} title={'id' in editingMateriale && editingMateriale.id ? 'Modifica Materiale' : 'Nuovo Materiale'}>
                    <MaterialeForm materiale={editingMateriale} onSave={handleSaveMateriale} onCancel={() => setIsMaterialeModalOpen(false)} />
                </Modal>
            )}
        </div>
    );
};