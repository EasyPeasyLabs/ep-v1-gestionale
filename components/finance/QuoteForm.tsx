
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Quote, QuoteInput, Client, ClientType, ParentClient, InstitutionalClient, DocumentItem, Installment, DocumentStatus, CompanyInfo } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import SearchIcon from '../icons/SearchIcon';
import CalculatorIcon from '../icons/CalculatorIcon';

const QuoteForm: React.FC<{
    quote?: Quote | null;
    clients: Client[];
    companyInfo?: CompanyInfo | null;
    onSave: (data: QuoteInput | Quote) => void;
    onCancel: () => void;
}> = ({ quote, clients, companyInfo, onSave, onCancel }) => {
    // Basic Info
    const [issueDate, setIssueDate] = useState(quote?.issueDate ? quote.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState(quote?.expiryDate ? quote.expiryDate.split('T')[0] : '');
    const [selectedClientId, setSelectedClientId] = useState(quote?.clientId || '');
    const [clientSearch, setClientSearch] = useState('');
    
    // Items
    const [items, setItems] = useState<DocumentItem[]>(quote?.items || [{ description: '', quantity: 1, price: 0, notes: '' }]);
    const [totalAmount, setTotalAmount] = useState(0);
    
    // Payment Configuration Wizard State
    const [paymentStrategy, setPaymentStrategy] = useState<'single' | 'multiple'>('single');
    const [installmentsCount, setInstallmentsCount] = useState<number>(2);
    const [paymentTerms, setPaymentTerms] = useState<string>('immed'); // immed, 30df, 60df, 30dffm, 60dffm
    const [paymentMode, setPaymentMode] = useState<string>('bank_transfer'); // bank_transfer, direct_cash, direct_check, direct_paypal
    
    // Generated Plan
    const [installments, setInstallments] = useState<Installment[]>(quote?.installments || []);
    const [notes, setNotes] = useState(quote?.notes || '');

    // Init Logic
    useEffect(() => {
        if (quote?.installments && quote.installments.length > 1) {
            setPaymentStrategy('multiple');
            setInstallmentsCount(quote.installments.length);
        }
    }, [quote]);

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const name = c.clientType === ClientType.Parent 
                ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                : (c as InstitutionalClient).companyName;
            return name.toLowerCase().includes(clientSearch.toLowerCase());
        });
    }, [clients, clientSearch]);

    // Total Calculation
    useEffect(() => {
        const sum = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        setTotalAmount(sum);
    }, [items]);

    // Auto Expiry Date
    useEffect(() => {
        if (!quote && !expiryDate) {
            const d = new Date(issueDate);
            d.setDate(d.getDate() + 30);
            setExpiryDate(d.toISOString().split('T')[0]);
        }
    }, [issueDate, quote]);

    // --- PAYMENT WIZARD LOGIC ---

    // 1. Calculate EFFECTIVE Date based on Base Date + Global Terms
    const calculateEffectiveDate = useCallback((baseDateStr: string, term: string): string => {
        if (!baseDateStr) return '';
        const d = new Date(baseDateStr);
        
        if (term === '30df') {
            d.setDate(d.getDate() + 30);
        } else if (term === '60df') {
            d.setDate(d.getDate() + 60);
        } else if (term === '30dffm') {
            d.setDate(d.getDate() + 30);
            // Fine mese successivo al calcolo dei 30gg
            // Setto al primo del mese successivo, poi torno indietro di 1 giorno
            d.setMonth(d.getMonth() + 1);
            d.setDate(0); 
        } else if (term === '60dffm') {
            d.setDate(d.getDate() + 60);
            d.setMonth(d.getMonth() + 1);
            d.setDate(0);
        }
        
        return d.toISOString().split('T')[0];
    }, []);

    // 2. Helper for term label
    const getTermLabel = (term: string) => {
        switch(term) {
            case 'immed': return 'Immediato';
            case '30df': return '+30gg';
            case '60df': return '+60gg';
            case '30dffm': return '+30gg FM';
            case '60dffm': return '+60gg FM';
            default: return '';
        }
    };

    // 3. Initialize/Reset Structure (Only on Strategy/Count change)
    useEffect(() => {
        // Prevent overwrite on initial load if quote exists and matches
        if (quote && installments.length > 0 && installments.length === (paymentStrategy === 'single' ? 1 : installmentsCount)) {
             return; 
        }

        const newInstallments: Installment[] = [];
        
        // Base Date Generation Helper (Monthly Step)
        const getBaseDate = (index: number) => {
            const d = new Date(issueDate);
            d.setMonth(d.getMonth() + index);
            return d.toISOString().split('T')[0];
        };

        if (paymentStrategy === 'single') {
            newInstallments.push({
                description: 'Unica Soluzione',
                dueDate: issueDate, // Base Date initially = Issue Date
                amount: totalAmount,
                isPaid: false
            });
        } else {
            const count = Math.max(2, installmentsCount);
            const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
            let remainder = totalAmount;

            for (let i = 0; i < count; i++) {
                const isLast = i === count - 1;
                const amount = isLast ? Number(remainder.toFixed(2)) : baseAmount;
                remainder -= amount;
                
                let desc = `Rata ${i + 1}`;
                if (i === 0) desc = `Acconto (${Math.round((amount/totalAmount)*100)}%)`;
                if (isLast) desc = `Saldo Finale`;

                newInstallments.push({
                    description: desc,
                    dueDate: getBaseDate(i), // Base Date
                    amount: amount,
                    isPaid: false
                });
            }
        }
        setInstallments(newInstallments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentStrategy, installmentsCount]); 

    // --- FORM HANDLERS ---

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    
    // Manual Installment Edit (Edits the BASE Date/Amount)
    const handleInstallmentChange = (idx: number, field: keyof Installment, value: any) => {
        const newInst = [...installments];
        newInst[idx] = { ...newInst[idx], [field]: value };
        setInstallments(newInst);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Calculate Final Effective Dates for Saving
        const finalInstallments = installments.map(inst => ({
            ...inst,
            dueDate: calculateEffectiveDate(inst.dueDate, paymentTerms)
        }));

        const client = clients.find(c => c.id === selectedClientId);
        const clientName = client 
            ? (client.clientType === ClientType.Parent ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}` : (client as InstitutionalClient).companyName)
            : 'Cliente Occasionale';

        // Validation: Sum check
        const sumInst = installments.reduce((acc, i) => acc + i.amount, 0);
        if (Math.abs(sumInst - totalAmount) > 0.05) {
            if (!confirm(`ATTENZIONE: Il totale delle rate (${sumInst.toFixed(2)}€) non corrisponde al totale del preventivo (${totalAmount.toFixed(2)}€). Vuoi salvare comunque?`)) {
                return;
            }
        }

        let methodStr = "";
        if (paymentMode === 'bank_transfer') methodStr = "Bonifico Bancario";
        else if (paymentMode === 'direct_cash') methodStr = "Rimessa Diretta (Contanti)";
        else if (paymentMode === 'direct_check') methodStr = "Rimessa Diretta (Assegno)";
        else if (paymentMode === 'direct_paypal') methodStr = "PayPal / Digital";

        const termsLabel = paymentTerms === 'immed' ? 'Vista Fattura' : 
                           paymentTerms === '30df' ? '30gg DF' : 
                           paymentTerms === '60df' ? '60gg DF' : 
                           paymentTerms === '30dffm' ? '30gg DF FM' : '60gg DF FM';
        methodStr += ` - ${termsLabel}`;

        let finalNotes = notes;
        if (!finalNotes) {
            if (paymentMode === 'bank_transfer' && companyInfo?.iban) {
                finalNotes = `Coordinate Bancarie:\nIBAN: ${companyInfo.iban}\nBeneficiario: ${companyInfo.name}`;
            } else if (paymentMode === 'direct_paypal' && companyInfo?.paypal) {
                finalNotes = `Link pagamento: ${companyInfo.paypal}`;
            }
        }

        const data: QuoteInput = {
            clientId: selectedClientId,
            clientName,
            issueDate: new Date(issueDate).toISOString(),
            expiryDate: new Date(expiryDate).toISOString(),
            items,
            totalAmount,
            installments: finalInstallments, // SAVE EFFECTIVE DATES
            notes: finalNotes,
            paymentMethod: methodStr,
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
                {/* ANAGRAFICA */}
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

                {/* SERVIZI */}
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

                {/* PIANO PAGAMENTI (WIZARD) */}
                <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs"><CalculatorIcon /></span> 
                            Condizioni Commerciali
                        </h4>
                    </div>

                    {/* Area A: Configurazione */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        
                        {/* Strategia */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Strategia Rateale</label>
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                                <button type="button" onClick={() => setPaymentStrategy('single')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${paymentStrategy === 'single' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Unica</button>
                                <button type="button" onClick={() => setPaymentStrategy('multiple')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${paymentStrategy === 'multiple' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Rateale</button>
                            </div>
                            {paymentStrategy === 'multiple' && (
                                <div className="mt-2 flex items-center gap-2 animate-fade-in">
                                    <span className="text-xs font-bold text-slate-600">N. Rate:</span>
                                    <input type="number" min="2" max="24" value={installmentsCount} onChange={e => setInstallmentsCount(Number(e.target.value))} className="w-16 p-1 text-center font-bold border rounded text-sm focus:ring-indigo-500 border-indigo-300 bg-white" />
                                </div>
                            )}
                        </div>

                        {/* Termini */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Termini Pagamento</label>
                            <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="immed">Vista Fattura / Immediato</option>
                                <option value="30df">30 GG Data Fattura</option>
                                <option value="60df">60 GG Data Fattura</option>
                                <option value="30dffm">30 GG D.F. Fine Mese</option>
                                <option value="60dffm">60 GG D.F. Fine Mese</option>
                            </select>
                        </div>

                        {/* Modalità */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Modalità Incasso</label>
                            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="bank_transfer">Bonifico Bancario</option>
                                <option value="direct_cash">Rimessa Diretta (Contanti)</option>
                                <option value="direct_check">Rimessa Diretta (Assegno)</option>
                                <option value="direct_paypal">PayPal / Digital</option>
                            </select>
                            {paymentMode === 'bank_transfer' && companyInfo?.iban && (
                                <p className="text-[9px] text-indigo-600 mt-1 truncate font-mono bg-indigo-50 px-1 rounded">IBAN: {companyInfo.iban}</p>
                            )}
                        </div>
                    </div>

                    {/* Area B: Lista Generata */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 grid grid-cols-12 gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <div className="col-span-5">Descrizione</div>
                            <div className="col-span-4">Data Rif. & Scadenza</div>
                            <div className="col-span-3 text-right">Importo</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {installments.map((inst, idx) => {
                                const effectiveDate = calculateEffectiveDate(inst.dueDate, paymentTerms);
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-4 items-start p-3 hover:bg-slate-50 transition-colors group">
                                        
                                        {/* Descrizione */}
                                        <div className="col-span-5 flex items-center gap-3 pt-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx + 1}</div>
                                            <input type="text" value={inst.description} onChange={e => handleInstallmentChange(idx, 'description', e.target.value)} className="w-full text-xs font-bold border-none bg-transparent focus:ring-0 text-slate-700 p-0" placeholder="Descrizione rata" />
                                        </div>
                                        
                                        {/* Date Section */}
                                        <div className="col-span-4">
                                            <input type="date" value={inst.dueDate ? inst.dueDate.split('T')[0] : ''} onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} className="w-full text-xs font-bold border border-slate-200 rounded p-1.5 text-slate-600 focus:border-indigo-500 mb-1.5" />
                                            <div className="flex items-center gap-2">
                                                {paymentTerms !== 'immed' && (
                                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                                                        {getTermLabel(paymentTerms)}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-black text-emerald-600 whitespace-nowrap flex items-center gap-1">
                                                    → {new Date(effectiveDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Importo */}
                                        <div className="col-span-3 text-right">
                                            <input type="number" step="0.01" value={inst.amount} onChange={e => handleInstallmentChange(idx, 'amount', Number(e.target.value))} className="w-full text-xs font-black border border-slate-200 rounded p-1.5 text-right font-mono text-slate-800 focus:border-indigo-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {installments.length > 0 && (
                        <div className="text-right pt-3 pr-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Verifica Totale: </span>
                            <span className={`text-sm font-black ${Math.abs(totalAmount - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
                                {installments.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}€
                            </span>
                            {Math.abs(totalAmount - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.05 && (
                                <p className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">ATTENZIONE: Gli importi delle rate non coprono il totale.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="md-input-group !mb-0"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="md-input !h-24 text-sm" placeholder=" "/><label className="md-input-label !top-[-10px] !text-[10px] !bg-gray-50">Annotazioni per il Cliente (Autocompilate)</label></div>
            </div>

            <div className="p-4 border-t bg-white flex justify-between items-center flex-shrink-0 z-20">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat text-sm font-bold">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary px-12 text-xs font-black uppercase tracking-widest shadow-xl">Salva Proposta</button>
            </div>
        </form>
    );
};

export default QuoteForm;
