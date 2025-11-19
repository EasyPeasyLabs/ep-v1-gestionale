
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, LessonInput, Supplier } from '../types';
import { getLessons, addLesson, updateLesson, deleteLesson, addLessonsBatch } from '../services/calendarService';
import { getSuppliers } from '../services/supplierService';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';

const LessonForm: React.FC<{
    lesson?: Lesson | null;
    selectedDate?: Date | null;
    onSave: (item: LessonInput | Lesson, isRecurring: boolean, recurringEndDate?: string, recurringDays?: number[]) => void;
    onCancel: () => void;
}> = ({ lesson, selectedDate, onSave, onCancel }) => {
    const [date, setDate] = useState(lesson?.date.split('T')[0] || selectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(lesson?.startTime || '09:00');
    const [endTime, setEndTime] = useState(lesson?.endTime || '10:00');
    const [supplierId, setSupplierId] = useState(lesson?.supplierId || '');
    const [locationId, setLocationId] = useState(lesson?.locationId || '');
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    // Recurring state
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringEndDate, setRecurringEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [recurringDays, setRecurringDays] = useState<number[]>([]);

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

    const handleRecurringDayChange = (dayIndex: number) => {
        setRecurringDays(prev => 
            prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
        );
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
            onSave({ ...lessonData, id: lesson.id }, false);
        } else {
            onSave(lessonData, isRecurring, recurringEndDate, recurringDays);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;
    
    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">{lesson ? 'Modifica Lezione' : 'Nuova Lezione'}</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
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

                {!lesson && (
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--md-divider)'}}>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                            <span className="font-medium">Ripeti questa lezione</span>
                        </label>
                        {isRecurring && (
                            <div className="mt-4 space-y-4 animate-fade-in">
                                <p className="text-sm" style={{color: 'var(--md-text-secondary)'}}>Crea lezioni multiple fino alla data di fine nei giorni selezionati.</p>
                                <div className="md-input-group">
                                    <input id="endDate" type="date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} required className="md-input"/>
                                    <label htmlFor="endDate" className="md-input-label !top-0 !text-xs !text-gray-500">Data di fine</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day, index) => (
                                        <button type="button" key={day} onClick={() => handleRecurringDayChange(index)}
                                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${recurringDays.includes(index) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-100'}`}>
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva Lezione</button>
            </div>
        </form>
    );
};


const Calendar: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

    const fetchLessons = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getLessons(); 
            setLessons(data);
        } catch (err) {
            setError("Impossibile caricare il calendario."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLessons(); }, [fetchLessons]);
    
    const handleOpenModal = (item: Lesson | null = null, date: Date | null = null) => { 
        setEditingLesson(item);
        setSelectedDate(date);
        setIsModalOpen(true); 
    };

    const handleSaveLesson = async (item: LessonInput | Lesson, isRecurring: boolean, recurringEndDate?: string, recurringDays?: number[]) => {
        if (isRecurring && !('id' in item) && recurringEndDate && recurringDays?.length) {
            const lessonsToCreate: LessonInput[] = [];
            let currentDate = new Date(item.date);
            const endDate = new Date(recurringEndDate);
            endDate.setHours(23, 59, 59, 999); // Include the end date

            while (currentDate <= endDate) {
                if (recurringDays.includes(currentDate.getDay())) {
                    lessonsToCreate.push({ ...item, date: currentDate.toISOString() });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            if (lessonsToCreate.length > 0) {
                await addLessonsBatch(lessonsToCreate);
            }
        } else if ('id' in item) { 
            await updateLesson(item.id, item); 
        } else { 
            await addLesson(item); 
        }
        setIsModalOpen(false); setEditingLesson(null); fetchLessons();
    };
    
    const handleDeleteClick = (id: string) => {
        setLessonToDelete(id);
        setIsModalOpen(false); // Close edit modal if open
    };

    const handleConfirmDelete = async () => {
        if(lessonToDelete) {
            await deleteLesson(lessonToDelete);
            fetchLessons();
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
                  <h1 className="text-3xl font-bold">Calendario Lezioni</h1>
                  <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Pianifica le lezioni a breve e lungo termine.</p>
                </div>
                <button onClick={() => handleOpenModal(null, new Date())} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon /><span className="ml-2">Nuova Lezione</span>
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
                                {day && lessons
                                    .filter(l => new Date(l.date).toDateString() === day.toDateString())
                                    .sort((a,b) => a.startTime.localeCompare(b.startTime))
                                    .map(item => {
                                        const textColor = getTextColorForBg(item.locationColor);
                                        return (
                                            <div key={item.id}
                                                 className="p-1 rounded text-[10px] leading-tight shadow-sm flex justify-between items-center group"
                                                 style={{ backgroundColor: item.locationColor || '#f1f5f9', color: textColor }}
                                                 onClick={(e) => { e.stopPropagation(); handleOpenModal(item, day); }}>
                                                 <p className="font-bold truncate flex-1">{item.startTime} - {item.locationName}</p>
                                                 <button onClick={(e) => {e.stopPropagation(); handleDeleteClick(item.id);}} className="opacity-0 group-hover:opacity-100 ml-1 hover:text-red-600 transition-opacity" aria-label="Elimina lezione">×</button>
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
                message="Sei sicuro di voler eliminare questa lezione? L'azione non può essere annullata."
                isDangerous={true}
            />
        </div>
    );
};

export default Calendar;
