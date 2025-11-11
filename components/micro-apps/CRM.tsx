
import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
// FIX: Added `Cliente` to imports for type safety.
import { InterazioneCRM, Cliente, ClienteTipo, IscrizioneStato, Laboratorio } from '../../types';
import { EMPTY_INTERAZIONE, INTERAZIONE_TIPO_OPTIONS } from '../../constants';

const InterazioneForm: React.FC<{
    interazione: InterazioneCRM,
    onSave: (interazione: InterazioneCRM) => void,
    onCancel: () => void
}> = ({ interazione, onSave, onCancel }) => {
    const [formData, setFormData] = useState(interazione);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
                <Input id="data" name="data" label="Data e Ora" type="datetime-local" value={formData.data.substring(0,16)} onChange={handleChange} required />
                <Select id="tipo" name="tipo" label="Tipo Interazione" options={INTERAZIONE_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                <Input id="oggetto" name="oggetto" label="Oggetto" value={formData.oggetto} onChange={handleChange} required />
                <div>
                    <label htmlFor="descrizione" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
                    <textarea id="descrizione" name="descrizione" rows={4} value={formData.descrizione} onChange={handleChange} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"></textarea>
                </div>
                <Input id="followUp" name="followUp" label="Prossimo Follow-up" type="date" value={formData.followUp} onChange={handleChange} />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Interazione</Button>
            </div>
        </form>
    )
}

const getClienteNome = (cliente: Cliente) => cliente.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${cliente.dati.genitore1.cognome}` : cliente.dati.ragioneSociale;

const InterazioniView: React.FC<{
    clienti: Cliente[],
    interazioni: InterazioneCRM[],
    onAdd: (interazione: Omit<InterazioneCRM, 'id'>) => void,
    onUpdate: (interazione: InterazioneCRM) => void,
    onDelete: (id: string) => void,
}> = ({ clienti, interazioni, onAdd, onUpdate, onDelete }) => {
    const [selectedClienteId, setSelectedClienteId] = useState<string | null>(clienti[0]?.id || null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInterazione, setEditingInterazione] = useState<InterazioneCRM | null>(null);

    const getClienteEmail = (cliente: Cliente) => {
        if (cliente.tipo === ClienteTipo.FAMIGLIA) return cliente.dati.genitore1.email;
        return cliente.dati.email;
    }

    const filteredInterazioni = useMemo(() => {
        if (!selectedClienteId) return [];
        return interazioni.filter(i => i.clienteId === selectedClienteId);
    }, [selectedClienteId, interazioni]);

    const handleOpenModal = (interazione?: InterazioneCRM) => {
        if (interazione) {
            setEditingInterazione(interazione);
        } else if(selectedClienteId) {
            setEditingInterazione({ ...EMPTY_INTERAZIONE, clienteId: selectedClienteId });
        }
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => setIsModalOpen(false);

    const handleSave = (interazione: InterazioneCRM) => {
        if (interazione.id) onUpdate(interazione);
        else {
            const { id, ...newInteraction } = interazione;
            onAdd(newInteraction);
        }
        handleCloseModal();
    };
    
    return (
        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            <div className="md:col-span-1 bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-y-auto">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {clienti.map(c => (
                        <li key={c.id}>
                            <button onClick={() => setSelectedClienteId(c.id)} className={`w-full text-left p-4 ${selectedClienteId === c.id ? 'bg-blue-50 dark:bg-blue-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                <p className={`font-semibold ${selectedClienteId === c.id ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>{getClienteNome(c)}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{getClienteEmail(c)}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="md:col-span-2 bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col">
                {selectedClienteId ? (
                    <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Storico Interazioni</h2>
                        <Button onClick={() => handleOpenModal()} icon={<PlusIcon/>}>Nuova</Button>
                    </div>
                    <div className="flex-grow overflow-y-auto -mr-6 pr-6 space-y-4">
                        {filteredInterazioni.length > 0 ? filteredInterazioni.map(i => (
                            <div key={i.id} className="p-4 border rounded-md dark:border-gray-700">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{i.oggetto} <span className="text-xs ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">{i.tipo}</span></p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(i.data).toLocaleString('it-IT')}</p>
                                    </div>
                                    <div className="space-x-2 flex-shrink-0">
                                        <button onClick={() => handleOpenModal(i)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                        <button onClick={() => onDelete(i.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                    </div>
                                </div>
                                <p className="mt-2 text-gray-700 dark:text-gray-300">{i.descrizione}</p>
                                {i.followUp && <p className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">Follow-up: {new Date(i.followUp).toLocaleDateString('it-IT')}</p>}
                            </div>
                        )) : <p className="text-gray-500 dark:text-gray-400 text-center pt-10">Nessuna interazione registrata per questo cliente.</p>}
                    </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 dark:text-gray-400">Seleziona un cliente per vedere le interazioni.</p>
                    </div>
                )}
            </div>
             {isModalOpen && editingInterazione && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingInterazione.id ? 'Modifica Interazione' : 'Nuova Interazione'}>
                    <InterazioneForm interazione={editingInterazione} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
}

const ScadenziarioIscrizioni: React.FC<{
    iscrizioni: ReturnType<typeof useMockData>['iscrizioni'],
    clienti: Cliente[],
    laboratori: Laboratorio[],
}> = ({ iscrizioni, clienti, laboratori }) => {
    
    const promemoria = useMemo(() => iscrizioni.filter(i => i.stato === IscrizioneStato.PROMEMORIA), [iscrizioni]);

    const getLabCodice = (labId: string) => laboratori.find(l => l.id === labId)?.codice || 'N/A';
    const getClienteNomeById = (clienteId: string) => {
        const cliente = clienti.find(c => c.id === clienteId);
        return cliente ? getClienteNome(cliente) : 'N/A';
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-6 py-3">Cliente</th>
                        <th scope="col" className="px-6 py-3">Laboratorio</th>
                        <th scope="col" className="px-6 py-3">Scadenza</th>
                        <th scope="col" className="px-6 py-3 text-right">Quota</th>
                    </tr>
                </thead>
                <tbody>
                    {promemoria.map(p => (
                        <tr key={p.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                           <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{getClienteNomeById(p.clienteId)}</td>
                           <td className="px-6 py-4">{getLabCodice(p.laboratorioId)}</td>
                           <td className="px-6 py-4">{new Date(p.scadenza).toLocaleDateString('it-IT')}</td>
                           <td className="px-6 py-4 text-right font-semibold">{p.listinoBaseApplicato.toFixed(2)}€</td>
                        </tr>
                    ))}
                    {promemoria.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nessun promemoria di iscrizione attivo.</td></tr>}
                </tbody>
            </table>
        </div>
    );
};


export const CRM: React.FC = () => {
    const { clienti, interazioni, addInterazione, updateInterazione, deleteInterazione, iscrizioni, laboratori } = useMockData();
    
    const handleDeleteInterazione = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa interazione?")) {
            deleteInterazione(id);
        }
    };
    
    const tabs = [
        {
            label: 'Interazioni Clienti',
            content: <InterazioniView clienti={clienti} interazioni={interazioni} onAdd={addInterazione} onUpdate={updateInterazione} onDelete={handleDeleteInterazione} />
        },
        {
            label: 'Scadenziario Iscrizioni',
            content: <ScadenziarioIscrizioni iscrizioni={iscrizioni} clienti={clienti} laboratori={laboratori} />
        }
    ];

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <h1 className="text-3xl font-bold mb-6">CRM</h1>
            <Tabs tabs={tabs} />
        </div>
    );
};
