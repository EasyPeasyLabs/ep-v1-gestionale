
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAllEnrollments, updateEnrollment, deleteEnrollment } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, getInvoices, getTransactions, getOrphanedFinancialsForClient, linkFinancialsToEnrollment, createGhostInvoiceForEnrollment, getQuotes } from '../services/financeService';
import { processPayment } from '../services/paymentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { Enrollment, Client, Supplier, ClientType, ParentClient, InstitutionalClient, EnrollmentStatus, EnrollmentInput, Invoice, Transaction, PaymentMethod, DocumentStatus, Quote } from '../types';
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
import SparklesIcon from '../components/icons/SparklesIcon';
import BanknotesIcon from '../components/icons/BanknotesIcon';

// Helpers
const getClientName = (c?: Client) => {
    if (!c) return 'Sconosciuto';
    return c.clientType === ClientType.Parent 
        ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
        : (c as InstitutionalClient).companyName;
};

const getStatusColor = (status: EnrollmentStatus) => {
    switch (status) {
        case EnrollmentStatus.Active: return 'bg-green-500 border-green-600';
        case EnrollmentStatus.Completed: return 'bg-blue-500 border-blue-600';
        case EnrollmentStatus.Expired: return 'bg-gray-400 border-gray-500';
        case EnrollmentStatus.Pending: return 'bg-amber-400 border-amber-500';
        default: return 'bg-gray-300';
    }
};

// --- FINANCIAL WIZARD COMPONENT ---
const EnrollmentFinancialWizard: React.FC<{
    enrollment: Enrollment;
    totalPaid: number;
    onClose: () => void;
    onOpenPayment: (prefillAmount?: number) => void;
    onRefresh: () => void;
}> = ({ enrollment, totalPaid, onClose, onOpenPayment, onRefresh }) => {
    const [path, setPath] = useState<'landing' | 'reconcile' | 'installments'>('landing');
    const [orphans, setOrphans] = useState<{ orphanInvoices: Invoice[], orphanTransactions: Transaction[], orphanGhosts: Invoice[] }>({ orphanInvoices: [], orphanTransactions: [], orphanGhosts: [] });
    const [loading, setLoading] = useState(false);
    const [relatedQuote, setRelatedQuote] = useState<Quote | null>(null);
    
    // Reconcile Form State
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
    const [adjustmentAmount, setAdjustmentAmount] = useState(enrollment.adjustmentAmount || 0);
    const [adjustmentNotes, setAdjustmentNotes] = useState(enrollment.adjustmentNotes || '');

    useEffect(() => {
        if (path === 'reconcile') {
            setLoading(true);
            getOrphanedFinancialsForClient(enrollment.clientId).then(data => {
                setOrphans(data);
                setLoading(false);
            });
        }
        if (enrollment.isQuoteBased && enrollment.relatedQuoteId && path === 'installments') {
            setLoading(true);
            getQuotes().then(list => {
                const found = list.find(q => q.id === enrollment.relatedQuoteId);
                if (found) setRelatedQuote(found);
                setLoading(false);
            });
        }
    }, [path, enrollment.clientId, enrollment.isQuoteBased, enrollment.relatedQuoteId]);

    const packagePrice = Number(enrollment.price) || 0;
    
    // Find already linked ghosts for this enrollment
    const [linkedGhosts, setLinkedGhosts] = useState<Invoice[]>([]);
    useEffect(() => {
        getInvoices().then(list => {
            const linked = list.filter(i => i.relatedEnrollmentId === enrollment.id && i.isGhost && !i.isDeleted);
            setLinkedGhosts(linked);
        });
    }, [enrollment.id]);

    const selectedOrphansTotal = useMemo(() => {
        const invSum = orphans.orphanInvoices.filter(i => selectedInvoiceIds.includes(i.id)).reduce((s, i) => s + Number(i.totalAmount), 0);
        const trnSum = orphans.orphanTransactions.filter(t => selectedTransactionIds.includes(t.id)).reduce((s, t) => s + Number(t.amount), 0);
        const ghostSum = orphans.orphanGhosts.filter(g => selectedInvoiceIds.includes(g.id)).reduce((s, g) => s + Number(g.totalAmount), 0);
        return invSum + trnSum + ghostSum;
    }, [orphans, selectedInvoiceIds, selectedTransactionIds]);

    const alreadyLinkedGhostsTotal = linkedGhosts.reduce((sum, g) => sum + Number(g.totalAmount), 0);
    
    // Critical Fix: Force Number casting on totalPaid to ensure correct math
    const projectedCoverage = Number(totalPaid) + selectedOrphansTotal + alreadyLinkedGhostsTotal + Number(adjustmentAmount);
    const remainingGap = Number((packagePrice - projectedCoverage).toFixed(2));
    const isBalanced = Math.abs(remainingGap) < 0.1;

    const handleConfirmReconcile = async () => {
        setLoading(true);
        try {
            await linkFinancialsToEnrollment(
                enrollment.id,
                selectedInvoiceIds,
                selectedTransactionIds,
                { amount: Number(adjustmentAmount), notes: adjustmentNotes }
            );
            onRefresh();
            onClose();
        } catch (e) {
            alert("Errore riconciliazione: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSaldoGhost = async () => {
        if (remainingGap <= 0) return;
        setLoading(true);
        try {
            const clientName = enrollment.childName; // Per gli enti il childName è il nome progetto
            await createGhostInvoiceForEnrollment(enrollment, clientName, remainingGap);
            onRefresh();
            const list = await getInvoices();
            setLinkedGhosts(list.filter(i => i.relatedEnrollmentId === enrollment.id && i.isGhost && !i.isDeleted));
            alert("Pro-forma di saldo generata con successo!");
        } catch (e) {
            alert("Errore generazione saldo: " + e);
        } finally {
            setLoading(false);
        }
    };

    if (path === 'landing') {
        return (
            <div className="p-8">
                <h3 className="text-2xl font-black text-slate-800 mb-2">Gestione Finanziaria</h3>
                <p className="text-sm text-slate-500 mb-8 uppercase tracking-widest font-bold">Progetto: {enrollment.childName}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {enrollment.isQuoteBased ? (
                        <button onClick={() => setPath('installments')} className="md-card p-6 border-2 border-indigo-50 hover:border-indigo-500 transition-all text-left flex flex-col items-center justify-center group">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">🗓️</div>
                            <h4 className="font-black text-slate-800 text-lg">Piano Rateale</h4>
                            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed px-4">Gestisci le scadenze concordate nel preventivo per questo ente.</p>
                        </button>
                    ) : (
                        <button onClick={() => onOpenPayment()} className="md-card p-6 border-2 border-indigo-50 hover:border-indigo-500 transition-all text-left flex flex-col items-center justify-center group">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">💸</div>
                            <h4 className="font-black text-slate-800 text-lg">Nuovo Incasso</h4>
                            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed px-4">Registra un nuovo versamento e genera i documenti fiscali necessari.</p>
                        </button>
                    )}

                    <button onClick={() => setPath('reconcile')} className="md-card p-6 border-2 border-amber-50 hover:border-amber-500 transition-all text-left flex flex-col items-center justify-center group">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">⚖️</div>
                        <h4 className="font-black text-slate-800 text-lg">Riconciliazione</h4>
                        <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed px-4">Collega pagamenti orfani o applica abbuoni per pareggio contabile.</p>
                    </button>
                </div>
            </div>
        );
    }

    if (path === 'installments') {
        return (
            <div className="flex flex-col h-[85vh]">
                <div className="p-6 border-b bg-indigo-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-indigo-900">Monitoraggio Rate Progetto</h3>
                    <p className="text-xs text-indigo-700">Situazione debitoria basata sul preventivo.</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? <Spinner /> : (
                        <>
                            {!relatedQuote ? <p className="text-sm text-red-500">Preventivo originale non trovato.</p> : (
                                <div className="space-y-3">
                                    {relatedQuote.installments.map((inst, i) => {
                                        const isPaid = inst.amount <= (totalPaid / relatedQuote.installments.length); // Semplificazione per UI
                                        return (
                                            <div key={i} className={`p-4 border rounded-xl flex justify-between items-center ${isPaid ? 'bg-green-50 border-green-200 opacity-60' : 'bg-white border-slate-200'}`}>
                                                <div>
                                                    <p className="font-bold text-slate-800">{inst.description}</p>
                                                    <p className="text-xs text-slate-500">Scadenza: {new Date(inst.dueDate).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right flex items-center gap-4">
                                                    <span className="font-black text-lg">{inst.amount.toFixed(2)}€</span>
                                                    {!isPaid && (
                                                        <button onClick={() => onOpenPayment(inst.amount)} className="md-btn md-btn-sm bg-indigo-600 text-white font-bold">Fattura Ora</button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="p-4 border-t bg-white flex justify-start flex-shrink-0">
                    <button onClick={() => setPath('landing')} className="md-btn md-btn-flat">Indietro</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[85vh]">
            <div className="p-6 border-b bg-amber-50 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-amber-900">Medical Financial Check</h3>
                        <p className="text-xs text-amber-700">Pareggio contabile e collegamento orfani.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Budget Totale</p>
                        <p className="text-2xl font-black text-slate-800">{packagePrice.toFixed(2)}€</p>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                        <span>Copertura Rilevata</span>
                        <span className={remainingGap > 0 ? 'text-red-500' : 'text-green-600'}>
                            {isBalanced ? 'Posizione Sanata ✨' : (remainingGap > 0 ? `Scoperto: ${remainingGap}€` : `Surplus: ${Math.abs(remainingGap)}€`)}
                        </span>
                    </div>
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min((totalPaid / packagePrice) * 100, 100)}%` }}></div>
                        <div className="h-full bg-indigo-300" style={{ width: `${Math.min((alreadyLinkedGhostsTotal / packagePrice) * 100, 100)}%` }}></div>
                        <div className="h-full bg-indigo-200 animate-pulse" style={{ width: `${Math.min((selectedOrphansTotal / packagePrice) * 100, 100)}%` }}></div>
                        <div className="h-full bg-amber-400" style={{ width: `${Math.min((Number(adjustmentAmount) / packagePrice) * 100, 100)}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {loading ? <div className="py-20 flex justify-center"><Spinner /></div> : (
                    <>
                        <section>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">📄 Documenti Orfani del Cliente</h4>
                            <div className="space-y-2">
                                {[...orphans.orphanInvoices, ...orphans.orphanGhosts].length === 0 && orphans.orphanTransactions.length === 0 && <p className="text-xs text-slate-400 italic">Nessun record orfano trovato.</p>}
                                {[...orphans.orphanInvoices, ...orphans.orphanGhosts].map(inv => (
                                    <label key={inv.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer ${selectedInvoiceIds.includes(inv.id) ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} onChange={() => setSelectedInvoiceIds(prev => prev.includes(inv.id) ? prev.filter(x => x !== inv.id) : [...prev, inv.id])} className="rounded text-indigo-600" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">{inv.isGhost ? 'Ghost (Pro-forma)' : 'Fattura Reale'}</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-slate-700">{Number(inv.totalAmount).toFixed(2)}€</span>
                                    </label>
                                ))}
                                {orphans.orphanTransactions.map(trn => (
                                    <label key={trn.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer ${selectedTransactionIds.includes(trn.id) ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={selectedTransactionIds.includes(trn.id)} onChange={() => setSelectedTransactionIds(prev => prev.includes(trn.id) ? prev.filter(x => x !== trn.id) : [...prev, trn.id])} className="rounded text-indigo-600" />
                                            <div><p className="text-sm font-bold text-slate-800">Cassa: {new Date(trn.date).toLocaleDateString()}</p><p className="text-[10px] text-slate-500 italic">"{trn.description}"</p></div>
                                        </div>
                                        <span className="font-black text-slate-700">{Number(trn.amount).toFixed(2)}€</span>
                                    </label>
                                ))}
                            </div>
                        </section>

                        {!enrollment.isQuoteBased && remainingGap > 0 && (
                            <section className="bg-indigo-900 text-white p-6 rounded-2xl border border-indigo-700 shadow-xl animate-slide-up">
                                <h4 className="text-lg font-black uppercase mb-1">Pareggio Automatico</h4>
                                <p className="text-sm mb-6 leading-relaxed opacity-90">Genera una **Pro-forma di Saldo** di <strong className="text-amber-400">{remainingGap.toFixed(2)}€</strong> per coprire il debito residuo.</p>
                                <button onClick={handleGenerateSaldoGhost} className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-black py-3 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs">Genera Pro-forma</button>
                            </section>
                        )}

                        <section className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">Regolazione Finale (Abbuono)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Importo Sconto</label>
                                    <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(Number(e.target.value))} className="md-input font-black text-indigo-700" placeholder="0.00" />
                                    <button type="button" onClick={() => setAdjustmentAmount(Number((packagePrice - (totalPaid + selectedOrphansTotal + alreadyLinkedGhostsTotal)).toFixed(2)))} className="text-[10px] font-black text-indigo-600 mt-2 hover:underline uppercase">Auto-Pareggio</button>
                                </div>
                                <div className="md-col-span-8">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Motivazione</label>
                                    <textarea value={adjustmentNotes} onChange={e => setAdjustmentNotes(e.target.value)} className="md-input text-xs" rows={3} placeholder="Es: Sconto Ente, Abbuono arrotondamento..." />
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>

            <div className="p-4 border-t bg-white flex justify-between items-center flex-shrink-0">
                <button onClick={() => setPath('landing')} className="md-btn md-btn-flat">Indietro</button>
                <div className="flex gap-3">
                    <button onClick={onClose} className="md-btn md-btn-flat">Chiudi</button>
                    <button onClick={handleConfirmReconcile} disabled={loading} className="md-btn md-btn-raised md-btn-primary px-8">{loading ? <Spinner /> : 'Conferma Regolarizzazione'}</button>
                </div>
            </div>
        </div>
    );
};


const EnrollmentArchive: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]); // ADDED STATE
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
                getTransactions() // ADDED FETCH
            ]);
            setEnrollments(enrData);
            setClients(cliData);
            setSuppliers(supData);
            setInvoices(invData);
            setTransactions(trnData); // ADDED SET
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
                return (enr.childName.toLowerCase().includes(term) || parentName.toLowerCase().includes(term) || enr.subscriptionName.toLowerCase().includes(term));
            }
            return true;
        });
    }, [enrollments, filterYear, filterLocation, searchTerm, clients]);

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

    // UPDATED PAYMENT STATUS LOGIC
    const getPaymentStatus = (enr: Enrollment) => {
        // 1. Sum linked invoices (Standard)
        const relatedInvoices = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted && !i.isGhost);
        const invoicePaid = relatedInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        
        // 2. Sum linked cash transactions (Solo Cassa)
        // These are transactions directly linked to enrollment AND NOT linked to any invoice
        // If they are linked to an invoice, they are covered by the invoice sum above (or ignored here to avoid double counting)
        // The standard is: invoice is the debt document. If invoice exists, we track invoice.
        // If no invoice (Solo Cassa), we track transaction.
        // To be safe: Sum transactions that have relatedEnrollmentId == enr.id AND (no relatedDocumentId OR relatedDocumentId starts with 'ENR-')
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
                                return (
                                    <div key={enr.id} className={`absolute h-4 top-2 rounded shadow-sm border-l-2 ${getStatusColor(enr.status)} opacity-80 hover:opacity-100 hover:z-10 transition-all cursor-pointer`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, backgroundColor: enr.locationColor || '#ccc' }} title={`${enr.subscriptionName} | ${enr.locationName}`} onClick={() => handleEditRequest(enr)}></div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [viewMode, groupedData, filterYear]);

    const handleEditRequest = (enr: Enrollment) => { setEditingEnrollment(enr); setIsEditModalOpen(true); };
    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[]) => {
        setLoading(true);
        try {
            for (const enrollmentData of enrollmentsData) { if ('id' in enrollmentData) { await updateEnrollment((enrollmentData as any).id, enrollmentData); } }
            setIsEditModalOpen(false); setEditingEnrollment(undefined); await fetchData();
        } catch (err) { alert("Errore salvataggio."); } finally { setLoading(false); }
    };

    const handleDeleteRequest = (enr: Enrollment) => { setDeleteTarget(enr); };
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setLoading(true);
        try { await cleanupEnrollmentFinancials(deleteTarget); await deleteEnrollment(deleteTarget.id); await fetchData(); } catch (err) { alert("Errore eliminazione."); } finally { setLoading(false); setDeleteTarget(null); }
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
        setPaymentModalState({ isOpen: true, enrollment: enr, date: new Date().toISOString().split('T')[0], method: PaymentMethod.BankTransfer, createInvoice: true, isDeposit: false, isBalance: true, depositAmount: prefillAmount || status.remaining, ghostInvoiceId: ghostId, totalPaid: status.totalPaid });
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

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 flex-shrink-0">
                <div><h1 className="text-3xl font-bold text-gray-800">Archivio Iscrizioni</h1><p className="mt-1 text-gray-500">Copertura temporale e pareggio contabile.</p></div>
                <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <div className="relative w-40"><div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div><input type="text" className="w-full pl-8 pr-2 py-1.5 text-sm border-none bg-transparent focus:ring-0 placeholder:text-gray-400" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                    <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="text-sm font-bold text-indigo-700 bg-indigo-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-indigo-200">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="text-sm text-gray-600 bg-gray-50 border-none rounded-lg py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-gray-200 max-w-[150px]"><option value="">Tutte le Sedi</option>{availableLocations.map(l => <option key={l} value={l}>{l}</option>)}</select>
                    <div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Lista"><ChecklistIcon /></button><button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Calendario Copertura"><CalendarIcon /></button></div>
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
                                            <div key={enr.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-800 rounded-lg p-2 min-w-[100px] border border-indigo-100">
                                                    <span className="text-[10px] font-bold uppercase">Dal</span><span className="text-sm font-mono font-bold">{new Date(enr.startDate).toLocaleDateString()}</span>
                                                    <div className="w-full h-px bg-indigo-200 my-1"></div>
                                                    <span className="text-[10px] font-bold uppercase">Al</span><span className="text-sm font-mono font-bold">{new Date(enr.endDate).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-gray-800 text-sm">{enr.subscriptionName}</h4>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${enr.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : enr.status === 'Completed' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{enr.status === 'Active' ? 'Attivo' : enr.status === 'Completed' ? 'Completato' : enr.status === 'Expired' ? 'Scaduto' : 'In Attesa'}</span>
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
                        <div className="md-input-group mb-4"><select value={paymentModalState.method} onChange={(e) => setPaymentModalState(prev => ({ ...prev, method: e.target.value as PaymentMethod }))} className="md-input">{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}</select><label className="md-input-label !top-0">Metodo</label></div>
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
