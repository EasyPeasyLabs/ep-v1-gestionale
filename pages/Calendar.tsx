
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
    count: number; // Numero studenti
    isManual?: boolean; 
    isClosed?: boolean; 
    closedAtDate?: string; 
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
            const locationConfigMap = new Map<string, { days: Set<number>, closedAt?: string }>();
            supps.forEach(s => {
                s.locations.forEach(l => {
                    const days = new Set<number>(l.availability?.map(a => a.dayOfWeek) || []);
                    if (l.name) locationConfigMap.set(l.name.trim(), { days, closedAt: l.closedAt });
                });
            });

            // Set per tracciare le lezioni manuali che sono state "assorbite" da un'iscrizione istituzionale
            const absorbedLessonIds = new Set<string>();

            // 1. Process Enrollments (Cartellini)
            enrollments.forEach(enr => {
                if (enr.appointments && enr.appointments.length > 0) {
                    enr.appointments.forEach(app => {
                        const appDateObj = new Date(app.date);
                        const dayOfWeek = appDateObj.getDay(); 
                        const dateKey = app.date.split('T')[0];
                        const locName = (app.locationName || enr.locationName || 'N/D').trim();
                        const locColor = app.locationColor || enr.locationColor || '#ccc';
                        
                        const config = locationConfigMap.get(locName);
                        let isClosed = false;
                        let closedAtVal = '';

                        if (config) {
                            if (config.closedAt) {
                                const closingDate = new Date(config.closedAt);
                                closingDate.setHours(0,0,0,0);
                                const currentLessonDate = new Date(app.date);
                                if (currentLessonDate >= closingDate) {
                                    isClosed = true;
                                    closedAtVal = config.closedAt;
                                }
                            }
                            if (!isClosed && app.status === 'Scheduled' && !config.days.has(dayOfWeek)) return; 
                        }

                        // Tracciamo il collegamento referenziale per l'assorbimento
                        if (enr.isQuoteBased) {
                            absorbedLessonIds.add(app.lessonId);
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
                                isClosed,
                                closedAtDate: closedAtVal,
                                count: 0 
                            });
                        }
                        const cluster = clusterMap.get(key);
                        if (cluster) {
                            cluster.count++;
                            if (isClosed) { cluster.isClosed = true; cluster.closedAtDate = closedAtVal; }
                            // Se è istituzionale, sovrascriviamo childNames per chiarezza
                            if (enr.isQuoteBased) {
                                cluster.childNames = enr.childName;
                                cluster.title = 'ENTE';
                            }
                        }
                    });
                }
            });

            // 2. Process Manual Lessons (Extra) - FILTRO ASSORBIMENTO ATTIVO
            mLessons.forEach(ml => {
                // Se questa lezione manuale è già stata renderizzata tramite un'iscrizione istituzionale, saltala
                if (absorbedLessonIds.has(ml.id)) return;

                const config = locationConfigMap.get(ml.locationName.trim());
                let isClosed = false;
                let closedAtVal = '';
                if (config?.closedAt) {
                    const closingDate = new Date(config.closedAt);
                    if (new Date(ml.date) >= closingDate) { isClosed = true; closedAtVal = config.closedAt; }
                }

                let displayNames = '';
                let attendeeCount = 0;
                if (ml.attendees && ml.attendees.length > 0) {
                    displayNames = ml.attendees.map(a => a.childName).join(', ');
                    attendeeCount = ml.attendees.length;
                    if (ml.attendees.length > 2) displayNames = `${ml.attendees[0].childName} +${ml.attendees.length - 1}`;
                } else {
                    displayNames = ml.childName || '';
                    if (displayNames) attendeeCount = 1;
                }

                clusterMap.set(ml.id, {
                    id: ml.id,
                    date: ml.date,
                    startTime: ml.startTime,
                    endTime: ml.endTime,
                    locationName: ml.locationName,
                    locationColor: ml.locationColor || '#94a3b8',
                    count: attendeeCount, 
                    isManual: true,
                    isClosed,
                    closedAtDate: closedAtVal,
                    title: 'EXTRA',
                    description: ml.description,
                    childNames: displayNames
                });
            });

            setClusters(Array.from(clusterMap.values()));
            setError(null);
        } catch (err) {
            console.error(err);
            setError("Errore calendario.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveLesson = async (data: LessonInput | Lesson) => {
        setLoading(true);
        try {
            if ('id' in data) await updateLesson(data.id, data);
            else await addLesson(data);
            setIsModalOpen(false);
            await fetchData();
        } catch (e) { alert("Errore"); }
        finally { setLoading(false); }
    };

    const getTextColorForBg = (bgColor: string) => {
        if (!bgColor) return '#000';
        const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#000' : '#fff';
    };

    const { monthGrid, daysOfWeek } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDayIndex = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        const grid: (Date | null)[] = Array(startDayIndex).fill(null);
        for (let day = 1; day <= daysInMonth; day++) grid.push(new Date(year, month, day));
        return { monthGrid: grid, daysOfWeek: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] };
    }, [currentDate]);

    return (
        <div>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Calendario</h1>
                <button onClick={() => { setEditingLesson(null); setIsModalOpen(true); }} className="md-btn md-btn-raised md-btn-green md-btn-sm flex items-center"><PlusIcon /><span className="ml-2">Nuovo Evento</span></button>
            </div>
            
            <div className="mt-2 md-card p-2 md:p-6">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="md-icon-btn h-10 w-10 bg-gray-50 rounded-full font-bold">&lt;</button>
                    <h2 className="text-lg md:text-xl font-bold capitalize text-center">{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="md-icon-btn h-10 w-10 bg-gray-50 rounded-full font-bold">&gt;</button>
                </div>

                 {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
                 <div className="grid grid-cols-7 gap-1">
                     {daysOfWeek.map(day => <div key={day} className="text-center font-bold text-xs md:text-sm p-1 md:p-2 text-slate-400">{day}</div>)}
                     {monthGrid.map((day, index) => {
                        const dayEvents = day ? clusters.filter(c => new Date(c.date).toDateString() === day.toDateString()).sort((a,b) => a.startTime.localeCompare(b.startTime)) : [];
                        return (
                            <div key={index} className={`border min-h-[80px] md:min-h-[120px] p-1 overflow-hidden flex flex-col relative transition-colors ${day ? 'bg-white' : 'bg-gray-50'}`} style={{borderColor: 'var(--md-divider)'}}>
                                 {day && <span className={`font-semibold text-xs mb-1 ${new Date().toDateString() === day.toDateString() ? 'bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>{day.getDate()}</span>}
                                 <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                     {dayEvents.map(event => {
                                         const textColor = getTextColorForBg(event.locationColor);
                                         const locPrefix = event.locationName.substring(0, 3).toUpperCase();
                                         return (
                                             <div key={event.id} onClick={(e) => { if(event.isClosed) return alert("Sede chiusa."); if(event.isManual) { setEditingLesson(manualLessons.find(l => l.id === event.id) || null); setIsModalOpen(true); } }} className={`rounded p-1 text-[10px] md:text-xs font-bold shadow-sm leading-tight flex justify-between items-center transition-all ${event.isManual && !event.isClosed ? 'cursor-pointer hover:opacity-80' : ''} ${event.isClosed ? 'grayscale-ghost bg-zebra' : ''}`} style={{ backgroundColor: event.locationColor, color: textColor }}>
                                                 <span className="truncate mr-1 flex-1 flex items-center gap-1">
                                                     {event.title === 'ENTE' ? <span className="text-[8px] bg-black/20 px-1 rounded flex-shrink-0">ENTE</span> : (event.isManual && <span className="text-[8px] bg-black/20 px-1 rounded flex-shrink-0">EXT</span>)}
                                                     <span className="truncate">{event.childNames ? event.childNames : `${locPrefix} ${event.startTime}`}</span>
                                                 </span>
                                                 {!event.isClosed && event.count > 1 && <span className="bg-white/30 px-1 rounded text-[9px] min-w-[1.2em] text-center">{event.count}</span>}
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

            {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} size="md"><LessonForm lesson={editingLesson} suppliers={suppliers} clients={clients} onSave={handleSaveLesson} onDelete={id => deleteLesson(id).then(fetchData)} onCancel={() => setIsModalOpen(false)} /></Modal>}
        </div>
    );
};

export default Calendar;
