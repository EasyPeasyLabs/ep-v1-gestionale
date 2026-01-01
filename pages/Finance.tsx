
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, syncRentExpenses, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo } from '../services/settingsService';
import { getClients } from '../services/parentService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import { exportTransactionsToExcel, exportInvoicesToExcel } from '../utils/financeExport';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import RefreshIcon from '../components/icons/RestoreIcon';
import TransactionForm from '../components/finance/TransactionForm';
import InvoiceEditForm from '../components/finance/InvoiceEditForm';
import QuoteForm from '../components/finance/QuoteForm';
import FinanceOverview from '../components/finance/FinanceOverview';
import FinanceCFO from '../components/finance/FinanceCFO';
import FinanceControlling from '../components/finance/FinanceControlling';
import FinanceListView from '../components/finance/FinanceListView';
import FiscalYearManager from '../components/finance/FiscalYearManager'; // NEW IMPORT
import LocationDetailModal from '../components/finance/LocationDetailModal';
import { getAllEnrollments } from '../services/enrollmentService';
import { Enrollment, PaymentMethod, TransactionStatus } from '../types';

// ... (COSTANTI FISCALI e Interfacce rimangono uguali) ...
const INPS_RATE = 0.2623;
const TAX_RATE_STARTUP = 0.05;
const COEFF_REDDITIVITA = 0.78;
const LIMIT_FORFETTARIO = 85000;

interface FinanceProps {
    initialParams?: {
        tab?: 'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure';
        searchTerm?: string;
    };
    onNavigate?: (page: Page, params?: any) => void;
}

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure'>('overview');
    // ... (Stati esistenti: transactions, invoices, etc.) ...
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
    const [lessonPrice, setLessonPrice] = useState(25);

    const [isSealModalOpen, setIsSealModalOpen] = useState(false);
    const [invoiceToSeal, setInvoiceToSeal] = useState<Invoice | null>(null);
    const [sdiId, setSdiId] = useState('');
    const [filters, setFilters] = useState({ search: '' });

    const [selectedLocationROI, setSelectedLocationROI] = useState<{name: string, color: string, revenue: number, costs: number} | null>(null);

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);

    // ... (fetchData e useEffect uguali) ...
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [t, i, q, e, s, c, info] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getCompanyInfo()
            ]);
            setTransactions(t); setInvoices(i); setQuotes(q); setEnrollments(e); setSuppliers(s); setClients(c); setCompanyInfo(info);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchData();
        if (initialParams?.tab) setActiveTab(initialParams.tab);
        if (initialParams?.searchTerm) setFilters(f => ({ ...f, search: initialParams.searchTerm || '' }));

        const handleRealTimeUpdate = () => {
            fetchData(); 
        };
        window.addEventListener('EP_DataUpdated', handleRealTimeUpdate);
        return () => window.removeEventListener('EP_DataUpdated', handleRealTimeUpdate);

    }, [fetchData, initialParams]);

    // ... (handleSyncRents, stats, reverseEngineering, simulatorData, roiSedi, handlePrint, handleWhatsApp, handleSeal ... TUTTI UGUALI) ...
    const handleSyncRents = async () => {
        if(confirm("Vuoi ricalcolare i costi di affitto per tutte le sedi in base all'occupazione reale del calendario? Questa operazione potrebbe richiedere alcuni secondi.")) {
            setLoading(true);
            try {
                const resultMsg = await syncRentExpenses();
                await fetchData();
                alert(resultMsg);
            } catch (e) {
                console.error(e);
                alert("Errore durante la sincronizzazione.");
            } finally {
                setLoading(false);
            }
        }
    };

    // --- ENGINE ANALITICO ---
    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted);
        const revenue = activeT.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capital).reduce((acc, t) => acc + t.amount, 0);
        const expenses = activeT.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        // Fiscale
        const taxable = revenue * COEFF_REDDITIVITA;
        const inps = taxable * INPS_RATE;
        const tax = taxable * TAX_RATE_STARTUP;
        
        // Calcolo Bolli: 2€ per ogni fattura > 77€
        let stampDutyTotal = 0;
        const stampDutyQuarters = { q1: 0, q2: 0, q3: 0, q4: 0 };
        
        invoices.forEach(inv => {
            if (!inv.isDeleted && !inv.isGhost && inv.totalAmount > 77.47) {
                stampDutyTotal += 2;
                const d = new Date(inv.issueDate);
                const m = d.getMonth(); 
                if (m < 3) stampDutyQuarters.q1 += 2; // Gen-Mar -> Scade Maggio
                else if (m < 6) stampDutyQuarters.q2 += 2; // Apr-Giu -> Scade Settembre
                else if (m < 9) stampDutyQuarters.q3 += 2; // Lug-Set -> Scade Novembre
                else stampDutyQuarters.q4 += 2; // Ott-Dic -> Scade Febbraio
            }
        });

        // Totali Combinati
        const totalInpsTax = inps + tax;
        const totalAll = totalInpsTax + stampDutyTotal;
        
        const totalLoadStartup = (totalInpsTax * 2) + stampDutyTotal;
        const savingsSuggestion = totalLoadStartup;

        // Proiezioni Mensili
        const monthlyData = Array(12).fill(0).map((_, i) => {
            const monthRev = activeT.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === i && t.type === TransactionType.Income && t.category !== TransactionCategory.Capital;
            }).reduce((acc, t) => acc + t.amount, 0);
            const mTaxable = monthRev * COEFF_REDDITIVITA;
            return { month: i, revenue: monthRev, inps: mTaxable * INPS_RATE, tax: mTaxable * TAX_RATE_STARTUP };
        });

        return { 
            revenue, expenses, profit, margin, 
            taxable, inps, tax, stampDutyTotal, stampDutyQuarters,
            totalInpsTax, totalAll, 
            savingsSuggestion, monthlyData, progress: (revenue / LIMIT_FORFETTARIO) * 100 
        };
    }, [transactions, invoices]);

    // ... (reverseEngineering, simulatorData, roiSedi, handlers... TUTTI UGUALI) ...
    const reverseEngineering = useMemo(() => {
        const compositeTaxRate = COEFF_REDDITIVITA * (INPS_RATE + TAX_RATE_STARTUP);
        const netRatio = 1 - compositeTaxRate;
        const annualNetTarget = targetMonthlyNet * 12;
        const grossNeeded = annualNetTarget / netRatio;
        const currentGross = stats.revenue;
        const gap = Math.max(0, grossNeeded - currentGross);
        const revenuePerLesson = lessonPrice; 
        const extraLessonsNeeded = revenuePerLesson > 0 ? Math.ceil(gap / revenuePerLesson) : 0;
        const studentsNeeded = Math.ceil(extraLessonsNeeded / 30);

        return { annualNetTarget, grossNeeded, gap, extraLessonsNeeded, studentsNeeded };
    }, [targetMonthlyNet, lessonPrice, stats.revenue]);

    const simulatorData = useMemo(() => {
        const tax2025 = stats.totalInpsTax; // Tassa calcolata sull'anno corrente
        
        const tranche1 = tax2025 * 1.5; 
        const tranche2 = tax2025 * 0.5;
        const monthlyInstallment = tranche1 / 6; // Rateizzabile Giu-Nov

        const stampDeadlines = [
            { label: '31 Mag (I Trim)', amount: stats.stampDutyQuarters.q1, month: 'MAG' }, 
            { label: '30 Set (II Trim)', amount: stats.stampDutyQuarters.q2, month: 'SET' },
            { label: '30 Nov (III Trim)', amount: stats.stampDutyQuarters.q3, month: 'NOV' },
            { label: '28 Feb (IV Trim)', amount: stats.stampDutyQuarters.q4, month: 'FEB' },
        ];

        const months = ['GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'];
        const savingsPlan = months.map(m => {
            let amount = monthlyInstallment;
            const stamp = stampDeadlines.find(s => s.month === m);
            if (stamp) amount += stamp.amount;
            if (m === 'NOV') amount += tranche2;
            return { month: m, amount };
        });

        const saldoFinaleTarget = tranche2; 

        return { tranche1, tranche2, monthlyInstallment, stampDeadlines, savingsPlan, saldoFinaleTarget };
    }, [stats]);

    const roiSedi = useMemo(() => {
        const data: Record<string, { name: string, color: string, revenue: number, costs: number }> = {};
        suppliers.flatMap(s => s.locations).forEach(l => {
            data[l.id] = { name: l.name, color: l.color, revenue: 0, costs: 0 };
        });

        transactions.filter(t => !t.isDeleted && t.allocationId).forEach(t => {
            if (data[t.allocationId!]) {
                if (t.type === TransactionType.Income) data[t.allocationId!].revenue += t.amount;
                else data[t.allocationId!].costs += t.amount;
            }
        });
        return Object.values(data).sort((a,b) => b.revenue - a.revenue);
    }, [suppliers, transactions]);

    const handlePrint = async (doc: Invoice | Quote) => {
        const client = clients.find(c => c.id === doc.clientId);
        await generateDocumentPDF(doc, 'invoiceNumber' in doc ? 'Fattura' : 'Preventivo', companyInfo, client);
    };

    const handleWhatsApp = (item: Invoice | Transaction) => {
        let phone = '';
        let msg = '';
        if ('clientId' in item) {
            const c = clients.find(cl => cl.id === item.clientId);
            phone = c?.phone || '';
            msg = `Gentile cliente, le inviamo riferimento per il pagamento di ${(item as Invoice).totalAmount}€.`;
        }
        if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        else alert("Numero non trovato.");
    };

    const handleSeal = async () => {
        if (!invoiceToSeal || !sdiId) return;
        await updateInvoice(invoiceToSeal.id, { status: DocumentStatus.SealedSDI, sdiId });
        setIsSealModalOpen(false);
        await fetchData();
    };

    const handleSaveTransaction = async (t: TransactionInput | Transaction) => {
        setLoading(true);
        try {
            if ('id' in t) await updateTransaction(t.id, t);
            else await addTransaction(t);
            setIsTransactionModalOpen(false);
            setEditingTransaction(null);
            await fetchData();
        } catch(e: any) {
            console.error(e);
            alert("Errore salvataggio transazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditItem = (item: any) => {
        if ('invoiceNumber' in item) {
            setEditingInvoice(item as Invoice);
            setIsInvoiceModalOpen(true);
        } else if ('quoteNumber' in item) {
            setEditingQuote(item as Quote);
            setIsQuoteModalOpen(true);
        } else {
            setEditingTransaction(item);
            setIsTransactionModalOpen(true);
        }
    };

    const handleSaveInvoice = async (data: InvoiceInput) => {
        if (!editingInvoice) return;
        setLoading(true);
        try {
            // AUTOMAZIONE STATO: Se c'è SDI ID, diventa automaticamente SealedSDI
            if (data.sdiId && data.sdiId.trim().length > 0) {
                data.status = DocumentStatus.SealedSDI;
            }

            let invoiceId = editingInvoice.id;
            let finalData = data;

            if (invoiceId) {
                await updateInvoice(invoiceId, data);
            } else {
                // Creazione nuova fattura
                const res = await addInvoice(data);
                invoiceId = res.id;
            }

            // AUTOMAZIONE TRANSAZIONE (Se Nuova Fattura e NON Bozza)
            // Se la fattura è appena creata (non era in edit) o è diventata definitiva, e non è bozza/fantasma
            // Generiamo la transazione di entrata corrispondente.
            // Per evitare duplicati, lo facciamo solo se non stiamo modificando una fattura esistente (che potrebbe già averla)
            // OPPURE se è una nuova creazione con status Pagato/Sent/Sealed/PendingSDI.
            
            if (!editingInvoice.id && data.status !== DocumentStatus.Draft && !data.isGhost && data.totalAmount > 0) {
                // Creazione automatica transazione
                const newTransaction: TransactionInput = {
                    date: data.issueDate,
                    description: `Incasso Fattura ${data.invoiceNumber || 'N/D'} - ${data.clientName}`,
                    amount: data.totalAmount,
                    type: TransactionType.Income,
                    category: TransactionCategory.Sales,
                    paymentMethod: data.paymentMethod,
                    status: TransactionStatus.Completed,
                    relatedDocumentId: invoiceId,
                    clientName: data.clientName,
                    isDeleted: false,
                    allocationType: 'general' // Default
                };
                await addTransaction(newTransaction);
                // Alert o feedback silenzioso? Meglio silenzioso o toast, ma qui usiamo alert standard se errore.
            }
            
            setIsInvoiceModalOpen(false);
            setEditingInvoice(null);
            await fetchData();
        } catch(e: any) {
            console.error(e);
            alert("Errore salvataggio fattura: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuote = async (data: QuoteInput | Quote) => {
        setLoading(true);
        try {
            if ('id' in data) await updateQuote(data.id, data);
            else await addQuote(data);
            setIsQuoteModalOpen(false);
            setEditingQuote(null);
            await fetchData();
        } catch(e) {
            console.error(e);
            alert("Errore salvataggio preventivo.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setTransactionToDelete(id);
    };

    const confirmDelete = async () => {
        if (transactionToDelete) {
            setLoading(true);
            try {
                if (activeTab === 'transactions') await deleteTransaction(transactionToDelete);
                else if (activeTab === 'invoices' || activeTab === 'archive') await deleteInvoice(transactionToDelete);
                else if (activeTab === 'quotes') await deleteQuote(transactionToDelete);
                
                await fetchData();
            } catch(e: any) { 
                console.error(e); 
                alert("Errore eliminazione: " + e.message);
            }
            finally { setLoading(false); setTransactionToDelete(null); }
        }
    };

    const handleConvertQuote = (quote: Quote) => {
        setQuoteToConvert(quote);
    };

    const processConversion = async () => {
        if (!quoteToConvert) return;
        setLoading(true);
        try {
            const invoiceId = await convertQuoteToInvoice(quoteToConvert.id);
            await fetchData();
            const updatedInvoices = await getInvoices();
            const inv = updatedInvoices.find(i => i.id === invoiceId);
            if (inv) {
                setEditingInvoice(inv);
                setIsInvoiceModalOpen(true);
            }
        } catch (e: any) {
            console.error(e);
            alert("Errore durante la conversione: " + (e.message || e));
        } finally {
            setLoading(false);
            setQuoteToConvert(null);
        }
    };

    const handleExportTransactions = () => {
        exportTransactionsToExcel(transactions, invoices);
    };

    const handleExportInvoices = () => {
        exportInvoicesToExcel(invoices);
    };

    // --- RENDER ---
    return (
        <div className="animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-wrap justify-between items-center mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Finanza Enterprise</h1>
                    <p className="text-slate-500 font-medium">Controllo di gestione, fiscalità, logistica e flussi.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleSyncRents} className="md-btn md-btn-flat bg-white border border-indigo-200 text-indigo-700 shadow-sm font-bold flex items-center gap-1 hover:bg-indigo-50"><RefreshIcon /> Sync Noli</button>
                    <button onClick={() => fetchData()} className="md-btn md-btn-flat bg-white border shadow-sm"><RefreshIcon /> Sync</button>
                    <button 
                        onClick={() => {
                            if (activeTab === 'quotes') {
                                setEditingQuote(null);
                                setIsQuoteModalOpen(true);
                            } else if (activeTab === 'invoices') {
                                // Creazione Nuova Fattura (Template Vuoto)
                                const newInv: any = {
                                    id: '', // Empty ID signals creation
                                    invoiceNumber: '', // Will be auto-generated or manual
                                    issueDate: new Date().toISOString(),
                                    dueDate: new Date().toISOString(),
                                    clientName: '',
                                    clientId: '',
                                    items: [],
                                    totalAmount: 0,
                                    status: DocumentStatus.Draft,
                                    paymentMethod: PaymentMethod.BankTransfer,
                                    hasStampDuty: false,
                                    isGhost: false,
                                    isDeleted: false
                                };
                                setEditingInvoice(newInv);
                                setIsInvoiceModalOpen(true);
                            } else {
                                setEditingTransaction(null);
                                setIsTransactionModalOpen(true);
                            }
                        }} 
                        className="md-btn md-btn-raised md-btn-green"
                    >
                        <PlusIcon /> 
                        {activeTab === 'quotes' ? 'Nuovo Preventivo' : (activeTab === 'invoices' ? 'Nuova Fattura' : 'Nuova Voce')}
                    </button>
                </div>
            </div>

            {/* TABS (UPDATED) */}
            <nav className="flex space-x-6 border-b border-gray-200 mb-8 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Panoramica' },
                    { id: 'cfo', label: 'CFO (Strategia)' },
                    { id: 'controlling', label: 'Controllo di Gestione' },
                    { id: 'transactions', label: 'Transazioni' }, 
                    { id: 'invoices', label: 'Fatture' },
                    { id: 'archive', label: 'Archivio' },
                    { id: 'quotes', label: 'Preventivi' },
                    { id: 'fiscal_closure', label: '🔒 Chiusura Fiscale' } // NEW TAB
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id as any)} 
                        className={`pb-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="space-y-8">
                    {activeTab === 'overview' && <FinanceOverview stats={stats} transactions={transactions} />}
                    
                    {activeTab === 'cfo' && (
                        <FinanceCFO 
                            stats={stats} 
                            simulatorData={simulatorData} 
                            reverseEngineering={reverseEngineering}
                            targetMonthlyNet={targetMonthlyNet}
                            lessonPrice={lessonPrice}
                            setTargetMonthlyNet={setTargetMonthlyNet}
                            setLessonPrice={setLessonPrice}
                        />
                    )}

                    {activeTab === 'controlling' && (
                        <FinanceControlling 
                            roiSedi={roiSedi} 
                            onSelectLocation={setSelectedLocationROI} 
                        />
                    )}

                    {activeTab === 'fiscal_closure' && (
                        <FiscalYearManager 
                            transactions={transactions}
                            invoices={invoices}
                        />
                    )}

                    {['transactions', 'invoices', 'archive', 'quotes'].includes(activeTab) && (
                        <FinanceListView 
                            activeTab={activeTab as any}
                            transactions={transactions}
                            invoices={invoices}
                            quotes={quotes}
                            suppliers={suppliers}
                            filters={filters}
                            setFilters={setFilters}
                            onExportTransactions={handleExportTransactions}
                            onExportInvoices={handleExportInvoices}
                            onEdit={handleEditItem}
                            onDelete={handleDelete}
                            onPrint={handlePrint}
                            onSeal={(inv) => { setInvoiceToSeal(inv); setIsSealModalOpen(true); }}
                            onWhatsApp={handleWhatsApp}
                            onConvert={activeTab === 'quotes' ? handleConvertQuote : undefined}
                        />
                    )}
                </div>
            )}

            {selectedLocationROI && (
                <LocationDetailModal 
                    data={selectedLocationROI} 
                    onClose={() => setSelectedLocationROI(null)} 
                />
            )}

            {isSealModalOpen && (
                <Modal onClose={() => setIsSealModalOpen(false)}>
                    <div className="p-8">
                        <h3 className="text-xl font-black mb-4">SIGILLO FISCALE SDI</h3>
                        <p className="text-sm text-slate-500 mb-6">Inserisci l'ID di ricezione del Sistema di Interscambio per finalizzare la fattura <strong>{invoiceToSeal?.invoiceNumber}</strong>.</p>
                        <div className="md-input-group mb-8">
                            <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} required className="md-input" placeholder=" " />
                            <label className="md-input-label">ID Sistema Interscambio (SDI)</label>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsSealModalOpen(false)} className="md-btn md-btn-flat">Esci</button>
                            <button onClick={handleSeal} disabled={!sdiId} className="md-btn md-btn-raised md-btn-primary">Finalizza Documento</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isTransactionModalOpen && (
                <Modal onClose={() => setIsTransactionModalOpen(false)} size="lg">
                    <TransactionForm 
                        transaction={editingTransaction}
                        suppliers={suppliers}
                        onSave={handleSaveTransaction}
                        onCancel={() => setIsTransactionModalOpen(false)}
                    />
                </Modal>
            )}

            {isInvoiceModalOpen && editingInvoice && (
                <Modal onClose={() => setIsInvoiceModalOpen(false)} size="2xl">
                    <InvoiceEditForm 
                        invoice={editingInvoice}
                        clients={clients} // Added clients prop
                        companyInfo={companyInfo} // NEW: Pass companyInfo prop
                        onSave={handleSaveInvoice}
                        onCancel={() => setIsInvoiceModalOpen(false)}
                    />
                </Modal>
            )}

            {isQuoteModalOpen && (
                <Modal onClose={() => setIsQuoteModalOpen(false)} size="lg">
                    <QuoteForm 
                        quote={editingQuote}
                        clients={clients}
                        onSave={handleSaveQuote}
                        onCancel={() => setIsQuoteModalOpen(false)}
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!transactionToDelete}
                onClose={() => setTransactionToDelete(null)}
                onConfirm={confirmDelete}
                title="Elimina Voce"
                message="Sei sicuro di voler eliminare questo elemento?"
                isDangerous={true}
            />

            <ConfirmModal 
                isOpen={!!quoteToConvert}
                onClose={() => setQuoteToConvert(null)}
                onConfirm={processConversion}
                title="Converti in Fattura"
                message={`Sei sicuro di voler convertire il preventivo ${quoteToConvert?.quoteNumber} in una nuova fattura?`}
                confirmText="Sì, Converti"
            />
        </div>
    );
};

export default Finance;
