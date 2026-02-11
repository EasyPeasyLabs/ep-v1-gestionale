
import React, { useMemo, useState, useEffect } from 'react';
import CalculatorIcon from '../icons/CalculatorIcon';
import SparklesIcon from '../icons/SparklesIcon';

interface FinanceCFOProps {
    stats: any;
    simulatorData: any;
    reverseEngineering: any;
    targetMonthlyNet: number;
    setTargetMonthlyNet: (v: number) => void;
    year: number;
    onYearChange: (year: number) => void;
    currentBankBalance?: number; // Prop esistente che contiene il dato dal DB
    onUpdateBankBalance?: (val: number) => void; // Funzione per salvare
}

// Local Tooltip Component for educational context
const FiscalTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-1 align-middle">
        <span className="cursor-help text-slate-400 text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-colors">?</span>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center leading-snug">
            {text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const FinanceCFO: React.FC<FinanceCFOProps> = ({ 
    stats, simulatorData, reverseEngineering, 
    targetMonthlyNet, setTargetMonthlyNet,
    year, onYearChange,
    currentBankBalance = 0,
    onUpdateBankBalance
}) => {
    
    // Local state for the input to prevent jitters, syncs with prop
    const [localBankBalance, setLocalBankBalance] = useState(currentBankBalance);

    useEffect(() => {
        setLocalBankBalance(currentBankBalance);
    }, [currentBankBalance]);

    const handleBalanceBlur = () => {
        if (onUpdateBankBalance && localBankBalance !== currentBankBalance) {
            onUpdateBankBalance(localBankBalance);
        }
    };

    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear + 1; y >= 2025; y--) {
            years.push(y);
        }
        return years;
    }, []);

    // Calcolo Liquidità Reale (Registro App) - Solo per riferimento
    const appLiquidity = (stats.cashRevenue || 0) - (stats.expenses || 0);
    
    // NUOVO CALCOLO SOSTENIBILITA': Basato su Disponibilità Reale C/C inserita manualmente
    const targetReserve = simulatorData.totalTarget || 0;
    const realDifference = localBankBalance - targetReserve;
    const coveragePercent = targetReserve > 0 ? (localBankBalance / targetReserve) * 100 : 0;

    // Helper formatter
    const fmt = (n: number) => n?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Calcolo rata mensile per la prima tranche (6 rate)
    const installmentT1 = (simulatorData.tranche1 || 0) / 6;

    return (
        <div className="space-y-8 animate-slide-up pb-10 max-w-6xl mx-auto">
            
            {/* Header / Selector */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-black text-slate-800">Cantiere Fiscale Start-up</h3>
                    <p className="text-xs text-gray-500">Analisi regime forfettario 5% per l'anno {year}</p>
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl">
                    <span className="text-xs font-bold text-indigo-400 uppercase">Anno:</span>
                    <select 
                        value={year} 
                        onChange={(e) => onYearChange(Number(e.target.value))} 
                        className="bg-transparent font-black text-indigo-800 outline-none cursor-pointer"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* --- CARD 1: FISCAL FLOW DASHBOARD (REDESIGNED) --- */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header Card */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <CalculatorIcon /> Proiezione Fiscale {year}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                        Regime Forfettario Start-up (5%)
                    </span>
                </div>

                <div className="p-6 space-y-8">
                    
                    {/* A. PLAFOND GAUGE (Based on Invoiced) */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Utilizzo Plafond</p>
                                <p className="text-xs text-slate-500 font-medium">Limite: <strong>85.000,00€</strong> (su Fatturato)</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-lg font-black ${stats.progress > 85 ? 'text-red-500' : stats.progress > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {stats.progress.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-1000 ease-out relative"
                                style={{ width: `${Math.min(stats.progress, 100)}%` }}
                            >
                                {/* Glare effect */}
                                <div className="absolute top-0 left-0 w-full h-[50%] bg-white/30"></div>
                            </div>
                            {/* Marker 85k */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 opacity-20" style={{ right: '0' }}></div>
                        </div>
                        <p className="text-[10px] text-right text-slate-400 mt-1 font-medium">
                            {stats.progress < 100 
                                ? `Hai ancora spazio per ${fmt(85000 - (stats.invoicedRevenue || 0))}€` 
                                : "⚠️ Plafond superato!"}
                        </p>
                    </div>

                    {/* B. THE FUNNEL: INVOICED REVENUE -> TAXABLE */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 relative">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                            
                            {/* Input: Fatturato FISCALE (invoicedRevenue) */}
                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1 justify-center md:justify-start">
                                    Base Imponibile Fatturata <FiscalTooltip text="Somma delle sole fatture reali emesse e sigillate (SDI). È la base legale per il calcolo tasse." />
                                </p>
                                <p className="text-3xl font-black text-indigo-900">{fmt(stats.invoicedRevenue)}€</p>
                                <p className="text-[10px] text-slate-400 mt-1">Totale fatture emesse (SDI)</p>
                            </div>

                            {/* The Filter */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="bg-white border-2 border-indigo-100 px-4 py-1.5 rounded-full shadow-sm text-center relative z-10">
                                    <span className="block text-[10px] font-black text-slate-400 uppercase">Coeff. Redditività</span>
                                    <span className="text-lg font-black text-slate-700">78%</span>
                                </div>
                                {/* Visual Connector Line */}
                                <div className="hidden md:block w-32 h-0.5 bg-indigo-100 absolute top-1/2 -z-10"></div>
                            </div>

                            {/* Output: Imponibile Lordo */}
                            <div className="text-center md:text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Imponibile Lordo</p>
                                <p className="text-3xl font-black text-slate-800">{fmt(stats.taxable)}€</p>
                                <p className="text-[10px] text-slate-400 mt-1">Base di calcolo INPS</p>
                            </div>
                        </div>
                        
                        {/* Note on difference Cash vs Invoice */}
                        {Math.abs((stats.cashRevenue || 0) - (stats.invoicedRevenue || 0)) > 5 && (
                             <div className="mt-6 text-center border-t border-slate-200 pt-4">
                                <div className="inline-flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 text-left md:text-center">
                                    <span className="text-xl">⚠️</span>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide mb-0.5">Discrepanza Rilevata</p>
                                        <p className="text-xs text-amber-800 leading-snug">
                                            L'incassato reale (Cassa) è <strong>{fmt(stats.cashRevenue)}€</strong>.
                                            {stats.cashRevenue > stats.invoicedRevenue 
                                                ? " Hai incassato più di quanto fatturato (Emetti fatture mancanti)." 
                                                : " Hai fatturato più di quanto incassato (Crediti da riscuotere)."}
                                        </p>
                                    </div>
                                </div>
                             </div>
                        )}
                    </div>

                    {/* C. LIABILITY BREAKDOWN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-black text-orange-800 uppercase flex items-center gap-1">
                                    INPS (Gest. Separata) <FiscalTooltip text="26,23% sull'Imponibile Lordo" />
                                </p>
                                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-orange-400">26,23%</span>
                            </div>
                            <p className="text-2xl font-black text-orange-600">{fmt(stats.inps)}€</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-black text-red-800 uppercase flex items-center gap-1">
                                    Imposta Sostitutiva <FiscalTooltip text="5% (Start-up) sull'Imponibile Netto (Lordo - INPS)" />
                                </p>
                                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-red-400">5%</span>
                            </div>
                            <p className="text-2xl font-black text-red-600">{fmt(stats.tax)}€</p>
                        </div>
                    </div>

                    {/* D. FINAL SUMMARY */}
                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">Totale Tasse Stimate (Anno {year})</p>
                        <p className="text-3xl font-black text-slate-800">{fmt(stats.totalLiability)}€</p>
                    </div>
                </div>
            </div>

            {/* --- CARD 2: LIQUIDITY SIMULATOR (Using Cash for Sustainability) --- */}
            <div className="bg-slate-900 text-white rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 md:p-8">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                        <SparklesIcon /> Simulatore Accantonamento
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LEFT COLUMN: Piano Rateale Tasse (UNCHANGED) */}
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Piano Pagamenti {year+1}</p>
                            
                            {/* Tranche 1 */}
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <p className="text-xs font-bold text-indigo-300 uppercase mb-1">Giugno {year+1}</p>
                                        <p className="text-[10px] text-slate-400">Saldo {year} + I Acconto {year+1}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white">{fmt(simulatorData.tranche1)}€</p>
                                        <p className="text-[10px] text-indigo-200 mt-1">Totale dovuto</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Rateizzabile in 6 rate (Giu-Nov)</span>
                                        <span className="text-sm font-bold text-indigo-400">{fmt(installmentT1)}€ / mese</span>
                                    </div>
                                    <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                        {['GIU','LUG','AGO','SET','OTT','NOV'].map(m => (
                                            <span key={m} className="text-[8px] font-mono bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">{m}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            </div>

                            {/* Tranche 2 */}
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                                <div className="flex justify-between items-end relative z-10">
                                    <div>
                                        <p className="text-xs font-bold text-teal-300 uppercase mb-1">Novembre {year+1}</p>
                                        <p className="text-xs text-slate-400">II Acconto {year+1}</p>
                                    </div>
                                    <p className="text-2xl font-black text-white">{fmt(simulatorData.tranche2)}€</p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-2">
                                    <span className="text-amber-500 text-xs">ℹ️</span>
                                    <p className="text-[10px] font-medium text-slate-400">Da versare in <strong>unica soluzione</strong></p>
                                </div>
                                <div className="absolute right-0 top-0 h-full w-1 bg-teal-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sostenibilità (UPDATED ORDER & LOGIC) */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Sostenibilità (Su Cassa Attuale)</p>
                                
                                {/* 1. Fabbisogno Fiscale (KPI Principale) */}
                                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 text-center">
                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Fabbisogno Fiscale Totale {year+1}</p>
                                    <p className="text-3xl font-black text-white">{fmt(simulatorData.totalTarget)}€</p>
                                </div>

                                {/* 2. Liquidità App (Riferimento) */}
                                <div className="flex justify-between text-xs mb-3 px-1">
                                    <span className="text-slate-500">Registro Cassa (App):</span>
                                    <span className="font-mono text-slate-400">{fmt(appLiquidity)}€</span>
                                </div>

                                {/* 3. Disponibilità C/C (Input Attivo) */}
                                <div className="bg-white/5 p-3 rounded-lg border border-white/10 mb-4 flex items-center justify-between">
                                    <label className="text-xs font-bold text-indigo-200">Disponibilità Reale C/C:</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={localBankBalance}
                                            onChange={(e) => setLocalBankBalance(Number(e.target.value))}
                                            onBlur={handleBalanceBlur}
                                            className="w-28 bg-white text-slate-900 font-bold text-right px-2 py-1 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <span className="text-white font-bold">€</span>
                                    </div>
                                </div>
                                
                                {/* 4. Barra Copertura & Stato (Calcolato su C/C) */}
                                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-2">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${coveragePercent >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} 
                                        style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                                    ></div>
                                </div>
                                <p className={`text-xs font-black text-right ${realDifference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {realDifference >= 0 ? `Coperto (+${fmt(realDifference)}€)` : `Scoperto (${fmt(realDifference)}€)`}
                                </p>
                            </div>

                            {/* 5. Suggerimento Accantonamento (Footer) */}
                            <div className="bg-indigo-900/50 p-4 rounded-xl border border-indigo-500/30">
                                <p className="text-[10px] font-bold text-indigo-300 uppercase mb-2">Suggerimento Accantonamento</p>
                                <p className="text-sm font-medium text-slate-200 leading-snug">
                                    Per non avere sorprese, dovresti mettere da parte <strong className="text-white bg-indigo-600 px-1.5 rounded">{fmt(simulatorData.savingsPlan[0].amount)}€</strong> ogni mese.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CARD 3: REVERSE ENGINEERING 2.0 --- */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                            🚀 Reverse Engineering
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">Strategia di crescita basata sul tuo obiettivo di reddito.</p>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* AREA A: OBIETTIVO */}
                    <div className="space-y-6 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
                        <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">1. Il tuo stipendio netto ideale</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={targetMonthlyNet} 
                                    onChange={(e) => setTargetMonthlyNet(Number(e.target.value))}
                                    className="w-full bg-white text-2xl font-black text-indigo-900 outline-none border-b-2 border-indigo-200 focus:border-indigo-500 py-1 text-center"
                                />
                                <span className="text-xl font-bold text-indigo-300">€/mese</span>
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">3. Fatturato Annuo Necessario</p>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">{fmt(reverseEngineering.grossNeeded)}€</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">
                                Include tasse ({fmt((reverseEngineering.grossNeeded || 0) * 0.78 * 0.26)}€ stimati) e costi fissi attuali.
                            </p>
                        </div>
                    </div>

                    {/* AREA B: ANALISI PRICING */}
                    <div className="space-y-6 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Analisi Prezzo Lezione</p>
                        
                        <div className="flex items-center justify-between relative">
                            {/* Current */}
                            <div className="text-center">
                                <p className="text-xs font-bold text-slate-500 mb-1">Attuale</p>
                                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center border-4 border-white shadow-sm mx-auto">
                                    <span className="text-sm font-black text-slate-700">{fmt(reverseEngineering.currentAvgPrice)}€</span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex-1 px-2 text-center relative top-2">
                                {reverseEngineering.recommendedPrice > reverseEngineering.currentAvgPrice ? (
                                    <div className="flex flex-col items-center animate-pulse">
                                        <span className="text-[10px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded">Alza i prezzi</span>
                                        <div className="h-0.5 w-full bg-red-200 mt-1"></div>
                                        <span className="text-red-400 text-xl leading-none">➜</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black text-green-500 uppercase bg-green-50 px-2 py-0.5 rounded">Prezzo OK</span>
                                        <div className="h-0.5 w-full bg-green-200 mt-1"></div>
                                        <span className="text-green-400 text-xl leading-none">➜</span>
                                    </div>
                                )}
                            </div>

                            {/* Recommended */}
                            <div className="text-center">
                                <p className="text-xs font-bold text-indigo-500 mb-1">Consigliato</p>
                                <div className="bg-indigo-600 w-20 h-20 rounded-full flex items-center justify-center border-4 border-indigo-100 shadow-xl mx-auto transform scale-110">
                                    <span className="text-lg font-black text-white">{fmt(reverseEngineering.recommendedPrice)}€</span>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-center text-slate-400 italic mt-2">
                            (5. Prezzo necessario a parità di volumi attuali)
                        </p>
                    </div>

                    {/* AREA C: STRATEGIA */}
                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">4. Target Allievi</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-800">{reverseEngineering.studentsNeededTotal}</span>
                                <span className="text-sm font-bold text-slate-500">totali necessari</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${reverseEngineering.studentsNeeded > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {reverseEngineering.studentsNeeded > 0 ? `Te ne mancano ${reverseEngineering.studentsNeeded}` : 'Obiettivo Raggiunto!'}
                                </span>
                            </div>
                        </div>

                        {reverseEngineering.bestSubscription && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-amber-200 text-amber-800 text-[9px] font-black px-2 py-1 rounded-bl-lg uppercase">
                                    6. Best Performer
                                </div>
                                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-1">Prodotto Consigliato</p>
                                <p className="text-lg font-black text-slate-800">{reverseEngineering.bestSubscription.name}</p>
                                <p className="text-xs font-medium text-amber-700 mt-1">
                                    Rendimento: <strong>{fmt(reverseEngineering.bestSubscription.roi)}€</strong> / lezione
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FinanceCFO;
