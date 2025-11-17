import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod } from '../types';
import { getTransactions, addTransaction, deleteTransaction } from '../services/financeService';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';

type Tab = 'overview' | 'transactions' | 'invoices' | 'quotes';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getTransactions();
            setTransactions(data);
        } catch (err) {
            setError("Impossibile caricare le transazioni.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleSaveTransaction = async (transaction: TransactionInput) => {
        await addTransaction(transaction);
        setIsModalOpen(false);
        fetchTransactions();
    };
    
    const handleDeleteTransaction = async (id: string) => {
        if(window.confirm("Sei sicuro di voler eliminare questa transazione?")) {
            await deleteTransaction(id);
            fetchTransactions();
        }
    };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // FIX: Add explicit type for accumulator in reduce to help type inference.
    const monthlyIncome = transactions
        .filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum: number, t) => sum + t.amount, 0);

    // FIX: Add explicit type for accumulator in reduce to help type inference.
    const monthlyExpense = transactions
        .filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
        .reduce((sum: number, t) => sum + t.amount, 0);
        
    // FIX: Add explicit type for accumulator in reduce to help type inference. This resolves the error on the next line.
    const expenseByCategory = transactions
        .filter(t => t.type === TransactionType.Expense)
        .reduce((acc: Record<TransactionCategory, number>, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
        }, {} as Record<TransactionCategory, number>);

    // FIX: Add explicit types for accumulator and value in reduce to help type inference.
    const totalExpense = Object.values(expenseByCategory).reduce((sum: number, amount: number) => sum + amount, 0);

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-green-50 p-6 rounded-lg">
                                <h3 className="text-sm font-medium text-green-700">Entrate (Mese)</h3>
                                <p className="text-3xl font-semibold text-green-800 mt-2">{monthlyIncome.toFixed(2)}€</p>
                            </div>
                            <div className="bg-red-50 p-6 rounded-lg">
                                <h3 className="text-sm font-medium text-red-700">Uscite (Mese)</h3>
                                <p className="text-3xl font-semibold text-red-800 mt-2">{monthlyExpense.toFixed(2)}€</p>
                            </div>
                            <div className="bg-indigo-50 p-6 rounded-lg">
                                <h3 className="text-sm font-medium text-indigo-700">Saldo (Mese)</h3>
                                <p className="text-3xl font-semibold text-indigo-800 mt-2">{(monthlyIncome - monthlyExpense).toFixed(2)}€</p>
                            </div>
                        </div>
                         <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="font-semibold text-slate-700 mb-4">Spese per Categoria</h3>
                            <div className="space-y-3">
                                {/* FIX: Refactor sort to avoid destructuring in callback parameters, which was confusing the type checker. */}
                                {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
                                    <div key={category}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-600">{category}</span>
                                            <span className="font-medium text-slate-800">{amount.toFixed(2)}€</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(amount / totalExpense) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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