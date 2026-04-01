
import React, { useState, useMemo } from 'react';
import { Lesson, LessonInput, Supplier, Client, ClientType, ParentClient, LessonAttendee, Enrollment } from '../../types';

interface LessonFormProps {
    lesson?: Lesson | null;
    suppliers: Supplier[];
    clients: Client[];
    enrollments: Enrollment[];
    onSave: (data: LessonInput | Lesson) => void;
    onDelete?: (id: string) => void;
    onCancel: () => void;
}

const LessonForm: React.FC<LessonFormProps> = ({ lesson, suppliers, clients, enrollments, onSave, onDelete, onCancel }) => {
    const [date, setDate] = useState(lesson?.date ? lesson.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(lesson?.startTime || '16:00');
    const [endTime, setEndTime] = useState(lesson?.endTime || '18:00');
    const [locationName, setLocationName] = useState(lesson?.locationName || '');
    const [locationColor, setLocationColor] = useState(lesson?.locationColor || '#94a3b8');
    const [description, setDescription] = useState(lesson?.description || '');
    
    // Multiple Attendees State
    // Se c'è un legacy single child, lo convertiamo in un array di attendee
    const initialAttendees: LessonAttendee[] = lesson?.attendees || 
        (lesson?.clientId && lesson?.childName ? [{ clientId: lesson.clientId, childId: 'legacy', childName: lesson.childName }] : []);
        
    const [attendees, setAttendees] = useState<LessonAttendee[]>(initialAttendees);
    const [searchTerm, setSearchTerm] = useState('');

    // Derived Lists
    const allLocations = useMemo(() => {
        const locs: { name: string, color: string }[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({ name: l.name, color: l.color })));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const parentClients = useMemo(() => 
        clients.filter(c => c.clientType === ClientType.Parent) as ParentClient[], 
    [clients]);

    // Mappatura figli con info genitore e iscrizioni per ricerca veloce
    const childrenData = useMemo(() => {
        const list: { 
            childId: string, 
            childName: string, 
            parentId: string, 
            parentName: string,
            courses: string[],
            locations: string[]
        }[] = [];

        parentClients.forEach(p => {
            p.children.forEach(c => {
                // Trova iscrizioni per questo figlio
                const childEnrollments = enrollments.filter(e => e.childId === c.id && e.clientId === p.id);
                const courses = Array.from(new Set(childEnrollments.map(e => e.subscriptionName)));
                const locations = Array.from(new Set(childEnrollments.map(e => e.locationName)));
                
                // Aggiungi anche la sede preferita del genitore se presente
                if (p.preferredLocation && !locations.includes(p.preferredLocation)) {
                    locations.push(p.preferredLocation);
                }

                list.push({
                    childId: c.id,
                    childName: c.name,
                    parentId: p.id,
                    parentName: `${p.lastName} ${p.firstName}`,
                    courses,
                    locations
                });
            });
        });
        return list;
    }, [parentClients, enrollments]);

    const filteredChildren = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const s = searchTerm.toLowerCase();
        return childrenData.filter(item => 
            item.childName.toLowerCase().includes(s) ||
            item.parentName.toLowerCase().includes(s) ||
            item.courses.some(c => c.toLowerCase().includes(s)) ||
            item.locations.some(l => l.toLowerCase().includes(s))
        ).slice(0, 15); // Limitiamo i risultati per performance
    }, [childrenData, searchTerm]);

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const name = e.target.value;
        setLocationName(name);
        const loc = allLocations.find(l => l.name === name);
        if (loc) setLocationColor(loc.color);
    };

    const isChildSelected = (childName: string) => attendees.some(a => a.childName === childName);

    const toggleAttendee = (parentId: string, childId: string, childName: string) => {
        if (isChildSelected(childName)) {
            // Remove
            setAttendees(prev => prev.filter(a => a.childName !== childName));
        } else {
            // Add
            setAttendees(prev => [...prev, {
                clientId: parentId,
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
            // Mantieni compatibilità legacy (opzionale, ma utile per visualizzazioni semplici)
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
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-800 uppercase mb-2">Partecipanti (Opzionale)</h4>
                    
                    {/* Filtro Ricerca */}
                    <div className="md-input-group bg-white rounded border border-indigo-200 px-2">
                        <input 
                            type="text" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="md-input border-none focus:ring-0" 
                            placeholder="Filtra per nome, genitore, corso o sede..." 
                        />
                        <label className="md-input-label !left-2">Cerca Partecipante</label>
                    </div>

                    {/* Risultati della Ricerca */}
                    {searchTerm.trim() !== '' && (
                        <div className="bg-white p-2 rounded border border-indigo-100 animate-fade-in max-h-48 overflow-y-auto shadow-sm">
                            <div className="space-y-1">
                                {filteredChildren.length === 0 && <p className="text-xs italic text-gray-400 p-2">Nessun risultato trovato.</p>}
                                {filteredChildren.map(item => (
                                    <label key={`${item.parentId}-${item.childId}`} className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 p-2 rounded transition-colors border-b border-gray-50 last:border-none">
                                        <input 
                                            type="checkbox" 
                                            checked={isChildSelected(item.childName)} 
                                            onChange={() => toggleAttendee(item.parentId, item.childId, item.childName)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-800">{item.childName}</span>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-tight">
                                                Genitore: {item.parentName}
                                                {item.courses.length > 0 && ` • ${item.courses.join(', ')}`}
                                                {item.locations.length > 0 && ` • ${item.locations.join(', ')}`}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lista Partecipanti Selezionati */}
                    <div className="mt-4 border-t border-indigo-200 pt-2">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500">Selezionati ({attendees.length})</label>
                            {attendees.length > 0 && (
                                <button type="button" onClick={() => setAttendees([])} className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase">Svuota Tutti</button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
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
                            {attendees.length === 0 && <span className="text-xs text-gray-400 italic">Nessuno selezionato.</span>}
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
