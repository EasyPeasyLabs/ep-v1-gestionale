import React, { useState, useMemo, useEffect, FC } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon, CalendarIcon } from '../icons/Icons';
import { Laboratorio, SedeAnagrafica, TimeSlot, TimeSlotStato, LaboratorioStato, LaboratorioTipoDef } from '../../types';
import { EMPTY_LABORATORIO, GIORNI_SETTIMANA, EMPTY_TIMESLOT, TIME_SLOT_STATO_OPTIONS, LABORATORIO_STATO_OPTIONS } from '../../constants';

const generateCode = (sede: SedeAnagrafica | undefined, giorno: string, ora: string): string => {
    if (!sede || !giorno || !ora) return '';
    const nomeSede = sede.nome.replace(/\s/g, '').substring(0, 3).toUpperCase();
    const giornoCode = giorno.substring(0, 3).toUpperCase();
    return `${nomeSede}.${giornoCode}.${ora.replace(':', '')}`;
};

const LaboratorioForm: FC<{
    laboratorio: Laboratorio | Omit<Laboratorio, 'id'>,
    sedi: SedeAnagrafica[],
    tipiLab: LaboratorioTipoDef[],
    onSave: (lab: Laboratorio | Omit<Laboratorio, 'id'>) => void,
    onCancel: () => void
}> = ({ laboratorio, sedi, tipiLab, onSave, onCancel }) => {
    const [formData, setFormData] = useState(laboratorio);
    const [ora, setOra] = useState('10:00');

    const dataInizioDate = useMemo(() => {
        if (!formData.dataInizio) return null;
        const [year, month, day] = formData.dataInizio.split('-').map(Number);
        return new Date(year, month - 1, day);
    }, [formData.dataInizio]);

    const giornoSettimana = useMemo(() => {
        if (!dataInizioDate) return GIORNI_SETTIMANA[0];
        const dayIndex = (dataInizioDate.getDay() + 6) % 7; // 0=Lunedì, ..., 6=Domenica
        return GIORNI_SETTIMANA[dayIndex];
    }, [dataInizioDate]);

    useEffect(() => {
        const selectedSede = sedi.find(s => s.id === formData.sedeId);
        const newCode = generateCode(selectedSede, giornoSettimana, ora);
        setFormData(prev => ({ ...prev, codice: newCode }));
    }, [formData.sedeId, giornoSettimana, ora, sedi]);

    useEffect(() => {
        const calculateDatesAndSlots = () => {
            if (!dataInizioDate || !formData.tipoId) {
                setFormData(prev => ({ ...prev, timeSlots: [], dataFine: '' }));
                return;
            }

            const tipoLab = tipiLab.find(t => t.id === formData.tipoId);
            if (!tipoLab) {
                 setFormData(prev => ({ ...prev, timeSlots: [], dataFine: '' }));
                return;
            }
            
            const numSlots = tipoLab.numeroTimeSlots || 0;

            const newSlots: TimeSlot[] = [];
            let lastDate = new Date(dataInizioDate);

            for (let i = 0; i < numSlots; i++) {
                const slotDate = new Date(dataInizioDate);
                slotDate.setDate(slotDate.getDate() + (i * 7));
                
                const slotYear = slotDate.getFullYear();
                const slotMonth = String(slotDate.getMonth() + 1).padStart(2, '0');
                const slotDay = String(slotDate.getDate()).padStart(2, '0');
                const formattedDate = `${slotYear}-${slotMonth}-${slotDay}`;

                newSlots.push({
                    ...EMPTY_TIMESLOT,
                    id: `new_${Date.now()}_${i}`,
                    laboratorioId: 'id' in formData ? formData.id : '',
                    ordine: i + 1,
                    data: formattedDate,
                });
                lastDate = slotDate;
            }
            
            const finalYear = lastDate.getFullYear();
            const finalMonth = String(lastDate.getMonth() + 1).padStart(2, '0');
            const finalDay = String(lastDate.getDate()).padStart(2, '0');
            const formattedFinalDate = `${finalYear}-${finalMonth}-${finalDay}`;

            setFormData(prev => ({ ...prev, timeSlots: newSlots, dataFine: formattedFinalDate }));
        };
        calculateDatesAndSlots();

    }, [formData.dataInizio, formData.tipoId, tipiLab, dataInizioDate]);

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
                 <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dettagli Principali</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md dark:border-gray-600">
                    <Select id="tipoId" name="tipoId" label="Tipo Lab" value={formData.tipoId} onChange={handleChange} required>
                        <option value="">Seleziona...</option>
                        {tipiLab.map(t => <option key={t.id} value={t.id}>{t.tipo}</option>)}
                    </Select>
                     <Select id="sedeId" name="sedeId" label="Sede" value={formData.sedeId} onChange={handleChange} required>
                        <option value="">Seleziona...</option>
                        {sedi.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.indirizzo.citta})</option>)}
                     </Select>
                     <Input id="dataInizio" name="dataInizio" label="Data Inizio" type="date" value={formData.dataInizio} onChange={handleChange} required/>
                     <Input id="ora" name="ora" label="Orario Inizio (HH:MM)" value={ora} onChange={e => setOra(e.target.value)} required />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                    <Input id="giorno" name="giorno" label="Giorno" value={giornoSettimana} readOnly />
                    <Input id="dataFine" name="dataFine" label="Data Fine (calcolata)" type="date" value={formData.dataFine} readOnly />
                    <Input id="codice" name="codice" label="Codice Generato" value={formData.codice} readOnly />
                 </div>
                 
                 <hr className="my-4 dark:border-gray-700" />
                 <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dettagli e Costi</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="costoAttivita" name="costoAttivita" label="Costo Attività (€)" type="number" step="0.01" value={formData.costoAttivita} onChange={handleChange} />
                    <Input id="costoLogistica" name="costoLogistica" label="Costo Logistica (€)" type="number" step="0.01" value={formData.costoLogistica} onChange={handleChange} />
                    <Select id="stato" name="stato" label="Stato" options={LABORATORIO_STATO_OPTIONS} value={formData.stato} onChange={handleChange} />
                 </div>
                 
                 {formData.timeSlots.length > 0 && (
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Anteprima Incontri Generati</h3>
                        <p className="text-sm text-gray-500 mb-2">Verranno generati <strong>{formData.timeSlots.length}</strong> incontri settimanali.</p>
                        <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                            {formData.timeSlots.map(slot => (
                                <div key={slot.id || slot.ordine} className="flex items-center gap-3 text-sm">
                                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                                    <span>Incontro #{slot.ordine}:</span>
                                    <span className="font-semibold">{new Date(`${slot.data}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Laboratorio</Button>
            </div>
        </form>
    );
}

export const Laboratori: React.FC = () => {
    const { laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio, sedi, laboratoriTipi } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLaboratorio, setEditingLaboratorio] = useState<Laboratorio | Omit<Laboratorio, 'id'> | null>(null);

    const sedeColorMap = useMemo(() => new Map(sedi.map(s => [s.id, s.colore])), [sedi]);
    
    const handleOpenModal = (lab?: Laboratorio) => {
        setEditingLaboratorio(lab || EMPTY_LABORATORIO);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLaboratorio(null);
        setIsModalOpen(false);
    };

    const handleSave = (lab: Laboratorio | Omit<Laboratorio, 'id'>) => {
        if ('id' in lab && lab.id) {
            updateLaboratorio(lab as Laboratorio);
        } else {
            addLaboratorio(lab as Omit<Laboratorio, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleDelete = (labId: string) => {
        // La conferma è ora gestita all'interno dell'hook deleteLaboratorio per un messaggio sull'integrità dei dati più accurato.
        deleteLaboratorio(labId);
    }
    
    const getSedeName = (sedeId: string) => sedi.find(s => s.id === sedeId)?.nome || 'N/D';
    const getStatoBadgeColor = (stato: LaboratorioStato) => {
        switch (stato) {
            case LaboratorioStato.ATTIVO: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case LaboratorioStato.PROGRAMMATO: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case LaboratorioStato.IN_PAUSA: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            default: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        }
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Laboratori</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />} disabled={sedi.length === 0 || laboratoriTipi.length === 0}>
                    Nuovo Laboratorio
                </Button>
            </div>
             {(sedi.length === 0 || laboratoriTipi.length === 0) && (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 p-4 rounded-md">
                    <p className="text-yellow-800 dark:text-yellow-200">Per aggiungere un laboratorio, devi prima creare almeno una Sede e un Tipo Lab nelle Anagrafiche.</p>
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
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laboratori.map((lab: Laboratorio) => (
                            <tr key={lab.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" style={{borderLeft: `5px solid ${sedeColorMap.get(lab.sedeId) || '#A0AEC0'}`}}>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{lab.codice}</span>
                                </th>
                                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(lab.stato)}`}>{lab.stato}</span></td>
                                <td className="px-6 py-4">{getSedeName(lab.sedeId)}</td>
                                <td className="px-6 py-4 text-xs">{new Date(`${lab.dataInizio}T00:00:00`).toLocaleDateString('it-IT')} - {new Date(`${lab.dataFine}T00:00:00`).toLocaleDateString('it-IT')}</td>
                                <td className="px-6 py-4">{lab.timeSlots.length}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(lab)} className="text-blue-600 hover:text-blue-800" title="Modifica Laboratorio"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(lab.id)} className="text-red-600 hover:text-red-800" disabled={!lab.id}><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                         {laboratori.length === 0 && (
                             <tr><td colSpan={6} className="text-center py-8 text-gray-500">Nessun laboratorio trovato.</td></tr>
                         )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingLaboratorio && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingLaboratorio && editingLaboratorio.id) ? 'Modifica Laboratorio' : 'Nuovo Laboratorio'}>
                    <LaboratorioForm laboratorio={editingLaboratorio} sedi={sedi} tipiLab={laboratoriTipi} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};