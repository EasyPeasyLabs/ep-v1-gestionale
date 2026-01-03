
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Enrollment, Appointment, EnrollmentStatus, Client } from '../types';
import { getLessons, addLesson, updateLesson, deleteLesson } from '../services/calendarService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import LessonForm from '../components/calendar/LessonForm';

// --- Types for Calendar Logic ---
interface CalendarCluster {
    id: string; // Unique key for React list
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    count: number; // Numero studenti (se manuale)
    isManual?: boolean; 
    title?: string;
    description?: string; 
    childNames?: string; 
}

const Calendar: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [clusters, setClusters] = useState<CalendarCluster[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [error, setError] = useState<string | null>(null);

    // Data for Forms
    const [manualLessons, setManualLessons] = useState<Lesson[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

    // --- Data Fetching & Aggregation Logic ---
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [enrollments, mLessons, supps, clis] = await Promise.all([
                getAllEnrollments(), 
                getLessons(),
                getSuppliers(),
                getClients()
            ]);

            setManualLessons(mLessons);
            setSuppliers(supps);
            setClients(clis);

            const clusterMap = new Map<string, CalendarCluster>();

            // 0. Costruiamo una Mappa di Disponibilità per Sede
            const locationAvailabilityMap = new Map<string, Set<number>>();
            supps.forEach(s => {
                s.locations.forEach(l => {
                    const days = new Set<number>(l.availability?.map(a => a.dayOfWeek) || []);
                    if (l.name) locationAvailabilityMap.set(l.name.trim(), days);
                });
            });

            // 1. Process Enrollments (Cartellini) -> Raggruppati per Lezione (TimeSlot)
            enrollments.forEach(enr => {
                if (enr.appointments && enr.appointments.length > 0) {
                    enr.appointments.forEach(app => {
                        const appDateObj = new Date(app.date);
                        const dayOfWeek = appDateObj.getDay(); 
                        const dateKey = app.date.split('T')[0];
                        const locName = (app.locationName || enr.locationName || 'N/D').trim();
                        const locColor = app.locationColor || enr.locationColor || '#ccc';
                        
                        // Check availability
                        const allowedDays = locationAvailabilityMap.get(locName);
                        if (allowedDays && !allowedDays.has(dayOfWeek)) {
                            return; 
                        }

                        const key = `${dateKey}_${app.startTime}_${locName}`;

                        if (!clusterMap.has(key)) {
                            clusterMap.set(key, {
                                id: key,
                                date: app.date,
                                startTime: app.startTime,
                                endTime: app.endTime,
                                locationName: locName,
                                locationColor: locColor,
                                count: 0 // Will increment per student
                            });
                        }

                        const cluster = clusterMap.get(key);
                        if (cluster) {
                            cluster.count++;
                        }
                    });
                }
            });

            // 2. Process Manual Lessons (Extra)
            mLessons.forEach(ml => {
                const dateKey = ml.date.split('T')[0];
                const key = ml.id; 
                
                // Generazione stringa nomi
                let displayNames = '';
                let attendeeCount = 0;
                if (ml.attendees && ml.attendees.length > 0) {
                    displayNames = ml.attendees.map(a => a.childName).join(', ');
                    attendeeCount = ml.attendees.length;
                    if (ml.attendees.length > 2) {
                        displayNames = `${ml.attendees[0].childName} +${ml.attendees.length - 1}`;
                    }
                } else {
                    displayNames = ml.childName || '';
                    if (displayNames) attendeeCount = 1;
                }

                clusterMap.set(key, {
                    id: ml.id,
                    date: ml.date,
                    startTime: ml.startTime,
                    endTime: ml.endTime,
                    locationName: ml.locationName,
                    locationColor: ml.locationColor || '#94a3b8',
                    count: attendeeCount, 
                    isManual: true,
                    title: 'EXTRA',
                    description: ml.description,
                    childNames: displayNames
                });
            });

            setClusters(Array.from(clusterMap.values()));
            setError(null);
        } catch (err) {
            console.error(err);
            setError("Impossibile caricare il calendario.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- Actions ---
    const handleSaveLesson = async (data: LessonInput | Lesson) => {
        setLoading(true);
        try {
            if ('id' in data) await updateLesson(data.id, data);
            else await addLesson(data);
            setIsModalOpen(false);
            await fetchData();
        } catch (e) { alert("Errore salvataggio"); }
        finally { setLoading(false); }
    };

    const handleDeleteLesson = async (id: string) => {
        if(confirm("Eliminare questo evento extra?")) {
            setLoading(true);
            try {
                await deleteLesson(id);
                setIsModalOpen(false);
                await fetchData();
            } catch(e) { alert("Errore eliminazione"); }
            finally { setLoading(false); }
        }
    };

    const handleEditManual = (id: string) => {
        const lesson = manualLessons.find(l => l.id === id);
        if (lesson) {
            setEditingLesson(lesson);
            setIsModalOpen(true);
        }
    };

    // --- Helper Colors ---
    const getTextColorForBg = (bgColor: string) => {
        if (!bgColor) return '#000';
        const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#000' : '#fff';
    };

    // --- Calendar Grid Rendering Logic ---
    const { monthGrid, daysOfWeek } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const startDayIndex = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        
        const grid: (Date | null)[] = Array(startDayIndex).fill(null);
        for (let day = 1; day <= daysInMonth; day++) {
            grid.push(new Date(year, month, day));
        }
        return { 
            monthGrid: grid, 
            daysOfWeek: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] 
        };
    }, [currentDate]);

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Calendario</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setEditingLesson(null); setIsModalOpen(true); }}
                        className="md-btn md-btn-raised md-btn-green md-btn-sm flex items-center"
                    >
                        <PlusIcon /><span className="ml-2">Nuovo Evento</span>
                    </button>
                </div>
            </div>
            
            <div className="mt-2 md-card p-2 md:p-6">
                {/* Navigazione Mese */}
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="md-icon-btn h-10 w-10 bg-gray-100 rounded-full font-bold">&lt;</button>
                    <h2 className="text-lg md:text-xl font-bold capitalize text-center">
                        {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={() => changeMonth(1)} className="md-icon-btn h-10 w-10 bg-gray-100 rounded-full font-bold">&gt;</button>
                </div>

                 {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
                 <div className="grid grid-cols-7 gap-1">
                     {/* Intestazioni Giorni */}
                     {daysOfWeek.map(day => (
                        <div key={day} className="text-center font-bold text-xs md:text-sm p-1 md:p-2" style={{color: 'var(--md-text-secondary)'}}>
                            {day}
                        </div>
                     ))}
                     
                     {/* Celle Giorni */}
                     {monthGrid.map((day, index) => {
                        const dayEvents = day 
                            ? clusters
                                .filter(c => new Date(c.date).toDateString() === day.toDateString())
                                .sort((a,b) => a.startTime.localeCompare(b.startTime))
                            : [];

                        return (
                            <div 
                                key={index} 
                                className={`border min-h-[80px] md:min-h-[120px] p-1 overflow-hidden flex flex-col relative transition-colors ${day ? 'bg-white' : 'bg-gray-50'}`}
                                style={{borderColor: 'var(--md-divider)'}} 
                            >
                                 {day && (
                                     <span className={`font-semibold text-xs mb-1 ${new Date().toDateString() === day.toDateString() ? 'bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>
                                         {day.getDate()}
                                     </span>
                                 )}
                                 
                                 {/* Lista Eventi */}
                                 <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                     {dayEvents.map(event => {
                                         const textColor = getTextColorForBg(event.locationColor);
                                         const locPrefix = event.locationName.substring(0, 3).toUpperCase();
                                         const isManual = event.isManual;
                                         
                                         return (
                                             <div 
                                                key={event.id}
                                                onClick={() => isManual && handleEditManual(event.id)}
                                                className={`rounded p-1 text-[10px] md:text-xs font-bold shadow-sm leading-tight flex justify-between items-center ${isManual ? 'cursor-pointer hover:opacity-80 ring-1 ring-black/10' : ''}`}
                                                style={{ backgroundColor: event.locationColor, color: textColor }}
                                                title={isManual ? `${event.description || 'Extra'} - ${event.childNames || ''}` : `${event.count} Allievi`}
                                             >
                                                 {/* Label */}
                                                 <span className="truncate mr-1 flex-1">
                                                     {isManual ? (
                                                         <span className="flex items-center gap-1">
                                                             <span className="text-[8px] bg-black/20 px-1 rounded flex-shrink-0">EXT</span>
                                                             <span className="truncate">
                                                                 {event.childNames ? event.childNames : (event.description || 'Evento')}
                                                             </span>
                                                         </span>
                                                     ) : (
                                                         <>{locPrefix} {event.startTime}</>
                                                     )}
                                                 </span>
                                                 {/* Counter (Solo Manuale o Nascosto per lezioni standard per evitare confusione) */}
                                                 {isManual && event.count > 1 && (
                                                     <span className="bg-white/30 px-1 rounded text-[9px] min-w-[1.2em] text-center flex-shrink-0" title="Partecipanti">
                                                         {event.count}
                                                     </span>
                                                 )}
                                             </div>
                                         );
                                     })}
                                 </div>
                            </div>
                        );
                     })}
                 </div>
                 }
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="md">
                    <LessonForm 
                        lesson={editingLesson}
                        suppliers={suppliers}
                        clients={clients}
                        onSave={handleSaveLesson}
                        onDelete={handleDeleteLesson}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default Calendar;
