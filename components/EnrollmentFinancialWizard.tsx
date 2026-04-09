
import React, { useState, useEffect, useMemo } from 'react';
import { Enrollment, Invoice, Transaction, Quote } from '../types';
import { getOrphanedFinancialsForClient, getQuotes, getInvoices, linkFinancialsToEnrollment, createGhostInvoiceForEnrollment } from '../services/financeService';
import Spinner from './Spinner';

interface EnrollmentFinancialWizardProps {
    enrollment: Enrollment;
    totalPaid: number;
    onClose: () => void;
    onOpenPayment: (prefillAmount?: number) => void;
    onRefresh: () => void;
}

const EnrollmentFinancialWizard: React.FC<EnrollmentFinancialWizardProps> = ({ enrollment, totalPaid, onClose, onOpenPayment, onRefresh }) => {
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
                    {/* NEW: Show Pending Ghosts Prominently */}
                    {linkedGhosts.length > 0 && (
                        <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <h4 className="font-black text-amber-900 text-sm uppercase flex items-center gap-2">📄 Pro-forma Rilevata</h4>
                                <p className="text-xs text-amber-700 mt-1">Esiste un documento di saldo di <strong>{linkedGhosts[0].totalAmount.toFixed(2)}€</strong> in attesa.</p>
                            </div>
                            <button onClick={() => onOpenPayment()} className="md-btn md-btn-sm bg-amber-500 text-white font-black shadow-md hover:bg-amber-600 uppercase tracking-wider">Incassa Ora</button>
                        </div>
                    )}

                    {enrollment.isQuoteBased ? (
                        <button onClick={() => setPath('installments')} className="md-card p-6 border-2 border-ep-blue-50 hover:border-ep-blue-600 transition-all text-left flex flex-col items-center justify-center group">
                            <div className="w-16 h-16 bg-ep-blue-600 text-white rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">🗓️</div>
                            <h4 className="font-black text-slate-800 text-lg">Piano Rateale</h4>
                            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed px-4">Gestisci le scadenze concordate nel preventivo per questo ente.</p>
                        </button>
                    ) : (
                        <button onClick={() => onOpenPayment()} className="md-card p-6 border-2 border-ep-blue-50 hover:border-ep-blue-600 transition-all text-left flex flex-col items-center justify-center group">
                            <div className="w-16 h-16 bg-ep-blue-600 text-white rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">💸</div>
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
                <div className="p-6 border-b bg-ep-blue-50 flex-shrink-0">
                    <h3 className="text-xl font-bold text-ep-blue-900">Monitoraggio Rate Progetto</h3>
                    <p className="text-xs text-ep-blue-700">Situazione debitoria basata sul preventivo.</p>
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
                                                        <button onClick={() => onOpenPayment(inst.amount)} className="md-btn md-btn-sm bg-ep-blue-600 text-white font-bold">Fattura Ora</button>
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
                        <div className="h-full bg-ep-blue-600" style={{ width: `${Math.min((totalPaid / packagePrice) * 100, 100)}%` }}></div>
                        <div className="h-full bg-ep-blue-400" style={{ width: `${Math.min((alreadyLinkedGhostsTotal / packagePrice) * 100, 100)}%` }}></div>
                        <div className="h-full bg-ep-blue-200 animate-pulse" style={{ width: `${Math.min((selectedOrphansTotal / packagePrice) * 100, 100)}%` }}></div>
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
                                    <label key={inv.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer ${selectedInvoiceIds.includes(inv.id) ? 'bg-ep-blue-50 border-ep-blue-300 ring-1 ring-ep-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={selectedInvoiceIds.includes(inv.id)} onChange={() => setSelectedInvoiceIds(prev => prev.includes(inv.id) ? prev.filter(x => x !== inv.id) : [...prev, inv.id])} className="rounded text-ep-blue-600" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">{inv.isGhost ? 'Ghost (Pro-forma)' : 'Fattura Reale'}</p>
                                            </div>
                                        </div>
                                        <span className="font-black text-slate-700">{Number(inv.totalAmount).toFixed(2)}€</span>
                                    </label>
                                ))}
                                {orphans.orphanTransactions.map(trn => (
                                    <label key={trn.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer ${selectedTransactionIds.includes(trn.id) ? 'bg-ep-blue-50 border-ep-blue-300 ring-1 ring-ep-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" checked={selectedTransactionIds.includes(trn.id)} onChange={() => setSelectedTransactionIds(prev => prev.includes(trn.id) ? prev.filter(x => x !== trn.id) : [...prev, trn.id])} className="rounded text-ep-blue-600" />
                                            <div><p className="text-sm font-bold text-slate-800">Cassa: {new Date(trn.date).toLocaleDateString()}</p><p className="text-[10px] text-slate-500 italic">"{trn.description}"</p></div>
                                        </div>
                                        <span className="font-black text-slate-700">{Number(trn.amount).toFixed(2)}€</span>
                                    </label>
                                ))}
                            </div>
                        </section>

                        {!enrollment.isQuoteBased && remainingGap > 0 && (
                            <section className="bg-ep-blue-900 text-white p-6 rounded-2xl border border-ep-blue-700 shadow-xl animate-slide-up">
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
                                    <input type="number" value={adjustmentAmount} onChange={e => setAdjustmentAmount(Number(e.target.value))} className="md-input font-black text-ep-blue-600" placeholder="0.00" />
                                    <button type="button" onClick={() => setAdjustmentAmount(Number((packagePrice - (totalPaid + selectedOrphansTotal + alreadyLinkedGhostsTotal)).toFixed(2)))} className="text-[10px] font-black text-ep-blue-600 mt-2 hover:underline uppercase">Auto-Pareggio</button>
                                </div>
                                <div className="md:col-span-8">
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

export default EnrollmentFinancialWizard;
