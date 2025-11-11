import React, { useState, useMemo, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, CalendarIcon } from '../icons/Icons';
import { Laboratorio, Sede, TimeSlot, TimeSlotStato, Durata, Fornitore, LaboratorioStato } from '../../types';
import { EMPTY_LABORATORIO, GIORNI_SETTIMANA, EMPTY_TIMESLOT, TIME_SLOT_STATO_OPTIONS, LABORATORIO_STATO_OPTIONS } from '../../constants';

// Helper to get all sedi from all fornitori
const getAllSedi = (fornitori: Fornitore[]): Sede[] => {
    return fornitori.flatMap(f => f.sedi);
};

// Helper to generate a code
const generateCode = (sede: Sede | undefined, giorno: string, ora: string): string => {
    if (!sede || !giorno || !ora) return '';
    const nomeSede = sede.nome.replace(/\s/g, '').substring(0, 3).toUpperCase();
    return `${nomeSede}.${giorno}.${ora.replace(':', '')}`;
};

// --- FORM TIME SLOT ---
const TimeSlotForm: React.FC<{
    timeSlot: TimeSlot | Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>,
    onSave: (ts: TimeSlot | Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>) => void,
    onCancel: () => void,
}> = ({ timeSlot, onSave, onCancel }) => {
    const [formData, setFormData] = useState(timeSlot);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = e.target.type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
             <div className="space-y-4">
                <Input id="data" name="data" label="Data" type="date" value={formData.data} onChange={handleChange} required />
                <Select id="stato" name="stato" label="Stato" options={TIME_SLOT_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                <Input id="iscritti" name="iscritti" label="Iscritti" type="number" value={formData.iscritti} onChange={handleChange} />
                {'id' in formData && <Input id="partecipanti" name="partecipanti" label="Partecipanti Effettivi" type="number" value={formData.partecipanti || ''} onChange={handleChange} />}
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Incontro</Button>
            </div>
        </form>
    )
}


// --- MANAGER TIME SLOT ---
const TimeSlotManager: React.FC<{
    laboratorio: Laboratorio,
    onClose: () => void,
    addTimeSlot: (labId: string, ts: Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>) => void,
    updateTimeSlot: (labId: string, ts: TimeSlot) => void,
    deleteTimeSlot: (labId: string, tsId: string) => void,
}> = ({ laboratorio, onClose, addTimeSlot, updateTimeSlot, deleteTimeSlot }) => {
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<TimeSlot | Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'> | null>(null);

    const handleSaveSlot = (slot: TimeSlot | Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'>) => {
        if ('id' in slot) {
            updateTimeSlot(laboratorio.id, slot);
        } else {
            addTimeSlot(laboratorio.id, slot);
        }
        setIsSlotModalOpen(false);
        setEditingSlot(null);
    };
    
    const handleDeleteSlot = (slotId: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo incontro?")) {
            deleteTimeSlot(laboratorio.id, slotId);
        }
    }

    const getStatoBadgeColor = (stato: TimeSlotStato) => {
        switch (stato) {
            case TimeSlotStato.CONFERMATO: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case TimeSlotStato.PROGRAMMATO: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case TimeSlotStato.ANTICIPATO: case TimeSlotStato.POSTICIPATO: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case TimeSlotStato.ANNULLATO: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} title={`Gestione Incontri: ${laboratorio.codice}`}>
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button onClick={() => { setEditingSlot({ ...EMPTY_TIMESLOT }); setIsSlotModalOpen(true); }} icon={<PlusIcon />}>
                        Aggiungi Incontro
                    </Button>
                </div>

                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                     <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">#</th>
                                <th scope="col" className="px-6 py-3">Data</th>
                                <th scope="col" className="px-6 py-3">Stato</th>
                                <th scope="col" className="px-6 py-3">Iscritti</th>
                                <th scope="col" className="px-6 py-3">Partecipanti</th>
                                <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {laboratorio.timeSlots.sort((a,b) => a.ordine - b.ordine).map(ts => (
                                <tr key={ts.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4">{ts.ordine}</td>
                                    <td className="px-6 py-4 font-semibold">{new Date(ts.data).toLocaleDateString('it-IT')}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(ts.stato)}`}>{ts.stato}</span>
                                    </td>
                                    <td className="px-6 py-4">{ts.iscritti}</td>
                                    <td className="px-6 py-4">{ts.partecipanti ?? '-'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => { setEditingSlot(ts); setIsSlotModalOpen(true); }} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                        <button onClick={() => handleDeleteSlot(ts.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                    </td>
                                </tr>
                            ))}
                            {laboratorio.timeSlots.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-6 text-gray-500">Nessun incontro programmato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             {isSlotModalOpen && editingSlot && (
                <Modal 
                    isOpen={isSlotModalOpen} 
                    onClose={() => setIsSlotModalOpen(false)} 
                    title={'id' in editingSlot ? 'Modifica Incontro' : 'Nuovo Incontro'}
                >
                    <TimeSlotForm timeSlot={editingSlot} onSave={handleSaveSlot} onCancel={() => setIsSlotModalOpen(false)} />
                </Modal>
            )}
        </Modal>
    );
};


// --- FORM LABORATORIO ---
const LaboratorioForm: React.FC<{
    laboratorio: Laboratorio,
    sedi: Sede[],
    durate: Durata[],
    onSave: (lab: Laboratorio) => void,
    onCancel: () => void
}> = ({ laboratorio, sedi, durate, onSave, onCancel }) => {
    const [formData, setFormData] = useState(laboratorio);
    const [giorno, setGiorno] = useState(GIORNI_SETTIMANA[0]);
    const [ora, setOra] = useState('10:00');
    const [isManualDuration, setIsManualDuration] = useState(false);
    const [manualSlotCount, setManualSlotCount] = useState(0);

    useEffect(() => {
        const selectedSede = sedi.find(s => s.id === formData.sedeId);
        const newCode = generateCode(selectedSede, giorno, ora);
        setFormData(prev => ({ ...prev, codice: newCode }));
    }, [formData.sedeId, giorno, ora, sedi]);

    // Auto-calculate dataFine and generate timeSlots
    useEffect(() => {
        // Only run for new labs
        if (formData.id) return;

        const calculateDatesAndSlots = () => {
            if (!formData.dataInizio) return;

            const selectedDurata = durate.find(d => d.id === formData.durataId);
            const startDate = new Date(formData.dataInizio);
            startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

            let numSlots = 0;
            let isManual = false;

            if (selectedDurata) {
                switch (selectedDurata.nome) {
                    case 'OpenDay': numSlots = 1; break;
                    case 'Mensile': numSlots = 4; break;
                    case 'Bimestrale': numSlots = 8; break;
                    case 'Trimestrale': numSlots = 12; break;
                    default: isManual = true;
                }
            } else {
                isManual = true;
            }

            setIsManualDuration(isManual);

            if (isManual) {
                numSlots = manualSlotCount > 0 ? manualSlotCount : 0;
            }

            if (numSlots <= 0) {
                setFormData(prev => ({ ...prev, timeSlots: [], dataFine: prev.dataFine })); // Don't clear manual date
                return;
            }

            const newSlots: TimeSlot[] = [];
            for (let i = 0; i < numSlots; i++) {
                const slotDate = new Date(startDate);
                slotDate.setDate(slotDate.getDate() + (i * 7)); // 1 per week
                
                newSlots.push({
                    ...EMPTY_TIMESLOT,
                    id: `new_${Date.now()}_${i}`,
                    laboratorioId: formData.id,
                    ordine: i + 1,
                    data: slotDate.toISOString().split('T')[0],
                });
            }

            const finalDate = newSlots.length > 0 ? newSlots[newSlots.length - 1].data : '';

            setFormData(prev => ({
                ...prev,
                timeSlots: newSlots,
                dataFine: finalDate
            }));
        };

        calculateDatesAndSlots();
    }, [formData.id, formData.dataInizio, formData.durataId, durate, manualSlotCount]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = e.target.type === 'number' ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="stato" name="stato" label="Stato" options={LABORATORIO_STATO_OPTIONS} value={formData.stato} onChange={handleChange} disabled={!formData.id} />
                </div>

                <hr className="my-6 dark:border-gray-600"/>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Codifica Laboratorio</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-md dark:border-gray-600">
                     <Select id="sedeId" name="sedeId" label="Sede" value={formData.sedeId} onChange={handleChange} required>
                        <option value="">Seleziona...</option>
                        {sedi.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.indirizzo.citta})</option>)}
                     </Select>
                     <Select id="giorno" name="giorno" label="Giorno" value={giorno} onChange={e => setGiorno(e.target.value)} required>
                        {GIORNI_SETTIMANA.map(g => <option key={g} value={g}>{g}</option>)}
                     </Select>
                     <Input id="ora" name="ora" label="Orario (HH:MM)" value={ora} onChange={e => setOra(e.target.value)} required />
                     <Input id="codice" name="codice" label="Codice Generato" value={formData.codice} readOnly />
                </div>
                
                <hr className="my-6 dark:border-gray-600"/>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dettagli e Costi</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="durataId" name="durataId" label="Durata Predefinita" value={formData.durataId || ''} onChange={handleChange} disabled={!!formData.id}>
                        <option value="">Manuale / Altro</option>
                        {durate.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </Select>
                    {isManualDuration && !formData.id && (
                         <Input id="manualSlotCount" name="manualSlotCount" label="Numero di Incontri" type="number" value={manualSlotCount} onChange={(e) => setManualSlotCount(parseInt(e.target.value) || 0)} min="0" />
                    )}
                    <div></div>
                    <Input id="dataInizio" name="dataInizio" label="Data Inizio" type="date" value={formData.dataInizio} onChange={handleChange} required  disabled={!!formData.id}/>
                    <Input id="dataFine" name="dataFine" label="Data Fine" type="date" value={formData.dataFine} onChange={handleChange} required readOnly />
                    <Input id="costoAttivita" name="costoAttivita" label="Costo Attività (€)" type="number" step="0.01" value={formData.costoAttivita} readOnly />
                    <Input id="costoLogistica" name="costoLogistica" label="Costo Logistica (€)" type="number" step="0.01" value={formData.costoLogistica} readOnly />
                 </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Laboratorio</Button>
            </div>
        </form>
    );
};

// --- COMPONENTE PRINCIPALE ---
export const Laboratori: React.FC = () => {
    const { laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio, fornitori, durate, addTimeSlot, updateTimeSlot, deleteTimeSlot } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLaboratorio, setEditingLaboratorio] = useState<Laboratorio | null>(null);
    const [selectedLabForSlots, setSelectedLabForSlots] = useState<Laboratorio | null>(null);
    
    const allSedi = useMemo(() => getAllSedi(fornitori), [fornitori]);

    useEffect(() => {
        if (selectedLabForSlots) {
            const updatedLab = laboratori.find(lab => lab.id === selectedLabForSlots.id);
            if (updatedLab) {
                if (JSON.stringify(updatedLab) !== JSON.stringify(selectedLabForSlots)) {
                    setSelectedLabForSlots(updatedLab);
                }
            } else {
                setSelectedLabForSlots(null);
            }
        }
    }, [laboratori, selectedLabForSlots]);


    const handleOpenModal = (lab?: Laboratorio) => {
        setEditingLaboratorio(lab || { ...EMPTY_LABORATORIO, id: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLaboratorio(null);
        setIsModalOpen(false);
    };

    const handleSave = (lab: Laboratorio) => {
        if (lab.id) {
            updateLaboratorio(lab);
        } else {
            const { id, ...newLab } = lab;
            addLaboratorio(newLab);
        }
        handleCloseModal();
    };
    
    const handleDelete = (labId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo laboratorio e tutti i suoi incontri programmati?')) {
            deleteLaboratorio(labId);
        }
    }

    const handleConfirmLab = (lab: Laboratorio) => {
        if (window.confirm(`Confermare l'attivazione del laboratorio "${lab.codice}"? Lo stato passerà a "Attivo".`)) {
            updateLaboratorio({ ...lab, stato: LaboratorioStato.ATTIVO });
        }
    };

    const getSedeName = (sedeId: string) => {
        return allSedi.find(s => s.id === sedeId)?.nome || 'Sede non trovata';
    }
    
    const getStatoBadgeColor = (stato: LaboratorioStato) => {
        switch (stato) {
            case LaboratorioStato.ATTIVO: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case LaboratorioStato.PROGRAMMATO: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case LaboratorioStato.IN_PAUSA: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Laboratori</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />} disabled={allSedi.length === 0}>
                    Nuovo Laboratorio
                </Button>
            </div>
             {allSedi.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <p className="text-yellow-800 dark:text-yellow-200">Per aggiungere un laboratorio, devi prima creare almeno una Sede.</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto mt-4">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Codice</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3">Sede</th>
                            <th scope="col" className="px-6 py-3">Periodo</th>
                            <th scope="col" className="px-6 py-3">Incontri</th>
                            <th scope="col" className="px-6 py-3">Costi</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laboratori.map(lab => (
                            <tr key={lab.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{lab.codice}</span>
                                </th>
                                <td className="px-6 py-4">
                                     <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(lab.stato)}`}>{lab.stato}</span>
                                </td>
                                <td className="px-6 py-4">{getSedeName(lab.sedeId)}</td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <span>{lab.dataInizio} / {lab.dataFine}</span>
                                    {lab.stato === LaboratorioStato.PROGRAMMATO && (
                                        <button onClick={() => handleConfirmLab(lab)} className="text-xs bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded-full">
                                            ✓
                                        </button>
                                    )}
                                </td>
                                <td className="px-6 py-4">{lab.timeSlots.length}</td>
                                <td className="px-6 py-4 text-xs">
                                    <div>Att: {lab.costoAttivita.toFixed(2)}€</div>
                                    <div>Log: {lab.costoLogistica.toFixed(2)}€</div>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => setSelectedLabForSlots(lab)} className="text-gray-500 hover:text-blue-600"><CalendarIcon /></button>
                                    <button onClick={() => handleOpenModal(lab)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button
                                        onClick={() => handleDelete(lab.id)}
                                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        disabled={!lab.id}
                                    >
                                        <TrashIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                         {laboratori.length === 0 && (
                             <tr>
                                 <td colSpan={7} className="text-center py-8 text-gray-500">Nessun laboratorio trovato.</td>
                             </tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingLaboratorio && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingLaboratorio.id ? 'Modifica Laboratorio' : 'Nuovo Laboratorio'}>
                    <LaboratorioForm laboratorio={editingLaboratorio} sedi={allSedi} durate={durate} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}

            {selectedLabForSlots && (
                <TimeSlotManager 
                    laboratorio={selectedLabForSlots} 
                    onClose={() => setSelectedLabForSlots(null)}
                    addTimeSlot={addTimeSlot}
                    updateTimeSlot={updateTimeSlot}
                    deleteTimeSlot={deleteTimeSlot}
                />
            )}
        </div>
    );
};