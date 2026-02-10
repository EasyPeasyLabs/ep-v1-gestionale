
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lesson, SchoolClosure, Supplier, Client, LessonInput, EnrollmentStatus, ClientType } from '../types';
import { getLessons, getSchoolClosures, deleteSchoolClosure, addSchoolClosure, deleteLesson, addLesson, updateLesson, bulkDeleteAllClosures } from '../services/calendarService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import { getAllEnrollments, restoreSuspendedLessons, suspendLessonsForClosure } from '../services/enrollmentService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import LessonForm from '../components/calendar/LessonForm';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import PencilIcon from '../components/icons/PencilIcon';
import { toLocalISOString, getItalianHolidays } from '../utils/dateUtils';

// Helper per contrasto colore
const getTextColorForBg = (bgColor: string) => {
    if (!bgColor) return '#1f2937';
    const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#1f2937' : '#ffffff';
};

const Calendar: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    // Usiamo any[] per ospitare sia Lesson che Appointment delle iscrizioni
    const [events, setEvents] = useState<any[]>([]);
    const [closures, setClosures] = useState<SchoolClosure[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals State
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [isDeleteAllClosuresModalOpen, setIsDeleteAllClosuresModalOpen] = useState(false);
    
    // Closure Management State
    const [manageClosureData, setManageClosureData] = useState<{ date: Date, closure?: SchoolClosure } | null>(null);
    const [closureReason, setClosureReason] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [manualLessons, enrollments, c, s, cli] = await Promise.all([
                getLessons(),
                getAllEnrollments(),
                getSchoolClosures(),
                getSuppliers(),
                getClients()
            ]);

            // --- 0. PRE-PROCESSING: REGISTRO SEDI UFFICIALI (MASTER) ---
            const officialLocations = new Map<string, { name: string, color: string }>();
            // Set per lookup rapido dei nomi "Master" (Case insensitive)
            const masterLocationNames = new Set<string>();

            s.forEach(supplier => {
                supplier.locations.forEach(loc => {
                    if (loc.name) {
                        const normalizedKey = loc.name.trim().toLowerCase();
                        officialLocations.set(normalizedKey, {
                            name: loc.name,
                            color: loc.color
                        });
                        masterLocationNames.add(normalizedKey);
                    }
                });
            });

            // Helper per normalizzare la sede dell'evento
            const normalizeLocation = (rawName: string, rawColor: string) => {
                const key = (rawName || '').trim().toLowerCase();
                if (officialLocations.has(key)) {
                    return { ...officialLocations.get(key)!, isMaster: true };
                }
                return { name: rawName || 'Sede Non Definita', color: rawColor || '#94a3b8', isMaster: false };
            };

            // --- FASE 1: RAGGRUPPAMENTO SPAZIALE (1 Slot = 1 Chip per Sede) ---
            // Chiave Univoca: YYYY-MM-DD_HH:MM_NormalizedLocationName
            const uniqueSlotsMap = new Map<string, any>();

            const generateKey = (dateStr: string, timeStr: string, locName: string) => {
                const cleanDate = dateStr.split('T')[0]; 
                const cleanLoc = (locName || 'Sede Non Definita').trim();
                return `${cleanDate}_${timeStr}_${cleanLoc}`;
            };

            // Processa Lezioni Manuali
            manualLessons.forEach(l => {
                const { name: finalLocName, color: finalLocColor, isMaster } = normalizeLocation(l.locationName, l.locationColor);
                const key = generateKey(l.date, l.startTime, finalLocName);
                
                uniqueSlotsMap.set(key, {
                    ...l,
                    locationName: finalLocName,
                    locationColor: finalLocColor,
                    isMaster, // Tag Master
                    type: 'manual', 
                    displayId: l.id,
                    studentNames: l.childName ? [l.childName] : [],
                    isGroup: false
                });
            });

            // Processa Appuntamenti Iscrizioni
            enrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
                    if (enr.appointments) {
                        enr.appointments.forEach(app => {
                            if(app.status === 'Suspended') return;

                            const rawLocName = app.locationName || enr.locationName;
                            const rawLocColor = app.locationColor || enr.locationColor;
                            
                            const { name: finalLocName, color: finalLocColor, isMaster } = normalizeLocation(rawLocName, rawLocColor);
                            const key = generateKey(app.date, app.startTime, finalLocName);

                            if (uniqueSlotsMap.has(key)) {
                                const slot = uniqueSlotsMap.get(key);
                                if (!slot.studentNames.includes(enr.childName)) {
                                    slot.studentNames.push(enr.childName);
                                }
                                slot.isGroup = true;
                                // Se questo evento è "Master" (riconosciuto), assicuriamoci che il flag rimanga true
                                if (isMaster) slot.isMaster = true; 
                            } else {
                                uniqueSlotsMap.set(key, {
                                    id: `${enr.id}_${app.lessonId}`,
                                    displayId: `${enr.id}_${app.lessonId}`,
                                    date: app.date,
                                    startTime: app.startTime,
                                    endTime: app.endTime,
                                    locationName: finalLocName,
                                    locationColor: finalLocColor,
                                    isMaster, // Tag Master
                                    description: enr.childName,
                                    childName: enr.childName,
                                    type: 'enrollment',
                                    originalApp: app,
                                    enrollmentId: enr.id,
                                    studentNames: [enr.childName],
                                    isGroup: false
                                });
                            }
                        });
                    }
                }
            });

            // --- FASE 2: FUSIONE TEMPORALE (Assorbimento Progetti) ---
            // Raggruppa gli slot per Data_Ora per trovare conflitti Master vs Slave
            const slotsByTime = new Map<string, any[]>();
            
            uniqueSlotsMap.forEach(slot => {
                const dateKey = slot.date.split('T')[0];
                const timeKey = `${dateKey}_${slot.startTime}`;
                if (!slotsByTime.has(timeKey)) {
                    slotsByTime.set(timeKey, []);
                }
                slotsByTime.get(timeKey)!.push(slot);
            });

            const finalEvents: any[] = [];

            slotsByTime.forEach((slotsInTime) => {
                // Separa Master (Sedi Fisiche) da Slave (Progetti/Astratte)
                const masters = slotsInTime.filter(s => s.isMaster);
                const slaves = slotsInTime.filter(s => !s.isMaster);

                if (masters.length > 0) {
                    // Esiste almeno una sede fisica in questo orario.
                    // Assorbiamo TUTTI gli eventi slave nel PRIMO master disponibile.
                    const targetMaster = masters[0];
                    
                    slaves.forEach(slave => {
                        // Unisci i nomi degli studenti
                        slave.studentNames.forEach((name: string) => {
                            if (!targetMaster.studentNames.includes(name)) {
                                targetMaster.studentNames.push(name);
                            }
                        });
                        // Segnaliamo visivamente che c'è un merge?
                        targetMaster.isGroup = true;
                        targetMaster.hasMergedProjects = true;
                    });

                    // Aggiungiamo i master (che ora contengono i dati degli slave assorbiti)
                    masters.forEach(m => finalEvents.push(m));
                    // Gli slave NON vengono aggiunti a finalEvents (Assorbiti e nascosti)
                } else {
                    // Nessun master: mostra tutti gli slave (comportamento standard)
                    slaves.forEach(s => finalEvents.push(s));
                }
            });
            
            setEvents(finalEvents);
            setClosures(c);
            setSuppliers(s);
            setClients(cli);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const handleSaveLesson = async (data: LessonInput | Lesson) => {
        try {
            if ('id' in data) await updateLesson(data.id, data);
            else await addLesson(data as LessonInput);
            setIsLessonModalOpen(false);
            fetchData();
        } catch (e) { alert("Errore salvataggio lezione"); }
    };

    const handleDeleteLesson = async (id: string) => {
        if(confirm("Eliminare questa lezione?")) {
            await deleteLesson(id);
            setIsLessonModalOpen(false);
            fetchData();
        }
    };

    const handleAddClosure = async () => {
        if (!manageClosureData || !closureReason) return;
        const dateStr = toLocalISOString(manageClosureData.date);
        
        setLoading(true);
        try {
            await addSchoolClosure(dateStr, closureReason);
            // Suspend lessons
            await suspendLessonsForClosure(dateStr);
            setManageClosureData(null);
            setClosureReason('');
            fetchData();
        } catch(e) {
            alert("Errore chiusura: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClosure = async (id: string, dateStr: string) => {
        if(!confirm("Sei sicuro di voler riaprire la scuola? Le lezioni sospese torneranno attive.")) return;
        
        // Non blocchiamo la UI con il loading per sempre se qualcosa va storto
        setLoading(true);
        
        try {
            // 1. DELETE CLOSURE RECORD (Priorità Massima)
            // Se questo fallisce, è un errore vero.
            await deleteSchoolClosure(id);
            
            // 2. RESTORE LESSONS (Best Effort)
            // Se questo fallisce (es. dati sporchi), non deve impedire la riapertura visiva.
            try {
                await restoreSuspendedLessons(dateStr);
            } catch (restoreError) {
                console.warn("[Calendar] Errore ripristino lezioni (non bloccante):", restoreError);
            }
            
            // 3. UI REFRESH (Mandatory)
            setManageClosureData(null); // Chiudi modale immediatamente
            await fetchData(); // Ricarica dati aggiornati

        } catch (e) { 
            console.error("Critical error opening school:", e);
            alert("Errore critico durante la riapertura: " + e); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleBulkDeleteClosures = async () => {
        setIsDeleteAllClosuresModalOpen(false);
        setLoading(true);
        try {
            await bulkDeleteAllClosures();
            await fetchData();
            alert("Tutte le chiusure sono state eliminate e le lezioni sospese ripristinate.");
        } catch (e) {
            console.error("Critical error bulk delete closures:", e);
            alert("Errore durante l'eliminazione massiva: " + e);
        } finally {
            setLoading(false);
        }
    };

    // Calendar Grid Logic
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    const endDate = new Date(monthEnd);
    
    // Adjust start to beginning of week (Monday)
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);

    // Adjust end to end of week (Sunday)
    const endDay = endDate.getDay();
    const endDiff = endDate.getDate() + (endDay === 0 ? 0 : 7 - endDay);
    endDate.setDate(endDiff);

    const calendarDays = [];
    let d = new Date(startDate);
    while (d <= endDate) {
        calendarDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    const holidays = useMemo(() => getItalianHolidays(currentDate.getFullYear()), [currentDate]);

    // Handler per click su evento
    const handleEventClick = (e: React.MouseEvent, evt: any) => {
        e.stopPropagation();
        if (evt.type === 'manual') {
            setEditingLesson(evt);
            setIsLessonModalOpen(true);
        } else {
            // Mostra dettagli gruppo se ci sono più studenti
            const participants = evt.studentNames && evt.studentNames.length > 0 
                ? evt.studentNames.join('\n- ')
                : evt.childName;
                
            let msg = `Lezione Iscrizione (${evt.startTime} - ${evt.endTime})\nSede: ${evt.locationName}`;
            if (evt.hasMergedProjects) msg += "\n(Include Progetti Istituzionali)";
            msg += `\n\nPartecipanti:\n- ${participants}`;
            
            alert(msg);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 md:mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Calendario</h1>
                    <p className="mt-1 text-sm md:text-base text-gray-500">Gestione lezioni extra e chiusure.</p>
                </div>
                <div className="flex items-center gap-2">
                    {closures.length > 0 && (
                        <button 
                            onClick={() => setIsDeleteAllClosuresModalOpen(true)}
                            className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center font-bold"
                            title="Elimina tutte le chiusure e ripristina lezioni"
                        >
                            <TrashIcon /> <span className="ml-1 hidden sm:inline">Elimina Tutte</span>
                        </button>
                    )}
                    <button onClick={() => { setEditingLesson(null); setIsLessonModalOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Nuova Lezione</span><span className="md:hidden ml-1">Nuova</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Calendar Header */}
                <div className="flex items-center justify-between p-2 md:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 z-10 relative">
                    <button onClick={handlePrevMonth} className="md-icon-btn bg-white shadow-sm hover:bg-gray-100 p-1 md:p-2">&lt;</button>
                    <h2 className="text-base md:text-xl font-bold text-gray-800 capitalize">
                        {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button onClick={handleNextMonth} className="md-icon-btn bg-white shadow-sm hover:bg-gray-100 p-1 md:p-2">&gt;</button>
                </div>

                {/* Days Header - STICKY */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0 z-10 shadow-sm relative">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                        <div key={day} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid - SCROLLABLE */}
                {loading ? <div className="flex-1 flex justify-center items-center"><Spinner /></div> : (
                    <div className="flex-1 grid grid-cols-7 overflow-y-auto custom-scrollbar">
                        {calendarDays.map((dayItem, idx) => {
                            const dateStr = toLocalISOString(dayItem);
                            const isCurrentMonth = dayItem.getMonth() === currentDate.getMonth();
                            const isToday = new Date().toDateString() === dayItem.toDateString();
                            const holidayName = holidays[dateStr];
                            const closure = closures.find(c => c.date === dateStr);
                            
                            // Filtra eventi per questo giorno dalla lista unificata
                            const dayEvents = events.filter(l => l.date.startsWith(dateStr));
                            // Ordina per orario
                            dayEvents.sort((a,b) => a.startTime.localeCompare(b.startTime));

                            return (
                                <div 
                                    key={idx} 
                                    // Aumento altezza minima a 180px
                                    className={`min-h-[80px] md:min-h-[180px] border-b border-r border-gray-100 p-1 md:p-2 flex flex-col relative transition-colors group ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'} ${isToday ? 'bg-indigo-50/30 animate-neon-pulse z-10' : ''}`}
                                    onClick={() => !closure && setManageClosureData({ date: dayItem })}
                                >
                                    <div className="flex justify-between items-start mb-1 md:mb-2">
                                        <span className={`text-xs md:text-sm font-bold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700' } ${holidayName ? 'text-red-500' : ''}`}>
                                            {dayItem.getDate()}
                                        </span>
                                        {closure ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setManageClosureData({ date: dayItem, closure }); }}
                                                className="text-[8px] md:text-[9px] font-bold bg-red-100 text-red-700 px-1.5 md:px-2 py-0.5 rounded border border-red-200 uppercase"
                                            >
                                                Chiuso
                                            </button>
                                        ) : holidayName ? (
                                            <span className="text-[8px] md:text-[9px] font-bold text-red-400 uppercase truncate max-w-[80px]" title={holidayName}>{holidayName}</span>
                                        ) : (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-gray-300 hover:text-gray-500 text-xs font-bold">+</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Events Container */}
                                    <div className="flex-1 space-y-1 md:space-y-0.5 overflow-y-auto custom-scrollbar pr-0 md:pr-1">
                                        {dayEvents.map(evt => {
                                            const bgCol = evt.locationColor || '#94a3b8';
                                            const textCol = getTextColorForBg(bgCol);
                                            
                                            // Costruzione Etichetta Desktop: Sede (3 char) + Orario
                                            const locName = evt.locationName || '';
                                            const locCode = locName.length >= 3 ? locName.substring(0, 3).toUpperCase() : locName.toUpperCase();
                                            const desktopLabel = `${locCode} ${evt.startTime}`;
                                            
                                            // Costruzione Etichetta Mobile: Sede (3 char) + Ora (2 char)
                                            const startHour = evt.startTime.split(':')[0];
                                            const mobileLabel = `${locCode} ${startHour}`;
                                            
                                            // Tooltip: Lista completa partecipanti
                                            const tooltip = `${evt.startTime} - ${evt.locationName}\n${evt.studentNames?.join(', ') || evt.childName || evt.description}`;

                                            return (
                                                <div 
                                                    key={evt.displayId} 
                                                    onClick={(e) => handleEventClick(e, evt)}
                                                    className="
                                                        rounded shadow-sm cursor-pointer hover:opacity-80 font-bold flex items-center transition-transform hover:scale-[1.02] border border-black/5
                                                        text-[9px] px-1 py-0.5 justify-center        
                                                        md:text-[10px] md:px-1.5 md:py-1 md:justify-between
                                                        mb-0.5 md:mb-0
                                                    "
                                                    style={{ backgroundColor: bgCol, color: textCol }}
                                                    title={tooltip}
                                                >
                                                    <span className="truncate w-full flex items-center gap-1 leading-tight justify-center md:justify-start">
                                                        {/* Mobile View */}
                                                        <span className="md:hidden">{mobileLabel}</span>
                                                        {/* Desktop View */}
                                                        <span className="hidden md:inline">{desktopLabel}</span>
                                                        
                                                        {evt.studentNames && evt.studentNames.length > 1 && (
                                                            <>
                                                                <span className="text-[8px] bg-black/20 px-1 rounded-full min-w-[16px] text-center hidden md:inline-block">
                                                                    {evt.studentNames.length}
                                                                </span>
                                                                {/* Mobile Indicator for Group REMOVED */}
                                                            </>
                                                        )}
                                                        {evt.hasMergedProjects && (
                                                            <span className="text-[8px] opacity-70 ml-0.5">
                                                                ★
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Overlay for closure details/creation */}
                                    {closure && (
                                        <div className="absolute inset-0 bg-red-50/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10">
                                            <span className="text-xs font-bold text-red-900 bg-white/80 px-2 py-1 rounded shadow-sm">{closure.reason}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            {isLessonModalOpen && (
                <Modal onClose={() => setIsLessonModalOpen(false)} size="lg">
                    <LessonForm 
                        lesson={editingLesson} 
                        suppliers={suppliers} 
                        clients={clients} 
                        onSave={handleSaveLesson} 
                        onDelete={handleDeleteLesson}
                        onCancel={() => setIsLessonModalOpen(false)} 
                    />
                </Modal>
            )}

            {manageClosureData && (
                <Modal onClose={() => setManageClosureData(null)} size="md">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-800">
                                {manageClosureData.closure ? 'Gestione Chiusura' : 'Nuova Chiusura'}
                            </h3>
                            <p className="text-sm font-medium text-gray-500">{manageClosureData.date.toLocaleDateString()}</p>
                        </div>

                        {manageClosureData.closure ? (
                            <div className="space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800">
                                    <p className="text-xs font-bold uppercase mb-1">Motivazione</p>
                                    <p className="font-bold">{manageClosureData.closure.reason}</p>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Riaprendo la scuola, le lezioni che erano state sospese verranno automaticamente ripristinate allo stato "Programmata".
                                </p>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button onClick={() => setManageClosureData(null)} className="md-btn md-btn-flat">Annulla</button>
                                    <button 
                                        onClick={() => handleDeleteClosure(manageClosureData.closure!.id, toLocalISOString(manageClosureData.date))} 
                                        className="md-btn md-btn-raised bg-green-600 text-white hover:bg-green-700"
                                    >
                                        Riapri Scuola
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    Chiudendo la scuola in questa data, tutte le lezioni programmate verranno <strong>SOSPESE</strong>. 
                                    Potrai gestirle successivamente tramite il wizard di recupero o lasciarle sospese.
                                </p>
                                <div className="md-input-group">
                                    <input 
                                        type="text" 
                                        value={closureReason} 
                                        onChange={e => setClosureReason(e.target.value)} 
                                        className="md-input" 
                                        placeholder=" " 
                                        autoFocus
                                    />
                                    <label className="md-input-label">Motivo Chiusura (es. Neve, Festa Patronale)</label>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button onClick={() => setManageClosureData(null)} className="md-btn md-btn-flat">Annulla</button>
                                    <button 
                                        onClick={handleAddClosure} 
                                        disabled={!closureReason.trim() || loading} 
                                        className="md-btn md-btn-raised md-btn-red"
                                    >
                                        {loading ? <Spinner /> : 'Conferma Chiusura'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            <ConfirmModal 
                isOpen={isDeleteAllClosuresModalOpen}
                onClose={() => setIsDeleteAllClosuresModalOpen(false)}
                onConfirm={handleBulkDeleteClosures}
                title="ELIMINA TUTTE LE CHIUSURE"
                message="⚠️ ATTENZIONE: Stai per eliminare TUTTI i record di chiusura scolastica dal database. Questa operazione RIPRISTINERÀ automaticamente tutte le lezioni che erano state sospese a causa di queste chiusure. L'operazione è irreversibile."
                isDangerous={true}
                confirmText="Sì, Procedi"
            />
        </div>
    );
};

export default Calendar;
