import React, { useState, useMemo, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { PropostaCommerciale, PropostaServizio, Cliente, ClienteTipo } from '../../types';
import { EMPTY_PROPOSTA, EMPTY_SERVIZIO_PROPOSTA, PROPOSTA_STATO_OPTIONS } from '../../constants';

const PropostaForm: React.FC<{
    proposta: PropostaCommerciale | Omit<PropostaCommerciale, 'id'>,
    clienti: Cliente[],
    onSave: (prop: PropostaCommerciale | Omit<PropostaCommerciale, 'id'>) => void,
    onCancel: () => void
}> = ({ proposta, clienti, onSave, onCancel }) => {
    const [formData, setFormData] = useState(proposta);

    useEffect(() => {
        const total = formData.servizi.reduce((acc, servizio) => acc + (servizio.quantita * servizio.prezzoUnitario), 0);
        setFormData(prev => ({...prev, totale: total}));
    }, [formData.servizi]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleServizioChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newServizi = [...formData.servizi];
        const valueToSet = e.target.type === 'number' ? parseFloat(value) || 0 : value;
        (newServizi[index] as any)[name] = valueToSet;
        setFormData(prev => ({...prev, servizi: newServizi}));
    };

    const addServizio = () => {
        setFormData(prev => ({...prev, servizi: [...prev.servizi, {...EMPTY_SERVIZIO_PROPOSTA, id: `new_${Date.now()}`}]}));
    };

    const removeServizio = (index: number) => {
        setFormData(prev => ({...prev, servizi: prev.servizi.filter((_, i) => i !== index)}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="codice" name="codice" label="Codice Proposta" value={formData.codice} onChange={handleChange} placeholder="Es. PREV-2024-001" />
                    <Select id="clienteId" name="clienteId" label="Cliente" value={formData.clienteId} onChange={handleChange} required>
                        <option value="">Seleziona...</option>
                        {clienti.map(c => <option key={c.id} value={c.id}>{c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${c.dati.genitore1.cognome}` : c.dati.ragioneSociale}</option>)}
                    </Select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="dataEmissione" name="dataEmissione" label="Data Emissione" type="date" value={formData.dataEmissione} onChange={handleChange} required />
                    <Input id="dataScadenza" name="dataScadenza" label="Data Scadenza" type="date" value={formData.dataScadenza} onChange={handleChange} />
                    <Select id="stato" name="stato" label="Stato" options={PROPOSTA_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                 </div>
                 
                 <div className="pt-4">
                    <h3 className="text-lg font-medium mb-2">Servizi/Prodotti</h3>
                    <div className="space-y-2">
                    {formData.servizi.map((servizio, index) => (
                        <div key={servizio.id} className="grid grid-cols-12 gap-2 items-center">
                           <div className="col-span-6"><Input id={`desc-${index}`} name="descrizione" label="Descrizione" value={servizio.descrizione} onChange={(e) => handleServizioChange(index, e as any)} /></div>
                           <div className="col-span-2"><Input id={`qta-${index}`} name="quantita" label="Q.tà" type="number" value={servizio.quantita} onChange={(e) => handleServizioChange(index, e as any)} /></div>
                           <div className="col-span-3"><Input id={`prezzo-${index}`} name="prezzoUnitario" label="Prezzo Unit." type="number" step="0.01" value={servizio.prezzoUnitario} onChange={(e) => handleServizioChange(index, e as any)} /></div>
                           <div className="col-span-1 pt-7"><Button type="button" variant="danger" onClick={() => removeServizio(index)}><TrashIcon /></Button></div>
                        </div>
                    ))}
                    </div>
                    <Button type="button" variant="secondary" onClick={addServizio} icon={<PlusIcon />} className="mt-2">Aggiungi riga</Button>
                 </div>
            </div>
             <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-between items-center">
                 <div className="text-xl font-bold">Totale: {formData.totale.toFixed(2)}€</div>
                 <div className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                    <Button type="submit" variant="primary">Salva Proposta</Button>
                 </div>
            </div>
        </form>
    );
};

export const Commerciale: React.FC = () => {
    const { proposte, addProposta, updateProposta, deleteProposta, clienti } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProposta, setEditingProposta] = useState<PropostaCommerciale | Omit<PropostaCommerciale, 'id'> | null>(null);

    const getClienteNome = (clienteId: string) => {
        const cliente = clienti.find(c => c.id === clienteId);
        if (!cliente) return 'N/A';
        return cliente.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${cliente.dati.genitore1.cognome}` : cliente.dati.ragioneSociale;
    };

    const handleOpenModal = (prop?: PropostaCommerciale) => {
        setEditingProposta(prop || { ...EMPTY_PROPOSTA, servizi: [{...EMPTY_SERVIZIO_PROPOSTA, id: `new_${Date.now()}`}]});
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingProposta(null);
        setIsModalOpen(false);
    };

    const handleSave = (prop: PropostaCommerciale | Omit<PropostaCommerciale, 'id'>) => {
        if ('id' in prop && prop.id) {
            updateProposta(prop);
        } else {
            addProposta(prop);
        }
        handleCloseModal();
    };
    
    const handleDelete = (propId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questa proposta?')) {
            deleteProposta(propId);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Pipeline Commerciale</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Proposta</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Codice</th>
                            <th scope="col" className="px-6 py-3">Cliente</th>
                            <th scope="col" className="px-6 py-3">Data</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3 text-right">Totale</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proposte.map(prop => (
                            <tr key={prop.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{prop.codice}</th>
                                <td className="px-6 py-4">{getClienteNome(prop.clienteId)}</td>
                                <td className="px-6 py-4">{new Date(prop.dataEmissione).toLocaleDateString('it-IT')}</td>
                                <td className="px-6 py-4">{prop.stato}</td>
                                <td className="px-6 py-4 text-right font-semibold">{prop.totale.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(prop)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(prop.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {isModalOpen && editingProposta && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingProposta && editingProposta.id ? 'Modifica Proposta' : 'Nuova Proposta'}>
                    <PropostaForm proposta={editingProposta} clienti={clienti} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};
