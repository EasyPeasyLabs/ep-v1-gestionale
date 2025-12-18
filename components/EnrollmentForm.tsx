
import React, { useState, useEffect, useMemo } from 'react';
import { ParentClient, EnrollmentInput, EnrollmentStatus, SubscriptionType, Supplier, Appointment, Enrollment } from '../types';
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
    
    // UI State
    const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);

    // --- FILTER STATES ---
    const [parentSearchTerm, setParentSearchTerm] = useState('');
    const [parentSort, setParentSort] = useState<'surname_asc' | 'surname_desc' | 'name_asc' | 'name_desc'>('surname_asc');
    
    const [subscriptionTypes, setSubscriptionTypes] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);

    // DEBUG: Mount
    useEffect(() => {
        console.log('[DEBUG EnrollmentForm] Mounted with:', { 
            parentsCount: parents.length, 
            initialParentId: initialParent?.id, 
            existingEnrollmentId: existingEnrollment?.id 
        });
    }, []);

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

    // --- FILTER LOGIC ---

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
        
        console.log('[DEBUG EnrollmentForm] HandleSubmit triggered');

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
        if (!selectedSub) {
            console.error('[DEBUG EnrollmentForm] Subscription Type not found:', subscriptionTypeId);
            return;
        }
        
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
            const endDateObj = new Date(startObj);
            endDateObj.setDate(endDateObj.getDate() + (selectedSub.durationInDays || 0));
            const endDate = endDateObj.toISOString();

            const newEnrollment: EnrollmentInput = {
                clientId: selectedParentId,
                childId: target.id, // Se adulto, childId = clientId
                childName: target.name, // Se adulto, nome genitore
                isAdult: isAdultEnrollment,
                subscriptionTypeId,
                subscriptionName: selectedSub.name,
                price: selectedSub.price,
                
                // Placeholder per "Da Assegnare"
                supplierId: 'unassigned',
                supplierName: '',
                locationId: 'unassigned',
                locationName: 'Sede Non Definita', 
                locationColor: '#e5e7eb', 
                
                appointments: [], 
                
                lessonsTotal: selectedSub.lessons,
                lessonsRemaining: selectedSub.lessons,
                startDate: startObj.toISOString(),
                endDate: endDate,
                status: existingEnrollment ? existingEnrollment.status : EnrollmentStatus.Pending, 
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

        console.log('[DEBUG EnrollmentForm] Saving payloads:', enrollmentsToSave);
        onSave(enrollmentsToSave);
    };

    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full w-full overflow-hidden">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                    {existingEnrollment ? 'Modifica Iscrizione' : 'Nuova Iscrizione'}
                </h2>
                <p className="text-sm text-gray-500">
                    Crea il cartellino. Assegnerai la sede trascinandolo nel calendario.
                </p>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                
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
                            <select 
                                value={parentSort}
                                onChange={(e) => setParentSort(e.target.value as any)}
                                className="text-xs border-gray-300 rounded py-1 pl-2 pr-6 bg-white"
                            >
                                <option value="surname_asc">Cognome (A-Z)</option>
                                <option value="surname_desc">Cognome (Z-A)</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="name_desc">Nome (Z-A)</option>
                            </select>
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

                {/* 1.5 TOGGLE CHI SI ISCRIVE */}
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

                {/* 2. SELEZIONE FIGLI (Multipla) - Solo se non è Adulto */}
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
                                {currentParent?.children.length === 0 && (
                                    <div className="px-4 py-2 text-sm text-gray-500 italic">Nessun figlio disponibile. Aggiungili nell'anagrafica clienti.</div>
                                )}
                            </div>
                        )}
                        {isChildDropdownOpen && !existingEnrollment && (
                            <div className="fixed inset-0 z-10" onClick={() => setIsChildDropdownOpen(false)}></div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 3. DATA INIZIO */}
                    <div className="md-input-group">
                        <input 
                            id="startDate" 
                            type="date" 
                            value={startDateInput} 
                            onChange={e => setStartDateInput(e.target.value)} 
                            required 
                            className="md-input" 
                        />
                        <label htmlFor="startDate" className="md-input-label !top-0 !text-xs !text-gray-500">3. Data Inizio Validità</label>
                    </div>

                    {/* 4. PACCHETTO */}
                    <div className="md-input-group">
                        <select id="sub-type" value={subscriptionTypeId} onChange={e => setSubscriptionTypeId(e.target.value)} required className="md-input">
                            <option value="" disabled>Seleziona pacchetto...</option>
                            {availableSubscriptions.map(sub => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name} ({sub.lessons} lez. - {sub.price}€)
                                </option>
                            ))}
                        </select>
                        <label htmlFor="sub-type" className="md-input-label !top-0 !text-xs !text-gray-500">4. Pacchetto ({isAdultEnrollment ? 'Adulti' : 'Bambini'})</label>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md mt-4 border border-dashed border-gray-300 text-center">
                    <p className="text-sm text-gray-600 font-medium">
                        Cartellino "Da Assegnare"
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Il fornitore, la sede e gli orari verranno definiti quando sposterai il cartellino nel recinto desiderato.
                    </p>
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
