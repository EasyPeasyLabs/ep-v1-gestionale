
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Chart from 'chart.js/auto';
import CalculatorIcon from '../icons/CalculatorIcon';
import Modal from '../Modal';
import { Transaction, TransactionType } from '../../types';

interface FinanceOverviewProps {
    stats: any;
    transactions: Transaction[];
}

// --- SOTTO-COMPONENTE PER GRAFICO MODALE ---
// Estraiamo il componente per garantire che il mounting del Canvas avvenga correttamente
// all'apertura della modale, risolvendo il problema del ref nullo.
const KpiDetailChart: React.FC<{ type: string; stats: any; transactions: Transaction[] }> = ({ type, stats, transactions }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Distruggi istanza precedente se esiste
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let config: any = {};

        if (type === 'revenue') {
            // Fatturato Lordo - Bar Chart Mensile
            config = {
                type: 'bar',
                data: {
                    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                    datasets: [{
                        label: 'Incassi',
                        data: stats.monthlyData.map((d: any) => d.revenue),
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
                }
            };
        } else if (type === 'costs') {
            // Costi Operativi - Doughnut per Categoria
            const expenses = transactions.filter(t => t.type === TransactionType.Expense && !t.isDeleted);
            const categories: Record<string, number> = {};
            expenses.forEach(t => {
                const cat = t.category || 'Altro';
                categories[cat] = (categories[cat] || 0) + t.amount;
            });
            
            config = {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categories),
                    datasets: [{
                        data: Object.values(categories),
                        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: { 
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } 
                    }
                }
            };
        } else if (type === 'margin') {
            // Margine Operativo - Pie (Profit vs Expenses)
            config = {
                type: 'pie',
                data: {
                    labels: ['Utile (Ciò che resta)', 'Spese (Ciò che esce)'],
                    datasets: [{
                        data: [Math.max(0, stats.profit), stats.expenses],
                        backgroundColor: ['#4f46e5', '#cbd5e1'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            };
        } else if (type === 'taxes') {
            // Accantonamento - Bar Comparison
            config = {
                type: 'bar',
                data: {
                    labels: ['Tuo Guadagno', 'Tasse & Bolli'],
                    datasets: [{
                        label: 'Ripartizione',
                        data: [Math.max(0, stats.revenue - stats.totalAll), stats.totalAll],
                        backgroundColor: ['#10b981', '#f59e0b'],
                        borderRadius: 8,
                        barThickness: 40
                    }]
                },
                options: { 
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
                }
            };
        }

        if (config.type) {
            chartInstanceRef.current = new Chart(ctx, config);
        }

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [type, stats, transactions]);

    return (
        <div className="w-full h-full relative">
            <canvas ref={canvasRef} />
        </div>
    );
};

const KpiCard = ({ title, value, color, progress, label, sub, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`md-card p-6 bg-white shadow-xl border-l-4 cursor-pointer transition-transform transform hover:scale-105 active:scale-95 group relative overflow-hidden`}
        style={{ borderLeftColor: color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'indigo' ? '#6366f1' : '#f59e0b' }}
    >
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-1 font-bold">{sub}</p>}
        {progress !== undefined && (
            <div className="mt-4">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1"><span>{label}</span><span>{progress.toFixed(0)}%</span></div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                </div>
            </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
    </div>
);

const StrategyCard = ({ title, desc, status }: any) => (
    <div className={`md-card p-5 border-l-4 ${status === 'danger' ? 'border-red-500 bg-red-50' : status === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-emerald-500 bg-emerald-50'}`}>
        <h4 className="text-xs font-black uppercase text-slate-800 mb-1">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">{desc}</p>
    </div>
);

const FinanceOverview: React.FC<FinanceOverviewProps> = ({ stats, transactions }) => {
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

    // --- Main Chart Overview ---
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

    const renderDetailContent = () => {
        switch (selectedKpi) {
            case 'revenue':
                return {
                    title: "Fatturato Lordo",
                    desc: "Il totale di tutte le vendite prima di togliere le spese.",
                    explanation: "Immagina che ogni barra sia una pila di monete raccolte in quel mese. Le barre più alte significano che il salvadanaio si è riempito di più! Questo è tutto il denaro che è entrato, senza togliere ancora nulla.",
                    icon: "💰"
                };
            case 'costs':
                return {
                    title: "Costi Operativi",
                    desc: "Tutte le spese necessarie per mandare avanti la baracca.",
                    explanation: "Questa ciambella mostra dove sono finiti i tuoi soldi. Ogni spicchio colorato è un tipo di spesa diversa: l'affitto della sala, i materiali per i bambini, o le tasse. Più grande è lo spicchio, più quella spesa 'mangia' i tuoi guadagni.",
                    icon: "💸"
                };
            case 'margin':
                return {
                    title: "Margine Operativo",
                    desc: "La percentuale di incasso che rimane dopo aver pagato i costi.",
                    explanation: "Guarda la torta: la fetta blu è quella che ti rimane in tasca per ogni euro che incassi. La parte grigia è quella che hai dovuto dare via per pagare le spese. Il nostro obiettivo è rendere la fetta blu sempre più grande!",
                    icon: "🍰"
                };
            case 'taxes':
                return {
                    title: "Accantonamento Tasse",
                    desc: "Soldi da mettere da parte per lo Stato.",
                    explanation: "Attenzione! La barra gialla sono soldi che hai incassato ma non sono tuoi: sono dello Stato (Tasse e Bolli). Non spenderli! La barra verde invece sono i soldi puliti che puoi usare per te o per la scuola.",
                    icon: "🏛️"
                };
            default: return null;
        }
    };

    const detail = renderDetailContent();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KpiCard 
                    title="Fatturato Lordo" 
                    value={`${stats.revenue.toFixed(2)}€`} 
                    color="emerald" 
                    progress={stats.progress} 
                    label="Soglia 85k" 
                    onClick={() => setSelectedKpi('revenue')}
                />
                <KpiCard 
                    title="Costi Operativi" 
                    value={`${stats.expenses.toFixed(2)}€`} 
                    color="red" 
                    onClick={() => setSelectedKpi('costs')}
                />
                <KpiCard 
                    title="Margine Operativo" 
                    value={`${stats.margin.toFixed(1)}%`} 
                    color="indigo" 
                    onClick={() => setSelectedKpi('margin')}
                />
                <KpiCard 
                    title="Accantonamento" 
                    value={`${stats.savingsSuggestion.toFixed(2)}€`} 
                    color="amber" 
                    sub="Suggerito per Tasse" 
                    onClick={() => setSelectedKpi('taxes')}
                />
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

            {selectedKpi && detail && (
                <Modal onClose={() => setSelectedKpi(null)} size="lg">
                    <div className="flex flex-col h-full max-h-[90vh]">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-start flex-shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                    {detail.icon} {detail.title}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">{detail.desc}</p>
                            </div>
                            <button onClick={() => setSelectedKpi(null)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
                        </div>
                        
                        <div className="p-8 flex-1 flex flex-col items-center justify-center bg-white min-h-[350px]">
                            <div className="w-full max-w-md h-72 relative">
                                {/* Usa il sotto-componente per garantire il rendering */}
                                <KpiDetailChart type={selectedKpi} stats={stats} transactions={transactions} />
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-50 border-t border-indigo-100 flex-shrink-0">
                            <h4 className="text-xs font-black uppercase text-indigo-400 mb-2 flex items-center gap-2">
                                <span className="bg-indigo-200 text-indigo-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">?</span>
                                Come si legge questo grafico?
                            </h4>
                            <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                                "{detail.explanation}"
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceOverview;
