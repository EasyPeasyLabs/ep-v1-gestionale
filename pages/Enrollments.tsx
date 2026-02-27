
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput, Supplier, Invoice, Client, InstitutionalClient, Transaction, Quote } from '../types';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment, addRecoveryLessons, bulkUpdateLocation, activateEnrollmentWithLocation, getEnrollmentsForClient, resyncInstitutionalEnrollment } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, deleteAutoRentTransactions, getInvoices, updateQuote, getOrphanedFinancialsForClient, linkFinancialsToEnrollment, createGhostInvoiceForEnrollment, getTransactions, getQuotes } from '../services/financeService';
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
        return invSum + trnSum;
    }, [orphans, selectedInvoiceIds, selectedTransactionIds]);

    const alreadyLinkedGhostsTotal = linkedGhosts.reduce((sum, g) => sum + Number(g.totalAmount), 0);
    
    // FIX: Projected coverage is Real Money + Adjustment. Ghosts are just promises.
    const projectedCoverage = Number(totalPaid) + selectedOrphansTotal + Number(adjustmentAmount);
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
                    {/* NEW: Show Pending Ghosts Prominently */}
                    {linkedGhosts.length > 0 && (
                        <div className="md-col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <h4 className="font-black text-amber-900 text-sm uppercase flex items-center gap-2">📄 Pro-forma Rilevata</h4>
                                <p className="text-xs text-amber-700 mt-1">Esiste un documento di saldo di <strong>{linkedGhosts[0].totalAmount.toFixed(2)}€</strong> in attesa.</p>
                            </div>
                            <button onClick={() => onOpenPayment()} className="md-btn md-btn-sm bg-amber-500 text-white font-black shadow-md hover:bg-amber-600 uppercase tracking-wider">Incassa Ora</button>
                        </div>
                    )}

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
                                <div className="md-col-span-4">
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

interface EnrollmentsProps {
    initialParams?: {
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
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    const [bulkAssignState, setBulkAssignState] = useState<{ isOpen: boolean; locationId: string; locationName: string; locationColor: string; } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Enrollment | null>(null); // State for delete confirm

    // State per la modale di assegnazione manuale
    const [assignSearch, setAssignSearch] = useState('');
    const [assignDay, setAssignDay] = useState(1);
    const [assignStart, setAssignStart] = useState('16:00');
    const [assignEnd, setAssignEnd] = useState('18:00');

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

    // Invoices and Transactions needed for payment logic
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [clientsData, enrollmentsData, suppliersData, invoicesData, transactionsData] = await Promise.all([ 
                getClients(), 
                getAllEnrollments(), 
                getSuppliers(),
                getInvoices(),
                getTransactions() 
            ]);
            setAllClients(clientsData);
            setEnrollments(enrollmentsData);
            setSuppliers(suppliersData);
            setInvoices(invoicesData);
            setTransactions(transactionsData);
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
                    await updateEnrollment((d as any).id, d, options?.regenerateCalendar);
                } else {
                    const newId = await addEnrollment(d);
                    if (d.locationId && d.locationId !== 'unassigned') {
                        const startTime = d.appointments?.[0]?.startTime || '16:00';
                        const endTime = d.appointments?.[0]?.endTime || '18:00';
                        const dayOfWeek = new Date(d.startDate).getDay(); 
                        await activateEnrollmentWithLocation(newId, d.supplierId || 'unassigned', d.supplierName || '', d.locationId, d.locationName || 'Sede', d.locationColor || '#ccc', dayOfWeek, startTime, endTime);
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
        await performAssignment(enrollment.id, bulkAssignState.locationId, bulkAssignState.locationName, bulkAssignState.locationColor, assignDay, assignStart, assignEnd);
    };
    
    // --- RESYNC HANDLER FOR INSTITUTIONAL PROJECTS ---
    const handleResyncRequest = async (enrollment: Enrollment) => {
        if (!confirm("Questa operazione sovrascriverà l'agenda interna del progetto con le lezioni reali presenti nel Calendario. Usalo per correggere discrepanze di orario/giorno. Confermi?")) return;
        
        setLoading(true);
        try {
            const count = await resyncInstitutionalEnrollment(enrollment.id);
            if (count > 0) {
                alert(`Sincronizzazione completata con successo! Trovate e collegate ${count} lezioni.`);
            } else {
                alert("ATTENZIONE: Nessuna lezione trovata collegata a questo progetto. \n\nSuggerimento: Se hai creato le lezioni manualmente, assicurati che il nome del progetto sia presente nella descrizione/titolo della lezione per permettere l'auto-riparazione.");
            }
            await fetchData();
        } catch (e: any) {
            alert("Errore durante la sincronizzazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const availableLocations = useMemo(() => {
        const names = new Set<string>();
        suppliers.forEach(s => s.locations.forEach(l => {
            if (!l.closedAt) names.add(l.name);
        }));
        enrollments.forEach(e => { 
            if (e.locationName && e.locationName !== 'Sede Non Definita') {
                let isClosed = false;
                suppliers.forEach(s => s.locations.forEach(l => {
                    if (l.id === e.locationId && l.closedAt) isClosed = true;
                }));
                if (!isClosed) names.add(e.locationName);
            }
        });
        return Array.from(names).sort();
    }, [suppliers, enrollments]);

    const groupedEnrollments = useMemo(() => {
        const groups: Record<string, any> = {};
        suppliers.forEach(s => { 
            s.locations.forEach(l => { 
                if (!l.closedAt) {
                    const key = l.id; 
                    groups[key] = { locationId: l.id, locationName: l.name, locationColor: l.color, days: {} }; 
                }
            }); 
        });
        groups['unassigned'] = { locationId: 'unassigned', locationName: 'Non Assegnati / In Attesa', locationColor: '#e5e7eb', days: {} };
        
        const filtered = enrollments.filter(e => {
            if (searchTerm && !e.childName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterLocation && e.locationName !== filterLocation) return false;
            
            // Exclude closed locations
            let isClosed = false;
            if (e.locationId && e.locationId !== 'unassigned') {
                suppliers.forEach(s => s.locations.forEach(l => {
                    if (l.id === e.locationId && l.closedAt) isClosed = true;
                }));
            }
            if (isClosed) return false;

            // Date filtering
            if (filterYear !== 'all' && filterMonth !== 'all') {
                const year = parseInt(filterYear);
                const month = parseInt(filterMonth) - 1;
                const filterStartDate = new Date(year, month, 1);
                const filterEndDate = new Date(year, month + 1, 0, 23, 59, 59);
                
                const enrStart = new Date(e.startDate);
                const enrEnd = new Date(e.endDate);
                
                if (enrStart > filterEndDate || enrEnd < filterStartDate) return false;
            } else if (filterYear !== 'all') {
                const year = parseInt(filterYear);
                const filterStartDate = new Date(year, 0, 1);
                const filterEndDate = new Date(year, 11, 31, 23, 59, 59);
                
                const enrStart = new Date(e.startDate);
                const enrEnd = new Date(e.endDate);
                
                if (enrStart > filterEndDate || enrEnd < filterStartDate) return false;
            } else if (filterMonth !== 'all') {
                const month = parseInt(filterMonth) - 1;
                const enrStart = new Date(e.startDate);
                const enrEnd = new Date(e.endDate);
                
                let monthMatches = false;
                let curr = new Date(enrStart.getFullYear(), enrStart.getMonth(), 1);
                while (curr <= enrEnd) {
                    if (curr.getMonth() === month) {
                        monthMatches = true;
                        break;
                    }
                    curr.setMonth(curr.getMonth() + 1);
                }
                if (!monthMatches) return false;
            }

            return true;
        });

        filtered.forEach(e => {
            let groupId = e.locationId;
            if (!groupId || groupId === 'unassigned') groupId = 'unassigned';
            if (!groups[groupId]) return; // Skip if location is closed
            const date = e.appointments?.[0]?.date ? new Date(e.appointments[0].date) : null;
            const dIdx = date ? date.getDay() : 99;
            const dName = date ? daysOfWeekMap[dIdx] : 'In Attesa';
            if (!groups[groupId].days[dIdx]) { groups[groupId].days[dIdx] = { dayName: dName, items: [] }; }
            groups[groupId].days[dIdx].items.push(e);
        });
        
        let result = Object.values(groups);
        if (filterLocation) { result = result.filter((g: any) => g.locationName === filterLocation); }
        return result.sort((a: any, b: any) => { if (a.locationId === 'unassigned') return -1; if (b.locationId === 'unassigned') return 1; return a.locationName.localeCompare(b.locationName); });
    }, [enrollments, suppliers, searchTerm, filterLocation, filterYear, filterMonth]);

    const unassignedEnrollments = useMemo(() => {
        return enrollments.filter(e => (e.locationId === 'unassigned' || !e.locationId) && e.childName.toLowerCase().includes(assignSearch.toLowerCase()));
    }, [enrollments, assignSearch]);

    // --- DELETION HANDLERS ---
    const handleDeleteRequest = (enr: Enrollment) => {
        setDeleteTarget(enr);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setLoading(true);
        try { 
            await cleanupEnrollmentFinancials(deleteTarget); 
            await deleteEnrollment(deleteTarget.id); 
            
            // UPDATED: Logic to rollback quote status
            if (deleteTarget.isQuoteBased && deleteTarget.relatedQuoteId) {
                 await updateQuote(deleteTarget.relatedQuoteId, { status: DocumentStatus.Sent });
            }

            await fetchData(); 
        } catch (err) { alert("Errore eliminazione."); } finally { setLoading(false); setDeleteTarget(null); }
    };

    // --- FINANCIAL HELPERS ---
    const getPaymentStatus = (enr: Enrollment) => {
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
        
        // FIX: Ghost invoices are NOT payments. They are promises. 
        // Remaining should be Price - Real Money Paid - Adjustments.
        const remaining = Math.max(0, price - totalPaid - adjustment);
        const isFullyPaid = remaining < 0.5 && price > 0;
        
        return { totalPaid, remaining, isFullyPaid, adjustment, ghostTotal };
    };

    const handleOpenPaymentFromWizard = (enr: Enrollment, prefillAmount?: number) => {
        const status = getPaymentStatus(enr);
        let ghostId = undefined;
        const ghostInvoice = invoices.find(i => i.relatedEnrollmentId === enr.id && i.isGhost === true && i.status === DocumentStatus.Draft && !i.isDeleted);
        if (ghostInvoice) ghostId = ghostInvoice.id;
        
        setPaymentModalState({ 
            isOpen: true, 
            enrollment: enr, 
            date: new Date().toISOString().split('T')[0], 
            method: PaymentMethod.BankTransfer, 
            createInvoice: true, 
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
        const enr = paymentModalState.enrollment; const client = allClients.find(c => c.id === enr.clientId);
        const result = await processPayment(enr, client, Number(paymentModalState.depositAmount), paymentModalState.date, paymentModalState.method, paymentModalState.createInvoice, paymentModalState.isDeposit, Number(enr.price) || 0, paymentModalState.ghostInvoiceId);
        if (result.success) { alert("Pagamento registrato."); await fetchData(); window.dispatchEvent(new Event('EP_DataUpdated')); } else { alert("ERRORE: " + result.error); }
        setLoading(false); setPaymentModalState(prev => ({...prev, isOpen: false}));
    };

    return (
        <div className="pb-20">
            {/* Header and filters */}
            <div className="flex justify-between items-center mb-6">
                <div><h1 className="text-3xl font-bold">Iscrizioni</h1><p className="text-gray-500">Gestione dei recinti operativi.</p></div>
                <button onClick={() => { setEditingEnrollment(undefined); setIsModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> Nuova</button>
            </div>

            <div className="bg-white p-3 rounded-xl border mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]"><SearchIcon /><input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="md-input pl-10" /></div>
                
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="md-input w-32">
                    <option value="all">Tutti gli anni</option>
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>

                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="md-input w-32">
                    <option value="all">Tutti i mesi</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('it-IT', { month: 'long' })}</option>
                    ))}
                </select>

                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="md-input w-48">
                    <option value="">Tutte le Sedi</option>
                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {loading ? <Spinner /> : (
                <div className="space-y-8">
                    {/* Render Grouped Enrollments */}
                    {groupedEnrollments.map((loc, i) => (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, loc.locationId, loc.locationName, loc.locationColor, 1, '16:00', '18:00')}>
                            <div className="px-6 py-4 flex justify-between items-center" style={{ backgroundColor: loc.locationColor, color: getTextColorForBg(loc.locationColor) }}>
                                <h2 className="text-lg font-black uppercase tracking-widest">{loc.locationName}</h2>
                                {loc.locationId !== 'unassigned' && (
                                    <button onClick={() => setBulkAssignState({ isOpen: true, locationId: loc.locationId, locationName: loc.locationName, locationColor: loc.locationColor })} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors border border-transparent hover:border-white/30" title="Assegna manualmente allievo a questa sede"><UserPlusIcon /></button>
                                )}
                            </div>
                            <div className="p-6 space-y-6">
                                {Object.keys(loc.days).length === 0 && (
                                    <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl"><p className="text-sm font-bold text-slate-400">Nessun allievo in questo recinto.</p><p className="text-xs text-slate-300 mt-1">Trascina qui o usa il tasto + per aggiungere.</p></div>
                                )}
                                {Object.values(loc.days).map((day: any, j) => {
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
                                                            <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 p-2 rounded-lg mb-3">
                                                                <span className="text-xs font-black text-slate-600 uppercase tracking-wider ml-1">{day.dayName}</span>
                                                                <div className="h-4 w-px bg-slate-300"></div>
                                                                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded shadow-sm"><ClockIcon /> <span className="font-mono">{start} - {end}</span></div>
                                                                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{items.length}</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {items.map((enr: Enrollment) => {
                                                                    const isInst = enr.clientType === ClientType.Institutional || enr.isQuoteBased;
                                                                    const progress = enr.lessonsTotal > 0 ? ((enr.lessonsTotal - enr.lessonsRemaining) / enr.lessonsTotal) * 100 : 0;
                                                                    let childAge = '';
                                                                    if (!isInst) {
                                                                        const client = allClients.find(c => c.id === enr.clientId);
                                                                        if (client && client.clientType === ClientType.Parent) {
                                                                            const child = (client as ParentClient).children.find(c => c.id === enr.childId);
                                                                            if (child && child.age) childAge = child.age;
                                                                        }
                                                                    }
                                                                    
                                                                    // Payment status for badge
                                                                    const paymentStatus = getPaymentStatus(enr);
                                                                    const isFullyPaid = paymentStatus.isFullyPaid;

                                                                    return (
                                                                        <div key={enr.id} draggable onDragStart={e => handleDragStart(e, enr.id)} className={`md-card p-4 border-l-[6px] transition-all hover:shadow-md cursor-grab flex flex-col gap-3 ${isInst ? 'border-indigo-900 bg-indigo-50/20' : 'border-slate-200'}`} style={!isInst ? { borderLeftColor: loc.locationColor } : {}}>
                                                                            {/* Riga 1 & 2: Nome ed Età */}
                                                                            <div>
                                                                                <h4 className="font-bold text-slate-800 text-sm leading-tight break-words">{enr.childName}</h4>
                                                                                {childAge && <p className="text-xs text-slate-500 mt-1">{childAge}</p>}
                                                                                {isInst && <span className="inline-block mt-1 text-[8px] font-black bg-indigo-900 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Progetto Ente</span>}
                                                                            </div>
                                                                            
                                                                            {/* Riga 3: Abbonamento e Progresso */}
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-500 mb-1 leading-tight break-words">{enr.subscriptionName}</p>
                                                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                                    <div className={`h-full ${isInst ? 'bg-indigo-900' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Riga 4: Bottoni Azione */}
                                                                            <div className="flex justify-end gap-1 mt-1">
                                                                                {/* Financial Wizard Trigger */}
                                                                                <button onClick={() => setFinancialWizardTarget(enr)} className={`md-icon-btn shadow-sm ${!isFullyPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title="Gestione Finanziaria / Wizard"><span className="font-bold text-xs">€</span></button>
                                                                                
                                                                                {/* RESYNC BUTTON PER ISTITUZIONALI */}
                                                                                {isInst && (
                                                                                    <button 
                                                                                        onClick={() => handleResyncRequest(enr)}
                                                                                        className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                                                                                        title="Sincronizza Calendario (Fix Date/Slots)"
                                                                                    >
                                                                                        <RefreshIcon />
                                                                                    </button>
                                                                                )}
                                                                                
                                                                                <button onClick={() => { setEditingEnrollment(enr); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 flex-shrink-0 ml-1"><PencilIcon/></button>
                                                                                <button onClick={() => handleDeleteRequest(enr)} className="text-slate-300 hover:text-red-500 flex-shrink-0 ml-1"><TrashIcon/></button>
                                                                            </div>
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
            
            {bulkAssignState && (
                <Modal onClose={() => setBulkAssignState(null)} size="lg">
                    {/* Bulk Assign Logic UI */}
                    <div className="flex flex-col h-[80vh]">
                        <div className="p-6 border-b flex-shrink-0" style={{ backgroundColor: bulkAssignState.locationColor, color: getTextColorForBg(bulkAssignState.locationColor) }}>
                            <h3 className="text-xl font-bold">Assegna a: {bulkAssignState.locationName}</h3>
                            <p className="text-xs opacity-80">Seleziona un allievo dalla lista "Non Assegnati" per inserirlo in questo recinto.</p>
                        </div>
                        <div className="p-4 bg-gray-50 border-b flex gap-4 items-end flex-shrink-0">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giorno</label><select value={assignDay} onChange={e => setAssignDay(Number(e.target.value))} className="md-input text-xs py-1">{daysOfWeekMap.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inizio</label><input type="time" value={assignStart} onChange={e => setAssignStart(e.target.value)} className="md-input text-xs py-1" /></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fine</label><input type="time" value={assignEnd} onChange={e => setAssignEnd(e.target.value)} className="md-input text-xs py-1" /></div>
                        </div>
                        <div className="p-4 border-b flex-shrink-0"><div className="relative"><SearchIcon /><input type="text" placeholder="Cerca allievo non assegnato..." className="md-input pl-10" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} /></div></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {unassignedEnrollments.length === 0 ? (<p className="text-center text-gray-400 italic py-10">Nessun allievo non assegnato trovato.</p>) : (
                                unassignedEnrollments.map(enr => (
                                    <div key={enr.id} className="flex justify-between items-center p-3 bg-white border rounded-lg hover:shadow-sm">
                                        <div><p className="font-bold text-gray-800">{enr.childName}</p><p className="text-xs text-gray-500">{enr.subscriptionName}</p></div>
                                        <button onClick={() => handleManualAssign(enr)} className="md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700">Assegna</button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end flex-shrink-0"><button onClick={() => setBulkAssignState(null)} className="md-btn md-btn-flat">Chiudi</button></div>
                    </div>
                </Modal>
            )}

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

            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        
                        {/* NEW: Alert for Ghost Linking */}
                        {paymentModalState.ghostInvoiceId && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
                                <span className="text-xl">🔗</span>
                                <div>
                                    <h4 className="text-xs font-black uppercase text-amber-800">Collegamento Automatico</h4>
                                    <p className="text-xs text-amber-700 leading-tight mt-1">Questo pagamento salderà la <strong>Pro-forma esistente</strong>. Il documento diventerà una Fattura Reale definitiva.</p>
                                </div>
                            </div>
                        )}

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

            <ConfirmModal 
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
                title="Elimina Iscrizione"
                message="Sei sicuro? Se è un progetto istituzionale, il preventivo tornerà in stato 'Inviato'."
                isDangerous={true}
            />
        </div>
    );
};

export default Enrollments;
