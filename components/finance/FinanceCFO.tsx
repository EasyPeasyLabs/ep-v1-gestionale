
import React from 'react';
import CalculatorIcon from '../icons/CalculatorIcon';
import SparklesIcon from '../icons/SparklesIcon';

interface FinanceCFOProps {
    stats: any;
    simulatorData: any;
    reverseEngineering: any;
    targetMonthlyNet: number;
    setTargetMonthlyNet: (v: number) => void;
}

const FinanceCFO: React.FC<FinanceCFOProps> = ({ 
    stats, simulatorData, reverseEngineering, 
    targetMonthlyNet, setTargetMonthlyNet 
}) => {
    const isUnderTarget = reverseEngineering.gap > 0;

    return (
        <div className="space-y-6 animate-slide-up pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Proiezione Fiscale */}
                <div className="md-card p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalculatorIcon /> Proiezione Fiscale</h3>
                        <span className="text-2xl font-black text-red-600">{(stats.totalAll ?? 0).toFixed(2)}€</span>
                    </div>
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>Plafond Regime Forfettario (85.000€)</span><span>{(stats.progress ?? 0).toFixed(1)}%</span></div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${stats.progress > 80 ? 'bg-red-500' : 'bg-slate-800'}`} style={{ width: `${Math.min(stats.progress ?? 0, 100)}%` }}></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-[9px] font-bold text-gray-400 uppercase">IMPONIBILE</p><p className="text-sm font-black">{(stats.taxable ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100"><p className="text-[9px] font-bold text-orange-400 uppercase">INPS</p><p className="text-sm font-black">{(stats.inps ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100"><p className="text-[9px] font-bold text-red-400 uppercase">IMPOSTA</p><p className="text-sm font-black">{(stats.tax ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100"><p className="text-[9px] font-bold text-blue-400 uppercase">TOTALE</p><p className="text-sm font-black">{(stats.totalInpsTax ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-[9px] font-bold text-gray-400 uppercase">BOLLI</p><p className="text-sm font-black">{(stats.stampDutyTotal ?? 0).toFixed(0)}€</p></div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Scadenze Fiscali Simulate (Scenario Start-up)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-[10px] font-bold text-red-700 uppercase">I Tranche (Giugno)</p>
                                <p className="text-xl font-black text-red-900">{(simulatorData.tranche1 ?? 0).toFixed(2)}€</p>
                                <p className="text-[9px] text-red-600 mt-1 italic">100% Saldo + 50% Acconto</p>
                            </div>
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-bold text-amber-700 uppercase">II Tranche (Novembre)</p>
                                <p className="text-xl font-black text-amber-900">{(simulatorData.tranche2 ?? 0).toFixed(2)}€</p>
                                <p className="text-[9px] text-red-600 mt-1 italic">50% Acconto</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Piano di Accantonamento Mensile */}
                <div className="md-card p-6 bg-slate-50 border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">💰 Piano Accantonamento</h3>
                    <p className="text-xs text-slate-500 mb-4 italic">Quota mensile suggerita per la riserva fiscale futura.</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {simulatorData.savingsPlan.map((p: any, i: number) => (
                            <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm">
                                <p className="text-[10px] font-black text-slate-400">{p.month}</p>
                                <p className="text-sm font-bold text-indigo-700">{(p.amount ?? 0).toFixed(0)}€</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 p-4 bg-indigo-600 text-white rounded-xl shadow-lg">
                        <p className="text-xs font-bold opacity-80 uppercase">Riserva Annuale Target</p>
                        <p className="text-3xl font-black">{(stats.totalAll ?? 0).toFixed(2)}€</p>
                        <div className="h-1 bg-white/20 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-white" style={{ width: '100%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reverse Engineering Re-Designed per risolvere OVERLAP */}
            <div className="md-card p-6 md:p-8 bg-white border-2 border-purple-100 rounded-3xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><SparklesIcon /> AI Reverse Engineering</h3>
                    <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-200">Motore Profitto v2</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 items-center">
                    {/* INPUT SECTION - 5 COLUMNS */}
                    <div className="lg:col-span-5 space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                Target Netto Desiderato (€/mese)
                            </label>
                            <div className="relative group">
                                <input 
                                    type="number" 
                                    value={targetMonthlyNet} 
                                    onChange={e => setTargetMonthlyNet(Number(e.target.value))} 
                                    className="w-full text-5xl md:text-6xl font-black p-0 bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-200" 
                                    placeholder="0"
                                />
                                <div className="absolute -bottom-1 left-0 w-12 h-1 bg-indigo-600 rounded-full"></div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Prezzo Medio Reale (Venduto)</p>
                            <p className="text-3xl font-black text-indigo-600">
                                {(reverseEngineering.realAveragePrice ?? 0).toFixed(2)}€ 
                                <span className="text-sm text-slate-400 font-bold ml-1 uppercase">/ lezione</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed font-bold italic border-t border-slate-200 pt-2">
                                Analisi basata sull'intero database iscrizioni attive.
                            </p>
                        </div>
                    </div>

                    {/* RESULT CARD SECTION - 7 COLUMNS */}
                    <div className="lg:col-span-7">
                        <div className="bg-purple-600 p-8 md:p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[200px]">
                            {/* Decorative Background Element */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                            
                            <p className="text-[10px] md:text-xs font-black opacity-70 uppercase mb-4 tracking-[0.3em] relative z-10">
                                FATTURATO LORDO ANNUO NECESSARIO
                            </p>
                            <p className="text-4xl md:text-6xl font-black italic tracking-tighter leading-none relative z-10">
                                {(reverseEngineering.grossNeeded ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                            </p>
                            
                            <div className="mt-8 flex flex-col gap-2 relative z-10">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-black uppercase opacity-60">Status Raggiungimento</span>
                                    <span className="text-sm font-black italic text-amber-300">
                                        {((stats.revenue / reverseEngineering.grossNeeded) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                    <div 
                                        className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-1000 ease-out" 
                                        style={{ width: `${Math.min((stats.revenue / reverseEngineering.grossNeeded) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card Consigli Pratici Dinamica */}
                <div className={`p-8 rounded-[32px] border-2 transition-all duration-500 shadow-lg ${isUnderTarget ? 'bg-slate-900 text-white border-purple-500/20' : 'bg-emerald-600 text-white border-emerald-400'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <h5 className="font-black text-xl flex items-center gap-3">
                            <span className="text-3xl">{isUnderTarget ? '🚀' : '✨'}</span> 
                            {isUnderTarget ? 'Strategia di Espansione' : 'Mantenimento Obiettivo'}
                        </h5>
                        <div className="bg-white/10 px-6 py-2 rounded-2xl border border-white/20 text-center">
                            <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">GAP ANNUALE ATTUALE</p>
                            <p className={`text-2xl font-black leading-none ${isUnderTarget ? 'text-red-400' : 'text-white'}`}>
                                {isUnderTarget ? `-${reverseEngineering.gap.toFixed(0)}€` : 'COPERTO'}
                            </p>
                        </div>
                    </div>
                    
                    <p className="text-base leading-relaxed font-bold mb-10 opacity-90 italic">
                        {reverseEngineering.advice}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors group">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <p className="text-[10px] text-purple-300 font-black uppercase tracking-widest">Scenario A: Volume</p>
                            </div>
                            <p className="text-sm font-bold text-slate-400 mb-4 leading-tight">Acquisisci nuovi allievi mantenendo il prezzo attuale.</p>
                            <p className="text-4xl font-black text-green-400">
                                +{reverseEngineering.studentsNeeded} 
                                <span className="text-xs font-black text-white/50 ml-2 uppercase">allievi target</span>
                            </p>
                        </div>
                        
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors group">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                                <p className="text-[10px] text-purple-300 font-black uppercase tracking-widest">Scenario B: Valore</p>
                            </div>
                            <p className="text-sm font-bold text-slate-400 mb-4 leading-tight">Ottimizza la marginalità portando il prezzo a:</p>
                            <p className="text-4xl font-black text-amber-400">
                                {(reverseEngineering.recommendedPrice ?? 0).toFixed(2)}€ 
                                <span className="text-xs font-black text-white/50 ml-2 uppercase">consigliato</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceCFO;
