
import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, InvoiceInput, DocumentStatus, PaymentMethod, DocumentItem, Client, ClientType, ParentClient, InstitutionalClient, CompanyInfo } from '../../types';
import { generateDocumentPDF } from '../../utils/pdfGenerator';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import SearchIcon from '../icons/SearchIcon';

const InvoiceEditForm: React.FC<{
    invoice: Invoice;
    clients?: Client[];
    companyInfo?: CompanyInfo | null; // NEW Prop
    onSave: (data: InvoiceInput) => void;
    onCancel: () => void;
}> = ({ invoice, clients = [], companyInfo, onSave, onCancel }) => {
    // --- General Info ---
    const [issueDate, setIssueDate] = useState(invoice.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(invoice.dueDate ? invoice.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod || PaymentMethod.BankTransfer);
    const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber || '');
    const [status, setStatus] = useState<DocumentStatus>(invoice.status || DocumentStatus.Draft);
    const [sdiId, setSdiId] = useState(invoice.sdiId || '');
    const [notes, setNotes] = useState(invoice.notes || '');

    // --- Client Selection ---
    const [clientId, setClientId] = useState(invoice.clientId || '');
    const [clientName, setClientName] = useState(invoice.clientName || '');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);

    // --- Items & Totals ---
    const [items, setItems] = useState<DocumentItem[]>(invoice.items || []);
    const [globalDiscount, setGlobalDiscount] = useState<number>(invoice.globalDiscount || 0);
    const [globalDiscountType, setGlobalDiscountType] = useState<'percent' | 'amount'>(invoice.globalDiscountType || 'amount');
    const [manualStampDuty, setManualStampDuty] = useState(invoice.hasStampDuty);

    // --- Automation: Pre-fill Notes with IBAN only (No Legal Footer) ---
    useEffect(() => {
        if (!invoice.id && !notes && companyInfo) {
            // Solo dati bancari, niente footer legale (gestito dal PDF)
            const bankDetails = companyInfo.iban 
                ? `Coordinate Bancarie:\nIBAN: ${companyInfo.iban}\nIntestato a: ${companyInfo.name}`
                : "";
            setNotes(bankDetails);
        }
    }, [invoice.id, companyInfo]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Computed: Client List for Dropdown ---
    const filteredClients = useMemo(() => {
        if (!clientSearchTerm) return clients.slice(0, 10);
        return clients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                : (c as InstitutionalClient).companyName;
            return name.toLowerCase().includes(clientSearchTerm.toLowerCase());
        });
    }, [clients, clientSearchTerm]);

    // --- Computed: Totals ---
    const { subtotal, totalDiscount, taxable, stampDuty, grandTotal } = useMemo(() => {
        let sub = 0;
        
        items.forEach(item => {
            const grossRow = item.quantity * item.price;
            let rowDiscount = 0;
            if (item.discount) {
                if (item.discountType === 'percent') {
                    rowDiscount = grossRow * (item.discount / 100);
                } else {
                    rowDiscount = item.discount;
                }
            }
            sub += (grossRow - rowDiscount);
        });

        // 2. Global Discount
        let globDisc = 0;
        if (globalDiscount > 0) {
            if (globalDiscountType === 'percent') {
                globDisc = sub * (globalDiscount / 100);
            } else {
                globDisc = globalDiscount;
            }
        }

        const taxableBase = Math.max(0, sub - globDisc);
        const stamp = (taxableBase > 77.47 || manualStampDuty) ? 2.00 : 0.00;
        
        return {
            subtotal: sub,
            totalDiscount: globDisc,
            taxable: taxableBase,
            stampDuty: stamp,
            grandTotal: taxableBase + stamp
        };
    }, [items, globalDiscount, globalDiscountType, manualStampDuty]);

    // Helper per trovare cliente selezionato
    const selectedClientObj = useMemo(() => clients.find(c => c.id === clientId), [clientId, clients]);

    // --- Handlers ---

    const handleClientSelect = (c: Client) => {
        const name = c.clientType === ClientType.Parent 
            ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
            : (c as InstitutionalClient).companyName;
        
        setClientId(c.id);
        setClientName(name);
        setClientSearchTerm('');
        setShowClientDropdown(false);
    };

    const handleItemChange = (index: number, field: keyof DocumentItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, price: 0, discount: 0, discountType: 'amount' }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave: InvoiceInput = {
            invoiceNumber,
            issueDate: new Date(issueDate).toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            clientId,
            clientName, // Can be manually typed if ID is empty
            paymentMethod,
            status,
            sdiId,
            items,
            totalAmount: grandTotal,
            hasStampDuty: stampDuty > 0,
            globalDiscount,
            globalDiscountType,
            notes,
            isGhost: invoice.isGhost,
            isDeleted: invoice.isDeleted
        };
        onSave(dataToSave);
    };

    const handlePreview = async () => {
        // Costruisci oggetto temporaneo
        const tempInvoice: Invoice = {
            ...invoice,
            invoiceNumber: invoiceNumber || 'BOZZA',
            issueDate: new Date(issueDate).toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            clientId,
            clientName,
            paymentMethod,
            status,
            items,
            totalAmount: grandTotal,
            hasStampDuty: stampDuty > 0,
            globalDiscount,
            globalDiscountType,
            notes,
            sdiId
        };

        // Usa il flag 'true' per ottenere l'URL invece di scaricare
        const blobUrl = await generateDocumentPDF(tempInvoice, 'Fattura', companyInfo || null, selectedClientObj, true);
        if (typeof blobUrl === 'string') {
            window.open(blobUrl, '_blank');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* --- HEADER --- */}
            <div className="px-8 py-5 bg-white border-b border-gray-200 flex justify-between items-center flex-shrink-0 shadow-sm z-20">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        {invoice.id ? 'Modifica Fattura' : 'Nuova Fattura'}
                        {status === DocumentStatus.Draft && <span className="bg-gray-100 text-gray-500 text-[10px] uppercase px-2 py-0.5 rounded border">Bozza</span>}
                        {status === DocumentStatus.Paid && <span className="bg-green-100 text-green-700 text-[10px] uppercase px-2 py-0.5 rounded border border-green-200">Pagata</span>}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                        {invoiceNumber || 'Numero Automatico'}
                    </p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stato Documento</label>
                        <select 
                            value={status} 
                            onChange={e => setStatus(e.target.value as DocumentStatus)} 
                            className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded py-1.5 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-indigo-200 outline-none"
                        >
                            <option value={DocumentStatus.Draft}>Bozza</option>
                            <option value={DocumentStatus.Sent}>Inviata</option>
                            <option value={DocumentStatus.Paid}>Pagata</option>
                            <option value={DocumentStatus.PendingSDI}>In Attesa SDI</option>
                            <option value={DocumentStatus.SealedSDI}>Sigillata SDI</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* --- SCROLLABLE CONTENT --- */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                
                {/* 1. DOCUMENT DATA Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* CLIENTE (Colonna Grande - Sinistra) */}
                    <div className="md:col-span-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Destinatario</label>
                        
                        {/* Selettore Intelligente o Card Dettaglio */}
                        {!clientId ? (
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                                    placeholder="Cerca cliente o inserisci nome manuale..."
                                    value={clientName || clientSearchTerm}
                                    onChange={(e) => {
                                        setClientName(e.target.value);
                                        setClientSearchTerm(e.target.value);
                                        setShowClientDropdown(true);
                                    }}
                                    onFocus={() => setShowClientDropdown(true)}
                                />
                                {showClientDropdown && clientSearchTerm && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {filteredClients.map(c => {
                                            const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => handleClientSelect(c)}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <span className="block text-sm font-bold text-slate-700">{name}</span>
                                                    <span className="block text-xs text-slate-400">{c.email || 'Nessuna email'}</span>
                                                </button>
                                            );
                                        })}
                                        {filteredClients.length === 0 && (
                                            <div className="px-4 py-3 text-xs text-slate-400 italic">
                                                Nessun cliente trovato. Premi invio per usare "{clientSearchTerm}" come manuale.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-lg font-bold text-indigo-900 mb-1">{clientName}</h4>
                                    {selectedClientObj && (
                                        <div className="text-xs text-slate-500 space-y-1">
                                            {selectedClientObj.clientType === ClientType.Parent ? (
                                                <p>CF: {(selectedClientObj as ParentClient).taxCode || 'N/D'}</p>
                                            ) : (
                                                <p>P.IVA: {(selectedClientObj as InstitutionalClient).vatNumber || 'N/D'}</p>
                                            )}
                                            <p>{selectedClientObj.address || ''} {selectedClientObj.city ? `, ${selectedClientObj.city}` : ''}</p>
                                            <p className="text-slate-400">{selectedClientObj.email}</p>
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={() => { setClientId(''); setClientName(''); }} className="text-xs font-bold text-red-400 hover:text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 transition-colors">
                                    CAMBIA
                                </button>
                            </div>
                        )}
                    </div>

                    {/* DATI DOCUMENTO (Colonna Piccola - Destra) */}
                    <div className="md:col-span-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Emissione</label>
                                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scadenza</label>
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Metodo Pagamento</label>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Numero (Opzionale)</label>
                            <input 
                                type="text" 
                                value={invoiceNumber} 
                                onChange={e => setInvoiceNumber(e.target.value)} 
                                placeholder="Automatico se vuoto" 
                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-200" 
                            />
                        </div>
                    </div>
                </div>

                {/* 2. ITEMS TABLE (Professional Grid) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <div className="col-span-5">Descrizione</div>
                        <div className="col-span-1 text-center">Q.tà</div>
                        <div className="col-span-2 text-right">Prezzo Unit.</div>
                        <div className="col-span-2 text-right">Sconto</div>
                        <div className="col-span-2 text-right">Totale</div>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {items.map((item, idx) => {
                            const gross = item.quantity * item.price;
                            const discountVal = item.discountType === 'percent' ? gross * (item.discount || 0) / 100 : (item.discount || 0);
                            const net = gross - discountVal;

                            return (
                                <div key={idx} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-slate-50 transition-colors group">
                                    <div className="col-span-5 pr-4">
                                        <input 
                                            type="text" 
                                            value={item.description} 
                                            onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                                            placeholder="Descrizione servizio..."
                                            className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0"
                                        />
                                        <input 
                                            type="text" 
                                            value={item.notes || ''} 
                                            onChange={e => handleItemChange(idx, 'notes', e.target.value)} 
                                            placeholder="Note riga (opzionale)"
                                            className="w-full bg-transparent border-none p-0 text-xs text-slate-500 placeholder:text-slate-200 focus:ring-0 mt-0.5"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <input type="number" step="0.5" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-full text-center bg-gray-50 border border-gray-200 rounded p-1 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-200" />
                                    </div>
                                    <div className="col-span-2 pl-2">
                                        <input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="w-full text-right bg-gray-50 border border-gray-200 rounded p-1 text-xs text-slate-700 font-mono focus:bg-white focus:ring-1 focus:ring-indigo-200" />
                                    </div>
                                    <div className="col-span-2 pl-2 flex items-center justify-end gap-1">
                                        <input 
                                            type="number" 
                                            value={item.discount || 0} 
                                            onChange={e => handleItemChange(idx, 'discount', Number(e.target.value))} 
                                            className={`w-16 text-right border border-gray-200 rounded p-1 text-xs ${item.discount ? 'bg-yellow-50 text-yellow-700 font-bold border-yellow-200' : 'bg-gray-50 text-slate-400'}`}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => handleItemChange(idx, 'discountType', item.discountType === 'percent' ? 'amount' : 'percent')}
                                            className="text-[9px] font-bold text-slate-400 bg-gray-100 px-1 py-1 rounded hover:bg-gray-200 w-5 text-center"
                                        >
                                            {item.discountType === 'percent' ? '%' : '€'}
                                        </button>
                                    </div>
                                    <div className="col-span-2 text-right pl-4 relative flex items-center justify-end">
                                        <span className="font-bold text-slate-700 text-sm">{net.toFixed(2)}€</span>
                                        <button type="button" onClick={() => handleRemoveItem(idx)} className="absolute -right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-3 bg-gray-50 border-t border-gray-200">
                        <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                            <PlusIcon /> Aggiungi Riga
                        </button>
                    </div>
                </div>

                {/* 3. FOOTER (Notes & Totals) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    
                    {/* Note & SDI */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dati Bancari / Note</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-slate-600 focus:ring-2 focus:ring-indigo-200 resize-none h-24"
                                placeholder="IBAN, Scadenze..." 
                            />
                        </div>
                        
                        <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Codice SDI / PEC</label>
                            <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} placeholder="0000000" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-mono" />
                        </div>
                    </div>

                    {/* Totals Calculation */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Imponibile Lordo</span>
                            <span className="font-mono">{subtotal.toFixed(2)}€</span>
                        </div>
                        
                        {/* Global Discount Input */}
                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span className="flex items-center gap-2">
                                Sconto Globale
                                <select 
                                    value={globalDiscountType} 
                                    onChange={e => setGlobalDiscountType(e.target.value as any)} 
                                    className="text-[10px] bg-gray-100 border-none rounded py-0.5 px-1 cursor-pointer"
                                >
                                    <option value="amount">€</option>
                                    <option value="percent">%</option>
                                </select>
                            </span>
                            <input 
                                type="number" 
                                value={globalDiscount} 
                                onChange={e => setGlobalDiscount(Number(e.target.value))}
                                className="w-20 text-right bg-gray-50 border border-gray-200 rounded p-1 font-mono text-sm focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Summary Lines */}
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-sm text-red-500 font-medium">
                                <span>Totale Sconto</span>
                                <span className="font-mono">-{totalDiscount.toFixed(2)}€</span>
                            </div>
                        )}

                        <div className="border-t border-dashed border-gray-200 my-2"></div>

                        <div className="flex justify-between text-sm font-bold text-slate-700">
                            <span>Imponibile Netto</span>
                            <span className="font-mono">{taxable.toFixed(2)}€</span>
                        </div>

                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span className="flex items-center gap-2">
                                Bollo Virtuale (2€)
                                <input 
                                    type="checkbox" 
                                    checked={stampDuty > 0} 
                                    onChange={() => setManualStampDuty(!manualStampDuty)} 
                                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                                    title="Forza applicazione bollo"
                                />
                            </span>
                            <span className="font-mono">{stampDuty.toFixed(2)}€</span>
                        </div>

                        <div className="border-t-2 border-slate-800 pt-3 mt-3 flex justify-between items-end">
                            <span className="text-base font-black text-slate-800 uppercase">Totale da Pagare</span>
                            <span className="text-2xl font-black text-indigo-700">{grandTotal.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- ACTION BAR --- */}
            <div className="px-8 py-4 bg-white border-t border-gray-200 flex justify-between items-center flex-shrink-0 z-20">
                <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800 font-bold text-sm px-4">Annulla</button>
                <div className="flex gap-3">
                    <button type="button" onClick={handlePreview} className="md-btn md-btn-flat text-indigo-600 border border-indigo-100 hover:bg-indigo-50">Anteprima PDF</button>
                    <button type="submit" className="md-btn md-btn-raised md-btn-primary px-8">Salva Fattura</button>
                </div>
            </div>
        </form>
    );
};

export default InvoiceEditForm;
