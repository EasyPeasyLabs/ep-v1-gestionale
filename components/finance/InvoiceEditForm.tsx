
import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceInput, DocumentStatus, PaymentMethod, DocumentItem } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';

const InvoiceEditForm: React.FC<{
    invoice: Invoice;
    onSave: (data: Partial<InvoiceInput>) => void;
    onCancel: () => void;
}> = ({ invoice, onSave, onCancel }) => {
    const [issueDate, setIssueDate] = useState(invoice.issueDate.split('T')[0]);
    const [dueDate, setDueDate] = useState(invoice.dueDate.split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod);
    const [notes, setNotes] = useState(invoice.notes || '');
    const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
    const [sdiId, setSdiId] = useState(invoice.sdiId || '');
    
    const [items, setItems] = useState<DocumentItem[]>(invoice.items || []);
    const [totalAmount, setTotalAmount] = useState(invoice.totalAmount);

    useEffect(() => {
        const sum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        const stampDuty = invoice.hasStampDuty ? 2 : 0;
        setTotalAmount(sum + stampDuty);
    }, [items, invoice.hasStampDuty]);

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, price: 0, notes: '' }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            invoiceNumber,
            totalAmount,
            items,
            sdiId: invoice.status === DocumentStatus.SealedSDI ? sdiId : invoice.sdiId,
            issueDate: new Date(issueDate).toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            paymentMethod,
            notes
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b flex-shrink-0 bg-white z-10">
                <h3 className="text-xl font-bold text-gray-800">Modifica Fattura</h3>
                <p className="text-sm text-gray-500">{invoice.clientName}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="md-input-group col-span-2">
                        <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="md-input font-mono font-bold" required />
                        <label className="md-input-label">Numero Fattura</label>
                    </div>
                    <div className="md-input-group">
                        <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Emissione</label>
                    </div>
                    <div className="md-input-group">
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Scadenza</label>
                    </div>
                    <div className="md-input-group col-span-2">
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label className="md-input-label !top-0">Metodo Pagamento</label>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Righe Documento</h4>
                    <div className="space-y-3">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white p-2 border rounded shadow-sm">
                                <div className="flex-1 space-y-2">
                                    <input 
                                        type="text" 
                                        value={item.description} 
                                        onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                                        className="w-full text-sm font-medium border-b border-gray-200 focus:border-indigo-500 outline-none pb-1"
                                        placeholder="Descrizione..."
                                    />
                                    <div className="flex gap-2">
                                        <div className="w-20">
                                            <label className="text-[10px] text-gray-400 block">Q.tà</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                value={item.quantity} 
                                                onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} 
                                                className="w-full text-xs border rounded p-1 bg-gray-50"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] text-gray-400 block">Prezzo Unit.</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={item.price} 
                                                onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} 
                                                className="w-full text-xs border rounded p-1 bg-gray-50 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex-1 text-right self-end pb-1">
                                            <span className="text-xs font-bold text-gray-700">{(item.quantity * item.price).toFixed(2)}€</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1 mt-1">
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddItem} className="mt-3 text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                        <PlusIcon /> Aggiungi Riga
                    </button>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-indigo-800">Bollo Virtuale</span>
                        <span className="text-sm font-bold text-indigo-800">{invoice.hasStampDuty ? '2.00€' : '0.00€'}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-indigo-200 pt-2">
                        <span className="text-lg font-bold text-indigo-900">TOTALE</span>
                        <span className="text-xl font-black text-indigo-900">{totalAmount.toFixed(2)}€</span>
                    </div>
                    <p className="text-[10px] text-indigo-400 mt-1 text-right italic">Calcolato automaticamente</p>
                </div>

                {invoice.status === DocumentStatus.SealedSDI && (
                    <div className="md-input-group bg-green-50 p-3 rounded border border-green-200">
                        <input type="text" value={sdiId} onChange={e => setSdiId(e.target.value)} className="md-input bg-transparent font-mono" />
                        <label className="md-input-label !top-0 text-green-700">ID Sigillo SDI (Modificabile)</label>
                    </div>
                )}

                <div className="md-input-group">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input" rows={3} placeholder=" " />
                    <label className="md-input-label">Note</label>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0 z-10">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva Modifiche</button>
            </div>
        </form>
    );
};

export default InvoiceEditForm;
