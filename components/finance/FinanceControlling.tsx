
import React, { useState, useMemo } from 'react';

interface FinanceControllingProps {
    roiSedi: { 
        name: string, 
        color: string, 
        revenue: number, 
        costs: number, 
        costPerLesson: { value: number, min: number, max: number, avg: number }, 
        costPerStudentPerLesson: number;
        costPerStudent: number, 
        studentBasedCosts: number, 
        breakdown: { rent: { total: number, current: number }, operational: number, logistics: number, overhead: number }, 
        isAccountant?: boolean; 
        globalRevenue?: number; 
    }[];
    onSelectLocation: (loc: any) => void;
    year: number;
    onYearChange: (year: number) => void;
    month?: string;
    onMonthChange?: (month: string) => void;
}

const LegendBox = () => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 shadow-sm max-w-2xl">
        <h4 className="font-bold text-slate-800 mb-2 uppercase flex items-center gap-2">
            <span className="text-lg">📖</span> Come leggere i dati (Enterprise Model)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <strong className="text-slate-700">Costi Sede:</strong>
                <p className="mt-1 leading-snug text-slate-500">Spese dirette per l'utilizzo degli spazi (Affitto/Nolo).</p>
            </div>
            <div>
                <strong className="text-slate-700">Costi Operativi:</strong>
                <p className="mt-1 leading-snug text-slate-500">Materiali, Attrezzature e altre spese vive allocate alla sede.</p>
            </div>
            <div>
                <strong className="text-slate-700">Logistica:</strong>
                <p className="mt-1 leading-snug text-slate-500">Costi auto ripartiti sulla sede in base alla distanza effettiva.</p>
            </div>
            <div>
                <strong className="text-slate-700">Spese Condivise:</strong>
                <p className="mt-1 leading-snug text-slate-500">Quota di spese generali (Commercialista, Tasse) ripartita sul fatturato della sede.</p>
            </div>
        </div>
    </div>
);

const FinanceControlling: React.FC<FinanceControllingProps> = ({ roiSedi, onSelectLocation, year, onYearChange, month, onMonthChange }) => {
    const currentYear = new Date().getFullYear();
    const availableYears = Array.from({ length: (currentYear + 1) - 2025 + 1 }, (_, i) => 2025 + i);
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    // State per il filtro Sede
    const [locationFilter, setLocationFilter] = useState('');

    // Estrai lista sedi univoche dai dati (Memoized)
    const availableLocations = useMemo(() => {
        return roiSedi.map(s => s.name).sort();
    }, [roiSedi]);

    // Filtra i dati da visualizzare
    const displayedSedi = useMemo(() => {
        if (!locationFilter) return roiSedi;
        return roiSedi.filter(s => s.name === locationFilter);
    }, [roiSedi, locationFilter]);

    return (
        <div className="animate-slide-up space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                <LegendBox />
                
                <div className="flex gap-2 flex-wrap">
                    {/* Location Filter */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase">Sede:</span>
                        <select 
                            value={locationFilter} 
                            onChange={(e) => setLocationFilter(e.target.value)} 
                            className="text-sm font-bold text-indigo-700 bg-transparent border-none outline-none cursor-pointer max-w-[150px]"
                        >
                            <option value="">Tutte le Sedi</option>
                            {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase">Anno:</span>
                        <select value={year} onChange={(e) => onYearChange(Number(e.target.value))} className="text-sm font-bold text-indigo-700 bg-transparent border-none outline-none cursor-pointer">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* Month Selector */}
                    {month !== undefined && onMonthChange && (
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                            <span className="text-xs font-bold text-gray-500 uppercase">Mese:</span>
                            <select 
                                value={month} 
                                onChange={(e) => onMonthChange(e.target.value)} 
                                className="text-sm font-bold text-indigo-700 bg-transparent border-none outline-none cursor-pointer"
                            >
                                <option value="all">Tutto l'anno</option>
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedSedi.map((sede, idx) => {
                    const roiPercent = sede.revenue > 0 ? (((sede.revenue - sede.costs) / sede.revenue) * 100) : 0;
                    return (
                        <div key={idx} className="md-card p-6 bg-white border-t-4 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group" style={{ borderColor: sede.color }} onClick={() => onSelectLocation(sede)}>
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-black uppercase tracking-tighter group-hover:text-indigo-600 transition-colors text-slate-800">{sede.name}</h4>
                                <span className={`px-2 py-1 rounded text-[10px] font-black ${sede.revenue > sede.costs ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>ROI {roiPercent.toFixed(0)}%</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs items-center mb-3"><span>Ricavi Studenti</span><span className="font-bold text-green-600">+{(sede.revenue ?? 0).toFixed(2)}€</span></div>
                                <div className="space-y-1 pt-2 border-t border-dashed border-gray-200">
                                    <div className="flex justify-between text-[11px] items-center text-emerald-700 bg-emerald-50/50 px-1 rounded -mx-1 mb-0.5">
                                        <span>Nolo Attuale (Consumato)</span>
                                        <span className="font-bold">-{(sede.breakdown.rent.current ?? 0).toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] items-center text-gray-600 px-1">
                                        <span>Nolo Tot. Periodo</span>
                                        <span className="font-bold">-{(sede.breakdown.rent.total ?? 0).toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] items-center text-gray-600"><span>Costi Operativi Sede</span><span className="font-bold">-{(sede.breakdown.operational ?? 0).toFixed(2)}€</span></div>
                                    <div className="flex justify-between text-[11px] items-center text-gray-600"><span>Costi Logistica</span><span className="font-bold">-{(sede.breakdown.logistics ?? 0).toFixed(2)}€</span></div>
                                    <div className="flex justify-between text-[11px] items-center text-gray-400"><span>Quota Spese Comuni</span><span className="font-bold">-{(sede.breakdown.overhead ?? 0).toFixed(2)}€</span></div>
                                </div>
                                <div className="pt-3 border-t flex justify-between items-end mt-2">
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">Utile Netto</span>
                                    <span className={`text-xl font-black ${(sede.revenue - sede.costs >= 0) ? 'text-indigo-700' : 'text-red-600'}`}>{(sede.revenue - sede.costs).toFixed(2)}€</span>
                                </div>
                            </div>
                            <div className="mt-4 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Clicca per Analisi Dettagliata</div>
                        </div>
                    );
                })}
                {displayedSedi.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        Nessuna sede trovata con questo filtro.
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinanceControlling;
