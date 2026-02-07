
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Quote, QuoteInput, Client, ClientType, ParentClient, InstitutionalClient, DocumentItem, Installment, DocumentStatus, CompanyInfo } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import SearchIcon from '../icons/SearchIcon';
import CalculatorIcon from '../icons/CalculatorIcon';
import CalendarIcon from '../icons/CalendarIcon';

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
    
    // New: Discount & Stamp
    const [globalDiscount, setGlobalDiscount] = useState<number>(quote?.globalDiscount || 0);
    const [globalDiscountType, setGlobalDiscountType] = useState<'percent' | 'amount'>(quote?.globalDiscountType || 'amount');
    const [hasStampDuty, setHasStampDuty] = useState<boolean>(quote?.hasStampDuty || false);
    const [manualStampMode, setManualStampMode] = useState<boolean>(false);

    // Payment Configuration Wizard State
    const [paymentStrategy, setPaymentStrategy] = useState<'single' | 'multiple'>('single');
    const [installmentsCount, setInstallmentsCount] = useState<number>(2);
    const [paymentTerms, setPaymentTerms] = useState<string>('immed'); // immed, 30df, 60df, 30dffm, 60dffm
    const [paymentMode, setPaymentMode] = useState<string>('bank_transfer');
    
    // Schedule Simulator (For Preview)
    const [simulatedStartDate, setSimulatedStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Generated Plan
    const [installments, setInstallments] = useState<Installment[]>(quote?.installments || []);
    const [notes, setNotes] = useState(quote?.notes || '');

    // Init Logic
    useEffect(() => {
        if (quote?.installments && quote.installments.length > 1) {
            setPaymentStrategy('multiple');
            setInstallmentsCount(quote.installments.length);
        }
        if (quote) {
            setHasStampDuty(quote.hasStampDuty || false);
            setManualStampMode(true); 
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

    // Totals Calculation (Memoized)
    const { subTotal, discountVal, taxable, stampVal, grandTotal } = useMemo(() => {
        const sub = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        let disc = 0;
        if (globalDiscount > 0) {
            disc = globalDiscountType === 'percent' ? sub * (globalDiscount / 100) : globalDiscount;
        }
        const tax = Math.max(0, sub - disc);
        
        // GLOBAL Stamp Duty Logic: used for quote total header, but installments might override
        // We will calculate installments stamp total later
        const stamp = hasStampDuty ? 2.00 : 0.00;
        
        // NOTE: If using split stamp duty on installments, we sum those up instead of using a global flag?
        // The PDF generator uses `hasStampDuty` on Quote level for legacy/single.
        // For multiple, we should probably sum the installments stamps.
        // For now, let's keep global flag logic consistent with single payment invoice logic.
        const total = tax + stamp;

        return { subTotal: sub, discountVal: disc, taxable: tax, stampVal: stamp, grandTotal: total };
    }, [items, globalDiscount, globalDiscountType, hasStampDuty]);

    // Total Stamps from Installments
    const installmentsStampTotal = useMemo(() => {
        return installments.reduce((acc, i) => acc + (i.hasStampDuty ? 2.00 : 0), 0);
    }, [installments]);

    // Grand Total including Split Stamps (Override)
    const finalGrandTotal = useMemo(() => {
        if (paymentStrategy === 'multiple') {
            return taxable + installmentsStampTotal;
        }
        return grandTotal;
    }, [grandTotal, taxable, installmentsStampTotal, paymentStrategy]);

    // Auto-Toggle Global Stamp Duty (Only for Single Strategy or Initial)
    useEffect(() => {
        if (!manualStampMode && paymentStrategy === 'single') {
            if (taxable > 77.47) {
                if (!hasStampDuty) setHasStampDuty(true);
            } else {
                if (hasStampDuty) setHasStampDuty(false);
            }
        }
    }, [taxable, manualStampMode, hasStampDuty, paymentStrategy]);

    const handleStampToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setManualStampMode(true);
        setHasStampDuty(e.target.checked);
    };

    // Auto Expiry Date
    useEffect(() => {
        if (!quote && !expiryDate) {
            const d = new Date(issueDate);
            d.setDate(d.getDate() + 30);
            setExpiryDate(d.toISOString().split('T')[0]);
        }
    }, [issueDate, quote]);

    // --- PAYMENT WIZARD LOGIC ---

    const calculateEffectiveDate = useCallback((baseDateStr: string, termDays: number): string => {
        if (!baseDateStr) return '';
        const d = new Date(baseDateStr);
        d.setDate(d.getDate() + termDays);
        return d.toISOString().split('T')[0];
    }, []);

    const getTermDaysFromKey = (key: string) => {
        if (key === 'immed') return 0;
        if (key === '30df' || key === '30dffm') return 30;
        if (key === '60df' || key === '60dffm') return 60;
        return 0;
    };

    const getTermLabel = (key: string) => {
        switch (key) {
            case 'immed': return 'Vista Fattura';
            case '30df': return '30 GG DF';
            case '60df': return '60 GG DF';
            case '30dffm': return '30 GG DFFM';
            case '60dffm': return '60 GG DFFM';
            default: return 'Standard';
        }
    };

    const getSimulatedDateForLesson = (lessonIndex: number) => {
        if (!simulatedStartDate || lessonIndex < 1) return '';
        const d = new Date(simulatedStartDate);
        d.setDate(d.getDate() + (lessonIndex - 1) * 7); // Assuming weekly freq
        return d.toISOString().split('T')[0];
    };

    // Refs to track changes
    const prevStrategyRef = useRef(paymentStrategy);
    const prevCountRef = useRef(installmentsCount);
    const prevTermsRef = useRef(paymentTerms);
    const prevTotalRef = useRef(taxable); // Use taxable as base for split

    useEffect(() => {
        const strategyChanged = prevStrategyRef.current !== paymentStrategy;
        const countChanged = prevCountRef.current !== installmentsCount;
        const totalChanged = Math.abs(prevTotalRef.current - taxable) > 0.01;
        const termsChanged = prevTermsRef.current !== paymentTerms;

        // Update refs
        prevStrategyRef.current = paymentStrategy;
        prevCountRef.current = installmentsCount;
        prevTotalRef.current = taxable;
        prevTermsRef.current = paymentTerms;

        if (!strategyChanged && !countChanged && !totalChanged && !termsChanged) return;

        // SKIP REGEN if initial load of existing quote matches state
        // Fix: Added check for quote.installments to prevent undefined access
        if (quote && quote.installments && installments.length > 0 && installments.length === quote.installments.length) {
             if (!strategyChanged && !countChanged && !termsChanged && !totalChanged) return;
        }

        // --- GENERATION LOGIC ---
        const newInstallments: Installment[] = [];
        
        const getBaseDate = (index: number) => {
            const d = new Date(issueDate);
            d.setMonth(d.getMonth() + index);
            return d.toISOString().split('T')[0];
        };

        if (paymentStrategy === 'single') {
            const termDays = getTermDaysFromKey(paymentTerms);
            const baseDate = issueDate;
            const collDate = calculateEffectiveDate(baseDate, termDays);
            
            newInstallments.push({
                description: 'Unica Soluzione',
                dueDate: baseDate, // Due date is emission date basically
                amount: taxable + (hasStampDuty ? 2 : 0),
                isPaid: false,
                triggerType: 'date',
                paymentTermDays: termDays,
                collectionDate: collDate,
                hasStampDuty: hasStampDuty
            });
        } else {
            const count = Math.max(2, installmentsCount);
            const baseAmount = Math.floor((taxable / count) * 100) / 100;
            let remainder = taxable;

            for (let i = 0; i < count; i++) {
                const isLast = i === count - 1;
                const rawAmount = isLast ? Number(remainder.toFixed(2)) : baseAmount;
                remainder -= rawAmount;
                
                // Auto Stamp Logic Per Installment
                const hasStamp = rawAmount > 77.47;
                const finalAmount = rawAmount + (hasStamp ? 2.00 : 0);

                let desc = `Rata ${i + 1}`;
                if (i === 0) desc = `Acconto (${Math.round((rawAmount/taxable)*100)}%)`;
                if (isLast) desc = `Saldo Finale`;

                // Default Trigger: Date
                const baseDate = getBaseDate(i);
                const termDays = getTermDaysFromKey(paymentTerms);
                const collDate = calculateEffectiveDate(baseDate, termDays);

                newInstallments.push({
                    description: desc,
                    dueDate: baseDate,
                    amount: finalAmount,
                    isPaid: false,
                    triggerType: 'date',
                    paymentTermDays: termDays,
                    collectionDate: collDate,
                    hasStampDuty: hasStamp
                });
            }
        }
        setInstallments(newInstallments);

    }, [paymentStrategy, installmentsCount, paymentTerms, taxable, issueDate, hasStampDuty]); 

    // Update Installment
    const handleInstallmentChange = (idx: number, field: keyof Installment, value: any) => {
        const newInst = [...installments];
        const updated = { ...newInst[idx], [field]: value };
        
        // Smart Updates based on trigger change
        if (field === 'triggerType') {
            if (value === 'lesson_number') {
                updated.triggerLessonIndex = idx + 1; // Default to sequential
            }
        }
        
        if (field === 'triggerLessonIndex' || field === 'triggerType' || field === 'paymentTermDays' || field === 'dueDate') {
            // Recalculate Dates
            let baseDate = updated.dueDate;
            if (updated.triggerType === 'lesson_number' && updated.triggerLessonIndex) {
                baseDate = getSimulatedDateForLesson(updated.triggerLessonIndex);
                // Also update display dueDate for clarity if simulated
                if(baseDate) updated.dueDate = baseDate; 
            }
            if (updated.paymentTermDays !== undefined) {
                updated.collectionDate = calculateEffectiveDate(baseDate, updated.paymentTermDays);
            }
        }

        // Stamp Duty Toggle
        if (field === 'hasStampDuty') {
            const oldStamp = newInst[idx].hasStampDuty ? 2 : 0;
            const newStamp = value ? 2 : 0;
            updated.amount = updated.amount - oldStamp + newStamp;
        }

        // Amount Manual Change -> Check Stamp Auto
        if (field === 'amount') {
             // If user manually types amount, we should check if stamp duty needs update or keep logic?
             // Let's assume input includes stamp. If we want logic "Amount + Stamp", we need separate input.
             // Here simpler: just update amount. Stamp toggle is separate.
        }

        newInst[idx] = updated;
        setInstallments(newInst);
    };

    // Re-run date simulation when start date changes
    useEffect(() => {
        if (paymentStrategy === 'multiple') {
            const updated = installments.map(inst => {
                if (inst.triggerType === 'lesson_number' && inst.triggerLessonIndex) {
                    const newBaseDate = getSimulatedDateForLesson(inst.triggerLessonIndex);
                    const newCollDate = calculateEffectiveDate(newBaseDate, inst.paymentTermDays || 0);
                    return { ...inst, dueDate: newBaseDate, collectionDate: newCollDate };
                }
                return inst;
            });
            // Only update if changes to avoid loop
            if (JSON.stringify(updated) !== JSON.stringify(installments)) {
                setInstallments(updated);
            }
        }
    }, [simulatedStartDate, paymentStrategy]); // Removing installments dependency to avoid loop, handled by check

    // --- FORM HANDLERS ---

    const handleItemChange = (index: number, field: keyof DocumentItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const client = clients.find(c => c.id === selectedClientId);
        const clientName = client 
            ? (client.clientType === ClientType.Parent ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}` : (client as InstitutionalClient).companyName)
            : 'Cliente Occasionale';

        // Validation: Sum check
        const sumInst = installments.reduce((acc, i) => acc + i.amount, 0);
        if (Math.abs(sumInst - finalGrandTotal) > 0.05) {
            if (!confirm(`ATTENZIONE: Il totale delle rate (${sumInst.toFixed(2)}€) non corrisponde al totale del documento (${finalGrandTotal.toFixed(2)}€). Vuoi salvare comunque?`)) {
                return;
            }
        }

        let methodStr = "";
        if (paymentMode === 'bank_transfer') methodStr = "Bonifico Bancario";
        else if (paymentMode === 'direct_cash') methodStr = "Rimessa Diretta (Contanti)";
        else if (paymentMode === 'direct_check') methodStr = "Rimessa Diretta (Assegno)";
        else if (paymentMode === 'direct_paypal') methodStr = "PayPal / Digital";

        methodStr += ` - Termini: ${getTermLabel(paymentTerms)}`;

        let finalNotes = notes;
        if (!finalNotes) {
            if (paymentMode === 'bank_transfer' && companyInfo?.iban) {
                finalNotes = `Coordinate Bancarie:\nIBAN: ${companyInfo.iban}\nBeneficiario: ${companyInfo.name}`;
            }
        }

        const data: QuoteInput = {
            clientId: selectedClientId,
            clientName,
            issueDate: new Date(issueDate).toISOString(),
            expiryDate: new Date(expiryDate).toISOString(),
            items,
            totalAmount: finalGrandTotal, // Save FULL total
            installments: installments,
            notes: finalNotes,
            paymentMethod: methodStr,
            status: quote?.status || DocumentStatus.Draft,
            quoteNumber: quote?.quoteNumber || '',
            isDeleted: false,
            globalDiscount,
            globalDiscountType,
            hasStampDuty: hasStampDuty // Keep global flag for reference
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
                    
                    {/* TOTALS SECTION */}
                    <div className="bg-slate-50 border-t border-gray-200 p-4">
                        <div className="flex justify-end gap-12 text-sm text-slate-600 mb-2">
                            <span>Imponibile Lordo:</span>
                            <span className="font-bold">{subTotal.toFixed(2)}€</span>
                        </div>
                        
                        {/* Discount Control */}
                        <div className="flex justify-end gap-2 items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Sconto Globale:</span>
                            <div className="flex bg-white border border-gray-300 rounded p-0.5">
                                <input type="number" value={globalDiscount} onChange={e => setGlobalDiscount(Number(e.target.value))} className="w-16 text-right text-sm border-none p-1 focus:ring-0" placeholder="0" />
                                <button type="button" onClick={() => setGlobalDiscountType(prev => prev === 'percent' ? 'amount' : 'percent')} className="bg-gray-100 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-gray-200 rounded ml-1 min-w-[30px]">
                                    {globalDiscountType === 'percent' ? '%' : '€'}
                                </button>
                            </div>
                            <span className="text-red-500 font-bold min-w-[60px] text-right">-{discountVal.toFixed(2)}€</span>
                        </div>

                        <div className="flex justify-end gap-12 text-sm text-slate-600 mb-2 border-t border-gray-200 pt-2">
                            <span>Imponibile Netto:</span>
                            <span className="font-bold">{taxable.toFixed(2)}€</span>
                        </div>

                        {paymentStrategy === 'single' && (
                            <div className="flex justify-end gap-4 items-center mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Applica Bollo (2€)</span>
                                    <input type="checkbox" checked={hasStampDuty} onChange={handleStampToggle} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                </label>
                                <span className="font-bold text-slate-700 min-w-[60px] text-right">{stampVal.toFixed(2)}€</span>
                            </div>
                        )}

                        <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                            <span className="text-xs font-bold uppercase tracking-widest opacity-60">Totale {paymentStrategy === 'single' ? 'Documento' : 'Servizi'}</span>
                            <span className="text-3xl font-black text-amber-400">{finalGrandTotal.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>

                {/* PIANO PAGAMENTI (WIZARD) */}
                <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <span className="bg-indigo-600 text-white w-6 h-6 rounded flex items-center justify-center text-xs"><CalculatorIcon /></span> 
                            Condizioni Commerciali & Rate
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

                        {/* Termini & Trigger */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Termini Pagamento (Default)</label>
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
                        </div>
                    </div>

                    {/* SIMULATORE CALENDARIO */}
                    {paymentStrategy === 'multiple' && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6 animate-fade-in">
                            <h5 className="text-[10px] font-black text-indigo-700 uppercase mb-2 flex items-center gap-1">
                                <CalendarIcon /> Simulatore Temporale
                            </h5>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-slate-500 block">Data Inizio Prevista (Lezione 1)</label>
                                    <input type="date" value={simulatedStartDate} onChange={e => setSimulatedStartDate(e.target.value)} className="mt-1 w-full text-xs font-bold p-1.5 rounded border border-indigo-200" />
                                </div>
                                <div className="text-xs text-slate-500 italic flex-1">
                                    Utilizzato per calcolare le scadenze dinamiche (es. "4° Lezione"). La frequenza è settimanale.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Area B: Lista Generata */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 grid grid-cols-12 gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <div className="col-span-3">Descrizione</div>
                            <div className="col-span-2">Trigger</div>
                            <div className="col-span-2">Emissione</div>
                            <div className="col-span-2">Incasso</div>
                            <div className="col-span-1 text-center">Bollo</div>
                            <div className="col-span-2 text-right">Importo</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {installments.map((inst, idx) => {
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-3 hover:bg-slate-50 transition-colors group text-xs">
                                        
                                        {/* Descrizione */}
                                        <div className="col-span-3 flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-black flex-shrink-0">{idx + 1}</div>
                                            <input type="text" value={inst.description} onChange={e => handleInstallmentChange(idx, 'description', e.target.value)} className="w-full font-bold border-none bg-transparent focus:ring-0 text-slate-700 p-0" placeholder="Descrizione" />
                                        </div>
                                        
                                        {/* Trigger Select */}
                                        <div className="col-span-2">
                                            <select 
                                                value={inst.triggerType || 'date'} 
                                                onChange={e => handleInstallmentChange(idx, 'triggerType', e.target.value)}
                                                className="w-full border border-slate-200 rounded p-1 text-[10px] bg-white"
                                            >
                                                <option value="date">Data Fissa</option>
                                                <option value="lesson_number">N. Lezione</option>
                                            </select>
                                            {inst.triggerType === 'lesson_number' && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[9px] text-gray-400">Lez:</span>
                                                    <input 
                                                        type="number" 
                                                        value={inst.triggerLessonIndex || (idx + 1)} 
                                                        onChange={e => handleInstallmentChange(idx, 'triggerLessonIndex', Number(e.target.value))}
                                                        className="w-10 border rounded p-0.5 text-center font-bold text-[10px]"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Emission Date */}
                                        <div className="col-span-2">
                                            <input 
                                                type="date" 
                                                value={inst.dueDate ? inst.dueDate.split('T')[0] : ''} 
                                                onChange={e => handleInstallmentChange(idx, 'dueDate', e.target.value)} 
                                                className="w-full font-medium border border-slate-200 rounded p-1 text-slate-600 focus:border-indigo-500" 
                                            />
                                            {inst.triggerType === 'lesson_number' && (
                                                <span className="text-[9px] text-indigo-400 block mt-0.5">*Stimata</span>
                                            )}
                                        </div>

                                        {/* Collection Date (Calculated) */}
                                        <div className="col-span-2">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] text-gray-400">+</span>
                                                    <input 
                                                        type="number" 
                                                        value={inst.paymentTermDays || 0} 
                                                        onChange={e => handleInstallmentChange(idx, 'paymentTermDays', Number(e.target.value))}
                                                        className="w-8 border rounded p-0.5 text-center text-[10px]"
                                                    />
                                                    <span className="text-[9px] text-gray-400">gg</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-green-600">
                                                    {inst.collectionDate ? new Date(inst.collectionDate).toLocaleDateString() : '-'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stamp Toggle */}
                                        <div className="col-span-1 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={inst.hasStampDuty || false} 
                                                onChange={e => handleInstallmentChange(idx, 'hasStampDuty', e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Importo */}
                                        <div className="col-span-2 text-right">
                                            <input type="number" step="0.01" value={inst.amount} onChange={e => handleInstallmentChange(idx, 'amount', Number(e.target.value))} className="w-full font-black border border-slate-200 rounded p-1.5 text-right font-mono text-slate-800 focus:border-indigo-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {installments.length > 0 && (
                        <div className="text-right pt-3 pr-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Verifica Totale Rate (con bolli): </span>
                            <span className={`text-sm font-black ${Math.abs(finalGrandTotal - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
                                {installments.reduce((sum, i) => sum + i.amount, 0).toFixed(2)}€
                            </span>
                            {Math.abs(finalGrandTotal - installments.reduce((sum, i) => sum + i.amount, 0)) > 0.05 && (
                                <p className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">ATTENZIONE: Il piano rateale non copre il totale documento.</p>
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
