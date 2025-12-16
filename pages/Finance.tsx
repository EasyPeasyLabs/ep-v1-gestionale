
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import { 
    Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, 
    TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, 
    DocumentStatus, CompanyInfo, Client, Supplier, Enrollment, EnrollmentStatus 
} from '../types';
import { 
    getTransactions, addTransaction, updateTransaction, deleteTransaction, 
    permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, 
    deleteInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, 
    deleteQuote, permanentDeleteQuote, calculateRentTransactions, batchAddTransactions,
    resetFinancialData, checkAndSetOverdueInvoices
} from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import { getCompanyInfo, updateCompanyInfo } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import DocumentCheckIcon from '../components/icons/DocumentCheckIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';

const INPS_RATE = 0.2623;
const TAX_RATE_STARTUP = 0.05;
const COEFF_REDDITIVITA = 0.78;
const LIMIT_FORFETTARIO = 85000;

interface FinanceProps {
    initialParams?: any;
    onNavigate?: (page: string, params: any) => void;
}

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'analytics' | 'transactions' | 'invoices' | 'archive' | 'quotes'>('overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const [simParams, setSimParams] = useState({
        targetNetMonthly: 3000,
        avgLessonPrice: 25,
        accountantCost: 1200,
        fuelCost: 1.85
    });

    const [listFilters, setListFilters] = useState({
        search: '',
        dateFrom: '',
        dateTo: '',
        minAmount: '',
        maxAmount: '',
        invoiceStatus: '',
        transactionStatus: '',
        sortColumn: 'date',
        sortDirection: 'desc'
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modals & UI States
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isSealModalOpen, setIsSealModalOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [isResetTransModalOpen, setIsResetTransModalOpen] = useState<{isOpen: boolean, type: TransactionType | null}>({isOpen: false, type: null});
    const [isRentHelpOpen, setIsRentHelpOpen] = useState(false);
    
    const [editingItem, setEditingItem] = useState<any>(null);
    const [docType, setDocType] = useState<'invoice' | 'quote'>('invoice');
    const [invoiceToSeal, setInvoiceToSeal] = useState<Invoice | null>(null);
    const [archiveSelection, setArchiveSelection] = useState<string[]>([]);
    
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDangerous: boolean;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDangerous: false });

    // Chart Refs
    const overviewChartRef = useRef<HTMLCanvasElement | null>(null);
    const controllingChartRef = useRef<HTMLCanvasElement | null>(null);
    const overviewChartInstance = useRef<Chart | null>(null);
    const controllingChartInstance = useRef<Chart | null>(null);
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
    const chartsRef = useRef<Record<string, Chart | null>>({});

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [tData, iData, qData, eData, sData, cData, infoData] = await Promise.all([
                getTransactions(),
                getInvoices(),
                getQuotes(),
                getAllEnrollments(),
                getSuppliers(),
                getClients(),
                getCompanyInfo()
            ]);
            setTransactions(tData);
            setInvoices(iData);
            setQuotes(qData);
            setEnrollments(eData);
            setSuppliers(sData);
            setClients(cData);
            setCompanyInfo(infoData);
        } catch (error) {
            console.error("Error fetching finance data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        if (initialParams?.tab) setActiveTab(initialParams.tab);
        if (initialParams?.searchTerm) setListFilters(prev => ({...prev, search: initialParams.searchTerm}));
    }, [fetchData, initialParams]);

    // --- ENGINE LOGIC: THE CORE ---
    const engineData = useMemo(() => {
        // 1. Core Financials
        const activeTransactions = transactions.filter(t => !t.isDeleted);
        const revenue = activeTransactions.filter(t => t.type === TransactionType.Income && !t.excludeFromStats).reduce((acc, t) => acc + t.amount, 0);
        const expenses = activeTransactions.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const netProfit = revenue - expenses;
        const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        // 2. Fiscal Engine (Forfettario 2025)
        const taxableIncome = revenue * COEFF_REDDITIVITA;
        
        // Tasse Anno Corrente
        const inpsCurrentYear = taxableIncome * INPS_RATE;
        const taxCurrentYear = taxableIncome * TAX_RATE_STARTUP;
        const totalTaxCurrentYear = inpsCurrentYear + taxCurrentYear;

        // Proiezione Acconti per Anno Successivo
        const saldo2025 = totalTaxCurrentYear;
        const acconto1_2026 = totalTaxCurrentYear * 0.50; // 50%
        const acconto2_2026 = totalTaxCurrentYear * 0.50; // 50%

        // Totale Giugno (Saldo + I Acconto) - Ripartibile in 6 rate
        const totalDueJune = saldo2025 + acconto1_2026;
        const installmentAmount = totalDueJune / 6;

        // Bolli
        const invoicesWithBollo = invoices.filter(i => !i.isDeleted && i.hasStampDuty);
        const totalBolloCost = invoicesWithBollo.length * 2.00;

        // Total Fiscal Burden (Snapshot)
        const totalFiscalBurden = totalTaxCurrentYear + totalBolloCost;

        // 3. Logistics
        let totalKm = 0;
        enrollments.forEach(enr => {
            if (enr.status === EnrollmentStatus.Active) {
                const loc = suppliers.find(s => s.locations.some(l => l.id === enr.locationId))?.locations.find(l => l.id === enr.locationId);
                const dist = loc?.distance || 0;
                totalKm += (enr.lessonsTotal * dist * 2);
            }
        });

        const fuelCons = companyInfo?.carFuelConsumption || 16.5;
        const estimatedFuelCost = (totalKm / fuelCons) * simParams.fuelCost;
        const insuranceCost = 600; 
        const carTax = 180; 
        const wearCost = totalKm * 0.045; 
        const totalLogisticsCost = estimatedFuelCost + wearCost + insuranceCost + carTax;

        // 4. AI CFO - Reverse Engineering (Dettagliato)
        const totalTaxRate = (COEFF_REDDITIVITA * (INPS_RATE + TAX_RATE_STARTUP)); // 24.35%
        // Net Profit = Revenue - Expenses - Taxes
        // Taxes = Revenue * TotalTaxRate
        // Net = Revenue - Exp - (Rev * Rate) => Net + Exp = Rev * (1 - Rate)
        // Rev = (Net + Exp) / (1 - Rate)
        
        const taxFactor = 1 - totalTaxRate; // ~0.7565
        const annualFixedCosts = simParams.accountantCost + totalLogisticsCost + expenses; // Fixed + OpEx
        const targetAnnualNet = simParams.targetNetMonthly * 12; // Su 12 mesi per stipendio
        
        const requiredAnnualRevenue = (targetAnnualNet + annualFixedCosts) / taxFactor;
        const requiredMonthlyRevenue = requiredAnnualRevenue / 12;
        
        const lessonsNeeded = requiredMonthlyRevenue / simParams.avgLessonPrice;
        const studentsNeeded = lessonsNeeded / 4; // Avg 4 lessons/month per student

        // Gap Analysis
        const revenueGap = requiredAnnualRevenue - revenue;
        const actionUrgency = revenueGap > 0 ? (revenueGap / requiredAnnualRevenue) > 0.3 ? 'High' : 'Medium' : 'Low';

        return {
            revenue, expenses, netProfit, margin,
            fiscal: {
                limitProgress: (revenue / LIMIT_FORFETTARIO) * 100,
                remainingCeiling: LIMIT_FORFETTARIO - revenue,
                taxableIncome,
                inpsTotal: inpsCurrentYear,
                taxTotal: taxCurrentYear,
                totalFiscalBurden,
                totalBolloCost,
                invoicesCount: invoicesWithBollo.length,
                // Breakdown Rate
                installmentsProjection: {
                    saldo2025,
                    acconto1_2026,
                    acconto2_2026,
                    totalDueJune,
                    installmentAmount,
                    months: ['Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov']
                }
            },
            logistics: {
                totalKm, estimatedFuelCost, wearCost, totalLogisticsCost,
                impactPerKm: totalKm > 0 ? totalLogisticsCost / totalKm : 0
            },
            ai: {
                requiredAnnualRevenue,
                requiredMonthlyRevenue,
                lessonsNeeded,
                studentsNeeded,
                revenueGap,
                actionUrgency
            }
        };
    }, [transactions, invoices, enrollments, suppliers, companyInfo, simParams]);

    // --- PROFITABILITY BY LOCATION ---
    const locationAnalysis = useMemo(() => {
        const stats: Record<string, {
            name: string, 
            revenue: number, 
            rentCost: number,
            otherAllocatedCosts: number, 
            margin: number,
            marginPercent: number
        }> = {};

        suppliers.forEach(s => {
            s.locations.forEach(l => {
                stats[l.id] = { name: l.name, revenue: 0, rentCost: 0, otherAllocatedCosts: 0, margin: 0, marginPercent: 0 };
            });
        });

        transactions.forEach(t => {
            if (!t.isDeleted && t.allocationType === 'location' && t.allocationId) {
                const locId = t.allocationId;
                if (!stats[locId]) stats[locId] = { name: t.allocationName || 'Sede Sconosciuta', revenue: 0, rentCost: 0, otherAllocatedCosts: 0, margin: 0, marginPercent: 0 };
                
                if (t.type === TransactionType.Income) {
                    stats[locId].revenue += t.amount;
                } else if (t.type === TransactionType.Expense) {
                    if (t.category === TransactionCategory.Rent) stats[locId].rentCost += t.amount;
                    else stats[locId].otherAllocatedCosts += t.amount;
                }
            }
        });

        return Object.values(stats).map(item => {
            const totalCosts = item.rentCost + item.otherAllocatedCosts;
            const margin = item.revenue - totalCosts;
            const marginPercent = item.revenue > 0 ? (margin / item.revenue) * 100 : 0;
            return { ...item, totalCosts, margin, marginPercent };
        }).sort((a,b) => b.revenue - a.revenue);
    }, [suppliers, transactions]);

    // --- CHART RENDERERS ---
    useEffect(() => {
        if (activeTab === 'analytics') {
            const createChart = (id: string, type: any, data: any, options: any) => {
                const canvas = canvasRefs.current[id];
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (chartsRef.current[id]) chartsRef.current[id]?.destroy();
                    chartsRef.current[id] = new Chart(ctx, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
                }
            };

            const monthlyRev = new Array(12).fill(0);
            const monthlyExp = new Array(12).fill(0);
            transactions.forEach(t => {
                if(!t.isDeleted) {
                    const m = new Date(t.date).getMonth();
                    if(t.type === TransactionType.Income) monthlyRev[m] += t.amount; else monthlyExp[m] += t.amount;
                }
            });

            createChart('bar', 'bar', {
                labels: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
                datasets: [
                    { label: 'Entrate', data: monthlyRev, backgroundColor: '#4ade80', borderRadius: 4 },
                    { label: 'Uscite', data: monthlyExp, backgroundColor: '#f87171', borderRadius: 4 }
                ]
            }, { plugins: { title: { display: true, text: 'Andamento Mensile' } } });

            createChart('doughnut', 'doughnut', {
                labels: ['Logistica (TCO)', 'Tasse (Stima)', 'Commercialista', 'Noli Sedi', 'Altro Operativo'],
                datasets: [{
                    data: [
                        engineData.logistics.totalLogisticsCost, 
                        engineData.fiscal.totalFiscalBurden, 
                        simParams.accountantCost, 
                        transactions.filter(t => t.category === TransactionCategory.Rent).reduce((a,b)=>a+b.amount,0), 
                        Math.max(0, engineData.expenses - engineData.logistics.totalLogisticsCost - engineData.fiscal.totalFiscalBurden) 
                    ],
                    backgroundColor: ['#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#9ca3af']
                }]
            }, { cutout: '60%' });

            let cash = 0;
            const flow = monthlyRev.map((inc, i) => { cash += (inc - monthlyExp[i]); return cash; });
            createChart('line', 'line', {
                labels: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
                datasets: [{ label: 'Saldo Progressivo', data: flow, borderColor: '#6366f1', fill: true, backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4 }]
            }, {});

            createChart('radar', 'radar', {
                labels: ['Liquidità', 'Redditività', 'Efficienza Fiscale', 'Sostenibilità Logistica', 'Crescita'],
                datasets: [{
                    label: 'Score Aziendale',
                    data: [85, engineData.margin, 70, 60, 75], // Mock logic
                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                    borderColor: '#34d399',
                    pointBackgroundColor: '#34d399'
                }]
            }, { scales: { r: { suggestedMin: 0, suggestedMax: 100 } } });
        }
    }, [activeTab, engineData, transactions]);

    // Actions
    const handleDeleteAll = async () => { setIsDeleteAllModalOpen(false); setLoading(true); try { if (activeTab === 'transactions') { for (const t of await getTransactions()) await permanentDeleteTransaction(t.id); } else if (activeTab === 'invoices') { for (const i of await getInvoices()) await permanentDeleteInvoice(i.id); } else if (activeTab === 'quotes') { for (const q of await getQuotes()) await permanentDeleteQuote(q.id); } await fetchData(); alert("Eliminazione completata."); } catch(e) { alert("Errore"); } finally { setLoading(false); } };
    const handleSaveTransaction = async (t: TransactionInput | Transaction) => { try { if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t as TransactionInput); setIsTransModalOpen(false); fetchData(); } catch (err) { alert("Errore"); } };
    const handleDeleteTransaction = (id: string) => { setConfirmState({ isOpen: true, title: "Elimina", message: "Sicuro?", isDangerous: true, onConfirm: async () => { await deleteTransaction(id); setConfirmState(p => ({...p, isOpen: false})); fetchData(); }}); };
    const handleSaveDocument = async (docData: any) => { setLoading(true); try { if (docData.id) { if (docType === 'invoice') await updateInvoice(docData.id, docData); else await updateQuote(docData.id, docData); } else { if (docType === 'invoice') await addInvoice(docData); else await addQuote(docData); } setIsDocModalOpen(false); fetchData(); } catch (err) { console.error(err); alert("Errore salvataggio"); } finally { setLoading(false); } };
    const handleDeleteDocument = (id: string) => { setConfirmState({ isOpen: true, title: "Elimina", message: "Sicuro?", isDangerous: true, onConfirm: async () => { if (docType === 'invoice') await deleteInvoice(id); else await deleteQuote(id); setConfirmState(p => ({...p, isOpen: false})); fetchData(); }}); };
    const handlePrintDocument = async (doc: Invoice | Quote) => { const companyInfo = await getCompanyInfo(); const client = clients.find(c => c.id === doc.clientId); await generateDocumentPDF(doc, docType === 'invoice' ? 'Fattura' : 'Preventivo', companyInfo, client); };
    const handleGenerateRentTransactions = async () => { const newTrans = calculateRentTransactions(enrollments, suppliers, transactions); if (newTrans.length > 0) { await batchAddTransactions(newTrans); fetchData(); alert(`Generate ${newTrans.length} transazioni.`); } else { alert("Nessun nolo da generare."); } };
    const handleSealClick = (inv: Invoice) => { setInvoiceToSeal(inv); setIsSealModalOpen(true); };
    const handleConfirmSeal = async (sdiId: string) => { if(!invoiceToSeal) return; setIsSealModalOpen(false); setLoading(true); try { await updateInvoice(invoiceToSeal.id, { status: DocumentStatus.SealedSDI, sdiId: sdiId }); await fetchData(); alert("Fattura sigillata correttamente!"); } catch(e) { console.error(e); alert("Errore"); } finally { setLoading(false); setInvoiceToSeal(null); } };
    const toggleArchiveSelection = (id: string) => { setArchiveSelection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
    const handleSendToAccountant = () => { if(archiveSelection.length === 0) return alert("Seleziona almeno una fattura."); const selectedInvoices = invoices.filter(i => archiveSelection.includes(i.id)); let body = `*Oggetto: trasmissione lista fatture*\n\nTotale: ${selectedInvoices.length}\n\n`; selectedInvoices.forEach((inv, i) => body += `${i+1}. ${inv.invoiceNumber} - ${new Date(inv.issueDate).toLocaleDateString()} - ${inv.sdiId || 'SDI N/D'}\n`); window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank'); };

    // Common List Filtering
    const filteredList = useMemo(() => {
        let list: any[] = [];
        if (activeTab === 'transactions') list = transactions.filter(t => !t.isDeleted);
        if (activeTab === 'invoices') list = invoices.filter(i => !i.isDeleted);
        if (activeTab === 'quotes') list = quotes.filter(q => !q.isDeleted);
        if (activeTab === 'archive') list = invoices.filter(i => !i.isDeleted && i.status === DocumentStatus.SealedSDI);

        list = list.filter(item => {
            const searchMatch = (item.description || item.clientName || item.invoiceNumber || item.quoteNumber || '').toLowerCase().includes(listFilters.search.toLowerCase());
            return searchMatch;
        });
        return list;
    }, [activeTab, transactions, invoices, quotes, listFilters]);

    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(start, start + itemsPerPage);
    }, [filteredList, currentPage]);

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div><h1 className="text-3xl font-bold">Finanza Enterprise</h1><p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Controllo di gestione, fiscalità, logistica e flussi.</p></div>
                {activeTab === 'controlling' ? (
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={handleGenerateRentTransactions} className="md-btn md-btn-raised bg-purple-600 text-white flex items-center"><SparklesIcon /> <span className="ml-2">Calcola Noli</span></button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        {activeTab === 'transactions' && <button onClick={() => setIsResetTransModalOpen({isOpen: true, type: TransactionType.Income})} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200"><TrashIcon /> ENTRATE: Elimina tutte</button>}
                        {['invoices','quotes'].includes(activeTab) && <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-gray-50 text-gray-700 border border-gray-200"><TrashIcon /> Elimina Tutto</button>}
                        {activeTab === 'transactions' && <button onClick={() => { setEditingItem(null); setIsTransModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> Nuova</button>}
                        {(activeTab === 'invoices' || activeTab === 'quotes') && <button onClick={() => { setEditingItem(null); setDocType(activeTab === 'invoices' ? 'invoice' : 'quote'); setIsDocModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary"><PlusIcon /> Nuovo</button>}
                    </div>
                )}
            </div>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {[{id:'overview',label:'Panoramica'},{id:'cfo',label:'CFO (Strategia)'},{id:'controlling',label:'Controllo di Gestione'},{id:'analytics',label:'Analisi Grafica'},{id:'transactions',label:'Transazioni'},{id:'invoices',label:'Fatture'},{id:'archive',label:'ARCHIVIO'},{id:'quotes',label:'Preventivi'}].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
                    ))}
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                    {activeTab === 'overview' && (
                        <div className="animate-fade-in space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md-card p-6 bg-green-50 border-l-4 border-green-500"><h3 className="text-xs font-bold text-green-800 uppercase tracking-wider">Ricavi Totali</h3><p className="text-2xl font-bold text-green-900 mt-2">{engineData.revenue.toFixed(2)}€</p></div>
                                <div className="md-card p-6 bg-red-50 border-l-4 border-red-500"><h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">Costi Totali</h3><p className="text-2xl font-bold text-red-900 mt-2">{engineData.expenses.toFixed(2)}€</p></div>
                                <div className="md-card p-6 bg-indigo-50 border-l-4 border-indigo-500"><h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Utile Netto</h3><p className="text-2xl font-bold text-indigo-900 mt-2">{engineData.netProfit.toFixed(2)}€</p></div>
                                <div className="md-card p-6 bg-blue-50 border-l-4 border-blue-500"><h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Margine</h3><p className="text-2xl font-bold text-blue-900 mt-2">{engineData.margin.toFixed(1)}%</p></div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'cfo' && (
                        <div className="space-y-8 animate-slide-up">
                            {/* Proiezione Fiscale Dettagliata */}
                            <div className="md-card p-6 border-l-4 border-indigo-600">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><CalculatorIcon /> Proiezione Fiscale (Forfettario)</h3>
                                
                                <div className="mb-6">
                                    <div className="flex justify-between text-xs mb-1 font-bold text-gray-600"><span>Plafond 85.000€</span><span>{engineData.fiscal.limitProgress.toFixed(1)}% Utilizzato</span></div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className={`h-3 rounded-full transition-all duration-1000 ${engineData.fiscal.limitProgress > 80 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(engineData.fiscal.limitProgress, 100)}%` }}></div></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200"><p className="text-gray-500 text-xs uppercase font-bold">Imponibile (78%)</p><p className="text-xl font-mono font-bold text-gray-800 mt-1">{engineData.fiscal.taxableIncome.toFixed(2)}€</p></div>
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200"><p className="text-gray-500 text-xs uppercase font-bold">INPS (26.23%)</p><p className="text-xl font-mono font-bold text-orange-600 mt-1">{engineData.fiscal.inpsTotal.toFixed(2)}€</p></div>
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200"><p className="text-gray-500 text-xs uppercase font-bold">Imposta Sost. (5%)</p><p className="text-xl font-mono font-bold text-red-600 mt-1">{engineData.fiscal.taxTotal.toFixed(2)}€</p></div>
                                    <div className="bg-gray-50 p-3 rounded border border-gray-200"><p className="text-gray-500 text-xs uppercase font-bold">Bolli ({engineData.fiscal.invoicesCount})</p><p className="text-xl font-mono font-bold text-gray-600 mt-1">{engineData.fiscal.totalBolloCost.toFixed(2)}€</p></div>
                                </div>
                            </div>

                            {/* Simulatore Rateale 6 Mesi */}
                            <div className="md-card p-6 border-l-4 border-teal-500">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">🔮 Simulatore Rate (Giu-Nov)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between border-b pb-1"><span>Saldo 2025:</span> <span className="font-bold">{engineData.fiscal.installmentsProjection.saldo2025.toFixed(2)}€</span></div>
                                        <div className="flex justify-between border-b pb-1"><span>I Acconto 2026:</span> <span className="font-bold">{engineData.fiscal.installmentsProjection.acconto1_2026.toFixed(2)}€</span></div>
                                        <div className="flex justify-between bg-teal-50 p-2 rounded font-bold text-teal-800"><span>TOTALE DA RATEIZZARE:</span> <span>{engineData.fiscal.installmentsProjection.totalDueJune.toFixed(2)}€</span></div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {engineData.fiscal.installmentsProjection.months.map((m, i) => (
                                            <div key={i} className="bg-white border rounded p-2 text-center shadow-sm">
                                                <div className="text-[10px] uppercase text-gray-400 font-bold">{m}</div>
                                                <div className="text-sm font-bold text-teal-600">{engineData.fiscal.installmentsProjection.installmentAmount.toFixed(0)}€</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Reverse Engineering & Strategy */}
                            <div className="md-card p-6 border-t-4 border-purple-500">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><SparklesIcon /> AI Reverse Engineering</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                    <div className="bg-gray-50 p-3 rounded">
                                        <label className="text-xs font-bold text-gray-500 block mb-1">Target Netto Mensile</label>
                                        <input type="number" value={simParams.targetNetMonthly} onChange={e=>setSimParams({...simParams, targetNetMonthly: Number(e.target.value)})} className="w-full font-bold text-lg bg-transparent border-b border-gray-300 focus:border-purple-500 outline-none" />
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded">
                                        <label className="text-xs font-bold text-gray-500 block mb-1">Prezzo Lezione</label>
                                        <input type="number" value={simParams.avgLessonPrice} onChange={e=>setSimParams({...simParams, avgLessonPrice: Number(e.target.value)})} className="w-full font-bold text-lg bg-transparent border-b border-gray-300 focus:border-purple-500 outline-none" />
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded border border-purple-100 col-span-2 flex flex-col justify-center">
                                        <span className="text-xs text-purple-800 font-bold uppercase">Fatturato Annuo Necessario (Lordo)</span>
                                        <span className="text-2xl font-bold text-purple-700">{engineData.ai.requiredAnnualRevenue.toFixed(2)}€</span>
                                    </div>
                                </div>

                                {/* Action Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className={`p-4 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${engineData.ai.actionUrgency === 'High' ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-400'}`}>
                                        <h4 className="font-bold text-sm uppercase mb-2">Azioni Tattiche (Breve Termine)</h4>
                                        <p className="text-xs text-gray-600 mb-2">Per coprire il gap di {engineData.ai.revenueGap.toFixed(0)}€:</p>
                                        <ul className="text-xs space-y-1 font-medium">
                                            <li>• Trovare <strong>{Math.ceil(engineData.ai.studentsNeeded)}</strong> nuovi studenti.</li>
                                            <li>• Vendere <strong>{Math.ceil(engineData.ai.lessonsNeeded)}</strong> lezioni extra.</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 rounded-xl border-l-4 border-blue-500 bg-blue-50 shadow-sm cursor-pointer hover:shadow-md transition-all">
                                        <h4 className="font-bold text-sm uppercase mb-2">Strategia (Medio/Lungo Termine)</h4>
                                        <p className="text-xs text-gray-600 mb-2">Per stabilizzare il target:</p>
                                        <ul className="text-xs space-y-1 font-medium">
                                            <li>• Alzare il prezzo medio a <strong>{(simParams.avgLessonPrice * 1.1).toFixed(2)}€</strong>.</li>
                                            <li>• Ottimizzare i costi di nolo nelle sedi a basso margine.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'controlling' && (
                        /* REINTEGRATO CONTROLLO GESTIONE (Logistica, Profittabilità) */
                        <div className="space-y-8 animate-slide-up">
                            <div className="md-card p-6 border-t-4 border-indigo-500">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">🏢 Profittabilità Sedi</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><div className="h-64 relative"><canvas ref={el => controllingChartRef.current = el}></canvas></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b"><tr><th className="px-3 py-2">Sede</th><th className="px-3 py-2 text-right">Margine</th></tr></thead><tbody>{locationAnalysis.map((loc,idx)=>(<tr key={idx} className="hover:bg-gray-50"><td className="px-3 py-2 font-bold">{loc.name}</td><td className="px-3 py-2 text-right">{loc.marginPercent.toFixed(0)}%</td></tr>))}</tbody></table></div></div>
                            </div>
                            <div className="md-card p-6 border-t-4 border-amber-500 bg-amber-50/30">
                                <h3 className="text-lg font-bold text-amber-900 mb-4">🚚 Efficienza Logistica (TCO)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div><span className="text-sm font-bold">Carburante (€/L):</span><input type="number" step="0.01" value={simParams.fuelCost} onChange={e=>setSimParams({...simParams,fuelCost:Number(e.target.value)})} className="w-20 p-1 border rounded ml-2"/></div>
                                    <div className="flex flex-col justify-center items-center bg-white rounded-xl shadow-sm p-4"><p className="text-xs font-bold text-amber-800 uppercase">Costo Totale</p><p className="text-3xl font-bold text-amber-600">{engineData.logistics.totalLogisticsCost.toFixed(2)}€</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        /* REINTEGRATO ANALYTICS */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                            <div className="md-card p-4"><div className="h-64"><canvas ref={el => canvasRefs.current['bar'] = el}></canvas></div></div>
                            <div className="md-card p-4"><div className="h-64"><canvas ref={el => canvasRefs.current['doughnut'] = el}></canvas></div></div>
                            <div className="md-card p-4"><div className="h-64"><canvas ref={el => canvasRefs.current['line'] = el}></canvas></div></div>
                            <div className="md-card p-4"><div className="h-64"><canvas ref={el => canvasRefs.current['radar'] = el}></canvas></div></div>
                        </div>
                    )}

                    {(['transactions', 'invoices', 'quotes', 'archive'].includes(activeTab)) && (
                        /* Standard List View */
                        <div className="space-y-4 animate-slide-up">
                            <div className="md-card p-4">
                                <div className="mb-4 flex gap-2">
                                    <input type="text" placeholder="Cerca..." value={listFilters.search} onChange={e=>setListFilters({...listFilters, search: e.target.value})} className="md-input"/>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th>Data</th><th>Descrizione/Cliente</th><th>Importo</th><th>Stato</th><th>Azioni</th></tr></thead>
                                        <tbody>
                                            {paginatedList.map((item: any) => (
                                                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3">{new Date(item.date || item.issueDate).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{item.description || item.clientName}</td>
                                                    <td className="px-4 py-3">{(item.amount || item.totalAmount).toFixed(2)}€</td>
                                                    <td className="px-4 py-3">{item.status}</td>
                                                    <td className="px-4 py-3 flex gap-2">
                                                        {activeTab === 'archive' && <input type="checkbox" checked={archiveSelection.includes(item.id)} onChange={() => toggleArchiveSelection(item.id)} />}
                                                        {activeTab === 'invoices' && item.status === 'PendingSDI' && <button onClick={() => handleSealClick(item)} className="text-blue-600"><DocumentCheckIcon/></button>}
                                                        {(activeTab === 'invoices' || activeTab === 'quotes' || activeTab === 'archive') && <button onClick={() => handlePrintDocument(item)} className="text-gray-600"><PrinterIcon/></button>}
                                                        {activeTab !== 'archive' && <button onClick={() => { setEditingItem(item); if(activeTab==='transactions') setIsTransModalOpen(true); else setIsDocModalOpen(true); }} className="text-blue-600"><PencilIcon/></button>}
                                                        <button onClick={() => activeTab === 'transactions' ? handleDeleteTransaction(item.id) : handleDeleteDocument(item.id)} className="text-red-600"><TrashIcon/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <ConfirmModal isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} isDangerous={confirmState.isDangerous} />
            
            {/* Minimal Modals Placeholders */}
            {isTransModalOpen && <Modal onClose={()=>setIsTransModalOpen(false)}><div className="p-4"><h3>Transazione</h3><button onClick={()=>handleSaveTransaction(editingItem || {date: new Date().toISOString(), amount:0, type: TransactionType.Expense, category: TransactionCategory.Other, paymentMethod: PaymentMethod.Cash, description: '', status: TransactionStatus.Completed})}>Salva</button></div></Modal>}
            {isDocModalOpen && <Modal onClose={()=>setIsDocModalOpen(false)}><div className="p-4"><h3>Documento</h3><button onClick={()=>handleSaveDocument(editingItem || {clientName: '', issueDate: new Date().toISOString(), items: [], totalAmount: 0, status: DocumentStatus.Draft})}>Salva</button></div></Modal>}
            {isSealModalOpen && <Modal onClose={()=>setIsSealModalOpen(false)}><div className="p-4"><h3>Sigilla SDI</h3><button onClick={()=>handleConfirmSeal('SDI-123')}>Conferma</button></div></Modal>}
        </div>
    );
};

export default Finance;
