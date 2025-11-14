import React, { useState, useMemo, FC } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Iscrizione, Cliente, ClienteTipo, Laboratorio, Figlio, Listino, IscrizioneStato } from '../../types';
import { EMPTY_ISCRIZIONE, ISCRIZIONE_STATO_OPTIONS, DURATA_LABORATORIO_OPTIONS } from '../../constants';

type IscrizioneFormProps = {
    iscrizione: Iscrizione,
    isEditing: boolean,
    clienti: Cliente[],
    laboratori: Laboratorio[],
    listini: Listino[],
    onSave: (isc: Iscrizione) => void,
    onCancel: () => void,
};

const IscrizioneForm: FC<IscrizioneFormProps> = ({ iscrizione, isEditing, clienti, laboratori, listini, onSave, onCancel }) => {
    const [formData, setFormData] = useState(iscrizione);

    const selectedCliente = useMemo(() => clienti.find(c => c.id === formData.clienteId), [clienti, formData.clienteId]);
    const selectedLaboratorio = useMemo(() => laboratori.find(l => l.id === formData.laboratorioId), [laboratori, formData.laboratorioId]);
    const listinoAssociato = useMemo(() => listini.find(li => li.laboratorioId === selectedLaboratorio?.id), [listini, selectedLaboratorio]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (isEditing) return;
        setFormData({ ...EMPTY_ISCRIZIONE, clienteId: e.target.value });
    };

    const handleLaboratorioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (isEditing) return;
        const labId = e.target.value;
        const lab = laboratori.find(l => l.id === labId);
        const listino = listini.find(l => l.laboratorioId === labId);
        setFormData(prev => ({
            ...prev,
            laboratorioId: labId,
            scadenza: lab?.dataFine || '',
            listinoBaseApplicato: listino?.listinoBase || 0,
        }));
    };

    const handleFiglioToggle = (figlio: Figlio) => {
        setFormData(prev => {
            const isSelected = prev.figliIscritti.some(f => f.id === figlio.id);
            const newFigli = isSelected
                ? prev.figliIscritti.filter(f => f.id !== figlio.id)
                : [...prev.figliIscritti, figlio];
            return { ...prev, figliIscritti: newFigli };
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.clienteId || !formData.laboratorioId) {
            alert("Cliente e Laboratorio sono obbligatori.");
            return;
        }
         if (!formData.tipoIscrizione) {
            alert("Il Tipo Iscrizione è obbligatorio.");
            return;
        }
        if (selectedCliente?.tipo === ClienteTipo.FAMIGLIA && formData.figliIscritti.length === 0) {
            alert("Selezionare almeno un figlio per l'iscrizione.");
            return;
        }
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">1. Cliente</h3>
                    <Select id="clienteId" name="clienteId" label="" value={formData.clienteId} onChange={handleClienteChange} required disabled={isEditing}>
                        <option value="">Seleziona...</option>
                        {clienti.map(c => <option key={c.id} value={c.id}>{c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${c.dati.genitore1.cognome}` : c.dati.ragioneSociale}</option>)}
                    </Select>
                </div>

                {selectedCliente?.tipo === ClienteTipo.FAMIGLIA && (
                     <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">2. Figli</h3>
                        <div className="space-y-2 p-2 border rounded-md dark:border-gray-600">
                            {selectedCliente.dati.figli.map(figlio => (
                                <label key={figlio.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.figliIscritti.some(f => f.id === figlio.id)}
                                        onChange={() => handleFiglioToggle(figlio)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm">{figlio.nome} ({figlio.eta})</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {selectedCliente && (
                     <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">3. Laboratorio</h3>
                        <Select id="laboratorioId" name="laboratorioId" label="" value={formData.laboratorioId} onChange={handleLaboratorioChange} required disabled={isEditing}>
                            <option value="">Seleziona...</option>
                            {laboratori.map(l => <option key={l.id} value={l.id}>{l.codice}</option>)}
                        </Select>
                    </div>
                )}
                
                {selectedLaboratorio && (
                     <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">4. Tipo Iscrizione</h3>
                        <Select id="tipoIscrizione" name="tipoIscrizione" label="" value={formData.tipoIscrizione} onChange={handleFormChange} options={DURATA_LABORATORIO_OPTIONS} required />
                    </div>
                )}

                {listinoAssociato && (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">5. Listino</h3>
                        <div className="p-3 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                             <label className="flex items-center">
                                <input type="checkbox" checked={true} readOnly className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="ml-3 text-sm">Applica Quota Base: <strong>{listinoAssociato.listinoBase.toFixed(2)}€</strong></span>
                            </label>
                        </div>
                    </div>
                )}
                
                {isEditing && (
                    <div>
                         <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">6. Stato Iscrizione</h3>
                         <Select id="stato" name="stato" label="" value={formData.stato} onChange={handleFormChange} options={ISCRIZIONE_STATO_OPTIONS} required />
                    </div>
                )}

            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">{isEditing ? 'Salva Modifiche' : 'Crea Promemoria Iscrizione'}</Button>
            </div>
        </form>
    );
};


export const Iscrizioni: React.FC = () => {
    const { iscrizioni, addIscrizione, updateIscrizione, deleteIscrizione, clienti, laboratori, listini } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIscrizione, setEditingIscrizione] = useState<Iscrizione | null>(null);

    const handleOpenModal = (isc?: Iscrizione) => {
        setEditingIscrizione(isc || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingIscrizione(null);
        setIsModalOpen(false);
    };

    const handleSave = (isc: Iscrizione) => {
        if (isc.id) {
            updateIscrizione(isc);
        } else {
            const { id, ...newIsc } = isc;
            addIscrizione(newIsc as Omit<Iscrizione, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa iscrizione?")) {
            deleteIscrizione(id);
        }
    };

    const getLabCodice = (labId: string) => laboratori.find(l => l.id === labId)?.codice || 'N/A';
    const getClienteNome = (clienteId: string) => {
        const c = clienti.find(c => c.id === clienteId);
        if (!c) return 'N/A';
        return c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${c.dati.genitore1.cognome}` : c.dati.ragioneSociale;
    }

    const getStatoBadgeColor = (stato: IscrizioneStato) => {
        switch(stato) {
            case IscrizioneStato.PAGATO: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case IscrizioneStato.PROMEMORIA: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case IscrizioneStato.ANNULLATO: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Iscrizioni</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuova Iscrizione</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                     <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Cliente</th>
                            <th scope="col" className="px-6 py-3">Laboratorio</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3">Scadenza</th>
                            <th scope="col" className="px-6 py-3 text-right">Quota</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {iscrizioni.map(isc => (
                             <tr key={isc.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{getClienteNome(isc.clienteId)}</th>
                                <td className="px-6 py-4">{getLabCodice(isc.laboratorioId)}</td>
                                <td className="px-6 py-4">{isc.tipoIscrizione}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(isc.stato)}`}>{isc.stato}</span>
                                </td>
                                <td className="px-6 py-4">{new Date(isc.scadenza).toLocaleDateString('it-IT')}</td>
                                <td className="px-6 py-4 text-right">{isc.listinoBaseApplicato.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(isc)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(isc.id)} className="text-red-600 hover:text-red-800 disabled:text-gray-400" disabled={!isc.id}><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingIscrizione ? "Modifica Iscrizione" : "Nuova Iscrizione"}>
                    <IscrizioneForm
                        iscrizione={editingIscrizione || EMPTY_ISCRIZIONE}
                        isEditing={!!editingIscrizione}
                        clienti={clienti}
                        laboratori={laboratori}
                        listini={listini}
                        onSave={handleSave}
                        onCancel={handleCloseModal}
                    />
                </Modal>
            )}
        </div>
    );
};