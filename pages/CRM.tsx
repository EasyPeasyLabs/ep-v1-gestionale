
import React, { useState, useEffect, useCallback } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCommunicationLogs, logCommunication, deleteCommunicationLog } from '../services/crmService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient, CommunicationLog } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import PlusIcon from '../components/icons/PlusIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import TrashIcon from '../components/icons/TrashIcon';

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

const SmsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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

// --- Modale Comunicazione Libera (Nuova) ---

const FreeCommunicationModal: React.FC<{
    clients: Client[];
    suppliers: Supplier[];
    onClose: () => void;
    onSuccess: () => void; // Callback to refresh logs
    initialData?: {
        subject: string;
        message: string;
        channel: 'email' | 'whatsapp' | 'sms';
    } | null;
}> = ({ clients, suppliers, onClose, onSuccess, initialData }) => {
    const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>(initialData?.channel || 'email');
    const [recipientType, setRecipientType] = useState<'clients' | 'suppliers' | 'manual'>('clients');
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Manual Input State
    const [manualName, setManualName] = useState('');
    const [manualContact, setManualContact] = useState('');

    // Content State
    const [subject, setSubject] = useState(initialData?.subject || '');
    const [message, setMessage] = useState(initialData?.message || '');
    const [signature, setSignature] = useState('Lo Staff di Easy Peasy');

    // Reset selection on type change
    useEffect(() => {
        setSelectedIds([]);
        setSearchTerm('');
        setManualName('');
        setManualContact('');
    }, [recipientType]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSend = async () => {
        const recipients: { name: string; contact: string }[] = [];

        // 1. Gather Recipients
        if (recipientType === 'manual') {
            if (!manualContact) { alert("Inserisci il recapito del destinatario."); return; }
            recipients.push({ name: manualName || 'Destinatario', contact: manualContact });
        } else if (recipientType === 'clients') {
            selectedIds.forEach(id => {
                const c = clients.find(x => x.id === id);
                if (c) {
                    const name = c.clientType === ClientType.Parent 
                        ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                        : (c as InstitutionalClient).companyName;
                    const contact = channel === 'email' ? c.email : c.phone;
                    if (contact) recipients.push({ name, contact });
                }
            });
        } else if (recipientType === 'suppliers') {
            selectedIds.forEach(id => {
                const s = suppliers.find(x => x.id === id);
                if (s) {
                    const contact = channel === 'email' ? s.email : s.phone;
                    if (contact) recipients.push({ name: s.companyName, contact });
                }
            });
        }

        if (recipients.length === 0) {
            alert("Seleziona almeno un destinatario.");
            return;
        }

        const fullMessage = `${message}\n\n${signature}`;

        // 2. Execute Opening Links
        if (channel === 'email') {
            const bccList = recipients.map(r => r.contact).join(',');
            const mailtoLink = `mailto:?bcc=${bccList}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
            window.open(mailtoLink, '_blank');
        } else if (channel === 'whatsapp') {
            if (recipients.length > 1) {
                const confirm = window.confirm(`Stai per inviare messaggi a ${recipients.length} destinatari su WhatsApp. Potrebbero aprirsi più finestre. Continuare?`);
                if (!confirm) return;
            }
            recipients.forEach((r) => {
                const cleanPhone = r.contact.replace(/[^0-9]/g, '');
                const waMessage = `*${subject}*\n\n${fullMessage}`;
                const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
                window.open(waLink, '_blank');
            });
        } else if (channel === 'sms') {
             if (recipients.length > 1) {
                const confirm = window.confirm(`Stai per inviare SMS a ${recipients.length} destinatari. Dovrai confermare l'invio per ogni singolo messaggio. Continuare?`);
                if (!confirm) return;
            }
            recipients.forEach((r) => {
                const cleanPhone = r.contact.replace(/[^0-9]/g, '');
                const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(fullMessage)}`;
                window.open(smsLink, '_blank');
            });
        }

        // 3. Log to Database
        try {
            await logCommunication({
                date: new Date().toISOString(),
                channel,
                subject,
                message: fullMessage,
                recipients: recipients.map(r => r.name),
                recipientCount: recipients.length,
                type: 'manual'
            });
            onSuccess(); // Refresh archive
        } catch (e) {
            console.error("Failed to log communication:", e);
        }

        onClose();
    };

    const getFilteredList = () => {
        if (recipientType === 'clients') {
            return clients.filter(c => {
                const name = c.clientType === ClientType.Parent 
                    ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                    : (c as InstitutionalClient).companyName;
                return name.toLowerCase().includes(searchTerm.toLowerCase());
            }).map(c => ({
                id: c.id,
                name: c.clientType === ClientType.Parent 
                    ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` 
                    : (c as InstitutionalClient).companyName,
                sub: c.clientType === ClientType.Parent ? 'Genitore' : 'Istituzionale'
            }));
        }
        if (recipientType === 'suppliers') {
            return suppliers.filter(s => s.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(s => ({ id: s.id, name: s.companyName, sub: 'Fornitore' }));
        }
        return [];
    };

    const listItems = getFilteredList();

    return (
        <div className="flex flex-col h-full max-h-[90vh]">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold">Comunicazione Libera</h2>
                <p className="text-sm text-gray-500">Invia messaggi a uno o più destinatari.</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                
                {/* 1. Canale */}
                <div className="flex space-x-4 mb-2">
                    <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'email' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 text-indigo-700' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="free-channel" value="email" checked={channel === 'email'} onChange={() => setChannel('email')} className="sr-only" />
                        <MailIcon />
                        <span className="ml-2 font-medium">Email</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'whatsapp' ? 'bg-green-50 border-green-500 ring-1 ring-green-500 text-green-700' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="free-channel" value="whatsapp" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} className="sr-only" />
                        <ChatIcon />
                        <span className="ml-2 font-medium">WhatsApp</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'sms' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-700' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="free-channel" value="sms" checked={channel === 'sms'} onChange={() => setChannel('sms')} className="sr-only" />
                        <SmsIcon />
                        <span className="ml-2 font-medium">SMS</span>
                    </label>
                </div>

                {/* 2. Tipo Destinatario */}
                <div className="flex border-b border-gray-200 mb-2">
                    <button onClick={() => setRecipientType('clients')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${recipientType === 'clients' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Clienti</button>
                    <button onClick={() => setRecipientType('suppliers')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${recipientType === 'suppliers' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Fornitori</button>
                    <button onClick={() => setRecipientType('manual')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${recipientType === 'manual' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Manuale</button>
                </div>

                {/* 3. Selezione Destinatari */}
                {recipientType === 'manual' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
                        <div className="md-input-group">
                            <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} className="md-input" placeholder=" " />
                            <label className="md-input-label">Nome Destinatario</label>
                        </div>
                        <div className="md-input-group">
                            <input type="text" value={manualContact} onChange={e => setManualContact(e.target.value)} className="md-input" placeholder=" " />
                            <label className="md-input-label">{channel === 'email' ? 'Indirizzo Email' : 'Numero Cellulare'}</label>
                        </div>
                    </div>
                ) : (
                    <div className="border rounded-md overflow-hidden flex flex-col h-48">
                        <div className="p-2 bg-gray-50 border-b">
                             <input 
                                type="text" 
                                placeholder="Cerca..." 
                                className="w-full bg-white border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {listItems.map(item => (
                                <label key={item.id} className="flex items-center p-2 hover:bg-indigo-50 rounded cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(item.id)}
                                        onChange={() => toggleSelection(item.id)}
                                        className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                        <p className="text-xs text-gray-500">{item.sub}</p>
                                    </div>
                                </label>
                            ))}
                            {listItems.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nessun risultato.</p>}
                        </div>
                        <div className="bg-gray-50 px-2 py-1 text-xs text-right text-gray-500 border-t">
                            {selectedIds.length} selezionati
                        </div>
                    </div>
                )}

                {/* 4. Contenuto Messaggio */}
                <div className="space-y-4 pt-2">
                    <div className="md-input-group">
                        <input 
                            type="text" 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)} 
                            className="md-input" 
                            placeholder=" " 
                        />
                        <label className="md-input-label">
                            {channel === 'email' ? 'Oggetto' : 'Titolo (in grassetto)'}
                        </label>
                    </div>
                    <div className="md-input-group">
                         <textarea 
                            rows={5} 
                            value={message} 
                            onChange={(e) => setMessage(e.target.value)} 
                            className="w-full p-3 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                            placeholder="Scrivi qui il tuo messaggio..."
                            style={{borderColor: 'var(--md-divider)'}}
                        ></textarea>
                    </div>
                     <div className="md-input-group">
                        <input 
                            type="text" 
                            value={signature} 
                            onChange={(e) => setSignature(e.target.value)} 
                            className="md-input text-sm text-gray-600 italic" 
                            placeholder=" " 
                        />
                        <label className="md-input-label">Firma</label>
                    </div>
                </div>

            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-green md-btn-sm">
                    <span className="mr-2"><SendIcon /></span>
                    Invia {channel === 'email' ? `Email` : channel === 'whatsapp' ? `WhatsApp` : `SMS`}
                </button>
            </div>
        </div>
    );
};


// --- Communication Modal (Existing - Contextual) ---

const CommunicationModal: React.FC<{
    data: ExpiringEnrollment | PendingRent;
    type: 'client' | 'supplier';
    onClose: () => void;
    onSuccess: () => void;
}> = ({ data, type, onClose, onSuccess }) => {
    const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
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
             recipientName = "Fornitore";
        }
    }

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
            const item = data as PendingRent;
            const desc = item.transaction.description;
            if (key === 'payment') {
                setSubject(`Avviso Pagamento Nolo - ${desc}`);
                setMessage(`Spett.le ${recipientName},\n\nVi informiamo che abbiamo preso in carico il pagamento per: ${desc}.\nIl bonifico verrà effettuato nei prossimi giorni.\n\nCordiali saluti,\nAmministrazione Easy Peasy`);
            }
        }
    };

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

    const handleSend = async () => {
        if (channel === 'email') {
            const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.open(mailtoLink, '_blank');
        } else if (channel === 'whatsapp') {
            const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
            const fullMessage = `*${subject}*\n\n${message}`;
            const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMessage)}`;
            window.open(waLink, '_blank');
        } else if (channel === 'sms') {
            const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
            const fullMessage = `${subject}\n\n${message}`;
            const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(fullMessage)}`;
            window.open(smsLink, '_blank');
        }

        // Log
        try {
            await logCommunication({
                date: new Date().toISOString(),
                channel,
                subject,
                message: message,
                recipients: [recipientName],
                recipientCount: 1,
                type: type === 'client' ? 'renewal' : 'payment'
            });
            onSuccess();
        } catch (e) {
            console.error("Failed to log", e);
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
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${channel === 'sms' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                        <input type="radio" name="channel" value="sms" checked={channel === 'sms'} onChange={() => setChannel('sms')} className="sr-only" />
                        <SmsIcon />
                        <span className="ml-2 font-medium">SMS</span>
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
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
                <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                    <span className="mr-2"><SendIcon /></span>
                    Invia {channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </button>
            </div>
        </div>
    );
};


const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'archive'>('overview');
    
    const [expiringEnrollments, setExpiringEnrollments] = useState<ExpiringEnrollment[]>([]);
    const [pendingRents, setPendingRents] = useState<PendingRent[]>([]);
    
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
    const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);

    // Search & Sort State for Archive
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'subject_asc' | 'subject_desc'>('date_desc');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<ExpiringEnrollment | PendingRent | null>(null);
    const [modalType, setModalType] = useState<'client' | 'supplier'>('client');

    // Free Communication Modal State
    const [isFreeCommModalOpen, setIsFreeCommModalOpen] = useState(false);
    const [reuseData, setReuseData] = useState<{subject: string, message: string, channel: 'email' | 'whatsapp' | 'sms'} | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clients, suppliers, logs] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
                getCommunicationLogs()
            ]);

            setAllClients(clients);
            setAllSuppliers(suppliers);
            setCommunicationLogs(logs);

            // 1. Process Expiring Enrollments
            const today = new Date();
            const expiring: ExpiringEnrollment[] = [];
            enrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active) {
                    const endDate = new Date(enr.endDate);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let reason: 'expiry' | 'lessons' | null = null;
                    if (diffDays >= 0 && diffDays <= 30) reason = 'expiry';
                    else if (enr.lessonsRemaining <= 2) reason = 'lessons';

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
                    const supplier = suppliers.find(s => t.description.toLowerCase().includes(s.companyName.toLowerCase())) 
                                     || suppliers.find(s => s.locations.some(l => t.description.includes(l.name)));
                    rents.push({ transaction: t, supplier: supplier });
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

    const handleReuseCommunication = (log: CommunicationLog) => {
        setReuseData({
            subject: log.subject,
            message: log.message.split('\n\nLo Staff di Easy Peasy')[0], // Rimuovi firma se presente per evitare duplicati
            channel: log.channel
        });
        setIsFreeCommModalOpen(true);
    };

    const handleDeleteLog = async (id: string) => {
        if (confirm("Vuoi eliminare questo log dalla cronologia?")) {
            await deleteCommunicationLog(id);
            fetchData();
        }
    };

    // Filter and Sort Logic for Archive
    const filteredLogs = communicationLogs.filter(log => {
        const term = searchTerm.toLowerCase();
        return (
            (log.subject || '').toLowerCase().includes(term) ||
            (log.message || '').toLowerCase().includes(term) ||
            (log.recipients || []).join(' ').toLowerCase().includes(term)
        );
    });

    filteredLogs.sort((a, b) => {
        switch (sortOrder) {
            case 'date_asc':
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            case 'date_desc':
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            case 'subject_asc':
                return (a.subject || '').localeCompare(b.subject || '');
            case 'subject_desc':
                return (b.subject || '').localeCompare(a.subject || '');
            default:
                return 0;
        }
    });

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">CRM</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>
                        Gestione relazioni clienti, rinnovi e archivio comunicazioni.
                    </p>
                </div>
                <button onClick={() => { setReuseData(null); setIsFreeCommModalOpen(true); }} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon />
                    <span className="ml-2">Nuova Comunicazione</span>
                </button>
            </div>

            <div className="mt-6 border-b mb-6" style={{borderColor: 'var(--md-divider)'}}>
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('archive')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'archive' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Archivio Comunicazioni</button>
                </nav>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
                <>
                {activeTab === 'overview' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
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
                ) : (
                    <div className="md-card p-0 animate-fade-in overflow-hidden">
                        
                        {/* Toolbar di Ricerca e Ordinamento */}
                        <div className="p-4 border-b bg-white flex flex-col md:flex-row gap-4 justify-between items-center">
                             <div className="relative w-full md:w-72">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Cerca per oggetto, messaggio, destinatario..."
                                    className="block w-full bg-gray-50 border rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{borderColor: 'var(--md-divider)'}}
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as any)}
                                    className="block w-full bg-gray-50 border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:border-indigo-500 focus:ring-indigo-500"
                                    style={{borderColor: 'var(--md-divider)'}}
                                >
                                    <option value="date_desc">Data (Recenti)</option>
                                    <option value="date_asc">Data (Meno recenti)</option>
                                    <option value="subject_asc">Oggetto (A-Z)</option>
                                    <option value="subject_desc">Oggetto (Z-A)</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Canale</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Oggetto / Contenuto</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Destinatari</th>
                                        <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="p-4 text-sm whitespace-nowrap">
                                                {new Date(log.date).toLocaleString('it-IT')}
                                            </td>
                                            <td className="p-4">
                                                {log.channel === 'email' && <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs flex items-center w-fit gap-1"><MailIcon/> Email</span>}
                                                {log.channel === 'whatsapp' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs flex items-center w-fit gap-1"><ChatIcon/> WA</span>}
                                                {log.channel === 'sms' && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs flex items-center w-fit gap-1"><SmsIcon/> SMS</span>}
                                            </td>
                                            <td className="p-4 max-w-xs">
                                                <div className="font-bold text-gray-800 truncate">{log.subject || '(Nessun Oggetto)'}</div>
                                                <div className="text-xs text-gray-500 truncate">{log.message}</div>
                                            </td>
                                            <td className="p-4 text-sm">
                                                {log.recipientCount > 1 ? (
                                                    <span className="font-medium">{log.recipientCount} Destinatari</span>
                                                ) : (
                                                    <span className="text-gray-700">{log.recipients[0]}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleReuseCommunication(log)}
                                                    className="md-icon-btn text-green-600 bg-green-50 hover:bg-green-100" 
                                                    title="Riusa Contenuto"
                                                >
                                                    <RestoreIcon />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteLog(log.id)}
                                                    className="md-icon-btn delete" 
                                                    title="Elimina Log"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLogs.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">Nessuna comunicazione trovata.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
            )}

            {/* Event-Driven Modal */}
            {isModalOpen && modalData && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <CommunicationModal 
                        data={modalData} 
                        type={modalType} 
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={fetchData} 
                    />
                </Modal>
            )}

            {/* Free Communication Modal */}
            {isFreeCommModalOpen && (
                <Modal onClose={() => setIsFreeCommModalOpen(false)} size="lg">
                    <FreeCommunicationModal 
                        clients={allClients}
                        suppliers={allSuppliers}
                        initialData={reuseData}
                        onClose={() => setIsFreeCommModalOpen(false)}
                        onSuccess={fetchData}
                    />
                </Modal>
            )}
        </div>
    );
};

export default CRM;
