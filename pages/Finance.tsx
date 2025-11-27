
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment, Invoice, Quote, InvoiceInput, QuoteInput, DocumentStatus, DocumentItem, Client, ClientType, Installment, Supplier, TransactionStatus, Location, EnrollmentStatus, CompanyInfo, SubscriptionType } from '../types';
import { getTransactions, addTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, restoreInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, updateQuoteStatus, deleteQuote, restoreQuote, permanentDeleteQuote, deleteTransactionByRelatedId, updateTransaction, calculateRentTransactions, batchAddTransactions } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo, getSubscriptionTypes } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../components/Spinner';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import PencilIcon from '../components/icons/PencilIcon';
import CalculatorIcon from '../components/icons/CalculatorIcon';
import SearchIcon from '../components/icons/SearchIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import { Chart, registerables, TooltipItem } from 'chart.js';
import * as XLSX from 'xlsx'; 

Chart.register(...registerables);

type Tab = 'overview' | 'transactions' | 'invoices' | 'quotes' | 'reports' | 'archive' | 'simulator';

interface FinanceProps {
    initialParams?: {
        tab?: Tab;
        invoiceStatus?: DocumentStatus;
        transactionStatus?: 'pending' | 'completed';
        searchTerm?: string; 
    };
}

// --- ICONS ---
const TrendingUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const PieChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
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

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

// --- COMPONENTS ---

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

const KpiCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode; trend?: 'up' | 'down' | 'neutral' }> = ({ title, value, subtext, icon, trend }) => (
    <div className="md-card p-5 flex items-start justify-between">
        <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
            {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-full ${trend === 'up' ? 'bg-green-50 text-green-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {icon}
        </div>
    </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="md-card p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64 relative">
            {children}
        </div>
    </div>
);


const TransactionForm: React.FC<{
    initialData?: Transaction | null;
    suppliers: Supplier[];
    enrollments: Enrollment[];
    onSave: (transaction: TransactionInput | Transaction) => void;
    onCancel: () => void;
}> = ({ initialData, suppliers, enrollments, onSave, onCancel }) => {
    // ... (Resto del componente TransactionForm invariato)
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
        
        let allocationName = null;
        let finalAllocationId = null;
        
        if (allocationType === 'location') {
            const loc = allLocations.find(l => l.id === allocationId);
            if (loc) {
                allocationName = `${loc.name} (${loc.supplierName})`;
                finalAllocationId = allocationId;
            }
        } else if (allocationType === 'enrollment') {
            const enr = activeEnrollments.find(e => e.id === allocationId);
            if (enr) {
                allocationName = enr.childName;
                finalAllocationId = allocationId;
            }
        }
        // If 'general', both stay null (Firestore doesn't accept undefined)

        const data: any = { 
            description, 
            amount: Math.abs(Number(amount)), 
            date: new Date(date).toISOString(), 
            type, 
            category, 
            paymentMethod, 
            status,
            allocationType,
            allocationId: finalAllocationId,
            allocationName: allocationName
        };
        
        if (initialData) {
            onSave({ ...data, id: initialData.id } as Transaction);
        } else {
            onSave(data);
        }
    };

    const incomeCategories = Object.values(TransactionCategory).filter(c => [TransactionCategory.Capital, TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));
    const expenseCategories = Object.values(TransactionCategory).filter(c => ![TransactionCategory.Capital, TransactionCategory.Sales, TransactionCategory.OtherIncome].includes(c));

    useEffect(() => {
        if (type === TransactionType.Income && !incomeCategories.includes(category)) {
            setCategory(TransactionCategory.Sales);
        } else if (type === TransactionType.Expense && !expenseCategories.includes(category)) {
            setCategory(TransactionCategory.OtherExpense);
        }
    }, [type]);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
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
                                    <option value="general">Generale (Spese Fisse/Aziendali)</option>
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

// ... (DocumentForm omitted for brevity, unchanged) ...
const DocumentForm: React.FC<{
    type: 'invoice' | 'quote';
    initialData?: Invoice | Quote | null;
    invoicesList?: Invoice[]; // Passato per controllare le fatture fantasma
    onSave: (data: InvoiceInput | QuoteInput) => void;
    onCancel: () => void;
}> = ({ type, initialData, invoicesList = [], onSave, onCancel }) => {
    const [clients, setClients] = useState<Client[]>([]);
    
    // Sort & Filter state for Clients Dropdown
    const [clientSearch, setClientSearch] = useState('');
    const [clientSort, setClientSort] = useState<'asc' | 'desc'>('asc');

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
    const [isGhost, setIsGhost] = useState((type === 'invoice' ? (initialData as Invoice)?.isGhost : false) || false);
    
    const [isSealed, setIsSealed] = useState(initialData?.status === DocumentStatus.SealedSDI);

    const isContentLocked = type === 'invoice' && initialData?.status === DocumentStatus.SealedSDI;

    useEffect(() => {
        const fetchClientsList = async () => {
            const data = await getClients();
            setClients(data);
        };
        fetchClientsList();
    }, []);

    // Ghost Invoice Logic
    const handleClientChange = (newId: string) => {
        setClientId(newId);
        
        if (type === 'invoice' && !initialData?.id) {
            // Check for pending Ghost Invoice
            const ghostInvoice = invoicesList.find(i => i.clientId === newId && i.isGhost && i.status === DocumentStatus.Draft);
            
            if (ghostInvoice) {
                if (confirm(`È presente una Fattura di Saldo (Fantasma) pre-generata per questo cliente (${ghostInvoice.totalAmount}€). Vuoi caricarla?`)) {
                    // Load Ghost Data
                    setItems(ghostInvoice.items);
                    setNotes(ghostInvoice.notes || '');
                    setDueDate(ghostInvoice.dueDate.split('T')[0]);
                    setPaymentMethod(ghostInvoice.paymentMethod || PaymentMethod.BankTransfer);
                    // Rimuovi flag ghost per renderla effettiva se salvata
                    setIsGhost(false); 
                    // Se aveva un ID (era già su DB), idealmente dovremmo aggiornare QUELLA fattura invece di crearne una nuova
                    // Per semplicità qui carichiamo i dati e ne creiamo una nuova, l'utente poi cancellerà la vecchia o il backend gestirà.
                    // Miglioria: passiamo l'ID al submit per fare update invece di create
                    // (initialData viene sovrascritto qui sotto ma è una prop read-only, usiamo stato locale)
                    // ... complex logic needed to swap 'create mode' to 'update mode'. 
                    // Simplified: We assume user wants to create a new one based on ghost data.
                }
            }
        }
    };

    const filteredClients = useMemo(() => {
        let list = clients.filter(c => {
            const name = c.clientType === ClientType.Parent ? `${c.firstName} ${c.lastName}` : c.companyName;
            return name.toLowerCase().includes(clientSearch.toLowerCase());
        });
        
        list.sort((a, b) => {
            const nameA = a.clientType === ClientType.Parent ? `${a.lastName} ${a.firstName}` : a.companyName;
            const nameB = b.clientType === ClientType.Parent ? `${b.lastName} ${b.firstName}` : b.companyName;
            return clientSort === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        
        return list;
    }, [clients, clientSearch, clientSort]);

    const handleSealToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            if (!sdiCode) {
                alert("Inserisci il Codice SDI prima di sigillare la fattura.");
                return;
            }
            setIsSealed(true);
            setStatus(DocumentStatus.SealedSDI);
        } else {
            setIsSealed(false);
            setStatus(DocumentStatus.PendingSDI);
        }
    };

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
                status !== DocumentStatus.Converted &&
                status !== DocumentStatus.PendingSDI &&
                status !== DocumentStatus.SealedSDI) {
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
                isGhost,
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

    const canEditSDI = status === DocumentStatus.Draft || status === DocumentStatus.Sent || status === DocumentStatus.PendingSDI || status === DocumentStatus.SealedSDI;

    let daysLeftSDI = null;
    if (type === 'invoice' && (status === DocumentStatus.PendingSDI || initialData?.status === DocumentStatus.PendingSDI)) {
        const issueD = new Date(issueDate);
        issueD.setHours(0,0,0,0);
        let deadline = new Date(issueD);
        deadline.setDate(deadline.getDate() + 12);
        
        if(issueD.getMonth() === 11) {
            const dec30 = new Date(issueD.getFullYear(), 11, 30);
            if (deadline > dec30) deadline = dec30;
        }
        
        const diffTime = deadline.getTime() - new Date().getTime();
        daysLeftSDI = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {initialData ? 'Modifica' : 'Nuovo'} {type === 'invoice' ? 'Fattura' : 'Preventivo'}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {type === 'invoice' && (
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                            <input type="checkbox" id="proforma" checked={isProForma} onChange={e => setIsProForma(e.target.checked)} disabled={isContentLocked} className="h-4 w-4 text-indigo-600"/>
                            <label htmlFor="proforma" className="text-sm font-medium text-gray-700">Fattura Pro-Forma</label>
                        </div>
                        {isGhost && (
                            <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">
                                👻 FATTURA FANTASMA (Saldo Futuro)
                            </div>
                        )}
                        {relatedQuoteNumber && (
                             <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                Da Preventivo: <span className="font-medium">{relatedQuoteNumber}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* --- CLIENT SELECTION & FILTER --- */}
                <div>
                    {!isContentLocked && (
                        <div className="flex gap-2 mb-1">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input 
                                    type="text" 
                                    placeholder="Cerca cliente..." 
                                    className="block w-full border rounded-md py-1 pl-8 pr-2 text-xs"
                                    value={clientSearch}
                                    onChange={e => setClientSearch(e.target.value)}
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setClientSort(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="px-2 py-1 bg-gray-100 border rounded text-xs font-bold w-12"
                            >
                                {clientSort === 'asc' ? 'A-Z' : 'Z-A'}
                            </button>
                        </div>
                    )}
                    <div className="md-input-group">
                        <select id="client" value={clientId} onChange={e => handleClientChange(e.target.value)} required className={`md-input ${isContentLocked ? 'bg-gray-50 text-gray-500' : ''}`} disabled={isContentLocked}>
                            <option value="" disabled>Seleziona Cliente</option>
                            {filteredClients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.clientType === ClientType.Parent ? `${c.firstName} ${c.lastName}` : c.companyName}
                                </option>
                            ))}
                        </select>
                        <label htmlFor="client" className="md-input-label !top-0 !text-xs !text-gray-500">Cliente</label>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="issueDate" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required className={`md-input ${isContentLocked ? 'bg-gray-50 text-gray-500' : ''}`} disabled={isContentLocked}/><label htmlFor="issueDate" className="md-input-label !top-0 !text-xs !text-gray-500">Data Emissione</label></div>
                    <div className="md-input-group"><input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className={`md-input ${isContentLocked ? 'bg-gray-50 text-gray-500' : ''}`} disabled={isContentLocked}/><label htmlFor="dueDate" className="md-input-label !top-0 !text-xs !text-gray-500">{type === 'invoice' ? 'Scadenza Pagamento' : 'Validità fino al'}</label></div>
                </div>
                
                <div className="mt-6">
                    <h3 className="font-semibold mb-2">Articoli</h3>
                    {items.map((item, index) => (
                        <div key={index} className="mb-4 border-b border-gray-100 pb-2">
                            <div className="flex gap-2 items-end">
                                <div className="flex-grow"><input type="text" placeholder="Descrizione" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className={`md-input text-sm ${isContentLocked ? 'bg-gray-50' : ''}`} disabled={isContentLocked} required /></div>
                                <div className="w-16"><input type="number" placeholder="Qtà" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className={`md-input text-sm text-center ${isContentLocked ? 'bg-gray-50' : ''}`} disabled={isContentLocked} required min="1"/></div>
                                <div className="w-24"><input type="number" placeholder="Prezzo" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className={`md-input text-sm text-right ${isContentLocked ? 'bg-gray-50' : ''}`} disabled={isContentLocked} required step="0.01"/></div>
                                {items.length > 1 && !isContentLocked && <button type="button" onClick={() => removeItem(index)} className="text-red-500 p-1"><TrashIcon /></button>}
                            </div>
                             <input 
                                type="text" 
                                placeholder="Note esplicative (opzionale)" 
                                value={item.notes || ''} 
                                onChange={e => handleItemChange(index, 'notes', e.target.value)} 
                                className={`md-input text-xs text-gray-500 w-full mt-1 italic bg-transparent border-none focus:ring-0 focus:border-gray-300 pl-1 ${isContentLocked ? 'bg-gray-50' : ''}`}
                                disabled={isContentLocked}
                            />
                        </div>
                    ))}
                    {!isContentLocked && <button type="button" onClick={addItem} className="text-sm text-indigo-600 font-medium flex items-center mt-2"><PlusIcon /> Aggiungi Riga</button>}
                </div>

                 <div className="text-right mt-4 space-y-1">
                    <p className="text-sm text-gray-600">Imponibile: {subtotal.toFixed(2)}€</p>
                    {hasStampDuty && <p className="text-sm text-gray-600">+ Bollo Virtuale: 2.00€</p>}
                    <p className="text-lg font-bold">Totale: {totalAmount.toFixed(2)}€</p>
                </div>

                <div className="mt-6 pt-4 border-t">
                    <h3 className="font-semibold mb-3">Pagamenti</h3>
                    <div className="md-input-group mb-4">
                         <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className={`md-input ${isContentLocked ? 'bg-gray-50 text-gray-500' : ''}`} disabled={isContentLocked}>
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label htmlFor="paymentMethod" className="md-input-label !top-0 !text-xs !text-gray-500">Metodo di Pagamento</label>
                    </div>

                    <div className="space-y-2">
                         <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">Piano Rateale / Scadenze</h4>
                            {!isContentLocked && <button type="button" onClick={addInstallment} className="text-xs text-indigo-600 font-medium">+ Aggiungi Rata</button>}
                        </div>
                        {installments.map((inst, index) => (
                            <div key={index} className="flex gap-2 items-end bg-gray-50 p-2 rounded">
                                <div className="flex-grow"><input type="text" placeholder="Descrizione (es. Acconto)" value={inst.description} onChange={e => updateInstallment(index, 'description', e.target.value)} className="bg-transparent border-b border-gray-300 w-full text-sm" disabled={isContentLocked} /></div>
                                <div className="w-28"><input type="date" value={inst.dueDate.split('T')[0]} onChange={e => updateInstallment(index, 'dueDate', new Date(e.target.value).toISOString())} className="bg-transparent border-b border-gray-300 w-full text-sm" disabled={isContentLocked} /></div>
                                <div className="w-20"><input type="number" placeholder="€" value={inst.amount} onChange={e => updateInstallment(index, 'amount', Number(e.target.value))} className="bg-transparent border-b border-gray-300 w-full text-sm text-right" disabled={isContentLocked} /></div>
                                {!isContentLocked && <button type="button" onClick={() => removeInstallment(index)} className="text-red-500"><TrashIcon /></button>}
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
                     <div className="mt-4 bg-blue-50 p-4 rounded border border-blue-200">
                         <h4 className="text-sm font-bold text-blue-800 mb-3 uppercase flex items-center gap-2">
                             <span className="bg-white text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs border border-blue-200">i</span>
                             Area SDI (Agenzia delle Entrate)
                         </h4>
                         
                         <div className="md-input-group mb-4">
                             <input 
                                id="sdi" 
                                type="text" 
                                value={sdiCode} 
                                onChange={e => setSdiCode(e.target.value)} 
                                className={`md-input font-bold text-blue-900 ${!canEditSDI ? 'opacity-50 bg-gray-100 cursor-not-allowed' : ''}`}
                                placeholder=" "
                                disabled={!canEditSDI}
                             />
                             <label htmlFor="sdi" className="md-input-label text-blue-700">Codice SDI / Numero Protocollo</label>
                         </div>
                         
                         <div className="flex items-center justify-between bg-white p-3 rounded border border-blue-100 shadow-sm">
                            <span className="text-sm font-medium text-gray-700">Stato Fattura:</span>
                            <label className="inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={isSealed}
                                    onChange={handleSealToggle}
                                    disabled={!sdiCode} 
                                />
                                <div className={`relative w-11 h-6 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${!sdiCode ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 peer-checked:bg-blue-600'}`}></div>
                                <span className={`ms-3 text-sm font-bold ${isSealed ? 'text-blue-700' : 'text-gray-500'}`}>
                                    {isSealed ? "SIGILLATA! (SDI)" : "DA SIGILLARE"}
                                </span>
                            </label>
                         </div>
                         
                         {!sdiCode && <p className="text-xs text-red-500 mt-2 italic">⚠️ Inserisci il codice SDI per abilitare la sigillatura e importare la transazione.</p>}
                         {isSealed && <p className="text-xs text-green-600 mt-2 font-medium">✔️ Fattura pronta. Clicca "Salva" per generare/aggiornare la transazione finanziaria.</p>}
                     </div>
                )}

                 <div className="md-input-group mt-4">
                    <select id="status" value={status} onChange={e => setStatus(e.target.value as DocumentStatus)} className="md-input" disabled={type === 'invoice' && status === DocumentStatus.SealedSDI}>
                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label htmlFor="status" className="md-input-label !top-0 !text-xs !text-gray-500">Stato Documento</label>
                    {type === 'invoice' && status === DocumentStatus.SealedSDI && <p className="text-[10px] text-gray-400 mt-1">Lo stato è bloccato perché la fattura è sigillata.</p>}
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
    // ... (Hooks e logiche esistenti invariate fino all'apertura modale) ...
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    
    // Unified Filters
    const [transactionFilter, setTransactionFilter] = useState<'all' | TransactionType>('all');
    const [invoiceFilter, setInvoiceFilter] = useState<'all' | DocumentStatus>('all');
    const [showTrash, setShowTrash] = useState(false);
    
    // New Filters for Transactions
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [allocationFilter, setAllocationFilter] = useState<string>('');

    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc'>('date_desc');

    // Settings State for Fuel Calculation
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [currentFuelPrice, setCurrentFuelPrice] = useState(1.80);

    useEffect(() => {
        if (initialParams) {
            if (initialParams.tab) setActiveTab(initialParams.tab);
            if (initialParams.invoiceStatus) setInvoiceFilter(initialParams.invoiceStatus);
            if (initialParams.searchTerm) setSearchTerm(initialParams.searchTerm);
        }
    }, [initialParams]);

    // Reset Search and Sort when Tab Changes
    useEffect(() => {
        setSearchTerm('');
        setSortOrder('date_desc');
        setCategoryFilter('');
        setAllocationFilter('');
    }, [activeTab]);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]); 
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Archive State
    const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);

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
    const profitDoughnutRef = useRef<HTMLCanvasElement>(null); 
    const efficiencyScatterRef = useRef<HTMLCanvasElement>(null); 


    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transData, enrollData, invData, quoData, clientsData, suppliersData, compInfo, subsData] = await Promise.all([
                getTransactions(), 
                getAllEnrollments(),
                getInvoices(),
                getQuotes(),
                getClients(),
                getSuppliers(),
                getCompanyInfo(),
                getSubscriptionTypes()
            ]);
            setTransactions(transData); 
            setEnrollments(enrollData);
            setInvoices(invData);
            setQuotes(quoData);
            setClients(clientsData);
            setSuppliers(suppliersData);
            setCompanyInfo(compInfo);
            setSubscriptionTypes(subsData);
        } catch (err) {
            setError("Impossibile caricare i dati finanziari."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);
    const completedTransactions = useMemo(() => activeTransactions.filter(t => !t.status || t.status === TransactionStatus.Completed), [activeTransactions]);
    const pendingTransactions = useMemo(() => activeTransactions.filter(t => t.status === TransactionStatus.Pending), [activeTransactions]);
    const pendingSDIInvoiceIds = useMemo(() => new Set(invoices.filter(i => i.status === DocumentStatus.PendingSDI).map(i => i.id)), [invoices]);

    // --- HANDLERS ---
    const handleOpenTransModal = (transaction: Transaction | null = null) => { setEditingTransaction(transaction); setIsTransModalOpen(true); };
    const handleCloseTransModal = () => { setEditingTransaction(null); setIsTransModalOpen(false); };
    const handleSaveTransaction = async (transactionData: TransactionInput | Transaction) => { try { if ('id' in transactionData) { const { id, ...data } = transactionData; await updateTransaction(id, data); } else { await addTransaction(transactionData); } handleCloseTransModal(); fetchAllData(); } catch (error) { console.error("Errore salvataggio transazione:", error); alert("Errore durante il salvataggio della transazione."); } };
    const handleGenerateRent = async () => { setLoading(true); try { const newTransactions = calculateRentTransactions(enrollments, suppliers, activeTransactions); if (newTransactions.length > 0) { await batchAddTransactions(newTransactions); await fetchAllData(); alert(`Generazione completata. Aggiunti ${newTransactions.length} movimenti di nolo in stato 'Da Saldare'.`); } else { alert("Nessuna nuova spesa di nolo da generare."); } } catch (err) { console.error("Errore generazione nolo:", err); alert("Errore durante la generazione delle spese di nolo."); } finally { setLoading(false); } };
    const handleConfirmPendingTransaction = async (t: Transaction) => { try { await updateTransaction(t.id, { status: TransactionStatus.Completed }); fetchAllData(); } catch (err) { console.error("Errore conferma transazione", err); alert("Impossibile confermare il saldo."); } };
    const handleOpenDocModal = (type: 'invoice' | 'quote', doc: Invoice | Quote | null = null) => { setDocType(type); setEditingDoc(doc); setIsDocModalOpen(true); };
    const handleCloseDocModal = () => { setIsDocModalOpen(false); setEditingDoc(null); setQuoteToConvertId(null); };
    const handleSaveDocument = async (data: InvoiceInput | QuoteInput) => { try { if (docType === 'invoice') { const invData = data as InvoiceInput; let savedId = ''; let finalInvoiceNumber = invData.invoiceNumber; const isUpdate = 'id' in invData; if (isUpdate) { savedId = (invData as any).id; await updateInvoice(savedId, invData); } else { const result = await addInvoice(invData); savedId = result.id; finalInvoiceNumber = result.invoiceNumber; } if (isUpdate) { await deleteTransactionByRelatedId(savedId); } const shouldCreateTransaction = invData.status === DocumentStatus.Paid || invData.status === DocumentStatus.PendingSDI || invData.status === DocumentStatus.SealedSDI; if (shouldCreateTransaction) { await addTransaction({ date: invData.issueDate, description: `Incasso Fattura ${finalInvoiceNumber || 'PROFORMA'} - ${invData.clientName}`, amount: invData.totalAmount, type: TransactionType.Income, category: TransactionCategory.Sales, paymentMethod: invData.paymentMethod || PaymentMethod.BankTransfer, status: TransactionStatus.Completed, relatedDocumentId: savedId }); } if (quoteToConvertId) { await updateQuoteStatus(quoteToConvertId, DocumentStatus.Converted); setQuoteToConvertId(null); } } else { if ('id' in data) await updateQuote((data as any).id, data as QuoteInput); else await addQuote(data as QuoteInput); } handleCloseDocModal(); await fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); } catch (e) { console.error(e); alert("Errore nel salvataggio"); } };
    const handleConvertQuoteToInvoice = (quote: Quote) => { setQuoteToConvertId(quote.id); const invoiceData: InvoiceInput = { clientId: quote.clientId, clientName: quote.clientName, issueDate: new Date().toISOString(), dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), items: quote.items, totalAmount: quote.totalAmount, status: DocumentStatus.Draft, isProForma: false, paymentMethod: quote.paymentMethod || PaymentMethod.BankTransfer, installments: quote.installments || [], invoiceNumber: '', hasStampDuty: quote.hasStampDuty, notes: quote.notes || '', relatedQuoteNumber: quote.quoteNumber }; setDocType('invoice'); setEditingDoc(invoiceData as unknown as Invoice); setIsDocModalOpen(true); };
    const handleMakeInvoiceFinal = async (invoice: Invoice) => { if (!invoice.isProForma) return; try { await updateInvoice(invoice.id, { isProForma: false }); await fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); } catch(e) { console.error(e); } };
    const handleUpdateStatus = async (id: string, status: DocumentStatus, type: 'invoice' | 'quote') => { if (type === 'invoice') { const invoice = invoices.find(i => i.id === id); if (invoice) { try { await deleteTransactionByRelatedId(id); } catch (e) { console.error("Errore nella pulizia delle transazioni precedenti:", e); } if (status === DocumentStatus.Paid || status === DocumentStatus.PendingSDI || status === DocumentStatus.SealedSDI) { try { await addTransaction({ date: invoice.issueDate, description: `Incasso Fattura ${invoice.invoiceNumber} - ${invoice.clientName}`, amount: invoice.totalAmount, type: TransactionType.Income, category: TransactionCategory.Sales, paymentMethod: invoice.paymentMethod || PaymentMethod.BankTransfer, status: TransactionStatus.Completed, relatedDocumentId: invoice.id }); } catch (e) { console.error("Errore creazione transazione automatica", e); alert("Attenzione: Stato aggiornato ma errore nella creazione della transazione automatica."); } } } setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv)); await updateInvoiceStatus(id, status); window.dispatchEvent(new Event('EP_DataUpdated')); } else { setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q)); await updateQuoteStatus(id, status); } fetchAllData(); };
    const handleActionClick = (id: string, type: 'transaction' | 'invoice' | 'quote', action: 'delete' | 'restore' | 'permanent') => { setItemToProcess({ id, type, action }); };
    const handleConfirmAction = async () => { if (!itemToProcess) return; const { id, type, action } = itemToProcess; try { if (type === 'transaction') { if (action === 'delete') await deleteTransaction(id); else if (action === 'restore') await restoreTransaction(id); else await permanentDeleteTransaction(id); } else if (type === 'invoice') { if (action === 'delete') await deleteInvoice(id); else if (action === 'restore') await restoreInvoice(id); else await permanentDeleteInvoice(id); } else if (type === 'quote') { if (action === 'delete') await deleteQuote(id); else if (action === 'restore') await restoreQuote(id); else await permanentDeleteQuote(id); } await fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); } catch (e) { console.error(e); setError("Errore durante l'operazione."); } finally { setItemToProcess(null); } };
    const handleDownloadPDF = async (doc: Invoice | Quote, type: 'Fattura' | 'Preventivo') => { try { const companyInfo = await getCompanyInfo(); const client = clients.find(c => c.id === doc.clientId); await generateDocumentPDF(doc, type, companyInfo, client); } catch (err) { console.error("Errore PDF", err); setError("Impossibile generare il PDF."); } };
    const handleArchiveToggle = (id: string) => { setSelectedArchiveIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
    const handleArchiveSelectAll = () => { const allIds = invoices.filter(i => !i.isDeleted && i.status !== DocumentStatus.Draft && i.status !== DocumentStatus.Cancelled).map(i => i.id); if (selectedArchiveIds.length === allIds.length) { setSelectedArchiveIds([]); } else { setSelectedArchiveIds(allIds); } };
    const getSelectedInvoices = () => { return invoices.filter(i => selectedArchiveIds.includes(i.id)); };
    const handleSendDistinta = () => { const selected = getSelectedInvoices(); if (selected.length === 0) { alert("Seleziona almeno una fattura."); return; } const supplier = suppliers.find(s => s.companyName.trim().toUpperCase().includes("SIMONA PUDDU")); if (!supplier || !supplier.phone) { alert("Impossibile trovare il contatto WhatsApp del fornitore 'SIMONA PUDDU'. Assicurati che sia registrato tra i fornitori con un numero di telefono."); return; } const monthName = new Date().toLocaleString('it-IT', { month: 'long' }).toUpperCase(); let message = `*DISTINTA TRASMISSIONE FATTURE - ${monthName}*\n\nEcco l'elenco delle fatture emesse:\n\n`; selected.forEach(inv => { const date = new Date(inv.issueDate).toLocaleDateString('it-IT'); message += `📄 *FT ${inv.invoiceNumber}* del ${date}\n`; message += `   SDI: ${inv.sdiCode || "N/A"}\n\n`; }); message += `Totale Fatture: ${selected.length}\n`; message += `Grazie, Ilaria.`; const cleanPhone = supplier.phone.replace(/[^0-9]/g, ''); const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`; window.open(waLink, '_blank'); };
    const handleExportArchiveExcel = () => { const selected = getSelectedInvoices(); if (selected.length === 0) { alert("Seleziona almeno una fattura."); return; } const data = selected.map(inv => ({ "Numero Fattura": inv.invoiceNumber, "Data Emissione": new Date(inv.issueDate).toLocaleDateString('it-IT'), "Cliente": inv.clientName, "Codice SDI": inv.sdiCode || "", "Importo": inv.totalAmount, "Stato": inv.status })); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Distinta Fatture"); XLSX.writeFile(wb, `Distinta_Trasmissione_Fatture.xlsx`); };

    // --- Reports Logic (Controlling) ---
    const reportsData = useMemo(() => {
        let totalRevenue = 0;
        let totalExpenses = 0;
        const expensesByCategory: Record<string, number> = {};
        const profitByLocation: Record<string, { revenue: number, cost: number }> = {};

        completedTransactions.forEach(t => {
            if (t.type === TransactionType.Income) {
                // Exclude Capital from P&L revenue
                if (t.category !== TransactionCategory.Capital) {
                    totalRevenue += t.amount;
                }
            } else {
                totalExpenses += t.amount;
                expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
            }

            // Location Profitability (Simple Model)
            if (t.allocationType === 'location' && t.allocationId && t.allocationName) {
                if (!profitByLocation[t.allocationName]) profitByLocation[t.allocationName] = { revenue: 0, cost: 0 };
                if (t.type === TransactionType.Income) profitByLocation[t.allocationName].revenue += t.amount;
                else profitByLocation[t.allocationName].cost += t.amount;
            }
        });

        // Add implied revenue from Enrollments to Locations if not directly linked in transactions?
        // For simplicity, we rely on transaction allocation here. 
        // Improvement: Iterate enrollments to allocate revenue to locations if transactions are generic "Sales".
        // Current logic: assumes manual or auto allocation in transaction form.

        return { totalRevenue, totalExpenses, expensesByCategory, profitByLocation };
    }, [completedTransactions]);

    // --- Simulator Logic ---
    // (Simplified for restoration)
    const locationProfits = useMemo(() => {
        // Placeholder implementation logic restored from context
        const data = reportsData.profitByLocation;
        return Object.keys(data).map(key => ({
            name: key,
            revenue: data[key].revenue,
            cost: data[key].cost,
            profit: data[key].revenue - data[key].cost
        }));
    }, [reportsData]);
    
    // --- Chart UseEffects ---
    // Overview Charts
    useEffect(() => {
        if (activeTab === 'overview' && monthlyChartRef.current) {
            const ctx = monthlyChartRef.current.getContext('2d');
            if (ctx) {
                const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                const incomeData = new Array(12).fill(0);
                const expenseData = new Array(12).fill(0);
                
                completedTransactions.forEach(t => {
                    const month = new Date(t.date).getMonth();
                    if (t.type === TransactionType.Income) incomeData[month] += t.amount;
                    else expenseData[month] += t.amount;
                });

                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: months,
                        datasets: [
                            { label: 'Entrate', data: incomeData, backgroundColor: '#4ade80', borderRadius: 4 },
                            { label: 'Uscite', data: expenseData, backgroundColor: '#f87171', borderRadius: 4 }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
                });
                return () => chart.destroy();
            }
        }
    }, [activeTab, completedTransactions]);

    useEffect(() => {
        if (activeTab === 'overview' && expensesDoughnutRef.current) {
            const ctx = expensesDoughnutRef.current.getContext('2d');
            if (ctx) {
                const categories = Object.keys(reportsData.expensesByCategory);
                const values = Object.values(reportsData.expensesByCategory);
                const bgColors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#22d3ee', '#818cf8', '#c084fc', '#f472b6'];

                const chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categories,
                        datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
                });
                return () => chart.destroy();
            }
        }
    }, [activeTab, reportsData]);

    const advancedMetrics = { 
        cagr: 0, 
        ros: reportsData.totalRevenue > 0 ? ((reportsData.totalRevenue - reportsData.totalExpenses) / reportsData.totalRevenue) * 100 : 0, 
        arpu: 0, 
        burnRate: reportsData.totalExpenses / 12, // Avg monthly
        dataInsufficient: completedTransactions.length < 5 
    };
    const ebitda = reportsData.totalRevenue - reportsData.totalExpenses; // Simplified
    const simulatorData = { avgMonthlyRevenue: 0, avgMonthlyCosts: 0, subscriptions: [], locations: [], arpu: 0 };

    // --- FILTERING & SORTING LOGIC ---
    const sortItems = <T extends any>(items: T[], dateField: keyof T, alphaField: keyof T) => { return items.sort((a, b) => { switch (sortOrder) { case 'date_desc': return new Date((b as any)[dateField]).getTime() - new Date((a as any)[dateField]).getTime(); case 'date_asc': return new Date((a as any)[dateField]).getTime() - new Date((b as any)[dateField]).getTime(); case 'alpha_asc': return String((a as any)[alphaField]).localeCompare(String((b as any)[alphaField])); case 'alpha_desc': return String((b as any)[alphaField]).localeCompare(String((a as any)[alphaField])); default: return 0; } }); };
    const displayedTransactions = useMemo(() => { 
        let filtered = transactions.filter(t => { 
            if (showTrash) return t.isDeleted; 
            if (t.isDeleted) return false; 
            if (transactionFilter !== 'all' && t.type !== transactionFilter) return false;
            if (categoryFilter && t.category !== categoryFilter) return false;
            if (allocationFilter) {
                if (allocationFilter === 'general') { if (t.allocationType && t.allocationType !== 'general') return false; } 
                else { if (t.allocationType !== allocationFilter) return false; }
            }
            return true; 
        }); 
        
        if (searchTerm) { 
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(t => t.description.toLowerCase().includes(term) || t.amount.toString().includes(term) || t.status.toLowerCase().includes(term) || t.date.includes(term) || (t.allocationName && t.allocationName.toLowerCase().includes(term))); 
        } 
        return sortItems(filtered, 'date', 'description'); 
    }, [transactions, showTrash, transactionFilter, categoryFilter, allocationFilter, searchTerm, sortOrder]);
    
    const displayedInvoices = useMemo(() => { 
        let filtered = invoices.filter(inv => { 
            if (showTrash) return inv.isDeleted; 
            if (inv.isDeleted) return false; 
            // Hide Ghost invoices from main list unless specifically searched or filtering drafts?
            // Usually ghosts are drafts. Let's keep them visible if status matches.
            if (invoiceFilter === 'all') return true; 
            return inv.status === invoiceFilter; 
        }); 
        if (searchTerm) { 
            filtered = filtered.filter(inv => inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || inv.totalAmount.toString().includes(searchTerm) || inv.status.toLowerCase().includes(searchTerm.toLowerCase()) || inv.issueDate.includes(searchTerm)); 
        } 
        return sortItems(filtered, 'issueDate', 'clientName'); 
    }, [invoices, showTrash, invoiceFilter, searchTerm, sortOrder]);
    
    const archiveInvoices = useMemo(() => { let filtered = invoices.filter(inv => !inv.isDeleted && inv.status !== DocumentStatus.Draft && inv.status !== DocumentStatus.Cancelled); if (searchTerm) { filtered = filtered.filter(inv => inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || inv.totalAmount.toString().includes(searchTerm) || inv.issueDate.includes(searchTerm)); } return sortItems(filtered, 'issueDate', 'clientName'); }, [invoices, searchTerm, sortOrder]);
    const displayedQuotes = useMemo(() => { let filtered = quotes.filter(q => { if (showTrash) return q.isDeleted; if (q.isDeleted) return false; return true; }); if (searchTerm) { filtered = filtered.filter(q => q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) || q.totalAmount.toString().includes(searchTerm) || q.status.toLowerCase().includes(searchTerm.toLowerCase())); } return sortItems(filtered, 'issueDate', 'clientName'); }, [quotes, showTrash, searchTerm, sortOrder]);

    const getLocationColor = (clientId: string) => {
        const clientEnrollments = enrollments.filter(e => e.clientId === clientId);
        const active = clientEnrollments.find(e => e.status === EnrollmentStatus.Active);
        if (active) return active.locationColor;
        const pending = clientEnrollments.find(e => e.status === EnrollmentStatus.Pending);
        if (pending) return pending.locationColor;
        return clientEnrollments[0]?.locationColor || 'transparent';
    };

    const FilterBar = () => (
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto mb-4 md:mb-0">
            <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                <input type="text" placeholder="Cerca..." className="block w-full bg-white border rounded-md py-1.5 pl-10 pr-3 text-sm focus:ring-1 focus:ring-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{borderColor: 'var(--md-divider)'}} />
            </div>
            <div className="w-full md:w-40">
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="block w-full bg-white border rounded-md py-1.5 px-2 text-sm focus:ring-1 focus:ring-indigo-500" style={{borderColor: 'var(--md-divider)'}} >
                    <option value="date_desc">Data (Recenti)</option>
                    <option value="date_asc">Data (Vecchi)</option>
                    <option value="alpha_asc">A-Z</option>
                    <option value="alpha_desc">Z-A</option>
                </select>
            </div>
        </div>
    );

    // Actual render inside component
    return (
        <div>
            {/* Header & Tabs ... */}
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Finanza</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestione flussi di cassa, fatturazione e controllo di gestione.</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setIsDocModalOpen(true)} className="md-btn md-btn-raised md-btn-primary">
                        <PlusIcon /> <span className="ml-2">Nuovo Documento</span>
                    </button>
                    {activeTab === 'transactions' && (
                        <>
                            <button onClick={() => handleOpenTransModal()} className="md-btn md-btn-raised md-btn-green">
                                <PlusIcon /> <span className="ml-2">Transazione</span>
                            </button>
                            <button onClick={handleGenerateRent} className="md-btn md-btn-flat bg-orange-100 text-orange-700 hover:bg-orange-200">
                                <CalculatorIcon /> <span className="ml-2">Genera Noli</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-6 border-b mb-6" style={{borderColor: 'var(--md-divider)'}}>
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('transactions')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Transazioni</button>
                    <button onClick={() => setActiveTab('invoices')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'invoices' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Fatture</button>
                    <button onClick={() => setActiveTab('quotes')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'quotes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Preventivi</button>
                    <button onClick={() => setActiveTab('reports')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Controlling</button>
                    <button onClick={() => setActiveTab('simulator')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'simulator' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Simulatore</button>
                    <button onClick={() => setActiveTab('archive')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'archive' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Archivio</button>
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {/* --- OVERVIEW TAB --- */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Ricavi Totali" value={`${reportsData.totalRevenue.toFixed(2)}€`} color="#4ade80" />
                            <StatCard title="Spese Totali" value={`${reportsData.totalExpenses.toFixed(2)}€`} color="#f87171" />
                            <StatCard title="Utile Netto" value={`${ebitda.toFixed(2)}€`} color="#3b82f6" />
                            <StatCard title="Margine (ROS)" value={`${advancedMetrics.ros.toFixed(1)}%`} color="#6366f1" />
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartCard title="Andamento Mensile">
                                <canvas ref={monthlyChartRef} />
                            </ChartCard>
                            <ChartCard title="Ripartizione Spese">
                                <canvas ref={expensesDoughnutRef} />
                            </ChartCard>
                        </div>
                    </div>
                )}

                {/* --- TRANSACTIONS TAB --- */}
                {activeTab === 'transactions' && (
                    <div className="md-card p-0 md:p-6 animate-fade-in">
                        <div className="p-4 md:p-0 md:mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                                <button onClick={() => setTransactionFilter('all')} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === 'all' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200'}`}>Tutte</button>
                                <button onClick={() => setTransactionFilter(TransactionType.Income)} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === TransactionType.Income ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-200'}`}>Entrate</button>
                                <button onClick={() => setTransactionFilter(TransactionType.Expense)} className={`px-3 py-1 text-sm rounded-full border ${transactionFilter === TransactionType.Expense ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}>Uscite</button>
                                <button onClick={() => setShowTrash(!showTrash)} className={`px-3 py-1 text-sm rounded-full border ${showTrash ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}><TrashIcon /></button>
                            </div>
                            <FilterBar />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Descrizione</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Importo</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">Stato</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayedTransactions.map(t => (
                                        <tr key={t.id} className={`hover:bg-gray-50 ${t.isDeleted ? 'bg-red-50 opacity-60' : ''}`}>
                                            <td className="p-4 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-medium text-gray-800">
                                                {t.description}
                                                {t.allocationName && <div className="text-[10px] text-gray-500">Imputato a: {t.allocationName}</div>}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{t.category}</span></td>
                                            <td className={`p-4 text-right font-bold ${t.type === TransactionType.Income ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.type === TransactionType.Income ? '+' : '-'}{t.amount.toFixed(2)}€
                                            </td>
                                            <td className="p-4 text-center">
                                                {t.status === TransactionStatus.Pending ? (
                                                    <button onClick={() => handleConfirmPendingTransaction(t)} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200">Da Saldare</button>
                                                ) : (
                                                    <span className="text-xs text-green-600 font-bold">Completato</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                {showTrash ? (
                                                    <>
                                                        <button onClick={() => handleActionClick(t.id, 'transaction', 'restore')} className="text-green-600 p-1"><RestoreIcon/></button>
                                                        <button onClick={() => handleActionClick(t.id, 'transaction', 'permanent')} className="text-red-600 p-1"><TrashIcon/></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleOpenTransModal(t)} className="text-blue-600 p-1"><PencilIcon/></button>
                                                        <button onClick={() => handleActionClick(t.id, 'transaction', 'delete')} className="text-red-400 p-1"><TrashIcon/></button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- INVOICES TAB --- */}
                {activeTab === 'invoices' && (
                 <div className="md-card p-0 md:p-6 animate-fade-in">
                    <div className="p-4 md:p-0 md:mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                             <button onClick={() => setInvoiceFilter('all')} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === 'all' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Tutte</button>
                             <button onClick={() => setInvoiceFilter(DocumentStatus.PendingSDI)} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.PendingSDI ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Da Sigillare (SDI)</button>
                             <button onClick={() => setInvoiceFilter(DocumentStatus.SealedSDI)} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.SealedSDI ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Sigillate (SDI)</button>
                             <button onClick={() => setInvoiceFilter(DocumentStatus.Overdue)} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${invoiceFilter === DocumentStatus.Overdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Scadute</button>
                        </div>
                        <FilterBar />
                    </div>
                    <div className="md:hidden space-y-3 px-4 pb-4">
                        {displayedInvoices.map(inv => {
                            const locColor = getLocationColor(inv.clientId);
                            return (
                            <div key={inv.id} 
                                 className={`bg-white p-4 rounded-lg border shadow-sm relative overflow-hidden ${inv.isDeleted ? 'bg-red-50 border-red-200 opacity-75' : 'border-gray-100'}`}
                                 style={{
                                     borderLeftWidth: '6px',
                                     borderLeftColor: locColor
                                 }}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-xs text-gray-500">{new Date(inv.issueDate).toLocaleDateString()}</span>
                                        <h4 className="font-bold text-gray-900">{inv.invoiceNumber} {inv.isProForma && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">PRO</span>} {inv.isGhost && <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded">GHOST</span>}</h4>
                                    </div>
                                    <select value={inv.status} disabled={inv.isDeleted} onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')} className={`text-xs font-bold px-2 py-1 rounded border-0 outline-none cursor-pointer max-w-[120px] ${inv.status === DocumentStatus.PendingSDI ? 'bg-yellow-100 text-yellow-800' : inv.status === DocumentStatus.SealedSDI ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <p className="text-sm text-gray-700 font-medium mb-2 truncate">{inv.clientName}</p>
                                <div className="flex justify-between items-end pt-2 border-t border-gray-50">
                                    <span className="font-bold text-lg">{inv.totalAmount.toFixed(2)}€</span>
                                    <div className="flex space-x-2">
                                        {showTrash ? (
                                            <>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'restore')} className="text-green-600 p-1"><RestoreIcon/></button>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'permanent')} className="text-red-600 p-1"><TrashIcon/></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => handleDownloadPDF(inv, 'Fattura')} className="text-green-600 p-1"><DownloadIcon /></button>
                                                <button onClick={() => handleOpenDocModal('invoice', inv)} className="text-blue-600 p-1"><PencilIcon /></button>
                                                <button onClick={() => handleActionClick(inv.id, 'invoice', 'delete')} className="text-red-400 p-1"><TrashIcon /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )})}
                        {displayedInvoices.length === 0 && <p className="text-center text-gray-500 py-8">Nessuna fattura trovata.</p>}
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
                                {displayedInvoices.map(inv => {
                                    const locColor = getLocationColor(inv.clientId);
                                    return (
                                    <tr key={inv.id} 
                                        className={`border-b hover:bg-gray-50 ${inv.isDeleted ? 'bg-red-50' : ''}`} 
                                        style={{
                                            borderColor: 'var(--md-divider)',
                                            boxShadow: locColor !== 'transparent' ? `inset 6px 0 0 ${locColor}` : 'none'
                                        }}
                                    >
                                        <td className="p-4 font-medium">
                                            {inv.invoiceNumber} 
                                            {inv.isProForma && <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded">PRO-FORMA</span>}
                                            {inv.isGhost && <span className="ml-2 bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded">GHOST</span>}
                                        </td>
                                        <td className="p-4 text-sm">{new Date(inv.issueDate).toLocaleDateString()}</td>
                                        <td className="p-4">{inv.clientName}</td>
                                        <td className="p-4 text-right font-semibold">{inv.totalAmount.toFixed(2)}€</td>
                                        <td className="p-4 text-center">
                                             {inv.status === DocumentStatus.PendingSDI ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Da Sigillare (SDI)</span> : inv.status === DocumentStatus.SealedSDI ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🔒 Sigillata (SDI)</span> : (
                                                 <select value={inv.status} disabled={inv.isDeleted} onChange={(e) => handleUpdateStatus(inv.id, e.target.value as DocumentStatus, 'invoice')} className={`text-xs font-bold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${inv.status === DocumentStatus.Paid ? 'bg-green-100 text-green-800' : inv.status === DocumentStatus.Sent ? 'bg-blue-100 text-blue-800' : inv.status === DocumentStatus.Overdue ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {Object.values(DocumentStatus).filter(s => s !== DocumentStatus.PendingSDI && s !== DocumentStatus.SealedSDI).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                             )}
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
                                                    {inv.isProForma && <button onClick={() => handleMakeInvoiceFinal(inv)} className="md-icon-btn text-indigo-600" title="Rendi Definitiva"><ConvertIcon /></button>}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )})}
                                {displayedInvoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nessuna fattura trovata.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}

                {/* --- QUOTES TAB --- */}
                {activeTab === 'quotes' && (
                    <div className="md-card p-6 animate-fade-in">
                        <div className="mb-4 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">Elenco Preventivi</h3>
                            <FilterBar />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Numero</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Totale</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">Stato</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayedQuotes.map(q => (
                                        <tr key={q.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-medium">{q.quoteNumber}</td>
                                            <td className="p-4">{q.clientName}</td>
                                            <td className="p-4 text-right font-bold">{q.totalAmount.toFixed(2)}€</td>
                                            <td className="p-4 text-center">
                                                <select value={q.status} onChange={(e) => handleUpdateStatus(q.id, e.target.value as DocumentStatus, 'quote')} className="text-xs font-bold px-2 py-1 rounded bg-gray-100 border-none">
                                                    {Object.values(DocumentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-4 flex items-center justify-end space-x-2">
                                                <button onClick={() => handleConvertQuoteToInvoice(q)} className="md-icon-btn text-indigo-600" title="Converti in Fattura"><ConvertIcon /></button>
                                                <button onClick={() => handleDownloadPDF(q, 'Preventivo')} className="md-icon-btn download"><DownloadIcon /></button>
                                                <button onClick={() => handleOpenDocModal('quote', q)} className="md-icon-btn edit"><PencilIcon /></button>
                                                <button onClick={() => handleActionClick(q.id, 'quote', 'delete')} className="md-icon-btn delete"><TrashIcon /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- REPORTS TAB --- */}
                {activeTab === 'reports' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <KpiCard title="Profittabilità (ROS)" value={`${advancedMetrics.ros.toFixed(1)}%`} trend={advancedMetrics.ros > 20 ? 'up' : 'neutral'} icon={<TrendingUpIcon />} subtext="Return on Sales" />
                            <KpiCard title="Burn Rate Mensile" value={`${advancedMetrics.burnRate.toFixed(0)}€`} trend="down" icon={<PieChartIcon />} subtext="Media costi fissi" />
                        </div>
                        <div className="md-card p-6">
                            <h3 className="text-lg font-bold mb-4">Analisi Profittabilità per Sede</h3>
                            <div className="space-y-4">
                                {locationProfits.map((loc, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-bold text-gray-700">{loc.name}</span>
                                            <span className={`text-sm font-bold ${loc.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                Utile: {loc.profit.toFixed(2)}€
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden flex">
                                            <div className="bg-green-400 h-full" style={{ width: `${(loc.revenue / (loc.revenue + loc.cost)) * 100}%` }} title={`Ricavi: ${loc.revenue}€`}></div>
                                            <div className="bg-red-400 h-full" style={{ width: `${(loc.cost / (loc.revenue + loc.cost)) * 100}%` }} title={`Costi: ${loc.cost}€`}></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>Ricavi: {loc.revenue.toFixed(2)}€</span>
                                            <span>Costi: {loc.cost.toFixed(2)}€</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ARCHIVE TAB --- */}
                {activeTab === 'archive' && (
                    <div className="md-card p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-lg">Archivio Fatture Emesse</h3>
                                <p className="text-xs text-gray-500">Seleziona le fatture da inviare al commercialista.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSendDistinta} className="md-btn md-btn-raised bg-[#25D366] text-white hover:bg-[#128C7E]">
                                    <WhatsAppIcon /> <span className="ml-2">Invia Distinta WhatsApp</span>
                                </button>
                                <button onClick={handleExportArchiveExcel} className="md-btn md-btn-flat border border-green-600 text-green-700">
                                    <DownloadIcon /> <span className="ml-2">Excel</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 w-10">
                                            <input type="checkbox" onChange={handleArchiveSelectAll} checked={archiveInvoices.length > 0 && selectedArchiveIds.length === archiveInvoices.length} />
                                        </th>
                                        <th className="p-4 text-xs font-semibold uppercase">Data</th>
                                        <th className="p-4 text-xs font-semibold uppercase">Numero</th>
                                        <th className="p-4 text-xs font-semibold uppercase">Cliente</th>
                                        <th className="p-4 text-xs font-semibold uppercase">Importo</th>
                                        <th className="p-4 text-xs font-semibold uppercase">SDI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {archiveInvoices.map(inv => (
                                        <tr key={inv.id} className={selectedArchiveIds.includes(inv.id) ? 'bg-indigo-50' : ''}>
                                            <td className="p-4"><input type="checkbox" checked={selectedArchiveIds.includes(inv.id)} onChange={() => handleArchiveToggle(inv.id)} /></td>
                                            <td className="p-4 text-sm">{new Date(inv.issueDate).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold">{inv.invoiceNumber}</td>
                                            <td className="p-4">{inv.clientName}</td>
                                            <td className="p-4 font-mono">{inv.totalAmount.toFixed(2)}€</td>
                                            <td className="p-4"><span className="text-xs bg-gray-100 px-2 py-1 rounded">{inv.sdiCode || 'N/A'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- SIMULATOR TAB --- */}
                {activeTab === 'simulator' && (
                    <div className="md-card p-6 flex flex-col items-center justify-center text-gray-400 py-12">
                        <SparklesIcon />
                        <p className="mt-2">Simulatore Finanziario in arrivo nella v.1.2</p>
                    </div>
                )}
                </>
            )}

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
                <Modal onClose={handleCloseDocModal} size="2xl">
                    <DocumentForm 
                        type={docType} 
                        initialData={editingDoc}
                        invoicesList={invoices} // Pass the full list to check for Ghosts
                        onSave={handleSaveDocument} 
                        onCancel={handleCloseDocModal} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!itemToProcess}
                onClose={() => setItemToProcess(null)}
                onConfirm={handleConfirmAction}
                title="Conferma Azione"
                message="Sei sicuro?"
                isDangerous={itemToProcess?.action !== 'restore'}
            />
        </div>
    );
};

export default Finance;
