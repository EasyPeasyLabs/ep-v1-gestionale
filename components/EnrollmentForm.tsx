
import React, { useState, useEffect, useMemo } from 'react';
import { ParentClient, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, AvailabilitySlot, Appointment, Enrollment } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import Spinner from './Spinner';
import SearchIcon from './icons/SearchIcon';

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

interface EnrollmentFormProps {
    parents: ParentClient[]; // Riceve la lista di tutti i genitori
    initialParent?: ParentClient | null; // Opzionale: genitore preselezionato (es. da Edit o da dettaglio)
    existingEnrollment?: Enrollment; // Opzionale, per la modifica
    onSave: (enrollments: EnrollmentInput[]) => void;
    onCancel: () => void;
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ parents, initialParent, existingEnrollment, onSave, onCancel }) => {
    // State per il Genitore Selezionato
    const [selectedParentId, setSelectedParentId] = useState<string>(initialParent?.id || existingEnrollment?.clientId || '');

    // State per selezione multipla figli
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>(existingEnrollment ? [existingEnrollment.childId] : []);
    
    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [supplierId, setSupplierId] = useState(existingEnrollment?.supplierId || '');
    const [locationId, setLocationId] = useState(existingEnrollment?.locationId || '');
    const [startDateInput, setStartDateInput] = useState(existingEnrollment ? existingEnrollment.startDate.split('T')[0] : new Date().toISOString().split('T')[0]); 
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    
    // UI State
    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);

    // --- FILTER STATES ---
    // Parent Filters
    const [parentSearchTerm, setParentSearchTerm] = useState('');
    const [parentSort, setParentSort] = useState<'surname_asc' | 'surname_desc' | 'name_asc' | 'name_desc'>('surname_asc');
    
    // Supplier Filters
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [supplierSort, setSupplierSort] = useState<'name_asc' | 'name_desc'>('name_asc');
    const [filterDay, setFilterDay] = useState<string>(''); // '' = all
    const [filterTime, setFilterTime] = useState<string>(''); // HH:mm

    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    // Derivato: Genitore corrente
    const currentParent = parents.find(p => p.id === selectedParentId);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [subs, suppliersData] = await Promise.all([
                getSubscriptionTypes(),
                getSuppliers()
            ]);
            setSubscriptionTypes(subs);
            setSuppliers(suppliersData);

            if (!existingEnrollment) {
                // Valori default solo se nuova iscrizione
                if (subs.length > 0) setSubscriptionTypeId(subs[0].id);
                // Non auto-selezioniamo il fornitore per forzare l'uso dei filtri se necessario
            } else {
                // Se modifica, tentiamo di pre-selezionare lo slot corretto
                if(existingEnrollment.appointments && existingEnrollment.appointments.length > 0) {
                    const firstApp = existingEnrollment.appointments[0];
                    const appDate = new Date(firstApp.date);
                    const appDay = appDate.getDay();
                    const appStart = firstApp.startTime;
                    
                    const supplier = suppliersData.find(s => s.id === existingEnrollment.supplierId);
                    const location = supplier?.locations.find(l => l.id === existingEnrollment.locationId);
                    if(location && location.availability) {
                        const slotIdx = location.availability.findIndex(slot => slot.dayOfWeek === appDay && slot.startTime === appStart);
                        if(slotIdx >= 0) setSelectedSlotIndex(slotIdx);
                    }
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [existingEnrollment]);

    // Effetto per gestire il cambio di genitore e resettare i figli se necessario
    useEffect(() => {
        if (!existingEnrollment && currentParent) {
            // Se cambiamo genitore in creazione, resettiamo i figli
            setSelectedChildIds([]); 
        }
    }, [selectedParentId, existingEnrollment]);


    const handleSupplierChange = (newSupplierId: string) => {
        setSupplierId(newSupplierId);
        setLocationId(''); // Reset location
        setSelectedSlotIndex(null); 
    };

    const toggleChildSelection = (childId: string) => {
        // Se siamo in modifica, non permettiamo di cambiare il figlio
        if (existingEnrollment) return;

        setSelectedChildIds(prev => {
            if (prev.includes(childId)) {
                return prev.filter(id => id !== childId);
            } else {
                return [...prev, childId];
            }
        });
    };

    // --- FILTER LOGIC ---

    const filteredParents = useMemo(() => {
        let result = parents.filter(p => {
            const term = parentSearchTerm.toLowerCase();
            const parentMatch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(term);
            const childMatch = p.children.some(c => c.name.toLowerCase().includes(term));
            return parentMatch || childMatch;
        });

        result.sort((a, b) => {
            switch (parentSort) {
                case 'surname_asc': return a.lastName.localeCompare(b.lastName);
                case 'surname_desc': return b.lastName.localeCompare(a.lastName);
                case 'name_asc': return a.firstName.localeCompare(b.firstName);
                case 'name_desc': return b.firstName.localeCompare(a.firstName);
                default: return 0;
            }
        });
        return result;
    }, [parents, parentSearchTerm, parentSort]);

    const filteredSuppliers = useMemo(() => {
        let result = suppliers.filter(s => {
            const term = supplierSearchTerm.toLowerCase();
            // 1. Text Match (Company or Location Name)
            const textMatch = s.companyName.toLowerCase().includes(term) || 
                              s.locations.some(l => l.name.toLowerCase().includes(term));
            
            if (!textMatch) return false;

            // 2. Day/Time Match
            if (filterDay !== '' || filterTime !== '') {
                const dayNum = filterDay !== '' ? parseInt(filterDay) : null;
                
                // Controlla se il fornitore ha ALMENO una sede con disponibilità compatibile
                const hasAvailability = s.locations.some(loc => {
                    if (!loc.availability) return false;
                    return loc.availability.some(slot => {
                        const dayOk = dayNum === null || slot.dayOfWeek === dayNum;
                        const timeOk = filterTime === '' || (filterTime >= slot.startTime && filterTime <= slot.endTime);
                        return dayOk && timeOk;
                    });
                });
                
                if (!hasAvailability) return false;
            }

            return true;
        });

        result.sort((a, b) => {
            if (supplierSort === 'name_asc') return a.companyName.localeCompare(b.companyName);
            return b.companyName.localeCompare(a.companyName);
        });

        return result;
    }, [suppliers, supplierSearchTerm, supplierSort, filterDay, filterTime]);


    // Helper per generare le date delle lezioni
    const generateAppointments = (startDate: Date, slot: AvailabilitySlot, numLessons: number, locName: string, locColor: string, childName: string): Appointment[] => {
        const appointments: Appointment[] = [];
        let currentDate = new Date(startDate);
        let lessonsScheduled = 0;

        while (currentDate.getDay() !== slot.dayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (currentDate < startDate) {
             currentDate.setDate(currentDate.getDate() + 7);
        }

        while (lessonsScheduled < numLessons) {
            appointments.push({
                lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: currentDate.toISOString(),
                startTime: slot.startTime,
                endTime: slot.endTime,
                locationName: locName,
                locationColor: locColor,
                childName: childName
            });
            currentDate.setDate(currentDate.getDate() + 7);
            lessonsScheduled++;
        }
        return appointments;
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedParentId) {
            alert("Seleziona un genitore.");
            return;
        }
        if (selectedChildIds.length === 0) {
            alert("Seleziona almeno un figlio.");
            return;
        }

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        // Cerca in TUTTI i fornitori, non solo quelli filtrati, per sicurezza in invio
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);
        
        if (!selectedSub || !selectedSupplier || !selectedLocation) return;
        
        if (selectedSlotIndex === null) {
            alert("Per favore seleziona un orario (slot) disponibile.");
            return;
        }
        const selectedSlot = selectedLocation.availability ? selectedLocation.availability[selectedSlotIndex] : null;
        if (!selectedSlot) return;

        const enrollmentsToSave: EnrollmentInput[] = [];

        selectedChildIds.forEach(childId => {
            // Assicuriamoci di cercare il figlio nel genitore CORRENTE selezionato
            const childObj = currentParent?.children.find(c => c.id === childId);
            if (!childObj) return;

            const startObj = new Date(startDateInput);
            const appointments = generateAppointments(
                startObj, 
                selectedSlot, 
                selectedSub.lessons, 
                selectedLocation.name, 
                selectedLocation.color,
                childObj.name
            );
            
            const startDate = appointments.length > 0 ? appointments[0].date : startObj.toISOString();
            
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(startDateObj);
            endDateObj.setDate(endDateObj.getDate() + (selectedSub.durationInDays || 0));
            const endDate = endDateObj.toISOString();

            const newEnrollment: EnrollmentInput = {
                clientId: selectedParentId,
                childId: childObj.id,
                childName: childObj.name,
                subscriptionTypeId,
                subscriptionName: selectedSub.name,
                price: selectedSub.price,
                supplierId: selectedSupplier.id,
                supplierName: selectedSupplier.companyName,
                locationId: selectedLocation.id,
                locationName: selectedLocation.name,
                locationColor: selectedLocation.color,
                appointments: appointments,
                lessonsTotal: selectedSub.lessons,
                lessonsRemaining: selectedSub.lessons,
                startDate: startDate,
                endDate: endDate,
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
            };
            
            if (existingEnrollment) {
                 (newEnrollment as any).id = existingEnrollment.id;
            }

            enrollmentsToSave.push(newEnrollment);
        });

        onSave(enrollmentsToSave);
    };

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    const selectedLocation = selectedSupplier?.locations.find(l => l.id === locationId);

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                <p className="text-sm text-gray-500">Compila i dati per iscrivere l'allievo ai corsi.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                
                {/* 1. SELEZIONE GENITORE */}
                <div className="space-y-2">
                    {/* Filter Bar for Parents */}
                    {!existingEnrollment && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 flex gap-2 items-center">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input 
                                    type="text" 
                                    className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500" 
                                    placeholder="Cerca genitore o figlio..."
                                    value={parentSearchTerm}
                                    onChange={e => setParentSearchTerm(e.target.value)}
                                />
                            </div>
                            <select 
                                value={parentSort}
                                onChange={(e) => setParentSort(e.target.value as any)}
                                className="text-xs border-gray-300 rounded py-1 pl-2 pr-6 bg-white"
                            >
                                <option value="surname_asc">Cognome (A-Z)</option>
                                <option value="surname_desc">Cognome (Z-A)</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="name_desc">Nome (Z-A)</option>
                            </select>
                        </div>
                    )}

                    <div className="md-input-group">
                        <select 
                            id="parent-select"
                            value={selectedParentId} 
                            onChange={e => setSelectedParentId(e.target.value)} 
                            required 
                            disabled={!!existingEnrollment} 
                            className={`md-input font-medium ${existingEnrollment ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                            <option value="" disabled>Seleziona Genitore...</option>
                            {filteredParents.map(p => (
                                <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>
                            ))}
                        </select>
                        <label htmlFor="parent-select" className="md-input-label !top-0 !text-xs !text-gray-500">1. Genitore</label>
                    </div>
                </div>

                {/* 2. SELEZIONE FIGLI (Multipla) */}
                <div className={`md-input-group relative transition-opacity duration-200 ${!selectedParentId ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs text-gray-500 absolute top-0 left-0">2. Figli (Seleziona uno o più)</label>
                    
                    <div 
                        className="md-input cursor-pointer flex justify-between items-center mt-2"
                        onClick={() => !existingEnrollment && setIsChildDropdownOpen(!isChildDropdownOpen)}
                    >
                        <span className="truncate">
                            {selectedChildIds.length === 0 
                                ? (currentParent?.children.length === 0 ? "Nessun figlio registrato" : "Seleziona figli...") 
                                : currentParent?.children.filter(c => selectedChildIds.includes(c.id)).map(c => c.name).join(', ')}
                        </span>
                        {!existingEnrollment && (
                            <svg className={`w-4 h-4 transition-transform ${isChildDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        )}
                    </div>

                    {(isChildDropdownOpen || existingEnrollment) && (
                         <div className={`${existingEnrollment ? 'block mt-2' : 'absolute z-20 w-full bg-white shadow-xl border border-gray-200 rounded-md mt-1 max-h-48 overflow-y-auto'}`}>
                            {currentParent?.children.map(child => (
                                <label key={child.id} className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer ${existingEnrollment ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedChildIds.includes(child.id)}
                                        onChange={() => toggleChildSelection(child.id)}
                                        disabled={!!existingEnrollment}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-700">{child.name}</span>
                                        <span className="text-[10px] text-gray-500">{child.age}</span>
                                    </div>
                                </label>
                            ))}
                            {currentParent?.children.length === 0 && (
                                <div className="px-4 py-2 text-sm text-gray-500 italic">Nessun figlio disponibile. Aggiungili nell'anagrafica clienti.</div>
                            )}
                        </div>
                    )}
                    {isChildDropdownOpen && !existingEnrollment && (
                        <div className="fixed inset-0 z-10" onClick={() => setIsChildDropdownOpen(false)}></div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 5. DATA INIZIO */}
                    <div className="md-input-group">
                        <input 
                            id="startDate" 
                            type="date" 
                            value={startDateInput} 
                            onChange={e => setStartDateInput(e.target.value)} 
                            required 
                            className="md-input" 
                        />
                        <label htmlFor="startDate" className="md-input-label !top-0 !text-xs !text-gray-500">5. Data Inizio</label>
                    </div>

                    {/* 6. PACCHETTO */}
                    <div className="md-input-group">
                        <select id="sub-type" value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input">
                            {subscriptionTypes.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.lessons} lez. - {sub.price}€)</option>)}
                        </select>
                        <label htmlFor="sub-type" className="md-input-label !top-0 !text-xs !text-gray-500">6. Pacchetto</label>
                    </div>
                </div>

                {/* SELEZIONE FORNITORE (Filtro per Sede) */}
                <div className="space-y-2">
                    {/* Filter Bar for Suppliers */}
                    <div className="bg-gray-50 p-2 rounded border border-gray-200 grid grid-cols-2 gap-2">
                        <div className="col-span-2 md:col-span-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                            <input 
                                type="text" 
                                className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500" 
                                placeholder="Cerca Fornitore o Sede..."
                                value={supplierSearchTerm}
                                onChange={e => setSupplierSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1 flex gap-2">
                            <select 
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                                className="flex-1 text-xs border-gray-300 rounded py-1 bg-white"
                            >
                                <option value="">Giorno...</option>
                                {daysOfWeekMap.map((d, i) => <option key={i} value={i}>{d}</option>)}
                            </select>
                            <input 
                                type="time" 
                                value={filterTime}
                                onChange={(e) => setFilterTime(e.target.value)}
                                className="flex-1 text-xs border-gray-300 rounded py-1 px-1 bg-white"
                            />
                        </div>
                        <div className="col-span-2">
                             <select 
                                value={supplierSort}
                                onChange={(e) => setSupplierSort(e.target.value as any)}
                                className="w-full text-xs border-gray-300 rounded py-1 bg-white"
                            >
                                <option value="name_asc">Ragione Sociale (A-Z)</option>
                                <option value="name_desc">Ragione Sociale (Z-A)</option>
                            </select>
                        </div>
                    </div>

                    <div className="md-input-group">
                        <select id="supplier" value={supplierId} onChange={e => handleSupplierChange(e.target.value)} required className="md-input">
                            <option value="" disabled>Seleziona Fornitore...</option>
                            {filteredSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.companyName}</option>
                            ))}
                        </select>
                        <label htmlFor="supplier" className="md-input-label !top-0 !text-xs !text-gray-500">Fornitore</label>
                    </div>
                </div>

                {/* 3. SELEZIONE SEDE (Radio List) */}
                <div className={`transition-opacity duration-200 ${!selectedSupplier ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-xs text-gray-500 mb-2">3. Seleziona Sede</label>
                    <div className="grid grid-cols-1 gap-2">
                        {!selectedSupplier?.locations.length && <p className="text-sm text-gray-400 italic">Nessuna sede disponibile per questo fornitore.</p>}
                        
                        {selectedSupplier?.locations.map(l => (
                            <label key={l.id} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${locationId === l.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                <input 
                                    type="radio" 
                                    name="locationSelection" 
                                    value={l.id}
                                    checked={locationId === l.id}
                                    onChange={() => { setLocationId(l.id); setSelectedSlotIndex(null); }}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                                <div className="ml-3 flex-1">
                                    <span className="block text-sm font-medium text-gray-900">{l.name}</span>
                                    <span className="block text-xs text-gray-500">{l.address}, {l.city}</span>
                                </div>
                                <div className="w-3 h-3 rounded-full border border-gray-300" style={{backgroundColor: l.color}}></div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 4. SELEZIONE SLOT (Radio List) */}
                {selectedLocation && (
                    <div className="animate-fade-in">
                         <label className="block text-xs text-gray-500 mb-2">4. Seleziona Slot Orario</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                             {selectedLocation.availability && selectedLocation.availability.length > 0 ? (
                                 selectedLocation.availability.map((slot, idx) => (
                                     <label key={idx} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedSlotIndex === idx ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                         <input 
                                             type="radio" 
                                             name="availabilitySlot" 
                                             value={idx} 
                                             checked={selectedSlotIndex === idx}
                                             onChange={() => setSelectedSlotIndex(idx)}
                                             className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                                         />
                                         <div className="ml-3">
                                             <span className="block text-sm font-medium text-gray-900 uppercase">
                                                 {daysOfWeekMap[slot.dayOfWeek]}
                                             </span>
                                             <span className="block text-sm text-gray-500 font-mono">
                                                 {slot.startTime} - {slot.endTime}
                                             </span>
                                         </div>
                                     </label>
                                 ))
                             ) : (
                                 <p className="text-sm text-red-500 col-span-2">Questa sede non ha orari definiti.</p>
                             )}
                         </div>
                    </div>
                )}
                
                <div className="bg-blue-50 p-3 rounded-md mt-2 border border-blue-100">
                    <p className="text-xs text-blue-800">
                        Stato iniziale: <strong>In Attesa di Pagamento</strong>.
                    </p>
                    {selectedChildIds.length > 1 && (
                         <p className="text-xs text-blue-800 mt-1 font-semibold">
                            Verranno create {selectedChildIds.length} iscrizioni separate.
                        </p>
                    )}
                </div>
            </div>

             <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button 
                    type="submit" 
                    className="md-btn md-btn-raised md-btn-green md-btn-sm" 
                    disabled={!selectedParentId || selectedChildIds.length === 0 || !locationId || selectedSlotIndex === null}
                >
                    {existingEnrollment ? 'Salva Modifiche' : `Conferma (${selectedChildIds.length})`}
                </button>
            </div>
        </form>
    );
};

export default EnrollmentForm;
