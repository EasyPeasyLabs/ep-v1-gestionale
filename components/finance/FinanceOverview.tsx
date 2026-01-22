
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Chart from 'chart.js/auto';
import CalculatorIcon from '../icons/CalculatorIcon';
import SparklesIcon from '../icons/SparklesIcon';
import Modal from '../Modal';
import { Transaction, TransactionType, TransactionCategory, Invoice, DocumentStatus } from '../../types';

interface FinanceOverviewProps {
    stats: any;
    transactions: Transaction[];
    invoices: Invoice[];
    overviewYear: number;
    setOverviewYear: (year: number) => void;
}

const getMacroCategory = (cat: TransactionCategory): string => {
    const catStr = cat as string; 
    if (['RCA', 'Bollo Auto', 'Manutenzione Auto', 'Consumo Auto', 'Carburante', 'Parcheggio', 'Sanzioni', 'Biglietto Viaggio'].includes(catStr)) return 'Logistica';
    if (['Consulenze/Commercialista', 'Tasse/Bollo', 'Spese Bancarie', 'Internet e telefonia', 'Formazione', 'Licenze Software', 'Hardware Ufficio', 'Vendite/Incassi', 'Capitale/Versamenti'].includes(catStr)) return 'Generali';
    if (catStr === 'Nolo') return 'Noli/Sedi';
    if (['Quote Associative', 'Attrezzature Sede', 'Igiene e Sicurezza', 'Materiali/Cancelleria', 'Libri', 'Hardware/Software Didattico', 'Stampa', 'Social'].includes(catStr)) return 'Operazioni';
    return 'Altro';
};

const KpiDetailChart: React.FC<{ type: string; stats: any; transactions: Transaction[] }> = ({ type, stats, transactions }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let config: any = {};
        if (type === 'Fatturato') {
            config = { type: 'bar', data: { labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'], datasets: [{ label: 'Incassi Effettivi', data: (stats.monthlyData || []).map((d: any) => d.revenue), backgroundColor: '#10b981', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } };
        } else if (type === 'Costi') {
            const expenses = transactions.filter(t => t.type === TransactionType.Expense && !t.isDeleted);
            const macros: Record<string, number> = { 'Logistica': 0, 'Generali': 0, 'Operazioni': 0, 'Noli/Sedi': 0, 'Altro': 0 };
            expenses.forEach(t => { const m = getMacroCategory(t.category); macros[m] += (t.amount || 0); });
            const labels = Object.keys(macros).filter(k => macros[k] > 0);
            const data = labels.map(k => macros[k]);
            config = { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#9ca3af'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%' } };
        } else if (type === 'Margine') {
            config = { type: 'pie', data: { labels: ['Utile Operativo', 'Costi Totali'], datasets: [{ data: [Math.max(0, stats.profit || 0), stats.expenses || 0], backgroundColor: ['#4f46e5', '#cbd5e1'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false } };
        } else if (type === 'Accantonamento') {
            config = { type: 'bar', data: { labels: ['Tasse', 'INPS', 'Bolli'], datasets: [{ data: [stats.tax || 0, stats.inps || 0, stats.stampDutyTotal || 0], backgroundColor: ['#ef4444', '#f59e0b', '#64748b'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } };
        }

        if (config.type) chartInstanceRef.current = new Chart(ctx, config);
        return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
    }, [type, stats, transactions]);

    return <div className="w-full h-full relative"><canvas ref={canvasRef} /></div>;
};

const KpiCard = ({ title, value, color, progress, label, sub, onClick }: any) => (
    <div onClick={onClick} className={`md-card p-6 bg-white shadow-xl border-l-4 cursor-pointer transition-transform transform hover:scale-105 active:scale-95 group relative overflow-hidden`} style={{ borderLeftColor: color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'indigo' ? '#6366f1' : '#f59e0b' }}>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-1 font-bold">{sub}</p>}
        {progress !== undefined && (
            <div className="mt-4">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 mb-1"><span>{label}</span><span>{(Number(progress) || 0).toFixed(0)}%</span></div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(Number(progress) || 0, 100)}%` }}></div>
                </div>
            </div>
        )}
    </div>
);

const FinanceOverview: React.FC<FinanceOverviewProps> = ({ stats, transactions, invoices, overviewYear, setOverviewYear }) => {
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

    const availableYears = useMemo(() => {
        const list = [];
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 1; y >= 2025; y--) list.push(y);
        return list;
    }, []);

    useEffect(() => {
        if (chartRef.current) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                chartInstance.current = new Chart(ctx, { type: 'line', data: { labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'], datasets: [{ label: 'Entrate (Cassa)', data: (stats.monthlyData || []).map((d: any) => d.revenue), borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false } });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [stats]);

    const advice = useMemo(() => {
        const short: string[] = [];
        const long: string[] = [];
        
        const drafts = invoices.filter(i => i.status === DocumentStatus.Draft && !i.isGhost).length;
        if (drafts > 0) short.push(`Hai ${drafts} fatture in bozza: inviale per velocizzare gli incassi.`);
        
        const sdiPending = invoices.filter(i => i.status === DocumentStatus.PendingSDI).length;
        if (sdiPending > 0) short.push(`Ci sono ${sdiPending} documenti in attesa di codice SDI.`);

        if (stats.margin < 30) long.push("Il margine operativo è basso (sotto il 30%): valuta una revisione dei listini o un taglio dei costi logistici.");
        else long.push("Ottima marginalità: potresti investire l'utile in nuove attrezzature o marketing.");

        if (stats.revenue > 60000) long.push("Ti stai avvicinando alla soglia degli 85k: pianifica con il commercialista l'eventuale passaggio di regime.");

        return { short, long };
    }, [invoices, stats]);

    const educationalFooters: Record<string, string> = {
        'Fatturato': "Il fatturato espresso qui rappresenta il totale degli incassi reali registrati in cassa (Transazioni di Entrata). Non include le fatture ancora da incassare o i versamenti di capitale proprio.",
        'Costi': "Le uscite includono tutti i costi operativi (noli, logistica, software) e amministrativi registrati nell'anno solare corrente.",
        'Margine': "Il margine è la percentuale di guadagno lordo rispetto al fatturato. Un margine sano per la tua attività dovrebbe oscillare tra il 40% e il 65%.",
        'Accantonamento': "Questa cifra rappresenta la riserva minima che dovresti detenere per coprire le tasse e i contributi INPS che pagherai nell'anno fiscale successivo. Si basa sui coefficienti del regime forfettario."
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KpiCard title="Fatturato" value={`${(stats.revenue ?? 0).toFixed(2)}€`} color="emerald" progress={stats.progress} label="Soglia 85k" onClick={() => setSelectedKpi('Fatturato')} />
                <KpiCard title="Costi" value={`${(stats.expenses ?? 0).toFixed(2)}€`} color="red" onClick={() => setSelectedKpi('Costi')} />
                <KpiCard title="Margine" value={`${(stats.margin ?? 0).toFixed(1)}%`} color="indigo" onClick={() => setSelectedKpi('Margine')} />
                <KpiCard title="Accantonamento" value={`${(stats.savingsSuggestion ?? 0).toFixed(2)}€`} color="amber" sub="Suggerito Tasse" onClick={() => setSelectedKpi('Accantonamento')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 md-card p-8 bg-white h-[450px]">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <h3 className="text-xl font-black flex items-center gap-2"><CalculatorIcon /> Flussi di Cassa Annuali</h3>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-inner">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anno Fiscale</span>
                            <select 
                                value={overviewYear} 
                                onChange={e => setOverviewYear(Number(e.target.value))} 
                                className="bg-transparent border-none text-sm font-bold text-indigo-700 outline-none cursor-pointer p-0"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="h-[320px]"><canvas ref={chartRef}></canvas></div>
                </div>
                
                <div className="space-y-6">
                    <div className="md-card p-6 bg-indigo-900 text-white shadow-xl">
                        <h4 className="font-bold text-xs uppercase text-indigo-300 mb-2">Utile Netto Stimato ({overviewYear})</h4>
                        <p className="text-3xl font-black">{((stats.profit ?? 0) - (stats.totalAll ?? 0)).toFixed(2)}€</p>
                        <p className="text-[10px] text-indigo-400 mt-2 italic">Cifra al netto di tasse, contributi e bolli.</p>
                    </div>

                    <div className="md-card p-5 bg-white border border-slate-200">
                        <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <SparklesIcon /> AI Strategy Advisor
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Breve Termine (Operatività)</p>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    {advice.short.map((a, i) => <li key={i} className="flex gap-2"><span>•</span> {a}</li>)}
                                    {advice.short.length === 0 && <li className="italic text-slate-400">Nessuna azione urgente richiesta.</li>}
                                </ul>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Medio-Lungo Termine (Strategia)</p>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    {advice.long.map((a, i) => <li key={i} className="flex gap-2"><span>•</span> {a}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedKpi && (
                <Modal onClose={() => setSelectedKpi(null)} size="lg">
                    <div className="p-6 bg-slate-50 border-b flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase">{selectedKpi}</h3>
                            <p className="text-xs text-slate-400 font-bold">Analisi granulare del dato</p>
                        </div>
                        <button onClick={() => setSelectedKpi(null)} className="text-slate-400 font-bold hover:text-slate-800 transition-colors">✕</button>
                    </div>
                    <div className="p-8 h-80"><KpiDetailChart type={selectedKpi} stats={stats} transactions={transactions} /></div>
                    <div className="p-6 bg-slate-50 border-t">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Come leggere questo dato:</h4>
                        <p className="text-sm text-slate-600 italic leading-relaxed">{educationalFooters[selectedKpi]}</p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceOverview;
