
import React, { useState, useEffect, useCallback } from 'react';
import { Appointment, Enrollment, EnrollmentStatus } from '../types';
import { getAllEnrollments, registerAbsence, consolidateAppointments } from '../services/enrollmentService';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
import CheckCircleIcon from '../components/icons/ChecklistIcon'; // Riutilizziamo un'icona esistente o simile

// Interfaccia estesa per visualizzare le lezioni nella lista presenze
interface AttendanceItem extends Appointment {
    enrollmentId: string;
    childName: string;
    subscriptionName: string;
}

const Attendance: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [attendanceItems, setAttendanceItems] = useState<AttendanceItem[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [consolidating, setConsolidating] = useState(false);
    
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

    // Funzione per consolidare le lezioni passate (Simulazione Backend Automation)
    const handleConsolidation = useCallback(async () => {
        setConsolidating(true);
        try {
            const count = await consolidateAppointments();
            if (count > 0) {
                console.log(`Consolidate ${count} iscrizioni con lezioni passate.`);
                // Emettiamo evento globale per aggiornare le altre viste (es. Dashboard o Iscrizioni)
                window.dispatchEvent(new Event('EP_DataUpdated'));
            }
        } catch (e) {
            console.error("Errore consolidamento automatico:", e);
        } finally {
            setConsolidating(false);
        }
    }, []);

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
                                    subscriptionName: enr.subscriptionName
                                });
                            }
                        });
                    }
                }
            });

            // Ordina per orario
            items.sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            setAttendanceItems(items);
        } catch (err) {
            console.error("Errore caricamento presenze:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // All'avvio, eseguiamo prima il consolidamento e poi il fetch
    useEffect(() => {
        const init = async () => {
            await handleConsolidation();
            fetchAttendanceData();
        };
        init();
    }, [handleConsolidation, fetchAttendanceData]); // Dipendenze stabili

    const handleDateChange = (offset: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + offset);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleMarkAbsence = (item: AttendanceItem) => {
        setConfirmState({
            isOpen: true,
            title: "Registra Assenza",
            message: `Il bambino ${item.childName} risulta assente per la lezione delle ${item.startTime}. Vuoi far slittare automaticamente questa lezione alla prima data utile disponibile?`,
            isDangerous: false,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    // true = recupero automatico
                    await registerAbsence(item.enrollmentId, item.lessonId, true); 
                    await fetchAttendanceData();
                    // Anche dopo un'assenza registrata, forziamo un refresh globale
                    window.dispatchEvent(new Event('EP_DataUpdated'));
                } catch (err) {
                    console.error("Errore registrazione assenza:", err);
                    alert("Errore durante la registrazione dell'assenza.");
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Registro Presenze</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                        Gestisci le presenze giornaliere e i recuperi automatici.
                    </p>
                </div>
                <button 
                    onClick={() => { handleConsolidation().then(fetchAttendanceData); }} 
                    disabled={consolidating}
                    className="md-btn md-btn-flat text-sm flex items-center"
                >
                    {consolidating ? <Spinner /> : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Aggiorna Stato Lezioni
                        </>
                    )}
                </button>
            </div>

            {/* Barra di Navigazione Data */}
            <div className="md-card p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => handleDateChange(-1)} className="md-btn md-btn-flat text-2xl font-bold">&lt;</button>
                    <div className="text-center">
                         <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)} 
                            className="text-lg font-bold bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-center"
                        />
                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                            {new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long' })}
                        </div>
                    </div>
                    <button onClick={() => handleDateChange(1)} className="md-btn md-btn-flat text-2xl font-bold">&gt;</button>
                </div>
                <button 
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
                    className="text-sm text-indigo-600 font-medium hover:underline"
                >
                    Torna a Oggi
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
                <div className="md-card p-0 overflow-hidden">
                    {attendanceItems.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            Nessuna lezione in programma per questa data.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orario</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Allievo</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sede / Aula</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stato</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {attendanceItems.map((item, idx) => {
                                        const isAbsent = item.status === 'Absent';
                                        const isPresent = item.status === 'Present';
                                        
                                        // Determina se la lezione è nel passato (quindi teoricamente "svolta")
                                        // Usiamo una comparazione sicura data+ora
                                        const lessonEnd = new Date(`${item.date.split('T')[0]}T${item.endTime}:00`);
                                        const isPast = lessonEnd < new Date();

                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 transition-colors ${isAbsent ? 'bg-red-50' : ''}`}>
                                                <td className="p-4 font-medium whitespace-nowrap">
                                                    {item.startTime} - {item.endTime}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{item.childName}</div>
                                                    <div className="text-xs text-gray-500">{item.subscriptionName}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center">
                                                        <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.locationColor || '#ccc' }}></span>
                                                        <span className="text-sm">{item.locationName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {isAbsent ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            Assente
                                                        </span>
                                                    ) : isPresent ? (
                                                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Presente
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            Programmata
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {!isAbsent && !isPresent && isPast && (
                                                        <span className="text-xs text-amber-600 italic mr-2">In attesa di aggiornamento...</span>
                                                    )}
                                                    {!isAbsent && (
                                                        <button 
                                                            onClick={() => handleMarkAbsence(item)}
                                                            className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded transition-colors shadow-sm"
                                                        >
                                                            Segna Assenza
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                isDangerous={confirmState.isDangerous}
                confirmText="Sì, recupera"
                cancelText="Annulla"
            />
        </div>
    );
};

export default Attendance;