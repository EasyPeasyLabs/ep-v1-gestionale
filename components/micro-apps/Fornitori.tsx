import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, StarIcon } from '../icons/Icons';
import { CLIENTE_CLASSE_OPTIONS, FORNITORE_TIPO_OPTIONS, CLIENTE_STATO_OPTIONS, EMPTY_DITTA } from '../../constants';
import { Fornitore, FornitoreTipo, DatiDitta, ClienteClasse, ClienteStato, Indirizzo } from '../../types';

const getInitialFormData = (): Omit<Fornitore, 'id' | 'sedi'> => ({
    classe: ClienteClasse.PRIVATO,
    tipo: FornitoreTipo.AZIENDA,
    stato: ClienteStato.ATTIVO,
    rating: 0,
    dati: { ...EMPTY_DITTA }
});

const FornitoreForm: React.FC<{ fornitore: Fornitore | Omit<Fornitore, 'id' | 'sedi'>, onSave: (fornitore: Fornitore | Omit<Fornitore, 'id' | 'sedi'>) => void, onCancel: () => void }> = ({ fornitore, onSave, onCancel }) => {
    const [formData, setFormData] = useState(fornitore);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDittaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, dati: { ...prev.dati, [name]: value } }));
    };

    const handleIndirizzoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            dati: {
                ...prev.dati,
                indirizzo: {
                    ...(prev.dati.indirizzo as Indirizzo),
                    [name]: value
                }
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select id="classe" name="classe" label="Classe" options={CLIENTE_CLASSE_OPTIONS} value={formData.classe} onChange={handleChange} required />
                    <Select id="tipo" name="tipo" label="Tipo" options={FORNITORE_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                    <Select id="stato" name="stato" label="Stato" options={CLIENTE_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                </div>
                <hr className="my-6 dark:border-gray-600"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="ragioneSociale" name="ragioneSociale" label="Ragione Sociale" value={formData.dati.ragioneSociale} onChange={handleDittaChange} required />
                    <Input id="partitaIva" name="partitaIva" label="Partita Iva" value={formData.dati.partitaIva} onChange={handleDittaChange} required/>
                    <Input id="referente" name="referente" label="Referente" value={formData.dati.referente} onChange={handleDittaChange} />
                    <Input id="email" name="email" label="Email" type="email" value={formData.dati.email} onChange={handleDittaChange} />
                    <Input id="telefono" name="telefono" label="Telefono" value={formData.dati.telefono} onChange={handleDittaChange} />
                </div>

                <div className="pt-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Indirizzo Sede Legale</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <Input id="via" name="via" label="Via / Piazza" value={formData.dati.indirizzo.via} onChange={handleIndirizzoChange} />
                        <Input id="civico" name="civico" label="N. Civico" value={formData.dati.indirizzo.civico} onChange={handleIndirizzoChange} />
                        <Input id="cap" name="cap" label="CAP" value={formData.dati.indirizzo.cap} onChange={handleIndirizzoChange} />
                        <Input id="citta" name="citta" label="Città" value={formData.dati.indirizzo.citta} onChange={handleIndirizzoChange} />
                        <Input id="provincia" name="provincia" label="Provincia" value={formData.dati.indirizzo.provincia} onChange={handleIndirizzoChange} />
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

export const Fornitori: React.FC = () => {
    const { fornitori, addFornitore, updateFornitore, deleteFornitore } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFornitore, setEditingFornitore] = useState<Fornitore | Omit<Fornitore, 'id' | 'sedi'> | null>(null);

    const handleOpenModal = (fornitore?: Fornitore) => {
        setEditingFornitore(fornitore || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingFornitore(null);
        setIsModalOpen(false);
    };

    const handleSaveFornitore = (fornitore: Fornitore | Omit<Fornitore, 'id' | 'sedi'>) => {
        if ('id' in fornitore) {
            updateFornitore(fornitore);
        } else {
            addFornitore(fornitore);
        }
        handleCloseModal();
    };
    
    const handleDeleteFornitore = (fornitoreId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo fornitore? Verranno eliminate anche tutte le sue sedi.')) {
            deleteFornitore(fornitoreId);
        }
    }

    const StarRatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <StarIcon key={i} filled={i < rating} />
            ))}
        </div>
    );

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
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Anagrafica Fornitori</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Fornitore</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Rag. Sociale</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3">Sedi</th>
                            <th scope="col" className="px-6 py-3">Rating</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fornitori.map(fornitore => (
                            <tr key={fornitore.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {fornitore.dati.ragioneSociale}
                                </th>
                                <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(fornitore.lastModified)}</td>
                                <td className="px-6 py-4">{fornitore.tipo}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{fornitore.stato}</span>
                                </td>
                                <td className="px-6 py-4">{fornitore.sedi.length}</td>
                                <td className="px-6 py-4"><StarRatingDisplay rating={fornitore.rating} /></td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(fornitore)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteFornitore(fornitore.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingFornitore && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingFornitore ? 'Modifica Fornitore' : 'Nuovo Fornitore'}>
                    <FornitoreForm fornitore={editingFornitore} onSave={handleSaveFornitore} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};