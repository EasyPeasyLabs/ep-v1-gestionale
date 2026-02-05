import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, Enrollment, PaymentMethod, ClientType, ParentClient, InstitutionalClient, AvailabilitySlot, Appointment } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import Spinner from './Spinner';
import SearchIcon from './icons/SearchIcon';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import CalendarIcon from './icons/CalendarIcon';
import ClockIcon from './icons/ClockIcon';

interface EnrollmentFormProps {
    clients: Client[]; 
    initialClient?: Client | null; 
    existingEnrollment?: Enrollment; 
    onSave: (enrollments: EnrollmentInput[], options?: { regenerateCalendar: boolean }) => void;
    onCancel: () => void;
}

// Helper Festività
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    const easterMondays: Record<number, string> = {
        2024: '4-1', 2025: '4-21', 2026: '4-6', 2027: '3-29', 2028: '4-17', 2029: '4-2', 2030: '4-22'
    };
    const key = `${m}-${d}`; 
    const lookupKey = `${m}-${d}`;
    if (easterMondays[y] === lookupKey) return true;
    return false;
};

// Helper standard per calcolo date (solo Mode Standard)
const calculateSlotBasedDates = (startStr: string, lessons: number): { start: string, end: string } => {
    if (!startStr || lessons <= 0) return { start: startStr, end: startStr };
    
    let currentDate = new Date(startStr);
    let validSlots = 0;
    let firstDate: string | null = null;
    let lastDate: string = startStr;

    let loops = 0;
    while (validSlots < lessons && loops < 100) {
        if (!isItalianHoliday(currentDate)) {
            if (!firstDate) firstDate = currentDate.toISOString().split('T')[0];
            lastDate = currentDate.toISOString().split('T')[0];
            validSlots++;
        }
        currentDate.setDate(currentDate.getDate() + 7);
        loops++;
    }

    return { start: firstDate || startStr, end: lastDate };
};

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ clients, initialClient, existingEnrollment, onSave, onCancel }) => {
    // --- STATE CORE ---
    const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || existingEnrollment?.clientId || '');
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>(existingEnrollment ? [existingEnrollment.childId] : []);
    const [isAdultEnrollment, setIsAdultEnrollment] = useState<boolean>(existingEnrollment?.isAdult || false);
    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>(existingEnrollment?.preferredPaymentMethod || PaymentMethod.BankTransfer);
    const [manualPrice, setManualPrice] = useState<string>(existingEnrollment?.price?.toString() || '');
    const [projectName, setProjectName] = useState<string>(existingEnrollment?.childName || '');

    // --- STATE STANDARD MODE ---
    const [startDateInput, setStartDateInput] = useState(existingEnrollment ? existingEnrollment.startDate.split('T')[0] : new Date().toISOString().split('T')[0]); 
    const [endDateInput, setEndDateInput] = useState(existingEnrollment ? existingEnrollment.endDate.split('T')[0] : '');
    const [targetLocationId, setTargetLocationId] = useState(existingEnrollment?.locationId !== 'unassigned' ? existingEnrollment?.locationId : '');
    const [startTime, setStartTime] = useState(existingEnrollment?.appointments?.[0]?.startTime || '16:00');
    const [endTime, setEndTime] = useState(existingEnrollment?.appointments?.[0]?.endTime || '18:00');
    const [isEndDateManual, setIsEndDateManual] = useState(false); 

    // --- STATE CUSTOM SCHEDULE BUILDER (MODE A/B) ---
    const [customSchedule, setCustomSchedule] = useState<Appointment[]>(existingEnrollment?.appointments || []);
    
    // Generator State
    const [genLocationId, setGenLocationId] = useState('');
    const [genDayOfWeek, setGenDayOfWeek] = useState(1);
    const [genStartTime, setGenStartTime] = useState('16:00');
    const [genEndTime, setGenEndTime] = useState('18:00');
    const [genCount, setGenCount] = useState(10);
    const [genSmartSlot, setGenSmartSlot] = useState(''); // "start-end" or "manual"

    // Single Adder State
    const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
    const [singleLocationId, setSingleLocationId] = useState('');
    const [singleStartTime, setSingleStartTime] = useState('16:00');
    const [singleEndTime, setSingleEndTime] = useState('18:00');
    const [singleSmartSlot, setSingleSmartSlot] = useState('');

    // Resources
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [clientSort, setClientSort] = useState<'surname_asc' | 'surname_desc'>('surname_asc');

    const initialValues = useRef({
        startDate: existingEnrollment ? existingEnrollment.startDate.split('T')[0] : '',
        subscriptionId: existingEnrollment?.subscriptionTypeId || '',
        endDate: existingEnrollment ? existingEnrollment.endDate.split('T')[0] : '',
        startTime: existingEnrollment?.appointments?.[0]?.startTime || '16:00',
        endTime: existingEnrollment?.appointments?.[0]?.endTime || '18:00'
    });

    const currentClient = clients.find(p => p.id === selectedClientId);
    const isInstitutional = currentClient?.clientType === ClientType.Institutional || existingEnrollment?.clientType === ClientType.Institutional;
    const isCustomMode = isInstitutional || subscriptionTypeId === 'quote-based';

    useEffect(() => {
        const loadData = async () => {
            try {
                const [subs, supps] = await Promise.all([getSubscriptionTypes(), getSuppliers()]);
                setSubscriptionTypes(subs);
                setSuppliers(supps);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        loadData();
    }, []);

    // Helper: Locations Flattened
    const allLocations = useMemo(() => {
        const locs: {id: string, name: string, color: string, supplierId: string, supplierName: string, availability?: AvailabilitySlot[]}[] = [];
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locs.push({
                    id: l.id, name: l.name, color: l.color,
                    supplierId: s.id, supplierName: s.companyName,
                    availability: l.availability
                });
            });
        });
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    // --- SMART TIME SELECTOR LOGIC ---
    const getSlotsForContext = (locationId: string, dayOfWeek: number) => {
        if (!locationId) return [];
        const loc = allLocations.find(l => l.id === locationId);
        if (!loc || !loc.availability) return [];
        return loc.availability.filter(slot => slot.dayOfWeek === dayOfWeek).sort((a,b) => a.startTime.localeCompare(b.startTime));
    };

    // Update Single Adder Time when Location or Date changes
    useEffect(() => {
        if (!singleLocationId || !singleDate) {
            setSingleSmartSlot('');
            return;
        }
        const day = new Date(singleDate).getDay();
        const slots = getSlotsForContext(singleLocationId, day);
        if (slots.length > 0) {
            // Auto-select first slot
            setSingleSmartSlot(`${slots[0].startTime}-${slots[0].endTime}`);
            setSingleStartTime(slots[0].startTime);
            setSingleEndTime(slots[0].endTime);
        } else {
            setSingleSmartSlot('manual');
        }
    }, [singleLocationId, singleDate]);

    // Update Generator Time when Location or Day changes
    useEffect(() => {
        if (!genLocationId) {
            setGenSmartSlot('');
            return;
        }
        const slots = getSlotsForContext(genLocationId, genDayOfWeek);
        if (slots.length > 0) {
            setGenSmartSlot(`${slots[0].startTime}-${slots[0].endTime}`);
            setGenStartTime(slots[0].startTime);
            setGenEndTime(slots[0].endTime);
        } else {
            setGenSmartSlot('manual');
        }
    }, [genLocationId, genDayOfWeek]);

    const handleSmartSlotChange = (val: string, setStart: any, setEnd: any, setSlot: any) => {
        setSlot(val);
        if (val !== 'manual' && val !== '') {
            const [s, e] = val.split('-');
            setStart(s);
            setEnd(e);
        }
    };

    // --- CUSTOM BUILDER ACTIONS ---
    const addSingleLesson = () => {
        if (!singleLocationId || !singleDate) return alert("Seleziona data e sede.");
        const loc = allLocations.find(l => l.id === singleLocationId);
        
        const newApp: Appointment = {
            lessonId: `NEW-${Date.now()}`,
            date: new Date(singleDate).toISOString(),
            startTime: singleStartTime,
            endTime: singleEndTime,
            locationId: singleLocationId,
            locationName: loc?.name || 'Sede',
            locationColor: loc?.color || '#ccc',
            childName: projectName || 'Progetto',
            status: 'Scheduled'
        };
        
        setCustomSchedule(prev => [...prev, newApp].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    };

    const runGenerator = () => {
        if (!genLocationId) return alert("Seleziona una sede.");
        const loc = allLocations.find(l => l.id === genLocationId);
        const newApps: Appointment[] = [];
        
        let currentDate = new Date(); // Start from today or logic start
        // Find first occurrence of selected day
        while (currentDate.getDay() !== genDayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let added = 0;
        let loops = 0;
        while (added < genCount && loops < 100) { // Safety break
            if (!isItalianHoliday(currentDate)) {
                newApps.push({
                    lessonId: `GEN-${Date.now()}-${added}`,
                    date: currentDate.toISOString(),
                    startTime: genStartTime,
                    endTime: genEndTime,
                    locationId: genLocationId,
                    locationName: loc?.name || 'Sede',
                    locationColor: loc?.color || '#ccc',
                    childName: projectName || 'Progetto',
                    status: 'Scheduled'
                });
                added++;
            }
            currentDate.setDate(currentDate.getDate() + 7);
            loops++;
        }
        
        setCustomSchedule(prev => [...prev, ...newApps].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        alert(`Generate ${added} lezioni.`);
    };

    const removeCustomLesson = (idx: number) => {
        setCustomSchedule(prev => prev.filter((_, i) => i !== idx));
    };

    // --- STANDARD LOGIC ---
    // (Existing slot calculation logic for non-institutional)
    const availableSubscriptions = useMemo(() => {
        const isVisible = (s: SubscriptionType) => {
            const status = s.statusConfig?.status || 'active'; 
            return status === 'active' || status === 'promo' || (existingEnrollment && existingEnrollment.subscriptionTypeId === s.id);
        };
        if (isInstitutional) return subscriptionTypes.filter(isVisible);
        return subscriptionTypes.filter(s => {
            let matchesTarget = false;
            if (s.target) matchesTarget = isAdultEnrollment ? s.target === 'adult' : s.target === 'kid';
            else { const isAdultName = s.name.startsWith('A -'); matchesTarget = isAdultEnrollment ? isAdultName : !isAdultName; }
            return matchesTarget && isVisible(s);
        });
    }, [subscriptionTypes, isAdultEnrollment, isInstitutional, existingEnrollment]);

    const calculatedDates = useMemo(() => {
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (!selectedSub || !startDateInput || isCustomMode) return null;
        return calculateSlotBasedDates(startDateInput, selectedSub.lessons);
    }, [subscriptionTypeId, startDateInput, subscriptionTypes, isCustomMode]);

    useEffect(() => {
        if (!isEndDateManual && calculatedDates && !isCustomMode) {
            setEndDateInput(calculatedDates.end);
        }
    }, [calculatedDates, isEndDateManual, isCustomMode]);

    const filteredClients = useMemo(() => {
        let result = clients.filter(c => {
            const term = clientSearchTerm.toLowerCase();
            if (c.clientType === ClientType.Parent) {
                const p = c as ParentClient;
                return `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) || p.children.some(ch => ch.name.toLowerCase().includes(term));
            } else {
                return (c as InstitutionalClient).companyName.toLowerCase().includes(term);
            }
        });
        return result.sort((a, b) => {
            const nameA = a.clientType === ClientType.Parent ? (a as ParentClient).lastName : (a as InstitutionalClient).companyName;
            const nameB = b.clientType === ClientType.Parent ? (b as ParentClient).lastName : (b as InstitutionalClient).companyName;
            return clientSort === 'surname_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [clients, clientSearchTerm, clientSort]);

    const toggleChildSelection = (childId: string) => {
        setSelectedChildIds(prev => prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]);
    };

    // --- SUBMIT ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) return alert("Seleziona un cliente.");
        if (!isInstitutional && !isAdultEnrollment && selectedChildIds.length === 0) return alert("Seleziona almeno un figlio.");

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        
        let appointmentsPayload: any[] = [];
        let finalStartDate = startDateInput;
        let finalEndDate = endDateInput;
        let finalLessonsTotal = Number(existingEnrollment?.lessonsTotal || selectedSub?.lessons || 0);
        let finalLocationId = targetLocationId || 'unassigned';
        let finalLocationName = allLocations.find(l => l.id === targetLocationId)?.name || 'Sede Non Definita';
        let finalLocationColor = allLocations.find(l => l.id === targetLocationId)?.color || '#e5e7eb';
        let finalSupplierId = allLocations.find(l => l.id === targetLocationId)?.supplierId || 'unassigned';
        let finalSupplierName = allLocations.find(l => l.id === targetLocationId)?.supplierName || '';

        // --- MODE LOGIC BRANCH ---
        if (isCustomMode) {
            if (customSchedule.length === 0) return alert("Inserisci almeno una lezione nel calendario.");
            
            appointmentsPayload = customSchedule;
            // Recalculate bounds from custom schedule
            const sortedDates = customSchedule.map(a => new Date(a.date).getTime()).sort((a,b) => a - b);
            finalStartDate = new Date(sortedDates[0]).toISOString();
            finalEndDate = new Date(sortedDates[sortedDates.length - 1]).toISOString();
            finalLessonsTotal = customSchedule.length;
            
            // For Institutional, location might be mixed, we use a placeholder or the most frequent
            finalLocationId = 'mixed'; 
            finalLocationName = 'Multi-Sede';
        } else {
            // Standard Mode
            let regenerateCalendar = false;
            const dateChanged = startDateInput !== initialValues.current.startDate;
            const subChanged = subscriptionTypeId !== initialValues.current.subscriptionId;
            const endChanged = endDateInput !== initialValues.current.endDate;
            const timeChanged = startTime !== initialValues.current.startTime || endTime !== initialValues.current.endTime;
            const locationChanged = finalLocationId !== existingEnrollment?.locationId;

            if (existingEnrollment && (dateChanged || subChanged || endChanged || timeChanged || locationChanged)) {
                if(window.confirm("Hai modificato parametri chiave. Rigenerare il calendario?")) regenerateCalendar = true;
            }

            if (regenerateCalendar || !existingEnrollment) {
                appointmentsPayload = [{
                    lessonId: 'template', 
                    date: new Date(startDateInput).toISOString(),
                    startTime: startTime,
                    endTime: endTime,
                    locationId: finalLocationId,
                    locationName: finalLocationName,
                    locationColor: finalLocationColor,
                    childName: '', 
                    status: 'Scheduled'
                }];
            } else {
                appointmentsPayload = (existingEnrollment.appointments || []).map(app => ({
                    ...app, startTime, endTime, locationId: finalLocationId, locationName: finalLocationName, locationColor: finalLocationColor
                }));
            }
        }

        const enrollmentsToSave: EnrollmentInput[] = [];
        const targets = isInstitutional 
            ? [{ id: existingEnrollment?.childId || 'institutional', name: projectName || (currentClient as InstitutionalClient).companyName }]
            : isAdultEnrollment 
                ? [{ id: selectedClientId, name: `${(currentClient as ParentClient).firstName} ${(currentClient as ParentClient).lastName}` }]
                : selectedChildIds.map(id => {
                    const c = (currentClient as ParentClient).children.find(child => child.id === id);
                    return c ? { id: c.id, name: c.name } : null;
                }).filter(Boolean);

        targets.forEach(target => {
            if(!target) return;
            const newEnrollment: EnrollmentInput = {
                clientId: selectedClientId,
                clientType: currentClient?.clientType || ClientType.Parent,
                childId: target.id, 
                childName: target.name, 
                isAdult: isAdultEnrollment,
                isQuoteBased: existingEnrollment?.isQuoteBased || isInstitutional,
                relatedQuoteId: existingEnrollment?.relatedQuoteId || undefined,
                subscriptionTypeId: subscriptionTypeId || 'quote-based',
                subscriptionName: selectedSub?.name || existingEnrollment?.subscriptionName || 'Progetto Istituzionale',
                price: Number(manualPrice) || 0,
                
                supplierId: finalSupplierId,
                supplierName: finalSupplierName,
                locationId: finalLocationId,
                locationName: finalLocationName, 
                locationColor: finalLocationColor, 
                
                appointments: appointmentsPayload, 
                
                lessonsTotal: finalLessonsTotal,
                lessonsRemaining: isCustomMode ? finalLessonsTotal : Number(existingEnrollment?.lessonsRemaining || selectedSub?.lessons || 0),
                startDate: new Date(finalStartDate).toISOString(),
                endDate: new Date(finalEndDate).toISOString(),
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
                preferredPaymentMethod: preferredPaymentMethod,
                adjustmentAmount: existingEnrollment?.adjustmentAmount,
                adjustmentNotes: existingEnrollment?.adjustmentNotes
            };
            if (existingEnrollment) (newEnrollment as any).id = existingEnrollment.id;
            enrollmentsToSave.push(newEnrollment);
        });

        onSave(enrollmentsToSave, { regenerateCalendar: !isCustomMode });
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full w-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                {isCustomMode && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-widest mt-1 inline-block">Builder Avanzato</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                {/* 1. SELEZIONE CLIENTE */}
                <div className="space-y-2">
                    {!existingEnrollment && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 flex gap-2 items-center">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input type="text" className="w-full pl-8 pr-2 py-1 text-sm border rounded" placeholder="Cerca cliente..." value={clientSearchTerm} onChange={e => setClientSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    )}
                    <div className="md-input-group">
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className="md-input font-medium">
                            <option value="" disabled>Seleziona Cliente...</option>
                            {filteredClients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.clientType === ClientType.Parent ? `${(c as ParentClient).lastName} ${(c as ParentClient).firstName}` : (c as InstitutionalClient).companyName}
                                </option>
                            ))}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">1. Cliente / Ente</label>
                    </div>
                </div>

                {/* LOGICA B2C vs B2B */}
                {!isInstitutional ? (
                    <>
                        {!existingEnrollment && (
                            <div className="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <span className="text-xs font-bold text-gray-700 self-center">Target:</span>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={!isAdultEnrollment} onChange={() => setIsAdultEnrollment(false)} className="mr-2" /><span className="text-sm text-gray-700">Figlio/i</span></label>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={isAdultEnrollment} onChange={() => setIsAdultEnrollment(true)} className="mr-2" /><span className="text-sm text-gray-700">Genitore</span></label>
                            </div>
                        )}
                        {!isAdultEnrollment && (
                            <div className={`md-input-group relative ${!selectedClientId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="md-input cursor-pointer flex justify-between items-center" onClick={() => !existingEnrollment && setIsChildDropdownOpen(!isChildDropdownOpen)}>
                                    <span className="truncate">{selectedChildIds.length === 0 ? "Seleziona figli..." : (currentClient as ParentClient)?.children.filter(c => selectedChildIds.includes(c.id)).map(c => c.name).join(', ')}</span>
                                </div>
                                <label className="md-input-label !top-0 !text-xs">2. Allievi</label>
                                {isChildDropdownOpen && (currentClient as ParentClient)?.children && (
                                    <div className="absolute z-20 w-full bg-white shadow-xl border rounded-md mt-1 max-h-48 overflow-y-auto">
                                        {(currentClient as ParentClient).children.map(child => (
                                            <label key={child.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                                                <input type="checkbox" checked={selectedChildIds.includes(child.id)} onChange={() => toggleChildSelection(child.id)} disabled={!!existingEnrollment} className="mr-3" />
                                                <span className="text-sm">{child.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Dettaglio Progetto (Nome Pubblico)</p>
                        <input 
                            type="text" 
                            value={projectName} 
                            onChange={e => setProjectName(e.target.value)}
                            className="w-full bg-white border border-indigo-200 rounded p-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none" 
                            placeholder="Es: Corso Inglese Estivo"
                        />
                    </div>
                )}

                {/* PACCHETTO, PREZZO & PAGAMENTO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md-input-group">
                        <select value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input font-bold">
                            {isInstitutional ? <option value="quote-based">Basato su Preventivo</option> : (
                                <>
                                    <option value="" disabled>Seleziona pacchetto...</option>
                                    {availableSubscriptions.map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.name} - {sub.price.toFixed(2)}€ ({sub.lessons} lez.)
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">3. Piano / Pacchetto</label>
                    </div>
                    
                    <div className="md-input-group">
                        <input 
                            type="number" 
                            value={manualPrice} 
                            onChange={e => setManualPrice(e.target.value)} 
                            className="md-input font-black text-right pr-8"
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-3 text-sm text-gray-400 font-bold">€</span>
                        <label className="md-input-label !top-0 !text-xs">Prezzo Pattuito</label>
                    </div>

                    <div className="md-input-group">
                        <select value={preferredPaymentMethod} onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">4. Metodo Previsto</label>
                    </div>
                </div>

                {/* CONDITIONAL RENDER: STANDARD vs CUSTOM BUILDER */}
                {!isCustomMode ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md-input-group">
                                <input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} required className="md-input" />
                                <label className="md-input-label !top-0 !text-xs">5. Data Inizio (Primo Slot)</label>
                            </div>
                            <div className="md-input-group">
                                <input type="date" value={endDateInput} onChange={e => { setEndDateInput(e.target.value); setIsEndDateManual(true); }} required className="md-input" />
                                <label className="md-input-label !top-0 !text-xs">6. Data Fine (Ultimo Slot)</label>
                                {!isEndDateManual && calculatedDates && (
                                    <span className="absolute -bottom-4 right-0 text-[10px] text-indigo-500 font-bold bg-white px-1">
                                        Calcolata su {subscriptionTypes.find(s => s.id === subscriptionTypeId)?.lessons} slot
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ASSEGNAZIONE SEDE STANDARD */}
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-2">
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-3">7. Assegnazione Sede & Orario</label>
                            
                            <div className="md-input-group !mb-3">
                                <select 
                                    value={targetLocationId || ''} 
                                    onChange={e => setTargetLocationId(e.target.value)} 
                                    className="md-input bg-white font-bold text-indigo-700"
                                >
                                    <option value="">-- Nessuna / Da Assegnare (Manuale) --</option>
                                    {allLocations.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                                <label className="md-input-label !top-0">Recinto di Destinazione</label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="md-input-group !mb-0">
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="md-input text-sm font-bold" />
                                    <label className="md-input-label !top-0">Inizio</label>
                                </div>
                                <div className="md-input-group !mb-0">
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="md-input text-sm font-bold" />
                                    <label className="md-input-label !top-0">Fine</label>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* CUSTOM SCHEDULE BUILDER (MODE A/B) */
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarIcon />
                            <h4 className="text-lg font-black text-indigo-900">Pianificatore Progetto</h4>
                        </div>

                        {/* BUILDER AREA */}
                        <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-4">
                            {/* SECTION 1: ADD SINGLE (MODE A) */}
                            <div className="mb-6">
                                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Inserimento Puntuale</p>
                                <div className="flex flex-col md:flex-row gap-2 items-end bg-gray-50 p-2 rounded-xl">
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">DATA</label>
                                        <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-gray-200" />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">SEDE</label>
                                        <select value={singleLocationId} onChange={e => setSingleLocationId(e.target.value)} className="w-full text-xs font-bold p-2 rounded border border-gray-200">
                                            <option value="">Seleziona...</option>
                                            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-[2] w-full">
                                        <label className="text-[10px] text-gray-400 font-bold block mb-1">ORARIO (Smart Select)</label>
                                        <div className="flex gap-2">
                                            <select 
                                                value={singleSmartSlot} 
                                                onChange={e => handleSmartSlotChange(e.target.value, setSingleStartTime, setSingleEndTime, setSingleSmartSlot)} 
                                                className="flex-1 text-xs font-bold p-2 rounded border border-gray-200 bg-white"
                                                disabled={!singleLocationId}
                                            >
                                                <option value="" disabled>-- Seleziona Slot Ufficiale --</option>
                                                {singleLocationId && getSlotsForContext(singleLocationId, new Date(singleDate).getDay()).map((slot, i) => (
                                                    <option key={i} value={`${slot.startTime}-${slot.endTime}`}>
                                                        {slot.startTime} - {slot.endTime}
                                                    </option>
                                                ))}
                                                <option value="manual">Manuale / Custom</option>
                                            </select>
                                            {singleSmartSlot === 'manual' && (
                                                <>
                                                    <input type="time" value={singleStartTime} onChange={e => setSingleStartTime(e.target.value)} className="w-16 text-xs p-1 border rounded" />
                                                    <input type="time" value={singleEndTime} onChange={e => setSingleEndTime(e.target.value)} className="w-16 text-xs p-1 border rounded" />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button type="button" onClick={addSingleLesson} className="md-btn md-btn-sm md-btn-raised md-btn-primary w-full md:w-auto h-full flex items-center justify-center">
                                        <PlusIcon />
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 2: BULK GENERATOR (MODE B) */}
                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <ClockIcon /> Generatore Periodico
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black text-amber-700 uppercase">Giorno</label>
                                        <select value={genDayOfWeek} onChange={e => setGenDayOfWeek(Number(e.target.value))} className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white">
                                            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((d,i) => <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black text-amber-700 uppercase">Sede</label>
                                        <select value={genLocationId} onChange={e => setGenLocationId(e.target.value)} className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white">
                                            <option value="">Seleziona...</option>
                                            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-amber-700 uppercase">Orario</label>
                                            <select 
                                                value={genSmartSlot} 
                                                onChange={e => handleSmartSlotChange(e.target.value, setGenStartTime, setGenEndTime, setGenSmartSlot)} 
                                                className="w-full text-xs p-1.5 rounded border border-amber-200 bg-white"
                                                disabled={!genLocationId}
                                            >
                                                <option value="" disabled>Slot...</option>
                                                {genLocationId && getSlotsForContext(genLocationId, genDayOfWeek).map((slot, i) => (
                                                    <option key={i} value={`${slot.startTime}-${slot.endTime}`}>
                                                        {slot.startTime} - {slot.endTime}
                                                    </option>
                                                ))}
                                                <option value="manual">Manuale</option>
                                            </select>
                                        </div>
                                        {genSmartSlot === 'manual' && (
                                            <div className="flex gap-1 items-end">
                                                <input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="w-12 text-xs p-1 rounded border" />
                                                <input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="w-12 text-xs p-1 rounded border" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 flex gap-1">
                                        <div className="w-16">
                                            <label className="text-[9px] font-black text-amber-700 uppercase">Quantità</label>
                                            <input type="number" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="w-full text-xs p-1.5 rounded border border-amber-200 text-center" />
                                        </div>
                                        <button type="button" onClick={runGenerator} className="bg-amber-500 text-white text-xs font-bold px-2 rounded hover:bg-amber-600 flex-1">Genera</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PREVIEW TABLE */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-black text-gray-500 uppercase">Calendario ({customSchedule.length} lezioni)</span>
                                <button type="button" onClick={() => setCustomSchedule([])} className="text-[10px] text-red-500 font-bold hover:underline">Svuota Tutto</button>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <tbody className="divide-y divide-gray-100">
                                        {customSchedule.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400 italic">Nessuna lezione inserita.</td></tr>}
                                        {customSchedule.map((app, idx) => (
                                            <tr key={idx} className="bg-white hover:bg-gray-50">
                                                <td className="p-2 font-mono text-gray-600">{new Date(app.date).toLocaleDateString()}</td>
                                                <td className="p-2 font-bold text-gray-800">{app.startTime} - {app.endTime}</td>
                                                <td className="p-2 text-indigo-600">{app.locationName}</td>
                                                <td className="p-2 text-right">
                                                    <button type="button" onClick={() => removeCustomLesson(idx)} className="text-red-400 hover:text-red-600 px-2 font-bold">×</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Modifiche</button>
            </div>
        </form>
    );
};

export default EnrollmentForm;