
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput, Lesson, IntegrityIssue, Enrollment, PaymentMethod, TransactionStatus, IntegrityIssueSuggestion, ClientType, EnrollmentStatus, InvoiceGap, RentAnalysisResult, SubscriptionType } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, analyzeRentExpenses, createRentTransactionsBatch, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice, reconcileTransactions, runFinancialHealthCheck, fixIntegrityIssue, getInvoiceNumberGaps, isInvoiceNumberTaken } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo, getSubscriptionTypes, updateCompanyInfo } from '../services/settingsService';
import { getClients } from '../services/parentService';
import { getLessons } from '../services/calendarService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import RefreshIcon from '../components/icons/RestoreIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CheckIcon from '../components/icons/CheckIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import TransactionForm from '../components/finance/TransactionForm';
import InvoiceEditForm from '../components/finance/InvoiceEditForm';
import QuoteForm from '../components/finance/QuoteForm';
import FinanceOverview from '../components/finance/FinanceOverview';
import FinanceCFO from '../components/finance/FinanceCFO';
import FinanceControlling from '../components/finance/FinanceControlling';
import FinanceListView from '../components/finance/FinanceListView';
import FiscalYearManager from '../components/finance/FiscalYearManager'; 
import LocationDetailModal from '../components/finance/LocationDetailModal';
import InstitutionalWizard from '../components/finance/InstitutionalWizard';
import { getAllEnrollments } from '../services/enrollmentService';

// COSTANTI FISCALI AGGIORNATE 2025/26
const INPS_RATE = 0.2623; // Gestione Separata
const TAX_RATE_STARTUP = 0.05; // 5% per primi 5 anni
const COEFF_REDDITIVITA = 0.78; // Attività professionali
const LIMIT_FORFETTARIO = 85000;

interface FinanceProps {
    initialParams?: {
        tab?: 'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure';
        searchTerm?: string;
    };
    onNavigate?: (page: Page, params?: any) => void;
}

// Separate component to handle the async analysis logic cleanly
const RentSyncModal: React.FC<{
    onClose: () => void;
    onComplete: () => void;
    enrollments: Enrollment[]; // Pass Enrollments down
}> = ({ onClose, onComplete, enrollments }) => {
    const now = new Date();
    const [step, setStep] = useState<'select' | 'preview'>('select');
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [loading, setLoading] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<RentAnalysisResult[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const years = useMemo(() => {
        const list = [];
        for (let y = now.getFullYear(); y >= 2025; y--) list.push(y);
        return list;
    }, [now]);

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            // Updated call: Passing enrollments to avoid circular dependency
            const results = await analyzeRentExpenses(month, year, enrollments);
            setAnalysisResults(results);
            setSelectedIds(results.filter(r => !r.isPaid).map(r => r.locationId));
            setStep('preview');
        } catch (e) {
            alert("Errore analisi: " + e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        const unpaidIds = analysisResults.filter(r => !r.isPaid).map(r => r.locationId);
        const allSelected = unpaidIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(unpaidIds);
        }
    };

    const handleConfirmPayment = async () => {
        const toPay = analysisResults.filter(r => !r.isPaid && selectedIds.includes(r.locationId));
        if (toPay.length === 0) return onClose();
        
        setLoading(true);
        try {
            const endOfMonth = new Date(year, month + 1, 0).toISOString();
            const monthLabel = `${months[month]} ${year}`;
            await createRentTransactionsBatch(toPay, endOfMonth, monthLabel);
            alert(`Registrati ${toPay.length} pagamenti con successo.`);
            onComplete();
            onClose();
        } catch (e) {
            alert("Errore salvataggio: " + e);
        } finally {
            setLoading(false);
        }
    };

    const totalSelectedCost = analysisResults
        .filter(r => selectedIds.includes(r.locationId))
        .reduce((sum, r) => sum + r.totalCost, 0);

    const unpaidCount = analysisResults.filter(r => !r.isPaid).length;
    const allUnpaidSelected = unpaidCount > 0 && selectedIds.length === unpaidCount;

    return (
        <div className="flex flex-col h-[80vh]">
            <div className="p-6 border-b bg-indigo-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-indigo-900">Sincronizzazione Noli (Pay-per-Use)</h3>
                <p className="text-sm text-indigo-700">Calcola i costi di affitto basati sull'utilizzo reale degli spazi.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {step === 'select' ? (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-600">Seleziona il periodo di competenza. Il sistema analizzerà le presenze e le lezioni manuali per calcolare il dovuto.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mese</label><select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full md-input bg-gray-50">{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select></div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Anno</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full md-input bg-gray-50">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {analysisResults.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 italic">Nessun utilizzo rilevato in questo periodo.</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                                        <tr>
                                            <th className="p-3 w-10 text-center">
                                                {unpaidCount > 0 && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={allUnpaidSelected} 
                                                        onChange={toggleSelectAll}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                )}
                                            </th>
                                            <th className="p-3">Sede</th>
                                            <th className="p-3 text-center">Eventi</th>
                                            <th className="p-3 text-right">Costo Unit.</th>
                                            <th className="p-3 text-right">Totale</th>
                                            <th className="p-3 text-center">Stato</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {analysisResults.map((res, i) => (
                                            <tr key={i} className={res.isPaid ? "bg-green-50 opacity-60" : "bg-white hover:bg-gray-50"}>
                                                <td className="p-3 text-center">
                                                    {!res.isPaid && (
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedIds.includes(res.locationId)} 
                                                            onChange={() => toggleSelect(res.locationId)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-3 font-medium text-gray-800">
                                                    {res.locationName} <span className="text-xs text-gray-400 block">{res.supplierName}</span>
                                                </td>
                                                <td className="p-3 text-center font-bold">{res.usageCount}</td>
                                                <td className="p-3 text-right text-gray-500">{res.unitCost.toFixed(2)}€</td>
                                                <td className="p-3 text-right font-black text-indigo-700">{res.totalCost.toFixed(2)}€</td>
                                                <td className="p-3 text-center">
                                                    {res.isPaid ? (
                                                        <span className="text-[10px] bg-green-200 text-green-800 px-2 py-1 rounded font-bold uppercase">Pagato</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold uppercase">Da Pagare</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="text-right text-xs text-gray-500 mt-2">
                            Totale selezionato: <strong className="text-indigo-700 text-base">{totalSelectedCost.toFixed(2)}€</strong>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                {step === 'preview' && <button onClick={() => setStep('select')} className="md-btn md-btn-flat">Indietro</button>}
                <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                {step === 'select' ? (
                    <button onClick={handleAnalyze} disabled={loading} className="md-btn md-btn-raised md-btn-primary px-8">{loading ? <Spinner /> : 'Analizza Utilizzi'}</button>
                ) : (
                    <button onClick={handleConfirmPayment} disabled={loading || selectedIds.length === 0} className="md-btn md-btn-raised md-btn-green px-8">
                        {loading ? <Spinner /> : `Registra (${selectedIds.length}) Pagamenti`}
                    </button>
                )}
            </div>
        </div>
    );
};

// ... [FixWizard Component - No changes here, kept for brevity] ...
const FixWizard: React.FC<{
    issues: IntegrityIssue[];
    onFix: (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', manualNum?: string, targetInvoiceIds?: string[], adjustment?: { amount: number, notes: string }, targetTransactionId?: string, forceDate?: string) => Promise<void>;
    onClose: () => void;
}> = ({ issues, onFix, onClose }) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [strategy, setStrategy] = useState<'invoice' | 'cash' | 'link' | null>(null);
    const [date, setDate] = useState('');
    
    const activeIssue = selectedIndex !== null ? issues[selectedIndex] : null;

    useEffect(() => {
        if (activeIssue) {
            setStrategy(null);
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [activeIssue]);

    const handleResolve = async (strat: 'invoice' | 'cash' | 'link') => {
        if (!activeIssue) return;
        setLoading(true);
        try {
            await onFix(activeIssue, strat, undefined, undefined, undefined, undefined, date);
            setSelectedIndex(null);
        } catch (e) {
            alert("Errore durante la risoluzione: " + e);
        } finally {
            setLoading(false);
        }
    };

    if (issues.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <CheckIcon className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Tutto in ordine!</h2>
                <p className="text-gray-500 mb-8">Il Fiscal Doctor non ha rilevato anomalie nei dati.</p>
                <button onClick={onClose} className="md-btn md-btn-primary md-btn-raised px-8 py-3">Chiudi</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[80vh] md:h-[70vh]">
            {/* Header */}
            <div className="p-6 border-b bg-slate-800 text-white flex-shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl">
                        <SparklesIcon className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Fiscal Doctor</h3>
                        <p className="text-slate-300 text-sm">{issues.length} anomalie rilevate da sanare.</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <span className="text-2xl">&times;</span>
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* LISTA LATERALE */}
                <div className={`w-full md:w-1/3 border-r bg-gray-50 overflow-y-auto ${activeIssue ? 'hidden md:block' : 'block'}`}>
                    {issues.map((issue, idx) => (
                        <div 
                            key={issue.id} 
                            onClick={() => setSelectedIndex(idx)}
                            className={`p-4 border-b cursor-pointer transition-all ${selectedIndex === idx ? 'bg-white border-l-4 border-l-indigo-500 shadow-md z-10 relative' : 'border-l-4 border-l-transparent hover:bg-gray-100'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded tracking-wider ${
                                    issue.type === 'missing_invoice' ? 'bg-orange-100 text-orange-700' : 
                                    issue.type === 'missing_transaction' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {issue.type === 'missing_invoice' ? 'Manca Fattura' : issue.type === 'missing_transaction' ? 'Manca Incasso' : 'Discrepanza'}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">{new Date(issue.date).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-bold text-gray-800 text-sm mb-1">{issue.entityName}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{issue.description}</p>
                            {issue.amount && <div className="text-right"><span className="font-mono text-sm font-black text-slate-700">{issue.amount.toFixed(2)}€</span></div>}
                        </div>
                    ))}
                </div>

                {/* DETTAGLIO */}
                <div className={`w-full md:w-2/3 bg-white p-6 md:p-8 overflow-y-auto ${!activeIssue ? 'hidden md:flex md:items-center md:justify-center' : 'block'}`}>
                    {!activeIssue ? (
                        <div className="text-center text-gray-400 max-w-xs">
                            <ExclamationIcon className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                            <p>Seleziona un'anomalia dalla lista per visualizzare le opzioni di risoluzione guidata.</p>
                        </div>
                    ) : (
                        <div className="max-w-xl mx-auto w-full animate-fade-in">
                            <button onClick={() => setSelectedIndex(null)} className="md:hidden mb-6 text-sm text-indigo-600 font-bold flex items-center gap-1">
                                <span>&larr;</span> Torna alla lista
                            </button>
                            
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Risoluzione Anomalia</h2>
                            
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-8 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Dettagli Problema</h4>
                                <p className="font-medium text-slate-800 text-lg mb-4">{activeIssue.description}</p>
                                <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-200 pt-4">
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Entità Coinvolta</span>
                                        <span className="font-bold text-slate-900">{activeIssue.entityName}</span>
                                    </div>
                                    {activeIssue.amount && (
                                        <div className="text-right">
                                            <span className="block text-xs text-slate-500 mb-1">Valore Stimato</span>
                                            <span className="font-mono font-black text-indigo-600 text-lg">{activeIssue.amount.toFixed(2)}€</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">1</span>
                                    Scegli Azione Correttiva
                                </h3>
                                
                                {activeIssue.type === 'missing_invoice' && (
                                    <div className="space-y-3">
                                        <div 
                                            className={`p-4 border rounded-xl transition-all cursor-pointer group ${strategy === 'invoice' ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'hover:border-indigo-300 hover:bg-gray-50'}`}
                                            onClick={() => setStrategy('invoice')}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${strategy === 'invoice' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                                    {strategy === 'invoice' && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <span className={`font-bold ${strategy === 'invoice' ? 'text-indigo-900' : 'text-gray-700'}`}>Genera Fattura Mancante</span>
                                            </div>
                                            <p className="text-sm text-gray-500 ml-8">Il sistema genererà automaticamente una fattura bozza precompilata.</p>
                                            
                                            {strategy === 'invoice' && (
                                                <div className="ml-8 mt-4 pt-4 border-t border-indigo-100 animate-fade-in">
                                                    <label className="block text-xs font-bold text-indigo-800 mb-1">Data Emissione</label>
                                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input w-full mb-3" />
                                                    <button onClick={() => handleResolve('invoice')} disabled={loading} className="md-btn md-btn-primary w-full shadow-lg">
                                                        {loading ? <Spinner /> : 'Conferma e Genera Fattura'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeIssue.type === 'missing_transaction' && (
                                    <div className="space-y-3">
                                        <div 
                                            className={`p-4 border rounded-xl transition-all cursor-pointer group ${strategy === 'cash' ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'hover:border-green-300 hover:bg-gray-50'}`}
                                            onClick={() => setStrategy('cash')}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${strategy === 'cash' ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
                                                    {strategy === 'cash' && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <span className={`font-bold ${strategy === 'cash' ? 'text-green-900' : 'text-gray-700'}`}>Registra Incasso</span>
                                            </div>
                                            <p className="text-sm text-gray-500 ml-8">Registra il movimento di cassa/banca mancante per saldare il documento.</p>
                                            
                                            {strategy === 'cash' && (
                                                <div className="ml-8 mt-4 pt-4 border-t border-green-100 animate-fade-in">
                                                    <label className="block text-xs font-bold text-green-800 mb-1">Data Incasso</label>
                                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input w-full mb-3" />
                                                    <button onClick={() => handleResolve('cash')} disabled={loading} className="md-btn md-btn-green w-full shadow-lg">
                                                        {loading ? <Spinner /> : 'Conferma Incasso'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeIssue.type === 'amount_mismatch' && (
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                                        <p className="font-bold flex items-center gap-2"><ExclamationIcon className="w-4 h-4" /> Attenzione</p>
                                        <p className="mt-1">Per le discrepanze di importo, si consiglia di verificare manualmente la fattura o la transazione e correggerla dall'elenco principale.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const TAB_LABELS = {
    overview: 'Panoramica',
    cfo: 'Cantiere CFO',
    controlling: 'Analisi ROI Sedi',
    transactions: 'Registro Cassa',
    invoices: 'Fatturazione',
    archive: 'Archivio SDI',
    quotes: 'Preventivi & Enti',
    fiscal_closure: 'Chiusura Fiscale'
};

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure'>('overview');
    const [overviewYear, setOverviewYear] = useState<number>(new Date().getFullYear());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [manualLessons, setManualLessons] = useState<Lesson[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
    const [controllingYear, setControllingYear] = useState<number>(Math.max(2025, new Date().getFullYear()));
    const [controllingMonth, setControllingMonth] = useState<string>('all'); // 'all' or '0'-'11'
    const [filters, setFilters] = useState({ search: '' });
    const [selectedLocationROI, setSelectedLocationROI] = useState<any | null>(null);
    const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
    const [isFixWizardOpen, setIsFixWizardOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
    const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);
    const [quoteToActivate, setQuoteToActivate] = useState<Quote | null>(null);

    // End of Month Check for Alert
    const isLateMonth = new Date().getDate() > 27;
    
    const isRentPaidForThisMonth = useMemo(() => {
        const now = new Date();
        return transactions.some(t => 
            !t.isDeleted &&
            t.category === TransactionCategory.Nolo &&
            t.relatedDocumentId?.startsWith('AUTO-RENT') &&
            new Date(t.date).getMonth() === now.getMonth() &&
            new Date(t.date).getFullYear() === now.getFullYear()
        );
    }, [transactions]);

    const showRentAlert = isLateMonth && !isRentPaidForThisMonth;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // First fetch data that doesn't depend on analysis
            const [t, i, q, e, s, c, ml, info, subs] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getLessons(), getCompanyInfo(), getSubscriptionTypes()
            ]);
            setTransactions(t || []); setInvoices(i || []); setQuotes(q || []); setEnrollments(e || []); setSuppliers(s || []); setClients(c || []); setManualLessons(ml || []); setCompanyInfo(info || null); setSubscriptionTypes(subs || []);
            
            // Then run health check passing the data directly
            const issues = await runFinancialHealthCheck(e || [], i || [], t || [], c || []);
            setIntegrityIssues(issues || []);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchData();
        if (initialParams?.tab) setActiveTab(initialParams.tab);
        if (initialParams?.searchTerm) setFilters(f => ({ ...f, search: initialParams.searchTerm || '' }));
        window.addEventListener('EP_DataUpdated', fetchData);
        return () => window.removeEventListener('EP_DataUpdated', fetchData);
    }, [fetchData, initialParams]);

    // HANDLER PER AGGIORNAMENTO SALDO BANCA
    const handleUpdateBankBalance = async (val: number) => {
        if (!companyInfo) return;
        const newInfo = { ...companyInfo, currentBankBalance: val };
        setCompanyInfo(newInfo); // Optimistic UI update
        await updateCompanyInfo(newInfo);
    };

    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted && new Date(t.date).getFullYear() === overviewYear);
        
        // 1. INCASSATO (Cassa) - Exclude Capital
        const cashRevenue = activeT
            .filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale)
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
            
        // Cash Expenses
        const cashExpenses = activeT
            .filter(t => t.type === TransactionType.Expense)
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        // 2. FATTURATO (Competenza/Fiscale) - Real Invoices Only
        const yearInvoices = invoices.filter(inv => 
            !inv.isDeleted && 
            !inv.isGhost && 
            new Date(inv.issueDate).getFullYear() === overviewYear
        );
        
        const invoicedRevenue = yearInvoices.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);

        // Profit (Cash based for internal view)
        const cashProfit = cashRevenue - cashExpenses;
        const cashMargin = cashRevenue > 0 ? (cashProfit / cashRevenue) * 100 : 0;
        
        // --- CALCOLO FISCALE (Basato su FATTURATO come richiesto) ---
        
        // 1. IMPONIBILE LORDO (su Fatturato)
        const taxable = invoicedRevenue * COEFF_REDDITIVITA;
        
        // 2. INPS
        const inps = taxable * INPS_RATE;
        
        // 3. IMPONIBILE NETTO
        const taxableNet = taxable - inps;
        
        // 4. IMPOSTA
        const tax = taxableNet * TAX_RATE_STARTUP;
        
        // 5. LIABILTY
        const totalLiability = inps + tax;

        // 6. BOLLI
        let stampDutyTotal = 0;
        yearInvoices.forEach(inv => { if ((Number(inv.totalAmount) || 0) > 77.47) stampDutyTotal += 2; });
        
        const totalAll = totalLiability + stampDutyTotal;

        return { 
            cashRevenue, // Was 'revenue'
            invoicedRevenue, // New
            revenue: cashRevenue, // Keep for backward compatibility with components expecting 'revenue'
            expenses: cashExpenses, 
            profit: cashProfit, 
            margin: cashMargin, 
            taxable, 
            taxableNet, 
            inps, 
            tax, 
            stampDutyTotal, 
            totalLiability, // New Proper Name
            totalInpsTax: totalLiability, // Alias for legacy
            totalAll, 
            savingsSuggestion: totalAll, 
            progress: (invoicedRevenue / LIMIT_FORFETTARIO) * 100, // Limit is on Invoiced
            monthlyData: Array(12).fill(0).map((_, i) => ({ 
                month: i, 
                cash: activeT.filter(t => new Date(t.date).getMonth() === i && t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).reduce((a,c) => a + (Number(c.amount) || 0), 0),
                invoiced: invoices.filter(inv => !inv.isDeleted && !inv.isGhost && new Date(inv.issueDate).getFullYear() === overviewYear && new Date(inv.issueDate).getMonth() === i).reduce((a,c) => a + (Number(c.totalAmount) || 0), 0),
                revenue: activeT.filter(t => new Date(t.date).getMonth() === i && t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).reduce((a,c) => a + (Number(c.amount) || 0), 0), // Legacy alias for 'cash'
                expenses: activeT.filter(t => new Date(t.date).getMonth() === i && t.type === TransactionType.Expense).reduce((a,c) => a + (Number(c.amount) || 0), 0) 
            })) 
        };
    }, [transactions, invoices, overviewYear]);

    // Calculate Simulator Data for CFO (TRANCHE & SAVINGS)
    const simulatorData = useMemo(() => {
        // Logica "Start-up / Storico"
        // Le tasse dell'anno N si pagano nell'anno N+1.
        // Giugno N+1: Saldo Anno N + I Acconto Anno N+1 (50% del storico)
        // Novembre N+1: II Acconto Anno N+1 (50% del storico)
        
        const montante = stats.totalLiability || 0; // INPS + Imposta (esclusi bolli che sono costi diretti)
        
        // I Tranche (Giugno): Saldo (100% Montante) + I Acconto (50% Montante) = 150%
        const tranche1 = montante * 1.5;
        
        // II Tranche (Novembre): II Acconto (50% Montante)
        const tranche2 = montante * 0.5;

        // Totale fabbisogno per l'anno prossimo (Saldo N + Acconti N+1)
        const totalTarget = tranche1 + tranche2;
        
        // Piano Mensile
        const monthsLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        const monthlySavings = totalTarget / 12;

        const savingsPlan = monthsLabels.map(m => ({ 
            month: m, 
            amount: monthlySavings,
            // Per UI: breakdown opzionale
            competence: montante / 12, // Quota saldo
            advance: montante / 12     // Quota acconto (totale acconti è 100% montante)
        }));

        return { savingsPlan, tranche1, tranche2, totalTarget };
    }, [stats]);

    // Reverse Engineering Logic (UPDATED 2026)
    const reverseEngineering = useMemo(() => {
        // 1. Dati Input
        const desiredAnnualNet = targetMonthlyNet * 12;
        const currentExpenses = stats.expenses;

        // 2. Calcolo Coefficiente Fiscale Sintetico (Tax Factor)
        const taxImpactFactor = (COEFF_REDDITIVITA * INPS_RATE) + ((COEFF_REDDITIVITA * (1 - INPS_RATE)) * TAX_RATE_STARTUP);
        
        // 3. Calcolo Fatturato Lordo Necessario
        const grossRevenueNeeded = (desiredAnnualNet + currentExpenses) / (1 - taxImpactFactor);
        const gap = Math.max(0, grossRevenueNeeded - stats.revenue); // Use Cash or Invoiced? Strategy usually targets cash flow needed.
        
        // 4. Analisi KPI Attuali
        const activeEnrollments = enrollments.filter(e => e.status === EnrollmentStatus.Active);
        
        let activeLessonsCount = 0;
        let activeRevenueSum = 0;
        
        activeEnrollments.forEach(e => {
            if (e.lessonsTotal > 0 && e.price > 0) {
                activeLessonsCount += e.lessonsTotal;
                activeRevenueSum += Number(e.price);
            }
        });

        // ARPU (Average Revenue Per User)
        const activeStudentsCount = activeEnrollments.length;
        const avgRevenuePerStudent = activeStudentsCount > 0 ? activeRevenueSum / activeStudentsCount : 0;

        // Average Price Per Lesson (Real)
        const currentAvgPrice = activeLessonsCount > 0 ? activeRevenueSum / activeLessonsCount : 0;

        // 5. Target Allievi (Reverse)
        // Quanti allievi servono IN TOTALE per fare il fatturato target, mantenendo l'ARPU attuale?
        const studentsNeededTotal = avgRevenuePerStudent > 0 ? Math.ceil(grossRevenueNeeded / avgRevenuePerStudent) : 0;
        
        // Quanti ne mancano?
        const studentsGap = Math.max(0, studentsNeededTotal - activeStudentsCount);

        // 6. Prezzo Consigliato (Markup Strategy)
        // Se volessi raggiungere il target con gli STESSI allievi e le STESSE lezioni, quanto dovrei far pagare a lezione?
        const recommendedPrice = activeLessonsCount > 0 ? grossRevenueNeeded / activeLessonsCount : 0;

        // 7. Best Performer Subscription
        let bestSubscription = null;
        let maxRoi = 0;
        
        subscriptionTypes.forEach(sub => {
            if (sub.statusConfig?.status === 'active' || sub.statusConfig?.status === 'promo') {
                const ratio = sub.lessons > 0 ? sub.price / sub.lessons : 0;
                if (ratio > maxRoi) {
                    maxRoi = ratio;
                    bestSubscription = { name: sub.name, roi: ratio };
                }
            }
        });

        // 8. Stipendio Netto Attuale (Reverse del punto 3)
        // Netto = (Fatturato - Spese) * (1 - TaxFactor)
        // Nota: Questo è un calcolo semplificato che assume che tutto il profitto sia prelevabile come netto
        const currentNetSalary = (stats.revenue - currentExpenses) * (1 - taxImpactFactor) / 12;

        // Advice Text
        let advice = "Sei sulla buona strada.";
        if (gap > 0) {
            advice = `Per raggiungere ${targetMonthlyNet}€ netti, ti mancano ${Math.round(gap).toLocaleString()}€ di fatturato lordo.`;
        }

        return { 
            grossNeeded: grossRevenueNeeded, 
            gap, 
            advice, 
            studentsNeeded: studentsGap, // Legacy prop name mapping to GAP
            studentsNeededTotal,         // New prop
            recommendedPrice, 
            currentAvgPrice,
            bestSubscription,
            currentNetSalary // New prop
        };
    }, [stats, targetMonthlyNet, enrollments, subscriptionTypes]);

    // ... [Handlers: handleSaveTransaction, handleDeleteTransaction, etc. same as before] ...
    const handleSaveTransaction = async (t: TransactionInput | Transaction) => { try { if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t as TransactionInput); setIsTransactionModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio."); } };
    const handleDeleteTransaction = async () => { if (transactionToDelete) { await deleteTransaction(transactionToDelete); setTransactionToDelete(null); fetchData(); } };
    const handleSaveInvoice = async (inv: InvoiceInput) => { try { if (editingInvoice?.id) await updateInvoice(editingInvoice.id, inv); else await addInvoice(inv); setIsInvoiceModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio."); } };
    const handleDeleteInvoice = async () => { if (invoiceToDelete) { await deleteInvoice(invoiceToDelete); setInvoiceToDelete(null); fetchData(); } };
    const handleSaveQuote = async (q: QuoteInput | Quote) => { try { if ('id' in q) await updateQuote(q.id, q); else await addQuote(q as QuoteInput); setIsQuoteModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio."); } };
    const handleDeleteQuote = async () => { if (quoteToDelete) { await deleteQuote(quoteToDelete); setQuoteToDelete(null); fetchData(); } };
    const handleConvertQuote = async () => { if (quoteToConvert) { try { await convertQuoteToInvoice(quoteToConvert.id); alert("Convertito!"); setQuoteToConvert(null); fetchData(); } catch (e) { alert(e); } } };
    const handlePrint = async (item: Invoice | Quote) => { const type = 'invoiceNumber' in item ? 'Fattura' : 'Preventivo'; const client = clients.find(c => c.id === item.clientId); await generateDocumentPDF(item, type, companyInfo, client); };
    const handleWhatsApp = (item: any) => { window.open(`https://wa.me/?text=${encodeURIComponent('Documento: ' + (item.invoiceNumber || item.quoteNumber))}`, '_blank'); };
    const handleSealSDI = async (item: Invoice) => { const c = prompt("Codice SDI:", item.sdiId || ''); if(c) { await updateInvoice(item.id, {status: DocumentStatus.SealedSDI, sdiId: c}); fetchData(); } };
    const handleEditTransaction = (t: any) => { setEditingTransaction(t); setIsTransactionModalOpen(true); };
    const handleEditInvoice = (i: any) => { setEditingInvoice(i); setIsInvoiceModalOpen(true); };
    const handleEditQuote = (q: any) => { setEditingQuote(q); setIsQuoteModalOpen(true); };
    const handleGapFill = (year: number, number: number) => { 
        const forcedNumber = `FT-${year}-${String(number).padStart(3, '0')}`;
        setEditingInvoice({ invoiceNumber: forcedNumber, issueDate: new Date().toISOString(), status: DocumentStatus.Draft, paymentMethod: PaymentMethod.BankTransfer, isGhost: false, isDeleted: false, items: [], totalAmount: 0 } as any);
        setIsInvoiceModalOpen(true);
    };
    
    // roiSedi Calculation (ENTERPRISE ALLOCATION LOGIC)
    const roiSedi = useMemo(() => {
        // --- 1. PREPARE DATA STRUCTURES ---
        const data = new Map<string, { 
            id: string; 
            name: string; 
            color: string; 
            distance: number;
            rentalCost: number; // Stored here for reference
            revenue: number; 
            operationalCosts: number; // New definition (Direct Costs excluding rent)
            calculatedRentCost: number; // Unique Slots * Rental Price
            tripCount: number; 
            uniqueStudents: Set<string>;
        }>();

        let globalRevenue = 0;
        let globalOverhead = 0;
        
        // Costi Auto Reali (TCO Calculation)
        let totalCarExpenses = 0;

        const targetMonth = controllingMonth === 'all' ? null : parseInt(controllingMonth);
        
        // --- 2. INITIALIZE LOCATIONS FROM SUPPLIERS ---
        suppliers.forEach(s => s.locations.forEach(l => {
            data.set(l.id, {
                id: l.id, 
                name: l.name, 
                color: l.color, 
                distance: l.distance || 0,
                rentalCost: l.rentalCost || 0,
                revenue: 0, 
                operationalCosts: 0, 
                calculatedRentCost: 0,
                tripCount: 0, 
                uniqueStudents: new Set()
            });
        }));

        // --- 3. PROCESS TRANSACTIONS (Expenses & TCO) ---
        const carCategories = [
            TransactionCategory.RCA, 
            TransactionCategory.BolloAuto, 
            TransactionCategory.ManutenzioneAuto, 
            TransactionCategory.ConsumoAuto, 
            TransactionCategory.Carburante
        ];

        transactions.forEach(t => {
            const tDate = new Date(t.date);
            const tYear = tDate.getFullYear();
            
            // Apply Month Filter if active
            if (targetMonth !== null && tDate.getMonth() !== targetMonth) return;

            if (tYear === controllingYear && !t.isDeleted && t.type === TransactionType.Expense) {
                const amt = Number(t.amount) || 0;
                
                // TCO Auto Collection
                if (carCategories.includes(t.category)) {
                    totalCarExpenses += amt;
                }
                
                // Direct Allocation
                else if (t.allocationType === 'location' && t.allocationId && data.has(t.allocationId)) {
                    const loc = data.get(t.allocationId)!;
                    // Ignore Nolo transactions here as we calculate them theoretically later
                    // But include other direct costs (materials, etc.) in operationalCosts
                    if (t.category !== TransactionCategory.Nolo) {
                        loc.operationalCosts += amt;
                    }
                } else {
                    // Overhead (General Expenses not allocated and not car)
                    globalOverhead += amt;
                }
            }
        });

        // --- 4. PROCESS REVENUE & ACTIVITY (Trips & Slots) ---
        // Helper to count unique slots per location (Date_Time_Location)
        const locationSlotsMap = new Map<string, Set<string>>(); // LocationID -> Set<"YYYY-MM-DD_HH:MM">

        // Helper to count unique trip days (assuming 1 trip per day per location)
        const locationTripDaysMap = new Map<string, Set<string>>(); // LocationID -> Set<"YYYY-MM-DD">

        const processActivity = (locId: string, dateStr: string, timeStr: string, price?: number, childName?: string) => {
            if (!locId || locId === 'unassigned' || !data.has(locId)) return;
            const loc = data.get(locId)!;
            
            // Revenue & Student
            if (price) {
                loc.revenue += price;
                globalRevenue += price;
            }
            if (childName) {
                loc.uniqueStudents.add(childName);
            }

            // Date Keys
            const datePart = dateStr.split('T')[0];
            const slotKey = `${datePart}_${timeStr}`;

            // Initialize Maps if needed
            if (!locationSlotsMap.has(locId)) locationSlotsMap.set(locId, new Set());
            if (!locationTripDaysMap.has(locId)) locationTripDaysMap.set(locId, new Set());

            // Track Usage
            locationSlotsMap.get(locId)!.add(slotKey);
            locationTripDaysMap.get(locId)!.add(datePart);
        };

        // Scan Enrollments
        enrollments.forEach(enr => {
             // Only consider if active/completed in the year or covering the year
             const startY = new Date(enr.startDate).getFullYear();
             const endY = new Date(enr.endDate).getFullYear();
             
             // Simplification: Check if enrollment touches the controlling year
             if (controllingYear >= startY && controllingYear <= endY) {
                 // Revenue Attribution (Pro-rated or full? Let's use full price if starts in year)
                 // Or better: Sum price to location.
                 const isRevenueRelevant = startY === controllingYear; 
                 // IMPORTANT: Revenue logic remains annual-based/start-date based for now, unless changed.
                 // If Month Filter is active, we ideally want ONLY revenue for that month.
                 // However, enrollments are often paid upfront. 
                 // Current logic assigns revenue to the FIRST processed appointment.
                 // If that first appointment is filtered out (because wrong month), revenue won't be added. This is acceptable for Cash/Competence view.
                 
                 const priceToAdd = isRevenueRelevant ? (Number(enr.price) || 0) : 0;
                 
                 // If enrollment has specific appointments, use them for accurate slot counting
                 if (enr.appointments && enr.appointments.length > 0) {
                     let first = true;
                     enr.appointments.forEach(app => {
                         const appDate = new Date(app.date);
                         
                         // Apply Month Filter if active
                         if (targetMonth !== null && appDate.getMonth() !== targetMonth) return;

                         if (appDate.getFullYear() === controllingYear && app.status !== 'Suspended') {
                             processActivity(
                                 app.locationId || enr.locationId, 
                                 app.date, 
                                 app.startTime, 
                                 first ? priceToAdd : 0, // Add price only once (on first relevant app in this window)
                                 enr.childName
                             );
                             if (isRevenueRelevant) first = false; // Consumed revenue add
                         }
                     });
                 } else {
                     // Fallback for enrollments without appointments generated yet
                     // If month filter active, this fallback might show revenue even if date doesn't match month exactly if we don't check.
                     // But fallback date is start date.
                     const startDate = new Date(enr.startDate);
                     if (targetMonth !== null && startDate.getMonth() !== targetMonth) {
                         // Skip if start date not in target month
                     } else {
                        processActivity(enr.locationId, enr.startDate, "00:00", priceToAdd, enr.childName);
                     }
                 }
             }
        });

        // Scan Manual Lessons
        manualLessons.forEach(ml => {
            const mlDate = new Date(ml.date);
            // Apply Month Filter
            if (targetMonth !== null && mlDate.getMonth() !== targetMonth) return;

            if (mlDate.getFullYear() === controllingYear) {
                // Manual lessons store name, find ID
                const locEntry = Array.from(data.values()).find(l => l.name === ml.locationName);
                if (locEntry) {
                    processActivity(locEntry.id, ml.date, ml.startTime, 0, ml.childName); // Manual lessons usually don't have direct price attached here easily
                }
            }
        });

        // --- 5. CALCULATE LOGISTICS & RENT ---
        
        // Calculate Global Total Km Driven
        let globalTotalKm = 0;
        data.forEach(loc => {
            const tripDays = locationTripDaysMap.get(loc.id)?.size || 0;
            loc.tripCount = tripDays;
            const locKm = tripDays * (loc.distance * 2); // Round trip
            globalTotalKm += locKm;
        });

        // Calculate Real Cost Per Km (TCO)
        // Fallback to settings if no expenses or no km
        let costPerKm = 0;
        if (totalCarExpenses > 0 && globalTotalKm > 0) {
            costPerKm = totalCarExpenses / globalTotalKm;
        } else {
            // Fallback parameters
            const fuelPrice = companyInfo?.averageFuelPrice || 1.8;
            const consumption = companyInfo?.carFuelConsumption || 16.5; // km/l
            costPerKm = consumption > 0 ? fuelPrice / consumption : 0.15;
        }

        // --- 6. FINAL AGGREGATION ---
        // NEW: Capture current time for slot consumption comparison
        const now = new Date();

        const result = Array.from(data.values()).map(loc => {
            // Rent: Slots * Hourly/Slot Cost
            const slotsSet = locationSlotsMap.get(loc.id);
            const uniqueSlotsCount = slotsSet?.size || 0;
            
            // Calculate Consumed Slots (Nolo Attuale)
            let consumedSlotsCount = 0;
            if (slotsSet) {
                slotsSet.forEach(key => {
                    const [d, t] = key.split('_');
                    // Simple ISO comparison: 'YYYY-MM-DD' + 'T' + 'HH:MM'
                    const slotDate = new Date(`${d}T${t}`);
                    if (slotDate < now) {
                        consumedSlotsCount++;
                    }
                });
            }

            const calculatedRentTotal = uniqueSlotsCount * loc.rentalCost;
            const calculatedRentCurrent = consumedSlotsCount * loc.rentalCost;

            // Logistics: Trips * Dist * CostPerKm
            const logisticsCost = loc.tripCount * (loc.distance * 2) * costPerKm;

            // Overhead: Proportional to Revenue
            const overheadShare = globalRevenue > 0 ? (loc.revenue / globalRevenue) * globalOverhead : 0;

            // IMPORTANT: Total Costs Calculation uses Total Rent (Forecast view)
            const totalCosts = loc.operationalCosts + calculatedRentTotal + logisticsCost + overheadShare;
            const studentCount = loc.uniqueStudents.size;
            
            // Approx lessons count (slots)
            const totalLessons = uniqueSlotsCount;

            return {
                name: loc.name,
                color: loc.color,
                revenue: loc.revenue,
                costs: totalCosts,
                breakdown: {
                    // Update structure to support split
                    rent: { total: calculatedRentTotal, current: calculatedRentCurrent },
                    operational: loc.operationalCosts,
                    logistics: logisticsCost,
                    overhead: overheadShare
                },
                costPerLesson: {
                    value: totalLessons > 0 ? totalCosts / totalLessons : 0,
                    avg: 0, min: 0, max: 0
                },
                costPerStudent: studentCount > 0 ? totalCosts / studentCount : 0,
                costPerStudentPerLesson: (studentCount > 0 && totalLessons > 0) ? (totalCosts / totalLessons) / studentCount : 0,
                studentBasedCosts: 0
            };
        });

        return result.sort((a,b) => b.revenue - a.revenue);

    }, [suppliers, enrollments, transactions, manualLessons, controllingYear, controllingMonth, companyInfo]); 

    return (
        <div className="pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div><h1 className="text-3xl font-bold">Finanza</h1><p className="text-gray-500">Controllo di gestione e fatturazione.</p></div>
                <div className="flex gap-2">
                    {/* BUTTON SYNC NOLI: Always Visible (or conditional to controlling tab if preferred, but user asked for logic restore) */}
                    {(activeTab === 'controlling' || activeTab === 'transactions') && (
                        <button onClick={() => setIsSyncModalOpen(true)} className="md-btn md-btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-2 font-bold shadow-sm">
                            <SparklesIcon /> Calcola Noli Mensili
                        </button>
                    )}
                    
                    {activeTab === 'transactions' && <button onClick={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /> <span className="ml-2">Nuova Voce</span></button>}
                    {activeTab === 'invoices' && <button onClick={() => { setEditingInvoice({} as Invoice); setIsInvoiceModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary flex items-center"><PlusIcon /> <span className="ml-2">Nuova Fattura</span></button>}
                    {activeTab === 'quotes' && <button onClick={() => { setEditingQuote(null); setIsQuoteModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary flex items-center"><PlusIcon /> <span className="ml-2">Nuovo Preventivo</span></button>}
                    {integrityIssues.length > 0 && <button onClick={() => setIsFixWizardOpen(true)} className="md-btn md-btn-sm bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 animate-pulse">🩺 {integrityIssues.length} Anomalie</button>}
                </div>
            </div>
            
            <div className="border-b border-gray-200 mb-6 -mx-4 md:mx-0"><nav className="flex space-x-2 overflow-x-auto scrollbar-hide px-4 md:px-0 pb-1">{Object.entries(TAB_LABELS).map(([key, label]) => (<button key={key} onClick={() => setActiveTab(key as any)} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>{label}</button>))}</nav></div>

            {activeTab === 'overview' && <FinanceOverview stats={stats} transactions={transactions} invoices={invoices} overviewYear={overviewYear} setOverviewYear={setOverviewYear} />}
            {/* Added currentBankBalance and update handler to FinanceCFO */}
            {activeTab === 'cfo' && <FinanceCFO 
                stats={stats} 
                simulatorData={simulatorData} 
                reverseEngineering={reverseEngineering} 
                targetMonthlyNet={targetMonthlyNet} 
                setTargetMonthlyNet={setTargetMonthlyNet} 
                year={overviewYear} 
                onYearChange={setOverviewYear}
                currentBankBalance={companyInfo?.currentBankBalance || 0}
                onUpdateBankBalance={handleUpdateBankBalance}
            />}
            {activeTab === 'controlling' && (
                <FinanceControlling 
                    roiSedi={roiSedi} 
                    onSelectLocation={setSelectedLocationROI} 
                    year={controllingYear} 
                    onYearChange={setControllingYear}
                    month={controllingMonth}
                    onMonthChange={setControllingMonth} 
                />
            )}
            {(activeTab === 'transactions' || activeTab === 'invoices' || activeTab === 'archive' || activeTab === 'quotes') && (
                <FinanceListView 
                    activeTab={activeTab} 
                    transactions={transactions} 
                    invoices={invoices} 
                    quotes={quotes} 
                    suppliers={suppliers} 
                    enrollments={enrollments} 
                    filters={filters} 
                    setFilters={setFilters}
                    onEdit={activeTab === 'transactions' ? handleEditTransaction : activeTab === 'quotes' ? handleEditQuote : handleEditInvoice}
                    onDelete={activeTab === 'transactions' ? setTransactionToDelete : activeTab === 'quotes' ? setQuoteToDelete : setInvoiceToDelete}
                    onPrint={handlePrint}
                    onSeal={handleSealSDI}
                    onWhatsApp={handleWhatsApp}
                    onConvert={activeTab === 'quotes' ? setQuoteToConvert : undefined}
                    onActivate={activeTab === 'quotes' ? setQuoteToActivate : undefined}
                />
            )}
            {activeTab === 'fiscal_closure' && <FiscalYearManager transactions={transactions} invoices={invoices} onRequestInvoiceCreation={handleGapFill} />}

            {/* Modals */}
            {isSyncModalOpen && <Modal onClose={() => setIsSyncModalOpen(false)} size="xl"><RentSyncModal onClose={() => setIsSyncModalOpen(false)} onComplete={fetchData} enrollments={enrollments} /></Modal>}
            {isFixWizardOpen && <Modal onClose={() => setIsFixWizardOpen(false)} size="2xl"><FixWizard issues={integrityIssues} onFix={fixIntegrityIssue} onClose={() => { setIsFixWizardOpen(false); fetchData(); }} /></Modal>}
            {isTransactionModalOpen && <Modal onClose={() => setIsTransactionModalOpen(false)} size="lg"><TransactionForm transaction={editingTransaction} suppliers={suppliers} onSave={handleSaveTransaction} onCancel={() => setIsTransactionModalOpen(false)} /></Modal>}
            {isInvoiceModalOpen && <Modal onClose={() => setIsInvoiceModalOpen(false)} size="2xl"><InvoiceEditForm invoice={editingInvoice || {} as Invoice} clients={clients} companyInfo={companyInfo} onSave={handleSaveInvoice} onCancel={() => setIsInvoiceModalOpen(false)} /></Modal>}
            {isQuoteModalOpen && <Modal onClose={() => setIsQuoteModalOpen(false)} size="2xl"><QuoteForm quote={editingQuote} clients={clients} companyInfo={companyInfo} onSave={handleSaveQuote} onCancel={() => setIsQuoteModalOpen(false)} /></Modal>}
            {selectedLocationROI && <LocationDetailModal data={selectedLocationROI} onClose={() => setSelectedLocationROI(null)} />}
            {quoteToActivate && (<Modal onClose={() => setQuoteToActivate(null)} size="2xl"><InstitutionalWizard quote={quoteToActivate} suppliers={suppliers} onClose={() => setQuoteToActivate(null)} onComplete={() => { setQuoteToActivate(null); fetchData(); alert("Progetto Attivato!"); }} /></Modal>)}

            <ConfirmModal isOpen={!!transactionToDelete} onClose={() => setTransactionToDelete(null)} onConfirm={handleDeleteTransaction} title="Elimina Transazione" message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={!!invoiceToDelete} onClose={() => setInvoiceToDelete(null)} onConfirm={handleDeleteInvoice} title="Elimina Fattura" message="Sei sicuro? Il numero verrà perso." isDangerous={true} />
            <ConfirmModal isOpen={!!quoteToDelete} onClose={() => setQuoteToDelete(null)} onConfirm={handleDeleteQuote} title="Elimina Preventivo" message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={!!quoteToConvert} onClose={() => setQuoteToConvert(null)} onConfirm={handleConvertQuote} title="Converti in Fattura" message="Verrà generata una nuova fattura dai dati del preventivo. Confermi?" />
        </div>
    );
};

export default Finance;
