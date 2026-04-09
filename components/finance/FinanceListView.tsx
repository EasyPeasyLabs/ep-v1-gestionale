
import React, { useMemo, useState } from 'react';
import SearchIcon from '../icons/SearchIcon';
import PrinterIcon from '../icons/PrinterIcon';
import TrashIcon from '../icons/TrashIcon';
import DocumentCheckIcon from '../icons/DocumentCheckIcon';
import PencilIcon from '../icons/PencilIcon';
import BanknotesIcon from '../icons/BanknotesIcon';
import { Transaction, Invoice, Quote, DocumentStatus, Supplier, TransactionType, Enrollment, TransactionCategory } from '../../types';
import { updateInvoice, markInvoicesAsPaid } from '../../services/financeService';

// --- Icona WhatsApp ---
const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

// --- Icona Magic Wand (Converti) ---
const MagicWandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
);

// --- Icona Fulmine (Attivazione Istituzionale) ---
const BoltIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const SortIcon: React.FC<{ active: boolean; direction: 'asc' | 'desc' }> = ({ active, direction }) => (
    <span className={`ml-1 text-[10px] ${active ? 'text-ep-blue-600 font-bold' : 'text-slate-300'}`}>
        {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
    </span>
);

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Paid':
        case 'completed':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Draft':
        case 'pending':
        case 'PendingSDI':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Sent':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'Overdue':
        case 'cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        case 'SealedSDI':
            return 'bg-ep-blue-50 text-ep-blue-700 border-ep-blue-200';
        default:
            return 'bg-gray-50 text-gray-700 border-gray-200';
    }
};

interface FinanceListViewProps {
    activeTab: 'transactions' | 'invoices' | 'archive' | 'quotes';
    transactions: Transaction[];
    invoices: Invoice[];
    quotes: Quote[];
    suppliers?: Supplier[]; 
    enrollments?: Enrollment[]; // Added for resolving child name
    filters: { search: string };
    setFilters: React.Dispatch<React.SetStateAction<{ search: string }>>;
    onEdit: (item: Transaction | Invoice | Quote) => void;
    onDelete: (id: string) => void;
    onPrint?: (item: Transaction | Invoice | Quote) => void;
    onSeal?: (item: Invoice) => void;
    onWhatsApp: (item: Transaction | Invoice | Quote) => void;
    onConvert?: (item: Quote) => void;
    onActivate?: (item: Quote) => void; 
}

const FinanceListView: React.FC<FinanceListViewProps> = ({ 
    activeTab, transactions, invoices, quotes, suppliers, enrollments, filters, setFilters, 
    onEdit, onDelete, onPrint, onSeal, onWhatsApp, onConvert, onActivate
}) => {
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'number'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // --- NUOVI FILTRI TEMPORALI ---
    const now = useMemo(() => new Date(), []);
    const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
    const [filterMonth, setFilterMonth] = useState<string>(String(now.getMonth() + 1)); // 1-12 o "all"
    const years = useMemo(() => {
        const list = [];
        for (let y = now.getFullYear() + 1; y >= 2025; y--) list.push(y);
        return list;
    }, [now]);
    const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    const handleSort = (key: 'date' | 'number') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const filteredList = useMemo(() => {
        let list: (Transaction | Invoice | Quote)[] = [];
        // Se c'è una ricerca testuale attiva (lunga almeno 2 caratteri), bypassiamo i filtri data
        const isSearching = filters.search.trim().length > 1;

        if (activeTab === 'transactions') {
            let tList = transactions.filter(t => !t.isDeleted);
            // Applica Filtro Temporale per Transazioni SOLO se non sto cercando
            if (!isSearching) {
                tList = tList.filter(t => {
                    const d = new Date(t.date);
                    const yearMatch = d.getFullYear() === filterYear;
                    const monthMatch = filterMonth === 'all' || (d.getMonth() + 1) === parseInt(filterMonth);
                    return yearMatch && monthMatch;
                });
            }
            list = tList;
        }
        else if (activeTab === 'invoices' || activeTab === 'archive') {
            const baseList = invoices.filter(i => !i.isDeleted);
            
            let iList = baseList.filter(i => {
                // Filtro Anagrafico/Tab - Allow ghost when filter is active
                const isGhostFilter = statusFilter === 'ghost';
                const matchesTab = activeTab === 'invoices' 
                    ? (isGhostFilter ? true : !i.isGhost) 
                    : (i.status === DocumentStatus.PendingSDI || i.status === DocumentStatus.SealedSDI || (i.sdiId && String(i.sdiId).trim().length > 0));
                
                if (!matchesTab) return false;

                // Se sto cercando, salto il filtro data
                if (isSearching) return true;

                // Filtro Temporale (Data Emissione)
                const d = new Date(i.issueDate);
                const yearMatch = d.getFullYear() === filterYear;
                const monthMatch = filterMonth === 'all' || (d.getMonth() + 1) === parseInt(filterMonth);
                
                return yearMatch && monthMatch;
            });

            if (statusFilter && activeTab === 'invoices') {
                if (statusFilter === 'ghost') {
                    iList = iList.filter(i => i.isGhost === true);
                } else {
                    iList = iList.filter(i => i.status === statusFilter);
                }
            }
            list = iList;
        }
        else if (activeTab === 'quotes') list = quotes.filter(q => !q.isDeleted);
        
        // SAFE SEARCH: Handle missing clientName for suppliers/rents
        const result = list.filter(item => {
            const t = item as Record<string, any>;
            const searchFields = [
                t.clientName,
                t.description,
                t.invoiceNumber,
                t.quoteNumber,
                t.allocationName
            ];

            // 1. Resolve Child Badge for Search
            if (activeTab === 'transactions' && enrollments && t.relatedEnrollmentId) {
                const enr = enrollments.find(e => e.id === t.relatedEnrollmentId);
                if (enr && enr.childName) {
                    searchFields.push(enr.childName);
                }
            }

            // 2. Resolve NOLO Badge for Search
            if (activeTab === 'transactions' && 
                t.type === TransactionType.Expense && 
                t.category === TransactionCategory.Nolo) {
                searchFields.push("NOLO");
            }

            const searchableText = searchFields.filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(filters.search.toLowerCase());
        });

        result.sort((a, b) => {
            const ta = a as Record<string, any>;
            const tb = b as Record<string, any>;
            let valA: string | number = '';
            let valB: string | number = '';
            if (sortConfig.key === 'date') {
                valA = new Date(ta.date || ta.issueDate || '').getTime();
                valB = new Date(tb.date || tb.issueDate || '').getTime();
                
                // Fallback to document number if dates are identical
                if (valA === valB) {
                    const numA = ta.invoiceNumber || ta.quoteNumber || ('id' in a ? a.id : '');
                    const numB = tb.invoiceNumber || tb.quoteNumber || ('id' in b ? b.id : '');
                    if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
            } else if (sortConfig.key === 'number') {
                valA = ta.invoiceNumber || ta.quoteNumber || ('id' in a ? a.id : '');
                valB = tb.invoiceNumber || tb.quoteNumber || ('id' in b ? b.id : '');
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [activeTab, transactions, invoices, quotes, filters, statusFilter, sortConfig, filterYear, filterMonth, enrollments]);

    // --- CALCOLO TOTALI DINAMICI (Cassa vs Fatturazione) ---
    const totals = useMemo(() => {
        if (activeTab === 'transactions') {
            return filteredList.reduce((acc, t) => {
                const trx = t as Transaction;
                if (trx.type === TransactionType.Income) acc.income += Number(trx.amount);
                else if (trx.type === TransactionType.Expense) acc.expense += Number(trx.amount);
                return acc;
            }, { income: 0, expense: 0 });
        } else if (activeTab === 'invoices' || activeTab === 'archive') {
            // Solo fatture reali per calcolo fiscale
            const realInvoices = filteredList.filter(i => !(i as Invoice).isGhost) as Invoice[];
            const gross = realInvoices.reduce((acc, i) => acc + (Number(i.totalAmount) || 0), 0);
            const taxable = gross * 0.78;
            const stamps = realInvoices.reduce((acc, i) => acc + (Number(i.totalAmount) > 77.47 ? 2 : 0), 0);
            return { gross, taxable, stamps };
        }
        return null;
    }, [filteredList, activeTab]);

    const getDocumentNumber = (item: Transaction | Invoice | Quote) => {
        const t = item as Record<string, any>;
        if (t.invoiceNumber) return t.invoiceNumber;
        if (t.quoteNumber) return t.quoteNumber;
        if (t.relatedDocumentId && t.relatedDocumentId.startsWith('FT-')) return t.relatedDocumentId;
        if (t.transactionNumber) return t.transactionNumber.toString();
        return 'TRX-' + t.id.substring(0, 5).toUpperCase();
    };

    const handleSendReportToSimona = () => {
        if (!suppliers) return alert("Errore: Anagrafica fornitori non disponibile.");
        const targetSupplier = suppliers.find(s => 
            s.companyName.toLowerCase().includes('simona') && 
            s.companyName.toLowerCase().includes('puddu')
        );
        let phone = targetSupplier?.phone;
        if (!phone) {
            if(!confirm("Fornitore 'Simona Puddu' non trovato. Procedere comunque?")) return;
            phone = ""; 
        }
        
        // Usa filteredList invece di invoices per mantenere l'ordinamento visivo
        const selectedInvoices = filteredList.filter(i => selectedItems.includes(i.id)) as Invoice[];
        let message = `*REPORT FATTURE SDI*\n------------------\n`;
        selectedInvoices.forEach(inv => {
            const dateStr = new Date(inv.issueDate).toLocaleDateString('it-IT');
            message += `🔹 *Fattura:* ${inv.invoiceNumber}\n   Data: ${dateStr}\n   SDI: ${inv.sdiId || 'N/D'}\n\n`;
        });
        message += `------------------\nTotale documenti: ${selectedInvoices.length}`;
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const finalPhone = (cleanPhone.length === 10) ? '39' + cleanPhone : cleanPhone;
        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleBulkPrint = () => {
        if (!onPrint) return;
        let sourceList: (Transaction | Invoice | Quote)[] = [];
        if (activeTab === 'invoices' || activeTab === 'archive') sourceList = invoices;
        else if (activeTab === 'quotes') sourceList = quotes;
        const itemsToPrint = sourceList.filter(item => selectedItems.includes(item.id));
        if (itemsToPrint.length === 0) return;
        itemsToPrint.forEach(item => onPrint(item));
    };

    const handleBulkMarkAsPaid = async () => {
        if (selectedItems.length === 0) return;
        if (!confirm(`Vuoi segnare come PAGATE ${selectedItems.length} fatture?`)) return;
        setIsBulkUpdating(true);
        try {
            await markInvoicesAsPaid(selectedItems);
            window.dispatchEvent(new Event('EP_DataUpdated'));
            setSelectedItems([]);
        } catch (e: unknown) {
            const error = e as Error;
            alert("Errore aggiornamento: " + error.message);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkAutoSeal = async () => {
        if (selectedItems.length === 0) return;
        if (!confirm(`Vuoi elaborare lo stato SDI per le ${selectedItems.length} fatture selezionate?`)) return;
        setIsBulkUpdating(true);
        try {
            const targets = invoices.filter(i => selectedItems.includes(i.id));
            const updates: Promise<void>[] = [];
            for (const inv of targets) {
                let newStatus: DocumentStatus | null = null;
                const hasSdi = inv.sdiId && inv.sdiId.trim().length > 0;
                if (hasSdi) {
                    if (inv.status !== DocumentStatus.SealedSDI) newStatus = DocumentStatus.SealedSDI;
                } else {
                    if (inv.status === DocumentStatus.Paid) newStatus = DocumentStatus.PendingSDI;
                }
                if (newStatus) updates.push(updateInvoice(inv.id, { status: newStatus }));
            }
            if (updates.length > 0) {
                await Promise.all(updates);
                window.dispatchEvent(new Event('EP_DataUpdated'));
                alert(`${updates.length} fatture aggiornate.`);
            }
            setSelectedItems([]);
        } catch (e) {
            alert("Errore elaborazione SDI.");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleMarkAsPaid = async (item: Invoice) => {
        try {
            await updateInvoice(item.id, { status: DocumentStatus.Paid });
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (e) {
            alert("Errore aggiornamento stato.");
        }
    };

    return (
        <div className="md-card overflow-hidden bg-white shadow-2xl border-0">
            <div className="p-6 bg-slate-50 border-b flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 w-full items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 flex-1 w-full md:w-auto">
                        <div className="relative flex-1 w-full md:w-auto md:max-w-md">
                            <div className="absolute left-3 top-3"><SearchIcon /></div>
                            <input type="text" placeholder="Cerca nel database..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="md-input pl-10 border bg-white rounded-xl focus:ring-2 ring-ep-blue-500 w-full" />
                        </div>
                        
                        {/* FILTRI TEMPORALI UNIVERSALI (Cassa + Fatture) */}
                        {(activeTab === 'transactions' || activeTab === 'invoices' || activeTab === 'archive') && (
                            <div className={`flex gap-2 transition-opacity ${filters.search.length > 1 ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex items-center gap-2 bg-ep-blue-600 rounded-xl px-3 py-2 border border-ep-blue-500 shadow-sm text-white">
                                    <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="text-xs font-bold text-white bg-transparent border-none outline-none cursor-pointer w-20">
                                        {years.map(y => <option key={y} value={y} className="text-slate-900">{y}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 bg-ep-blue-600 rounded-xl px-3 py-2 border border-ep-blue-500 shadow-sm text-white">
                                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-xs font-bold text-white bg-transparent border-none outline-none cursor-pointer w-28">
                                        <option value="all" className="text-slate-900">Tutto l'anno</option>
                                        {months.map((m, i) => <option key={i} value={String(i+1)} className="text-slate-900">{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'invoices' && (
                            <div className="flex items-center gap-2 bg-ep-blue-600 rounded-xl px-3 py-2 border border-ep-blue-500 shadow-sm text-white">
                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs font-bold text-white bg-transparent border-none outline-none cursor-pointer w-40">
                                    <option value="" className="text-slate-900">Tutti gli stati</option>
                                    <option value="ghost" className="text-slate-900">Pro-Forma (Ghost)</option>
                                    <option value={DocumentStatus.Draft} className="text-slate-900">Bozza</option>
                                    <option value={DocumentStatus.Sent} className="text-slate-900">Inviata</option>
                                    <option value={DocumentStatus.Paid} className="text-slate-900">Pagata</option>
                                    <option value={DocumentStatus.PendingSDI} className="text-slate-900">In Attesa SDI</option>
                                    <option value={DocumentStatus.SealedSDI} className="text-slate-900">Sigillata SDI</option>
                                    <option value={DocumentStatus.Overdue} className="text-slate-900">Scaduta</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* SMART COUNTERS REGISTRO CASSA */}
                    {activeTab === 'transactions' && totals && 'income' in totals && (
                        <div className="flex gap-3 flex-shrink-0 animate-fade-in">
                            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex flex-col items-end shadow-sm">
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Entrate Periodo</span>
                                <span className="text-sm font-black text-emerald-700 font-mono">+{totals.income.toFixed(2)}€</span>
                            </div>
                            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-2xl flex flex-col items-end shadow-sm">
                                <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Uscite Periodo</span>
                                <span className="text-sm font-black text-red-700 font-mono">-{totals.expense.toFixed(2)}€</span>
                            </div>
                        </div>
                    )}

                    {/* FISCAL COUNTERS FATTURAZIONE */}
                    {(activeTab === 'invoices' || activeTab === 'archive') && totals && 'gross' in totals && (
                        <div className="flex gap-2 flex-shrink-0 animate-fade-in flex-wrap justify-end">
                            <div className="bg-ep-blue-50 border border-ep-blue-200 px-3 py-1.5 rounded-xl flex flex-col items-end shadow-sm min-w-[90px]">
                                <span className="text-[8px] font-black text-ep-blue-600 uppercase tracking-tighter">Lordo Fatturato</span>
                                <span className="text-xs font-black text-ep-blue-700 font-mono">{totals.gross.toFixed(2)}€</span>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex flex-col items-end shadow-sm min-w-[90px]">
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Imponibile 78%</span>
                                <span className="text-xs font-black text-amber-700 font-mono">{totals.taxable.toFixed(2)}€</span>
                            </div>
                            <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl flex flex-col items-end shadow-sm min-w-[80px]">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Totale Bolli</span>
                                <span className="text-xs font-black text-slate-700 font-mono">{totals.stamps.toFixed(2)}€</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full">
                    {selectedItems.length > 0 && (
                        <div className="flex gap-2 animate-fade-in flex-wrap">
                            {activeTab === 'invoices' && (
                                <>
                                    <button onClick={handleBulkMarkAsPaid} disabled={isBulkUpdating} className={`md-btn md-btn-sm bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1 hover:bg-emerald-200 shadow-sm ${isBulkUpdating ? 'opacity-70' : ''}`} title="Segna selezionati come pagati">
                                        {isBulkUpdating ? <div className="w-3 h-3 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div> : <><BanknotesIcon /> Segna Pagate</>}
                                    </button>
                                    <button onClick={handleBulkAutoSeal} disabled={isBulkUpdating} className={`md-btn md-btn-sm bg-cyan-100 text-cyan-800 border border-cyan-200 font-bold flex items-center gap-1 hover:bg-cyan-200 shadow-sm ${isBulkUpdating ? 'opacity-70' : ''}`} title="Processa stato SDI">
                                        <DocumentCheckIcon /> Segna Sigillate
                                    </button>
                                </>
                            )}
                            {activeTab === 'archive' && (
                                <button onClick={handleSendReportToSimona} className="md-btn md-btn-sm bg-emerald-500 text-white font-bold flex items-center gap-1 hover:bg-emerald-600 shadow-sm" title="Invia report a Simona Puddu">
                                    <WhatsAppIcon /> Report Simona ({selectedItems.length})
                                </button>
                            )}
                            <button onClick={handleBulkPrint} className="md-btn md-btn-sm bg-ep-blue-600 text-white font-bold"><PrinterIcon /> Stampa ({selectedItems.length})</button>
                            <button className="md-btn md-btn-sm bg-slate-800 text-white font-bold"><TrashIcon /> Elimina</button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 border-b font-black tracking-widest">
                        <tr>
                            <th className="px-6 py-4 w-10">
                                <input type="checkbox" onChange={e => setSelectedItems(e.target.checked ? filteredList.map(i => i.id) : [])} checked={selectedItems.length === filteredList.length && filteredList.length > 0} />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                                <div className="flex items-center gap-1">Data <SortIcon active={sortConfig.key === 'date'} direction={sortConfig.direction} /></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('number')}>
                                <div className="flex items-center gap-1">Rif / ID <SortIcon active={sortConfig.key === 'number'} direction={sortConfig.direction} /></div>
                            </th>
                            <th className="px-6 py-4">Soggetto / Causale</th>
                            <th className="px-6 py-4 text-right">Importo</th>
                            <th className="px-6 py-4">Stato</th>
                            <th className="px-6 py-4 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.map(item => {
                            const t = item as Record<string, any>;
                            // CRITICAL FIX: Handle potential null/undefined amount correctly to prevent crash
                            // For transactions: use item.amount. For invoices: use item.totalAmount.
                            // If undefined, fallback to 0.
                            const displayAmount = 'amount' in item ? (item as Transaction).amount : ('totalAmount' in item ? (item as Invoice).totalAmount : 0);
                            const safeAmount = Number(displayAmount) || 0;

                            const isTransaction = activeTab === 'transactions';
                            const isIncome = isTransaction && t.type === TransactionType.Income;

                            const amountColor = isTransaction 
                                ? (isIncome ? 'text-emerald-700' : 'text-red-700') 
                                : 'text-slate-900';

                            const amountPrefix = isTransaction
                                ? (isIncome ? '+' : '-')
                                : '';

                            return (
                            <tr key={t.id} className={`hover:bg-ep-blue-50/30 transition-colors group ${selectedItems.includes(t.id) ? 'bg-ep-blue-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <input type="checkbox" checked={selectedItems.includes(t.id)} onChange={() => setSelectedItems(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">{new Date(t.date || t.issueDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-mono font-bold text-ep-blue-600 text-xs">{getDocumentNumber(item)}</td>
                                {/* SAFE RENDER: Fallback to description or allocationName if clientName is missing (e.g. Rent transactions) */}
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900 truncate max-w-[250px]">
                                        {t.clientName || t.allocationName || t.description}
                                    </div>
                                    {activeTab === 'transactions' && enrollments && t.relatedEnrollmentId && (
                                        (() => {
                                            const enr = enrollments.find(e => e.id === t.relatedEnrollmentId);
                                            if (enr) {
                                                return (
                                                    <div className="mt-1">
                                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-black text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-gray-200 tracking-tight">
                                                            👤 {enr.childName}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()
                                    )}
                                    {activeTab === 'transactions' && t.type === TransactionType.Expense && t.category === TransactionCategory.Nolo && (
                                        <div className="mt-1">
                                            <span className="inline-flex items-center gap-1 bg-gray-100 text-black text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-gray-200 tracking-tight">
                                                NOLO
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className={`px-6 py-4 text-right font-black ${amountColor}`}>
                                    {amountPrefix}{safeAmount.toFixed(2)}€
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusColor(t.status)}`}>{t.status || 'N/D'}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        {/* NEW: Institutional Activation Button */}
                                        {activeTab === 'quotes' && onActivate && (
                                            <button onClick={() => onActivate(item as Quote)} className="md-icon-btn text-ep-blue-600 bg-ep-blue-50 hover:bg-ep-blue-100" title="Attiva Progetto Ente"><BoltIcon /></button>
                                        )}
                                        {onConvert && (
                                            <button onClick={() => onConvert(item as Quote)} className="md-icon-btn text-purple-600" title="Converti in Fattura"><MagicWandIcon /></button>
                                        )}
                                        {activeTab === 'invoices' && t.status !== DocumentStatus.Paid && t.status !== DocumentStatus.PendingSDI && t.status !== DocumentStatus.SealedSDI && (
                                            <button onClick={() => handleMarkAsPaid(item as Invoice)} className="md-icon-btn text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-bold" title="Segna come Pagata">€</button>
                                        )}
                                        {onSeal && (t.status === DocumentStatus.PendingSDI || (t.sdiId && t.status !== DocumentStatus.SealedSDI)) && (
                                            <button onClick={() => onSeal(item as Invoice)} className="md-icon-btn text-ep-blue-600 hover:bg-ep-blue-50" title="Sigilla SDI"><DocumentCheckIcon /></button>
                                        )}
                                        <button onClick={() => onWhatsApp(item)} className="md-icon-btn text-emerald-600" title="WhatsApp"><WhatsAppIcon /></button>
                                        {(activeTab === 'invoices' || activeTab === 'quotes' || activeTab === 'archive') && onPrint && (
                                            <button onClick={() => onPrint(item)} className="md-icon-btn text-slate-600" title="PDF"><PrinterIcon /></button>
                                        )}
                                        <button onClick={() => onEdit(item)} className="md-icon-btn edit"><PencilIcon /></button>
                                        <button onClick={() => onDelete(t.id)} className="md-icon-btn delete"><TrashIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
                {filteredList.length === 0 && <div className="py-20 text-center text-slate-400 italic">Nessun record trovato.</div>}
            </div>
        </div>
    );
};

export default FinanceListView;
