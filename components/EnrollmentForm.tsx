
import React, { useState, useEffect, useMemo } from 'react';
import { ParentClient, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, Appointment, Enrollment, PaymentMethod } from '../types';
import { getSubscriptionTypes } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import Spinner from './Spinner';
import SearchIcon from './icons/SearchIcon';

interface EnrollmentFormProps {
    parents: ParentClient[]; 
    initialParent?: ParentClient | null; 
    existingEnrollment?: Enrollment; 
    onSave: (enrollments: EnrollmentInput[]) => void;
    onCancel: () => void;
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ parents, initialParent, existingEnrollment, onSave, onCancel }) => {
    // State per il Genitore Selezionato
    const [selectedParentId, setSelectedParentId] = useState<string>(initialParent?.id || existingEnrollment?.clientId || '');

    // State per selezione multipla figli
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>(existingEnrollment ? [existingEnrollment.childId] : []);
    
    // NEW: Toggle per iscrizione Adulto
    const [isAdultEnrollment, setIsAdultEnrollment] = useState<boolean>(existingEnrollment?.isAdult || false);

    const [subscriptionTypeId, setSubscriptionTypeId] = useState(existingEnrollment?.subscriptionTypeId || '');
    const [startDateInput, setStartDateInput] = useState(existingEnrollment ? existingEnrollment.startDate.split('T')[0] : new Date().toISOString().split('T')[0]); 
    
    // NEW: Manual End Date Management
    const [endDateInput, setEndDateInput] = useState(existingEnrollment ? existingEnrollment.endDate.split('T')[0] : '');
    const [isEndDateManual, setIsEndDateManual] = useState(false);
    
    // NEW: Payment Method Preference
    const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>(existingEnrollment?.preferredPaymentMethod || PaymentMethod.BankTransfer);

    // UI State
    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);

    // --- FILTER STATES ---
    const [parentSearchTerm, setParentSearchTerm] = useState('');
    const [parentSort, setParentSort] = useState<'surname_asc' | 'surname_desc' | 'name_asc' | 'name_desc'>('surname_asc');
    
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);

    // Derivato: Genitore corrente
    const currentParent = parents.find(p => p.id === selectedParentId);

    // Filtra abbonamenti in base al target (Kid/Adult)
    const availableSubscriptions = useMemo(() => {
        return subscriptionTypes.filter(s => {
            // Se esiste il campo target, usalo
            if (s.target) {
                return isAdultEnrollment ? s.target === 'adult' : s.target === 'kid';
            }
            // Fallback sul nome (prefisso) se il target non è settato (vecchi record)
            const isAdultName = s.name.startsWith('A -') || s.name.startsWith('A-');
            return isAdultEnrollment ? isAdultName : !isAdultName;
        });
    }, [subscriptionTypes, isAdultEnrollment]);

    // Pre-calcolo della data finale naturale (quella che dovrebbe essere)
    const naturalEndDate = useMemo(() => {
        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (!selectedSub || !startDateInput) return '';
        
        const startObj = new Date(startDateInput);
        const endDateObj = new Date(startObj);
        endDateObj.setDate(endDateObj.getDate() + (selectedSub.durationInDays || 0));
        return endDateObj.toISOString().split('T')[0];
    }, [subscriptionTypeId, startDateInput, subscriptionTypes]);

    // Automazione Data Fine: se non manuale, segui la naturale
    useEffect(() => {
        if (!isEndDateManual && naturalEndDate) {
            setEndDateInput(naturalEndDate);
        }
    }, [naturalEndDate, isEndDateManual]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const subs = await getSubscriptionTypes();
            setSubscriptionTypes(subs);
            setLoading(false);
        };
        fetchData();
    }, [existingEnrollment]);

    // Resetta selezione pacchetto quando cambia la modalità Adulto/Bambino
    useEffect(() => {
        if (!existingEnrollment && availableSubscriptions.length > 0) {
            setSubscriptionTypeId(availableSubscriptions[0].id);
        } else if (!existingEnrollment) {
            setSubscriptionTypeId('');
        }
    }, [availableSubscriptions, existingEnrollment, isAdultEnrollment]);

    useEffect(() => {
        if (!existingEnrollment && currentParent) {
            setSelectedChildIds([]); 
        }
    }, [selectedParentId, existingEnrollment]);

    const toggleChildSelection = (childId: string) => {
        if (existingEnrollment) return;

        setSelectedChildIds(prev => {
            if (prev.includes(childId)) {
                return prev.filter(id => id !== childId);
            } else {
                return [...prev, childId];
            }
        });
    };

    // Check if it's an early closure
    const isShortened = useMemo(() => {
        if (!endDateInput || !naturalEndDate) return false;
        return new Date(endDateInput) < new Date(naturalEndDate);
    }, [endDateInput, naturalEndDate]);

    const filteredParents = useMemo(() => {
        let result = parents.filter(p => {
            const term = parentSearchTerm.toLowerCase();
            const parentMatch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(term);
            const childMatch = p.children.some(c => c.name.toLowerCase().includes(term));
            return parentMatch || childMatch;
        });

        result.sort((a, b) => {
            switch (parentSort) {
                case 'surname_asc': return a.lastName.localeCompare(b.lastName);
                case 'surname_desc': return b.lastName.localeCompare(a.lastName);
                case 'name_asc': return a.firstName.localeCompare(b.firstName);
                case 'name_desc': return b.firstName.localeCompare(a.firstName);
                default: return 0;
            }
        });
        return result;
    }, [parents, parentSearchTerm, parentSort]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedParentId) {
            alert("Seleziona un genitore/cliente.");
            return;
        }
        
        // Se è bambino, deve aver selezionato almeno un figlio
        if (!isAdultEnrollment && selectedChildIds.length === 0) {
            alert("Seleziona almeno un figlio.");
            return;
        }

        const selectedSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);
        if (!selectedSub) return;
        
        const enrollmentsToSave: EnrollmentInput[] = [];

        // Logica Differenziata: Loop su Figli o Singolo Adulto
        const targets = isAdultEnrollment 
            ? [{ id: selectedParentId, name: `${currentParent?.firstName} ${currentParent?.lastName}` }] // Adulto è se stesso
            : selectedChildIds.map(id => {
                const c = currentParent?.children.find(child => child.id === id);
                return c ? { id: c.id, name: c.name } : null;
            }).filter(Boolean); // Figli

        targets.forEach(target => {
            if(!target) return;

            const startObj = new Date(startDateInput);
            const endObj = new Date(endDateInput);

            const newEnrollment: EnrollmentInput = {
                clientId: selectedParentId,
                childId: target.id, 
                childName: target.name, 
                isAdult: isAdultEnrollment,
                subscriptionTypeId,
                subscriptionName: selectedSub.name,
                price: selectedSub.price,
                
                supplierId: 'unassigned',
                supplierName: '',
                locationId: 'unassigned',
                locationName: 'Sede Non Definita', 
                locationColor: '#e5e7eb', 
                
                appointments: [], 
                
                lessonsTotal: selectedSub.lessons,
                lessonsRemaining: selectedSub.lessons,
                startDate: startObj.toISOString(),
                endDate: endObj.toISOString(),
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
                isEarlyClosure: isShortened,
                preferredPaymentMethod: preferredPaymentMethod
            };
            
            if (existingEnrollment) {
                 (newEnrollment as any).id = existingEnrollment.id;
                 if (existingEnrollment.locationId !== 'unassigned') {
                     newEnrollment.supplierId = existingEnrollment.supplierId;
                     newEnrollment.supplierName = existingEnrollment.supplierName;
                     newEnrollment.locationId = existingEnrollment.locationId;
                     newEnrollment.locationName = existingEnrollment.locationName;
                     newEnrollment.locationColor = existingEnrollment.locationColor;
                     newEnrollment.appointments = existingEnrollment.appointments;
                 }
            }

            enrollmentsToSave.push(newEnrollment);
        });

        onSave(enrollmentsToSave);
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    const currentSub = subscriptionTypes.find(s => s.id === subscriptionTypeId);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full w-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                <p className="text-sm text-gray-500">
                    Gestione cartellino e validità temporale.
                </p>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                
                {/* BANNER CHIUSURA ANTICIPATA */}
                {isShortened && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm animate-fade-in flex gap-3">
                        <span className="text-xl">⚠️</span>
                        <div className="text-xs text-amber-800 leading-relaxed">
                            <p className="font-bold uppercase mb-1">Protocollo Chiusura Anticipata Attivo</p>
                            Stai accorciando la validità temporale rispetto alla durata standard del pacchetto.
                            <br/>• L'incasso di <strong>{currentSub?.price || 0}€</strong> rimarrà acquisito in Finanza e non verrà modificato.
                        </div>
                    </div>
                )}

                {/* 1. SELEZIONE GENITORE */}
                <div className="space-y-2">
                    {!existingEnrollment && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 flex gap-2 items-center">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                                <input 
                                    type="text" 
                                    className="w-full pl-8 pr-2 py-1 text-sm border rounded focus:ring-indigo-500 focus:border-indigo-500" 
                                    placeholder="Cerca genitore o figlio..."
                                    value={parentSearchTerm}
                                    onChange={e => setParentSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="md-input-group">
                        <select 
                            id="parent-select"
                            value={selectedParentId} 
                            onChange={e => setSelectedParentId(e.target.value)} 
                            required 
                            disabled={!!existingEnrollment} 
                            className={`md-input font-medium ${existingEnrollment ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                            <option value="" disabled>Seleziona Genitore...</option>
                            {filteredParents.map(p => (
                                <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>
                            ))}
                        </select>
                        <label htmlFor="parent-select" className="md-input-label !top-0 !text-xs !text-gray-500">1. Cliente / Genitore</label>
                    </div>
                </div>

                {/* CHI SI ISCRIVE */}
                {!existingEnrollment && (
                    <div className="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-xs font-bold text-gray-700 self-center">Chi si iscrive?</span>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                name="enrollmentTarget" 
                                checked={!isAdultEnrollment} 
                                onChange={() => setIsAdultEnrollment(false)} 
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Figlio/i</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                name="enrollmentTarget" 
                                checked={isAdultEnrollment} 
                                onChange={() => setIsAdultEnrollment(true)} 
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Genitore (Adulto)</span>
                        </label>
                    </div>
                )}

                {/* SELEZIONE FIGLI */}
                {!isAdultEnrollment && (
                    <div className={`md-input-group relative transition-opacity duration-200 ${!selectedParentId ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="block text-xs text-gray-500 absolute top-0 left-0">2. Figli (Seleziona uno o più)</label>
                        
                        <div 
                            className="md-input cursor-pointer flex justify-between items-center mt-2"
                            onClick={() => !existingEnrollment && setIsChildDropdownOpen(!isChildDropdownOpen)}
                        >
                            <span className="truncate">
                                {selectedChildIds.length === 0 
                                    ? (currentParent?.children.length === 0 ? "Nessun figlio registrato" : "Seleziona figli...") 
                                    : currentParent?.children.filter(c => selectedChildIds.includes(c.id)).map(c => c.name).join(', ')}
                            </span>
                            {!existingEnrollment && (
                                <svg className={`w-4 h-4 transition-transform ${isChildDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            )}
                        </div>

                        {(isChildDropdownOpen || existingEnrollment) && (
                             <div className={`${existingEnrollment ? 'block mt-2' : 'absolute z-20 w-full bg-white shadow-xl border border-gray-200 rounded-md mt-1 max-h-48 overflow-y-auto'}`}>
                                {currentParent?.children.map(child => (
                                    <label key={child.id} className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer ${existingEnrollment ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedChildIds.includes(child.id)}
                                            onChange={() => toggleChildSelection(child.id)}
                                            disabled={!!existingEnrollment}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-3"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-700">{child.name}</span>
                                            <span className="text-[10px] text-gray-500">{child.age}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PACCHETTO */}
                <div className="md-input-group">
                    <select id="sub-type" value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input font-bold">
                        <option value="" disabled>Seleziona pacchetto...</option>
                        {availableSubscriptions.map(sub => (
                            <option key={sub.id} value={sub.id}>
                                {sub.name} ({sub.lessons} lez. - {sub.price}€)
                            </option>
                        ))}
                    </select>
                    <label htmlFor="sub-type" className="md-input-label !top-0 !text-xs !text-gray-500">3. Pacchetto ({isAdultEnrollment ? 'Adulti' : 'Bambini'})</label>
                </div>

                {/* METODO PREVISTO */}
                <div className="md-input-group">
                    <select value={preferredPaymentMethod} onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)} className="md-input">
                        {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <label className="md-input-label !top-0 !text-xs">4. Metodo di Pagamento Previsto</label>
                </div>

                {/* DATE VALIDITÀ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input 
                            id="startDate" 
                            type="date" 
                            value={startDateInput} 
                            onChange={e => setStartDateInput(e.target.value)} 
                            required 
                            className="md-input" 
                        />
                        <label htmlFor="startDate" className="md-input-label !top-0 !text-xs !text-gray-500">5. Data Inizio</label>
                    </div>

                    <div className="space-y-1">
                        <div className="md-input-group">
                            <input 
                                id="endDate" 
                                type="date" 
                                value={endDateInput} 
                                onChange={e => { setEndDateInput(e.target.value); setIsEndDateManual(true); }} 
                                required 
                                disabled={!isEndDateManual}
                                className={`md-input ${isEndDateManual ? 'border-indigo-500 bg-white ring-2 ring-indigo-50' : 'bg-gray-50 text-gray-400'}`} 
                            />
                            <label htmlFor="endDate" className="md-input-label !top-0 !text-xs !text-gray-500">6. Data Fine {isEndDateManual ? '(Manuale)' : '(Calcolata)'}</label>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                type="button" 
                                onClick={() => setIsEndDateManual(!isEndDateManual)}
                                className={`text-[10px] font-bold uppercase transition-colors px-2 py-0.5 rounded ${isEndDateManual ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:text-indigo-600'}`}
                            >
                                {isEndDateManual ? '🔒 Blocca (Auto)' : '🔓 Sblocca (Modifica)'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

             <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button 
                    type="submit" 
                    className="md-btn md-btn-raised md-btn-green md-btn-sm" 
                    disabled={!selectedParentId || (!isAdultEnrollment && selectedChildIds.length === 0)}
                >
                    {existingEnrollment ? 'Salva Modifiche' : `Crea Cartellino ${isAdultEnrollment ? '(Adulto)' : `(${selectedChildIds.length})`}`}
                </button>
            </div>
        </form>
    );
};

export default EnrollmentForm;
