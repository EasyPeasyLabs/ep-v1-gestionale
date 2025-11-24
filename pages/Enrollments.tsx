
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput, Supplier } from '../types';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment, addRecoveryLessons } from '../services/enrollmentService';
import { addTransaction, deleteTransactionByRelatedId, addInvoice } from '../services/financeService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import EnrollmentForm from '../components/EnrollmentForm';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import SearchIcon from '../components/icons/SearchIcon';
import TrashIcon from '../components/icons/TrashIcon';
import RefreshIcon from '../components/icons/RestoreIcon'; // Used for Recovery icon

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
    
    // Recupera location originale per default
    const originalSupplier = suppliers.find(s => s.id === enrollment.supplierId);
    const originalLocation = originalSupplier?.locations.find(l => l.id === enrollment.locationId);

    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [availableSlots, setAvailableSlots] = useState<{start: string, end: string, day: number}[]>([]);

    // Aggiorna gli slot disponibili quando cambia la data (in base al giorno della settimana)
    useEffect(() => {
        const dayOfWeek = new Date(date).getDay();
        if (originalLocation && originalLocation.availability) {
            const slots = originalLocation.availability.filter(s => s.dayOfWeek === dayOfWeek);
            setAvailableSlots(slots.map(s => ({ start: s.startTime, end: s.endTime, day: s.dayOfWeek })));
            setSelectedSlotIndex(null); // Reset selezione
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
                <p className="text-sm text-gray-500 mb-4">
                    Programma il recupero per <strong>{enrollment.childName}</strong>.
                    <br/>
                    <span className="text-xs text-orange-600">Assenze da recuperare: {maxRecoverable}</span>
                </p>

                <div className="space-y-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" />
                        <label className="md-input-label !top-0">Data Inizio Recupero</label>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Seleziona Slot ({daysOfWeekMap[new Date(date).getDay()]})</label>
                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {availableSlots.map((slot, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedSlotIndex(idx)}
                                        className={`p-2 border rounded text-sm ${selectedSlotIndex === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'hover:bg-gray-50'}`}
                                    >
                                        {slot.start} - {slot.end}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-red-500 italic border p-2 rounded bg-red-50">Nessuno slot disponibile per questo giorno nella sede originale.</p>
                        )}
                    </div>

                    <div className="md-input-group">
                        <input 
                            type="number" 
                            min="1" 
                            max={maxRecoverable} 
                            value={count} 
                            onChange={e => setCount(Math.min(maxRecoverable, Math.max(1, Number(e.target.value))))} 
                            className="md-input" 
                        />
                        <label className="md-input-label !top-0">Numero Lezioni</label>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={selectedSlotIndex === null}
                        className="md-btn md-btn-raised md-btn-primary md-btn-sm disabled:opacity-50"
                    >
                        Conferma Recupero
                    </button>
                </div>
            </div>
        </Modal>
    );
};


const Enrollments: React.FC<EnrollmentsProps> = ({ initialParams }) => {
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filter State
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'parent_asc' | 'parent_desc'>('date_desc');
    
    // Advanced Filters
    const [filterDay, setFilterDay] = useState<string>('');
    const [filterTime, setFilterTime] = useState<string>('');

    // Apply initial params
    useEffect(() => {
        if (initialParams) {
            if (initialParams.status) setStatusFilter(initialParams.status as any);
            if (initialParams.searchTerm) setSearchTerm(initialParams.searchTerm);
        }
    }, [initialParams]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ParentClient | null>(null);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);

    // Payment Modal State
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        date: string;
        method: PaymentMethod;
        generateInvoice: boolean;
    }>({
        isOpen: false,
        enrollment: null,
        date: new Date().toISOString().split('T')[0],
        method: PaymentMethod.BankTransfer,
        generateInvoice: true
    });

    // Recovery Modal State
    const [recoveryModalState, setRecoveryModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        maxRecoverable: number;
    }>({
        isOpen: false,
        enrollment: null,
        maxRecoverable: 0
    });

    // Confirm Modal
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDangerous: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        isDangerous: false
    });

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
            console.error("[DEBUG] Error fetching data:", err);
            setError("Errore nel caricamento dati.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const handleDataUpdate = () => fetchData();
        window.addEventListener('EP_DataUpdated', handleDataUpdate);
        return () => window.removeEventListener('EP_DataUpdated', handleDataUpdate);
    }, [fetchData]);

    // --- Handlers ---

    const handleNewEnrollment = () => {
        setSelectedClient(null); 
        setEditingEnrollment(undefined);
        setIsModalOpen(true);
    }

    const handleEditClick = (e: React.MouseEvent, client: ParentClient | undefined, enrollment: Enrollment) => {
        e.stopPropagation();
        if (!client) return;
        setSelectedClient(client);
        setEditingEnrollment(enrollment);
        setIsModalOpen(true);
    };

    const handleSaveEnrollment = async (enrollmentsData: EnrollmentInput[]) => {
        setLoading(true);
        try {
            for (const enrollmentData of enrollmentsData) {
                if ('id' in enrollmentData) {
                    await updateEnrollment((enrollmentData as any).id, enrollmentData);
                } else {
                    await addEnrollment(enrollmentData);
                }
            }
            setIsModalOpen(false);
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch (err) {
            console.error("Save error:", err);
            setError("Errore salvataggio.");
            setLoading(false);
        }
    };

    // --- Payment ---
    const executePayment = async (enr: Enrollment, paymentDateStr: string, method: PaymentMethod, generateInvoice: boolean) => {
        setLoading(true);
        try {
            const amount = enr.price !== undefined ? enr.price : 0;
            const paymentIsoDate = new Date(paymentDateStr).toISOString();

            if (generateInvoice) {
                // --- OPZIONE 1: GENERA FATTURA + TRANSAZIONE COLLEGATA ---
                const client = clients.find(c => c.id === enr.clientId);
                const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente Sconosciuto';

                const invoiceInput: InvoiceInput = {
                    clientId: enr.clientId,
                    clientName: clientName,
                    issueDate: paymentIsoDate,
                    dueDate: paymentIsoDate,
                    status: DocumentStatus.PendingSDI, 
                    paymentMethod: method,
                    items: [{
                        description: `Iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`,
                        quantity: 1,
                        price: amount,
                        notes: 'Generata automaticamente da iscrizione'
                    }],
                    totalAmount: amount,
                    hasStampDuty: amount > 77, 
                    notes: `Rif. Iscrizione ${enr.childName}`,
                    invoiceNumber: '' 
                };

                const { id: invoiceId, invoiceNumber } = await addInvoice(invoiceInput);
                
                if (amount > 0) {
                    await addTransaction({
                        date: paymentIsoDate,
                        description: `Incasso Fattura ${invoiceNumber} (${method}) - Iscrizione ${enr.childName}`,
                        amount: amount, 
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: method,
                        status: TransactionStatus.Completed,
                        relatedDocumentId: invoiceId, 
                    });
                }
                alert(`Pagamento registrato!\nGenerata Fattura n. ${invoiceNumber} (Da sigillare).`);

            } else {
                // --- OPZIONE 2: SOLO TRANSAZIONE (Es. Contanti senza fattura) ---
                if (amount > 0) {
                    await addTransaction({
                        date: paymentIsoDate,
                        description: `Incasso Iscrizione: ${enr.childName} - ${enr.subscriptionName}`,
                        amount: amount,
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: method,
                        status: TransactionStatus.Completed,
                        allocationType: 'enrollment', // Colleghiamo direttamente all'iscrizione per i report
                        allocationId: enr.id,
                        allocationName: enr.childName
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

    const handlePaymentRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setPaymentModalState({
            isOpen: true,
            enrollment: enr,
            date: new Date().toISOString().split('T')[0],
            method: PaymentMethod.BankTransfer,
            generateInvoice: true // Default true
        });
    };

    const handleConfirmPayment = async () => {
        if (paymentModalState.enrollment && paymentModalState.date) {
            setPaymentModalState(prev => ({ ...prev, isOpen: false }));
            await executePayment(
                paymentModalState.enrollment, 
                paymentModalState.date, 
                paymentModalState.method,
                paymentModalState.generateInvoice
            );
        }
    };

    // --- Recovery ---
    const handleRecoveryRequest = (e: React.MouseEvent, enr: Enrollment, absentCount: number) => {
        e.stopPropagation();
        setRecoveryModalState({
            isOpen: true,
            enrollment: enr,
            maxRecoverable: absentCount
        });
    };

    const handleConfirmRecovery = async (date: string, startTime: string, endTime: string, count: number, locName: string, locColor: string) => {
        if (!recoveryModalState.enrollment) return;
        setRecoveryModalState(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
            await addRecoveryLessons(
                recoveryModalState.enrollment.id,
                date,
                startTime,
                endTime,
                count,
                locName,
                locColor
            );
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert("Recupero programmato con successo!");
        } catch (err) {
            console.error("Recovery error:", err);
            alert("Errore durante la programmazione del recupero.");
        } finally {
            setLoading(false);
        }
    };

    // --- Other Actions ---
    const handleRevokeRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Revoca Pagamento",
            message: `Attenzione: L'iscrizione tornerà 'In Attesa'. La fattura/transazione emessa NON sarà eliminata automaticamente.`,
            isDangerous: true,
            onConfirm: async () => {
                setLoading(true);
                await updateEnrollment(enr.id, { status: EnrollmentStatus.Pending });
                await fetchData();
                setLoading(false);
            }
        });
    };

    const handleAbandonRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Conferma Abbandono",
            message: `Segnare come 'Abbandonato'? Lo stato passerà a Completato.`,
            isDangerous: true,
            onConfirm: async () => {
                setLoading(true);
                await updateEnrollment(enr.id, { status: EnrollmentStatus.Completed, endDate: new Date().toISOString() });
                await fetchData();
                setLoading(false);
            }
        });
    };

    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Elimina Iscrizione",
            message: `Eliminare DEFINITIVAMENTE l'iscrizione di ${enr.childName}?`,
            isDangerous: true,
            onConfirm: async () => {
                setLoading(true);
                await deleteEnrollment(enr.id);
                await deleteTransactionByRelatedId(enr.id);
                await fetchData();
                setLoading(false);
            }
        });
    };

    // --- Filtering & Sorting ---
    const filteredEnrollments = useMemo(() => {
        let result = enrollments.filter(enr => {
            // 1. Status
            if (statusFilter === 'pending' && enr.status !== EnrollmentStatus.Pending) return false;
            if (statusFilter === 'active' && enr.status !== EnrollmentStatus.Active) return false;
            if (statusFilter === 'completed' && enr.status !== EnrollmentStatus.Completed && enr.status !== EnrollmentStatus.Expired) return false;

            // 2. Search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const client = clients.find(c => c.id === enr.clientId);
                const parentName = client ? `${client.firstName} ${client.lastName}` : '';
                
                const match = 
                    enr.childName.toLowerCase().includes(term) ||
                    parentName.toLowerCase().includes(term) ||
                    enr.supplierName.toLowerCase().includes(term) ||
                    enr.locationName.toLowerCase().includes(term);
                
                if (!match) return false;
            }

            // 3. Day / Time Filter (Check appointments)
            if (filterDay !== '' || filterTime !== '') {
                const dayNum = filterDay !== '' ? parseInt(filterDay) : null;
                const hasMatch = enr.appointments?.some(app => {
                    const appDate = new Date(app.date);
                    const dayOk = dayNum === null || appDate.getDay() === dayNum;
                    const timeOk = filterTime === '' || (filterTime >= app.startTime && filterTime <= app.endTime);
                    return dayOk && timeOk;
                });
                if (!hasMatch) return false;
            }

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            const clientA = clients.find(c => c.id === a.clientId);
            const clientB = clients.find(c => c.id === b.clientId);
            const parentA = clientA ? clientA.lastName : '';
            const parentB = clientB ? clientB.lastName : '';

            switch (sortOrder) {
                case 'date_asc': return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                case 'date_desc': return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                case 'name_asc': return a.childName.localeCompare(b.childName);
                case 'name_desc': return b.childName.localeCompare(a.childName);
                case 'parent_asc': return parentA.localeCompare(parentB);
                case 'parent_desc': return parentB.localeCompare(parentA);
                default: return 0;
            }
        });

        return result;
    }, [enrollments, clients, statusFilter, searchTerm, sortOrder, filterDay, filterTime]);

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Iscrizioni</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci iscrizioni, pagamenti e recuperi.</p>
                </div>
                <button onClick={handleNewEnrollment} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon /> <span className="ml-2">Nuova Iscrizione</span>
                </button>
            </div>

            {/* Filters Toolbar */}
            <div className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col lg:flex-row gap-3 items-center">
                {/* Status Tabs */}
                <div className="flex space-x-1 bg-white rounded border p-1 overflow-x-auto w-full lg:w-auto">
                    <button onClick={() => setStatusFilter('all')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${statusFilter === 'all' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-gray-600'}`}>Tutte</button>
                    <button onClick={() => setStatusFilter('active')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${statusFilter === 'active' ? 'bg-green-100 text-green-800 font-bold' : 'text-gray-600'}`}>Attive</button>
                    <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${statusFilter === 'pending' ? 'bg-amber-100 text-amber-800 font-bold' : 'text-gray-600'}`}>In Attesa</button>
                    <button onClick={() => setStatusFilter('completed')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${statusFilter === 'completed' ? 'bg-gray-200 text-gray-800 font-bold' : 'text-gray-600'}`}>Concluse</button>
                </div>

                {/* Search & Sort - FIX MOBILE: Added flex-wrap to allow items to stack on small screens instead of shrinking */}
                <div className="flex-1 flex gap-2 w-full flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><SearchIcon /></div>
                        <input 
                            type="text" 
                            placeholder="Cerca Allievo, Genitore, Sede..." 
                            className="block w-full bg-white border rounded py-1.5 pl-8 pr-2 text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Day / Time */}
                    <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="w-24 text-xs border rounded bg-white h-[34px]">
                        <option value="">Giorno...</option>
                        {daysOfWeekMap.map((d, i) => <option key={i} value={i}>{d.substring(0,3)}</option>)}
                    </select>
                    <input type="time" value={filterTime} onChange={e => setFilterTime(e.target.value)} className="w-20 text-xs border rounded bg-white px-1 h-[34px]" />

                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="w-32 text-xs border rounded bg-white h-[34px]">
                        <option value="date_desc">Recenti</option>
                        <option value="name_asc">Allievo A-Z</option>
                        <option value="parent_asc">Genitore A-Z</option>
                    </select>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEnrollments.map(enr => {
                        // Logic for badges
                        const usedSlots = enr.appointments ? enr.appointments.filter(a => a.status === 'Present').length : 0;
                        const absentSlots = enr.appointments ? enr.appointments.filter(a => a.status === 'Absent').length : 0;
                        // Se il numero di presenze ha raggiunto il totale, il pacchetto è concluso (indipendentemente dallo stato attivo del cliente)
                        const isPackageFinished = usedSlots >= enr.lessonsTotal;
                        
                        // Recupero abilitato solo se attivo, non finito e ci sono assenze
                        const canRecover = enr.status === EnrollmentStatus.Active && !isPackageFinished && absentSlots > 0;

                        return (
                            <div key={enr.id} className="md-card flex flex-col relative overflow-hidden hover:shadow-md transition-shadow" style={{ borderLeftWidth: '8px', borderLeftColor: enr.locationColor || '#ccc' }}>
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-lg font-bold text-gray-800">{enr.childName}</h3>
                                        <div className="flex flex-col items-end gap-1">
                                            {/* Badge Stato Cliente */}
                                            {enr.status === EnrollmentStatus.Active && <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded">Cliente: ATTIVO</span>}
                                            {enr.status === EnrollmentStatus.Pending && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded">In Attesa</span>}
                                            
                                            {/* Badge Stato Abbonamento */}
                                            {isPackageFinished && enr.status === EnrollmentStatus.Active && (
                                                <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-700 px-2 py-0.5 rounded border border-gray-300">Abbonamento: CONCLUSO</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <p className="text-sm text-indigo-600 font-medium mb-1">{enr.subscriptionName}</p>
                                    <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: enr.locationColor}}></span>
                                        {enr.locationName}
                                    </p>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                                        <div>Inizio: <strong>{new Date(enr.startDate).toLocaleDateString()}</strong></div>
                                        <div>Fine: <strong>{new Date(enr.endDate).toLocaleDateString()}</strong></div>
                                        <div>Totale: <strong>{enr.lessonsTotal}</strong></div>
                                        <div className={`${isPackageFinished ? 'text-red-600 font-bold' : ''}`}>
                                            Usati: <strong>{usedSlots}</strong> / {enr.lessonsTotal}
                                        </div>
                                        {absentSlots > 0 && <div className="col-span-2 text-orange-600 font-bold">Assenze: {absentSlots}</div>}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center">
                                    <div>
                                        {canRecover && (
                                            <button 
                                                onClick={(e) => handleRecoveryRequest(e, enr, absentSlots)}
                                                className="flex items-center px-2 py-1 text-xs font-bold text-white bg-orange-500 rounded hover:bg-orange-600 shadow-sm transition-colors"
                                            >
                                                <span className="mr-1"><RefreshIcon /></span> RECUPERA
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {enr.status === EnrollmentStatus.Pending && (
                                            <button onClick={(e) => handlePaymentRequest(e, enr)} className="px-3 py-1 text-xs font-bold text-white bg-green-500 rounded hover:bg-green-600 shadow-sm">
                                                Registra Pagamento
                                            </button>
                                        )}
                                        
                                        {enr.status === EnrollmentStatus.Active && (
                                            <>
                                                <button onClick={(e) => handleRevokeRequest(e, enr)} className="text-amber-600 hover:text-amber-800 text-xs font-medium underline px-1">Revoca</button>
                                                <button onClick={(e) => handleAbandonRequest(e, enr)} className="text-gray-500 hover:text-gray-700 text-xs font-medium underline px-1">Abbandona</button>
                                            </>
                                        )}

                                        <div className="h-4 w-px bg-gray-300 mx-1"></div>

                                        <button onClick={(e) => handleEditClick(e, clients.find(c => c.id === enr.clientId), enr)} className="text-gray-400 hover:text-indigo-600 p-1">
                                            <PencilIcon />
                                        </button>
                                        <button onClick={(e) => handleDeleteRequest(e, enr)} className="text-gray-400 hover:text-red-600 p-1">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredEnrollments.length === 0 && <div className="col-span-full text-center py-12 text-gray-500 italic">Nessuna iscrizione trovata con i filtri correnti.</div>}
                </div>
            )}

            {/* Modals */}
            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <EnrollmentForm 
                        parents={clients} 
                        initialParent={selectedClient}
                        existingEnrollment={editingEnrollment}
                        onSave={handleSaveEnrollment} 
                        onCancel={() => setIsModalOpen(false)} 
                    />
                </Modal>
            )}

            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        <div className="md-input-group">
                            <input type="date" value={paymentModalState.date} onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))} className="md-input font-bold" />
                            <label className="md-input-label !top-0">Data Pagamento</label>
                        </div>
                        <div className="md-input-group mt-4">
                            <select value={paymentModalState.method} onChange={(e) => setPaymentModalState(prev => ({ ...prev, method: e.target.value as PaymentMethod }))} className="md-input font-bold">
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <label className="md-input-label !top-0">Metodo</label>
                        </div>
                        
                        {/* Opzione Genera Fattura */}
                        <div className="mt-4 flex items-center bg-gray-50 p-3 rounded border border-gray-200">
                            <input 
                                id="genInvoice"
                                type="checkbox" 
                                checked={paymentModalState.generateInvoice}
                                onChange={(e) => setPaymentModalState(prev => ({ ...prev, generateInvoice: e.target.checked }))}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="genInvoice" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                                Genera e collega Fattura automaticamente
                            </label>
                        </div>
                        {!paymentModalState.generateInvoice && (
                            <p className="text-xs text-amber-600 mt-1 ml-1">
                                Verrà creata solo una transazione finanziaria.
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                            <button onClick={handleConfirmPayment} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma</button>
                        </div>
                    </div>
                </Modal>
            )}

            {recoveryModalState.isOpen && recoveryModalState.enrollment && (
                <RecoveryModal 
                    enrollment={recoveryModalState.enrollment}
                    maxRecoverable={recoveryModalState.maxRecoverable}
                    suppliers={suppliers}
                    onClose={() => setRecoveryModalState(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={handleConfirmRecovery}
                />
            )}

            <ConfirmModal 
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                isDangerous={confirmState.isDangerous}
            />
        </div>
    );
};

export default Enrollments;
