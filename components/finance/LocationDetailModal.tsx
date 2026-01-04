
import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import Modal from '../Modal';

interface LocationDetailModalProps {
    data: { 
        name: string, 
        color: string, 
        revenue: number, 
        costs: number, 
        costPerLesson?: number, 
        costPerStudent?: number, // NEW
        breakdown?: { rent: number, logistics: number, overhead: number } 
    };
    onClose: () => void;
}

// Helper per Tooltip (Local)
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-block ml-1">
        <span className="cursor-pointer text-gray-400 text-[10px] border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center hover:bg-gray-100 hover:text-gray-600 transition-colors">?</span>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-snug">
            {text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const LocationDetailModal: React.FC<LocationDetailModalProps> = ({ data, onClose }) => {
    const profit = data.revenue - data.costs;
    const isProfitable = profit >= 0;
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    
    // Breakdown defaults (Ensure overhead is handled)
    const bd = data.breakdown || { rent: 0, logistics: 0, overhead: 0 };
    
    // Efficiency: Quanto rimane in tasca su 10 euro
    const pocketMoneyPer10 = data.revenue > 0 ? (profit / data.revenue) * 10 : 0;
    
    useEffect(() => {
        if (chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                let chartData = [];
                let colors = [];
                let labels = [];

                if (isProfitable) {
                    // Guadagno: Profitto vs Costi Totali
                    chartData = [data.costs, profit];
                    colors = ['#ef4444', '#22c55e'];
                    labels = ['Spese Totali', 'Tuo Guadagno'];
                } else {
                    // Perdita: Entrate vs Scoperto
                    chartData = [data.revenue, data.costs - data.revenue];
                    colors = ['#22c55e', '#ef4444'];
                    labels = ['Coperto', 'Perdita'];
                }

                const chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: chartData,
                            backgroundColor: colors,
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { size: 10, family: 'Inter' } } },
                            tooltip: {
                                callbacks: {
                                    label: (context) => ` ${context.label}: ${Number(context.raw).toFixed(2)}€`
                                }
                            }
                        },
                        cutout: '65%',
                    }
                });
                return () => chart.destroy();
            }
        }
    }, [data, isProfitable]);

    return (
        <Modal onClose={onClose} size="lg">
            <div className="flex flex-col h-full overflow-hidden">
                {/* HEADER: IL VERDETTO */}
                <div className={`p-6 text-white flex justify-between items-start ${isProfitable ? 'bg-indigo-600' : 'bg-red-500'}`}>
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">{data.name}</h3>
                        <p className="text-sm opacity-90 font-medium mt-1">Smart Insight - Controllo di Gestione</p>
                    </div>
                    <div className="text-5xl">
                        {isProfitable ? '👍' : '⚠️'}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* 1. NARRATIVA DEL VERDETTO */}
                    <div className="text-center">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">IL VERDETTO</p>
                        {isProfitable ? (
                            <h4 className="text-xl font-bold text-green-600">
                                Ottimo Lavoro! <br/>
                                <span className="text-gray-600 text-base font-normal">Questa sede si ripaga da sola. Gli incassi coprono affitto, logistica e spese generali.</span>
                            </h4>
                        ) : (
                            <h4 className="text-xl font-bold text-red-600">
                                Attenzione: Costi Alti <br/>
                                <span className="text-gray-600 text-base font-normal">Gli incassi non coprono le spese. Stai usando risorse di altre sedi.</span>
                            </h4>
                        )}
                    </div>

                    {/* 2. VISUALIZZAZIONE E BREAKDOWN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-56 relative">
                            <canvas ref={chartRef}></canvas>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">UTILE NETTO</span>
                                <span className={`text-2xl font-black ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                                    {profit > 0 ? '+' : ''}{profit.toFixed(0)}€
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <h5 className="text-xs font-bold text-gray-400 uppercase border-b pb-1 mb-2">Dettaglio Costi</h5>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🏠</span>
                                    <div className="flex items-center">
                                        <span className="text-xs font-bold text-gray-600">Nolo Sede</span>
                                        <InfoTooltip text="Costo affitto diretto." />
                                    </div>
                                </div>
                                <span className="font-bold text-gray-800">{bd.rent.toFixed(2)}€</span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🚗</span>
                                    <div className="flex items-center">
                                        <span className="text-xs font-bold text-gray-600">Logistica</span>
                                        <InfoTooltip text="Costo veicoli diviso per n. sedi attive." />
                                    </div>
                                </div>
                                <span className="font-bold text-gray-800">{bd.logistics.toFixed(2)}€</span>
                            </div>

                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📊</span>
                                    <div className="flex items-center">
                                        <span className="text-xs font-bold text-gray-600">Spese Generali</span>
                                        <InfoTooltip text="Quota parte overhead + materiali." />
                                    </div>
                                </div>
                                <span className="font-bold text-gray-800">{bd.overhead.toFixed(2)}€</span>
                            </div>

                            <div className="pt-2 border-t mt-2 flex justify-between text-sm">
                                <span className="font-bold text-red-600 uppercase">Totale Uscite</span>
                                <span className="font-black text-red-600">{data.costs.toFixed(2)}€</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. SPIEGAZIONE NARRATIVA (EFFICIENZA) */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="text-xl">💡</span> Efficienza:
                        </h5>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                <span>
                                    Per ogni <strong>10€</strong> incassati, ne spendi <strong>{((data.costs / (data.revenue || 1)) * 10).toFixed(1)}€</strong> per mantenere la sede.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                <span>
                                    Ti restano in tasca <strong>{isProfitable ? pocketMoneyPer10.toFixed(1) : 0}€</strong> (su 10€) dopo aver pagato affitto, viaggi e spese generali.
                                </span>
                            </li>
                            {data.costPerLesson > 0 && (
                                <li className="flex gap-2 border-t border-slate-200 pt-2 mt-2">
                                    <span className="font-bold text-red-500">•</span>
                                    <span>
                                        Il "Costo Singola Lezione" (Cost to Serve) è di <strong>{data.costPerLesson.toFixed(2)}€</strong>.
                                        <br/><span className="text-xs text-gray-400 italic font-normal">Include logistica diviso per il numero di viaggi (aperture).</span>
                                    </span>
                                </li>
                            )}
                            {data.costPerStudent > 0 && (
                                <li className="flex gap-2 border-t border-slate-200 pt-2 mt-2">
                                    <span className="font-bold text-red-500">•</span>
                                    <span>
                                        Il "Costo Singolo Studente" (Marginal Cost) è di <strong>{data.costPerStudent.toFixed(2)}€</strong>.
                                        <br/><span className="text-xs text-gray-400 italic font-normal">Totale costi sede diviso per iscritti reali.</span>
                                    </span>
                                </li>
                            )}
                        </ul>
                    </div>

                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="md-btn md-btn-raised md-btn-primary">Ho capito</button>
                </div>
            </div>
        </Modal>
    );
};

export default LocationDetailModal;
