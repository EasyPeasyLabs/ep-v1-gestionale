
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Enrollment, Appointment, EnrollmentStatus } from '../types';
import { getLessons, addLesson, updateLesson, deleteLesson } from '../services/calendarService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';

// --- Types for Calendar Logic ---
interface CalendarCluster {
    id: string; // Unique key for React list
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    count: number; // Numero totale cartellini
    isManual?: boolean; // Per distinguere lezioni extra manuali
    title?: string; // Per lezioni manuali
}

const Calendar: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [clusters, setClusters] = useState<CalendarCluster[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [error, setError] = useState<string | null>(null);

    // --- Data Fetching & Aggregation Logic ---
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [enrollments, manualLessons, suppliers] = await Promise.all([
                getAllEnrollments(), 
                getLessons(),
                getSuppliers()
            ]);

            const clusterMap = new Map<string, CalendarCluster>();

            // 0. Costruiamo una Mappa di Disponibilità per Sede (Nome Sede -> Set di Giorni Index)
            // Questo serve per filtrare appuntamenti "fantasma" che rimangono in giorni dove la sede non lavora
            // (es. dopo uno spostamento da Martedì a Venerdì, i vecchi martedì non devono apparire se la nuova sede lavora solo Venerdì)
            const locationAvailabilityMap = new Map<string, Set<number>>();
            suppliers.forEach(s => {
                s.locations.forEach(l => {
                    const days = new Set(l.availability?.map(a => a.dayOfWeek) || []);
                    // Normalizziamo il nome per sicurezza
                    if (l.name) locationAvailabilityMap.set(l.name.trim(), days);
                });
            });

            // 1. Process Enrollments (Cartellini)
            enrollments.forEach(enr => {
                // Consideriamo solo iscrizioni attive, in attesa o completate (storico)
                if (enr.appointments && enr.appointments.length > 0) {
                    enr.appointments.forEach(app => {
                        const appDateObj = new Date(app.date);
                        const dayOfWeek = appDateObj.getDay(); // 0-6
                        
                        // Normalizziamo la data a stringa YYYY-MM-DD
                        const dateKey = app.date.split('T')[0];
                        
                        // Determina la location corrente
                        // Se l'appuntamento ha una location specifica salvata (es. lezione passata confermata), usa quella.
                        // Altrimenti usa quella dell'iscrizione (es. lezione futura o spostata).
                        const locName = (app.locationName || enr.locationName || 'N/D').trim();
                        const locColor = app.locationColor || enr.locationColor || '#ccc';
                        
                        // --- FILTRO DI COERENZA (Availability Check) ---
                        // Se la sede identificata NON ha disponibilità per questo giorno della settimana,
                        // nascondiamo l'appuntamento. Questo risolve il problema visivo degli spostamenti.
                        const allowedDays = locationAvailabilityMap.get(locName);
                        // Se la mappa ha la sede, controlliamo il giorno. Se la sede non è in mappa (es. cancellata), mostriamo per sicurezza (o nascondiamo, policy permissiva qui).
                        if (allowedDays && !allowedDays.has(dayOfWeek)) {
                            return; // SKIP: La sede X non lavora di Martedì, quindi non mostrare questo appuntamento.
                        }

                        // Chiave di raggruppamento: DATA + ORARIO + SEDE
                        const key = `${dateKey}_${app.startTime}_${locName}`;

                        if (!clusterMap.has(key)) {
                            clusterMap.set(key, {
                                id: key,
                                date: app.date,
                                startTime: app.startTime,
                                endTime: app.endTime,
                                locationName: locName,
                                locationColor: locColor,
                                count: 0
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
            // Le lezioni manuali NON subiscono il filtro di disponibilità perché sono eccezioni/extra.
            manualLessons.forEach(ml => {
                const dateKey = ml.date.split('T')[0];
                const key = `${dateKey}_${ml.startTime}_${ml.locationName}_MANUAL`; 
                
                clusterMap.set(key, {
                    id: ml.id,
                    date: ml.date,
                    startTime: ml.startTime,
                    endTime: ml.endTime,
                    locationName: ml.locationName,
                    locationColor: ml.locationColor || '#94a3b8',
                    count: 0, // 0 indica che è manuale/extra
                    isManual: true,
                    title: 'EXTRA'
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
        
        // 0 = Domenica -> index 6. Lunedì (1) -> index 0.
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
                    {/* Placeholder per azioni future (es. Aggiungi Extra) */}
                    <button className="md-btn md-btn-raised md-btn-green md-btn-sm opacity-50 cursor-not-allowed">
                        <PlusIcon /><span className="ml-2">Nuovo</span>
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
                        // Filtra gli eventi per questo giorno
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
                                 
                                 {/* Lista Eventi Aggregati */}
                                 <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                     {dayEvents.map(event => {
                                         const textColor = getTextColorForBg(event.locationColor);
                                         const locPrefix = event.locationName.substring(0, 3).toUpperCase();
                                         
                                         return (
                                             <div 
                                                key={event.id}
                                                className="rounded p-1 text-[10px] md:text-xs font-bold shadow-sm leading-tight flex justify-between items-center"
                                                style={{ backgroundColor: event.locationColor, color: textColor }}
                                             >
                                                 {/* Label: 3 Lettere Sede + Orario */}
                                                 <span className="truncate mr-1">
                                                     {event.isManual ? 'EXTRA' : locPrefix} {event.startTime}
                                                 </span>
                                                 {/* Numero Totale Cartellini */}
                                                 {!event.isManual && (
                                                     <span className="bg-white/30 px-1 rounded text-[9px]">
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
        </div>
    );
};

export default Calendar;
