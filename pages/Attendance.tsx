
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Enrollment, EnrollmentStatus, Supplier } from '../types';
import { getAllEnrollments, registerAbsence, registerPresence, resetAppointmentStatus, toggleAppointmentStatus, deleteAppointment } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
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

// Helpers Date
const getStartOfWeek = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); };
const getEndOfWeek = (d: Date) => { const date = getStartOfWeek(d); date.setDate(date.getDate() + 6); return date; };
const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const Attendance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    
    // Filters
    const [filterLocation, setFilterLocation] = useState('');
    
    // UI state per menu "Gestisci" aperto
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Modal State per conferma assenza
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDangerous: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        isDangerous: false
    });

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
        setConfirmState({
            isOpen: true,
            title: "Assenza & Recupero",
            message: `Il bambino ${item.childName} è assente. Vuoi riprogrammare lo slot per il futuro? Se annulli, l'assenza viene registrata ma lo slot non viene automaticamente riprogrammato.`,
            isDangerous: false,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await registerAbsence(item.enrollmentId, item.lessonId, true); // True = Reschedule logic
                    await fetchAttendanceData();
                    window.dispatchEvent(new Event('EP_DataUpdated'));
                } catch (err) {
                    console.error("Errore assenza:", err);
                    alert("Errore.");
                    setLoading(false);
                }
            }
        });
    };

    // --- CRUD Handlers ---
    const toggleMenu = (lessonId: string) => {
        setOpenMenuId(prev => prev === lessonId ? null : lessonId);
    };

    const handleModify = async (item: AttendanceItem) => {
        // Toggle Logic: Present -> Absent, Absent -> Present
        // Chiude il menu
        setOpenMenuId(null);
        try {
            setLoading(true);
            await toggleAppointmentStatus(item.enrollmentId, item.lessonId);
            await fetchAttendanceData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            alert("Errore modifica stato.");
            setLoading(false);
        }
    };

    const handleDelete = async (item: AttendanceItem) => {
        setOpenMenuId(null);
        if(!confirm("ELIMINARE questa presenza? L'operazione cancellerà questa lezione specifica, restituirà il credito (slot) all'allievo e aggiornerà i conteggi di nolo/fatturazione. Confermi?")) return;
        
        try {
            setLoading(true);
            // New Service Call
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
                await registerAbsence(item.enrollmentId, item.lessonId, true); 
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

            {/* Navigazione Calendario + Filtro Sede */}
            <div className="md-card p-4 mb-6 flex items-center justify-between bg-white border-l-4 border-indigo-500 shadow-sm">
                <button onClick={() => handleNavigate(-1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors">&lt;</button>
                
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
                        <CalendarIcon />
                        <div className="text-center">
                            <span className="block text-lg font-bold text-gray-800 capitalize">{getRangeLabel()}</span>
                            {viewMode === 'day' && <span className="text-xs text-gray-400 font-medium">Oggi</span>}
                        </div>
                    </div>
                    {/* Location Filter */}
                    <div className="mt-1">
                        <select 
                            value={filterLocation} 
                            onChange={(e) => setFilterLocation(e.target.value)} 
                            className="bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full px-3 py-1 border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                        >
                            <option value="">Tutte le Sedi</option>
                            {availableLocations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button onClick={() => handleNavigate(1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors">&gt;</button>
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

                        return (
                        <div key={locationName} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                            {/* RECINTO HEADER */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors rounded-t-xl">
                                <span className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: firstItem?.locationColor || '#ccc' }}></span>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locationName}</h2>
                                <span className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                                    {Object.values(datesMap).reduce((acc, curr) => acc + curr.length, 0)} lez.
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
                                                <div key={item.lessonId} className={`px-6 py-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-all border-l-4 ${isAbsent ? 'border-l-red-400 bg-red-50/30' : isPresent ? 'border-l-green-400 bg-green-50/30' : 'border-l-transparent'}`}>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono font-bold text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">{item.startTime} - {item.endTime}</span>
                                                            <h3 className="font-bold text-gray-900 text-base">{item.childName}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 ml-1">
                                                            <span className="text-xs text-gray-500">{item.subscriptionName}</span>
                                                            <span className="text-[10px] text-gray-400">•</span>
                                                            <span className="text-xs text-gray-500">Slot residui: <strong>{item.lessonsRemaining}</strong></span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 mt-3 md:mt-0 md:ml-4 relative">
                                                        {isPresent || isAbsent ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm flex items-center gap-1 min-w-[90px] justify-center ${isPresent ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                                                    {isPresent ? '✓ PRESENTE' : '✕ ASSENTE'}
                                                                </span>
                                                                
                                                                {/* CRUD Dropdown Trigger */}
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); toggleMenu(item.lessonId); }} 
                                                                    className="md-btn md-btn-sm bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                                                                >
                                                                    Gestisci <ChevronDownIcon />
                                                                </button>

                                                                {/* CRUD Dropdown Menu */}
                                                                {isMenuOpen && (
                                                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="py-1">
                                                                            <button 
                                                                                onClick={() => handleModify(item)}
                                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <PencilIcon /> Modifica
                                                                                </div>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => setOpenMenuId(null)}
                                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="w-5 text-center font-bold">✕</span> Annulla
                                                                                </div>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDelete(item)}
                                                                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold border-t border-gray-100"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <TrashIcon /> Elimina
                                                                                </div>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleMarkPresence(item)} className="px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg text-xs font-bold hover:bg-green-50 hover:shadow-md transition-all active:scale-95">
                                                                    ✓ Presente
                                                                </button>
                                                                <button onClick={() => handleMarkAbsence(item)} className="px-4 py-2 bg-white border border-red-300 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 hover:shadow-md transition-all active:scale-95">
                                                                    ✕ Assente
                                                                </button>
                                                            </>
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

            <ConfirmModal 
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                isDangerous={confirmState.isDangerous}
                confirmText="Sì, recupera slot"
                cancelText="Solo Assenza"
            />
        </div>
    );
};

export default Attendance;
