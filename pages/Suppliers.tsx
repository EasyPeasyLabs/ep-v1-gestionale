import React, { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInput, Location, LocationInput } from '../types';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../services/supplierService';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import { importSuppliersFromCSV } from '../services/importService';


const LocationForm: React.FC<{ location?: Location | null; onSave: (location: Location) => void; onCancel: () => void; }> = ({ location, onSave, onCancel }) => {
    const [name, setName] = useState(location?.name || '');
    const [address, setAddress] = useState(location?.address || '');
    const [zipCode, setZipCode] = useState(location?.zipCode || '');
    const [city, setCity] = useState(location?.city || '');
    const [province, setProvince] = useState(location?.province || '');
    const [capacity, setCapacity] = useState(location?.capacity || 0);
    const [rentalCost, setRentalCost] = useState(location?.rentalCost || 0);
    const [distance, setDistance] = useState(location?.distance || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: location?.id || Date.now().toString(),
            name, address, zipCode, city, province,
            capacity: Number(capacity),
            rentalCost: Number(rentalCost),
            distance: Number(distance),
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h3 className="text-lg font-bold mb-4">{location ? 'Modifica Sede' : 'Nuova Sede'}</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Nome Sede</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full input"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Indirizzo</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="mt-1 block w-full input"/>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">CAP</label>
                        <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Città</label>
                        <input type="text" value={city} onChange={e => setCity(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Provincia</label>
                    <input type="text" value={province} onChange={e => setProvince(e.target.value)} required className="mt-1 block w-full input"/>
                </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Capienza</label>
                        <input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required className="mt-1 block w-full input"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Nolo (€)</label>
                        <input type="number" value={rentalCost} onChange={e => setRentalCost(Number(e.target.value))} required className="mt-1 block w-full input"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Distanza (km)</label>
                        <input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} required className="mt-1 block w-full input"/>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">Salva Sede</button>
            </div>
        </form>
    );
};


const SupplierForm: React.FC<{ supplier?: Supplier | null; onSave: (supplier: SupplierInput | Supplier) => void; onCancel: () => void; }> = ({ supplier, onSave, onCancel }) => {
    const [companyName, setCompanyName] = useState(supplier?.companyName || '');
    const [vatNumber, setVatNumber] = useState(supplier?.vatNumber || '');
    const [address, setAddress] = useState(supplier?.address || '');
    const [zipCode, setZipCode] = useState(supplier?.zipCode || '');
    const [city, setCity] = useState(supplier?.city || '');
    const [province, setProvince] = useState(supplier?.province || '');
    const [email, setEmail] = useState(supplier?.email || '');
    const [phone, setPhone] = useState(supplier?.phone || '');
    const [locations, setLocations] = useState<Location[]>(supplier?.locations || []);

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);

    const handleSaveLocation = (location: Location) => {
        const existingIndex = locations.findIndex(l => l.id === location.id);
        if (existingIndex > -1) {
            const updatedLocations = [...locations];
            updatedLocations[existingIndex] = location;
            setLocations(updatedLocations);
        } else {
            setLocations([...locations, location]);
        }
        setIsLocationModalOpen(false);
        setEditingLocation(null);
    };
    
    const handleEditLocation = (location: Location) => {
        setEditingLocation(location);
        setIsLocationModalOpen(true);
    };

    const handleRemoveLocation = (id: string) => {
        setLocations(locations.filter(l => l.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplierData = {
            companyName, vatNumber, address, zipCode, city, province, email, phone, locations,
        };
        if (supplier?.id) {
            onSave({ ...supplierData, id: supplier.id });
        } else {
            onSave(supplierData as SupplierInput);
        }
    };

    return (
        <>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Ragione Sociale</label>
                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Partita IVA</label>
                        <input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Telefono</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Indirizzo Sede Legale</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="mt-1 block w-full input"/>
                </div>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">CAP</label>
                        <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                     <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Città</label>
                        <input type="text" value={city} onChange={e => setCity(e.target.value)} required className="mt-1 block w-full input"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Provincia</label>
                    <input type="text" value={province} onChange={e => setProvince(e.target.value)} required className="mt-1 block w-full input"/>
                </div>
                
                 <div className="pt-4 border-t mt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold text-slate-700">Sedi Operative</h3>
                         <button type="button" onClick={() => { setEditingLocation(null); setIsLocationModalOpen(true); }} className="btn-primary-outline text-sm">
                            <PlusIcon/>
                            <span className="ml-1">Aggiungi Sede</span>
                        </button>
                    </div>
                    <div className="mt-2 space-y-2">
                    {locations.length > 0 ? locations.map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                            <div>
                                <p className="text-sm font-medium">{loc.name}</p>
                                <p className="text-xs text-slate-500">{loc.address}, {loc.city}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button type="button" onClick={() => handleEditLocation(loc)} className="text-slate-500 hover:text-indigo-600"><PencilIcon/></button>
                                <button type="button" onClick={() => handleRemoveLocation(loc.id)} className="text-red-500 hover:text-red-700"><TrashIcon/></button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-slate-400 text-center py-4">Nessuna sede operativa aggiunta.</p>}
                    </div>
                </div>

            </div>
             <div className="mt-6 pt-4 border-t flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">Salva Fornitore</button>
            </div>
        </form>

        {isLocationModalOpen && (
            <Modal onClose={() => setIsLocationModalOpen(false)} size="lg">
                <LocationForm location={editingLocation} onSave={handleSaveLocation} onCancel={() => setIsLocationModalOpen(false)}/>
            </Modal>
        )}
        </>
    );
};


const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);


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
                await addSupplier(supplierData as SupplierInput);
            }
            handleCloseModal();
            fetchSuppliers();
        } catch (err) {
            console.error("Errore nel salvataggio del fornitore:", err);
            setError("Salvataggio fallito.");
        }
    };

    const handleDeleteSupplier = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo fornitore e tutte le sue sedi?")) {
            try {
                await deleteSupplier(id);
                fetchSuppliers();
            } catch (err) {
                console.error("Errore nell'eliminazione del fornitore:", err);
                setError("Eliminazione fallita.");
            }
        }
    };

     const handleImport = async (file: File) => {
        const result = await importSuppliersFromCSV(file);
        fetchSuppliers(); // Refresh the list after import
        return result;
    };


  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Fornitori</h1>
              <p className="mt-1 text-slate-500">Gestisci i fornitori e le loro sedi.</p>
            </div>
             <div className="flex items-center space-x-2">
                 <button onClick={() => setIsImportModalOpen(true)} className="flex items-center bg-white text-slate-700 px-4 py-2 rounded-lg shadow-sm border border-slate-300 hover:bg-slate-50 transition-colors">
                    <UploadIcon />
                    <span className="ml-2">Importa CSV</span>
                </button>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">
                    <PlusIcon />
                    <span className="ml-2">Aggiungi Fornitore</span>
                </button>
            </div>
        </div>
        
        {isModalOpen && (
            <Modal onClose={handleCloseModal} size="2xl">
                <SupplierForm supplier={editingSupplier} onSave={handleSaveSupplier} onCancel={handleCloseModal} />
            </Modal>
        )}

        {isImportModalOpen && (
            <ImportModal 
                entityName="Fornitori"
                templateCsvContent={'companyName,vatNumber,address,zipCode,city,province,email,phone\nSpazio Bimbi SRL,12345678901,"Via dei Giardini 10","20121","Milano","MI",info@spaziobimbi.it,029876543'}
                instructions={[
                    'La prima riga deve contenere le intestazioni richieste.',
                    'Il separatore dei campi deve essere la virgola (,).',
                    'Il campo "companyName" è la chiave unica per l\'aggiornamento.'
                ]}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        )}


        <div className="mt-8">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.map(supplier => (
                    <div key={supplier.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col">
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-slate-800">{supplier.companyName}</h2>
                            <p className="text-sm text-slate-500 mt-1">P.IVA: {supplier.vatNumber}</p>
                            <div className="mt-4 text-sm text-slate-600 space-y-1">
                                <p><strong>Email:</strong> {supplier.email}</p>
                                <p><strong>Tel:</strong> {supplier.phone}</p>
                                <p><strong>Sede:</strong> {supplier.address}, {supplier.city} ({supplier.province})</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h4 className="font-semibold text-sm">Sedi Operative ({supplier.locations.length})</h4>
                                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                                {supplier.locations.slice(0, 3).map(loc => (
                                    <li key={loc.id}>{loc.name} - {loc.address}, {loc.city}</li>
                                ))}
                                {supplier.locations.length > 3 && <li className="text-xs text-slate-400">...e altre {supplier.locations.length - 3}.</li>}
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