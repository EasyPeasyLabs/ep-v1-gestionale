import React, { useState, useEffect } from 'react';
import { Location, Course, SlotType, RecurrenceConfig } from '../types';
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
import { collection, query, where, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';

interface CourseConfig {
    quantity: number;
    startTime: string;
    endTime: string;
    minAge: number;
    maxAge: number;
    capacity: number;
}

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
    const [configs, setConfigs] = useState<Record<SlotType, CourseConfig>>({
        LAB: { quantity: 1, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        SG: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        READ: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        EVT: { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
        'LAB+SG': { quantity: 0, startTime: '09:00', endTime: '10:00', minAge: 3, maxAge: 14, capacity: 10 },
    });
    
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const [isAdvancedRecurrence, setIsAdvancedRecurrence] = useState(false);
    const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({
        type: 'monthly_pattern',
        activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
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
                .map((docSnap) => {
                    const data = docSnap.data();
                    return {
                        name: data.childName as string,
                        status: data.status as string,
                        remaining: (data.lessonsRemaining !== undefined ? data.lessonsRemaining : (data.labRemaining || 0)) as number
                    };
                })
                .filter((s) => ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(s.status) && s.remaining > 0);
            setEnrolledStudents(students);
        } catch (error) {
            console.error("Errore recupero allievi:", error);
            toast.error("Errore recupero allievi");
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const fetchCourses = React.useCallback(async () => {
        setLoadingCourses(true);
        try {
            const data = await courseService.getCoursesByLocation(selectedLocationId);
            setCourses(data);
        } catch (error) {
            toast.error("Errore caricamento corsi");
        } finally {
            setLoadingCourses(false);
        }
    }, [selectedLocationId]);

    useEffect(() => {
        if (selectedLocationId) {
            fetchCourses();
        } else {
            setCourses([]);
        }
    }, [selectedLocationId, fetchCourses]);

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
                    if (data.courseId && data.courseId !== 'manual') return false; // Already counted in new model

                    const remaining = (data.lessonsRemaining || 0) + (data.labRemaining || 0) + (data.sgRemaining || 0) + (data.evtRemaining || 0);
                    if (remaining <= 0) return false;

                    const enrDayRaw = data.selectedSlot?.dayOfWeek || data.dayOfWeek || data.giorno;
                    let matchDay = false;
                    if (typeof enrDayRaw === 'number') matchDay = enrDayRaw === courseData.dayOfWeek;
                    else if (typeof enrDayRaw === 'string') {
                        const dayStr = enrDayRaw.toLowerCase();
                        matchDay = dayStr.startsWith(targetDayName.substring(0,3).toLowerCase()) || 
                                   dayStr === targetDayName.toLowerCase();
                    }

                    const enrTypeRaw = data.selectedSlot?.type || data.slotType || data.type || data.tipo || data.subscriptionName;
                    let matchType = false;
                    if (enrTypeRaw) {
                        const cleanEnrType = String(enrTypeRaw).toUpperCase();
                        const cleanTargetType = String(courseData.slotType).toUpperCase();
                        // Broad match for combo types
                        matchType = cleanEnrType.includes(cleanTargetType) || 
                                    cleanTargetType.includes(cleanEnrType) ||
                                    (cleanTargetType === 'LAB+SG' && (cleanEnrType.includes('LAB') || cleanEnrType.includes('SG')));
                    }
                    
                    // Also check time if available to be more precise
                    const enrTime = data.selectedSlot?.startTime || data.startTime || data.ora;
                    let matchTime = true; // Default to true if not specified in legacy
                    if (enrTime && courseData.startTime) {
                        matchTime = String(enrTime).startsWith(courseData.startTime.substring(0, 2));
                    }

                    return matchDay && matchType && matchTime;
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
        
        // Impact Analysis: Se stiamo modificando un corso esistente con ricorrenza avanzata
        if (editingCourseId && isAdvancedRecurrence) {
            const activeMonths = recurrenceConfig.activeMonths || [];
            const conflicts = await courseService.checkCourseConflicts(editingCourseId, activeMonths);
            
            if (conflicts.length > 0) {
                const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
                const conflictMsg = conflicts.map(c => `${monthNames[c.month-1]} (${c.count} iscritti)`).join(', ');
                
                const confirmed = window.confirm(
                    `ATTENZIONE: Stai disattivando mesi in cui sono presenti iscrizioni attive: ${conflictMsg}.\n\n` +
                    `Le lezioni per questi mesi verranno rimosse e gli iscritti non risulteranno più in calendario.\n` +
                    `Desideri procedere comunque?`
                );
                
                if (!confirmed) return;
            }
        }

        setIsSaving(true);
        
        // FIX: Se il tipo è LAB+SG, usiamo LAB come config di riferimento principale per evitare undefined
        const mainConfig = activeType === 'LAB+SG' ? configs.LAB : configs[activeType];
        
        try {
            const courseData: Omit<Course, 'id' | 'activeEnrollmentsCount'> = {
                dayOfWeek,
                slotType: activeType,
                startTime: mainConfig.startTime,
                endTime: mainConfig.endTime,
                minAge: mainConfig.minAge,
                maxAge: mainConfig.maxAge,
                capacity: mainConfig.capacity,
                locationId: selectedLocationId,
                status: 'open' as const,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                recurrenceConfig: isAdvancedRecurrence ? recurrenceConfig : undefined
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
                
                // Use the configured LAB+SG slot times for the main course document
                courseData.startTime = configs['LAB+SG'].startTime;
                courseData.endTime = configs['LAB+SG'].endTime;
                courseData.capacity = configs['LAB+SG'].capacity || Math.max(configs.LAB.capacity, configs.SG.capacity);
            }

            if (editingCourseId) {
                await courseService.updateCourse(editingCourseId, courseData);
                toast.success("Corso aggiornato correttamente");
                
                // Sincronizza lezioni se ci sono date
                if (startDate && endDate) {
                    const loc = locations.find(l => l.id === selectedLocationId);
                    if (loc) {
                        await courseService.syncCourseLessons(editingCourseId, { ...courseData, id: editingCourseId } as Course, loc.name, loc.color);
                    }
                }
            } else {
                const newCourseId = await courseService.createCourse(courseData);
                toast.success("Corso aggiunto correttamente");
                
                // Genera lezioni se ci sono date
                if (startDate && endDate) {
                    const loc = locations.find(l => l.id === selectedLocationId);
                    if (loc) {
                        await courseService.generateCourseLessons(newCourseId, { ...courseData, id: newCourseId } as Course, loc.name, loc.color);
                    }
                }
            }

            setIsAddModalOpen(false);
            setEditingCourseId(null);
            // Reset sicuro delle configurazioni
            setConfigs(prev => {
                const reset = { ...prev };
                Object.keys(reset).forEach(k => {
                    const type = k as SlotType;
                    if (reset[type]) reset[type].quantity = 0;
                });
                return reset;
            });
            setWeeklyPlan({ 1: 'LAB', 2: 'LAB', 3: 'SG', 4: 'SG', 5: 'SG' });
            fetchCourses();
        } catch (error) {
            console.error("Errore salvataggio corso:", error);
            const message = error instanceof Error ? error.message : "riprova più tardi";
            toast.error("Errore salvataggio: " + message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourseId(course.id);
        setDayOfWeek(course.dayOfWeek);
        setActiveType(course.slotType);
        setStartDate(course.startDate || '');
        setEndDate(course.endDate || '');
        
        if (course.recurrenceConfig) {
            setIsAdvancedRecurrence(true);
            setRecurrenceConfig(course.recurrenceConfig);
        } else {
            setIsAdvancedRecurrence(false);
            setRecurrenceConfig({
                type: 'monthly_pattern',
                activeMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
            });
        }

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
                startTime: course.comboConfigs.LAB?.startTime || '09:00',
                endTime: course.comboConfigs.LAB?.endTime || '10:00',
                minAge: course.comboConfigs.LAB?.minAge || 3,
                maxAge: course.comboConfigs.LAB?.maxAge || 14,
                capacity: course.comboConfigs.LAB?.capacity || 10
            };
            newConfigs.SG = { 
                quantity: 1, 
                startTime: course.comboConfigs.SG?.startTime || '09:00',
                endTime: course.comboConfigs.SG?.endTime || '10:00',
                minAge: course.comboConfigs.SG?.minAge || 3,
                maxAge: course.comboConfigs.SG?.maxAge || 14,
                capacity: course.comboConfigs.SG?.capacity || 10
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
        if (!confirm("Sei sicuro di voler eliminare questo corso? Tutte le lezioni future verranno rimosse.")) return;
        try {
            // Elimina lezioni future
            const now = new Date().toISOString();
            const q = query(
                collection(db, 'lessons'),
                where('courseId', '==', id),
                where('date', '>=', now)
            );
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            await courseService.deleteCourse(id);
            toast.success("Corso e lezioni future eliminati");
            fetchCourses();
        } catch (error) {
            console.error("Errore eliminazione:", error);
            toast.error("Errore eliminazione");
        }
    };

    if (loading) return <FullScreenSpinner />;

    const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Gestione Corsi</h1>
                        <p className="text-gray-500 font-medium text-sm md:text-base">Configurazione fessure e disponibilità per sede</p>
                    </div>
                    <button 
                        onClick={realignAllOccupancy}
                        disabled={isRealigning}
                        className={`self-start sm:self-center px-3 py-2 border rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-sm
                            ${isRealigning 
                                ? 'bg-gray-50 text-gray-400 border-gray-100 italic' 
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300'}`}
                    >
                        {isRealigning ? '⏳ Ricalcolo...' : '⚡ Ricalcola Occupazione'}
                    </button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1">
                        <select 
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                            className="md-input w-full"
                        >
                            <option value="">Seleziona una sede...</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>
                            ))}
                        </select>
                    </div>
                    {selectedLocationId && (
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="md-btn md-btn-raised md-btn-green py-3 sm:py-2 px-4 whitespace-nowrap justify-center"
                        >
                            <PlusIcon />
                            <span className="ml-2 font-bold uppercase tracking-wider text-xs">Nuovo Corso</span>
                        </button>
                    )}
                </div>
            </header>

            {selectedLocationId ? (
                <div className="space-y-4">
                    {/* Mobile View: Cards */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {loadingCourses ? (
                            <div className="p-12 text-center text-gray-400 font-medium italic bg-white rounded-3xl border border-gray-100">Caricamento corsi...</div>
                        ) : courses.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 font-medium italic bg-white rounded-3xl border border-gray-100">Nessun corso configurato</div>
                        ) : (
                            courses.map(course => (
                                <div key={course.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-black text-gray-900 uppercase tracking-tight">{days[course.dayOfWeek]}</h3>
                                            <p className="text-sm font-bold text-indigo-600">{course.startTime} - {course.endTime}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider
                                            ${course.slotType === 'LAB' ? 'bg-indigo-50 text-indigo-600' : 
                                              course.slotType === 'SG' ? 'bg-emerald-50 text-emerald-600' : 
                                              course.slotType === 'LAB+SG' ? 'bg-purple-50 text-purple-600' :
                                              course.slotType === 'READ' ? 'bg-blue-50 text-blue-600' :
                                              'bg-amber-50 text-amber-600'}`}
                                        >
                                            {course.slotType}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between py-3 border-y border-gray-50">
                                        <div className="text-center">
                                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Età</p>
                                            <p className="text-sm font-bold text-gray-700">{course.minAge}-{course.maxAge}a</p>
                                        </div>
                                        <div className="text-center flex-1 px-4">
                                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Occupazione</p>
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-sm font-bold text-gray-900">{course.activeEnrollmentsCount || 0}/{course.capacity}</span>
                                                <button 
                                                    onClick={() => fetchEnrolledStudents(course.id, `${days[course.dayOfWeek]} ${course.startTime}`)}
                                                    className="p-1.5 text-indigo-400"
                                                >
                                                    <ProfileIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Stato</p>
                                            <span className={`w-2.5 h-2.5 rounded-full inline-block ${course.status === 'open' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleToggleStatus(course.id, course.status)}
                                            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border
                                                ${course.status === 'open' 
                                                    ? 'bg-red-50 text-red-600 border-red-100' 
                                                    : 'bg-green-50 text-green-600 border-green-100'}`}
                                        >
                                            {course.status === 'open' ? 'Sospendi' : 'Riattiva'}
                                        </button>
                                        <button 
                                            onClick={() => handleEditCourse(course)}
                                            className="p-3 text-gray-500 hover:text-indigo-500 bg-gray-50 rounded-xl"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCourse(course.id)}
                                            className="p-3 text-gray-500 hover:text-red-500 bg-gray-50 rounded-xl"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
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
                                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider
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
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">Seleziona una sede per gestire i corsi</p>
                </div>
            )}

            {isAddModalOpen && (
                <Modal onClose={() => { setIsAddModalOpen(false); setEditingCourseId(null); }} size="xl">
                    <div className="flex flex-col max-h-[90vh] md:max-h-[85vh]">
                        {/* Header Fisso - Più compatto su mobile */}
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20 rounded-t-3xl">
                            <h2 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-tight">
                                {editingCourseId ? 'Modifica Corso' : 'Nuovo Corso'}
                            </h2>
                        </div>

                        {/* Area Contenuto Scrollabile */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Giorno</label>
                                    <select 
                                        className="md-input w-full bg-gray-50/50 border-gray-100 py-3 md:py-2"
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                                    >
                                        {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tipo Principale</label>
                                    <select 
                                        className="md-input w-full bg-gray-50/50 border-gray-100 py-3 md:py-2"
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
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Data Inizio Validità</label>
                                    <input 
                                        type="date"
                                        className="md-input w-full bg-gray-50/50 border-gray-100 py-3 md:py-2"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Data Fine Validità</label>
                                    <input 
                                        type="date"
                                        className="md-input w-full bg-gray-50/50 border-gray-100 py-3 md:py-2"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Ricorrenza Avanzata */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ricorrenza Avanzata</h3>
                                    <button 
                                        type="button"
                                        onClick={() => setIsAdvancedRecurrence(!isAdvancedRecurrence)}
                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm
                                            ${isAdvancedRecurrence ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                                    >
                                        {isAdvancedRecurrence ? 'Disattiva' : 'Attiva'}
                                    </button>
                                </div>
                                
                                {isAdvancedRecurrence && (
                                    <div className="p-4 md:p-6 bg-amber-50/30 rounded-3xl border border-amber-100/50 space-y-4 animate-fade-in shadow-inner">
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                            {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((month, i) => {
                                                const monthNum = i + 1;
                                                const isActive = recurrenceConfig.activeMonths?.includes(monthNum);
                                                return (
                                                    <button
                                                        key={monthNum}
                                                        type="button"
                                                        onClick={() => {
                                                            setRecurrenceConfig(prev => {
                                                                const active = prev.activeMonths || [];
                                                                const newActive = active.includes(monthNum)
                                                                    ? active.filter(m => m !== monthNum)
                                                                    : [...active, monthNum].sort((a, b) => a - b);
                                                                return { ...prev, activeMonths: newActive };
                                                            });
                                                        }}
                                                        className={`py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 transform active:scale-95
                                                            ${isActive 
                                                                ? 'bg-amber-500 text-white shadow-md' 
                                                                : 'bg-white text-gray-400 border border-amber-100'}`}
                                                    >
                                                        {month}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[9px] text-amber-600 font-bold italic text-center">
                                            Seleziona i mesi in cui il corso è attivo. Le lezioni verranno generate solo per i mesi selezionati.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {activeType === 'LAB+SG' && (
                                <div className="p-4 md:p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 space-y-4 md:space-y-6 animate-fade-in shadow-inner">
                                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                       <div className="flex flex-col">
                                           <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-1 pl-1">Pianificazione Mensile</h3>
                                           <p className="text-[9px] text-indigo-400 font-bold italic pl-1">Alternanza LAB/SG per settimana</p>
                                       </div>
                                       <div className="flex flex-wrap md:flex-nowrap gap-2 p-1.5 bg-white/50 rounded-2xl border border-indigo-100 justify-center">
                                           {[1, 2, 3, 4, 5].map((week) => (
                                               <div key={week} className="flex flex-col items-center gap-1 p-2 min-w-[55px] md:min-w-[64px] rounded-xl border border-indigo-50 bg-white shadow-sm">
                                                   <span className="text-[7px] md:text-[8px] font-black text-indigo-300 uppercase">S{week}</span>
                                                   <button
                                                       type="button"
                                                       onClick={() => setWeeklyPlan(prev => ({ ...prev, [week]: prev[week] === 'LAB' ? 'SG' : 'LAB' }))}
                                                       className={`w-full py-1.5 md:py-2.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all duration-300 transform active:scale-95
                                                           ${weeklyPlan[week] === 'LAB' 
                                                               ? 'bg-indigo-600 text-white shadow-md' 
                                                               : 'bg-emerald-500 text-white shadow-md'}`}
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
                                    <h3 className="text-[10px] md:text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Configurazione Slot Ammessi</h3>
                                </div>                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                                    {(Object.keys(configs) as SlotType[]).map(type => {
                                        const isActive = activeType === type || (activeType === 'LAB+SG' && (type === 'LAB' || type === 'SG'));
                                        const config = configs[type];
                                        
                                        return (
                                            <div 
                                                key={type}
                                                className={`rounded-2xl border-2 transition-all duration-300 p-3 md:p-4 space-y-4 md:space-y-5
                                                    ${isActive 
                                                        ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100/50 md:scale-[1.02] z-10' 
                                                        : 'bg-gray-50/50 border-gray-100 opacity-60 grayscale-[0.5]'}`}
                                            >
                                                {/* Quantity / Header */}
                                                <div className="flex items-center md:flex-col justify-between md:justify-center gap-2 pb-3 md:pb-4 border-b border-gray-100/10">
                                                    <span className={`text-[10px] font-black tracking-widest uppercase ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                        {type}
                                                    </span>
                                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-xl border-2 transition-colors
                                                        ${isActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                                        {config.quantity}
                                                    </div>
                                                </div>

                                                {/* Times */}
                                                <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
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
                                                <div className="space-y-1 pt-1 md:pt-2">
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

                        {/* Footer Fisso - Più compatto e ordinato su mobile */}
                        <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 justify-between items-center sticky bottom-0 z-20 rounded-b-3xl">
                            <div className="order-2 md:order-1 w-full md:w-auto flex justify-center md:justify-start">
                                {editingCourseId && (
                                    <button 
                                        onClick={() => {
                                            if (window.confirm("Sei sicuro di voler eliminare questo corso?")) {
                                                handleDeleteCourse(editingCourseId);
                                                setIsAddModalOpen(false);
                                                setEditingCourseId(null);
                                            }
                                        }}
                                        className="text-[10px] font-black text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest flex items-center gap-2"
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                        Elimina Corso
                                    </button>
                                )}
                            </div>

                            <div className="order-1 md:order-2 w-full md:w-auto flex items-center justify-between md:justify-end gap-4 md:gap-6">
                                <button 
                                    onClick={() => { setIsAddModalOpen(false); setEditingCourseId(null); }} 
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                                >
                                    Annulla
                                </button>
                                <button 
                                  onClick={handleAddCourse}
                                  disabled={isSaving}
                                  className={`px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-lg transition-all flex items-center gap-2
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
