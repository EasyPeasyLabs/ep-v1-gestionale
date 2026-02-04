
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Enrollment, EnrollmentStatus, Supplier } from '../types';
import { getAllEnrollments, registerAbsence, registerPresence, resetAppointmentStatus, toggleAppointmentStatus, deleteAppointment } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import CalendarIcon from '../components/icons/CalendarIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import CheckIcon from '../components/icons/CheckIcon'; 

// Icona X per "Tutti Assenti" (inline SVG per sicurezza)
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Interfaccia estesa per visualizzare le lezioni nella lista presenze
interface AttendanceItem extends Appointment {
    enrollmentId: string;
    childName: string;
    subscriptionName: string;
    lessonsRemaining: number;
}

interface AttendanceProps {
    initialParams?: {
        date?: string; // ISO date string
    };
}

// Helpers Date
const getStartOfWeek = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); };
const getEndOfWeek = (d: Date) => { const date = getStartOfWeek(d); date.setDate(date.getDate() + 6); return date; };
const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// --- ABSENCE WIZARD MODAL (MULTI-ITEM SUPPORT) ---
const AbsenceWizardModal: React.FC<{
    items: AttendanceItem[];
    suppliers: Supplier[];
    onClose: () => void;
    onConfirm: (strategy: 'lost' | 'recover_auto' | 'recover_manual', details?: any) => Promise<void>;
}> = ({ items, suppliers, onClose, onConfirm }) => {
    // Use first item as reference for defaults (since they are in same slot)
    const refItem = items[0];
    if (!refItem) return null;

    const [step, setStep] = useState<'choice' | 'manual'>('choice');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualTimeStart, setManualTimeStart] = useState(refItem.startTime);
    const [manualTimeEnd, setManualTimeEnd] = useState(refItem.endTime);
    const [manualLocationId, setManualLocationId] = useState(refItem.locationId);
    const [loading, setLoading] = useState(false);

    // Flatten locations for selector
    const allLocations = useMemo(() => {
        const locs: {id: string, name: string, color: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name, color: l.color})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleAction = async (strategy: 'lost' | 'recover_auto' | 'recover_manual') => {
        if (strategy === 'recover_manual') {
            const loc = allLocations.find(l => l.id === manualLocationId);
            if (!loc) return alert("Seleziona una sede valida.");
            setLoading(true);
            await onConfirm(strategy, {
                date: manualDate,
                startTime: manualTimeStart,
                endTime: manualTimeEnd,
                locationId: loc.id,
                locationName: loc.name,
                locationColor: loc.color
            });
        } else {
            setLoading(true);
            await onConfirm(strategy);
        }
        setLoading(false);
    };

    const isSingle = items.length === 1;
    const title = isSingle ? `Gestione Assenza: ${items[0].childName}` : `Gestione Assenza di Gruppo (${items.length})`;

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                        <p className="text-sm text-slate-500 font-medium">
                            {new Date(refItem.date).toLocaleDateString()} • {refItem.startTime}
                        </p>
                    </div>
                    <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black uppercase">
                        {isSingle ? 'Assente' : 'Tutti Assenti'}
                    </div>
                </div>

                {step === 'choice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">Come vuoi gestire questa assenza {!isSingle && 'massiva'} a livello economico e didattico?</p>
                        
                        <button onClick={() => handleAction('lost')} disabled={loading} className="w-full p-4 border-2 border-red-100 bg-red-50 hover:bg-red-100 rounded-xl text-left transition-all group relative overflow-hidden">
                            <div className="relative z-10">
                                <h4 className="font-bold text-red-800 text-sm uppercase mb-1">🚫 Assenza Persa (No Recupero)</h4>
                                <p className="text-xs text-red-600 leading-snug">
                                    {isSingle ? "Lo slot viene bruciato." : "Gli slot vengono bruciati."} Il credito lezione viene scalato dal pacchetto.
                                </p>
                            </div>
                        </button>

                        <button onClick={() => handleAction('recover_auto')} disabled={loading} className="w-full p-4 border-2 border-amber-100 bg-amber-50 hover:bg-amber-100 rounded-xl text-left transition-all group">
                            <h4 className="font-bold text-amber-800 text-sm uppercase mb-1">⚡ Recupero Automatico</h4>
                            <p className="text-xs text-amber-700 leading-snug">
                                {isSingle ? "Lo slot slitta" : "Gli slot slittano"} alla prossima settimana (stessa ora/sede). Credito preservato.
                            </p>
                        </button>

                        <button onClick={() => setStep('manual')} disabled={loading} className="w-full p-4 border-2 border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-300 rounded-xl text-left transition-all group">
                            <h4 className="font-bold text-slate-800 text-sm uppercase mb-1">📅 Recupero Manuale</h4>
                            <p className="text-xs text-slate-500 leading-snug">Scegli tu la data, l'orario e la sede del recupero {isSingle ? "" : "per l'intero gruppo"}. Credito preservato.</p>
                        </button>
                    </div>
                )}

                {step === 'manual' && (
                    <div className="space-y-4 animate-slide-up">
                        <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-800 mb-4">
                            Stai riprogrammando {isSingle ? "la lezione" : `le ${items.length} lezioni`}. Il credito non verrà scalato oggi.
                        </div>
                        <div className="md-input-group">
                            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="md-input" />
                            <label className="md-input-label !top-0">Data Recupero</label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="md-input-group"><input type="time" value={manualTimeStart} onChange={e => setManualTimeStart(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Inizio</label></div>
                            <div className="md-input-group"><input type="time" value={manualTimeEnd} onChange={e => setManualTimeEnd(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Fine</label></div>
                        </div>
                        <div className="md-input-group">
                            <select value={manualLocationId} onChange={e => setManualLocationId(e.target.value)} className="md-input">
                                {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            <label className="md-input-label !top-0">Sede</label>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setStep('choice')} className="md-btn md-btn-flat flex-1">Indietro</button>
                            <button onClick={() => handleAction('recover_manual')} disabled={loading} className="md-btn md-btn-raised md-btn-primary flex-1">Conferma Recupero</button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const Attendance: React.FC<AttendanceProps> = ({ initialParams }) => {
    const [loading, setLoading] = useState(true);
    const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    
    // Filters
    const [filterLocation, setFilterLocation] = useState('');
    
    // UI state per menu "Gestisci" aperto
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Wizard State (Array for bulk)
    const [wizardItems, setWizardItems] = useState<AttendanceItem[]>([]);

    // Initial Params Effect
    useEffect(() => {
        if (initialParams?.date) {
            const d = new Date(initialParams.date);
            if (!isNaN(d.getTime())) {
                setCurrentDate(d);
                setViewMode('day');
            }
        }
    }, [initialParams]);

    const fetchAttendanceData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, suppliersData] = await Promise.all([
                getAllEnrollments(),
                getSuppliers()
            ]);
            
            setSuppliers(suppliersData);

            const items: AttendanceItem[] = [];
            
            // Calcola Range Date
            let start = new Date(currentDate);
            let end = new Date(currentDate);
            
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);

            if (viewMode === 'week') {
                start = getStartOfWeek(currentDate);
                start.setHours(0,0,0,0);
                end = getEndOfWeek(currentDate);
                end.setHours(23,59,59,999);
            } else if (viewMode === 'month') {
                start = getStartOfMonth(currentDate);
                end = getEndOfMonth(currentDate);
                end.setHours(23,59,59,999);
            }

            enrollments.forEach((enr: Enrollment) => {
                // Consideriamo solo iscrizioni attive o in attesa (che occupano il posto)
                if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
                    if (enr.appointments) {
                        enr.appointments.forEach((app: Appointment) => {
                            const appDate = new Date(app.date);
                            // Filtra per range
                            if (appDate >= start && appDate <= end) {
                                items.push({
                                    ...app,
                                    enrollmentId: enr.id,
                                    childName: enr.childName,
                                    subscriptionName: enr.subscriptionName,
                                    lessonsRemaining: enr.lessonsRemaining
                                });
                            }
                        });
                    }
                }
            });

            setAttendanceItems(items);
        } catch (err) {
            console.error("Errore caricamento presenze:", err);
        } finally {
            setLoading(false);
        }
    }, [currentDate, viewMode]);

    useEffect(() => { fetchAttendanceData(); }, [fetchAttendanceData]); 

    // Grouping Logic: Location -> Date -> Time -> Items
    const groupedData = useMemo(() => {
        // Location -> DateString -> Items
        const locationGroups: Record<string, Record<string, AttendanceItem[]>> = {}; 
        
        attendanceItems.forEach(item => {
            const loc = item.locationName || 'Sede Non Definita';
            const dateKey = new Date(item.date).toDateString(); // Group by day

            if (!locationGroups[loc]) locationGroups[loc] = {};
            if (!locationGroups[loc][dateKey]) locationGroups[loc][dateKey] = [];
            
            locationGroups[loc][dateKey].push(item);
        });
        
        // Sort items inside groups by time
        Object.keys(locationGroups).forEach(loc => {
            Object.keys(locationGroups[loc]).forEach(date => {
                locationGroups[loc][date].sort((a,b) => a.startTime.localeCompare(b.startTime));
            });
        });

        return locationGroups;
    }, [attendanceItems]);

    // Extract available locations for filter
    const availableLocations = useMemo(() => {
        const locs = new Set<string>();
        suppliers.forEach(s => s.locations.forEach(l => locs.add(l.name)));
        return Array.from(locs).sort();
    }, [suppliers]);

    const handleNavigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'day') newDate.setDate(newDate.getDate() + direction);
        else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (direction * 7));
        else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const getRangeLabel = () => {
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        if (viewMode === 'day') return currentDate.toLocaleDateString('it-IT', { weekday: 'long', ...options });
        if (viewMode === 'week') {
            const start = getStartOfWeek(currentDate);
            const end = getEndOfWeek(currentDate);
            return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    };

    // --- Individual Actions ---
    const handleMarkPresence = async (item: AttendanceItem) => {
        try {
            setLoading(true);
            await registerPresence(item.enrollmentId, item.lessonId);
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (err) {
            console.error(err);
            alert("Errore segnando la presenza.");
            setLoading(false);
        }
    };

    const handleMarkAbsence = (item: AttendanceItem) => {
        setWizardItems([item]);
    };

    // --- Bulk Slot Actions ---
    const handleBulkSlotPresence = async (slotItems: AttendanceItem[]) => {
        // Filter out those already present
        const targets = slotItems.filter(i => i.status !== 'Present');
        if (targets.length === 0) return;

        try {
            setLoading(true);
            for(const item of targets) {
                await registerPresence(item.enrollmentId, item.lessonId);
            }
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(e) {
            console.error(e);
            alert("Errore aggiornamento massivo.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkSlotAbsence = (slotItems: AttendanceItem[]) => {
        // Filter out those already absent? No, allow re-managing
        setWizardItems(slotItems);
    };

    const handleWizardConfirm = async (strategy: 'lost' | 'recover_auto' | 'recover_manual', details?: any) => {
        if (wizardItems.length === 0) return;
        try {
            // Se recover_manual, usiamo i dettagli per TUTTI gli item (es. spostamento classe intera)
            // Se recover_auto, ognuno calcola il suo prossimo slot.
            for (const item of wizardItems) {
                await registerAbsence(item.enrollmentId, item.lessonId, strategy, details);
            }
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            setWizardItems([]);
        } catch (e) {
            console.error(e);
            alert("Errore durante l'elaborazione dell'assenza.");
        }
    };

    // --- CRUD Handlers ---
    const toggleMenu = (lessonId: string) => {
        setOpenMenuId(prev => prev === lessonId ? null : lessonId);
    };

    const handleModify = (item: AttendanceItem) => {
        setOpenMenuId(null);
        setWizardItems([item]);
    };

    const handleDelete = async (item: AttendanceItem) => {
        setOpenMenuId(null);
        if(!confirm("ELIMINARE questa presenza? L'operazione cancellerà questa lezione specifica, restituirà il credito (slot) all'allievo e aggiornerà i conteggi di nolo/fatturazione. Confermi?")) return;
        
        try {
            setLoading(true);
            await deleteAppointment(item.enrollmentId, item.lessonId);
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            alert("Errore durante l'eliminazione.");
            setLoading(false);
        }
    };

    // --- Global Bulk Actions (Page Level) ---
    const handleGlobalBulkMarkPresent = async () => {
        if (!confirm("Segnare TUTTI gli studenti visualizzati come PRESENTI?")) return;
        setLoading(true);
        try {
            const targets = attendanceItems.filter(i => i.status !== 'Present');
            for (const item of targets) {
                await registerPresence(item.enrollmentId, item.lessonId);
            }
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(e) {
            alert("Errore durante l'aggiornamento massivo.");
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalBulkMarkAbsent = async () => {
        if (!confirm("Segnare TUTTI gli studenti visualizzati come ASSENTI con RECUPERO automatico?")) return;
        setLoading(true);
        try {
            const targets = attendanceItems.filter(i => i.status !== 'Absent');
            for (const item of targets) {
                await registerAbsence(item.enrollmentId, item.lessonId, 'recover_auto'); 
            }
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(e) {
            alert("Errore durante l'aggiornamento massivo.");
        } finally {
            setLoading(false);
        }
    };

    // Helper: Raggruppamento per Orario (all'interno di Location/Date)
    const groupItemsByTime = (items: AttendanceItem[]) => {
        const groups: Record<string, AttendanceItem[]> = {};
        items.forEach(item => {
            const key = `${item.startTime} - ${item.endTime}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    };

    return (
        <div onClick={() => setOpenMenuId(null)}> {/* Chiude menu al click fuori */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Registro Presenze</h1>
                    <p className="text-gray-500">Gestione presenze e recuperi.</p>
                </div>
                
                {/* TOOLBAR SCORREVOLE SU MOBILE */}
                <div className="w-full md:w-auto flex gap-2 items-center overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {/* Bulk Actions Globali */}
                    <button onClick={handleGlobalBulkMarkPresent} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap flex-shrink-0">
                        ✓ Tutti Presenti
                    </button>
                    <button onClick={handleGlobalBulkMarkAbsent} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 whitespace-nowrap flex-shrink-0">
                        ✕ Tutti Assenti
                    </button>

                    {/* View Toggles */}
                    <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm ml-2 flex-shrink-0">
                        <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Giorno</button>
                        <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Settimana</button>
                        <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Mese</button>
                    </div>
                </div>
            </div>

            {/* Navigazione Calendario + Filtro Sede */}
            <div className="md-card p-4 mb-6 bg-white border-l-4 border-indigo-500 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                
                <div className="w-full md:w-auto md:flex-1 flex items-center justify-between md:justify-center gap-4 order-1">
                    <button onClick={() => handleNavigate(-1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors flex-shrink-0">&lt;</button>
                    
                    <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2">
                            <CalendarIcon />
                            <span className="block text-lg font-bold text-gray-800 capitalize text-center leading-tight">{getRangeLabel()}</span>
                        </div>
                        {viewMode === 'day' && <span className="text-xs text-gray-400 font-medium mt-1">Oggi</span>}
                    </div>

                    <button onClick={() => handleNavigate(1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors flex-shrink-0">&gt;</button>
                </div>

                <div className="w-full md:w-auto order-2">
                    <select 
                        value={filterLocation} 
                        onChange={(e) => setFilterLocation(e.target.value)} 
                        className="w-full md:w-64 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl px-4 py-2 border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                    >
                        <option value="">Tutte le Sedi</option>
                        {availableLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-8 animate-fade-in">
                    {Object.keys(groupedData).length === 0 && <div className="text-center py-12 text-gray-500 italic bg-gray-50 rounded-xl border border-dashed border-gray-300">Nessuna lezione in programma nel periodo selezionato.</div>}
                    
                    {Object.entries(groupedData).map(([locationName, datesMap]) => {
                        // FILTER: Skip this group if filter is active and doesn't match
                        if (filterLocation && locationName !== filterLocation) return null;

                        // Ordina le date
                        const sortedDates = Object.keys(datesMap).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
                        const firstItem = datesMap[sortedDates[0]][0];

                        // LOGICA CONTEGGIO LEZIONI (Non studenti)
                        const totalLessonsCount = Object.values(datesMap).reduce((acc, itemsOnDate) => {
                            const uniqueTimes = new Set(itemsOnDate.map(i => i.startTime));
                            return acc + uniqueTimes.size;
                        }, 0);

                        return (
                        <div key={locationName} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                            {/* RECINTO HEADER (LOCATION) */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors rounded-t-xl">
                                <span className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: firstItem?.locationColor || '#ccc' }}></span>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locationName}</h2>
                                <span className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                                    {totalLessonsCount} lez.
                                </span>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {sortedDates.map(dateKey => {
                                    // GROUP BY TIME SLOT INSIDE DATE
                                    const timeGroups = groupItemsByTime(datesMap[dateKey]);
                                    const sortedTimeKeys = Object.keys(timeGroups).sort();

                                    return (
                                    <div key={dateKey} className="p-4 md:p-6 bg-white">
                                        {/* Date Header (Se non è Daily View) */}
                                        {viewMode !== 'day' && (
                                            <div className="mb-4 pb-2 border-b border-indigo-50 flex items-center">
                                                <CalendarIcon /> <span className="ml-2 text-sm font-bold text-indigo-900 uppercase">{new Date(dateKey).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long'})}</span>
                                            </div>
                                        )}

                                        <div className="space-y-6">
                                            {sortedTimeKeys.map(timeKey => {
                                                const slotItems = timeGroups[timeKey];
                                                
                                                return (
                                                    <div key={timeKey} className="border border-indigo-100 rounded-xl mb-4 shadow-sm">
                                                        
                                                        {/* TIME SLOT HEADER (With Bulk Actions) - Updated rounded-t-xl */}
                                                        <div className="bg-indigo-50/70 px-4 py-2 flex flex-wrap justify-between items-center gap-2 border-b border-indigo-100 rounded-t-xl">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded shadow-sm border border-indigo-100">
                                                                    <span className="font-mono">{timeKey}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                    {slotItems.length} Allievi
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => handleBulkSlotPresence(slotItems)}
                                                                    className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors border border-green-200"
                                                                    title="Segna tutti presenti in questo slot"
                                                                >
                                                                    <span className="text-sm">✓</span> Tutti Pres.
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleBulkSlotAbsence(slotItems)}
                                                                    className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors border border-red-200"
                                                                    title="Segna tutti assenti in questo slot"
                                                                >
                                                                    <XIcon /> Tutti Ass.
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* STUDENTS LIST */}
                                                        <div className="divide-y divide-gray-50 bg-white">
                                                            {slotItems.map(item => {
                                                                const isPresent = item.status === 'Present';
                                                                const isAbsent = item.status === 'Absent';
                                                                const isMenuOpen = openMenuId === item.lessonId;

                                                                return (
                                                                    <div key={item.lessonId} className={`px-4 py-3 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all ${isAbsent ? 'bg-red-50/10' : isPresent ? 'bg-green-50/10' : ''}`}>
                                                                        
                                                                        <div className="flex-1 mb-2 md:mb-0">
                                                                            <div className="flex items-center gap-3">
                                                                                <h3 className="font-bold text-gray-900 text-sm">{item.childName}</h3>
                                                                                {(isPresent || isAbsent) && (
                                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                                        {isPresent ? 'Presente' : 'Assente'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 mt-0.5 ml-0.5">
                                                                                <span className="text-[10px] text-gray-400 truncate max-w-[150px]">{item.subscriptionName}</span>
                                                                                <span className="text-[10px] text-gray-300">•</span>
                                                                                <span className="text-[10px] text-gray-500">Residui: <strong>{item.lessonsRemaining}</strong></span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2 justify-end">
                                                                            {isPresent || isAbsent ? (
                                                                                <div className="relative">
                                                                                    <button 
                                                                                        onClick={(e) => { e.stopPropagation(); toggleMenu(item.lessonId); }} 
                                                                                        className="md-btn md-btn-sm bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-1 text-xs"
                                                                                    >
                                                                                        Opzioni <ChevronDownIcon />
                                                                                    </button>
                                                                                    {isMenuOpen && (
                                                                                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-fade-in-down origin-top-right overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                                                                            <button onClick={() => handleModify(item)} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 font-bold flex items-center gap-2">
                                                                                                <PencilIcon /> Modifica Stato
                                                                                            </button>
                                                                                            <button onClick={() => handleDelete(item)} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-bold border-t border-gray-100 flex items-center gap-2">
                                                                                                <TrashIcon /> Elimina
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex gap-2">
                                                                                    <button onClick={() => handleMarkPresence(item)} className="px-3 py-1.5 bg-white border border-green-500 text-green-600 rounded-lg text-xs font-bold hover:bg-green-50 shadow-sm transition-all">
                                                                                        ✓ Presente
                                                                                    </button>
                                                                                    <button onClick={() => handleMarkAbsence(item)} className="px-3 py-1.5 bg-white border border-red-300 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 shadow-sm transition-all">
                                                                                        ✕ Assente
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {wizardItems.length > 0 && (
                <AbsenceWizardModal 
                    items={wizardItems}
                    suppliers={suppliers}
                    onClose={() => setWizardItems([])}
                    onConfirm={handleWizardConfirm}
                />
            )}
        </div>
    );
};

export default Attendance;
