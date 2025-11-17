
import React, { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInput } from '../types';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../services/supplierService';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

const SupplierForm: React.FC<{ supplier?: Supplier | null; onSave: (supplier: SupplierInput | Supplier) => void; onCancel: () => void; }> = ({ supplier, onSave, onCancel }) => {
    const [name, setName] = useState(supplier?.name || '');
    const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '');
    const [email, setEmail] = useState(supplier?.email || '');
    const [phone, setPhone] = useState(supplier?.phone || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplierData = {
            name,
            contactPerson,
            email,
            phone,
            locations: supplier?.locations || [],
        };
        if (supplier?.id) {
            onSave({ ...supplierData, id: supplier.id });
        } else {
            onSave(supplierData);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Nome Fornitore</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Referente</label>
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Telefono</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
                </div>
            </div>
             <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Annulla
                </button>
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Salva
                </button>
            </div>
        </form>
    );
};


const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const fetchSuppliers = useCallback(async () => {
        try {
            setLoading(true);
            const suppliersData = await getSuppliers();
            setSuppliers(suppliersData);
            setError(null);
        } catch (err) {
            setError("Impossibile caricare i fornitori.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const handleOpenModal = (supplier: Supplier | null = null) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingSupplier(null);
        setIsModalOpen(false);
    };

    const handleSaveSupplier = async (supplierData: SupplierInput | Supplier) => {
        try {
            if ('id' in supplierData) {
                await updateSupplier(supplierData.id, supplierData);
            } else {
                await addSupplier(supplierData);
            }
            handleCloseModal();
            fetchSuppliers();
        } catch (err) {
            console.error("Errore nel salvataggio del fornitore:", err);
            setError("Salvataggio fallito.");
        }
    };

    const handleDeleteSupplier = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo fornitore?")) {
            try {
                await deleteSupplier(id);
                fetchSuppliers();
            } catch (err) {
                console.error("Errore nell'eliminazione del fornitore:", err);
                setError("Eliminazione fallita.");
            }
        }
    };


  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Fornitori</h1>
              <p className="mt-1 text-slate-500">Gestisci i fornitori e le loro sedi.</p>
            </div>
             <button onClick={() => handleOpenModal()} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                <PlusIcon />
                <span className="ml-2">Aggiungi Fornitore</span>
            </button>
        </div>
        
        {isModalOpen && (
            <Modal onClose={handleCloseModal}>
                <SupplierForm supplier={editingSupplier} onSave={handleSaveSupplier} onCancel={handleCloseModal} />
            </Modal>
        )}

        <div className="mt-8">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.map(supplier => (
                    <div key={supplier.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col">
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-slate-800">{supplier.name}</h2>
                            <p className="text-sm text-slate-500 mt-1">Referente: {supplier.contactPerson}</p>
                            <div className="mt-4 text-sm text-slate-600 space-y-1">
                                <p><strong>Email:</strong> {supplier.email}</p>
                                <p><strong>Tel:</strong> {supplier.phone}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h4 className="font-semibold text-sm">Sedi ({supplier.locations.length})</h4>
                                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                                {supplier.locations.map(loc => (
                                    <li key={loc.id}>{loc.address}, {loc.city}</li>
                                ))}
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end items-center space-x-3">
                             <button onClick={() => handleOpenModal(supplier)} className="text-slate-500 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100">
                                <PencilIcon />
                            </button>
                            <button onClick={() => handleDeleteSupplier(supplier.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50">
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            }
        </div>
    </div>
  );
};

export default Suppliers;