
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionCategory, TransactionType, PaymentMethod, Enrollment, Invoice, Quote, InvoiceInput, QuoteInput, DocumentStatus, DocumentItem, Client, ClientType, Installment, Supplier, TransactionStatus, Location, EnrollmentStatus, CompanyInfo, SubscriptionType } from '../types';
import { getTransactions, addTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getInvoices, addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, restoreInvoice, permanentDeleteInvoice, getQuotes, addQuote, updateQuote, updateQuoteStatus, deleteQuote, restoreQuote, permanentDeleteQuote, deleteTransactionByRelatedId, updateTransaction, calculateRentTransactions, batchAddTransactions } from '../services/financeService';
import { getAllEnrollments } from '../services/enrollmentService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo, getSubscriptionTypes } from '../services/settingsService';
import { generateDocumentPDF } from '../utils/pdfGenerator';
import { Page } from '../App';
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
import PrinterIcon from '../components/icons/PrinterIcon';
import DocumentCheckIcon from '../components/icons/DocumentCheckIcon';
import { Chart, registerables, ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

type Tab = 'dashboard' | 'simulator' | 'controlling' | 'transactions' | 'invoices' | 'quotes';

interface FinanceProps {
    initialParams?: {
        tab?: Tab;
        invoiceStatus?: DocumentStatus;
        transactionStatus?: 'pending' | 'completed';
        searchTerm?: string; 
    };
    onNavigate?: (page: Page, params?: any) => void;
}

// --- ICONS ---
const TrendingUpIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> </svg> );
const BankIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /> </svg> );
const InfoIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg> );
const BulbIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> </svg> );
const RocketIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /> </svg> );
const ShareIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /> </svg> );
const CalendarIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> </svg> );

// ... (TransactionForm, DocumentForm, StatCard retained) ...
const TransactionForm: React.FC<{ transaction?: Transaction | null; onSave: (t: TransactionInput | Transaction) => void; onCancel: () => void }> = ({ transaction, onSave, onCancel }) => { const [date, setDate] = useState(transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]); const [description, setDescription] = useState(transaction?.description || ''); const [amount, setAmount] = useState(transaction?.amount || 0); const [type, setType] = useState<TransactionType>(transaction?.type || TransactionType.Expense); const [category, setCategory] = useState<TransactionCategory>(transaction?.category || TransactionCategory.OtherExpense); const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.paymentMethod || PaymentMethod.BankTransfer); const [status, setStatus] = useState<TransactionStatus>(transaction?.status || TransactionStatus.Completed); const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const data: any = { date: new Date(date).toISOString(), description, amount: Number(amount), type, category, paymentMethod, status }; if (transaction?.id) onSave({ ...data, id: transaction.id }); else onSave(data); }; return ( <form onSubmit={handleSubmit} className="p-6 space-y-4"> <h3 className="text-lg font-bold">{transaction ? 'Modifica Transazione' : 'Nuova Transazione'}</h3> <div className="grid grid-cols-2 gap-4"> <div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" /><label className="md-input-label">Data</label></div> <div className="md-input-group"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="md-input" /><label className="md-input-label">Importo (€)</label></div> </div> <div className="md-input-group"><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="md-input" required /><label className="md-input-label">Descrizione</label></div> <div className="grid grid-cols-2 gap-4"> <div className="md-input-group"><select value={type} onChange={e => setType(e.target.value as TransactionType)} className="md-input">{Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}</select><label className="md-input-label">Tipo</label></div> <div className="md-input-group"><select value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="md-input">{Object.values(TransactionCategory).map(c => <option key={c} value={c}>{c}</option>)}</select><label className="md-input-label">Categoria</label></div> </div> <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button><button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button></div> </form> ); };
const DocumentForm: React.FC<{ doc?: Invoice | Quote | null; type: 'invoice' | 'quote'; clients: Client[]; onSave: (d: any) => void; onCancel: () => void }> = ({ doc, type, clients, onSave, onCancel }) => { const [clientId, setClientId] = useState(doc?.clientId || ''); const [date, setDate] = useState(doc?.issueDate ? doc.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]); const [items, setItems] = useState<DocumentItem[]>(doc?.items || [{ description: '', quantity: 1, price: 0 }]); const client = clients.find(c => c.id === clientId); const clientName = client ? (client.clientType === ClientType.Parent ? `${(client as any).firstName} ${(client as any).lastName}` : (client as any).companyName) : ''; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const total = items.reduce((sum, i) => sum + (i.quantity * i.price), 0); const data = { clientId, clientName, issueDate: new Date(date).toISOString(), items, totalAmount: total, status: doc?.status || DocumentStatus.Draft, invoiceNumber: (doc as any)?.invoiceNumber || '', quoteNumber: (doc as any)?.quoteNumber || '' }; if (doc?.id) onSave({ ...data, id: doc.id }); else onSave(data); }; return ( <form onSubmit={handleSubmit} className="p-6 space-y-4 flex flex-col h-full max-h-[80vh]"> <h3 className="text-lg font-bold">{doc ? `Modifica ${type}` : `Nuovo ${type}`}</h3> <div className="md-input-group"> <select value={clientId} onChange={e => setClientId(e.target.value)} className="md-input"> <option value="">Seleziona Cliente...</option> {clients.map(c => <option key={c.id} value={c.id}>{c.clientType === 'Parent' ? `${(c as any).firstName} ${(c as any).lastName}` : (c as any).companyName}</option>)} </select> <label className="md-input-label">Cliente</label> </div> <div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" /><label className="md-input-label">Data</label></div> <div className="flex-1 overflow-y-auto border p-2 rounded"> <h4 className="text-sm font-bold mb-2">Articoli</h4> {items.map((item, idx) => ( <div key={idx} className="flex gap-2 mb-2"> <input className="border p-1 w-full text-sm" placeholder="Desc" value={item.description} onChange={e => {const n=[...items]; n[idx].description=e.target.value; setItems(n)}} /> <input className="border p-1 w-20 text-sm" type="number" placeholder="Qty" value={item.quantity} onChange={e => {const n=[...items]; n[idx].quantity=Number(e.target.value); setItems(n)}} /> <input className="border p-1 w-24 text-sm" type="number" placeholder="Prezzo" value={item.price} onChange={e => {const n=[...items]; n[idx].price=Number(e.target.value); setItems(n)}} /> </div> ))} <button type="button" onClick={() => setItems([...items, {description:'', quantity:1, price:0}])} className="text-xs text-blue-600">+ Aggiungi Riga</button> </div> <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button><button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button></div> </form> ); };
const StatCard: React.FC<{ title: string; value: string; color: string; subtext?: string; explanation?: string; onClick?: () => void }> = ({ title, value, color, subtext, explanation, onClick }) => ( <div className={`md-card p-4 border-l-4 group relative ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} style={{borderColor: color}} onClick={onClick} > <div className="flex justify-between items-start"> <h3 className="text-xs font-medium uppercase tracking-wide flex items-center gap-1" style={{color: 'var(--md-text-secondary)'}}> {title} {explanation && ( <div className="group/info relative ml-1"> <InfoIcon /> <div className="absolute left-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/info:opacity-100 transition-opacity z-10 pointer-events-none"> {explanation} </div> </div> )} </h3> </div> <p className="text-xl md:text-2xl font-bold mt-1 text-gray-800">{value}</p> {subtext && <p className="text-[10px] text-gray-500 mt-1 font-medium">{subtext}</p>} </div> );

// --- MAIN COMPONENT ---
const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialParams?.tab || 'dashboard');
    
    // Simulator State
    const [targetNetProfit, setTargetNetProfit] = useState<number>(3000); 
    const [taxRate, setTaxRate] = useState<number>(5); 
    const [inpsRate, setInpsRate] = useState<number>(26.23); 
    const [profitabilityCoeff, setProfitabilityCoeff] = useState<number>(78); 
    const [fuelPrice, setFuelPrice] = useState<number>(1.85); 

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Selection State for Invoices
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

    // CRUD Modal State
    const [isTransModalOpen, setIsTransModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docType, setDocType] = useState<'invoice'|'quote'>('invoice');
    const [editingDoc, setEditingDoc] = useState<Invoice | Quote | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'transaction'|'invoice'|'quote'} | null>(null);

    // Chart Refs
    const monthlyChartRef = useRef<HTMLCanvasElement>(null);
    const expenseDoughnutRef = useRef<HTMLCanvasElement>(null);
    const trendLineRef = useRef<HTMLCanvasElement>(null);
    const taxPieRef = useRef<HTMLCanvasElement>(null);

    // Chart Instances Refs (per pulizia)
    const chartInstances = useRef<{[key: string]: any}>({});

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [transData, enrollData, invData, quoData, clientsData, suppliersData, compInfo] = await Promise.all([
                getTransactions(), getAllEnrollments(), getInvoices(), getQuotes(), getClients(), getSuppliers(), getCompanyInfo()
            ]);
            setTransactions(transData); setEnrollments(enrollData); setInvoices(invData); setQuotes(quoData);
            setClients(clientsData); setSuppliers(suppliersData); setCompanyInfo(compInfo);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    // --- FINANCIAL CORE CALCULATIONS ---
    const activeTransactions = useMemo(() => transactions.filter(t => !t.isDeleted), [transactions]);
    
    const metrics = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let totalRevenueYTD = 0;
        let totalExpensesYTD = 0;
        let monthlyRevenue = new Array(12).fill(0);
        let monthlyExpenses = new Array(12).fill(0);
        const expensesByCategory: Record<string, number> = {};

        activeTransactions.forEach(t => {
            const d = new Date(t.date);
            if (d.getFullYear() === currentYear) {
                // Ricavi: Tutto ciò che è Income tranne il Capitale Iniziale
                if (t.type === TransactionType.Income && t.category !== TransactionCategory.Capital) {
                    totalRevenueYTD += t.amount;
                    monthlyRevenue[d.getMonth()] += t.amount;
                } else if (t.type === TransactionType.Expense) {
                    totalExpensesYTD += t.amount;
                    monthlyExpenses[d.getMonth()] += t.amount;
                    // Aggregate for Doughnut
                    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
                }
            }
        });

        // Proiezioni
        const avgMonthlyRevenue = totalRevenueYTD / (currentMonth + 1);
        const avgMonthlyExpenses = totalExpensesYTD / (currentMonth + 1);
        const projectedAnnualRevenue = avgMonthlyRevenue * 12;
        const projectedAnnualExpenses = avgMonthlyExpenses * 12;

        return { 
            totalRevenueYTD, totalExpensesYTD, 
            monthlyRevenue, monthlyExpenses,
            avgMonthlyRevenue, avgMonthlyExpenses,
            projectedAnnualRevenue, projectedAnnualExpenses,
            expensesByCategory
        };
    }, [activeTransactions]);

    // --- SIMULATOR LOGIC (CFO) ---
    const simulation = useMemo(() => {
        const monthlyExpenses = metrics.avgMonthlyExpenses;
        const targetNet = targetNetProfit;
        const totalTaxBurdenRate = (profitabilityCoeff / 100) * ((taxRate / 100) + (inpsRate / 100));
        const requiredGrossRevenue = (targetNet + monthlyExpenses) / (1 - totalTaxBurdenRate);
        const currentGap = requiredGrossRevenue - metrics.avgMonthlyRevenue;
        const newStudentsNeeded = currentGap > 0 ? Math.ceil(currentGap / (350 / 4)) : 0; 
        
        return { requiredGrossRevenue, currentGap, newStudentsNeeded, totalTaxBurdenRate };
    }, [targetNetProfit, metrics, taxRate, inpsRate, profitabilityCoeff]);

    // --- CONTROLLING FISCALE (ACCONTI) ---
    const fiscalSchedule = useMemo(() => {
        // Base di calcolo: Fatturato Proiettato Annuo
        const projectedRevenue = metrics.projectedAnnualRevenue;
        
        // Calcolo Carico Fiscale Base (Anno Corrente)
        const taxableIncome = projectedRevenue * (profitabilityCoeff / 100);
        const annualTax = taxableIncome * (taxRate / 100);
        const annualInps = taxableIncome * (inpsRate / 100);
        const totalBaseDue = annualTax + annualInps;

        // Logica Acconti (Doppio Binario: Saldo X + Acconto X+1)
        // 1. Scadenza Giugno: Saldo (100% Base) + I Acconto (50% Base)
        // Nota: Il saldo si paga nell'anno successivo. L'acconto è una stima sul successivo.
        // Questo calcolo assume che l'anno prossimo si pagherà:
        // - Saldo di QUESTO anno corrente (totalBaseDue)
        // - Primo Acconto dell'ANNO PROSSIMO (calcolato storicamente sul 100% di questo anno).
        
        const saldoYearCurrent = totalBaseDue;
        const accontoYearNextTotal = totalBaseDue; // Metodo storico (100% dell'anno prec)
        
        const firstInstallmentJune = saldoYearCurrent + (accontoYearNextTotal * 0.5); // Saldo + 50% Acconto
        const secondInstallmentNov = accontoYearNextTotal * 0.5; // Restante 50% Acconto

        // Rateizzazione Giugno (max 6 rate: Giu-Nov)
        // Stima interessi ~4% annuo su base mensile semplificata per la visualizzazione
        const installmentCount = 6;
        const monthlyInstallmentBase = firstInstallmentJune / installmentCount;
        
        return {
            totalBaseDue,
            firstInstallmentJune,
            secondInstallmentNov,
            monthlyInstallmentBase
        };
    }, [metrics.projectedAnnualRevenue, profitabilityCoeff, taxRate, inpsRate]);


    // --- LOGISTICS & PROFITABILITY (NEW SLOT LOGIC) ---
    const logisticsData = useMemo(() => {
        const profitByLocation: Record<string, { revenue: number, cost: number, trips: number, distance: number }> = {};
        const locationInfoMap = new Map<string, {name: string, distance: number}>();
        
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locationInfoMap.set(l.id, { name: l.name, distance: l.distance || 0 });
                // Init structure
                profitByLocation[l.id] = { revenue: 0, cost: 0, trips: 0, distance: l.distance || 0 };
            });
        });

        // 1. CALCOLO RICAVI DA CONSUMO SLOT (Quota Parte)
        // I soldi non vanno alla sede quando paghi, ma quando CONSUMI lo slot (presenza)
        enrollments.forEach(enr => {
            // Calcola valore unitario slot
            const totalSlots = enr.lessonsTotal || 1;
            const price = enr.price || 0;
            const unitValue = price / totalSlots;

            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    if (app.status === 'Present') {
                        // Cerca la location ID in base al nome (se non abbiamo ID nello storico)
                        // L'algoritmo ideale salverebbe locationId nello storico appuntamenti.
                        // Qui usiamo una mappa inversa o assumiamo che locationName sia univoco.
                        // Per robustezza, cerchiamo tra tutte le location
                        let matchedLocId = '';
                        for (const [id, info] of locationInfoMap.entries()) {
                            if (info.name === app.locationName) {
                                matchedLocId = id;
                                break;
                            }
                        }

                        if (matchedLocId && profitByLocation[matchedLocId]) {
                            profitByLocation[matchedLocId].revenue += unitValue;
                        }
                    }
                });
            }
        });

        // 2. CALCOLO COSTI DIRETTI (Affitti, etc) - Da Transazioni
        activeTransactions.forEach(t => {
            if (t.type === TransactionType.Expense) {
                if (t.allocationType === 'location' && t.allocationId && profitByLocation[t.allocationId]) {
                    profitByLocation[t.allocationId].cost += t.amount;
                }
            }
        });

        // 3. CALCOLO COSTI LOGISTICI (Viaggi)
        // Basato su lezioni passate (consumate o anche solo programmate ma passate?)
        // Usiamo lezioni 'Present' per coerenza con i ricavi
        const tripSet = new Set<string>(); // "YYYY-MM-DD|LOC_ID"
        
        enrollments.forEach(enr => {
            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    if (app.status === 'Present') {
                        const dateKey = app.date.split('T')[0];
                        // Trova location id
                        let matchedLocId = '';
                        for (const [id, info] of locationInfoMap.entries()) {
                            if (info.name === app.locationName) {
                                matchedLocId = id;
                                break;
                            }
                        }
                        if (matchedLocId) {
                            tripSet.add(`${dateKey}|${matchedLocId}`);
                        }
                    }
                });
            }
        });

        const carConsumption = companyInfo?.carFuelConsumption || 16.5; 
        const maintenanceCostPerKm = 0.10; 

        tripSet.forEach(key => {
            const [_, locId] = key.split('|');
            const locInfo = locationInfoMap.get(locId);
            if (locInfo && profitByLocation[locId]) {
                const roundTripKm = locInfo.distance * 2;
                const fuelCost = (roundTripKm / carConsumption) * fuelPrice;
                const wearCost = roundTripKm * maintenanceCostPerKm;
                
                profitByLocation[locId].trips += 1;
                profitByLocation[locId].cost += (fuelCost + wearCost);
            }
        });

        return { profitByLocation, locationInfoMap };
    }, [activeTransactions, enrollments, suppliers, companyInfo, fuelPrice]);


    // --- HANDLERS (Unchanged) ---
    const handleSaveTransaction = async (t: TransactionInput | Transaction) => {
        if ('id' in t) await updateTransaction(t.id, t); else await addTransaction(t);
        setIsTransModalOpen(false); fetchAllData();
    };
    const handleSaveDoc = async (d: any) => {
        if (docType === 'invoice') { if(d.id) await updateInvoice(d.id, d); else await addInvoice(d); }
        else { if(d.id) await updateQuote(d.id, d); else await addQuote(d); }
        setIsDocModalOpen(false); fetchAllData();
    };
    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        if (itemToDelete.type === 'transaction') await deleteTransaction(itemToDelete.id);
        else if (itemToDelete.type === 'invoice') await deleteInvoice(itemToDelete.id);
        else await deleteQuote(itemToDelete.id);
        setItemToDelete(null); fetchAllData();
    };

    const toggleInvoiceSelection = (id: string) => {
        setSelectedInvoiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSendToAccountant = (method: 'email' | 'whatsapp') => {
        const selected = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
        if (selected.length === 0) return;
        let message = `Ciao Simona,\necco l'elenco delle fatture emesse:\n\n`;
        selected.forEach(inv => {
            const sdi = inv.sdiCode ? ` (SDI: ${inv.sdiCode})` : '';
            message += `- ${inv.invoiceNumber} del ${new Date(inv.issueDate).toLocaleDateString()} - ${inv.clientName}${sdi}\n`;
        });
        message += `\nTotale documenti: ${selected.length}`;
        if (method === 'email') {
            const subject = encodeURIComponent("Invio Tabulato Fatture - Easy Peasy");
            const body = encodeURIComponent(message);
            window.location.href = `mailto:commercialista@example.com?subject=${subject}&body=${body}`;
        } else {
            const encodedMsg = encodeURIComponent(message);
            window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
        }
    };

    const handlePrintDocument = (doc: Invoice | Quote, type: 'Fattura' | 'Preventivo') => {
        const client = clients.find(c => c.id === doc.clientId);
        generateDocumentPDF(doc, type, companyInfo, client);
    };

    const handleConvertQuote = async (quote: Quote) => {
        setLoading(true);
        try {
            const invoiceData: InvoiceInput = {
                clientId: quote.clientId,
                clientName: quote.clientName,
                issueDate: new Date().toISOString(),
                dueDate: new Date().toISOString(), 
                status: DocumentStatus.Draft,
                paymentMethod: quote.paymentMethod,
                items: quote.items,
                totalAmount: quote.totalAmount,
                notes: quote.notes,
                invoiceNumber: '',
                relatedQuoteNumber: quote.quoteNumber
            };
            await addInvoice(invoiceData);
            await updateQuoteStatus(quote.id, DocumentStatus.Converted);
            alert("Preventivo convertito in Fattura (Bozza)!");
            fetchAllData();
        } catch (err) { console.error(err); alert("Errore conversione."); } finally { setLoading(false); }
    };


    // --- CHARTS EFFECTS ---
    useEffect(() => {
        if (activeTab === 'dashboard') {
            if (monthlyChartRef.current) {
                const ctx = monthlyChartRef.current.getContext('2d');
                if (ctx) {
                    if(chartInstances.current['monthly']) chartInstances.current['monthly'].destroy();
                    chartInstances.current['monthly'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                            datasets: [
                                { label: 'Entrate', data: metrics.monthlyRevenue, backgroundColor: '#4ade80', borderRadius: 4 },
                                { label: 'Uscite', data: metrics.monthlyExpenses, backgroundColor: '#f87171', borderRadius: 4 }
                            ]
                        },
                        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { display: false } } }
                    });
                }
            }
            if (expenseDoughnutRef.current) {
                const ctx = expenseDoughnutRef.current.getContext('2d');
                if (ctx) {
                    const categories = Object.keys(metrics.expensesByCategory);
                    const values = Object.values(metrics.expensesByCategory);
                    if(chartInstances.current['expenses']) chartInstances.current['expenses'].destroy();
                    chartInstances.current['expenses'] = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: categories,
                            datasets: [{
                                data: values,
                                backgroundColor: ['#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399', '#f472b6'],
                                borderWidth: 0
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } } } }
                    });
                }
            }
            if (trendLineRef.current) {
                const ctx = trendLineRef.current.getContext('2d');
                if (ctx) {
                    let cumulative = 0;
                    const trendData = metrics.monthlyRevenue.map((inc, i) => { cumulative += (inc - metrics.monthlyExpenses[i]); return cumulative; });
                    if(chartInstances.current['trend']) chartInstances.current['trend'].destroy();
                    chartInstances.current['trend'] = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
                            datasets: [{
                                label: 'Flusso di Cassa Cumulativo',
                                data: trendData,
                                borderColor: '#6366f1',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { display: true } } } }
                    });
                }
            }
        }
        return () => { Object.values(chartInstances.current).forEach((c: any) => c?.destroy()); };
    }, [activeTab, metrics]);

    useEffect(() => {
        if (activeTab === 'controlling' && taxPieRef.current) {
            const ctx = taxPieRef.current.getContext('2d');
            if (ctx) {
                const taxable = metrics.totalRevenueYTD * (profitabilityCoeff / 100);
                const tax = taxable * (taxRate / 100);
                const inps = taxable * (inpsRate / 100);
                const realNet = metrics.totalRevenueYTD - (tax + inps + metrics.totalExpensesYTD);
                const expenses = metrics.totalExpensesYTD;
                if(chartInstances.current['taxPie']) chartInstances.current['taxPie'].destroy();
                chartInstances.current['taxPie'] = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: ['Netto Reale', 'Tasse & INPS', 'Spese Operative'],
                        datasets: [{
                            data: [realNet, tax + inps, expenses],
                            backgroundColor: ['#4ade80', '#fb923c', '#f87171'],
                            borderWidth: 1
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }
    }, [activeTab, metrics, taxRate, inpsRate, profitabilityCoeff]);


    return (
        <div className="pb-24">
            <h1 className="text-3xl font-bold mb-2">Finanza</h1>
            <p className="text-gray-500 mb-6">CFO Dashboard, Simulator & Controlling.</p>

            <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide">
                {[{id: 'dashboard', label: 'Dashboard'}, {id: 'simulator', label: 'CFO Simulator'}, {id: 'controlling', label: 'Controlling'}, {id: 'transactions', label: 'Transazioni'}, {id: 'invoices', label: 'Fatture'}, {id: 'quotes', label: 'Preventivi'}].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as Tab)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}>{t.label}</button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="Fatturato YTD" explanation="Year To Date: Totale ricavi da inizio anno solare ad oggi." value={metrics.totalRevenueYTD.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} color="#4ade80" subtext={`Proiezione annua: ${metrics.projectedAnnualRevenue.toLocaleString()}€`} />
                            <StatCard title="Spese YTD" explanation="Year To Date: Totale spese sostenute da inizio anno ad oggi." value={metrics.totalExpensesYTD.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} color="#f87171" subtext={`Media mensile: ${metrics.avgMonthlyExpenses.toLocaleString('it-IT', {maximumFractionDigits:0})}€`} />
                            <StatCard title="Utile Lordo" explanation="Differenza secca tra Incassato e Speso (prima delle tasse)." value={(metrics.totalRevenueYTD - metrics.totalExpensesYTD).toLocaleString('it-IT', {style:'currency', currency:'EUR'})} color="#6366f1" />
                            <StatCard title="Margine Operativo" explanation="Percentuale di guadagno su ogni euro incassato." value={`${metrics.totalRevenueYTD > 0 ? ((metrics.totalRevenueYTD - metrics.totalExpensesYTD)/metrics.totalRevenueYTD * 100).toFixed(1) : 0}%`} color="#f59e0b" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="md-card p-4 h-80"><h3 className="font-bold text-gray-700 mb-4">Entrate vs Uscite (Mensile)</h3><canvas ref={monthlyChartRef} /></div>
                            <div className="md-card p-4 h-80"><h3 className="font-bold text-gray-700 mb-4">Ripartizione Spese</h3><div className="h-64">{Object.keys(metrics.expensesByCategory).length > 0 ? <canvas ref={expenseDoughnutRef} /> : <div className="flex h-full items-center justify-center text-gray-400">Nessuna spesa registrata</div>}</div></div>
                            <div className="md-card p-4 h-80 lg:col-span-2"><h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUpIcon /> Trend Flusso di Cassa (Cumulativo)</h3><canvas ref={trendLineRef} /></div>
                        </div>
                    </div>
                )}

                {activeTab === 'simulator' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="md-card p-6 bg-gradient-to-br from-slate-800 to-indigo-900 text-white shadow-xl">
                            <div className="flex items-center gap-2 mb-6"><SparklesIcon /><h2 className="text-2xl font-bold">Simulatore Obiettivi CFO</h2></div>
                            <div className="mb-8">
                                <label className="block text-indigo-200 text-sm font-bold mb-2">Obiettivo Guadagno Netto Mensile (Pulito in tasca)</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-4"><input type="range" min="1000" max="10000" step="100" value={targetNetProfit} onChange={e => setTargetNetProfit(Number(e.target.value))} className="w-full h-2 bg-indigo-500 rounded-lg appearance-none cursor-pointer" list="salary-markers" /><span className="text-3xl font-bold font-mono text-white min-w-[120px]">{targetNetProfit.toLocaleString()}€</span></div>
                                    <datalist id="salary-markers" className="flex justify-between w-full text-xs text-indigo-300 font-mono"><option value="1000" label="1k"></option><option value="2000"></option><option value="3000"></option><option value="4000"></option><option value="5000" label="5k"></option><option value="6000"></option><option value="7000"></option><option value="8000"></option><option value="9000"></option><option value="10000" label="10k"></option></datalist>
                                    <div className="flex justify-between text-xs text-indigo-400 font-bold px-1"><span>1.000€</span><span>10.000€</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                                <div><h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-2">Analisi Gap</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Fatturato Mensile Attuale:</span><span className="font-mono">{metrics.avgMonthlyRevenue.toLocaleString()}€</span></div><div className="flex justify-between text-yellow-300 font-bold"><span>Fatturato Necessario:</span><span className="font-mono">{simulation.requiredGrossRevenue.toLocaleString('it-IT', {maximumFractionDigits:0})}€</span></div><div className="h-px bg-white/20 my-2"></div><div className="flex justify-between text-red-300"><span>GAP Mensile:</span><span className="font-mono">{simulation.currentGap > 0 ? `-${simulation.currentGap.toLocaleString('it-IT', {maximumFractionDigits:0})}€` : 'Obiettivo Raggiunto!'}</span></div></div></div>
                                <div><h3 className="text-sm font-bold text-green-300 uppercase tracking-wider mb-2">Target Rapidi</h3>{simulation.currentGap > 0 ? (<ul className="space-y-2 text-sm"><li className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs">1</span><span>Trovare <strong>{simulation.newStudentsNeeded}</strong> nuovi studenti questo mese.</span></li><li className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center font-bold text-xs">2</span><span>Alzare i prezzi del <strong>{((simulation.currentGap / metrics.avgMonthlyRevenue)*100).toFixed(1)}%</strong>.</span></li></ul>) : (<div className="text-center py-4 text-green-300 font-bold text-lg">Complimenti! Sei in target. 🚀</div>)}</div>
                            </div>
                        </div>
                        {simulation.currentGap > 0 && (<div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="md-card p-5 border-t-4 border-amber-500 bg-amber-50/50"><h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><RocketIcon /> Azioni Urgenti (Entro 30gg)</h3><div className="space-y-3"><button onClick={() => onNavigate && onNavigate('Finance', { tab: 'invoices', invoiceStatus: 'overdue' })} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-amber-600 font-bold">•</span><span><strong>Recupero Crediti:</strong> Chiama i clienti con debiti scaduti.</span></button><button onClick={() => onNavigate && onNavigate('CRM', { tab: 'overview' })} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-amber-600 font-bold">•</span><span><strong>Upsell Immediato:</strong> Proponi rinnovi ai clienti in scadenza.</span></button><button onClick={() => onNavigate && onNavigate('Finance', { tab: 'transactions', category: 'OtherExpense' })} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-amber-600 font-bold">•</span><span><strong>Taglio Costi:</strong> Analizza le spese "Altro" ({metrics.expensesByCategory[TransactionCategory.OtherExpense]?.toFixed(0) || 0}€).</span></button></div></div><div className="md-card p-5 border-t-4 border-indigo-500 bg-indigo-50/50"><h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><BulbIcon /> Azioni Creative (Medio Termine)</h3><div className="space-y-3"><button onClick={() => onNavigate && onNavigate('CRM', { tab: 'campaigns' })} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-indigo-600 font-bold">•</span><span><strong>Partnership:</strong> Lancia una campagna marketing per partner locali.</span></button><button onClick={() => onNavigate && onNavigate('Settings', {})} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-indigo-600 font-bold">•</span><span><strong>Nuovo Prodotto:</strong> Crea un pacchetto "Intensivo" nel listino.</span></button><button onClick={() => onNavigate && onNavigate('Suppliers', {})} className="flex items-start gap-2 text-sm text-gray-700 hover:bg-white p-2 rounded transition-colors w-full text-left"><span className="text-indigo-600 font-bold">•</span><span><strong>Negoziazione:</strong> Rinegozia il nolo con i fornitori meno performanti.</span></button></div></div></div>)}
                    </div>
                )}

                {activeTab === 'controlling' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><BankIcon /> Controlling Fiscale (Forfettario)</h2>
                                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs"><tr><th className="p-3">Voce</th><th className="p-3 text-right">Attuale (YTD)</th><th className="p-3 text-right">Proiezione (Anno)</th></tr></thead><tbody className="divide-y divide-gray-100"><tr><td className="p-3 font-medium">Fatturato Lordo</td><td className="p-3 text-right font-bold">{metrics.totalRevenueYTD.toLocaleString()}€</td><td className="p-3 text-right font-bold text-indigo-600">{metrics.projectedAnnualRevenue.toLocaleString()}€</td></tr><tr><td className="p-3 text-gray-600">Imponibile ({profitabilityCoeff}%)</td><td className="p-3 text-right text-gray-600">{(metrics.totalRevenueYTD * profitabilityCoeff/100).toLocaleString()}€</td><td className="p-3 text-right text-gray-600">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100).toLocaleString()}€</td></tr><tr className="bg-red-50"><td className="p-3 font-medium text-red-800">Imposta Sostitutiva ({taxRate}%)</td><td className="p-3 text-right text-red-800">{(metrics.totalRevenueYTD * profitabilityCoeff/100 * taxRate/100).toLocaleString()}€</td><td className="p-3 text-right text-red-800 font-bold">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100 * taxRate/100).toLocaleString()}€</td></tr><tr className="bg-orange-50"><td className="p-3 font-medium text-orange-800">INPS ({inpsRate}%)</td><td className="p-3 text-right text-orange-800">{(metrics.totalRevenueYTD * profitabilityCoeff/100 * inpsRate/100).toLocaleString()}€</td><td className="p-3 text-right text-orange-800 font-bold">{(metrics.projectedAnnualRevenue * profitabilityCoeff/100 * inpsRate/100).toLocaleString()}€</td></tr><tr className="bg-gray-100 border-t border-gray-200"><td className="p-3 font-bold text-gray-700">TOTALE TASSE + INPS</td><td className="p-3 text-right font-bold text-red-600">{((metrics.totalRevenueYTD * profitabilityCoeff/100 * taxRate/100) + (metrics.totalRevenueYTD * profitabilityCoeff/100 * inpsRate/100)).toLocaleString()}€</td><td className="p-3 text-right font-bold text-red-600">{((metrics.projectedAnnualRevenue * profitabilityCoeff/100 * taxRate/100) + (metrics.projectedAnnualRevenue * profitabilityCoeff/100 * inpsRate/100)).toLocaleString()}€</td></tr><tr className="bg-green-50 border-t-2 border-green-200"><td className="p-3 font-bold text-green-900">NETTO REALE STIMATO</td><td className="p-3 text-right font-bold text-green-900">{(metrics.totalRevenueYTD - (metrics.totalRevenueYTD * profitabilityCoeff/100 * (taxRate+inpsRate)/100)).toLocaleString()}€</td><td className="p-3 text-right font-bold text-green-900 text-lg">{(metrics.projectedAnnualRevenue - (metrics.projectedAnnualRevenue * profitabilityCoeff/100 * (taxRate+inpsRate)/100)).toLocaleString()}€</td></tr></tbody></table></div>
                                
                                {/* --- NUOVA SEZIONE: Scadenziario Fiscale (Flussi di Cassa Anno Successivo) --- */}
                                <div className="mt-6 border-t pt-4">
                                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                        <CalendarIcon /> Scadenziario Fiscale (Stima Anno Successivo)
                                    </h3>
                                    
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800 mb-4">
                                        <strong>⚠️ Attenzione (1° Anno Attività):</strong> L'importo da versare l'anno prossimo sarà doppio. Pagherai il saldo dell'anno corrente + l'acconto (100% dell'anno corrente) per l'anno successivo.
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* SCADENZA GIUGNO */}
                                        <div className="border border-indigo-100 rounded-lg bg-indigo-50 p-3 relative">
                                            <span className="absolute top-2 right-2 text-[10px] font-bold bg-white text-indigo-600 px-2 py-0.5 rounded border border-indigo-200">GIUGNO</span>
                                            <div className="text-xs text-indigo-700 font-bold uppercase mb-1">Saldo + I° Acconto</div>
                                            <div className="text-xl font-bold text-indigo-900 mb-2">{fiscalSchedule.firstInstallmentJune.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}</div>
                                            
                                            {/* Dettaglio Rateizzazione */}
                                            <div className="mt-2 pt-2 border-t border-indigo-200">
                                                <div className="text-[10px] text-indigo-600 font-medium mb-1">Oppure 6 rate mensili (con interessi):</div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span>~ {fiscalSchedule.monthlyInstallmentBase.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} / mese</span>
                                                    <span className="text-[9px] text-gray-500">(Giu - Nov)</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SCADENZA NOVEMBRE */}
                                        <div className="border border-red-100 rounded-lg bg-red-50 p-3 relative">
                                            <span className="absolute top-2 right-2 text-[10px] font-bold bg-white text-red-600 px-2 py-0.5 rounded border border-red-200">NOVEMBRE</span>
                                            <div className="text-xs text-red-700 font-bold uppercase mb-1">II° Acconto</div>
                                            <div className="text-xl font-bold text-red-900 mb-2">{fiscalSchedule.secondInstallmentNov.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}</div>
                                            <div className="mt-2 pt-2 border-t border-red-200">
                                                <div className="text-[10px] text-red-600 font-medium italic">Non rateizzabile.</div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 text-center italic">* Stime basate sul fatturato proiettato. Gli importi rateizzati includono stima interessi.</p>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center"><h3 className="font-bold text-gray-700 mb-4">Dove vanno i tuoi soldi?</h3><div className="w-full h-64"><canvas ref={taxPieRef} /></div></div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-indigo-500">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><CalculatorIcon /> Logistica & Profittabilità Sedi</h2>
                                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200">Basato su Slot Consumati</span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center bg-gray-50 p-3 rounded">
                                <div><div className="text-xs text-gray-500">Costo Carburante</div><input type="number" step="0.01" value={fuelPrice} onChange={e => setFuelPrice(Number(e.target.value))} className="w-16 p-1 text-center font-bold border rounded" /></div>
                                <div><div className="text-xs text-gray-500">Consumo Veicolo</div><div className="font-bold text-gray-800">{companyInfo?.carFuelConsumption || 16.5} km/l</div></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {Object.entries(logisticsData.profitByLocation).map(([locId, data]) => {
                                    const typedData = data as { revenue: number, cost: number, trips: number, distance: number };
                                    const locInfo = logisticsData.locationInfoMap.get(locId);
                                    const profit = typedData.revenue - typedData.cost;
                                    const margin = typedData.revenue > 0 ? (profit / typedData.revenue) * 100 : 0;
                                    return (
                                        <div key={locId} className="border rounded p-4 relative overflow-hidden">
                                            <h4 className="font-bold text-gray-800">{locInfo?.name || 'Sconosciuta'}</h4>
                                            <div className="text-xs text-gray-500 mb-2">{typedData.trips} Viaggi a/r • {locInfo?.distance}km dist.</div>
                                            <div className="flex justify-between text-sm"><span className="text-green-600">Generato: {typedData.revenue.toFixed(0)}€</span><span className="text-red-500">Costi: {typedData.cost.toFixed(0)}€</span></div>
                                            <div className="mt-2 font-bold text-right" style={{color: profit > 0 ? 'green' : 'red'}}>Utile: {profit.toFixed(0)}€ ({margin.toFixed(0)}%)</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {(activeTab === 'transactions' || activeTab === 'invoices' || activeTab === 'quotes') && (
                    <div className="animate-slide-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
                            <button onClick={() => { if(activeTab === 'transactions') { setEditingTransaction(null); setIsTransModalOpen(true); } else { setDocType(activeTab === 'invoices' ? 'invoice' : 'quote'); setEditingDoc(null); setIsDocModalOpen(true); } }} className="md-btn md-btn-raised md-btn-primary md-btn-sm flex items-center"><PlusIcon /><span className="ml-2">Nuova</span></button>
                        </div>
                        {activeTab === 'invoices' && selectedInvoiceIds.length > 0 && (<div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg mb-4 flex items-center justify-between animate-fade-in"><span className="text-sm text-indigo-800 font-medium">{selectedInvoiceIds.length} fatture selezionate</span><div className="flex gap-2"><button onClick={() => handleSendToAccountant('email')} className="md-btn md-btn-sm bg-white border shadow-sm text-gray-700 flex items-center">📧 Email Commercialista</button><button onClick={() => handleSendToAccountant('whatsapp')} className="md-btn md-btn-sm bg-green-500 text-white shadow-sm flex items-center hover:bg-green-600"><ShareIcon /><span className="ml-1">WhatsApp</span></button></div></div>)}
                        <div className="md-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b"><tr>{activeTab === 'invoices' && <th className="p-3 w-8"></th>}<th className="p-3">Data</th><th className="p-3">Descrizione / Cliente</th><th className="p-3 text-right">Importo</th><th className="p-3 text-center">Stato</th><th className="p-3 text-right">Azioni</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {activeTab === 'transactions' && transactions.slice(0, 15).map(t => (<tr key={t.id}><td className="p-3">{new Date(t.date).toLocaleDateString()}</td><td className="p-3 font-medium">{t.description}</td><td className={`p-3 text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{t.amount}€</td><td className="p-3 text-center"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{t.status}</span></td><td className="p-3 text-right"><button onClick={() => { setEditingTransaction(t); setIsTransModalOpen(true); }} className="text-blue-600 mx-1"><PencilIcon /></button><button onClick={() => setItemToDelete({id: t.id, type: 'transaction'})} className="text-red-600 mx-1"><TrashIcon /></button></td></tr>))}
                                        {activeTab === 'invoices' && invoices.slice(0, 15).map(i => (<tr key={i.id} className={selectedInvoiceIds.includes(i.id) ? 'bg-indigo-50' : ''}><td className="p-3 text-center"><input type="checkbox" checked={selectedInvoiceIds.includes(i.id)} onChange={() => toggleInvoiceSelection(i.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></td><td className="p-3">{new Date(i.issueDate).toLocaleDateString()}</td><td className="p-3 font-medium">{i.invoiceNumber} - {i.clientName}</td><td className="p-3 text-right font-bold">{i.totalAmount}€</td><td className="p-3 text-center"><span className={`px-2 py-1 rounded text-xs ${i.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{i.status}</span></td><td className="p-3 text-right flex justify-end gap-1"><button onClick={() => handlePrintDocument(i, 'Fattura')} className="md-icon-btn text-gray-600 hover:text-indigo-600" title="Stampa PDF"><PrinterIcon /></button><button onClick={() => { setDocType('invoice'); setEditingDoc(i); setIsDocModalOpen(true); }} className="md-icon-btn text-blue-600 hover:bg-blue-50"><PencilIcon /></button><button onClick={() => setItemToDelete({id: i.id, type: 'invoice'})} className="md-icon-btn text-red-600 hover:bg-red-50"><TrashIcon /></button></td></tr>))}
                                        {activeTab === 'quotes' && quotes.slice(0, 15).map(q => (<tr key={q.id}><td className="p-3">{new Date(q.issueDate).toLocaleDateString()}</td><td className="p-3 font-medium">{q.quoteNumber} - {q.clientName}</td><td className="p-3 text-right font-bold">{q.totalAmount}€</td><td className="p-3 text-center"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{q.status}</span></td><td className="p-3 text-right flex justify-end gap-1">{q.status !== DocumentStatus.Converted && (<button onClick={() => handleConvertQuote(q)} className="md-icon-btn text-green-600 hover:bg-green-50" title="Converti in Fattura"><DocumentCheckIcon /></button>)}<button onClick={() => handlePrintDocument(q, 'Preventivo')} className="md-icon-btn text-gray-600 hover:text-indigo-600" title="Stampa PDF"><PrinterIcon /></button><button onClick={() => { setDocType('quote'); setEditingDoc(q); setIsDocModalOpen(true); }} className="md-icon-btn text-blue-600 hover:bg-blue-50"><PencilIcon /></button><button onClick={() => setItemToDelete({id: q.id, type: 'quote'})} className="md-icon-btn text-red-600 hover:bg-red-50"><TrashIcon /></button></td></tr>))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}

            {isTransModalOpen && <Modal onClose={() => setIsTransModalOpen(false)}><TransactionForm transaction={editingTransaction} onSave={handleSaveTransaction} onCancel={() => setIsTransModalOpen(false)} /></Modal>}
            {isDocModalOpen && <Modal onClose={() => setIsDocModalOpen(false)} size="lg"><DocumentForm doc={editingDoc} type={docType} clients={clients} onSave={handleSaveDoc} onCancel={() => setIsDocModalOpen(false)} /></Modal>}
            <ConfirmModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirm} title="Elimina Elemento" message="Sei sicuro di voler eliminare questo elemento?" isDangerous={true} />
        </div>
    );
};

export default Finance;
