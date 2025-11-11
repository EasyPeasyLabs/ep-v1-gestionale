
import React, { useState, useMemo, FC } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Iscrizione, Cliente, ClienteTipo, Laboratorio, Figlio, Listino, IscrizioneStato } from '../../types';
import { EMPTY_ISCRIZIONE, ISCRIZIONE_STATO_OPTIONS } from '../../constants';

type IscrizioneFormProps = {
    iscrizione: Omit<Iscrizione, 'id'>,
    clienti: Cliente[],
    laboratori: Laboratorio[],
    listini: Listino[],
    onSave: (isc: Omit<Iscrizione, 'id'>) => void,
    onCancel: () => void,
};

const IscrizioneForm: FC<IscrizioneFormProps> = ({ iscrizione, clienti, laboratori, listini, onSave, onCancel }) => {
    const [formData, setFormData] = useState(iscrizione);

    const selectedCliente = useMemo(() => clienti.find(c => c.id === formData.clienteId), [clienti, formData.clienteId]);
    const selectedLaboratorio = useMemo(() => laboratori.find(l => l.id === formData.laboratorioId), [laboratori, formData.laboratorioId]);
    const listinoAssociato = useMemo(() => listini.find(li => li.laboratorioId === selectedLaboratorio?.id), [listini, selectedLaboratorio]);

    const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...EMPTY_ISCRIZIONE, clienteId: e.target.value });
    };

    const handleLaboratorioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">1. Seleziona Cliente</h3>
                    <Select id="clienteId" name="clienteId" label="" value={formData.clienteId} onChange={handleClienteChange} required>
                        <option value="">Seleziona...</option>
                        {clienti.map(c => <option key={c.id} value={c.id}>{c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${c.dati.genitore1.cognome}` : c.dati.ragioneSociale}</option>)}
                    </Select>
                </div>

                {selectedCliente?.tipo === ClienteTipo.FAMIGLIA && (
                     <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">2. Seleziona Figli</h3>
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
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">3. Seleziona Laboratorio</h3>
                        <Select id="laboratorioId" name="laboratorioId" label="" value={formData.laboratorioId} onChange={handleLaboratorioChange} required>
                            <option value="">Seleziona...</option>
                            {laboratori.map(l => <option key={l.id} value={l.id}>{l.codice}</option>)}
                        </Select>
                    </div>
                )}

                {listinoAssociato && (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">4. Applica Listino</h3>
                        <div className="p-3 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                             <label className="flex items-center">
                                <input type="checkbox" checked={true} readOnly className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="ml-3 text-sm">Applica Quota Base: <strong>{listinoAssociato.listinoBase.toFixed(2)}€</strong></span>
                            </label>
                        </div>
                    </div>
                )}

            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Crea Promemoria Iscrizione</Button>
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

    const handleSave = (isc: Omit<Iscrizione, 'id'>) => {
        addIscrizione(isc);
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
                                <td className="px-6 py-4">{isc.stato}</td>
                                <td className="px-6 py-4">{new Date(isc.scadenza).toLocaleDateString('it-IT')}</td>
                                <td className="px-6 py-4 text-right">{isc.listinoBaseApplicato.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleDelete(isc.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Nuova Iscrizione">
                    <IscrizioneForm
                        iscrizione={editingIscrizione || EMPTY_ISCRIZIONE}
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
