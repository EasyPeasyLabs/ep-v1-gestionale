import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { EMPTY_FIGLIO_ANAGRAFICA } from '../../constants';
import { FiglioAnagrafica } from '../../types';

const getInitialFormData = (): Omit<FiglioAnagrafica, 'id'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = EMPTY_FIGLIO_ANAGRAFICA;
    return rest;
};

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

export const AnagraficaFigli: React.FC = () => {
    const { figli, addFiglio, updateFiglio, deleteFiglio } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFiglio, setEditingFiglio] = useState<FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'> | null>(null);

    const handleOpenModal = (figlio?: FiglioAnagrafica) => {
        setEditingFiglio(figlio || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingFiglio(null);
        setIsModalOpen(false);
    };

    const handleSaveFiglio = (figlio: FiglioAnagrafica | Omit<FiglioAnagrafica, 'id'>) => {
        if ('id' in figlio && figlio.id) {
            updateFiglio(figlio as FiglioAnagrafica);
        } else {
            addFiglio(figlio as Omit<FiglioAnagrafica, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteFiglio = (figlioId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo figlio?')) {
            deleteFiglio(figlioId);
        }
    }

    const formatLastModified = (isoDate?: string) => {
        if (!isoDate) return '-';
        return new Date(isoDate).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Figlio</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Età</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {figli.map(figlio => (
                            <tr key={figlio.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {figlio.nome}
                                </th>
                                <td className="px-6 py-4">{figlio.eta}</td>
                                <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(figlio.lastModified)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(figlio)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteFiglio(figlio.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {figli.length === 0 && (
                             <tr>
                                 <td colSpan={4} className="text-center py-8 text-gray-500">Nessun figlio trovato.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingFiglio && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={('id' in editingFiglio && editingFiglio.id) ? 'Modifica Figlio' : 'Nuovo Figlio'}
                >
                    <FiglioForm figlio={editingFiglio} onSave={handleSaveFiglio} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};