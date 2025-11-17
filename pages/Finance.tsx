import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment } from '../types';
import { getTransactions, addTransaction, deleteTransaction } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

type Tab = 'overview' | 'transactions' | 'invoices' | 'quotes';

const StatCard: React.FC<{ title: string; value: string; color: string; }> = ({ title, value, color }) => (
  <div className={`bg-white p-4 rounded-lg shadow-md border-l-4 ${color}`}>
    <h3 className="text-sm font-medium text-slate-500">{title}</h3>
    <p className="text-2xl font-semibold text-slate-800 mt-1">{value}</p>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
        <div className="h-64">
            {children}
        </div>
    </div>
);


const TransactionForm: React.FC<{
    onSave: (transaction: TransactionInput) => void;
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>(TransactionType.Expense);
    const [category, setCategory] = useState<TransactionCategory>(TransactionCategory.OtherExpense);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BankTransfer);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            description,
            amount: Number(amount),
            date: new Date(date).toISOString(),
            type,
            category,
            paymentMethod
        });
    };

    const incomeCategories = Object.values(TransactionCategory).filter(c => 
        [TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));
    
    const expenseCategories = Object.values(TransactionCategory).filter(c => 
        ![TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">Nuova Transazione</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Descrizione</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} required className="mt-1 block w-full input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Importo (€)</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="0" className="mt-1 block w-full input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Data</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full input" />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Tipo</label>
                        <select value={type} onChange={e => setType(e.target.value as TransactionType)} className="mt-1 block w-full input">
                            <option value={TransactionType.Income}>Entrata</option>
                            <option value={TransactionType.Expense}>Uscita</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Categoria</label>
                        <select value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="mt-1 block w-full input">
                            {(type === TransactionType.Income ? incomeCategories : expenseCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Metodo Pagamento</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="mt-1 block w-full input">
                        {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                    </select>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">Salva</button>
            </div>
        </form>
    );
};

const Finance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Chart refs
    const monthlyChartRef = useRef<HTMLCanvasElement>(null);
    const enrollmentsChartRef = useRef<HTMLCanvasElement>(null);
    const expensesDoughnutRef = useRef<HTMLCanvasElement>(null);


    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transactionsData, enrollmentsData] = await Promise.all([getTransactions(), getAllEnrollments()]);
            setTransactions(transactionsData);
            setEnrollments(enrollmentsData);
        } catch (err) {
            setError("Impossibile caricare i dati finanziari.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleSaveTransaction = async (transaction: TransactionInput) => {
        await addTransaction(transaction);
        setIsModalOpen(false);
        fetchAllData();
    };
    
    const handleDeleteTransaction = async (id: string) => {
        if(window.confirm("Sei sicuro di voler eliminare questa transazione?")) {
            await deleteTransaction(id);
            fetchAllData();
        }
    };
    
    // --- METRICS CALCULATION ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyIncome = transactions
        .filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpense = transactions
        .filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);
        
    const annualIncome = transactions
        .filter(t => t.type === TransactionType.Income && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const annualExpense = transactions
        .filter(t => t.type === TransactionType.Expense && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);

    // Regime Forfettario Calculation
    const COEFFICIENTE_REDDITIVITA = 0.78;
    const ALIQUOTA_INPS = 0.2623;
    const ALIQUOTA_IMPOSTA = 0.05;

    const imponibileLordo = annualIncome * COEFFICIENTE_REDDITIVITA;
    const contributiInpsStimati = imponibileLordo * ALIQUOTA_INPS;
    const imponibileNetto = imponibileLordo - contributiInpsStimati;
    const impostaSostitutivaStimata = imponibileNetto > 0 ? imponibileNetto * ALIQUOTA_IMPOSTA : 0;
    const utileNettoPrevisto = annualIncome - annualExpense - contributiInpsStimati - impostaSostitutivaStimata;


    // Chart Data Preparation
    useEffect(() => {
        const last6Months = [...Array(6)].map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return { month: d.getMonth(), year: d.getFullYear() };
        }).reverse();

        const labels = last6Months.map(d => new Date(d.year, d.month).toLocaleString('it-IT', { month: 'short' }));

        const monthlyIncomeData = last6Months.map(d => 
            transactions
                .filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year)
                .reduce((sum, t) => sum + t.amount, 0)
        );
        const monthlyExpenseData = last6Months.map(d => 
            transactions
                .filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year)
                .reduce((sum, t) => sum + t.amount, 0)
        );
        const monthlyEnrollmentsData = last6Months.map(d => 
            enrollments.filter(e => new Date(e.startDate).getMonth() === d.month && new Date(e.startDate).getFullYear() === d.year).length
        );

        const expenseByCategory = transactions
            .filter(t => t.type === TransactionType.Expense)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {} as Record<string, number>);

        let monthlyChart: Chart, enrollmentsChart: Chart, expensesDoughnut: Chart;

        if (monthlyChartRef.current) {
            monthlyChart = new Chart(monthlyChartRef.current, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Entrate', data: monthlyIncomeData, backgroundColor: '#34d399', },
                        { label: 'Uscite', data: monthlyExpenseData, backgroundColor: '#f87171', }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        if (enrollmentsChartRef.current) {
            enrollmentsChart = new Chart(enrollmentsChartRef.current, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{ label: 'Nuovi Iscritti', data: monthlyEnrollmentsData, borderColor: '#6366f1', tension: 0.1, fill: false }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        if (expensesDoughnutRef.current) {
             expensesDoughnut = new Chart(expensesDoughnutRef.current, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(expenseByCategory),
                    datasets: [{ data: Object.values(expenseByCategory), backgroundColor: ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        return () => {
            if (monthlyChart) monthlyChart.destroy();
            if (enrollmentsChart) enrollmentsChart.destroy();
            if (expensesDoughnut) expensesDoughnut.destroy();
        };

    }, [transactions, enrollments]);


    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Entrate (Mese)" value={`${monthlyIncome.toFixed(2)}€`} color="border-green-500" />
                            <StatCard title="Uscite (Mese)" value={`${monthlyExpense.toFixed(2)}€`} color="border-red-500" />
                            <StatCard title="Utile Lordo (Mese)" value={`${(monthlyIncome - monthlyExpense).toFixed(2)}€`} color="border-indigo-500" />
                            <StatCard title="Allievi Totali" value={enrollments.length.toString()} color="border-sky-500" />
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartCard title="Andamento Mensile (Entrate vs Uscite)"><canvas ref={monthlyChartRef}></canvas></ChartCard>
                            <ChartCard title="Trend Iscrizioni Allievi"><canvas ref={enrollmentsChartRef}></canvas></ChartCard>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-lg font-semibold text-slate-700">Proiezione Fiscale (Regime Forfettario)</h3>
                                <p className="text-sm text-slate-500 mb-4">Stima basata sul fatturato dell'anno in corso.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                    <div className="bg-slate-50 p-3 rounded-md">
                                        <p className="text-xs text-slate-500">Fatturato Annuo</p>
                                        <p className="font-bold text-lg text-slate-800">{annualIncome.toFixed(2)}€</p>
                                    </div>
                                     <div className="bg-slate-50 p-3 rounded-md">
                                        <p className="text-xs text-slate-500">Imponibile (78%)</p>
                                        <p className="font-bold text-lg text-slate-800">{imponibileLordo.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-md">
                                        <p className="text-xs text-red-600">Contributi INPS (stima)</p>
                                        <p className="font-bold text-lg text-red-800">{contributiInpsStimati.toFixed(2)}€</p>
                                    </div>
                                     <div className="bg-red-50 p-3 rounded-md">
                                        <p className="text-xs text-red-600">Imposta (5%) (stima)</p>
                                        <p className="font-bold text-lg text-red-800">{impostaSostitutivaStimata.toFixed(2)}€</p>
                                    </div>
                                     <div className="bg-green-50 p-3 rounded-md col-span-2 md:col-span-1">
                                        <p className="text-xs text-green-600">Utile Netto Previsto</p>
                                        <p className="font-bold text-lg text-green-800">{utileNettoPrevisto.toFixed(2)}€</p>
                                    </div>
                                </div>
                            </div>
                            <ChartCard title="Ripartizione Costi"><canvas ref={expensesDoughnutRef}></canvas></ChartCard>
                        </div>

                    </div>
                );
            case 'transactions':
                return (
                    <div className="bg-white p-6 rounded-lg shadow-md">
                         <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200 text-sm text-slate-500">
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Descrizione</th>
                                    <th className="p-4">Categoria</th>
                                    <th className="p-4 text-right">Importo</th>
                                    <th className="p-4">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-4 text-sm text-slate-600">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-medium text-slate-800">{t.description}</td>
                                        <td className="p-4 text-sm text-slate-600">{t.category}</td>
                                        <td className={`p-4 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}€
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => handleDeleteTransaction(t.id)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                );
            case 'invoices':
            case 'quotes':
                return (
                     <div className="bg-white p-8 rounded-lg shadow-md flex flex-col items-center justify-center h-96">
                        <h2 className="text-xl font-semibold text-slate-700">Sezione in Costruzione</h2>
                        <p className="text-slate-500 mt-2">Questa funzionalità sarà disponibile a breve.</p>
                    </div>
                )
        }
    };
    
  return (
    <div>
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Finanza</h1>
              <p className="mt-1 text-slate-500">Monitora costi, ricavi, fatture e pagamenti.</p>
            </div>
            {activeTab === 'transactions' && (
             <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                <PlusIcon />
                <span className="ml-2">Aggiungi Transazione</span>
            </button>
            )}
        </div>

        <div className="mt-6 border-b border-slate-200">
            <nav className="-mb-px flex space-x-6">
                <button onClick={() => setActiveTab('overview')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Panoramica</button>
                <button onClick={() => setActiveTab('transactions')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Transazioni</button>
                <button onClick={() => setActiveTab('invoices')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'invoices' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Fatture</button>
                <button onClick={() => setActiveTab('quotes')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'quotes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>Preventivi</button>
            </nav>
        </div>
        
        <div className="mt-8">
            {loading ? <div className="flex justify-center items-center h-64"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             renderContent()
            }
        </div>
        
         {isModalOpen && (
            <Modal onClose={() => setIsModalOpen(false)}>
                <TransactionForm onSave={handleSaveTransaction} onCancel={() => setIsModalOpen(false)}/>
            </Modal>
        )}
    </div>
  );
};

export default Finance;