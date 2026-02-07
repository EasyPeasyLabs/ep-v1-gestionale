import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput, Lesson, IntegrityIssue, Enrollment, PaymentMethod, TransactionStatus, IntegrityIssueSuggestion, ClientType, EnrollmentStatus, InvoiceGap, RentAnalysisResult } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, analyzeRentExpenses, createRentTransactionsBatch, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice, reconcileTransactions, runFinancialHealthCheck, fixIntegrityIssue, getInvoiceNumberGaps, isInvoiceNumberTaken } from '../services/financeService';
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
import InstitutionalWizard from '../components/finance/InstitutionalWizard';
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

const FixWizard: React.FC<{
    issues: IntegrityIssue[];
    onFix: (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', manualNum?: string, targetInvoiceIds?: string[], adjustment?: { amount: number, notes: string }, targetTransactionId?: string, forceDate?: string) => Promise<void>;
    onClose: () => void;
}> = ({ issues, onFix, onClose }) => {
    const [step, setStep] = useState<'list' | 'invoice_wizard' | 'adjustment_confirm' | 'year_closed_override'>('list');
    const [activeIssue, setActiveIssue] = useState<IntegrityIssue | null>(null);
    const [pendingSelection, setPendingSelection] = useState<{ issue: IntegrityIssue, invoices: Invoice[], gap: number, strategy: 'link' | 'cash' | 'invoice', targetId?: string } | null>(null);
    const [gaps, setGaps] = useState<InvoiceGap[]>([]);
    const [selectedGap, setSelectedGap] = useState<number | null>(null);
    const [manualNum, setManualNum] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [loadingGaps, setLoadingGaps] = useState(false);
    const [fixingId, setFixingId] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    
    // Recovery State for Year Closed
    const [overrideDate, setOverrideDate] = useState(new Date().toISOString().split('T')[0]);
    const [retryContext, setRetryContext] = useState<any>(null); // Stores args to retry

    const handleSelectIssue = async (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link', targetInvoices?: Invoice[], targetTransactionId?: string) => {
        // Reset recovery state
        setOverrideDate(new Date().toISOString().split('T')[0]);
        setRetryContext(null);

        try {
            if (strategy === 'link' && issue.type === 'missing_transaction' && targetTransactionId) {
                setFixingId(issue.id);
                await onFix(issue, 'link', undefined, undefined, undefined, targetTransactionId);
                setSuccessId(issue.id);
                setTimeout(() => setSuccessId(null), 1800);
            }
            else if (strategy === 'link' && issue.type === 'missing_invoice' && targetTransactionId) {
                setFixingId(issue.id);
                await onFix(issue, 'link', undefined, undefined, undefined, targetTransactionId);
                setSuccessId(issue.id);
                setTimeout(() => setSuccessId(null), 1800);
            }
            else if (strategy === 'link' && targetInvoices) {
                const ids = targetInvoices.map(i => i.id);
                const suggestion = issue.suggestions?.find(s => s.invoices.length === targetInvoices.length && s.invoices.every(inv => ids.includes(inv.id)));
                const realGap = suggestion ? suggestion.gap : 0;
                
                if (realGap > 0.1) { 
                    setPendingSelection({ issue, invoices: targetInvoices, gap: realGap, strategy: 'link' }); 
                    setStep('adjustment_confirm'); 
                } else { 
                    setFixingId(issue.id); 
                    await onFix(issue, 'link', undefined, ids); 
                    setSuccessId(issue.id); 
                    setTimeout(() => setSuccessId(null), 1800); 
                }
            } 
            else if (strategy === 'cash') {
                setFixingId(issue.id); 
                await onFix(issue, strategy); 
                setSuccessId(issue.id); 
                setTimeout(() => setSuccessId(null), 1800); 
            } 
            else {
                setActiveIssue(issue); 
                setLoadingGaps(true); 
                setStep('invoice_wizard');
                const year = new Date(issue.date).getFullYear();
                const yearGaps = await getInvoiceNumberGaps(year);
                const issueDate = new Date(issue.date).getTime();
                const enrichedGaps = yearGaps.map(g => {
                    let rec = false;
                    if (g.prevDate && g.nextDate) { rec = issueDate >= new Date(g.prevDate).getTime() && issueDate <= new Date(g.nextDate).getTime(); } else if (!g.prevDate && g.nextDate) { rec = issueDate <= new Date(g.nextDate).getTime(); } else if (g.prevDate && !g.nextDate) { rec = issueDate >= new Date(g.prevDate).getTime(); }
                    return { ...g, recommended: rec };
                });
                setGaps(enrichedGaps); 
                setLoadingGaps(false);
            }
        } catch (e: any) {
            console.error("Fix Integrity Error:", e);
            if (e.message === "FISCAL_YEAR_CLOSED") {
                // Save context for retry
                setRetryContext({ issue, strategy, targetInvoices, targetTransactionId });
                setStep('year_closed_override');
            } else {
                alert("Errore: " + e.message);
            }
        } finally {
            setFixingId(null);
        }
    };

    const handleRetryWithOverride = async () => {
        if (!retryContext) return;
        setFixingId(retryContext.issue.id);
        try {
            if (retryContext.strategy === 'link' && pendingSelection) {
                // Special case for adjustment retry
                await handleConfirmAdjustment(overrideDate);
            } else if (retryContext.strategy === 'link' && retryContext.targetInvoices) {
                 const ids = retryContext.targetInvoices.map((i: any) => i.id);
                 await onFix(retryContext.issue, 'link', undefined, ids, undefined, undefined, overrideDate);
            } else if (retryContext.strategy === 'cash') {
                 await onFix(retryContext.issue, 'cash', undefined, undefined, undefined, undefined, overrideDate);
            }
            // Add other cases if needed (e.g. simple link)
            
            setSuccessId(retryContext.issue.id);
            setTimeout(() => { setSuccessId(null); setStep('list'); setRetryContext(null); }, 1800);
        } catch (e: any) {
            alert("Errore anche con data override: " + e.message);
        } finally {
            setFixingId(null);
        }
    };

    const handleConfirmAdjustment = async (dateOverride?: string) => {
        if (!pendingSelection) return;
        const { issue, invoices, gap } = pendingSelection;
        setFixingId(issue.id);
        try { 
            await onFix(
                issue, 
                'link', 
                undefined, 
                invoices.map(i => i.id), 
                { amount: gap, notes: `Abbuono Fiscale: ${gap}€.` },
                undefined,
                dateOverride
            ); 
            setSuccessId(issue.id); 
            setTimeout(() => { setSuccessId(null); setStep('list'); setPendingSelection(null); }, 1800); 
        } catch (e: any) { 
            if (e.message === "FISCAL_YEAR_CLOSED") {
                setRetryContext({ issue, strategy: 'link', pendingSelectionData: pendingSelection }); // Mark logic path
                setStep('year_closed_override');
            } else {
                alert("Errore regolarizzazione."); 
            }
        } finally {
            setFixingId(null); 
        }
    };

    useEffect(() => { if (manualNum && activeIssue) { const timer = setTimeout(async () => { const year = new Date(activeIssue.date).getFullYear(); const taken = await isInvoiceNumberTaken(year, parseInt(manualNum)); setIsDuplicate(taken); }, 500); return () => clearTimeout(timer); } }, [manualNum, activeIssue]);
    
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
            setTimeout(() => { setStep('list'); setActiveIssue(null); setSuccessId(null); }, 1800); 
        } catch (e: any) { 
            if (e.message === "FISCAL_YEAR_CLOSED") {
                 alert("Impossibile inserire fatture in un anno chiuso. Emetti una fattura ordinaria nell'anno corrente.");
            } else {
                alert("Errore salvataggio."); 
            }
        } finally {
            setFixingId(null); 
        }
    };

    return (
        <div className="flex flex-col h-[85vh]">
            <div className="p-6 border-b bg-amber-50 flex-shrink-0 flex justify-between items-center"><div><h3 className="text-xl font-bold text-amber-900">Fiscal Doctor</h3><p className="text-sm text-amber-700">Analisi Automatica & Smart Identity Matching.</p></div><span className="text-2xl">🩺</span></div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {step === 'list' ? (
                    <div className="space-y-4">
                        {issues.length === 0 ? <div className="text-center py-20 animate-fade-in"><div className="text-5xl mb-4">✨</div><h3 className="text-lg font-bold text-slate-800">Database Integro</h3><p className="text-sm text-slate-500">Nessuna anomalia rilevata.</p></div> : 
                        issues.map((issue, idx) => {
                            const isFixing = fixingId === issue.id;
                            const isSuccess = successId === issue.id;
                            return (
                                <div key={issue.id || idx} className={`bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${isSuccess ? 'border-green-500 bg-green-50' : ''}`}>
                                    {isSuccess && <div className="absolute inset-0 bg-green-500/10 backdrop-blur-[1px] flex items-center justify-center z-10 animate-fade-in"><div className="bg-white rounded-full p-4 shadow-xl text-green-600 flex items-center gap-2 font-black text-sm border border-green-200">✓ RICONCILIATO!</div></div>}
                                    <div className="flex justify-between items-start mb-3"><div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${issue.type === 'missing_invoice' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{issue.type === 'missing_invoice' ? 'Manca Copertura' : 'Manca Cassa'}</span><span className="text-xs font-mono text-gray-400">{new Date(issue.date).toLocaleDateString()}</span></div><div className="flex flex-col items-end"><span className="text-xl font-black text-slate-800">{(issue.amount ?? 0).toFixed(2)}€</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono">Gap Rilevato</span></div></div>
                                    <h4 className="font-bold text-gray-900 mb-1">{issue.description}</h4>
                                    <div className="grid grid-cols-2 gap-4 mt-4 text-[11px] bg-slate-50 p-4 rounded-xl border border-slate-100"><div className="col-span-1"><span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Soggetto / Allievo</span><span className="text-gray-700 font-bold block truncate">{issue.parentName || 'N/D'}</span><span className="text-gray-500 italic block">Ref: {issue.entityName}</span></div><div className="col-span-1"><span className="text-gray-400 font-bold uppercase block mb-0.5 tracking-tighter">Pacchetto Iscrizione</span><span className="text-gray-700 font-bold block truncate">{issue.subscriptionName || 'N/D'}</span><span className="text-gray-500 block">Dotazione: {issue.lessonsTotal || 0} lez.</span></div></div>
                                    {issue.suggestions && issue.suggestions.length > 0 && (
                                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-slide-up"><h5 className="text-[10px] font-black text-indigo-700 uppercase mb-2 flex items-center gap-2"><SparklesIcon /> Smart Identity Match</h5>
                                            <div className="space-y-3">{issue.suggestions.map((suggestion, gIdx) => {
                                                if (suggestion.transactionDetails) {
                                                    const t = suggestion.transactionDetails;
                                                    const tDate = new Date(t.date).toLocaleDateString();
                                                    return (
                                                        <div key={gIdx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-indigo-200 shadow-sm transition-all">
                                                            <div className="flex-1 min-w-0 pr-4">
                                                                <span className="text-[10px] font-black text-indigo-900 uppercase flex items-center gap-1">
                                                                    {suggestion.isPerfect ? <span className="text-green-500">●</span> : <span className="text-amber-500">●</span>}
                                                                    Transazione Cassa: {Number(t.amount).toFixed(2)}€
                                                                </span>
                                                                <div className="text-[11px] text-slate-700 mt-1 truncate font-medium">{tDate} - {t.description}</div>
                                                            </div>
                                                            <button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'link', undefined, t.id)} className="text-[10px] font-black text-white px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all uppercase disabled:opacity-50 mt-3 sm:mt-0">Collega</button>
                                                        </div>
                                                    );
                                                } else {
                                                    const invGroup = suggestion.invoices;
                                                    const totalVal = invGroup.reduce((s, i) => s + i.totalAmount, 0);
                                                    return (
                                                        <div key={gIdx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-indigo-200 shadow-sm transition-all"><div className="flex-1 min-w-0 pr-4"><span className="text-[10px] font-black text-indigo-900 uppercase">Somma Doc: {totalVal.toFixed(2)}€</span><div className="space-y-1 mt-1">{invGroup.map((inv, idx) => (<div key={inv.id} className="flex items-center gap-2 text-[11px] text-slate-700"><span className="font-bold font-mono">{inv.invoiceNumber}</span><span className="text-[9px] text-slate-400 italic">{inv.totalAmount.toFixed(2)}€</span></div>))}</div></div><button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'link', invGroup)} className="text-[10px] font-black text-white px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all uppercase disabled:opacity-50 mt-3 sm:mt-0">Collega Ora</button></div>
                                                    );
                                                }
                                            })}</div>
                                        </div>
                                    )}
                                    <div className="mt-5 flex gap-2">{issue.type === 'missing_invoice' ? (<><button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'invoice')} className="flex-1 md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50">{isFixing ? <Spinner /> : 'Genera Fattura'}</button><button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'cash')} className="flex-1 md-btn md-btn-sm bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 disabled:opacity-50">Solo Cassa (No Doc)</button></>) : (<button disabled={isFixing} onClick={() => handleSelectIssue(issue, 'invoice')} className="w-full md-btn md-btn-sm bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50">Risolvi Ora</button>)}</div>
                                </div>
                            );
                        })}
                    </div>
                ) : step === 'adjustment_confirm' ? (
                    <div className="animate-fade-in p-4 text-center py-10"><div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚖️</div><h3 className="text-xl font-black text-slate-800 mb-2">Conferma Regolazione</h3><p className="text-sm text-slate-500 mb-6 px-4">L'importo dei documenti è inferiore a quello dell'iscrizione. Vuoi registrare la differenza di <strong className="text-red-600">{pendingSelection?.gap.toFixed(2)}€</strong> come Abbuono Fiscale?</p><div className="flex flex-col gap-3"><button onClick={() => handleConfirmAdjustment()} disabled={fixingId === pendingSelection?.issue.id} className="w-full md-btn md-btn-raised bg-red-600 text-white font-bold uppercase tracking-widest text-xs">Sì, Registra Abbuono e Collega</button><button onClick={() => { setStep('list'); setPendingSelection(null); }} className="md-btn md-btn-flat">Indietro</button></div></div>
                ) : step === 'year_closed_override' ? (
                    <div className="animate-fade-in p-6 bg-amber-50 rounded-xl border border-amber-200 text-center">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔒</div>
                        <h3 className="text-lg font-black text-slate-800 mb-2">Anno Fiscale Chiuso</h3>
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            L'iscrizione originale risale a un periodo fiscale già chiuso. Non è possibile registrare movimenti retroattivi.
                            <br/><br/>
                            Vuoi registrare questa operazione come <strong>Recupero Crediti / Abbuono</strong> con data odierna?
                        </p>
                        
                        <div className="bg-white p-4 rounded-xl border border-amber-100 mb-6 text-left">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Data Contabile Registrazione</label>
                            <input 
                                type="date" 
                                value={overrideDate} 
                                onChange={e => setOverrideDate(e.target.value)} 
                                className="w-full md-input font-bold text-slate-800"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => { setStep('list'); setRetryContext(null); }} className="flex-1 md-btn md-btn-flat">Annulla</button>
                            <button onClick={handleRetryWithOverride} className="flex-1 md-btn md-btn-raised bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg">
                                Conferma e Procedi
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in"><div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100"><h4 className="text-sm font-bold text-indigo-900 mb-1">Recupero Numerazione: {activeIssue?.entityName}</h4><p className="text-xs text-indigo-700 leading-relaxed">Seleziona un progressivo mancante.</p></div>{loadingGaps ? <div className="py-10 flex justify-center"><Spinner /></div> : (<div className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Buchi Trovati</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{gaps.map(g => (<button key={g.number} onClick={() => { setSelectedGap(g.number); setManualNum(''); }} className={`p-3 border rounded-xl text-left transition-all ${selectedGap === g.number ? 'ring-4 ring-indigo-500 bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white border-gray-200 hover:border-indigo-300'}`}><span className="font-mono font-bold text-base">#{g.number}</span></button>))}</div></div></div>)}</div>
                )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between flex-shrink-0 z-10">{step === 'list' ? <button onClick={onClose} className="md-btn md-btn-flat">Chiudi Medico</button> : <button onClick={() => { setStep('list'); setPendingSelection(null); }} className="md-btn md-btn-flat">Indietro</button>}{step === 'invoice_wizard' && <button onClick={handleConfirmInvoice} disabled={(!selectedGap && !manualNum) || isDuplicate} className="md-btn md-btn-raised md-btn-primary px-8">Genera Documento Sanante</button>}</div>
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
    const [manualLessons, setManualLessons] = useState<Lesson[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
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
            const [t, i, q, e, s, c, ml, info] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getLessons(), getCompanyInfo()
            ]);
            setTransactions(t || []); setInvoices(i || []); setQuotes(q || []); setEnrollments(e || []); setSuppliers(s || []); setClients(c || []); setManualLessons(ml || []); setCompanyInfo(info || null);
            
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

    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted && new Date(t.date).getFullYear() === overviewYear);
        const revenue = activeT.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const expenses = activeT.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const taxable = revenue * COEFF_REDDITIVITA;
        const inps = taxable * INPS_RATE;
        const tax = taxable * TAX_RATE_STARTUP;
        let stampDutyTotal = 0;
        
        const yearInvoices = invoices.filter(inv => !inv.isDeleted && !inv.isGhost && new Date(inv.issueDate).getFullYear() === overviewYear);
        yearInvoices.forEach(inv => { if ((Number(inv.totalAmount) || 0) > 77.47) stampDutyTotal += 2; });
        
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
    }, [transactions, invoices, overviewYear]);

    const roiSedi = useMemo(() => {
        const enrollmentMap = new Map<string, { locationId: string, locationName: string, locationColor: string, isQuoteBased?: boolean }>();
        enrollments.forEach(enr => {
            if (enr.locationId && enr.locationId !== 'unassigned') {
                enrollmentMap.set(enr.id, { 
                    locationId: enr.locationId, 
                    locationName: enr.locationName, 
                    locationColor: enr.locationColor,
                    isQuoteBased: enr.isQuoteBased
                });
            }
        });

        const locationsMap = new Map<string, { id: string, name: string, color: string, distance: number }>();
        suppliers.forEach(s => s.locations.forEach(l => {
            locationsMap.set(l.id, { id: l.id, name: l.name, color: l.color, distance: l.distance || 0 });
        }));

        const locStats: Record<string, { revenue: number, rent: number, uniqueLessonKeys: Set<string> }> = {};
        locationsMap.forEach((_, id) => locStats[id] = { revenue: 0, rent: 0, uniqueLessonKeys: new Set<string>() });

        const globalUniqueLessons = new Set<string>();

        enrollments.forEach(enr => {
            if (!enr.isQuoteBased && enr.locationId && locStats[enr.locationId]) {
                (enr.appointments || []).forEach(app => {
                    if (new Date(app.date).getFullYear() === controllingYear && app.status === 'Present') {
                        const lessonKey = `${app.date.split('T')[0]}_${app.startTime}_${enr.locationId}`;
                        locStats[enr.locationId].uniqueLessonKeys.add(lessonKey);
                        globalUniqueLessons.add(lessonKey);
                    }
                });
            }
        });

        manualLessons.forEach(ml => {
            if (new Date(ml.date).getFullYear() === controllingYear) {
                let targetLocId = "";
                for (const [id, info] of locationsMap.entries()) {
                    if (info.name === ml.locationName) { targetLocId = id; break; }
                }

                if (targetLocId && locStats[targetLocId]) {
                    const lessonKey = `${ml.date.split('T')[0]}_${ml.startTime}_${targetLocId}`;
                    locStats[targetLocId].uniqueLessonKeys.add(lessonKey);
                    globalUniqueLessons.add(lessonKey);
                }
            }
        });

        let totalRevenueForYear = 0;
        let totalAutoCosts = 0;
        let totalCommonExpenses = 0;

        transactions.filter(t => !t.isDeleted && new Date(t.date).getFullYear() === controllingYear).forEach(t => {
            let targetLocId = t.allocationId;
            if (!targetLocId && t.relatedEnrollmentId) {
                targetLocId = enrollmentMap.get(t.relatedEnrollmentId)?.locationId;
            }

            if (t.type === TransactionType.Income) {
                if (targetLocId && locStats[targetLocId]) locStats[targetLocId].revenue += Number(t.amount);
                totalRevenueForYear += Number(t.amount);
            } else {
                if (t.category === TransactionCategory.Nolo && targetLocId && locStats[targetLocId]) {
                    locStats[targetLocId].rent += Number(t.amount);
                } else if ([TransactionCategory.RCA, TransactionCategory.BolloAuto, TransactionCategory.ManutenzioneAuto, TransactionCategory.ConsumoAuto, TransactionCategory.Carburante, TransactionCategory.BigliettoViaggio].includes(t.category)) {
                    totalAutoCosts += Number(t.amount);
                } else {
                    totalCommonExpenses += Number(t.amount);
                }
            }
        });

        const totalUniqueLessonsInYear = globalUniqueLessons.size || 1;

        return Array.from(locationsMap.entries()).map(([id, info]) => {
            const stats = locStats[id];
            const lessonsCount = stats.uniqueLessonKeys.size;
            
            const logisticsShare = totalUniqueLessonsInYear > 0 ? (totalAutoCosts / totalUniqueLessonsInYear) * lessonsCount : 0;
            const revenueShare = totalRevenueForYear > 0 ? (stats.revenue / totalRevenueForYear) : 0;
            const overheadShare = totalCommonExpenses * revenueShare;
            const totalCosts = stats.rent + logisticsShare + overheadShare;
            
            return {
                id: info.id,
                name: info.name,
                color: info.color,
                revenue: stats.revenue,
                costs: totalCosts,
                breakdown: {
                    rent: stats.rent,
                    logistics: logisticsShare,
                    overhead: overheadShare
                },
                costPerLesson: { value: lessonsCount > 0 ? totalCosts / lessonsCount : 0, min:0, max:0, avg:0 },
                costPerStudent: 0, 
                costPerStudentPerLesson: 0,
                studentBasedCosts: 0
            };
        });
    }, [enrollments, suppliers, transactions, controllingYear, manualLessons]);

    // Handlers
    const handleSaveTransaction = async (t: TransactionInput | Transaction) => {
        try { if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t as TransactionInput); setIsTransactionModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio transazione."); }
    };
    const handleDeleteTransaction = async () => { if (transactionToDelete) { await deleteTransaction(transactionToDelete); setTransactionToDelete(null); fetchData(); } };
    
    const handleSaveInvoice = async (inv: InvoiceInput) => {
        try { if (editingInvoice?.id) await updateInvoice(editingInvoice.id, inv); else await addInvoice(inv); setIsInvoiceModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio fattura."); }
    };
    const handleDeleteInvoice = async () => { if (invoiceToDelete) { await deleteInvoice(invoiceToDelete); setInvoiceToDelete(null); fetchData(); } };

    const handleSaveQuote = async (q: QuoteInput | Quote) => {
        try { if ('id' in q) await updateQuote(q.id, q); else await addQuote(q as QuoteInput); setIsQuoteModalOpen(false); fetchData(); } catch (e) { alert("Errore salvataggio preventivo."); }
    };
    const handleDeleteQuote = async () => { if (quoteToDelete) { await deleteQuote(quoteToDelete); setQuoteToDelete(null); fetchData(); } };

    const handleConvertQuote = async () => {
        if (!quoteToConvert) return;
        try {
            await convertQuoteToInvoice(quoteToConvert.id);
            alert("Preventivo convertito in fattura!");
            setQuoteToConvert(null);
            fetchData();
        } catch (e) {
            alert("Errore conversione: " + e);
        }
    };

    const handlePrint = async (item: Invoice | Quote) => {
        const type = 'invoiceNumber' in item ? 'Fattura' : 'Preventivo';
        const client = clients.find(c => c.id === item.clientId);
        await generateDocumentPDF(item, type, companyInfo, client);
    };

    const handleWhatsApp = (item: any) => {
        const number = item.invoiceNumber || item.quoteNumber || 'Documento';
        const text = `Ciao! Ecco il documento ${number}.`;
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    const handleSealSDI = async (item: Invoice) => {
        const code = prompt("Inserisci Codice SDI o PEC per confermare l'invio:", item.sdiId || item.sdiCode || '');
        if (code) {
            await updateInvoice(item.id, { status: DocumentStatus.SealedSDI, sdiId: code });
            fetchData();
        }
    };

    // New wrapper handlers to open modals
    const handleEditTransaction = (t: any) => {
        setEditingTransaction(t as Transaction);
        setIsTransactionModalOpen(true);
    };

    const handleEditInvoice = (i: any) => {
        setEditingInvoice(i as Invoice);
        setIsInvoiceModalOpen(true);
    };

    const handleEditQuote = (q: any) => {
        setEditingQuote(q as Quote);
        setIsQuoteModalOpen(true);
    };

    // Handle fiscal gap fill request from FiscalYearManager
    const handleGapFill = (year: number, number: number) => {
        // Formatta il numero es. FT-2025-005
        const forcedNumber = `FT-${year}-${String(number).padStart(3, '0')}`;
        
        // Crea una fattura parziale per l'editor
        const skeletonInvoice: any = {
            invoiceNumber: forcedNumber,
            issueDate: new Date().toISOString(),
            status: DocumentStatus.Draft,
            paymentMethod: PaymentMethod.BankTransfer,
            isGhost: false,
            isDeleted: false,
            items: [],
            totalAmount: 0
        };
        
        setEditingInvoice(skeletonInvoice);
        setIsInvoiceModalOpen(true);
    };

    // Calculate Simulator Data for CFO
    const simulatorData = useMemo(() => {
        const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        const monthlySavings = (stats.totalAll || 0) / 12;
        const savingsPlan = months.map(m => ({ month: m, amount: monthlySavings }));
        
        // Mock Tranches
        const totalTax = stats.totalAll || 0;
        const tranche1 = totalTax * 0.4; // Giugno (Saldo + I Acconto)
        const tranche2 = totalTax * 0.6; // Nov (II Acconto)

        return { savingsPlan, tranche1, tranche2 };
    }, [stats]);

    // Reverse Engineering Logic
    const reverseEngineering = useMemo(() => {
        const desiredAnnualNet = targetMonthlyNet * 12;
        // Formula: Revenue - Expenses - Taxes = Net
        // We assume expenses scale roughly or are fixed? Let's assume fixed expenses from current stats to simplify
        // Revenue * (1 - tax_rate) - Expenses = Net
        // Revenue = (Net + Expenses) / (1 - tax_rate_approx)
        
        // Approx Tax Rate on Revenue (Forfettario 5% + INPS ~26% on 78% profitability)
        // Effective Tax Load ~ 24% of Revenue
        const effectiveTaxRate = 0.24; 
        
        const grossNeeded = (desiredAnnualNet + stats.expenses) / (1 - effectiveTaxRate);
        const gap = Math.max(0, grossNeeded - stats.revenue);
        
        // Unit Economics
        const totalLessons = enrollments.reduce((acc, enr) => acc + (enr.status === EnrollmentStatus.Active ? enr.lessonsTotal : 0), 0);
        const activeStudents = enrollments.filter(e => e.status === EnrollmentStatus.Active).length;
        const avgPricePerLesson = totalLessons > 0 ? (stats.revenue / totalLessons) : 0; // Very rough
        
        // Advice generation
        let advice = "Sei sulla buona strada.";
        if (gap > 0) {
            advice = `Per raggiungere ${targetMonthlyNet}€ netti al mese, ti mancano circa ${gap.toLocaleString()}€ di fatturato annuo.`;
        }

        const studentsNeeded = activeStudents > 0 ? Math.ceil(gap / (stats.revenue / activeStudents)) : 0;
        const recommendedPrice = totalLessons > 0 ? (grossNeeded / totalLessons) : 0;

        return { grossNeeded, gap, advice, studentsNeeded, recommendedPrice, realAveragePrice: avgPricePerLesson };
    }, [stats, targetMonthlyNet, enrollments]);

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Finanza</h1>
                    <p className="text-gray-500">Controllo di gestione e fatturazione.</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'transactions' && <button onClick={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /> <span className="ml-2">Nuova Voce</span></button>}
                    {activeTab === 'invoices' && <button onClick={() => { setEditingInvoice({} as Invoice); setIsInvoiceModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary flex items-center"><PlusIcon /> <span className="ml-2">Nuova Fattura</span></button>}
                    {activeTab === 'quotes' && <button onClick={() => { setEditingQuote(null); setIsQuoteModalOpen(true); }} className="md-btn md-btn-raised md-btn-primary flex items-center"><PlusIcon /> <span className="ml-2">Nuovo Preventivo</span></button>}
                    
                    {integrityIssues.length > 0 && <button onClick={() => setIsFixWizardOpen(true)} className="md-btn md-btn-sm bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 animate-pulse">🩺 {integrityIssues.length} Anomalie</button>}
                    {showRentAlert && <button onClick={() => setIsSyncModalOpen(true)} className="md-btn md-btn-sm bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200">🏠 Noli da Saldare</button>}
                </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6 -mx-4 md:mx-0">
                <nav className="flex space-x-2 overflow-x-auto scrollbar-hide px-4 md:px-0 pb-1">
                    {Object.entries(TAB_LABELS).map(([key, label]) => (
                        <button key={key} onClick={() => setActiveTab(key as any)} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>
                            {label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content based on activeTab */}
            {activeTab === 'overview' && <FinanceOverview stats={stats} transactions={transactions} invoices={invoices} overviewYear={overviewYear} setOverviewYear={setOverviewYear} />}
            {activeTab === 'cfo' && <FinanceCFO stats={stats} simulatorData={simulatorData} reverseEngineering={reverseEngineering} targetMonthlyNet={targetMonthlyNet} setTargetMonthlyNet={setTargetMonthlyNet} />}
            {activeTab === 'controlling' && <FinanceControlling roiSedi={roiSedi} onSelectLocation={setSelectedLocationROI} year={controllingYear} onYearChange={setControllingYear} />}
            {(activeTab === 'transactions' || activeTab === 'invoices' || activeTab === 'archive' || activeTab === 'quotes') && (
                <FinanceListView 
                    activeTab={activeTab} 
                    transactions={transactions} 
                    invoices={invoices} 
                    quotes={quotes} 
                    suppliers={suppliers} 
                    enrollments={enrollments} // Pass enrollments
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
            {activeTab === 'fiscal_closure' && (
                <FiscalYearManager 
                    transactions={transactions} 
                    invoices={invoices} 
                    onRequestInvoiceCreation={handleGapFill}
                />
            )}

            {/* Modals */}
            {isSyncModalOpen && <Modal onClose={() => setIsSyncModalOpen(false)} size="xl"><RentSyncModal onClose={() => setIsSyncModalOpen(false)} onComplete={fetchData} enrollments={enrollments} /></Modal>}
            {isFixWizardOpen && <Modal onClose={() => setIsFixWizardOpen(false)} size="2xl"><FixWizard issues={integrityIssues} onFix={fixIntegrityIssue} onClose={() => { setIsFixWizardOpen(false); fetchData(); }} /></Modal>}
            
            {isTransactionModalOpen && <Modal onClose={() => setIsTransactionModalOpen(false)} size="lg"><TransactionForm transaction={editingTransaction} suppliers={suppliers} onSave={handleSaveTransaction} onCancel={() => setIsTransactionModalOpen(false)} /></Modal>}
            {isInvoiceModalOpen && <Modal onClose={() => setIsInvoiceModalOpen(false)} size="2xl"><InvoiceEditForm invoice={editingInvoice || {} as Invoice} clients={clients} companyInfo={companyInfo} onSave={handleSaveInvoice} onCancel={() => setIsInvoiceModalOpen(false)} /></Modal>}
            {isQuoteModalOpen && <Modal onClose={() => setIsQuoteModalOpen(false)} size="2xl"><QuoteForm quote={editingQuote} clients={clients} companyInfo={companyInfo} onSave={handleSaveQuote} onCancel={() => setIsQuoteModalOpen(false)} /></Modal>}
            {selectedLocationROI && <LocationDetailModal data={selectedLocationROI} onClose={() => setSelectedLocationROI(null)} />}
            
            {/* New: Institutional Activation Wizard */}
            {quoteToActivate && (
                <Modal onClose={() => setQuoteToActivate(null)} size="2xl">
                    <InstitutionalWizard 
                        quote={quoteToActivate} 
                        suppliers={suppliers}
                        onClose={() => setQuoteToActivate(null)}
                        onComplete={() => { setQuoteToActivate(null); fetchData(); alert("Progetto Attivato! Vai a Iscrizioni per gestirlo."); }}
                    />
                </Modal>
            )}

            <ConfirmModal isOpen={!!transactionToDelete} onClose={() => setTransactionToDelete(null)} onConfirm={handleDeleteTransaction} title="Elimina Transazione" message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={!!invoiceToDelete} onClose={() => setInvoiceToDelete(null)} onConfirm={handleDeleteInvoice} title="Elimina Fattura" message="Sei sicuro? Il numero verrà perso." isDangerous={true} />
            <ConfirmModal isOpen={!!quoteToDelete} onClose={() => setQuoteToDelete(null)} onConfirm={handleDeleteQuote} title="Elimina Preventivo" message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={!!quoteToConvert} onClose={() => setQuoteToConvert(null)} onConfirm={handleConvertQuote} title="Converti in Fattura" message="Verrà generata una nuova fattura dai dati del preventivo. Confermi?" />
        </div>
    );
};

export default Finance;