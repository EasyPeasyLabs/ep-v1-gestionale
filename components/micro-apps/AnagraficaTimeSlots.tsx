import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { TimeSlotDef } from '../../types';
import { EMPTY_TIMESLOT_DEF } from '../../constants';

// Form Component
const TimeSlotForm: React.FC<{
    timeSlotDef: TimeSlotDef | Omit<TimeSlotDef, 'id'>,
    onSave: (data: TimeSlotDef | Omit<TimeSlotDef, 'id'>) => void,
    onCancel: () => void
}> = ({ timeSlotDef, onSave, onCancel }) => {
    const [formData, setFormData] = useState(timeSlotDef);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const valueToSet = e.target.type === 'number' ? parseInt(value, 10) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input id="nome" name="nome" label="Nome (es. 1 Ora, Lezione Standard)" value={formData.nome} onChange={handleChange} required />
                <Input id="valoreInMinuti" name="valoreInMinuti" label="Durata (in minuti)" type="number" value={formData.valoreInMinuti} onChange={handleChange} required />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva</Button>
            </div>
        </form>
    );
};

// Main Component
export const AnagraficaTimeSlots: React.FC = () => {
    const { timeSlotsDef, addTimeSlotDef, updateTimeSlotDef, deleteTimeSlotDef } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<TimeSlotDef | Omit<TimeSlotDef, 'id'> | null>(null);

    const handleOpenModal = (item?: TimeSlotDef) => {
        setEditingItem(item || EMPTY_TIMESLOT_DEF);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSave = (data: TimeSlotDef | Omit<TimeSlotDef, 'id'>) => {
        if ('id' in data && data.id) {
            updateTimeSlotDef(data as TimeSlotDef);
        } else {
            addTimeSlotDef(data as Omit<TimeSlotDef, 'id'>);
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa definizione di time slot?")) {
            deleteTimeSlotDef(id);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Durata Time Slot</Button>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Durata (minuti)</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlotsDef.map(item => (
                            <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{item.nome}</th>
                                <td className="px-6 py-4">{item.valoreInMinuti}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {timeSlotsDef.length === 0 && (
                             <tr><td colSpan={3} className="text-center py-8 text-gray-500">Nessuna definizione trovata.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingItem && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingItem && editingItem.id) ? 'Modifica Durata' : 'Nuova Durata'}>
                    <TimeSlotForm timeSlotDef={editingItem} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};