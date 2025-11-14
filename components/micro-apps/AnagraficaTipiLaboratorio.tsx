import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { LaboratorioTipoDef } from '../../types';
import { EMPTY_LABORATORIO_TIPO_DEF } from '../../constants';

// Form Component
const TipoLabForm: React.FC<{
    tipoLab: LaboratorioTipoDef | Omit<LaboratorioTipoDef, 'id'>,
    onSave: (data: LaboratorioTipoDef | Omit<LaboratorioTipoDef, 'id'>) => void,
    onCancel: () => void
}> = ({ tipoLab, onSave, onCancel }) => {
    const [formData, setFormData] = useState(tipoLab);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input id="tipo" name="tipo" label="Tipo di Laboratorio" value={formData.tipo} onChange={handleChange} required />
                <Input 
                    id="codice" 
                    name="codice" 
                    label="Codice (2 caratteri alfanumerici)" 
                    value={formData.codice} 
                    onChange={handleChange} 
                    required 
                    maxLength={2}
                    pattern="[a-zA-Z0-9]{2}"
                    title="Inserire 2 caratteri alfanumerici (lettere o numeri)."
                />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                <Button type="submit" variant="primary">Salva</Button>
            </div>
        </form>
    );
};

// Main Component
export const AnagraficaTipiLaboratorio: React.FC = () => {
    const { laboratoriTipi, addLaboratorioTipo, updateLaboratorioTipo, deleteLaboratorioTipo, laboratori } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LaboratorioTipoDef | Omit<LaboratorioTipoDef, 'id'> | null>(null);

    const handleOpenModal = (item?: LaboratorioTipoDef) => {
        setEditingItem(item || EMPTY_LABORATORIO_TIPO_DEF);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSave = (data: LaboratorioTipoDef | Omit<LaboratorioTipoDef, 'id'>) => {
        if ('id' in data && data.id) {
            updateLaboratorioTipo(data as LaboratorioTipoDef);
        } else {
            addLaboratorioTipo(data as Omit<LaboratorioTipoDef, 'id'>);
        }
        handleCloseModal();
    };

    const handleDelete = (item: LaboratorioTipoDef) => {
        if (laboratori.some(lab => lab.tipo === item.tipo)) {
            alert(`Impossibile eliminare il tipo "${item.tipo}" perché è utilizzato in uno o più laboratori.`);
            return;
        }
        if (window.confirm(`Sei sicuro di voler eliminare il tipo di laboratorio "${item.tipo}"?`)) {
            deleteLaboratorioTipo(item.id);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Tipo Lab</Button>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Codice</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {laboratoriTipi.map(item => (
                            <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{item.tipo}</th>
                                <td className="px-6 py-4 font-mono">{item.codice}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {laboratoriTipi.length === 0 && (
                             <tr><td colSpan={3} className="text-center py-8 text-gray-500">Nessun tipo di laboratorio trovato.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingItem && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingItem && editingItem.id) ? 'Modifica Tipo Laboratorio' : 'Nuovo Tipo Laboratorio'}>
                    <TipoLabForm tipoLab={editingItem} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};