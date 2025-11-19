
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment, Invoice, Quote, InvoiceInput, QuoteInput, DocumentStatus, DocumentItem, Client, ClientType, Installment } from '../types';
import { getTransactions, addTransaction, deleteTransaction, getInvoices, addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, getQuotes, addQuote, updateQuote, updateQuoteStatus, deleteQuote, deleteTransactionByRelatedId } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';
import { getCompanyInfo } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import PencilIcon from '../components/icons/PencilIcon';
import { Chart, registerables, TooltipItem } from 'chart.js';
Chart.register(...registerables);

type Tab = 'overview' | 'transactions' | 'invoices' | 'quotes';

const StatCard: React.FC<{ title: string; value: string; color: string; }> = ({ title, value, color }) => (
  <div className={`md-card p-4 border-l-4`} style={{borderColor: color}}>
    <h3 className="text-sm font-medium" style={{color: 'var(--md-text-secondary)'}}>{title}</h3>
    <p className="text-2xl font-semibold mt-1">{value}</p>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="md-card p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64">
            {children}
        </div>
    </div>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
    </svg>
);

const ConvertIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
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
        onSave({ description, amount: Number(amount), date: new Date(date).toISOString(), type, category, paymentMethod });
    };

    const incomeCategories = Object.values(TransactionCategory).filter(c => [TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));
    const expenseCategories = Object.values(TransactionCategory).filter(c => ![TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">Nuova Transazione</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="md-input-group"><input id="desc" type="text" value={description} onChange={e => setDescription(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="desc" className="md-input-label">Descrizione</label></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="0" className="md-input" placeholder=" "/><label htmlFor="amount" className="md-input-label">Importo (€)</label></div>
                    <div className="md-input-group"><input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="md-input" placeholder=" "/><label htmlFor="date" className="md-input-label">Data</label></div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <select id="type" value={type} onChange={e => setType(e.target.value as TransactionType)} className="md-input">
                            <option value={TransactionType.Income}>Entrata</option>
                            <option value={TransactionType.Expense}>Uscita</option>
                        </select>
                         <label htmlFor="type" className="md-input-label !top-0 !text-xs !text-gray-500">Tipo</label>
                    </div>
                    <div className="md-input-group">
                        <select id="category" value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="md-input">
                            {(type === TransactionType.Income ? incomeCategories : expenseCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <label htmlFor="category" className="md-input-label !top-0 !text-xs !text-gray-500">Categoria</label>
                    </div>
                </div>
                <div className="md-input-group">
                    <select id="payment" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                        {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                    </select>
                    <label htmlFor="payment" className="md-input-label !top-0 !text-xs !text-gray-500">Metodo Pagamento</label>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva</button>
            </div>
        </form>
    );
};

const DocumentForm: React.FC<{
    type: 'invoice' | 'quote';
    initialData?: Invoice | Quote | null;
    onSave: (data: InvoiceInput | QuoteInput) => void;
    onCancel: () => void;
}> = ({ type, initialData, onSave, onCancel }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [clientId, setClientId] = useState(initialData?.clientId || '');
    const [issueDate, setIssueDate] = useState(initialData?.issueDate.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState((type === 'invoice' ? (initialData as Invoice)?.dueDate : (initialData as Quote)?.expiryDate)?.split('T')[0] || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);
    const [items, setItems] = useState<DocumentItem[]>(initialData?.items || [{ description: '', quantity: 1, price: 0, notes: '' }]);
    const [status, setStatus] = useState<DocumentStatus>(initialData?.status || DocumentStatus.Draft);
    const [notes, setNotes] = useState(initialData?.notes || '');
    
    // New Fields
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || PaymentMethod.BankTransfer);
    const [installments, setInstallments] = useState<Installment[]>(initialData?.installments || []);
    const [sdiCode, setSdiCode] = useState((type === 'invoice' ? (initialData as Invoice)?.sdiCode : '') || '');
    const [isProForma, setIsProForma] = useState((type === 'invoice' ? (initialData as Invoice)?.isProForma : false) || false);
    const [relatedQuoteNumber, setRelatedQuoteNumber] = useState((type === 'invoice' ? (initialData as Invoice)?.relatedQuoteNumber : '') || '');

    useEffect(() => {
        const fetchClientsList = async () => {
            const data = await getClients();
            setClients(data);
        };
        fetchClientsList();
    }, []);

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0, notes: '' }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const hasStampDuty = subtotal > 77;
    const stampDuty = hasStampDuty ? 2.00 : 0;
    const totalAmount = subtotal + stampDuty;

    // Installments Logic
    const addInstallment = () => setInstallments([...installments, { description: 'Rata', amount: 0, dueDate: dueDate, isPaid: false }]);
    const removeInstallment = (index: number) => setInstallments(installments.filter((_, i) => i !== index));
    const updateInstallment = (index: number, field: keyof Installment, value: any) => {
        const newInst = [...installments];
        newInst[index] = { ...newInst[index], [field]: value };
        setInstallments(newInst);
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const clientName = client.clientType === ClientType.Parent 
            ? `${client.firstName} ${client.lastName}` 
            : client.companyName;

        // Logica D: Controllo data scadenza per stato automatico "Scaduto"
        let finalStatus = status;
        if (type === 'invoice') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiryDate = new Date(dueDate);
            
            // Se la data di scadenza è passata e lo stato non è 'Pagato', 'Annullato' o 'Convertito', diventa 'Scaduto'
            if (expiryDate < today && 
                status !== DocumentStatus.Paid && 
                status !== DocumentStatus.Cancelled && 
                status !== DocumentStatus.Converted) {
                finalStatus = DocumentStatus.Overdue;
            }
        }

        const commonData = { 
            clientId, 
            clientName, 
            issueDate: new Date(issueDate).toISOString(), 
            items, 
            totalAmount, 
            status: finalStatus,
            paymentMethod,
            installments,
            hasStampDuty,
            notes
        };

        if (type === 'invoice') {
            const invoiceData: InvoiceInput = {
                ...commonData,
                dueDate: new Date(dueDate).toISOString(),
                isProForma,
                sdiCode,
                invoiceNumber: (initialData as Invoice)?.invoiceNumber,
                relatedQuoteNumber
            };
            if (initialData?.id) { (invoiceData as any).id = initialData.id; }
            onSave(invoiceData);
        } else {
             const quoteData: QuoteInput = {
                ...commonData,
                expiryDate: new Date(dueDate).toISOString(),
                quoteNumber: (initialData as Quote)?.quoteNumber
            };
             if (initialData?.id) { (quoteData as any).id = initialData.id; }
            onSave(quoteData);
        }
    };

    // Logica B: SDI editabile solo se Bozza o Inviato
    const canEditSDI = status === DocumentStatus.Draft || status === DocumentStatus.Sent;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">
                {initialData ? 'Modifica' : 'Nuovo'} {type === 'invoice' ? 'Fattura' : 'Preventivo'}
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {type === 'invoice' && (
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                            <input type="checkbox" id="proforma" checked={isProForma} onChange={e => setIsProForma(e.target.checked)} className="h-4 w-4 text-indigo-600"/>
                            <label htmlFor="proforma" className="text-sm font-medium text-gray-700">Fattura Pro-Forma</label>
                        </div>
                        {relatedQuoteNumber && (
                             <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                Da Preventivo: <span className="font-medium">{relatedQuoteNumber}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="md-input-group">
                    <select id="client" value={clientId} onChange={e => setClientId(e.target.value)} required className="md-input">
                        <option value="" disabled>Seleziona Cliente</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.clientType === ClientType.Parent ? `${c.firstName} ${c.lastName}` : c.companyName}
                            </option>
                        ))}
                    </select>
                    <label htmlFor="client" className="md-input-label !top-0 !text-xs !text-gray-500">Cliente</label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="issueDate" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required className="md-input"/><label htmlFor="issueDate" className="md-input-label !top-0 !text-xs !text-gray-500">Data Emissione</label></div>
                    <div className="md-input-group"><input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="md-input"/><label htmlFor="dueDate" className="md-input-label !top-0 !text-xs !text-gray-500">{type === 'invoice' ? 'Scadenza Pagamento' : 'Validità fino al'}</label></div>
                </div>
                
                <div className="mt-6">
                    <h3 className="font-semibold mb-2">Articoli</h3>
                    {items.map((item, index) => (
                        <div key={index} className="mb-4 border-b border-gray-100 pb-2">
                            <div className="flex gap-2 items-end">
                                <div className="flex-grow"><input type="text" placeholder="Descrizione" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="md-input text-sm" required /></div>
                                <div className="w-16"><input type="number" placeholder="Qtà" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="md-input text-sm text-center" required min="1"/></div>
                                <div className="w-24"><input type="number" placeholder="Prezzo" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="md-input text-sm text-right" required step="0.01"/></div>
                                {items.length > 1 && <button type="button" onClick={() => removeItem(index)} className="text-red-500 p-1"><TrashIcon /></button>}
                            </div>
                             <input 
                                type="text" 
                                placeholder="Note esplicative (opzionale)" 
                                value={item.notes || ''} 
                                onChange={e => handleItemChange(index, 'notes', e.target.value)} 
                                className="md-input text-xs text-gray-500 w-full mt-1 italic bg-transparent border-none focus:ring-0 focus:border-gray-300 pl-1"
                            />
                        </div>
                    ))}
                    <button type="button" onClick={addItem} className="text-sm text-indigo-600 font-medium flex items-center mt-2"><PlusIcon /> Aggiungi Riga</button>
                </div>

                {/* Totals */}
                 <div className="text-right mt-4 space-y-1">
                    <p className="text-sm text-gray-600">Imponibile: {subtotal.toFixed(2)}€</p>
                    {hasStampDuty && <p className="text-sm text-gray-600">+ Bollo Virtuale: 2.00€</p>}
                    <p className="text-lg font-bold">Totale: {totalAmount.toFixed(2)}€</p>
                </div>

                {/* Payment Section */}
                <div className="mt-6 pt-4 border-t">
                    <h3 className="font-semibold mb-3">Pagamenti</h3>
                    <div className="md-input-group mb-4">
                         <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label htmlFor="paymentMethod" className="md-input-label !top-0 !text-xs !text-gray-500">Metodo di Pagamento</label>
                    </div>

                    <div className="space-y-2">
                         <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">Piano Rateale / Scadenze</h4>
                            <button type="button" onClick={addInstallment} className="text-xs text-indigo-600 font-medium">+ Aggiungi Rata</button>
                        </div>
                        {installments.map((inst, index) => (
                            <div key={index} className="flex gap-2 items-end bg-gray-50 p-2 rounded">
                                <div className="flex-grow"><input type="text" placeholder="Descrizione (es. Acconto)" value={inst.description} onChange={e => updateInstallment(index, 'description', e.target.value)} className="bg-transparent border-b border-gray-300 w-full text-sm" /></div>
                                <div className="w-28"><input type="date" value={inst.dueDate.split('T')[0]} onChange={e => updateInstallment(index, 'dueDate', new Date(e.target.value).toISOString())} className="bg-transparent border-b border-gray-300 w-full text-sm" /></div>
                                <div className="w-20"><input type="number" placeholder="€" value={inst.amount} onChange={e => updateInstallment(index, 'amount', Number(e.target.value))} className="bg-transparent border-b border-gray-300 w-full text-sm text-right" /></div>
                                <button type="button" onClick={() => removeInstallment(index)} className="text-red-500"><TrashIcon /></button>
                            </div>
                        ))}
                        {installments.length === 0 && <p className="text-xs text-gray-400 italic">Nessuna rata definita (pagamento unico).</p>}
                    </div>
                </div>
                
                {/* Notes Section */}
                 <div className="mt-6 pt-4 border-t">
                    <h3 className="font-semibold mb-2">Note Documento</h3>
                    <p className="text-xs text-gray-500 mb-2">Queste note appariranno in un box dedicato nel PDF.</p>
                    <textarea 
                        rows={3}
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        className="w-full p-2 border rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        style={{borderColor: 'var(--md-divider)'}}
                        placeholder="Inserisci note aggiuntive qui..."
                    />
                </div>

                {/* SDI Field - Moved here */}
                {type === 'invoice' && (
                     <div className="md-input-group mt-4">
                         <input 
                            id="sdi" 
                            type="text" 
                            value={sdiCode} 
                            onChange={e => setSdiCode(e.target.value)} 
                            className={`md-input ${!canEditSDI ? 'opacity-50 bg-gray-100 cursor-not-allowed' : ''}`}
                            placeholder=" "
                            disabled={!canEditSDI}
                         />
                         <label htmlFor="sdi" className="md-input-label">Codice SDI / PEC</label>
                         {!canEditSDI && <p className="text-xs text-red-500 mt-1">Modificabile solo in bozza o inviato.</p>}
                     </div>
                )}

                {/* Status Field */}
                 <div className="md-input-group mt-4">
                    <select id="status" value={status} onChange={e => setStatus(e.target.value as DocumentStatus)} className="md-input">
                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label htmlFor="status" className="md-input-label !top-0 !text-xs !text-gray-500">Stato Documento</label>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva</button>
            </div>
        </form>
    );
};


const Finance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]); // Cache for PDF gen
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    
    // Unified Document Modal
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docType, setDocType] = useState<'invoice' | 'quote'>('invoice');
    const [editingDoc, setEditingDoc] = useState<Invoice | Quote | null>(null);
    const [quoteToConvertId, setQuoteToConvertId] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'transaction' | 'invoice' | 'quote' | null>(null);
    
    const monthlyChartRef = useRef<HTMLCanvasElement>(null);
    const enrollmentsChartRef = useRef<HTMLCanvasElement>(null);
    const expensesDoughnutRef = useRef<HTMLCanvasElement>(null);
    const incomeDoughnutRef = useRef<HTMLCanvasElement>(null);


    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transData, enrollData, invData, quoData, clientsData] = await Promise.all([
                getTransactions(), 
                getAllEnrollments(),
                getInvoices(),
                getQuotes(),
                getClients()
            ]);
            setTransactions(transData); 
            setEnrollments(enrollData);
            setInvoices(invData);
            setQuotes(quoData);
            setClients(clientsData);
        } catch (err) {
            setError("Impossibile caricare i dati finanziari."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    // Handlers for Transactions
    const handleSaveTransaction = async (transaction: TransactionInput) => {
        await addTransaction(transaction); setIsTransModalOpen(false); fetchAllData();
    };

    // Handlers for Documents (Invoices/Quotes)
    const handleOpenDocModal = (type: 'invoice' | 'quote', doc: Invoice | Quote | null = null) => {
        setDocType(type);
        setEditingDoc(doc);
        setIsDocModalOpen(true);
    };

    const handleCloseDocModal = () => {
        setIsDocModalOpen(false);
        setEditingDoc(null);
        setQuoteToConvertId(null);
    };

    const handleSaveDocument = async (data: InvoiceInput | QuoteInput) => {
        try {
            if (docType === 'invoice') {
                const invData = data as InvoiceInput;
                let savedId = '';
                let finalInvoiceNumber = invData.invoiceNumber;

                const isPaidNow = invData.status === DocumentStatus.Paid;
                const isUpdate = 'id' in invData;

                if (isUpdate) {
                    savedId = (invData as any).id;
                    await updateInvoice(savedId, invData);
                } else {
                    const result = await addInvoice(invData);
                    savedId = result.id;
                    finalInvoiceNumber = result.invoiceNumber;
                }

                // Logica Transazioni Robusta: Pulisci sempre prima per garantire unicità
                // 1. Se aggiorniamo una fattura, rimuoviamo eventuali transazioni collegate esistenti.
                // 2. Se creiamo una nuova fattura (isUpdate = false), in teoria non ce ne sono, ma delete è safe.
                // Per sicurezza, facciamolo se è un update.
                if (isUpdate) {
                    await deleteTransactionByRelatedId(savedId);
                }

                // 2. Se lo stato finale è "Pagato", creiamo la transazione corretta.
                // Questo approccio (cancella e ricrea se pagato) evita duplicati e mantiene i dati allineati.
                if (isPaidNow) {
                    await addTransaction({
                        date: new Date().toISOString(), 
                        description: `Incasso Fattura ${finalInvoiceNumber || 'PROFORMA'} - ${invData.clientName}`,
                        amount: invData.totalAmount,
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: invData.paymentMethod || PaymentMethod.BankTransfer,
                        relatedDocumentId: savedId
                    });
                }
                
                // Handle Quote conversion status update
                if (quoteToConvertId) {
                    await updateQuoteStatus(quoteToConvertId, DocumentStatus.Converted);
                    setQuoteToConvertId(null);
                }

            } else {
                if ('id' in data) await updateQuote((data as any).id, data as QuoteInput);
                else await addQuote(data as QuoteInput);
            }
            handleCloseDocModal();
            await fetchAllData();
            // Dispatch global event to update notifications
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            console.error(e);
            alert("Errore nel salvataggio");
        }
    };

    const handleConvertQuoteToInvoice = (quote: Quote) => {
        setQuoteToConvertId(quote.id);
        // Pre-fill invoice with quote data
        const invoiceData: InvoiceInput = {
            clientId: quote.clientId,
            clientName: quote.clientName,
            issueDate: new Date().toISOString(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
            items: quote.items,
            totalAmount: quote.totalAmount,
            status: DocumentStatus.Draft,
            isProForma: false,
            paymentMethod: quote.paymentMethod || PaymentMethod.BankTransfer,
            installments: quote.installments || [],
            invoiceNumber: '', // Will be generated
            hasStampDuty: quote.hasStampDuty,
            notes: quote.notes || '',
            relatedQuoteNumber: quote.quoteNumber
        };
        // Open modal as Invoice with this data
        setDocType('invoice');
        setEditingDoc(invoiceData as unknown as Invoice); // Temporary cast to pre-fill
        setIsDocModalOpen(true);
    };

    const handleMakeInvoiceFinal = async (invoice: Invoice) => {
        if (!invoice.isProForma) return;
        try {
             await updateInvoice(invoice.id, { isProForma: false });
             await fetchAllData();
             window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(e) {
            console.error(e);
        }
    };


    const handleUpdateStatus = async (id: string, status: DocumentStatus, type: 'invoice' | 'quote') => {
        if (type === 'invoice') {
            const invoice = invoices.find(i => i.id === id);
            
            if (invoice) {
                // Logica Robusta per Transazioni:
                // 1. Tentiamo sempre di rimuovere eventuali transazioni esistenti collegate a questa fattura.
                // Questo garantisce che non ci siano mai duplicati, indipendentemente dallo stato precedente.
                try {
                    await deleteTransactionByRelatedId(id);
                } catch (e) {
                    console.error("Errore nella pulizia delle transazioni precedenti:", e);
                }

                // 2. Se il nuovo stato è "Pagato", creiamo la transazione.
                if (status === DocumentStatus.Paid) {
                    try {
                        await addTransaction({
                            date: new Date().toISOString(),
                            description: `Incasso Fattura ${invoice.invoiceNumber} - ${invoice.clientName}`,
                            amount: invoice.totalAmount,
                            type: TransactionType.Income,
                            category: TransactionCategory.Sales,
                            paymentMethod: invoice.paymentMethod || PaymentMethod.BankTransfer,
                            relatedDocumentId: invoice.id
                        });
                    } catch (e) {
                        console.error("Errore creazione transazione automatica", e);
                        alert("Attenzione: Stato aggiornato ma errore nella creazione della transazione automatica.");
                    }
                }
                // Se lo stato non è "Pagato", la transazione è stata rimossa al punto 1 e non ne viene creata una nuova.
            }

             setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
             await updateInvoiceStatus(id, status);
             // Trigger notification update
             window.dispatchEvent(new Event('EP_DataUpdated'));
        } else {
             setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
             await updateQuoteStatus(id, status);
        }
        fetchAllData(); 
    };

    const handleDeleteRequest = (id: string, type: 'transaction' | 'invoice' | 'quote') => {
        setDeleteId(id);
        setDeleteType(type);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId || !deleteType) return;
        try {
            if (deleteType === 'transaction') await deleteTransaction(deleteId);
            else if (deleteType === 'invoice') await deleteInvoice(deleteId);
            else if (deleteType === 'quote') await deleteQuote(deleteId);
            
            await fetchAllData();
            // Update notifications if we deleted an invoice that was causing a notification
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            console.error(e);
            setError("Errore durante l'eliminazione.");
        } finally {
            setDeleteId(null);
            setDeleteType(null);
        }
    };

    const handleDownloadPDF = async (doc: Invoice | Quote, type: 'Fattura' | 'Preventivo') => {
        try {
            const companyInfo = await getCompanyInfo();
            const client = clients.find(c => c.id === doc.clientId);
            await generateDocumentPDF(doc, type, companyInfo, client);
        } catch (err) {
            console.error("Errore PDF", err);
            setError("Impossibile generare il PDF.");
        }
    };


    // --- CHART LOGIC ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyIncome = transactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = transactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const annualIncome = transactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const annualExpense = transactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    
    // Logica C: Totale Scaduto
    const overdueAmount = invoices.filter(inv => inv.status === DocumentStatus.Overdue).reduce((sum, inv) => sum + inv.totalAmount, 0);

    const COEFFICIENTE_REDDITIVITA = 0.78, ALIQUOTA_INPS = 0.2623, ALIQUOTA_IMPOSTA = 0.05;
    const imponibileLordo = annualIncome * COEFFICIENTE_REDDITIVITA;
    const contributiInpsStimati = imponibileLordo * ALIQUOTA_INPS;
    const imponibileNetto = imponibileLordo - contributiInpsStimati;
    const impostaSostitutivaStimata = imponibileNetto > 0 ? imponibileNetto * ALIQUOTA_IMPOSTA : 0;
    const utileNettoPrevisto = annualIncome - annualExpense - contributiInpsStimati - impostaSostitutivaStimata;

    useEffect(() => {
        if (activeTab !== 'overview') return;
        const last6Months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { month: d.getMonth(), year: d.getFullYear() }; }).reverse();
        const labels = last6Months.map(d => new Date(d.year, d.month).toLocaleString('it-IT', { month: 'short' }));
        const monthlyIncomeData = last6Months.map(d => transactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year).reduce((sum, t) => sum + t.amount, 0));
        const monthlyExpenseData = last6Months.map(d => transactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year).reduce((sum, t) => sum + t.amount, 0));
        const monthlyEnrollmentsData = last6Months.map(d => enrollments.filter(e => new Date(e.startDate).getMonth() === d.month && new Date(e.startDate).getFullYear() === d.year).length);
        
        // Data for Doughnut Charts
        const expenseByCategory = transactions.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>);
        
        const incomeByCategory = transactions.filter(t => t.type === TransactionType.Income).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>);


        let monthlyChart: Chart, enrollmentsChart: Chart, expensesDoughnut: Chart, incomeDoughnut: Chart;
        
        // Tooltip callback for percentages
        const percentageTooltip = {
            callbacks: {
                label: function(context: TooltipItem<'doughnut'>) {
                    const dataset = context.dataset;
                    const total = dataset.data.reduce((acc, current) => acc + (typeof current === 'number' ? current : 0), 0);
                    const currentValue = context.raw as number;
                    const percentage = total > 0 ? ((currentValue / total) * 100).toFixed(1) : '0';
                    return `${context.label}: ${currentValue.toFixed(2)}€ (${percentage}%)`;
                }
            }
        };

        if (monthlyChartRef.current) { monthlyChart = new Chart(monthlyChartRef.current, { type: 'bar', data: { labels, datasets: [{ label: 'Entrate', data: monthlyIncomeData, backgroundColor: 'rgba(76, 175, 80, 0.7)' }, { label: 'Uscite', data: monthlyExpenseData, backgroundColor: 'rgba(244, 67, 54, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        if (enrollmentsChartRef.current) { enrollmentsChart = new Chart(enrollmentsChartRef.current, { type: 'line', data: { labels, datasets: [{ label: 'Nuovi Iscritti', data: monthlyEnrollmentsData, borderColor: 'var(--md-primary)', tension: 0.1, fill: false }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        
        // Expense Chart
        if (expensesDoughnutRef.current) { 
            expensesDoughnut = new Chart(expensesDoughnutRef.current, { 
                type: 'doughnut', 
                data: { 
                    labels: Object.keys(expenseByCategory), 
                    datasets: [{ 
                        data: Object.values(expenseByCategory), 
                        backgroundColor: ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa'] 
                    }] 
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { tooltip: percentageTooltip }
                } 
            }); 
        }
        
        // Income Chart
        if (incomeDoughnutRef.current) {
            incomeDoughnut = new Chart(incomeDoughnutRef.current, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(incomeByCategory),
                    datasets: [{
                        data: Object.values(incomeByCategory),
                        backgroundColor: ['#4CAF50', '#2196F3', '#FFC107', '#9C27B0'] // Green, Blue, Amber, Purple
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { tooltip: percentageTooltip }
                }
            });
        }
        
        return () => { 
            if (monthlyChart) monthlyChart.destroy(); 
            if (enrollmentsChart) enrollmentsChart.destroy(); 
            if (expensesDoughnut) expensesDoughnut.destroy(); 
            if (incomeDoughnut) incomeDoughnut.destroy();
        };
    }, [transactions, enrollments, activeTab]);


    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Entrate (Mese)" value={`${monthlyIncome.toFixed(2)}€`} color="var(--md-green)" />
                        <StatCard title="Uscite (Mese)" value={`${monthlyExpense.toFixed(2)}€`} color="var(--md-red)" />
                        <StatCard title="Utile Lordo (Mese)" value={`${(monthlyIncome - monthlyExpense).toFixed(2)}€`} color="var(--md-primary)" />
                        <StatCard title="Scaduti (Da Incassare)" value={`${overdueAmount.toFixed(2)}€`} color="#E65100" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Andamento Mensile (Entrate vs Uscite)"><canvas ref={monthlyChartRef}></canvas></ChartCard>
                        <ChartCard title="Trend Iscrizioni Allievi"><canvas ref={enrollmentsChartRef}></canvas></ChartCard>
                    </div>
                    
                    {/* Fiscal Projection & Breakdown Section */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="md-card p-6">
                            <h3 className="text-lg font-semibold">Proiezione Fiscale (Regime Forfettario)</h3>
                            <p className="text-sm mb-4" style={{color: 'var(--md-text-secondary)'}}>Stima basata sul fatturato dell'anno in corso.</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                <div className="bg-gray-50 p-3 rounded-md"><p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>Fatturato Annuo</p><p className="font-bold text-lg">{annualIncome.toFixed(2)}€</p></div>
                                <div className="bg-gray-50 p-3 rounded-md"><p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>Imponibile (78%)</p><p className="font-bold text-lg">{imponibileLordo.toFixed(2)}€</p></div>
                                <div className="bg-red-50 p-3 rounded-md"><p className="text-xs text-red-600">INPS (stima)</p><p className="font-bold text-lg text-red-800">{contributiInpsStimati.toFixed(2)}€</p></div>
                                <div className="bg-red-50 p-3 rounded-md"><p className="text-xs text-red-600">Imposta (stima)</p><p className="font-bold text-lg text-red-800">{impostaSostitutivaStimata.toFixed(2)}€</p></div>
                                <div className="bg-green-50 p-3 rounded-md col-span-2 md:col-span-1"><p className="text-xs text-green-600">Utile Netto</p><p className="font-bold text-lg text-green-800">{utileNettoPrevisto.toFixed(2)}€</p></div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <ChartCard title="Ripartizione Ricavi"><canvas ref={incomeDoughnutRef}></canvas></ChartCard>
                             <ChartCard title="Ripartizione Costi"><canvas ref={expensesDoughnutRef}></canvas></ChartCard>
                        </div>
                    </div>
                </div>
            );
            case 'transactions': return (
                <div className="md-card p-0 md:p-6 animate-fade-in">
                    <div className="md:hidden space-y-3 p-4">
                        {transactions.map(t => (
                            <div key={t.id} className="md-card p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{t.description}</p>
                                        <p className="text-sm" style={{color: 'var(--md-text-secondary)'}}>{t.category}</p>
                                        <p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>{new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                    <p className={`font-bold text-lg ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}€</p>
                                </div>
                                <div className="text-right mt-2">
                                     <button onClick={() => handleDeleteRequest(t.id, 'transaction')} className="md-icon-btn delete" aria-label="Elimina transazione"><TrashIcon/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <table className="w-full text-left hidden md:table">
                        <thead>
                            <tr className="border-b" style={{borderColor: 'var(--md-divider)'}}>
                                <th className="p-4 font-medium">Data</th>
                                <th className="p-4 font-medium">Descrizione</th>
                                <th className="p-4 font-medium">Categoria</th>
                                <th className="p-4 text-right font-medium">Importo</th>
                                <th className="p-4 font-medium">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(t => (
                                <tr key={t.id} className="border-b hover:bg-gray-50" style={{borderColor: 'var(--md-divider)'}}>
                                    <td className="p-4 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium">{t.description}</td>
                                    <td className="p-4 text-sm">{t.category}</td>
                                    <td className={`p-4 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}€</td>
                                    <td className="p-4"><button onClick={() => handleDeleteRequest(t.id, 'transaction')} className="md-icon-btn delete"><TrashIcon/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            case 'invoices': return (
                <div className="md-card p-0 md:p-6 animate-fade-in">
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b" style={{borderColor: 'var(--md-divider)'}}>
                                    <th className="p-4">Numero</th>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4 text-right">Totale</th>
                                    <th className="p-4 text-center">Stato</th>
                                    <th className="p-4">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => (
                                    <tr key={inv.id} className="border-b hover:bg-gray-50" style={{borderColor: 'var(--md-divider)'}}>
                                        <td className="p-4 font-medium">
                                            {inv.invoiceNumber} 
                                            {inv.isProForma && <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded">PRO-FORMA</span>}
                                        </td>
                                        <td className="p-4 text-sm">{new Date(inv.issueDate).toLocaleDateString()}</td>
                                        <td className="p-4">{inv.clientName}</td>
                                        <td className="p-4 text-right font-semibold">{inv.totalAmount.toFixed(2)}€</td>
                                        <td className="p-4 text-center">
                                             <select 
                                                value={inv.status} 
                                                onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')}
                                                className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4 flex items-center space-x-2">
                                            <button onClick={() => handleDownloadPDF(inv, 'Fattura')} className="md-icon-btn download" title="Scarica PDF"><DownloadIcon /></button>
                                            <button onClick={() => handleOpenDocModal('invoice', inv)} className="md-icon-btn edit" title="Modifica"><PencilIcon /></button>
                                            <button onClick={() => handleDeleteRequest(inv.id, 'invoice')} className="md-icon-btn delete" title="Elimina"><TrashIcon /></button>
                                            {inv.isProForma && (
                                                <button onClick={() => handleMakeInvoiceFinal(inv)} className="md-icon-btn text-indigo-600" title="Rendi Definitiva"><ConvertIcon /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {invoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessuna fattura presente.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile View Invoices */}
                    <div className="md:hidden p-4 space-y-4">
                        {invoices.map(inv => (
                            <div key={inv.id} className="border rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <div>
                                        <span className="font-bold block">{inv.invoiceNumber}</span>
                                        {inv.isProForma && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded">PRO</span>}
                                    </div>
                                    <span className="font-bold text-lg">{inv.totalAmount.toFixed(2)}€</span>
                                </div>
                                <p className="text-sm mb-1">{inv.clientName}</p>
                                <p className="text-xs text-gray-500 mb-3">{new Date(inv.issueDate).toLocaleDateString()}</p>
                                <div className="flex justify-between items-center">
                                     <select 
                                        value={inv.status} 
                                        onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')}
                                        className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none ${inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="flex space-x-2">
                                         <button onClick={() => handleDownloadPDF(inv, 'Fattura')} className="md-icon-btn download"><DownloadIcon /></button>
                                         <button onClick={() => handleOpenDocModal('invoice', inv)} className="md-icon-btn edit"><PencilIcon /></button>
                                         <button onClick={() => handleDeleteRequest(inv.id, 'invoice')} className="md-icon-btn delete"><TrashIcon /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
            case 'quotes': return (
                <div className="md-card p-0 md:p-6 animate-fade-in">
                     <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b" style={{borderColor: 'var(--md-divider)'}}>
                                    <th className="p-4">Numero</th>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4 text-right">Totale</th>
                                    <th className="p-4 text-center">Stato</th>
                                    <th className="p-4">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map(q => (
                                    <tr key={q.id} className="border-b hover:bg-gray-50" style={{borderColor: 'var(--md-divider)'}}>
                                        <td className="p-4 font-medium">{q.quoteNumber}</td>
                                        <td className="p-4 text-sm">{new Date(q.issueDate).toLocaleDateString()}</td>
                                        <td className="p-4">{q.clientName}</td>
                                        <td className="p-4 text-right font-semibold">{q.totalAmount.toFixed(2)}€</td>
                                        <td className="p-4 text-center">
                                            <select 
                                                value={q.status} 
                                                onChange={(e) => handleUpdateStatus(q.id, e.target.value as DocumentStatus, 'quote')}
                                                className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${q.status === DocumentStatus.Converted ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4 flex items-center space-x-2">
                                            <button onClick={() => handleDownloadPDF(q, 'Preventivo')} className="md-icon-btn download" title="Scarica PDF"><DownloadIcon /></button>
                                            <button onClick={() => handleOpenDocModal('quote', q)} className="md-icon-btn edit" title="Modifica"><PencilIcon /></button>
                                            <button onClick={() => handleDeleteRequest(q.id, 'quote')} className="md-icon-btn delete" title="Elimina"><TrashIcon /></button>
                                            <button 
                                                onClick={() => handleConvertQuoteToInvoice(q)} 
                                                className={`md-icon-btn ${q.status === DocumentStatus.Converted ? 'text-gray-300 cursor-not-allowed' : 'text-green-600'}`} 
                                                title="Converti in Fattura"
                                                disabled={q.status === DocumentStatus.Converted}
                                            >
                                                <ConvertIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {quotes.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessun preventivo presente.</td></tr>}
                            </tbody>
                        </table>
                     </div>
                     {/* Mobile View Quotes */}
                    <div className="md:hidden p-4 space-y-4">
                        {quotes.map(q => (
                            <div key={q.id} className="border rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold">{q.quoteNumber}</span>
                                    <span className="font-bold text-lg">{q.totalAmount.toFixed(2)}€</span>
                                </div>
                                <p className="text-sm mb-1">{q.clientName}</p>
                                <p className="text-xs text-gray-500 mb-3">{new Date(q.issueDate).toLocaleDateString()}</p>
                                <div className="flex justify-between items-center">
                                     <select 
                                        value={q.status} 
                                        onChange={(e) => handleUpdateStatus(q.id, e.target.value as DocumentStatus, 'quote')}
                                        className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none ${q.status === DocumentStatus.Converted ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="flex space-x-2">
                                         <button onClick={() => handleDownloadPDF(q, 'Preventivo')} className="md-icon-btn download"><DownloadIcon /></button>
                                         <button onClick={() => handleOpenDocModal('quote', q)} className="md-icon-btn edit"><PencilIcon /></button>
                                         <button onClick={() => handleDeleteRequest(q.id, 'quote')} className="md-icon-btn delete"><TrashIcon /></button>
                                          <button 
                                                onClick={() => handleConvertQuoteToInvoice(q)} 
                                                className={`md-icon-btn ${q.status === DocumentStatus.Converted ? 'text-gray-300 cursor-not-allowed' : 'text-green-600'}`} 
                                                disabled={q.status === DocumentStatus.Converted}
                                            >
                                                <ConvertIcon />
                                            </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    };
    
  return (
    <div>
        <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Finanza</h1>
              <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Monitora costi, ricavi, fatture e pagamenti.</p>
            </div>
            <div className="flex space-x-2">
                {activeTab === 'transactions' && (
                    <button onClick={() => setIsTransModalOpen(true)} className="md-btn md-btn-raised md-btn-green">
                        <PlusIcon /> <span className="ml-2">Nuova Transazione</span>
                    </button>
                )}
                {(activeTab === 'invoices' || activeTab === 'quotes') && (
                     <button onClick={() => handleOpenDocModal(activeTab === 'invoices' ? 'invoice' : 'quote')} className="md-btn md-btn-raised md-btn-primary">
                        <PlusIcon /> <span className="ml-2">{activeTab === 'invoices' ? 'Nuova Fattura' : 'Nuovo Preventivo'}</span>
                    </button>
                )}
            </div>
        </div>

        <div className="mt-6 border-b" style={{borderColor: 'var(--md-divider)'}}>
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                <button onClick={() => setActiveTab('transactions')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Transazioni</button>
                <button onClick={() => setActiveTab('invoices')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'invoices' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Fatture</button>
                <button onClick={() => setActiveTab('quotes')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'quotes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Preventivi</button>
            </nav>
        </div>
        
        <div className="mt-8">
            {loading ? <div className="flex justify-center items-center h-64"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> :
             renderContent()
            }
        </div>
        
         {isTransModalOpen && (
            <Modal onClose={() => setIsTransModalOpen(false)}>
                <TransactionForm onSave={handleSaveTransaction} onCancel={() => setIsTransModalOpen(false)}/>
            </Modal>
        )}

        {isDocModalOpen && (
            <Modal onClose={() => handleCloseDocModal()} size="lg">
                <DocumentForm 
                    type={docType} 
                    initialData={editingDoc} 
                    onSave={handleSaveDocument} 
                    onCancel={() => handleCloseDocModal()} 
                />
            </Modal>
        )}

        <ConfirmModal 
            isOpen={!!deleteId}
            onClose={() => { setDeleteId(null); setDeleteType(null); }}
            onConfirm={handleConfirmDelete}
            title={deleteType === 'transaction' ? "Elimina Transazione" : deleteType === 'invoice' ? "Elimina Fattura" : "Elimina Preventivo"}
            message="Sei sicuro di voler eliminare questo elemento? L'azione non può essere annullata."
            isDangerous={true}
        />
    </div>
  );
};

export default Finance;
