
import React, { useState, useEffect, useCallback } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';

// --- Icons ---
const MailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

// --- Types & Interfaces ---

interface ExpiringEnrollment {
    enrollment: Enrollment;
    client: Client | undefined;
    daysRemaining: number;
    reason: 'expiry' | 'lessons';
}

interface PendingRent {
    transaction: Transaction;
    supplier: Supplier | undefined;
}

interface CommunicationPayload {
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    subject: string;
    message: string;
    channel: 'email' | 'whatsapp';
}

// --- Communication Modal ---

const CommunicationModal: React.FC<{
    data: ExpiringEnrollment | PendingRent;
    type: 'client' | 'supplier';
    onClose: () => void;
}> = ({ data, type, onClose }) => {
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [templateKey, setTemplateKey] = useState('custom');

    // Extract Contact Info
    let recipientName = '';
    let recipientEmail = '';
    let recipientPhone = '';

    if (type === 'client') {
        const item = data as ExpiringEnrollment;
        const client = item.client;
        if (client) {
            recipientName = client.clientType === ClientType.Parent 
                ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}`
                : (client as InstitutionalClient).companyName;
            recipientEmail = client.email;
            recipientPhone = client.phone;
        }
    } else {
        const item = data as PendingRent;
        const supplier = item.supplier;
        if (supplier) {
            recipientName = supplier.companyName;
            recipientEmail = supplier.email;
            recipientPhone = supplier.phone;
        } else {
             // Fallback parsing description if supplier logic fails
             recipientName = "Fornitore";
        }
    }

    // Apply Templates logic
    const applyTemplate = (key: string) => {
        if (type === 'client') {
             const item = data as ExpiringEnrollment;
             const childName = item.enrollment.childName;
             const endDate = new Date(item.enrollment.endDate).toLocaleDateString('it-IT');
             
             if (key === 'lessons') {
                setSubject(`Avviso esaurimento lezioni - ${childName}`);
                setMessage(`Gentile ${recipientName},\n\nLe lezioni del pacchetto di ${childName} stanno per terminare (ne rimangono ${item.enrollment.lessonsRemaining}).\nTi invitiamo a rinnovare l'iscrizione per non perdere la continuità didattica.\n\nA presto,\nEasy Peasy`);
             } else if (key === 'expiry') {
                setSubject(`Rinnovo Iscrizione in scadenza - ${childName}`);
                setMessage(`Gentile ${recipientName},\n\nTi ricordiamo che l'iscrizione di ${childName} scadrà il ${endDate}.\nPer confermare il posto per il prossimo periodo, ti preghiamo di effettuare il rinnovo.\n\nCordiali saluti,\nEasy Peasy`);
             } else {
                setSubject(''); setMessage('');
             }
        } else {
            // Supplier Template (Only one default really)
            const item = data as PendingRent;
            const desc = item.transaction.description;
            if (key === 'payment') {
                setSubject(`Avviso Pagamento Nolo - ${desc}`);
                setMessage(`Spett.le ${recipientName},\n\nVi informiamo che abbiamo preso in carico il pagamento per: ${desc}.\nIl bonifico verrà effettuato nei prossimi giorni.\n\nCordiali saluti,\nAmministrazione Easy Peasy`);
            }
        }
    };

    // Initial Load
    useEffect(() => {
        let defaultKey = 'custom';
        if (type === 'client') {
            const item = data as ExpiringEnrollment;
            defaultKey = item.reason === 'lessons' ? 'lessons' : 'expiry';
        } else {
            defaultKey = 'payment';
        }
        setTemplateKey(defaultKey);
        applyTemplate(defaultKey);
    }, [data, type, recipientName]);

    const handleTemplateChange = (key: string) => {
        setTemplateKey(key);
        applyTemplate(key);
    };

    const handleSend = () => {
        if (channel === 'email') {
            const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.open(mailtoLink, '_blank');
        } else {
            // Clean phone number
            const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
            // For WhatsApp, we combine Subject (Bold) and Message
            const fullMessage = `*${subject}*\n\n${message}`;
            const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMessage)}`;
            window.open(waLink, '_blank');
        }
        onClose();
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold">Nuova Comunicazione</h2>
                <p className="text-sm text-gray-500">A: {recipientName} ({channel === 'email' ? recipientEmail : recipientPhone})</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                {/* Channel Selector */}
                <div className="flex space-x-4 mb-4">
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'email' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="channel" value="email" checked={channel === 'email'} onChange={() => setChannel('email')} className="sr-only" />
                        <MailIcon />
                        <span className="ml-2 font-medium">Email</span>
                    </label>
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'whatsapp' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="channel" value="whatsapp" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} className="sr-only" />
                        <ChatIcon />
                        <span className="ml-2 font-medium">WhatsApp</span>
                    </label>
                </div>

                {type === 'client' && (
                    <div className="md-input-group">
                        <select value={templateKey} onChange={(e) => handleTemplateChange(e.target.value)} className="md-input">
                            <option value="expiry">Scadenza Iscrizione</option>
                            <option value="lessons">Esaurimento Lezioni</option>
                            <option value="custom">Messaggio Personalizzato</option>
                        </select>
                        <label className="md-input-label !top-0 !text-xs !text-gray-500">Template</label>
                    </div>
                )}

                {/* Subject Field - Always Visible */}
                <div className="md-input-group">
                    <input 
                        type="text" 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)} 
                        className="md-input" 
                        placeholder=" " 
                    />
                    <label className="md-input-label">
                        {channel === 'email' ? 'Oggetto Email' : 'Titolo Messaggio (in grassetto)'}
                    </label>
                </div>

                <div className="md-input-group mt-4">
                    <textarea 
                        rows={8} 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                        className="w-full p-3 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                        placeholder="Scrivi il tuo messaggio..."
                        style={{borderColor: 'var(--md-divider)'}}
                    ></textarea>
                </div>

                {channel === 'whatsapp' && (
                    <p className="text-xs text-gray-500 italic">
                        Nota: Su WhatsApp, il "Titolo" verrà inviato in grassetto prima del messaggio.
                    </p>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                    <span className="mr-2"><SendIcon /></span>
                    Invia {channel === 'email' ? 'Email' : 'WhatsApp'}
                </button>
            </div>
        </div>
    );
};


const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [expiringEnrollments, setExpiringEnrollments] = useState<ExpiringEnrollment[]>([]);
    const [pendingRents, setPendingRents] = useState<PendingRent[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<ExpiringEnrollment | PendingRent | null>(null);
    const [modalType, setModalType] = useState<'client' | 'supplier'>('client');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clients, suppliers] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers()
            ]);

            // 1. Process Expiring Enrollments
            const today = new Date();
            const next30Days = new Date();
            next30Days.setDate(today.getDate() + 30);

            const expiring: ExpiringEnrollment[] = [];
            enrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active) {
                    const endDate = new Date(enr.endDate);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let reason: 'expiry' | 'lessons' | null = null;

                    if (diffDays >= 0 && diffDays <= 30) {
                        reason = 'expiry';
                    } else if (enr.lessonsRemaining <= 2) {
                        reason = 'lessons';
                    }

                    if (reason) {
                        expiring.push({
                            enrollment: enr,
                            client: clients.find(c => c.id === enr.clientId),
                            daysRemaining: diffDays,
                            reason
                        });
                    }
                }
            });
            setExpiringEnrollments(expiring);

            // 2. Process Pending Rents
            const rents: PendingRent[] = [];
            transactions.forEach(t => {
                if (t.status === TransactionStatus.Pending && t.category === TransactionCategory.Rent) {
                    // Try to match supplier from description or external metadata if available
                    // Usually rent description is "Nolo Sede: LocationName - Month/Year"
                    const supplier = suppliers.find(s => t.description.toLowerCase().includes(s.companyName.toLowerCase())) 
                                     || suppliers.find(s => s.locations.some(l => t.description.includes(l.name)));
                    
                    rents.push({
                        transaction: t,
                        supplier: supplier
                    });
                }
            });
            setPendingRents(rents);

        } catch (err) {
            console.error("Error fetching CRM data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModal = (data: ExpiringEnrollment | PendingRent, type: 'client' | 'supplier') => {
        setModalData(data);
        setModalType(type);
        setIsModalOpen(true);
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">CRM</h1>
                <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                    Gestione relazioni clienti, rinnovi e comunicazioni fornitori.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* COLUMN 1: Client Renewals */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold" style={{ color: 'var(--md-primary)' }}>Rinnovi Iscrizioni ({expiringEnrollments.length})</h2>
                        </div>
                        
                        {expiringEnrollments.length === 0 ? (
                            <div className="md-card p-8 text-center text-gray-400 italic">
                                Nessuna iscrizione in scadenza nei prossimi 30 giorni.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {expiringEnrollments.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 border-l-4 flex flex-col sm:flex-row justify-between items-start gap-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: 'var(--md-primary)' }}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-gray-800">{item.enrollment.childName}</h3>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.reason === 'lessons' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {item.reason === 'lessons' ? 'Lezioni Finite' : 'In Scadenza'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Cliente: {item.client 
                                                    ? (item.client.clientType === ClientType.Parent ? `${(item.client as ParentClient).firstName} ${(item.client as ParentClient).lastName}` : (item.client as InstitutionalClient).companyName)
                                                    : 'N/D'}
                                            </p>
                                            <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-2">
                                                <span>Scadenza: <strong>{new Date(item.enrollment.endDate).toLocaleDateString()}</strong></span>
                                                <span>Residuo: <strong>{item.enrollment.lessonsRemaining} lez.</strong></span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleOpenModal(item, 'client')}
                                            className="md-btn md-btn-flat text-sm whitespace-nowrap self-center"
                                            style={{ color: 'var(--md-primary)' }}
                                        >
                                            <span className="mr-1"><ChatIcon /></span> Contatta
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* COLUMN 2: Supplier Payments */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-amber-900">Pagamenti Noli ({pendingRents.length})</h2>
                        </div>

                        {pendingRents.length === 0 ? (
                            <div className="md-card p-8 text-center text-gray-400 italic">
                                Nessun nolo in attesa di pagamento.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendingRents.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 border-l-4 border-amber-500 flex flex-col sm:flex-row justify-between items-start gap-4 hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800 mb-1">{item.transaction.description}</h3>
                                            <p className="text-sm text-gray-600">
                                                Fornitore: {item.supplier ? item.supplier.companyName : 'Sconosciuto'}
                                            </p>
                                            <div className="mt-2 flex items-center gap-3">
                                                <span className="text-lg font-bold text-red-600">€ {item.transaction.amount.toFixed(2)}</span>
                                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">Da Saldare</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">Rif: {new Date(item.transaction.date).toLocaleDateString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleOpenModal(item, 'supplier')}
                                            className="md-btn md-btn-flat text-amber-600 text-sm whitespace-nowrap self-center"
                                        >
                                            <span className="mr-1"><ChatIcon /></span> Contatta
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            )}

            {isModalOpen && modalData && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <CommunicationModal 
                        data={modalData} 
                        type={modalType} 
                        onClose={() => setIsModalOpen(false)} 
                    />
                </Modal>
            )}
        </div>
    );
};

export default CRM;
