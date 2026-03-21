import React, { useState, useEffect } from 'react';
import { Location, Course, SlotType, Note } from '../types';
import * as courseService from '../services/courseService';
import FullScreenSpinner from '../components/FullScreenSpinner';
import { toast } from 'react-hot-toast';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';

const Courses: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // New structured state for the 5 columns
    const [dayOfWeek, setDayOfWeek] = useState(1);
    const [activeType, setActiveType] = useState<SlotType>('LAB');
    const [configs, setConfigs] = useState<Record<SlotType, any>>({
        LAB: { quantity: 1, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        SG: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        'LAB+SG': { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        READ: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        EVT: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
    });

    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const locs = await courseService.getLocations();
                setLocations(locs);
                if (locs.length > 0) {
                    setSelectedLocationId(locs[0].id);
                }
            } catch (error) {
                toast.error("Errore caricamento sedi");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedLocationId) {
            fetchCourses();
        } else {
            setCourses([]);
        }
    }, [selectedLocationId]);

    const fetchCourses = async () => {
        setLoadingCourses(true);
        try {
            const data = await courseService.getCoursesByLocation(selectedLocationId);
            setCourses(data);
        } catch (error) {
            toast.error("Errore caricamento corsi");
        } finally {
            setLoadingCourses(false);
        }
    };

    const handleToggleStatus = async (courseId: string, status: 'open' | 'closed') => {
        try {
            await courseService.toggleCourseStatus(courseId, status);
            toast.success("Stato aggiornato");
            fetchCourses();
        } catch (error) {
            toast.error("Errore aggiornamento");
        }
    };

    const handleAddCourse = async () => {
        if (!selectedLocationId) return;
        const config = configs[activeType];
        try {
            const courseData = {
                dayOfWeek,
                slotType: activeType,
                startTime: config.startTime,
                endTime: config.endTime,
                minAge: config.minAge,
                maxAge: config.maxAge,
                capacity: config.capacity,
                locationId: selectedLocationId,
                status: 'open' as const
            };

            if (editingCourseId) {
                await courseService.updateCourse(editingCourseId, courseData);
                toast.success("Corso aggiornato");
            } else {
                await courseService.createCourse(courseData);
                toast.success("Corso aggiunto");
            }

            setIsAddModalOpen(false);
            setEditingCourseId(null);
            fetchCourses();
        } catch (error) {
            toast.error("Errore salvataggio");
        }
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourseId(course.id);
        setDayOfWeek(course.dayOfWeek);
        setActiveType(course.slotType);
        setConfigs(prev => ({
            ...prev,
            [course.slotType]: {
                quantity: 1, // Defaulting to 1 for active
                startTime: course.startTime,
                endTime: course.endTime,
                minAge: course.minAge,
                maxAge: course.maxAge,
                capacity: course.capacity
            }
        }));
        setIsAddModalOpen(true);
    };

    const handleDeleteCourse = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo corso?")) return;
        try {
            await courseService.deleteCourse(id);
            toast.success("Corso eliminato");
            fetchCourses();
        } catch (error) {
            toast.error("Errore eliminazione");
        }
    };

    if (loading) return <FullScreenSpinner />;

    const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">Gestione Corsi</h1>
                    <p className="text-gray-500 font-medium">Configurazione fessure e disponibilità per sede</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="md-input min-w-[250px]"
                    >
                        <option value="">Seleziona una sede...</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>
                        ))}
                    </select>
                    {selectedLocationId && (
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="md-btn md-btn-raised md-btn-green py-2 px-4 whitespace-nowrap"
                        >
                            <PlusIcon />
                            <span className="ml-2 font-bold uppercase tracking-wider text-xs">Nuovo Corso</span>
                        </button>
                    )}
                </div>
            </header>

            {selectedLocationId ? (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Giorno</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Orario</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Età</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Occupazione</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingCourses ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium italic">Caricamento corsi...</td>
                                    </tr>
                                ) : courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium italic">Nessun corso configurato per questa sede</td>
                                    </tr>
                                ) : (
                                    courses.map(course => (
                                        <tr key={course.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900">{days[course.dayOfWeek]}</td>
                                            <td className="px-6 py-4 text-gray-600 font-medium">{course.startTime} - {course.endTime}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                                                    ${course.slotType === 'LAB' ? 'bg-indigo-50 text-indigo-600' : 
                                                      course.slotType === 'SG' ? 'bg-emerald-50 text-emerald-600' : 
                                                      course.slotType === 'LAB+SG' ? 'bg-purple-50 text-purple-600' :
                                                      course.slotType === 'READ' ? 'bg-blue-50 text-blue-600' :
                                                      'bg-amber-50 text-amber-600'}`}
                                                >
                                                    {course.slotType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-medium">{course.minAge} - {course.maxAge} anni</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-gray-900">
                                                            {course.activeEnrollmentsCount || 0} /
                                                        </span>
                                                        <input 
                                                            type="number" 
                                                            defaultValue={course.capacity}
                                                            onBlur={async (e) => {
                                                                const newCap = parseInt(e.target.value);
                                                                if (!isNaN(newCap) && newCap !== course.capacity) {
                                                                    try {
                                                                        await courseService.updateCourse(course.id, { capacity: newCap });
                                                                        toast.success("Capienza aggiornata");
                                                                        fetchCourses();
                                                                    } catch (err) {
                                                                        toast.error("Errore aggiornamento");
                                                                    }
                                                                }
                                                            }}
                                                            className="w-16 px-2 py-1 text-sm font-bold border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                (course.activeEnrollmentsCount / (course.capacity || 1)) > 0.8 ? 'bg-red-500' : 
                                                                (course.activeEnrollmentsCount / (course.capacity || 1)) > 0.5 ? 'bg-amber-500' : 
                                                                'bg-indigo-500'
                                                            }`}
                                                            style={{ width: `${Math.min(100, ((course.activeEnrollmentsCount || 0) / (course.capacity || 1)) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleToggleStatus(course.id, course.status)}
                                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
                                                            ${course.status === 'open' 
                                                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' 
                                                                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'}`}
                                                    >
                                                        {course.status === 'open' ? 'Sospendi' : 'Riattiva'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEditCourse(course)}
                                                        className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                    >
                                                        <div className="w-4 h-4"><PencilIcon/></div>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCourse(course.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <div className="w-4 h-4"><TrashIcon /></div>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">Seleziona una sede per gestire i corsi</p>
                </div>
            )}

            {isAddModalOpen && (
                <Modal onClose={() => { setIsAddModalOpen(false); setEditingCourseId(null); }} size="xl">
                    <div className="p-8 space-y-8 min-w-[900px]">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-gray-900">{editingCourseId ? 'Modifica Corso' : 'Nuovo Corso'}</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Giorno</label>
                                <select 
                                    className="md-input w-full bg-gray-50/50 border-gray-100"
                                    value={dayOfWeek}
                                    onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                                >
                                    {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tipo Principale</label>
                                <select 
                                    className="md-input w-full bg-gray-50/50 border-gray-100"
                                    value={activeType}
                                    onChange={(e) => {
                                        const newType = e.target.value as SlotType;
                                        setActiveType(newType);
                                        // Update quantity logic: only active has 1, others 0
                                        setConfigs(prev => {
                                            const next = { ...prev };
                                            Object.keys(next).forEach(k => {
                                                next[k as SlotType].quantity = (k === newType ? 1 : 0);
                                            });
                                            return next;
                                        });
                                    }}
                                >
                                    <option value="LAB">Laboratorio</option>
                                    <option value="SG">Spazio Gioco</option>
                                    <option value="LAB+SG">Lab + Spazio Gioco</option>
                                    <option value="READ">Lettura (READ)</option>
                                    <option value="EVT">Evento</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Configurazione Slot Ammessi</h3>
                            </div>
                            
                            <div className="grid grid-cols-5 gap-3">
                                {(Object.keys(configs) as SlotType[]).map(type => {
                                    const isActive = activeType === type;
                                    const config = configs[type];
                                    
                                    return (
                                        <div 
                                            key={type}
                                            className={`rounded-2xl border-2 transition-all duration-300 p-4 space-y-5
                                                ${isActive 
                                                    ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100/50 scale-[1.02] z-10' 
                                                    : 'bg-gray-50/50 border-gray-100 opacity-60 grayscale-[0.5]'}`}
                                        >
                                            {/* Quantity / Header */}
                                            <div className="flex flex-col items-center gap-2 pb-4 border-b border-gray-100/10">
                                                <span className={`text-[10px] font-black tracking-widest uppercase ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                    {type}
                                                </span>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-colors
                                                    ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                                    {config.quantity}
                                                </div>
                                            </div>

                                            {/* Times */}
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Inizio</label>
                                                    <input 
                                                        type="time" 
                                                        value={config.startTime} 
                                                        disabled={!isActive}
                                                        onChange={(e) => setConfigs(prev => ({ ...prev, [type]: { ...prev[type], startTime: e.target.value }}))}
                                                        className={`w-full text-center py-2 rounded-xl text-sm font-bold border-2 transition-all
                                                            ${isActive ? 'border-gray-100 focus:border-indigo-500 bg-white' : 'border-transparent bg-transparent'}`}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Fine</label>
                                                    <input 
                                                        type="time" 
                                                        value={config.endTime} 
                                                        disabled={!isActive}
                                                        onChange={(e) => setConfigs(prev => ({ ...prev, [type]: { ...prev[type], endTime: e.target.value }}))}
                                                        className={`w-full text-center py-2 rounded-xl text-sm font-bold border-2 transition-all
                                                            ${isActive ? 'border-gray-100 focus:border-indigo-500 bg-white' : 'border-transparent bg-transparent'}`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Ages */}
                                            <div className="space-y-2">
                                                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Età Min / Max</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={config.minAge} 
                                                        disabled={!isActive}
                                                        onChange={(e) => setConfigs(prev => ({ ...prev, [type]: { ...prev[type], minAge: parseInt(e.target.value) || 0 }}))}
                                                        className={`w-full text-center py-2 rounded-xl text-sm font-black border-2 transition-all
                                                            ${isActive ? 'border-gray-100 focus:border-indigo-500 bg-white' : 'border-transparent bg-transparent'}`}
                                                    />
                                                    <input 
                                                        type="number" 
                                                        value={config.maxAge} 
                                                        disabled={!isActive}
                                                        onChange={(e) => setConfigs(prev => ({ ...prev, [type]: { ...prev[type], maxAge: parseInt(e.target.value) || 0 }}))}
                                                        className={`w-full text-center py-2 rounded-xl text-sm font-black border-2 transition-all
                                                            ${isActive ? 'border-gray-100 focus:border-indigo-500 bg-white' : 'border-transparent bg-transparent'}`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Capacity */}
                                            <div className="space-y-1 pt-2">
                                                <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">Capienza</label>
                                                <input 
                                                    type="number" 
                                                    value={config.capacity} 
                                                    disabled={!isActive}
                                                    onChange={(e) => setConfigs(prev => ({ ...prev, [type]: { ...prev[type], capacity: parseInt(e.target.value) || 0 }}))}
                                                    className={`w-full text-center py-2 rounded-xl text-sm font-black border-2 transition-all
                                                        ${isActive ? 'border-gray-100 focus:border-indigo-500 bg-white' : 'border-transparent bg-transparent'}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-50 flex justify-between items-center gap-6">
                            {editingCourseId ? (
                                <button 
                                    onClick={() => {
                                        if (window.confirm("Sei sicuro di voler eliminare questo corso?")) {
                                            handleDeleteCourse(editingCourseId);
                                            setIsAddModalOpen(false);
                                            setEditingCourseId(null);
                                        }
                                    }}
                                    className="text-xs font-black text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest flex items-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Elimina Corso
                                </button>
                            ) : <div></div>}

                            <div className="flex items-center gap-6">
                                <button 
                                    onClick={() => { setIsAddModalOpen(false); setEditingCourseId(null); }} 
                                    className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                                >
                                    Annulla
                                </button>
                                <button 
                                  onClick={handleAddCourse} 
                                  className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-emerald-100 transition-all hover:-translate-y-0.5"
                                >
                                    Salva Corso
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Courses;
