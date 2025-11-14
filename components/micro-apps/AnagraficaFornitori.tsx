import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { EMPTY_FORNITORE_ANAGRAFICA } from '../../constants';
import { FornitoreAnagrafica, Indirizzo } from '../../types';

const getInitialFormData = (): Omit<FornitoreAnagrafica, 'id'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = EMPTY_FORNITORE_ANAGRAFICA;
    return rest;
};

const FornitoreForm: React.FC<{ 
    fornitore: FornitoreAnagrafica | Omit<FornitoreAnagrafica, 'id'>, 
    onSave: (fornitore: FornitoreAnagrafica | Omit<FornitoreAnagrafica, 'id'>) => void, 
    onCancel: () => void 
}> = ({ fornitore, onSave, onCancel }) => {
    const [formData, setFormData] = useState(fornitore);

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
                    <Input id="ragioneSociale" name="ragioneSociale" label="Ragione Sociale" value={formData.ragioneSociale} onChange={handleChange} required />
                    <Input id="partitaIva" name="partitaIva" label="Partita IVA" value={formData.partitaIva} onChange={handleChange} required />
                </div>
                <Input id="referente" name="referente" label="Referente" value={formData.referente} onChange={handleChange} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input id="email" name="email" label="Email" type="email" value={formData.email} onChange={handleChange} />
                     <Input id="telefono" name="telefono" label="Telefono" value={formData.telefono} onChange={handleChange} />
                </div>
                
                <div className="pt-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Indirizzo Sede Legale</h4>
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
                 <Button type="submit" variant="primary">Salva Fornitore</Button>
            </div>
        </form>
    );
};

export const AnagraficaFornitori: React.FC = () => {
    const { fornitoriAnagrafica, addFornitoreAnagrafica, updateFornitoreAnagrafica, deleteFornitoreAnagrafica } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFornitore, setEditingFornitore] = useState<FornitoreAnagrafica | Omit<FornitoreAnagrafica, 'id'> | null>(null);

    const handleOpenModal = (fornitore?: FornitoreAnagrafica) => {
        setEditingFornitore(fornitore || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingFornitore(null);
        setIsModalOpen(false);
    };

    const handleSaveFornitore = (fornitore: FornitoreAnagrafica | Omit<FornitoreAnagrafica, 'id'>) => {
        if ('id' in fornitore && fornitore.id) {
            updateFornitoreAnagrafica(fornitore as FornitoreAnagrafica);
        } else {
            addFornitoreAnagrafica(fornitore as Omit<FornitoreAnagrafica, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteFornitore = (fornitoreId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo fornitore?')) {
            deleteFornitoreAnagrafica(fornitoreId);
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
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Fornitore</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Ragione Sociale</th>
                            <th scope="col" className="px-6 py-3">Contatti</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fornitoriAnagrafica.map(fornitore => (
                            <tr key={fornitore.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {fornitore.ragioneSociale}
                                </th>
                                <td className="px-6 py-4 text-xs">
                                    <div>{fornitore.referente}</div>
                                    <div>{fornitore.email} | {fornitore.telefono}</div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(fornitore.lastModified)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(fornitore)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteFornitore(fornitore.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {fornitoriAnagrafica.length === 0 && (
                             <tr>
                                 <td colSpan={4} className="text-center py-8 text-gray-500">Nessun fornitore trovato.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingFornitore && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={('id' in editingFornitore && editingFornitore.id) ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
                >
                    <FornitoreForm fornitore={editingFornitore} onSave={handleSaveFornitore} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};