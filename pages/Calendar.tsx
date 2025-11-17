import React, { useState, useEffect, useCallback } from 'react';
import { ScheduledClass, ScheduledClassInput, Supplier } from '../types';
import { getScheduledClasses, addScheduledClass, updateScheduledClass, deleteScheduledClass } from '../services/calendarService';
import { getSuppliers } from '../services/supplierService';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';

const ClassForm: React.FC<{
    classItem?: ScheduledClass | null;
    onSave: (item: ScheduledClassInput | ScheduledClass) => void;
    onCancel: () => void;
}> = ({ classItem, onSave, onCancel }) => {
    const [dayOfWeek, setDayOfWeek] = useState(classItem?.dayOfWeek || 'Lunedì');
    const [startTime, setStartTime] = useState(classItem?.startTime || '09:00');
    const [endTime, setEndTime] = useState(classItem?.endTime || '10:00');
    const [supplierId, setSupplierId] = useState(classItem?.supplierId || '');
    const [locationId, setLocationId] = useState(classItem?.locationId || '');
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedSupplier = suppliers.find(s => s.id === supplierId);

    useEffect(() => {
        const fetchSuppliersData = async () => {
            setLoading(true);
            const data = await getSuppliers();
            setSuppliers(data);
            if (data.length > 0 && !supplierId) {
                setSupplierId(data[0].id);
                if (data[0].locations.length > 0 && !locationId) {
                    setLocationId(data[0].locations[0].id);
                }
            }
            setLoading(false);
        };
        fetchSuppliersData();
    }, [supplierId, locationId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const supplier = suppliers.find(s => s.id === supplierId);
        const location = supplier?.locations.find(l => l.id === locationId);
        if (!supplier || !location) return;

        const classData = {
            dayOfWeek: dayOfWeek as ScheduledClass['dayOfWeek'], startTime, endTime, supplierId, locationId,
            supplierName: supplier.companyName, locationName: location.name, locationColor: location.color,
        };

        if (classItem?.id) { onSave({ ...classData, id: classItem.id }); } 
        else { onSave(classData); }
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;
    
    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">{classItem ? 'Modifica Lezione' : 'Nuova Lezione'}</h2>
            <div className="space-y-4">
                 <div className="md-input-group">
                    <select id="day" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value as ScheduledClass['dayOfWeek'])} className="md-input">
                        {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <label htmlFor="day" className="md-input-label !top-0 !text-xs !text-gray-500">Giorno</label>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="md-input"/><label htmlFor="start" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Inizio</label></div>
                    <div className="md-input-group"><input id="end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="md-input"/><label htmlFor="end" className="md-input-label !top-0 !text-xs !text-gray-500">Orario Fine</label></div>
                </div>
                 <div className="md-input-group">
                    <select id="supplier" value={supplierId} onChange={e => {setSupplierId(e.target.value); setLocationId('');}} required className="md-input">
                        {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.companyName}</option>)}
                    </select>
                    <label htmlFor="supplier" className="md-input-label !top-0 !text-xs !text-gray-500">Fornitore</label>
                </div>
                 <div className="md-input-group">
                    <select id="location" value={locationId} onChange={e => setLocationId(e.target.value)} required disabled={!selectedSupplier || selectedSupplier.locations.length === 0} className="md-input">
                       {selectedSupplier?.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>)}
                    </select>
                    <label htmlFor="location" className="md-input-label !top-0 !text-xs !text-gray-500">Sede</label>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva Lezione</button>
            </div>
        </form>
    );
};


const Calendar: React.FC = () => {
    const [classes, setClasses] = useState<ScheduledClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null);

    const daysOfWeek: ScheduledClass['dayOfWeek'][] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

    const fetchClasses = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getScheduledClasses(); setClasses(data);
        } catch (err) {
            setError("Impossibile caricare il calendario."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchClasses(); }, [fetchClasses]);
    
    const handleOpenModal = (item: ScheduledClass | null = null) => { setEditingClass(item); setIsModalOpen(true); };

    const handleSaveClass = async (item: ScheduledClassInput | ScheduledClass) => {
        if ('id' in item) { await updateScheduledClass(item.id, item); } 
        else { await addScheduledClass(item); }
        setIsModalOpen(false); setEditingClass(null); fetchClasses();
    };
    
    const handleDeleteClass = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questa lezione programmata?")) {
            await deleteScheduledClass(id); fetchClasses();
        }
    };

    const getTextColorForBg = (bgColor?: string) => {
        if (!bgColor) return '#212121'; // --md-text-primary
        const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
        const r = parseInt(color.substring(0, 2), 16), g = parseInt(color.substring(2, 4), 16), b = parseInt(color.substring(4, 6), 16);
        return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#212121' : '#ffffff';
    };

    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold">Calendario Lezioni</h1>
                  <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Programma le lezioni settimanali.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon /><span className="ml-2">Nuova Lezione</span>
                </button>
            </div>
            
            <div className="mt-8">
                 {loading ? <div className="flex justify-center items-center py-8"><Spinner /></div> :
                 error ? <p className="text-center text-red-500 py-8">{error}</p> :
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    {daysOfWeek.map(day => (
                        <div key={day} className="bg-white p-4 rounded-lg shadow-md min-h-[200px]" style={{backgroundColor: 'var(--md-bg-card)'}}>
                            <h2 className="text-center font-bold border-b pb-2 mb-4" style={{color: 'var(--md-primary)', borderColor: 'var(--md-divider)'}}>{day}</h2>
                            <div className="space-y-3">
                                {classes.filter(c => c.dayOfWeek === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(item => {
                                    const textColor = getTextColorForBg(item.locationColor);
                                    return (
                                    <div key={item.id} className="p-3 rounded-lg relative group shadow-sm" style={{ backgroundColor: item.locationColor || '#f1f5f9' }}>
                                        <p className="font-semibold text-sm" style={{ color: textColor }}>{item.startTime} - {item.endTime}</p>
                                        <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.9 }}>{item.locationName}</p>
                                        <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>{item.supplierName}</p>
                                        <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(item)} className="p-1 rounded-full bg-white/50 hover:bg-white md-icon-btn edit" aria-label="Modifica lezione"><PencilIcon/></button>
                                            <button onClick={() => handleDeleteClass(item.id)} className="p-1 rounded-full bg-white/50 hover:bg-white md-icon-btn delete" aria-label="Elimina lezione"><TrashIcon/></button>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                 </div>
                 }
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)}>
                    <ClassForm classItem={editingClass} onSave={handleSaveClass} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}
        </div>
    );
};

export default Calendar;