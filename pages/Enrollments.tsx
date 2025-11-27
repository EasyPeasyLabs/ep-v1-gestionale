
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
    // ... (Code for Recovery Modal - Same as before)
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
    // ... (States same as before)
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'parent_asc' | 'parent_desc'>('date_desc');
    const [filterDay, setFilterDay] = useState<string>('');
    const [filterTime, setFilterTime] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ParentClient | null>(null);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);
    
    // Updated Payment Modal State with "isDeposit" and "depositAmount"
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

    // ... (fetchData useEffect - same as before)
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

    // --- Payment Execution with Deposit Logic ---
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

            if (generateInvoice) {
                // 1. Fattura Acconto (o Totale)
                const desc = isDeposit 
                    ? `Acconto iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`
                    : `Iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`;

                const invoiceInput: InvoiceInput = {
                    clientId: enr.clientId,
                    clientName: clientName,
                    issueDate: paymentIsoDate,
                    dueDate: paymentIsoDate,
                    status: DocumentStatus.PendingSDI, 
                    paymentMethod: method,
                    items: [{ description: desc, quantity: 1, price: actualAmount, notes: 'Generata automaticamente' }],
                    totalAmount: actualAmount,
                    hasStampDuty: actualAmount > 77, 
                    notes: `Rif. Iscrizione ${enr.childName}`,
                    invoiceNumber: '' 
                };

                const { id: invoiceId, invoiceNumber } = await addInvoice(invoiceInput);
                
                // Transazione
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
                    });
                }

                // 2. Se Acconto -> Genera Fattura Fantasma per il saldo
                if (isDeposit) {
                    const balance = fullPrice - depositAmount;
                    if (balance > 0) {
                        const ghostInvoice: InvoiceInput = {
                            clientId: enr.clientId,
                            clientName: clientName,
                            issueDate: new Date().toISOString(), // Data creazione
                            dueDate: enr.endDate, // Scadenza = Fine Corso
                            status: DocumentStatus.Draft,
                            paymentMethod: PaymentMethod.BankTransfer,
                            items: [{ 
                                description: `Saldo iscrizione corso: ${enr.childName} - ${enr.subscriptionName}`, 
                                quantity: 1, 
                                price: balance,
                                notes: `A saldo della fattura di acconto n. ${invoiceNumber}`
                            }],
                            totalAmount: balance,
                            hasStampDuty: balance > 77,
                            notes: 'Fattura generata automaticamente come saldo.',
                            invoiceNumber: '',
                            isGhost: true // FLAG CHIAVE
                        };
                        await addInvoice(ghostInvoice);
                    }
                }

                const msg = isDeposit 
                    ? `Acconto di ${actualAmount}€ registrato. Generata fattura fantasma per il saldo.`
                    : `Pagamento registrato! Generata Fattura n. ${invoiceNumber}.`;
                alert(msg);

            } else {
                // Solo Transazione
                if (actualAmount > 0) {
                    await addTransaction({
                        date: paymentIsoDate,
                        description: `Incasso Iscrizione: ${enr.childName}`,
                        amount: actualAmount,
                        type: TransactionType.Income,
                        category: TransactionCategory.Sales,
                        paymentMethod: method,
                        status: TransactionStatus.Completed,
                        allocationType: 'enrollment',
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
            generateInvoice: true,
            isDeposit: false,
            depositAmount: (enr.price || 0) / 2 // Default suggestion 50%
        });
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
    const handleRevokeRequest = (e: React.MouseEvent, enr: Enrollment) => { e.stopPropagation(); setConfirmState({ isOpen: true, title: "Revoca", message: "Torna in attesa?", isDangerous: true, onConfirm: async () => { setLoading(true); await updateEnrollment(enr.id, { status: EnrollmentStatus.Pending }); await fetchData(); setLoading(false); } }); };
    const handleAbandonRequest = (e: React.MouseEvent, enr: Enrollment) => { e.stopPropagation(); setConfirmState({ isOpen: true, title: "Abbandono", message: "Confermi?", isDangerous: true, onConfirm: async () => { setLoading(true); await updateEnrollment(enr.id, { status: EnrollmentStatus.Completed, endDate: new Date().toISOString() }); await fetchData(); setLoading(false); } }); };
    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => { e.stopPropagation(); setConfirmState({ isOpen: true, title: "Elimina", message: "Eliminare definitivamente?", isDangerous: true, onConfirm: async () => { setLoading(true); await deleteEnrollment(enr.id); await deleteTransactionByRelatedId(enr.id); await fetchData(); setLoading(false); } }); };

    // --- Filtering Logic Omitted for brevity (same as before) ---
    const filteredEnrollments = useMemo(() => {
        let result = enrollments.filter(enr => {
            if (statusFilter === 'pending' && enr.status !== EnrollmentStatus.Pending) return false;
            if (statusFilter === 'active' && enr.status !== EnrollmentStatus.Active) return false;
            if (statusFilter === 'completed' && enr.status !== EnrollmentStatus.Completed && enr.status !== EnrollmentStatus.Expired) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const client = clients.find(c => c.id === enr.clientId);
                const parentName = client ? `${client.firstName} ${client.lastName}` : '';
                const match = enr.childName.toLowerCase().includes(term) || parentName.toLowerCase().includes(term) || enr.supplierName.toLowerCase().includes(term) || enr.locationName.toLowerCase().includes(term);
                if (!match) return false;
            }
            return true;
        });
        result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        return result;
    }, [enrollments, clients, statusFilter, searchTerm]);

    return (
        <div>
            {/* ... Header and Toolbar ... */}
            <div className="flex wrap gap-4 justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Iscrizioni</h1>
                <button onClick={handleNewEnrollment} className="md-btn md-btn-raised md-btn-green"><PlusIcon /><span className="ml-2">Nuova</span></button>
            </div>
            
            {/* Render List */}
            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEnrollments.map(enr => (
                        <div key={enr.id} className="md-card p-5 flex flex-col hover:shadow-md transition-shadow" style={{ borderLeftWidth: '8px', borderLeftColor: enr.locationColor || '#ccc' }}>
                            <div className="flex justify-between mb-2">
                                <h3 className="text-lg font-bold">{enr.childName}</h3>
                                {enr.status === 'Active' && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Attivo</span>}
                                {enr.status === 'Pending' && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">In Attesa</span>}
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{enr.subscriptionName}</p>
                            
                            {/* Actions Footer */}
                            <div className="mt-auto pt-3 border-t flex justify-between items-center">
                                {enr.status === 'Pending' && (
                                    <button onClick={(e) => handlePaymentRequest(e, enr)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600 shadow-sm">
                                        Registra Pagamento
                                    </button>
                                )}
                                {enr.status === 'Active' && (
                                    <button onClick={(e) => handleRecoveryRequest(e, enr, 1)} className="text-orange-500 text-xs font-bold flex items-center"><RefreshIcon/> Recupera</button>
                                )}
                                <div className="flex gap-1">
                                    <button onClick={(e) => handleEditClick(e, clients.find(c => c.id === enr.clientId), enr)} className="text-gray-400 p-1 hover:text-blue-500"><PencilIcon/></button>
                                    <button onClick={(e) => handleDeleteRequest(e, enr)} className="text-gray-400 p-1 hover:text-red-500"><TrashIcon/></button>
                                </div>
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
                            <button onClick={handleConfirmPayment} className="md-btn md-btn-raised md-btn-green md-btn-sm">Conferma</button>
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
