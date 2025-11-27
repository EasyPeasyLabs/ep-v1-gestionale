
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment, Invoice, Quote, InvoiceInput, QuoteInput, DocumentStatus, DocumentItem, Client, ClientType, Installment, Supplier, TransactionStatus, Location, EnrollmentStatus, CompanyInfo, SubscriptionType } from '../types';
import { getTransactions, addTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, restoreInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, updateQuoteStatus, deleteQuote, restoreQuote, permanentDeleteQuote, deleteTransactionByRelatedId, updateTransaction, calculateRentTransactions, batchAddTransactions } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo, getSubscriptionTypes } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import PencilIcon from '../components/icons/PencilIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import SearchIcon from '../components/icons/SearchIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type Tab = 'dashboard' | 'simulator' | 'controlling' | 'transactions' | 'invoices' | 'quotes';

interface FinanceProps {
    initialParams?: {
        tab?: Tab;
        invoiceStatus?: DocumentStatus;
        transactionStatus?: 'pending' | 'completed';
        searchTerm?: string; 
    };
}

// --- ICONS ---
const TrendingUpIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> </svg> );
const BankIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /> </svg> );

// --- COMPONENTS ---

const StatCard: React.FC<{ title: string; value: string; color: string; subtext?: string; onClick?: () => void }> = ({ title, value, color, subtext, onClick }) => (
  <div 
    className={`md-card p-4 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} 
    style={{borderColor: color}}
    onClick={onClick}
  >
    <h3 className="text-xs font-medium uppercase tracking-wide" style={{color: 'var(--md-text-secondary)'}}>{title}</h3>
    <p className="text-xl md:text-2xl font-bold mt-1 text-gray-800">{value}</p>
    {subtext && <p className="text-[10px] text-gray-500 mt-1 font-medium">{subtext}</p>}
  </div>
);

// --- MAIN COMPONENT ---
const Finance: React.FC<FinanceProps> = ({ initialParams }) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialParams?.tab || 'dashboard');
    
    // Simulator State
    const [targetNetProfit, setTargetNetProfit] = useState<number>(3000); // Obiettivo Netto Mensile
    const [taxRate, setTaxRate] = useState<number>(5); // 5% startup, 15% standard
    const [inpsRate, setInpsRate] = useState<number>(26.23); // Gestione Separata
    const [profitabilityCoeff, setProfitabilityCoeff] = useState<number>(78); // Coefficiente redditività

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    
    const monthlyChartRef = useRef<HTMLCanvasElement>(null);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transData, enrollData, invData, quoData] = await Promise.all([
                getTransactions(), getAllEnrollments(), getInvoices(), getQuotes()
            ]);
            setTransactions(transData); setEnrollments(enrollData); setInvoices(invData); setQuotes(quoData);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    // --- FINANCIAL CORE CALCULATIONS ---
    const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);
    
    const metrics = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let totalRevenueYTD = 0;
        let totalExpensesYTD = 0;
        let monthlyRevenue = new Array(12).fill(0);
        let monthlyExpenses = new Array(12).fill(0);

        activeTransactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getFullYear() === currentYear) {
                if (t.type === TransactionType.Income && t.category !== TransactionCategory.Capital) {
                    totalRevenueYTD += t.amount;
                    monthlyRevenue[d.getMonth()] += t.amount;
                } else if (t.type === TransactionType.Expense) {
                    totalExpensesYTD += t.amount;
                    monthlyExpenses[d.getMonth()] += t.amount;
                }
            }
        });

        // Proiezioni
        const avgMonthlyRevenue = totalRevenueYTD / (currentMonth + 1);
        const avgMonthlyExpenses = totalExpensesYTD / (currentMonth + 1);
        const projectedAnnualRevenue = avgMonthlyRevenue * 12;
        const projectedAnnualExpenses = avgMonthlyExpenses * 12;

        return { 
            totalRevenueYTD, totalExpensesYTD, 
            monthlyRevenue, monthlyExpenses,
            avgMonthlyRevenue, avgMonthlyExpenses,
            projectedAnnualRevenue, projectedAnnualExpenses
        };
    }, [activeTransactions]);

    // --- SIMULATOR LOGIC (CFO) ---
    const simulation = useMemo(() => {
        // Reverse calculation: Net Profit -> Gross Revenue needed
        // Net = Gross - Expenses - Taxes - INPS
        // Taxes = (Gross * Coeff) * TaxRate
        // INPS = (Gross * Coeff) * InpsRate
        // So: Net + Exp = Gross - (Gross * Coeff * TaxRate) - (Gross * Coeff * InpsRate)
        // Net + Exp = Gross * (1 - Coeff*TaxRate - Coeff*InpsRate)
        // Gross = (Net + Exp) / (1 - Coeff * (TaxRate + InpsRate))

        const monthlyExpenses = metrics.avgMonthlyExpenses;
        const targetNet = targetNetProfit;
        
        const totalTaxBurdenRate = (profitabilityCoeff / 100) * ((taxRate / 100) + (inpsRate / 100));
        const requiredGrossRevenue = (targetNet + monthlyExpenses) / (1 - totalTaxBurdenRate);
        
        const currentGap = requiredGrossRevenue - metrics.avgMonthlyRevenue;
        
        // Action Items
        const avgPackagePrice = 350; // Prezzo medio pacchetto
        const newStudentsNeeded = currentGap > 0 ? Math.ceil(currentGap / (avgPackagePrice / 4)) : 0; // Diviso 4 mesi durata media? Semplifichiamo: studenti nuovi al mese
        
        return { requiredGrossRevenue, currentGap, newStudentsNeeded, totalTaxBurdenRate };
    }, [targetNetProfit, metrics, taxRate, inpsRate, profitabilityCoeff]);


    // --- CHART EFFECT ---
    useEffect(() => {
        if (activeTab === 'dashboard' && monthlyChartRef.current) {
            const ctx = monthlyChartRef.current.getContext('2d');
            if (ctx) {
                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                        datasets: [
                            { label: 'Entrate', data: metrics.monthlyRevenue, backgroundColor: '#4ade80', borderRadius: 4 },
                            { label: 'Uscite', data: metrics.monthlyExpenses, backgroundColor: '#f87171', borderRadius: 4 }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { display: false } } }
                });
                return () => chart.destroy();
            }
        }
    }, [activeTab, metrics]);

    return (
        <div className="pb-24">
            <h1 className="text-3xl font-bold mb-2">Finanza</h1>
            <p className="text-gray-500 mb-6">CFO Dashboard, Simulator & Controlling.</p>

            {/* Mobile Tab Nav */}
            <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide">
                {[
                    {id: 'dashboard', label: 'Dashboard'},
                    {id: 'simulator', label: 'CFO Simulator'},
                    {id: 'controlling', label: 'Tasse & INPS'},
                    {id: 'transactions', label: 'Transazioni'},
                    {id: 'invoices', label: 'Fatture'},
                    {id: 'quotes', label: 'Preventivi'}
                ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setActiveTab(t.id as Tab)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {/* === DASHBOARD === */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard 
                                title="Fatturato YTD" 
                                value={metrics.totalRevenueYTD.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} 
                                color="#4ade80" 
                                subtext={`Proiezione: ${metrics.projectedAnnualRevenue.toLocaleString()}€`}
                            />
                            <StatCard 
                                title="Spese YTD" 
                                value={metrics.totalExpensesYTD.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} 
                                color="#f87171" 
                            />
                            <StatCard 
                                title="Utile Lordo" 
                                value={(metrics.totalRevenueYTD - metrics.totalExpensesYTD).toLocaleString('it-IT', {style:'currency', currency:'EUR'})} 
                                color="#6366f1" 
                            />
                            <StatCard 
                                title="Margine" 
                                value={`${metrics.totalRevenueYTD > 0 ? ((metrics.totalRevenueYTD - metrics.totalExpensesYTD)/metrics.totalRevenueYTD * 100).toFixed(1) : 0}%`} 
                                color="#f59e0b" 
                            />
                        </div>
                        <div className="md-card p-4 h-64">
                            <canvas ref={monthlyChartRef} />
                        </div>
                    </div>
                )}

                {/* === SIMULATOR (CFO) === */}
                {activeTab === 'simulator' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="md-card p-6 bg-gradient-to-br from-slate-800 to-indigo-900 text-white shadow-xl">
                            <div className="flex items-center gap-2 mb-6">
                                <SparklesIcon />
                                <h2 className="text-2xl font-bold">Simulatore Obiettivi CFO</h2>
                            </div>

                            <div className="mb-8">
                                <label className="block text-indigo-200 text-sm font-bold mb-2">
                                    Obiettivo Guadagno Netto Mensile (Pulito in tasca)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" min="1000" max="10000" step="100" 
                                        value={targetNetProfit} 
                                        onChange={e => setTargetNetProfit(Number(e.target.value))}
                                        className="w-full h-2 bg-indigo-500 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-3xl font-bold font-mono text-white min-w-[120px]">
                                        {targetNetProfit.toLocaleString()}€
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-2">Analisi Gap</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Fatturato Mensile Attuale:</span>
                                            <span className="font-mono">{metrics.avgMonthlyRevenue.toLocaleString()}€</span>
                                        </div>
                                        <div className="flex justify-between text-yellow-300 font-bold">
                                            <span>Fatturato Necessario:</span>
                                            <span className="font-mono">{simulation.requiredGrossRevenue.toLocaleString('it-IT', {maximumFractionDigits:0})}€</span>
                                        </div>
                                        <div className="h-px bg-white/20 my-2"></div>
                                        <div className="flex justify-between text-red-300">
                                            <span>GAP Mensile:</span>
                                            <span className="font-mono">{simulation.currentGap > 0 ? `-${simulation.currentGap.toLocaleString('it-IT', {maximumFractionDigits:0})}€` : 'Obiettivo Raggiunto!'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-green-300 uppercase tracking-wider mb-2">Azioni Richieste</h3>
                                    {simulation.currentGap > 0 ? (
                                        <ul className="space-y-2 text-sm">
                                            <li className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs">1</span>
                                                <span>Trovare <strong>{simulation.newStudentsNeeded}</strong> nuovi studenti questo mese.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs">2</span>
                                                <span>Alzare i prezzi del <strong>{((simulation.currentGap / metrics.avgMonthlyRevenue)*100).toFixed(1)}%</strong>.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs">3</span>
                                                <span>Ridurre i costi operativi di <strong>{(simulation.currentGap * 0.5).toFixed(0)}€</strong>.</span>
                                            </li>
                                        </ul>
                                    ) : (
                                        <div className="text-center py-4 text-green-300 font-bold text-lg">
                                            Complimenti! Sei in target. 🚀
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === CONTROLLING (TASSE) === */}
                {activeTab === 'controlling' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <BankIcon /> Controlling Fiscale (Forfettario)
                            </h2>
                            
                            {/* Parametri Configurabili */}
                            <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                                <div>
                                    <label className="block text-gray-500 mb-1">Coeff. Redditività %</label>
                                    <input type="number" value={profitabilityCoeff} onChange={e => setProfitabilityCoeff(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-indigo-600" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 mb-1">Imposta Sostitutiva %</label>
                                    <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-indigo-600" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 mb-1">Aliquota INPS %</label>
                                    <input type="number" value={inpsRate} onChange={e => setInpsRate(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-indigo-600" />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="p-3">Voce</th>
                                            <th className="p-3 text-right">Attuale (YTD)</th>
                                            <th className="p-3 text-right">Proiezione (Anno)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td className="p-3 font-medium">Fatturato Lordo</td>
                                            <td className="p-3 text-right font-bold">{metrics.totalRevenueYTD.toLocaleString()}€</td>
                                            <td className="p-3 text-right font-bold text-indigo-600">{metrics.projectedAnnualRevenue.toLocaleString()}€</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 text-gray-600">Imponibile ({profitabilityCoeff}%)</td>
                                            <td className="p-3 text-right text-gray-600">{(metrics.totalRevenueYTD * profitabilityCoeff/100).toLocaleString()}€</td>
                                            <td className="p-3 text-right text-gray-600">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100).toLocaleString()}€</td>
                                        </tr>
                                        <tr className="bg-red-50">
                                            <td className="p-3 font-medium text-red-800">Imposta Sostitutiva ({taxRate}%)</td>
                                            <td className="p-3 text-right text-red-800">{(metrics.totalRevenueYTD * profitabilityCoeff/100 * taxRate/100).toLocaleString()}€</td>
                                            <td className="p-3 text-right text-red-800 font-bold">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100 * taxRate/100).toLocaleString()}€</td>
                                        </tr>
                                        <tr className="bg-orange-50">
                                            <td className="p-3 font-medium text-orange-800">INPS ({inpsRate}%)</td>
                                            <td className="p-3 text-right text-orange-800">{(metrics.totalRevenueYTD * profitabilityCoeff/100 * inpsRate/100).toLocaleString()}€</td>
                                            <td className="p-3 text-right text-orange-800 font-bold">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100 * inpsRate/100).toLocaleString()}€</td>
                                        </tr>
                                        <tr className="bg-green-50 border-t-2 border-green-200">
                                            <td className="p-3 font-bold text-green-900">NETTO REALE STIMATO</td>
                                            <td className="p-3 text-right font-bold text-green-900">
                                                {(metrics.totalRevenueYTD - (metrics.totalRevenueYTD * profitabilityCoeff/100 * (taxRate+inpsRate)/100)).toLocaleString()}€
                                            </td>
                                            <td className="p-3 text-right font-bold text-green-900 text-lg">
                                                {(metrics.projectedAnnualRevenue - (metrics.projectedAnnualRevenue * profitabilityCoeff/100 * (taxRate+inpsRate)/100)).toLocaleString()}€
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-400 mt-4 italic">
                                * Simulazione basata sul regime forfettario. I costi deducibili non influenzano l'imponibile, solo il coefficiente di redditività.
                            </p>
                        </div>
                    </div>
                )}

                {/* === LISTE (TRANSAZIONI / FATTURE / PREVENTIVI) === */}
                {(activeTab === 'transactions' || activeTab === 'invoices' || activeTab === 'quotes') && (
                    <div className="animate-slide-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
                            <button className="md-btn md-btn-raised md-btn-primary md-btn-sm flex items-center">
                                <PlusIcon /><span className="ml-2">Nuova</span>
                            </button>
                        </div>
                        
                        <div className="md-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="p-3">Data</th>
                                            <th className="p-3">Descrizione</th>
                                            <th className="p-3 text-right">Importo</th>
                                            <th className="p-3 text-center">Stato</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {activeTab === 'transactions' && transactions.slice(0, 10).map(t => (
                                            <tr key={t.id}>
                                                <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="p-3 font-medium">{t.description}</td>
                                                <td className={`p-3 text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type === 'income' ? '+' : '-'}{t.amount}€
                                                </td>
                                                <td className="p-3 text-center"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{t.status}</span></td>
                                            </tr>
                                        ))}
                                        {activeTab === 'invoices' && invoices.slice(0, 10).map(i => (
                                            <tr key={i.id}>
                                                <td className="p-3">{new Date(i.issueDate).toLocaleDateString()}</td>
                                                <td className="p-3 font-medium">{i.invoiceNumber} - {i.clientName}</td>
                                                <td className="p-3 text-right font-bold">{i.totalAmount}€</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs ${i.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {i.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {activeTab === 'quotes' && quotes.slice(0, 10).map(q => (
                                            <tr key={q.id}>
                                                <td className="p-3">{new Date(q.issueDate).toLocaleDateString()}</td>
                                                <td className="p-3 font-medium">{q.quoteNumber} - {q.clientName}</td>
                                                <td className="p-3 text-right font-bold">{q.totalAmount}€</td>
                                                <td className="p-3 text-center">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{q.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 text-center text-xs text-gray-400 bg-gray-50">
                                Mostrati gli ultimi 10 elementi. Usa la ricerca per trovarne altri.
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default Finance;
