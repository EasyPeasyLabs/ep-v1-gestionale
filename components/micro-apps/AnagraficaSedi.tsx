import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { SedeAnagrafica, FornitoreAnagrafica, Indirizzo } from '../../types';
import { EMPTY_SEDE_ANAGRAFICA } from '../../constants';

const getInitialFormData = (): Omit<SedeAnagrafica, 'id'> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = EMPTY_SEDE_ANAGRAFICA;
    return rest;
};


const SedeForm: React.FC<{
    sede: SedeAnagrafica | Omit<SedeAnagrafica, 'id'>,
    fornitori: FornitoreAnagrafica[],
    onSave: (sede: SedeAnagrafica | Omit<SedeAnagrafica, 'id'>) => void,
    onCancel: () => void
}> = ({ sede, fornitori, onSave, onCancel }) => {
    const [formData, setFormData] = useState(sede);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const target = e.target as HTMLInputElement;
        const valueToSet = target.type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleIndirizzoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, indirizzo: { ...(prev.indirizzo as Indirizzo), [name]: value } }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fornitoreId) {
            alert("Seleziona un fornitore.");
            return;
        }
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Select
                    id="fornitoreId"
                    name="fornitoreId"
                    label="Fornitore Padre"
                    value={formData.fornitoreId}
                    onChange={handleChange}
                    disabled={'id' in formData && !!formData.id}
                    required
                >
                    <option value="">Seleziona un fornitore...</option>
                    {fornitori.map(f => (
                        <option key={f.id} value={f.id}>{f.ragioneSociale}</option>
                    ))}
                </Select>
                 <hr className="my-6 dark:border-gray-600"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="nome" name="nome" label="Nome Sede" value={formData.nome} onChange={handleChange} required />
                     <div>
                        <label htmlFor="colore" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Colore Identificativo
                        </label>
                        <input 
                            id="colore" 
                            name="colore" 
                            type="color" 
                            value={formData.colore || '#A0AEC0'} 
                            onChange={handleChange} 
                            className="p-1 h-10 w-full block border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="capienzaMassima" name="capienzaMassima" label="Capienza Massima" type="number" value={formData.capienzaMassima} onChange={handleChange} required />
                    <Input id="costoNoloOra" name="costoNoloOra" label="Costo Nolo (€/ora)" type="number" step="0.01" value={formData.costoNoloOra} onChange={handleChange} required />
                </div>
                <Input id="fasciaEta" name="fasciaEta" label="Fascia Età (es. 0-6 anni)" value={formData.fasciaEta} onChange={handleChange} />

                 <div className="mt-6">
                    <h4 className="text-lg font-medium mb-2">Indirizzo Sede</h4>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="col-span-2">
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
                 <Button type="submit" variant="primary">Salva Sede</Button>
            </div>
        </form>
    );
};

export const AnagraficaSedi: React.FC = () => {
    const { sedi, addSede, updateSede, deleteSede, fornitoriAnagrafica } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSede, setEditingSede] = useState<SedeAnagrafica | Omit<SedeAnagrafica, 'id'> | null>(null);

    const handleOpenModal = (sede?: SedeAnagrafica) => {
        setEditingSede(sede || getInitialFormData());
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingSede(null);
        setIsModalOpen(false);
    };

    const handleSaveSede = (sede: SedeAnagrafica | Omit<SedeAnagrafica, 'id'>) => {
        if ('id' in sede && sede.id) {
            updateSede(sede as SedeAnagrafica);
        } else {
            addSede(sede as Omit<SedeAnagrafica, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDeleteSede = (sedeId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questa sede?')) {
            deleteSede(sedeId);
        }
    }
    
    const getFornitoreNome = (fornitoreId: string) => {
        return fornitoriAnagrafica.find(f => f.id === fornitoreId)?.ragioneSociale || 'N/D';
    }

    const formatIndirizzo = (indirizzo: Indirizzo) => {
        return `${indirizzo.via} ${indirizzo.civico}, ${indirizzo.cap} ${indirizzo.citta} (${indirizzo.provincia})`;
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
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />} disabled={fornitoriAnagrafica.length === 0}>
                    Nuova Sede
                </Button>
            </div>
            
            {fornitoriAnagrafica.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <p className="text-yellow-800 dark:text-yellow-200">Per aggiungere una sede, devi prima creare almeno un fornitore nell'anagrafica fornitori.</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto mt-4">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome Sede</th>
                            <th scope="col" className="px-6 py-3">Fornitore Padre</th>
                            <th scope="col" className="px-6 py-3">Indirizzo</th>
                            <th scope="col" className="px-6 py-3">Capienza Max</th>
                            <th scope="col" className="px-6 py-3">Ultima Modifica</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sedi.map(sede => (
                                <tr key={sede.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" style={{borderLeft: `5px solid ${sede.colore || '#A0AEC0'}`}}>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        {sede.nome}
                                    </th>
                                    <td className="px-6 py-4">{getFornitoreNome(sede.fornitoreId)}</td>
                                    <td className="px-6 py-4 text-xs">{formatIndirizzo(sede.indirizzo)}</td>
                                    <td className="px-6 py-4">{sede.capienzaMassima}</td>
                                    <td className="px-6 py-4 text-xs text-gray-500">{formatLastModified(sede.lastModified)}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleOpenModal(sede)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                        <button onClick={() => handleDeleteSede(sede.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                    </td>
                                </tr>
                            ))
                        }
                         {sedi.length === 0 && (
                             <tr>
                                 <td colSpan={6} className="text-center py-8 text-gray-500">Nessuna sede trovata.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingSede && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingSede && editingSede.id ? 'Modifica Sede' : 'Nuova Sede'}>
                    <SedeForm sede={editingSede} fornitori={fornitoriAnagrafica} onSave={handleSaveSede} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};