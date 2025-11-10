import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Durata } from '../../types';
import { EMPTY_DURATA, DURATA_TIPO_OPTIONS } from '../../constants';

const DurataForm: React.FC<{
    durata: Durata | Omit<Durata, 'id'>,
    onSave: (dur: Durata | Omit<Durata, 'id'>) => void,
    onCancel: () => void
}> = ({ durata, onSave, onCancel }) => {
    const [formData, setFormData] = useState(durata);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = name === 'valore' ? parseInt(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <Input id="nome" name="nome" label="Nome Durata (es. 'Corso Trimestrale')" value={formData.nome} onChange={handleChange} required />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="tipo" name="tipo" label="Tipo Unità" options={DURATA_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                    <Input id="valore" name="valore" label="Valore" type="number" min="1" value={formData.valore} onChange={handleChange} required />
                 </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Durata</Button>
            </div>
        </form>
    );
};


export const Durate: React.FC = () => {
    const { durate, addDurata, updateDurata, deleteDurata } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDurata, setEditingDurata] = useState<Durata | Omit<Durata, 'id'> | null>(null);

    const handleOpenModal = (dur?: Durata) => {
        setEditingDurata(dur || { ...EMPTY_DURATA });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingDurata(null);
        setIsModalOpen(false);
    };

    const handleSave = (dur: Durata | Omit<Durata, 'id'>) => {
        if ('id' in dur && dur.id) {
            updateDurata(dur);
        } else {
            addDurata(dur);
        }
        handleCloseModal();
    };
    
    const handleDelete = (durId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo modello di durata?')) {
            deleteDurata(durId);
        }
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Modelli di Durata</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Durata</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Durata</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {durate.map(dur => (
                            <tr key={dur.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{dur.nome}</th>
                                <td className="px-6 py-4">{dur.valore} {dur.tipo}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(dur)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(dur.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {durate.length === 0 && (
                             <tr>
                                 <td colSpan={3} className="text-center py-8 text-gray-500">Nessun modello di durata trovato.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingDurata && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingDurata && editingDurata.id ? 'Modifica Durata' : 'Nuova Durata'}>
                    <DurataForm durata={editingDurata} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};