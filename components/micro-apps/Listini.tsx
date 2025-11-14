
import React, { useState, useMemo, FC } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
// FIX: Imported SedeAnagrafica as Sede to match component's internal usage.
import { Listino, Laboratorio, SedeAnagrafica as Sede } from '../../types';
import { EMPTY_LISTINO } from '../../constants';

type ListinoFormProps = {
    listino: Listino,
    laboratori: Laboratorio[],
    sedi: Sede[],
    onSave: (l: Listino) => void,
    onCancel: () => void,
};

const ListinoForm: FC<ListinoFormProps> = ({ listino, laboratori, sedi, onSave, onCancel }) => {
    const [formData, setFormData] = useState(listino);

    const selectedLab = useMemo(() => laboratori.find(l => l.id === formData.laboratorioId), [formData.laboratorioId, laboratori]);
    const selectedSede = useMemo(() => sedi.find(s => s.id === selectedLab?.sedeId), [selectedLab, sedi]);

    const totaleCosti = useMemo(() => {
        if (!selectedLab || !selectedSede) return 0;
        const costoNolo = (selectedSede.costoNoloOra || 0) * (selectedLab.timeSlots.length || 0);
        return (selectedLab.costoAttivita || 0) + (selectedLab.costoLogistica || 0) + costoNolo;
    }, [selectedLab, selectedSede]);

    const profittoEuro = useMemo(() => (totaleCosti * (formData.profittoPercentuale / 100)), [totaleCosti, formData.profittoPercentuale]);
    const listinoProposto = useMemo(() => totaleCosti + profittoEuro, [totaleCosti, profittoEuro]);
    const scostamentoEuro = useMemo(() => formData.listinoBase - totaleCosti, [formData.listinoBase, totaleCosti]);
    const scostamentoPerc = useMemo(() => (totaleCosti > 0 ? (scostamentoEuro / totaleCosti) * 100 : 0), [scostamentoEuro, totaleCosti]);

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
                <Select id="laboratorioId" name="laboratorioId" label="Laboratorio" value={formData.laboratorioId} onChange={handleChange} required disabled={!!formData.id}>
                    <option value="">Seleziona un laboratorio...</option>
                    {laboratori.map(l => <option key={l.id} value={l.id}>{l.codice}</option>)}
                </Select>
                <Input id="listinoBase" name="listinoBase" label="Listino Base (€)" type="number" step="0.01" value={formData.listinoBase} onChange={handleChange} required />
                
                <div className="p-4 border rounded-md dark:border-gray-600 space-y-2">
                    <h3 className="font-semibold">Analisi Costi e Profitti</h3>
                    <div className="text-sm"><strong>Totale Costi Stimati:</strong> {totaleCosti.toFixed(2)}€</div>
                    <div className="text-sm"><strong>Scostamento da Listino:</strong> <span className={scostamentoEuro >= 0 ? 'text-green-500' : 'text-red-500'}>{scostamentoEuro.toFixed(2)}€ ({scostamentoPerc.toFixed(1)}%)</span></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <Input id="profittoPercentuale" name="profittoPercentuale" label="Profitto Desiderato (%)" type="number" value={formData.profittoPercentuale} onChange={handleChange} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Listino Proposto</label>
                        <div className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-600 dark:border-gray-600 dark:text-white">
                           {listinoProposto.toFixed(2)}€ <span className="text-xs text-gray-500">(Costi + {profittoEuro.toFixed(2)}€)</span>
                        </div>
                    </div>
                </div>

            </div>
             <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Listino</Button>
            </div>
        </form>
    );
};

export const Listini: React.FC = () => {
    // FIX: Fetched 'sedi' collection directly, as the denormalized model is no longer used.
    const { listini, addListino, updateListino, deleteListino, laboratori, sedi } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingListino, setEditingListino] = useState<Listino | null>(null);

    const laboratoriConListino = useMemo(() => listini.map(l => l.laboratorioId), [listini]);
    const laboratoriDisponibili = useMemo(() => laboratori.filter(l => !laboratoriConListino.includes(l.id)), [laboratori, laboratoriConListino]);

    const handleOpenModal = (list?: Listino) => {
        setEditingListino(list || { ...EMPTY_LISTINO });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingListino(null);
        setIsModalOpen(false);
    };

    const handleSave = (listino: Listino) => {
        if (listino.id) {
            updateListino(listino);
        } else {
            const { id, ...newListino } = listino;
            addListino(newListino);
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo listino?")) {
            deleteListino(id);
        }
    };
    
    const getLabCodice = (labId: string) => laboratori.find(l => l.id === labId)?.codice || 'N/A';

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Listini Nominali</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />} disabled={laboratoriDisponibili.length === 0}>
                    Nuovo Listino
                </Button>
            </div>
            {laboratori.length > 0 && laboratoriDisponibili.length === 0 && (
                 <div className="bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-400 p-4 rounded-md mb-4">
                    <p className="text-blue-800 dark:text-blue-200">Tutti i laboratori esistenti hanno già un listino associato.</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Laboratorio</th>
                            <th scope="col" className="px-6 py-3 text-right">Prezzo Base</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {listini.map(list => (
                            <tr key={list.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{getLabCodice(list.laboratorioId)}</span>
                                </th>
                                <td className="px-6 py-4 text-right font-semibold">{list.listinoBase.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(list)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(list.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {listini.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-8 text-gray-500">Nessun listino trovato.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingListino && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingListino.id ? "Modifica Listino" : "Nuovo Listino"}>
                    <ListinoForm 
                        listino={editingListino}
                        // Se stiamo modificando, passiamo tutti i lab; se nuovo, solo quelli senza listino
                        laboratori={editingListino.id ? laboratori : laboratoriDisponibili}
                        sedi={sedi}
                        onSave={handleSave}
                        onCancel={handleCloseModal}
                    />
                </Modal>
            )}
        </div>
    );
};
