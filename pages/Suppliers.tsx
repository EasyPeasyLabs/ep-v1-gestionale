
import React, { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInput, Location, LocationInput, AvailabilitySlot } from '../types';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier, restoreSupplier, permanentDeleteSupplier } from '../services/supplierService';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
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
    
    // Availability State
    const [availability, setAvailability] = useState<AvailabilitySlot[]>(location?.availability || []);

    const daysOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    const handleAddSlot = () => {
        setAvailability([...availability, { dayOfWeek: 1, startTime: '15:00', endTime: '16:00' }]);
    };

    const handleRemoveSlot = (index: number) => {
        setAvailability(availability.filter((_, i) => i !== index));
    };

    const handleSlotChange = (index: number, field: keyof AvailabilitySlot, value: any) => {
        const newSlots = [...availability];
        newSlots[index] = { ...newSlots[index], [field]: value };
        setAvailability(newSlots);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: location?.id || Date.now().toString(), name, address, zipCode, city, province,
            capacity: Number(capacity), rentalCost: Number(rentalCost), distance: Number(distance), color,
            availability
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100" style={{borderColor: 'var(--md-divider)'}}>
                <h3 className="text-lg font-bold text-gray-800">{location ? 'Modifica Sede' : 'Nuova Sede'}</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-2 md-input-group"><input id="locName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locName" className="md-input-label">Nome Sede</label></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Colore</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-8 rounded-md border cursor-pointer" style={{borderColor: 'var(--md-divider)'}}/></div>
                </div>
                <div className="md-input-group"><input id="locAddr" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locAddr" className="md-input-label">Indirizzo</label></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="locZip" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locZip" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="locCity" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locCity" className="md-input-label">Città</label></div>
                </div>
                <div className="md-input-group"><input id="locProv" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="locProv" className="md-input-label">Provincia</label></div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="locCap" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCap" className="md-input-label">Capienza</label></div>
                    <div className="md-input-group"><input id="locCost" type="number" value={rentalCost} onChange={e => setRentalCost(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCost" className="md-input-label">Nolo (€)</label></div>
                    <div className="md-input-group"><input id="locDist" type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locDist" className="md-input-label">Distanza (km)</label></div>
                </div>

                <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-sm text-indigo-700">Disponibilità Oraria</h4>
                        <button type="button" onClick={handleAddSlot} className="text-xs flex items-center text-indigo-600 font-medium hover:bg-indigo-50 px-2 py-1 rounded">
                            <PlusIcon /> Aggiungi Slot
                        </button>
                    </div>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {availability.length === 0 && <p className="text-xs text-gray-400 italic text-center">Nessun orario definito.</p>}
                        {availability.map((slot, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <select 
                                    value={slot.dayOfWeek} 
                                    onChange={e => handleSlotChange(index, 'dayOfWeek', Number(e.target.value))}
                                    className="text-sm border-gray-300 rounded-md py-1 px-2 flex-1"
                                >
                                    {daysOfWeek.map((day, i) => <option key={i} value={i}>{day}</option>)}
                                </select>
                                <input 
                                    type="time" 
                                    value={slot.startTime} 
                                    onChange={e => handleSlotChange(index, 'startTime', e.target.value)}
                                    className="text-sm border-gray-300 rounded-md py-1 px-2 w-24"
                                />
                                <span className="text-gray-400">-</span>
                                <input 
                                    type="time" 
                                    value={slot.endTime} 
                                    onChange={e => handleSlotChange(index, 'endTime', e.target.value)}
                                    className="text-sm border-gray-300 rounded-md py-1 px-2 w-24"
                                />
                                <button type="button" onClick={() => handleRemoveSlot(index)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Sede</button>
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
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100 flex flex-wrap gap-2 justify-between items-center" style={{borderColor: 'var(--md-divider)'}}>
                <h2 className="text-xl font-bold text-gray-800">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
                <button type="button" onClick={() => { setEditingLocation(null); setIsLocationModalOpen(true); }} className="md-btn md-btn-flat md-btn-primary text-sm flex-shrink-0">
                    <PlusIcon/> <span className="ml-1 hidden sm:inline">Aggiungi Sede</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="supName" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supName" className="md-input-label">Ragione Sociale</label></div>
                    <div className="md-input-group"><input id="supVat" type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supVat" className="md-input-label">Partita IVA</label></div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="supEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supEmail" className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input id="supPhone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supPhone" className="md-input-label">Telefono</label></div>
                </div>
                <div className="md-input-group"><input id="supAddr" type="text" value={address} onChange={e => setAddress(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supAddr" className="md-input-label">Indirizzo Sede Legale</label></div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group"><input id="supZip" type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supZip" className="md-input-label">CAP</label></div>
                    <div className="col-span-2 md-input-group"><input id="supCity" type="text" value={city} onChange={e => setCity(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supCity" className="md-input-label">Città</label></div>
                </div>
                <div className="md-input-group"><input id="supProv" type="text" value={province} onChange={e => setProvince(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="supProv" className="md-input-label">Provincia</label></div>
                
                 <div className="pt-4 border-t mt-4" style={{borderColor: 'var(--md-divider)'}}>
                    <h3 className="text-md font-semibold">Sedi Operative</h3>
                    <div className="mt-2 space-y-2">
                    {locations.length > 0 ? locations.map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-3 border" style={{ backgroundColor: loc.color }}></span>
                                <div>
                                    <p className="text-sm font-medium">{loc.name}</p>
                                    <p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>
                                        {loc.city} - {loc.availability?.length || 0} slot orari definiti
                                    </p>
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
             <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Fornitore</button>
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
    
    // Trash Mode State
    const [showTrash, setShowTrash] = useState(false);
    
    // Delete/Restore State
    const [supplierToProcess, setSupplierToProcess] = useState<{id: string, action: 'delete' | 'restore' | 'permanent'} | null>(null);


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
                const { id, ...dataToUpdate } = supplierData;
                await updateSupplier(id, dataToUpdate);
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

    const handleActionClick = (id: string, action: 'delete' | 'restore' | 'permanent') => {
        setSupplierToProcess({ id, action });
    };

    const handleConfirmAction = async () => {
        if (supplierToProcess) {
            try {
                if (supplierToProcess.action === 'delete') {
                    await deleteSupplier(supplierToProcess.id);
                } else if (supplierToProcess.action === 'restore') {
                    await restoreSupplier(supplierToProcess.id);
                } else if (supplierToProcess.action === 'permanent') {
                    await permanentDeleteSupplier(supplierToProcess.id);
                }
                fetchSuppliers();
            } catch (err) {
                console.error("Errore nell'operazione fornitore:", err);
                setError("Operazione fallita.");
            } finally {
                setSupplierToProcess(null);
            }
        }
    };

     const handleImport = async (file: File) => {
        const result = await importSuppliersFromExcel(file);
        fetchSuppliers();
        return result;
    };

    const filteredSuppliers = suppliers.filter(s => {
        if (showTrash) return s.isDeleted;
        return !s.isDeleted;
    });


  return (
    <div>
        <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Fornitori</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci i fornitori e le loro sedi.</p>
            </div>
             <div className="flex items-center space-x-2 flex-wrap">
                 <button onClick={() => setIsImportModalOpen(true)} className="md-btn md-btn-flat">
                    <UploadIcon />
                    <span className="ml-2">Importa</span>
                </button>
                <button 
                    onClick={() => setShowTrash(!showTrash)} 
                    className={`md-btn ${showTrash ? 'bg-gray-200 text-gray-800' : 'md-btn-flat'}`}
                    title={showTrash ? "Torna alla lista" : "Visualizza Cestino"}
                >
                    <TrashIcon />
                    <span className="ml-2">{showTrash ? "Lista Attivi" : "Cestino"}</span>
                </button>
                {!showTrash && (
                    <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
                        <PlusIcon />
                        <span className="ml-2">Aggiungi</span>
                    </button>
                )}
            </div>
        </div>
        
        {showTrash && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mt-6 text-sm flex items-center">
                <TrashIcon />
                <span className="ml-2 font-bold">MODALITÀ CESTINO:</span> Stai visualizzando i fornitori eliminati.
            </div>
        )}

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
                {filteredSuppliers.map(supplier => (
                    <div key={supplier.id} className={`md-card p-6 flex flex-col ${showTrash ? 'border-gray-400 opacity-80' : ''}`}>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold">{supplier.companyName}</h2>
                            <p className="text-sm mt-1" style={{color: 'var(--md-text-secondary)'}}>P.IVA: {supplier.vatNumber}</p>
                            <div className="mt-4 text-sm space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                <p className="truncate"><strong>Email:</strong> {supplier.email}</p>
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
                             {showTrash ? (
                                <>
                                    <button 
                                        onClick={() => handleActionClick(supplier.id, 'restore')} 
                                        className="md-icon-btn text-green-600 hover:bg-green-50" 
                                        title="Ripristina Fornitore"
                                    >
                                        <RestoreIcon />
                                    </button>
                                    <button 
                                        onClick={() => handleActionClick(supplier.id, 'permanent')} 
                                        className="md-icon-btn text-red-600 hover:bg-red-50" 
                                        title="Elimina Definitivamente"
                                    >
                                        <TrashIcon />
                                    </button>
                                </>
                             ) : (
                                <>
                                    <button onClick={() => handleOpenModal(supplier)} className="md-icon-btn edit" aria-label={`Modifica fornitore ${supplier.companyName}`}><PencilIcon /></button>
                                    <button onClick={() => handleActionClick(supplier.id, 'delete')} className="md-icon-btn delete" aria-label={`Elimina fornitore ${supplier.companyName}`}><TrashIcon /></button>
                                </>
                             )}
                        </div>
                    </div>
                ))}
                {filteredSuppliers.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        {showTrash ? "Cestino vuoto." : "Nessun fornitore trovato."}
                    </div>
                )}
            </div>
            }
        </div>
        
        <ConfirmModal 
            isOpen={!!supplierToProcess}
            onClose={() => setSupplierToProcess(null)}
            onConfirm={handleConfirmAction}
            title={supplierToProcess?.action === 'restore' ? "Ripristina Fornitore" : supplierToProcess?.action === 'permanent' ? "Elimina Definitivamente" : "Sposta nel Cestino"}
            message={supplierToProcess?.action === 'restore' 
                ? "Vuoi ripristinare questo fornitore?" 
                : supplierToProcess?.action === 'permanent' 
                ? "Sei sicuro di voler eliminare definitivamente questo fornitore? Tutte le sedi associate verranno perse." 
                : "Sei sicuro di voler spostare questo fornitore nel cestino?"}
            isDangerous={supplierToProcess?.action !== 'restore'}
            confirmText={supplierToProcess?.action === 'restore' ? "Ripristina" : "Elimina"}
        />
    </div>
  );
};

export default Suppliers;