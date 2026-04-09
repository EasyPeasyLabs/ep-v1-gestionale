import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Enrollment, 
    Client, 
    ClientType, 
    ParentClient, 
    InstitutionalClient, 
    EnrollmentStatus, 
    Invoice, 
    Transaction, 
    PaymentMethod,
    EnrollmentInput,
    Supplier,
    DocumentStatus,
    AdvancedEnrollmentExportData
} from '../types';
import { 
    getAllEnrollments, 
    updateEnrollment, 
    deleteEnrollment 
} from '../services/enrollmentService';
import { getInvoices, getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { cleanupEnrollmentFinancials } from '../services/financeService';
import { processPayment } from '../services/paymentService';
import { exportAdvancedEnrollmentReport } from '../services/exportService';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { 
    Pencil, 
    Trash2, 
    Calendar, 
    List, 
    StopCircle,
    Download as DownloadIcon,
    Search as SearchIcon
} from 'lucide-react';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import EnrollmentForm from '../components/EnrollmentForm';
import EnrollmentFinancialWizard from '../components/EnrollmentFinancialWizard';

// Helpers
const getClientName = (c?: Client) => {
    if (!c) return 'Sconosciuto';
    return c.clientType === ClientType.Parent 
        ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
        : (c as InstitutionalClient).companyName;
};

type AnyEnrollmentStatus = EnrollmentStatus | string;

const normalizeEnrollmentStatus = (status: AnyEnrollmentStatus): EnrollmentStatus => {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'active' || s === 'confirmed') return EnrollmentStatus.Active;
    if (s === 'completed') return EnrollmentStatus.Completed;
    if (s === 'expired') return EnrollmentStatus.Expired;
    if (s === 'pending') return EnrollmentStatus.Pending;
    return EnrollmentStatus.Pending;
};

const getStatusColor = (status: AnyEnrollmentStatus) => {
    const normalized = normalizeEnrollmentStatus(status);
    switch (normalized) {
        case EnrollmentStatus.Active: return 'bg-green-500 border-green-600';
        case EnrollmentStatus.Completed: return 'bg-blue-500 border-blue-600';
        case EnrollmentStatus.Expired: return 'bg-gray-400 border-gray-500';
        case EnrollmentStatus.Pending: return 'bg-amber-400 border-amber-500';
        default: return 'bg-gray-300';
    }
};

const getStatusLabel = (status: AnyEnrollmentStatus, isFullyPaid: boolean) => {
    const normalized = normalizeEnrollmentStatus(status);
    const resolved = normalized === EnrollmentStatus.Pending && isFullyPaid ? EnrollmentStatus.Active : normalized;
    switch (resolved) {
        case EnrollmentStatus.Active: return 'Attivo';
        case EnrollmentStatus.Completed: return 'Completato';
        case EnrollmentStatus.Expired: return 'Scaduto';
        case EnrollmentStatus.Pending: return 'In Attesa';
        default: return 'In Attesa';
    }
};

const computePaymentStatus = (enr: Enrollment, invoices: Invoice[], transactions: Transaction[]) => {
    const relatedInvoices = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted && !i.isGhost);
    const invoicePaid = relatedInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const directTransactions = transactions.filter(t => 
        t.relatedEnrollmentId === enr.id && 
        !t.isDeleted && 
        (!t.relatedDocumentId || t.relatedDocumentId.startsWith('ENR-'))
    );
    const cashPaid = directTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPaid = invoicePaid + cashPaid;
    const price = Number(enr.price) || 0;
    const adjustment = Number(enr.adjustmentAmount || 0);
    const linkedGhosts = invoices.filter(i => i.relatedEnrollmentId === enr.id && i.isGhost && !i.isDeleted);
    const ghostTotal = linkedGhosts.reduce((sum, g) => sum + Number(g.totalAmount), 0);
    const remaining = Math.max(0, price - totalPaid - adjustment - ghostTotal);
    const isFullyPaid = remaining < 0.5 && price > 0;
    return { totalPaid, remaining, isFullyPaid, adjustment, ghostTotal };
};


const EnrollmentArchive: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
    const [filterLocation, setFilterLocation] = useState('');
    const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

    // Actions State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null);
    const [terminateTarget, setTerminateTarget] = useState<Enrollment | null>(null);

    // Selection State for Export
    const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);

    // Financial Wizard State
    const [financialWizardTarget, setFinancialWizardTarget] = useState<Enrollment | null>(null);

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
            const [enrData, cliData, supData, invData, trnData] = await Promise.all([
                getAllEnrollments(),
                getClients(),
                getSuppliers(),
                getInvoices(),
                getTransactions()
            ]);

            // 1) Auto-activation logic: se pagamento completamente coperto, promuovi Pending -> Active
            const toActivate = enrData.filter(enr =>
                normalizeEnrollmentStatus(enr.status) === EnrollmentStatus.Pending &&
                computePaymentStatus(enr, invData, trnData).isFullyPaid
            );

            if (toActivate.length > 0) {
                await Promise.all(toActivate.map(enr =>
                    updateEnrollment(enr.id, { status: EnrollmentStatus.Active })
                        .catch(err => { console.warn('Errore aggiornamento stato iscrizione:', err); })
                ));
                // Ricarica dopo la sincronizzazione per evitare incoerenze nella UI
                const refreshed = await getAllEnrollments();
                setEnrollments(refreshed);
            } else {
                setEnrollments(enrData);
            }

            setClients(cliData);
            setSuppliers(supData);
            setInvoices(invData);
            setTransactions(trnData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); window.addEventListener('EP_DataUpdated', fetchData); return () => window.removeEventListener('EP_DataUpdated', fetchData); }, [fetchData]);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        enrollments.forEach(e => years.add(new Date(e.startDate).getFullYear()));
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

    // UPDATED PAYMENT STATUS LOGIC (Hoisted)
    const getPaymentStatus = useCallback((enr: Enrollment) => {
        // 1. Sum linked invoices (Standard)
        return computePaymentStatus(enr, invoices, transactions);
    }, [invoices, transactions]);

    const filteredEnrollments = useMemo(() => {
        return enrollments.filter(enr => {
            const startYear = new Date(enr.startDate).getFullYear();
            const endYear = new Date(enr.endDate).getFullYear();
            const yearMatch = startYear <= filterYear && endYear >= filterYear;
            if (!yearMatch) return false;
            
            if (filterLocation && enr.locationName !== filterLocation) return false;
            
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const client = clients.find(c => c.id === enr.clientId);
                const parentName = getClientName(client);
                const matches = enr.childName.toLowerCase().includes(term) || parentName.toLowerCase().includes(term) || enr.subscriptionName.toLowerCase().includes(term);
                if (!matches) return false;
            }

            // New Payment Status Filter
            if (filterPaymentStatus !== 'all') {
                const status = getPaymentStatus(enr);
                if (filterPaymentStatus === 'paid' && !status.isFullyPaid) return false;
                if (filterPaymentStatus === 'unpaid' && status.isFullyPaid) return false;
            }

            return true;
        });
    }, [enrollments, filterYear, filterLocation, searchTerm, clients, filterPaymentStatus, getPaymentStatus]);

    const groupedData = useMemo(() => {
        const groups: Record<string, { studentName: string, clientName: string, items: Enrollment[] }> = {};
        filteredEnrollments.forEach(enr => {
            const key = `${enr.childName}_${enr.clientId}`;
            if (!groups[key]) {
                const client = clients.find(c => c.id === enr.clientId);
                groups[key] = { studentName: enr.childName, clientName: getClientName(client), items: [] };
            }
            groups[key].items.push(enr);
        });
        Object.values(groups).forEach(g => { g.items.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()); });
        return Object.values(groups).sort((a,b) => a.studentName.localeCompare(b.studentName));
    }, [filteredEnrollments, clients]);

    const calendarGrid = useMemo(() => {
        if (viewMode !== 'calendar') return null;
        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return (
            <div className="space-y-4 overflow-x-auto">
                <div className="grid grid-cols-12 gap-1 min-w-[800px] mb-2 sticky top-0 bg-gray-50 z-10 p-2 border-b">
                    {months.map((m, i) => ( <div key={i} className="text-center text-xs font-bold text-gray-500 uppercase">{m}</div> ))}
                </div>
                {groupedData.map((group, idx) => (
                    <div key={idx} className="bg-white border rounded-lg p-3 shadow-sm min-w-[800px]">
                        <div className="flex justify-between mb-2">
                            <span className="font-bold text-sm text-gray-800">{group.studentName}</span>
                            <span className="text-xs text-gray-500">{group.clientName}</span>
                        </div>
                        <div className="relative h-8 bg-gray-100 rounded overflow-hidden">
                            <div className="absolute inset-0 grid grid-cols-12 gap-1 pointer-events-none">
                                {months.map((_, i) => ( <div key={i} className="border-r border-gray-200 h-full last:border-0"></div> ))}
                            </div>
                            {group.items.map(enr => {
                                const start = new Date(enr.startDate); const end = new Date(enr.endDate);
                                const yearStart = new Date(filterYear, 0, 1); const yearEnd = new Date(filterYear, 11, 31);
                                if (end < yearStart || start > yearEnd) return null;
                                const effectiveStart = start < yearStart ? yearStart : start; const effectiveEnd = end > yearEnd ? yearEnd : end;
                                const totalDays = 365; const startDay = Math.floor((effectiveStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)); const durationDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
                                const leftPercent = (startDay / totalDays) * 100; const widthPercent = Math.max(0.5, (durationDays / totalDays) * 100);

                                const enrPayment = getPaymentStatus(enr);
                                const displayStatus = (normalizeEnrollmentStatus(enr.status) === EnrollmentStatus.Pending && enrPayment.isFullyPaid)
                                    ? EnrollmentStatus.Active
                                    : normalizeEnrollmentStatus(enr.status);

                                return (
                                    <div key={enr.id} className={`absolute h-4 top-2 rounded shadow-sm border-l-2 ${getStatusColor(displayStatus)} opacity-80 hover:opacity-100 hover:z-10 transition-all cursor-pointer`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, backgroundColor: enr.locationColor || '#ccc' }} title={`${enr.subscriptionName} | ${enr.locationName}`} onClick={() => handleEditRequest(enr)}></div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [viewMode, groupedData, filterYear, getPaymentStatus]);

    const handleEditRequest = (enr: Enrollment) => { setEditingEnrollment(enr); setIsEditModalOpen(true); };
    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[]) => {
        setLoading(true);
        try {
            for (const enrollmentData of enrollmentsData as (EnrollmentInput & { id?: string })[]) { if (enrollmentData.id) { await updateEnrollment(enrollmentData.id, enrollmentData); } }
            setIsEditModalOpen(false); setEditingEnrollment(undefined); await fetchData();
        } catch (err) { alert("Errore salvataggio."); } finally { setLoading(false); }
    };

    const handleDeleteRequest = (enr: Enrollment) => { setDeleteTarget(enr); };
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setLoading(true);
        try {
            // 1. Revert Lead Status if exists
            const client = clients.find(c => c.id === deleteTarget.clientId);
            if (client && client.clientType === ClientType.Parent) {
                const parentClient = client as ParentClient;
                const leadsRef = collection(db, 'incoming_leads');
                // Query by email and status 'converted'
                const q = query(
                    leadsRef, 
                    where('email', '==', parentClient.email),
                    where('status', '==', 'converted')
                );
                const querySnapshot = await getDocs(q);
                
                // Iterate and check child name match
                for (const docSnap of querySnapshot.docs) {
                    const leadData = docSnap.data();
                    // Check if child name matches (case insensitive)
                    if (leadData.childName && deleteTarget.childName && 
                        leadData.childName.toLowerCase().trim() === deleteTarget.childName.toLowerCase().trim()) {
                        
                        await updateDoc(doc(db, 'incoming_leads', docSnap.id), {
                            status: 'pending', // Revert to 'pending' (Nuovo)
                            convertedAt: null,
                            convertedStudentId: null
                        });
                        console.log(`Reverted lead status for ${leadData.childName}`);
                    }
                }
            }

            await cleanupEnrollmentFinancials(deleteTarget); 
            await deleteEnrollment(deleteTarget.id); 
            await fetchData(); 
        } catch (err) { 
            console.error(err);
            alert("Errore eliminazione."); 
        } finally { 
            setLoading(false); 
            setDeleteTarget(null); 
        }
    };

    const handleTerminateRequest = (enr: Enrollment) => { setTerminateTarget(enr); };
    const handleConfirmTerminate = async () => {
        if (!terminateTarget) return;
        setLoading(true);
        try { await updateEnrollment(terminateTarget.id, { status: EnrollmentStatus.Expired }); await fetchData(); } catch (err) { alert("Errore aggiornamento stato."); } finally { setLoading(false); setTerminateTarget(null); }
    };

    const handleOpenPaymentFromWizard = (enr: Enrollment, prefillAmount?: number) => {
        const status = getPaymentStatus(enr);
        let ghostId = undefined;
        const ghostInvoice = invoices.find(i => i.relatedEnrollmentId === enr.id && i.isGhost === true && i.status === DocumentStatus.Draft && !i.isDeleted);
        if (ghostInvoice) ghostId = ghostInvoice.id;
        
        // Auto-select invoice creation unless Cash
        // Initial setup for modal
        setPaymentModalState({ 
            isOpen: true, 
            enrollment: enr, 
            date: new Date().toISOString().split('T')[0], 
            method: PaymentMethod.BankTransfer, 
            createInvoice: true, // Default
            isDeposit: false, 
            isBalance: true, 
            depositAmount: prefillAmount || status.remaining, 
            ghostInvoiceId: ghostId, 
            totalPaid: status.totalPaid 
        });
        setFinancialWizardTarget(null); 
    };

    const executePaymentAction = async () => {
        if (!paymentModalState.enrollment) return;
        setLoading(true);
        const enr = paymentModalState.enrollment; const client = clients.find(c => c.id === enr.clientId);
        const result = await processPayment(enr, client, Number(paymentModalState.depositAmount), paymentModalState.date, paymentModalState.method, paymentModalState.createInvoice, paymentModalState.isDeposit, Number(enr.price) || 0, paymentModalState.ghostInvoiceId);
        if (result.success) { alert("Pagamento registrato."); await fetchData(); window.dispatchEvent(new Event('EP_DataUpdated')); } else { alert("ERRORE: " + result.error); }
        setLoading(false); setPaymentModalState(prev => ({...prev, isOpen: false}));
    };

    const toggleEnrollmentSelection = (id: string) => {
        setSelectedEnrollmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleExportExcel = () => {
        // 1. Determine Target Data
        const targets = selectedEnrollmentIds.length > 0 
            ? enrollments.filter(e => selectedEnrollmentIds.includes(e.id))
            : filteredEnrollments;

        if (targets.length === 0) return alert("Nessuna iscrizione da esportare.");

        // 2. Prepare Data Structure
        const exportData: AdvancedEnrollmentExportData[] = targets.map(enr => {
            const client = clients.find(c => c.id === enr.clientId);
            const supplier = suppliers.find(s => s.id === enr.supplierId);
            const linkedInvoices = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted);
            const linkedTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted);

            return {
                enrollment: enr,
                client,
                supplier,
                invoices: linkedInvoices,
                transactions: linkedTrans
            };
        });

        // 3. Export
        exportAdvancedEnrollmentReport(exportData);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
                <div><h1 className="text-3xl font-bold text-gray-800">Archivio Iscrizioni</h1><p className="mt-1 text-gray-500">Copertura temporale e pareggio contabile.</p></div>
                <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    {/* EXPORT BUTTON */}
                    <button onClick={handleExportExcel} className="p-1.5 rounded-md transition-all text-gray-600 hover:text-indigo-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 flex items-center gap-1" title="Esporta Excel">
                        <DownloadIcon />
                        {selectedEnrollmentIds.length > 0 && <span className="text-[10px] font-bold bg-ep-blue-600 text-white px-1.5 rounded-full">{selectedEnrollmentIds.length}</span>}
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <div className="relative w-40"><div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div><input type="text" className="w-full pl-8 pr-2 py-1.5 text-sm border-none bg-transparent focus:ring-0 placeholder:text-gray-400" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                    
                    <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="text-sm font-bold text-white bg-ep-blue-600 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-ep-blue-300">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    
                    <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="text-sm text-gray-600 bg-gray-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-gray-200 max-w-[150px]"><option value="">Tutte le Sedi</option>{availableLocations.map(l => <option key={l} value={l}>{l}</option>)}</select>
                    
                    {/* NEW PAYMENT STATUS FILTER */}
                    <select
                        value={filterPaymentStatus}
                        onChange={e => setFilterPaymentStatus(e.target.value as 'all' | 'paid' | 'unpaid')}
                        className="text-sm text-gray-600 bg-gray-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-gray-200"
                    >
                        <option value="all">Tutti gli stati</option>
                        <option value="paid">✅ Coperti</option>
                        <option value="unpaid">⚠️ Scoperti</option>
                    </select>

                    <div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Lista"><List /></button><button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Calendario Copertura"><Calendar /></button></div>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="flex-1 overflow-y-auto pr-2 pb-10">
                    {viewMode === 'list' ? (
                        <div className="space-y-6 animate-fade-in">
                            {groupedData.length === 0 && <p className="text-center text-gray-400 italic py-10">Nessuna iscrizione trovata.</p>}
                            {groupedData.map((group, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                                        <div><h3 className="text-lg font-bold text-gray-800">{group.studentName}</h3><p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{group.clientName}</p></div>
                                        <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border text-gray-600">Tot. {group.items.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0).toFixed(2)}€</span>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {group.items.map(enr => {
                                            const paymentInfo = getPaymentStatus(enr);
                                            const isFullyPaid = paymentInfo.isFullyPaid;
                                            return (
                                            <div key={enr.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center group">
                                                {/* Checkbox Selection */}
                                                <div className="flex items-center justify-center h-full mr-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedEnrollmentIds.includes(enr.id)} 
                                                        onChange={() => toggleEnrollmentSelection(enr.id)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-gray-300" 
                                                    />
                                                </div>

                                                <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-800 rounded-lg p-2 min-w-[100px] border border-indigo-100">
                                                    <span className="text-[10px] font-bold uppercase">Dal</span><span className="text-sm font-mono font-bold">{new Date(enr.startDate).toLocaleDateString()}</span>
                                                    <div className="w-full h-px bg-indigo-200 my-1"></div>
                                                    <span className="text-[10px] font-bold uppercase">Al</span><span className="text-sm font-mono font-bold">{new Date(enr.endDate).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-gray-800 text-sm">{enr.subscriptionName}</h4>
                                                        {(() => {
                                                            const isFullyPaid = getPaymentStatus(enr).isFullyPaid;
                                                            const statusLabel = getStatusLabel(enr.status, isFullyPaid);
                                                            const statusClass = (statusLabel === 'Attivo') ? 'bg-green-100 text-green-700 border-green-200'
                                                                : (statusLabel === 'Completato') ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                                : (statusLabel === 'Scaduto') ? 'bg-gray-100 text-gray-600 border-gray-200'
                                                                : 'bg-amber-100 text-amber-700 border-amber-200';
                                                            return (
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${statusClass}`}>
                                                                    {statusLabel}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: enr.locationColor || '#ccc' }}></span><span>{enr.locationName}</span></div>
                                                        <div className="font-mono">{enr.lessonsTotal} Lez. Totali</div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <span className="block text-lg font-black text-gray-700 font-mono">{Number(enr.price)?.toFixed(2)}€</span>
                                                    {isFullyPaid ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">COPERTO</span> : <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">SCOPERTO: {paymentInfo.remaining.toFixed(2)}€</span>}
                                                </div>
                                                <div className="flex gap-1 md:flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4 mt-2 md-mt-0">
                                                    <button onClick={() => setFinancialWizardTarget(enr)} className={`md-icon-btn shadow-sm ${!isFullyPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title="Gestione Finanziaria / Wizard"><span className="font-bold text-xs">€</span></button>
                                                    <button onClick={() => handleEditRequest(enr)} className="md-icon-btn edit bg-white shadow-sm" title="Modifica"><Pencil /></button>
                                                    <button onClick={() => handleTerminateRequest(enr)} className="md-icon-btn text-amber-600 hover:bg-amber-50 bg-white shadow-sm" title="Termina/Annulla"><StopCircle /></button>
                                                    <button onClick={() => handleDeleteRequest(enr)} className="md-icon-btn delete bg-white shadow-sm" title="Elimina"><Trash2 /></button>
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="animate-fade-in bg-white p-4 rounded-xl shadow border border-gray-200 overflow-hidden">{calendarGrid}</div>
                    )}
                </div>
            )}

            {/* MODALS */}
            {financialWizardTarget && (
                <Modal onClose={() => setFinancialWizardTarget(null)} size="lg">
                    <EnrollmentFinancialWizard 
                        enrollment={financialWizardTarget}
                        totalPaid={getPaymentStatus(financialWizardTarget).totalPaid}
                        onClose={() => setFinancialWizardTarget(null)}
                        onOpenPayment={(amt) => handleOpenPaymentFromWizard(financialWizardTarget, amt)}
                        onRefresh={fetchData}
                    />
                </Modal>
            )}

            {isEditModalOpen && editingEnrollment && (
                <Modal onClose={() => setIsEditModalOpen(false)} size="lg">
                    <EnrollmentForm clients={clients} initialClient={clients.find(c => c.id === editingEnrollment.clientId)} existingEnrollment={editingEnrollment} onSave={handleSaveEnrollment} onCancel={() => setIsEditModalOpen(false)} />
                </Modal>
            )}

            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        <div className="bg-indigo-50 p-3 rounded mb-4 text-xs">
                            <p>Prezzo Totale: <strong>{Number(paymentModalState.enrollment.price).toFixed(2)}€</strong></p>
                            <p className="text-indigo-700 font-bold">Rimanenza: {( Number(paymentModalState.enrollment.price || 0) - paymentModalState.totalPaid - Number(paymentModalState.enrollment.adjustmentAmount || 0) ).toFixed(2)}€</p>
                        </div>
                        <div className="md-input-group mb-4"><input type="date" value={paymentModalState.date} onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))} className="md-input font-bold" /><label className="md-input-label !top-0">Data</label></div>
                        <div className="md-input-group mb-4">
                            <select 
                                value={paymentModalState.method} 
                                onChange={(e) => {
                                    const newMethod = e.target.value as PaymentMethod;
                                    setPaymentModalState(prev => ({ 
                                        ...prev, 
                                        method: newMethod,
                                        createInvoice: newMethod !== PaymentMethod.Cash // Smart default
                                    }))
                                }} 
                                className="md-input"
                            >
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <label className="md-input-label !top-0">Metodo</label>
                        </div>

                        {/* TOGGLE FATTURA */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => setPaymentModalState(prev => ({ ...prev, createInvoice: !prev.createInvoice }))}>
                            <input 
                                type="checkbox" 
                                checked={paymentModalState.createInvoice} 
                                onChange={e => setPaymentModalState(prev => ({ ...prev, createInvoice: e.target.checked }))} 
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                                <span className="block text-sm font-bold text-slate-800">Genera Fattura Elettronica</span>
                                <span className="text-[10px] text-slate-500 block leading-tight font-medium">Se disattivato, registra solo movimento di cassa (No Doc).</span>
                            </div>
                        </div>

                        <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                             <label className="text-xs text-gray-500 block font-bold mb-1">Importo Versato Ora</label>
                             <input type="number" value={paymentModalState.depositAmount} onChange={e => setPaymentModalState(prev => ({ ...prev, depositAmount: Number(e.target.value) }))} className="w-full p-2 border rounded text-sm font-bold text-right" />
                        </div>
                        <div className="mt-6 flex justify-end gap-2"><button onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button><button onClick={executePaymentAction} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma Pagamento</button></div>
                    </div>
                </Modal>
            )}

            <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} title="Elimina Iscrizione" message="Sei sicuro? Questa azione cancellerà anche i dati finanziari collegati." isDangerous={true} />
            <ConfirmModal isOpen={!!terminateTarget} onClose={() => setTerminateTarget(null)} onConfirm={handleConfirmTerminate} title="Termina Iscrizione" message="Vuoi segnare l'iscrizione come 'Scaduta'?" confirmText="Sì, Termina" />
        </div>
    );
};

export default EnrollmentArchive;