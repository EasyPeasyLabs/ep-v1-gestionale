
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Invoice, Quote, Supplier, CompanyInfo, TransactionType, TransactionCategory, DocumentStatus, Page, InvoiceInput, TransactionInput, Client, QuoteInput, Lesson } from '../types';
import { getTransactions, getInvoices, getQuotes, addTransaction, updateTransaction, deleteTransaction, updateInvoice, addInvoice, deleteInvoice, syncRentExpenses, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice } from '../services/financeService';
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
        costPerStudent: number, 
        breakdown: { rent: number, logistics: number, overhead: number } 
    } | null>(null);

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
            const [t, i, q, e, s, c, ml, info] = await Promise.all([
                getTransactions(), getInvoices(), getQuotes(), getAllEnrollments(), getSuppliers(), getClients(), getLessons(), getCompanyInfo()
            ]);
            setTransactions(t); setInvoices(i); setQuotes(q); setEnrollments(e); setSuppliers(s); setClients(c); setManualLessons(ml); setCompanyInfo(info);
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
        // --- 1. CONFIGURAZIONE & DATI BASE ---
        const targetYear = controllingYear;
        
        // Entrate Totali (Solo Income reale, no capital)
        const totalGlobalRevenue = transactions.filter(t => 
            !t.isDeleted && 
            t.type === TransactionType.Income && 
            t.category !== TransactionCategory.Capitale &&
            new Date(t.date).getFullYear() === targetYear
        ).reduce((sum, t) => sum + t.amount, 0);

        // Uscite Totali (qualsiasi natura, usate per KPI stress test)
        const totalGlobalOutflows = transactions.filter(t => 
            !t.isDeleted && 
            t.type === TransactionType.Expense && 
            new Date(t.date).getFullYear() === targetYear
        ).reduce((sum, t) => sum + t.amount, 0);

        const data: Record<string, any> = {};
        
        // Inizializza Sedi
        suppliers.flatMap(s => s.locations).forEach(l => {
            data[l.id] = { 
                name: l.name, 
                color: l.color, 
                revenue: 0, 
                costs: 0,
                costPerLesson: { value: 0, min: 0, max: 0, avg: 0 },
                costPerStudent: 0,
                studentBasedCosts: 0,
                breakdown: { rent: 0, logistics: 0, overhead: 0 }
            };
        });

        // --- 2. FILTRO TRANSAZIONI & AGGREGAZIONE CATEGORIE ---
        // Recuperiamo tutte le uscite dell'anno target
        const yearExpenses = transactions.filter(t => 
            !t.isDeleted && 
            t.type === TransactionType.Expense &&
            new Date(t.date).getFullYear() === targetYear
        );

        // 3. "Costi Totali Logistici" (Famiglia Logistica)
        const totalLogisticsCosts = yearExpenses
            .filter(t => getMacroCategory(t.category) === 'Logistica')
            .reduce((sum, t) => sum + t.amount, 0);

        // 4. "Costi Totali Generali" (Famiglia Generali)
        const totalGeneralCosts = yearExpenses
            .filter(t => getMacroCategory(t.category) === 'Generali')
            .reduce((sum, t) => sum + t.amount, 0);

        // 5. "Costi Totali Operazioni" (Famiglia Operazioni)
        // ATTENZIONE: Qui dividiamo in Allocati (Nolo diretto alla sede) e Non Allocati (Materiali condivisi)
        const operationsTransactions = yearExpenses.filter(t => getMacroCategory(t.category) === 'Operazioni');
        
        const operationsAllocatedToLocation = operationsTransactions.filter(t => t.allocationId);
        const operationsUnallocated = operationsTransactions.filter(t => !t.allocationId);
        
        const totalOperationsUnallocated = operationsUnallocated.reduce((sum, t) => sum + t.amount, 0);

        // --- 6. METRICHE DI ATTIVITÀ PER RIPARTIZIONE ---
        const locationStats: Record<string, { studentCount: number, uniqueTrips: number }> = {};
        Object.keys(data).forEach(id => locationStats[id] = { studentCount: 0, uniqueTrips: 0 });

        let totalUniqueTrips = 0;
        let totalActiveStudents = 0;
        let activeLocationsCount = 0;

        // A. Studenti Reali
        enrollments.forEach(enr => {
            if ((enr.status === 'Active' || enr.status === 'Completed') && enr.locationId && locationStats[enr.locationId]) {
                locationStats[enr.locationId].studentCount++;
                totalActiveStudents++;
            }
        });

        // B. Aperture Uniche (Viaggi)
        const tripKeys = new Set<string>();
        enrollments.forEach(enr => {
            if (enr.appointments) {
                enr.appointments.forEach(app => {
                    const d = new Date(app.date);
                    if (d.getFullYear() === targetYear) {
                        const locId = app.locationId || enr.locationId;
                        if (locId && locationStats[locId]) {
                            const key = `${app.date.split('T')[0]}_${locId}`; // Un viaggio al giorno per sede
                            if (!tripKeys.has(key)) {
                                tripKeys.add(key);
                                locationStats[locId].uniqueTrips++;
                                totalUniqueTrips++;
                            }
                        }
                    }
                });
            }
        });

        // Manual Lessons Trips
        manualLessons.forEach(ml => {
            const d = new Date(ml.date);
            if (d.getFullYear() === targetYear) {
                // Find loc ID by Name (Approx)
                const loc = suppliers.flatMap(s => s.locations).find(l => l.name === ml.locationName);
                if (loc && locationStats[loc.id]) {
                    const key = `${ml.date.split('T')[0]}_${loc.id}`;
                    if (!tripKeys.has(key)) {
                        tripKeys.add(key);
                        locationStats[loc.id].uniqueTrips++;
                        totalUniqueTrips++;
                    }
                }
            }
        });

        Object.values(locationStats).forEach(s => {
            if (s.studentCount > 0 || s.uniqueTrips > 0) activeLocationsCount++;
        });
        if (activeLocationsCount === 0) activeLocationsCount = 1;

        // --- 7. ALLOCAZIONE RICAVI (Diretta) ---
        transactions.filter(t => !t.isDeleted && new Date(t.date).getFullYear() === targetYear && t.type === TransactionType.Income).forEach(t => {
            if (t.allocationId && data[t.allocationId]) {
                data[t.allocationId].revenue += t.amount;
            }
        });

        // --- 8. CALCOLO E RIPARTIZIONE COSTI SECONDO NUOVE FORMULE ---
        
        Object.keys(data).forEach(id => {
            const stats = locationStats[id];
            
            // A. Costi Diretti (Allocati) - Es. Nolo Sede specifico
            // Somma delle transazioni "Operazioni" con allocationId = id
            const directOpsCost = operationsAllocatedToLocation
                .filter(t => t.allocationId === id)
                .reduce((sum, t) => sum + t.amount, 0);
            
            data[id].breakdown.rent = directOpsCost; // Lo chiamiamo 'rent' per compatibilità UI ma include tutto ciò che è diretto
            data[id].costs += directOpsCost;

            // B. "Costo Logistica Sede" (Formula 8)
            // Totale Logistica / Aperture Uniche Sede (Se > 0)
            // Se la sede non ha aperture, non gli attribuiamo logistica variabile (ha senso?)
            // La formula richiesta è: "Costi Totali Logistica" / "Numero aperture uniche della sede"
            // INTERPRETAZIONE: Questo sembrerebbe un costo UNITARIO per viaggio.
            // Ma per il ROI della sede, dobbiamo sommare il costo totale attribuito.
            // Probabilmente intende: Ripartizione proporzionale ai viaggi?
            // "Costo Logistica Sede" = (Costi Totali Logistica / Totale Viaggi Globali) * Viaggi Sede
            // Se interpretiamo letteralmente la richiesta "Costi Totali / Aperture Sede", verrebbe un numero enorme.
            // Assumeremo Ripartizione Proporzionale ai Viaggi.
            const logisticsShare = totalUniqueTrips > 0 
                ? (totalLogisticsCosts / totalUniqueTrips) * stats.uniqueTrips
                : 0;
            
            data[id].breakdown.logistics = logisticsShare;
            data[id].costs += logisticsShare;

            // C. "Costo Studenti Sede" (Formula 9)
            // (Costi Totali Operazioni NON Allocati + Generali) / Studenti Totali * Studenti Sede?
            // La richiesta dice: "Costi Totali Operazioni" / "Numero iscrizioni sede".
            // Anche qui, interpretiamo come ripartizione proporzionale del "non allocato".
            // Totale Operazioni = (Diretto gia sommato) + (Indiretto da ripartire).
            // Ripartiamo i Generali + Operazioni Indirette in base agli studenti.
            const overheadPool = totalGeneralCosts + totalOperationsUnallocated;
            const overheadShare = totalActiveStudents > 0
                ? (overheadPool / totalActiveStudents) * stats.studentCount
                : 0;

            data[id].breakdown.overhead = overheadShare;
            data[id].costs += overheadShare;
            
            // Student Based Costs (per visualizzazione)
            data[id].studentBasedCosts = overheadShare + directOpsCost; // Approx

            // --- KPI CALCOLATI ---

            // "Costo Studenti Sede" (Formula 9 - Interpretazione Unitaria)
            // Costo Totale Operazioni (Attribuzione) / Iscritti Sede
            // Qui usiamo la quota parte attribuita
            data[id].costPerStudent = stats.studentCount > 0 
                ? (directOpsCost + overheadShare) / stats.studentCount
                : 0;

            // "Costo assoluto Studente a Lezione" (Formula 10)
            // "Uscite Totali" / Aperture Sede / Iscrizioni Sede
            // Attenzione: Uscite Totali è GLOBAL o LOCAL? "Uscite Totali" (Globali) diviso i fattori locali sarebbe un indice di pressione.
            // Se usiamo i costi attribuiti alla sede (data[id].costs), è il costo reale.
            // La richiesta dice "Uscite Totali" (definito come somma di tutte le transazioni negative).
            // Usiamo il Costo Totale Attribuito alla Sede per coerenza ROI.
            const costPerStudentPerLesson = (stats.uniqueTrips > 0 && stats.studentCount > 0)
                ? data[id].costs / stats.uniqueTrips / stats.studentCount
                : 0;

            // Vettoriale per UI
            // Per il "Costo Singola Lezione" (compatibilità UI precedente), usiamo la formula vettoriale [(C/S/V)*2]
            // Oppure usiamo il nuovo "Costo assoluto Studente a Lezione"?
            // Usiamo la nuova formula 10 come valore principale.
            data[id].costPerLesson = {
                value: costPerStudentPerLesson,
                min: costPerStudentPerLesson * 0.9,
                max: costPerStudentPerLesson * 1.1,
                avg: costPerStudentPerLesson
            };
            
            data[id].globalRevenue = totalGlobalRevenue;
        });

        return Object.values(data).sort((a,b) => b.revenue - a.revenue);
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
            if (invoiceId) {
                await updateInvoice(invoiceId, data);
            } else {
                const res = await addInvoice(data);
                invoiceId = res.id;
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
                    description: `Incasso Fattura ${data.invoiceNumber || 'N/D'} - ${data.clientName}`,
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
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Finanza Enterprise</h1>
                    <p className="text-slate-500 font-medium">Controllo di gestione, fiscalità, logistica e flussi.</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <button onClick={handleSyncRents} className="md-btn md-btn-flat bg-white border border-indigo-200 text-indigo-700 shadow-sm font-bold flex items-center gap-1 hover:bg-indigo-50 flex-shrink-0"><RefreshIcon /> Sync Noli</button>
                    <button onClick={() => fetchData()} className="md-btn md-btn-flat bg-white border shadow-sm flex-shrink-0"><RefreshIcon /> Sync</button>
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
