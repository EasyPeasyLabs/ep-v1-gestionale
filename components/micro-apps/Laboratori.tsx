
import React, { useState, useMemo, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Laboratorio, Sede } from '../../types';
import { EMPTY_LABORATORIO, GIORNI_SETTIMANA } from '../../constants';

// Helper to get all sedi from all fornitori
const getAllSedi = (fornitori: any[]): Sede[] => {
    return fornitori.flatMap(f => f.sedi);
};

// Helper to generate a code
const generateCode = (sede: Sede | undefined, giorno: string, ora: string): string => {
    if (!sede || !giorno || !ora) return '';
    const nomeSede = sede.nome.replace(/\s/g, '').substring(0, 3).toUpperCase();
    return `${nomeSede}.${giorno}.${ora}`;
};

const LaboratorioForm: React.FC<{
    laboratorio: Laboratorio | Omit<Laboratorio, 'id'>,
    sedi: Sede[],
    onSave: (lab: Laboratorio | Omit<Laboratorio, 'id'>) => void,
    onCancel: () => void
}> = ({ laboratorio, sedi, onSave, onCancel }) => {
    const [formData, setFormData] = useState(laboratorio);
    
    // State for code generation
    const [giorno, setGiorno] = useState(GIORNI_SETTIMANA[0]);
    const [ora, setOra] = useState('10:00');

    useEffect(() => {
        const selectedSede = sedi.find(s => s.id === formData.sedeId);
        const newCode = generateCode(selectedSede, giorno, ora);
        setFormData(prev => ({ ...prev, codice: newCode }));
    }, [formData.sedeId, giorno, ora, sedi]);


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
                    <Input id="dataInizio" name="dataInizio" label="Data Inizio" type="date" value={formData.dataInizio} onChange={handleChange} required />
                    <Input id="dataFine" name="dataFine" label="Data Fine" type="date" value={formData.dataFine} onChange={handleChange} required />
                    <Input id="prezzoListino" name="prezzoListino" label="Prezzo Listino (€)" type="number" value={formData.prezzoListino} onChange={handleChange} required />
                    <Input id="costoAttivita" name="costoAttivita" label="Costo Attività (€)" type="number" value={formData.costoAttivita} onChange={handleChange} />
                    <Input id="costoLogistica" name="costoLogistica" label="Costo Logistica (€)" type="number" value={formData.costoLogistica} onChange={handleChange} />
                 </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Laboratorio</Button>
            </div>
        </form>
    );
};


export const Laboratori: React.FC = () => {
    const { laboratori, addLaboratorio, updateLaboratorio, deleteLaboratorio, fornitori } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLaboratorio, setEditingLaboratorio] = useState<Laboratorio | Omit<Laboratorio, 'id'> | null>(null);

    const allSedi = useMemo(() => getAllSedi(fornitori), [fornitori]);

    const handleOpenModal = (lab?: Laboratorio) => {
        setEditingLaboratorio(lab || { ...EMPTY_LABORATORIO });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingLaboratorio(null);
        setIsModalOpen(false);
    };

    const handleSave = (lab: Laboratorio | Omit<Laboratorio, 'id'>) => {
        if ('id' in lab && lab.id) {
            updateLaboratorio(lab);
        } else {
            addLaboratorio(lab);
        }
        handleCloseModal();
    };
    
    const handleDelete = (labId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo laboratorio?')) {
            deleteLaboratorio(labId);
        }
    }

    const getSedeName = (sedeId: string) => {
        return allSedi.find(s => s.id === sedeId)?.nome || 'Sede non trovata';
    }

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
                            <th scope="col" className="px-6 py-3">Sede</th>
                            <th scope="col" className="px-6 py-3">Periodo</th>
                            <th scope="col" className="px-6 py-3">Time Slots</th>
                            <th scope="col" className="px-6 py-3">Prezzo</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laboratori.map(lab => (
                            <tr key={lab.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{lab.codice}</span>
                                </th>
                                <td className="px-6 py-4">{getSedeName(lab.sedeId)}</td>
                                <td className="px-6 py-4">{lab.dataInizio} / {lab.dataFine}</td>
                                <td className="px-6 py-4">{lab.timeSlots.length}</td>
                                <td className="px-6 py-4">{lab.prezzoListino}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(lab)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(lab.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingLaboratorio && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingLaboratorio && editingLaboratorio.id ? 'Modifica Laboratorio' : 'Nuovo Laboratorio'}>
                    <LaboratorioForm laboratorio={editingLaboratorio} sedi={allSedi} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};
