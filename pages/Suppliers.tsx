
import React, { useState, useEffect, useCallback } from 'react';
import { Supplier, SupplierInput, Location, LocationInput, AvailabilitySlot, SupplierRating, LocationRating, Note } from '../types';
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
import NotesManager from '../components/NotesManager';

// Internal Star Icon
const StarIcon: React.FC<{ filled: boolean; onClick?: () => void; className?: string }> = ({ filled, onClick, className }) => (
    <svg 
        onClick={onClick} 
        xmlns="http://www.w3.org/2000/svg" 
        className={`h-5 w-5 ${filled ? 'text-yellow-400' : 'text-gray-300'} ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''} ${className}`} 
        viewBox="0 0 20 20" 
        fill="currentColor"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

// Fuel Pump Icon
const FuelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v.01M12 16v.01M12 20v.01" stroke="none"/> 
        {/* Simple fuel pump representation */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
);

// Helper function for automatic fuel rating
const calculateFuelRating = (distance: number) => {
    if (distance <= 5) return 5;
    if (distance <= 15) return 4;
    if (distance <= 30) return 3;
    if (distance <= 60) return 2;
    return 1;
};

const getFuelRatingLabel = (rating: number) => {
    switch(rating) {
        case 5: return "Impatto Minimo";
        case 4: return "Impatto Basso";
        case 3: return "Impatto Medio";
        case 2: return "Impatto Elevato";
        case 1: return "Impatto Critico";
        default: return "";
    }
};

// Generic Legend Component
const RatingLegend: React.FC = () => (
    <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-gray-400 border-t border-dashed border-gray-200 pt-2">
        <div className="flex items-center">
            <span className="font-bold mr-1">1</span> 
            <StarIcon filled={true} className="w-3 h-3 text-yellow-400 mr-1" /> 
            <span>= pessimo</span>
        </div>
        <div className="flex items-center">
            <span className="font-bold mr-1">5</span> 
            <StarIcon filled={true} className="w-3 h-3 text-yellow-400 mr-1" /> 
            <span>= ottimo</span>
        </div>
    </div>
);

// Helper for rating row
const RatingRow: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex justify-between items-center mb-1 bg-white p-2 rounded border border-gray-100">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <div className="flex space-x-1 items-center">
            <span className="text-xs font-bold text-gray-400 mr-2">{value}/5</span>
            {[1,2,3,4,5].map(star => (
                <StarIcon key={star} filled={star <= value} onClick={() => onChange(star)} className="w-4 h-4" />
            ))}
        </div>
    </div>
);

const LocationForm: React.FC<{ location?: Location | null; onSave: (location: Location) => void; onCancel: () => void; }> = ({ location, onSave, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'rating'>('info');

    // Basic Info
    const [name, setName] = useState(location?.name || '');
    const [address, setAddress] = useState(location?.address || '');
    const [zipCode, setZipCode] = useState(location?.zipCode || '');
    const [city, setCity] = useState(location?.city || '');
    const [province, setProvince] = useState(location?.province || '');
    const [capacity, setCapacity] = useState(location?.capacity || 0);
    const [rentalCost, setRentalCost] = useState(location?.rentalCost || 0);
    const [distance, setDistance] = useState(location?.distance || 0);
    const [color, setColor] = useState(location?.color || '#a855f7');
    
    // Availability
    const [availability, setAvailability] = useState<AvailabilitySlot[]>(location?.availability || []);

    // Advanced Rating & Details
    // Note History
    const initialHistory = location?.notesHistory || [];
    if (initialHistory.length === 0 && location?.notes) {
        initialHistory.push({
            id: 'legacy-loc',
            date: new Date().toISOString(),
            content: location.notes
        });
    }
    const [notesHistory, setNotesHistory] = useState<Note[]>(initialHistory);

    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(location?.tags || []);
    
    const initialRating: LocationRating = location?.rating || {
        cost: 0, distance: 0, parking: 0, availability: 0, safety: 0, 
        environment: 0, distractions: 0, modifiability: 0, prestige: 0
    };
    const [rating, setRating] = useState<LocationRating>(initialRating);

    const daysOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    // Automatic Fuel Rating calculation
    const fuelRating = calculateFuelRating(Number(distance));
    const fuelRatingLabel = getFuelRatingLabel(fuelRating);

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

    const handleAddTag = () => {
        if (tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => setTags(tags.filter(t => t !== tag));

    const handleRatingChange = (field: keyof LocationRating, value: number) => {
        setRating(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: location?.id || Date.now().toString(), name, address, zipCode, city, province,
            capacity: Number(capacity), rentalCost: Number(rentalCost), distance: Number(distance), color,
            availability,
            notes: '', // Deprecated
            notesHistory,
            tags, rating
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100" style={{borderColor: 'var(--md-divider)'}}>
                <h3 className="text-lg font-bold text-gray-800 mb-3">{location ? 'Modifica Sede' : 'Nuova Sede'}</h3>
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                    <button type="button" onClick={() => setActiveTab('info')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'info' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Anagrafica</button>
                    <button type="button" onClick={() => setActiveTab('schedule')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'schedule' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Orari</button>
                    <button type="button" onClick={() => setActiveTab('rating')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'rating' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>Qualità & Rating</button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-3">
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-fade-in">
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div className="md-input-group"><input id="locCap" type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCap" className="md-input-label">Capienza</label></div>
                            <div className="md-input-group"><input id="locCost" type="number" value={rentalCost} onChange={e => setRentalCost(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locCost" className="md-input-label">Nolo (€)</label></div>
                            <div>
                                <div className="md-input-group">
                                    <input id="locDist" type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} required className="md-input" placeholder=" " /><label htmlFor="locDist" className="md-input-label">Distanza (km)</label>
                                </div>
                                {/* Visual Rating Indicator */}
                                <div className={`mt-1 flex items-center justify-between text-[10px] px-2 py-1 rounded border ${
                                    fuelRating >= 4 ? 'bg-green-50 text-green-700 border-green-100' : 
                                    fuelRating >= 3 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                    'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                    <span>Incidenza Carburante:</span>
                                    <div className="flex items-center font-bold">
                                        {fuelRating} <StarIcon filled={true} className="w-3 h-3 ml-0.5"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="animate-fade-in">
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
                )}

                {activeTab === 'rating' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* 9-Points Rating */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide border-b pb-1 border-gray-200">Parametri di Valutazione</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                <RatingRow label="1. Costo nolo / gratuità" value={rating.cost} onChange={(v) => handleRatingChange('cost', v)} />
                                <RatingRow label="2. Distanza sede aziendale" value={rating.distance} onChange={(v) => handleRatingChange('distance', v)} />
                                <RatingRow label="3. Facilità parcheggio" value={rating.parking} onChange={(v) => handleRatingChange('parking', v)} />
                                <RatingRow label="4. Disponibilità oraria" value={rating.availability} onChange={(v) => handleRatingChange('availability', v)} />
                                <RatingRow label="5. Ambienti a norma (0-6)" value={rating.safety} onChange={(v) => handleRatingChange('safety', v)} />
                                <RatingRow label="6. Ampiezza / Luce / Clima" value={rating.environment} onChange={(v) => handleRatingChange('environment', v)} />
                                <RatingRow label="7. Assenza distrazioni" value={rating.distractions} onChange={(v) => handleRatingChange('distractions', v)} />
                                <RatingRow label="8. Modifica layout" value={rating.modifiability} onChange={(v) => handleRatingChange('modifiability', v)} />
                                <RatingRow label="9. Prestigio / Network" value={rating.prestige} onChange={(v) => handleRatingChange('prestige', v)} />
                            </div>
                            <RatingLegend />
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tag Sede</label>
                            <div className="flex gap-2 mb-2">
                                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="Es. #AmpioGiardino" className="md-input flex-1" />
                                <button type="button" onClick={handleAddTag} className="md-btn md-btn-flat bg-gray-100 text-gray-600"><PlusIcon/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 text-indigo-900 font-bold">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Notes Manager */}
                        <NotesManager 
                            notesHistory={notesHistory}
                            onSave={setNotesHistory}
                            label="Note Sede"
                        />
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Sede</button>
            </div>
        </form>
    );
};


const SupplierForm: React.FC<{ supplier?: Supplier | null; onSave: (supplier: SupplierInput | Supplier) => void; onCancel: () => void; }> = ({ supplier, onSave, onCancel }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'details'>('general');
    
    // General
    const [companyName, setCompanyName] = useState(supplier?.companyName || '');
    const [vatNumber, setVatNumber] = useState(supplier?.vatNumber || '');
    const [address, setAddress] = useState(supplier?.address || '');
    const [zipCode, setZipCode] = useState(supplier?.zipCode || '');
    const [city, setCity] = useState(supplier?.city || '');
    const [province, setProvince] = useState(supplier?.province || '');
    const [email, setEmail] = useState(supplier?.email || '');
    const [phone, setPhone] = useState(supplier?.phone || '');
    const [locations, setLocations] = useState<Location[]>(supplier?.locations || []);
    
    // Details (Notes, Tags, Rating)
    // Note History
    const initialSupplierHistory = supplier?.notesHistory || [];
    if (initialSupplierHistory.length === 0 && supplier?.notes) {
        initialSupplierHistory.push({
            id: 'legacy-sup',
            date: new Date().toISOString(),
            content: supplier.notes
        });
    }
    const [notesHistory, setNotesHistory] = useState<Note[]>(initialSupplierHistory);

    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(supplier?.tags || []);
    const [rating, setRating] = useState<SupplierRating>(supplier?.rating || { responsiveness: 0, partnership: 0, negotiation: 0 });

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

    const handleAddTag = () => {
        if (tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleRatingChange = (field: keyof SupplierRating, value: number) => {
        setRating(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplierData = { 
            companyName, vatNumber, address, zipCode, city, province, email, phone, locations,
            notes: '', // Deprecated
            notesHistory,
            tags, rating
        };
        if (supplier?.id) { onSave({ ...supplierData, id: supplier.id }); } 
        else { onSave(supplierData as SupplierInput); }
    };

    // Helper per calcolare media rating location
    const getLocAvg = (r: LocationRating | undefined) => {
        if (!r) return 0;
        const vals = Object.values(r).filter(v => typeof v === 'number');
        const sum = vals.reduce((a, b) => a + b, 0);
        return vals.length ? (sum / vals.length).toFixed(1) : 0;
    };

    return (
        <>
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100" style={{borderColor: 'var(--md-divider)'}}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{supplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
                    <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                        <button type="button" onClick={() => setActiveTab('general')} className={`px-3 py-1 text-sm rounded-md transition-all ${activeTab === 'general' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Anagrafica</button>
                        <button type="button" onClick={() => setActiveTab('details')} className={`px-3 py-1 text-sm rounded-md transition-all ${activeTab === 'details' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Valutazione & Note</button>
                    </div>
                </div>
                
                {activeTab === 'general' && (
                    <button type="button" onClick={() => { setEditingLocation(null); setIsLocationModalOpen(true); }} className="md-btn md-btn-flat md-btn-primary text-xs mb-2">
                        <PlusIcon/> <span className="ml-1">Aggiungi Sede</span>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-3">
                {activeTab === 'general' ? (
                    <>
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
                            <h3 className="text-md font-semibold mb-2">Sedi Operative</h3>
                            <div className="mt-2 space-y-2">
                            {locations.length > 0 ? locations.map((loc) => {
                                const avg = getLocAvg(loc.rating);
                                const fuelR = calculateFuelRating(loc.distance || 0);
                                return (
                                <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-100 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full mr-3 border" style={{ backgroundColor: loc.color }}></span>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{loc.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {loc.city} • {loc.availability?.length || 0} orari
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-700" title="Rating Carburante">
                                            <FuelIcon className="w-3 h-3 mr-1" /> {fuelR}/5
                                        </div>
                                        {Number(avg) > 0 && (
                                            <div className="flex items-center text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                                                {avg} <StarIcon filled={true} className="w-3 h-3 ml-1" />
                                            </div>
                                        )}
                                        <div className="flex items-center space-x-1">
                                            <button type="button" onClick={() => handleEditLocation(loc)} className="md-icon-btn edit" aria-label={`Modifica sede ${loc.name}`}><PencilIcon/></button>
                                            <button type="button" onClick={() => handleRemoveLocation(loc.id)} className="md-icon-btn delete" aria-label={`Elimina sede ${loc.name}`}><TrashIcon/></button>
                                        </div>
                                    </div>
                                </div>
                            )}) : <p className="text-sm text-center py-4 text-gray-400 bg-gray-50 rounded-md border border-dashed">Nessuna sede operativa aggiunta.</p>}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Tags Section */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tag Fornitore</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    placeholder="Aggiungi tag..." 
                                    className="md-input flex-1"
                                />
                                <button type="button" onClick={handleAddTag} className="md-btn md-btn-flat bg-gray-100 text-gray-600"><PlusIcon/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        {tag}
                                        <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-200 hover:bg-indigo-300 text-indigo-900">
                                            &times;
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Ratings Section */}
                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-800 mb-3">Valutazione Affidabilità Fornitore</h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm text-gray-600">Reattività (Problemi)</span>
                                        <span className="text-sm font-bold text-gray-800">{rating.responsiveness}/5</span>
                                    </div>
                                    <div className="flex space-x-1">
                                        {[1,2,3,4,5].map(star => (
                                            <StarIcon key={star} filled={star <= rating.responsiveness} onClick={() => handleRatingChange('responsiveness', star)} />
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm text-gray-600">Partnership (Promozioni)</span>
                                        <span className="text-sm font-bold text-gray-800">{rating.partnership}/5</span>
                                    </div>
                                    <div className="flex space-x-1">
                                        {[1,2,3,4,5].map(star => (
                                            <StarIcon key={star} filled={star <= rating.partnership} onClick={() => handleRatingChange('partnership', star)} />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm text-gray-600">Flessibilità (Rinegoziazione)</span>
                                        <span className="text-sm font-bold text-gray-800">{rating.negotiation}/5</span>
                                    </div>
                                    <div className="flex space-x-1">
                                        {[1,2,3,4,5].map(star => (
                                            <StarIcon key={star} filled={star <= rating.negotiation} onClick={() => handleRatingChange('negotiation', star)} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <RatingLegend />
                        </div>

                        {/* Notes Manager */}
                        <NotesManager 
                            notesHistory={notesHistory}
                            onSave={setNotesHistory}
                            label="Note Fornitore"
                        />
                    </>
                )}

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

    // Sort State
    const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc'>('name_asc');

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

    // Sorting
    filteredSuppliers.sort((a, b) => {
        const nameA = a.companyName;
        const nameB = b.companyName;
        if (sortOrder === 'name_asc') {
            return nameA.localeCompare(nameB);
        } else {
            return nameB.localeCompare(nameA);
        }
    });

    // Helper to calculate average rating
    const getAverageRating = (rating?: SupplierRating) => {
        if (!rating) return 0;
        const sum = (rating.responsiveness || 0) + (rating.partnership || 0) + (rating.negotiation || 0);
        return sum > 0 ? (sum / 3).toFixed(1) : 0;
    };


  return (
    <div>
        <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Fornitori</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci i fornitori, le sedi e le valutazioni.</p>
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

        {/* Sorting Controls */}
        <div className="mt-6 flex justify-end">
            <div className="w-48">
                <select 
                    value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value as any)} 
                    className="block w-full bg-white border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                    style={{borderColor: 'var(--md-divider)'}}
                >
                    <option value="name_asc">Nome (A-Z)</option>
                    <option value="name_desc">Nome (Z-A)</option>
                </select>
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


        <div className="mt-4">
            {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map(supplier => {
                    const avgRating = getAverageRating(supplier.rating);
                    return (
                        <div key={supplier.id} className={`md-card p-6 flex flex-col ${showTrash ? 'border-gray-400 opacity-80' : ''}`}>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-lg font-bold">{supplier.companyName}</h2>
                                    {Number(avgRating) > 0 && (
                                        <div className="flex items-center bg-yellow-50 px-2 py-1 rounded border border-yellow-100" title={`Reattività: ${supplier.rating?.responsiveness}, Partnership: ${supplier.rating?.partnership}, Flessibilità: ${supplier.rating?.negotiation}`}>
                                            <span className="text-sm font-bold text-yellow-700 mr-1">{avgRating}</span>
                                            <StarIcon filled={true} className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                                
                                <p className="text-sm mt-1" style={{color: 'var(--md-text-secondary)'}}>P.IVA: {supplier.vatNumber}</p>
                                
                                {/* Tags */}
                                {supplier.tags && supplier.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2 mb-3">
                                        {supplier.tags.map(tag => (
                                            <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 text-sm space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                    <p className="truncate"><strong>Email:</strong> {supplier.email}</p>
                                    <p><strong>Tel:</strong> {supplier.phone}</p>
                                    <p><strong>Sede:</strong> {supplier.address}, {supplier.city} ({supplier.province})</p>
                                </div>
                                <div className="mt-4 pt-4 border-t" style={{borderColor: 'var(--md-divider)'}}>
                                    <h4 className="font-semibold text-sm">Sedi Operative ({supplier.locations.length})</h4>
                                    <ul className="text-xs mt-2 space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                    {supplier.locations.slice(0, 3).map(loc => {
                                        const fuelR = calculateFuelRating(loc.distance || 0);
                                        return (
                                        <li key={loc.id} className="flex items-center justify-between">
                                            <div className="flex items-center overflow-hidden">
                                                <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: loc.color }}></span>
                                                <span className="truncate">{loc.name}</span>
                                            </div>
                                            <div className="flex items-center bg-gray-100 px-1.5 py-0.5 rounded ml-2" title="Rating Carburante">
                                                <FuelIcon className="w-3 h-3 text-gray-600 mr-1"/>
                                                <span className="font-bold text-gray-700">{fuelR}</span>
                                            </div>
                                        </li>
                                    )})}
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
                    );
                })}
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
