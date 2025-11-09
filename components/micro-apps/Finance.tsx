import React, { useState, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { MovimentoFinance, TipoMovimento, CentroDiCosto, Imputazione } from '../../types';
import { EMPTY_MOVIMENTO, TIPO_MOVIMENTO_OPTIONS, CENTRO_DI_COSTO_OPTIONS, IMPUTAZIONI_MAP } from '../../constants';

const MovimentoForm: React.FC<{
    movimento: MovimentoFinance | Omit<MovimentoFinance, 'id'>,
    onSave: (mov: MovimentoFinance | Omit<MovimentoFinance, 'id'>) => void,
    onCancel: () => void
}> = ({ movimento, onSave, onCancel }) => {
    const [formData, setFormData] = useState(movimento);

    useEffect(() => {
        // Reset imputazione if centroDiCosto changes to an invalid one
        const validImputazioni = IMPUTAZIONI_MAP[formData.centroDiCosto];
        // FIX: Removed `as any` cast. The type of `IMPUTAZIONI_MAP` was corrected in `constants.ts`
        // to ensure `validImputazioni` is correctly typed as `Imputazione[]`, resolving the type conflict.
        if (!validImputazioni.includes(formData.imputazione)) {
            setFormData(prev => ({ ...prev, imputazione: validImputazioni[0] }));
        }
    }, [formData.centroDiCosto, formData.imputazione]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = name === 'importo' ? parseFloat(value) || 0 : value;
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
                <Input id="descrizione" name="descrizione" label="Descrizione" value={formData.descrizione} onChange={handleChange} required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="tipo" name="tipo" label="Tipo Movimento" options={TIPO_MOVIMENTO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                    <Input id="importo" name="importo" label="Importo (€)" type="number" step="0.01" value={formData.importo} onChange={handleChange} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="centroDiCosto" name="centroDiCosto" label="Centro di Costo" options={CENTRO_DI_COSTO_OPTIONS} value={formData.centroDiCosto} onChange={handleChange} required />
                    <Select id="imputazione" name="imputazione" label="Imputazione" options={IMPUTAZIONI_MAP[formData.centroDiCosto]} value={formData.imputazione} onChange={handleChange} required />
                </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva Movimento</Button>
            </div>
        </form>
    );
};

export const Finance: React.FC = () => {
    const { movimenti, addMovimento, updateMovimento, deleteMovimento } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMovimento, setEditingMovimento] = useState<MovimentoFinance | Omit<MovimentoFinance, 'id'> | null>(null);

    const handleOpenModal = (mov?: MovimentoFinance) => {
        setEditingMovimento(mov || { ...EMPTY_MOVIMENTO });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingMovimento(null);
        setIsModalOpen(false);
    };

    const handleSave = (mov: MovimentoFinance | Omit<MovimentoFinance, 'id'>) => {
        if ('id' in mov && mov.id) {
            updateMovimento(mov);
        } else {
            addMovimento(mov);
        }
        handleCloseModal();
    };
    
    const handleDelete = (movId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo movimento?')) {
            deleteMovimento(movId);
        }
    }
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Finanziaria</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Movimento</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Data</th>
                            <th scope="col" className="px-6 py-3">Descrizione</th>
                            <th scope="col" className="px-6 py-3">Imputazione</th>
                            <th scope="col" className="px-6 py-3 text-right">Importo</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movimenti.map(mov => (
                            <tr key={mov.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4">{new Date(mov.data).toLocaleDateString('it-IT')}</td>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{mov.descrizione}</th>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                        {mov.imputazione}
                                    </span>
                                </td>
                                <td className={`px-6 py-4 text-right font-semibold ${mov.tipo === TipoMovimento.ENTRATA ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {mov.tipo === TipoMovimento.ENTRATA ? '+' : '-'} {formatCurrency(mov.importo)}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(mov)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(mov.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingMovimento && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingMovimento && editingMovimento.id ? 'Modifica Movimento' : 'Nuovo Movimento'}>
                    <MovimentoForm movimento={editingMovimento} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};