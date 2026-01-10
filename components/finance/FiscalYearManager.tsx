
import React, { useState, useEffect, useMemo } from 'react';
import { FiscalYear, Transaction, Invoice, DocumentStatus, TransactionType } from '../../types';
import { getFiscalYears, closeFiscalYear, reopenFiscalYear } from '../../services/fiscalYearService';
import { addInvoice, updateInvoice } from '../../services/financeService'; // Import per le azioni di fix
import Spinner from '../Spinner';
import ConfirmModal from '../ConfirmModal';
import HelpIcon from '../icons/HelpIcon';
import PlusIcon from '../icons/PlusIcon';
import RefreshIcon from '../icons/RestoreIcon';
import TrashIcon from '../icons/TrashIcon';

interface FiscalYearManagerProps {
    transactions: Transaction[];
    invoices: Invoice[];
}

const FiscalYearManager: React.FC<FiscalYearManagerProps> = ({ transactions, invoices }) => {
    const [years, setYears] = useState<FiscalYear[]>([]);
    const [loading, setLoading] = useState(true);
    // Default to current year, but at least 2025
    const currentActualYear = new Date().getFullYear();
    const startYear = 2025;
    const [selectedYear, setSelectedYear] = useState<number>(Math.max(currentActualYear, startYear));
    
    // State per le spiegazioni (accordion)
    const [activeHelp, setActiveHelp] = useState<number | null>(null);
    
    const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean, type: 'close' | 'reopen', year: number } | null>(null);

    const availableFiscalYears = useMemo(() => {
        const yearsList = [];
        const maxYear = Math.max(currentActualYear, startYear);
        for (let y = maxYear; y >= startYear; y--) {
            yearsList.push(y);
        }
        return yearsList;
    }, [currentActualYear]);

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
    const simulation = useMemo(() => {
        const start = new Date(selectedYear, 0, 1);
        const end = new Date(selectedYear, 11, 31, 23, 59, 59);

        const yearTrans = transactions.filter(t => !t.isDeleted && new Date(t.date) >= start && new Date(t.date) <= end);
        const yearInvoices = invoices.filter(i => !i.isDeleted && !i.isGhost && new Date(i.issueDate) >= start && new Date(i.issueDate) <= end);

        const revenue = yearTrans.filter(t => t.type === TransactionType.Income).reduce((acc, t) => acc + t.amount, 0);
        const expenses = yearTrans.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const profit = revenue - expenses;

        // Check Integrità Base
        const draftInvoices = yearInvoices.filter(i => i.status === DocumentStatus.Draft);
        const pendingInvoices = yearInvoices.filter(i => i.status === DocumentStatus.PendingSDI);
        
        const integrityIssues = [];
        if (draftInvoices.length > 0) integrityIssues.push(`${draftInvoices.length} fatture in bozza`);
        if (pendingInvoices.length > 0) integrityIssues.push(`${pendingInvoices.length} fatture in attesa SDI`);

        // --- ANALISI BUCHI NUMERAZIONE ---
        // 1. Estrai numeri e pulisci
        const numbers = yearInvoices
            .map(inv => {
                const parts = inv.invoiceNumber.split('-');
                // Formato atteso: FT-202X-NNN. Prendi l'ultima parte.
                const numPart = parts.length > 0 ? parts[parts.length - 1] : '0';
                return parseInt(numPart, 10);
            })
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        const gaps: number[] = [];
        if (numbers.length > 0) {
            // Check sequenza
            for (let i = 0; i < numbers.length - 1; i++) {
                if (numbers[i + 1] !== numbers[i] + 1) {
                    // Trovato un salto tra numbers[i] e numbers[i+1]
                    // Esempio: ho 5 e 7. Il buco è 6.
                    for (let missing = numbers[i] + 1; missing < numbers[i+1]; missing++) {
                        gaps.push(missing);
                    }
                }
            }
            // Check partenza (opzionale, se manca la 1)
            if (numbers[0] !== 1) {
                for (let missing = 1; missing < numbers[0]; missing++) {
                    gaps.push(missing);
                }
            }
        }
        
        // Ordina i buchi
        gaps.sort((a, b) => a - b);

        if (gaps.length > 0) {
            integrityIssues.push(`SALTATA NUMERAZIONE: Mancano le fatture n. ${gaps.join(', ')}`);
        }

        return { revenue, expenses, profit, integrityIssues, docCount: yearInvoices.length, transCount: yearTrans.length, gaps };
    }, [selectedYear, transactions, invoices]);

    const existingYearRecord = years.find(y => y.year === selectedYear);
    const isClosed = existingYearRecord?.status === 'CLOSED';
    const canClose = selectedYear < new Date().getFullYear(); // Solo anni passati

    const toggleHelp = (id: number) => {
        setActiveHelp(prev => prev === id ? null : id);
    };

    const handleExecuteAction = async () => {
        if (!confirmAction) return;
        setLoading(true);
        try {
            if (confirmAction.type === 'close') {
                await closeFiscalYear(confirmAction.year, {
                    totalRevenue: simulation.revenue,
                    totalExpenses: simulation.expenses,
                    netProfit: simulation.profit,
                    taxes: 0 
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

    // Placeholder actions for the fix buttons (Logic backend explained in chat, here just alerts)
    const handleFixGap = (method: 'fill' | 'shift' | 'void', gapNumber: number) => {
        if (method === 'fill') {
            alert(`Apertura form creazione fattura forzata al numero ${gapNumber}... (Mock)`);
        } else if (method === 'shift') {
            alert(`Avvio procedura rinumerazione a cascata per coprire il buco ${gapNumber}... (Mock)`);
        } else if (method === 'void') {
            if(confirm(`Creare una fattura tecnica annullata numero ${gapNumber}?`)) {
                alert(`Generata fattura ${gapNumber} con importo 0€ e stato Annullata.`);
            }
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
                            {availableFiscalYears.map(y => (
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
                                    if (simulation.integrityIssues.length > 0) return alert("Risolvi prima i problemi elencati sotto.");
                                    setConfirmAction({ isOpen: true, type: 'close', year: selectedYear });
                                }}
                                disabled={!canClose}
                                className={`md-btn md-btn-raised w-full ${!canClose ? 'bg-gray-300 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                            >
                                {canClose ? `Chiudi e Sigilla ${selectedYear}` : "Anno Corrente (Non Chiudibile)"}
                            </button>
                        )}
                        {simulation.integrityIssues.length > 0 && !isClosed && (
                            <p className="text-xs text-red-500 mt-2 text-center font-bold animate-pulse">⚠️ {simulation.integrityIssues.length} anomalie rilevate</p>
                        )}
                    </div>
                </div>
            </div>

            {/* SEZIONE GESTIONE BUCHI (Visibile solo se ci sono buchi) */}
            {simulation.gaps.length > 0 && !isClosed && (
                <div className="md-card p-6 bg-amber-50 border border-amber-200 shadow-sm rounded-xl">
                    <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2 mb-4">
                        ⚠️ Anomalie Sequenza Rilevate
                    </h3>
                    <p className="text-sm text-amber-700 mb-6">
                        È stata rilevata un'interruzione nella numerazione progressiva delle fatture. 
                        <strong>Mancano i numeri: {simulation.gaps.join(', ')}</strong>. 
                        Per procedere alla chiusura fiscale è necessario risolvere l'anomalia.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* OPZIONE 1: RIEMPIMENTO */}
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm relative">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
                                    <PlusIcon /> Recupero Manuale
                                </h4>
                                <button onClick={() => toggleHelp(1)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                    <HelpIcon />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Crea una nuova fattura usando il numero mancante.</p>
                            
                            {activeHelp === 1 && (
                                <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-indigo-900 text-white text-xs p-3 rounded-lg shadow-xl mx-2 animate-fade-in-down">
                                    <strong className="block mb-1 text-indigo-200 uppercase">Dettaglio Opzione</strong>
                                    Ideale se devi ancora emettere una fattura per quel periodo. 
                                    Il sistema apre l'editor forzando il numero mancante (es. #{simulation.gaps[0]}).
                                    <br/><br/>
                                    <span className="text-yellow-300">ATTENZIONE:</span> La data dovrà essere coerente con la sequenza cronologica (tra la fattura precedente e quella successiva).
                                </div>
                            )}

                            <button 
                                onClick={() => handleFixGap('fill', simulation.gaps[0])}
                                className="w-full md-btn md-btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold"
                            >
                                Usa #{simulation.gaps[0]}
                            </button>
                        </div>

                        {/* OPZIONE 2: SLITTAMENTO */}
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm relative">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
                                    <RefreshIcon /> Rinumera
                                </h4>
                                <button onClick={() => toggleHelp(2)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                                    <HelpIcon />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Sposta indietro le successive per chiudere il buco.</p>

                            {activeHelp === 2 && (
                                <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-indigo-900 text-white text-xs p-3 rounded-lg shadow-xl mx-2 animate-fade-in-down">
                                    <strong className="block mb-1 text-indigo-200 uppercase">Dettaglio Opzione</strong>
                                    Consigliato se hai creato fatture successive in Bozza per errore saltando un numero.
                                    Il sistema rinomina automaticamente a cascata (es. la #8 diventa #7, la #9 diventa #8).
                                    <br/><br/>
                                    <span className="text-yellow-300">ATTENZIONE:</span> Disponibile solo se le fatture successive non sono ancora state inviate o sigillate SDI.
                                </div>
                            )}

                            <button 
                                onClick={() => handleFixGap('shift', simulation.gaps[0])}
                                className="w-full md-btn md-btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold"
                            >
                                Compatta Numeri
                            </button>
                        </div>

                        {/* OPZIONE 3: TAPPO */}
                        <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm relative">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-red-700 text-sm flex items-center gap-2">
                                    <TrashIcon /> Giustificativo
                                </h4>
                                <button onClick={() => toggleHelp(3)} className="text-gray-400 hover:text-red-600 transition-colors">
                                    <HelpIcon />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Crea una fattura tecnica annullata a 0€.</p>

                            {activeHelp === 3 && (
                                <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-red-900 text-white text-xs p-3 rounded-lg shadow-xl mx-2 animate-fade-in-down">
                                    <strong className="block mb-1 text-red-200 uppercase">Dettaglio Opzione</strong>
                                    Soluzione di emergenza. Il sistema genera una fattura tecnica a importo 0€ col numero mancante, la marca immediatamente come "Annullata" e inserisce una nota giustificativa interna.
                                    <br/><br/>
                                    Serve a garantire la continuità numerica richiesta dal fisco senza alterare i bilanci.
                                </div>
                            )}

                            <button 
                                onClick={() => handleFixGap('void', simulation.gaps[0])}
                                className="w-full md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold"
                            >
                                Annulla #{simulation.gaps[0]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
