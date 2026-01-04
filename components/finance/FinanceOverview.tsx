
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Chart from 'chart.js/auto';
import CalculatorIcon from '../icons/CalculatorIcon';
import Modal from '../Modal';
import { Transaction, TransactionType, TransactionCategory } from '../../types';

interface FinanceOverviewProps {
    stats: any;
    transactions: Transaction[];
}

// Helper duplicato (local) per overview
const getMacroCategory = (cat: TransactionCategory): 'Logistica' | 'Generali' | 'Operazioni' | 'Altro' => {
    // Replica della logica definita in Finance.tsx per coerenza visiva
    const catStr = cat as string; 
    // Logistica
    if (['RCA', 'Bollo Auto', 'Manutenzione Auto', 'Consumo Auto', 'Carburante', 'Parcheggio', 'Sanzioni', 'Biglietto Viaggio'].includes(catStr)) return 'Logistica';
    // Generali
    // Include stringhe legacy 'Abbonamento Fibra', 'Abbonamento SIM' per retrocompatibilità
    if (['Consulenze/Commercialista', 'Tasse/Bollo', 'Spese Bancarie', 'Abbonamento Fibra', 'Abbonamento SIM', 'Internet e telefonia', 'Formazione', 'Licenze Software', 'Hardware Ufficio', 'Vendite/Incassi', 'Capitale/Versamenti'].includes(catStr)) return 'Generali';
    // Operazioni
    if (['Nolo', 'Quote Associative', 'Attrezzature Sede', 'Igiene e Sicurezza', 'Materiali/Cancelleria', 'Libri', 'Hardware/Software Didattico', 'Stampa', 'Social'].includes(catStr)) return 'Operazioni';
    
    return 'Altro';
};

const KpiDetailChart: React.FC<{ type: string; stats: any; transactions: Transaction[] }> = ({ type, stats, transactions }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let config: any = {};

        if (type === 'revenue') {
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
            // Costi Operativi - Raggruppati per Macro-Categoria
            const expenses = transactions.filter(t => t.type === TransactionType.Expense && !t.isDeleted);
            const macros: Record<string, number> = { 'Logistica': 0, 'Generali': 0, 'Operazioni': 0, 'Altro': 0 };
            
            expenses.forEach(t => {
                const m = getMacroCategory(t.category);
                macros[m] += t.amount;
            });
            
            // Filtra solo quelli > 0
            const labels = Object.keys(macros).filter(k => macros[k] > 0);
            const data = labels.map(k => macros[k]);
            
            // Colori standard per Macro
            const macroColors: Record<string, string> = {
                'Logistica': '#f59e0b', // Amber
                'Generali': '#64748b',  // Slate
                'Operazioni': '#ef4444', // Red
                'Altro': '#9ca3af'
            };

            config = {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: labels.map(l => macroColors[l] || '#ccc'),
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: { 
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => {
                                    const value = Number(context.raw);
                                    const total = context.chart._metasets[context.datasetIndex].total;
                                    const percentage = ((value / total) * 100).toFixed(1) + '%';
                                    return ` ${context.label}: ${value.toFixed(2)}€ (${percentage})`;
                                }
                            }
                        }
                    }
                }
            };
        } else if (type === 'margin') {
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
        } else if (type === 'cashflow') {
            config = {
                type: 'bar',
                data: {
                    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                    datasets: [
                        {
                            label: 'Ricavi',
                            data: stats.monthlyData.map((d: any) => d.revenue),
                            backgroundColor: '#10b981', 
                            borderRadius: 4,
                            barPercentage: 0.7,
                            categoryPercentage: 0.8
                        },
                        {
                            label: 'Costi',
                            data: stats.monthlyData.map((d: any) => d.expenses), 
                            backgroundColor: '#ef4444', 
                            borderRadius: 4,
                            barPercentage: 0.7,
                            categoryPercentage: 0.8
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'top', align: 'end' },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => ` ${context.dataset.label}: ${Number(context.raw).toFixed(2)}€`
                            }
                        }
                    },
                    scales: { 
                        y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, 
                        x: { grid: { display: false } } 
                    }
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
    const [showCashFlowModal, setShowCashFlowModal] = useState(false);

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
                    explanation: "Immagina che ogni barra sia una pila di monete raccolte in quel mese. Le barre più alte significano che il salvadanaio si è riempito di più!",
                    icon: "💰"
                };
            case 'costs':
                return {
                    title: "Costi Operativi (Macro)",
                    desc: "Suddivisione spese per aree: Logistica, Generali, Operazioni.",
                    explanation: "Questa ciambella mostra le 3 grandi aree di spesa. La Logistica riguarda i viaggi, le Operazioni riguardano sedi e corsi, i Generali la struttura aziendale.",
                    icon: "💸"
                };
            case 'margin':
                return {
                    title: "Margine Operativo",
                    desc: "La percentuale di incasso che rimane dopo aver pagato i costi.",
                    explanation: "La fetta blu è quella che ti rimane in tasca per ogni euro che incassi.",
                    icon: "🍰"
                };
            case 'taxes':
                return {
                    title: "Accantonamento Tasse",
                    desc: "Soldi da mettere da parte per lo Stato.",
                    explanation: "Attenzione! La barra gialla sono soldi che hai incassato ma non sono tuoi: sono dello Stato (Tasse e Bolli).",
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
                <div 
                    className="lg:col-span-2 md-card p-8 bg-white h-[450px] relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                    onClick={() => setShowCashFlowModal(true)}
                >
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                        <CalculatorIcon /> Analisi Flussi Temporali (Clicca per dettagli)
                    </h3>
                    <div className="h-[320px]"><canvas ref={chartRef}></canvas></div>
                </div>
                <div className="space-y-6">
                    <StrategyCard title="Soglia Forfettario" desc={stats.revenue > 60000 ? "ATTENZIONE: Sei vicino alla soglia." : "Stato Sicuro."} status={stats.revenue > 70000 ? 'danger' : 'success'} />
                    <StrategyCard title="Efficiency Insight" desc={stats.margin < 30 ? "Margine basso rilevato." : "Ottima efficienza operativa."} status={stats.margin < 30 ? 'warning' : 'success'} />
                    <div className="md-card p-6 bg-indigo-900 text-white shadow-indigo-200">
                        <h4 className="font-bold text-xs uppercase text-indigo-300 mb-2">Utile Netto Stimato</h4>
                        <p className="text-3xl font-black">{(stats.profit - stats.totalAll).toFixed(2)}€</p>
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

            {showCashFlowModal && (
                <Modal onClose={() => setShowCashFlowModal(false)} size="xl">
                    <div className="flex flex-col h-full max-h-[90vh]">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">Analisi Flussi Annuali</h3>
                                <p className="text-sm text-slate-500">Confronto diretto Ricavi vs Costi mensili</p>
                            </div>
                            <button onClick={() => setShowCashFlowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
                        </div>
                        
                        <div className="p-8 flex-1 flex flex-col items-center justify-center bg-white min-h-[400px]">
                            <div className="w-full h-full relative">
                                <KpiDetailChart type="cashflow" stats={stats} transactions={transactions} />
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceOverview;
