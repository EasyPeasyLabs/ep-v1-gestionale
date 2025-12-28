
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
        <div className="space-y-6 animate-slide-up">
            {/* 1. PIANIFICATORE FISCALE VISUALE */}
            <div className="md-card p-6 bg-white border border-gray-200 shadow-sm rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <CalculatorIcon /> Proiezione Fiscale (Forfettario)
                    </h3>
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-gray-400 block">TOTAL TAX</span>
                        <span className="text-2xl font-black text-red-600">{stats.totalAll.toFixed(2)}€</span>
                    </div>
                </div>
                
                <div className="mb-6">
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                        <span>Plafond 85.000€</span>
                        <span>{stats.progress.toFixed(1)}% Utilizzato</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${stats.progress > 80 ? 'bg-red-500' : 'bg-gray-600'}`} 
                            style={{ width: `${Math.min(stats.progress, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">IMPONIBILE (78%)</p>
                        <p className="text-xl font-black text-gray-800 mt-1">{stats.taxable.toFixed(2)}€</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <p className="text-[10px] font-bold text-orange-400 uppercase">INPS (26.23%)</p>
                        <p className="text-xl font-black text-orange-600 mt-1">{stats.inps.toFixed(2)}€</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <p className="text-[10px] font-bold text-red-400 uppercase">IMPOSTA SOST. (5%)</p>
                        <p className="text-xl font-black text-red-600 mt-1">{stats.tax.toFixed(2)}€</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">TOT INPS+IMP.</p>
                        <p className="text-xl font-black text-blue-700 mt-1">{stats.totalInpsTax.toFixed(2)}€</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">BOLLI ({stats.stampDutyTotal/2})</p>
                        <p className="text-xl font-black text-gray-600 mt-1">{stats.stampDutyTotal.toFixed(2)}€</p>
                    </div>
                </div>
            </div>

            {/* 2. SIMULATORE RATE (TEAL) */}
            <div className="md-card p-6 bg-white border-2 border-teal-50 shadow-sm rounded-2xl">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    🔮 Simulatore Rate & Scadenze
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Colonna 1: Totali Tranches */}
                    <div className="space-y-4 border-r border-gray-100 pr-4">
                        <h4 className="text-xs font-black uppercase text-teal-800 border-b pb-2">Ripartizione Tasse</h4>
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-xs font-bold text-gray-600 block">I Tranche (Rateizzabile)</span>
                                <span className="text-[10px] text-gray-400">Saldo + I Acconto</span>
                            </div>
                            <span className="font-bold text-gray-900">{simulatorData.tranche1.toFixed(2)}€</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-xs font-bold text-gray-600 block">Saldo Finale (II Acconto)</span>
                                <span className="text-[10px] text-gray-400">Novembre (Unica Sol.)</span>
                            </div>
                            <span className="font-bold text-gray-900">{simulatorData.tranche2.toFixed(2)}€</span>
                        </div>

                        <div className="bg-teal-50 p-3 rounded-lg mt-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-teal-800">SCAD. BOLLI</span>
                                <span className="font-black text-teal-900">{stats.stampDutyTotal.toFixed(2)}€</span>
                            </div>
                            <div className="space-y-1 mt-2">
                                {simulatorData.stampDeadlines.map((sd: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[10px]">
                                        <span className="text-teal-600 font-medium">{sd.label}</span>
                                        <span className="font-bold text-teal-800">{sd.amount.toFixed(2)}€</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Colonna 2: Rateazione */}
                    <div className="space-y-4 border-r border-gray-100 pr-4">
                        <h4 className="text-xs font-black uppercase text-teal-800 border-b pb-2">Rateazione (I Tranche)</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {['GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'].map((month, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded p-2 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">{month}</span>
                                    <span className="text-xs font-bold text-teal-600">{simulatorData.monthlyInstallment.toFixed(0)}€</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[9px] text-gray-400 italic text-center mt-2">Rata calcolata su 6 mesi per il 150% del totale INPS+Imp (Scenario Start-up).</p>
                    </div>

                    {/* Colonna 3: Accantonamento Consigliato */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-amber-600 border-b pb-2">Accantonamento Consigliato</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {simulatorData.savingsPlan.map((plan: any, idx: number) => (
                                <div key={idx} className="bg-amber-50 border border-amber-100 rounded p-2 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-amber-400 uppercase">{plan.month}</span>
                                    <span className="text-xs font-bold text-amber-700">{plan.amount.toFixed(0)}€</span>
                                </div>
                            ))}
                        </div>
                        <div className="bg-amber-100 p-2 rounded border border-amber-200 mt-2 flex flex-col items-center">
                            <span className="text-[9px] font-bold text-amber-600 uppercase">SALDO FINALE (NOV)</span>
                            <span className="text-sm font-black text-amber-800">{simulatorData.saldoFinaleTarget.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. AI REVERSE ENGINEERING (PURPLE) */}
            <div className="md-card p-6 bg-white border-2 border-purple-50 shadow-md rounded-2xl ring-1 ring-purple-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <SparklesIcon /> AI Reverse Engineering
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Target Netto Mensile</label>
                        <input 
                            type="number" 
                            value={targetMonthlyNet} 
                            onChange={e => setTargetMonthlyNet(Number(e.target.value))}
                            className="w-full text-2xl font-bold p-2 bg-gray-50 rounded-lg border-none focus:ring-2 ring-purple-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Prezzo Lezione</label>
                        <input 
                            type="number" 
                            value={lessonPrice} 
                            onChange={e => setLessonPrice(Number(e.target.value))}
                            className="w-full text-2xl font-bold p-2 bg-gray-50 rounded-lg border-none focus:ring-2 ring-purple-200"
                        />
                    </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                    <p className="text-xs font-bold text-purple-800 uppercase mb-1">FATTURATO ANNUO NECESSARIO (LORDO)</p>
                    <p className="text-3xl font-black text-purple-700">{reverseEngineering.grossNeeded.toFixed(2)}€</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-red-50 rounded-xl border-l-4 border-red-400">
                        <h4 className="text-xs font-black uppercase text-red-800 mb-2">AZIONI TATTICHE (BREVE TERMINE)</h4>
                        <p className="text-xs text-red-700 mb-2">Per coprire il gap di {reverseEngineering.gap.toFixed(0)}€:</p>
                        <ul className="text-xs text-gray-700 list-disc list-inside space-y-1">
                            <li>Trovare <strong>{reverseEngineering.studentsNeeded}</strong> nuovi studenti.</li>
                            <li>Vendere <strong>{reverseEngineering.extraLessonsNeeded}</strong> lezioni extra.</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
                        <h4 className="text-xs font-black uppercase text-blue-800 mb-2">STRATEGIA (MEDIO/LUNGO TERMINE)</h4>
                        <p className="text-xs text-blue-700 mb-2">Per stabilizzare il target:</p>
                        <ul className="text-xs text-gray-700 list-disc list-inside space-y-1">
                            <li>Alzare il prezzo medio a <strong>{(lessonPrice * 1.1).toFixed(2)}€</strong>.</li>
                            <li>Ottimizzare i costi di nolo nelle sedi a basso margine.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceCFO;
