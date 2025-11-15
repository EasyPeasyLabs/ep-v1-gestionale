import React, { useState, useMemo, FC, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Iscrizione, Cliente, ClienteTipo, Laboratorio, IscrizioneStato, FiglioAnagrafica, TimeSlot, ClienteFamiglia, GenitoreAnagrafica, LaboratorioStato, ListinoDef } from '../../types';
import { EMPTY_ISCRIZIONE, ISCRIZIONE_STATO_OPTIONS } from '../../constants';

type IscrizioneFormProps = {
    iscrizione: Omit<Iscrizione, 'id' | 'codice'>,
    genitori: GenitoreAnagrafica[],
    tuttiFigli: FiglioAnagrafica[],
    laboratori: Laboratorio[],
    listiniDef: ListinoDef[],
    onSave: (isc: Omit<Iscrizione, 'id' | 'codice'>) => void,
    onCancel: () => void,
};

const IscrizioneForm: FC<IscrizioneFormProps> = ({ iscrizione, genitori, tuttiFigli, laboratori, listiniDef, onSave, onCancel }) => {
    const [formData, setFormData] = useState(iscrizione);

    const selectedGenitore = useMemo(() => genitori.find(g => g.id === formData.clienteId), [genitori, formData.clienteId]);
    const selectedLaboratorio = useMemo(() => laboratori.find(l => l.id === formData.laboratorioId), [laboratori, formData.laboratorioId]);
    const selectedListino = useMemo(() => listiniDef.find(l => l.id === formData.listinoDefId), [listiniDef, formData.listinoDefId]);
    
    const laboratoriDisponibili = useMemo(() => {
        return laboratori.filter(l => 
            (l.stato === LaboratorioStato.ATTIVO || l.stato === LaboratorioStato.PROGRAMMATO)
        );
    }, [laboratori]);

    const figliAssociati = useMemo(() => {
        if (!selectedGenitore) return [];
        const figliIds = selectedGenitore.figliIds;
        if (!Array.isArray(figliIds)) return [];
        return tuttiFigli.filter(figlio => figliIds.includes(figlio.id));
    }, [selectedGenitore, tuttiFigli]);
    
    // Auto-select time slots when listino is chosen
    useEffect(() => {
        if (selectedLaboratorio && selectedListino) {
            const numIncontri = selectedListino.numeroIncontri || 0;
            const incontriSelezionati = selectedLaboratorio.timeSlots
                .slice(0, numIncontri)
                .map(ts => ts.id);
            
            setFormData(prev => ({...prev, timeSlotIds: incontriSelezionati}));
        }
    }, [selectedLaboratorio, selectedListino]);
    
    // Recalculate total price
    useEffect(() => {
        if (selectedListino) {
            const importo = (selectedListino.prezzo || 0) * (formData.figliIds.length || 0);
            setFormData(prev => ({ ...prev, importo }));
        } else {
            setFormData(prev => ({ ...prev, importo: 0 }));
        }
    }, [selectedListino, formData.figliIds.length]);

    const handleSave = () => {
        if (!formData.clienteId || !formData.laboratorioId || !formData.listinoDefId || formData.figliIds.length === 0 || formData.timeSlotIds.length === 0) {
            alert("Completa tutti i campi prima di salvare.");
            return;
        }
        onSave(formData);
    };

    const isStep2Disabled = !formData.clienteId;
    const isStep3Disabled = isStep2Disabled || formData.figliIds.length === 0;
    const isStep4Disabled = isStep3Disabled || !formData.laboratorioId;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Form Fields */}
            <div className="md:col-span-2 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Seleziona Famiglia</h3>
                     <Select id="clienteId" name="clienteId" label="" value={formData.clienteId} onChange={e => setFormData({ ...EMPTY_ISCRIZIONE, clienteId: e.target.value })} required>
                        <option value="">Seleziona una famiglia...</option>
                        {genitori.map(g => <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>)}
                    </Select>
                </div>

                <div className={isStep2Disabled ? 'opacity-50' : ''}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. Seleziona Figli</h3>
                    <div className="space-y-2 p-3 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                        {!selectedGenitore ? <p className="text-sm text-gray-500 p-4 text-center">Seleziona prima una famiglia.</p> :
                         figliAssociati.length > 0 ? figliAssociati.map(figlio => (
                            <label key={figlio.id} className="flex items-center">
                                <input
                                    type="checkbox"
                                    id={`figlio-${figlio.id}`}
                                    checked={formData.figliIds.includes(figlio.id)}
                                    onChange={() => {
                                        const newFigliIds = formData.figliIds.includes(figlio.id)
                                            ? formData.figliIds.filter(id => id !== figlio.id)
                                            : [...formData.figliIds, figlio.id];
                                        setFormData(prev => ({ ...prev, figliIds: newFigliIds }));
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-3 text-sm">{figlio.nome} ({figlio.eta})</span>
                            </label>
                        )) : <p className="text-sm text-gray-500">Nessun figlio associato.</p>}
                    </div>
                </div>

                <div className={isStep3Disabled ? 'opacity-50' : ''}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Seleziona Laboratorio</h3>
                    <div className="space-y-2 p-3 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                         {laboratoriDisponibili.map(lab => (
                            <label key={lab.id} className="flex items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="laboratorioId"
                                    value={lab.id}
                                    checked={formData.laboratorioId === lab.id}
                                    onChange={e => setFormData(prev => ({...prev, laboratorioId: e.target.value, timeSlotIds: [], listinoDefId: ''}))}
                                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    disabled={isStep3Disabled}
                                />
                                <span className="ml-3 text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{lab.codice}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className={isStep4Disabled ? 'opacity-50' : ''}>
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Seleziona Abbonamento</h3>
                     <Select id="listinoDefId" name="listinoDefId" label="" value={formData.listinoDefId} onChange={e => setFormData(prev => ({...prev, listinoDefId: e.target.value }))} required disabled={isStep4Disabled}>
                        <option value="">Seleziona un abbonamento...</option>
                        {listiniDef.map(l => <option key={l.id} value={l.id}>{l.tipo} ({l.numeroIncontri} incontri) - {l.prezzo.toFixed(2)}€</option>)}
                    </Select>
                </div>
            </div>

            {/* Right Column: Summary */}
            <div className="md:col-span-1">
                 <div className="sticky top-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 shadow-md">
                    <h3 className="text-xl font-semibold border-b pb-2 dark:border-gray-600 mb-4">Riepilogo Iscrizione</h3>
                    <div className="space-y-3 text-sm">
                        <p><strong>Genitore:</strong> {selectedGenitore ? `${selectedGenitore.cognome} ${selectedGenitore.nome}` : <span className="text-gray-500">...</span>}</p>
                        <p><strong>Figli Selezionati:</strong> {formData.figliIds.length > 0 ? formData.figliIds.length : <span className="text-gray-500">...</span>}</p>
                        <p><strong>Laboratorio:</strong> {selectedLaboratorio?.codice ? <span className="font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{selectedLaboratorio.codice}</span> : <span className="text-gray-500">...</span>}</p>
                        <p><strong>Abbonamento:</strong> {selectedListino?.tipo || <span className="text-gray-500">...</span>}</p>
                        <p><strong>Incontri Inclusi:</strong> {formData.timeSlotIds.length > 0 ? formData.timeSlotIds.length : <span className="text-gray-500">...</span>}</p>
                        
                        {formData.timeSlotIds.length > 0 && selectedLaboratorio && (
                            <div className="text-xs max-h-24 overflow-y-auto bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600">
                                {selectedLaboratorio.timeSlots
                                    .filter(ts => formData.timeSlotIds.includes(ts.id))
                                    .map(ts => <div key={ts.id}>• {new Date(`${ts.data}T00:00:00`).toLocaleDateString('it-IT')}</div>)
                                }
                            </div>
                        )}

                        <div className="!mt-6 pt-4 border-t dark:border-gray-600">
                            <p className="text-xl font-bold">Totale: {formData.importo.toFixed(2)}€</p>
                        </div>
                    </div>
                     <div className="mt-6">
                         <Button 
                            type="button" 
                            variant="primary" 
                            onClick={handleSave}
                            className="w-full"
                            disabled={!formData.clienteId || !formData.laboratorioId || !formData.listinoDefId || formData.figliIds.length === 0 || formData.timeSlotIds.length === 0}
                        >
                            Crea Iscrizione
                        </Button>
                         <Button type="button" variant="secondary" onClick={onCancel} className="w-full mt-2">Annulla</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const IscrizioneEditForm: FC<{ iscrizione: Iscrizione; onSave: (isc: Iscrizione) => void; onCancel: () => void; }> = ({ iscrizione, onSave, onCancel }) => {
    const [stato, setStato] = useState(iscrizione.stato);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...iscrizione, stato });
    };

    return (
        <form onSubmit={handleSubmit}>
            <p className="mb-4">Modifica lo stato dell'iscrizione <strong>{iscrizione.codice}</strong>.</p>
            <Select
                id="stato"
                label="Stato Iscrizione"
                options={ISCRIZIONE_STATO_OPTIONS}
                value={stato}
                onChange={e => setStato(e.target.value as IscrizioneStato)}
            />
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva Modifica</Button>
            </div>
        </form>
    )
}


export const Iscrizioni: React.FC = () => {
    const { iscrizioni, addIscrizione, updateIscrizione, deleteIscrizione, clienti, laboratori, listiniDef, figli: tuttiFigli, genitori } = useMockData();
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

    const handleSave = (isc: Iscrizione | Omit<Iscrizione, 'id' | 'codice'>) => {
        if ('id' in isc && isc.id) {
             updateIscrizione(isc as Iscrizione);
        } else {
            addIscrizione(isc as Omit<Iscrizione, 'id' | 'codice'>);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa iscrizione? L'operazione è irreversibile e rimuoverà anche eventuali promemoria e movimenti finanziari collegati.")) {
            deleteIscrizione(id);
        }
    };

    const getLabCodice = (labId: string) => laboratori.find(l => l.id === labId)?.codice || 'N/A';
    
    const getClienteNome = (clienteId: string) => {
        const genitore = genitori.find(g => g.id === clienteId);
        if (genitore) return `${genitore.cognome} ${genitore.nome}`;
        
        const c = clienti.find(c => c.id === clienteId);
        if (!c) return 'N/A';
        return c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${(c as ClienteFamiglia).dati.genitore1.cognome}` : c.dati.ragioneSociale;
    }

    const getFigliNomi = (figliIds: string[]) => {
        return figliIds.map(id => tuttiFigli.find(f => f.id === id)?.nome).filter(Boolean).join(', ') || 'N/A';
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
                            <th scope="col" className="px-6 py-3">Codice</th>
                            <th scope="col" className="px-6 py-3">Cliente</th>
                            <th scope="col" className="px-6 py-3">Laboratorio</th>
                            <th scope="col" className="px-6 py-3">Figli</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3 text-right">Importo</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {iscrizioni.map(isc => (
                             <tr key={isc.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-mono">{isc.codice}</td>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{getClienteNome(isc.clienteId)}</th>
                                <td className="px-6 py-4">{getLabCodice(isc.laboratorioId)}</td>
                                <td className="px-6 py-4 text-xs">{getFigliNomi(isc.figliIds)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(isc.stato)}`}>{isc.stato}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-semibold">{isc.importo.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(isc)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(isc.id)} className="text-red-600 hover:text-red-800" disabled={!isc.id}><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingIscrizione ? "Modifica Stato Iscrizione" : "Nuova Iscrizione"}>
                    {editingIscrizione ? (
                        <IscrizioneEditForm iscrizione={editingIscrizione} onSave={handleSave as (isc: Iscrizione) => void} onCancel={handleCloseModal} />
                    ) : (
                        <IscrizioneForm
                            iscrizione={EMPTY_ISCRIZIONE}
                            genitori={genitori}
                            tuttiFigli={tuttiFigli}
                            laboratori={laboratori}
                            listiniDef={listiniDef}
                            onSave={handleSave}
                            onCancel={handleCloseModal}
                        />
                    )}
                </Modal>
            )}
        </div>
    );
};