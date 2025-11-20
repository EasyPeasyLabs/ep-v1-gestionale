
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Enrollment, Appointment, LessonActivity, EnrollmentStatus } from '../types';
import { getAllEnrollments } from '../services/enrollmentService';
import { getActivities, getLessonActivities, saveLessonActivities } from '../services/activityService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';

// --- Componente Selezione Attività (Modal) ---
const SelectActivityModal: React.FC<{
    activities: Activity[];
    onSave: (selectedIds: string[]) => void;
    onCancel: () => void;
    initialSelection?: string[];
}> = ({ activities, onSave, onCancel, initialSelection = [] }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
    const [searchTerm, setSearchTerm] = useState('');

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const filtered = activities.filter(a => 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full max-h-[80vh]">
            <div className="p-6 pb-2 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">Assegna Attività</h3>
                <p className="text-sm text-gray-500">Seleziona le attività da collegare alle lezioni scelte.</p>
            </div>
            <div className="p-4 bg-gray-50 border-b">
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        placeholder="Cerca attività..." 
                        className="block w-full bg-white border rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filtered.map(act => (
                    <label key={act.id} className="flex items-start p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.includes(act.id)} 
                            onChange={() => toggleSelection(act.id)}
                            className="mt-1 h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                        />
                        <div className="ml-3">
                            <p className="font-medium text-gray-900">{act.title}</p>
                            <p className="text-xs text-gray-500">{act.category} {act.theme ? ` - ${act.theme}` : ''}</p>
                        </div>
                    </label>
                ))}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={() => onSave(selectedIds)} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                    Conferma ({selectedIds.length})
                </button>
            </div>
        </div>
    );
};


// --- Pagina Principale ---
interface LessonRow extends Appointment {
    enrollmentId: string;
    childName: string;
    assignedActivities: Activity[]; // Populated
}

const ActivityLog: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<LessonRow[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Selection State
    const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [allEnrollments, allActivities] = await Promise.all([
                getAllEnrollments(),
                getActivities()
            ]);
            setActivities(allActivities);

            // Flatten appointments for the selected date
            const dailyLessons: LessonRow[] = [];
            allEnrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
                    if (enr.appointments) {
                        enr.appointments.forEach(app => {
                            if (app.date.startsWith(selectedDate)) {
                                dailyLessons.push({
                                    ...app,
                                    enrollmentId: enr.id,
                                    childName: enr.childName,
                                    assignedActivities: [] // Will be filled
                                });
                            }
                        });
                    }
                }
            });

            // Sort by time
            dailyLessons.sort((a, b) => a.startTime.localeCompare(b.startTime));

            // Fetch existing assignments
            const lessonIds = dailyLessons.map(l => l.lessonId);
            const logEntries = await getLessonActivities(lessonIds);

            // Map activities to lessons
            const activityMap = new Map(allActivities.map(a => [a.id, a]));
            
            dailyLessons.forEach(l => {
                const entry = logEntries.find(e => e.lessonId === l.lessonId);
                if (entry) {
                    l.assignedActivities = entry.activityIds
                        .map(id => activityMap.get(id))
                        .filter((a): a is Activity => !!a);
                }
            });

            setLessons(dailyLessons);
            setSelectedLessonIds([]); // Reset selection on date change

        } catch (err) {
            console.error("Error fetching activity log:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDateChange = (offset: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + offset);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const toggleLessonSelection = (lessonId: string) => {
        setSelectedLessonIds(prev => 
            prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]
        );
    };

    const handleSelectAll = () => {
        if (selectedLessonIds.length === lessons.length) {
            setSelectedLessonIds([]);
        } else {
            setSelectedLessonIds(lessons.map(l => l.lessonId));
        }
    };

    const handleAssignActivities = async (activityIds: string[]) => {
        try {
            await saveLessonActivities(selectedLessonIds, activityIds, selectedDate);
            setIsModalOpen(false);
            fetchData(); // Refresh to show new assignments
        } catch (err) {
            console.error("Error saving assignments:", err);
            alert("Errore durante il salvataggio.");
        }
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Lezioni</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                        Programma e traccia le attività didattiche svolte in ogni lezione.
                    </p>
                </div>
                
                {selectedLessonIds.length > 0 && (
                    <button 
                        onClick={() => setIsModalOpen(true)} 
                        className="md-btn md-btn-raised md-btn-primary animate-fade-in"
                    >
                        Assegna Attività ({selectedLessonIds.length})
                    </button>
                )}
            </div>

            {/* Navigazione Data */}
            <div className="md-card p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => handleDateChange(-1)} className="md-btn md-btn-flat text-2xl font-bold">&lt;</button>
                    <div className="text-center">
                         <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)} 
                            className="text-lg font-bold bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none text-center"
                        />
                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                            {new Date(selectedDate).toLocaleDateString('it-IT', { weekday: 'long' })}
                        </div>
                    </div>
                    <button onClick={() => handleDateChange(1)} className="md-btn md-btn-flat text-2xl font-bold">&gt;</button>
                </div>
                <button 
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} 
                    className="text-sm text-gray-600 font-medium hover:underline"
                >
                    Torna a Oggi
                </button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="md-card p-0 overflow-hidden">
                     {lessons.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 italic">
                            Nessuna lezione in programma per questa data.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input 
                                                type="checkbox" 
                                                checked={lessons.length > 0 && selectedLessonIds.length === lessons.length}
                                                onChange={handleSelectAll}
                                                className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
                                            />
                                        </th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Orario</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Allievo</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Attività Svolte / Programmate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lessons.map((lesson) => (
                                        <tr key={lesson.lessonId} className={`hover:bg-gray-50 ${selectedLessonIds.includes(lesson.lessonId) ? 'bg-gray-100' : ''}`}>
                                            <td className="p-4">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedLessonIds.includes(lesson.lessonId)}
                                                    onChange={() => toggleLessonSelection(lesson.lessonId)}
                                                    className="h-4 w-4 text-gray-600 rounded border-gray-300 focus:ring-gray-500"
                                                />
                                            </td>
                                            <td className="p-4 whitespace-nowrap font-medium text-sm">
                                                {lesson.startTime} - {lesson.endTime}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800 text-sm">{lesson.childName}</div>
                                                <div className="text-xs text-gray-500 flex items-center mt-1">
                                                    <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: lesson.locationColor || '#ccc' }}></span>
                                                    {lesson.locationName}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {lesson.assignedActivities.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {lesson.assignedActivities.map(act => (
                                                            <span key={act.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                                                                {act.title}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Nessuna attività registrata</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <SelectActivityModal 
                        activities={activities} 
                        onSave={handleAssignActivities} 
                        onCancel={() => setIsModalOpen(false)}
                        // Seleziona solo se è stata selezionata una sola lezione e ha già attività
                        initialSelection={selectedLessonIds.length === 1 
                            ? (lessons.find(l => l.lessonId === selectedLessonIds[0])?.assignedActivities.map(a => a.id) || [])
                            : []
                        }
                    />
                </Modal>
            )}
        </div>
    );
};

export default ActivityLog;
