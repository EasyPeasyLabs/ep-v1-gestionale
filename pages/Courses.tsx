import React, { useState, useEffect } from 'react';
import { Location, Course } from '../types';
import * as courseService from '../services/courseService';
import FullScreenSpinner from '../components/FullScreenSpinner';
import { toast } from 'react-hot-toast';

const Courses: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCourses, setLoadingCourses] = useState(false);

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
                                                <button 
                                                    onClick={() => handleToggleStatus(course.id, course.status)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
                                                        ${course.status === 'open' 
                                                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                            : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                                >
                                                    {course.status === 'open' ? 'Chiudi Corso' : 'Apri Corso'}
                                                </button>
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
        </div>
    );
};

export default Courses;
