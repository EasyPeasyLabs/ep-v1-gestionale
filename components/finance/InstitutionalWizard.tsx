
import React, { useState, useEffect, useMemo } from 'react';
import { Quote, Lesson, Supplier, LessonInput } from '../../types';
import { getLessons, addLessonsBatch } from '../../services/calendarService';
import { createInstitutionalEnrollment } from '../../services/enrollmentService';
import { generateInvoicesFromQuote } from '../../services/financeService';
import Spinner from '../Spinner';
import CalendarIcon from '../icons/CalendarIcon';
import SparklesIcon from '../icons/SparklesIcon';
import SearchIcon from '../icons/SearchIcon';
import PlusIcon from '../icons/PlusIcon';

// Helper Festività (Duplicate logic to ensure standalone consistency inside Wizard)
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    const easterMondays: Record<number, string> = {
        2024: '4-1', 2025: '4-21', 2026: '4-6', 2027: '3-29', 2028: '4-17', 2029: '4-2', 2030: '4-22'
    };
    const key = `${m}-${d}`; 
    const lookupKey = `${m}-${d}`;
    if (easterMondays[y] === lookupKey) return true;
    return false;
};

interface InstitutionalWizardProps {
    quote: Quote;
    suppliers: Supplier[];
    onClose: () => void;
    onComplete: () => void;
}

const InstitutionalWizard: React.FC<InstitutionalWizardProps> = ({ quote, suppliers, onClose, onComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [projectName, setProjectName] = useState(quote.items[0]?.description || '');
    
    // --- MODE: LINK EXISTING ---
    const [allLessons, setAllLessons] = useState<Lesson[]>([]);
    const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // --- MODE: GENERATE NEW ---
    const [activationMode, setActivationMode] = useState<'link' | 'generate'>('generate'); // Default to Generate as per request
    const [genLocationId, setGenLocationId] = useState('');
    const [genDayOfWeek, setGenDayOfWeek] = useState(1); // 1 = Lunedì
    const [genStartTime, setGenStartTime] = useState('09:00');
    const [genEndTime, setGenEndTime] = useState('13:00');
    const [genStartDate, setGenStartDate] = useState(new Date(quote.issueDate).toISOString().split('T')[0]);
    const [genCount, setGenCount] = useState(quote.installments.length || 10);
    const [generatedPreview, setGeneratedPreview] = useState<LessonInput[]>([]);

    useEffect(() => {
        if (step === 2 && activationMode === 'link') {
            setLoading(true);
            getLessons().then(list => {
                setAllLessons(list.filter(l => !l.attendees || l.attendees.length === 0));
                setLoading(false);
            });
        }
    }, [step, activationMode]);

    // Locations Flattened
    const allLocations = useMemo(() => {
        const locs: {id: string, name: string, color: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name, color: l.color})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const filteredLessons = useMemo(() => {
        return allLessons.filter(l => 
            l.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.description.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allLessons, searchTerm]);

    const handleToggleLesson = (id: string) => {
        setSelectedLessonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // GENERATOR LOGIC
    const handleGeneratePreview = () => {
        if (!genLocationId) return alert("Seleziona una sede operativa.");
        const loc = allLocations.find(l => l.id === genLocationId);
        if (!loc) return;

        const previews: LessonInput[] = [];
        let currentDate = new Date(genStartDate);
        
        // Find first occurrence of day
        while (currentDate.getDay() !== genDayOfWeek) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let added = 0;
        let loops = 0;
        while (added < genCount && loops < 100) {
            if (!isItalianHoliday(currentDate)) {
                previews.push({
                    date: currentDate.toISOString(),
                    startTime: genStartTime,
                    endTime: genEndTime,
                    locationName: loc.name,
                    locationColor: loc.color,
                    description: `${projectName} (${added + 1}/${genCount})`,
                    // Temporary ID for UI key only, not for DB
                    // Note: LessonInput doesn't strictly have ID, we manage it in rendering
                });
                added++;
            }
            currentDate.setDate(currentDate.getDate() + 7);
            loops++;
        }
        setGeneratedPreview(previews);
    };

    const handleActivate = async () => {
        setLoading(true);
        try {
            let finalLessons: Lesson[] = [];

            if (activationMode === 'generate') {
                if (generatedPreview.length === 0) throw new Error("Genera prima l'anteprima del calendario.");
                
                // 1. Create Lessons in Batch
                const newIds = await addLessonsBatch(generatedPreview);
                
                // 2. Hydrate local objects with new IDs
                finalLessons = generatedPreview.map((p, idx) => ({
                    ...p,
                    id: newIds[idx]
                } as Lesson));

            } else {
                // Link Mode
                finalLessons = allLessons.filter(l => selectedLessonIds.includes(l.id));
            }
            
            // 3. Create Enrollment & Link Lessons
            const enrollmentId = await createInstitutionalEnrollment(quote, finalLessons, projectName);
            
            // 4. Generate Scheduled Invoices from Installments
            await generateInvoicesFromQuote(quote, enrollmentId, finalLessons);

            onComplete();
        } catch (e: any) {
            alert("Errore attivazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const isNextDisabled = () => {
        if (step === 1) return !projectName;
        if (step === 2) {
            if (activationMode === 'link') return selectedLessonIds.length === 0;
            if (activationMode === 'generate') return generatedPreview.length === 0;
        }
        return false;
    };

    return (
        <div className="flex flex-col h-[85vh] lg:h-[80vh] bg-gray-50">
            <div className="p-6 border-b bg-indigo-900 text-white flex-shrink-0 flex justify-between items-center shadow-lg z-10">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Attivazione Progetto Ente</h3>
                    <p className="text-xs text-indigo-300 font-bold mt-0.5">Preventivo: {quote.quoteNumber} • {quote.clientName}</p>
                </div>
                <div className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-black border border-white/20 uppercase tracking-widest">Step {step}/3</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {step === 1 && (
                    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl">
                            <h4 className="font-black text-lg mb-2 flex items-center gap-2"><SparklesIcon /> Configurazione Operativa</h4>
                            <p className="text-sm opacity-80 leading-relaxed font-medium">Stai trasformando l'accordo economico in un'entità gestionale. L'iscrizione monitorerà le rate del preventivo e le presenze sul campo.</p>
                        </div>
                        <div className="md-input-group !mb-0"><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} required className="md-input font-black text-lg" placeholder=" " /><label className="md-input-label !top-[-10px] !text-[10px] !bg-gray-50">Nome Pubblico del Progetto</label></div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em]">Riepilogo Rateale</h5>
                            <div className="space-y-2">
                                {quote.installments.map((inst, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{inst.description}</span>
                                            {inst.triggerType === 'lesson_number' && <span className="text-[9px] text-indigo-600 font-bold">Trigger: Lezione {inst.triggerLessonIndex}</span>}
                                        </div>
                                        <span className="font-black text-indigo-600">{inst.amount.toFixed(2)}€ <span className="text-[10px] text-slate-400 ml-1 font-bold">entro {new Date(inst.dueDate).toLocaleDateString()}</span></span>
                                    </div>
                                ))}
                                {quote.installments.length === 0 && <p className="text-xs italic text-slate-400 p-4 text-center">Soluzione unica: {quote.totalAmount.toFixed(2)}€</p>}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fade-in h-full flex flex-col">
                        
                        {/* MODE SWITCHER */}
                        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
                            <button 
                                onClick={() => setActivationMode('generate')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activationMode === 'generate' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <span className="flex items-center justify-center gap-2"><PlusIcon /> Genera Calendario</span>
                            </button>
                            <button 
                                onClick={() => setActivationMode('link')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activationMode === 'link' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <span className="flex items-center justify-center gap-2">🔗 Collega Esistenti</span>
                            </button>
                        </div>

                        {/* GENERATE MODE */}
                        {activationMode === 'generate' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-2 border-b pb-2">Parametri Generazione</h4>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sede Operativa</label>
                                        <select value={genLocationId} onChange={e => setGenLocationId(e.target.value)} className="md-input font-bold text-sm">
                                            <option value="">-- Seleziona Sede --</option>
                                            {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Inizio</label>
                                            <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} className="md-input text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">N. Lezioni</label>
                                            <input type="number" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="md-input text-sm font-bold" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Giorno & Orario</label>
                                        <div className="flex gap-2 mb-2">
                                            {['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((d, i) => (
                                                <button key={i} onClick={() => setGenDayOfWeek(i)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${genDayOfWeek === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>{d}</button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input type="time" value={genStartTime} onChange={e => setGenStartTime(e.target.value)} className="md-input text-sm font-bold text-center" />
                                            <span className="text-slate-400 font-bold">-</span>
                                            <input type="time" value={genEndTime} onChange={e => setGenEndTime(e.target.value)} className="md-input text-sm font-bold text-center" />
                                        </div>
                                    </div>

                                    <button onClick={handleGeneratePreview} className="w-full md-btn md-btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold hover:bg-indigo-100">
                                        Aggiorna Anteprima
                                    </button>
                                </div>

                                <div className="lg:col-span-2 bg-slate-100 rounded-2xl border border-slate-200 p-4 flex flex-col min-h-[300px]">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Anteprima Calendario ({generatedPreview.length} slot)</h4>
                                    {generatedPreview.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-400 italic text-sm">
                                            Configura i parametri e clicca "Aggiorna Anteprima"
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                                            {generatedPreview.map((lesson, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: lesson.locationColor }}></div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Lezione {idx + 1}</span>
                                                    <span className="text-sm font-bold text-slate-800">{new Date(lesson.date).toLocaleDateString()}</span>
                                                    <span className="text-xs text-indigo-600 font-mono mt-1">{lesson.startTime} - {lesson.endTime}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* LINK MODE */}
                        {activationMode === 'link' && (
                            <div className="flex-1 flex flex-col space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Seleziona Slot Liberi</h4>
                                    <div className="relative w-full sm:w-64"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div><input type="text" placeholder="Cerca sede..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                                </div>
                                
                                {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                                    <div className="flex-1 overflow-y-auto bg-slate-100 rounded-2xl p-4 border border-slate-200">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {filteredLessons.map(l => (
                                                <label key={l.id} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-sm active:scale-95 ${selectedLessonIds.includes(l.id) ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
                                                    <input type="checkbox" checked={selectedLessonIds.includes(l.id)} onChange={() => handleToggleLesson(l.id)} className="rounded text-indigo-500 w-5 h-5 border-gray-300" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-black text-xs uppercase ${selectedLessonIds.includes(l.id) ? 'text-white' : 'text-slate-800'}`}>{new Date(l.date).toLocaleDateString('it-IT', {weekday:'short', day:'2-digit', month:'short'})}</p>
                                                        <p className={`text-[10px] font-bold mt-0.5 truncate ${selectedLessonIds.includes(l.id) ? 'text-indigo-200' : 'text-slate-500'}`}>{l.startTime} • {l.locationName}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        {filteredLessons.length === 0 && <p className="text-center text-xs text-slate-400 py-20 font-bold uppercase tracking-widest italic">Nessuno slot 'Extra' disponibile.</p>}
                                    </div>
                                )}
                                <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter self-end">Selezionati: {selectedLessonIds.length} slot</div>
                            </div>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-8 animate-fade-in max-w-xl mx-auto text-center py-10">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner animate-bounce">🚀</div>
                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">Esecuzione Imminente</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Il progetto verrà inizializzato con lo stato <strong>ATTIVO</strong>. <br/>Il sistema genererà automaticamente le fatture pro-forma per le rate impostate.</p>
                        <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200 text-left">
                            <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Riepilogo Generale</h5>
                            <ul className="text-sm space-y-2 text-slate-700 font-bold">
                                <li className="flex justify-between border-b pb-2"><span>Ente:</span> <span className="text-slate-900">{quote.clientName}</span></li>
                                <li className="flex justify-between border-b pb-2"><span>Progetto:</span> <span className="text-slate-900">{projectName}</span></li>
                                <li className="flex justify-between border-b pb-2"><span>Modalità:</span> <span className="text-slate-900">{activationMode === 'generate' ? 'Generazione Automatica' : 'Collegamento Manuale'}</span></li>
                                <li className="flex justify-between border-b pb-2"><span>Slot Totali:</span> <span className="text-slate-900">{activationMode === 'generate' ? generatedPreview.length : selectedLessonIds.length}</span></li>
                                <li className="flex justify-between"><span>Valore:</span> <span className="text-green-600">{quote.totalAmount.toFixed(2)}€</span></li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-white flex justify-between items-center flex-shrink-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <button onClick={onClose} className="md-btn md-btn-flat font-bold uppercase text-xs">Annulla</button>
                <div className="flex gap-2">
                    {step > 1 && <button onClick={() => setStep(s => s - 1)} className="md-btn md-btn-flat border border-slate-200 px-6 font-bold uppercase text-xs">Indietro</button>}
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)} disabled={isNextDisabled()} className="md-btn md-btn-raised md-btn-primary px-10 font-black uppercase text-xs tracking-widest shadow-lg">Continua</button>
                    ) : (
                        <button onClick={handleActivate} disabled={loading} className="md-btn md-btn-raised bg-green-600 text-white px-12 font-black uppercase text-xs tracking-widest shadow-xl hover:bg-green-700">
                            {loading ? <Spinner /> : 'Lancia Progetto'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstitutionalWizard;
