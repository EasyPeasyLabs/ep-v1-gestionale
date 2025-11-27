
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Enrollment, Appointment, EnrollmentStatus } from '../types';
import { getLessons, addLesson, updateLesson, deleteLesson } from '../services/calendarService';
import { getAllEnrollments, bulkUpdateLocation } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';

// ... (LessonForm omitted - unchanged, keep existing code) ...
const LessonForm: React.FC<{ lesson?: Lesson | null; selectedDate?: Date | null; onSave: (item: LessonInput | Lesson) => void; onCancel: () => void; }> = ({ lesson, selectedDate, onSave, onCancel }) => { const [date, setDate] = useState(lesson?.date.split('T')[0] || selectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]); const [startTime, setStartTime] = useState(lesson?.startTime || '09:00'); const [endTime, setEndTime] = useState(lesson?.endTime || '10:00'); const [supplierId, setSupplierId] = useState(lesson?.supplierId || ''); const [locationId, setLocationId] = useState(lesson?.locationId || ''); const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [loading, setLoading] = useState(true); const selectedSupplier = suppliers.find(s => s.id === supplierId); useEffect(() => { const fetchSuppliersData = async () => { setLoading(true); const data = await getSuppliers(); setSuppliers(data); if (!lesson?.id && data.length > 0) { const firstSupplier = data[0]; setSupplierId(firstSupplier.id); if (firstSupplier.locations.length > 0) { setLocationId(firstSupplier.locations[0].id); } } setLoading(false); }; fetchSuppliersData(); }, [lesson]); const handleSupplierChange = (newSupplierId: string) => { setSupplierId(newSupplierId); const newSupplier = suppliers.find(s => s.id === newSupplierId); setLocationId(newSupplier?.locations[0]?.id || ''); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const supplier = suppliers.find(s => s.id === supplierId); const location = supplier?.locations.find(l => l.id === locationId); if (!supplier || !location) return; const lessonData: LessonInput = { date: new Date(date).toISOString(), startTime, endTime, supplierId, locationId, supplierName: supplier.companyName, locationName: location.name, locationColor: location.color, }; if (lesson?.id) { onSave({ ...lessonData, id: lesson.id }); } else { onSave(lessonData); } }; if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden"> <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100"> <h2 className="text-xl font-bold text-gray-800">{lesson ? 'Modifica Lezione Manuale' : 'Nuova Lezione Manuale'}</h2> </div> <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4"> <div className="md-input-group"><input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="md-input"/><label htmlFor="date" className="md-input-label !top-0 !text-xs !text-gray-500">Data</label></div> <div className="grid grid-cols-2 gap-4"> <div className="md-input-group"><input id="start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="md-input"/><label htmlFor="start" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Inizio</label></div> <div className="md-input-group"><input id="end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="md-input"/><label htmlFor="end" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Fine</label></div> </div> <div className="md-input-group"> <select id="supplier" value={supplierId} onChange={e => handleSupplierChange(e.target.value)} required className="md-input"> <option value="" disabled>Seleziona un fornitore</option> {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.companyName}</option>)} </select> <label htmlFor="supplier" className="md-input-label !top-0 !text-xs !text-gray-500">Fornitore</label> </div> <div className="md-input-group"> <select id="location" value={locationId} onChange={e => setLocationId(e.target.value)} required disabled={!selectedSupplier || selectedSupplier.locations.length === 0} className="md-input"> <option value="" disabled>Seleziona una sede</option> {selectedSupplier?.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>)} </select> <label htmlFor="location" className="md-input-label !top-0 !text-xs !text-gray-500">Sede</label> </div> </div> <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button> </div> </form> ); };

// --- Edit Group Modal ---
const EditGroupModal: React.FC<{
    event: CalendarEvent;
    allEnrollments: Enrollment[]; 
    onClose: () => void;
    onSave: (date: string, locId: string, locName: string, locColor: string, startTime: string, endTime: string, selectedIds: string[]) => void;
    targetDate?: string; // Nuova prop per la data di destinazione (da Drag/Move)
}> = ({ event, allEnrollments, onClose, onSave, targetDate }) => {
    const [effectiveDate, setEffectiveDate] = useState(targetDate || event.date.split('T')[0]);
    const [supplierId, setSupplierId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [startTime, setStartTime] = useState(event.startTime);
    const [endTime, setEndTime] = useState(event.endTime);
    
    // Partecipanti
    const groupEnrollments = useMemo(() => {
        return allEnrollments.filter(e => event.enrollmentIds?.includes(e.id));
    }, [allEnrollments, event.enrollmentIds]);

    const [selectedIds, setSelectedIds] = useState<string[]>(event.enrollmentIds || []);

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSuppliers().then(data => {
            setSuppliers(data);
            setLoading(false);
            // Pre-fill se stiamo spostando solo di data ma mantenendo la sede (se possibile)
            // Per ora reset to empty per sicurezza, l'utente deve confermare la sede
        });
    }, []);

    const selectedSupplier = suppliers.find(s => s.id === supplierId);

    const toggleParticipant = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const handleConfirm = () => {
        if (!selectedSupplier) return;
        const loc = selectedSupplier.locations.find(l => l.id === locationId);
        if (!loc) return;
        
        onSave(effectiveDate, loc.id, loc.name, loc.color, startTime, endTime, selectedIds);
    };

    return (
        <Modal onClose={onClose} size="lg">
            <div className="flex flex-col h-full max-h-full overflow-hidden">
                <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                    <h3 className="text-xl font-bold">Sposta/Modifica Gruppo</h3>
                    <p className="text-sm text-gray-500">
                        Stai spostando <strong>{event.locationName}</strong>.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
                    
                    {/* Sezione 1: Parametri Spostamento */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-sm text-indigo-700 uppercase">1. Nuova Destinazione</h4>
                        <div className="md-input-group">
                            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="md-input font-bold text-lg" />
                            <label className="md-input-label !top-0">Data (Dal...)</label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="md-input-group">
                                <select value={supplierId} onChange={e => {setSupplierId(e.target.value); setLocationId('');}} className="md-input">
                                    <option value="">Scegli Fornitore...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                                </select>
                                <label className="md-input-label !top-0">Nuovo Fornitore</label>
                            </div>
                            <div className="md-input-group">
                                <select value={locationId} onChange={e => setLocationId(e.target.value)} disabled={!selectedSupplier} className="md-input">
                                    <option value="">Scegli Sede...</option>
                                    {selectedSupplier?.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <label className="md-input-label !top-0">Nuova Sede</label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-2 rounded">
                            <div className="md-input-group">
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="md-input" />
                                <label className="md-input-label !top-0">Nuovo Inizio</label>
                            </div>
                            <div className="md-input-group">
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="md-input" />
                                <label className="md-input-label !top-0">Nuova Fine</label>
                            </div>
                        </div>
                    </div>

                    {/* Sezione 2: Partecipanti Coinvolti */}
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-sm text-indigo-700 uppercase">2. Partecipanti ({selectedIds.length})</h4>
                            <button 
                                onClick={() => setSelectedIds(selectedIds.length === groupEnrollments.length ? [] : groupEnrollments.map(e => e.id))}
                                className="text-xs text-blue-600 font-bold hover:underline"
                            >
                                {selectedIds.length === groupEnrollments.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 border rounded-md max-h-40 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {groupEnrollments.map(enr => (
                                <label key={enr.id} className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-100 cursor-pointer hover:border-indigo-300">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(enr.id)}
                                        onChange={() => toggleParticipant(enr.id)}
                                        className="h-4 w-4 text-indigo-600 rounded"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">{enr.childName}</span>
                                        <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{enr.subscriptionName}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 flex-shrink-0">
                    <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!locationId || selectedIds.length === 0} 
                        className="md-btn md-btn-raised md-btn-primary md-btn-sm disabled:opacity-50"
                    >
                        Conferma Spostamento
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ... (Calendar Component Logic) ...
interface CalendarEvent {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    color: string;
    isManual: boolean; 
    locationName?: string;
    enrolledCount?: number;
    maxCapacity?: number;
    enrollmentIds?: string[];
}

const Calendar: React.FC = () => {
    // ... (Existing states) ...
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [rawEnrollments, setRawEnrollments] = useState<Enrollment[]>([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
    
    // Group Edit State
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedGroupEvent, setSelectedGroupEvent] = useState<CalendarEvent | null>(null);
    
    // --- MOVE MODE STATE ---
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [eventToMove, setEventToMove] = useState<CalendarEvent | null>(null);
    const [moveTargetDate, setMoveTargetDate] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        // ... (Existing fetch logic - unchanged) ...
        try {
            setLoading(true);
            const [manualLessons, enrollments, suppliers] = await Promise.all([getLessons(), getAllEnrollments(), getSuppliers()]);
            setRawEnrollments(enrollments); // Store raw enrollments

            const locationMap = new Map<string, { name: string; capacity: number; color: string }>();
            suppliers.forEach(s => { s.locations.forEach(l => { locationMap.set(l.id, { name: l.name, capacity: l.capacity || 0, color: l.color }); }); });
            const calendarEvents: CalendarEvent[] = [];
            manualLessons.forEach(l => { calendarEvents.push({ id: l.id, date: l.date, startTime: l.startTime, endTime: l.endTime, title: `EXTRA: ${l.locationName}`, color: l.locationColor || '#94a3b8', isManual: true, locationName: l.locationName }); });

            const groupedAppointments = new Map<string, { date: string; startTime: string; endTime: string; locationId: string; count: number; locationName: string; color: string; capacity: number; enrollmentIds: string[] }>();

            enrollments.forEach(enr => {
                if (enr.status !== EnrollmentStatus.Active && enr.status !== EnrollmentStatus.Pending && enr.status !== EnrollmentStatus.Completed) return;
                
                if (enr.appointments) {
                    enr.appointments.forEach(app => {
                        const locationId = enr.locationId;
                        const key = `${app.date}_${app.startTime}_${locationId}`;
                        const locInfo = locationMap.get(locationId);
                        if (!groupedAppointments.has(key)) {
                            groupedAppointments.set(key, { date: app.date, startTime: app.startTime, endTime: app.endTime, locationId: locationId, count: 0, locationName: locInfo?.name || app.locationName, color: locInfo?.color || app.locationColor || enr.locationColor || '#3b82f6', capacity: locInfo?.capacity || 0, enrollmentIds: [] });
                        }
                        const group = groupedAppointments.get(key);
                        if (group) { group.count++; group.enrollmentIds.push(enr.id); }
                    });
                }
            });

            groupedAppointments.forEach((group, key) => {
                calendarEvents.push({ id: key, date: group.date, startTime: group.startTime, endTime: group.endTime, title: `${group.locationName}`, locationName: group.locationName, color: group.color, isManual: false, enrolledCount: group.count, maxCapacity: group.capacity, enrollmentIds: group.enrollmentIds });
            });
            setEvents(calendarEvents);
        } catch (err) { setError("Impossibile caricare il calendario."); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    // Handler unico per click su evento
    const handleEventClick = (event: CalendarEvent, date: Date | null) => {
        if (isMoveMode) {
            // Se siamo in Move Mode, cliccare su un evento lo seleziona come "Da Spostare"
            if (!event.isManual) {
                setEventToMove(event);
                // Non apriamo ancora la modale, aspettiamo che l'utente clicchi il giorno di destinazione
                alert("Evento selezionato! Ora tocca il giorno dove vuoi spostarlo.");
            } else {
                alert("Puoi spostare solo i gruppi di lezione, non le lezioni manuali (per ora).");
            }
            return;
        }

        // Normal Behavior
        if (event && !event.isManual) {
            setSelectedGroupEvent(event);
            setMoveTargetDate(null); // Reset
            setIsGroupModalOpen(true);
            return;
        }
        const lessonToEdit = event ? { id: event.id, date: event.date, startTime: event.startTime, endTime: event.endTime, supplierId: '', locationId: '', supplierName: '', locationName: '' } as Lesson : null;
        setEditingLesson(lessonToEdit); setSelectedDate(date); setIsModalOpen(true); 
    };

    // Handler per click sul giorno (vuoto o con eventi)
    const handleDayClick = (day: Date) => {
        if (!day) return;

        if (isMoveMode && eventToMove) {
            // Se abbiamo un evento in canna e clicchiamo un giorno, è il DROP
            setSelectedGroupEvent(eventToMove);
            setMoveTargetDate(day.toISOString().split('T')[0]); // Imposta data target
            setIsGroupModalOpen(true);
            
            // Reset move mode after triggering modal
            setIsMoveMode(false);
            setEventToMove(null);
            return;
        }

        // Normal: Apri modale creazione lezione manuale
        handleOpenModal(null, day);
    };

    const handleOpenModal = (item: CalendarEvent | null = null, date: Date | null = null) => { 
        if (item) handleEventClick(item, date);
        else {
            setEditingLesson(null); setSelectedDate(date); setIsModalOpen(true); 
        }
    };

    const handleGroupSave = async (date: string, locId: string, locName: string, locColor: string, start: string, end: string, selectedIds: string[]) => {
        setIsGroupModalOpen(false);
        setLoading(true);
        try {
            await bulkUpdateLocation(
                selectedIds, 
                date,
                locId,
                locName,
                locColor,
                start,
                end
            );
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert("Spostamento completato. Iscrizioni aggiornate.");
        } catch (e) {
            alert("Errore aggiornamento gruppo.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLesson = async (item: LessonInput | Lesson) => { if ('id' in item) { await updateLesson(item.id, item); } else { await addLesson(item); } setIsModalOpen(false); setEditingLesson(null); fetchData(); };
    const handleDeleteClick = (id: string, isManual: boolean) => { if (!isManual) return; setLessonToDelete(id); };
    const handleConfirmDelete = async () => { if(lessonToDelete) { await deleteLesson(lessonToDelete); fetchData(); setLessonToDelete(null); } };

    // ... (Calendar Grid Rendering Logic) ...
    const { monthGrid, daysOfWeek } = useMemo(() => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const firstDayOfMonth = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const startDayIndex = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; const grid: (Date | null)[] = Array(startDayIndex).fill(null); for (let day = 1; day <= daysInMonth; day++) { grid.push(new Date(year, month, day)); } return { monthGrid: grid, daysOfWeek: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] }; }, [currentDate]);
    const getTextColorForBg = (bgColor?: string) => { if (!bgColor) return '#212121'; const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor; const r = parseInt(color.substring(0, 2), 16), g = parseInt(color.substring(2, 4), 16), b = parseInt(color.substring(4, 6), 16); return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#212121' : '#ffffff'; };
    const changeMonth = (delta: number) => { setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)); };

    return (
        <div>
            {/* Header ... */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Calendario</h1>
                
                <div className="flex gap-2">
                    {/* MOVE BUTTON TOGGLE */}
                    <button 
                        onClick={() => { setIsMoveMode(!isMoveMode); setEventToMove(null); }} 
                        className={`md-btn md-btn-sm ${isMoveMode ? 'bg-amber-100 text-amber-800 border-2 border-amber-300 shadow-inner' : 'bg-white border text-gray-700 shadow-sm'}`}
                    >
                        {isMoveMode ? (
                            <span className="flex items-center font-bold">
                                <span className="animate-pulse mr-2">👆</span> Scegli Slot...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                ✋ Sposta Slot
                            </span>
                        )}
                    </button>

                    <button onClick={() => handleOpenModal(null, new Date())} className="md-btn md-btn-raised md-btn-green md-btn-sm"><PlusIcon /><span className="ml-2">Extra</span></button>
                </div>
            </div>
            
            {isMoveMode && (
                <div className="bg-amber-50 text-amber-900 px-4 py-2 rounded-lg mb-4 text-sm border border-amber-200 shadow-sm">
                    <strong>Modalità Spostamento Attiva:</strong>
                    {eventToMove ? 
                        <span> Hai selezionato <strong>{eventToMove.locationName}</strong>. Ora tocca il <strong>giorno di destinazione</strong> nel calendario.</span> : 
                        <span> Tocca un blocco colorato (lezione) per selezionarlo, poi tocca un altro giorno per spostarlo.</span>
                    }
                </div>
            )}

            <div className="mt-2 md-card p-2 md:p-6">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="md-icon-btn h-10 w-10 bg-gray-100 rounded-full font-bold">&lt;</button>
                    <h2 className="text-lg md:text-xl font-bold capitalize text-center">{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2>
                    <button onClick={() => changeMonth(1)} className="md-icon-btn h-10 w-10 bg-gray-100 rounded-full font-bold">&gt;</button>
                </div>

                 {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
                 <div className="grid grid-cols-7 gap-1">
                     {daysOfWeek.map(day => <div key={day} className="text-center font-bold text-xs md:text-sm p-1 md:p-2" style={{color: 'var(--md-text-secondary)'}}>{day}</div>)}
                     {monthGrid.map((day, index) => (
                        <div 
                            key={index} 
                            className={`border min-h-[80px] md:min-h-[120px] p-1 overflow-hidden flex flex-col relative transition-colors
                                ${day ? (isMoveMode && eventToMove ? 'bg-green-50 cursor-pointer hover:bg-green-100 border-green-200' : 'bg-white cursor-pointer') : 'bg-gray-50'}
                            `}
                            style={{borderColor: 'var(--md-divider)'}} 
                            onClick={() => day && handleDayClick(day)}
                        >
                             {day && <span className={`font-semibold text-xs mb-1 ${new Date().toDateString() === day.toDateString() ? 'bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>{day.getDate()}</span>}
                             <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                {day && events.filter(ev => new Date(ev.date).toDateString() === day.toDateString()).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(event => {
                                        const textColor = getTextColorForBg(event.color);
                                        const locAbbr = (event.locationName || 'UNK').substring(0, 3).toUpperCase();
                                        const isSelected = eventToMove?.id === event.id;
                                        
                                        return (
                                            <div 
                                                key={event.id} 
                                                className={`p-1 rounded shadow-sm flex flex-col justify-between relative
                                                    ${isSelected ? 'ring-2 ring-offset-1 ring-amber-500 transform scale-95 opacity-80' : ''}
                                                `} 
                                                style={{ backgroundColor: event.color, color: textColor, minHeight: event.isManual ? 'auto' : '36px' }} 
                                                onClick={(e) => { e.stopPropagation(); handleEventClick(event, day); }}
                                            >
                                                 {event.isManual ? (
                                                    <div className="flex justify-between items-center text-[10px] leading-tight"><span className="font-bold truncate">{event.startTime} - {event.title}</span><button onClick={(e) => {e.stopPropagation(); handleDeleteClick(event.id, true);}} className="opacity-60 ml-1 hover:text-red-600 font-bold">×</button></div>
                                                 ) : (
                                                    <><div className="text-[10px] md:text-[11px] font-bold leading-tight">{locAbbr}. {event.startTime}</div><div className="text-[9px] md:text-[10px] text-right font-mono opacity-90 mt-0.5">{event.enrolledCount} / {event.maxCapacity}</div></>
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

            {isModalOpen && <Modal onClose={() => setIsModalOpen(false)}><LessonForm lesson={editingLesson} selectedDate={selectedDate} onSave={handleSaveLesson} onCancel={() => {setIsModalOpen(false); setEditingLesson(null);}} /></Modal>}
            {isGroupModalOpen && selectedGroupEvent && <EditGroupModal event={selectedGroupEvent} allEnrollments={rawEnrollments} onClose={() => setIsGroupModalOpen(false)} onSave={handleGroupSave} targetDate={moveTargetDate || undefined} />}
            <ConfirmModal isOpen={!!lessonToDelete} onClose={() => setLessonToDelete(null)} onConfirm={handleConfirmDelete} title="Elimina Lezione" message="Sei sicuro di voler eliminare questa lezione extra?" isDangerous={true} />
        </div>
    );
};

export default Calendar;
