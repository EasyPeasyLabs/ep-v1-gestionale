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
import ProfileIcon from '../components/icons/ProfileIcon';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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
    const [weeklyPlan, setWeeklyPlan] = useState<Record<number, SlotType>>({
        1: 'LAB', 2: 'LAB', 3: 'SG', 4: 'SG', 5: 'SG'
    });
    const [configs, setConfigs] = useState<Partial<Record<SlotType, any>>>({
        LAB: { quantity: 1, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        SG: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        READ: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        EVT: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
    });

    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<{ id: string, name: string } | null>(null);
    const [enrolledStudents, setEnrolledStudents] = useState<{ name: string, remaining: number }[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    const fetchEnrolledStudents = async (courseId: string, courseName: string) => {
        setSelectedCourseForStudents({ id: courseId, name: courseName });
        setIsLoadingStudents(true);
        try {
            const q = query(
                collection(db, 'enrollments'),
                where('courseId', '==', courseId)
            );
            const snap = await getDocs(q);
            const students = snap.docs
                .map((doc: any) => ({
                    name: doc.data().childName,
                    status: doc.data().status,
                    remaining: doc.data().lessonsRemaining !== undefined ? doc.data().lessonsRemaining : (doc.data().labRemaining || 0)
                }))
                .filter((s: any) => ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(s.status) && s.remaining > 0);
            setEnrolledStudents(students);
        } catch (error) {
            console.error("Errore recupero allievi:", error);
            toast.error("Errore recupero allievi");
        } finally {
            setIsLoadingStudents(false);
        }
    };

    useEffect(() => {
        if (selectedLocationId) {
            fetchCourses();
        } else {
            setCourses([]);
        }
    }, [selectedLocationId]);

    const [isRealigning, setIsRealigning] = useState(false);

    const realignAllOccupancy = async () => {
        if (!window.confirm("Questa operazione ricalcolerà l'occupazione reale di tutti i corsi basandosi sulle iscrizioni attive. Procedere?")) return;
        setIsRealigning(true);
        try {
            const coursesSnap = await getDocs(collection(db, 'courses'));
            let updatedCount = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const courseDoc of coursesSnap.docs) {
                const courseId = courseDoc.id;
                const courseData = courseDoc.data();

                // --- QUERY 1: NUOVO MODELLO (con courseId) ---
                const qNew = query(
                    collection(db, 'enrollments'),
                    where('courseId', '==', courseId),
                    where('status', 'in', ['active', 'confirmed', 'pending']),
                    where('endDate', '>=', today)
                );
                const snapNew = await getDocs(qNew);
                const newModelCount = snapNew.docs.filter(d => (d.data().lessonsRemaining || 0) > 0).length;

                // --- QUERY 2: MODELLO LEGACY (senza courseId, matching fuzzy) ---
                // Questa query è più ampia e richiede un filtro JS aggiuntivo
                const qLegacy = query(
                    collection(db, 'enrollments'),
                    where('locationId', '==', courseData.locationId),
                    where('status', 'in', ['active', 'confirmed', 'pending']),
                    where('endDate', '>=', today)
                );
                const snapLegacy = await getDocs(qLegacy);
                
                const daysMap: Record<number, string> = { 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì', 4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato', 0: 'Domenica' };
                const targetDayName = daysMap[courseData.dayOfWeek];

                const legacyModelCount = snapLegacy.docs.filter(d => {
                    const data = d.data();
                    if (data.courseId) return false; // Già conteggiato nel nuovo modello

                    const remaining = (data.lessonsRemaining || 0) + (data.labRemaining || 0) + (data.sgRemaining || 0) + (data.evtRemaining || 0);
                    if (remaining <= 0) return false;

                    const enrDayRaw = data.selectedSlot?.dayOfWeek || data.dayOfWeek || data.giorno;
                    let matchDay = false;
                    if (typeof enrDayRaw === 'number') matchDay = enrDayRaw === courseData.dayOfWeek;
                    else if (typeof enrDayRaw === 'string') matchDay = enrDayRaw.toLowerCase().startsWith(targetDayName.substring(0,3).toLowerCase());

                    const enrTypeRaw = data.selectedSlot?.type || data.slotType || data.type || data.tipo;
                    let matchType = false;
                    if (enrTypeRaw) {
                        const cleanEnrType = String(enrTypeRaw).toUpperCase();
                        const cleanTargetType = String(courseData.slotType).toUpperCase();
                        matchType = cleanEnrType.includes(cleanTargetType) || cleanTargetType.includes(cleanEnrType);
                    }
                    
                    return matchDay && matchType;
                }).length;

                const realCount = newModelCount + legacyModelCount;

                if ((courseData.activeEnrollmentsCount || 0) !== realCount) {
                    await updateDoc(doc(db, 'courses', courseId), {
                        activeEnrollmentsCount: realCount,
                        lastManualSyncAt: new Date().toISOString()
                    });
                    updatedCount++;
                }
            }
            toast.success(`Riallineamento completato: ${updatedCount} corsi aggiornati.`);
            if (updatedCount > 0) fetchCourses();
        } catch (error) {
            console.error("Errore riallineamento:", error);
            toast.error("Errore durante il riallineamento. Controlla gli indici Firestore.");
        } finally {
            setIsRealigning(false);
        }
    };

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
        if (!selectedLocationId || isSaving) return;
        setIsSaving(true);
        const mainConfig = configs[activeType];
        try {
            const courseData: any = {
                dayOfWeek,
                slotType: activeType,
                startTime: mainConfig.startTime,
                endTime: mainConfig.endTime,
                minAge: mainConfig.minAge,
                maxAge: mainConfig.maxAge,
                capacity: mainConfig.capacity,
                locationId: selectedLocationId,
                status: 'open' as const
            };

            if (activeType === 'LAB+SG') {
                courseData.comboConfigs = {
                    LAB: { 
                        startTime: configs.LAB.startTime, 
                        endTime: configs.LAB.endTime, 
                        minAge: configs.LAB.minAge, 
                        maxAge: configs.LAB.maxAge, 
                        capacity: configs.LAB.capacity 
                    },
                    SG: { 
                        startTime: configs.SG.startTime, 
                        endTime: configs.SG.endTime, 
                        minAge: configs.SG.minAge, 
                        maxAge: configs.SG.maxAge, 
                        capacity: configs.SG.capacity 
                    }
                };
                courseData.weeklyPlan = weeklyPlan;
                courseData.startTime = configs.LAB.startTime;
                courseData.endTime = configs.LAB.endTime;
                courseData.capacity = Math.max(configs.LAB.capacity, configs.SG.capacity);
            }

            if (editingCourseId) {
                await courseService.updateCourse(editingCourseId, courseData);
                toast.success("Corso aggiornato correttamente");
            } else {
                await courseService.createCourse(courseData);
                toast.success("Corso aggiunto correttamente");
            }

            setIsAddModalOpen(false);
            setEditingCourseId(null);
            setWeeklyPlan({ 1: 'LAB', 2: 'LAB', 3: 'SG', 4: 'SG', 5: 'SG' });
            fetchCourses();
        } catch (error: any) {
            console.error("Errore salvataggio corso:", error);
            toast.error("Errore salvataggio: " + (error.message || "riprova più tardi"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourseId(course.id);
        setDayOfWeek(course.dayOfWeek);
        setActiveType(course.slotType);
        if (course.weeklyPlan) {
            setWeeklyPlan(course.weeklyPlan);
        } else {
            setWeeklyPlan({ 1: 'LAB', 2: 'LAB', 3: 'SG', 4: 'SG', 5: 'SG' });
        }
        
        const newConfigs = { ...configs };
        
        // Reset quantities
        Object.keys(newConfigs).forEach(k => {
            newConfigs[k as SlotType].quantity = 0;
        });

        if (course.slotType === 'LAB+SG' && course.comboConfigs) {
            newConfigs.LAB = { 
                quantity: 1, 
                ...course.comboConfigs.LAB 
            };
            newConfigs.SG = { 
                quantity: 1, 
                ...course.comboConfigs.SG 
            };
        } else {
            newConfigs[course.slotType] = {
                quantity: 1,
                startTime: course.startTime,
                endTime: course.endTime,
                minAge: course.minAge,
                maxAge: course.maxAge,
                capacity: course.capacity
            };
        }
        
        setConfigs(newConfigs);
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
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Gestione Corsi</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-gray-500 font-medium">Configurazione fessure e disponibilità per sede</p>
                        <button 
                            onClick={realignAllOccupancy}
                            disabled={isRealigning}
                            className={`px-3 py-1 border rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-sm
                                ${isRealigning 
                                    ? 'bg-gray-50 text-gray-400 border-gray-100 italic' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300'}`}
                        >
                            {isRealigning ? '⏳ Ricalcolo in corso...' : '⚡ Ricalcola Occupazione'}
                        </button>
                    </div>
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
                                                            className="w-12 px-1.5 py-0.5 text-sm font-bold border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                            min="0"
                                                        />
                                                        <button 
                                                            onClick={() => fetchEnrolledStudents(course.id, `${days[course.dayOfWeek]} ${course.startTime}`)}
                                                            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            title="Vedi iscritti"
                                                        >
                                                            <div className="w-4 h-4"><ProfileIcon /></div>
                                                        </button>
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                ((course.activeEnrollmentsCount || 0) / (course.capacity || 1)) > 0.8 ? 'bg-red-500' : 
                                                                ((course.activeEnrollmentsCount || 0) / (course.capacity || 1)) > 0.5 ? 'bg-amber-500' : 
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
                    <div className="flex flex-col max-h-[90vh]">
                        {/* Header Fisso */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20 rounded-t-3xl">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                {editingCourseId ? 'Modifica Corso' : 'Nuovo Corso'}
                            </h2>
                        </div>

                        {/* Area Contenuto Scrollabile */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            setConfigs(prev => {
                                                const next = { ...prev };
                                                Object.keys(next).forEach(k => {
                                                    const slotK = k as SlotType;
                                                    if (newType === 'LAB+SG') {
                                                        next[slotK].quantity = (slotK === 'LAB' || slotK === 'SG') ? 1 : 0;
                                                    } else {
                                                        next[slotK].quantity = (slotK === newType ? 1 : 0);
                                                    }
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

                                {activeType === 'LAB+SG' && (
                                <div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 space-y-6 animate-fade-in shadow-inner">
                                   <div className="flex items-center justify-between">
                                       <div className="flex flex-col">
                                           <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-1 pl-1">Pianificazione Mensile (Settimane)</h3>
                                           <p className="text-[9px] text-indigo-400 font-bold italic pl-1">Stabilisci l'alternanza attività per ogni settimana del mese</p>
                                       </div>
                                       <div className="flex gap-1.5 p-1 bg-white/50 rounded-2xl border border-indigo-100">
                                           {[1, 2, 3, 4, 5].map((week) => (
                                               <div key={week} className="flex flex-col items-center gap-1.5 p-2 min-w-[64px] rounded-xl border border-indigo-50 bg-white shadow-sm">
                                                   <span className="text-[8px] font-black text-indigo-300 uppercase">Sett. {week}</span>
                                                   <button
                                                       type="button"
                                                       onClick={() => setWeeklyPlan(prev => ({ ...prev, [week]: prev[week] === 'LAB' ? 'SG' : 'LAB' }))}
                                                       className={`w-full py-2.5 rounded-lg text-[10px] font-black transition-all duration-300 transform active:scale-95
                                                           ${weeklyPlan[week] === 'LAB' 
                                                               ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                                               : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'}`}
                                                   >
                                                       {weeklyPlan[week]}
                                                   </button>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                                </div>
                                )}

                                <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Configurazione Slot Ammessi</h3>
                                </div>                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {(Object.keys(configs) as SlotType[]).map(type => {
                                        const isActive = activeType === type || (activeType === 'LAB+SG' && (type === 'LAB' || type === 'SG'));
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
                        </div>

                        {/* Footer Fisso */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center sticky bottom-0 z-20 rounded-b-3xl">
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
                                  disabled={isSaving}
                                  className={`px-8 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-lg transition-all flex items-center gap-2
                                    ${isSaving 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100 hover:-translate-y-0.5'}`}
                                >
                                    {isSaving && (
                                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin"></div>
                                    )}
                                    {isSaving ? 'Salvataggio...' : 'Salva Corso'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {selectedCourseForStudents && (
                <Modal 
                    onClose={() => setSelectedCourseForStudents(null)} 
                    size="md"
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Allievi Iscritti - {selectedCourseForStudents.name}
                            </h2>
                        </div>
                        {isLoadingStudents ? (
                            <div className="flex justify-center py-8"><Spinner /></div>
                        ) : enrolledStudents.length === 0 ? (
                            <p className="text-center text-gray-400 italic py-8 text-sm">Nessun allievo con lezioni residue trovato per questo corso.</p>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Elenco Allievi Attivi ({enrolledStudents.length})</p>
                                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                                    {enrolledStudents.map((s, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <span className="font-bold text-gray-800 text-sm">{s.name}</span>
                                            <span className="px-2 py-1 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase">
                                                {s.remaining} lez. residue
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-8 flex justify-end">
                            <button onClick={() => setSelectedCourseForStudents(null)} className="md-btn md-btn-flat">Chiudi</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Courses;
