
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllEnrollments, updateEnrollment, deleteEnrollment } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, getInvoices } from '../services/financeService';
import { processPayment } from '../services/paymentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { Enrollment, Client, Supplier, ClientType, ParentClient, InstitutionalClient, EnrollmentStatus, EnrollmentInput, Invoice, PaymentMethod, DocumentStatus } from '../types';
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
    const [invoices, setInvoices] = useState<Invoice[]>([]);
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

    // Payment Modal State
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        date: string;
        method: PaymentMethod;
        createInvoice: boolean;
        isDeposit: boolean;
        isBalance: boolean;
        depositAmount: number;
        ghostInvoiceId?: string;
        totalPaid: number; 
    }>({
        isOpen: false,
        enrollment: null,
        date: new Date().toISOString().split('T')[0],
        method: PaymentMethod.BankTransfer,
        createInvoice: true,
        isDeposit: false,
        isBalance: false,
        depositAmount: 0,
        totalPaid: 0
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrData, cliData, supData, invData] = await Promise.all([
                getAllEnrollments(),
                getClients(),
                getSuppliers(),
                getInvoices()
            ]);
            setEnrollments(enrData);
            setClients(cliData);
            setSuppliers(supData);
            setInvoices(invData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); window.addEventListener('EP_DataUpdated', fetchData); return () => window.removeEventListener('EP_DataUpdated', fetchData); }, [fetchData]);

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

    // Helper: Payment Status Calculation
    const getPaymentStatus = (enr: Enrollment) => {
        const childName = enr.childName.toLowerCase();
        const relatedInvoices = invoices.filter(i => 
            i.clientId === enr.clientId && 
            !i.isDeleted && 
            !i.isGhost && 
            i.items.some(item => item.description.toLowerCase().includes(childName))
        );
        const totalPaid = relatedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const price = enr.price || 0;
        // Tolleranza per arrotondamenti
        const remaining = Math.max(0, price - totalPaid);
        const isFullyPaid = remaining < 0.5 && price > 0;
        
        return { totalPaid, remaining, isFullyPaid };
    };

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

    // Payment Logic
    const handlePaymentRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        
        const status = getPaymentStatus(enr);
        let ghostId = undefined;
        let isBalanceMode = true;
        let suggestedAmount = status.remaining;

        // Check for Ghost Invoice
        const childName = enr.childName.toLowerCase();
        const ghostInvoice = invoices.find(i => 
            i.clientId === enr.clientId && 
            i.isGhost === true && 
            i.status === DocumentStatus.Draft && 
            !i.isDeleted && 
            i.items.some(item => item.description.toLowerCase().includes('saldo') && item.description.toLowerCase().includes(childName))
        );

        if (ghostInvoice) ghostId = ghostInvoice.id;

        setPaymentModalState({ 
            isOpen: true, 
            enrollment: enr, 
            date: new Date().toISOString().split('T')[0], 
            method: PaymentMethod.BankTransfer, 
            createInvoice: true, 
            isDeposit: false, 
            isBalance: isBalanceMode, 
            depositAmount: suggestedAmount, 
            ghostInvoiceId: ghostId, 
            totalPaid: status.totalPaid 
        });
    };

    const executePaymentAction = async () => {
        if (!paymentModalState.enrollment) return;
        
        setLoading(true);
        const enr = paymentModalState.enrollment;
        const fullPrice = enr.price || 0;
        const actualAmount = Number(paymentModalState.depositAmount); 
        const client = clients.find(c => c.id === enr.clientId);

        const result = await processPayment(
            enr, 
            client, 
            actualAmount, 
            paymentModalState.date, 
            paymentModalState.method, 
            paymentModalState.createInvoice,
            paymentModalState.isDeposit,
            fullPrice,
            paymentModalState.ghostInvoiceId
        );

        if (result.success) {
            alert("Pagamento registrato con successo.");
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } else {
            alert("ERRORE: " + result.error); 
        }
        setLoading(false);
        setPaymentModalState(prev => ({...prev, isOpen: false}));
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
                                        {group.items.map(enr => {
                                            const paymentInfo = getPaymentStatus(enr);
                                            const isFullyPaid = paymentInfo.isFullyPaid;
                                            
                                            return (
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

                                                {/* Amount & Status */}
                                                <div className="text-right flex-shrink-0">
                                                    <span className="block text-lg font-black text-gray-700 font-mono">{enr.price?.toFixed(2)}€</span>
                                                    {isFullyPaid ? (
                                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">SALDATO</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">DA PAGARE</span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-1 md:flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4 mt-2 md:mt-0">
                                                    <button 
                                                        onClick={(e) => handlePaymentRequest(e, enr)}
                                                        className={`md-icon-btn shadow-sm ${!isFullyPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                        title="Gestione Pagamenti / Saldo"
                                                    >
                                                        <span className="font-bold text-xs">€</span>
                                                    </button>
                                                    <button onClick={() => handleEditRequest(enr)} className="md-icon-btn edit bg-white shadow-sm" title="Modifica"><PencilIcon /></button>
                                                    <button onClick={() => handleTerminateRequest(enr)} className="md-icon-btn text-amber-600 hover:bg-amber-50 bg-white shadow-sm" title="Termina/Annulla"><StopIcon /></button>
                                                    <button onClick={() => handleDeleteRequest(enr)} className="md-icon-btn delete bg-white shadow-sm" title="Elimina"><TrashIcon /></button>
                                                </div>
                                            </div>
                                        )})}
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

            {/* MODALS */}
            
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

            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento (Archivio)</h3>
                        <p className="text-sm text-gray-500 mb-2">Pagamento per <strong>{paymentModalState.enrollment.childName}</strong>.</p>
                        
                        <div className="bg-indigo-50 p-3 rounded mb-4 text-xs">
                            <p>Prezzo Totale: <strong>{paymentModalState.enrollment.price}€</strong></p>
                            <p>Già Versato: <strong>{paymentModalState.totalPaid.toFixed(2)}€</strong></p>
                            <p className="text-indigo-700 font-bold">Rimanenza: {( (paymentModalState.enrollment.price || 0) - paymentModalState.totalPaid ).toFixed(2)}€</p>
                        </div>

                        <div className="md-input-group mb-4">
                            <input type="date" value={paymentModalState.date} onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))} className="md-input font-bold" />
                            <label className="md-input-label !top-0">Data Pagamento</label>
                        </div>
                        
                        <div className="md-input-group mb-4">
                            <select value={paymentModalState.method} onChange={(e) => setPaymentModalState(prev => ({ ...prev, method: e.target.value as PaymentMethod }))} className="md-input">
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <label className="md-input-label !top-0">Metodo Pagamento</label>
                        </div>

                        <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                            <div className="flex gap-4">
                                <label className="flex items-center cursor-pointer">
                                    <input type="radio" name="paymentType" checked={paymentModalState.isDeposit} onChange={() => setPaymentModalState(prev => ({ ...prev, isDeposit: true, isBalance: false, depositAmount: 0 }))} className="h-4 w-4 text-indigo-600 rounded" />
                                    <span className="ml-2 text-sm font-bold text-gray-700">In Acconto</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input type="radio" name="paymentType" checked={paymentModalState.isBalance} onChange={() => setPaymentModalState(prev => ({ ...prev, isBalance: true, isDeposit: false, depositAmount: prev.enrollment ? Math.max(0, (prev.enrollment.price || 0) - prev.totalPaid) : 0 }))} className="h-4 w-4 text-green-600 rounded" />
                                    <span className="ml-2 text-sm font-bold text-green-700">A Saldo / Tutto Subito</span>
                                </label>
                            </div>
                            
                            {(paymentModalState.isDeposit || paymentModalState.isBalance) && (
                                <div className="animate-fade-in pl-2 pt-2">
                                    <label className="text-xs text-gray-500 block font-bold mb-1">Importo Versato Ora</label>
                                    <input type="number" value={paymentModalState.depositAmount} onChange={e => setPaymentModalState(prev => ({ ...prev, depositAmount: Number(e.target.value) }))} className="w-full p-2 border rounded text-sm font-bold text-right" placeholder={paymentModalState.isDeposit ? "Inserisci quota concordata..." : ""} />
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Generazione Documento</label>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-2 border rounded cursor-pointer text-center text-xs transition-colors ${!paymentModalState.createInvoice ? 'bg-gray-100 border-gray-300 text-gray-600' : 'bg-white border-gray-200'}`}>
                                    <input type="radio" name="invoiceGen" checked={!paymentModalState.createInvoice} onChange={() => setPaymentModalState(prev => ({ ...prev, createInvoice: false }))} className="hidden" />
                                    🚫 Non crea fattura
                                </label>
                                <label className={`flex-1 p-2 border rounded cursor-pointer text-center text-xs transition-colors ${paymentModalState.createInvoice ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-gray-200'}`}>
                                    <input type="radio" name="invoiceGen" checked={paymentModalState.createInvoice} onChange={() => setPaymentModalState(prev => ({ ...prev, createInvoice: true }))} className="hidden" />
                                    📄 Crea fattura {paymentModalState.ghostInvoiceId ? '(Promuovi)' : ''}
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                            <button onClick={executePaymentAction} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma Pagamento</button>
                        </div>
                    </div>
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
