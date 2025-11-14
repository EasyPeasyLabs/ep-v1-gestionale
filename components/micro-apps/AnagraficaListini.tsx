import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { ListinoDef } from '../../types';
import { EMPTY_LISTINO_DEF } from '../../constants';

// Form Component
const ListinoDefForm: React.FC<{
    listinoDef: ListinoDef | Omit<ListinoDef, 'id'>,
    onSave: (data: ListinoDef | Omit<ListinoDef, 'id'>) => void,
    onCancel: () => void
}> = ({ listinoDef, onSave, onCancel }) => {
    const [formData, setFormData] = useState(listinoDef);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const valueToSet = e.target.type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input id="tipo" name="tipo" label="Tipo di Listino" value={formData.tipo} onChange={handleChange} required />
                <Input id="prezzo" name="prezzo" label="Prezzo (€)" type="number" step="0.01" value={formData.prezzo} onChange={handleChange} required />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva</Button>
            </div>
        </form>
    );
};

// Main Component
export const AnagraficaListini: React.FC = () => {
    const { listiniDef, addListinoDef, updateListinoDef, deleteListinoDef } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ListinoDef | Omit<ListinoDef, 'id'> | null>(null);

    const handleOpenModal = (item?: ListinoDef) => {
        setEditingItem(item || EMPTY_LISTINO_DEF);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSave = (data: ListinoDef | Omit<ListinoDef, 'id'>) => {
        if ('id' in data && data.id) {
            updateListinoDef(data as ListinoDef);
        } else {
            addListinoDef(data as Omit<ListinoDef, 'id'>);
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo listino?")) {
            deleteListinoDef(id);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Listino</Button>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Tipo di Listino</th>
                            <th scope="col" className="px-6 py-3">Prezzo</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {listiniDef.map(item => (
                            <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{item.tipo}</th>
                                <td className="px-6 py-4">{formatCurrency(item.prezzo)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {listiniDef.length === 0 && (
                             <tr><td colSpan={3} className="text-center py-8 text-gray-500">Nessun listino trovato.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingItem && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingItem && editingItem.id) ? 'Modifica Listino' : 'Nuovo Listino'}>
                    <ListinoDefForm listinoDef={editingItem} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};