
import React, { useState, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Client, ClientType, ParentClient, LessonAttendee, Enrollment, EnrollmentStatus, Course } from '../../types';

interface FilteredChild {
    childId: string;
    childName: string;
    parent: ParentClient;
    age: string;
    activeEnrollments: Enrollment[];
}

interface LessonFormProps {
    lesson?: Lesson | null;
    suppliers: Supplier[];
    clients: Client[];
    enrollments: Enrollment[];
    courses?: Course[];
    onSave: (data: LessonInput | Lesson) => void;
    onDelete?: (id: string) => void;
    onCancel: () => void;
}

const LessonForm: React.FC<LessonFormProps> = ({ lesson, suppliers, clients, enrollments, courses = [], onSave, onDelete, onCancel }) => {
    const [date, setDate] = useState(lesson?.date ? lesson.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(lesson?.startTime || '16:00');
    const [endTime, setEndTime] = useState(lesson?.endTime || '18:00');
    const [locationName, setLocationName] = useState(lesson?.locationName || '');
    const [locationColor, setLocationColor] = useState(lesson?.locationColor || '#94a3b8');
    const [description, setDescription] = useState(lesson?.description || '');
    
    // Multiple Attendees State
    const initialAttendees: LessonAttendee[] = lesson?.attendees || 
        (lesson?.clientId && lesson?.childName ? [{ clientId: lesson.clientId, childId: 'legacy', childName: lesson.childName }] : []);
        
    const [attendees, setAttendees] = useState<LessonAttendee[]>(initialAttendees);
    
    // Nuovi stati per i filtri
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterCourse, setFilterCourse] = useState('');
    const [filterAge, setFilterAge] = useState('');

    // Derived Lists
    const allLocations = useMemo(() => {
        const locs: { name: string, color: string }[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({ name: l.name, color: l.color })));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const parentClients = useMemo(() => 
        clients.filter(c => c.clientType === ClientType.Parent) as ParentClient[], 
    [clients]);

    // Estrai Sedi e Corsi unici dalle iscrizioni attive per i filtri
    const filterOptions = useMemo(() => {
        const locations = new Set<string>();
        const courseOptions = new Map<string, string>(); // id -> label
        const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        
        enrollments.forEach(e => {
            if (e.status === EnrollmentStatus.Active) {
                if (e.locationName) locations.add(e.locationName);
            }
        });

        courses.forEach(c => {
            const label = `${days[c.dayOfWeek]} ${c.startTime} - ${c.endTime} ${c.slotType} ${c.minAge}-${c.maxAge} anni`;
            courseOptions.set(c.id, label);
        });
        
        return {
            locations: Array.from(locations).sort(),
            courses: Array.from(courseOptions.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
            ages: ['0-3', '4-6', '7-10', '11-14', '15+']
        };
    }, [enrollments, courses]);

    // Deriva la lista dei bambini filtrata
    const filteredChildrenList = useMemo(() => {
        let list: FilteredChild[] = [];
        
        // 1. Appiattisci tutti i bambini
        parentClients.forEach(parent => {
            parent.children.forEach(child => {
                // Trova iscrizioni attive per questo bambino
                const childEnrollments = enrollments.filter(e => 
                    e.clientId === parent.id && 
                    e.childName === child.name && 
                    e.status === EnrollmentStatus.Active
                );
                
                list.push({
                    childId: child.id,
                    childName: child.name,
                    parent: parent,
                    age: child.age || '',
                    activeEnrollments: childEnrollments
                });
            });
        });

        // 2. Applica filtri
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item => 
                item.childName.toLowerCase().includes(query) ||
                item.parent.firstName.toLowerCase().includes(query) ||
                item.parent.lastName.toLowerCase().includes(query)
            );
        }

        if (filterLocation) {
            list = list.filter(item => 
                item.activeEnrollments.some(e => 
                    e.locationName === filterLocation || 
                    e.appointments?.some(app => app.locationName === filterLocation)
                )
            );
        }

        if (filterCourse) {
            list = list.filter(item => 
                item.activeEnrollments.some(e => e.courseId === filterCourse)
            );
        }

        if (filterAge) {
            list = list.filter(item => {
                const ageNum = parseInt(item.age);
                if (isNaN(ageNum)) return false; 
                
                if (filterAge === '0-3') return ageNum >= 0 && ageNum <= 3;
                if (filterAge === '4-6') return ageNum >= 4 && ageNum <= 6;
                if (filterAge === '7-10') return ageNum >= 7 && ageNum <= 10;
                if (filterAge === '11-14') return ageNum >= 11 && ageNum <= 14;
                if (filterAge === '15+') return ageNum >= 15;
                return true;
            });
        }

        return list;
    }, [parentClients, enrollments, searchQuery, filterLocation, filterCourse, filterAge]);

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const name = e.target.value;
        setLocationName(name);
        const loc = allLocations.find(l => l.name === name);
        if (loc) setLocationColor(loc.color);
    };

    const isChildSelected = (childName: string) => attendees.some(a => a.childName === childName);

    const toggleAttendee = (parent: ParentClient, childId: string, childName: string) => {
        if (isChildSelected(childName)) {
            setAttendees(prev => prev.filter(a => a.childName !== childName));
        } else {
            setAttendees(prev => [...prev, {
                clientId: parent.id,
                childId: childId,
                childName: childName
            }]);
        }
    };

    const removeAttendee = (childName: string) => {
        setAttendees(prev => prev.filter(a => a.childName !== childName));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const data: LessonInput = {
            date: new Date(date).toISOString(),
            startTime,
            endTime,
            locationName: locationName || 'Sede Extra',
            locationColor,
            description,
            attendees: attendees,
            clientId: attendees.length > 0 ? attendees[0].clientId : undefined,
            childName: attendees.length > 0 ? (attendees.length === 1 ? attendees[0].childName : `${attendees.length} Partecipanti`) : undefined
        };

        if (lesson?.id) onSave({ ...data, id: lesson.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full w-full overflow-hidden">
            {/* Header Fissato */}
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">{lesson ? 'Modifica Evento Extra' : 'Nuovo Evento Extra'}</h3>
                {lesson && onDelete && (
                    <button type="button" onClick={() => onDelete(lesson.id)} className="text-red-500 hover:text-red-700 text-sm font-bold uppercase">
                        Elimina
                    </button>
                )}
            </div>
            
            {/* Contenuto Scrollabile */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {/* 1. Dettagli Temporali */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="md-input font-bold" />
                        <label className="md-input-label !top-0">Data</label>
                    </div>
                    <div className="md-input-group">
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="md-input" />
                        <label className="md-input-label !top-0">Inizio</label>
                    </div>
                    <div className="md-input-group">
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="md-input" />
                        <label className="md-input-label !top-0">Fine</label>
                    </div>
                </div>

                {/* 2. Luogo */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Sede (Recinto)</label>
                    <select value={locationName} onChange={handleLocationChange} className="md-input bg-white" required>
                        <option value="">Seleziona Sede...</option>
                        {allLocations.map((l, idx) => (
                            <option key={idx} value={l.name}>{l.name}</option>
                        ))}
                    </select>
                </div>

                {/* 3. Descrizione / Titolo */}
                <div className="md-input-group">
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="md-input" placeholder=" " />
                    <label className="md-input-label">Titolo / Descrizione (es. Recupero, Corso Estivo)</label>
                </div>

                {/* 4. Selezione Partecipanti (Multipla) */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3 flex flex-col h-[400px]">
                    <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2">Partecipanti (Opzionale)</h4>
                    
                    {/* Filtri di Ricerca */}
                    <div className="space-y-2 flex-shrink-0">
                        <input 
                            type="text" 
                            placeholder="Cerca per nome allievo o genitore..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full p-2 text-sm border border-indigo-200 rounded focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <select 
                                value={filterLocation} 
                                onChange={e => setFilterLocation(e.target.value)}
                                className="p-2 text-xs border border-indigo-200 rounded bg-white"
                            >
                                <option value="">Tutte le Sedi</option>
                                {filterOptions.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                            <select 
                                value={filterCourse} 
                                onChange={e => setFilterCourse(e.target.value)}
                                className="p-2 text-xs border border-indigo-200 rounded bg-white"
                            >
                                <option value="">Tutti i Corsi</option>
                                {filterOptions.courses.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                            <select 
                                value={filterAge} 
                                onChange={e => setFilterAge(e.target.value)}
                                className="p-2 text-xs border border-indigo-200 rounded bg-white"
                            >
                                <option value="">Tutte le Età</option>
                                {filterOptions.ages.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Lista Risultati */}
                    <div className="flex-1 overflow-y-auto bg-white border border-indigo-100 rounded p-2 space-y-1 custom-scrollbar">
                        {filteredChildrenList.length === 0 && (
                            <p className="text-xs text-center text-gray-400 py-4">Nessun allievo trovato con questi filtri.</p>
                        )}
                        {filteredChildrenList.map(item => (
                            <label key={`${item.parent.id}-${item.childId}`} className="flex items-start gap-3 cursor-pointer hover:bg-indigo-50 p-2 rounded border border-transparent hover:border-indigo-100 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={isChildSelected(item.childName)} 
                                    onChange={() => toggleAttendee(item.parent, item.childId, item.childName)}
                                    className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-sm font-bold text-gray-800">{item.childName}</span>
                                        <span className="text-[10px] text-gray-500">{item.age ? `${item.age} anni` : 'Età N/D'}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mb-1">
                                        Genitore: {item.parent.firstName} {item.parent.lastName}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {item.activeEnrollments.map(enr => {
                                            const course = courses.find(c => c.id === enr.courseId);
                                            if (course) {
                                                const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
                                                return (
                                                    <span key={enr.id} className="text-[8px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                        {course.slotType} {days[course.dayOfWeek]} {course.startTime} @ {enr.locationName}
                                                    </span>
                                                );
                                            } else {
                                                return (
                                                    <span key={enr.id} className="text-[8px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                        {enr.subscriptionName} @ {enr.locationName}
                                                    </span>
                                                );
                                            }
                                        })}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Lista Partecipanti Selezionati */}
                    <div className="border-t border-indigo-200 pt-2 flex-shrink-0">
                        <label className="block text-xs font-bold text-gray-500 mb-2">Selezionati ({attendees.length})</label>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                            {attendees.map((a, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    {a.childName}
                                    <button 
                                        type="button" 
                                        onClick={() => removeAttendee(a.childName)}
                                        className="ml-1.5 text-indigo-600 hover:text-indigo-900 focus:outline-none font-bold"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            {attendees.length === 0 && <span className="text-xs text-gray-400 italic">Nessuno.</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Fissato */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva Evento</button>
            </div>
        </form>
    );
};

export default LessonForm;
