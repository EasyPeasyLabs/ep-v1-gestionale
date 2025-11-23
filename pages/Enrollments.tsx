
import React, { useState, useEffect, useCallback } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus, DocumentStatus, InvoiceInput } from '../types';
import { getClients } from '../services/parentService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment } from '../services/enrollmentService';
import { addTransaction, deleteTransactionByRelatedId, addInvoice } from '../services/financeService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import EnrollmentForm from '../components/EnrollmentForm';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import SearchIcon from '../components/icons/SearchIcon';
import TrashIcon from '../components/icons/TrashIcon';

interface EnrollmentsProps {
    initialParams?: {
        status?: 'all' | 'pending' | 'active';
        searchTerm?: string;
    };
}

const Enrollments: React.FC<EnrollmentsProps> = ({ initialParams }) => {
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filter State
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'>('date_desc');
    
    // Apply initial params if present
    useEffect(() => {
        if (initialParams) {
            if (initialParams.status) setStatusFilter(initialParams.status);
            if (initialParams.searchTerm) setSearchTerm(initialParams.searchTerm);
        }
    }, [initialParams]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ParentClient | null>(null); // Usato SOLO per EDIT mode
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);

    // Payment Modal State (New)
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        enrollment: Enrollment | null;
        date: string;
    }>({
        isOpen: false,
        enrollment: null,
        date: new Date().toISOString().split('T')[0]
    });

    // Confirmation Modal State
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
            const [clientsData, enrollmentsData] = await Promise.all([
                getClients(),
                getAllEnrollments()
            ]);
            setClients(clientsData.filter(c => c.clientType === ClientType.Parent) as ParentClient[]);
            setEnrollments(enrollmentsData);
            setError(null);
        } catch (err) {
            console.error("[DEBUG] Errore fetch dati:", err);
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

    // --- Actions Handlers ---

    const handleNewEnrollment = () => {
        // Reset selezione per nuova iscrizione
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
            // Itera su tutte le iscrizioni passate (1 nel caso di edit, N nel caso di nuova iscrizione multipla)
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
            console.error("[DEBUG] Errore salvataggio:", err);
            setError(`Errore durante il salvataggio: ${err}`);
            setLoading(false);
        }
    };

    // --- Payment Logic ---

    const executePayment = async (enr: Enrollment, paymentDateStr: string) => {
        console.log(`[DEBUG] Executing Payment for ${enr.id} on date ${paymentDateStr}`);
        setLoading(true);
        try {
            const amount = enr.price !== undefined ? enr.price : 0;
            const client = clients.find(c => c.id === enr.clientId);
            const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente Sconosciuto';
            const paymentIsoDate = new Date(paymentDateStr).toISOString();

            // 1. GENERAZIONE AUTOMATICA FATTURA (DA SIGILLARE)
            // La fattura viene creata come 'PendingSDI' (Da Sigillare) per il bonifico.
            const invoiceInput: InvoiceInput = {
                clientId: enr.clientId,
                clientName: clientName,
                issueDate: paymentIsoDate, // Usa la data selezionata
                dueDate: paymentIsoDate, // Già pagata in data X
                status: DocumentStatus.PendingSDI, 
                paymentMethod: PaymentMethod.BankTransfer,
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
            console.log(`[DEBUG] Fattura generata: ${invoiceNumber} (Pending SDI)`);

            // 2. Aggiorna Stato Iscrizione -> Active
            await updateEnrollment(enr.id, { status: EnrollmentStatus.Active });
            
            // 3. Crea Transazione (COLLEGATA ALLA FATTURA)
            if (amount > 0) {
                await addTransaction({
                    date: paymentIsoDate, // Usa la data selezionata
                    description: `Incasso Fattura ${invoiceNumber} (Bonifico) - Iscrizione ${enr.childName}`,
                    amount: amount, 
                    type: TransactionType.Income,
                    category: TransactionCategory.Sales,
                    paymentMethod: PaymentMethod.BankTransfer,
                    status: TransactionStatus.Completed,
                    relatedDocumentId: invoiceId, 
                });
            }

            console.log("[DEBUG] Transazione e Fattura create correttamente.");

            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert(`Pagamento registrato!\nÈ stata generata la Fattura n. ${invoiceNumber} in stato 'Da sigillare (SDI)' con data ${new Date(paymentDateStr).toLocaleDateString()}.`);
        } catch(err) {
            console.error("[DEBUG] Errore Pagamento:", err);
            setError("Errore nel processare il pagamento. Controlla la console.");
            setLoading(false);
        }
    };

    // Open Modal instead of generic confirm
    const handlePaymentRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setPaymentModalState({
            isOpen: true,
            enrollment: enr,
            date: new Date().toISOString().split('T')[0] // Default to today
        });
    };

    const handleConfirmPayment = async () => {
        if (paymentModalState.enrollment && paymentModalState.date) {
            setPaymentModalState(prev => ({ ...prev, isOpen: false }));
            await executePayment(paymentModalState.enrollment, paymentModalState.date);
        }
    };

    // --- Revoke Logic ---

    const executeRevoke = async (enr: Enrollment) => {
        setLoading(true);
        try {
            await updateEnrollment(enr.id, { status: EnrollmentStatus.Pending });
            // Nota: La revoca dell'iscrizione NON elimina la fattura emessa per ragioni di tracciabilità fiscale.
            // La fattura deve essere gestita (annullata/nota di credito) manualmente in Finanza se necessario.
            
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert("Iscrizione revocata. Ricorda di gestire l'eventuale fattura emessa nella sezione Finanza.");
        } catch(err) {
            console.error("[DEBUG] Errore Revoca:", err);
            setError("Errore durante la revoca del pagamento.");
            setLoading(false);
        }
    };

    const handleRevokeRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Revoca Pagamento",
            message: `Attenzione: L'iscrizione tornerà 'In Attesa'.\nNOTA: La fattura eventualmente emessa NON verrà eliminata automaticamente.`,
            isDangerous: true,
            onConfirm: () => executeRevoke(enr)
        });
    };

    // --- Abandon Logic ---

    const executeAbandon = async (enr: Enrollment) => {
        setLoading(true);
        try {
            await updateEnrollment(enr.id, { 
                status: EnrollmentStatus.Completed,
                endDate: new Date().toISOString()
            });
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(err) {
            console.error("[DEBUG] Errore Abbandona:", err);
            setError("Errore durante l'operazione di abbandono.");
            setLoading(false);
        }
    };

    const handleAbandonRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Conferma Abbandono",
            message: `Sei sicuro di voler segnare come 'Abbandonato' l'iscrizione di ${enr.childName}? Lo stato passerà a Completato e la data fine sarà impostata a oggi.`,
            isDangerous: true,
            onConfirm: () => executeAbandon(enr)
        });
    };

    const executeDelete = async (enr: Enrollment) => {
        setLoading(true);
        try {
            await deleteEnrollment(enr.id);
            // Elimina eventuali transazioni orfane (legacy)
            await deleteTransactionByRelatedId(enr.id);
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(err) {
            console.error("[DEBUG] Errore Eliminazione:", err);
            setError("Errore durante l'eliminazione dell'iscrizione.");
            setLoading(false);
        }
    };

    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Elimina Iscrizione",
            message: `Sei sicuro di voler eliminare DEFINITIVAMENTE l'iscrizione di ${enr.childName}?`,
            isDangerous: true,
            onConfirm: () => executeDelete(enr)
        });
    };

    // Filter Logic
    const filteredEnrollments = enrollments.filter(enr => {
        // Status Filter
        if (statusFilter === 'pending' && enr.status !== EnrollmentStatus.Pending) return false;
        if (statusFilter === 'active' && enr.status !== EnrollmentStatus.Active) return false;
        
        // Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            return (
                enr.childName.toLowerCase().includes(lowerTerm) ||
                enr.subscriptionName.toLowerCase().includes(lowerTerm) ||
                (enr.locationName || '').toLowerCase().includes(lowerTerm)
            );
        }
        return true;
    });

    // Sorting Logic
    filteredEnrollments.sort((a, b) => {
        switch (sortOrder) {
            case 'date_asc':
                return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            case 'date_desc':
                return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            case 'name_asc':
                return a.childName.localeCompare(b.childName);
            case 'name_desc':
                return b.childName.localeCompare(a.childName);
            default:
                return 0;
        }
    });

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Iscrizioni</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestisci le iscrizioni, i pagamenti e gli abbandoni.</p>
                </div>
                <button onClick={handleNewEnrollment} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon />
                    <span className="ml-2">Nuova Iscrizione</span>
                </button>
            </div>

            <div className="mb-6 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
                {/* Filters */}
                 <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                    <button onClick={() => setStatusFilter('all')} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${statusFilter === 'all' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Tutte</button>
                    <button onClick={() => setStatusFilter('active')} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${statusFilter === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Attive</button>
                    <button onClick={() => setStatusFilter('pending')} className={`px-3 py-1 text-sm rounded-full border whitespace-nowrap ${statusFilter === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>In Attesa</button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Cerca..."
                            className="block w-full bg-white border rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{borderColor: 'var(--md-divider)'}}
                        />
                    </div>

                    {/* Sort */}
                    <div className="w-full md:w-48">
                        <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value as any)} 
                            className="block w-full bg-white border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
                            style={{borderColor: 'var(--md-divider)'}}
                        >
                            <option value="date_desc">Più Recenti</option>
                            <option value="date_asc">Meno Recenti</option>
                            <option value="name_asc">Nome Allievo (A-Z)</option>
                            <option value="name_desc">Nome Allievo (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : 
             error ? <p className="text-center text-red-500 py-8">{error}</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEnrollments.map(enr => (
                        <div key={enr.id} className="md-card p-0 flex flex-col border-t-4 border-transparent hover:border-indigo-500 transition-all">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-gray-800">{enr.childName}</h3>
                                    {enr.status === EnrollmentStatus.Pending && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-1 rounded">Da Pagare</span>}
                                    {enr.status === EnrollmentStatus.Active && <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-1 rounded">Attiva</span>}
                                    {(enr.status === EnrollmentStatus.Completed || enr.status === EnrollmentStatus.Expired) && <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-1 rounded">Terminata</span>}
                                </div>
                                <p className="text-sm text-indigo-600 font-medium mb-1">{enr.subscriptionName}</p>
                                <p className="text-xs text-gray-500 mb-4">{enr.locationName}</p>
                                
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">
                                    <div>Start: <strong>{new Date(enr.startDate).toLocaleDateString()}</strong></div>
                                    <div>End: <strong>{new Date(enr.endDate).toLocaleDateString()}</strong></div>
                                    <div>Lezioni: <strong>{enr.lessonsTotal}</strong></div>
                                    <div>Residuo: <strong>{enr.lessonsRemaining}</strong></div>
                                </div>
                                
                                <div className="text-xs text-gray-400 truncate">
                                    ID: {enr.id.substring(0,8)}...
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-end items-center gap-2">
                                {/* Buttons based on status */}
                                {enr.status === EnrollmentStatus.Pending && (
                                    <button onClick={(e) => handlePaymentRequest(e, enr)} className="px-3 py-1 text-xs font-bold text-white bg-green-500 rounded hover:bg-green-600 shadow-sm">
                                        Registra Pagamento
                                    </button>
                                )}
                                {enr.status === EnrollmentStatus.Active && (
                                    <>
                                        <button onClick={(e) => handleRevokeRequest(e, enr)} className="px-2 py-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100">
                                            Revoca
                                        </button>
                                        <button onClick={(e) => handleAbandonRequest(e, enr)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200">
                                            Abbandona
                                        </button>
                                    </>
                                )}
                                
                                <div className="h-4 w-px bg-gray-300 mx-1"></div>

                                <button onClick={(e) => handleEditClick(e, clients.find(c => c.id === enr.clientId), enr)} className="text-gray-400 hover:text-indigo-600 p-1" title="Modifica">
                                    <PencilIcon />
                                </button>
                                <button onClick={(e) => handleDeleteRequest(e, enr)} className="text-gray-400 hover:text-red-600 p-1" title="Elimina">
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredEnrollments.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 italic">
                            Nessuna iscrizione trovata.
                        </div>
                    )}
                </div>
            )}

            {/* Modale Iscrizione */}
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

            {/* Modale Conferma Pagamento (Nuova) */}
            {paymentModalState.isOpen && paymentModalState.enrollment && (
                <Modal onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} size="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Registra Pagamento</h3>
                        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                            <p className="text-sm text-green-800">
                                Stai registrando il pagamento per <strong>{paymentModalState.enrollment.childName}</strong>.
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                                Verrà generata una fattura "Da sigillare (SDI)" con la data indicata qui sotto.
                            </p>
                        </div>
                        
                        <div className="md-input-group">
                            <input
                                type="date"
                                value={paymentModalState.date}
                                onChange={(e) => setPaymentModalState(prev => ({ ...prev, date: e.target.value }))}
                                className="md-input font-bold"
                            />
                            <label className="md-input-label !top-0">Data Ricezione Pagamento</label>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button 
                                onClick={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))} 
                                className="md-btn md-btn-flat md-btn-sm"
                            >
                                Annulla
                            </button>
                            <button 
                                onClick={handleConfirmPayment} 
                                className="md-btn md-btn-raised md-btn-green md-btn-sm"
                            >
                                Conferma Pagamento
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modale Conferma Generica */}
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
