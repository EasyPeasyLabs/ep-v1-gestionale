
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Supplier, SupplierInput, Location, LocationInput, AvailabilitySlot, SupplierRating, LocationRating, Note, ContractTemplate, CompanyInfo } from '../types';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier, restoreSupplier, permanentDeleteSupplier } from '../services/supplierService';
import { getContractTemplates, getCompanyInfo } from '../services/settingsService';
import { compileContractTemplate } from '../utils/contractUtils';
import { jsPDF } from 'jspdf';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import { importSuppliersFromExcel } from '../services/importService';
import NotesManager from '../components/NotesManager';
import Pagination from '../components/Pagination';

// Helpers & Icons
const StarIcon: React.FC<{ filled: boolean; onClick?: () => void; className?: string }> = ({ filled, onClick, className }) => ( <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${filled ? 'text-yellow-400' : 'text-gray-300'} ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''} ${className}`} viewBox="0 0 20 20" fill="currentColor"> <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /> </svg> );
const calculateFuelRating = (distance: number) => { if (distance <= 5) return 5; if (distance <= 15) return 4; if (distance <= 30) return 3; if (distance <= 60) return 2; return 1; };
const getAverageRating = (rating?: SupplierRating) => { if (!rating) return 0; const sum = (rating.responsiveness || 0) + (rating.partnership || 0) + (rating.negotiation || 0); return sum > 0 ? (sum / 3).toFixed(1) : 0; };
const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// --- CONTRACT GENERATOR MODAL ---
const ContractGeneratorModal: React.FC<{
    supplier: Supplier;
    onClose: () => void;
}> = ({ supplier, onClose }) => {
    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [tpls, info] = await Promise.all([getContractTemplates(), getCompanyInfo()]);
                setTemplates(tpls);
                setCompanyInfo(info);
                if (tpls.length > 0) setSelectedTemplateId(tpls[0].id);
                // Pre-select first location if any
                if (supplier.locations && supplier.locations.length > 0) setSelectedLocationId(supplier.locations[0].id);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [supplier]);

    const handleGeneratePDF = async () => {
        if (!selectedTemplateId || !companyInfo) return;
        setGenerating(true);

        try {
            const template = templates.find(t => t.id === selectedTemplateId);
            if (!template) return;

            const location = supplier.locations.find(l => l.id === selectedLocationId);
            
            // 1. Compila il template
            const compiledHtml = compileContractTemplate(template.content, supplier, companyInfo, location, { startDate });

            // 2. Genera PDF usando jsPDF
            const doc = new jsPDF({
                unit: 'pt',
                format: 'a4'
            });

            // Container temporaneo per rendering HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = compiledHtml;
            tempDiv.style.width = '550px'; // Fit A4 width approx (595pt) minus margins
            tempDiv.style.padding = '20px';
            tempDiv.style.fontFamily = 'Helvetica, sans-serif';
            tempDiv.style.fontSize = '11pt';
            tempDiv.style.lineHeight = '1.5';
            document.body.appendChild(tempDiv);

            await doc.html(tempDiv, {
                callback: function (doc) {
                    doc.save(`Contratto_${supplier.companyName.replace(/\s+/g, '_')}_${location?.name || 'Gen'}.pdf`);
                    document.body.removeChild(tempDiv);
                    setGenerating(false);
                    onClose();
                },
                x: 40,
                y: 40,
                width: 520, // Max width for content
                windowWidth: 650 // Virtual window width to render CSS correctly
            });

        } catch (e) {
            console.error(e);
            alert("Errore durante la generazione del PDF.");
            setGenerating(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Spinner /></div>;

    const currentTemplate = templates.find(t => t.id === selectedTemplateId);
    const location = supplier.locations.find(l => l.id === selectedLocationId);
    
    // Anteprima live
    const previewHtml = currentTemplate && companyInfo 
        ? compileContractTemplate(currentTemplate.content, supplier, companyInfo, location, { startDate }) 
        : '<p>Seleziona un template...</p>';

    return (
        <Modal onClose={onClose} size="xl">
            <div className="flex flex-col h-[90vh]">
                <div className="p-6 border-b bg-slate-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">Genera Contratto: {supplier.companyName}</h3>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Sidebar Controlli */}
                    <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto bg-gray-50">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">1. Scegli Modello</label>
                                <select 
                                    value={selectedTemplateId} 
                                    onChange={e => setSelectedTemplateId(e.target.value)} 
                                    className="md-input bg-white"
                                >
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">2. Scegli Sede (Opzionale)</label>
                                <select 
                                    value={selectedLocationId} 
                                    onChange={e => setSelectedLocationId(e.target.value)} 
                                    className="md-input bg-white"
                                >
                                    <option value="">Nessuna / Generale</option>
                                    {supplier.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">Necessario se il contratto cita "Nome Sede" o "Importo Nolo".</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">3. Data Decorrenza</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="md-input bg-white" />
                            </div>
                        </div>
                    </div>

                    {/* Anteprima */}
                    <div className="w-full md:w-2/3 p-8 bg-gray-100 overflow-y-auto custom-scrollbar">
                        <div className="bg-white shadow-lg p-10 min-h-[800px] w-full max-w-[21cm] mx-auto text-sm leading-relaxed text-justify">
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-white flex justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="md-btn md-btn-flat">Chiudi</button>
                    <button onClick={handleGeneratePDF} disabled={generating || !selectedTemplateId} className="md-btn md-btn-raised md-btn-primary flex items-center gap-2">
                        {generating ? <Spinner /> : <PrinterIcon />}
                        Scarica PDF
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- LOCATION FORM (Nested) ---
const LocationForm: React.FC<{ 
    location: LocationInput | Location; 
    onSave: (loc: LocationInput | Location) => void; 
    onCancel: () => void 
}> = ({ location, onSave, onCancel }) => {
    const [name, setName] = useState(location.name || '');
    const [address, setAddress] = useState(location.address || '');
    const [city, setCity] = useState(location.city || '');
    const [capacity, setCapacity] = useState(location.capacity || 0);
    const [rentalCost, setRentalCost] = useState(location.rentalCost || 0);
    const [distance, setDistance] = useState(location.distance || 0);
    const [color, setColor] = useState(location.color || '#3b82f6');
    const [closedAt, setClosedAt] = useState(location.closedAt || '');
    
    // Availability Slots
    const [slots, setSlots] = useState<AvailabilitySlot[]>(location.availability || []);
    
    const [newSlotDay, setNewSlotDay] = useState(1); // Lunedì
    const [newSlotStart, setNewSlotStart] = useState('16:00');
    const [newSlotEnd, setNewSlotEnd] = useState('18:00');

    const handleAddSlot = () => {
        setSlots([...slots, { dayOfWeek: Number(newSlotDay), startTime: newSlotStart, endTime: newSlotEnd }]);
    };

    const removeSlot = (idx: number) => {
        setSlots(slots.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        onSave({ 
            ...location, 
            name, address, city, capacity, rentalCost, distance, color, closedAt, availability: slots 
        });
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4 animate-fade-in">
            <h4 className="font-bold text-sm text-gray-700 mb-3 uppercase">{('id' in location) ? 'Modifica Sede' : 'Nuova Sede'}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} className="md-input text-sm" placeholder=" "/><label className="md-input-label text-xs">Nome Sede (es. Sala Grande)</label></div>
                <div className="md-input-group"><input type="text" value={city} onChange={e => setCity(e.target.value)} className="md-input text-sm" placeholder=" "/><label className="md-input-label text-xs">Città</label></div>
            </div>
            <div className="md-input-group mb-3"><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="md-input text-sm" placeholder=" "/><label className="md-input-label text-xs">Indirizzo</label></div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div><label className="text-[10px] text-gray-500">Capienza</label><input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full border rounded p-1 text-sm"/></div>
                <div><label className="text-[10px] text-gray-500">Costo Nolo (€)</label><input type="number" value={rentalCost} onChange={e => setRentalCost(Number(e.target.value))} className="w-full border rounded p-1 text-sm"/></div>
                <div><label className="text-[10px] text-gray-500">Distanza (km)</label><input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} className="w-full border rounded p-1 text-sm"/></div>
                <div><label className="text-[10px] text-gray-500">Colore Calendario</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-7 border rounded cursor-pointer"/></div>
            </div>

            {/* Closed At */}
            <div className="mb-4">
                <div className="md-input-group">
                    <input type="date" value={closedAt} onChange={e => setClosedAt(e.target.value)} className="md-input text-sm" placeholder=" " />
                    <label className="md-input-label text-xs">Data Chiusura (Opzionale: Blocca Noli)</label>
                </div>
                {closedAt && <p className="text-[10px] text-red-500 mt-1">⚠️ Sede dismessa dal {new Date(closedAt).toLocaleDateString()}. Non verranno generati costi futuri.</p>}
            </div>

            {/* Slots */}
            <div className="border-t border-gray-200 pt-3">
                <label className="block text-xs font-bold text-gray-600 mb-2">Disponibilità Oraria</label>
                <div className="flex gap-2 items-end mb-2">
                    <select value={newSlotDay} onChange={e => setNewSlotDay(Number(e.target.value))} className="text-xs border rounded p-1 bg-white">
                        {daysMap.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} className="text-xs border rounded p-1"/>
                    <span className="text-gray-400">-</span>
                    <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} className="text-xs border rounded p-1"/>
                    <button type="button" onClick={handleAddSlot} className="md-btn md-btn-sm md-btn-green px-2 py-0 h-7">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {slots.map((s, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded bg-white border border-gray-300 text-[10px] font-medium text-gray-700">
                            {daysMap[s.dayOfWeek]} {s.startTime}-{s.endTime}
                            <button onClick={() => removeSlot(i)} className="ml-1 text-red-500 hover:text-red-700 font-bold">×</button>
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={handleSubmit} className="md-btn md-btn-raised md-btn-primary md-btn-sm">Salva Sede</button>
            </div>
        </div>
    );
};

// --- SUPPLIER FORM ---
const SupplierForm: React.FC<{ 
    supplier?: Supplier | null; 
    onSave: (data: SupplierInput | Supplier) => void; 
    onCancel: () => void 
}> = ({ supplier, onSave, onCancel }) => {
    const [companyName, setCompanyName] = useState(supplier?.companyName || '');
    const [vatNumber, setVatNumber] = useState(supplier?.vatNumber || '');
    const [email, setEmail] = useState(supplier?.email || '');
    const [phone, setPhone] = useState(supplier?.phone || '');
    const [address, setAddress] = useState(supplier?.address || '');
    const [city, setCity] = useState(supplier?.city || '');
    const [province, setProvince] = useState(supplier?.province || '');
    const [zipCode, setZipCode] = useState(supplier?.zipCode || '');
    
    const [locations, setLocations] = useState<Location[]>(supplier?.locations || []);
    const [rating, setRating] = useState<SupplierRating>(supplier?.rating || { responsiveness: 0, partnership: 0, negotiation: 0 });
    const [notesHistory, setNotesHistory] = useState<Note[]>(supplier?.notesHistory || []);

    const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);
    const [isEditingLoc, setIsEditingLoc] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data: any = {
            companyName, vatNumber, email, phone, address, city, province, zipCode,
            locations, rating, notesHistory
        };
        if (supplier?.id) onSave({ ...data, id: supplier.id });
        else onSave(data);
    };

    const handleSaveLocation = (loc: LocationInput | Location) => {
        if ('id' in loc && loc.id && !String(loc.id).startsWith('temp')) {
            setLocations(locations.map(l => l.id === loc.id ? (loc as Location) : l));
        } else {
            // New or temp
            const newLoc = { ...loc, id: ('id' in loc ? loc.id : undefined) || `temp-${Date.now()}` } as Location;
            if (editingLocation && editingLocation.id) {
                 setLocations(locations.map(l => l.id === editingLocation.id ? newLoc : l));
            } else {
                setLocations([...locations, newLoc]);
            }
        }
        setIsEditingLoc(false);
        setEditingLocation(null);
    };

    const handleDeleteLocation = (id: string) => {
        if(confirm('Eliminare questa sede?')) {
            setLocations(locations.filter(l => l.id !== id));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
                {/* Dati Anagrafici */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="md-input" placeholder=" "/><label className="md-input-label">Ragione Sociale</label></div>
                    <div className="md-input-group"><input type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">P.IVA / C.F.</label></div>
                    <div className="md-input-group"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Email</label></div>
                    <div className="md-input-group"><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Telefono</label></div>
                </div>
                <div className="md-input-group"><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Indirizzo</label></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="md-input-group"><input type="text" value={city} onChange={e => setCity(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Città</label></div>
                    <div className="md-input-group"><input type="text" value={province} onChange={e => setProvince(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">Prov.</label></div>
                    <div className="md-input-group"><input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className="md-input" placeholder=" "/><label className="md-input-label">CAP</label></div>
                </div>

                {/* Sedi */}
                <div>
                    <div className="flex justify-between items-center mb-2 border-b pb-1">
                        <h3 className="font-bold text-gray-700">Sedi & Disponibilità</h3>
                        {!isEditingLoc && <button type="button" onClick={() => { setEditingLocation({}); setIsEditingLoc(true); }} className="text-xs text-indigo-600 font-bold hover:underline">+ Aggiungi Sede</button>}
                    </div>
                    
                    {isEditingLoc && editingLocation && (
                        <LocationForm location={editingLocation as Location} onSave={handleSaveLocation} onCancel={() => setIsEditingLoc(false)} />
                    )}

                    <div className="space-y-2 mt-2">
                        {locations.map(loc => (
                            <div key={loc.id} className={`bg-white border rounded p-3 flex justify-between items-center hover:shadow-sm transition-shadow ${loc.closedAt ? 'border-l-4 border-l-red-400 bg-red-50/20' : ''}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full" style={{backgroundColor: loc.color}}></span>
                                        <span className="font-bold text-sm text-gray-800">{loc.name}</span>
                                        {loc.closedAt && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Chiusa</span>}
                                    </div>
                                    <p className="text-xs text-gray-500">{loc.address}, {loc.city}</p>
                                    <div className="flex gap-1 mt-1">
                                        {loc.availability?.map((slot, i) => (
                                            <span key={i} className="text-[9px] bg-gray-100 px-1 rounded text-gray-600">{daysMap[slot.dayOfWeek].substring(0,3)} {slot.startTime}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => { setEditingLocation(loc); setIsEditingLoc(true); }} className="md-icon-btn edit p-1"><PencilIcon/></button>
                                    <button type="button" onClick={() => handleDeleteLocation(loc.id)} className="md-icon-btn delete p-1"><TrashIcon/></button>
                                </div>
                            </div>
                        ))}
                        {locations.length === 0 && !isEditingLoc && <p className="text-xs text-gray-400 italic">Nessuna sede registrata.</p>}
                    </div>
                </div>

                {/* Rating & Note */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">Rating</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><span className="text-xs">Reattività</span><div className="flex">{[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rating.responsiveness} onClick={() => setRating({...rating, responsiveness: s})} className="w-4 h-4"/>)}</div></div>
                            <div className="flex justify-between items-center"><span className="text-xs">Partnership</span><div className="flex">{[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rating.partnership} onClick={() => setRating({...rating, partnership: s})} className="w-4 h-4"/>)}</div></div>
                            <div className="flex justify-between items-center"><span className="text-xs">Negoziazione</span><div className="flex">{[1,2,3,4,5].map(s => <StarIcon key={s} filled={s <= rating.negotiation} onClick={() => setRating({...rating, negotiation: s})} className="w-4 h-4"/>)}</div></div>
                        </div>
                    </div>
                    <div>
                        <NotesManager notesHistory={notesHistory} onSave={setNotesHistory} label="Note Fornitore" />
                    </div>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
            </div>
        </form>
    );
};

const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [showTrash, setShowTrash] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    
    // CONTRACT GENERATOR STATE
    const [contractModalSupplier, setContractModalSupplier] = useState<Supplier | null>(null);

    // Sort State
    const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc' | 'day_asc'>('day_asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const fetchSuppliers = useCallback(async () => {
        try {
            setLoading(true);
            const suppliersData = await getSuppliers();
            setSuppliers(suppliersData);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [showTrash, sortOrder]);

    const handleOpenModal = (supplier: Supplier | null = null) => { setEditingSupplier(supplier); setIsModalOpen(true); };
    const handleSaveSupplier = async (supplierData: SupplierInput | Supplier) => { 
        try {
            if ('id' in supplierData) await updateSupplier(supplierData.id, supplierData);
            else await addSupplier(supplierData);
            setIsModalOpen(false); 
            fetchSuppliers();
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio");
        }
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeleteAllModalOpen(false);
        setLoading(true);
        try {
            const allSuppliers = await getSuppliers();
            for (const s of allSuppliers) {
                await permanentDeleteSupplier(s.id);
            }
            await fetchSuppliers();
            alert("Tutti i fornitori sono stati eliminati. Le sedi e le lezioni collegate non saranno più disponibili.");
        } catch (err) {
            console.error(err);
            alert("Errore eliminazione totale.");
        } finally {
            setLoading(false);
        }
    };

    // Helper to find earliest availability day
    const getEarliestDay = (supplier: Supplier): number => {
        let minDay = 7; // Default max (Sunday=0, but we treat it as 7 for sort if needed, or 0)
        supplier.locations.forEach(loc => {
            loc.availability?.forEach(slot => {
                // Adjust: 0=Sunday. If we want Monday first (1), we can map 0->7.
                const day = slot.dayOfWeek === 0 ? 7 : slot.dayOfWeek; 
                if (day < minDay) minDay = day;
            });
        });
        return minDay;
    };

    const filteredSuppliers = useMemo(() => {
        const result = suppliers.filter(s => showTrash ? s.isDeleted : !s.isDeleted);

        // Sorting
        result.sort((a, b) => {
            if (sortOrder === 'day_asc') {
                return getEarliestDay(a) - getEarliestDay(b);
            }
            // FIX: SAFE GUARD against missing companyName to avoid crash
            const nameA = (a.companyName || '').toLowerCase();
            const nameB = (b.companyName || '').toLowerCase();
            return sortOrder === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        
        return result;
    }, [suppliers, showTrash, sortOrder]);

    // Paginated
    const paginatedSuppliers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSuppliers.slice(start, start + itemsPerPage);
    }, [filteredSuppliers, currentPage]);

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <div><h1 className="text-3xl font-bold">Fornitori</h1><p className="mt-1 text-gray-500">Gestione sedi e anagrafiche.</p></div>
                <div className="flex gap-2">
                    <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>
                    <button onClick={() => setShowTrash(!showTrash)} className={`md-btn ${showTrash ? 'bg-gray-200' : 'md-btn-flat'}`}><TrashIcon /></button>
                    {!showTrash && <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green"><PlusIcon /><span className="ml-2">Nuovo</span></button>}
                </div>
            </div>
            
            {/* Sorting Controls */}
            <div className="mt-6 flex justify-end mb-4">
                <select 
                    value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value as any)} 
                    className="block w-48 bg-white border rounded-md py-2 px-3 text-sm"
                >
                    <option value="day_asc">Giorno Disp. (Lun-Dom)</option>
                    <option value="name_asc">Nome (A-Z)</option>
                    <option value="name_desc">Nome (Z-A)</option>
                </select>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
             <>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedSuppliers.map(supplier => {
                    const avgRating = getAverageRating(supplier.rating);
                    return (
                        <div key={supplier.id} className={`md-card p-6 flex flex-col ${showTrash ? 'opacity-75' : ''} border-t-4 border-indigo-500`}>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-lg font-bold">{supplier.companyName}</h2>
                                    {Number(avgRating) > 0 && <span className="text-sm font-bold text-yellow-600 flex items-center bg-yellow-50 px-2 py-1 rounded">{avgRating} <StarIcon filled={true} className="w-3 h-3 ml-1"/></span>}
                                </div>
                                <div className="mt-3 text-sm text-gray-600">
                                    <p><strong>Tel:</strong> {supplier.phone}</p>
                                    <p><strong>Sede:</strong> {supplier.city}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <h4 className="font-semibold text-xs text-gray-500 uppercase">Sedi & Slot</h4>
                                    <ul className="text-xs mt-2 space-y-1">
                                    {supplier.locations.map(loc => (
                                        <li key={loc.id} className={`flex justify-between items-center p-1 rounded ${loc.closedAt ? 'bg-red-50 text-red-500 line-through' : 'bg-gray-50'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: loc.color }}></span>
                                                <span className="truncate max-w-[120px]">{loc.name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                {loc.availability?.map((slot, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-bold text-indigo-600">
                                                        {daysMap[slot.dayOfWeek].substring(0,3)}
                                                    </span>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t flex justify-between items-center space-x-2">
                                {/* Contract Generation Button */}
                                {!showTrash && (
                                    <button 
                                        onClick={() => setContractModalSupplier(supplier)} 
                                        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 font-bold"
                                        title="Genera Contratto PDF"
                                    >
                                        <PrinterIcon /> Contratto
                                    </button>
                                )}

                                <div className="flex gap-1 ml-auto">
                                    {showTrash ? (
                                        <>
                                            <button onClick={() => restoreSupplier(supplier.id).then(fetchSuppliers)} className="md-icon-btn"><RestoreIcon /></button>
                                            <button onClick={() => permanentDeleteSupplier(supplier.id).then(fetchSuppliers)} className="md-icon-btn delete"><TrashIcon /></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleOpenModal(supplier)} className="md-icon-btn edit"><PencilIcon /></button>
                                            <button onClick={() => deleteSupplier(supplier.id).then(fetchSuppliers)} className="md-icon-btn delete"><TrashIcon /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <Pagination 
                currentPage={currentPage} 
                totalItems={filteredSuppliers.length} 
                itemsPerPage={itemsPerPage} 
                onPageChange={setCurrentPage} 
            />
            </>
            )}
            
            {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} size="2xl"><SupplierForm supplier={editingSupplier} onSave={handleSaveSupplier} onCancel={() => setIsModalOpen(false)} /></Modal>}
            
            {contractModalSupplier && (
                <ContractGeneratorModal 
                    supplier={contractModalSupplier} 
                    onClose={() => setContractModalSupplier(null)} 
                />
            )}

            <ConfirmModal 
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleConfirmDeleteAll}
                title="ELIMINA TUTTI I FORNITORI"
                message="⚠️ ATTENZIONE: Stai per eliminare TUTTI i fornitori e le relative sedi. Questa operazione renderà orfane le lezioni collegate a queste sedi. Confermi?"
                isDangerous={true}
                confirmText="Sì, Elimina TUTTO"
            />
        </div>
    );
};

export default Suppliers;
