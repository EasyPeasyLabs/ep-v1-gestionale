import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, StarIcon } from '../icons/Icons';
// FIX: Renamed imported type to avoid name collision with the component.
import { Attivita as AttivitaType } from '../../types';
import { EMPTY_ATTIVITA, ATTIVITA_STATO_OPTIONS, ATTIVITA_TIPO_OPTIONS } from '../../constants';

const AttivitaForm: React.FC<{
    attivita: AttivitaType,
    onSave: (act: AttivitaType) => void,
    onCancel: () => void
}> = ({ attivita, onSave, onCancel }) => {
    const [formData, setFormData] = useState(attivita);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = name === 'rating' ? parseInt(value) : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <Input id="titolo" name="titolo" label="Titolo Attività" value={formData.titolo} onChange={handleChange} required />
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Select id="tipo" name="tipo" label="Tipo" options={ATTIVITA_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                     <Select id="stato" name="stato" label="Stato" options={ATTIVITA_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                     <Input id="rating" name="rating" label="Rating (1-5)" type="number" min="1" max="5" value={formData.rating} onChange={handleChange} required />
                 </div>
                 <Input id="materiali" name="materiali" label="Materiali (ID, separati da virgola)" value={formData.materiali.join(',')} onChange={e => setFormData(prev => ({...prev, materiali: e.target.value.split(',').map(m => m.trim())}))} />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Attività</Button>
            </div>
        </form>
    );
};


export const Attivita: React.FC = () => {
    const { attivita, addAttivita, updateAttivita, deleteAttivita } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
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
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingAttivita && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingAttivita.id ? 'Modifica Attività' : 'Nuova Attività'}>
                    <AttivitaForm attivita={editingAttivita} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};