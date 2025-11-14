import React, { useState } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { DocumentoTipoDef } from '../../types';
import { EMPTY_DOCUMENTO_TIPO_DEF } from '../../constants';

// Form Component
const DocumentoTipoForm: React.FC<{
    tipoDoc: DocumentoTipoDef | Omit<DocumentoTipoDef, 'id'>,
    onSave: (data: DocumentoTipoDef | Omit<DocumentoTipoDef, 'id'>) => void,
    onCancel: () => void
}> = ({ tipoDoc, onSave, onCancel }) => {
    const [formData, setFormData] = useState(tipoDoc);

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
                <Input id="nome" name="nome" label="Nome Tipo Documento" value={formData.nome} onChange={handleChange} required />
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
export const AnagraficaDocumenti: React.FC = () => {
    const { documenti, documentiTipi, addDocumentoTipo, updateDocumentoTipo, deleteDocumentoTipo } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DocumentoTipoDef | Omit<DocumentoTipoDef, 'id'> | null>(null);

    const handleOpenModal = (item?: DocumentoTipoDef) => {
        setEditingItem(item || EMPTY_DOCUMENTO_TIPO_DEF);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSave = (data: DocumentoTipoDef | Omit<DocumentoTipoDef, 'id'>) => {
        if ('id' in data && data.id) {
            updateDocumentoTipo(data as DocumentoTipoDef);
        } else {
            addDocumentoTipo(data as Omit<DocumentoTipoDef, 'id'>);
        }
        handleCloseModal();
    };

    const handleDelete = (item: DocumentoTipoDef) => {
        // Check if the type is in use
        if (documenti.some(d => d.tipo === item.nome)) {
            alert(`Impossibile eliminare il tipo "${item.nome}" perché è in uso in uno o più documenti.`);
            return;
        }

        if (window.confirm(`Sei sicuro di voler eliminare il tipo di documento "${item.nome}"?`)) {
            deleteDocumentoTipo(item.id);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Tipo Documento</Button>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Codice</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documentiTipi.map(item => (
                            <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{item.nome}</th>
                                <td className="px-6 py-4 font-mono">{item.codice.toUpperCase()}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                        {documentiTipi.length === 0 && (
                             <tr><td colSpan={3} className="text-center py-8 text-gray-500">Nessun tipo di documento definito.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingItem && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={('id' in editingItem && editingItem.id) ? 'Modifica Tipo Documento' : 'Nuovo Tipo Documento'}>
                    <DocumentoTipoForm tipoDoc={editingItem} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};