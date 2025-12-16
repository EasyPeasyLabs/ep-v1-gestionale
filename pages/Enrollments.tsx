
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput, Supplier, Invoice } from '../types';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment, addRecoveryLessons, bulkUpdateLocation, activateEnrollmentWithLocation, getEnrollmentsForClient } from '../services/enrollmentService';
import { cleanupEnrollmentFinancials, deleteAutoRentTransactions, getInvoices } from '../services/financeService';
import { processPayment } from '../services/paymentService'; // NEW
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

// --- Modal Recupero ---
const RecoveryModal: React.FC<{
    enrollment: Enrollment;
    maxRecoverable: number;
    suppliers: Supplier[];
    onClose: () => void;
    onConfirm: (date: string, time: string, endTime: string, count: number, locName: string, locColor: string) => void;
}> = ({ enrollment, maxRecoverable, suppliers, onClose, onConfirm }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [count, setCount] = useState(1);
    
    // Default: Sede originale dell'iscrizione
    const originalLocationId = enrollment.locationId;
    const [selectedLocationId, setSelectedLocationId] = useState(originalLocationId);
    
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [availableSlots, setAvailableSlots] = useState<{start: string, end: string, day: number}[]>([]);

    const currentLocation = useMemo(() => {
        for (const s of suppliers) {
            const loc = s.locations.find(l => l.id === selectedLocationId);
            if (loc) return loc;
        }
        return null;
    }, [suppliers, selectedLocationId]);

    const allLocations = useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => {
            s.locations.forEach(l => {
                locs.push({ id: l.id, name: l.name });
            });
        });
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    useEffect(() => {
        const dayOfWeek = new Date(date).getDay();
        if (currentLocation && currentLocation.availability) {
            const slots = currentLocation.availability.filter(s => s.dayOfWeek === dayOfWeek);
            setAvailableSlots(slots.map(s => ({ start: s.startTime, end: s.endTime, day: s.dayOfWeek })));
            setSelectedSlotIndex(null); 
        } else {
            setAvailableSlots([]);
        }
    }, [date, currentLocation]);

    const handleConfirm = () => {
        if (selectedSlotIndex === null || !currentLocation) return;
        const slot = availableSlots[selectedSlotIndex];
        onConfirm(date, slot.start, slot.end, count, currentLocation.name, currentLocation.color);
    };

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Recupero Lezioni</h3>
                <p className="text-sm text-gray-500 mb-4">Programma il recupero per <strong>{enrollment.childName}</strong>.</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Presso Sede (Recinto)</label>
                        <select 
                            value={selectedLocationId} 
                            onChange={(e) => setSelectedLocationId(e.target.value)} 
                            className="md-input bg-white"
                        >
                            {allLocations.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" />
                        <label className="md-input-label !top-0">Data Inizio</label>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Seleziona Slot (Sede Selezionata)</label>
                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {availableSlots.map((slot, idx) => (
                                    <button key={idx} onClick={() => setSelectedSlotIndex(idx)} className={`p-2 border rounded text-sm ${selectedSlotIndex === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'hover:bg-gray-50'}`}>
                                        {slot.start} - {slot.end}
                                    </button>
                                ))}
                            </div>
                        ) : <p className="text-xs text-red-500 italic">Nessuno slot disponibile per questo giorno in questa sede.</p>}
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
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        date: string;
        method: PaymentMethod;
        createInvoice: boolean;
        isDeposit: boolean;
        isBalance: boolean;
        depositAmount: number;
        ghostInvoiceId?: string; // ID della fattura ghost da promuovere
    }>({
        isOpen: false,
        enrollment: null,
        date: new Date().toISOString().split('T')[0],
        method: PaymentMethod.BankTransfer,
        createInvoice: true,
        isDeposit: false,
        isBalance: false,
        depositAmount: 0
    });

    const [recoveryModalState, setRecoveryModalState] = useState<{ isOpen: boolean; enrollment: Enrollment | null; maxRecoverable: number; }>({ isOpen: false, enrollment: null, maxRecoverable: 0 });
    
    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        scope: 'single' | 'all';
    }>({
        isOpen: false,
        enrollment: null,
        scope: 'single'
    });

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
    const executePaymentAction = async (
        enr: Enrollment, 
        paymentDateStr: string, 
        method: PaymentMethod, 
        createInvoice: boolean,
        isDeposit: boolean,
        isBalance: boolean,
        depositAmount: number,
        ghostInvoiceId?: string
    ) => {
        setLoading(true);
        const fullPrice = enr.price !== undefined ? enr.price : 0;
        const actualAmount = (isDeposit || isBalance) ? depositAmount : fullPrice;
        
        const client = clients.find(c => c.id === enr.clientId);

        const result = await processPayment(
            enr, 
            client, 
            actualAmount, 
            paymentDateStr, 
            method, 
            createInvoice,
            isDeposit,
            fullPrice,
            ghostInvoiceId // Passa l'ID per la promozione se esiste
        );

        if (result.success) {
            alert("Pagamento registrato con successo.");
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } else {
            setError("Errore durante la registrazione del pagamento: " + result.error);
        }
        setLoading(false);
    };

    // ... (executeMove, handleDragStart, handleDragOver, handleDrop, handleCardClick, handleSlotClick logic remains same) ...
    // Re-included briefly for completeness of file
    const executeMove = async (enrollmentId: string, targetLocId: string, targetLocName: string, targetLocColor: string, targetDayIndex: number, targetStartTime: string, targetEndTime: string) => {
        const original = enrollments.find(en => en.id === enrollmentId);
        if (!original) return;
        if (original.locationId === 'unassigned') {
            if (window.confirm(`Assegnare ${original.childName} a ${targetLocName}?`)) {
                setLoading(true);
                try {
                    let targetSupplierId = '';
                    let targetSupplierName = '';
                    suppliers.forEach(s => { const foundLoc = s.locations.find(l => l.id === targetLocId); if (foundLoc) { targetSupplierId = s.id; targetSupplierName = s.companyName; } });
                    await activateEnrollmentWithLocation(enrollmentId, targetSupplierId, targetSupplierName, targetLocId, targetLocName, targetLocColor, targetDayIndex, targetStartTime, targetEndTime);
                    await fetchData();
                } catch (err) { alert("Errore assegnazione."); } finally { setLoading(false); setMoveSourceId(null); setIsMoveMode(false); }
            }
            return;
        }
        // Move existing
        const today = new Date();
        const todayDay = today.getDay();
        let diff = targetDayIndex - todayDay;
        if (diff < 0) diff += 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + diff);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (window.confirm(`Spostare ${original.childName}?`)) {
            setLoading(true);
            try {
                await bulkUpdateLocation([enrollmentId], nextDateStr, targetLocId, targetLocName, targetLocColor, targetStartTime, targetEndTime);
                await fetchData();
            } catch (err) { alert("Errore spostamento."); } finally { setLoading(false); setMoveSourceId(null); setIsMoveMode(false); }
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedEnrollmentId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
    const handleDrop = (e: React.DragEvent, locId: string, locName: string, locColor: string, dayIdx: number, start: string, end: string) => { e.preventDefault(); const droppedId = draggedEnrollmentId; setDraggedEnrollmentId(null); if (droppedId) executeMove(droppedId, locId, locName, locColor, dayIdx, start, end); };
    const handleCardClick = (e: React.MouseEvent, id: string) => { if (isMoveMode) { e.stopPropagation(); setMoveSourceId(prev => prev === id ? null : id); } };
    const handleSlotClick = (locId: string, locName: string, locColor: string, dayIdx: number, start: string, end: string) => { if (isMoveMode && moveSourceId) executeMove(moveSourceId, locId, locName, locColor, dayIdx, start, end); };


    const handlePaymentRequest = async (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        
        let isBalanceMode = false;
        let ghostId = undefined;
        let suggestedAmount = (enr.price || 0);

        try {
            const invoices = await getInvoices();
            
            // 1. Cerca se c'è un Acconto Pagato per questo corso
            const childName = enr.childName.toLowerCase();
            const depositInvoice = invoices.find(i => 
                i.clientId === enr.clientId && 
                !i.isDeleted && 
                !i.isGhost && 
                (i.items.some(item => item.description.toLowerCase().includes('acconto') && item.description.toLowerCase().includes(childName)))
            );

            // 2. Cerca se c'è una Fattura Ghost (Draft) pronta per il saldo
            const ghostInvoice = invoices.find(i => 
                i.clientId === enr.clientId &&
                i.isGhost === true &&
                i.status === DocumentStatus.Draft &&
                !i.isDeleted &&
                i.items.some(item => item.description.toLowerCase().includes('saldo') && item.description.toLowerCase().includes(childName))
            );

            if (depositInvoice) {
                isBalanceMode = true;
                suggestedAmount = Math.max(0, (enr.price || 0) - depositInvoice.totalAmount);
                if (ghostInvoice) {
                    ghostId = ghostInvoice.id;
                }
            }
        } catch(e) { console.error("Error checking invoices", e); }

        setPaymentModalState({ 
            isOpen: true, 
            enrollment: enr, 
            date: new Date().toISOString().split('T')[0], 
            method: PaymentMethod.BankTransfer,
            createInvoice: true, 
            isDeposit: !isBalanceMode, 
            isBalance: isBalanceMode, 
            depositAmount: isBalanceMode ? suggestedAmount : (enr.price || 0) / 2,
            ghostInvoiceId: ghostId
        });
    };

    const handleConfirmPayment = async () => {
        if (paymentModalState.enrollment && paymentModalState.date) {
            setPaymentModalState(prev => ({ ...prev, isOpen: false }));
            await executePaymentAction(
                paymentModalState.enrollment, 
                paymentModalState.date, 
                paymentModalState.method,
                paymentModalState.createInvoice,
                paymentModalState.isDeposit,
                paymentModalState.isBalance,
                paymentModalState.depositAmount,
                paymentModalState.ghostInvoiceId
            );
        }
    };

    const handleRecoveryRequest = (e: React.MouseEvent, enr: Enrollment, absentCount: number) => { e.stopPropagation(); setRecoveryModalState({ isOpen: true, enrollment: enr, maxRecoverable: absentCount }); };
    const handleConfirmRecovery = async (date: string, startTime: string, endTime: string, count: number, locName: string, locColor: string) => { if (!recoveryModalState.enrollment) return; setRecoveryModalState(prev => ({ ...prev, isOpen: false })); setLoading(true); try { await addRecoveryLessons(recoveryModalState.enrollment.id, date, startTime, endTime, count, locName, locColor); await fetchData(); window.dispatchEvent(new Event('EP_DataUpdated')); alert("Recupero programmato con successo!"); } catch (err) { alert("Errore recupero."); } finally { setLoading(false); } };
    
    // --- DELETE HANDLERS ---
    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => { 
        e.stopPropagation(); 
        setDeleteModalState({ isOpen: true, enrollment: enr, scope: 'single' });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalState.enrollment) return;
        const target = deleteModalState.enrollment;
        const scope = deleteModalState.scope;
        
        setDeleteModalState(prev => ({...prev, isOpen: false}));
        setLoading(true);

        try {
            if (scope === 'single') {
                await cleanupEnrollmentFinancials(target);
                await deleteEnrollment(target.id);
            } else {
                const allEnrollments = await getEnrollmentsForClient(target.clientId);
                for (const enr of allEnrollments) {
                    await cleanupEnrollmentFinancials(enr);
                    await deleteEnrollment(enr.id);
                }
            }
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (err) {
            console.error("Delete error:", err);
            alert("Errore durante l'eliminazione.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeleteAllModalOpen(false);
        setLoading(true);
        try {
            const allEnrollments = await getAllEnrollments();
            for (const enr of allEnrollments) {
                await cleanupEnrollmentFinancials(enr);
                await deleteEnrollment(enr.id);
                // NOTA: I noli (Auto-Rent) non vengono cancellati massivamente qui, 
                // devono essere gestiti dalla pulizia finanziaria se necessario.
            }
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert("Tutte le iscrizioni e i dati correlati sono stati eliminati.");
        } catch (err) {
            console.error("Error deleting all:", err);
            alert("Errore durante l'eliminazione totale.");
        } finally {
            setLoading(false);
        }
    };

    // --- Helper per estrarre dati derivati ---
    const getChildAge = (enrollment: Enrollment): string => {
        const client = clients.find(c => c.id === enrollment.clientId);
        const child = client?.children.find(c => c.id === enrollment.childId);
        return child?.age || '';
    };

    const getFirstAppointmentData = (enrollment: Enrollment) => {
        if (enrollment.appointments && enrollment.appointments.length > 0) {
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
            const isExhausted = enr.lessonsRemaining <= 0 || enr.status === EnrollmentStatus.Completed || enr.status === EnrollmentStatus.Expired;
            if (isExhausted) {
                let lastRelevantDate = new Date(enr.endDate); 
                const presentApps = enr.appointments?.filter(a => a.status === 'Present');
                if (presentApps && presentApps.length > 0) {
                    const lastPres = presentApps.reduce((latest, current) => 
                        new Date(current.date) > new Date(latest.date) ? current : latest
                    );
                    lastRelevantDate = new Date(lastPres.date);
                }
                if (lastRelevantDate < oneWeekAgo) return false;
            }

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

        result.sort((a, b) => {
            const nameA = a.childName.toLowerCase();
            const nameB = b.childName.toLowerCase();
            return sortOrder === 'az' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });

        return result;
    }, [enrollments, clients, searchTerm, filterLocation, filterAge, filterDay, filterTime, sortOrder]);


    // --- Grouping Logic (Recinti) ---
    const groupedEnrollments = useMemo(() => {
        const groups: Record<string, { 
            locationId: string;
            locationName: string;
            locationColor: string;
            days: Record<number, { 
                dayName: string;
                slots: Record<string, { 
                    timeRange: string;
                    start: string;
                    end: string;
                    items: Enrollment[];
                }>
            }>
        }> = {};

        suppliers.forEach(s => {
            s.locations.forEach(l => {
                const locKey = l.name;
                groups[locKey] = { 
                    locationId: l.id, 
                    locationName: l.name, 
                    locationColor: l.color || '#ccc', 
                    days: {} 
                };
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

        filteredEnrollments.forEach(enr => {
            const locName = enr.locationName || 'Sede Non Definita';
            const locId = enr.locationId || 'unassigned';
            const locColor = enr.locationColor || '#e5e7eb';
            const appData = getFirstAppointmentData(enr);
            
            const timeKey = locId === 'unassigned' ? 'Da Assegnare' : (appData.startTime ? `${appData.startTime} - ${appData.endTime}` : 'Orario N/D');
            const dayIdx = locId === 'unassigned' ? 99 : appData.dayIndex; 

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

        const sortedGroups = Object.values(groups).sort((a,b) => {
            if (a.locationId === 'unassigned') return -1;
            if (b.locationId === 'unassigned') return 1;
            return a.locationName.localeCompare(b.locationName);
        });

        return sortedGroups.map(loc => ({
            ...loc,
            days: Object.entries(loc.days)
                .sort(([idxA], [idxB]) => Number(idxA) - Number(idxB)) 
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

                <div className="flex flex-col md:flex-row gap-2 flex-1 xl:max-w-4xl xl:justify-end">
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
                        <button onClick={() => setSortOrder(prev => prev === 'az' ? 'za' : 'az')} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2 px-3 rounded-lg text-xs whitespace-nowrap shadow-sm">
                            {sortOrder === 'az' ? 'A-Z' : 'Z-A'}
                        </button>
                    </div>

                    <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>
                    <button onClick={handleNewEnrollment} className="md-btn md-btn-raised md-btn-green whitespace-nowrap h-9 flex items-center">
                        <PlusIcon /><span className="ml-2 hidden sm:inline">Nuova</span>
                    </button>
                </div>
            </div>
            
            {isMoveMode && (
                <div className="bg-amber-50 text-amber-900 px-4 py-2 rounded-lg mb-4 text-sm border border-amber-200 shadow-sm md:hidden">
                    {moveSourceId ? <span>Selezionato. <strong>Tocca uno slot orario</strong> per spostare.</span> : <span>Tocca un'iscrizione per selezionarla.</span>}
                </div>
            )}

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="space-y-8 pb-10">
                    {groupedEnrollments.length === 0 && <p className="text-center text-gray-500 italic py-10">Nessuna iscrizione trovata.</p>}

                    {groupedEnrollments.map((locGroup, locIdx) => (
                        <div key={locIdx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className={`px-6 py-3 border-b border-gray-200 flex items-center gap-3 ${locGroup.locationId === 'unassigned' ? 'bg-gray-200' : 'bg-gray-50'}`}>
                                <div className="w-4 h-4 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: locGroup.locationColor }}></div>
                                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{locGroup.locationName}</h2>
                                {locGroup.locationId === 'unassigned' && <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded">Trascina nei recinti</span>}
                            </div>

                            <div className="p-6 space-y-6">
                                {locGroup.days.map((dayGroup, dayIdx) => (
                                    <div key={dayIdx} className="relative pl-4 border-l-2 border-dashed border-gray-300">
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
                                                    <div className="flex items-center mb-3">
                                                        <span className="bg-white text-slate-600 border border-slate-200 text-xs font-mono font-bold px-2 py-1 rounded shadow-sm">
                                                            {slotGroup.timeRange}
                                                        </span>
                                                        <div className="h-px bg-slate-200 flex-1 ml-3"></div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                        {slotGroup.items.map(enr => {
                                                            const childAge = getChildAge(enr);
                                                            const isSelectedForMove = moveSourceId === enr.id;
                                                            const isPending = enr.status === EnrollmentStatus.Pending;
                                                            const isExhausted = enr.lessonsRemaining <= 0;
                                                            const isUnassigned = enr.locationId === 'unassigned';
                                                            
                                                            let cardBorderColor = locGroup.locationColor;
                                                            let cardBg = 'bg-white';
                                                            let opacity = 'opacity-100';

                                                            if (isPending) {
                                                                cardBorderColor = '#fbbf24'; 
                                                                cardBg = 'bg-amber-50';
                                                            } else if (isExhausted) {
                                                                cardBorderColor = '#9ca3af'; 
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
                                                                    
                                                                    {!isMoveMode && (
                                                                        <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                                                                            {!isUnassigned && (
                                                                                <button onClick={(e) => handlePaymentRequest(e, enr)} className="bg-green-100 text-green-700 p-1.5 rounded-full hover:bg-green-200 shadow-sm" title="Registra Pagamento / Saldo">
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

            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Pagamento per <strong>{paymentModalState.enrollment.childName}</strong>.<br/>
                            Totale Iscrizione: <span className="font-bold text-indigo-600">{paymentModalState.enrollment.price}€</span>
                        </p>
                        
                        <div className="md-input-group mb-4">
                            <input type="date" value={paymentModalState.date} onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))} className="md-input font-bold" />
                            <label className="md-input-label !top-0">Data Pagamento</label>
                        </div>

                        <div className="md-input-group mb-4">
                            <select value={paymentModalState.method} onChange={(e) => setPaymentModalState(prev => ({ ...prev, method: e.target.value as PaymentMethod }))} className="md-input">
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <label className="md-input-label !top-0">Metodo Pagamento</label>
                        </div>
                        
                        <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200 space-y-3">
                            <div className="flex gap-4">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="paymentType"
                                        checked={paymentModalState.isDeposit}
                                        onChange={() => setPaymentModalState(prev => ({ 
                                            ...prev, 
                                            isDeposit: true,
                                            isBalance: false, 
                                            depositAmount: (prev.enrollment?.price || 0) / 2 
                                        }))}
                                        className="h-4 w-4 text-indigo-600 rounded"
                                    />
                                    <span className="ml-2 text-sm font-bold text-gray-700">In Acconto</span>
                                </label>

                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="paymentType"
                                        checked={paymentModalState.isBalance}
                                        onChange={() => setPaymentModalState(prev => ({ 
                                            ...prev, 
                                            isBalance: true,
                                            isDeposit: false,
                                            depositAmount: prev.enrollment ? (prev.enrollment.price || 0) - (prev.isBalance ? 0 : (prev.enrollment.price || 0) / 2) : 0
                                        }))}
                                        className="h-4 w-4 text-green-600 rounded"
                                    />
                                    <span className="ml-2 text-sm font-bold text-green-700">A Saldo</span>
                                </label>
                            </div>
                            
                            {(paymentModalState.isDeposit || paymentModalState.isBalance) && (
                                <div className="animate-fade-in pl-2 pt-2">
                                    <label className="text-xs text-gray-500 block font-bold mb-1">Importo Versato Ora</label>
                                    <input 
                                        type="number" 
                                        value={paymentModalState.depositAmount}
                                        onChange={e => setPaymentModalState(prev => ({ ...prev, depositAmount: Number(e.target.value) }))}
                                        className="w-full p-2 border rounded text-sm font-bold text-right"
                                    />
                                    {paymentModalState.isDeposit && (
                                        <div className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
                                            Rimanenza (Saldo): <strong>{(paymentModalState.enrollment.price || 0) - paymentModalState.depositAmount}€</strong>
                                            <br/>Verrà generata una notifica di saldo.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Generazione Documento</label>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-2 border rounded cursor-pointer text-center text-xs transition-colors ${!paymentModalState.createInvoice ? 'bg-gray-100 border-gray-300 text-gray-600' : 'bg-white border-gray-200'}`}>
                                    <input type="radio" name="invoiceGen" checked={!paymentModalState.createInvoice} onChange={() => setPaymentModalState(prev => ({ ...prev, createInvoice: false }))} className="hidden" />
                                    🚫 Non crea fattura
                                </label>
                                <label className={`flex-1 p-2 border rounded cursor-pointer text-center text-xs transition-colors ${paymentModalState.createInvoice ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-gray-200'}`}>
                                    <input type="radio" name="invoiceGen" checked={paymentModalState.createInvoice} onChange={() => setPaymentModalState(prev => ({ ...prev, createInvoice: true }))} className="hidden" />
                                    📄 Crea fattura {paymentModalState.ghostInvoiceId ? '(Promuovi)' : ''}
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                            <button onClick={handleConfirmPayment} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma Pagamento</button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteModalState.isOpen && deleteModalState.enrollment && (
                <Modal onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <TrashIcon />
                            <h3 className="text-lg font-bold">Elimina Iscrizione</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Stai per eliminare l'iscrizione di <strong>{deleteModalState.enrollment.childName}</strong>. 
                            Questa azione è irreversibile.
                        </p>
                        <div className="space-y-3 mb-6">
                            <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deleteModalState.scope === 'single' ? 'bg-red-50 border-red-200' : 'bg-white hover:bg-gray-50'}`}>
                                <input type="radio" name="deleteScope" checked={deleteModalState.scope === 'single'} onChange={() => setDeleteModalState(prev => ({ ...prev, scope: 'single' }))} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500" />
                                <div className="ml-3"><span className="block text-sm font-bold text-gray-800">Elimina solo questa</span><span className="block text-xs text-gray-500">Rimuove solo questa iscrizione e i relativi movimenti finanziari.</span></div>
                            </label>
                            <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deleteModalState.scope === 'all' ? 'bg-red-50 border-red-200' : 'bg-white hover:bg-gray-50'}`}>
                                <input type="radio" name="deleteScope" checked={deleteModalState.scope === 'all'} onChange={() => setDeleteModalState(prev => ({ ...prev, scope: 'all' }))} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500" />
                                <div className="ml-3"><span className="block text-sm font-bold text-gray-800">Elimina tutte (Cliente)</span><span className="block text-xs text-gray-500">Rimuove TUTTE le iscrizioni storiche e i dati finanziari di questo cliente.</span></div>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                            <button onClick={handleConfirmDelete} className="md-btn md-btn-raised md-btn-red md-btn-sm">Conferma Eliminazione</button>
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmModal 
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleConfirmDeleteAll}
                title="ELIMINA TUTTE LE ISCRIZIONI"
                message="⚠️ ATTENZIONE: Stai per eliminare TUTTE le iscrizioni attive e storiche. Questa azione cancellerà a cascata anche tutte le Lezioni, Presenze, Transazioni e Fatture collegate. Questa operazione è irreversibile. Confermi?"
                isDangerous={true}
                confirmText="Sì, Elimina TUTTO"
            />

            {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} size="lg"><EnrollmentForm parents={clients} initialParent={selectedClient} existingEnrollment={editingEnrollment} onSave={handleSaveEnrollment} onCancel={() => setIsModalOpen(false)} /></Modal>}
            {recoveryModalState.isOpen && recoveryModalState.enrollment && <RecoveryModal enrollment={recoveryModalState.enrollment} maxRecoverable={recoveryModalState.maxRecoverable} suppliers={suppliers} onClose={() => setRecoveryModalState(prev => ({ ...prev, isOpen: false }))} onConfirm={handleConfirmRecovery} />}
        </div>
    );
};

export default Enrollments;
