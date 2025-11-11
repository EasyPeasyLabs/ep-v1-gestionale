import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Materiale } from '../../types';
import { EMPTY_MATERIALE, MATERIALE_UBICAZIONE_OPTIONS } from '../../constants';

const MaterialeForm: React.FC<{
    materiale: Materiale,
    onSave: (mat: Materiale) => void,
    onCancel: () => void
}> = ({ materiale, onSave, onCancel }) => {
    const [formData, setFormData] = useState(materiale);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const valueToSet = ['quantita', 'prezzoAbituale'].includes(name) ? parseFloat(value) || 0 : value;
        setFormData(prev => ({ ...prev, [name]: valueToSet }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                 <Input id="nome" name="nome" label="Nome Breve Materiale" value={formData.nome} onChange={handleChange} required />
                 <Input id="descrizione" name="descrizione" label="Descrizione" value={formData.descrizione} onChange={handleChange} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="quantita" name="quantita" label="Quantità" type="number" value={formData.quantita} onChange={handleChange} required />
                    <Input id="unitaMisura" name="unitaMisura" label="Unità di Misura" value={formData.unitaMisura} onChange={handleChange} required />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="prezzoAbituale" name="prezzoAbituale" label="Prezzo Abituale (€)" type="number" step="0.01" value={formData.prezzoAbituale} onChange={handleChange} />
                    <Select id="ubicazione" name="ubicazione" label="Ubicazione" options={MATERIALE_UBICAZIONE_OPTIONS} value={formData.ubicazione} onChange={handleChange} required />
                 </div>
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Materiale</Button>
            </div>
        </form>
    );
};


export const Materiali: React.FC = () => {
    const { materiali, addMateriale, updateMateriale, deleteMateriale } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMateriale, setEditingMateriale] = useState<Materiale | null>(null);

    const handleOpenModal = (mat?: Materiale) => {
        setEditingMateriale(mat || { ...EMPTY_MATERIALE });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingMateriale(null);
        setIsModalOpen(false);
    };

    const handleSave = (mat: Materiale) => {
        if (mat.id) {
            updateMateriale(mat);
        } else {
            const { id, ...newMat } = mat;
            addMateriale(newMat);
        }
        handleCloseModal();
    };
    
    const handleDelete = (matId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo materiale dall\'inventario?')) {
            deleteMateriale(matId);
        }
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Inventario Materiali</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Materiale</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Quantità</th>
                            <th scope="col" className="px-6 py-3">Ubicazione</th>
                            <th scope="col" className="px-6 py-3">Prezzo</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {materiali.map(mat => (
                            <tr key={mat.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{mat.nome}</th>
                                <td className="px-6 py-4">{mat.quantita} {mat.unitaMisura}</td>
                                <td className="px-6 py-4">{mat.ubicazione}</td>
                                <td className="px-6 py-4">{mat.prezzoAbituale.toFixed(2)}€</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(mat)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(mat.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingMateriale && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingMateriale.id ? 'Modifica Materiale' : 'Nuovo Materiale'}>
                    <MaterialeForm materiale={editingMateriale} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};