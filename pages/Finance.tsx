import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput, Lesson, IntegrityIssue, Enrollment, PaymentMethod, TransactionStatus, IntegrityIssueSuggestion } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, syncRentExpenses, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice, reconcileTransactions, runFinancialHealthCheck, fixIntegrityIssue, getInvoiceNumberGaps, isInvoiceNumberTaken, InvoiceGap } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo } from '../services/settingsService';
import { getClients } from '../services/parentService';
import { getLessons } from '../services/calendarService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import RefreshIcon from '../components/icons/RestoreIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import TransactionForm from '../components/finance/TransactionForm';
import InvoiceEditForm from '../components/finance/InvoiceEditForm';
import QuoteForm from '../components/finance/QuoteForm';
import FinanceOverview from '../components/finance/FinanceOverview';
import FinanceCFO from '../components/finance/FinanceCFO';
import FinanceControlling from '../components/finance/FinanceControlling';
import FinanceListView from '../components/finance/FinanceListView';
import FiscalYearManager from '../components/finance/FiscalYearManager'; 
import LocationDetailModal from '../components/finance/LocationDetailModal';
import { getAllEnrollments } from '../services/enrollmentService';

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

// --- RENT SYNC SELECTOR MODAL ---
const RentSyncModal: React.FC<{
    onClose: () => void;
    onSync: (month: number, year: number) => Promise<void>;
}> = ({ onClose, onSync }) => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [loading, setLoading] = useState(false);

    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const years = useMemo(() => {
        const list = [];
        for (let y = now.getFullYear(); y >= 2025; y--) list.push(y);
        return list;
    }, [now]);

    const handleSync = async () => {
        setLoading(true);
        try {
            await onSync(month, year);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Sincronizzazione Noli Sede</h3>
            <p className="text-sm text-slate-500 mb-6">Seleziona il periodo di competenza da sanare. Il sistema genererà transazioni di uscita solo se rileva presenze reali ('Present') nel mese scelto.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mese</label>
                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full md-input bg-slate-50">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Anno</label>
                    <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full md-input bg-slate-50">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                <button onClick={handleSync} disabled={loading} className="md-btn md-btn-raised md-btn-primary px-8">
                    {loading ? <Spinner /> : 'Avvia Sincronizzazione'}
                </button>
            </div>
        </div>
    );
};

// --- FISCAL DOCTOR WIZARD (UI ENTERPRISE) ---
const FixWizard: React.FC<{
    issues: IntegrityIssue[];
    onFix: (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', manualNum?: string, targetInvoiceIds?: string[], adjustment?: { amount: number, notes: string }, targetTransactionId?: string) => Promise<void>;
    onClose: () => void;
}> = ({ issues, onFix, onClose }) => {
    const [step, setStep] = useState<'list' | 'invoice_wizard' | 'adjustment_confirm'>('list');
    const [activeIssue, setActiveIssue] = useState<IntegrityIssue | null>(null);
    const [pendingSelection, setPendingSelection] = useState<{ issue: IntegrityIssue, invoices: Invoice[], gap: number } | null>(null);
    
    const [gaps, setGaps] = useState<InvoiceGap[]>([]);
    const [selectedGap, setSelectedGap] = useState<number | null>(null);
    const [manualNum, setManualNum] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [loadingGaps, setLoadingGaps] = useState(false);
    
    // Feedback states per singola riga
    const [fixingId, setFixingId] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);

    const handleSelectIssue = async (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', targetInvoices?: Invoice[], targetTransactionId?: string) => {
        // --- CASO: COLLEGAMENTO TRANSAZIONE ORFANA (Manca Cassa) ---
        if (strategy === 'link' && issue.type === 'missing_transaction' && targetTransactionId) {
            setFixingId(issue.id);
            try {
                await onFix(issue, 'link', undefined, undefined, undefined, targetTransactionId);
                setSuccessId(issue.id);
                setFixingId(null);
                setTimeout(() => setSuccessId(null), 1800);
            } catch (e) {
                alert("Errore collegamento cassa.");
                setFixingId(null);
            }
            return;
        }

        if (strategy === 'link' && targetInvoices) {
            const ids = targetInvoices.map(i => i.id);
            const suggestion = issue.suggestions?.find(s => s.invoices.length === targetInvoices.length && s.invoices.every(inv => ids.includes(inv.id)));
            const realGap = suggestion ? suggestion.gap : 0;

            if (realGap > 0.1) {
                // Match parziale: chiedi conferma abbuono
                setPendingSelection({ issue, invoices: targetInvoices, gap: realGap });
                setStep('adjustment_confirm');
            } else {
                // Match perfetto: procedi atomico
                setFixingId(issue.id);
                try {
                    await onFix(issue, 'link', undefined, ids);
                    setSuccessId(issue.id);
                    setFixingId(null);
                    setTimeout(() => setSuccessId(null), 1800);
                } catch (e) {
                    alert("Errore riconciliazione.");
                    setFixingId(null);
                }
            }
        } else if (strategy === 'cash') {
            setFixingId(issue.id);
            try {
                await onFix(issue, strategy);
                setSuccessId(issue.id);
                setFixingId(null);
                setTimeout(() => setSuccessId(null), 1800);
            } catch (e) {
                alert("Errore cassa.");
                setFixingId(null);
            }
        } else {
            // Strategia 'invoice'
            setActiveIssue(issue);
            setLoadingGaps(true);
            setStep('invoice_wizard');
            const year = new Date(issue.date).getFullYear();
            const yearGaps = await getInvoiceNumberGaps(year);
            const issueDate = new Date(issue.date).getTime();
            
            const enrichedGaps = yearGaps.map(g => {
                let rec = false;
                if (g.prevDate && g.nextDate) {
                    rec = issueDate >= new Date(g.prevDate).getTime() && issueDate <= new Date(g.nextDate).getTime();
                } else if (!g.prevDate && g.nextDate) {
                    rec = issueDate <= new Date(g.nextDate).getTime();
                } else if (g.prevDate && !g.nextDate) {
                    rec = issueDate >= new Date(g.prevDate).getTime();
                }
                return { ...g, recommended: rec };
            });
            
            setGaps(enrichedGaps);
            setLoadingGaps(false);
        }
    };

    const handleConfirmAdjustment = async () => {
        if (!pendingSelection) return;
        const { issue, invoices, gap } = pendingSelection;
        
        setFixingId(issue.id);
        try {
            await onFix(issue, 'link', undefined, invoices.map(i => i.id), {
                amount: gap,
                notes: `Sconto/Abbuono applicato sul totale per pareggio contabile. Gap rilevato: ${gap}€.`
            });
            setSuccessId(issue.id);
            setFixingId(null);
            setTimeout(() => {
                setSuccessId(null);
                setStep('list');
                setPendingSelection(null);
            }, 1800);
        } catch (e) {
            alert("Errore regolarizzazione.");
            setFixingId(null);
        }
    };

    useEffect(() => {
        if (manualNum && activeIssue) {
            const timer = setTimeout(async () => {
                const year = new Date(activeIssue.date).getFullYear();
                const taken = await isInvoiceNumberTaken(year, parseInt(manualNum));
                setIsDuplicate(taken);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [manualNum, activeIssue]);

    const handleConfirmInvoice = async () => {
        if (!activeIssue) return;
        const numToUse = selectedGap !== null ? selectedGap : parseInt(manualNum);
        if (isNaN(numToUse as any)) return alert("Numero non valido.");
        
        const year = new Date(activeIssue.date).getFullYear();
        const finalString = `FT-${year}-${String(numToUse).padStart(3, '0')}`;
        
        setFixingId(activeIssue.id);
        try {
            await onFix(activeIssue, 'invoice', finalString);
            setSuccessId(activeIssue.id);
            setFixingId(null);
            
            setTimeout(() => {
                setStep('list');
                setActiveIssue(null);
                setSuccessId(null);
            }, 1800);
        } catch (e) {
            alert("Errore salvataggio.");
            setFixingId(null);
        }
    };

    return (
        <div className="flex flex-col h-[85vh]">
            <div className="p-6 border-b bg-amber-50 flex-shrink-0 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-amber-900">Fiscal Doctor</h3>
                    <p className="text-sm text-amber-700">Analisi Automatica & Smart Fuzzy Match.</p>
                </div>
                <span className="text-2xl">🩺</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {step === 'list' ? (
                    <div className="space-y-4">
                        {issues.length === 0 ? (
                            <div className="text-center py-20 animate-fade-in">
                                <div className="text-5xl mb-4">✨</div>
                                <h3 className="text-lg font-bold text-slate-800">Database Integro</h3>
                                <p className="text-sm text-slate-500">Nessuna anomalia rilevata. Ottimo lavoro!</p>
                            </div>
                        ) : issues.map((issue, idx) => {
                            const isFixing = fixingId === issue.id;
                            const isSuccess = successId === issue.id;

                            return (
                                <div key={issue.id || idx} className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${isSuccess ? 'border-green-500 bg-green-50' : ''}`}>
                                    
                                    {isSuccess && (
                                        <div className="absolute inset-0 bg-green-500/10 backdrop-blur-[1px] flex items-center justify-center z-10 animate-fade-in">
                                            <div className="bg-white rounded-full p-4 shadow-xl text-green-600 flex items-center gap-2 font-black text-sm border border-green-200">
                                                <span className="text-xl">✓</span> RICONCILIATO!
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${issue.type === 'missing_invoice' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {issue.type === 'missing_invoice' ? 'Manca Copertura' : 'Manca Cassa'}
                                            </span>
                                            <span className="text-xs font-mono text-gray-400">{new Date(issue.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-black text-slate-800">{(issue.amount ?? 0).toFixed(2)}€</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono leading-tight flex-1">
                                                Gap Rilevato
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-gray-900 mb-1">{issue.description}</h4>
                                    
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-4 text-[11px] bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="col-span-1">
                                            <span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Soggetto / Allievo</span> 
                                            <span className="text-gray-700 font-bold block truncate" title={issue.parentName}>{issue.parentName || 'N/D'}</span>
                                            <span className="text-gray-500 italic block">Ref: {issue.entityName}</span>
                                        </div>
                                        <div className="col-span-1">
                                            <span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Pacchetto Iscrizione</span> 
                                            <span className="text-gray-700 font-bold block truncate" title={issue.subscriptionName}>{issue.subscriptionName || 'N/D'}</span>
                                            <span className="text-gray-500 block">Dotazione: {issue.lessonsTotal || 0} lez.</span>
                                        </div>
                                        <div className="col-span-1">
                                            <span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Validità</span> 
                                            <span className="text-gray-600 block">Dal {new Date(issue.date).toLocaleDateString()}</span>
                                            <span className="text-gray-600 block">Al {issue.endDate ? new Date(issue.endDate).toLocaleDateString() : '?' }</span>
                                        </div>
                                        <div className="col-span-1">
                                            <span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Tracciabilità</span> 
                                            <span className="text-gray-600 block">Reg. il: {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : 'N/D'}</span>
                                            <span className="text-indigo-600 font-bold block">Metodo: {issue.paymentMethod || 'Contanti'}</span>
                                        </div>
                                    </div>

                                    {issue.suggestions && issue.suggestions.length > 0 && (
                                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-slide-up">
                                            <h5 className="text-[10px] font-black text-indigo-700 uppercase mb-2 flex items-center gap-2">
                                                <SparklesIcon /> Smart Identity Match
                                            </h5>
                                            <p className="text-[11px] text-indigo-600 mb-3 leading-tight italic">
                                                Ho trovato {issue.type === 'missing_transaction' ? 'movimenti di cassa' : 'documenti'} orfani compatibili.
                                            </p>
                                            <div className="space-y-3">
                                                {issue.suggestions.map((suggestion, gIdx) => {
                                                    // --- CASO MISSING TRANSACTION (Suggerimenti Transazioni) ---
                                                    if (issue.type === 'missing_transaction' && (suggestion as any).transactionDetails) {
                                                        const t = (suggestion as any).transactionDetails as Transaction;
                                                        const comboKey = t.id;
                                                        const isPerfect = suggestion.isPerfect;

                                                        return (
                                                            <div key={comboKey} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border shadow-sm group/btn transition-all ${isPerfect ? 'border-indigo-300' : 'border-amber-200'}`}>
                                                                <div className="flex-1 min-w-0 pr-4 space-y-1">
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <span className="text-[10px] font-black text-indigo-900 uppercase tracking-tighter">Movimento: {Number(t.amount).toFixed(2)}€</span>
                                                                        {!isPerfect && <span className="text-[9px] font-bold text-red-500 italic">(Diff. {suggestion.gap}€)</span>}
                                                                    </div>
                                                                    <div className="space-y-1.5 pl-1 border-l-2 border-indigo-200 ml-1">
                                                                        <div className="text-[11px] text-slate-700 font-medium">
                                                                            "{t.description}" <span className="text-slate-400 font-normal italic">del {new Date(t.date).toLocaleDateString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    disabled={isFixing}
                                                                    onClick={() => handleSelectIssue(issue, 'link', undefined, t.id)} 
                                                                    className={`text-[10px] font-black text-white px-4 py-2 rounded-xl transition-all uppercase disabled:opacity-50 flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0 shadow-sm active:scale-95 ${isPerfect ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
                                                                >
                                                                    {isFixing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><ArrowRightStartOnRectangleIcon /> Collega Ora</>}
                                                                </button>
                                                            </div>
                                                        );
                                                    }

                                                    // --- CASO MISSING INVOICE (Suggerimenti Fatture) ---
                                                    const invGroup = suggestion.invoices;
                                                    const isCluster = invGroup.length > 1;
                                                    const isPerfect = suggestion.isPerfect;
                                                    const totalVal = invGroup.reduce((s, i) => s + i.totalAmount, 0);

                                                    const sortedGroup = [...invGroup].sort((a, b) => {
                                                        const numA = parseInt(a.invoiceNumber.split('-').pop() || '0');
                                                        const numB = parseInt(b.invoiceNumber.split('-').pop() || '0');
                                                        return numA - numB;
                                                    });

                                                    const comboKey = suggestion.invoices.map(inv => inv.id).sort().join('_');

                                                    return (
                                                        <div key={comboKey} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border shadow-sm group/btn transition-all ${isCluster ? 'border-indigo-300 ring-2 ring-indigo-50 bg-indigo-50/20' : 'border-indigo-200'}`}>
                                                            <div className="flex-1 min-w-0 pr-4 space-y-1">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    {isCluster && <span className="text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm">PACKAGE</span>}
                                                                    {!isPerfect && <span className="text-[8px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">DISCREPANZA RILEVATA</span>}
                                                                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-tighter">Somma: {totalVal.toFixed(2)}€</span>
                                                                    {!isPerfect && <span className="text-[9px] font-bold text-red-500 italic">(Mancano {suggestion.gap}€)</span>}
                                                                </div>
                                                                <div className="space-y-1.5 pl-1 border-l-2 border-indigo-200 ml-1">
                                                                    {sortedGroup.map((inv, idx) => (
                                                                        <div key={inv.id} className="flex items-center gap-2 text-[11px] text-slate-700">
                                                                            <span className="text-indigo-400 font-black">#{idx+1}</span>
                                                                            <span className="font-bold font-mono">{inv.invoiceNumber}</span>
                                                                            <span className="text-[9px] text-slate-400 italic">del {new Date(inv.issueDate).toLocaleDateString()}</span>
                                                                            <span className="font-black text-indigo-600 ml-auto">{inv.totalAmount.toFixed(2)}€</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <button 
                                                                disabled={isFixing}
                                                                onClick={() => handleSelectIssue(issue, 'link', invGroup)} 
                                                                className={`text-[10px] font-black text-white px-4 py-2 rounded-xl transition-all uppercase disabled:opacity-50 flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0 shadow-sm active:scale-95 ${isPerfect ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
                                                            >
                                                                {isFixing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : ( 
                                                                    isPerfect ? <><ArrowRightStartOnRectangleIcon /> Collega Ora</> : <><BanknotesIcon /> Collega e Regola</> 
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-5 flex gap-2">
                                        {issue.type === 'missing_invoice' ? (
                                            <>
                                                <button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'invoice')} className="flex-1 md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50">
                                                    {isFixing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Genera Fattura'}
                                                </button>
                                                <button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'cash')} className="flex-1 md-btn md-btn-sm bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 disabled:opacity-50">
                                                    Solo Cassa (No Doc)
                                                </button>
                                            </>
                                        ) : (
                                            <button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'invoice')} className="w-full md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50">
                                                {isFixing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Risolvi Ora'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : step === 'adjustment_confirm' ? (
                    <div className="animate-fade-in p-2 text-center py-10">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚖️</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Conferma Regolazione</h3>
                        <p className="text-sm text-slate-500 mb-6 px-4">
                            L'importo dei documenti ({pendingSelection?.invoices.reduce((s,i) => s+i.totalAmount,0).toFixed(2)}€) è inferiore a quello dell'iscrizione ({pendingSelection?.issue.details.enrollment.price.toFixed(2)}€).
                            <br/><br/>
                            Vuoi registrare la differenza di <strong className="text-red-600">{pendingSelection?.gap.toFixed(2)}€</strong> come <strong className="text-slate-800 underline">Abbuono Fiscale (Sconto Finale)</strong> per chiudere la posizione dell'allievo?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleConfirmAdjustment} 
                                disabled={fixingId === pendingSelection?.issue.id}
                                className="w-full md-btn md-btn-raised bg-red-600 text-white font-bold uppercase tracking-widest text-xs"
                            >
                                {fixingId ? 'REGOLAZIONE IN CORSO...' : 'Sì, Registra Abbuono e Collega'}
                            </button>
                            <button onClick={() => { setStep('list'); setPendingSelection(null); }} className="md-btn md-btn-flat">Indietro</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <h4 className="text-sm font-bold text-indigo-900 mb-1">Recupero Numerazione: {activeIssue?.entityName}</h4>
                            <p className="text-xs text-indigo-700 leading-relaxed">Seleziona un progressivo mancante identificato dal sistema o digitalo manualmente.</p>
                        </div>
                        {loadingGaps ? <div className="py-10 flex justify-center"><Spinner /></div> : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">1. Seleziona un Buco Trovato</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {gaps.map(g => (
                                            <button key={g.number} onClick={() => { setSelectedGap(g.number); setManualNum(''); }} className={`p-3 border rounded-xl text-left transition-all relative overflow-hidden ${selectedGap === g.number ? 'ring-4 ring-indigo-500 bg-indigo-600 border-indigo-600 text-white shadow-xl scale-95' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
                                                <div className="flex justify-between items-start">
                                                    <span className="font-mono font-bold text-base">#{g.number}</span>
                                                    {g.recommended && <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">MATCH</span>}
                                                </div>
                                                <p className={`text-[9px] mt-1 ${selectedGap === g.number ? 'text-indigo-200' : 'text-slate-400'} font-bold`}>
                                                    {g.prevDate ? new Date(g.prevDate).toLocaleDateString() : 'START'} - {g.nextDate ? new Date(g.nextDate).toLocaleDateString() : 'END'}
                                                </p>
                                            </button>
                                        ))}
                                        {gaps.length === 0 && <p className="text-xs text-gray-400 italic py-2 col-span-full">Nessuna interruzione rilevata nella sequenza.</p>}
                                    </div>
                                </div>
                                <div className="border-t pt-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">2. Inserimento Manuale Libero</label>
                                    <input type="number" value={manualNum} onChange={e => { setManualNum(e.target.value); setSelectedGap(null); }} placeholder="Cerca progressivo..." className={`w-full p-3 border rounded-xl text-sm font-mono font-bold ${isDuplicate ? 'border-red-500 bg-red-50' : 'bg-white border-gray-300'}`} />
                                    {isDuplicate && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">⚠️ Questo numero è già presente in archivio per l'anno selezionato.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between flex-shrink-0 z-10">
                {step === 'list' ? <button onClick={onClose} className="md-btn md-btn-flat">Chiudi Medico</button> : <button onClick={() => { setStep('list'); setPendingSelection(null); }} className="md-btn md-btn-flat">Indietro</button>}
                {step === 'invoice_wizard' && <button onClick={handleConfirmInvoice} disabled={(!selectedGap && !manualNum) || isDuplicate} className="md-btn md-btn-raised md-btn-primary px-8 disabled:opacity-50">Genera Documento Sanante</button>}
            </div>
        </div>
    );
};

// Icona Spostamento (Re-used for Link)
const ArrowRightStartOnRectangleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
);

// Icona Cassa (Re-used for Link)
const BanknotesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure'>('overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [manualLessons, setManualLessons] = useState<Lesson[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
    const [lessonPrice, setLessonPrice] = useState(25);
    const [controllingYear, setControllingYear] = useState<number>(Math.max(2025, new Date().getFullYear()));
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
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [t, i, q, e, s, c, ml, info, issues] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getLessons(), getCompanyInfo(), runFinancialHealthCheck()
            ]);
            setTransactions(t || []); 
            setInvoices(i || []); 
            setQuotes(q || []); 
            setEnrollments(e || []); 
            setSuppliers(s || []); 
            setClients(c || []); 
            setManualLessons(ml || []); 
            setCompanyInfo(info || null); 
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

    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted);
        const revenue = activeT.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const expenses = activeT.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const taxable = revenue * COEFF_REDDITIVITA;
        const inps = taxable * INPS_RATE;
        const tax = taxable * TAX_RATE_STARTUP;
        let stampDutyTotal = 0;
        invoices.forEach(inv => { if (!inv.isDeleted && !inv.isGhost && (Number(inv.totalAmount) || 0) > 77.47) stampDutyTotal += 2; });
        const totalInpsTax = inps + tax;
        const totalAll = totalInpsTax + stampDutyTotal;
        return { 
            revenue, expenses, profit, margin, taxable, inps, tax, stampDutyTotal, 
            totalInpsTax, totalAll, 
            savingsSuggestion: totalInpsTax * 2 + stampDutyTotal, 
            progress: (revenue / LIMIT_FORFETTARIO) * 100, 
            monthlyData: Array(12).fill(0).map((_, i) => ({ 
                month: i, 
                revenue: activeT.filter(t => new Date(t.date).getMonth() === i && t.type === TransactionType.Income).reduce((a,c) => a + (Number(c.amount) || 0), 0), 
                expenses: activeT.filter(t => new Date(t.date).getMonth() === i && t.type === TransactionType.Expense).reduce((a,c) => a + (Number(c.amount) || 0), 0) 
            })) 
        };
    }, [transactions, invoices]);

    const reverseEngineering = useMemo(() => { 
        const compositeTaxRate = COEFF_REDDITIVITA * (INPS_RATE + TAX_RATE_STARTUP); 
        const netRatio = 1 - compositeTaxRate; 
        const annualNetTarget = (Number(targetMonthlyNet) || 0) * 12; 
        const grossNeeded = annualNetTarget / (netRatio || 1); 
        const currentGross = stats.revenue; 
        const gap = Math.max(0, grossNeeded - currentGross);
        const extraLessonsNeeded = Math.ceil(gap / (Number(lessonPrice) || 1));
        const studentsNeeded = Math.ceil(extraLessonsNeeded / 30);
        
        return { 
            annualNetTarget, 
            grossNeeded, 
            gap, 
            extraLessonsNeeded, 
            studentsNeeded,
            advice: gap > 0 
                ? `Per il target netto di ${(Number(targetMonthlyNet) || 0)}€/mese, ti mancano ${studentsNeeded} allievi medi o ${extraLessonsNeeded} lezioni extra annue.` 
                : "Obiettivo raggiunto! Ogni ulteriore incasso incrementa direttamente il tuo utile netto."
        }; 
    }, [targetMonthlyNet, lessonPrice, stats.revenue]);

    const simulatorData = useMemo(() => { 
        const tax2025 = stats.totalInpsTax; 
        return { 
            tranche1: tax2025 * 1.5, 
            tranche2: tax2025 * 0.5, 
            monthlyInstallment: (tax2025 * 1.5) / 6, 
            savingsPlan: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'].map((m) => ({ month: m, amount: (tax2025 * 2) / 12 })), 
        }; 
    }, [stats]);

    // --- REFACTORING ROI SEDI (CONTROLLING) ---
    const roiSedi = useMemo(() => {
        // 1. Definisci Categorie Logistiche (A. Logistica)
        const logisticCats = [
            TransactionCategory.RCA,
            TransactionCategory.BolloAuto,
            TransactionCategory.ManutenzioneAuto,
            TransactionCategory.ConsumoAuto,
            TransactionCategory.Carburante,
            TransactionCategory.Parcheggio,
            TransactionCategory.Sanzioni,
            TransactionCategory.BigliettoViaggio
        ];

        // 2. Filtra Transazioni dell'anno selezionato
        const yearTrans = transactions.filter(t => !t.isDeleted && new Date(t.date).getFullYear() === controllingYear);
        
        // 3. Calcola Costo Totale Logistica (TCO) dell'anno
        const totalYearLogisticsCost = yearTrans
            .filter(t => t.type === TransactionType.Expense && logisticCats.includes(t.category))
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        // 4. Prepara Mappa Sedi
        const locationsMap = new Map<string, { id: string, name: string, color: string, distance: number }>();
        suppliers.forEach(s => s.locations.forEach(l => locationsMap.set(l.id, { id: l.id, name: l.name, color: l.color, distance: l.distance || 0 })));

        // 5. Conta Lezioni e KM per sede
        const locStats: Record<string, { revenue: number, rent: number, lessonCount: number, km: number }> = {};
        locationsMap.forEach((_, id) => locStats[id] = { revenue: 0, rent: 0, lessonCount: 0, km: 0 });

        let totalYearKm = 0;

        // Conteggio da Iscrizioni (Cartellini)
        enrollments.forEach(enr => {
            if (enr.locationId && locStats[enr.locationId]) {
                const yearApps = (enr.appointments || []).filter(app => 
                    new Date(app.date).getFullYear() === controllingYear && app.status === 'Present'
                );
                locStats[enr.locationId].lessonCount += yearApps.length;
            }
        });

        // Conteggio da Lezioni Manuali (Extra)
        manualLessons.forEach(ml => {
            const date = new Date(ml.date);
            if (date.getFullYear() === controllingYear) {
                // Cerchiamo la location per nome se ID non disponibile
                const foundLoc = Array.from(locationsMap.values()).find(l => l.name === ml.locationName);
                if (foundLoc && locStats[foundLoc.id]) {
                    locStats[foundLoc.id].lessonCount += 1;
                }
            }
        });

        // Calcola KM e totale KM globale
        locationsMap.forEach((info, id) => {
            const stats = locStats[id];
            stats.km = stats.lessonCount * (info.distance * 2); // Andata e ritorno
            totalYearKm += stats.km;
        });

        // 6. Calcola Costo per KM (CPK)
        const cpk = totalYearLogisticsCost / (totalYearKm || 1);

        // 7. Calcola Ricavi e Noli Reali (Transazionali)
        yearTrans.forEach(t => {
            if (!t.allocationId || !locStats[t.allocationId]) return;
            if (t.type === TransactionType.Income) {
                locStats[t.allocationId].revenue += (Number(t.amount) || 0);
            } else if (t.category === TransactionCategory.Nolo) {
                locStats[t.allocationId].rent += (Number(t.amount) || 0);
            }
        });

        // 8. Calcola Overhead (Spese comuni senza sede)
        const totalYearRevenueGlobal = yearTrans
            .filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale)
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        const totalYearOverhead = yearTrans
            .filter(t => 
                t.type === TransactionType.Expense && 
                !t.allocationId && 
                !logisticCats.includes(t.category) && 
                t.category !== TransactionCategory.Nolo
            )
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        // 9. Assemblaggio Finale ROI
        return Array.from(locationsMap.entries())
            .map(([id, info]) => {
                const stats = locStats[id];
                const revenue = stats.revenue;
                
                // Ripartizione proporzionale Overhead
                const overheadQuota = (revenue / (totalYearRevenueGlobal || 1)) * totalYearOverhead;
                
                // Calcolo Logistica Sede
                const logisticsCost = stats.km * cpk;
                
                // Nolo: Usa il dato transazionale (stats.rent)
                const rentCost = stats.rent;

                return { 
                    name: info.name, color: info.color, 
                    revenue: revenue, 
                    costs: rentCost + logisticsCost + overheadQuota, 
                    studentBasedCosts: overheadQuota, 
                    costPerStudent: revenue > 0 ? (rentCost + logisticsCost + overheadQuota) / (revenue / 25) : 0, // 25€ stima lezione
                    costPerLesson: { 
                        value: stats.lessonCount > 0 ? (rentCost + logisticsCost) / stats.lessonCount : 0, 
                        min: 0, max: 0, avg: 0 
                    }, 
                    costPerStudentPerLesson: stats.lessonCount > 0 && revenue > 0 ? ((rentCost + logisticsCost) / stats.lessonCount) / (revenue / (stats.lessonCount * 25)) : 0,
                    breakdown: { rent: rentCost, logistics: logisticsCost, overhead: overheadQuota },
                    // Nuovi flag per il filtraggio card
                    hasActivity: revenue > 0 || rentCost > 0 || stats.lessonCount > 0
                };
            })
            // FILTRO INTEGRITA TEMPORALE: Mostra solo sedi con attività nell'anno
            .filter(sede => sede.hasActivity);

    }, [suppliers, transactions, enrollments, manualLessons, controllingYear]);

    const tabLabels: Record<string, string> = {
        overview: 'Panoramica',
        cfo: 'Strategia CFO',
        controlling: 'Controllo Sedi',
        transactions: 'Registro Cassa',
        invoices: 'Fatture',
        archive: 'Archivio SDI',
        quotes: 'Preventivi',
        fiscal_closure: 'Chiusura Fiscale'
    };

    const handlePrint = async (doc: Invoice | Quote) => { const client = clients.find(c => c.id === doc.clientId); await generateDocumentPDF(doc, 'invoiceNumber' in doc ? 'Fattura' : 'Preventivo', companyInfo, client); };
    const handleWhatsApp = (item: any) => { const c = clients.find(cl => cl.id === item.clientId); if (c?.phone) window.open(`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Le inviamo riferimento per il pagamento.')}`, '_blank'); else alert("Numero non trovato."); };
    const handleSaveTransaction = async (t: any) => { setLoading(true); try { if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t); setIsTransactionModalOpen(false); await fetchData(); } finally { setLoading(false); } };
    const handleEditItem = (item: any) => { if ('invoiceNumber' in item) { setEditingInvoice(item); setIsInvoiceModalOpen(true); } else if ('quoteNumber' in item) { setEditingQuote(item); setIsQuoteModalOpen(true); } else { setEditingTransaction(item); setIsTransactionModalOpen(true); } };
    const handleSaveInvoice = async (data: any) => { setLoading(true); try { if (editingInvoice?.id) await updateInvoice(editingInvoice.id, data); else await addInvoice(data); setIsInvoiceModalOpen(false); await fetchData(); } finally { setLoading(false); } };
    const handleSaveQuote = async (data: any) => { setLoading(true); try { if ('id' in data) await updateQuote(data.id, data); else await addQuote(data); setIsQuoteModalOpen(false); await fetchData(); } finally { setLoading(false); } };
    
    // Wrapper per gestire il refresh dopo il fix guidato
    const handleWizardFix = async (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', manualNum?: string, targetInvoiceIds?: string[], adjustment?: { amount: number, notes: string }, targetTransactionId?: string) => {
        await fixIntegrityIssue(issue, strategy, manualNum, targetInvoiceIds, adjustment, targetTransactionId);
        await fetchData();
    };

    const handleExecuteSync = async (month: number, year: number) => {
        setLoading(true);
        const result = await syncRentExpenses(month, year);
        alert(result);
        await fetchData();
        setLoading(false);
    };

    const confirmDelete = async () => { if (transactionToDelete) { setLoading(true); try { if (activeTab === 'transactions') await deleteTransaction(transactionToDelete); else if (activeTab === 'invoices' || activeTab === 'archive') await deleteInvoice(transactionToDelete); else if (activeTab === 'quotes') await deleteQuote(transactionToDelete); await fetchData(); } finally { setLoading(false) ; setTransactionToDelete(null); } } };
    const processConversion = async () => { if (quoteToConvert) { setLoading(true); try { await convertQuoteToInvoice(quoteToConvert.id); await fetchData(); } finally { setLoading(false); setQuoteToConvert(null); } } };

    return (
        <div className="animate-fade-in pb-20">
            {integrityIssues.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center animate-slide-up">
                    <div className="flex items-center gap-3 mb-3 md:mb-0"><div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl shadow-inner">🩺</div><div><h4 className="text-sm font-bold text-amber-900 uppercase tracking-tighter">Fiscal Doctor: {integrityIssues.length} Anomalie Rilevate</h4><p className="text-xs text-amber-700">Riconciliazione guidata tramite Smart Identity Matching.</p></div></div>
                    <button onClick={() => setIsFixWizardOpen(true)} className="md-btn md-btn-sm bg-amber-600 text-white font-bold px-6 shadow-md hover:bg-amber-700 transition-colors uppercase text-[10px]">Apri Medico Fiscale</button>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <div><h1 className="text-3xl font-black text-slate-900">Finanza Enterprise</h1><p className="text-slate-500 font-medium">Strategia, CFO Dashboard e documentazione fiscale.</p></div>
                <div className="flex gap-2">
                    <button onClick={() => setIsSyncModalOpen(true)} className="md-btn md-btn-flat bg-white border border-indigo-200"><RefreshIcon /> Noli</button>
                    <button onClick={async () => { setLoading(true); await reconcileTransactions(); await fetchData(); setLoading(false); }} className="md-btn md-btn-flat bg-white border"><RefreshIcon /> Sync</button>
                    <button onClick={() => { if (activeTab === 'quotes') setIsQuoteModalOpen(true); else if (activeTab === 'invoices') setIsInvoiceModalOpen(true); else setIsTransactionModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> {activeTab === 'quotes' ? 'Preventivo' : (activeTab === 'invoices' ? 'Fattura' : 'Voce')}</button>
                </div>
            </div>
            <div className="border-b border-gray-200 mb-8"><nav className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">{Object.keys(tabLabels).map(t => ( <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>{tabLabels[t].toUpperCase()}</button> ))}</nav></div>
            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="space-y-8">
                    {activeTab === 'overview' && <FinanceOverview stats={stats} transactions={transactions} invoices={invoices} />}
                    {activeTab === 'cfo' && <FinanceCFO stats={stats} simulatorData={simulatorData} reverseEngineering={reverseEngineering} targetMonthlyNet={targetMonthlyNet} lessonPrice={lessonPrice} setTargetMonthlyNet={setTargetMonthlyNet} setLessonPrice={setLessonPrice} />}
                    {activeTab === 'controlling' && <FinanceControlling roiSedi={roiSedi} onSelectLocation={setSelectedLocationROI} year={controllingYear} onYearChange={setControllingYear} />}
                    {activeTab === 'fiscal_closure' && <FiscalYearManager transactions={transactions} invoices={invoices} />}
                    {['transactions', 'invoices', 'archive', 'quotes'].includes(activeTab) && <FinanceListView activeTab={activeTab as any} transactions={transactions} invoices={invoices} quotes={quotes} suppliers={suppliers} filters={filters} setFilters={setFilters} onEdit={handleEditItem} onDelete={setTransactionToDelete} onPrint={handlePrint} onSeal={inv => updateInvoice(inv.id, {status: DocumentStatus.SealedSDI})} onWhatsApp={handleWhatsApp} onConvert={setQuoteToConvert} />}
                </div>
            )}
            {isSyncModalOpen && <Modal onClose={() => setIsSyncModalOpen(false)} size="lg"><RentSyncModal onClose={() => setIsSyncModalOpen(false)} onSync={handleExecuteSync} /></Modal>}
            {isFixWizardOpen && <Modal onClose={() => setIsFixWizardOpen(false)} size="lg"><FixWizard issues={integrityIssues} onFix={handleWizardFix} onClose={() => setIsFixWizardOpen(false)} /></Modal>}
            {isTransactionModalOpen && <Modal onClose={() => setIsTransactionModalOpen(false)} size="lg"><TransactionForm transaction={editingTransaction} suppliers={suppliers} onSave={handleSaveTransaction} onCancel={() => setIsTransactionModalOpen(false)} /></Modal>}
            {isInvoiceModalOpen && <Modal onClose={() => setIsInvoiceModalOpen(false)} size="2xl"><InvoiceEditForm invoice={editingInvoice || {} as Invoice} clients={clients} companyInfo={companyInfo} onSave={handleSaveInvoice} onCancel={() => setIsInvoiceModalOpen(false)} /></Modal>}
            {isQuoteModalOpen && <Modal onClose={() => setIsQuoteModalOpen(false)} size="lg"><QuoteForm quote={editingQuote} clients={clients} onSave={handleSaveQuote} onCancel={() => setIsTransactionModalOpen(false)} /></Modal>}
            {selectedLocationROI && <LocationDetailModal data={selectedLocationROI} onClose={() => setSelectedLocationROI(null)} />}
            <ConfirmModal isOpen={!!transactionToDelete} onClose={() => setTransactionToDelete(null)} onConfirm={confirmDelete} title="Elimina" message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={!!quoteToConvert} onClose={() => setQuoteToConvert(null)} onConfirm={processConversion} title="Converti" message="Convertire in fattura?" />
        </div>
    );
};

export default Finance;