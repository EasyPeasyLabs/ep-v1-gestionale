
import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import CalculatorIcon from '../icons/CalculatorIcon';

interface FinanceOverviewProps {
    stats: any;
}

const KpiCard = ({ title, value, color, progress, label, sub }: any) => (
    <div className="md-card p-6 bg-white shadow-xl border-l-4 border-l-indigo-500">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <p className={`text-2xl font-black text-slate-900`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-1 font-bold">{sub}</p>}
        {progress !== undefined && (
            <div className="mt-4">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1"><span>{label}</span><span>{progress.toFixed(0)}%</span></div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                </div>
            </div>
        )}
    </div>
);

const StrategyCard = ({ title, desc, status }: any) => (
    <div className={`md-card p-5 border-l-4 ${status === 'danger' ? 'border-red-500 bg-red-50' : status === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-emerald-500 bg-emerald-50'}`}>
        <h4 className="text-xs font-black uppercase text-slate-800 mb-1">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">{desc}</p>
    </div>
);

const FinanceOverview: React.FC<FinanceOverviewProps> = ({ stats }) => {
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
                gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                        datasets: [{
                            label: 'Ricavi Mensili',
                            data: stats.monthlyData.map((d: any) => d.revenue),
                            borderColor: '#4f46e5',
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 5,
                            pointBackgroundColor: '#fff'
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [stats]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KpiCard title="Fatturato Lordo" value={`${stats.revenue.toFixed(2)}€`} color="emerald" progress={stats.progress} label="Soglia 85k" />
                <KpiCard title="Costi Operativi" value={`${stats.expenses.toFixed(2)}€`} color="red" />
                <KpiCard title="Margine Operativo" value={`${stats.margin.toFixed(1)}%` } color="indigo" />
                <KpiCard title="Accantonamento" value={`${stats.savingsSuggestion.toFixed(2)}€`} color="amber" sub="Suggerito per Tasse" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 md-card p-8 bg-white h-[450px] relative overflow-hidden">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2"><CalculatorIcon /> Analisi Flussi Temporali</h3>
                    <div className="h-[320px]"><canvas ref={chartRef}></canvas></div>
                </div>
                <div className="space-y-6">
                    <StrategyCard title="Soglia Forfettario" desc={stats.revenue > 60000 ? "ATTENZIONE: Sei vicino alla soglia. Monitora le prossime fatture." : "Stato Sicuro: Ampiamente sotto la soglia degli 85k."} status={stats.revenue > 70000 ? 'danger' : 'success'} />
                    <StrategyCard title="Efficiency Insight" desc={stats.margin < 30 ? "Margine basso rilevato. Controlla i costi di nolo delle sedi periferiche." : "Ottima efficienza operativa rilevata questo mese."} status={stats.margin < 30 ? 'warning' : 'success'} />
                    <div className="md-card p-6 bg-indigo-900 text-white shadow-indigo-200">
                        <h4 className="font-bold text-xs uppercase text-indigo-300 mb-2">Utile Netto Stimato</h4>
                        <p className="text-3xl font-black">{(stats.profit - stats.totalAll).toFixed(2)}€</p>
                        <p className="text-[10px] mt-4 text-indigo-400 italic">Calcolato dopo INPS, Imposta e Bolli</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceOverview;
