
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
    // Basic Info
    const [issueDate, setIssueDate] = useState(quote?.issueDate ? quote.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState(quote?.expiryDate ? quote.expiryDate.split('T')[0] : '');
    
    // Client Selection
    const [selectedClientId, setSelectedClientId] = useState(quote?.clientId || '');
    const [clientSearch, setClientSearch] = useState('');
    
    // Items
    const [items, setItems] = useState<DocumentItem[]>(quote?.items || [{ description: '', quantity: 1, price: 0, notes: '' }]);
    
    // Installments (Piano Rateale)
    const [installments, setInstallments] = useState<Installment[]>(quote?.installments || []);
    
    // Notes
    const [notes, setNotes] = useState(quote?.notes || '');
    
    // Totals
    const [totalAmount, setTotalAmount] = useState(0);

    // Filter Clients
    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                : (c as InstitutionalClient).companyName;
            return name.toLowerCase().includes(clientSearch.toLowerCase());
        });
    }, [clients, clientSearch]);

    // Calculate Total
    useEffect(() => {
        const sum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        // Bollo virtuale su preventivi? Solitamente no, ma se serve lo aggiungiamo. 
        // Qui calcoliamo il totale puro.
        setTotalAmount(sum);
    }, [items]);

    // Set Expiry default (30 days)
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

    // Installment Logic
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
            quoteNumber: quote?.quoteNumber || '', // Generato dal backend se nuovo
            isDeleted: false
        };

        if (quote?.id) onSave({ ...data, id: quote.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b flex-shrink-0 bg-white">
                <h3 className="text-xl font-bold text-gray-800">{quote ? 'Modifica Preventivo' : 'Nuovo Preventivo'}</h3>
                <p className="text-sm text-gray-500">Crea una proposta commerciale professionale.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Cliente & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Destinatario</label>
                        {!selectedClientId ? (
                            <div className="relative">
                                <SearchIcon />
                                <input 
                                    type="text" 
                                    className="md-input pl-8" 
                                    placeholder="Cerca cliente..." 
                                    value={clientSearch}
                                    onChange={e => setClientSearch(e.target.value)}
                                />
                                <div className="absolute z-10 w-full bg-white border shadow-lg max-h-40 overflow-y-auto mt-1 rounded-md">
                                    {filteredClients.map(c => {
                                        const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;
                                        return (
                                            <div 
                                                key={c.id} 
                                                onClick={() => { setSelectedClientId(c.id); setClientSearch(''); }}
                                                className="p-2 hover:bg-indigo-50 cursor-pointer text-sm"
                                            >
                                                {name}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <span className="font-bold text-indigo-900">
                                    {clients.find(c => c.id === selectedClientId)?.clientType === ClientType.Parent 
                                        ? `${(clients.find(c => c.id === selectedClientId) as ParentClient).firstName} ${(clients.find(c => c.id === selectedClientId) as ParentClient).lastName}`
                                        : (clients.find(c => c.id === selectedClientId) as InstitutionalClient)?.companyName}
                                </span>
                                <button type="button" onClick={() => setSelectedClientId('')} className="text-xs text-red-500 font-bold hover:underline">Cambia</button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <div className="md-input-group flex-1">
                            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="md-input" required />
                            <label className="md-input-label !top-0">Data Emissione</label>
                        </div>
                        <div className="md-input-group flex-1">
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="md-input" required />
                            <label className="md-input-label !top-0">Scadenza Validità</label>
                        </div>
                    </div>
                </div>

                {/* 2. Articoli */}
                <div>
                    <div className="flex justify-between items-center mb-2 border-b pb-1">
                        <h4 className="text-xs font-bold text-gray-500 uppercase">Dettaglio Servizi</h4>
                        <button type="button" onClick={addItem} className="text-xs text-indigo-600 font-bold flex items-center hover:bg-indigo-50 px-2 py-1 rounded">
                            <PlusIcon /> Aggiungi Riga
                        </button>
                    </div>
                    <div className="space-y-2">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-200">
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        placeholder="Descrizione..." 
                                        value={item.description} 
                                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                        className="w-full bg-transparent text-sm border-b border-gray-300 focus:border-indigo-500 outline-none pb-1 mb-1"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Note opzionali..." 
                                        value={item.notes} 
                                        onChange={e => handleItemChange(idx, 'notes', e.target.value)}
                                        className="w-full bg-transparent text-xs text-gray-500 outline-none"
                                    />
                                </div>
                                <div className="w-16">
                                    <input 
                                        type="number" 
                                        value={item.quantity} 
                                        onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                        className="w-full text-right text-sm border rounded p-1"
                                        placeholder="Qt."
                                    />
                                </div>
                                <div className="w-24">
                                    <input 
                                        type="number" 
                                        value={item.price} 
                                        onChange={e => handleItemChange(idx, 'price', Number(e.target.value))}
                                        className="w-full text-right text-sm border rounded p-1 font-mono"
                                        placeholder="€"
                                    />
                                </div>
                                <div className="w-20 text-right font-bold text-sm self-center">
                                    {(item.quantity * item.price).toFixed(2)}€
                                </div>
                                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 self-center"><TrashIcon /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end mt-4 text-xl font-black text-slate-800">
                        Totale: {totalAmount.toFixed(2)}€
                    </div>
                </div>

                {/* 3. Piano Rateale (Opzionale) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                            <span>📅</span> Piano Pagamenti Proposto
                        </h4>
                        <button type="button" onClick={addInstallment} className="text-xs bg-white border shadow-sm px-2 py-1 rounded hover:bg-slate-100">
                            + Aggiungi Rata
                        </button>
                    </div>
                    
                    {installments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nessun piano rateale definito. Il pagamento si intende in soluzione unica.</p>
                    ) : (
                        <div className="space-y-2">
                            {installments.map((inst, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input 
                                        type="text" 
                                        value={inst.description} 
                                        onChange={e => handleInstallmentChange(idx, 'description', e.target.value)}
                                        className="flex-1 text-xs border rounded p-1.5"
                                        placeholder="Descrizione (es. Acconto)"
                                    />
                                    <input 
                                        type="date" 
                                        value={inst.dueDate ? inst.dueDate.split('T')[0] : ''} 
                                        onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)}
                                        className="w-32 text-xs border rounded p-1.5"
                                    />
                                    <input 
                                        type="number" 
                                        value={inst.amount} 
                                        onChange={e => handleInstallmentChange(idx, 'amount', Number(e.target.value))}
                                        className="w-24 text-xs border rounded p-1.5 text-right font-mono"
                                    />
                                    <button type="button" onClick={() => removeInstallment(idx)} className="text-red-400 hover:text-red-600"><TrashIcon /></button>
                                </div>
                            ))}
                            <div className="text-right text-xs text-slate-500 mt-2">
                                Totale Rateizzato: <strong>{installments.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}€</strong>
                                {Math.abs(totalAmount - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.01 && (
                                    <span className="text-red-500 ml-2">(Differenza: {(totalAmount - installments.reduce((sum, i) => sum + i.amount, 0)).toFixed(2)}€)</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="md-input-group">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input" rows={3} placeholder="Note aggiuntive per il cliente..." />
                    <label className="md-input-label">Note</label>
                </div>

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva Preventivo</button>
            </div>
        </form>
    );
};

export default QuoteForm;
