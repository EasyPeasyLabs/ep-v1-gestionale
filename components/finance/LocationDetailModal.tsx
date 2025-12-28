
import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import Modal from '../Modal';

interface LocationDetailModalProps {
    data: { name: string, color: string, revenue: number, costs: number };
    onClose: () => void;
}

const LocationDetailModal: React.FC<LocationDetailModalProps> = ({ data, onClose }) => {
    const profit = data.revenue - data.costs;
    const isProfitable = profit >= 0;
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    
    // Efficiency: Quanto rimane in tasca su 10 euro
    const pocketMoneyPer10 = data.revenue > 0 ? (profit / data.revenue) * 10 : 0;
    
    useEffect(() => {
        if (chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                const chartData = isProfitable 
                    ? [data.costs, profit] 
                    : [data.revenue, data.costs - data.revenue]; 
                
                const colors = isProfitable 
                    ? ['#ef4444', '#22c55e'] // Rosso (Costi), Verde (Profitto)
                    : ['#22c55e', '#ef4444']; // Verde (Coperto), Rosso (Scoperto)

                const labels = isProfitable
                    ? ['Affitto (Costi)', 'Tasca Tua (Profitto)']
                    : ['Coperto da Incassi', 'Perdita (Di tasca tua)'];

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
                                <span className="text-gray-600 text-base font-normal">Questa sede si ripaga da sola. Gli studenti coprono abbondantemente l'affitto.</span>
                            </h4>
                        ) : (
                            <h4 className="text-xl font-bold text-red-600">
                                Attenzione: Costi Alti <br/>
                                <span className="text-gray-600 text-base font-normal">Gli incassi attuali non bastano a coprire l'affitto. Stai usando soldi di altre sedi per mantenere questa.</span>
                            </h4>
                        )}
                    </div>

                    {/* 2. VISUALIZZAZIONE (LA TORTA) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-56 relative">
                            <canvas ref={chartRef}></canvas>
                            {/* Centro della ciambella */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">COSA TI RIMANE</span>
                                <span className={`text-2xl font-black ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                                    {profit > 0 ? '+' : ''}{profit.toFixed(0)}€
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                                <div className="p-2 bg-green-100 rounded-full text-xl">💰</div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Totale raccolto dagli studenti</p>
                                    <p className="text-lg font-bold text-gray-800">{data.revenue.toFixed(2)}€</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                <div className="p-2 bg-red-100 rounded-full text-xl">🏠</div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase">Affitto pagato al proprietario</p>
                                    <p className="text-lg font-bold text-gray-800">{data.costs.toFixed(2)}€</p>
                                </div>
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
                                    Per ogni <strong>10€</strong> che incassi in questa sede, ne spendi <strong>{((data.costs / (data.revenue || 1)) * 10).toFixed(1)}€</strong> per l'affitto.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                <span>
                                    Ti restano in tasca puliti <strong>{isProfitable ? pocketMoneyPer10.toFixed(1) : 0}€</strong> (su 10€).
                                </span>
                            </li>
                            {!isProfitable && (
                                <li className="flex gap-2 text-red-600 font-medium bg-red-50 p-2 rounded mt-2">
                                    <span className="font-bold">!</span>
                                    <span>
                                        Consiglio: Devi trovare nuovi iscritti per questa sede o rinegoziare l'affitto.
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
