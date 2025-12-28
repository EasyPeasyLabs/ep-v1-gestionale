
import React, { useMemo, useState } from 'react';
import SearchIcon from '../icons/SearchIcon';
import PrinterIcon from '../icons/PrinterIcon';
import TrashIcon from '../icons/TrashIcon';
import DocumentCheckIcon from '../icons/DocumentCheckIcon';
import PencilIcon from '../icons/PencilIcon';
import { Transaction, Invoice, Quote, DocumentStatus, TransactionType, Supplier } from '../../types';

// --- Icona WhatsApp ---
const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

interface FinanceListViewProps {
    activeTab: 'transactions' | 'invoices' | 'archive' | 'quotes';
    transactions: Transaction[];
    invoices: Invoice[];
    quotes: Quote[];
    suppliers?: Supplier[]; // Optional to avoid breaking other usages if any
    filters: { search: string };
    setFilters: React.Dispatch<React.SetStateAction<{ search: string }>>;
    onExportTransactions?: () => void;
    onExportInvoices?: () => void;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
    onPrint?: (item: any) => void;
    onSeal?: (item: Invoice) => void;
    onWhatsApp: (item: any) => void;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Paid':
        case 'Completed':
            return 'bg-green-100 text-green-700 border-green-200';
        case DocumentStatus.SealedSDI:
            return 'bg-cyan-100 text-cyan-700 border-cyan-200'; // Ciano
        case DocumentStatus.PendingSDI:
        case 'pending':
            return 'bg-amber-100 text-amber-800 border-amber-200'; // Ocra
        case DocumentStatus.Overdue:
            return 'bg-red-100 text-red-700 border-red-200';
        case DocumentStatus.Draft:
            return 'bg-gray-100 text-gray-600 border-gray-200';
        case DocumentStatus.Sent:
            return 'bg-blue-100 text-blue-700 border-blue-200';
        default:
            return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

const FinanceListView: React.FC<FinanceListViewProps> = ({ 
    activeTab, transactions, invoices, quotes, suppliers, filters, setFilters, 
    onExportTransactions, onExportInvoices, onEdit, onDelete, onPrint, onSeal, onWhatsApp 
}) => {
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState('');

    const filteredList = useMemo(() => {
        let list: any[] = [];
        if (activeTab === 'transactions') list = transactions.filter(t => !t.isDeleted);
        else if (activeTab === 'invoices') {
            list = invoices.filter(i => !i.isDeleted && !i.isGhost);
            if (statusFilter) {
                list = list.filter(i => i.status === statusFilter);
            }
        }
        else if (activeTab === 'archive') {
            list = invoices.filter(i => 
                !i.isDeleted && (
                    i.status === DocumentStatus.PendingSDI || 
                    i.status === DocumentStatus.SealedSDI || 
                    (i.sdiId && String(i.sdiId).trim().length > 0)
                )
            );
        }
        else if (activeTab === 'quotes') list = quotes.filter(q => !q.isDeleted);
        
        return list.filter(item => (item.clientName || item.description || item.invoiceNumber || '').toLowerCase().includes(filters.search.toLowerCase()));
    }, [activeTab, transactions, invoices, quotes, filters, statusFilter]);

    // Funzione per inviare report a Simona Puddu
    const handleSendReportToSimona = () => {
        if (!suppliers) return alert("Errore: Anagrafica fornitori non disponibile.");
        
        // 1. Trova Simona Puddu
        const targetSupplier = suppliers.find(s => 
            s.companyName.toLowerCase().includes('simona') && 
            s.companyName.toLowerCase().includes('puddu')
        );

        let phone = targetSupplier?.phone;
        if (!phone) {
            // Fallback: se non trovata, chiedi all'utente (opzionale) o avvisa
            if(!confirm("Fornitore 'Simona Puddu' non trovato o senza numero di telefono. Vuoi procedere comunque aprendo WhatsApp (dovrai selezionare il contatto)?")) return;
            phone = ""; 
        }

        // 2. Costruisci il messaggio
        const selectedInvoices = invoices.filter(i => selectedItems.includes(i.id));
        
        let message = `*REPORT FATTURE SDI*\n------------------\n`;
        
        selectedInvoices.forEach(inv => {
            const dateStr = new Date(inv.issueDate).toLocaleDateString('it-IT');
            message += `🔹 *Fattura:* ${inv.invoiceNumber}\n`;
            message += `   Data: ${dateStr}\n`;
            message += `   SDI: ${inv.sdiId || 'N/D'}\n\n`;
        });
        message += `------------------\nTotale documenti: ${selectedInvoices.length}`;

        // 3. Apri WhatsApp
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const finalPhone = (cleanPhone.length === 10) ? '39' + cleanPhone : cleanPhone;
        const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    // Stampa Massiva
    const handleBulkPrint = () => {
        if (!onPrint) return;

        // Determina la sorgente dati corretta
        let sourceList: any[] = [];
        if (activeTab === 'invoices' || activeTab === 'archive') {
            sourceList = invoices;
        } else if (activeTab === 'quotes') {
            sourceList = quotes;
        }

        // Filtra gli oggetti completi basandosi sugli ID selezionati
        const itemsToPrint = sourceList.filter(item => selectedItems.includes(item.id));

        if (itemsToPrint.length === 0) return;

        // Lancia la stampa in sequenza
        itemsToPrint.forEach(item => {
            onPrint(item);
        });
    };

    return (
        <div className="md-card overflow-hidden bg-white shadow-2xl border-0">
            <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute left-3 top-3"><SearchIcon /></div>
                        <input type="text" placeholder="Cerca nel database..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="md-input pl-10 border bg-white rounded-xl focus:ring-2 ring-indigo-500" />
                    </div>
                    {activeTab === 'invoices' && (
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)} 
                            className="block w-40 pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="">Tutti gli stati</option>
                            <option value={DocumentStatus.Draft}>Bozza (Draft)</option>
                            <option value={DocumentStatus.Sent}>Inviata (Sent)</option>
                            <option value={DocumentStatus.Paid}>Pagata (Paid)</option>
                            <option value={DocumentStatus.PendingSDI}>In Attesa SDI</option>
                            <option value={DocumentStatus.SealedSDI}>Sigillata SDI</option>
                            <option value={DocumentStatus.Overdue}>Scaduta (Overdue)</option>
                        </select>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    {activeTab === 'transactions' && onExportTransactions && (
                        <button onClick={onExportTransactions} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1 font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Excel
                        </button>
                    )}
                    {activeTab === 'invoices' && onExportInvoices && (
                        <button onClick={onExportInvoices} className="md-btn md-btn-sm bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1 font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Excel
                        </button>
                    )}
                    {selectedItems.length > 0 && (
                        <div className="flex gap-2 animate-fade-in">
                            {activeTab === 'archive' && (
                                <button 
                                    onClick={handleSendReportToSimona} 
                                    className="md-btn md-btn-sm bg-emerald-500 text-white font-bold flex items-center gap-1 hover:bg-emerald-600 shadow-sm"
                                    title="Invia report a Simona Puddu"
                                >
                                    <WhatsAppIcon /> Report Simona ({selectedItems.length})
                                </button>
                            )}
                            <button onClick={handleBulkPrint} className="md-btn md-btn-sm bg-indigo-600 text-white font-bold"><PrinterIcon /> Stampa ({selectedItems.length})</button>
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
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        {item.status === 'PendingSDI' && onSeal && <button onClick={() => onSeal(item)} className="md-icon-btn text-indigo-600" title="Sigilla SDI"><DocumentCheckIcon /></button>}
                                        
                                        <button onClick={() => onWhatsApp(item)} className="md-icon-btn text-emerald-600" title="WhatsApp"><WhatsAppIcon /></button>
                                        
                                        {(activeTab === 'invoices' || activeTab === 'quotes' || activeTab === 'archive') && onPrint && (
                                            <button onClick={() => onPrint(item)} className="md-icon-btn text-slate-600" title="PDF"><PrinterIcon /></button>
                                        )}
                                        
                                        <button onClick={() => onEdit(item)} className="md-icon-btn edit"><PencilIcon /></button>
                                        
                                        <button onClick={() => onDelete(item.id)} className="md-icon-btn delete"><TrashIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredList.length === 0 && <div className="py-20 text-center text-slate-400 italic">Nessun record trovato.</div>}
            </div>
        </div>
    );
};

export default FinanceListView;
