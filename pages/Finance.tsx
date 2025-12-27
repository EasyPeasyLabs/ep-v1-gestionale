
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import { 
    Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, 
    TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, 
    DocumentStatus, CompanyInfo, Client, Supplier, Enrollment, Page, DocumentItem 
} from '../types';
import { 
    getTransactions, addTransaction, updateTransaction, deleteTransaction, 
    permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, 
    deleteInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, 
    deleteQuote, permanentDeleteQuote, syncRentExpenses, batchAddTransactions
} from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import { getCompanyInfo } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import DocumentCheckIcon from '../components/icons/DocumentCheckIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import SearchIcon from '../components/icons/SearchIcon';

// --- CONFIG FISCALE FORFETTARIO ---
const INPS_RATE = 0.2623;
const TAX_RATE_STARTUP = 0.05;
const COEFF_REDDITIVITA = 0.78;
const LIMIT_FORFETTARIO = 85000;

// --- Icona WhatsApp ---
const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

const RefreshIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);

// --- Mappatura Categorie Italiano & Suggerimenti ---
const categoryDetails: Record<TransactionCategory, { label: string; help: string }> = {
    [TransactionCategory.Sales]: { label: 'Vendite / Incassi', help: 'Entrate da iscrizioni, vendita libri o servizi extra.' },
    [TransactionCategory.Rent]: { label: 'Affitto / Locazione', help: 'Canone mensile per la sede o affitto sale a ore.' },
    [TransactionCategory.Taxes]: { label: 'Tasse & Bolli', help: 'Pagamenti F24, INPS, marche da bollo o imposte statali.' },
    [TransactionCategory.Fuel]: { label: 'Carburante & Trasporti', help: 'Benzina, pedaggi, biglietti treno/aereo o rimborsi chilometrici.' },
    [TransactionCategory.Materials]: { label: 'Materiali & Cancelleria', help: 'Acquisto libri, penne, carta, giochi o attrezzature per lezioni.' },
    [TransactionCategory.ProfessionalServices]: { label: 'Servizi & Consulenze', help: 'Commercialista, avvocato, pulizie, manutenzioni o collaboratori esterni.' },
    [TransactionCategory.Software]: { label: 'Software & Internet', help: 'Abbonamenti (Zoom, Canva, Gestionale), sito web o telefonia.' },
    [TransactionCategory.Marketing]: { label: 'Marketing & Pubblicità', help: 'Sponsorizzate social, stampa volantini, gadget o eventi.' },
    [TransactionCategory.Capital]: { label: 'Capitale / Versamenti Propri', help: 'Soldi versati dal tuo conto personale a quello aziendale. NON è tassato.' },
    [TransactionCategory.Other]: { label: 'Altro / Spese Bancarie', help: 'Commissioni bancarie, interessi o voci non presenti sopra.' },
};

// --- Componente Modale Dettaglio ROI "Educational" ---
const LocationDetailModal: React.FC<{
    data: { name: string, color: string, revenue: number, costs: number };
    onClose: () => void;
}> = ({ data, onClose }) => {
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

// --- Componente Form Transazione Manuale ---
const TransactionForm: React.FC<{
    transaction?: Transaction | null;
    suppliers: Supplier[];
    onSave: (t: TransactionInput | Transaction) => void;
    onCancel: () => void;
}> = ({ transaction, suppliers, onSave, onCancel }) => {
    const [date, setDate] = useState(transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState(transaction?.description || '');
    const [amount, setAmount] = useState(transaction?.amount || 0);
    const [type, setType] = useState<TransactionType>(transaction?.type || TransactionType.Expense);
    const [category, setCategory] = useState<TransactionCategory>(transaction?.category || TransactionCategory.Materials);
    const [allocationId, setAllocationId] = useState(transaction?.allocationId || '');

    const allLocations = useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const locName = allLocations.find(l => l.id === allocationId)?.name;
        
        const data: TransactionInput = {
            date: new Date(date).toISOString(),
            description,
            amount: Number(amount),
            type,
            category,
            paymentMethod: PaymentMethod.Other,
            status: TransactionStatus.Completed,
            allocationType: allocationId ? 'location' : 'general',
            // FIX: Use 'null' instead of 'undefined' to prevent Firestore crash.
            // Casting to 'any' allows null without breaking strict TS interfaces if they require string | undefined.
            allocationId: (allocationId || null) as any,
            allocationName: (locName || null) as any
        };

        if (transaction?.id) onSave({ ...data, id: transaction.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{transaction ? 'Modifica Voce' : 'Nuova Voce'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex gap-4 mb-4">
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center font-bold ${type === TransactionType.Income ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white text-gray-500'}`}>
                        <input type="radio" checked={type === TransactionType.Income} onChange={() => setType(TransactionType.Income)} className="hidden" />
                        Entrata
                    </label>
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center font-bold ${type === TransactionType.Expense ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white text-gray-500'}`}>
                        <input type="radio" checked={type === TransactionType.Expense} onChange={() => setType(TransactionType.Expense)} className="hidden" />
                        Uscita
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Data</label>
                    </div>
                    <div className="md-input-group">
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className="md-input" required />
                        <label className="md-input-label">Importo (€)</label>
                    </div>
                </div>

                <div className="md-input-group">
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="md-input" required placeholder=" " />
                    <label className="md-input-label">Descrizione</label>
                </div>

                <div>
                    <div className="md-input-group">
                        <select value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="md-input">
                            {Object.values(TransactionCategory).map(c => (
                                <option key={c} value={c}>
                                    {categoryDetails[c]?.label || c}
                                </option>
                            ))}
                        </select>
                        <label className="md-input-label !top-0">Categoria</label>
                    </div>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 items-start animate-fade-in">
                        <span className="text-xl">💡</span>
                        <div>
                            <p className="text-xs font-bold text-blue-800 uppercase mb-0.5">Guida alla Categoria</p>
                            <p className="text-xs text-blue-700 leading-snug">
                                {categoryDetails[category]?.help || "Seleziona una categoria per vedere i dettagli."}
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Allocazione (Opzionale - Per ROI Sede)</label>
                    <select value={allocationId} onChange={e => setAllocationId(e.target.value)} className="md-input bg-gray-50">
                        <option value="">Generale / Nessuna Sede</option>
                        {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button>
            </div>
        </form>
    );
};

// --- Componente Form Modifica Fattura (FULL EDIT) ---
const InvoiceEditForm: React.FC<{
    invoice: Invoice;
    onSave: (data: Partial<InvoiceInput>) => void;
    onCancel: () => void;
}> = ({ invoice, onSave, onCancel }) => {
    const [issueDate, setIssueDate] = useState(invoice.issueDate.split('T')[0]);
    const [dueDate, setDueDate] = useState(invoice.dueDate.split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod);
    const [notes, setNotes] = useState(invoice.notes || '');
    const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
    const [sdiId, setSdiId] = useState(invoice.sdiId || '');
    
    const [items, setItems] = useState<DocumentItem[]>(invoice.items || []);
    const [totalAmount, setTotalAmount] = useState(invoice.totalAmount);

    useEffect(() => {
        const sum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        const stampDuty = invoice.hasStampDuty ? 2 : 0;
        setTotalAmount(sum + stampDuty);
    }, [items, invoice.hasStampDuty]);

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, price: 0, notes: '' }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            invoiceNumber,
            totalAmount,
            items,
            sdiId: invoice.status === DocumentStatus.SealedSDI ? sdiId : invoice.sdiId,
            issueDate: new Date(issueDate).toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            paymentMethod,
            notes
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b flex-shrink-0 bg-white z-10">
                <h3 className="text-xl font-bold text-gray-800">Modifica Fattura</h3>
                <p className="text-sm text-gray-500">{invoice.clientName}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="md-input-group col-span-2">
                        <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="md-input font-mono font-bold" required />
                        <label className="md-input-label">Numero Fattura</label>
                    </div>
                    <div className="md-input-group">
                        <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Emissione</label>
                    </div>
                    <div className="md-input-group">
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Scadenza</label>
                    </div>
                    <div className="md-input-group col-span-2">
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label className="md-input-label !top-0">Metodo Pagamento</label>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Righe Documento</h4>
                    <div className="space-y-3">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white p-2 border rounded shadow-sm">
                                <div className="flex-1 space-y-2">
                                    <input 
                                        type="text" 
                                        value={item.description} 
                                        onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                                        className="w-full text-sm font-medium border-b border-gray-200 focus:border-indigo-500 outline-none pb-1"
                                        placeholder="Descrizione..."
                                    />
                                    <div className="flex gap-2">
                                        <div className="w-20">
                                            <label className="text-[10px] text-gray-400 block">Q.tà</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                value={item.quantity} 
                                                onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} 
                                                className="w-full text-xs border rounded p-1 bg-gray-50"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] text-gray-400 block">Prezzo Unit.</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={item.price} 
                                                onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} 
                                                className="w-full text-xs border rounded p-1 bg-gray-50 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex-1 text-right self-end pb-1">
                                            <span className="text-xs font-bold text-gray-700">{(item.quantity * item.price).toFixed(2)}€</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1 mt-1">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddItem} className="mt-3 text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                        <PlusIcon /> Aggiungi Riga
                    </button>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-indigo-800">Bollo Virtuale</span>
                        <span className="text-sm font-bold text-indigo-800">{invoice.hasStampDuty ? '2.00€' : '0.00€'}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-indigo-200 pt-2">
                        <span className="text-lg font-bold text-indigo-900">TOTALE</span>
                        <span className="text-xl font-black text-indigo-900">{totalAmount.toFixed(2)}€</span>
                    </div>
                    <p className="text-[10px] text-indigo-400 mt-1 text-right italic">Calcolato automaticamente</p>
                </div>

                {invoice.status === DocumentStatus.SealedSDI && (
                    <div className="md-input-group bg-green-50 p-3 rounded border border-green-200">
                        <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} className="md-input bg-transparent font-mono" />
                        <label className="md-input-label !top-0 text-green-700">ID Sigillo SDI (Modificabile)</label>
                    </div>
                )}

                <div className="md-input-group">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input" rows={3} placeholder=" " />
                    <label className="md-input-label">Note</label>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0 z-10">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva Modifiche</button>
            </div>
        </form>
    );
};

interface FinanceProps {
    initialParams?: {
        tab?: 'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes';
        searchTerm?: string;
    };
    onNavigate?: (page: Page, params?: any) => void;
}

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes'>('overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
    const [lessonPrice, setLessonPrice] = useState(25);

    const [isSealModalOpen, setIsSealModalOpen] = useState(false);
    const [invoiceToSeal, setInvoiceToSeal] = useState<Invoice | null>(null);
    const [sdiId, setSdiId] = useState('');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [filters, setFilters] = useState({ search: '' });

    const [selectedLocationROI, setSelectedLocationROI] = useState<{name: string, color: string, revenue: number, costs: number} | null>(null);

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [t, i, q, e, s, c, info] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getCompanyInfo()
            ]);
            setTransactions(t); setInvoices(i); setQuotes(q); setEnrollments(e); setSuppliers(s); setClients(c); setCompanyInfo(info);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchData();
        if (initialParams?.tab) setActiveTab(initialParams.tab);
        if (initialParams?.searchTerm) setFilters(f => ({ ...f, search: initialParams.searchTerm || '' }));

        const handleRealTimeUpdate = () => {
            fetchData(); 
        };
        window.addEventListener('EP_DataUpdated', handleRealTimeUpdate);
        return () => window.removeEventListener('EP_DataUpdated', handleRealTimeUpdate);

    }, [fetchData, initialParams]);

    const handleSyncRents = async () => {
        if(confirm("Vuoi ricalcolare i costi di affitto per tutte le sedi in base all'occupazione reale del calendario? Questa operazione potrebbe richiedere alcuni secondi.")) {
            setLoading(true);
            try {
                await syncRentExpenses();
                await fetchData();
                alert("Sincronizzazione Noli completata!");
            } catch (e) {
                console.error(e);
                alert("Errore durante la sincronizzazione.");
            } finally {
                setLoading(false);
            }
        }
    };

    // --- ENGINE ANALITICO ---
    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted);
        const revenue = activeT.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capital).reduce((acc, t) => acc + t.amount, 0);
        const expenses = activeT.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        // Fiscale
        const taxable = revenue * COEFF_REDDITIVITA;
        const inps = taxable * INPS_RATE;
        const tax = taxable * TAX_RATE_STARTUP;
        
        // Calcolo Bolli: 2€ per ogni fattura > 77€
        // Conteggiamo i bolli raggruppati per trimestre per la nuova logica
        let stampDutyTotal = 0;
        const stampDutyQuarters = { q1: 0, q2: 0, q3: 0, q4: 0 };
        
        invoices.forEach(inv => {
            if (!inv.isDeleted && !inv.isGhost && inv.totalAmount > 77.47) {
                stampDutyTotal += 2;
                
                const d = new Date(inv.issueDate);
                const m = d.getMonth(); // 0-11
                if (m < 3) stampDutyQuarters.q1 += 2;
                else if (m < 6) stampDutyQuarters.q2 += 2;
                else if (m < 9) stampDutyQuarters.q3 += 2;
                else stampDutyQuarters.q4 += 2;
            }
        });

        // Totali Combinati
        const totalInpsTax = inps + tax;
        const totalAll = totalInpsTax + stampDutyTotal;
        const savingsSuggestion = totalAll * 1.1; 

        // Proiezioni Mensili
        const monthlyData = Array(12).fill(0).map((_, i) => {
            const monthRev = activeT.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === i && t.type === TransactionType.Income && t.category !== TransactionCategory.Capital;
            }).reduce((acc, t) => acc + t.amount, 0);
            const mTaxable = monthRev * COEFF_REDDITIVITA;
            return { month: i, revenue: monthRev, inps: mTaxable * INPS_RATE, tax: mTaxable * TAX_RATE_STARTUP };
        });

        return { 
            revenue, expenses, profit, margin, 
            taxable, inps, tax, stampDutyTotal, stampDutyQuarters,
            totalInpsTax, totalAll, 
            savingsSuggestion, monthlyData, progress: (revenue / LIMIT_FORFETTARIO) * 100 
        };
    }, [transactions, invoices]);

    // --- REVERSE ENGINEERING AI CALC ---
    const reverseEngineering = useMemo(() => {
        const compositeTaxRate = COEFF_REDDITIVITA * (INPS_RATE + TAX_RATE_STARTUP);
        const netRatio = 1 - compositeTaxRate;
        
        const annualNetTarget = targetMonthlyNet * 12;
        const grossNeeded = annualNetTarget / netRatio;
        
        const currentGross = stats.revenue;
        const gap = Math.max(0, grossNeeded - currentGross);
        
        const revenuePerLesson = lessonPrice; 
        const extraLessonsNeeded = revenuePerLesson > 0 ? Math.ceil(gap / revenuePerLesson) : 0;
        
        const studentsNeeded = Math.ceil(extraLessonsNeeded / 30);

        return {
            annualNetTarget,
            grossNeeded,
            gap,
            extraLessonsNeeded,
            studentsNeeded
        };
    }, [targetMonthlyNet, lessonPrice, stats.revenue]);

    // --- SIMULATORE RATE (New Logic) ---
    const simulatorData = useMemo(() => {
        // MODIFICA RICHIESTA 10 (STARTUP SCENARIO):
        // Poiché l'azienda è nata nel 2025, nella prima dichiarazione (2026) si paga:
        // GIUGNO: Saldo 2025 (100%) + I Acconto 2026 (50% del 2025)
        // NOVEMBRE: II Acconto 2026 (50% del 2025)
        
        const saldoCorrente = stats.totalInpsTax; // 100% Tasse calcolate sull'anno corrente
        
        // I Tranche rateizzabile (Giugno-Nov): Saldo + I Acconto (150% del totale)
        const tranche1 = saldoCorrente + (saldoCorrente * 0.5); 
        
        // II Acconto (Nov): 50% del totale
        const tranche2 = saldoCorrente * 0.5;
        
        const monthlyInstallment = tranche1 / 6; // Rateazione Giugno-Novembre

        // Scadenze Bolli (Logica Cumulo < 5000€)
        // Ipotizzando che i bolli siano sempre < 5000€ per il forfettario medio,
        // applichiamo il differimento standard:
        // I Trim -> paga entro 30 Settembre (con II Trim)
        // II Trim -> paga entro 30 Settembre
        // III Trim -> paga entro 30 Novembre
        // IV Trim -> paga entro 28 Febbraio (Anno X+1)
        
        const stampDeadlines = [
            { label: '30 Set (I+II Trim)', amount: stats.stampDutyQuarters.q1 + stats.stampDutyQuarters.q2, monthIndex: 8 }, // Sept
            { label: '30 Nov (III Trim)', amount: stats.stampDutyQuarters.q3, monthIndex: 10 }, // Nov
            { label: '28 Feb (IV Trim)', amount: stats.stampDutyQuarters.q4, monthIndex: 1 }, // Feb (next year) - Not in current simulation grid usually
        ];

        // Piano di Accantonamento Consigliato (Giugno - Novembre)
        // Per ogni mese calcoliamo: Rata Tasse + Bolli in scadenza quel mese
        // E aggiungiamo un target per il Saldo Finale di Novembre
        const savingsPlan = [];
        const months = ['GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'];
        
        for (let i = 0; i < 6; i++) {
            const monthIdx = i + 5; // 5=June, 6=July... 10=Nov
            let amount = monthlyInstallment; // Base tax installment
            
            // Add Stamps if deadline matches month
            const stampsDue = stampDeadlines.filter(s => s.monthIndex === monthIdx).reduce((sum, s) => sum + s.amount, 0);
            amount += stampsDue;

            savingsPlan.push({ month: months[i], amount });
        }

        // Aggiunta voce "Saldo Finale" separata per chiarezza
        const saldoFinaleTarget = tranche2;

        return {
            tranche1,
            tranche2,
            monthlyInstallment,
            stampDeadlines,
            savingsPlan,
            saldoFinaleTarget
        };
    }, [stats]);

    const roiSedi = useMemo(() => {
        const data: Record<string, { name: string, color: string, revenue: number, costs: number }> = {};
        suppliers.flatMap(s => s.locations).forEach(l => {
            data[l.id] = { name: l.name, color: l.color, revenue: 0, costs: 0 };
        });

        transactions.filter(t => !t.isDeleted && t.allocationId).forEach(t => {
            if (data[t.allocationId!]) {
                if (t.type === TransactionType.Income) data[t.allocationId!].revenue += t.amount;
                else data[t.allocationId!].costs += t.amount;
            }
        });
        return Object.values(data).sort((a,b) => b.revenue - a.revenue);
    }, [suppliers, transactions]);

    useEffect(() => {
        if (activeTab === 'overview' && chartRef.current && !loading) {
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
                            data: stats.monthlyData.map(d => d.revenue),
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
    }, [activeTab, loading, stats]);

    const handlePrint = async (doc: Invoice | Quote) => {
        const client = clients.find(c => c.id === doc.clientId);
        await generateDocumentPDF(doc, 'invoiceNumber' in doc ? 'Fattura' : 'Preventivo', companyInfo, client);
    };

    const handleWhatsApp = (item: Invoice | Transaction) => {
        let phone = '';
        let msg = '';
        if ('clientId' in item) {
            const c = clients.find(cl => cl.id === item.clientId);
            phone = c?.phone || '';
            msg = `Gentile cliente, le inviamo riferimento per il pagamento di ${(item as Invoice).totalAmount}€.`;
        }
        if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        else alert("Numero non trovato.");
    };

    const handleSeal = async () => {
        if (!invoiceToSeal || !sdiId) return;
        await updateInvoice(invoiceToSeal.id, { status: DocumentStatus.SealedSDI, sdiId });
        setIsSealModalOpen(false);
        await fetchData();
    };

    const handleSaveTransaction = async (t: TransactionInput | Transaction) => {
        setLoading(true);
        try {
            if ('id' in t) await updateTransaction(t.id, t);
            else await addTransaction(t);
            setIsTransactionModalOpen(false);
            setEditingTransaction(null);
            await fetchData();
        } catch(e) {
            console.error(e);
            alert("Errore salvataggio transazione.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditTransaction = (item: any) => {
        if ('amount' in item && 'category' in item && !('invoiceNumber' in item)) {
            setEditingTransaction(item);
            setIsTransactionModalOpen(true);
        }
    };

    const handleEditInvoice = (item: Invoice) => {
        setEditingInvoice(item);
        setIsInvoiceModalOpen(true);
    };

    const handleSaveInvoice = async (data: Partial<InvoiceInput>) => {
        if (!editingInvoice) return;
        setLoading(true);
        try {
            await updateInvoice(editingInvoice.id, data);
            setIsInvoiceModalOpen(false);
            setEditingInvoice(null);
            await fetchData();
        } catch(e) {
            console.error(e);
            alert("Errore salvataggio fattura.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTransaction = async () => {
        if (transactionToDelete) {
            setLoading(true);
            try {
                await deleteTransaction(transactionToDelete);
                await fetchData();
            } catch(e) { console.error(e); }
            finally { setLoading(false); setTransactionToDelete(null); }
        }
    };

    const filteredList = useMemo(() => {
        let list: any[] = [];
        if (activeTab === 'transactions') list = transactions.filter(t => !t.isDeleted);
        else if (activeTab === 'invoices') list = invoices.filter(i => !i.isDeleted && !i.isGhost);
        else if (activeTab === 'archive') list = invoices.filter(i => !i.isDeleted && (i.status === DocumentStatus.SealedSDI || i.status === DocumentStatus.PendingSDI));
        else if (activeTab === 'quotes') list = quotes.filter(q => !q.isDeleted);
        return list.filter(item => (item.clientName || item.description || item.invoiceNumber || '').toLowerCase().includes(filters.search.toLowerCase()));
    }, [activeTab, transactions, invoices, quotes, filters]);

    return (
        <div className="animate-fade-in pb-20">
            {/* HEADER */}
            <div className="flex flex-wrap justify-between items-center mb-8 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Finanza Enterprise</h1>
                    <p className="text-slate-500 font-medium">Controllo di gestione, fiscalità, logistica e flussi.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleSyncRents} className="md-btn md-btn-flat bg-white border border-indigo-200 text-indigo-700 shadow-sm font-bold flex items-center gap-1 hover:bg-indigo-50"><RefreshIcon /> Sync Noli</button>
                    <button onClick={() => fetchData()} className="md-btn md-btn-flat bg-white border shadow-sm"><RefreshIcon /> Sync</button>
                    <button onClick={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }} className="md-btn md-btn-raised md-btn-green"><PlusIcon /> Nuova Voce</button>
                </div>
            </div>

            {/* TABS */}
            <nav className="flex space-x-6 border-b border-gray-200 mb-8 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Panoramica' },
                    { id: 'cfo', label: 'CFO (Strategia)' },
                    { id: 'controlling', label: 'Controllo di Gestione' },
                    { id: 'transactions', label: 'Transazioni' }, 
                    { id: 'invoices', label: 'Fatture' },
                    { id: 'archive', label: 'Archivio' },
                    { id: 'quotes', label: 'Preventivi' }
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id as any)} 
                        className={`pb-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="space-y-8">
                    {activeTab === 'overview' && (
                        <>
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
                        </>
                    )}

                    {/* --- CFO / STRATEGIA TAB --- */}
                    {activeTab === 'cfo' && (
                        <div className="space-y-6 animate-slide-up">
                            
                            {/* 1. PIANIFICATORE FISCALE VISUALE */}
                            <div className="md-card p-6 bg-white border border-gray-200 shadow-sm rounded-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <CalculatorIcon /> Proiezione Fiscale (Forfettario)
                                    </h3>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase text-gray-400 block">TOTAL TAX</span>
                                        <span className="text-2xl font-black text-red-600">{stats.totalAll.toFixed(2)}€</span>
                                    </div>
                                </div>
                                
                                <div className="mb-6">
                                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                        <span>Plafond 85.000€</span>
                                        <span>{stats.progress.toFixed(1)}% Utilizzato</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${stats.progress > 80 ? 'bg-red-500' : 'bg-gray-600'}`} 
                                            style={{ width: `${Math.min(stats.progress, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">IMPONIBILE (78%)</p>
                                        <p className="text-xl font-black text-gray-800 mt-1">{stats.taxable.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                        <p className="text-[10px] font-bold text-orange-400 uppercase">INPS (26.23%)</p>
                                        <p className="text-xl font-black text-orange-600 mt-1">{stats.inps.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <p className="text-[10px] font-bold text-red-400 uppercase">IMPOSTA SOST. (5%)</p>
                                        <p className="text-xl font-black text-red-600 mt-1">{stats.tax.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-400 uppercase">TOT INPS+IMP.</p>
                                        <p className="text-xl font-black text-blue-700 mt-1">{stats.totalInpsTax.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">BOLLI ({stats.stampDutyTotal/2})</p>
                                        <p className="text-xl font-black text-gray-600 mt-1">{stats.stampDutyTotal.toFixed(2)}€</p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. SIMULATORE RATE (TEAL) */}
                            <div className="md-card p-6 bg-white border-2 border-teal-50 shadow-sm rounded-2xl">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    🔮 Simulatore Rate & Scadenze
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Colonna 1: Totali Tranches */}
                                    <div className="space-y-4 border-r border-gray-100 pr-4">
                                        <h4 className="text-xs font-black uppercase text-teal-800 border-b pb-2">Ripartizione Tasse</h4>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-xs font-bold text-gray-600 block">I Tranche (Rateizzabile)</span>
                                                <span className="text-[10px] text-gray-400">Saldo + I Acconto</span>
                                            </div>
                                            <span className="font-bold text-gray-900">{simulatorData.tranche1.toFixed(2)}€</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-xs font-bold text-gray-600 block">Saldo Finale (II Acconto)</span>
                                                <span className="text-[10px] text-gray-400">Novembre (Unica Sol.)</span>
                                            </div>
                                            <span className="font-bold text-gray-900">{simulatorData.tranche2.toFixed(2)}€</span>
                                        </div>

                                        <div className="bg-teal-50 p-3 rounded-lg mt-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-teal-800">SCAD. BOLLI</span>
                                                <span className="font-black text-teal-900">{stats.stampDutyTotal.toFixed(2)}€</span>
                                            </div>
                                            <div className="space-y-1 mt-2">
                                                {simulatorData.stampDeadlines.map((sd, i) => (
                                                    <div key={i} className="flex justify-between text-[10px]">
                                                        <span className="text-teal-600 font-medium">{sd.label}</span>
                                                        <span className="font-bold text-teal-800">{sd.amount.toFixed(2)}€</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Colonna 2: Rateazione */}
                                    <div className="space-y-4 border-r border-gray-100 pr-4">
                                        <h4 className="text-xs font-black uppercase text-teal-800 border-b pb-2">Rateazione (I Tranche)</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'].map((month, idx) => (
                                                <div key={idx} className="bg-white border border-gray-200 rounded p-2 flex flex-col items-center">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase">{month}</span>
                                                    <span className="text-xs font-bold text-teal-600">{simulatorData.monthlyInstallment.toFixed(0)}€</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-gray-400 italic text-center mt-2">Rata calcolata su 6 mesi per il 150% del totale INPS+Imp (Scenario Start-up).</p>
                                    </div>

                                    {/* Colonna 3: Accantonamento Consigliato */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black uppercase text-amber-600 border-b pb-2">Accantonamento Consigliato</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {simulatorData.savingsPlan.map((plan, idx) => (
                                                <div key={idx} className="bg-amber-50 border border-amber-100 rounded p-2 flex flex-col items-center">
                                                    <span className="text-[9px] font-bold text-amber-400 uppercase">{plan.month}</span>
                                                    <span className="text-xs font-bold text-amber-700">{plan.amount.toFixed(0)}€</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-amber-100 p-2 rounded border border-amber-200 mt-2 flex flex-col items-center">
                                            <span className="text-[9px] font-bold text-amber-600 uppercase">SALDO FINALE (NOV)</span>
                                            <span className="text-sm font-black text-amber-800">{simulatorData.saldoFinaleTarget.toFixed(2)}€</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. AI REVERSE ENGINEERING (PURPLE) */}
                            <div className="md-card p-6 bg-white border-2 border-purple-50 shadow-md rounded-2xl ring-1 ring-purple-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <SparklesIcon /> AI Reverse Engineering
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Target Netto Mensile</label>
                                        <input 
                                            type="number" 
                                            value={targetMonthlyNet} 
                                            onChange={e => setTargetMonthlyNet(Number(e.target.value))}
                                            className="w-full text-2xl font-bold p-2 bg-gray-50 rounded-lg border-none focus:ring-2 ring-purple-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Prezzo Lezione</label>
                                        <input 
                                            type="number" 
                                            value={lessonPrice} 
                                            onChange={e => setLessonPrice(Number(e.target.value))}
                                            className="w-full text-2xl font-bold p-2 bg-gray-50 rounded-lg border-none focus:ring-2 ring-purple-200"
                                        />
                                    </div>
                                </div>

                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                                    <p className="text-xs font-bold text-purple-800 uppercase mb-1">FATTURATO ANNUO NECESSARIO (LORDO)</p>
                                    <p className="text-3xl font-black text-purple-700">{reverseEngineering.grossNeeded.toFixed(2)}€</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-red-50 rounded-xl border-l-4 border-red-400">
                                        <h4 className="text-xs font-black uppercase text-red-800 mb-2">AZIONI TATTICHE (BREVE TERMINE)</h4>
                                        <p className="text-xs text-red-700 mb-2">Per coprire il gap di {reverseEngineering.gap.toFixed(0)}€:</p>
                                        <ul className="text-xs text-gray-700 list-disc list-inside space-y-1">
                                            <li>Trovare <strong>{reverseEngineering.studentsNeeded}</strong> nuovi studenti.</li>
                                            <li>Vendere <strong>{reverseEngineering.extraLessonsNeeded}</strong> lezioni extra.</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
                                        <h4 className="text-xs font-black uppercase text-blue-800 mb-2">STRATEGIA (MEDIO/LUNGO TERMINE)</h4>
                                        <p className="text-xs text-blue-700 mb-2">Per stabilizzare il target:</p>
                                        <ul className="text-xs text-gray-700 list-disc list-inside space-y-1">
                                            <li>Alzare il prezzo medio a <strong>{(lessonPrice * 1.1).toFixed(2)}€</strong>.</li>
                                            <li>Ottimizzare i costi di nolo nelle sedi a basso margine.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'controlling' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
                            {roiSedi.map((sede, idx) => (
                                <div 
                                    key={idx} 
                                    className="md-card p-6 bg-white border-t-4 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group" 
                                    style={{ borderColor: sede.color }}
                                    onClick={() => setSelectedLocationROI(sede)}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black text-slate-800 uppercase tracking-tighter group-hover:text-indigo-600 transition-colors">{sede.name}</h4>
                                        <span className={`px-2 py-1 rounded text-[10px] font-black ${sede.revenue > sede.costs ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            ROI {sede.revenue > 0 ? (((sede.revenue - sede.costs) / sede.revenue) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs"><span>Ricavi Studenti</span><span className="font-bold text-green-600">+{sede.revenue.toFixed(2)}€</span></div>
                                        <div className="flex justify-between text-xs"><span>Costo Noli Real</span><span className="font-bold text-red-600">-{sede.costs.toFixed(2)}€</span></div>
                                        <div className="pt-2 border-t flex justify-between text-sm font-black"><span>Utile Sede</span><span className="text-indigo-600">{(sede.revenue - sede.costs).toFixed(2)}€</span></div>
                                    </div>
                                    <div className="mt-3 text-center text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Clicca per analisi semplificata</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {['transactions', 'invoices', 'archive', 'quotes'].includes(activeTab) && (
                        <div className="md-card overflow-hidden bg-white shadow-2xl border-0">
                            <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="relative flex-1 max-w-md">
                                    <div className="absolute left-3 top-3"><SearchIcon /></div>
                                    <input type="text" placeholder="Cerca nel database..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="md-input pl-10 border bg-white rounded-xl focus:ring-2 ring-indigo-500" />
                                </div>
                                {selectedItems.length > 0 && (
                                    <div className="flex gap-2 animate-fade-in">
                                        <button className="md-btn md-btn-sm bg-indigo-600 text-white font-bold"><PrinterIcon /> Stampa ({selectedItems.length})</button>
                                        <button className="md-btn md-btn-sm bg-slate-800 text-white font-bold"><TrashIcon /> Elimina</button>
                                    </div>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 border-b font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4 w-10">
                                                <input type="checkbox" onChange={e => setSelectedItems(e.target.checked ? filteredList.map(i => i.id) : [])} checked={selectedItems.length === filteredList.length && filteredList.length > 0} />
                                            </th>
                                            <th className="px-6 py-4">Data</th>
                                            <th className="px-6 py-4">Rif / ID</th>
                                            <th className="px-6 py-4">Soggetto / Causale</th>
                                            <th className="px-6 py-4 text-right">Importo</th>
                                            <th className="px-6 py-4">Stato</th>
                                            <th className="px-6 py-4 text-right">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredList.map(item => (
                                            <tr key={item.id} className={`hover:bg-indigo-50/30 transition-colors group ${selectedItems.includes(item.id) ? 'bg-indigo-50' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => setSelectedItems(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])} />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">{new Date(item.date || item.issueDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-mono font-bold text-indigo-600 text-xs">{item.invoiceNumber || item.quoteNumber || 'TRX-'+item.id.substring(0,5).toUpperCase()}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900 truncate max-w-[250px]">{item.clientName || item.description}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900">{(item.amount || item.totalAmount).toFixed(2)}€</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${
                                                        item.status === 'Paid' || item.status === 'Completed' || item.status === 'SealedSDI' 
                                                        ? 'bg-green-100 text-green-700 border-green-200' 
                                                        : 'bg-amber-100 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {item.status === 'PendingSDI' && <button onClick={() => { 
                                                            console.log('[DEBUG] Click Seal SDI', item);
                                                            setInvoiceToSeal(item); setIsSealModalOpen(true); 
                                                        }} className="md-icon-btn text-indigo-600" title="Sigilla SDI"><DocumentCheckIcon /></button>}
                                                        
                                                        <button onClick={() => {
                                                            console.log('[DEBUG] Click WhatsApp', item);
                                                            handleWhatsApp(item);
                                                        }} className="md-icon-btn text-emerald-600" title="WhatsApp"><WhatsAppIcon /></button>
                                                        
                                                        {(activeTab === 'invoices' || activeTab === 'quotes' || activeTab === 'archive') && (
                                                            <button onClick={() => {
                                                                console.log('[DEBUG] Click Print PDF', item);
                                                                handlePrint(item);
                                                            }} className="md-icon-btn text-slate-600" title="PDF"><PrinterIcon /></button>
                                                        )}
                                                        
                                                        <button onClick={() => {
                                                            console.log('[DEBUG] Click Edit', item);
                                                            if ('invoiceNumber' in item) {
                                                                handleEditInvoice(item as Invoice);
                                                            } else {
                                                                handleEditTransaction(item);
                                                            }
                                                        }} className="md-icon-btn edit"><PencilIcon /></button>
                                                        
                                                        <button onClick={() => {
                                                            console.log('[DEBUG] Click Delete', item);
                                                            setTransactionToDelete(item.id);
                                                        }} className="md-icon-btn delete"><TrashIcon /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredList.length === 0 && <div className="py-20 text-center text-slate-400 italic">Nessun record trovato.</div>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedLocationROI && (
                <LocationDetailModal 
                    data={selectedLocationROI} 
                    onClose={() => setSelectedLocationROI(null)} 
                />
            )}

            {isSealModalOpen && (
                <Modal onClose={() => setIsSealModalOpen(false)}>
                    <div className="p-8">
                        <h3 className="text-xl font-black mb-4">SIGILLO FISCALE SDI</h3>
                        <p className="text-sm text-slate-500 mb-6">Inserisci l'ID di ricezione del Sistema di Interscambio per finalizzare la fattura <strong>{invoiceToSeal?.invoiceNumber}</strong>.</p>
                        <div className="md-input-group mb-8">
                            <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} required className="md-input" placeholder=" " />
                            <label className="md-input-label">ID Sistema Interscambio (SDI)</label>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsSealModalOpen(false)} className="md-btn md-btn-flat">Esci</button>
                            <button onClick={handleSeal} disabled={!sdiId} className="md-btn md-btn-raised md-btn-primary">Finalizza Documento</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isTransactionModalOpen && (
                <Modal onClose={() => setIsTransactionModalOpen(false)} size="lg">
                    <TransactionForm 
                        transaction={editingTransaction}
                        suppliers={suppliers}
                        onSave={handleSaveTransaction}
                        onCancel={() => setIsTransactionModalOpen(false)}
                    />
                </Modal>
            )}

            {isInvoiceModalOpen && editingInvoice && (
                <Modal onClose={() => setIsInvoiceModalOpen(false)} size="md">
                    <InvoiceEditForm 
                        invoice={editingInvoice}
                        onSave={handleSaveInvoice}
                        onCancel={() => setIsInvoiceModalOpen(false)}
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!transactionToDelete}
                onClose={() => setTransactionToDelete(null)}
                onConfirm={handleDeleteTransaction}
                title="Elimina Voce"
                message="Sei sicuro di voler eliminare questa transazione?"
                isDangerous={true}
            />
        </div>
    );
};

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

export default Finance;
