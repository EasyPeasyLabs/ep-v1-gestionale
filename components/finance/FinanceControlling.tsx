
import React from 'react';

interface FinanceControllingProps {
    roiSedi: { name: string, color: string, revenue: number, costs: number }[];
    onSelectLocation: (loc: any) => void;
    year: number;
    onYearChange: (year: number) => void;
}

const FinanceControlling: React.FC<FinanceControllingProps> = ({ roiSedi, onSelectLocation, year, onYearChange }) => {
    
    // Genera lista anni dal 2025 all'anno corrente + 1
    const currentYear = new Date().getFullYear();
    const availableYears = Array.from(
        { length: (currentYear + 1) - 2025 + 1 }, 
        (_, i) => 2025 + i
    );

    return (
        <div className="animate-slide-up space-y-4">
            {/* Year Selector Toolbar */}
            <div className="flex justify-end items-center mb-2">
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border border-gray-200 shadow-sm">
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
                {roiSedi.map((sede, idx) => (
                    <div 
                        key={idx} 
                        className="md-card p-6 bg-white border-t-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group" 
                        style={{ borderColor: sede.color }}
                        onClick={() => onSelectLocation(sede)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-black text-slate-800 uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">{sede.name}</h4>
                            <span className={`px-2 py-1 rounded text-[10px] font-black ${sede.revenue > sede.costs ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                ROI {sede.revenue > 0 ? (((sede.revenue - sede.costs) / sede.revenue) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs"><span>Ricavi Studenti</span><span className="font-bold text-green-600">+{sede.revenue.toFixed(2)}€</span></div>
                            <div className="flex justify-between text-xs"><span>Nolo & Logistica</span><span className="font-bold text-red-600">-{sede.costs.toFixed(2)}€</span></div>
                            <div className="pt-2 border-t flex justify-between text-sm font-black"><span>Utile Sede</span><span className="text-indigo-600">{(sede.revenue - sede.costs).toFixed(2)}€</span></div>
                        </div>
                        <div className="mt-3 text-center text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Clicca per breakdown costi</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinanceControlling;
