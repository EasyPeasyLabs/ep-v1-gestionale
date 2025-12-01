
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chart, ArcElement, LineElement, BarElement, PointElement, BarController, BubbleController, DoughnutController, LineController, PieController, PolarAreaController, RadarController, ScatterController, CategoryScale, LinearScale, LogarithmicScale, RadialLinearScale, TimeScale, TimeSeriesScale, Decimation, Filler, Legend, Title, Tooltip, SubTitle } from 'chart.js';
import { 
    Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, 
    TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, 
    DocumentStatus, Enrollment, Supplier, DocumentItem, Client, ClientType, ParentClient, InstitutionalClient 
} from '../types';
import { 
    getTransactions, addTransaction, updateTransaction, deleteTransaction, 
    getInvoices, addInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus, 
    getQuotes, addQuote, updateQuote, deleteQuote, updateQuoteStatus, 
    calculateRentTransactions, batchAddTransactions,
    permanentDeleteTransaction, permanentDeleteInvoice, permanentDeleteQuote,
    resetFinancialData // New function
} from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import { getCompanyInfo } from '../services/settingsService';

import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import Pagination from '../components/Pagination';

// Register ALL Chart.js components
Chart.register(
  ArcElement, LineElement, BarElement, PointElement,
  BarController, BubbleController, DoughnutController, LineController, PieController, PolarAreaController, RadarController, ScatterController,
  CategoryScale, LinearScale, LogarithmicScale, RadialLinearScale, TimeScale, TimeSeriesScale,
  Decimation, Filler, Legend, Title, Tooltip, SubTitle
);

// --- HELPER FISCALI 2025 ---
const LIMIT_FORFETTARIO = 85000;
const COEFF_REDDITIVITA = 0.78; // ATECO Istruzione
const INPS_RATE = 0.2623; // Gestione Separata 2024/25 approx
const TAX_RATE_STARTUP = 0.05;
const START_DATE_BUSINESS = new Date('2025-03-01'); // Data Inizio Attività

// --- SUB-COMPONENTS (Forms) ---
const TransactionForm: React.FC<{ transaction?: Transaction | null; onSave: (t: TransactionInput | Transaction) => void; onCancel: () => void }> = ({ transaction, onSave, onCancel }) => {
    const [date, setDate] = useState(transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState(transaction?.description || '');
    const [amount, setAmount] = useState(transaction?.amount || 0);
    const [type, setType] = useState<TransactionType>(transaction?.type || TransactionType.Expense);
    const [category, setCategory] = useState<TransactionCategory>(transaction?.category || TransactionCategory.OtherExpense);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.paymentMethod || PaymentMethod.BankTransfer);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data: any = { date: new Date(date).toISOString(), description, amount: Number(amount), type, category, paymentMethod, status: transaction?.status || TransactionStatus.Completed };
        if (transaction?.id) onSave({ ...data, id: transaction.id }); else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <h3 className="text-xl font-bold mb-2">{transaction ? 'Modifica Transazione' : 'Nuova Transazione'}</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} required className="md-input" /><label className="md-input-label !top-0">Data</label></div>
                <div className="md-input-group"><select value={type} onChange={e => setType(e.target.value as TransactionType)} className="md-input"><option value={TransactionType.Income}>Entrata</option><option value={TransactionType.Expense}>Uscita</option></select><label className="md-input-label !top-0">Tipo</label></div>
            </div>
            <div className="md-input-group"><input type="text" value={description} onChange={e => setDescription(e.target.value)} required className="md-input" placeholder=" " /><label className="md-input-label">Descrizione</label></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="md-input-group"><input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required className="md-input" placeholder=" " /><label className="md-input-label">Importo (€)</label></div>
                <div className="md-input-group"><select value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="md-input">{Object.values(TransactionCategory).map(c => <option key={c} value={c}>{c}</option>)}</select><label className="md-input-label !top-0">Categoria</label></div>
            </div>
            <div className="md-input-group"><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}</select><label className="md-input-label !top-0">Metodo Pagamento</label></div>
            <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button><button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button></div>
        </form>
    );
};

const DocumentForm: React.FC<{ docData?: Invoice | Quote | null; type: 'invoice' | 'quote'; clients: Client[]; onSave: (d: any) => void; onCancel: () => void; }> = ({ docData, type, clients, onSave, onCancel }) => {
    const [clientId, setClientId] = useState(docData?.clientId || '');
    const [issueDate, setIssueDate] = useState(docData?.issueDate ? docData.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState((docData as Invoice)?.dueDate ? (docData as Invoice).dueDate.split('T')[0] : '');
    const [expiryDate, setExpiryDate] = useState((docData as Quote)?.expiryDate ? (docData as Quote).expiryDate.split('T')[0] : '');
    const [items, setItems] = useState<DocumentItem[]>(docData?.items || [{ description: '', quantity: 1, price: 0 }]);
    const [notes, setNotes] = useState(docData?.notes || '');
    const [paymentMethod, setPaymentMethod] = useState(docData?.paymentMethod || PaymentMethod.BankTransfer);
    const [hasStampDuty, setHasStampDuty] = useState(docData?.hasStampDuty || false);

    const handleAddItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
    const handleItemChange = (index: number, field: keyof DocumentItem, value: any) => { const newItems = [...items]; newItems[index] = { ...newItems[index], [field]: value }; setItems(newItems); };
    
    const clientOptions = useMemo(() => clients.map(c => ({ id: c.id, label: c.clientType === ClientType.Parent ? `${(c as ParentClient).lastName} ${(c as ParentClient).firstName}` : (c as InstitutionalClient).companyName })).sort((a,b) => a.label.localeCompare(b.label)), [clients]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedClient = clients.find(c => c.id === clientId);
        const clientName = selectedClient ? (selectedClient.clientType === ClientType.Parent ? `${(selectedClient as ParentClient).firstName} ${(selectedClient as ParentClient).lastName}` : (selectedClient as InstitutionalClient).companyName) : 'Cliente Manuale';
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0) + (hasStampDuty ? 2 : 0);
        const baseData = { clientId, clientName, issueDate: new Date(issueDate).toISOString(), items, notes, paymentMethod, hasStampDuty, totalAmount, status: docData?.status || DocumentStatus.Draft };
        if (type === 'invoice') { onSave({ ...baseData, dueDate: new Date(dueDate || issueDate).toISOString() }); } else { onSave({ ...baseData, expiryDate: new Date(expiryDate || issueDate).toISOString() }); }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 flex flex-col h-full max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 flex-shrink-0">{docData ? 'Modifica' : 'Nuovo'} {type === 'invoice' ? 'Fattura' : 'Preventivo'}</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="md-input-group"><select value={clientId} onChange={e => setClientId(e.target.value)} required className="md-input"><option value="" disabled>Seleziona Cliente</option>{clientOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select><label className="md-input-label !top-0">Cliente</label></div>
                <div className="grid grid-cols-2 gap-4"><div className="md-input-group"><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required className="md-input" /><label className="md-input-label !top-0">Data Emissione</label></div>{type === 'invoice' ? (<div className="md-input-group"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="md-input" /><label className="md-input-label !top-0">Scadenza</label></div>) : (<div className="md-input-group"><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required className="md-input" /><label className="md-input-label !top-0">Validità Fino</label></div>)}</div>
                <div className="border-t pt-4"><label className="block text-sm font-bold text-gray-700 mb-2">Articoli</label>{items.map((item, idx) => (<div key={idx} className="flex gap-2 mb-2 items-start"><div className="flex-1 space-y-1"><input type="text" placeholder="Descrizione" value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} required className="md-input text-sm py-1" /><input type="text" placeholder="Note (opzionale)" value={item.notes || ''} onChange={e => handleItemChange(idx, 'notes', e.target.value)} className="md-input text-xs py-1 text-gray-500" /></div><input type="number" placeholder="Qta" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-16 border rounded p-1 text-sm text-center" /><input type="number" placeholder="Prezzo" value={item.price} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="w-24 border rounded p-1 text-sm text-right" /><button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 font-bold px-2">×</button></div>))}<button type="button" onClick={handleAddItem} className="text-sm text-indigo-600 font-medium hover:underline">+ Aggiungi Riga</button></div>
                <div className="border-t pt-4 grid grid-cols-2 gap-4"><div><label className="block text-xs text-gray-500 mb-1">Metodo Pagamento</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full border rounded p-2 text-sm bg-white">{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}</select></div><div className="flex items-center pt-4"><input type="checkbox" checked={hasStampDuty} onChange={e => setHasStampDuty(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded" /><label className="ml-2 text-sm text-gray-700">Applica Bollo (2€)</label></div></div>
                <div className="md-input-group"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="md-input" placeholder="Note documento..." /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t flex-shrink-0 bg-white"><button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button><button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button></div>
        </form>
    );
};

// --- MAIN FINANCE COMPONENT ---

interface FinanceProps {
    initialParams?: any;
    onNavigate?: (page: string, params?: any) => void;
}

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'analytics' | 'transactions' | 'invoices' | 'quotes'>('overview');
    
    // Data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Simulators State (Interactive)
    const [simParams, setSimParams] = useState({
        accountantCost: 1200,
        fuelCost: 1.85,
        targetNetMonthly: 2000, // AI CFO Target
        avgLessonPrice: 20 // Stima media per simulazione
    });

    // List Filters State
    const [listFilters, setListFilters] = useState({
        search: '',
        dateFrom: '',
        dateTo: '',
        minAmount: '',
        maxAmount: '',
        sortColumn: 'date',
        sortDirection: 'desc' as 'asc' | 'desc'
    });

    // Modals
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [docType, setDocType] = useState<'invoice' | 'quote'>('invoice');
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    
    // Modal per eliminazione massiva transazioni
    const [isResetTransModalOpen, setIsResetTransModalOpen] = useState<{isOpen: boolean, type: TransactionType | null}>({isOpen: false, type: null});

    const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDangerous: boolean; }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDangerous: false });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Charts Refs
    const chartsRef = useRef<{[key: string]: Chart}>({});
    const canvasRefs = useRef<{[key: string]: HTMLCanvasElement | null}>({});
    
    // Overview Chart Ref (NEW)
    const overviewChartRef = useRef<HTMLCanvasElement | null>(null);
    const overviewChartInstance = useRef<Chart | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tData, iData, qData, eData, sData, cData, info] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getCompanyInfo()
            ]);
            setTransactions(tData); setInvoices(iData); setQuotes(qData); setEnrollments(eData); setSuppliers(sData); setClients(cData); setCompanyInfo(info);
            // Init Sim Params from info if available or defaults
            if(info) setSimParams(prev => ({...prev, fuelCost: info.carFuelConsumption ? 1.85 : 1.85 })); 
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); window.addEventListener('EP_DataUpdated', fetchData); return () => window.removeEventListener('EP_DataUpdated', fetchData); }, [fetchData]);

    // --- ENGINE LOGIC: THE CORE ---
    const engineData = useMemo(() => {
        // 1. Core Financials
        const activeTransactions = transactions.filter(t => !t.isDeleted);
        const revenue = activeTransactions.filter(t => t.type === TransactionType.Income && !t.excludeFromStats).reduce((acc, t) => acc + t.amount, 0);
        const expenses = activeTransactions.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const netProfit = revenue - expenses;
        const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        // 2. Fiscal Engine (Forfettario 2025 - Start Mar 2025)
        // Imponibile = Fatturato incassato * 78%
        const taxableIncome = revenue * COEFF_REDDITIVITA;
        
        // Tasse Anno Corrente (2025)
        const inpsCurrentYear = taxableIncome * INPS_RATE;
        const taxCurrentYear = taxableIncome * TAX_RATE_STARTUP;
        const totalTaxCurrentYear = inpsCurrentYear + taxCurrentYear;

        // Proiezione Acconti per Anno Successivo (2026)
        // Saldo 2025 (pari alle tasse calcolate) + I Acconto 2026 (50% del saldo) + II Acconto 2026 (50% del saldo)
        const saldo2025 = totalTaxCurrentYear;
        const acconto1_2026 = totalTaxCurrentYear * 0.50; // 50% del 100%
        const acconto2_2026 = totalTaxCurrentYear * 0.50; // 50% del 100%

        // Totale Giugno (Saldo + I Acconto) - Ripartibile in rate
        const totalDueJune = saldo2025 + acconto1_2026;
        const installmentAmount = totalDueJune / 6; // N. rate (Giugno -> Novembre)

        // Quota Mensile "Salva-Vita" (Accantonamento reale per coprire Saldo + Acconti futuri)
        // Considerando 10 mesi di attività (Mar-Dic)
        const totalLiabilityToCover = totalDueJune + acconto2_2026;
        const monthlySavingQuota = totalLiabilityToCover / 10; 

        // Bolli
        const invoicesWithBollo = invoices.filter(i => !i.isDeleted && i.hasStampDuty);
        const totalBolloCost = invoicesWithBollo.length * 2.00;

        // 3. Advanced Logistics (TCO)
        let totalKm = 0;
        enrollments.forEach(enr => {
            if (enr.status === 'Active' || enr.status === 'Completed') {
                const loc = suppliers.find(s => s.locations.some(l => l.id === enr.locationId))?.locations.find(l => l.id === enr.locationId);
                const dist = loc?.distance || 0;
                // Km = (Distance * 2 A/R) * LessonsTotal
                const tripKm = (dist * 2) * enr.lessonsTotal;
                totalKm += tripKm;
            }
        });

        const fuelCons = companyInfo?.carFuelConsumption || 16.5;
        const estimatedFuelCost = (totalKm / fuelCons) * simParams.fuelCost;
        const wearCoefficient = 0.045; 
        const estimatedWearCost = totalKm * wearCoefficient;
        const insuranceCost = 600; // Annual fixed
        const carTax = 180; // Bollo Auto fixed
        const totalLogisticsCost = estimatedFuelCost + estimatedWearCost + insuranceCost + carTax;

        // 4. AI CFO - Reverse Engineering
        const totalTaxRate = INPS_RATE + TAX_RATE_STARTUP;
        const taxFactor = 1 - (COEFF_REDDITIVITA * totalTaxRate);
        const monthlyFixedCosts = (totalLogisticsCost + simParams.accountantCost + 1200) / 10; // Su 10 mesi
        const targetAnnualNet = simParams.targetNetMonthly * 10; // Su 10 mesi
        const annualRealCosts = totalLogisticsCost + simParams.accountantCost + expenses; 
        
        const requiredAnnualRevenue = (targetAnnualNet + annualRealCosts) / taxFactor;
        const requiredMonthlyRevenue = requiredAnnualRevenue / 10;
        
        const lessonsNeeded = requiredMonthlyRevenue / simParams.avgLessonPrice;
        const studentsNeeded = lessonsNeeded / 4; 

        return {
            revenue, expenses, netProfit, margin,
            fiscal: {
                limitProgress: (revenue / LIMIT_FORFETTARIO) * 100,
                remainingCeiling: LIMIT_FORFETTARIO - revenue,
                taxableIncome,
                inpsTotal: inpsCurrentYear,
                taxTotal: taxCurrentYear,
                totalFiscalBurden: totalTaxCurrentYear,
                monthlySavingQuota,
                totalBolloCost,
                invoicesCount: invoicesWithBollo.length,
                // Breakdown per simulazione rate
                installmentsProjection: {
                    saldo2025,
                    acconto1_2026,
                    acconto2_2026,
                    totalDueJune,
                    installmentAmount // Rata singola (x6)
                }
            },
            logistics: {
                totalKm,
                estimatedFuelCost,
                estimatedWearCost,
                fixedCosts: insuranceCost + carTax,
                totalLogisticsCost,
                impactPerKm: totalKm > 0 ? totalLogisticsCost / totalKm : 0
            },
            accountant: {
                annualCost: simParams.accountantCost
            },
            ai: {
                requiredAnnualRevenue,
                requiredMonthlyRevenue,
                lessonsNeeded,
                studentsNeeded
            }
        };
    }, [transactions, invoices, enrollments, suppliers, companyInfo, simParams]);

    // --- EXPENSE BREAKDOWN CALCULATION (For Overview Card) ---
    const expenseAnalysis = useMemo(() => {
        const categories: Record<string, number> = {};
        let totalExpenses = 0;

        transactions.forEach(t => {
            if (!t.isDeleted && t.type === TransactionType.Expense) {
                const cat = t.category || 'Altro';
                categories[cat] = (categories[cat] || 0) + t.amount;
                totalExpenses += t.amount;
            }
        });

        // Convert to array and sort desc
        const sortedCategories = Object.entries(categories)
            .map(([name, value]) => ({ 
                name, 
                value, 
                percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
                description: getCategoryDescription(name)
            }))
            .sort((a, b) => b.value - a.value);

        return { sortedCategories, totalExpenses };
    }, [transactions]);

    function getCategoryDescription(cat: string): string {
        switch(cat) {
            case TransactionCategory.Rent: return "Nolo Sedi e Spazi";
            case TransactionCategory.Taxes: return "Imposte e Tasse";
            case TransactionCategory.Fuel: return "Carburante e Trasporti";
            case TransactionCategory.Materials: return "Materiale Didattico";
            case TransactionCategory.ProfessionalServices: return "Commercialista/Consulenze";
            case TransactionCategory.Software: return "Licenze e Servizi Web";
            case TransactionCategory.Marketing: return "Pubblicità e Promo";
            default: return "Spese operative varie";
        }
    }

    // --- OVERVIEW CHART RENDERER ---
    useEffect(() => {
        if (activeTab === 'overview' && overviewChartRef.current) {
            if (overviewChartInstance.current) {
                overviewChartInstance.current.destroy();
            }

            const ctx = overviewChartRef.current.getContext('2d');
            if (ctx) {
                // Colors palette for breakdown
                const colors = [
                    '#6366f1', // Indigo
                    '#f43f5e', // Rose
                    '#f59e0b', // Amber
                    '#10b981', // Emerald
                    '#3b82f6', // Blue
                    '#8b5cf6', // Violet
                    '#ec4899', // Pink
                    '#64748b'  // Slate
                ];

                overviewChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: expenseAnalysis.sortedCategories.map(c => c.name),
                        datasets: [{
                            data: expenseAnalysis.sortedCategories.map(c => c.value),
                            backgroundColor: colors,
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.raw as number;
                                        const pct = ((val / expenseAnalysis.totalExpenses) * 100).toFixed(1);
                                        return `${ctx.label}: ${val.toFixed(2)}€ (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (overviewChartInstance.current) overviewChartInstance.current.destroy();
        };
    }, [activeTab, expenseAnalysis]);


    // --- ANALYTICS CHARTS RENDERER (Original) ---
    useEffect(() => {
        if (activeTab === 'analytics') {
            const createChart = (id: string, type: any, data: any, options: any) => {
                const ctx = canvasRefs.current[id]?.getContext('2d');
                if (ctx) {
                    if (chartsRef.current[id]) chartsRef.current[id].destroy();
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

            // 1. Histogram (Bar) - Fatturato vs Spese
            createChart('bar', 'bar', {
                labels: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
                datasets: [
                    { label: 'Entrate', data: monthlyRev, backgroundColor: '#4ade80', borderRadius: 4 },
                    { label: 'Uscite', data: monthlyExp, backgroundColor: '#f87171', borderRadius: 4 }
                ]
            }, { plugins: { title: { display: true, text: 'Andamento Mensile' } } });

            // 2. Doughnut - Cost Breakdown (Detailed)
            createChart('doughnut', 'doughnut', {
                labels: ['Logistica (TCO)', 'Tasse (Stima)', 'Commercialista', 'Noli Sedi', 'Altro Operativo'],
                datasets: [{
                    data: [
                        engineData.logistics.totalLogisticsCost, 
                        engineData.fiscal.totalFiscalBurden, 
                        engineData.accountant.annualCost, 
                        transactions.filter(t => t.category === TransactionCategory.Rent).reduce((a,b)=>a+b.amount,0), 
                        Math.max(0, engineData.expenses - engineData.logistics.totalLogisticsCost - engineData.fiscal.totalFiscalBurden) // Residuo
                    ],
                    backgroundColor: ['#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#9ca3af']
                }]
            }, { cutout: '60%' });

            // 3. Line - Cash Flow Cumulative
            let cash = 0;
            const flow = monthlyRev.map((inc, i) => { cash += (inc - monthlyExp[i]); return cash; });
            createChart('line', 'line', {
                labels: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
                datasets: [{ label: 'Saldo Progressivo', data: flow, borderColor: '#6366f1', fill: true, backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4 }]
            }, {});

            // 4. Radar - Business Health
            createChart('radar', 'radar', {
                labels: ['Liquidità', 'Redditività', 'Efficienza Fiscale', 'Sostenibilità Logistica', 'Crescita'],
                datasets: [{
                    label: 'Score Aziendale',
                    data: [85, engineData.margin, 70, 60, 75], // Mock logic for health score based on metrics
                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                    borderColor: '#34d399',
                    pointBackgroundColor: '#34d399'
                }]
            }, { scales: { r: { suggestedMin: 0, suggestedMax: 100 } } });
        }
    }, [activeTab, engineData, transactions]);

    // --- LIST FILTER LOGIC ---
    const handleSort = (column: string) => {
        setListFilters(prev => ({
            ...prev,
            sortColumn: column,
            sortDirection: prev.sortColumn === column && prev.sortDirection === 'asc' ? 'desc' : 'asc'
        }));
    };

    const filteredList = useMemo(() => {
        let list: any[] = [];
        if (activeTab === 'transactions') list = transactions.filter(t => !t.isDeleted);
        if (activeTab === 'invoices') list = invoices.filter(i => !i.isDeleted);
        if (activeTab === 'quotes') list = quotes.filter(q => !q.isDeleted);

        // Filter
        list = list.filter(item => {
            const searchMatch = (item.description || item.clientName || '').toLowerCase().includes(listFilters.search.toLowerCase());
            const dateMatch = (!listFilters.dateFrom || new Date(item.date || item.issueDate) >= new Date(listFilters.dateFrom)) &&
                              (!listFilters.dateTo || new Date(item.date || item.issueDate) <= new Date(listFilters.dateTo));
            const amt = item.amount || item.totalAmount;
            const amtMatch = (!listFilters.minAmount || amt >= Number(listFilters.minAmount)) &&
                             (!listFilters.maxAmount || amt <= Number(listFilters.maxAmount));
            return searchMatch && dateMatch && amtMatch;
        });

        // Sort
        list.sort((a, b) => {
            const valA = a[listFilters.sortColumn] || (listFilters.sortColumn === 'date' ? (a.date || a.issueDate) : 0);
            const valB = b[listFilters.sortColumn] || (listFilters.sortColumn === 'date' ? (b.date || b.issueDate) : 0);
            
            if (typeof valA === 'string') {
                return listFilters.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return listFilters.sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        return list;
    }, [activeTab, transactions, invoices, quotes, listFilters]);

    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(start, start + itemsPerPage);
    }, [filteredList, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [activeTab, listFilters]);

    // --- ACTIONS ---
    const handleDeleteAll = async () => { setIsDeleteAllModalOpen(false); setLoading(true); try { if (activeTab === 'transactions') { for (const t of await getTransactions()) await permanentDeleteTransaction(t.id); } else if (activeTab === 'invoices') { for (const i of await getInvoices()) await permanentDeleteInvoice(i.id); } else if (activeTab === 'quotes') { for (const q of await getQuotes()) await permanentDeleteQuote(q.id); } await fetchData(); alert("Eliminazione completata."); } catch(e) { alert("Errore"); } finally { setLoading(false); } };
    const handleSaveTransaction = async (t: TransactionInput | Transaction) => { try { if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t as TransactionInput); setIsTransModalOpen(false); fetchData(); } catch (err) { alert("Errore"); } };
    const handleDeleteTransaction = (id: string) => { setConfirmState({ isOpen: true, title: "Elimina", message: "Sicuro?", isDangerous: true, onConfirm: async () => { await deleteTransaction(id); setConfirmState(p => ({...p, isOpen: false})); fetchData(); }}); };
    const handleSaveDocument = async (docData: any) => { try { if (docData.id) { if (docType === 'invoice') await updateInvoice(docData.id, docData); else await updateQuote(docData.id, docData); } else { if (docType === 'invoice') await addInvoice(docData); else await addQuote(docData); } setIsDocModalOpen(false); fetchData(); } catch (err) { alert("Errore"); } };
    const handleDeleteDocument = (id: string) => { setConfirmState({ isOpen: true, title: "Elimina", message: "Sicuro?", isDangerous: true, onConfirm: async () => { if (docType === 'invoice') await deleteInvoice(id); else await deleteQuote(id); setConfirmState(p => ({...p, isOpen: false})); fetchData(); }}); };
    const handlePrintDocument = async (doc: Invoice | Quote) => { const companyInfo = await getCompanyInfo(); const client = clients.find(c => c.id === doc.clientId); await generateDocumentPDF(doc, docType === 'invoice' ? 'Fattura' : 'Preventivo', companyInfo, client); };
    const handleGenerateRentTransactions = async () => { const newTrans = calculateRentTransactions(enrollments, suppliers, transactions); if (newTrans.length > 0) { await batchAddTransactions(newTrans); fetchData(); alert(`Generate ${newTrans.length} transazioni.`); } else { alert("Nessun nolo da generare."); } };

    // New: Reset Transactions by Type
    const handleResetTransactions = async () => {
        if (!isResetTransModalOpen.type) return;
        setIsResetTransModalOpen(prev => ({...prev, isOpen: false}));
        setLoading(true);
        try {
            await resetFinancialData(isResetTransModalOpen.type);
            await fetchData();
            alert(`Tutte le ${isResetTransModalOpen.type === TransactionType.Income ? 'Entrate' : 'Uscite'} sono state eliminate.`);
        } catch (e) {
            alert("Errore durante l'eliminazione.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Finanza Enterprise</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Controllo di gestione, fiscalità, logistica e flussi.</p>
                </div>
                {activeTab === 'cfo' ? (
                    <div className="flex gap-2">
                        <button onClick={handleGenerateRentTransactions} className="md-btn md-btn-raised bg-purple-600 text-white flex items-center">
                            <SparklesIcon /> <span className="ml-2">Calcola Noli</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        {/* New Bulk Delete Buttons for Transactions */}
                        {activeTab === 'transactions' && (
                            <>
                                <button onClick={() => setIsResetTransModalOpen({isOpen: true, type: TransactionType.Income})} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center text-xs font-bold"><TrashIcon /> ENTRATE: Elimina tutte</button>
                                <button onClick={() => setIsResetTransModalOpen({isOpen: true, type: TransactionType.Expense})} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold"><TrashIcon /> USCITE: Elimina tutte</button>
                            </>
                        )}

                        {['invoices','quotes'].includes(activeTab) && <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>}
                        
                        {activeTab === 'transactions' && <button onClick={() => { setEditingItem(null); setIsTransModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> Nuova</button>}
                        {(activeTab === 'invoices' || activeTab === 'quotes') && <button onClick={() => { setEditingItem(null); setDocType(activeTab === 'invoices' ? 'invoice' : 'quote'); setIsDocModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary"><PlusIcon /> Nuovo</button>}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Panoramica' },
                        { id: 'cfo', label: 'CFO (Controllo)' },
                        { id: 'analytics', label: 'Analisi Grafica' },
                        { id: 'transactions', label: 'Transazioni' },
                        { id: 'invoices', label: 'Fatture' },
                        { id: 'quotes', label: 'Preventivi' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                    {/* --- OVERVIEW (Densità Massima) --- */}
                    {activeTab === 'overview' && (
                        <div className="animate-fade-in space-y-6">
                            <p className="text-gray-500 text-sm mb-2">Quadro sintetico dei KPI finanziari.</p>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md-card p-6 bg-green-50 border-l-4 border-green-500">
                                    <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider">Ricavi Totali</h3>
                                    <p className="text-2xl font-bold text-green-900 mt-2">{engineData.revenue.toFixed(2)}€</p>
                                    <p className="text-[10px] text-green-600 mt-1">Fatturato lordo</p>
                                </div>
                                <div className="md-card p-6 bg-red-50 border-l-4 border-red-500">
                                    <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">Costi Totali</h3>
                                    <p className="text-2xl font-bold text-red-900 mt-2">{engineData.expenses.toFixed(2)}€</p>
                                    <p className="text-[10px] text-red-600 mt-1">Op + Fiscali + Logistici</p>
                                </div>
                                <div className="md-card p-6 bg-indigo-50 border-l-4 border-indigo-500">
                                    <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Utile Netto</h3>
                                    <p className="text-2xl font-bold text-indigo-900 mt-2">{engineData.netProfit.toFixed(2)}€</p>
                                    <p className="text-[10px] text-indigo-600 mt-1">Cash Flow Reale</p>
                                </div>
                                <div className="md-card p-6 bg-blue-50 border-l-4 border-blue-500">
                                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Margine (MOL)</h3>
                                    <p className="text-2xl font-bold text-blue-900 mt-2">{engineData.margin.toFixed(1)}%</p>
                                    <p className="text-[10px] text-blue-600 mt-1">Efficienza Operativa</p>
                                </div>
                            </div>

                            {/* --- NUOVA CARD: Dove vanno a finire i miei soldi? --- */}
                            <div className="md-card p-6 border-t-4 border-slate-500">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    💸 Dove vanno a finire i miei soldi?
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                                    {/* Charts Section */}
                                    <div className="h-64 relative flex justify-center items-center">
                                        <canvas ref={el => overviewChartRef.current = el}></canvas>
                                        <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                                            <span className="text-xs text-slate-400 font-medium">TOTALE USCITE</span>
                                            <span className="text-xl font-bold text-slate-800">{expenseAnalysis.totalExpenses.toFixed(2)}€</span>
                                        </div>
                                    </div>

                                    {/* Details Breakdown */}
                                    <div className="lg:col-span-2 overflow-y-auto max-h-72 pr-2 custom-scrollbar">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-slate-400 border-b border-slate-100">
                                                <tr>
                                                    <th className="text-left py-2">Categoria Spesa</th>
                                                    <th className="text-left py-2">Dettaglio</th>
                                                    <th className="text-right py-2">Importo</th>
                                                    <th className="text-right py-2">%</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {expenseAnalysis.sortedCategories.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-3 font-bold text-slate-700">{item.name}</td>
                                                        <td className="py-3 text-xs text-slate-500 italic">{item.description}</td>
                                                        <td className="py-3 text-right font-mono text-red-600 font-medium">-{item.value.toFixed(2)}€</td>
                                                        <td className="py-3 text-right">
                                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-bold">
                                                                {item.percentage.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {expenseAnalysis.sortedCategories.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                                            Nessuna spesa registrata per generare il grafico.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CFO (SIMULATOR + DEEP DATA) --- */}
                    {activeTab === 'cfo' && (
                        <div className="space-y-8 animate-slide-up">
                            
                            {/* CARD 0: AI CFO TARGET SIMULATOR */}
                            <div className="md-card p-6 border-t-4 border-purple-500 shadow-md bg-gradient-to-br from-white to-purple-50">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                                            <SparklesIcon /> AI Financial Planner 2025
                                        </h3>
                                        <p className="text-xs text-purple-600">Simulazione dinamica basata sui tuoi costi reali.</p>
                                    </div>
                                    <div className="bg-white p-2 rounded shadow-sm border border-purple-100">
                                        <label className="text-[10px] font-bold text-purple-800 block mb-1">OBIETTIVO MENSILE (NETTO)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={simParams.targetNetMonthly} 
                                                onChange={e => setSimParams({...simParams, targetNetMonthly: Number(e.target.value)})}
                                                className="w-24 text-right font-bold text-purple-700 border-b border-purple-300 outline-none bg-transparent"
                                            />
                                            <span className="text-purple-700 font-bold">€</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white/60 p-4 rounded-lg border border-purple-100">
                                        <p className="text-xs text-purple-500 font-bold uppercase mb-1">Fatturato Annuo Necessario</p>
                                        <p className="text-2xl font-bold text-purple-800">{engineData.ai.requiredAnnualRevenue.toFixed(0)}€</p>
                                        <p className="text-[10px] text-gray-500 mt-1">Per coprire Tasse, Costi e Obiettivo.</p>
                                    </div>
                                    <div className="bg-white/60 p-4 rounded-lg border border-purple-100">
                                        <p className="text-xs text-purple-500 font-bold uppercase mb-1">Target Mensile Lordo</p>
                                        <p className="text-2xl font-bold text-purple-800">{engineData.ai.requiredMonthlyRevenue.toFixed(0)}€</p>
                                        <p className="text-[10px] text-gray-500 mt-1">Da incassare ogni mese.</p>
                                    </div>
                                    <div className="bg-white/60 p-4 rounded-lg border border-purple-100">
                                        <p className="text-xs text-purple-500 font-bold uppercase mb-1">Volume Vendite Richiesto</p>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xl font-bold text-purple-800">{engineData.ai.lessonsNeeded.toFixed(0)} <span className="text-sm font-normal">lezioni/mese</span></p>
                                                <p className="text-xs text-gray-500">~{engineData.ai.studentsNeeded.toFixed(0)} allievi attivi</p>
                                            </div>
                                            <div className="text-right">
                                                <input 
                                                    type="number" 
                                                    value={simParams.avgLessonPrice} 
                                                    onChange={e => setSimParams({...simParams, avgLessonPrice: Number(e.target.value)})}
                                                    className="w-12 text-right text-xs border-b border-purple-200 bg-transparent"
                                                />
                                                <span className="text-xs text-purple-400">€/lez</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CARD 1: MOTORE FISCALE COMPLETO 2025 (Start Marzo) */}
                            <div className="md-card p-0 overflow-hidden border-t-4 border-indigo-600 shadow-md">
                                <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                        <CalculatorIcon /> Motore Fiscale & Previdenziale 2025
                                    </h3>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200">REGIME FORFETTARIO</span>
                                        <span className="text-[9px] text-indigo-400 mt-1">Inizio Attività: Mar 2025</span>
                                    </div>
                                </div>
                                
                                {/* Progress Bar Limite 85k */}
                                <div className="px-6 pt-6 pb-2">
                                    <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                                        <span>Fatturato Attuale: {engineData.revenue.toFixed(2)}€</span>
                                        <span>Limite 2025: 85.000€</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border border-gray-300 relative">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${engineData.fiscal.limitProgress > 80 ? 'bg-red-500' : engineData.fiscal.limitProgress > 50 ? 'bg-yellow-400' : 'bg-green-500'}`} 
                                            style={{ width: `${Math.min(100, engineData.fiscal.limitProgress)}%` }}
                                        ></div>
                                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700 mix-blend-multiply">
                                            Residuo: {engineData.fiscal.remainingCeiling.toFixed(2)}€
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-2 border-r border-gray-100 pr-4">
                                        <p className="text-xs text-gray-500 uppercase font-bold">Imponibile Netto (78%)</p>
                                        <p className="text-2xl font-mono font-bold text-gray-800">{engineData.fiscal.taxableIncome.toFixed(2)}€</p>
                                        <p className="text-[10px] text-gray-400">Su fatturato incassato (Mar-Dic).</p>
                                    </div>
                                    <div className="space-y-2 border-r border-gray-100 pr-4">
                                        <p className="text-xs text-gray-500 uppercase font-bold">INPS 2025</p>
                                        <p className="text-2xl font-mono font-bold text-orange-600">{engineData.fiscal.inpsTotal.toFixed(2)}€</p>
                                        <div className="text-[10px] text-orange-800 bg-orange-50 p-1 rounded">
                                            Aliquota 26.23%
                                        </div>
                                    </div>
                                    <div className="space-y-2 border-r border-gray-100 pr-4">
                                        <p className="text-xs text-gray-500 uppercase font-bold">Imposta Sost. 2025</p>
                                        <p className="text-2xl font-mono font-bold text-red-600">{engineData.fiscal.taxTotal.toFixed(2)}€</p>
                                        <p className="text-[10px] text-gray-400">Flat Tax Startup (5%).</p>
                                    </div>
                                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100 space-y-1">
                                        <p className="text-xs text-indigo-800 uppercase font-bold">Accantonamento Mensile</p>
                                        <p className="text-xl font-bold text-indigo-700">{engineData.fiscal.monthlySavingQuota.toFixed(2)}€</p>
                                        <p className="text-[10px] text-indigo-500 leading-tight">Per coprire Saldo '25 + Acconti '26.</p>
                                    </div>
                                </div>

                                {/* Piano Rateale Simulato */}
                                <div className="px-6 pb-6">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Piano Rateale Simulato (Giugno 2026)</h4>
                                    <p className="text-[10px] text-gray-400 mb-3">
                                        Calcolato sui redditi prodotti da Marzo 2025. Include Saldo 2025 + Acconti 2026 (100% + 50% + 50%).
                                    </p>
                                    <div className="overflow-x-auto bg-gray-50 rounded-lg p-3 border border-gray-200">
                                        <table className="w-full text-xs text-left">
                                            <tbody className="divide-y divide-gray-200">
                                                <tr>
                                                    <td className="p-2 font-medium">Saldo 2025 (Totale)</td>
                                                    <td className="p-2 text-right">{engineData.fiscal.installmentsProjection.saldo2025.toFixed(2)}€</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-2 font-medium">I Acconto 2026 (50%)</td>
                                                    <td className="p-2 text-right">{engineData.fiscal.installmentsProjection.acconto1_2026.toFixed(2)}€</td>
                                                </tr>
                                                <tr className="bg-indigo-50 font-bold text-indigo-900">
                                                    <td className="p-2">TOTALE DA VERSARE (Giugno)</td>
                                                    <td className="p-2 text-right">{engineData.fiscal.installmentsProjection.totalDueJune.toFixed(2)}€</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-2 pl-6 italic text-gray-500">↳ Rata Mensile (x6 rate Giu-Nov)</td>
                                                    <td className="p-2 text-right font-mono font-bold text-indigo-600">
                                                        {engineData.fiscal.installmentsProjection.installmentAmount.toFixed(2)}€
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="p-2 font-medium text-gray-500 pt-4">II Acconto 2026 (50% - Novembre)</td>
                                                    <td className="p-2 text-right pt-4">{engineData.fiscal.installmentsProjection.acconto2_2026.toFixed(2)}€</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* CARD 2: LOGISTICA AVANZATA (TCO & SIMULATOR) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 md-card p-0 border-t-4 border-orange-500 shadow-md">
                                    <div className="p-4 bg-orange-50 border-b border-orange-100">
                                        <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                                            <span className="text-xl">🚗</span> Logistica & TCO Veicolo
                                        </h3>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                                <span className="text-sm text-gray-600">Km Totali (A/R)</span>
                                                <span className="font-bold">{engineData.logistics.totalKm.toFixed(0)} km</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                                <span className="text-sm text-gray-600">Costo Carburante</span>
                                                <span className="font-bold text-orange-600">{engineData.logistics.estimatedFuelCost.toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                                <span className="text-sm text-gray-600">Usura (Gomme/Olio)</span>
                                                <span className="font-bold text-gray-500">{engineData.logistics.estimatedWearCost.toFixed(2)}€</span>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                                <span className="text-sm text-gray-600">Assicurazione/Bollo</span>
                                                <span className="font-bold text-gray-500">{engineData.logistics.fixedCosts.toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                                <span className="text-sm text-gray-600 font-bold">Costo Totale Logistica</span>
                                                <span className="font-bold text-red-600">{engineData.logistics.totalLogisticsCost.toFixed(2)}€</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-2">
                                                Incidenza: <strong>{engineData.logistics.impactPerKm.toFixed(2)} €/km</strong>
                                            </div>
                                        </div>
                                        
                                        {/* Simulator Input */}
                                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Simulatore Costi</label>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs">Prezzo Carburante</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={simParams.fuelCost} 
                                                    onChange={e => setSimParams({...simParams, fuelCost: Number(e.target.value)})} 
                                                    className="w-16 p-1 text-right text-xs border rounded font-bold"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 text-center mt-2">Modifica il prezzo per aggiornare le stime.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* CARD 3: COSTI STRUTTURA & COMMERCIALISTA */}
                                <div className="md-card p-6 border-t-4 border-gray-500 shadow-md">
                                    <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <span className="text-xl">💼</span> Admin & Struttura
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">Costo Commercialista (Annuale)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" 
                                                    value={simParams.accountantCost} 
                                                    onChange={e => setSimParams({...simParams, accountantCost: Number(e.target.value)})} 
                                                    className="flex-1 border rounded p-2 text-right font-bold"
                                                />
                                                <span className="self-center font-bold">€</span>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-gray-100">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Affitti Sedi (Totale)</span>
                                                <span className="font-bold">{transactions.filter(t => t.category === TransactionCategory.Rent).reduce((a,b)=>a+b.amount,0).toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Software/Servizi</span>
                                                <span className="font-bold">{transactions.filter(t => t.category === TransactionCategory.Software).reduce((a,b)=>a+b.amount,0).toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CARD 4: AZIONI STRATEGICHE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md-card p-6 border-l-4 border-amber-500 bg-amber-50/50">
                                    <h3 className="text-lg font-bold text-amber-900 mb-3">⚡ Azioni Tattiche (Urgenti)</h3>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-center gap-2 text-red-700">
                                            ⚠️ <strong>Accantonamento:</strong> Metti da parte {engineData.fiscal.monthlySavingQuota.toFixed(0)}€ questo mese per le tasse.
                                        </li>
                                        {engineData.fiscal.limitProgress > 80 && (
                                            <li className="flex items-center gap-2 text-red-700 animate-pulse font-bold">
                                                🚨 <strong>ATTENZIONE LIMITE 85K:</strong> Sei all'{engineData.fiscal.limitProgress.toFixed(1)}% del limite.
                                            </li>
                                        )}
                                        {engineData.fiscal.totalFiscalBurden > 3000 && (
                                            <li className="flex items-center gap-2 text-orange-700">
                                                ⚠️ <strong>Acconti INPS:</strong> Verifica la disponibilità per la scadenza di Giugno/Novembre.
                                            </li>
                                        )}
                                        {engineData.netProfit < 0 && (
                                            <li className="flex items-center gap-2 text-red-700 font-bold">
                                                🚨 <strong>Cash Flow Negativo:</strong> Bloccare spese non essenziali.
                                            </li>
                                        )}
                                    </ul>
                                </div>
                                <div className="md-card p-6 border-l-4 border-blue-500 bg-blue-50/50">
                                    <h3 className="text-lg font-bold text-blue-900 mb-3">🔭 Azioni Strategiche</h3>
                                    <ul className="space-y-2 text-sm text-blue-800">
                                        <li>• <strong>Ottimizzazione:</strong> Rinegoziare nolo sedi se margine &lt; 20%.</li>
                                        <li>• <strong>Logistica:</strong> Ridurre km a vuoto per abbattere costo usura ({engineData.logistics.impactPerKm.toFixed(2)} €/km).</li>
                                        <li>• <strong>Target:</strong> Per guadagnare {simParams.targetNetMonthly}€ netti, punta a {engineData.ai.requiredMonthlyRevenue.toFixed(0)}€ di fatturato mensile.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ANALYTICS --- */}
                    {activeTab === 'analytics' && (
                        <div className="animate-fade-in space-y-6">
                            <p className="text-gray-500 text-sm mb-4">Analisi visuale avanzata dei flussi.</p>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="md-card p-4 h-80">
                                    <h3 className="text-sm font-bold text-gray-600 mb-2 text-center">Fatturato vs Spese (Mensile)</h3>
                                    <div className="h-64 w-full relative"><canvas ref={el => canvasRefs.current['bar'] = el}></canvas></div>
                                </div>
                                <div className="md-card p-4 h-80">
                                    <h3 className="text-sm font-bold text-gray-600 mb-2 text-center">Ripartizione Costi (Doughnut)</h3>
                                    <div className="h-64 w-full relative flex justify-center"><canvas ref={el => canvasRefs.current['doughnut'] = el}></canvas></div>
                                </div>
                                <div className="md-card p-4 h-80">
                                    <h3 className="text-sm font-bold text-gray-600 mb-2 text-center">Trend Cash Flow (Lineare)</h3>
                                    <div className="h-64 w-full relative"><canvas ref={el => canvasRefs.current['line'] = el}></canvas></div>
                                </div>
                                <div className="md-card p-4 h-80">
                                    <h3 className="text-sm font-bold text-gray-600 mb-2 text-center">Analisi Salute Aziendale (Radar)</h3>
                                    <div className="h-64 w-full relative flex justify-center"><canvas ref={el => canvasRefs.current['radar'] = el}></canvas></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- LISTS --- */}
                    {['transactions', 'invoices', 'quotes'].includes(activeTab) && (
                        <div className="animate-slide-up space-y-4">
                            
                            {/* Filters Bar */}
                            <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-2 items-center">
                                <div className="relative flex-1 min-w-[200px]">
                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                    <input type="text" placeholder="Cerca..." className="w-full pl-8 pr-2 py-1 text-sm border rounded" value={listFilters.search} onChange={e => setListFilters({...listFilters, search: e.target.value})} />
                                </div>
                                <input type="date" className="text-sm border rounded p-1" value={listFilters.dateFrom} onChange={e => setListFilters({...listFilters, dateFrom: e.target.value})} title="Da Data" />
                                <input type="date" className="text-sm border rounded p-1" value={listFilters.dateTo} onChange={e => setListFilters({...listFilters, dateTo: e.target.value})} title="A Data" />
                                <input type="number" placeholder="Min €" className="w-20 text-sm border rounded p-1" value={listFilters.minAmount} onChange={e => setListFilters({...listFilters, minAmount: e.target.value})} />
                                <input type="number" placeholder="Max €" className="w-20 text-sm border rounded p-1" value={listFilters.maxAmount} onChange={e => setListFilters({...listFilters, maxAmount: e.target.value})} />
                            </div>

                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-semibold">
                                        <tr>
                                            <th className="p-4 cursor-pointer hover:text-gray-700" onClick={() => handleSort('date')}>Data {listFilters.sortColumn === 'date' && (listFilters.sortDirection === 'asc' ? '▲' : '▼')}</th>
                                            <th className="p-4 cursor-pointer hover:text-gray-700" onClick={() => handleSort('description')}>Descrizione / Cliente</th>
                                            <th className="p-4 text-right cursor-pointer hover:text-gray-700" onClick={() => handleSort('amount')}>Importo {listFilters.sortColumn === 'amount' && (listFilters.sortDirection === 'asc' ? '▲' : '▼')}</th>
                                            <th className="p-4 text-center">Stato</th>
                                            <th className="p-4 text-right">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedList.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="p-4 text-gray-600 font-mono text-xs">{new Date(item.date || item.issueDate).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{item.description || item.clientName}</div>
                                                    {activeTab !== 'transactions' && <div className="text-xs text-gray-500">{item.invoiceNumber || item.quoteNumber}</div>}
                                                </td>
                                                <td className={`p-4 text-right font-bold ${item.type === TransactionType.Expense ? 'text-red-600' : 'text-green-600'}`}>
                                                    {item.type === TransactionType.Expense ? '-' : ''}{(item.amount || item.totalAmount).toFixed(2)}€
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.status === 'completed' || item.status === 'paid' ? 'bg-green-100 text-green-800' : item.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    {activeTab !== 'transactions' && <button onClick={() => handlePrintDocument(item)} className="text-gray-500 hover:text-indigo-600 p-1"><PrinterIcon /></button>}
                                                    <button onClick={() => { setEditingItem(item); if (activeTab === 'transactions') setIsTransModalOpen(true); else { setDocType(activeTab === 'invoices' ? 'invoice' : 'quote'); setIsDocModalOpen(true); } }} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><PencilIcon /></button>
                                                    <button onClick={() => { if (activeTab === 'transactions') handleDeleteTransaction(item.id); else { setDocType(activeTab === 'invoices' ? 'invoice' : 'quote'); handleDeleteDocument(item.id); } }} className="text-red-500 hover:bg-red-50 p-1 rounded"><TrashIcon /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination currentPage={currentPage} totalItems={filteredList.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                        </div>
                    )}
                </>
            )}

            {isTransModalOpen && <Modal onClose={() => setIsTransModalOpen(false)} size="lg"><TransactionForm transaction={editingItem} onSave={handleSaveTransaction} onCancel={() => setIsTransModalOpen(false)} /></Modal>}
            {isDocModalOpen && <Modal onClose={() => setIsDocModalOpen(false)} size="2xl"><DocumentForm docData={editingItem} type={docType} clients={clients} onSave={handleSaveDocument} onCancel={() => setIsDocModalOpen(false)} /></Modal>}
            <ConfirmModal isOpen={confirmState.isOpen} onClose={() => setConfirmState(p => ({...p, isOpen: false}))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} isDangerous={confirmState.isDangerous} />
            <ConfirmModal isOpen={isDeleteAllModalOpen} onClose={() => setIsDeleteAllModalOpen(false)} onConfirm={handleDeleteAll} title={`ELIMINA TUTTO (${activeTab.toUpperCase()})`} message="ATTENZIONE: Operazione irreversibile. Confermi?" isDangerous={true} confirmText="Elimina TUTTO" />
            
            <ConfirmModal 
                isOpen={isResetTransModalOpen.isOpen}
                onClose={() => setIsResetTransModalOpen({isOpen: false, type: null})}
                onConfirm={handleResetTransactions}
                title={`Elimina tutte le ${isResetTransModalOpen.type === TransactionType.Income ? 'ENTRATE' : 'USCITE'}`}
                message={`Sei sicuro di voler eliminare TUTTE le transazioni di tipo ${isResetTransModalOpen.type === TransactionType.Income ? 'ENTRATA' : 'USCITA'}? L'operazione è irreversibile.`}
                isDangerous={true}
                confirmText="Sì, Procedi"
            />
        </div>
    );
};

export default Finance;
