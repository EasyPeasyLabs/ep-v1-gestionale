
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput, Supplier } from '../types';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment, addRecoveryLessons, bulkUpdateLocation, activateEnrollmentWithLocation } from '../services/enrollmentService';
import { addTransaction, deleteTransactionByRelatedId, addInvoice } from '../services/financeService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import EnrollmentForm from '../components/EnrollmentForm';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import SearchIcon from '../components/icons/SearchIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RefreshIcon from '../components/icons/RestoreIcon';

interface EnrollmentsProps {
    initialParams?: {
        status?: 'all' | 'pending' | 'active';
        searchTerm?: string;
    };
}

const daysOfWeekMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// --- Modal Recupero (Omissis - Same as before) ---
const RecoveryModal: React.FC<{
    enrollment: Enrollment;
    maxRecoverable: number;
    suppliers: Supplier[];
    onClose: () => void;
    onConfirm: (date: string, time: string, endTime: string, count: number, locName: string, locColor: string) => void;
}> = ({ enrollment, maxRecoverable, suppliers, onClose, onConfirm }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [count, setCount] = useState(1);
    const originalSupplier = suppliers.find(s => s.id === enrollment.supplierId);
    const originalLocation = originalSupplier?.locations.find(l => l.id === enrollment.locationId);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [availableSlots, setAvailableSlots] = useState<{start: string, end: string, day: number}[]>([]);

    useEffect(() => {
        const dayOfWeek = new Date(date).getDay();
        if (originalLocation && originalLocation.availability) {
            const slots = originalLocation.availability.filter(s => s.dayOfWeek === dayOfWeek);
            setAvailableSlots(slots.map(s => ({ start: s.startTime, end: s.endTime, day: s.dayOfWeek })));
            setSelectedSlotIndex(null); 
        } else {
            setAvailableSlots([]);
        }
    }, [date, originalLocation]);

    const handleConfirm = () => {
        if (selectedSlotIndex === null || !originalLocation) return;
        const slot = availableSlots[selectedSlotIndex];
        onConfirm(date, slot.start, slot.end, count, originalLocation.name, originalLocation.color);
    };

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Recupero Lezioni</h3>
                <p className="text-sm text-gray-500 mb-4">Programma il recupero per <strong>{enrollment.childName}</strong>.</p>
                <div className="space-y-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" />
                        <label className="md-input-label !top-0">Data Inizio</label>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Seleziona Slot</label>
                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {availableSlots.map((slot, idx) => (
                                    <button key={idx} onClick={() => setSelectedSlotIndex(idx)} className={`p-2 border rounded text-sm ${selectedSlotIndex === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'hover:bg-gray-50'}`}>
                                        {slot.start} - {slot.end}
                                    </button>
                                ))}
                            </div>
                        ) : <p className="text-xs text-red-500 italic">Nessuno slot.</p>}
                    </div>
                    <div className="md-input-group">
                        <input type="number" min="1" max={maxRecoverable} value={count} onChange={e => setCount(Math.min(maxRecoverable, Math.max(1, Number(e.target.value))))} className="md-input" />
                        <label className="md-input-label !top-0">Numero Lezioni</label>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                    <button onClick={handleConfirm} disabled={selectedSlotIndex === null} className="md-btn md-btn-raised md-btn-primary md-btn-sm disabled:opacity-50">Conferma</button>
                </div>
            </div>
        </Modal>
    );
};


const Enrollments: React.FC<EnrollmentsProps> = ({ initialParams }) => {
    // Data States
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'az' | 'za'>('az');
    
    // Dropdown Filters
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [filterDay, setFilterDay] = useState<string>('');
    const [filterTime, setFilterTime] = useState<string>('');
    const [filterAge, setFilterAge] = useState<string>('');

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ParentClient | null>(null);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        date: string;
        method: PaymentMethod;
        generateInvoice: boolean;
        isDeposit: boolean;
        depositAmount: number;
    }>({
        isOpen: false,
        enrollment: null,
        date: new Date().toISOString().split('T')[0],
        method: PaymentMethod.BankTransfer,
        generateInvoice: true,
        isDeposit: false,
        depositAmount: 0
    });

    const [recoveryModalState, setRecoveryModalState] = useState<{ isOpen: boolean; enrollment: Enrollment | null; maxRecoverable: number; }>({ isOpen: false, enrollment: null, maxRecoverable: 0 });
    const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isDangerous: boolean; }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDangerous: false });

    // Drag and Drop State
    const [draggedEnrollmentId, setDraggedEnrollmentId] = useState<string | null>(null);

    // --- MOVE MODE STATE (Mobile Friendly) ---
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveSourceId, setMoveSourceId] = useState<string | null>(null);

    // Fetch Data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [clientsData, enrollmentsData, suppliersData] = await Promise.all([
                getClients(),
                getAllEnrollments(),
                getSuppliers()
            ]);
            setClients(clientsData.filter(c => c.clientType === ClientType.Parent) as ParentClient[]);
            setEnrollments(enrollmentsData);
            setSuppliers(suppliersData);
            setError(null);
        } catch (err) {
            setError("Errore nel caricamento dati.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); window.addEventListener('EP_DataUpdated', fetchData); return () => window.removeEventListener('EP_DataUpdated', fetchData); }, [fetchData]);

    const handleNewEnrollment = () => { setSelectedClient(null); setEditingEnrollment(undefined); setIsModalOpen(true); }
    const handleEditClick = (e: React.MouseEvent, client: ParentClient | undefined, enrollment: Enrollment) => { e.stopPropagation(); if (!client) return; setSelectedClient(client); setEditingEnrollment(enrollment); setIsModalOpen(true); };
    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[]) => { setLoading(true); try { for (const enrollmentData of enrollmentsData) { if ('id' in enrollmentData) { await updateEnrollment((enrollmentData as any).id, enrollmentData); } else { await addEnrollment(enrollmentData); } } setIsModalOpen(false); await fetchData(); window.dispatchEvent(new Event('EP_DataUpdated')); } catch (err) { console.error("Save error:", err); setError("Errore salvataggio."); setLoading(false); } };

    // --- Actions ---
    const executePayment = async (
        enr: Enrollment, 
        paymentDateStr: string, 
        method: PaymentMethod, 
        generateInvoice: boolean,
        isDeposit: boolean,
        depositAmount: number
    ) => {
        setLoading(true);
        try {
            const fullPrice = enr.price !== undefined ? enr.price : 0;
            const actualAmount = isDeposit ? depositAmount : fullPrice;
            const paymentIsoDate = new Date(paymentDateStr).toISOString();
            const client = clients.find(c => c.id === enr.clientId);
            const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente Sconosciuto';

            // INFO PER ALLOCAZIONE COSTI/RICAVI ALLA SEDE (Iniziale)
            const allocationData = {
                allocationType: 'location' as const,
                allocationId: enr.locationId,
                allocationName: enr.locationName
            };

            if (generateInvoice) {
                const desc = isDeposit 
                    ? `Acconto iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`
                    : `Iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`;

                const itemNotes = `Sede: ${enr.locationName}`;

                const invoiceInput: InvoiceInput = {
                    clientId: enr.clientId,
                    clientName: clientName,
                    issueDate: paymentIsoDate,
                    dueDate: paymentIsoDate,
                    status: DocumentStatus.PendingSDI, 
                    paymentMethod: method,
                    items: [{ description: desc, quantity: 1, price: actualAmount, notes: itemNotes }],
                    totalAmount: actualAmount,
                    hasStampDuty: actualAmount > 77, 
                    notes: `Rif. Iscrizione ${enr.childName}`,
                    invoiceNumber: '' 
                };

                const { id: invoiceId, invoiceNumber } = await addInvoice(invoiceInput);
                
                if (actualAmount > 0) {
                    await addTransaction({
                        date: paymentIsoDate,
                        description: `Incasso Fattura ${invoiceNumber} (${method}) - ${enr.childName}`,
                        amount: actualAmount, 
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: method,
                        status: TransactionStatus.Completed,
                        relatedDocumentId: invoiceId,
                        ...allocationData // Collega alla Sede
                    });
                }

                if (isDeposit) {
                    const balance = fullPrice - depositAmount;
                    if (balance > 0) {
                        const ghostInvoice: InvoiceInput = {
                            clientId: enr.clientId,
                            clientName: clientName,
                            issueDate: new Date().toISOString(), 
                            dueDate: enr.endDate, 
                            status: DocumentStatus.Draft,
                            paymentMethod: PaymentMethod.BankTransfer,
                            items: [{ 
                                description: `Saldo iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`, 
                                quantity: 1, 
                                price: balance,
                                notes: `Sede: ${enr.locationName} - A saldo della fattura di acconto n. ${invoiceNumber}`
                            }],
                            totalAmount: balance,
                            hasStampDuty: balance > 77,
                            notes: 'Fattura generata automaticamente come saldo.',
                            invoiceNumber: '',
                            isGhost: true
                        };
                        await addInvoice(ghostInvoice);
                    }
                }
                alert(isDeposit ? `Acconto di ${actualAmount}€ registrato. Generata fattura fantasma per il saldo.` : `Pagamento registrato! Generata Fattura n. ${invoiceNumber}.`);
            } else {
                if (actualAmount > 0) {
                    await addTransaction({
                        date: paymentIsoDate,
                        description: `Incasso Iscrizione: ${enr.childName}`,
                        amount: actualAmount,
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: method,
                        status: TransactionStatus.Completed,
                        ...allocationData // Collega alla Sede
                    });
                }
                alert(`Pagamento registrato (Solo Transazione).`);
            }

            await updateEnrollment(enr.id, { status: EnrollmentStatus.Active });
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            
        } catch(err) {
            console.error("Payment error:", err);
            setError("Errore pagamento.");
            setLoading(false);
        }
    };

    // --- Core Move Logic (Used by Drop and Click) ---
    const executeMove = async (
        enrollmentId: string, 
        targetLocId: string, 
        targetLocName: string, 
        targetLocColor: string, 
        targetDayIndex: number, 
        targetStartTime: string, 
        targetEndTime: string
    ) => {
        const original = enrollments.find(en => en.id === enrollmentId);
        if (!original) return;

        // SE ISCRIZIONE E' UNASSIGNED (NUOVA): Logica di Attivazione
        if (original.locationId === 'unassigned') {
            if (window.confirm(`Assegnare ${original.childName} a ${targetLocName} (${daysOfWeekMap[targetDayIndex]} ${targetStartTime})? Verranno generate tutte le lezioni.`)) {
                setLoading(true);
                try {
                    // Trova il Supplier ID associato a questa Location ID
                    // Dato che groupedEnrollments è per display, usiamo i dati raw suppliers
                    let targetSupplierId = '';
                    let targetSupplierName = '';
                    
                    suppliers.forEach(s => {
                        const foundLoc = s.locations.find(l => l.id === targetLocId);
                        if (foundLoc) {
                            targetSupplierId = s.id;
                            targetSupplierName = s.companyName;
                        }
                    });

                    await activateEnrollmentWithLocation(
                        enrollmentId,
                        targetSupplierId,
                        targetSupplierName,
                        targetLocId,
                        targetLocName,
                        targetLocColor,
                        targetDayIndex,
                        targetStartTime,
                        targetEndTime
                    );
                    await fetchData();
                } catch (err) {
                    console.error("Errore assegnazione:", err);
                    alert("Errore durante l'assegnazione.");
                } finally {
                    setLoading(false);
                    setMoveSourceId(null);
                    setIsMoveMode(false);
                }
            }
            return;
        }

        // SE ISCRIZIONE GIA' ESISTENTE: Logica di Spostamento (Standard)
        const today = new Date();
        const todayDay = today.getDay(); // 0-6
        let diff = targetDayIndex - todayDay;
        if (diff < 0) diff += 7; // Se target è passato questa settimana, vai alla prossima
        
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + diff);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        if (window.confirm(`Spostare ${original.childName} a ${daysOfWeekMap[targetDayIndex]} ${targetStartTime}? L'iscrizione sarà aggiornata con il nuovo orario per le lezioni future.`)) {
            setLoading(true);
            try {
                await bulkUpdateLocation(
                    [enrollmentId],
                    nextDateStr,
                    targetLocId,
                    targetLocName,
                    targetLocColor,
                    targetStartTime,
                    targetEndTime
                );
                await fetchData();
            } catch (err) {
                console.error("Errore spostamento:", err);
                alert("Errore durante lo spostamento.");
            } finally {
                setLoading(false);
                setMoveSourceId(null);
                setIsMoveMode(false);
            }
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedEnrollmentId(id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (
        e: React.DragEvent, 
        targetLocId: string, 
        targetLocName: string, 
        targetLocColor: string, 
        targetDayIndex: number, 
        targetStartTime: string, 
        targetEndTime: string
    ) => {
        e.preventDefault();
        const droppedId = draggedEnrollmentId;
        setDraggedEnrollmentId(null);
        if (droppedId) {
            executeMove(droppedId, targetLocId, targetLocName, targetLocColor, targetDayIndex, targetStartTime, targetEndTime);
        }
    };

    // --- Move Mode Handlers (Touch/Click) ---
    const handleCardClick = (e: React.MouseEvent, id: string) => {
        if (isMoveMode) {
            e.stopPropagation(); // Evita di aprire il dettaglio/modifica
            setMoveSourceId(prev => prev === id ? null : id); // Toggle selezione
        }
    };

    const handleSlotClick = (
        locId: string, 
        locName: string, 
        locColor: string, 
        dayIdx: number, 
        start: string, 
        end: string
    ) => {
        if (isMoveMode && moveSourceId) {
            executeMove(moveSourceId, locId, locName, locColor, dayIdx, start, end);
        }
    };


    const handlePaymentRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setPaymentModalState({ isOpen: true, enrollment: enr, date: new Date().toISOString().split('T')[0], method: PaymentMethod.BankTransfer, generateInvoice: true, isDeposit: false, depositAmount: (enr.price || 0) / 2 });
    };

    const handleConfirmPayment = async () => {
        if (paymentModalState.enrollment && paymentModalState.date) {
            setPaymentModalState(prev => ({ ...prev, isOpen: false }));
            await executePayment(
                paymentModalState.enrollment, 
                paymentModalState.date, 
                paymentModalState.method,
                paymentModalState.generateInvoice,
                paymentModalState.isDeposit,
                paymentModalState.depositAmount
            );
        }
    };

    const handleRecoveryRequest = (e: React.MouseEvent, enr: Enrollment, absentCount: number) => { e.stopPropagation(); setRecoveryModalState({ isOpen: true, enrollment: enr, maxRecoverable: absentCount }); };
    const handleConfirmRecovery = async (date: string, startTime: string, endTime: string, count: number, locName: string, locColor: string) => { if (!recoveryModalState.enrollment) return; setRecoveryModalState(prev => ({ ...prev, isOpen: false })); setLoading(true); try { await addRecoveryLessons(recoveryModalState.enrollment.id, date, startTime, endTime, count, locName, locColor); await fetchData(); window.dispatchEvent(new Event('EP_DataUpdated')); alert("Recupero programmato con successo!"); } catch (err) { alert("Errore recupero."); } finally { setLoading(false); } };
    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => { e.stopPropagation(); setConfirmState({ isOpen: true, title: "Elimina", message: "Eliminare definitivamente?", isDangerous: true, onConfirm: async () => { setLoading(true); await deleteEnrollment(enr.id); await deleteTransactionByRelatedId(enr.id); await fetchData(); setLoading(false); } }); };

    // --- Helper per estrarre dati derivati ---
    const getChildAge = (enrollment: Enrollment): string => {
        const client = clients.find(c => c.id === enrollment.clientId);
        const child = client?.children.find(c => c.id === enrollment.childId);
        return child?.age || '';
    };

    const getFirstAppointmentData = (enrollment: Enrollment) => {
        if (enrollment.appointments && enrollment.appointments.length > 0) {
            // Find the next scheduled appointment, or fallback to the first one if all are past/consumed
            const now = new Date();
            const next = enrollment.appointments.find(a => new Date(a.date) >= now) || enrollment.appointments[0];
            const date = new Date(next.date);
            return {
                dayIndex: date.getDay(),
                dayName: daysOfWeekMap[date.getDay()],
                startTime: next.startTime,
                endTime: next.endTime
            };
        }
        return { dayIndex: 9, dayName: 'Da Definire', startTime: '', endTime: '' };
    };

    // --- Dynamic Options for Selects ---
    const availableLocations = useMemo(() => Array.from(new Set(enrollments.map(e => e.locationName))).filter(l => l && l !== 'Sede Non Definita').sort(), [enrollments]);
    const availableAges = useMemo(() => {
        const ages = new Set<string>();
        enrollments.forEach(e => {
            const age = getChildAge(e);
            if(age) ages.add(age);
        });
        return Array.from(ages).sort();
    }, [enrollments, clients]);
    const availableTimes = useMemo(() => {
        const times = new Set<string>();
        enrollments.forEach(e => {
            const d = getFirstAppointmentData(e);
            if(d.startTime) times.add(`${d.startTime} - ${d.endTime}`);
        });
        return Array.from(times).sort();
    }, [enrollments]);


    // --- Filtering Logic ---
    const filteredEnrollments = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        oneWeekAgo.setHours(0, 0, 0, 0);

        let result = enrollments.filter(enr => {
            // --- Visibility Rule: Hide old exhausted/expired cards ---
            // Hide if lessons are exhausted AND it happened more than a week ago
            const isExhausted = enr.lessonsRemaining <= 0 || enr.status === EnrollmentStatus.Completed || enr.status === EnrollmentStatus.Expired;
            
            if (isExhausted) {
                let lastRelevantDate = new Date(enr.endDate); // Default to endDate (expiry)
                
                // If we have present appointments, use the last one as the "consumption date"
                const presentApps = enr.appointments?.filter(a => a.status === 'Present');
                if (presentApps && presentApps.length > 0) {
                    const lastPres = presentApps.reduce((latest, current) => 
                        new Date(current.date) > new Date(latest.date) ? current : latest
                    );
                    lastRelevantDate = new Date(lastPres.date);
                }

                // If the relevant date is older than 1 week, hide it from the fence
                if (lastRelevantDate < oneWeekAgo) {
                    return false;
                }
            }

            // Search Term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const client = clients.find(c => c.id === enr.clientId);
                const parentName = client ? `${client.firstName} ${client.lastName}` : '';
                const childAge = getChildAge(enr);
                const appData = getFirstAppointmentData(enr);
                
                const match = 
                    enr.childName.toLowerCase().includes(term) || 
                    parentName.toLowerCase().includes(term) || 
                    enr.locationName.toLowerCase().includes(term) || 
                    childAge.toLowerCase().includes(term) ||
                    appData.dayName.toLowerCase().includes(term) ||
                    appData.startTime.includes(term);
                
                if (!match) return false;
            }

            // Dropdown Filters
            if (filterLocation && enr.locationName !== filterLocation) return false;
            if (filterAge && getChildAge(enr) !== filterAge) return false;
            if (filterDay && getFirstAppointmentData(enr).dayName !== filterDay) return false;
            if (filterTime) {
                const d = getFirstAppointmentData(enr);
                const timeStr = `${d.startTime} - ${d.endTime}`;
                if (timeStr !== filterTime) return false;
            }

            return true;
        });

        // Sorting Base (Before Grouping)
        result.sort((a, b) => {
            const nameA = a.childName.toLowerCase();
            const nameB = b.childName.toLowerCase();
            return sortOrder === 'az' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });

        return result;
    }, [enrollments, clients, searchTerm, filterLocation, filterAge, filterDay, filterTime, sortOrder]);


    // --- Grouping Logic (Recinti) ---
    // Structure: Location -> Day -> TimeSlot -> Enrollments[]
    const groupedEnrollments = useMemo(() => {
        const groups: Record<string, { // Location Key
            locationId: string;
            locationName: string;
            locationColor: string;
            days: Record<number, { // Day Index Key
                dayName: string;
                slots: Record<string, { // Time Key (Start-End)
                    timeRange: string;
                    start: string;
                    end: string;
                    items: Enrollment[];
                }>
            }>
        }> = {};

        // 1. Inizializza i gruppi con le sedi dai Supplier (così anche i recinti vuoti appaiono)
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                // Initialize structure for available slots
                const locKey = l.name;
                groups[locKey] = { 
                    locationId: l.id, 
                    locationName: l.name, 
                    locationColor: l.color || '#ccc', 
                    days: {} 
                };
                
                // Pre-populate days from availability
                if (l.availability) {
                    l.availability.forEach(slot => {
                        if (!groups[locKey].days[slot.dayOfWeek]) {
                            groups[locKey].days[slot.dayOfWeek] = { dayName: daysOfWeekMap[slot.dayOfWeek], slots: {} };
                        }
                        const timeKey = `${slot.startTime} - ${slot.endTime}`;
                        if (!groups[locKey].days[slot.dayOfWeek].slots[timeKey]) {
                            groups[locKey].days[slot.dayOfWeek].slots[timeKey] = {
                                timeRange: timeKey,
                                start: slot.startTime,
                                end: slot.endTime,
                                items: []
                            };
                        }
                    });
                }
            });
        });

        // 2. Distribuisci le iscrizioni
        filteredEnrollments.forEach(enr => {
            const locName = enr.locationName || 'Sede Non Definita';
            const locId = enr.locationId || 'unassigned';
            const locColor = enr.locationColor || '#e5e7eb';
            const appData = getFirstAppointmentData(enr);
            
            // Gestione speciale per "Unassigned"
            const timeKey = locId === 'unassigned' ? 'Da Assegnare' : (appData.startTime ? `${appData.startTime} - ${appData.endTime}` : 'Orario N/D');
            const dayIdx = locId === 'unassigned' ? 99 : appData.dayIndex; // 99 pushes to bottom if sorted asc, but we want it top? Sort logic below handles location order.

            if (!groups[locName]) {
                groups[locName] = { locationId: locId, locationName: locName, locationColor: locColor, days: {} };
            }
            
            if (!groups[locName].days[dayIdx]) {
                groups[locName].days[dayIdx] = { dayName: locId === 'unassigned' ? 'In Attesa' : appData.dayName, slots: {} };
            }

            if (!groups[locName].days[dayIdx].slots[timeKey]) {
                groups[locName].days[dayIdx].slots[timeKey] = { 
                    timeRange: timeKey, 
                    start: appData.startTime, 
                    end: appData.endTime, 
                    items: [] 
                };
            }

            groups[locName].days[dayIdx].slots[timeKey].items.push(enr);
        });

        // Convert to Arrays for rendering and sort
        const sortedGroups = Object.values(groups).sort((a,b) => {
            // Force "Sede Non Definita" to top
            if (a.locationId === 'unassigned') return -1;
            if (b.locationId === 'unassigned') return 1;
            return a.locationName.localeCompare(b.locationName);
        });

        return sortedGroups.map(loc => ({
            ...loc,
            days: Object.entries(loc.days)
                .sort(([idxA], [idxB]) => Number(idxA) - Number(idxB)) // Sort by Day Index (Mon=1, ...)
                .map(([idx, day]) => ({
                    dayIndex: Number(idx),
                    ...day,
                    slots: Object.values(day.slots).sort((a,b) => a.timeRange.localeCompare(b.timeRange))
                }))
        }));

    }, [filteredEnrollments, suppliers]);


    return (
        <div>
            {/* --- HEADER --- */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Iscrizioni</h1>
                        <p className="mt-1 text-gray-500">Gestione dei "recinti" e dotazione slot.</p>
                    </div>
                    {/* MOVE BUTTON TOGGLE (Mobile Only Visual Aid) */}
                    <button 
                        onClick={() => { setIsMoveMode(!isMoveMode); setMoveSourceId(null); }} 
                        className={`md-btn md-btn-sm md:hidden mt-2 ${isMoveMode ? 'bg-amber-100 text-amber-800 border-2 border-amber-300 shadow-inner' : 'bg-white border text-gray-700 shadow-sm'}`}
                    >
                        {isMoveMode ? (
                            <span className="flex items-center font-bold">
                                <span className="animate-pulse mr-2">👆</span> Scegli...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                ✋ Sposta
                            </span>
                        )}
                    </button>
                </div>

                {/* Search & Filters Bar */}
                <div className="flex flex-col md:flex-row gap-2 flex-1 xl:max-w-4xl xl:justify-end">
                    
                    {/* Search Input */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                        <input 
                            type="text" 
                            className="block w-full bg-white border border-gray-300 rounded-lg py-2 pl-10 pr-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            placeholder="Cerca nome, sede, orario..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Dropdown Filters Group */}
                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 min-w-[100px]">
                            <option value="">Tutte le Sedi</option>
                            {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        
                        <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 min-w-[100px]">
                            <option value="">Tutti i Giorni</option>
                            {daysOfWeekMap.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <select value={filterTime} onChange={e => setFilterTime(e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 min-w-[90px]">
                            <option value="">Tutti Orari</option>
                            {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <select value={filterAge} onChange={e => setFilterAge(e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 min-w-[80px]">
                            <option value="">Tutte Età</option>
                            {availableAges.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>

                        {/* Sort Button Toggle */}
                        <button 
                            onClick={() => setSortOrder(prev => prev === 'az' ? 'za' : 'az')}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2 px-3 rounded-lg text-xs whitespace-nowrap shadow-sm"
                        >
                            {sortOrder === 'az' ? 'A-Z' : 'Z-A'}
                        </button>
                    </div>

                    <button onClick={handleNewEnrollment} className="md-btn md-btn-raised md-btn-green whitespace-nowrap h-9 flex items-center">
                        <PlusIcon /><span className="ml-2 hidden sm:inline">Nuova</span>
                    </button>
                </div>
            </div>
            
            {/* Banner Istruzioni Move Mode */}
            {isMoveMode && (
                <div className="bg-amber-50 text-amber-900 px-4 py-2 rounded-lg mb-4 text-sm border border-amber-200 shadow-sm md:hidden">
                    {moveSourceId ? 
                        <span>Selezionato. <strong>Tocca uno slot orario</strong> per spostare.</span> : 
                        <span>Tocca un'iscrizione per selezionarla.</span>
                    }
                </div>
            )}

            {/* --- CONTENT --- */}
            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-8 pb-10">
                    {groupedEnrollments.length === 0 && <p className="text-center text-gray-500 italic py-10">Nessuna iscrizione trovata.</p>}

                    {groupedEnrollments.map((locGroup, locIdx) => (
                        <div key={locIdx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* RECINTO SEDE */}
                            <div className={`px-6 py-3 border-b border-gray-200 flex items-center gap-3 ${locGroup.locationId === 'unassigned' ? 'bg-gray-200' : 'bg-gray-50'}`}>
                                <div className="w-4 h-4 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: locGroup.locationColor }}></div>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locGroup.locationName}</h2>
                                {locGroup.locationId === 'unassigned' && <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded">Trascina nei recinti</span>}
                            </div>

                            <div className="p-6 space-y-6">
                                {locGroup.days.map((dayGroup, dayIdx) => (
                                    <div key={dayIdx} className="relative pl-4 border-l-2 border-dashed border-gray-300">
                                        {/* RECINTO GIORNO */}
                                        <h3 className="text-md font-bold text-indigo-700 mb-3 uppercase flex items-center">
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 -ml-[21px] ring-4 ring-white"></span>
                                            {dayGroup.dayName}
                                        </h3>

                                        <div className="space-y-4">
                                            {dayGroup.slots.map((slotGroup, slotIdx) => (
                                                <div 
                                                    key={slotIdx} 
                                                    className={`rounded-lg p-3 border transition-all ${
                                                        isMoveMode && moveSourceId ? 'bg-indigo-50 border-indigo-200 cursor-pointer hover:bg-indigo-100 ring-2 ring-indigo-200 ring-offset-1' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                                    }`}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, locGroup.locationId, locGroup.locationName, locGroup.locationColor, dayGroup.dayIndex, slotGroup.start, slotGroup.end)}
                                                    onClick={() => handleSlotClick(locGroup.locationId, locGroup.locationName, locGroup.locationColor, dayGroup.dayIndex, slotGroup.start, slotGroup.end)}
                                                >
                                                    {/* RECINTO ORARIO */}
                                                    <div className="flex items-center mb-3">
                                                        <span className="bg-white text-slate-600 border border-slate-200 text-xs font-mono font-bold px-2 py-1 rounded shadow-sm">
                                                            {slotGroup.timeRange}
                                                        </span>
                                                        <div className="h-px bg-slate-200 flex-1 ml-3"></div>
                                                    </div>

                                                    {/* CARDS GRID */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                        {slotGroup.items.map(enr => {
                                                            const childAge = getChildAge(enr);
                                                            const isSelectedForMove = moveSourceId === enr.id;
                                                            const isPending = enr.status === EnrollmentStatus.Pending;
                                                            const isExhausted = enr.lessonsRemaining <= 0;
                                                            const isUnassigned = enr.locationId === 'unassigned';
                                                            
                                                            // Colore card: dipende dallo stato
                                                            let cardBorderColor = locGroup.locationColor;
                                                            let cardBg = 'bg-white';
                                                            let opacity = 'opacity-100';

                                                            if (isPending) {
                                                                cardBorderColor = '#fbbf24'; // Amber
                                                                cardBg = 'bg-amber-50';
                                                            } else if (isExhausted) {
                                                                cardBorderColor = '#9ca3af'; // Gray
                                                                cardBg = 'bg-gray-100';
                                                                opacity = 'opacity-75';
                                                            } else if (isUnassigned) {
                                                                cardBorderColor = '#6b7280';
                                                                cardBg = 'bg-gray-50';
                                                            }

                                                            return (
                                                                <div 
                                                                    key={enr.id}
                                                                    draggable={!isExhausted}
                                                                    onDragStart={(e) => !isExhausted && handleDragStart(e, enr.id)}
                                                                    onClick={(e) => handleCardClick(e, enr.id)}
                                                                    className={`p-3 rounded-lg border shadow-sm transition-all relative group 
                                                                        ${cardBg} ${opacity} border-gray-200 hover:shadow-md cursor-grab active:cursor-grabbing
                                                                        ${draggedEnrollmentId === enr.id ? 'opacity-50 ring-2 ring-indigo-300' : ''}
                                                                        ${isSelectedForMove ? 'ring-4 ring-indigo-500 transform scale-95 border-indigo-300 z-10' : ''}
                                                                    `}
                                                                    style={{ borderLeftWidth: '5px', borderLeftColor: cardBorderColor }}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <h4 className={`font-bold text-sm text-gray-800`}>{enr.childName}</h4>
                                                                            <p className="text-[10px] text-gray-500">{childAge}</p>
                                                                        </div>
                                                                        {isPending && <span className="text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">Dormiente</span>}
                                                                        {isExhausted && <span className="text-[9px] bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded font-bold uppercase">Esaurito</span>}
                                                                    </div>
                                                                    
                                                                    <div className="mt-2 flex items-center justify-between">
                                                                        <p className="text-xs text-gray-600 truncate flex-1 pr-2" title={enr.subscriptionName}>{enr.subscriptionName}</p>
                                                                        <div className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap" title="Slot Consumati / Totali">
                                                                            <span className="font-bold text-indigo-600">{enr.lessonsTotal - enr.lessonsRemaining}</span>
                                                                            <span className="text-gray-400">/</span>
                                                                            <span className="font-bold text-gray-600">{enr.lessonsTotal}</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Hover Actions */}
                                                                    {!isMoveMode && (
                                                                        <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                                                                            {isPending && !isUnassigned && (
                                                                                <button onClick={(e) => handlePaymentRequest(e, enr)} className="bg-green-100 text-green-700 p-1.5 rounded-full hover:bg-green-200 shadow-sm" title="Registra Pagamento">
                                                                                    <span className="font-bold text-xs">€</span>
                                                                                </button>
                                                                            )}
                                                                            <button onClick={(e) => handleEditClick(e, clients.find(c => c.id === enr.clientId), enr)} className="bg-blue-100 text-blue-600 p-1.5 rounded-full hover:bg-blue-200 shadow-sm" title="Modifica">
                                                                                <PencilIcon />
                                                                            </button>
                                                                            <button onClick={(e) => handleDeleteRequest(e, enr)} className="bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 shadow-sm" title="Elimina">
                                                                                <TrashIcon />
                                                                            </button>
                                                                            {!isExhausted && !isPending && !isUnassigned && (
                                                                                <button onClick={(e) => handleRecoveryRequest(e, enr, 1)} className="bg-orange-100 text-orange-600 p-1.5 rounded-full hover:bg-orange-200 shadow-sm" title="Recupero">
                                                                                    <RefreshIcon />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Payment Modal */}
            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        <p className="text-sm text-gray-500 mb-4">Attiva la card <strong>{paymentModalState.enrollment.childName}</strong> sbloccando {paymentModalState.enrollment.lessonsTotal} slot.</p>
                        <div className="md-input-group">
                            <input type="date" value={paymentModalState.date} onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))} className="md-input font-bold" />
                            <label className="md-input-label !top-0">Data</label>
                        </div>
                        
                        {/* Deposit Logic */}
                        <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-200">
                            <div className="flex items-center mb-2">
                                <input 
                                    type="checkbox" 
                                    checked={paymentModalState.isDeposit}
                                    onChange={e => setPaymentModalState(prev => ({ ...prev, isDeposit: e.target.checked }))}
                                    className="h-4 w-4 text-indigo-600 rounded"
                                />
                                <label className="ml-2 text-sm font-bold text-gray-700">Acconto</label>
                            </div>
                            {paymentModalState.isDeposit && (
                                <div className="animate-fade-in pl-6">
                                    <label className="text-xs text-gray-500 block">Importo Acconto</label>
                                    <input 
                                        type="number" 
                                        value={paymentModalState.depositAmount}
                                        onChange={e => setPaymentModalState(prev => ({ ...prev, depositAmount: Number(e.target.value) }))}
                                        className="w-full p-1 border rounded text-sm font-bold"
                                    />
                                    <p className="text-xs text-orange-600 mt-1">
                                        Saldo restante: {(paymentModalState.enrollment.price || 0) - paymentModalState.depositAmount}€
                                        <br/>Verrà generata una fattura fantasma per il saldo.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex items-center bg-blue-50 p-2 rounded">
                            <input 
                                type="checkbox" 
                                checked={paymentModalState.generateInvoice}
                                onChange={e => setPaymentModalState(prev => ({...prev, generateInvoice: e.target.checked}))}
                                className="h-4 w-4 text-blue-600 rounded"
                            />
                            <label className="ml-2 text-xs text-blue-800 font-medium">Genera Documento Fiscale</label>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                            <button onClick={handleConfirmPayment} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma & Attiva</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Other modals ... */}
            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <EnrollmentForm parents={clients} initialParent={selectedClient} existingEnrollment={editingEnrollment} onSave={handleSaveEnrollment} onCancel={() => setIsModalOpen(false)} />
                </Modal>
            )}
            {recoveryModalState.isOpen && recoveryModalState.enrollment && <RecoveryModal enrollment={recoveryModalState.enrollment} maxRecoverable={recoveryModalState.maxRecoverable} suppliers={suppliers} onClose={() => setRecoveryModalState(prev => ({ ...prev, isOpen: false }))} onConfirm={handleConfirmRecovery} />}
            <ConfirmModal isOpen={confirmState.isOpen} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} isDangerous={confirmState.isDangerous} />
        </div>
    );
};

export default Enrollments;
