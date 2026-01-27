
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, Enrollment, PaymentMethod, ClientType, ParentClient, InstitutionalClient } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import Spinner from './Spinner';
import SearchIcon from './icons/SearchIcon';

interface EnrollmentFormProps {
    clients: Client[]; 
    initialClient?: Client | null; 
    existingEnrollment?: Enrollment; 
    onSave: (enrollments: EnrollmentInput[], options?: { regenerateCalendar: boolean }) => void;
    onCancel: () => void;
}

// Helper Festività (Duplicated for UI Preview)
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    if (d === 1 && m === 1) return true;
    if (d === 6 && m === 1) return true;
    if (d === 25 && m === 4) return true;
    if (d === 1 && m === 5) return true;
    if (d === 2 && m === 6) return true;
    if (d === 15 && m === 8) return true;
    if (d === 1 && m === 11) return true;
    if (d === 8 && m === 12) return true;
    if (d === 25 && m === 12) return true;
    if (d === 26 && m === 12) return true;
    const easterMondays: Record<number, string> = {
        2024: '4-1', 2025: '4-21', 2026: '4-6', 2027: '3-29', 2028: '4-17', 2029: '4-2', 2030: '4-22'
    };
    const key = `${y}-${m}-${d}`; // Fix key format matching
    const lookupKey = `${m}-${d}`;
    if (easterMondays[y] === lookupKey) return true;
    return false;
};

const calculateSlotBasedDates = (startStr: string, lessons: number): { start: string, end: string } => {
    if (!startStr || lessons <= 0) return { start: startStr, end: startStr };
    
    let currentDate = new Date(startStr);
    let validSlots = 0;
    let firstDate: string | null = null;
    let lastDate: string = startStr;

    // Safety break
    let loops = 0;
    while (validSlots < lessons && loops < 100) {
        if (!isItalianHoliday(currentDate)) {
            if (!firstDate) firstDate = currentDate.toISOString().split('T')[0];
            lastDate = currentDate.toISOString().split('T')[0];
            validSlots++;
        }
        // Advance 1 week
        currentDate.setDate(currentDate.getDate() + 7);
        loops++;
    }

    return { 
        start: firstDate || startStr, 
        end: lastDate 
    };
};

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ clients, initialClient, existingEnrollment, onSave, onCancel }) => {
    const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || existingEnrollment?.clientId || '');
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>(existingEnrollment ? [existingEnrollment.childId] : []);
    const [isAdultEnrollment, setIsAdultEnrollment] = useState<boolean>(existingEnrollment?.isAdult || false);

    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [startDateInput, setStartDateInput] = useState(existingEnrollment ? existingEnrollment.startDate.split('T')[0] : new Date().toISOString().split('T')[0]); 
    const [endDateInput, setEndDateInput] = useState(existingEnrollment ? existingEnrollment.endDate.split('T')[0] : '');
    // Manual End Date is now only relevant if user explicitly overrides the calc
    const [isEndDateManual, setIsEndDateManual] = useState(false); 
    const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>(existingEnrollment?.preferredPaymentMethod || PaymentMethod.BankTransfer);

    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [clientSort, setClientSort] = useState<'surname_asc' | 'surname_desc'>('surname_asc');
    
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);

    // Track initial values to detect changes
    const initialValues = useRef({
        startDate: existingEnrollment ? existingEnrollment.startDate.split('T')[0] : '',
        subscriptionId: existingEnrollment?.subscriptionTypeId || '',
        endDate: existingEnrollment ? existingEnrollment.endDate.split('T')[0] : ''
    });

    const currentClient = clients.find(p => p.id === selectedClientId);
    const isInstitutional = currentClient?.clientType === ClientType.Institutional || existingEnrollment?.clientType === ClientType.Institutional;

    const availableSubscriptions = useMemo(() => {
        const isVisible = (s: SubscriptionType) => {
            const status = s.statusConfig?.status || 'active'; 
            const isActiveOrPromo = status === 'active' || status === 'promo';
            const isCurrentLegacy = existingEnrollment && existingEnrollment.subscriptionTypeId === s.id;
            return isActiveOrPromo || isCurrentLegacy;
        };

        if (isInstitutional) {
            return subscriptionTypes.filter(isVisible);
        }

        return subscriptionTypes.filter(s => {
            let matchesTarget = false;
            if (s.target) {
                matchesTarget = isAdultEnrollment ? s.target === 'adult' : s.target === 'kid';
            } else {
                const isAdultName = s.name.startsWith('A -') || s.name.startsWith('A-');
                matchesTarget = isAdultEnrollment ? isAdultName : !isAdultName;
            }
            return matchesTarget && isVisible(s);
        });
    }, [subscriptionTypes, isAdultEnrollment, isInstitutional, existingEnrollment]);

    // SLOT-DRIVEN CALCULATION
    const calculatedDates = useMemo(() => {
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (!selectedSub || !startDateInput || selectedSub.id === 'quote-based') {
            return null;
        }
        // Usa il numero di lezioni, non i giorni
        return calculateSlotBasedDates(startDateInput, selectedSub.lessons);
    }, [subscriptionTypeId, startDateInput, subscriptionTypes]);

    useEffect(() => {
        // Se non è istituzionale e non è manuale, applica la logica Slot
        if (!isEndDateManual && calculatedDates && !isInstitutional) {
            setEndDateInput(calculatedDates.end);
            // Opzionale: Se la data inizio calcolata (es. post-festività) è diversa dall'input, potremmo aggiornare anche quella
            // Ma per UX lasciamo che l'input rifletta l'intenzione dell'utente, sarà il backend a normalizzare.
        }
    }, [calculatedDates, isEndDateManual, isInstitutional]);

    useEffect(() => {
        getSubscriptionTypes().then(subs => {
            setSubscriptionTypes(subs);
            setLoading(false);
        });
    }, []);

    const filteredClients = useMemo(() => {
        let result = clients.filter(c => {
            const term = clientSearchTerm.toLowerCase();
            if (c.clientType === ClientType.Parent) {
                const p = c as ParentClient;
                return `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) || p.children.some(ch => ch.name.toLowerCase().includes(term));
            } else {
                return (c as InstitutionalClient).companyName.toLowerCase().includes(term);
            }
        });
        result.sort((a, b) => {
            const nameA = a.clientType === ClientType.Parent ? (a as ParentClient).lastName : (a as InstitutionalClient).companyName;
            const nameB = b.clientType === ClientType.Parent ? (b as ParentClient).lastName : (b as InstitutionalClient).companyName;
            return clientSort === 'surname_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
        return result;
    }, [clients, clientSearchTerm, clientSort]);

    const toggleChildSelection = (childId: string) => {
        setSelectedChildIds(prev => 
            prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) return alert("Seleziona un cliente.");
        if (!isInstitutional && !isAdultEnrollment && selectedChildIds.length === 0) return alert("Seleziona almeno un figlio.");

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        
        // --- SMART CALENDAR REGENERATION CHECK ---
        let regenerateCalendar = false;
        if (existingEnrollment) {
            const dateChanged = startDateInput !== initialValues.current.startDate;
            const subChanged = subscriptionTypeId !== initialValues.current.subscriptionId;
            // Also check end date change if it implies duration change
            const endChanged = endDateInput !== initialValues.current.endDate;

            if (dateChanged || subChanged || endChanged) {
                const message = "Hai modificato le date o il pacchetto dell'iscrizione.\n\nVuoi rigenerare il calendario lezioni per allinearlo alle nuove date?\n(Le presenze già registrate verranno mantenute se le date coincidono).";
                regenerateCalendar = window.confirm(message);
            }
        }

        const enrollmentsToSave: EnrollmentInput[] = [];
        const targets = isInstitutional 
            ? [{ id: existingEnrollment?.childId || 'institutional', name: existingEnrollment?.childName || (currentClient as InstitutionalClient).companyName }]
            : isAdultEnrollment 
                ? [{ id: selectedClientId, name: `${(currentClient as ParentClient).firstName} ${(currentClient as ParentClient).lastName}` }]
                : selectedChildIds.map(id => {
                    const c = (currentClient as ParentClient).children.find(child => child.id === id);
                    return c ? { id: c.id, name: c.name } : null;
                }).filter(Boolean);

        targets.forEach(target => {
            if(!target) return;
            const newEnrollment: EnrollmentInput = {
                clientId: selectedClientId,
                clientType: currentClient?.clientType || ClientType.Parent,
                childId: target.id, 
                childName: target.name, 
                isAdult: isAdultEnrollment,
                isQuoteBased: existingEnrollment?.isQuoteBased || false,
                relatedQuoteId: existingEnrollment?.relatedQuoteId || undefined,
                subscriptionTypeId: subscriptionTypeId || 'quote-based',
                subscriptionName: selectedSub?.name || existingEnrollment?.subscriptionName || 'Progetto Istituzionale',
                price: Number(existingEnrollment?.price || selectedSub?.price || 0),
                supplierId: existingEnrollment?.supplierId || 'unassigned',
                supplierName: existingEnrollment?.supplierName || '',
                locationId: existingEnrollment?.locationId || 'unassigned',
                locationName: existingEnrollment?.locationName || 'Sede Non Definita', 
                locationColor: existingEnrollment?.locationColor || '#e5e7eb', 
                appointments: existingEnrollment?.appointments || [], 
                lessonsTotal: Number(existingEnrollment?.lessonsTotal || selectedSub?.lessons || 0),
                lessonsRemaining: Number(existingEnrollment?.lessonsRemaining || selectedSub?.lessons || 0),
                startDate: new Date(startDateInput).toISOString(),
                endDate: new Date(endDateInput).toISOString(),
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
                preferredPaymentMethod: preferredPaymentMethod,
                adjustmentAmount: existingEnrollment?.adjustmentAmount,
                adjustmentNotes: existingEnrollment?.adjustmentNotes
            };
            if (existingEnrollment) (newEnrollment as any).id = existingEnrollment.id;
            enrollmentsToSave.push(newEnrollment);
        });

        onSave(enrollmentsToSave, { regenerateCalendar });
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full w-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                {isInstitutional && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-widest mt-1 inline-block">Progetto Ente</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                {/* 1. SELEZIONE CLIENTE */}
                <div className="space-y-2">
                    {!existingEnrollment && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 flex gap-2 items-center">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input type="text" className="w-full pl-8 pr-2 py-1 text-sm border rounded" placeholder="Cerca cliente..." value={clientSearchTerm} onChange={e => setClientSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    )}
                    <div className="md-input-group">
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required disabled={!!existingEnrollment} className="md-input font-medium disabled:bg-gray-100">
                            <option value="" disabled>Seleziona Cliente...</option>
                            {filteredClients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.clientType === ClientType.Parent ? `${(c as ParentClient).lastName} ${(c as ParentClient).firstName}` : (c as InstitutionalClient).companyName}
                                </option>
                            ))}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">1. Cliente / Ente</label>
                    </div>
                </div>

                {/* LOGICA B2C vs B2B */}
                {!isInstitutional ? (
                    <>
                        {!existingEnrollment && (
                            <div className="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <span className="text-xs font-bold text-gray-700 self-center">Target:</span>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={!isAdultEnrollment} onChange={() => setIsAdultEnrollment(false)} className="mr-2" /><span className="text-sm text-gray-700">Figlio/i</span></label>
                                <label className="flex items-center cursor-pointer"><input type="radio" checked={isAdultEnrollment} onChange={() => setIsAdultEnrollment(true)} className="mr-2" /><span className="text-sm text-gray-700">Genitore</span></label>
                            </div>
                        )}
                        {!isAdultEnrollment && (
                            <div className={`md-input-group relative ${!selectedClientId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="md-input cursor-pointer flex justify-between items-center" onClick={() => !existingEnrollment && setIsChildDropdownOpen(!isChildDropdownOpen)}>
                                    <span className="truncate">{selectedChildIds.length === 0 ? "Seleziona figli..." : (currentClient as ParentClient)?.children.filter(c => selectedChildIds.includes(c.id)).map(c => c.name).join(', ')}</span>
                                </div>
                                <label className="md-input-label !top-0 !text-xs">2. Allievi</label>
                                {isChildDropdownOpen && (currentClient as ParentClient)?.children && (
                                    <div className="absolute z-20 w-full bg-white shadow-xl border rounded-md mt-1 max-h-48 overflow-y-auto">
                                        {(currentClient as ParentClient).children.map(child => (
                                            <label key={child.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                                                <input type="checkbox" checked={selectedChildIds.includes(child.id)} onChange={() => toggleChildSelection(child.id)} disabled={!!existingEnrollment} className="mr-3" />
                                                <span className="text-sm">{child.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Dettaglio Progetto</p>
                        <input type="text" value={existingEnrollment?.childName || ''} readOnly className="w-full bg-white border border-indigo-200 rounded p-2 text-sm font-bold text-slate-700" />
                    </div>
                )}

                {/* PACCHETTO & PAGAMENTO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <select value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required disabled={isInstitutional} className="md-input font-bold">
                            {isInstitutional ? <option value="quote-based">Basato su Preventivo</option> : (
                                <>
                                    <option value="" disabled>Seleziona pacchetto...</option>
                                    {availableSubscriptions.map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.name} - {sub.price.toFixed(2)}€ ({sub.lessons} lez.)
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">3. Piano / Pacchetto</label>
                    </div>
                    <div className="md-input-group">
                        <select value={preferredPaymentMethod} onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <label className="md-input-label !top-0 !text-xs">4. Metodo Previsto</label>
                    </div>
                </div>

                {/* DATE (SLOT DRIVEN) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} required className="md-input" />
                        <label className="md-input-label !top-0 !text-xs">5. Data Inizio (Primo Slot)</label>
                    </div>
                    <div className="md-input-group">
                        <input type="date" value={endDateInput} onChange={e => { setEndDateInput(e.target.value); setIsEndDateManual(true); }} required className="md-input" />
                        <label className="md-input-label !top-0 !text-xs">6. Data Fine (Ultimo Slot)</label>
                        {!isEndDateManual && calculatedDates && !isInstitutional && (
                            <span className="absolute -bottom-4 right-0 text-[10px] text-indigo-500 font-bold bg-white px-1">
                                Calcolata su {subscriptionTypes.find(s => s.id === subscriptionTypeId)?.lessons} slot
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Modifiche</button>
            </div>
        </form>
    );
};

export default EnrollmentForm;
