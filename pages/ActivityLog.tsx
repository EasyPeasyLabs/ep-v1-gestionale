
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Appointment, LessonActivity, EnrollmentStatus, Homework, Supplier, AvailabilitySlot } from '../types';
import { getAllEnrollments } from '../services/enrollmentService';
import { getActivities, getLessonActivities, saveLessonActivities } from '../services/activityService';
import { getHomeworks } from '../services/homeworkService';
import { getSuppliers } from '../services/supplierService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import CalendarIcon from '../components/icons/CalendarIcon';

// Helpers Date
const getStartOfWeek = (d: Date) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); };
const getEndOfWeek = (d: Date) => { const date = getStartOfWeek(d); date.setDate(date.getDate() + 6); return date; };
const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// Helper per conversione orario in minuti (es. 16:30 -> 990)
const getMinutesFromTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

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
interface GroupedLessonRow {
    id: string; // Composite ID for key
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    childNames: string[];
    lessonIds: string[]; // All appointment IDs in this group
    assignedActivities: Activity[];
}

const ActivityLog: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<GroupedLessonRow[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [homeworks, setHomeworks] = useState<Homework[]>([]); 
    
    // View State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    
    // Selection State (contains composite IDs of grouped rows)
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [allEnrollments, allActivities, allHomeworks, allSuppliers] = await Promise.all([
                getAllEnrollments(),
                getActivities(),
                getHomeworks(),
                getSuppliers()
            ]);
            setActivities(allActivities);
            setHomeworks(allHomeworks);

            // --- SMART SLOT MAP BUILDER ---
            // Mappa: locationId_dayIndex -> AvailabilitySlot[]
            const locationScheduleMap = new Map<string, AvailabilitySlot[]>();
            allSuppliers.forEach(s => {
                s.locations.forEach(l => {
                    if (l.availability && l.availability.length > 0) {
                        l.availability.forEach(slot => {
                            const key = `${l.id}_${slot.dayOfWeek}`; // es. loc123_1 (Lunedì)
                            if (!locationScheduleMap.has(key)) locationScheduleMap.set(key, []);
                            locationScheduleMap.get(key)?.push(slot);
                        });
                    }
                });
            });

            // Calcola Range Date
            let start = new Date(currentDate);
            let end = new Date(currentDate);
            
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);

            if (viewMode === 'week') {
                start = getStartOfWeek(currentDate);
                start.setHours(0,0,0,0);
                end = getEndOfWeek(currentDate);
                end.setHours(23,59,59,999);
            } else if (viewMode === 'month') {
                start = getStartOfMonth(currentDate);
                end = getEndOfMonth(currentDate);
                end.setHours(23,59,59,999);
            }

            // Map Activity Data
            const activityMap = new Map(allActivities.map(a => [a.id, a]));

            // Flatten Appointments & Group
            const groups: Record<string, GroupedLessonRow> = {};
            const allLessonIds: string[] = [];

            allEnrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
                    if (enr.appointments) {
                        enr.appointments.forEach(app => {
                            const appDate = new Date(app.date);
                            if (appDate >= start && appDate <= end) {
                                // --- SMART SNAPPING LOGIC ---
                                const locationId = app.locationId && app.locationId !== 'unassigned' ? app.locationId : enr.locationId;
                                const dayIndex = appDate.getDay();
                                
                                let displayStartTime = app.startTime;
                                let displayEndTime = app.endTime;

                                if (locationId && locationId !== 'unassigned') {
                                    const scheduleKey = `${locationId}_${dayIndex}`;
                                    const officialSlots = locationScheduleMap.get(scheduleKey);
                                    
                                    if (officialSlots) {
                                        const appMinutes = getMinutesFromTime(app.startTime);
                                        let bestSlot: AvailabilitySlot | null = null;
                                        let minDiff = 45; // Tolerance threshold (minutes)

                                        officialSlots.forEach(slot => {
                                            const slotMinutes = getMinutesFromTime(slot.startTime);
                                            const diff = Math.abs(slotMinutes - appMinutes);
                                            if (diff <= minDiff) {
                                                minDiff = diff;
                                                bestSlot = slot;
                                            }
                                        });

                                        if (bestSlot) {
                                            displayStartTime = bestSlot.startTime;
                                            displayEndTime = bestSlot.endTime;
                                        }
                                    }
                                }
                                // -----------------------------

                                // Grouping Key using SNAPPED Time
                                const dateKey = app.date.split('T')[0];
                                const locKey = (app.locationName || enr.locationName || 'N/D').trim();
                                const groupKey = `${dateKey}_${displayStartTime}_${locKey}`;

                                if (!groups[groupKey]) {
                                    groups[groupKey] = {
                                        id: groupKey,
                                        date: app.date,
                                        startTime: displayStartTime,
                                        endTime: displayEndTime,
                                        locationName: locKey,
                                        locationColor: app.locationColor || enr.locationColor || '#ccc',
                                        childNames: [],
                                        lessonIds: [],
                                        assignedActivities: []
                                    };
                                }
                                groups[groupKey].childNames.push(enr.childName);
                                groups[groupKey].lessonIds.push(app.lessonId);
                                allLessonIds.push(app.lessonId);
                            }
                        });
                    }
                }
            });

            // Fetch assigned activities for ALL lessons involved
            const logEntries = await getLessonActivities(allLessonIds);
            
            // Map activities back to groups (Union of activities)
            Object.values(groups).forEach(group => {
                const groupActivityIds = new Set<string>();
                group.lessonIds.forEach(lId => {
                    const entry = logEntries.find(e => e.lessonId === lId);
                    if (entry) entry.activityIds.forEach(aId => groupActivityIds.add(aId));
                });
                
                group.assignedActivities = Array.from(groupActivityIds)
                    .map(id => activityMap.get(id))
                    .filter((a): a is Activity => !!a);
            });

            const sortedGroups = Object.values(groups).sort((a,b) => {
                // Sort by date then time
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return a.startTime.localeCompare(b.startTime);
            });

            setLessons(sortedGroups);
            setSelectedGroupIds([]);

        } catch (err) {
            console.error("Error fetching activity log:", err);
        } finally {
            setLoading(false);
        }
    }, [currentDate, viewMode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleNavigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'day') newDate.setDate(newDate.getDate() + direction);
        else if (viewMode === 'week') newDate.setDate(newDate.getDate() + (direction * 7));
        else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const getRangeLabel = () => {
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        if (viewMode === 'day') return currentDate.toLocaleDateString('it-IT', { weekday: 'long', ...options });
        if (viewMode === 'week') {
            const start = getStartOfWeek(currentDate);
            const end = getEndOfWeek(currentDate);
            return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    };

    const toggleGroupSelection = (groupId: string) => {
        setSelectedGroupIds(prev => 
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const handleAssignActivities = async (activityIds: string[]) => {
        try {
            // Collect all lessonIds from selected groups
            const allTargetLessonIds: string[] = [];
            selectedGroupIds.forEach(gId => {
                const group = lessons.find(l => l.id === gId);
                if (group) allTargetLessonIds.push(...group.lessonIds);
            });

            await saveLessonActivities(allTargetLessonIds, activityIds, new Date().toISOString()); 
            setIsModalOpen(false);
            fetchData(); 
        } catch (err) {
            console.error("Error saving assignments:", err);
            alert("Errore durante il salvataggio.");
        }
    };

    // Grouping Logic for Render: Date -> Location -> Lessons
    const groupedView = (() => {
        const grouped: Record<string, Record<string, GroupedLessonRow[]>> = {}; // Date -> Location -> Lessons
        
        lessons.forEach(l => {
            const dateKey = new Date(l.date).toDateString();
            const locKey = l.locationName || 'Sede Non Definita';
            
            if(!grouped[dateKey]) grouped[dateKey] = {};
            if(!grouped[dateKey][locKey]) grouped[dateKey][locKey] = [];
            
            grouped[dateKey][locKey].push(l);
        });

        // Sort keys
        const sortedDates = Object.keys(grouped).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
        return { sortedDates, grouped };
    })();

    // Helper to find homeworks for a specific date and location
    const getHomeworksForContext = (dateKey: string, locationName: string) => {
        const dateStr = new Date(dateKey).toISOString().split('T')[0];
        return homeworks.filter(h => 
            h.assignedDate === dateStr && 
            h.assignedLocationName === locationName
        );
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Lezioni</h1>
                    <p className="text-gray-500">
                        Programma e traccia le attività didattiche.
                    </p>
                </div>
                
                <div className="flex gap-2 items-center">
                    {/* View Toggles */}
                    <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                        <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Giorno</button>
                        <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Settimana</button>
                        <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Mese</button>
                    </div>

                    {selectedGroupIds.length > 0 && (
                        <button 
                            onClick={() => setIsModalOpen(true)} 
                            className="md-btn md-btn-raised md-btn-green animate-fade-in"
                        >
                            Assegna ({selectedGroupIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Navigazione Data */}
            <div className="md-card p-4 mb-6 flex items-center justify-between bg-white border-l-4 border-indigo-500 shadow-sm">
                <button onClick={() => handleNavigate(-1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors">&lt;</button>
                
                <div className="flex items-center gap-3">
                    <CalendarIcon />
                    <div className="text-center">
                        <span className="block text-lg font-bold text-gray-800 capitalize">{getRangeLabel()}</span>
                        {viewMode === 'day' && <span className="text-xs text-gray-400 font-medium">Oggi</span>}
                    </div>
                </div>

                <button onClick={() => handleNavigate(1)} className="md-icon-btn h-10 w-10 bg-gray-50 hover:bg-gray-100 rounded-full font-bold text-gray-600 transition-colors">&gt;</button>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-8 animate-fade-in">
                     {lessons.length === 0 && (
                        <div className="p-12 text-center text-gray-500 italic bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            Nessuna lezione in programma nel periodo selezionato.
                        </div>
                    )}

                    {/* Rendering Grouped: Date -> Location -> Table */}
                    {groupedView.sortedDates.map(dateKey => (
                        <div key={dateKey} className="space-y-4">
                            {/* Date Header Separator (Only for Week/Month view) */}
                            {viewMode !== 'day' && (
                                <div className="flex items-center gap-4 py-4">
                                    <div className="h-px bg-gray-300 flex-1"></div>
                                    <span className="text-sm font-bold text-gray-600 uppercase bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                        {new Date(dateKey).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long'})}
                                    </span>
                                    <div className="h-px bg-gray-300 flex-1"></div>
                                </div>
                            )}

                            {Object.keys(groupedView.grouped[dateKey]).sort().map(locName => {
                                const locLessons = groupedView.grouped[dateKey][locName];
                                const locColor = locLessons[0]?.locationColor || '#ccc';
                                
                                // Check for homework assigned to this location on this day
                                const assignedHomeworks = getHomeworksForContext(dateKey, locName);

                                return (
                                    <div key={locName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        {/* RECINTO HEADER (Location) */}
                                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors">
                                            <span className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: locColor }}></span>
                                            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{locName}</h2>
                                            <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded-full">{locLessons.length} lez.</span>
                                        </div>
                                        
                                        {/* HOMEWORK DISPLAY */}
                                        {assignedHomeworks.length > 0 && (
                                            <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-100 flex flex-col gap-1">
                                                <h4 className="text-[10px] font-bold text-yellow-700 uppercase">Compiti Assegnati:</h4>
                                                {assignedHomeworks.map(hw => (
                                                    <div key={hw.id} className="text-xs text-yellow-900 flex items-center gap-2">
                                                        <span className="font-bold">• {hw.title}</span>
                                                        <span className="text-yellow-600 italic">
                                                            ({hw.type === 'textbook' ? `Manuale: ${hw.textbookName || 'N/D'}` : 'Multimedia'})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-white border-b text-xs text-gray-400 uppercase">
                                                    <tr>
                                                        <th className="p-4 w-10">#</th>
                                                        <th className="p-4 font-semibold">Orario</th>
                                                        <th className="p-4 font-semibold">Allievi ({locLessons.reduce((acc, l) => acc + l.childNames.length, 0)})</th>
                                                        <th className="p-4 font-semibold">Attività Svolte</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {locLessons.map((lessonGroup) => (
                                                        <tr 
                                                            key={lessonGroup.id} 
                                                            onClick={() => toggleGroupSelection(lessonGroup.id)}
                                                            className={`cursor-pointer transition-colors ${selectedGroupIds.includes(lessonGroup.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                                        >
                                                            <td className="p-4">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedGroupIds.includes(lessonGroup.id)}
                                                                    onChange={() => toggleGroupSelection(lessonGroup.id)}
                                                                    className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 pointer-events-none" 
                                                                />
                                                            </td>
                                                            <td className="p-4 whitespace-nowrap font-mono font-bold text-sm text-gray-600">
                                                                {lessonGroup.startTime} - {lessonGroup.endTime}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="text-sm text-gray-800">
                                                                    {lessonGroup.childNames.length > 5 
                                                                        ? `${lessonGroup.childNames.slice(0, 5).join(', ')} (+${lessonGroup.childNames.length - 5})` 
                                                                        : lessonGroup.childNames.join(', ')}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                {lessonGroup.assignedActivities.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {lessonGroup.assignedActivities.map(act => (
                                                                            <span key={act.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
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
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <SelectActivityModal 
                        activities={activities} 
                        onSave={handleAssignActivities} 
                        onCancel={() => setIsModalOpen(false)}
                        // Pre-selezione se solo una lezione selezionata e ha già attività (opzionale, complesso con gruppi multipli)
                        initialSelection={[]}
                    />
                </Modal>
            )}
        </div>
    );
};

export default ActivityLog;
