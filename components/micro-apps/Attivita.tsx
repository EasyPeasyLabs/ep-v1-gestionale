import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, StarIcon } from '../icons/Icons';
import { Attivita as AttivitaType, Materiale, AttivitaTipoDef } from '../../types';
// FIX: Corrected typo in constant name from EMPTY_ATTIVita to EMPTY_ATTIVITA.
import { EMPTY_ATTIVITA, ATTIVITA_STATO_OPTIONS } from '../../constants';

const TipiManagerModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    tipi: AttivitaTipoDef[],
    onAdd: (nome: string) => void,
    onDelete: (id: string) => void,
}> = ({ isOpen, onClose, tipi, onAdd, onDelete }) => {
    const [newTipo, setNewTipo] = useState('');

    const handleAdd = () => {
        if (newTipo.trim()) {
            onAdd(newTipo.trim());
            setNewTipo('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestisci Tipi di Attività">
            <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 dark:border-gray-600">
                    {tipi.length === 0 && <p className="text-gray-500 text-center p-4">Nessun tipo definito.</p>}
                    <ul className="divide-y dark:divide-gray-700">
                        {tipi.map(tipo => (
                            <li key={tipo.id} className="flex justify-between items-center p-2">
                                <span>{tipo.nome}</span>
                                <Button variant="danger" onClick={() => onDelete(tipo.id)}><TrashIcon /></Button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex gap-2 items-end">
                    <Input id="newTipo" name="newTipo" label="Nuovo Tipo" value={newTipo} onChange={(e) => setNewTipo(e.target.value)} />
                    <Button type="button" onClick={handleAdd} icon={<PlusIcon />}>Aggiungi</Button>
                </div>
            </div>
        </Modal>
    )
}

const AttivitaForm: React.FC<{
    attivita: AttivitaType,
    materiali: Materiale[],
    tipi: AttivitaTipoDef[],
    onSave: (act: AttivitaType) => void,
    onCancel: () => void,
    onManageTipi: () => void,
}> = ({ attivita, materiali, tipi, onSave, onCancel, onManageTipi }) => {
    const [formData, setFormData] = useState(attivita);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = name === 'rating' ? parseInt(value) : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };
    
    const handleMaterialToggle = (materialId: string) => {
        setFormData(prev => {
            const newMateriali = prev.materiali.includes(materialId)
                ? prev.materiali.filter(id => id !== materialId)
                : [...prev.materiali, materialId];
            return { ...prev, materiali: newMateriali };
        });
    };

    const totalCost = useMemo(() => {
        return formData.materiali.reduce((sum, matId) => {
            const material = materiali.find(m => m.id === matId);
            return sum + (material?.prezzoAbituale || 0);
        }, 0);
    }, [formData.materiali, materiali]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <Input id="titolo" name="titolo" label="Titolo Attività" value={formData.titolo} onChange={handleChange} required />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                             <Select id="tipo" name="tipo" label="Tipo" value={formData.tipo} onChange={handleChange} required>
                                <option value="">Seleziona...</option>
                                {tipi.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                             </Select>
                        </div>
                        <Button type="button" variant="secondary" onClick={onManageTipi}>Gestisci</Button>
                     </div>
                     <Select id="stato" name="stato" label="Stato" options={ATTIVITA_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                 </div>
                 <Input id="rating" name="rating" label="Rating (1-5)" type="number" min="1" max="5" value={formData.rating} onChange={handleChange} required />
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Materiali</label>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 dark:border-gray-600 space-y-1">
                        {materiali.length === 0 && <p className="text-gray-500 text-sm text-center p-2">Nessun materiale in inventario.</p>}
                        {materiali.map(mat => (
                            <div key={mat.id} className="flex items-center">
                                <input
                                    type="checkbox"
                                    id={`mat-${mat.id}`}
                                    checked={formData.materiali.includes(mat.id)}
                                    onChange={() => handleMaterialToggle(mat.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-600"
                                />
                                <label htmlFor={`mat-${mat.id}`} className="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                                    {mat.nome} <span className="text-xs text-gray-500">({mat.prezzoAbituale.toFixed(2)}€)</span>
                                </label>
                            </div>
                        ))}
                    </div>
                 </div>

                <div>
                    <label htmlFor="costoMateriali" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Costo Totale Materiali</label>
                    <div className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-600 dark:border-gray-600 dark:text-white">
                        {totalCost.toFixed(2)}€
                    </div>
                </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Attività</Button>
            </div>
        </form>
    );
};


export const Attivita: React.FC = () => {
    const { attivita, addAttivita, updateAttivita, deleteAttivita, materiali, attivitaTipi, addAttivitaTipo, deleteAttivitaTipo } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTipiModalOpen, setIsTipiModalOpen] = useState(false);
    const [editingAttivita, setEditingAttivita] = useState<AttivitaType | null>(null);

    const handleOpenModal = (act?: AttivitaType) => {
        setEditingAttivita(act || { ...EMPTY_ATTIVITA });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingAttivita(null);
        setIsModalOpen(false);
    };

    const handleSave = (act: AttivitaType) => {
        if (act.id) {
            updateAttivita(act);
        } else {
            const { id, ...newAct } = act;
            addAttivita(newAct);
        }
        handleCloseModal();
    };
    
    const handleDelete = (actId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questa attività?')) {
            deleteAttivita(actId);
        }
    }
    
    const handleAddTipo = async (nome: string) => {
        if (attivitaTipi.some(t => t.nome.toLowerCase() === nome.toLowerCase())) {
            alert("Questo tipo di attività esiste già.");
            return;
        }
        await addAttivitaTipo({ nome });
    };
    
    const handleDeleteTipo = async (id: string) => {
        const tipoToDelete = attivitaTipi.find(t=> t.id === id);
        if (attivita.some(a => a.tipo === tipoToDelete?.nome)) {
            alert("Impossibile eliminare un tipo in uso da una o più attività.");
            return;
        }
        if (window.confirm(`Sei sicuro di voler eliminare il tipo "${tipoToDelete?.nome}"?`)) {
            await deleteAttivitaTipo(id);
        }
    };


    const StarRatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <StarIcon key={i} filled={i < rating} />
            ))}
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Attività</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Attività</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Titolo</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3">Rating</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attivita.map(act => (
                            <tr key={act.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{act.titolo}</th>
                                <td className="px-6 py-4">{act.tipo}</td>
                                <td className="px-6 py-4">{act.stato}</td>
                                <td className="px-6 py-4"><StarRatingDisplay rating={act.rating} /></td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(act)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(act.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {attivita.length === 0 && (
                             <tr>
                                 <td colSpan={5} className="text-center py-8 text-gray-500">Nessuna attività trovata.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingAttivita && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingAttivita.id ? 'Modifica Attività' : 'Nuova Attività'}>
                    <AttivitaForm 
                        attivita={editingAttivita} 
                        materiali={materiali}
                        tipi={attivitaTipi}
                        onSave={handleSave} 
                        onCancel={handleCloseModal}
                        onManageTipi={() => setIsTipiModalOpen(true)}
                    />
                </Modal>
            )}

            <TipiManagerModal 
                isOpen={isTipiModalOpen}
                onClose={() => setIsTipiModalOpen(false)}
                tipi={attivitaTipi}
                onAdd={handleAddTipo}
                onDelete={handleDeleteTipo}
            />
        </div>
    );
};