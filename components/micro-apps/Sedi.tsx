
import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Sede, Fornitore, Indirizzo } from '../../types';
import { EMPTY_SEDE } from '../../constants';

type EditingSedeState = {
    sede: Sede | Omit<Sede, 'id'>;
    fornitoreId: string;
}

const SedeForm: React.FC<{
    sedeState: EditingSedeState,
    fornitori: Fornitore[],
    onSave: (fornitoreId: string, sede: Sede | Omit<Sede, 'id'>) => void,
    onCancel: () => void
}> = ({ sedeState, fornitori, onSave, onCancel }) => {
    // FIX: Unificato lo stato del form in un unico oggetto per evitare dati inconsistenti.
    // L'ID del fornitore (fornitoreId) è ora gestito direttamente all'interno di formData.
    const [formData, setFormData] = useState({
        ...sedeState.sede,
        fornitoreId: sedeState.fornitoreId,
    });

    // FIX: Creato un handler generico per tutti gli input e select del form.
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
        // Passa a onSave il fornitoreId e l'oggetto sede completo dallo stato unificato.
        onSave(formData.fornitoreId, formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Select
                    id="fornitoreId"
                    name="fornitoreId" // Aggiunto per l'handler generico
                    label="Fornitore Padre"
                    value={formData.fornitoreId} // Controllato dallo stato unificato
                    onChange={handleChange} // Usa l'handler unificato
                    // FIX: La logica di disabilitazione è stata corretta per bloccare
                    // la modifica solo per le sedi esistenti (con un ID valido).
                    disabled={'id' in formData && !!formData.id}
                    required
                >
                    <option value="">Seleziona un fornitore...</option>
                    {fornitori.map(f => (
                        <option key={f.id} value={f.id}>{f.dati.ragioneSociale}</option>
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
                    <Input id="costoNoloOra" name="costoNoloOra" label="Costo Nolo (€/ora)" type="number" value={formData.costoNoloOra} onChange={handleChange} required />
                </div>
                <Input id="fasciaEta" name="fasciaEta" label="Fascia Età (es. 0-6 anni)" value={formData.fasciaEta} onChange={handleChange} />

                 <div className="mt-6">
                    <h4 className="text-lg font-medium mb-2">Indirizzo Sede</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input id="via" name="via" label="Via / Piazza" value={formData.indirizzo.via} onChange={handleIndirizzoChange} />
                        <Input id="civico" name="civico" label="N. Civico" value={formData.indirizzo.civico} onChange={handleIndirizzoChange} />
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

export const Sedi: React.FC = () => {
    const { fornitori, addSede, updateSede, deleteSede } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSede, setEditingSede] = useState<EditingSedeState | null>(null);

    const handleOpenModal = (sede?: Sede, fornitoreId?: string) => {
        if (sede && fornitoreId) {
            setEditingSede({ sede, fornitoreId });
        } else {
            setEditingSede({ sede: { ...EMPTY_SEDE }, fornitoreId: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingSede(null);
        setIsModalOpen(false);
    };

    const handleSaveSede = (fornitoreId: string, sede: Sede | Omit<Sede, 'id'>) => {
        if ('id' in sede && sede.id) {
            updateSede(fornitoreId, sede as Sede);
        } else {
            addSede(fornitoreId, sede);
        }
        handleCloseModal();
    };
    
    const handleDeleteSede = (fornitoreId: string, sedeId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questa sede?')) {
            deleteSede(fornitoreId, sedeId);
        }
    }
    
    const formatIndirizzo = (indirizzo: Indirizzo) => {
        return `${indirizzo.via} ${indirizzo.civico}, ${indirizzo.cap} ${indirizzo.citta} (${indirizzo.provincia})`;
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Anagrafica Sedi</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />} disabled={fornitori.length === 0}>
                    Nuova Sede
                </Button>
            </div>
            
            {fornitori.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <p className="text-yellow-800 dark:text-yellow-200">Per aggiungere una sede, devi prima creare almeno un fornitore.</p>
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
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fornitori.flatMap(fornitore => 
                            fornitore.sedi.map(sede => (
                                <tr key={sede.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" style={{borderLeft: `5px solid ${sede.colore || '#A0AEC0'}`}}>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        {sede.nome}
                                    </th>
                                    <td className="px-6 py-4">{fornitore.dati.ragioneSociale}</td>
                                    <td className="px-6 py-4">{formatIndirizzo(sede.indirizzo)}</td>
                                    <td className="px-6 py-4">{sede.capienzaMassima}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => handleOpenModal(sede, fornitore.id)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                        <button onClick={() => handleDeleteSede(fornitore.id, sede.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                         {fornitori.reduce((acc, f) => acc + f.sedi.length, 0) === 0 && (
                             <tr>
                                 <td colSpan={5} className="text-center py-8 text-gray-500">Nessuna sede trovata.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingSede && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingSede.sede && editingSede.sede.id ? 'Modifica Sede' : 'Nuova Sede'}>
                    <SedeForm sedeState={editingSede} fornitori={fornitori} onSave={handleSaveSede} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};