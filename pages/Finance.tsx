
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment, Invoice, Quote, InvoiceInput, QuoteInput, DocumentStatus, DocumentItem, Client, ClientType, Installment, Supplier, TransactionStatus, Location, EnrollmentStatus } from '../types';
import { getTransactions, addTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, restoreInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, updateQuoteStatus, deleteQuote, restoreQuote, permanentDeleteQuote, deleteTransactionByRelatedId, updateTransaction, calculateRentTransactions, batchAddTransactions } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import PencilIcon from '../components/icons/PencilIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import { Chart, registerables, TooltipItem } from 'chart.js';
Chart.register(...registerables);

type Tab = 'overview' | 'transactions' | 'invoices' | 'quotes' | 'reports';

interface FinanceProps {
    initialParams?: {
        tab?: Tab;
        invoiceStatus?: DocumentStatus;
        transactionStatus?: 'pending' | 'completed';
        searchTerm?: string; 
    };
}

const StatCard: React.FC<{ title: string; value: string; color: string; onClick?: () => void }> = ({ title, value, color, onClick }) => (
  <div 
    className={`md-card p-4 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} 
    style={{borderColor: color}}
    onClick={onClick}
  >
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
    initialData?: Transaction | null;
    suppliers: Supplier[];
    enrollments: Enrollment[];
    onSave: (transaction: TransactionInput | Transaction) => void;
    onCancel: () => void;
}> = ({ initialData, suppliers, enrollments, onSave, onCancel }) => {
    const [description, setDescription] = useState(initialData?.description || '');
    const [amount, setAmount] = useState(initialData?.amount || 0);
    const [date, setDate] = useState(initialData?.date.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.Expense);
    const [category, setCategory] = useState<TransactionCategory>(initialData?.category || TransactionCategory.OtherExpense);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialData?.paymentMethod || PaymentMethod.BankTransfer);
    const [status, setStatus] = useState<TransactionStatus>(initialData?.status || TransactionStatus.Completed);
    
    // Allocation Fields
    const [allocationType, setAllocationType] = useState<'general' | 'location' | 'enrollment'>(initialData?.allocationType || 'general');
    const [allocationId, setAllocationId] = useState(initialData?.allocationId || '');

    const allLocations = useMemo(() => {
        const locs: { id: string; name: string; supplierName: string }[] = [];
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locs.push({ id: l.id, name: l.name, supplierName: s.companyName });
            });
        });
        return locs;
    }, [suppliers]);

    const activeEnrollments = useMemo(() => {
        return enrollments.filter(e => e.status === 'Active' || e.status === 'Pending');
    }, [enrollments]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let allocationName = undefined;
        
        if (allocationType === 'location') {
            const loc = allLocations.find(l => l.id === allocationId);
            if (loc) allocationName = loc.name;
        } else if (allocationType === 'enrollment') {
            const enr = activeEnrollments.find(e => e.id === allocationId);
            if (enr) allocationName = enr.childName;
        }

        const data: any = { 
            description, 
            amount: Number(amount), 
            date: new Date(date).toISOString(), 
            type, 
            category, 
            paymentMethod, 
            status,
            allocationType,
            allocationId: allocationType === 'general' ? undefined : allocationId,
            allocationName: allocationType === 'general' ? undefined : allocationName
        };
        
        if (initialData) {
            onSave({ ...data, id: initialData.id } as Transaction);
        } else {
            onSave(data);
        }
    };

    const incomeCategories = Object.values(TransactionCategory).filter(c => [TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));
    const expenseCategories = Object.values(TransactionCategory).filter(c => ![TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{initialData ? 'Modifica Transazione' : 'Nuova Transazione'}</h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <select id="payment" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                        <label htmlFor="payment" className="md-input-label !top-0 !text-xs !text-gray-500">Metodo Pagamento</label>
                    </div>
                     <div className="md-input-group">
                        <select id="status" value={status} onChange={e => setStatus(e.target.value as TransactionStatus)} className="md-input">
                            <option value={TransactionStatus.Completed}>Completato (Pagato)</option>
                            <option value={TransactionStatus.Pending}>In Attesa (Addebitato)</option>
                        </select>
                        <label htmlFor="status" className="md-input-label !top-0 !text-xs !text-gray-500">Stato</label>
                    </div>
                </div>

                {type === TransactionType.Expense && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mt-4 animate-fade-in">
                        <h4 className="text-sm font-bold text-gray-700 mb-3">Imputazione Costo (Opzionale)</h4>
                        <div className="space-y-3">
                            <div className="md-input-group">
                                <select value={allocationType} onChange={e => { setAllocationType(e.target.value as any); setAllocationId(''); }} className="md-input">
                                    <option value="general">Generale (Costi Fissi/Aziendali)</option>
                                    <option value="location">Sede Specifica (Costi Diretti)</option>
                                    <option value="enrollment">Iscrizione/Allievo (Materiali)</option>
                                </select>
                                <label className="md-input-label !top-0 !text-xs !text-gray-500">Imputa a</label>
                            </div>

                            {allocationType === 'location' && (
                                <div className="md-input-group animate-fade-in">
                                    <select value={allocationId} onChange={e => setAllocationId(e.target.value)} className="md-input">
                                        <option value="">Seleziona Sede...</option>
                                        {allLocations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.supplierName})</option>
                                        ))}
                                    </select>
                                    <label className="md-input-label !top-0 !text-xs !text-gray-500">Sede di Riferimento</label>
                                </div>
                            )}

                            {allocationType === 'enrollment' && (
                                <div className="md-input-group animate-fade-in">
                                    <select value={allocationId} onChange={e => setAllocationId(e.target.value)} className="md-input">
                                        <option value="">Seleziona Allievo...</option>
                                        {activeEnrollments.map(e => (
                                            <option key={e.id} value={e.id}>{e.childName} - {e.subscriptionName}</option>
                                        ))}
                                    </select>
                                    <label className="md-input-label !top-0 !text-xs !text-gray-500">Iscrizione di Riferimento</label>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
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

        let finalStatus = status;
        if (type === 'invoice') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiryDate = new Date(dueDate);
            
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

    const canEditSDI = status === DocumentStatus.Draft || status === DocumentStatus.Sent;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {initialData ? 'Modifica' : 'Nuovo'} {type === 'invoice' ? 'Fattura' : 'Preventivo'}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
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

                 <div className="text-right mt-4 space-y-1">
                    <p className="text-sm text-gray-600">Imponibile: {subtotal.toFixed(2)}€</p>
                    {hasStampDuty && <p className="text-sm text-gray-600">+ Bollo Virtuale: 2.00€</p>}
                    <p className="text-lg font-bold">Totale: {totalAmount.toFixed(2)}€</p>
                </div>

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

                 <div className="md-input-group mt-4">
                    <select id="status" value={status} onChange={e => setStatus(e.target.value as DocumentStatus)} className="md-input">
                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label htmlFor="status" className="md-input-label !top-0 !text-xs !text-gray-500">Stato Documento</label>
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
            </div>
        </form>
    );
};


const Finance: React.FC<FinanceProps> = ({ initialParams }) => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [transactionFilter, setTransactionFilter] = useState<'all' | TransactionType>('all');
    const [invoiceFilter, setInvoiceFilter] = useState<'all' | DocumentStatus>('all');
    const [showTrash, setShowTrash] = useState(false);
    
    useEffect(() => {
        if (initialParams) {
            if (initialParams.tab) setActiveTab(initialParams.tab);
            if (initialParams.invoiceStatus) setInvoiceFilter(initialParams.invoiceStatus);
        }
    }, [initialParams]);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]); 
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docType, setDocType] = useState<'invoice' | 'quote'>('invoice');
    const [editingDoc, setEditingDoc] = useState<Invoice | Quote | null>(null);
    const [quoteToConvertId, setQuoteToConvertId] = useState<string | null>(null);

    const [itemToProcess, setItemToProcess] = useState<{id: string, type: 'transaction'|'invoice'|'quote', action: 'delete'|'restore'|'permanent'} | null>(null);
    
    const monthlyChartRef = useRef<HTMLCanvasElement>(null);
    const enrollmentsChartRef = useRef<HTMLCanvasElement>(null);
    const expensesDoughnutRef = useRef<HTMLCanvasElement>(null);
    const incomeDoughnutRef = useRef<HTMLCanvasElement>(null);
    const reportsDoughnutRef = useRef<HTMLCanvasElement>(null);


    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transData, enrollData, invData, quoData, clientsData, suppliersData] = await Promise.all([
                getTransactions(), 
                getAllEnrollments(),
                getInvoices(),
                getQuotes(),
                getClients(),
                getSuppliers()
            ]);
            setTransactions(transData); 
            setEnrollments(enrollData);
            setInvoices(invData);
            setQuotes(quoData);
            setClients(clientsData);
            setSuppliers(suppliersData);
        } catch (err) {
            setError("Impossibile caricare i dati finanziari."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    // Use active items for Dashboard/Calculations
    const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);
    
    const completedTransactions = useMemo(() => 
        activeTransactions.filter(t => !t.status || t.status === TransactionStatus.Completed), 
    [activeTransactions]);

    const pendingTransactions = useMemo(() => 
        activeTransactions.filter(t => t.status === TransactionStatus.Pending), 
    [activeTransactions]);


    const handleOpenTransModal = (transaction: Transaction | null = null) => {
        setEditingTransaction(transaction);
        setIsTransModalOpen(true);
    };

    const handleCloseTransModal = () => {
        setEditingTransaction(null);
        setIsTransModalOpen(false);
    };

    const handleSaveTransaction = async (transactionData: TransactionInput | Transaction) => {
        try {
            if ('id' in transactionData) {
                const { id, ...data } = transactionData;
                await updateTransaction(id, data);
            } else {
                await addTransaction(transactionData); 
            }
            handleCloseTransModal();
            fetchAllData();
        } catch (error) {
            console.error("Errore salvataggio transazione:", error);
            alert("Errore durante il salvataggio della transazione.");
        }
    };

    const handleGenerateRent = async () => {
        setLoading(true);
        try {
            // calculateRentTransactions needs active transactions to avoid dups
            const newTransactions = calculateRentTransactions(enrollments, suppliers, activeTransactions);
            
            if (newTransactions.length > 0) {
                await batchAddTransactions(newTransactions);
                await fetchAllData();
                alert(`Generazione completata. Aggiunti ${newTransactions.length} movimenti di nolo in stato 'Da Saldare'.`);
            } else {
                alert("Nessuna nuova spesa di nolo da generare.");
            }
        } catch (err) {
            console.error("Errore generazione nolo:", err);
            alert("Errore durante la generazione delle spese di nolo.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPendingTransaction = async (t: Transaction) => {
        try {
            await updateTransaction(t.id, { status: TransactionStatus.Completed });
            fetchAllData();
        } catch (err) {
            console.error("Errore conferma transazione", err);
            alert("Impossibile confermare il saldo.");
        }
    };


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

                if (isUpdate) {
                    await deleteTransactionByRelatedId(savedId);
                }

                if (isPaidNow) {
                    await addTransaction({
                        date: new Date().toISOString(), 
                        description: `Incasso Fattura ${finalInvoiceNumber || 'PROFORMA'} - ${invData.clientName}`,
                        amount: invData.totalAmount,
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: invData.paymentMethod || PaymentMethod.BankTransfer,
                        status: TransactionStatus.Completed,
                        relatedDocumentId: savedId
                    });
                }
                
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
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            console.error(e);
            alert("Errore nel salvataggio");
        }
    };

    const handleConvertQuoteToInvoice = (quote: Quote) => {
        setQuoteToConvertId(quote.id);
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
            invoiceNumber: '',
            hasStampDuty: quote.hasStampDuty,
            notes: quote.notes || '',
            relatedQuoteNumber: quote.quoteNumber
        };
        setDocType('invoice');
        setEditingDoc(invoiceData as unknown as Invoice);
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
                try {
                    await deleteTransactionByRelatedId(id);
                } catch (e) {
                    console.error("Errore nella pulizia delle transazioni precedenti:", e);
                }

                if (status === DocumentStatus.Paid) {
                    try {
                        await addTransaction({
                            date: new Date().toISOString(),
                            description: `Incasso Fattura ${invoice.invoiceNumber} - ${invoice.clientName}`,
                            amount: invoice.totalAmount,
                            type: TransactionType.Income,
                            category: TransactionCategory.Sales,
                            paymentMethod: invoice.paymentMethod || PaymentMethod.BankTransfer,
                            status: TransactionStatus.Completed,
                            relatedDocumentId: invoice.id
                        });
                    } catch (e) {
                        console.error("Errore creazione transazione automatica", e);
                        alert("Attenzione: Stato aggiornato ma errore nella creazione della transazione automatica.");
                    }
                }
            }

             setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
             await updateInvoiceStatus(id, status);
             window.dispatchEvent(new Event('EP_DataUpdated'));
        } else {
             setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
             await updateQuoteStatus(id, status);
        }
        fetchAllData(); 
    };

    const handleActionClick = (id: string, type: 'transaction' | 'invoice' | 'quote', action: 'delete' | 'restore' | 'permanent') => {
        setItemToProcess({ id, type, action });
    };

    const handleConfirmAction = async () => {
        if (!itemToProcess) return;
        const { id, type, action } = itemToProcess;
        try {
            if (type === 'transaction') {
                if (action === 'delete') await deleteTransaction(id);
                else if (action === 'restore') await restoreTransaction(id);
                else await permanentDeleteTransaction(id);
            } else if (type === 'invoice') {
                if (action === 'delete') await deleteInvoice(id);
                else if (action === 'restore') await restoreInvoice(id);
                else await permanentDeleteInvoice(id);
            } else if (type === 'quote') {
                if (action === 'delete') await deleteQuote(id);
                else if (action === 'restore') await restoreQuote(id);
                else await permanentDeleteQuote(id);
            }
            
            await fetchAllData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            console.error(e);
            setError("Errore durante l'operazione.");
        } finally {
            setItemToProcess(null);
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


    // --- CHART LOGIC (Uses ONLY Completed Active Transactions) ---
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyIncome = completedTransactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = completedTransactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const annualIncome = completedTransactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    const annualExpense = completedTransactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getFullYear() === currentYear).reduce((sum, t) => sum + t.amount, 0);
    
    const overdueAmount = invoices.filter(inv => !inv.isDeleted && inv.status === DocumentStatus.Overdue).reduce((sum, inv) => sum + inv.totalAmount, 0);

    const COEFFICIENTE_REDDITIVITA = 0.78, ALIQUOTA_INPS = 0.2623, ALIQUOTA_IMPOSTA = 0.05;
    const imponibileLordo = annualIncome * COEFFICIENTE_REDDITIVITA;
    const contributiInpsStimati = imponibileLordo * ALIQUOTA_INPS;
    const imponibileNetto = imponibileLordo - contributiInpsStimati;
    const impostaSostitutivaStimata = imponibileNetto > 0 ? imponibileNetto * ALIQUOTA_IMPOSTA : 0;
    const utileNettoPrevisto = annualIncome - annualExpense - contributiInpsStimati - impostaSostitutivaStimata;

    useEffect(() => {
        if (activeTab !== 'overview' && activeTab !== 'reports') return; 
        
        const last6Months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { month: d.getMonth(), year: d.getFullYear() }; }).reverse();
        const labels = last6Months.map(d => new Date(d.year, d.month).toLocaleString('it-IT', { month: 'short' }));
        const monthlyIncomeData = last6Months.map(d => completedTransactions.filter(t => t.type === TransactionType.Income && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year).reduce((sum, t) => sum + t.amount, 0));
        const monthlyExpenseData = last6Months.map(d => completedTransactions.filter(t => t.type === TransactionType.Expense && new Date(t.date).getMonth() === d.month && new Date(t.date).getFullYear() === d.year).reduce((sum, t) => sum + t.amount, 0));
        const monthlyEnrollmentsData = last6Months.map(d => enrollments.filter(e => new Date(e.startDate).getMonth() === d.month && new Date(e.startDate).getFullYear() === d.year).length);
        
        const expenseByCategory = completedTransactions.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>);
        const incomeByCategory = completedTransactions.filter(t => t.type === TransactionType.Income).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>);


        let monthlyChart: Chart, enrollmentsChart: Chart, expensesDoughnut: Chart, incomeDoughnut: Chart, reportsDoughnut: Chart;
        
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

        if (monthlyChartRef.current && activeTab === 'overview') { monthlyChart = new Chart(monthlyChartRef.current, { type: 'bar', data: { labels, datasets: [{ label: 'Entrate', data: monthlyIncomeData, backgroundColor: 'rgba(76, 175, 80, 0.7)' }, { label: 'Uscite', data: monthlyExpenseData, backgroundColor: 'rgba(244, 67, 54, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        if (enrollmentsChartRef.current && activeTab === 'overview') { enrollmentsChart = new Chart(enrollmentsChartRef.current, { type: 'line', data: { labels, datasets: [{ label: 'Nuovi Iscritti', data: monthlyEnrollmentsData, borderColor: 'var(--md-primary)', tension: 0.1, fill: false }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        if (expensesDoughnutRef.current && activeTab === 'overview') { expensesDoughnut = new Chart(expensesDoughnutRef.current, { type: 'doughnut', data: { labels: Object.keys(expenseByCategory), datasets: [{ data: Object.values(expenseByCategory), backgroundColor: ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#e879f9', '#fb7185'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: percentageTooltip } } }); }
        if (incomeDoughnutRef.current && activeTab === 'overview') { incomeDoughnut = new Chart(incomeDoughnutRef.current, { type: 'doughnut', data: { labels: Object.keys(incomeByCategory), datasets: [{ data: Object.values(incomeByCategory), backgroundColor: ['#4CAF50', '#2196F3', '#FFC107', '#9C27B0'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: percentageTooltip } } }); }
        
        if (reportsDoughnutRef.current && activeTab === 'reports') {
             reportsDoughnut = new Chart(reportsDoughnutRef.current, { type: 'doughnut', data: { labels: Object.keys(expenseByCategory), datasets: [{ data: Object.values(expenseByCategory), backgroundColor: ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#e879f9', '#fb7185'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, tooltip: percentageTooltip } } }); 
        }

        return () => { 
            if (monthlyChart) monthlyChart.destroy(); 
            if (enrollmentsChart) enrollmentsChart.destroy(); 
            if (expensesDoughnut) expensesDoughnut.destroy(); 
            if (incomeDoughnut) incomeDoughnut.destroy();
            if (reportsDoughnut) reportsDoughnut.destroy();
        };
    }, [completedTransactions, enrollments, activeTab]); 

    // Filtered Lists for Tables (respecting Trash toggle)
    const displayedTransactions = transactions.filter(t => {
        if (showTrash) return t.isDeleted;
        if (t.isDeleted) return false;
        if (transactionFilter === 'all') return true;
        return t.type === transactionFilter;
    });

    const displayedInvoices = invoices.filter(inv => {
        if (showTrash) return inv.isDeleted;
        if (inv.isDeleted) return false;
        if (invoiceFilter === 'all') return true;
        return inv.status === invoiceFilter;
    });

    const displayedQuotes = quotes.filter(q => {
        if (showTrash) return q.isDeleted;
        if (q.isDeleted) return false;
        return true; // No specific filter for quotes currently
    });

    // --- REPORTS LOGIC ---
    const calculateLocationProfit = () => {
        const locationStats: Record<string, { name: string, revenue: number, costs: number }> = {};
        
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locationStats[l.id] = { name: `${l.name} (${s.companyName})`, revenue: 0, costs: 0 };
            });
        });

        enrollments.forEach(enr => {
            if (enr.status === EnrollmentStatus.Active && locationStats[enr.locationId]) {
                locationStats[enr.locationId].revenue += (enr.price || 0);
            }
        });

        completedTransactions.forEach(t => {
            if (t.type === TransactionType.Expense) {
                if (t.allocationType === 'location' && t.allocationId && locationStats[t.allocationId]) {
                    locationStats[t.allocationId].costs += t.amount;
                }
                else if (t.category === TransactionCategory.Rent && !t.allocationId) {
                    for (const locId in locationStats) {
                        if (t.description.includes(locationStats[locId].name.split('(')[0].trim())) {
                            locationStats[locId].costs += t.amount;
                            break;
                        }
                    }
                }
            }
        });

        return Object.values(locationStats).map(s => ({
            ...s,
            profit: s.revenue - s.costs,
            margin: s.revenue > 0 ? ((s.revenue - s.costs) / s.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);
    };

    const locationProfits = useMemo(() => calculateLocationProfit(), [enrollments, completedTransactions, suppliers]);
    
    const totalOperatingCosts = completedTransactions
        .filter(t => t.type === TransactionType.Expense && t.category !== TransactionCategory.Taxes)
        .reduce((sum, t) => sum + t.amount, 0);
        
    const ebitda = annualIncome - totalOperatingCosts;


    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Entrate (Mese)" 
                            value={`${monthlyIncome.toFixed(2)}€`} 
                            color="var(--md-green)" 
                            onClick={() => {
                                setTransactionFilter(TransactionType.Income);
                                setActiveTab('transactions');
                            }}
                        />
                        <StatCard 
                            title="Uscite (Mese)" 
                            value={`${monthlyExpense.toFixed(2)}€`} 
                            color="var(--md-red)"
                            onClick={() => {
                                setTransactionFilter(TransactionType.Expense);
                                setActiveTab('transactions');
                            }}
                        />
                        <StatCard title="Utile Lordo (Mese)" value={`${(monthlyIncome - monthlyExpense).toFixed(2)}€`} color="var(--md-primary)" />
                        <StatCard 
                            title="Scaduti (Da Incassare)" 
                            value={`${overdueAmount.toFixed(2)}€`} 
                            color="#E65100" 
                            onClick={() => {
                                setInvoiceFilter(DocumentStatus.Overdue);
                                setActiveTab('invoices');
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Andamento Mensile (Entrate vs Uscite)"><canvas ref={monthlyChartRef}></canvas></ChartCard>
                        <ChartCard title="Trend Iscrizioni Allievi"><canvas ref={enrollmentsChartRef}></canvas></ChartCard>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                        <div className="md-card p-6">
                            <h3 className="text-lg font-semibold">Proiezione Fiscale (Regime Forfettario)</h3>
                            <p className="text-sm mb-4" style={{color: 'var(--md-text-secondary)'}}>Stima basata sul fatturato (incassato) dell'anno in corso.</p>
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
                    
                    {/* Controls */}
                    <div className="p-4 md:p-0 md:mb-4 flex flex-wrap justify-between gap-2">
                        <div className="flex space-x-2">
                            <button onClick={() => setTransactionFilter('all')} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === 'all' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Tutti</button>
                            <button onClick={() => setTransactionFilter(TransactionType.Income)} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === TransactionType.Income ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Entrate</button>
                            <button onClick={() => setTransactionFilter(TransactionType.Expense)} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === TransactionType.Expense ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Uscite</button>
                        </div>
                        {!showTrash && (
                            <button onClick={handleGenerateRent} className="md-btn md-btn-flat text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-sm">
                                <CalculatorIcon /> <span className="ml-2">Calcola Nolo Sedi</span>
                            </button>
                        )}
                    </div>

                    {/* Pending Transactions Section */}
                    {!showTrash && pendingTransactions.length > 0 && (
                        <div className="mb-6 border-2 border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
                            <div className="p-4 bg-amber-100 border-b border-amber-200 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-amber-900 flex items-center">
                                    ⚠️ Noli da Saldare ({pendingTransactions.length})
                                </h3>
                                <span className="text-xs text-amber-800">Questi importi non sono ancora inclusi nel bilancio.</span>
                            </div>
                            <div className="divide-y divide-amber-200">
                                {pendingTransactions.map(t => (
                                    <div key={t.id} className="p-3 flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-bold text-amber-900">{t.description}</p>
                                            <p className="text-xs text-amber-700">{new Date(t.date).toLocaleDateString()} - {t.amount.toFixed(2)}€</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button 
                                                onClick={() => handleConfirmPendingTransaction(t)}
                                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow-sm font-medium transition-colors"
                                            >
                                                Salda
                                            </button>
                                             <button onClick={() => handleActionClick(t.id, 'transaction', 'delete')} className="md-icon-btn delete text-amber-700"><TrashIcon/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="md:hidden space-y-3 p-4 pt-0">
                        {displayedTransactions.map(t => (
                            <div key={t.id} className={`md-card p-4 ${t.isDeleted ? 'opacity-75 border-red-200 bg-red-50' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{t.description}</p>
                                        <p className="text-sm" style={{color: 'var(--md-text-secondary)'}}>{t.category}</p>
                                        <p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>{new Date(t.date).toLocaleDateString()}</p>
                                    </div>
                                    <p className={`font-bold text-lg ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}€</p>
                                </div>
                                <div className="text-right mt-2 space-x-2">
                                     {showTrash ? (
                                        <>
                                            <button onClick={() => handleActionClick(t.id, 'transaction', 'restore')} className="md-icon-btn text-green-600"><RestoreIcon/></button>
                                            <button onClick={() => handleActionClick(t.id, 'transaction', 'permanent')} className="md-icon-btn text-red-600"><TrashIcon/></button>
                                        </>
                                     ) : (
                                        <>
                                            <button onClick={() => handleOpenTransModal(t)} className="md-icon-btn edit"><PencilIcon/></button>
                                            <button onClick={() => handleActionClick(t.id, 'transaction', 'delete')} className="md-icon-btn delete"><TrashIcon/></button>
                                        </>
                                     )}
                                </div>
                            </div>
                        ))}
                         {displayedTransactions.length === 0 && <p className="text-center text-gray-500 text-sm py-4">Nessuna transazione registrata.</p>}
                    </div>
                    <table className="w-full text-left hidden md:table">
                        <thead>
                            <tr className="border-b" style={{borderColor: 'var(--md-divider)'}}>
                                <th className="p-4 font-medium">Data</th>
                                <th className="p-4 font-medium">Descrizione</th>
                                <th className="p-4 font-medium">Categoria</th>
                                <th className="p-4 font-medium">Imputazione</th>
                                <th className="p-4 text-right font-medium">Importo</th>
                                <th className="p-4 font-medium">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedTransactions.map(t => (
                                <tr key={t.id} className={`border-b hover:bg-gray-50 ${t.isDeleted ? 'bg-red-50' : ''}`} style={{borderColor: 'var(--md-divider)'}}>
                                    <td className="p-4 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium">{t.description}</td>
                                    <td className="p-4 text-sm">{t.category}</td>
                                    <td className="p-4 text-xs text-gray-500">
                                        {t.allocationType === 'location' ? `Sede: ${t.allocationName || '...'}` : 
                                         t.allocationType === 'enrollment' ? `Iscrizione: ${t.allocationName || '...'}` : 
                                         '-'}
                                    </td>
                                    <td className={`p-4 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {t.amount.toFixed(2)}€</td>
                                    <td className="p-4 flex space-x-2">
                                        {showTrash ? (
                                            <>
                                                <button onClick={() => handleActionClick(t.id, 'transaction', 'restore')} className="md-icon-btn text-green-600" title="Ripristina"><RestoreIcon/></button>
                                                <button onClick={() => handleActionClick(t.id, 'transaction', 'permanent')} className="md-icon-btn text-red-600" title="Elimina per sempre"><TrashIcon/></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleOpenTransModal(t)} className="md-icon-btn edit"><PencilIcon/></button>
                                                <button onClick={() => handleActionClick(t.id, 'transaction', 'delete')} className="md-icon-btn delete"><TrashIcon/></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                             {displayedTransactions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessuna transazione trovata.</td></tr>}
                        </tbody>
                    </table>
                </div>
            );
            case 'invoices': return (
                <div className="md-card p-0 md:p-6 animate-fade-in">
                    {/* Filter controls for invoices */}
                    <div className="p-4 md:p-0 md:mb-4 flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                         <button 
                            onClick={() => setInvoiceFilter('all')} 
                            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === 'all' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Tutte
                        </button>
                        <button 
                            onClick={() => setInvoiceFilter(DocumentStatus.Overdue)} 
                            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.Overdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Scadute
                        </button>
                         <button 
                            onClick={() => setInvoiceFilter(DocumentStatus.Paid)} 
                            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.Paid ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Pagate
                        </button>
                         <button 
                            onClick={() => setInvoiceFilter(DocumentStatus.Sent)} 
                            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Inviate
                        </button>
                         <button 
                            onClick={() => setInvoiceFilter(DocumentStatus.Draft)} 
                            className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.Draft ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Bozze
                        </button>
                    </div>

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
                                {displayedInvoices.map(inv => (
                                    <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.isDeleted ? 'bg-red-50' : ''}`} style={{borderColor: 'var(--md-divider)'}}>
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
                                                disabled={inv.isDeleted}
                                                onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')}
                                                className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4 flex items-center space-x-2">
                                            {showTrash ? (
                                                <>
                                                    <button onClick={() => handleActionClick(inv.id, 'invoice', 'restore')} className="md-icon-btn text-green-600"><RestoreIcon/></button>
                                                    <button onClick={() => handleActionClick(inv.id, 'invoice', 'permanent')} className="md-icon-btn text-red-600"><TrashIcon/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleDownloadPDF(inv, 'Fattura')} className="md-icon-btn download" title="Scarica PDF"><DownloadIcon /></button>
                                                    <button onClick={() => handleOpenDocModal('invoice', inv)} className="md-icon-btn edit" title="Modifica"><PencilIcon /></button>
                                                    <button onClick={() => handleActionClick(inv.id, 'invoice', 'delete')} className="md-icon-btn delete" title="Elimina"><TrashIcon /></button>
                                                    {inv.isProForma && (
                                                        <button onClick={() => handleMakeInvoiceFinal(inv)} className="md-icon-btn text-indigo-600" title="Rendi Definitiva"><ConvertIcon /></button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {displayedInvoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessuna fattura trovata.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile View Invoices */}
                    <div className="md:hidden p-4 space-y-4">
                        {displayedInvoices.map(inv => (
                            <div key={inv.id} className={`border rounded-lg p-4 shadow-sm ${inv.isDeleted ? 'bg-red-50 opacity-75' : ''}`}>
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
                                        disabled={inv.isDeleted}
                                        onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')}
                                        className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none ${inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="flex space-x-2">
                                         {showTrash ? (
                                            <>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'restore')} className="md-icon-btn text-green-600"><RestoreIcon/></button>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'permanent')} className="md-icon-btn text-red-600"><TrashIcon/></button>
                                            </>
                                         ) : (
                                            <>
                                                <button onClick={() => handleDownloadPDF(inv, 'Fattura')} className="md-icon-btn download"><DownloadIcon /></button>
                                                <button onClick={() => handleOpenDocModal('invoice', inv)} className="md-icon-btn edit"><PencilIcon /></button>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'delete')} className="md-icon-btn delete"><TrashIcon /></button>
                                            </>
                                         )}
                                    </div>
                                </div>
                            </div>
                        ))}
                         {displayedInvoices.length === 0 && <p className="text-center text-gray-500">Nessuna fattura trovata.</p>}
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
                                {displayedQuotes.map(q => (
                                    <tr key={q.id} className={`border-b hover:bg-gray-50 ${q.isDeleted ? 'bg-red-50' : ''}`} style={{borderColor: 'var(--md-divider)'}}>
                                        <td className="p-4 font-medium">{q.quoteNumber}</td>
                                        <td className="p-4 text-sm">{new Date(q.issueDate).toLocaleDateString()}</td>
                                        <td className="p-4">{q.clientName}</td>
                                        <td className="p-4 text-right font-semibold">{q.totalAmount.toFixed(2)}€</td>
                                        <td className="p-4 text-center">
                                            <select 
                                                value={q.status} 
                                                disabled={q.isDeleted}
                                                onChange={(e) => handleUpdateStatus(q.id, e.target.value as DocumentStatus, 'quote')}
                                                className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${q.status === DocumentStatus.Converted ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4 flex items-center space-x-2">
                                            {showTrash ? (
                                                <>
                                                    <button onClick={() => handleActionClick(q.id, 'quote', 'restore')} className="md-icon-btn text-green-600"><RestoreIcon/></button>
                                                    <button onClick={() => handleActionClick(q.id, 'quote', 'permanent')} className="md-icon-btn text-red-600"><TrashIcon/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleDownloadPDF(q, 'Preventivo')} className="md-icon-btn download" title="Scarica PDF"><DownloadIcon /></button>
                                                    <button onClick={() => handleOpenDocModal('quote', q)} className="md-icon-btn edit" title="Modifica"><PencilIcon /></button>
                                                    <button onClick={() => handleActionClick(q.id, 'quote', 'delete')} className="md-icon-btn delete" title="Elimina"><TrashIcon /></button>
                                                    <button 
                                                        onClick={() => handleConvertQuoteToInvoice(q)} 
                                                        className={`md-icon-btn ${q.status === DocumentStatus.Converted ? 'text-gray-300 cursor-not-allowed' : 'text-green-600'}`} 
                                                        title="Converti in Fattura"
                                                        disabled={q.status === DocumentStatus.Converted}
                                                    >
                                                        <ConvertIcon />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {displayedQuotes.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessun preventivo presente.</td></tr>}
                            </tbody>
                        </table>
                     </div>
                     {/* Mobile View Quotes */}
                    <div className="md:hidden p-4 space-y-4">
                        {displayedQuotes.map(q => (
                            <div key={q.id} className={`border rounded-lg p-4 shadow-sm ${q.isDeleted ? 'bg-red-50 opacity-75' : ''}`}>
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold">{q.quoteNumber}</span>
                                    <span className="font-bold text-lg">{q.totalAmount.toFixed(2)}€</span>
                                </div>
                                <p className="text-sm mb-1">{q.clientName}</p>
                                <p className="text-xs text-gray-500 mb-3">{new Date(q.issueDate).toLocaleDateString()}</p>
                                <div className="flex justify-between items-center">
                                     <select 
                                        value={q.status} 
                                        disabled={q.isDeleted}
                                        onChange={(e) => handleUpdateStatus(q.id, e.target.value as DocumentStatus, 'quote')}
                                        className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none ${q.status === DocumentStatus.Converted ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="flex space-x-2">
                                         {showTrash ? (
                                            <>
                                                <button onClick={() => handleActionClick(q.id, 'quote', 'restore')} className="md-icon-btn text-green-600"><RestoreIcon/></button>
                                                <button onClick={() => handleActionClick(q.id, 'quote', 'permanent')} className="md-icon-btn text-red-600"><TrashIcon/></button>
                                            </>
                                         ) : (
                                            <>
                                                <button onClick={() => handleDownloadPDF(q, 'Preventivo')} className="md-icon-btn download"><DownloadIcon /></button>
                                                <button onClick={() => handleOpenDocModal('quote', q)} className="md-icon-btn edit"><PencilIcon /></button>
                                                <button onClick={() => handleActionClick(q.id, 'quote', 'delete')} className="md-icon-btn delete"><TrashIcon /></button>
                                                <button 
                                                        onClick={() => handleConvertQuoteToInvoice(q)} 
                                                        className={`md-icon-btn ${q.status === DocumentStatus.Converted ? 'text-gray-300 cursor-not-allowed' : 'text-green-600'}`} 
                                                        disabled={q.status === DocumentStatus.Converted}
                                                    >
                                                        <ConvertIcon />
                                                    </button>
                                            </>
                                         )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
            case 'reports': return (
                <div className="space-y-6 animate-fade-in">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md-card p-6 border-t-4 border-indigo-500">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Fatturato Annuo (Competenza)</h3>
                            <p className="text-3xl font-bold text-indigo-900">{annualIncome.toFixed(2)}€</p>
                            <p className="text-xs text-gray-400 mt-1">Valore contratti attivati nel {currentYear}</p>
                        </div>
                        <div className="md-card p-6 border-t-4 border-pink-500">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Costi Operativi (OPEX)</h3>
                            <p className="text-3xl font-bold text-pink-900">{totalOperatingCosts.toFixed(2)}€</p>
                            <p className="text-xs text-gray-400 mt-1">Escluso Tasse e INPS</p>
                        </div>
                        <div className="md-card p-6 border-t-4 border-green-500">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">EBITDA (Margine Op. Lordo)</h3>
                            <p className="text-3xl font-bold text-green-900">{ebitda.toFixed(2)}€</p>
                            <p className={`text-xs font-bold mt-1 ${ebitda > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {annualIncome > 0 ? ((ebitda / annualIncome) * 100).toFixed(1) : '0'}% dei Ricavi
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Tabella Profitto per Sede */}
                        <div className="lg:col-span-2 md-card p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Analisi Profitto per Sede</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="p-3 font-semibold text-gray-600">Sede Operativa</th>
                                            <th className="p-3 font-semibold text-gray-600 text-right">Ricavi</th>
                                            <th className="p-3 font-semibold text-gray-600 text-right">Costi Imputati</th>
                                            <th className="p-3 font-semibold text-gray-600 text-right">Margine</th>
                                            <th className="p-3 font-semibold text-gray-600 text-right">%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {locationProfits.map((loc, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium">{loc.name}</td>
                                                <td className="p-3 text-right">{loc.revenue.toFixed(2)}€</td>
                                                <td className="p-3 text-right text-red-600">{loc.costs.toFixed(2)}€</td>
                                                <td className={`p-3 text-right font-bold ${loc.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {loc.profit.toFixed(2)}€
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${loc.margin > 20 ? 'bg-green-100 text-green-800' : loc.margin > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                        {loc.margin.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {locationProfits.length === 0 && (
                                            <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">Nessun dato disponibile.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Chart Costi */}
                        <div className="md-card p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Distribuzione Costi</h3>
                            <div className="h-64 relative">
                                <canvas ref={reportsDoughnutRef}></canvas>
                            </div>
                        </div>
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
            <div className="flex items-center space-x-2">
                <button 
                    onClick={() => setShowTrash(!showTrash)} 
                    className={`md-btn ${showTrash ? 'bg-gray-200 text-gray-800' : 'md-btn-flat'}`}
                    title={showTrash ? "Torna alla lista" : "Visualizza Cestino"}
                >
                    <TrashIcon />
                    <span className="ml-2 hidden sm:inline">{showTrash ? "Lista Attivi" : "Cestino"}</span>
                </button>
                {!showTrash && activeTab === 'transactions' && (
                    <button onClick={() => handleOpenTransModal()} className="md-btn md-btn-raised md-btn-green">
                        <PlusIcon /> <span className="ml-2 hidden sm:inline">Nuova Transazione</span>
                    </button>
                )}
                {!showTrash && (activeTab === 'invoices' || activeTab === 'quotes') && (
                     <button onClick={() => handleOpenDocModal(activeTab === 'invoices' ? 'invoice' : 'quote')} className="md-btn md-btn-raised md-btn-green">
                        <PlusIcon /> <span className="ml-2 hidden sm:inline">{activeTab === 'invoices' ? 'Nuova Fattura' : 'Nuovo Preventivo'}</span>
                    </button>
                )}
            </div>
        </div>

        {showTrash && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mt-6 text-sm flex items-center animate-fade-in">
                <TrashIcon />
                <span className="ml-2 font-bold">MODALITÀ CESTINO:</span> Stai visualizzando elementi eliminati.
            </div>
        )}

        <div className="mt-6 border-b" style={{borderColor: 'var(--md-divider)'}}>
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                <button onClick={() => setActiveTab('reports')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Controllo di Gestione</button>
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
            <Modal onClose={handleCloseTransModal}>
                <TransactionForm 
                    initialData={editingTransaction} 
                    suppliers={suppliers}
                    enrollments={enrollments}
                    onSave={handleSaveTransaction} 
                    onCancel={handleCloseTransModal}
                />
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
            isOpen={!!itemToProcess}
            onClose={() => setItemToProcess(null)}
            onConfirm={handleConfirmAction}
            title={itemToProcess?.action === 'delete' ? "Sposta nel Cestino" : itemToProcess?.action === 'restore' ? "Ripristina Elemento" : "Eliminazione Definitiva"}
            message={itemToProcess?.action === 'delete' 
                ? "Sei sicuro di voler spostare questo elemento nel cestino? Potrai ripristinarlo in seguito." 
                : itemToProcess?.action === 'restore' 
                ? "Vuoi ripristinare questo elemento?" 
                : "ATTENZIONE: Questa operazione è irreversibile. Vuoi eliminare definitivamente questo elemento?"}
            isDangerous={itemToProcess?.action !== 'restore'}
            confirmText={itemToProcess?.action === 'restore' ? "Ripristina" : itemToProcess?.action === 'delete' ? "Sposta nel Cestino" : "Elimina per sempre"}
        />
    </div>
  );
};

export default Finance;
