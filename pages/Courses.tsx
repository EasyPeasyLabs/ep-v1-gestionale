import React, { useState, useEffect } from 'react';
import { Location, Course, SlotType } from '../types';
import * as courseService from '../services/courseService';
import FullScreenSpinner from '../components/FullScreenSpinner';
import { toast } from 'react-hot-toast';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';

const Courses: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form State for New Course
    const [newCourse, setNewCourse] = useState<any>({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        slotType: 'LAB',
        minAge: 3,
        maxAge: 14,
        capacity: 10
    });

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
        try {
            await courseService.createCourse({ 
                ...newCourse, 
                locationId: selectedLocationId,
                status: 'open'
            });
            toast.success("Corso aggiunto");
            setIsAddModalOpen(false);
            fetchCourses();
        } catch (error) {
            toast.error("Errore salvataggio");
        }
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
                <Modal onClose={() => setIsAddModalOpen(false)}>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-black text-gray-900">Nuovo Corso</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Giorno</label>
                                <select 
                                    className="md-input w-full"
                                    value={newCourse.dayOfWeek}
                                    onChange={(e) => setNewCourse({ ...newCourse, dayOfWeek: parseInt(e.target.value) })}
                                >
                                    {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Tipo</label>
                                <select 
                                    className="md-input w-full"
                                    value={newCourse.slotType}
                                    onChange={(e) => setNewCourse({ ...newCourse, slotType: e.target.value })}
                                >
                                    <option value="LAB">Laboratorio</option>
                                    <option value="SG">Spazio Gioco</option>
                                    <option value="EVT">Evento</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Inizio</label>
                                <input type="time" className="md-input w-full" value={newCourse.startTime} onChange={(e) => setNewCourse({ ...newCourse, startTime: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fine</label>
                                <input type="time" className="md-input w-full" value={newCourse.endTime} onChange={(e) => setNewCourse({ ...newCourse, endTime: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Età Min</label>
                                <input type="number" className="md-input w-full" value={newCourse.minAge} onChange={(e) => setNewCourse({ ...newCourse, minAge: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Età Max</label>
                                <input type="number" className="md-input w-full" value={newCourse.maxAge} onChange={(e) => setNewCourse({ ...newCourse, maxAge: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Capienza</label>
                                <input type="number" className="md-input w-full" value={newCourse.capacity} onChange={(e) => setNewCourse({ ...newCourse, capacity: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="pt-6 border-t flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="md-btn md-btn-flat">Annulla</button>
                            <button onClick={handleAddCourse} className="md-btn md-btn-raised md-btn-green">Salva Corso</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Courses;
