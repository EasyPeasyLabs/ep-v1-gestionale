
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Appointment, Enrollment, EnrollmentStatus } from '../types';
import { getAllEnrollments, registerAbsence, registerPresence } from '../services/enrollmentService';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';

// Interfaccia estesa per visualizzare le lezioni nella lista presenze
interface AttendanceItem extends Appointment {
    enrollmentId: string;
    childName: string;
    subscriptionName: string;
    lessonsRemaining: number;
}

const Attendance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
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
            const enrollments = await getAllEnrollments();
            const items: AttendanceItem[] = [];
            
            enrollments.forEach((enr: Enrollment) => {
                // Consideriamo solo iscrizioni attive o in attesa (che occupano il posto)
                if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
                    if (enr.appointments) {
                        enr.appointments.forEach((app: Appointment) => {
                            // Filtra per la data selezionata
                            if (app.date.startsWith(selectedDate)) {
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
    }, [selectedDate]);

    useEffect(() => { fetchAttendanceData(); }, [fetchAttendanceData]); 

    // Grouping Logic: Location -> Items
    const groupedItems = useMemo(() => {
        const groups: Record<string, AttendanceItem[]> = {};
        attendanceItems.forEach(item => {
            const loc = item.locationName || 'Sede Non Definita';
            if (!groups[loc]) groups[loc] = [];
            groups[loc].push(item);
        });
        
        // Sort items inside groups by time
        Object.keys(groups).forEach(key => {
            groups[key].sort((a,b) => a.startTime.localeCompare(b.startTime));
        });

        return groups;
    }, [attendanceItems]);

    const handleDateChange = (offset: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + offset);
        setSelectedDate(date.toISOString().split('T')[0]);
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

    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">Registro Presenze</h1>
            <p className="mt-1 mb-6" style={{color: 'var(--md-text-secondary)'}}>
                Gestione giornaliera suddivisa per Recinto (Sede).
            </p>

            {/* Navigazione Data */}
            <div className="md-card p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => handleDateChange(-1)} className="md-btn md-btn-flat text-2xl font-bold">&lt;</button>
                    <div className="text-center">
                         <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-lg font-bold bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-center"/>
                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long' })}</div>
                    </div>
                    <button onClick={() => handleDateChange(1)} className="md-btn md-btn-flat text-2xl font-bold">&gt;</button>
                </div>
                <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="text-sm text-indigo-600 font-medium hover:underline">Torna a Oggi</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-8">
                    {Object.keys(groupedItems).length === 0 && <div className="text-center py-12 text-gray-500 italic">Nessuna lezione in programma oggi.</div>}
                    
                    {Object.entries(groupedItems).map(([locationName, items]) => {
                        const typedItems = items as AttendanceItem[];
                        return (
                        <div key={locationName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: typedItems[0]?.locationColor || '#ccc' }}></span>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locationName}</h2>
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{typedItems.length} allievi</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {typedItems.map(item => {
                                    const isPresent = item.status === 'Present';
                                    const isAbsent = item.status === 'Absent';
                                    return (
                                        <div key={item.lessonId} className={`p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors ${isAbsent ? 'bg-red-50' : isPresent ? 'bg-green-50' : ''}`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold text-sm text-gray-600">{item.startTime} - {item.endTime}</span>
                                                    <h3 className="font-bold text-gray-900">{item.childName}</h3>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 ml-14">
                                                    Slot residui: <strong>{item.lessonsRemaining}</strong>
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-3 md:mt-0 ml-14 md:ml-0">
                                                {isPresent ? (
                                                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full border border-green-200">PRESENTE (Slot Consumato)</span>
                                                ) : isAbsent ? (
                                                    <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">ASSENTE</span>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleMarkPresence(item)} className="px-3 py-1.5 bg-white border border-green-500 text-green-600 rounded text-xs font-bold hover:bg-green-50 transition-colors">
                                                            ✓ Presente
                                                        </button>
                                                        <button onClick={() => handleMarkAbsence(item)} className="px-3 py-1.5 bg-white border border-red-300 text-red-500 rounded text-xs font-medium hover:bg-red-50 transition-colors">
                                                            ✕ Assente
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
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
