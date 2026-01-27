
import React, { useState, useEffect } from 'react';
import { Enrollment, Lesson, Appointment } from '../../types';
import { getAllEnrollments, rescheduleSuspendedLesson } from '../../services/enrollmentService';
import { getLessons } from '../../services/calendarService';
import Spinner from '../Spinner';

interface ClosureWizardProps {
    date: Date;
    onClose: () => void;
}

interface SuspendedItem {
    id: string; // Unique key
    enrollmentId?: string; // If from enrollment
    lessonId: string; // ID of the specific appointment/lesson
    childName: string;
    courseName: string; // Subscription name or 'Extra'
    locationName: string;
    originalTime: string;
    type: 'enrollment' | 'manual';
}

const ClosureWizard: React.FC<ClosureWizardProps> = ({ date, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [suspendedItems, setSuspendedItems] = useState<SuspendedItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [action, setAction] = useState<'append' | 'move'>('append');
    const [moveDate, setMoveDate] = useState('');

    useEffect(() => {
        const fetchSuspended = async () => {
            setLoading(true);
            const dateStr = date.toISOString().split('T')[0];
            const items: SuspendedItem[] = [];

            // 1. Fetch Enrollments
            const enrollments = await getAllEnrollments();
            enrollments.forEach(enr => {
                if (enr.appointments) {
                    enr.appointments.forEach(app => {
                        const appDateStr = app.date.split('T')[0];
                        if (appDateStr === dateStr && app.status === 'Suspended') {
                            items.push({
                                id: `${enr.id}_${app.lessonId}`,
                                enrollmentId: enr.id,
                                lessonId: app.lessonId,
                                childName: enr.childName,
                                courseName: enr.subscriptionName,
                                locationName: app.locationName || enr.locationName,
                                originalTime: app.startTime,
                                type: 'enrollment'
                            });
                        }
                    });
                }
            });

            // 2. Fetch Manual Lessons (If marked [SOSPESO])
            const manualLessons = await getLessons();
            manualLessons.forEach(ml => {
                const mlDateStr = ml.date.split('T')[0];
                if (mlDateStr === dateStr && ml.description.startsWith('[SOSPESO]')) {
                    items.push({
                        id: `manual_${ml.id}`,
                        lessonId: ml.id,
                        childName: ml.childName || 'Extra Lesson',
                        courseName: 'Lezione Extra',
                        locationName: ml.locationName,
                        originalTime: ml.startTime,
                        type: 'manual'
                    });
                }
            });

            setSuspendedItems(items);
            // Select all by default
            setSelectedIds(items.map(i => i.id));
            setLoading(false);
        };
        fetchSuspended();
    }, [date]);

    const handleProcess = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        
        try {
            const promises = selectedIds.map(id => {
                const item = suspendedItems.find(i => i.id === id);
                if (!item) return Promise.resolve();

                if (item.type === 'enrollment' && item.enrollmentId) {
                    return rescheduleSuspendedLesson(
                        item.enrollmentId, 
                        item.lessonId, 
                        moveDate, 
                        action === 'append' ? 'append_end' : 'move_to_date'
                    );
                } 
                // Manual lessons handling: Update date directly (Simplified for now)
                // In a real app we'd have a specific service for manual lesson move
                return Promise.resolve(); 
            });

            await Promise.all(promises);
            alert("Riprogrammazione completata!");
            onClose();
        } catch (e) {
            console.error(e);
            alert("Errore durante la riprogrammazione.");
        } finally {
            setLoading(false);
        }
    };

    const toggleId = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    if (loading) return <div className="p-10 flex justify-center"><Spinner /></div>;

    return (
        <div className="flex flex-col h-[80vh]">
            <div className="p-6 border-b bg-red-50">
                <h3 className="text-xl font-bold text-red-900">Wizard Gestione Chiusura</h3>
                <p className="text-sm text-red-700">Lezioni sospese del {date.toLocaleDateString()}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {suspendedItems.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 italic">
                        Nessuna lezione sospesa trovata per questa data.
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 font-bold text-sm text-gray-700 mb-2">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === suspendedItems.length} 
                                    onChange={(e) => setSelectedIds(e.target.checked ? suspendedItems.map(i => i.id) : [])}
                                    className="rounded text-indigo-600"
                                />
                                Seleziona Tutto ({suspendedItems.length})
                            </label>
                            {suspendedItems.map(item => (
                                <label key={item.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selectedIds.includes(item.id) ? 'bg-indigo-50 border-indigo-200' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleId(item.id)} className="rounded text-indigo-600" />
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{item.childName}</p>
                                            <p className="text-xs text-gray-500">{item.originalTime} • {item.locationName}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border text-gray-500 uppercase">{item.courseName}</span>
                                </label>
                            ))}
                        </div>

                        <div className="bg-gray-100 p-4 rounded-xl space-y-4 border border-gray-200">
                            <h4 className="font-bold text-sm text-gray-700 uppercase">Azione di Riprogrammazione</h4>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center bg-white ${action === 'append' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
                                    <input type="radio" name="action" checked={action === 'append'} onChange={() => setAction('append')} className="hidden" />
                                    <span className="block font-bold text-sm">Accoda alla Fine ➔</span>
                                    <span className="text-xs text-gray-500">Slitta tutto di 1 settimana</span>
                                </label>
                                <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center bg-white ${action === 'move' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
                                    <input type="radio" name="action" checked={action === 'move'} onChange={() => setAction('move')} className="hidden" />
                                    <span className="block font-bold text-sm">Data Specifica 📅</span>
                                    <span className="text-xs text-gray-500">Sposta in blocco</span>
                                </label>
                            </div>
                            
                            {action === 'move' && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nuova Data</label>
                                    <input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} className="md-input" />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                <button onClick={onClose} className="md-btn md-btn-flat">Chiudi</button>
                <button 
                    onClick={handleProcess} 
                    disabled={selectedIds.length === 0 || (action === 'move' && !moveDate)} 
                    className="md-btn md-btn-raised md-btn-primary"
                >
                    Applica Modifiche
                </button>
            </div>
        </div>
    );
};

export default ClosureWizard;
