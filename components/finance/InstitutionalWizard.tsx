import React, { useState, useEffect, useMemo } from 'react';
import { Quote, Lesson, Supplier } from '../../types';
import { getLessons } from '../../services/calendarService';
import { createInstitutionalEnrollment } from '../../services/enrollmentService';
import Spinner from '../Spinner';
import CalendarIcon from '../icons/CalendarIcon';
import SparklesIcon from '../icons/SparklesIcon';
// Added missing SearchIcon import
import SearchIcon from '../icons/SearchIcon';

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
    const [allLessons, setAllLessons] = useState<Lesson[]>([]);
    const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (step === 2) {
            setLoading(true);
            getLessons().then(list => {
                setAllLessons(list.filter(l => !l.attendees || l.attendees.length === 0));
                setLoading(false);
            });
        }
    }, [step]);

    const filteredLessons = useMemo(() => {
        return allLessons.filter(l => 
            l.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.description.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allLessons, searchTerm]);

    const handleToggleLesson = (id: string) => {
        setSelectedLessonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleActivate = async () => {
        setLoading(true);
        try {
            const selectedObjs = allLessons.filter(l => selectedLessonIds.includes(l.id));
            await createInstitutionalEnrollment(quote, selectedObjs, projectName);
            onComplete();
        } catch (e) {
            alert("Errore attivazione: " + e);
        } finally {
            setLoading(false);
        }
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
                                        <span className="font-bold text-slate-700">{inst.description}</span>
                                        <span className="font-black text-indigo-600">{inst.amount.toFixed(2)}€ <span className="text-[10px] text-slate-400 ml-1 font-bold">entro {new Date(inst.dueDate).toLocaleDateString()}</span></span>
                                    </div>
                                ))}
                                {quote.installments.length === 0 && <p className="text-xs italic text-slate-400 p-4 text-center">Soluzione unica: {quote.totalAmount.toFixed(2)}€</p>}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-fade-in h-full flex flex-col">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Associazione Slot Calendario</h4>
                            <div className="relative w-full sm:w-64"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div><input type="text" placeholder="Cerca sede..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                        </div>
                        
                        {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                            <div className="flex-1 overflow-x-auto">
                                <div className="min-w-[600px] h-full">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                            </div>
                        )}
                        <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter self-end">Selezionati: {selectedLessonIds.length} slot</div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-8 animate-fade-in max-w-xl mx-auto text-center py-10">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner animate-bounce">🚀</div>
                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">Esecuzione Imminente</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Il progetto verrà inizializzato con lo stato <strong>ATTIVO</strong>. <br/>Riceverai una notifica push 30 giorni prima di ogni scadenza rateale.</p>
                        <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200 text-left">
                            <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">Riepilogo Generale</h5>
                            <ul className="text-sm space-y-2 text-slate-700 font-bold">
                                <li className="flex justify-between border-b pb-2"><span>Ente:</span> <span className="text-slate-900">{quote.clientName}</span></li>
                                <li className="flex justify-between border-b pb-2"><span>Progetto:</span> <span className="text-slate-900">{projectName}</span></li>
                                <li className="flex justify-between border-b pb-2"><span>Slot Totali:</span> <span className="text-slate-900">{selectedLessonIds.length}</span></li>
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
                        <button onClick={() => setStep(s => s + 1)} disabled={step === 2 && selectedLessonIds.length === 0} className="md-btn md-btn-raised md-btn-primary px-10 font-black uppercase text-xs tracking-widest shadow-lg">Continua</button>
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