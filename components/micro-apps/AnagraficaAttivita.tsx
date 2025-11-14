import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { EMPTY_ATTIVITA_ANAGRAFICA } from '../../constants';
import { AttivitaAnagrafica } from '../../types';

const getInitialFormData = (): Omit<AttivitaAnagrafica, 'id'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = EMPTY_ATTIVITA_ANAGRAFICA;
    return rest;
};

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

export const AnagraficaAttivita: React.FC = () => {
    const { attivitaAnagrafica, addAttivitaAnagrafica, updateAttivitaAnagrafica, deleteAttivitaAnagrafica } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAttivita, setEditingAttivita] = useState<AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'> | null>(null);

    const handleOpenModal = (attivita?: AttivitaAnagrafica) => {
        setEditingAttivita(attivita || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingAttivita(null);
        setIsModalOpen(false);
    };

    const handleSaveAttivita = (attivita: AttivitaAnagrafica | Omit<AttivitaAnagrafica, 'id'>) => {
        if ('id' in attivita && attivita.id) {
            updateAttivitaAnagrafica(attivita as AttivitaAnagrafica);
        } else {
            addAttivitaAnagrafica(attivita as Omit<AttivitaAnagrafica, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteAttivita = (attivitaId: string) => {
        if(window.confirm("Sei sicuro di voler eliminare questo modello di attività?")) {
            deleteAttivitaAnagrafica(attivitaId);
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
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Attività</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Fascia d'età</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attivitaAnagrafica.map(attivita => (
                            <tr key={attivita.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {attivita.nome}
                                </th>
                                <td className="px-6 py-4">{attivita.fasciaEta}</td>
                                <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(attivita.lastModified)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(attivita)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteAttivita(attivita.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {attivitaAnagrafica.length === 0 && (
                             <tr>
                                 <td colSpan={4} className="text-center py-8 text-gray-500">Nessuna attività trovata.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingAttivita && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={('id' in editingAttivita && editingAttivita.id) ? "Modifica Attività" : "Nuova Attività"}
                >
                    <AttivitaForm attivita={editingAttivita} onSave={handleSaveAttivita} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};