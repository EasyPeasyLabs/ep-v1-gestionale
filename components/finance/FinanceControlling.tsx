
import React from 'react';

interface FinanceControllingProps {
    roiSedi: { 
        name: string, 
        color: string, 
        revenue: number, 
        costs: number, // Event-based (Real Total)
        costPerLesson: { value: number, min: number, max: number, avg: number }, // Object Vectorial
        costPerStudentPerLesson: number; // NEW KPI
        costPerStudent: number, 
        studentBasedCosts: number, 
        breakdown: { rent: number, logistics: number, overhead: number }, 
        isAccountant?: boolean; 
        globalRevenue?: number; 
    }[];
    onSelectLocation: (loc: any) => void;
    year: number;
    onYearChange: (year: number) => void;
}

const LegendBox = () => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 shadow-sm max-w-2xl">
        <h4 className="font-bold text-slate-800 mb-2 uppercase flex items-center gap-2">
            <span className="text-lg">📖</span> Come leggere i dati (Enterprise Model)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <strong className="text-slate-700">Costi Diretti (Sede):</strong>
                <p className="mt-1 leading-snug text-slate-500">Spese vive sostenute specificamente per questa sede (Affitto, Materiali, Attrezzature).</p>
            </div>
            <div>
                <strong className="text-slate-700">Logistica (Km Reali):</strong>
                <p className="mt-1 leading-snug text-slate-500">
                    Costi Auto ripartiti in base ai Km effettivi per raggiungere la sede (non più a forfait).
                </p>
            </div>
            <div>
                <strong className="text-slate-700">Spese Condivise:</strong>
                <p className="mt-1 leading-snug text-slate-500">
                    Commercialista, tasse e costi generali ripartiti in base al fatturato: chi incassa di più, contribuisce di più.
                </p>
            </div>
            <div>
                <strong className="text-slate-700">Costo Apri-Porta (Lezione):</strong>
                <p className="mt-1 leading-snug text-slate-500">
                    Quanto ti costa fare una singola lezione (Affitto + Viaggio) prima ancora di guadagnare 1€.
                </p>
            </div>
            <div>
                <strong className="text-slate-700">Costo Studente/Lez:</strong>
                <p className="mt-1 leading-snug text-slate-500">
                    Quanto costa servire un singolo studente per una lezione (Costo Apri-Porta diviso Studenti Attivi).
                </p>
            </div>
        </div>
    </div>
);

const FinanceControlling: React.FC<FinanceControllingProps> = ({ roiSedi, onSelectLocation, year, onYearChange }) => {
    
    // Genera lista anni dal 2025 all'anno corrente + 1
    const currentYear = new Date().getFullYear();
    const availableYears = Array.from(
        { length: (currentYear + 1) - 2025 + 1 }, 
        (_, i) => 2025 + i
    );

    return (
        <div className="animate-slide-up space-y-6">
            {/* Header: Legend + Year Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <LegendBox />
                
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold text-gray-500 uppercase">Anno Analisi:</span>
                    <select 
                        value={year} 
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        className="text-sm font-bold text-indigo-700 bg-transparent border-none outline-none cursor-pointer"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roiSedi.map((sede, idx) => {
                    const isAccountant = sede.isAccountant;
                    const roiPercent = sede.revenue > 0 ? (((sede.revenue - sede.costs) / sede.revenue) * 100) : 0;
                    
                    const accountantIncidence = sede.globalRevenue && sede.globalRevenue > 0
                        ? (sede.costs / sede.globalRevenue) * 100
                        : 0;

                    return (
                        <div 
                            key={idx} 
                            className={`md-card p-6 bg-white border-t-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group ${isAccountant ? 'border-purple-500' : ''}`} 
                            style={{ borderColor: isAccountant ? sede.color : sede.color }}
                            onClick={() => onSelectLocation(sede)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className={`font-black uppercase tracking-tighter transition-colors ${isAccountant ? 'text-purple-700' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                        {sede.name}
                                    </h4>
                                    {isAccountant && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-bold">FORNITORE</span>}
                                </div>
                                
                                {isAccountant ? (
                                    <span className="px-2 py-1 rounded text-[10px] font-black bg-purple-100 text-purple-700" title="Incidenza su fatturato totale">
                                        -{accountantIncidence.toFixed(1)}% RICAVI
                                    </span>
                                ) : (
                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${sede.revenue > sede.costs ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        ROI {roiPercent.toFixed(0)}%
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs items-center mb-2">
                                    <span>Ricavi Studenti</span>
                                    <span className="font-bold text-green-600">+{sede.revenue.toFixed(2)}€</span>
                                </div>
                                
                                {/* Overhead (Generali + Operazioni Indirette) */}
                                <div className="flex justify-between text-xs items-center bg-gray-50 p-1.5 rounded mb-1 border border-gray-100">
                                    <div className="flex items-center">
                                        <span className="text-gray-500">Spese Condivise (Quota)</span>
                                    </div>
                                    <span className="font-bold text-gray-500">-{sede.studentBasedCosts.toFixed(2)}€</span>
                                </div>
                                {sede.costPerStudent > 0 && (
                                    <div className="flex justify-between text-[10px] items-center px-1.5 mb-3">
                                        <span className="text-gray-400 italic">└ Costo Op. per Studente:</span>
                                        <span className="font-bold text-gray-400">-{sede.costPerStudent.toFixed(2)}€</span>
                                    </div>
                                )}

                                {/* Breakdown Costi Reali */}
                                <div className="space-y-1 pt-1 border-t border-dashed border-gray-200">
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-gray-600">Costi Diretti (Sede)</span>
                                        <span className="font-bold text-red-600">-{sede.breakdown.rent.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-gray-600">Logistica (Km Reali)</span>
                                        <span className="font-bold text-red-600">-{sede.breakdown.logistics.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-gray-400 text-[10px] uppercase">Spese Condivise</span>
                                        <span className="font-bold text-red-400">-{sede.breakdown.overhead.toFixed(2)}€</span>
                                    </div>
                                </div>
                                
                                <div className="pt-3 border-t flex flex-col gap-1 mt-2">
                                    <div className="flex justify-between text-sm font-black">
                                        <span>Utile Sede</span>
                                        <span className={`text-lg ${(sede.revenue - sede.costs >= 0) ? 'text-indigo-600' : 'text-red-600'}`}>
                                            {(sede.revenue - sede.costs).toFixed(2)}€
                                        </span>
                                    </div>
                                    {/* Costo Assoluto Studente (Stress Test) */}
                                    {sede.costPerLesson && sede.costPerLesson.value > 0 && (
                                        <div className="flex flex-col gap-1 mt-1 border-t border-dashed border-gray-100 pt-1">
                                            <div className="flex justify-between text-[10px] text-gray-400">
                                                <span>Costo "Apri-Porta" (Lez.):</span>
                                                <span>-{sede.costPerLesson.value.toFixed(2)}€</span>
                                            </div>
                                            {/* NEW KPI */}
                                            <div className="flex justify-between text-[10px] text-indigo-400 font-medium">
                                                <span>Costo Studente/Lez:</span>
                                                <span>-{sede.costPerStudentPerLesson.toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mt-3 text-center text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                Clicca per analisi dettagliata
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FinanceControlling;
