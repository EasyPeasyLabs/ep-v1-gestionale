import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { EMPTY_GENITORE_ANAGRAFICA } from '../../constants';
import { GenitoreAnagrafica, Indirizzo } from '../../types';

const getInitialFormData = (): Omit<GenitoreAnagrafica, 'id'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = EMPTY_GENITORE_ANAGRAFICA;
    return rest;
};

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

export const AnagraficaGenitori: React.FC = () => {
    const { genitori, addGenitore, updateGenitore, deleteGenitore } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGenitore, setEditingGenitore] = useState<GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'> | null>(null);

    const handleOpenModal = (genitore?: GenitoreAnagrafica) => {
        setEditingGenitore(genitore || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingGenitore(null);
        setIsModalOpen(false);
    };

    const handleSaveGenitore = (genitore: GenitoreAnagrafica | Omit<GenitoreAnagrafica, 'id'>) => {
        if ('id' in genitore && genitore.id) {
            updateGenitore(genitore as GenitoreAnagrafica);
        } else {
            addGenitore(genitore as Omit<GenitoreAnagrafica, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteGenitore = (genitoreId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo genitore?')) {
            deleteGenitore(genitoreId);
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
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Genitore</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Cognome e Nome</th>
                            <th scope="col" className="px-6 py-3">Contatti</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {genitori.map(genitore => (
                            <tr key={genitore.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {genitore.cognome} {genitore.nome}
                                </th>
                                <td className="px-6 py-4 text-xs">
                                    <div>{genitore.email}</div>
                                    <div>{genitore.telefono}</div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(genitore.lastModified)}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(genitore)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteGenitore(genitore.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {genitori.length === 0 && (
                             <tr>
                                 <td colSpan={4} className="text-center py-8 text-gray-500">Nessun genitore trovato.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingGenitore && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={('id' in editingGenitore && editingGenitore.id) ? 'Modifica Genitore' : 'Nuovo Genitore'}
                >
                    <GenitoreForm genitore={editingGenitore} onSave={handleSaveGenitore} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};