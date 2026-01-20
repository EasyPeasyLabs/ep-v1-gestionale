
import React, { useState, useEffect, useMemo } from 'react';
import { Quote, QuoteInput, Client, ClientType, ParentClient, InstitutionalClient, DocumentItem, Installment, DocumentStatus } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import SearchIcon from '../icons/SearchIcon';

const QuoteForm: React.FC<{
    quote?: Quote | null;
    clients: Client[];
    onSave: (data: QuoteInput | Quote) => void;
    onCancel: () => void;
}> = ({ quote, clients, onSave, onCancel }) => {
    const [issueDate, setIssueDate] = useState(quote?.issueDate ? quote.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState(quote?.expiryDate ? quote.expiryDate.split('T')[0] : '');
    const [selectedClientId, setSelectedClientId] = useState(quote?.clientId || '');
    const [clientSearch, setClientSearch] = useState('');
    const [items, setItems] = useState<DocumentItem[]>(quote?.items || [{ description: '', quantity: 1, price: 0, notes: '' }]);
    const [installments, setInstallments] = useState<Installment[]>(quote?.installments || []);
    const [notes, setNotes] = useState(quote?.notes || '');
    const [totalAmount, setTotalAmount] = useState(0);

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                : (c as InstitutionalClient).companyName;
            return name.toLowerCase().includes(clientSearch.toLowerCase());
        });
    }, [clients, clientSearch]);

    useEffect(() => {
        const sum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        setTotalAmount(sum);
    }, [items]);

    useEffect(() => {
        if (!quote && !expiryDate) {
            const d = new Date(issueDate);
            d.setDate(d.getDate() + 30);
            setExpiryDate(d.toISOString().split('T')[0]);
        }
    }, [issueDate, quote]);

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const addInstallment = () => setInstallments([...installments, { description: 'Rata', dueDate: '', amount: 0, isPaid: false }]);
    const removeInstallment = (idx: number) => setInstallments(installments.filter((_, i) => i !== idx));
    const handleInstallmentChange = (idx: number, field: keyof Installment, value: any) => {
        const newInst = [...installments];
        newInst[idx] = { ...newInst[idx], [field]: value };
        setInstallments(newInst);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const client = clients.find(c => c.id === selectedClientId);
        const clientName = client 
            ? (client.clientType === ClientType.Parent ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}` : (client as InstitutionalClient).companyName)
            : 'Cliente Occasionale';

        const data: QuoteInput = {
            clientId: selectedClientId,
            clientName,
            issueDate: new Date(issueDate).toISOString(),
            expiryDate: new Date(expiryDate).toISOString(),
            items,
            totalAmount,
            installments,
            notes,
            status: quote?.status || DocumentStatus.Draft,
            quoteNumber: quote?.quoteNumber || '',
            isDeleted: false
        };
        if (quote?.id) onSave({ ...data, id: quote.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden bg-gray-50">
            <div className="p-6 border-b bg-white flex-shrink-0">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {quote ? 'Modifica Preventivo' : 'Nuovo Preventivo'}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Destinatario</label>
                        {!selectedClientId ? (
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input type="text" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors" placeholder="Cerca cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                                {clientSearch && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                        {filteredClients.map(c => {
                                            const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;
                                            return (
                                                <div key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch(''); }} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm font-bold border-b last:border-0">{name}</div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <span className="font-bold text-indigo-900 text-base">{clients.find(c => c.id === selectedClientId)?.clientType === ClientType.Parent ? `${(clients.find(c => c.id === selectedClientId) as ParentClient).firstName} ${(clients.find(c => c.id === selectedClientId) as ParentClient).lastName}` : (clients.find(c => c.id === selectedClientId) as InstitutionalClient)?.companyName}</span>
                                <button type="button" onClick={() => setSelectedClientId('')} className="text-xs font-black text-red-500 hover:underline uppercase">Cambia</button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="md-input-group !mb-0"><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="md-input font-bold" required /><label className="md-input-label !top-[-10px] !text-[10px] !bg-gray-50">Emissione</label></div>
                        <div className="md-input-group !mb-0"><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="md-input font-bold" required /><label className="md-input-label !top-[-10px] !text-[10px] !bg-gray-50">Scadenza</label></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Dettaglio Servizi</h4>
                        <button type="button" onClick={addItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-tighter"><PlusIcon /> Aggiungi riga</button>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[650px] p-4 space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-3 items-start group">
                                    <div className="flex-1 min-w-0"><input type="text" placeholder="Descrizione servizio..." value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-b border-gray-200 pb-1 focus:border-indigo-500 outline-none" /><input type="text" placeholder="Note riga (opzionale)" value={item.notes} onChange={e => handleItemChange(idx, 'notes', e.target.value)} className="w-full text-[10px] text-slate-400 border-none p-0 outline-none mt-1" /></div>
                                    <div className="w-20"><input type="number" step="0.5" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-full text-center text-sm border border-gray-200 rounded p-1.5 focus:ring-1 focus:ring-indigo-500" /></div>
                                    <div className="w-28"><input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="w-full text-right text-sm border border-gray-200 rounded p-1.5 font-mono" /></div>
                                    <div className="w-24 text-right font-black text-slate-800 text-sm self-center">{(item.quantity * item.price).toFixed(2)}€</div>
                                    <button type="button" onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 self-center p-1"><TrashIcon /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">Imponibile Totale</span>
                        <span className="text-2xl font-black text-amber-400">{totalAmount.toFixed(2)}€</span>
                    </div>
                </div>

                <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><span>🗓️</span> Piano Pagamenti Proposto</h4>
                        <button type="button" onClick={addInstallment} className="text-[10px] font-black bg-white border border-slate-300 px-3 py-1.5 rounded-full shadow-sm hover:bg-slate-50 uppercase tracking-tighter transition-all">+ Aggiungi rata</button>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[500px] space-y-2">
                            {installments.map((inst, idx) => (
                                <div key={idx} className="flex gap-3 items-center bg-white/50 p-2 rounded-xl border border-white">
                                    <input type="text" value={inst.description} onChange={e => handleInstallmentChange(idx, 'description', e.target.value)} className="flex-1 text-xs font-bold border-none bg-transparent focus:ring-0" placeholder="Es: I Rata (Acconto)" />
                                    <input type="date" value={inst.dueDate ? inst.dueDate.split('T')[0] : ''} onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} className="w-36 text-xs font-bold border border-slate-200 rounded p-1.5" />
                                    <input type="number" step="0.01" value={inst.amount} onChange={e => handleInstallmentChange(idx, 'amount', Number(e.target.value))} className="w-24 text-xs font-black border border-slate-200 rounded p-1.5 text-right font-mono" />
                                    <button type="button" onClick={() => removeInstallment(idx)} className="text-red-400 hover:text-red-600 p-1"><TrashIcon /></button>
                                </div>
                            ))}
                            {installments.length > 0 && (
                                <div className="text-right pt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Somma Rate: </span>
                                    <span className={`text-sm font-black ${Math.abs(totalAmount - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{installments.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}€</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="md-input-group !mb-0"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input !h-24 text-sm" placeholder=" "/><label className="md-input-label !top-[-10px] !text-[10px] !bg-gray-50">Annotazioni per il Cliente</label></div>
            </div>

            <div className="p-4 border-t bg-white flex justify-between items-center flex-shrink-0 z-20">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat text-sm font-bold">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary px-12 text-xs font-black uppercase tracking-widest shadow-xl">Salva Proposta</button>
            </div>
        </form>
    );
};

export default QuoteForm;
