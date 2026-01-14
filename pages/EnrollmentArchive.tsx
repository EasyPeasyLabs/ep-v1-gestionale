
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllEnrollments, updateEnrollment, deleteEnrollment } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { Enrollment, Client, Supplier, ClientType, ParentClient, InstitutionalClient, EnrollmentStatus, EnrollmentInput } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import EnrollmentForm from '../components/EnrollmentForm';
import SearchIcon from '../components/icons/SearchIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import StopIcon from '../components/icons/StopIcon';

// Helpers
const getClientName = (c?: Client) => {
    if (!c) return 'Sconosciuto';
    return c.clientType === ClientType.Parent 
        ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
        : (c as InstitutionalClient).companyName;
};

// Colors for timeline bars
const getStatusColor = (status: EnrollmentStatus) => {
    switch (status) {
        case EnrollmentStatus.Active: return 'bg-green-500 border-green-600';
        case EnrollmentStatus.Completed: return 'bg-blue-500 border-blue-600';
        case EnrollmentStatus.Expired: return 'bg-gray-400 border-gray-500';
        case EnrollmentStatus.Pending: return 'bg-amber-400 border-amber-500';
        default: return 'bg-gray-300';
    }
};

const EnrollmentArchive: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
    const [filterLocation, setFilterLocation] = useState('');

    // Actions State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null);
    const [terminateTarget, setTerminateTarget] = useState<Enrollment | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrData, cliData, supData] = await Promise.all([
                getAllEnrollments(),
                getClients(),
                getSuppliers()
            ]);
            setEnrollments(enrData);
            setClients(cliData);
            setSuppliers(supData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const parentClients = useMemo(() => clients.filter(c => c.clientType === ClientType.Parent) as ParentClient[], [clients]);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        enrollments.forEach(e => years.add(new Date(e.startDate).getFullYear()));
        // Aggiungi anno corrente e prossimo se mancano
        const curr = new Date().getFullYear();
        years.add(curr);
        return Array.from(years).sort((a,b) => b-a);
    }, [enrollments]);

    const availableLocations = useMemo(() => {
        const locs = new Set<string>();
        enrollments.forEach(e => {
            if (e.locationName && e.locationName !== 'Sede Non Definita') locs.add(e.locationName);
        });
        return Array.from(locs).sort();
    }, [enrollments]);

    // Filtering Logic
    const filteredEnrollments = useMemo(() => {
        return enrollments.filter(enr => {
            const startYear = new Date(enr.startDate).getFullYear();
            const endYear = new Date(enr.endDate).getFullYear();
            
            // Year Match (include if range overlaps selected year)
            const yearMatch = startYear <= filterYear && endYear >= filterYear;
            
            if (!yearMatch) return false;
            
            if (filterLocation && enr.locationName !== filterLocation) return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const client = clients.find(c => c.id === enr.clientId);
                const parentName = getClientName(client);
                return (
                    enr.childName.toLowerCase().includes(term) ||
                    parentName.toLowerCase().includes(term) ||
                    enr.subscriptionName.toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [enrollments, filterYear, filterLocation, searchTerm, clients]);

    // Grouping for List View
    const groupedData = useMemo(() => {
        const groups: Record<string, { studentName: string, clientName: string, items: Enrollment[] }> = {};
        
        filteredEnrollments.forEach(enr => {
            const key = `${enr.childName}_${enr.clientId}`; // Composite key student-parent
            if (!groups[key]) {
                const client = clients.find(c => c.id === enr.clientId);
                groups[key] = {
                    studentName: enr.childName,
                    clientName: getClientName(client),
                    items: []
                };
            }
            groups[key].items.push(enr);
        });

        // Sort items inside groups by startDate desc
        Object.values(groups).forEach(g => {
            g.items.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        });

        return Object.values(groups).sort((a,b) => a.studentName.localeCompare(b.studentName));
    }, [filteredEnrollments, clients]);

    // Calendar Grid Logic
    const calendarGrid = useMemo(() => {
        if (viewMode !== 'calendar') return null;
        
        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        
        return (
            <div className="space-y-4 overflow-x-auto">
                {/* Header Mesi */}
                <div className="grid grid-cols-12 gap-1 min-w-[800px] mb-2 sticky top-0 bg-gray-50 z-10 p-2 border-b">
                    {months.map((m, i) => (
                        <div key={i} className="text-center text-xs font-bold text-gray-500 uppercase">{m}</div>
                    ))}
                </div>

                {groupedData.map((group, idx) => (
                    <div key={idx} className="bg-white border rounded-lg p-3 shadow-sm min-w-[800px]">
                        <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm text-gray-800">{group.studentName}</span>
                            <span className="text-xs text-gray-500">{group.clientName}</span>
                        </div>
                        
                        <div className="relative h-8 bg-gray-100 rounded overflow-hidden">
                            {/* Grid lines */}
                            <div className="absolute inset-0 grid grid-cols-12 gap-1 pointer-events-none">
                                {months.map((_, i) => (
                                    <div key={i} className="border-r border-gray-200 h-full last:border-0"></div>
                                ))}
                            </div>

                            {/* Bars */}
                            {group.items.map(enr => {
                                const start = new Date(enr.startDate);
                                const end = new Date(enr.endDate);
                                
                                // Cap within selected year
                                const yearStart = new Date(filterYear, 0, 1);
                                const yearEnd = new Date(filterYear, 11, 31);

                                if (end < yearStart || start > yearEnd) return null;

                                const effectiveStart = start < yearStart ? yearStart : start;
                                const effectiveEnd = end > yearEnd ? yearEnd : end;

                                // Calculate position
                                const totalDays = 365; // Approx
                                const startDay = Math.floor((effectiveStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
                                const durationDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
                                
                                const leftPercent = (startDay / totalDays) * 100;
                                const widthPercent = Math.max(0.5, (durationDays / totalDays) * 100);

                                return (
                                    <div 
                                        key={enr.id}
                                        className={`absolute h-4 top-2 rounded shadow-sm border-l-2 ${getStatusColor(enr.status)} opacity-80 hover:opacity-100 hover:z-10 transition-all cursor-pointer`}
                                        style={{ 
                                            left: `${leftPercent}%`, 
                                            width: `${widthPercent}%`,
                                            backgroundColor: enr.locationColor || '#ccc' 
                                        }}
                                        title={`${enr.subscriptionName} | ${enr.locationName} (${new Date(enr.startDate).toLocaleDateString()} - ${new Date(enr.endDate).toLocaleDateString()})`}
                                        onClick={() => handleEditRequest(enr)}
                                    ></div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [viewMode, groupedData, filterYear]);

    // --- Action Handlers ---

    const handleEditRequest = (enr: Enrollment) => {
        setEditingEnrollment(enr);
        setIsEditModalOpen(true);
    };

    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[]) => {
        setLoading(true);
        try {
            for (const enrollmentData of enrollmentsData) {
                if ('id' in enrollmentData) {
                    await updateEnrollment((enrollmentData as any).id, enrollmentData);
                }
            }
            setIsEditModalOpen(false);
            setEditingEnrollment(undefined);
            await fetchData();
        } catch (err) {
            console.error("Save error:", err);
            alert("Errore salvataggio.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRequest = (enr: Enrollment) => {
        setDeleteTarget(enr);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setLoading(true);
        try {
            // Clean financials & delete
            await cleanupEnrollmentFinancials(deleteTarget);
            await deleteEnrollment(deleteTarget.id);
            await fetchData();
        } catch (err) {
            alert("Errore eliminazione.");
        } finally {
            setLoading(false);
            setDeleteTarget(null);
        }
    };

    const handleTerminateRequest = (enr: Enrollment) => {
        setTerminateTarget(enr);
    };

    const handleConfirmTerminate = async () => {
        if (!terminateTarget) return;
        setLoading(true);
        try {
            await updateEnrollment(terminateTarget.id, { status: EnrollmentStatus.Expired });
            await fetchData();
        } catch (err) {
            alert("Errore aggiornamento stato.");
        } finally {
            setLoading(false);
            setTerminateTarget(null);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Archivio Iscrizioni</h1>
                    <p className="mt-1 text-gray-500">Storico e copertura temporale delle iscrizioni.</p>
                </div>
                
                {/* Filters Toolbar */}
                <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <div className="relative w-40">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                        <input 
                            type="text" 
                            className="w-full pl-8 pr-2 py-1.5 text-sm border-none bg-transparent focus:ring-0 placeholder:text-gray-400"
                            placeholder="Cerca..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <select 
                        value={filterYear} 
                        onChange={e => setFilterYear(Number(e.target.value))} 
                        className="text-sm font-bold text-indigo-700 bg-indigo-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-indigo-200"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <select 
                        value={filterLocation} 
                        onChange={e => setFilterLocation(e.target.value)} 
                        className="text-sm text-gray-600 bg-gray-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-gray-200 max-w-[150px]"
                    >
                        <option value="">Tutte le Sedi</option>
                        {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Lista">
                            <ChecklistIcon />
                        </button>
                        <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Calendario Copertura">
                            <CalendarIcon />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="flex-1 overflow-y-auto pr-2 pb-10">
                    
                    {/* View Mode Switch */}
                    {viewMode === 'list' ? (
                        <div className="space-y-6 animate-fade-in">
                            {groupedData.length === 0 && <p className="text-center text-gray-400 italic py-10">Nessuna iscrizione trovata per i filtri selezionati.</p>}
                            
                            {groupedData.map((group, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">{group.studentName}</h3>
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{group.clientName}</p>
                                        </div>
                                        <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border text-gray-600">
                                            Tot. {group.items.reduce((acc, curr) => acc + (curr.price || 0), 0).toFixed(2)}€
                                        </span>
                                    </div>
                                    
                                    <div className="divide-y divide-gray-50">
                                        {group.items.map(enr => (
                                            <div key={enr.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                {/* Date Block */}
                                                <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-800 rounded-lg p-2 min-w-[100px] border border-indigo-100">
                                                    <span className="text-[10px] font-bold uppercase">Dal</span>
                                                    <span className="text-sm font-mono font-bold">{new Date(enr.startDate).toLocaleDateString()}</span>
                                                    <div className="w-full h-px bg-indigo-200 my-1"></div>
                                                    <span className="text-[10px] font-bold uppercase">Al</span>
                                                    <span className="text-sm font-mono font-bold">{new Date(enr.endDate).toLocaleDateString()}</span>
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-gray-800 text-sm">{enr.subscriptionName}</h4>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${enr.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : enr.status === 'Completed' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                            {enr.status === 'Active' ? 'Attivo' : enr.status === 'Completed' ? 'Completato' : enr.status === 'Expired' ? 'Scaduto' : 'In Attesa'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: enr.locationColor || '#ccc' }}></span>
                                                            <span>{enr.locationName}</span>
                                                        </div>
                                                        <div className="font-mono">
                                                            {enr.lessonsTotal} Lez. Totali
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="text-right flex-shrink-0">
                                                    <span className="block text-lg font-black text-gray-700 font-mono">{enr.price?.toFixed(2)}€</span>
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold">Importo</span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-1 md:flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4 mt-2 md:mt-0">
                                                    <button onClick={() => handleEditRequest(enr)} className="md-icon-btn edit bg-white shadow-sm" title="Modifica"><PencilIcon /></button>
                                                    <button onClick={() => handleTerminateRequest(enr)} className="md-icon-btn text-amber-600 hover:bg-amber-50 bg-white shadow-sm" title="Termina/Annulla"><StopIcon /></button>
                                                    <button onClick={() => handleDeleteRequest(enr)} className="md-icon-btn delete bg-white shadow-sm" title="Elimina"><TrashIcon /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="animate-fade-in bg-white p-4 rounded-xl shadow border border-gray-200 overflow-hidden">
                            {calendarGrid}
                            {groupedData.length === 0 && <p className="text-center text-gray-400 italic py-10">Nessun dato da visualizzare.</p>}
                        </div>
                    )}
                </div>
            )}

            {isEditModalOpen && editingEnrollment && (
                <Modal onClose={() => setIsEditModalOpen(false)} size="lg">
                    <EnrollmentForm 
                        parents={parentClients} 
                        initialParent={parentClients.find(p => p.id === editingEnrollment.clientId)} 
                        existingEnrollment={editingEnrollment} 
                        onSave={handleSaveEnrollment} 
                        onCancel={() => setIsEditModalOpen(false)} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina Iscrizione Storica"
                message="Sei sicuro di voler eliminare questa iscrizione dall'archivio? Questa azione cancellerà anche tutti i dati finanziari e le lezioni associate. È irreversibile."
                isDangerous={true}
            />

            <ConfirmModal 
                isOpen={!!terminateTarget}
                onClose={() => setTerminateTarget(null)}
                onConfirm={handleConfirmTerminate}
                title="Annulla/Termina Iscrizione"
                message="Vuoi segnare questa iscrizione come 'Scaduta/Ritirata'? Questo non cancella i dati, ma aggiorna lo stato per indicare che non è stata completata regolarmente."
                confirmText="Sì, Termina"
            />
        </div>
    );
};

export default EnrollmentArchive;
