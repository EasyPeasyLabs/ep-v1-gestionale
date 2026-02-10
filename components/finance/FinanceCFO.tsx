
import React, { useMemo } from 'react';
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
    year, onYearChange
}) => {
    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear + 1; y >= 2025; y--) {
            years.push(y);
        }
        return years;
    }, []);

    // Calcolo Liquidità Reale vs Target
    const currentLiquidity = (stats.revenue || 0) - (stats.expenses || 0);
    const targetReserve = simulatorData.totalTarget || 0;
    const difference = currentLiquidity - targetReserve;
    const coveragePercent = targetReserve > 0 ? (currentLiquidity / targetReserve) * 100 : 0;

    // Helper formatter
    const fmt = (n: number) => n?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                    
                    {/* A. PLAFOND GAUGE */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Utilizzo Plafond</p>
                                <p className="text-xs text-slate-500 font-medium">Limite: <strong>85.000,00€</strong></p>
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
                                ? `Hai ancora spazio per ${fmt(85000 - stats.revenue)}€` 
                                : "⚠️ Plafond superato!"}
                        </p>
                    </div>

                    {/* B. THE FUNNEL: REVENUE -> TAXABLE */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 relative">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                            
                            {/* Input: Fatturato */}
                            <div className="text-center md:text-left">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Fatturato Incassato</p>
                                <p className="text-3xl font-black text-indigo-900">{fmt(stats.revenue)}€</p>
                                <p className="text-[10px] text-slate-400 mt-1">Totale entrate dell'anno</p>
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
                    </div>

                    {/* C. THE DEBT GRID: INPS, TAX, STAMPS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* CARD INPS */}
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">INPS</span>
                                    <FiscalTooltip text="Gestione Separata INPS. Calcolata sul 100% dell'Imponibile Lordo." />
                                </div>
                                <p className="text-[10px] text-orange-800 font-medium mb-1">Aliquota <strong className="text-orange-900">26,23%</strong></p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-orange-900">{fmt(stats.inps)}€</p>
                                <p className="text-[9px] text-orange-700/60 font-medium mt-1">Deducibile l'anno prossimo</p>
                            </div>
                        </div>

                        {/* CARD IMPOSTA */}
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-100 rounded-full opacity-50 pointer-events-none"></div>
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Imposta</span>
                                    <FiscalTooltip text="Imposta Sostitutiva 5% (Start-up). Calcolata sull'Imponibile Netto (Lordo - INPS)." />
                                </div>
                                <p className="text-[10px] text-red-800 font-medium mb-1">Aliquota <strong className="text-red-900">5%</strong></p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-red-900">{fmt(stats.tax)}€</p>
                                <p className="text-[9px] text-red-700/60 font-medium mt-1">
                                    Su imp. netto: <strong>{fmt(stats.taxableNet)}€</strong>
                                </p>
                            </div>
                        </div>

                        {/* CARD BOLLI */}
                        <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-white text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-slate-200">Bolli</span>
                                    <FiscalTooltip text="Somma dei bolli virtuali da 2€ applicati su fatture superiori a 77,47€." />
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium mb-1">Fissi <strong className="text-slate-700">2,00€</strong></p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-700">{fmt(stats.stampDutyTotal)}€</p>
                                <p className="text-[9px] text-slate-400 font-medium mt-1">Non deducibili</p>
                            </div>
                        </div>
                    </div>

                    {/* D. FOOTER: THE BILL */}
                    <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <span className="text-xl">🧾</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Totale Debito Stimato</p>
                                <p className="text-xs text-slate-500">INPS + Imposta Sostitutiva</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-black text-white font-mono tracking-tight">{fmt(stats.totalLiability)}€</p>
                            {stats.stampDutyTotal > 0 && <p className="text-[10px] text-slate-400 mt-1">+ {fmt(stats.stampDutyTotal)}€ bolli</p>}
                        </div>
                    </div>

                </div>
            </div>

            {/* CARD 2: SCADENZE FISCALI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="md-card p-6 bg-white border border-gray-200 border-l-4 border-l-red-500 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-sm font-black text-red-700 uppercase tracking-widest">I Tranche (Giugno {year + 1})</h4>
                            <p className="text-[10px] text-gray-400 font-bold mt-1">SALDO {year} + 50% ACCONTO {year + 1}</p>
                        </div>
                        <div className="bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase">Il Salasso</div>
                    </div>
                    
                    <p className="text-3xl font-black text-slate-800 mb-6">{simulatorData.tranche1.toFixed(2)}€</p>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-gray-600">Piano Rateale (6 mesi)</span>
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">Opzionale</span>
                        </div>
                        <p className="text-sm text-gray-500">
                            Puoi dividere in 6 rate da: <strong className="text-slate-800">{(simulatorData.tranche1 / 6).toFixed(2)}€</strong>
                        </p>
                    </div>
                </div>

                <div className="md-card p-6 bg-white border border-gray-200 border-l-4 border-l-amber-500 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-sm font-black text-amber-700 uppercase tracking-widest">II Tranche (Novembre {year + 1})</h4>
                            <p className="text-[10px] text-gray-400 font-bold mt-1">50% ACCONTO {year + 1}</p>
                        </div>
                        <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-black uppercase">No Rate</div>
                    </div>
                    
                    <p className="text-3xl font-black text-slate-800 mb-6">{simulatorData.tranche2.toFixed(2)}€</p>

                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                        <p className="text-xs text-amber-800 font-medium">
                            ⚠️ Questa scadenza <strong>non è rateizzabile</strong>. Assicurati di avere la liquidità necessaria per l'autunno.
                        </p>
                    </div>
                </div>
            </div>

            {/* CARD 3: PIANO ACCANTONAMENTO */}
            <div className="md-card p-6 bg-slate-900 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-20 pointer-events-none -mr-16 -mt-16"></div>
                
                <h4 className="text-sm font-black text-indigo-300 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                    <span className="bg-white/10 p-1 rounded">💰</span> Piano Accantonamento Mensile
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10 mb-8">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Competenza {year}</p>
                        <p className="text-2xl font-black">{simulatorData.savingsPlan[0].competence.toFixed(2)}€</p>
                        <p className="text-[10px] text-slate-500 mt-1">Quota mensile per pagare il saldo attuale.</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Anticipo {year + 1}</p>
                        <p className="text-2xl font-black text-indigo-400">{simulatorData.savingsPlan[0].advance.toFixed(2)}€</p>
                        <p className="text-[10px] text-slate-500 mt-1">Quota mensile per coprire gli acconti futuri.</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                        <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Bonifico Mensile Suggerito</p>
                        <p className="text-3xl font-black text-white">{simulatorData.savingsPlan[0].amount.toFixed(2)}€</p>
                        <p className="text-[10px] text-slate-300 mt-2">
                            Da spostare sul conto risparmio ogni mese.
                        </p>
                    </div>
                </div>

                {/* --- SEZIONE CONTROLLO LIQUIDITÀ --- */}
                <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-4">
                            
                            {/* 1. Liquidità (Realtà) */}
                            <div>
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
                                    Liquidità Attuale Disponibile
                                </p>
                                <p className="text-3xl font-black text-white">
                                    {currentLiquidity.toFixed(2)}€
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Cassa generata nel {year} (Entrate - Uscite)
                                </p>
                            </div>

                            {/* 2. Target (Obiettivo) */}
                            <div className="text-right">
                                 <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                                    Riserva Target Totale
                                </p>
                                <p className="text-3xl font-black text-white">
                                    {targetReserve.toFixed(2)}€
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Fabbisogno per Giugno + Novembre
                                </p>
                            </div>
                        </div>

                        {/* 3. Bar / Verdict */}
                        <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                             {/* La barra mostra quanto della riserva è coperta dalla liquidità */}
                             <div 
                                className={`h-full transition-all duration-1000 ${difference >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                             ></div>
                        </div>
                        
                        <div className="mt-3 flex justify-between items-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                Verifica Sostenibilità
                            </p>
                            <div className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-2 ${difference >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {difference >= 0 ? (
                                    <><span>✓</span> Copertura Completa (+{difference.toFixed(0)}€)</>
                                ) : (
                                    <><span>⚠️</span> Mancano {Math.abs(difference).toFixed(2)}€</>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* CARD 4: REVERSE ENGINEERING DASHBOARD (STRATEGIA & OBIETTIVI) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden relative">
                
                {/* Header Card */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <SparklesIcon /> Reverse Engineering & Target
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-400 bg-white px-2 py-1 rounded border border-indigo-100">
                        Strategia Aziendale
                    </span>
                </div>

                <div className="p-6">
                    {/* Row 1: IL DRIVER (Obiettivo) */}
                    <div className="mb-8 text-center">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Il tuo Obiettivo: Stipendio Netto Mensile
                        </label>
                        <div className="relative inline-block w-full max-w-xs">
                            <input 
                                type="number" 
                                value={targetMonthlyNet} 
                                onChange={e => setTargetMonthlyNet(Number(e.target.value))} 
                                className="text-5xl font-black text-indigo-700 bg-transparent border-b-4 border-indigo-100 focus:border-indigo-500 outline-none w-full text-center pb-2 placeholder-indigo-200 transition-colors"
                                placeholder="3000"
                            />
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-indigo-200 pointer-events-none">€</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 font-medium">Inserisci quanto vuoi guadagnare pulito al mese.</p>
                    </div>

                    {/* Row 2: CONFRONTO PREZZI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prezzo Medio Attuale</p>
                            <p className="text-2xl font-black text-gray-600">{reverseEngineering.currentAvgPrice.toFixed(2)}€</p>
                            <p className="text-[9px] text-gray-400 mt-1">Calcolato sulle iscrizioni attive</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500 rounded-bl-3xl opacity-10"></div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Prezzo Consigliato</p>
                            <p className="text-2xl font-black text-indigo-700">{reverseEngineering.recommendedPrice.toFixed(2)}€</p>
                            <p className="text-[9px] text-indigo-400 mt-1">Per raggiungere l'obiettivo a parità di volumi</p>
                        </div>
                    </div>

                    {/* Row 3: KPI OPERATIVI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-center">
                        <div className="text-center md:text-left">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fatturato Lordo Annuo Necessario</p>
                            <p className="text-4xl font-black text-slate-800">{fmt(reverseEngineering.grossNeeded)}€</p>
                            <p className="text-xs text-slate-500 mt-2 font-medium">
                                Include copertura costi fissi ({fmt(stats.expenses)}€) e tasse stimate (~23%).
                            </p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Allievi Totali</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-slate-800">{reverseEngineering.studentsNeededTotal}</span>
                                <span className="text-sm font-bold text-slate-400">iscritti</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 text-center">
                                Mantenendo il prezzo attuale, ti servono {reverseEngineering.studentsNeededTotal} studenti a regime.
                                {reverseEngineering.studentsNeeded > 0 && <span className="block font-bold text-indigo-600 mt-1">(Te ne mancano {reverseEngineering.studentsNeeded})</span>}
                            </p>
                        </div>
                    </div>

                    {/* Footer: MOSSA VINCENTE */}
                    {reverseEngineering.bestSubscription && (
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-amber-400 text-indigo-900 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">La Mossa Vincente</span>
                                </div>
                                <h4 className="text-lg font-bold">
                                    Spingi il pacchetto: <span className="text-amber-300 font-black text-xl">"{reverseEngineering.bestSubscription.name}"</span>
                                </h4>
                                <p className="text-xs text-indigo-200 mt-1 opacity-80">
                                    È il prodotto con il miglior rapporto Prezzo/Lezioni (ROI {reverseEngineering.bestSubscription.roi.toFixed(2)}€/ora).
                                </p>
                            </div>
                            <div className="text-3xl">🚀</div>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
};

export default FinanceCFO;
