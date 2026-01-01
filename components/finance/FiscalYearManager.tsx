
import React, { useState, useEffect } from 'react';
import { FiscalYear, Transaction, Invoice, DocumentStatus, TransactionType } from '../../types';
import { getFiscalYears, closeFiscalYear, reopenFiscalYear } from '../../services/fiscalYearService';
import Spinner from '../Spinner';
import ConfirmModal from '../ConfirmModal';

interface FiscalYearManagerProps {
    transactions: Transaction[];
    invoices: Invoice[];
}

const FiscalYearManager: React.FC<FiscalYearManagerProps> = ({ transactions, invoices }) => {
    const [years, setYears] = useState<FiscalYear[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() - 1);
    
    const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean, type: 'close' | 'reopen', year: number } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getFiscalYears();
            setYears(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Calcola simulazione per l'anno selezionato
    const simulation = React.useMemo(() => {
        const start = new Date(selectedYear, 0, 1);
        const end = new Date(selectedYear, 11, 31, 23, 59, 59);

        const yearTrans = transactions.filter(t => !t.isDeleted && new Date(t.date) >= start && new Date(t.date) <= end);
        const yearInvoices = invoices.filter(i => !i.isDeleted && !i.isGhost && new Date(i.issueDate) >= start && new Date(i.issueDate) <= end);

        const revenue = yearTrans.filter(t => t.type === TransactionType.Income).reduce((acc, t) => acc + t.amount, 0);
        const expenses = yearTrans.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const profit = revenue - expenses;

        // Check Integrità
        const draftInvoices = yearInvoices.filter(i => i.status === DocumentStatus.Draft);
        const pendingInvoices = yearInvoices.filter(i => i.status === DocumentStatus.PendingSDI);
        
        const integrityIssues = [];
        if (draftInvoices.length > 0) integrityIssues.push(`${draftInvoices.length} fatture in bozza`);
        if (pendingInvoices.length > 0) integrityIssues.push(`${pendingInvoices.length} fatture in attesa SDI`);

        return { revenue, expenses, profit, integrityIssues, docCount: yearInvoices.length, transCount: yearTrans.length };
    }, [selectedYear, transactions, invoices]);

    const existingYearRecord = years.find(y => y.year === selectedYear);
    const isClosed = existingYearRecord?.status === 'CLOSED';
    const canClose = selectedYear < new Date().getFullYear(); // Solo anni passati

    const handleExecuteAction = async () => {
        if (!confirmAction) return;
        setLoading(true);
        try {
            if (confirmAction.type === 'close') {
                await closeFiscalYear(confirmAction.year, {
                    totalRevenue: simulation.revenue,
                    totalExpenses: simulation.expenses,
                    netProfit: simulation.profit,
                    taxes: 0 // Placeholder, calcolo reale nel service se necessario
                });
            } else {
                await reopenFiscalYear(confirmAction.year);
            }
            await loadData();
        } catch (e) {
            alert("Errore operazione: " + e);
        } finally {
            setLoading(false);
            setConfirmAction(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="md-card p-6 bg-white border-l-4 border-slate-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            🔐 Chiusura Fiscale
                        </h2>
                        <p className="text-sm text-slate-500">Cristallizza i dati contabili per evitare modifiche accidentali.</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-600">Anno:</span>
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(Number(e.target.value))} 
                            className="md-input border rounded px-3 py-1 font-bold w-32"
                        >
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase">STATO ESERCIZIO</p>
                        {isClosed ? (
                            <div className="mt-2">
                                <span className="text-red-600 font-black text-lg flex items-center gap-2">🔒 CHIUSO</span>
                                <p className="text-xs text-slate-500 mt-1">da {existingYearRecord?.closedBy} il {new Date(existingYearRecord?.closedAt!).toLocaleDateString()}</p>
                            </div>
                        ) : (
                            <div className="mt-2">
                                <span className="text-green-600 font-black text-lg flex items-center gap-2">🔓 APERTO</span>
                                <p className="text-xs text-slate-500 mt-1">Dati modificabili</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase">BILANCIO {selectedYear}</p>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-sm"><span>Entrate:</span> <span className="font-bold text-green-700">{simulation.revenue.toFixed(2)}€</span></div>
                            <div className="flex justify-between text-sm"><span>Uscite:</span> <span className="font-bold text-red-700">{simulation.expenses.toFixed(2)}€</span></div>
                            <div className="border-t pt-1 mt-1 flex justify-between text-sm font-black"><span>Utile:</span> <span>{simulation.profit.toFixed(2)}€</span></div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center items-center">
                        {isClosed ? (
                            <button 
                                onClick={() => setConfirmAction({ isOpen: true, type: 'reopen', year: selectedYear })}
                                className="md-btn md-btn-sm border border-slate-300 text-slate-600 hover:bg-slate-100 w-full"
                            >
                                Riapri Esercizio (Admin)
                            </button>
                        ) : (
                            <button 
                                onClick={() => {
                                    if (simulation.integrityIssues.length > 0) return alert("Risolvi prima i problemi: " + simulation.integrityIssues.join(", "));
                                    setConfirmAction({ isOpen: true, type: 'close', year: selectedYear });
                                }}
                                disabled={!canClose}
                                className={`md-btn md-btn-raised w-full ${!canClose ? 'bg-gray-300 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                            >
                                {canClose ? `Chiudi e Sigilla ${selectedYear}` : "Anno Corrente (Non Chiudibile)"}
                            </button>
                        )}
                        {simulation.integrityIssues.length > 0 && !isClosed && (
                            <p className="text-xs text-red-500 mt-2 text-center font-bold">⚠️ {simulation.integrityIssues.length} anomalie rilevate</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Storico */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-700 mb-4">Storico Esercizi Chiusi</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Anno</th>
                                <th className="px-6 py-3">Data Chiusura</th>
                                <th className="px-6 py-3 text-right">Fatturato</th>
                                <th className="px-6 py-3 text-right">Utile</th>
                                <th className="px-6 py-3 text-center">Stato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {years.filter(y => y.status === 'CLOSED').map(y => (
                                <tr key={y.id}>
                                    <td className="px-6 py-4 font-bold">{y.year}</td>
                                    <td className="px-6 py-4 text-slate-500">{new Date(y.closedAt!).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right font-mono">{y.snapshot?.totalRevenue.toFixed(2)}€</td>
                                    <td className="px-6 py-4 text-right font-mono">{y.snapshot?.netProfit.toFixed(2)}€</td>
                                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">LOCKED</span></td>
                                </tr>
                            ))}
                            {years.filter(y => y.status === 'CLOSED').length === 0 && (
                                <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">Nessun esercizio chiuso.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal 
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleExecuteAction}
                title={confirmAction?.type === 'close' ? `Chiudi Anno ${confirmAction.year}` : `Riapri Anno ${confirmAction?.year}`}
                message={confirmAction?.type === 'close' 
                    ? "Sei sicuro? Una volta chiuso, non potrai più modificare, aggiungere o eliminare transazioni e fatture di questo anno. Sarà tutto in sola lettura." 
                    : "Attenzione: Riaprire l'anno permette modifiche che potrebbero alterare i bilanci già depositati o inviati. Procedere?"}
                isDangerous={true}
                confirmText={confirmAction?.type === 'close' ? "Conferma Chiusura" : "Conferma Riapertura"}
            />
        </div>
    );
};

export default FiscalYearManager;
