
import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, InvoiceInput, DocumentStatus, PaymentMethod, DocumentItem, Client, ClientType, ParentClient, InstitutionalClient, CompanyInfo } from '../../types';
import { generateDocumentPDF } from '../../utils/pdfGenerator';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import SearchIcon from '../icons/SearchIcon';

const InvoiceEditForm: React.FC<{
    invoice: Invoice;
    clients?: Client[];
    companyInfo?: CompanyInfo | null;
    onSave: (data: InvoiceInput) => void;
    onCancel: () => void;
}> = ({ invoice, clients = [], companyInfo, onSave, onCancel }) => {
    const [issueDate, setIssueDate] = useState(invoice.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(invoice.dueDate ? invoice.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod || PaymentMethod.BankTransfer);
    const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber || '');
    const [status, setStatus] = useState<DocumentStatus>(invoice.status || DocumentStatus.Draft);
    const [sdiId, setSdiId] = useState(invoice.sdiId || '');
    const [notes, setNotes] = useState(invoice.notes || '');
    const [clientId, setClientId] = useState(invoice.clientId || '');
    const [clientName, setClientName] = useState(invoice.clientName || '');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>(invoice.items || []);
    const [globalDiscount, setGlobalDiscount] = useState<number>(invoice.globalDiscount || 0);
    const [globalDiscountType, setGlobalDiscountType] = useState<'percent' | 'amount'>(invoice.globalDiscountType || 'amount');
    const [manualStampDuty, setManualStampDuty] = useState(invoice.hasStampDuty);

    useEffect(() => {
        if (!invoice.id && !notes && companyInfo) {
            const bankDetails = companyInfo.iban 
                ? `Coordinate Bancarie:\nIBAN: ${companyInfo.iban}\nIntestato a: ${companyInfo.name}`
                : "";
            setNotes(bankDetails);
        }
    }, [invoice.id, companyInfo]);

    const filteredClients = useMemo(() => {
        if (!clientSearchTerm) return clients.slice(0, 10);
        return clients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                : (c as InstitutionalClient).companyName;
            return name.toLowerCase().includes(clientSearchTerm.toLowerCase());
        });
    }, [clients, clientSearchTerm]);

    const { taxable, stampDuty, grandTotal } = useMemo(() => {
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
            taxable: taxableBase,
            stampDuty: stamp,
            grandTotal: taxableBase + stamp
        };
    }, [items, globalDiscount, globalDiscountType, manualStampDuty]);

    const selectedClientObj = useMemo(() => clients.find(c => c.id === clientId), [clientId, clients]);

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
            clientName,
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
        if (sdiId && sdiId.trim().length > 0) {
            dataToSave.status = DocumentStatus.SealedSDI;
        }
        onSave(dataToSave);
    };

    const handlePreview = async () => {
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
        const blobUrl = await generateDocumentPDF(tempInvoice, 'Fattura', companyInfo || null, selectedClientObj, true);
        if (typeof blobUrl === 'string') {
            window.open(blobUrl, '_blank');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-gray-50 overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center flex-shrink-0 shadow-sm z-20">
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        {invoice.id ? 'Modifica Fattura' : 'Nuova Fattura'}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{invoiceNumber || 'Assegnazione automatica'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <select value={status} onChange={e => setStatus(e.target.value as DocumentStatus)} className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded py-1.5 px-3 focus:ring-2 focus:ring-indigo-200 outline-none">
                        <option value={DocumentStatus.Draft}>Bozza</option>
                        <option value={DocumentStatus.Sent}>Inviata</option>
                        <option value={DocumentStatus.Paid}>Pagata</option>
                        <option value={DocumentStatus.PendingSDI}>In Attesa SDI</option>
                        <option value={DocumentStatus.SealedSDI}>Sigillata SDI</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Destinatario</label>
                        {!clientId ? (
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors" placeholder="Cerca cliente..." value={clientName || clientSearchTerm} onChange={(e) => { setClientName(e.target.value); setClientSearchTerm(e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)} />
                                {showClientDropdown && clientSearchTerm && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {filteredClients.map(c => {
                                            const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;
                                            return (
                                                <button key={c.id} type="button" onClick={() => handleClientSelect(c)} className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors">
                                                    <span className="block text-sm font-bold text-slate-700">{name}</span>
                                                    <span className="block text-xs text-slate-400">{c.email}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <div><h4 className="text-base font-bold text-indigo-900">{clientName}</h4><p className="text-xs text-slate-500 mt-1">{selectedClientObj?.email}</p></div>
                                <button type="button" onClick={() => { setClientId(''); setClientName(''); }} className="text-xs font-bold text-indigo-600 hover:underline">CAMBIA</button>
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="md-input-group !mb-0">
                            <input 
                                type="text" 
                                value={invoiceNumber} 
                                onChange={e => setInvoiceNumber(e.target.value.toUpperCase())} 
                                className="md-input !py-2 !px-3 text-sm font-mono font-bold" 
                                placeholder=" "
                            />
                            <label className="md-input-label !top-[-10px] !text-[10px] !bg-white">Numero Documento</label>
                            {invoice.id && invoiceNumber !== invoice.invoiceNumber && (
                                <p className="text-[9px] text-amber-600 font-bold mt-1 animate-pulse">
                                    ⚠️ Attenzione: modifica manuale in corso
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="md-input-group !mb-0"><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="md-input !py-2 !px-3 text-xs" required /><label className="md-input-label !top-[-10px] !text-[10px] !bg-white">Data Emissione</label></div>
                            <div className="md-input-group !mb-0"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="md-input !py-2 !px-3 text-xs" required /><label className="md-input-label !top-[-10px] !text-[10px] !bg-white">Data Scadenza</label></div>
                        </div>
                        <div className="md-input-group !mb-0"><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input !py-2 !px-3 text-xs">{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}</select><label className="md-input-label !top-[-10px] !text-[10px] !bg-white">Metodo Pagamento</label></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[850px]">
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
                                                <input type="text" value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} placeholder="Descrizione..." className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0" />
                                                <input type="text" value={item.notes || ''} onChange={e => handleItemChange(idx, 'notes', e.target.value)} placeholder="Note opzionali" className="w-full bg-transparent border-none p-0 text-xs text-slate-400 placeholder:text-slate-200 focus:ring-0 mt-0.5" />
                                            </div>
                                            <div className="col-span-1"><input type="number" step="0.5" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-full text-center bg-gray-50 border border-gray-200 rounded p-1 text-xs text-slate-700" /></div>
                                            <div className="col-span-2 pl-2"><input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="w-full text-right bg-gray-50 border border-gray-200 rounded p-1 text-xs text-slate-700 font-mono" /></div>
                                            <div className="col-span-2 pl-2 flex items-center justify-end gap-1">
                                                <input type="number" value={item.discount || 0} onChange={e => handleItemChange(idx, 'discount', Number(e.target.value))} className="w-16 text-right border border-gray-200 rounded p-1 text-xs" />
                                                <button type="button" onClick={() => handleItemChange(idx, 'discountType', item.discountType === 'percent' ? 'amount' : 'percent')} className="text-[9px] font-bold text-slate-400 bg-gray-100 px-1 py-1 rounded w-5 text-center">{item.discountType === 'percent' ? '%' : '€'}</button>
                                            </div>
                                            <div className="col-span-2 text-right pl-4 relative flex items-center justify-end">
                                                <span className="font-bold text-slate-700 text-sm">{net.toFixed(2)}€</span>
                                                <button type="button" onClick={() => handleRemoveItem(idx)} className="absolute -right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="p-3 bg-gray-50 border-t border-gray-200">
                        <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><PlusIcon /> Aggiungi riga</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4">
                        <div className="md-input-group !mb-0"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input !h-32 text-sm" placeholder=" "/><label className="md-input-label !top-[-10px] !text-[10px] !bg-white">Note & Coordinate</label></div>
                        <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sigillo Fiscale SDI</label>
                            <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} placeholder="Inserisci Codice SDI o PEC" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-mono font-bold text-indigo-700 shadow-inner" />
                        </div>
                    </div>
                    <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                        <div className="flex justify-between items-center text-xs opacity-70"><span>Imponibile Netto</span><span className="font-mono text-base font-bold">{taxable.toFixed(2)}€</span></div>
                        <div className="flex justify-between items-center text-xs opacity-70"><span>Bollo Virtuale</span><span className="font-mono text-base font-bold">{stampDuty.toFixed(2)}€</span></div>
                        <div className="border-t border-white/10 pt-4 flex justify-between items-baseline">
                            <span className="text-base font-bold uppercase tracking-tight">Totale Documento</span>
                            <span className="text-3xl font-black text-amber-400">{grandTotal.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-between items-center flex-shrink-0 z-20">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat text-sm font-bold">Annulla</button>
                <div className="flex gap-2">
                    <button type="button" onClick={handlePreview} className="md-btn md-btn-flat border border-indigo-100 text-indigo-600 text-xs font-bold uppercase">Anteprima PDF</button>
                    <button type="submit" className="md-btn md-btn-raised md-btn-primary px-10 text-xs font-black uppercase tracking-widest">Salva Fattura</button>
                </div>
            </div>
        </form>
    );
};

export default InvoiceEditForm;
