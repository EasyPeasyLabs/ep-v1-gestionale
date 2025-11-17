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
import { importSuppliersFromExcel } from '../services/importService';


const LocationForm: React.FC<{ location?: Location | null; onSave: (location: Location) => void; onCancel: () => void; }> = ({ location, onSave, onCancel }) => {
    const [name, setName] = useState(location?.name || '');
    const [address, setAddress] = useState(location?.address || '');
    const [zipCode, setZipCode] = useState(location?.zipCode || '');
    const [city, setCity] = useState(location?.city || '');
    const [province, setProvince] = useState(location?.province || '');
    const [capacity, setCapacity] = useState(location?.capacity || 0);
    const [rentalCost, setRentalCost] = useState(location?.rentalCost || 0);
    const [distance, setDistance] = useState(location?.distance || 0);
    const [color, setColor] = useState(location?.color || '#a855f7'); // default purple

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: location?.id || Date.now().toString(), name, address, zipCode, city, province,
            capacity: Number(capacity), rentalCost: Number(rentalCost), distance: Number(distance), color,
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h3 className="text-lg font-bold mb-4">{location ? 'Modifica Sede' : 'Nuova Sede'}</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 md-input-group"><input id="locName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locName" className="md-input-label">Nome Sede</label></div>
                    <div><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 rounded-md border" style={{borderColor: 'var(--md-divider)'}}/></div>
                </div>
                <div className="md-input-group"><input id="locAddr" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locAddr" className="md-input-label">Indirizzo</label></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="locZip" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locZip" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="locCity" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locCity" className="md-input-label">Città</label></div>
                </div>
                <div className="md-input-group"><input id="locProv" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locProv" className="md-input-label">Provincia</label></div>
                 <div className="grid grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="locCap" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCap" className="md-input-label">Capienza</label></div>
                    <div className="md-input-group"><input id="locCost" type="number" value={rentalCost} onChange={e => setRentalCost(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCost" className="md-input-label">Nolo (€)</label></div>
                    <div className="md-input-group"><input id="locDist" type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locDist" className="md-input-label">Distanza (km)</label></div>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva Sede</button>
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
            const updatedLocations = [...locations]; updatedLocations[existingIndex] = location; setLocations(updatedLocations);
        } else { setLocations([...locations, location]); }
        setIsLocationModalOpen(false); setEditingLocation(null);
    };
    
    const handleEditLocation = (location: Location) => { setEditingLocation(location); setIsLocationModalOpen(true); };
    const handleRemoveLocation = (id: string) => { setLocations(locations.filter(l => l.id !== id)); };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplierData = { companyName, vatNumber, address, zipCode, city, province, email, phone, locations };
        if (supplier?.id) { onSave({ ...supplierData, id: supplier.id }); } 
        else { onSave(supplierData as SupplierInput); }
    };

    return (
        <>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="supName" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supName" className="md-input-label">Ragione Sociale</label></div>
                    <div className="md-input-group"><input id="supVat" type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supVat" className="md-input-label">Partita IVA</label></div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="supEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supEmail" className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input id="supPhone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supPhone" className="md-input-label">Telefono</label></div>
                </div>
                <div className="md-input-group"><input id="supAddr" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supAddr" className="md-input-label">Indirizzo Sede Legale</label></div>
                 <div className="grid grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="supZip" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supZip" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="supCity" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supCity" className="md-input-label">Città</label></div>
                </div>
                <div className="md-input-group"><input id="supProv" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supProv" className="md-input-label">Provincia</label></div>
                
                 <div className="pt-4 border-t mt-4" style={{borderColor: 'var(--md-divider)'}}>
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold">Sedi Operative</h3>
                         <button type="button" onClick={() => { setEditingLocation(null); setIsLocationModalOpen(true); }} className="md-btn md-btn-flat md-btn-primary text-sm">
                            <PlusIcon/> <span className="ml-1">Aggiungi Sede</span>
                        </button>
                    </div>
                    <div className="mt-2 space-y-2">
                    {locations.length > 0 ? locations.map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: loc.color }}></span>
                                <div>
                                    <p className="text-sm font-medium">{loc.name}</p>
                                    <p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>{loc.address}, {loc.city}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button type="button" onClick={() => handleEditLocation(loc)} className="md-icon-btn edit" aria-label={`Modifica sede ${loc.name}`}><PencilIcon/></button>
                                <button type="button" onClick={() => handleRemoveLocation(loc.id)} className="md-icon-btn delete" aria-label={`Elimina sede ${loc.name}`}><TrashIcon/></button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-center py-4" style={{color: 'var(--md-text-secondary)'}}>Nessuna sede operativa aggiunta.</p>}
                    </div>
                </div>

            </div>
             <div className="mt-6 pt-4 border-t flex justify-end space-x-3" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva Fornitore</button>
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
        const result = await importSuppliersFromExcel(file);
        fetchSuppliers();
        return result;
    };


  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Fornitori</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci i fornitori e le loro sedi.</p>
            </div>
             <div className="flex items-center space-x-2">
                 <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat">
                    <UploadIcon />
                    <span className="ml-2">Importa Excel</span>
                </button>
                <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
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
                templateHeaders={[
                    'companyName', 'vatNumber', 'address', 'zipCode', 
                    'city', 'province', 'email', 'phone'
                ]}
                instructions={[
                    'La prima riga del primo foglio di lavoro deve contenere le intestazioni.',
                    'Il campo "companyName" è la chiave unica per l\'aggiornamento di record esistenti.',
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
                    <div key={supplier.id} className="md-card p-6 flex flex-col">
                        <div className="flex-1">
                            <h2 className="text-lg font-bold">{supplier.companyName}</h2>
                            <p className="text-sm mt-1" style={{color: 'var(--md-text-secondary)'}}>P.IVA: {supplier.vatNumber}</p>
                            <div className="mt-4 text-sm space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                <p><strong>Email:</strong> {supplier.email}</p>
                                <p><strong>Tel:</strong> {supplier.phone}</p>
                                <p><strong>Sede:</strong> {supplier.address}, {supplier.city} ({supplier.province})</p>
                            </div>
                            <div className="mt-4 pt-4 border-t" style={{borderColor: 'var(--md-divider)'}}>
                                <h4 className="font-semibold text-sm">Sedi Operative ({supplier.locations.length})</h4>
                                <ul className="text-xs mt-2 space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                {supplier.locations.slice(0, 3).map(loc => (
                                    <li key={loc.id} className="flex items-center">
                                        <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: loc.color }}></span>
                                        {loc.name} - {loc.address}, {loc.city}
                                    </li>
                                ))}
                                {supplier.locations.length > 3 && <li className="text-xs text-gray-400">...e altre {supplier.locations.length - 3}.</li>}
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-end items-center space-x-2" style={{borderColor: 'var(--md-divider)'}}>
                             <button onClick={() => handleOpenModal(supplier)} className="md-icon-btn edit" aria-label={`Modifica fornitore ${supplier.companyName}`}><PencilIcon /></button>
                             <button onClick={() => handleDeleteSupplier(supplier.id)} className="md-icon-btn delete" aria-label={`Elimina fornitore ${supplier.companyName}`}><TrashIcon /></button>
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