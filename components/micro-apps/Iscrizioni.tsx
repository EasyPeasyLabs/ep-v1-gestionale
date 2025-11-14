import React, { useState, useMemo, FC, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Iscrizione, Cliente, ClienteTipo, Laboratorio, Listino, IscrizioneStato, FiglioAnagrafica, TimeSlot, ClienteFamiglia, GenitoreAnagrafica } from '../../types';
import { EMPTY_ISCRIZIONE, ISCRIZIONE_STATO_OPTIONS } from '../../constants';

const Step: FC<{ title: string; stepNumber: number; isActive: boolean; children: React.ReactNode }> = ({ title, stepNumber, isActive, children }) => (
    <div className={`${isActive ? 'block' : 'hidden'}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            <span className="bg-blue-600 text-white rounded-full h-8 w-8 inline-flex items-center justify-center mr-3">{stepNumber}</span>
            {title}
        </h3>
        <div className="pl-11">{children}</div>
    </div>
);

type IscrizioneFormProps = {
    iscrizione: Omit<Iscrizione, 'id' | 'codice'>,
    genitori: GenitoreAnagrafica[],
    tuttiFigli: FiglioAnagrafica[],
    laboratori: Laboratorio[],
    listini: Listino[],
    onSave: (isc: Omit<Iscrizione, 'id' | 'codice'>) => void,
    onCancel: () => void,
};

const IscrizioneForm: FC<IscrizioneFormProps> = ({ iscrizione, genitori, tuttiFigli, laboratori, listini, onSave, onCancel }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState(iscrizione);

    const selectedGenitore = useMemo(() => genitori.find(g => g.id === formData.clienteId), [genitori, formData.clienteId]);
    const selectedLaboratorio = useMemo(() => laboratori.find(l => l.id === formData.laboratorioId), [laboratori, formData.laboratorioId]);
    
    const figliAssociati = useMemo(() => {
        if (!selectedGenitore) return [];
        
        // La relazione 'Genitori-Figli' aggiunge dinamicamente il campo 'figliIds' al documento del genitore.
        // Accediamo a questo campo in modo dinamico.
        const figliIds = (selectedGenitore as any).figliIds as string[];

        if (!Array.isArray(figliIds)) {
            return [];
        }

        return tuttiFigli.filter(figlio => figliIds.includes(figlio.id));
    }, [selectedGenitore, tuttiFigli]);
    
    useEffect(() => {
        if (selectedLaboratorio) {
            const listinoAssociato = listini.find(li => li.laboratorioId === selectedLaboratorio.id);
            if (listinoAssociato) {
                const importo = (listinoAssociato.listinoBase || 0) * (formData.figliIds.length || 1);
                setFormData(prev => ({ ...prev, listinoId: listinoAssociato.id, importo }));
            }
        }
    }, [selectedLaboratorio, formData.figliIds, listini]);

    const handleSave = () => {
        if (!formData.clienteId || !formData.laboratorioId || formData.figliIds.length === 0 || formData.timeSlotIds.length === 0) {
            alert("Completa tutti i passaggi prima di salvare.");
            return;
        }
        onSave(formData);
    };

    return (
        <div className="space-y-6">
            <Step title="Seleziona Famiglia (Genitore)" stepNumber={1} isActive={true}>
                <Select id="clienteId" name="clienteId" label="" value={formData.clienteId} onChange={e => {
                    setFormData({ ...EMPTY_ISCRIZIONE, clienteId: e.target.value });
                    setStep(e.target.value ? 2 : 1);
                }} required>
                    <option value="">Seleziona una famiglia...</option>
                    {genitori.map(g => <option key={g.id} value={g.id}>{g.cognome} {g.nome}</option>)}
                </Select>
            </Step>

            <Step title="Seleziona Figli" stepNumber={2} isActive={step >= 2}>
                <div className="space-y-2 p-3 border rounded-md dark:border-gray-600">
                    {figliAssociati.length > 0 ? figliAssociati.map(figlio => (
                        <label key={figlio.id} className="flex items-center">
                            <input
                                type="checkbox"
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
                    )) : <p className="text-sm text-gray-500">Nessun figlio associato a questo genitore. Associa i figli tramite la micro-app 'Genitori-Figli'.</p>}
                </div>
            </Step>

             <Step title="Seleziona Laboratorio" stepNumber={3} isActive={step >= 2 && formData.figliIds.length > 0}>
                <Select id="laboratorioId" name="laboratorioId" label="" value={formData.laboratorioId} onChange={e => {
                    setFormData(prev => ({...prev, laboratorioId: e.target.value, timeSlotIds: []}));
                    setStep(e.target.value ? 4 : 3);
                }} required>
                    <option value="">Seleziona un laboratorio...</option>
                    {laboratori.filter(l => l.stato === 'Attivo' || l.stato === 'Programmato').map(l => <option key={l.id} value={l.id}>{l.codice}</option>)}
                </Select>
            </Step>
            
            <Step title="Seleziona Incontri" stepNumber={4} isActive={step >= 4}>
                 <div className="space-y-2 p-3 border rounded-md dark:border-gray-600 max-h-48 overflow-y-auto">
                    {selectedLaboratorio?.timeSlots?.length > 0 ? selectedLaboratorio.timeSlots.map((ts: TimeSlot) => (
                        <label key={ts.id} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.timeSlotIds.includes(ts.id)}
                                onChange={() => {
                                    const newTimeSlotIds = formData.timeSlotIds.includes(ts.id)
                                        ? formData.timeSlotIds.filter(id => id !== ts.id)
                                        : [...formData.timeSlotIds, ts.id];
                                    setFormData(prev => ({ ...prev, timeSlotIds: newTimeSlotIds }));
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm">Incontro #{ts.ordine} - {new Date(ts.data).toLocaleDateString('it-IT')}</span>
                        </label>
                    )) : <p className="text-sm text-gray-500">Nessun incontro definito per questo laboratorio.</p>}
                 </div>
                 <Button size="sm" variant="secondary" type="button" onClick={() => setFormData(prev => ({...prev, timeSlotIds: selectedLaboratorio?.timeSlots.map(ts => ts.id) || []}))} className="mt-2">Seleziona tutti</Button>
            </Step>

            <Step title="Riepilogo e Quota" stepNumber={5} isActive={step >= 4 && formData.laboratorioId !== ''}>
                <div className="p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 space-y-2">
                    <p><strong>Cliente:</strong> {selectedGenitore ? `${selectedGenitore.cognome} ${selectedGenitore.nome}`: 'N/D'}</p>
                    <p><strong>Figli Selezionati:</strong> {formData.figliIds.length}</p>
                    <p><strong>Laboratorio:</strong> {selectedLaboratorio?.codice || 'N/D'}</p>
                    <p><strong>Incontri Selezionati:</strong> {formData.timeSlotIds.length}</p>
                    <p className="text-lg font-bold mt-2">Totale Quota: {formData.importo.toFixed(2)}€</p>
                </div>
            </Step>

            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="button" variant="primary" onClick={handleSave} disabled={step < 4 || formData.timeSlotIds.length === 0}>
                    Crea Iscrizione
                </Button>
            </div>
        </div>
    );
};


export const Iscrizioni: React.FC = () => {
    const { iscrizioni, addIscrizione, updateIscrizione, deleteIscrizione, clienti, laboratori, listini, figli: tuttiFigli, genitori } = useMockData();
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

    const handleSave = (isc: Omit<Iscrizione, 'id' | 'codice'>) => {
        if (editingIscrizione) { // Se stiamo modificando
            updateIscrizione({ ...editingIscrizione, ...isc });
        } else { // Se stiamo creando
            addIscrizione(isc);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa iscrizione? L'operazione è irreversibile.")) {
            deleteIscrizione(id);
        }
    };

    const getLabCodice = (labId: string) => laboratori.find(l => l.id === labId)?.codice || 'N/A';
    
    const getClienteNome = (clienteId: string) => {
        // Logica nuova: clienteId è l'ID di un genitore
        const genitore = genitori.find(g => g.id === clienteId);
        if (genitore) {
            return `${genitore.cognome} ${genitore.nome}`;
        }
        // Fallback per vecchie iscrizioni create con l'anagrafica Clienti
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
                                    {/* <button onClick={() => handleOpenModal(isc)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button> */}
                                    <button onClick={() => handleDelete(isc.id)} className="text-red-600 hover:text-red-800 disabled:text-gray-400" disabled={!isc.id}><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingIscrizione ? "Modifica Iscrizione (non disponibile)" : "Nuova Iscrizione"}>
                    <IscrizioneForm
                        iscrizione={editingIscrizione || EMPTY_ISCRIZIONE}
                        genitori={genitori}
                        tuttiFigli={tuttiFigli}
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