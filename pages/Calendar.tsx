
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Enrollment, Appointment, EnrollmentStatus } from '../types';
import { getLessons, addLesson, updateLesson, deleteLesson } from '../services/calendarService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';


const LessonForm: React.FC<{
    lesson?: Lesson | null;
    selectedDate?: Date | null;
    onSave: (item: LessonInput | Lesson) => void;
    onCancel: () => void;
}> = ({ lesson, selectedDate, onSave, onCancel }) => {
    const [date, setDate] = useState(lesson?.date.split('T')[0] || selectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(lesson?.startTime || '09:00');
    const [endTime, setEndTime] = useState(lesson?.endTime || '10:00');
    const [supplierId, setSupplierId] = useState(lesson?.supplierId || '');
    const [locationId, setLocationId] = useState(lesson?.locationId || '');
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedSupplier = suppliers.find(s => s.id === supplierId);

    useEffect(() => {
        const fetchSuppliersData = async () => {
            setLoading(true);
            const data = await getSuppliers();
            setSuppliers(data);
            if (!lesson?.id && data.length > 0) {
                const firstSupplier = data[0];
                setSupplierId(firstSupplier.id);
                if (firstSupplier.locations.length > 0) {
                    setLocationId(firstSupplier.locations[0].id);
                }
            }
            setLoading(false);
        };
        fetchSuppliersData();
    }, [lesson]);

    const handleSupplierChange = (newSupplierId: string) => {
        setSupplierId(newSupplierId);
        const newSupplier = suppliers.find(s => s.id === newSupplierId);
        setLocationId(newSupplier?.locations[0]?.id || '');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplier = suppliers.find(s => s.id === supplierId);
        const location = supplier?.locations.find(l => l.id === locationId);
        if (!supplier || !location) return;

        const lessonData: LessonInput = {
            date: new Date(date).toISOString(), startTime, endTime, supplierId, locationId,
            supplierName: supplier.companyName, locationName: location.name, locationColor: location.color,
        };

        if (lesson?.id) {
            onSave({ ...lessonData, id: lesson.id });
        } else {
            onSave(lessonData);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;
    
    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                 <h2 className="text-xl font-bold text-gray-800">{lesson ? 'Modifica Lezione Manuale' : 'Nuova Lezione Manuale'}</h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm text-yellow-800">
                    <strong>Attenzione:</strong> Usa questa funzione solo per lezioni extra o fuori abbonamento. Le lezioni regolari vengono create automaticamente all'iscrizione del cliente.
                </div>
                
                <div className="md-input-group"><input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="md-input"/><label htmlFor="date" className="md-input-label !top-0 !text-xs !text-gray-500">Data</label></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="md-input"/><label htmlFor="start" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Inizio</label></div>
                    <div className="md-input-group"><input id="end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="md-input"/><label htmlFor="end" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Fine</label></div>
                </div>
                <div className="md-input-group">
                    <select id="supplier" value={supplierId} onChange={e => handleSupplierChange(e.target.value)} required className="md-input">
                        <option value="" disabled>Seleziona un fornitore</option>
                        {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.companyName}</option>)}
                    </select>
                    <label htmlFor="supplier" className="md-input-label !top-0 !text-xs !text-gray-500">Fornitore</label>
                </div>
                <div className="md-input-group">
                    <select id="location" value={locationId} onChange={e => setLocationId(e.target.value)} required disabled={!selectedSupplier || selectedSupplier.locations.length === 0} className="md-input">
                        <option value="" disabled>Seleziona una sede</option>
                        {selectedSupplier?.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>)}
                    </select>
                    <label htmlFor="location" className="md-input-label !top-0 !text-xs !text-gray-500">Sede</label>
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
            </div>
        </form>
    );
};

// Definizione unificata per evento calendario
interface CalendarEvent {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    color: string;
    isManual: boolean; // true se da collection 'lessons', false se da 'enrollments'
    // Campi specifici per aggregazione
    locationName?: string;
    enrolledCount?: number;
    maxCapacity?: number;
}

const Calendar: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            // Fetch everything in parallel
            const [manualLessons, enrollments, suppliers] = await Promise.all([
                getLessons(),
                getAllEnrollments(),
                getSuppliers()
            ]);

            // 1. Mappa le location per ID per avere accesso rapido a capienza e nome
            const locationMap = new Map<string, { name: string; capacity: number; color: string }>();
            suppliers.forEach(s => {
                s.locations.forEach(l => {
                    locationMap.set(l.id, { 
                        name: l.name, 
                        capacity: l.capacity || 0, 
                        color: l.color 
                    });
                });
            });

            const calendarEvents: CalendarEvent[] = [];

            // 2. Gestione Lezioni Manuali (Restano separate)
            manualLessons.forEach(l => {
                calendarEvents.push({
                    id: l.id,
                    date: l.date,
                    startTime: l.startTime,
                    endTime: l.endTime,
                    title: `EXTRA: ${l.locationName}`,
                    color: l.locationColor || '#94a3b8',
                    isManual: true,
                    locationName: l.locationName
                });
            });

            // 3. Gestione Iscrizioni (Raggruppamento)
            // Chiave di raggruppamento: date_startTime_locationId
            const groupedAppointments = new Map<string, {
                date: string;
                startTime: string;
                endTime: string;
                locationId: string;
                count: number;
                locationName: string;
                color: string;
                capacity: number;
            }>();

            enrollments.forEach(enr => {
                // Show lessons only if enrollment is ACTIVE (Paid) or PENDING (Transitory)
                if (enr.status !== EnrollmentStatus.Active && enr.status !== EnrollmentStatus.Pending) {
                    return;
                }

                if (enr.appointments) {
                    enr.appointments.forEach(app => {
                        const locationId = enr.locationId;
                        const key = `${app.date}_${app.startTime}_${locationId}`;
                        const locInfo = locationMap.get(locationId);
                        
                        if (!groupedAppointments.has(key)) {
                            groupedAppointments.set(key, {
                                date: app.date,
                                startTime: app.startTime,
                                endTime: app.endTime,
                                locationId: locationId,
                                count: 0,
                                locationName: locInfo?.name || app.locationName,
                                color: locInfo?.color || app.locationColor || enr.locationColor || '#3b82f6',
                                capacity: locInfo?.capacity || 0
                            });
                        }
                        
                        const group = groupedAppointments.get(key);
                        if (group) {
                            group.count++;
                        }
                    });
                }
            });

            // Converti i gruppi in eventi del calendario
            groupedAppointments.forEach((group, key) => {
                calendarEvents.push({
                    id: key, // ID fittizio per il rendering
                    date: group.date,
                    startTime: group.startTime,
                    endTime: group.endTime,
                    title: `${group.locationName}`, // Titolo base
                    locationName: group.locationName,
                    color: group.color,
                    isManual: false,
                    enrolledCount: group.count,
                    maxCapacity: group.capacity
                });
            });

            setEvents(calendarEvents);
        } catch (err) {
            setError("Impossibile caricare il calendario."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const handleOpenModal = (item: CalendarEvent | null = null, date: Date | null = null) => { 
        if (item && !item.isManual) {
            // Se è un raggruppamento automatico, mostriamo solo un alert
            // Non permettiamo modifiche di gruppo qui, devono essere gestite lato Cliente
            return;
        }
        // Se è manuale o nuovo
        const lessonToEdit = item ? { 
            id: item.id, 
            date: item.date, 
            startTime: item.startTime, 
            endTime: item.endTime,
            // Campi fittizi
            supplierId: '', 
            locationId: '', 
            supplierName: '', 
            locationName: '' 
        } as Lesson : null;
        
        setEditingLesson(lessonToEdit);
        setSelectedDate(date);
        setIsModalOpen(true); 
    };

    const handleSaveLesson = async (item: LessonInput | Lesson) => {
        if ('id' in item) { 
            await updateLesson(item.id, item); 
        } else { 
            await addLesson(item); 
        }
        setIsModalOpen(false); setEditingLesson(null); fetchData();
    };
    
    const handleDeleteClick = (id: string, isManual: boolean) => {
        if (!isManual) return;
        setLessonToDelete(id);
    };

    const handleConfirmDelete = async () => {
        if(lessonToDelete) {
            await deleteLesson(lessonToDelete);
            fetchData();
            setLessonToDelete(null);
        }
    };

    const { monthGrid, daysOfWeek } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon...
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Adjust for Sunday being 0, we want Monday to be the start
        const startDayIndex = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        const grid: (Date | null)[] = Array(startDayIndex).fill(null);
        for (let day = 1; day <= daysInMonth; day++) {
            grid.push(new Date(year, month, day));
        }
        return {
            monthGrid: grid,
            daysOfWeek: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
        };
    }, [currentDate]);

    const getTextColorForBg = (bgColor?: string) => {
        if (!bgColor) return '#212121';
        const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
        const r = parseInt(color.substring(0, 2), 16), g = parseInt(color.substring(2, 4), 16), b = parseInt(color.substring(4, 6), 16);
        return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#212121' : '#ffffff';
    };

    const changeMonth = (delta: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold">Calendario</h1>
                  <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Visualizza le lezioni programmate e l'occupazione delle aule.</p>
                </div>
                <button onClick={() => handleOpenModal(null, new Date())} className="md-btn md-btn-flat md-btn-primary">
                    <PlusIcon /><span className="ml-2">Lezione Extra</span>
                </button>
            </div>
            
            <div className="mt-8 md-card p-4 md:p-6">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="md-icon-btn" aria-label="Mese precedente">&lt;</button>
                    <h2 className="text-xl font-bold capitalize">{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="md-icon-btn" aria-label="Mese successivo">&gt;</button>
                </div>

                 {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
                 error ? <p className="text-center text-red-500 py-8">{error}</p> :
                 <div className="grid grid-cols-7 gap-1">
                     {daysOfWeek.map(day => <div key={day} className="text-center font-bold text-sm hidden md:block p-2" style={{color: 'var(--md-text-secondary)'}}>{day}</div>)}
                     {monthGrid.map((day, index) => (
                        <div key={index} 
                             className={`border min-h-[120px] p-1.5 overflow-hidden flex flex-col ${day ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'}`}
                             style={{borderColor: 'var(--md-divider)'}}
                             onClick={() => day && handleOpenModal(null, day)}>
                             {day && (
                                <span className={`font-semibold text-xs ${new Date().toDateString() === day.toDateString() ? 'bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>{day.getDate()}</span>
                             )}
                             <div className="mt-1 space-y-1 overflow-y-auto flex-1">
                                {day && events
                                    .filter(ev => new Date(ev.date).toDateString() === day.toDateString())
                                    .sort((a,b) => a.startTime.localeCompare(b.startTime))
                                    .map(event => {
                                        const textColor = getTextColorForBg(event.color);
                                        
                                        // Abbreviazione sede (prime 3 lettere uppercase)
                                        const locAbbr = (event.locationName || 'UNK').substring(0, 3).toUpperCase();

                                        return (
                                            <div key={event.id}
                                                 className="p-1 rounded shadow-sm group flex flex-col justify-between relative"
                                                 style={{ backgroundColor: event.color, color: textColor, minHeight: event.isManual ? 'auto' : '36px' }}
                                                 onClick={(e) => { if(!event.isManual) e.stopPropagation(); else {e.stopPropagation(); handleOpenModal(event, day);} }}>
                                                 
                                                 {event.isManual ? (
                                                    // Visualizzazione Lezione Manuale (Classica)
                                                    <div className="flex justify-between items-center text-[10px] leading-tight">
                                                        <span className="font-bold truncate">{event.startTime} - {event.title}</span>
                                                        <button onClick={(e) => {e.stopPropagation(); handleDeleteClick(event.id, true);}} className="opacity-0 group-hover:opacity-100 ml-1 hover:text-red-600 transition-opacity font-bold text-lg leading-none" aria-label="Elimina">×</button>
                                                    </div>
                                                 ) : (
                                                    // Visualizzazione Raggruppata (Richiesta Specifica)
                                                    <>
                                                        <div className="text-[11px] font-bold leading-tight">
                                                            {locAbbr}. {event.startTime}
                                                        </div>
                                                        <div className="text-[10px] text-right font-mono opacity-90 mt-1">
                                                            {event.enrolledCount} / {event.maxCapacity}
                                                        </div>
                                                    </>
                                                 )}
                                            </div>
                                        )
                                })}
                             </div>
                        </div>
                     ))}
                 </div>
                 }
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)}>
                    <LessonForm lesson={editingLesson} selectedDate={selectedDate} onSave={handleSaveLesson} onCancel={() => {setIsModalOpen(false); setEditingLesson(null);}} />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!lessonToDelete}
                onClose={() => setLessonToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina Lezione"
                message="Sei sicuro di voler eliminare questa lezione extra?"
                isDangerous={true}
            />
        </div>
    );
};

export default Calendar;
