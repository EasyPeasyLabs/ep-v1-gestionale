
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput, Supplier, Invoice, Client, InstitutionalClient } from '../types';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment, addRecoveryLessons, bulkUpdateLocation, activateEnrollmentWithLocation, getEnrollmentsForClient } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, deleteAutoRentTransactions, getInvoices } from '../services/financeService';
import { processPayment } from '../services/paymentService';
import { importEnrollmentsFromExcel } from '../services/importService';
import { exportEnrollmentsToExcel } from '../utils/financeExport';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import EnrollmentForm from '../components/EnrollmentForm';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import SearchIcon from '../components/icons/SearchIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RefreshIcon from '../components/icons/RestoreIcon';
import UserPlusIcon from '../components/icons/UserPlusIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ImportModal from '../components/ImportModal';
import ClockIcon from '../components/icons/ClockIcon';

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

const getTextColorForBg = (bgColor: string) => {
    if (!bgColor || bgColor === 'unassigned') return '#1f2937';
    const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#1f2937' : '#ffffff';
};

const getClientName = (c?: Client) => {
    if (!c) return 'Sconosciuto';
    if (c.clientType === ClientType.Parent) {
        const p = c as ParentClient;
        return `${p.firstName || ''} ${p.lastName || ''}`.trim();
    } else {
        const i = c as InstitutionalClient;
        return i.companyName || 'Ente Sconosciuto';
    }
};

interface EnrollmentsProps {
    initialParams?: {
        status?: string;
        searchTerm?: string;
    };
}

const Enrollments: React.FC<EnrollmentsProps> = ({ initialParams }) => {
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(initialParams?.searchTerm || '');
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    const [bulkAssignState, setBulkAssignState] = useState<{ isOpen: boolean; locationId: string; locationName: string; locationColor: string; } | null>(null);
    
    // State per la modale di assegnazione manuale
    const [assignSearch, setAssignSearch] = useState('');
    const [assignDay, setAssignDay] = useState(1);
    const [assignStart, setAssignStart] = useState('16:00');
    const [assignEnd, setAssignEnd] = useState('18:00');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [clientsData, enrollmentsData, suppliersData] = await Promise.all([ getClients(), getAllEnrollments(), getSuppliers() ]);
            setAllClients(clientsData);
            setEnrollments(enrollmentsData);
            setSuppliers(suppliersData);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        fetchData(); 
        if (initialParams?.searchTerm) {
            setSearchTerm(initialParams.searchTerm);
        }
    }, [fetchData, initialParams]);

    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[], options?: { regenerateCalendar: boolean }) => { 
        setLoading(true); 
        try { 
            for (const d of enrollmentsData) { 
                if ('id' in d) {
                    // Update Logic
                    await updateEnrollment((d as any).id, d, options?.regenerateCalendar);
                } else {
                    // Create Logic
                    const newId = await addEnrollment(d);
                    
                    // HYBRID LOGIC: Direct Assignment if location was selected in Modal
                    if (d.locationId && d.locationId !== 'unassigned') {
                        // Extract Start/End from template if available, otherwise use defaults
                        const startTime = d.appointments?.[0]?.startTime || '16:00';
                        const endTime = d.appointments?.[0]?.endTime || '18:00';
                        
                        // Calculate Day of Week from Start Date
                        const dayOfWeek = new Date(d.startDate).getDay(); // 0=Dom, 1=Lun

                        // Call Activate logic to generate calendar
                        await activateEnrollmentWithLocation(
                            newId,
                            d.supplierId || 'unassigned',
                            d.supplierName || '',
                            d.locationId,
                            d.locationName || 'Sede',
                            d.locationColor || '#ccc',
                            dayOfWeek,
                            startTime,
                            endTime
                        );
                    }
                }
            } 
            setIsModalOpen(false); await fetchData(); 
        } finally { setLoading(false); } 
    };

    const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("text/plain", id); };
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = async (e: React.DragEvent, locId: string, locName: string, locColor: string, day: number, start: string, end: string) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (!id) return;
        await performAssignment(id, locId, locName, locColor, day, start, end);
    };

    const performAssignment = async (id: string, locId: string, locName: string, locColor: string, day: number, start: string, end: string) => {
        const enr = enrollments.find(x => x.id === id);
        if (!enr) return;
        setLoading(true);
        try {
            if (enr.locationId === 'unassigned') {
                let sId = '', sName = '';
                suppliers.forEach(s => { if (s.locations.some(l => l.id === locId)) { sId = s.id; sName = s.companyName; } });
                await activateEnrollmentWithLocation(id, sId, sName, locId, locName, locColor, day, start, end);
            } else {
                await bulkUpdateLocation([id], new Date().toISOString(), locId, locName, locColor, start, end);
            }
            await fetchData();
        } finally { setLoading(false); }
    };

    const handleManualAssign = async (enrollment: Enrollment) => {
        if (!bulkAssignState) return;
        await performAssignment(
            enrollment.id, 
            bulkAssignState.locationId, 
            bulkAssignState.locationName, 
            bulkAssignState.locationColor, 
            assignDay, 
            assignStart, 
            assignEnd
        );
        // Non chiudiamo la modale per permettere assegnazioni multiple rapide
    };

    // Calculate available locations combining suppliers config and existing enrollments (legacy)
    const availableLocations = useMemo(() => {
        const names = new Set<string>();
        suppliers.forEach(s => s.locations.forEach(l => names.add(l.name)));
        enrollments.forEach(e => {
            if (e.locationName && e.locationName !== 'Sede Non Definita') names.add(e.locationName);
        });
        return Array.from(names).sort();
    }, [suppliers, enrollments]);

    // Infrastructure-Driven Grouping
    const groupedEnrollments = useMemo(() => {
        const groups: Record<string, any> = {};

        // 1. Initialize from Suppliers (Infrastructure)
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                const key = l.id;
                groups[key] = { 
                    locationId: l.id, 
                    locationName: l.name, 
                    locationColor: l.color, 
                    days: {} 
                };
            });
        });

        // 2. Initialize 'Unassigned'
        groups['unassigned'] = { 
            locationId: 'unassigned', 
            locationName: 'Non Assegnati / In Attesa', 
            locationColor: '#e5e7eb', // Gray
            days: {} 
        };

        // 3. Filter Enrollments
        const filtered = enrollments.filter(e => {
            if (searchTerm && !e.childName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterLocation && e.locationName !== filterLocation) return false;
            return true;
        });

        // 4. Distribute
        filtered.forEach(e => {
            let groupId = e.locationId;
            if (!groupId || groupId === 'unassigned') groupId = 'unassigned';

            // Fallback for legacy locations not in suppliers
            if (!groups[groupId]) {
                groups[groupId] = {
                    locationId: groupId,
                    locationName: e.locationName || 'Sede Ignota',
                    locationColor: e.locationColor || '#9ca3af',
                    days: {}
                };
            }

            // Determine Day
            const date = e.appointments?.[0]?.date ? new Date(e.appointments[0].date) : null;
            const dIdx = date ? date.getDay() : 99; // 99 for Unassigned/Pending
            const dName = date ? daysOfWeekMap[dIdx] : 'In Attesa';

            if (!groups[groupId].days[dIdx]) {
                groups[groupId].days[dIdx] = { dayName: dName, items: [] };
            }
            groups[groupId].days[dIdx].items.push(e);
        });

        // 5. Filter result groups if location filter is active
        let result = Object.values(groups);
        if (filterLocation) {
            result = result.filter((g: any) => g.locationName === filterLocation);
        }

        // 6. Sort
        return result.sort((a: any, b: any) => {
            if (a.locationId === 'unassigned') return -1;
            if (b.locationId === 'unassigned') return 1;
            return a.locationName.localeCompare(b.locationName);
        });
    }, [enrollments, suppliers, searchTerm, filterLocation]);

    const unassignedEnrollments = useMemo(() => {
        return enrollments.filter(e => 
            (e.locationId === 'unassigned' || !e.locationId) && 
            e.childName.toLowerCase().includes(assignSearch.toLowerCase())
        );
    }, [enrollments, assignSearch]);

    return (
        <div className="pb-20">
            <div className="flex justify-between items-center mb-6">
                <div><h1 className="text-3xl font-bold">Iscrizioni</h1><p className="text-gray-500">Gestione dei recinti operativi.</p></div>
                <button onClick={() => { setEditingEnrollment(undefined); setIsModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> Nuova</button>
            </div>

            <div className="bg-white p-3 rounded-xl border mb-6 flex gap-4 items-center">
                <div className="relative flex-1"><SearchIcon /><input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="md-input pl-10" /></div>
                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="md-input w-48">
                    <option value="">Tutte le Sedi</option>
                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {loading ? <Spinner /> : (
                <div className="space-y-8">
                    {groupedEnrollments.map((loc, i) => (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, loc.locationId, loc.locationName, loc.locationColor, 1, '16:00', '18:00')}>
                            <div className="px-6 py-4 flex justify-between items-center" style={{ backgroundColor: loc.locationColor, color: getTextColorForBg(loc.locationColor) }}>
                                <h2 className="text-lg font-black uppercase tracking-widest">{loc.locationName}</h2>
                                {loc.locationId !== 'unassigned' && (
                                    <button 
                                        onClick={() => setBulkAssignState({ isOpen: true, locationId: loc.locationId, locationName: loc.locationName, locationColor: loc.locationColor })}
                                        className="p-1.5 rounded-lg hover:bg-white/20 transition-colors border border-transparent hover:border-white/30"
                                        title="Assegna manualmente allievo a questa sede"
                                    >
                                        <UserPlusIcon />
                                    </button>
                                )}
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Se non ci sono iscritti ma il gruppo esiste (Sede Vuota), mostra placeholder */}
                                {Object.keys(loc.days).length === 0 && (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                                        <p className="text-sm font-bold text-slate-400">Nessun allievo in questo recinto.</p>
                                        <p className="text-xs text-slate-300 mt-1">Trascina qui o usa il tasto + per aggiungere.</p>
                                    </div>
                                )}

                                {Object.values(loc.days).map((day: any, j) => {
                                    // GROUP BY TIME SLOTS LOGIC
                                    const timeGroups: Record<string, Enrollment[]> = {};
                                    day.items.forEach((enr: Enrollment) => {
                                        const start = enr.appointments?.[0]?.startTime || 'N/D';
                                        const end = enr.appointments?.[0]?.endTime || 'N/D';
                                        const key = `${start}-${end}`;
                                        if(!timeGroups[key]) timeGroups[key] = [];
                                        timeGroups[key].push(enr);
                                    });
                                    const sortedTimes = Object.keys(timeGroups).sort();

                                    return (
                                        <div key={j} className="pl-4 border-l-2 border-dashed border-slate-200">
                                            <div className="space-y-6">
                                                {sortedTimes.map((timeKey) => {
                                                    const [start, end] = timeKey.split('-');
                                                    const items = timeGroups[timeKey];
                                                    
                                                    return (
                                                        <div key={timeKey}>
                                                            {/* TIME BOX HEADER */}
                                                            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 p-2 rounded-lg mb-3">
                                                                <span className="text-xs font-black text-slate-600 uppercase tracking-wider ml-1">{day.dayName}</span>
                                                                <div className="h-4 w-px bg-slate-300"></div>
                                                                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded shadow-sm">
                                                                    <ClockIcon /> <span className="font-mono">{start} - {end}</span>
                                                                </div>
                                                                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                                    {items.length}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {items.map((enr: Enrollment) => {
                                                                    const isInst = enr.clientType === ClientType.Institutional || enr.isQuoteBased;
                                                                    const progress = enr.lessonsTotal > 0 ? ((enr.lessonsTotal - enr.lessonsRemaining) / enr.lessonsTotal) * 100 : 0;
                                                                    
                                                                    // Resolve Age
                                                                    let childAge = '';
                                                                    if (!isInst) {
                                                                        const client = allClients.find(c => c.id === enr.clientId);
                                                                        if (client && client.clientType === ClientType.Parent) {
                                                                            const child = (client as ParentClient).children.find(c => c.id === enr.childId);
                                                                            if (child && child.age) childAge = child.age;
                                                                        }
                                                                    }

                                                                    return (
                                                                        <div key={enr.id} draggable onDragStart={e => handleDragStart(e, enr.id)} className={`md-card p-4 border-l-4 transition-all hover:shadow-md cursor-grab ${isInst ? 'border-indigo-900 bg-indigo-50/20' : 'border-slate-200'}`} style={!isInst ? { borderLeftColor: loc.locationColor } : {}}>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div>
                                                                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                                                        <span className="truncate">{enr.childName}</span>
                                                                                        {childAge && <span className="bg-gray-100 text-black text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">{childAge}</span>}
                                                                                    </h4>
                                                                                    {isInst && <span className="text-[8px] font-black bg-indigo-900 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Progetto Ente</span>}
                                                                                </div>
                                                                                <button onClick={() => { setEditingEnrollment(enr); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 flex-shrink-0 ml-1"><PencilIcon/></button>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-500 mb-3 truncate">{enr.subscriptionName}</p>
                                                                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-auto"><div className={`h-full ${isInst ? 'bg-indigo-900' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div></div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} size="lg"><EnrollmentForm clients={allClients} initialClient={editingEnrollment ? allClients.find(c => c.id === editingEnrollment.clientId) : undefined} existingEnrollment={editingEnrollment} onSave={handleSaveEnrollment} onCancel={() => setIsModalOpen(false)} /></Modal>}
            
            {/* BULK ASSIGN MODAL */}
            {bulkAssignState && (
                <Modal onClose={() => setBulkAssignState(null)} size="lg">
                    <div className="flex flex-col h-[80vh]">
                        <div className="p-6 border-b flex-shrink-0" style={{ backgroundColor: bulkAssignState.locationColor, color: getTextColorForBg(bulkAssignState.locationColor) }}>
                            <h3 className="text-xl font-bold">Assegna a: {bulkAssignState.locationName}</h3>
                            <p className="text-xs opacity-80">Seleziona un allievo dalla lista "Non Assegnati" per inserirlo in questo recinto.</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 border-b flex gap-4 items-end flex-shrink-0">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giorno</label>
                                <select value={assignDay} onChange={e => setAssignDay(Number(e.target.value))} className="md-input text-xs py-1">
                                    {daysOfWeekMap.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inizio</label>
                                <input type="time" value={assignStart} onChange={e => setAssignStart(e.target.value)} className="md-input text-xs py-1" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fine</label>
                                <input type="time" value={assignEnd} onChange={e => setAssignEnd(e.target.value)} className="md-input text-xs py-1" />
                            </div>
                        </div>

                        <div className="p-4 border-b flex-shrink-0">
                            <div className="relative">
                                <SearchIcon />
                                <input 
                                    type="text" 
                                    placeholder="Cerca allievo non assegnato..." 
                                    className="md-input pl-10" 
                                    value={assignSearch} 
                                    onChange={e => setAssignSearch(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {unassignedEnrollments.length === 0 ? (
                                <p className="text-center text-gray-400 italic py-10">Nessun allievo non assegnato trovato.</p>
                            ) : (
                                unassignedEnrollments.map(enr => (
                                    <div key={enr.id} className="flex justify-between items-center p-3 bg-white border rounded-lg hover:shadow-sm">
                                        <div>
                                            <p className="font-bold text-gray-800">{enr.childName}</p>
                                            <p className="text-xs text-gray-500">{enr.subscriptionName}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleManualAssign(enr)}
                                            className="md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                                        >
                                            Assegna
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 flex justify-end flex-shrink-0">
                            <button onClick={() => setBulkAssignState(null)} className="md-btn md-btn-flat">Chiudi</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Enrollments;
