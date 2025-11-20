
import React, { useState, useEffect, useCallback } from 'react';
import { ParentClient, Enrollment, EnrollmentInput, EnrollmentStatus, TransactionType, TransactionCategory, PaymentMethod, ClientType, TransactionStatus } from '../types';
import { getClients } from '../services/parentService';
import { getAllEnrollments, addEnrollment, updateEnrollment, deleteEnrollment } from '../services/enrollmentService';
import { addTransaction, deleteTransactionByRelatedId } from '../services/financeService';
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
    
    // Apply initial params if present
    useEffect(() => {
        if (initialParams) {
            if (initialParams.status) setStatusFilter(initialParams.status);
            if (initialParams.searchTerm) setSearchTerm(initialParams.searchTerm);
        }
    }, [initialParams]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ParentClient | null>(null);
    const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | undefined>(undefined);

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

    const handleEnrollClick = (e: React.MouseEvent, client: ParentClient) => {
        e.stopPropagation();
        setSelectedClient(client);
        setEditingEnrollment(undefined);
        setIsModalOpen(true);
    };

    const handleEditClick = (e: React.MouseEvent, client: ParentClient, enrollment: Enrollment) => {
        e.stopPropagation();
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

    const executePayment = async (enr: Enrollment) => {
        console.log(`[DEBUG] Executing Payment for ${enr.id}`);
        setLoading(true);
        try {
            // 1. Set Enrollment Active
            await updateEnrollment(enr.id, { status: EnrollmentStatus.Active });
            
            // 2. Create Transaction
            const amount = enr.price !== undefined ? enr.price : 0;
            
            if (amount === 0) {
                console.warn("Attenzione: Prezzo iscrizione non trovato o zero. Transazione generata a 0.");
            }

            await addTransaction({
                date: new Date().toISOString(),
                description: `Incasso Iscrizione ${enr.childName} - ${enr.subscriptionName}`,
                amount: amount, 
                type: TransactionType.Income,
                category: TransactionCategory.Sales,
                paymentMethod: PaymentMethod.Other,
                status: TransactionStatus.Completed,
                relatedDocumentId: enr.id,
            });

            console.log("[DEBUG] Transazione creata correttamente.");

            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
            alert(`Pagamento registrato con successo! È stata generata una transazione di ${amount}€.`);
        } catch(err) {
            console.error("[DEBUG] Errore Pagamento:", err);
            setError("Errore nel processare il pagamento. Controlla la console.");
            setLoading(false);
        }
    };

    const handlePaymentRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        const priceMsg = enr.price ? `${enr.price}€` : '0€ (Prezzo non definito)';
        setConfirmState({
            isOpen: true,
            title: "Conferma Pagamento",
            message: `Confermi il pagamento per l'iscrizione di ${enr.childName}? Verrà registrata una transazione di entrata di ${priceMsg}.`,
            isDangerous: false,
            onConfirm: () => executePayment(enr)
        });
    };

    // --- Revoke Logic ---

    const executeRevoke = async (enr: Enrollment) => {
        setLoading(true);
        try {
            await updateEnrollment(enr.id, { status: EnrollmentStatus.Pending });
            await deleteTransactionByRelatedId(enr.id);
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
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
            message: `Attenzione: Vuoi annullare il pagamento per ${enr.childName}? L'iscrizione tornerà 'In Attesa' e la transazione registrata verrà eliminata.`,
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
            title: "Termina Iscrizione",
            message: `Sei sicuro di voler terminare anticipatamente l'iscrizione di ${enr.childName}? Lo storico verrà mantenuto ma il posto sarà liberato.`,
            isDangerous: true,
            onConfirm: () => executeAbandon(enr)
        });
    };

    // --- Delete Logic (New) ---
    const executeDelete = async (enr: Enrollment) => {
        setLoading(true);
        try {
            await deleteEnrollment(enr.id);
            // Opzionale: puliamo anche eventuali transazioni per non lasciare orfani
            await deleteTransactionByRelatedId(enr.id);
            
            await fetchData();
            window.dispatchEvent(new Event('EP_DataUpdated'));
        } catch(err) {
            console.error("[DEBUG] Errore Eliminazione:", err);
            setError("Errore durante l'eliminazione definitiva.");
            setLoading(false);
        }
    };

    const handleDeleteRequest = (e: React.MouseEvent, enr: Enrollment) => {
        e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: "Elimina Iscrizione",
            message: `ATTENZIONE: Stai per eliminare definitivamente l'iscrizione di ${enr.childName}. Questa azione rimuoverà il record dal database e le eventuali transazioni collegate. L'azione è irreversibile.`,
            isDangerous: true,
            onConfirm: () => executeDelete(enr)
        });
    };


    const getScheduleString = (enr: Enrollment) => {
        if (!enr.appointments || enr.appointments.length === 0) return "Orario non definito";
        const firstApp = enr.appointments[0];
        const date = new Date(firstApp.date);
        const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        return `${days[date.getDay()]} ${firstApp.startTime}-${firstApp.endTime}`;
    };


    const filteredClients = clients.filter(client => {
        // 1. Filter by Search Term
        const term = searchTerm.toLowerCase();
        const parentMatches = 
            client.firstName.toLowerCase().includes(term) || 
            client.lastName.toLowerCase().includes(term);
        
        const childrenMatches = client.children && client.children.some(child => 
            child.name.toLowerCase().includes(term)
        );

        if (term && !parentMatches && !childrenMatches) return false;

        // 2. Filter by Status (if specific status selected)
        const clientEnrollments = enrollments.filter(e => e.clientId === client.id);
        
        if (statusFilter === 'all') return true; 
        if (statusFilter === 'pending') return clientEnrollments.some(e => e.status === EnrollmentStatus.Pending);
        if (statusFilter === 'active') return clientEnrollments.some(e => e.status === EnrollmentStatus.Active);
        
        return true;
    }).filter(client => {
        // 3. Ensure client has relevant enrollments to display based on filter
        if (statusFilter === 'all') {
            if(searchTerm) return true;
            return true;
        }

        const relevantEnrollments = enrollments.filter(e => 
            e.clientId === client.id && 
            e.status !== EnrollmentStatus.Expired &&
            (statusFilter === 'pending' ? e.status === EnrollmentStatus.Pending : 
             statusFilter === 'active' ? e.status === EnrollmentStatus.Active : true)
        );
        return relevantEnrollments.length > 0;
    });

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Gestione Iscrizioni</h1>
                <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                    Monitora le iscrizioni, i pagamenti in sospeso e l'occupazione delle aule.
                </p>
            </div>

            <div className="md-card p-4 md:p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                        <input 
                            type="text" 
                            placeholder="Cerca cliente o figlio..." 
                            className="block w-full bg-gray-50 border rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1" 
                            style={{borderColor: 'var(--md-divider)'}}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setStatusFilter('all')} 
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            style={statusFilter === 'all' ? { backgroundColor: 'var(--md-primary)' } : {}}
                        >
                            Tutti
                        </button>
                        <button 
                            onClick={() => setStatusFilter('pending')} 
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Da Pagare
                        </button>
                        <button 
                            onClick={() => setStatusFilter('active')} 
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Attivi
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">{error}</div>}

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : 
             <div className="grid grid-cols-1 gap-4">
                {filteredClients.map(client => {
                    const clientEnrollments = enrollments.filter(e => {
                        if (e.clientId !== client.id) return false;
                        if (e.status === EnrollmentStatus.Expired) return false;
                        if (statusFilter === 'pending') return e.status === EnrollmentStatus.Pending;
                        if (statusFilter === 'active') return e.status === EnrollmentStatus.Active;
                        return true;
                    });

                    if (clientEnrollments.length === 0 && statusFilter !== 'all') return null;

                    return (
                        <div 
                            key={client.id} 
                            className="md-card p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-l-4 animate-fade-in"
                            style={{ borderLeftColor: 'var(--md-primary)' }}
                        >
                            <div className="md:w-1/4 min-w-[200px]">
                                <h3 className="font-bold text-lg" style={{ color: 'var(--md-primary)' }}>{client.firstName} {client.lastName}</h3>
                                <p className="text-sm text-gray-500">{client.phone}</p>
                                <div className="mt-3">
                                    <button onClick={(e) => handleEnrollClick(e, client)} className="md-btn md-btn-flat md-btn-primary text-sm px-0">
                                        <PlusIcon /> <span className="ml-1">Nuova Iscrizione</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 w-full">
                                {clientEnrollments.length === 0 ? (
                                    <div className="text-sm text-gray-400 italic p-2 bg-gray-50 rounded">Nessuna iscrizione.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {clientEnrollments.map(enr => {
                                            // Calcolo ultima data effettiva (potrebbe essere oltre la scadenza contratto)
                                            const sortedApps = [...(enr.appointments || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                            const lastApp = sortedApps.length > 0 ? sortedApps[sortedApps.length - 1] : null;
                                            const lastLessonDate = lastApp ? new Date(lastApp.date) : new Date(enr.endDate);
                                            const contractEndDate = new Date(enr.endDate);
                                            
                                            // Controlla se c'è uno slittamento (confrontando solo le date)
                                            const isExtended = lastLessonDate.setHours(0,0,0,0) > contractEndDate.setHours(0,0,0,0);
                                            const lastLessonDateObj = lastApp ? new Date(lastApp.date) : null;

                                            return (
                                                <div key={enr.id} className="bg-white border rounded-md p-4 shadow-sm flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden" style={{ borderLeft: `6px solid ${enr.locationColor || '#e5e7eb'}` }}>
                                                    
                                                    {/* Left Side: Info */}
                                                    <div className="flex-1">
                                                        {/* Name + Badge */}
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <span className="font-bold text-lg text-gray-800">{enr.childName}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                                                                enr.status === EnrollmentStatus.Active ? 'bg-green-50 text-green-700 border-green-200' : 
                                                                enr.status === EnrollmentStatus.Pending ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                                'bg-gray-100 text-gray-500 border-gray-200'
                                                            }`}>
                                                                {enr.status === EnrollmentStatus.Pending ? 'In Attesa' : enr.status === EnrollmentStatus.Active ? 'Attiva' : 'Terminata'}
                                                            </span>
                                                        </div>

                                                        {/* Details Grid */}
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                                                            <div>
                                                                <span className="text-gray-400 text-xs uppercase block">Inizio</span>
                                                                <span className="font-medium text-gray-900">{new Date(enr.startDate).toLocaleDateString('it-IT')}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400 text-xs uppercase block">Scadenza</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-gray-900">{new Date(enr.endDate).toLocaleDateString('it-IT')}</span>
                                                                    {isExtended && lastLessonDateObj && (
                                                                        <span 
                                                                            className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded font-bold cursor-help" 
                                                                            title={`Ultima lezione slittata al: ${lastLessonDateObj.toLocaleDateString('it-IT')}`}
                                                                        >
                                                                            RECUPERO
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400 text-xs uppercase block">Pacchetto</span>
                                                                <span className="font-medium">{enr.subscriptionName}</span>
                                                                <span className="ml-2 font-bold px-1 rounded text-xs" style={{ color: 'var(--md-primary)', backgroundColor: 'var(--md-bg-light)' }}>
                                                                    {enr.price !== undefined ? `€${enr.price}` : '€ -'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400 text-xs uppercase block">Sede</span>
                                                                <strong style={{ color: enr.locationColor || 'inherit' }}>{enr.locationName}</strong>
                                                            </div>
                                                            <div className="col-span-2 md:col-span-2">
                                                                <span className="text-gray-400 text-xs uppercase block">Orario</span>
                                                                <span>{getScheduleString(enr)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        {enr.status === EnrollmentStatus.Active && (
                                                            <div className="mt-2 max-w-md">
                                                                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                                    <span>Svolte: {enr.lessonsTotal - enr.lessonsRemaining}</span>
                                                                    <span>Rimanenti: {enr.lessonsRemaining}</span>
                                                                </div>
                                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                                    <div 
                                                                        className="h-2 rounded-full transition-all duration-500" 
                                                                        style={{ width: `${Math.max(0, Math.min(100, ((enr.lessonsTotal - enr.lessonsRemaining) / enr.lessonsTotal) * 100))}%`, backgroundColor: enr.locationColor || '#6366f1' }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Side: Actions */}
                                                    <div className="flex flex-col gap-2 justify-center min-w-[120px] border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4">
                                                        {enr.status === EnrollmentStatus.Pending && (
                                                            <button onClick={(e) => handlePaymentRequest(e, enr)} className="md-btn md-btn-raised md-btn-green w-full text-xs">
                                                                PAGATO
                                                            </button>
                                                        )}
                                                        
                                                        {(enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) && (
                                                            <>
                                                                <button onClick={(e) => handleEditClick(e, client, enr)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded transition-colors flex items-center justify-center w-full border border-gray-200">
                                                                    <PencilIcon /> <span className="ml-1">Modifica</span>
                                                                </button>
                                                            </>
                                                        )}

                                                         {enr.status === EnrollmentStatus.Active && (
                                                            <button onClick={(e) => handleRevokeRequest(e, enr)} className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-2 rounded transition-colors font-medium w-full text-center">
                                                                Revoca Pagamento
                                                            </button>
                                                        )}
                                                        
                                                        {(enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) && (
                                                             <button onClick={(e) => handleAbandonRequest(e, enr)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded transition-colors w-full text-center">
                                                                Abbandona
                                                            </button>
                                                        )}

                                                        {/* Delete Button (New) */}
                                                        <button 
                                                            onClick={(e) => handleDeleteRequest(e, enr)} 
                                                            className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-2 rounded transition-colors w-full text-center mt-1"
                                                        >
                                                            <div className="flex items-center justify-center">
                                                                 <TrashIcon /> <span className="ml-1">Elimina</span>
                                                            </div>
                                                        </button>

                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {filteredClients.length === 0 && <p className="text-center text-gray-500 py-8">Nessun cliente trovato.</p>}
             </div>
            }

            {/* Main Enrollment Form Modal */}
            {isModalOpen && selectedClient && (
                <Modal onClose={() => setIsModalOpen(false)}>
                    <EnrollmentForm 
                        parent={selectedClient} 
                        existingEnrollment={editingEnrollment}
                        onSave={handleSaveEnrollment} 
                        onCancel={() => setIsModalOpen(false)} 
                    />
                </Modal>
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
