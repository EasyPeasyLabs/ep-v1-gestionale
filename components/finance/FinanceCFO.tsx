
import React from 'react';
import CalculatorIcon from '../icons/CalculatorIcon';
import SparklesIcon from '../icons/SparklesIcon';

interface FinanceCFOProps {
    stats: any;
    simulatorData: any;
    reverseEngineering: any;
    targetMonthlyNet: number;
    lessonPrice: number;
    setTargetMonthlyNet: (v: number) => void;
    setLessonPrice: (v: number) => void;
}

const FinanceCFO: React.FC<FinanceCFOProps> = ({ 
    stats, simulatorData, reverseEngineering, 
    targetMonthlyNet, lessonPrice, 
    setTargetMonthlyNet, setLessonPrice 
}) => {
    return (
        <div className="space-y-6 animate-slide-up pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Proiezione Fiscale */}
                <div className="md-card p-6 bg-white border border-gray-200 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalculatorIcon /> Proiezione Fiscale</h3>
                        <span className="text-2xl font-black text-red-600">{(stats.totalAll ?? 0).toFixed(2)}€</span>
                    </div>
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>Plafond Regime Forfettario (85.000€)</span><span>{(stats.progress ?? 0).toFixed(1)}%</span></div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${stats.progress > 80 ? 'bg-red-500' : 'bg-gray-600'}`} style={{ width: `${Math.min(stats.progress ?? 0, 100)}%` }}></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-[9px] font-bold text-gray-400 uppercase">IMPONIBILE</p><p className="text-sm font-black">{(stats.taxable ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100"><p className="text-[9px] font-bold text-orange-400 uppercase">INPS</p><p className="text-sm font-black">{(stats.inps ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100"><p className="text-[9px] font-bold text-red-400 uppercase">IMPOSTA</p><p className="text-sm font-black">{(stats.tax ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100"><p className="text-[9px] font-bold text-blue-400 uppercase">TOTALE</p><p className="text-sm font-black">{(stats.totalInpsTax ?? 0).toFixed(0)}€</p></div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-[9px] font-bold text-gray-400 uppercase">BOLLI</p><p className="text-sm font-black">{(stats.stampDutyTotal ?? 0).toFixed(0)}€</p></div>
                    </div>

                    {/* Dettaglio Rateazione */}
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
                                <p className="text-[9px] text-amber-600 mt-1 italic">50% Acconto</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Piano di Accantonamento Mensile */}
                <div className="md-card p-6 bg-slate-50 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">💰 Piano Accantonamento</h3>
                    <p className="text-xs text-slate-500 mb-4 italic">Quanto "mettere nel salvadanaio" ogni mese per le tasse future.</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {simulatorData.savingsPlan.map((p: any, i: number) => (
                            <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm">
                                <p className="text-[10px] font-black text-slate-400">{p.month}</p>
                                <p className="text-sm font-bold text-indigo-700">{(p.amount ?? 0).toFixed(0)}€</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 p-4 bg-indigo-600 text-white rounded-xl shadow-lg">
                        <p className="text-xs font-bold opacity-80 uppercase">Obiettivo Risparmio Annuale</p>
                        <p className="text-3xl font-black">{(stats.totalAll ?? 0).toFixed(2)}€</p>
                        <div className="h-1 bg-white/20 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-white" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reverse Engineering */}
            <div className="md-card p-6 bg-white border-2 border-purple-50 rounded-2xl shadow-xl">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><SparklesIcon /> AI Reverse Engineering</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                    <div className="space-y-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Target Netto Desiderato (Mensile)</label><input type="number" value={targetMonthlyNet} onChange={e => setTargetMonthlyNet(Number(e.target.value))} className="w-full text-3xl font-black p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-purple-400" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Prezzo Medio Lezione</label><input type="number" value={lessonPrice} onChange={e => setLessonPrice(Number(e.target.value))} className="w-full text-xl font-black p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-purple-400" /></div>
                    </div>
                    <div className="flex flex-col justify-center">
                        <div className="bg-purple-600 p-6 rounded-2xl text-white shadow-xl transform hover:scale-105 transition-transform">
                            <p className="text-xs font-bold opacity-80 uppercase mb-1 tracking-widest">LORDO ANNUO NECESSARIO</p>
                            <p className="text-4xl font-black">{(reverseEngineering.grossNeeded ?? 0).toFixed(2)}€</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl text-white border border-purple-500/30">
                    <h5 className="font-bold text-purple-400 mb-2 flex items-center gap-2">💡 Consigli Pratici</h5>
                    <p className="text-sm leading-relaxed font-medium">
                        {reverseEngineering.advice}
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/5 p-3 rounded-xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">GAP FATTURATO</p>
                            <p className="text-lg font-black text-red-400">{(reverseEngineering.gap ?? 0).toFixed(0)}€</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">STUDENTI TARGET</p>
                            <p className="text-lg font-black text-green-400">{(reverseEngineering.studentsNeeded ?? 0)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceCFO;
