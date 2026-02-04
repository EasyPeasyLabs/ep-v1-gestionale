
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

// --- ABSENCE WIZARD MODAL ---
const AbsenceWizardModal: React.FC<{
    item: AttendanceItem;
    suppliers: Supplier[];
    onClose: () => void;
    onConfirm: (strategy: 'lost' | 'recover_auto' | 'recover_manual', details?: any) => Promise<void>;
}> = ({ item, suppliers, onClose, onConfirm }) => {
    const [step, setStep] = useState<'choice' | 'manual'>('choice');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualTimeStart, setManualTimeStart] = useState(item.startTime);
    const [manualTimeEnd, setManualTimeEnd] = useState(item.endTime);
    const [manualLocationId, setManualLocationId] = useState(item.locationId);
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

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Gestione Assenza</h3>
                        <p className="text-sm text-slate-500 font-medium">{item.childName} • {new Date(item.date).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black uppercase">Assente</div>
                </div>

                {step === 'choice' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">Come vuoi gestire questa assenza a livello economico e didattico?</p>
                        
                        <button onClick={() => handleAction('lost')} disabled={loading} className="w-full p-4 border-2 border-red-100 bg-red-50 hover:bg-red-100 rounded-xl text-left transition-all group relative overflow-hidden">
                            <div className="relative z-10">
                                <h4 className="font-bold text-red-800 text-sm uppercase mb-1">🚫 Assenza Persa (No Recupero)</h4>
                                <p className="text-xs text-red-600 leading-snug">Lo slot viene bruciato. Il credito lezione viene scalato dal pacchetto.</p>
                            </div>
                        </button>

                        <button onClick={() => handleAction('recover_auto')} disabled={loading} className="w-full p-4 border-2 border-amber-100 bg-amber-50 hover:bg-amber-100 rounded-xl text-left transition-all group">
                            <h4 className="font-bold text-amber-800 text-sm uppercase mb-1">⚡ Recupero Automatico</h4>
                            <p className="text-xs text-amber-700 leading-snug">Lo slot slitta alla prossima settimana (stessa ora/sede). Credito preservato.</p>
                        </button>

                        <button onClick={() => setStep('manual')} disabled={loading} className="w-full p-4 border-2 border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-300 rounded-xl text-left transition-all group">
                            <h4 className="font-bold text-slate-800 text-sm uppercase mb-1">📅 Recupero Manuale</h4>
                            <p className="text-xs text-slate-500 leading-snug">Scegli tu la data, l'orario e la sede del recupero. Credito preservato.</p>
                        </button>
                    </div>
                )}

                {step === 'manual' && (
                    <div className="space-y-4 animate-slide-up">
                        <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-800 mb-4">
                            Stai riprogrammando la lezione. Il credito non verrà scalato oggi.
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

    // Wizard State
    const [wizardItem, setWizardItem] = useState<AttendanceItem | null>(null);

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

    // Grouping Logic: Location -> Date (if not daily) -> Items
    const groupedData = useMemo(() => {
        const locationGroups: Record<string, Record<string, AttendanceItem[]>> = {}; // Location -> DateString -> Items
        
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
        setWizardItem(item);
    };

    const handleWizardConfirm = async (strategy: 'lost' | 'recover_auto' | 'recover_manual', details?: any) => {
        if (!wizardItem) return;
        try {
            await registerAbsence(wizardItem.enrollmentId, wizardItem.lessonId, strategy, details);
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            setWizardItem(null);
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
        // Invece di un semplice toggle, apriamo il Wizard Assenze
        // Questo permette di scegliere tra "Persa" e "Recupero" anche partendo da "Presente"
        setWizardItem(item);
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

    // --- Bulk Actions ---
    const handleBulkMarkPresent = async () => {
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

    const handleBulkMarkAbsent = async () => {
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

    return (
        <div onClick={() => setOpenMenuId(null)}> {/* Chiude menu al click fuori */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Registro Presenze</h1>
                    <p className="text-gray-500">Gestione presenze e recuperi.</p>
                </div>
                
                {/* TOOLBAR SCORREVOLE SU MOBILE */}
                <div className="w-full md:w-auto flex gap-2 items-center overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {/* Bulk Actions */}
                    <button onClick={handleBulkMarkPresent} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 whitespace-nowrap flex-shrink-0">
                        ✓ Tutti Presenti
                    </button>
                    <button onClick={handleBulkMarkAbsent} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 whitespace-nowrap flex-shrink-0">
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

            {/* Navigazione Calendario + Filtro Sede - RESPONSIVE REFACTOR */}
            <div className="md-card p-4 mb-6 bg-white border-l-4 border-indigo-500 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* 1. Navigation Group: Date & Buttons (Full width on mobile, auto on desktop) */}
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

                {/* 2. Filter Group: Location Selector (Full width on mobile, auto on desktop) */}
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
                            // Conta gli slot unici (startTime) per ogni giornata
                            const uniqueTimes = new Set(itemsOnDate.map(i => i.startTime));
                            return acc + uniqueTimes.size;
                        }, 0);

                        return (
                        <div key={locationName} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                            {/* RECINTO HEADER */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors rounded-t-xl">
                                <span className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: firstItem?.locationColor || '#ccc' }}></span>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locationName}</h2>
                                <span className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                                    {totalLessonsCount} lez.
                                </span>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {sortedDates.map(dateKey => (
                                    <div key={dateKey}>
                                        {/* Date Header (Se non è Daily View) */}
                                        {viewMode !== 'day' && (
                                            <div className="px-6 py-2 bg-indigo-50/50 text-xs font-bold text-indigo-800 uppercase border-b border-indigo-100/50 flex items-center">
                                                <CalendarIcon /> <span className="ml-2">{new Date(dateKey).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long'})}</span>
                                            </div>
                                        )}

                                        {datesMap[dateKey].map(item => {
                                            const isPresent = item.status === 'Present';
                                            const isAbsent = item.status === 'Absent';
                                            
                                            // Check se il menu è aperto per questo item
                                            const isMenuOpen = openMenuId === item.lessonId;

                                            return (
                                                <div key={item.lessonId} className={`px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all border-l-4 ${isAbsent ? 'border-l-red-400 bg-red-50/20' : isPresent ? 'border-l-green-400 bg-green-50/20' : 'border-l-transparent'}`}>
                                                    
                                                    {/* LEFT: Info Studente (Responsive) */}
                                                    <div className="flex-1 mb-3 md:mb-0">
                                                        <div className="flex items-center justify-between md:justify-start gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">{item.startTime} - {item.endTime}</span>
                                                                <h3 className="font-bold text-gray-900 text-base md:text-lg">{item.childName}</h3>
                                                            </div>
                                                            {/* Mobile-only status badge small */}
                                                            {(isPresent || isAbsent) && (
                                                                <span className={`md:hidden px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                    {isPresent ? 'Pres' : 'Ass'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 ml-1">
                                                            <span className="text-xs text-gray-500 truncate max-w-[150px] md:max-w-none">{item.subscriptionName}</span>
                                                            <span className="text-[10px] text-gray-400">•</span>
                                                            <span className="text-xs text-gray-500">Slot residui: <strong>{item.lessonsRemaining}</strong></span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* RIGHT: Actions */}
                                                    <div className="flex items-center gap-2 md:ml-4 relative justify-end">
                                                        {isPresent || isAbsent ? (
                                                            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                                <span className={`hidden md:flex px-3 py-1 text-xs font-bold rounded-full border shadow-sm items-center gap-1 min-w-[90px] justify-center ${isPresent ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                                                    {isPresent ? '✓ PRESENTE' : '✕ ASSENTE'}
                                                                </span>
                                                                
                                                                {/* CRUD Dropdown Trigger */}
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); toggleMenu(item.lessonId); }} 
                                                                    className="md-btn md-btn-sm bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1 w-full md:w-auto justify-center"
                                                                >
                                                                    Gestisci <ChevronDownIcon />
                                                                </button>

                                                                {/* CRUD Dropdown Menu */}
                                                                {isMenuOpen && (
                                                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 animate-fade-in-down origin-top-right" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="py-1">
                                                                            <button 
                                                                                onClick={() => handleModify(item)}
                                                                                className="block w-full text-left px-4 py-3 md:py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <PencilIcon /> Modifica Stato
                                                                                </div>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDelete(item)}
                                                                                className="block w-full text-left px-4 py-3 md:py-2 text-sm text-red-600 hover:bg-red-50 font-bold border-t border-gray-100"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <TrashIcon /> Elimina Slot
                                                                                </div>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => setOpenMenuId(null)}
                                                                                className="block w-full text-left px-4 py-3 md:py-2 text-sm text-gray-400 hover:bg-gray-50 border-t border-gray-100 md:hidden"
                                                                            >
                                                                                Annulla
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2 w-full md:w-auto">
                                                                <button onClick={() => handleMarkPresence(item)} className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-white border border-green-500 text-green-600 rounded-xl md:rounded-lg text-sm md:text-xs font-bold hover:bg-green-50 hover:shadow-md transition-all active:scale-95 shadow-sm">
                                                                    ✓ Presente
                                                                </button>
                                                                <button onClick={() => handleMarkAbsence(item)} className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-white border border-red-300 text-red-500 rounded-xl md:rounded-lg text-sm md:text-xs font-medium hover:bg-red-50 hover:shadow-md transition-all active:scale-95 shadow-sm">
                                                                    ✕ Assente
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {wizardItem && (
                <AbsenceWizardModal 
                    item={wizardItem}
                    suppliers={suppliers}
                    onClose={() => setWizardItem(null)}
                    onConfirm={handleWizardConfirm}
                />
            )}
        </div>
    );
};

export default Attendance;
