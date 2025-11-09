import React, { useState, useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlusIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import { Documento, Associato, ClienteTipo } from '../../types';
import { EMPTY_DOCUMENTO, DOCUMENTO_TIPO_OPTIONS, DOCUMENTO_STATO_OPTIONS } from '../../constants';

const DocumentoForm: React.FC<{
    documento: Documento | Omit<Documento, 'id'>,
    associabili: Associato[],
    onSave: (doc: Documento | Omit<Documento, 'id'>) => void,
    onCancel: () => void
}> = ({ documento, associabili, onSave, onCancel }) => {
    const [formData, setFormData] = useState(documento);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAssociatoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        if (!selectedValue) {
             setFormData(prev => ({ ...prev, associatoA: undefined }));
             return;
        }
        const [tipo, id] = selectedValue.split(':');
        const selectedAssociato = associabili.find(a => a.tipo === tipo && a.id === id);
        setFormData(prev => ({ ...prev, associatoA: selectedAssociato }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-4">
                <Input id="nome" name="nome" label="Nome Documento" value={formData.nome} onChange={handleChange} required />
                <Input id="dataCreazione" name="dataCreazione" label="Data Creazione" type="date" value={formData.dataCreazione} onChange={handleChange} required />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select id="tipo" name="tipo" label="Tipo" options={DOCUMENTO_TIPO_OPTIONS} value={formData.tipo} onChange={handleChange} required />
                    <Select id="stato" name="stato" label="Stato" options={DOCUMENTO_STATO_OPTIONS} value={formData.stato} onChange={handleChange} required />
                 </div>
                 <Select id="associatoA" name="associatoA" label="Associato A" value={formData.associatoA ? `${formData.associatoA.tipo}:${formData.associatoA.id}` : ''} onChange={handleAssociatoChange}>
                    <option value="">Nessuno</option>
                    <optgroup label="Clienti">
                        {associabili.filter(a => a.tipo === 'cliente').map(c => <option key={c.id} value={`cliente:${c.id}`}>{c.nome}</option>)}
                    </optgroup>
                    <optgroup label="Fornitori">
                        {associabili.filter(a => a.tipo === 'fornitore').map(f => <option key={f.id} value={`fornitore:${f.id}`}>{f.nome}</option>)}
                    </optgroup>
                 </Select>
                 <Input id="contenuto" name="contenuto" label="Contenuto/URL File" value={formData.contenuto} onChange={handleChange} placeholder="Incollare qui il link al file..." />
            </div>
            <div className="pt-5 mt-5 border-t dark:border-gray-700 flex justify-end gap-3">
                 <Button type="button" variant="secondary" onClick={onCancel}>Annulla</Button>
                 <Button type="submit" variant="primary">Salva Documento</Button>
            </div>
        </form>
    );
};


export const Documenti: React.FC = () => {
    const { documenti, addDocumento, updateDocumento, deleteDocumento, clienti, fornitori } = useMockData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDocumento, setEditingDocumento] = useState<Documento | Omit<Documento, 'id'> | null>(null);

    const associabili = useMemo<Associato[]>(() => {
        const clientiAssociabili = clienti.map(c => ({
            id: c.id,
            tipo: 'cliente' as 'cliente',
            nome: c.tipo === ClienteTipo.FAMIGLIA ? `Fam. ${c.dati.genitore1.cognome}` : c.dati.ragioneSociale
        }));
        const fornitoriAssociabili = fornitori.map(f => ({
            id: f.id,
            tipo: 'fornitore' as 'fornitore',
            nome: f.dati.ragioneSociale
        }));
        return [...clientiAssociabili, ...fornitoriAssociabili];
    }, [clienti, fornitori]);
    
    const handleOpenModal = (doc?: Documento) => {
        setEditingDocumento(doc || { ...EMPTY_DOCUMENTO });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingDocumento(null);
        setIsModalOpen(false);
    };

    const handleSave = (doc: Documento | Omit<Documento, 'id'>) => {
        if ('id' in doc && doc.id) {
            updateDocumento(doc);
        } else {
            addDocumento(doc);
        }
        handleCloseModal();
    };
    
    const handleDelete = (docId: string) => {
        if(window.confirm('Sei sicuro di voler eliminare questo documento?')) {
            deleteDocumento(docId);
        }
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Documenti</h1>
                <Button onClick={() => handleOpenModal()} icon={<PlusIcon />}>Nuovo Documento</Button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome Documento</th>
                            <th scope="col" className="px-6 py-3">Tipo</th>
                            <th scope="col" className="px-6 py-3">Associato A</th>
                            <th scope="col" className="px-6 py-3">Data</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documenti.map(doc => (
                            <tr key={doc.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{doc.nome}</th>
                                <td className="px-6 py-4">{doc.tipo}</td>
                                <td className="px-6 py-4">{doc.associatoA?.nome || '-'}</td>
                                <td className="px-6 py-4">{new Date(doc.dataCreazione).toLocaleDateString('it-IT')}</td>
                                <td className="px-6 py-4">{doc.stato}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(doc)} className="text-blue-600 hover:text-blue-800"><PencilIcon /></button>
                                    <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-800"><TrashIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && editingDocumento && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in editingDocumento && editingDocumento.id ? 'Modifica Documento' : 'Nuovo Documento'}>
                    <DocumentoForm documento={editingDocumento} associabili={associabili} onSave={handleSave} onCancel={handleCloseModal} />
                </Modal>
            )}
        </div>
    );
};
