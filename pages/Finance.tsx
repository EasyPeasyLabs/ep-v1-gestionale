
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput, Lesson, IntegrityIssue } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, syncRentExpenses, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice, reconcileTransactions, runFinancialHealthCheck, fixIntegrityIssue } from '../services/financeService';
import { getSuppliers } from '../services/supplierService';
import { getCompanyInfo } from '../services/settingsService';
import { getClients } from '../services/parentService';
import { getLessons } from '../services/calendarService'; // Import added
import { generateDocumentPDF } from '../utils/pdfGenerator';
import { exportTransactionsToExcel, exportInvoicesToExcel } from '../utils/financeExport';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import RefreshIcon from '../components/icons/RestoreIcon';
import TransactionForm from '../components/finance/TransactionForm';
import InvoiceEditForm from '../components/finance/InvoiceEditForm';
import QuoteForm from '../components/finance/QuoteForm';
import FinanceOverview from '../components/finance/FinanceOverview';
import FinanceCFO from '../components/finance/FinanceCFO';
import FinanceControlling from '../components/finance/FinanceControlling';
import FinanceListView from '../components/finance/FinanceListView';
import FiscalYearManager from '../components/finance/FiscalYearManager'; 
import LocationDetailModal from '../components/finance/LocationDetailModal';
import { getAllEnrollments, getActiveLocationForClient } from '../services/enrollmentService';
import { Enrollment, PaymentMethod, TransactionStatus } from '../types';

// ... (COSTANTI FISCALI e Interfacce rimangono uguali) ...
const INPS_RATE = 0.2623;
const TAX_RATE_STARTUP = 0.05;
const COEFF_REDDITIVITA = 0.78;
const LIMIT_FORFETTARIO = 85000;

interface FinanceProps {
    initialParams?: {
        tab?: 'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure';
        searchTerm?: string;
    };
    onNavigate?: (page: Page, params?: any) => void;
}

// --- HELPER MACRO CATEGORIE ---
const getMacroCategory = (cat: TransactionCategory): 'Logistica' | 'Generali' | 'Operazioni' | 'Altro' => {
    // Mantiene compatibilità con stringhe legacy per transazioni vecchie
    switch (cat) {
        case TransactionCategory.RCA:
        case TransactionCategory.BolloAuto:
        case TransactionCategory.ManutenzioneAuto:
        case TransactionCategory.ConsumoAuto:
        case TransactionCategory.Carburante:
        case TransactionCategory.Parcheggio:
        case TransactionCategory.Sanzioni:
        case TransactionCategory.BigliettoViaggio:
            return 'Logistica';
        
        case TransactionCategory.Consulenze:
        case TransactionCategory.Tasse:
        case TransactionCategory.SpeseBancarie:
        case 'Abbonamento Fibra' as any: // Legacy
        case 'Abbonamento SIM' as any: // Legacy
        case TransactionCategory.InternetTelefonia:
        case TransactionCategory.Formazione:
        case TransactionCategory.Software:
        case TransactionCategory.HardwareGenerale:
        case TransactionCategory.Vendite:
        case TransactionCategory.Capitale:
            return 'Generali';

        case TransactionCategory.Nolo:
        case TransactionCategory.QuoteAssociative:
        case TransactionCategory.AttrezzatureSede:
        case TransactionCategory.IgieneSicurezza:
        case TransactionCategory.Materiali:
        case TransactionCategory.Libri:
        case TransactionCategory.HardwareSoftwareCorsi:
        case TransactionCategory.Stampa:
        case TransactionCategory.Social:
            return 'Operazioni';
            
        default:
            return 'Altro';
    }
};

const Finance: React.FC<FinanceProps> = ({ initialParams, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'cfo' | 'controlling' | 'transactions' | 'invoices' | 'archive' | 'quotes' | 'fiscal_closure'>('overview');
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [manualLessons, setManualLessons] = useState<Lesson[]>([]); // New state
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const [targetMonthlyNet, setTargetMonthlyNet] = useState(3000);
    const [lessonPrice, setLessonPrice] = useState(25);

    // Stato per l'anno di analisi del Controllo di Gestione (Default: Anno Corrente o 2025)
    const [controllingYear, setControllingYear] = useState<number>(Math.max(2025, new Date().getFullYear()));

    const [isSealModalOpen, setIsSealModalOpen] = useState(false);
    const [invoiceToSeal, setInvoiceToSeal] = useState<Invoice | null>(null);
    const [sdiId, setSdiId] = useState('');
    const [filters, setFilters] = useState({ search: '' });

    const [selectedLocationROI, setSelectedLocationROI] = useState<{
        name: string, 
        color: string, 
        revenue: number, 
        costs: number, 
        costPerLesson: { value: number, min: number, max: number, avg: number }, 
        costPerStudentPerLesson: number, // NEW
        costPerStudent: number, 
        breakdown: { rent: number, logistics: number, overhead: number } 
    } | null>(null);

    // --- INTEGRITY CHECK STATE ---
    const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
    const [isFixWizardOpen, setIsFixWizardOpen] = useState(false);

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);

    // ... (fetchData e useEffect uguali) ...
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [t, i, q, e, s, c, ml, info, issues] = await Promise.all([
                getTransactions(), 
                getInvoices(), 
                getQuotes(), 
                getAllEnrollments(), 
                getSuppliers(), 
                getClients(), 
                getLessons(), 
                getCompanyInfo(),
                runFinancialHealthCheck() // New Diagnostic
            ]);
            setTransactions(t); 
            setInvoices(i); 
            setQuotes(q); 
            setEnrollments(e); 
            setSuppliers(s); 
            setClients(c); 
            setManualLessons(ml); 
            setCompanyInfo(info);
            setIntegrityIssues(issues);
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
                const resultMsg = await syncRentExpenses();
                await fetchData();
                alert(resultMsg);
            } catch (e) {
                console.error(e);
                alert("Errore durante la sincronizzazione.");
            } finally {
                setLoading(false);
            }
        }
    };

    // --- NUOVA LOGICA FULL SYNC (Riconciliazione) ---
    const handleFullSync = async () => {
        setLoading(true);
        try {
            const resultMsg = await reconcileTransactions();
            await fetchData();
            alert(resultMsg);
        } catch (e) {
            console.error(e);
            alert("Errore durante la sincronizzazione globale.");
        } finally {
            setLoading(false);
        }
    };

    // --- FIX WIZARD HANDLER ---
    const handleFixIssue = async (issue: IntegrityIssue) => {
        setLoading(true);
        try {
            await fixIntegrityIssue(issue);
            // Refresh list
            const remainingIssues = await runFinancialHealthCheck();
            setIntegrityIssues(remainingIssues);
            
            // Re-fetch standard data to update UI
            await fetchData();
            
            if (remainingIssues.length === 0) {
                setIsFixWizardOpen(false);
                alert("Ottimo! Tutte le anomalie sono state risolte.");
            }
        } catch (e: any) {
            alert("Errore durante la correzione automatica: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ENGINE ANALITICO ---
    const stats = useMemo(() => {
        const activeT = transactions.filter(t => !t.isDeleted);
        // Ricavi: Income e NON Capital
        const revenue = activeT.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).reduce((acc, t) => acc + t.amount, 0);
        const expenses = activeT.filter(t => t.type === TransactionType.Expense).reduce((acc, t) => acc + t.amount, 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        // Fiscale
        const taxable = revenue * COEFF_REDDITIVITA;
        const inps = taxable * INPS_RATE;
        const tax = taxable * TAX_RATE_STARTUP;
        
        // Calcolo Bolli
        let stampDutyTotal = 0;
        const stampDutyQuarters = { q1: 0, q2: 0, q3: 0, q4: 0 };
        
        invoices.forEach(inv => {
            if (!inv.isDeleted && !inv.isGhost && inv.totalAmount > 77.47) {
                stampDutyTotal += 2;
                const d = new Date(inv.issueDate);
                const m = d.getMonth(); 
                if (m < 3) stampDutyQuarters.q1 += 2; 
                else if (m < 6) stampDutyQuarters.q2 += 2; 
                else if (m < 9) stampDutyQuarters.q3 += 2; 
                else stampDutyQuarters.q4 += 2; 
            }
        });

        // Totali Combinati
        const totalInpsTax = inps + tax;
        const totalAll = totalInpsTax + stampDutyTotal;
        const totalLoadStartup = (totalInpsTax * 2) + stampDutyTotal;
        const savingsSuggestion = totalLoadStartup;

        // Proiezioni Mensili
        const monthlyData = Array(12).fill(0).map((_, i) => {
            const monthTrans = activeT.filter(t => new Date(t.date).getMonth() === i);
            const monthRev = monthTrans.filter(t => 
                t.type === TransactionType.Income && 
                t.category !== TransactionCategory.Capitale
            ).reduce((acc, t) => acc + t.amount, 0);

            const monthExp = monthTrans.filter(t => 
                t.type === TransactionType.Expense
            ).reduce((acc, t) => acc + t.amount, 0);

            const mTaxable = monthRev * COEFF_REDDITIVITA;
            
            return { 
                month: i, 
                revenue: monthRev, 
                expenses: monthExp, 
                inps: mTaxable * INPS_RATE, 
                tax: mTaxable * TAX_RATE_STARTUP 
            };
        });

        return { 
            revenue, expenses, profit, margin, 
            taxable, inps, tax, stampDutyTotal, stampDutyQuarters,
            totalInpsTax, totalAll, 
            savingsSuggestion, monthlyData, progress: (revenue / LIMIT_FORFETTARIO) * 100 
        };
    }, [transactions, invoices]);

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

        return { annualNetTarget, grossNeeded, gap, extraLessonsNeeded, studentsNeeded };
    }, [targetMonthlyNet, lessonPrice, stats.revenue]);

    const simulatorData = useMemo(() => {
        const tax2025 = stats.totalInpsTax; // Tassa calcolata sull'anno corrente
        
        const tranche1 = tax2025 * 1.5; 
        const tranche2 = tax2025 * 0.5;
        const monthlyInstallment = tranche1 / 6; // Rateizzabile Giu-Nov

        const stampDeadlines = [
            { label: '31 Mag (I Trim)', amount: stats.stampDutyQuarters.q1, month: 'MAG' }, 
            { label: '30 Set (II Trim)', amount: stats.stampDutyQuarters.q2, month: 'SET' },
            { label: '30 Nov (III Trim)', amount: stats.stampDutyQuarters.q3, month: 'NOV' },
            { label: '28 Feb (IV Trim)', amount: stats.stampDutyQuarters.q4, month: 'FEB' },
        ];

        const months = ['GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV'];
        const savingsPlan = months.map(m => {
            let amount = monthlyInstallment;
            const stamp = stampDeadlines.find(s => s.month === m);
            if (stamp) amount += stamp.amount;
            if (m === 'NOV') amount += tranche2;
            return { month: m, amount };
        });

        const saldoFinaleTarget = tranche2; 

        return { tranche1, tranche2, monthlyInstallment, stampDeadlines, savingsPlan, saldoFinaleTarget };
    }, [stats]);

    const roiSedi = useMemo(() => {
        // --- CONTROLLO DI GESTIONE ENTERPRISE ---
        // Algoritmo: Full Costing con Driver specifici per Logistica e Overhead.
        const targetYear = controllingYear;
        
        // 1. PREPARAZIONE DATI GREZZI
        const yearTransactions = transactions.filter(t => 
            !t.isDeleted && new Date(t.date).getFullYear() === targetYear
        );

        // Mappa ID Location -> Info Sede
        const locationsMap = new Map<string, {name: string, color: string, distance: number}>();
        suppliers.forEach(s => {
            s.locations.forEach(l => locationsMap.set(l.id, { name: l.name, color: l.color, distance: l.distance || 0 }));
        });

        // 2. AGGREGAZIONE METRICHE OPERATIVE (DRIVERS)
        // Calcoliamo i driver per l'allocazione: Viaggi (per Logistica) e Studenti (per Overhead)
        const locStats: Record<string, { revenue: number, trips: number, students: number }> = {};
        
        // Init
        locationsMap.forEach((_, id) => {
            locStats[id] = { revenue: 0, trips: 0, students: 0 };
        });

        // A. Revenue Diretta per Sede
        yearTransactions.filter(t => t.type === TransactionType.Income && t.category !== TransactionCategory.Capitale).forEach(t => {
            if (t.allocationId && locStats[t.allocationId]) {
                locStats[t.allocationId].revenue += t.amount;
            }
        });
        const totalGlobalRevenue = Object.values(locStats).reduce((acc, curr) => acc + curr.revenue, 0);

        // B. Studenti Attivi per Sede
        enrollments.forEach(enr => {
            if ((enr.status === 'Active' || enr.status === 'Completed') && enr.locationId && locStats[enr.locationId]) {
                locStats[enr.locationId].students++;
            }
        });
        const totalActiveStudents = Object.values(locStats).reduce((acc, curr) => acc + curr.students, 0);

        // C. Viaggi (Aperture) per Sede
        const tripKeys = new Set<string>();
        enrollments.forEach(enr => {
            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    const d = new Date(app.date);
                    if (d.getFullYear() === targetYear) {
                        const locId = app.locationId || enr.locationId;
                        if (locId && locStats[locId]) {
                            const key = `${app.date.split('T')[0]}_${locId}`;
                            if (!tripKeys.has(key)) {
                                tripKeys.add(key);
                                locStats[locId].trips++;
                            }
                        }
                    }
                });
            }
        });
        // Aggiungi lezioni manuali
        manualLessons.forEach(ml => {
            const d = new Date(ml.date);
            if (d.getFullYear() === targetYear) {
                // Find loc ID by Name approx
                const locEntry = Array.from(locationsMap.entries()).find(([_, val]) => val.name === ml.locationName);
                if (locEntry) {
                    const [id] = locEntry;
                    const key = `${ml.date.split('T')[0]}_${id}`;
                    if (!tripKeys.has(key)) {
                        tripKeys.add(key);
                        locStats[id].trips++;
                    }
                }
            }
        });

        // 3. CALCOLO POOL DI COSTI INDIRETTI
        const yearExpenses = yearTransactions.filter(t => t.type === TransactionType.Expense);
        
        const costsByMacro = {
            logistics: yearExpenses.filter(t => getMacroCategory(t.category) === 'Logistica').reduce((s, t) => s + t.amount, 0),
            general: yearExpenses.filter(t => getMacroCategory(t.category) === 'Generali').reduce((s, t) => s + t.amount, 0),
            operationsUnallocated: yearExpenses.filter(t => getMacroCategory(t.category) === 'Operazioni' && !t.allocationId).reduce((s, t) => s + t.amount, 0)
        };

        // 4. CALCOLO TASSI DI ALLOCAZIONE (RATES)
        
        // Driver Logistica: Km Totali Percorsi (Distanza Sede * Viaggi Sede)
        let totalWeightedKm = 0;
        locationsMap.forEach((info, id) => {
            totalWeightedKm += (info.distance * locStats[id].trips);
        });
        // Costo per Km = Totale Logistica / Totale Km
        const costPerKm = totalWeightedKm > 0 ? costsByMacro.logistics / totalWeightedKm : 0;

        // Driver Overhead: Revenue Share (Capacità di spesa)
        // Overhead Rate = (Generali + Op. Indirette) / Fatturato Totale
        const totalOverheadPool = costsByMacro.general + costsByMacro.operationsUnallocated;
        const overheadRateRevenueBased = totalGlobalRevenue > 0 ? totalOverheadPool / totalGlobalRevenue : 0;

        // 5. COSTRUZIONE REPORT FINALE
        const finalData = Array.from(locationsMap.entries()).map(([id, info]) => {
            const stats = locStats[id];
            
            // A. Costi Diretti (Specifici Sede)
            const directCosts = yearExpenses
                .filter(t => t.allocationId === id && getMacroCategory(t.category) === 'Operazioni')
                .reduce((s, t) => s + t.amount, 0);

            // B. Costi Logistica Allocati (Km-Based)
            const kmTraveled = info.distance * stats.trips;
            const allocatedLogistics = kmTraveled * costPerKm;

            // C. Costi Overhead Allocati (Revenue-Based)
            // "Chi fattura di più contribuisce di più alla struttura"
            const allocatedOverhead = stats.revenue * overheadRateRevenueBased;

            const totalAllocatedCosts = directCosts + allocatedLogistics + allocatedOverhead;

            // KPI: Costo Industriale Lezione (Break-Even)
            // (Costi Diretti + Logistica) / Numero Lezioni (Viaggi)
            // Questo dice: quanto costa aprire la porta per una lezione.
            const industrialCostPerLesson = stats.trips > 0 
                ? (directCosts + allocatedLogistics) / stats.trips
                : 0;

            // KPI: Costo per Studente a Lezione (NEW)
            // Divide il costo industriale per il numero di studenti attivi
            const costPerStudentPerLesson = stats.students > 0 
                ? industrialCostPerLesson / stats.students 
                : 0;

            // KPI: Costo per Studente Totale
            const costPerStudent = stats.students > 0 ? totalAllocatedCosts / stats.students : 0;

            return {
                name: info.name,
                color: info.color,
                revenue: stats.revenue,
                costs: totalAllocatedCosts,
                studentBasedCosts: allocatedOverhead, // Quota struttura
                costPerStudent: costPerStudent,
                costPerLesson: {
                    value: industrialCostPerLesson,
                    min: industrialCostPerLesson * 0.9,
                    max: industrialCostPerLesson * 1.1,
                    avg: industrialCostPerLesson
                },
                costPerStudentPerLesson, // NEW Field
                breakdown: {
                    rent: directCosts,
                    logistics: allocatedLogistics,
                    overhead: allocatedOverhead
                },
                globalRevenue: totalGlobalRevenue
            };
        });

        // Filtra sedi inattive (senza ricavi ne costi)
        return finalData.filter(d => d.revenue > 0 || d.costs > 0).sort((a,b) => b.revenue - a.revenue);

    }, [suppliers, transactions, enrollments, manualLessons, controllingYear]); 

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
        } catch(e: any) {
            console.error(e);
            alert("Errore salvataggio transazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditItem = (item: any) => {
        if ('invoiceNumber' in item) {
            setEditingInvoice(item as Invoice);
            setIsInvoiceModalOpen(true);
        } else if ('quoteNumber' in item) {
            setEditingQuote(item as Quote);
            setIsQuoteModalOpen(true);
        } else {
            setEditingTransaction(item);
            setIsTransactionModalOpen(true);
        }
    };

    const handleSaveInvoice = async (data: InvoiceInput) => {
        if (!editingInvoice) return;
        setLoading(true);
        try {
            if (data.sdiId && data.sdiId.trim().length > 0) {
                data.status = DocumentStatus.SealedSDI;
            }
            let invoiceId = editingInvoice.id;
            
            // Variabile per catturare il numero fattura generato (se nuova)
            let finalInvoiceNumber = data.invoiceNumber;

            if (invoiceId) {
                await updateInvoice(invoiceId, data);
            } else {
                const res = await addInvoice(data);
                invoiceId = res.id;
                finalInvoiceNumber = res.invoiceNumber;
            }
            if (!editingInvoice.id && data.status !== DocumentStatus.Draft && !data.isGhost && data.totalAmount > 0) {
                let autoAllocationId = null;
                let autoAllocationName = null;
                if (data.clientId) {
                    try {
                        const activeLoc = await getActiveLocationForClient(data.clientId);
                        if (activeLoc) {
                            autoAllocationId = activeLoc.id;
                            autoAllocationName = activeLoc.name;
                        }
                    } catch (e) {
                        console.warn("Smart Link error", e);
                    }
                }
                const newTransaction: TransactionInput = {
                    date: data.issueDate,
                    // UPDATED: Use 'incasso' lowercase and ensure Rif+Soggetto
                    description: `incasso fattura n. ${finalInvoiceNumber || 'N/D'} - ${data.clientName}`,
                    amount: data.totalAmount,
                    type: TransactionType.Income,
                    category: TransactionCategory.Vendite,
                    paymentMethod: data.paymentMethod,
                    status: TransactionStatus.Completed,
                    relatedDocumentId: invoiceId,
                    clientName: data.clientName,
                    isDeleted: false,
                    allocationType: autoAllocationId ? 'location' : 'general',
                    allocationId: autoAllocationId || undefined,
                    allocationName: autoAllocationName || undefined
                };
                await addTransaction(newTransaction);
            }
            setIsInvoiceModalOpen(false);
            setEditingInvoice(null);
            await fetchData();
        } catch(e: any) {
            console.error(e);
            alert("Errore salvataggio fattura: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuote = async (data: QuoteInput | Quote) => {
        setLoading(true);
        try {
            if ('id' in data) await updateQuote(data.id, data);
            else await addQuote(data);
            setIsQuoteModalOpen(false);
            setEditingQuote(null);
            await fetchData();
        } catch(e) {
            alert("Errore salvataggio preventivo.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setTransactionToDelete(id);
    };

    const confirmDelete = async () => {
        if (transactionToDelete) {
            setLoading(true);
            try {
                if (activeTab === 'transactions') await deleteTransaction(transactionToDelete);
                else if (activeTab === 'invoices' || activeTab === 'archive') await deleteInvoice(transactionToDelete);
                else if (activeTab === 'quotes') await deleteQuote(transactionToDelete);
                await fetchData();
            } catch(e: any) { 
                console.error(e); 
                alert("Errore eliminazione: " + e.message);
            }
            finally { setLoading(false); setTransactionToDelete(null); }
        }
    };

    const handleConvertQuote = (quote: Quote) => {
        setQuoteToConvert(quote);
    };

    const processConversion = async () => {
        if (!quoteToConvert) return;
        setLoading(true);
        try {
            const invoiceId = await convertQuoteToInvoice(quoteToConvert.id);
            await fetchData();
            const updatedInvoices = await getInvoices();
            const inv = updatedInvoices.find(i => i.id === invoiceId);
            if (inv) {
                setEditingInvoice(inv);
                setIsInvoiceModalOpen(true);
            }
        } catch (e: any) {
            console.error(e);
            alert("Errore durante la conversione: " + (e.message || e));
        } finally {
            setLoading(false);
            setQuoteToConvert(null);
        }
    };

    const handleExportTransactions = () => {
        exportTransactionsToExcel(transactions, invoices);
    };

    const handleExportInvoices = () => {
        exportInvoicesToExcel(invoices);
    };

    // --- RENDER ---
    return (
        <div className="animate-fade-in pb-20">
            
            {/* FISCAL DOCTOR DIAGNOSTIC BANNER */}
            {integrityIssues.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center animate-slide-up">
                    <div className="flex items-center gap-3 mb-3 md:mb-0">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl shadow-sm">🩺</div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Fiscal Doctor: Rilevate {integrityIssues.length} Anomalie</h4>
                            <p className="text-xs text-amber-700">Ci sono disallineamenti tra Iscrizioni, Fatture e Transazioni.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsFixWizardOpen(true)}
                        className="md-btn md-btn-sm bg-amber-600 text-white hover:bg-amber-700 shadow-md font-bold px-4"
                    >
                        Risolvi Anomalie
                    </button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Finanza Enterprise</h1>
                    <p className="text-slate-500 font-medium">Controllo di gestione, fiscalità, logistica e flussi.</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <button onClick={handleSyncRents} className="md-btn md-btn-flat bg-white border border-indigo-200 text-indigo-700 shadow-sm font-bold flex items-center gap-1 hover:bg-indigo-50 flex-shrink-0"><RefreshIcon /> Sync Noli</button>
                    <button onClick={handleFullSync} className="md-btn md-btn-flat bg-white border shadow-sm flex-shrink-0"><RefreshIcon /> Sync</button>
                    <button 
                        onClick={() => {
                            if (activeTab === 'quotes') {
                                setEditingQuote(null);
                                setIsQuoteModalOpen(true);
                            } else if (activeTab === 'invoices') {
                                const newInv: any = {
                                    id: '', 
                                    invoiceNumber: '',
                                    issueDate: new Date().toISOString(),
                                    dueDate: new Date().toISOString(),
                                    clientName: '',
                                    clientId: '',
                                    items: [],
                                    totalAmount: 0,
                                    status: DocumentStatus.Draft,
                                    paymentMethod: PaymentMethod.BankTransfer,
                                    hasStampDuty: false,
                                    isGhost: false,
                                    isDeleted: false
                                };
                                setEditingInvoice(newInv);
                                setIsInvoiceModalOpen(true);
                            } else {
                                setEditingTransaction(null);
                                setIsTransactionModalOpen(true);
                            }
                        }} 
                        className="md-btn md-btn-raised md-btn-green flex-shrink-0"
                    >
                        <PlusIcon /> 
                        {activeTab === 'quotes' ? 'Nuovo Preventivo' : (activeTab === 'invoices' ? 'Nuova Fattura' : 'Nuova Voce')}
                    </button>
                </div>
            </div>

            {/* TABS (SCROLLABLE ON MOBILE) */}
            <div className="border-b border-gray-200 mb-8 -mx-4 md:mx-0">
                <nav className="flex space-x-2 overflow-x-auto scrollbar-hide px-4 md:px-0 pb-1">
                    {[
                        { id: 'overview', label: 'Panoramica' },
                        { id: 'cfo', label: 'CFO (Strategia)' },
                        { id: 'controlling', label: 'Controlling' },
                        { id: 'transactions', label: 'Transazioni' }, 
                        { id: 'invoices', label: 'Fatture' },
                        { id: 'archive', label: 'Archivio' },
                        { id: 'quotes', label: 'Preventivi' },
                        { id: 'fiscal_closure', label: '🔒 Chiusura' } 
                    ].map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => setActiveTab(t.id as any)} 
                            className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="space-y-8">
                    {activeTab === 'overview' && <FinanceOverview stats={stats} transactions={transactions} />}
                    
                    {activeTab === 'cfo' && (
                        <FinanceCFO 
                            stats={stats} 
                            simulatorData={simulatorData} 
                            reverseEngineering={reverseEngineering}
                            targetMonthlyNet={targetMonthlyNet}
                            lessonPrice={lessonPrice}
                            setTargetMonthlyNet={setTargetMonthlyNet}
                            setLessonPrice={setLessonPrice}
                        />
                    )}

                    {activeTab === 'controlling' && (
                        <FinanceControlling 
                            roiSedi={roiSedi} 
                            onSelectLocation={setSelectedLocationROI}
                            year={controllingYear}
                            onYearChange={setControllingYear}
                        />
                    )}

                    {activeTab === 'fiscal_closure' && (
                        <FiscalYearManager 
                            transactions={transactions}
                            invoices={invoices}
                        />
                    )}

                    {['transactions', 'invoices', 'archive', 'quotes'].includes(activeTab) && (
                        <FinanceListView 
                            activeTab={activeTab as any}
                            transactions={transactions}
                            invoices={invoices}
                            quotes={quotes}
                            suppliers={suppliers}
                            filters={filters}
                            setFilters={setFilters}
                            onExportTransactions={handleExportTransactions}
                            onExportInvoices={handleExportInvoices}
                            onEdit={handleEditItem}
                            onDelete={handleDelete}
                            onPrint={handlePrint}
                            onSeal={async (inv) => { 
                                const safeSdi = inv.sdiId ? String(inv.sdiId).trim() : '';
                                if (safeSdi.length > 0) {
                                    if(confirm(`Codice SDI presente (${safeSdi}). Confermi il sigillo fiscale?`)) {
                                        setLoading(true);
                                        try {
                                            await updateInvoice(inv.id, { status: DocumentStatus.SealedSDI });
                                            await fetchData();
                                            window.dispatchEvent(new Event('EP_DataUpdated'));
                                        } catch (e) {
                                            alert("Errore durante il sigillo.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }
                                } else {
                                    setInvoiceToSeal(inv); 
                                    setSdiId('');
                                    setIsSealModalOpen(true); 
                                }
                            }}
                            onWhatsApp={handleWhatsApp}
                            onConvert={activeTab === 'quotes' ? handleConvertQuote : undefined}
                        />
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

            {/* --- FIX WIZARD MODAL --- */}
            {isFixWizardOpen && (
                <Modal onClose={() => setIsFixWizardOpen(false)} size="lg">
                    <div className="flex flex-col h-[80vh]">
                        <div className="p-6 border-b bg-amber-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-amber-900">Fiscal Doctor</h3>
                                <p className="text-sm text-amber-700">Risoluzione guidata delle anomalie finanziarie.</p>
                            </div>
                            <span className="text-2xl font-black text-amber-500">🩺</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {integrityIssues.map((issue, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {issue.type === 'missing_invoice' 
                                                ? <span className="bg-red-100 text-red-700 text-[10px] uppercase px-2 py-1 rounded font-bold">Manca Fattura</span>
                                                : <span className="bg-orange-100 text-orange-700 text-[10px] uppercase px-2 py-1 rounded font-bold">Manca Transazione</span>
                                            }
                                            <span className="text-xs font-mono text-gray-400">{new Date(issue.date).toLocaleDateString()}</span>
                                        </div>
                                        <span className="font-black text-lg text-slate-800">{issue.amount.toFixed(2)}€</span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">{issue.description}</h4>
                                    <p className="text-sm text-gray-500 mb-4">Soggetto: {issue.entityName}</p>
                                    
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3 text-xs text-gray-600">
                                        <strong>Soluzione Proposta:</strong><br/>
                                        {issue.type === 'missing_invoice' 
                                            ? `Generazione automatica Fattura Pagata per ${issue.entityName}.` 
                                            : `Creazione automatica Transazione in entrata collegata alla fattura.`
                                        }
                                    </div>

                                    <button 
                                        onClick={() => handleFixIssue(issue)}
                                        className="w-full md-btn md-btn-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm font-bold"
                                    >
                                        Risolvi Ora
                                    </button>
                                </div>
                            ))}
                            {integrityIssues.length === 0 && (
                                <div className="text-center py-10 text-gray-400 italic">
                                    Nessuna anomalia rilevata. Ottimo lavoro!
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button onClick={() => setIsFixWizardOpen(false)} className="md-btn md-btn-flat">Chiudi</button>
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
                <Modal onClose={() => setIsInvoiceModalOpen(false)} size="2xl">
                    <InvoiceEditForm 
                        invoice={editingInvoice}
                        clients={clients} 
                        companyInfo={companyInfo} 
                        onSave={handleSaveInvoice}
                        onCancel={() => setIsInvoiceModalOpen(false)}
                    />
                </Modal>
            )}

            {isQuoteModalOpen && (
                <Modal onClose={() => setIsQuoteModalOpen(false)} size="lg">
                    <QuoteForm 
                        quote={editingQuote}
                        clients={clients}
                        onSave={handleSaveQuote}
                        onCancel={() => setIsQuoteModalOpen(false)}
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!transactionToDelete}
                onClose={() => setTransactionToDelete(null)}
                onConfirm={confirmDelete}
                title="Elimina Voce"
                message="Sei sicuro di voler eliminare questo elemento?"
                isDangerous={true}
            />

            <ConfirmModal 
                isOpen={!!quoteToConvert}
                onClose={() => setQuoteToConvert(null)}
                onConfirm={processConversion}
                title="Converti in Fattura"
                message={`Sei sicuro di voler convertire il preventivo ${quoteToConvert?.quoteNumber} in una nuova fattura?`}
                confirmText="Sì, Converti"
            />
        </div>
    );
};

export default Finance;
