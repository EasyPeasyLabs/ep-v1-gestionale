
import React, { useState, useEffect, useCallback } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCommunicationLogs, logCommunication, deleteCommunicationLog, getCampaigns, addCampaign, updateCampaign, deleteCampaign } from '../services/crmService';
import { getCommunicationTemplates } from '../services/settingsService';
import { uploadCampaignFile } from '../services/storageService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient, CommunicationLog, Campaign, CampaignInput, CampaignRecipient, CommunicationTemplate } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import PlusIcon from '../components/icons/PlusIcon';
import RestoreIcon from '../components/icons/RestoreIcon';
import TrashIcon from '../components/icons/TrashIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import UploadIcon from '../components/icons/UploadIcon';

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

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

// --- Helper per invio reale messaggi ---
const sendToExternalApp = (channel: 'email' | 'whatsapp' | 'sms', recipient: {contact: string, name: string}, subject: string, message: string, mediaLinks?: string) => {
    const fullMessage = mediaLinks ? `${message}\n\nMedia: ${mediaLinks}` : message;
    
    if (channel === 'email') {
        // Per email, apriamo mailto. Nota: oggetto e body devono essere encodati
        const mailtoLink = `mailto:${recipient.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
        window.open(mailtoLink, '_blank');
    } else if (channel === 'whatsapp') {
        const cleanPhone = recipient.contact.replace(/[^0-9]/g, '');
        const waMessage = `*${subject}*\n\n${fullMessage}`;
        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
        window.open(waLink, '_blank');
    } else if (channel === 'sms') {
        const cleanPhone = recipient.contact.replace(/[^0-9]/g, '');
        const smsBody = `${subject}\n\n${fullMessage}`;
        const smsLink = `sms:${cleanPhone}?body=${encodeURIComponent(smsBody)}`;
        window.open(smsLink, '_blank');
    }
};

// --- Campaign Runner Modal ---
const CampaignRunnerModal: React.FC<{
    campaign: Campaign;
    onClose: () => void;
    onComplete: () => void;
}> = ({ campaign, onClose, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const recipients = campaign.recipients || [];
    const total = recipients.length;
    const currentRecipient = recipients[currentIndex];

    const handleSendNext = () => {
        if (!currentRecipient) return;
        
        sendToExternalApp(
            campaign.channel,
            currentRecipient,
            campaign.subject,
            campaign.message,
            campaign.mediaLinks
        );

        if (currentIndex < total - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Finito
            handleFinish();
        }
    };

    const handleFinish = async () => {
        setIsProcessing(true);
        try {
            // Aggiorna stato campagna
            const nextRun = new Date(campaign.nextRun);
            let newStatus = campaign.status;
            let newNextRun = campaign.nextRun;

            // Calcola prossima esecuzione
            if (campaign.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
            if (campaign.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
            
            if (campaign.frequency === 'once' || (campaign.sentCount + 1 >= campaign.repeatCount)) {
                newStatus = 'completed';
                newNextRun = ''; // No next run
            } else {
                newNextRun = nextRun.toISOString();
            }

            await updateCampaign(campaign.id, {
                status: newStatus as any,
                sentCount: campaign.sentCount + 1,
                lastRun: new Date().toISOString(),
                nextRun: newNextRun
            });

            // Logga anche nel CRM generale
            await logCommunication({
                date: new Date().toISOString(),
                channel: campaign.channel,
                subject: `CAMPAGNA: ${campaign.subject}`,
                message: campaign.message,
                recipients: [`${total} Destinatari (Campagna)`],
                recipientCount: total,
                type: 'other'
            });

            onComplete();
        } catch (e) {
            console.error("Errore completamento campagna", e);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!currentRecipient) {
        return (
            <div className="p-6 text-center">
                <h3 className="text-xl font-bold text-green-600 mb-4">Campagna Completata!</h3>
                <p className="mb-4">Tutti i messaggi sono stati processati.</p>
                <button onClick={onClose} className="md-btn md-btn-raised md-btn-primary">Chiudi</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">Esecuzione Campagna: {campaign.name}</h3>
                <p className="text-sm text-gray-600">
                    Invio {currentIndex + 1} di {total}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${((currentIndex) / total) * 100}%` }}></div>
                </div>
            </div>
            
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold">{currentRecipient.name.charAt(0)}</span>
                </div>
                <h2 className="text-2xl font-bold mb-1">{currentRecipient.name}</h2>
                <p className="text-gray-500 mb-6">{currentRecipient.contact}</p>
                
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-sm text-yellow-800 mb-6 max-w-md">
                    Clicca "Invia" per aprire {campaign.channel === 'email' ? 'il client di posta' : 'WhatsApp'}. 
                    Dopo aver inviato, torna qui per procedere col prossimo.
                </div>

                <button 
                    onClick={handleSendNext} 
                    className="md-btn md-btn-raised md-btn-green w-64 h-12 text-lg"
                >
                    <span className="mr-2"><SendIcon/></span>
                    Invia a {currentRecipient.name.split(' ')[0]}
                </button>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-between">
                <button onClick={onClose} className="text-gray-500 text-sm hover:underline">Interrompi</button>
                <span className="text-xs text-gray-400">L'automazione completa richiede API a pagamento. Modalità assistita attiva.</span>
            </div>
        </div>
    );
};

// --- Campaign Wizard Modal ---
const CampaignWizard: React.FC<{
    clients: Client[];
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (campaign: CampaignInput) => void;
}> = ({ clients, suppliers, onClose, onSave }) => {
    const [step, setStep] = useState(1);
    
    // Data
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [mediaLinks, setMediaLinks] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [recipientType, setRecipientType] = useState<'clients' | 'suppliers'>('clients');
    const [searchTerm, setSearchTerm] = useState('');

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('09:00');
    const [frequency, setFrequency] = useState<'once' | 'weekly' | 'monthly'>('once');
    const [repeatCount, setRepeatCount] = useState(1);

    // Helpers
    const getList = () => {
        const list = recipientType === 'clients' ? clients : suppliers;
        return list.filter((item: any) => {
            const n = recipientType === 'clients' 
                ? (item.clientType === ClientType.Parent ? `${item.firstName} ${item.lastName}` : item.companyName)
                : item.companyName;
            return n.toLowerCase().includes(searchTerm.toLowerCase());
        }).map((item: any) => ({
            id: item.id,
            name: recipientType === 'clients' 
                ? (item.clientType === ClientType.Parent ? `${item.firstName} ${item.lastName}` : item.companyName)
                : item.companyName,
            contact: channel === 'email' ? item.email : item.phone
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await uploadCampaignFile(file);
            // Aggiungi l'URL al campo esistente, separato da a capo se c'è già testo
            setMediaLinks(prev => prev ? `${prev}\n${url}` : url);
        } catch (error) {
            console.error("Errore caricamento file:", error);
            alert("Errore durante il caricamento del file.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFinish = () => {
        if (!name || !subject || !message || selectedIds.length === 0) {
            alert("Compila tutti i campi obbligatori"); return;
        }

        const finalRecipients: CampaignRecipient[] = [];
        const sourceList = recipientType === 'clients' ? clients : suppliers;
        
        selectedIds.forEach(id => {
            const item: any = sourceList.find((x: any) => x.id === id);
            if (item) {
                const rName = recipientType === 'clients' 
                    ? (item.clientType === ClientType.Parent ? `${item.firstName} ${item.lastName}` : item.companyName)
                    : item.companyName;
                const rContact = channel === 'email' ? item.email : item.phone;
                if (rContact) {
                    finalRecipients.push({ id: item.id, name: rName, contact: rContact, type: recipientType === 'clients' ? 'client' : 'supplier' });
                }
            }
        });

        const campaignData: CampaignInput = {
            name,
            channel,
            subject,
            message,
            mediaLinks,
            recipients: finalRecipients,
            startDate: new Date(startDate).toISOString(),
            time,
            frequency,
            repeatCount: Number(repeatCount),
            status: 'active',
            sentCount: 0,
            nextRun: new Date(`${startDate}T${time}:00`).toISOString()
        };

        onSave(campaignData);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b bg-gray-50">
                <h2 className="text-xl font-bold">Nuova Campagna Newsletter</h2>
                <div className="flex space-x-2 mt-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg mb-4">1. Dettagli e Contenuto</h3>
                        <div className="md-input-group">
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="md-input" placeholder=" " />
                            <label className="md-input-label">Nome Campagna (interno)</label>
                        </div>
                        <div className="flex space-x-4 my-4">
                            <label className={`flex-1 p-3 border rounded cursor-pointer ${channel === 'email' ? 'bg-indigo-50 border-indigo-500' : ''}`}>
                                <input type="radio" name="c_channel" value="email" checked={channel === 'email'} onChange={() => setChannel('email')} className="hidden"/>
                                <div className="text-center font-bold text-sm"><MailIcon/> Email</div>
                            </label>
                            <label className={`flex-1 p-3 border rounded cursor-pointer ${channel === 'whatsapp' ? 'bg-green-50 border-green-500' : ''}`}>
                                <input type="radio" name="c_channel" value="whatsapp" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} className="hidden"/>
                                <div className="text-center font-bold text-sm"><ChatIcon/> WhatsApp</div>
                            </label>
                        </div>
                        <div className="md-input-group">
                            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " />
                            <label className="md-input-label">{channel === 'email' ? 'Oggetto' : 'Titolo (Grassetto)'}</label>
                        </div>
                        <div className="md-input-group">
                            <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="Testo del messaggio..."></textarea>
                        </div>
                        
                        {/* Media Links with Upload Button */}
                        <div className="md-input-group">
                            <label className="block text-xs text-gray-500 mb-1">Allegati Multimediali (Immagini, Audio, Video)</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="text" 
                                    value={mediaLinks} 
                                    onChange={e => setMediaLinks(e.target.value)} 
                                    className="md-input flex-1" 
                                    placeholder="Incolla link o carica file..." 
                                />
                                <label className={`cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded border border-gray-300 flex items-center ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isUploading ? <Spinner /> : <UploadIcon />}
                                    <span className="ml-2 text-xs hidden sm:inline">{isUploading ? 'Caricamento...' : 'Carica File'}</span>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*,video/*,audio/*"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                    />
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Supporta: JPG, PNG, MP3, MP4. Il file verrà caricato e trasformato in un link pubblico.</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 h-full flex flex-col">
                        <h3 className="font-bold text-lg mb-2">2. Destinatari</h3>
                        <div className="flex space-x-2 mb-2">
                            <button onClick={() => setRecipientType('clients')} className={`px-3 py-1 rounded ${recipientType === 'clients' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Clienti</button>
                            <button onClick={() => setRecipientType('suppliers')} className={`px-3 py-1 rounded ${recipientType === 'suppliers' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Fornitori</button>
                        </div>
                        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border rounded mb-2" />
                        
                        <div className="flex-1 overflow-y-auto border rounded p-2 bg-gray-50">
                            {getList().map((item: any) => (
                                <label key={item.id} className="flex items-center p-2 hover:bg-white cursor-pointer border-b last:border-0">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(item.id)} 
                                        onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                                        className="mr-2"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{item.name}</div>
                                        <div className="text-xs text-gray-500">{item.contact}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="text-right text-sm text-gray-600">{selectedIds.length} selezionati</div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg mb-4">3. Pianificazione</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="md-input-group">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="md-input" />
                                <label className="md-input-label !top-0">Data Inizio</label>
                            </div>
                            <div className="md-input-group">
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="md-input" />
                                <label className="md-input-label !top-0">Orario</label>
                            </div>
                        </div>
                        <div className="md-input-group">
                            <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="md-input">
                                <option value="once">Una volta sola</option>
                                <option value="weekly">Settimanale</option>
                                <option value="monthly">Mensile</option>
                            </select>
                            <label className="md-input-label !top-0">Frequenza</label>
                        </div>
                        {frequency !== 'once' && (
                            <div className="md-input-group">
                                <input type="number" min="1" value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))} className="md-input" />
                                <label className="md-input-label">Ripeti per (volte)</label>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between">
                <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <div className="flex space-x-2">
                    {step > 1 && <button onClick={() => setStep(s => s - 1)} className="md-btn md-btn-flat md-btn-sm">Indietro</button>}
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)} className="md-btn md-btn-raised md-btn-primary md-btn-sm">Avanti</button>
                    ) : (
                        <button onClick={handleFinish} className="md-btn md-btn-raised md-btn-green md-btn-sm">Crea Campagna</button>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Communication Modal (Updated with Template Logic) ---

const CommunicationModal: React.FC<{
    data: ExpiringEnrollment | PendingRent;
    type: 'client' | 'supplier';
    templates: CommunicationTemplate[];
    onClose: () => void;
    onSuccess: () => void;
}> = ({ data, type, templates, onClose, onSuccess }) => {
    const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    // Invece di 'custom', usiamo l'ID del template o 'custom'
    const [templateId, setTemplateId] = useState('');

    // Extract Info
    let recipientName = '';
    let recipientEmail = '';
    let recipientPhone = '';
    let placeholders: any = {};

    if (type === 'client') {
        const item = data as ExpiringEnrollment;
        const client = item.client;
        if (client) {
            recipientName = client.clientType === ClientType.Parent 
                ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}`
                : (client as InstitutionalClient).companyName;
            recipientEmail = client.email;
            recipientPhone = client.phone;
            placeholders = {
                '{{cliente}}': recipientName,
                '{{bambino}}': item.enrollment.childName,
                '{{data}}': new Date(item.enrollment.endDate).toLocaleDateString('it-IT')
            };
        }
    } else {
        const item = data as PendingRent;
        const supplier = item.supplier;
        if (supplier) {
            recipientName = supplier.companyName;
            recipientEmail = supplier.email;
            recipientPhone = supplier.phone;
            placeholders = {
                '{{fornitore}}': recipientName,
                '{{descrizione}}': item.transaction.description
            };
        }
    }

    // Funzione per applicare il template e sostituire le variabili
    const applyTemplate = (tId: string) => {
        if (tId === 'custom') {
            setSubject('');
            setMessage('');
            return;
        }
        const tmpl = templates.find(t => t.id === tId);
        if (tmpl) {
            let subj = tmpl.subject;
            let body = tmpl.body + '\n\n' + tmpl.signature;

            // Sostituzione placeholders
            Object.keys(placeholders).forEach(key => {
                subj = subj.replace(new RegExp(key, 'g'), placeholders[key]);
                body = body.replace(new RegExp(key, 'g'), placeholders[key]);
            });

            setSubject(subj);
            setMessage(body);
        }
    };

    // Seleziona template default in base al contesto
    useEffect(() => {
        let defId = 'custom';
        if (type === 'client') {
            const item = data as ExpiringEnrollment;
            defId = item.reason === 'lessons' ? 'lessons' : 'expiry';
        } else {
            defId = 'payment';
        }
        
        // Verifica se il template esiste nella lista caricata
        if (templates.some(t => t.id === defId)) {
            setTemplateId(defId);
            applyTemplate(defId);
        } else {
            setTemplateId('custom');
        }
    }, [data, type, templates]);

    const handleTemplateChange = (newId: string) => {
        setTemplateId(newId);
        applyTemplate(newId);
    };

    const handleSend = async () => {
        sendToExternalApp(channel, { contact: channel === 'email' ? recipientEmail : recipientPhone, name: recipientName }, subject, message);

        try {
            await logCommunication({
                date: new Date().toISOString(),
                channel,
                subject,
                message,
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
                <p className="text-sm text-gray-500">A: {recipientName}</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div className="flex space-x-4 mb-4">
                    {['email', 'whatsapp', 'sms'].map(c => (
                        <label key={c} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${channel === c ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'hover:bg-gray-50'}`}>
                            <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c as any)} className="sr-only" />
                            <span className="capitalize font-medium ml-2">{c}</span>
                        </label>
                    ))}
                </div>

                <div className="md-input-group">
                    <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="md-input">
                        <option value="custom">Messaggio Personalizzato</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                    </select>
                    <label className="md-input-label !top-0 !text-xs !text-gray-500">Template</label>
                </div>

                <div className="md-input-group">
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="md-input" placeholder=" " />
                    <label className="md-input-label">{channel === 'email' ? 'Oggetto' : 'Titolo'}</label>
                </div>

                <div className="md-input-group mt-4">
                    <textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full p-3 border rounded-md bg-white text-sm" placeholder="Scrivi il tuo messaggio..."></textarea>
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                <button onClick={onClose} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-primary md-btn-sm">Invia</button>
            </div>
        </div>
    );
};


const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'archive'>('overview');
    
    const [expiringEnrollments, setExpiringEnrollments] = useState<ExpiringEnrollment[]>([]);
    const [pendingRents, setPendingRents] = useState<PendingRent[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<ExpiringEnrollment | PendingRent | null>(null);
    const [modalType, setModalType] = useState<'client' | 'supplier'>('client');
    
    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
    const [isCampaignRunnerOpen, setIsCampaignRunnerOpen] = useState(false);
    const [runningCampaign, setRunningCampaign] = useState<Campaign | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clients, suppliers, logs, camps, tmpls] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
                getCommunicationLogs(),
                getCampaigns(),
                getCommunicationTemplates()
            ]);

            setAllClients(clients);
            setAllSuppliers(suppliers);
            setCommunicationLogs(logs);
            setCampaigns(camps);
            setTemplates(tmpls);

            // 1. Renewals Logic
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
                    if (reason) expiring.push({ enrollment: enr, client: clients.find(c => c.id === enr.clientId), daysRemaining: diffDays, reason });
                }
            });
            setExpiringEnrollments(expiring);

            // 2. Pending Rents
            const rents: PendingRent[] = [];
            transactions.forEach(t => {
                if (t.status === TransactionStatus.Pending && t.category === TransactionCategory.Rent) {
                    const supplier = suppliers.find(s => t.description.toLowerCase().includes(s.companyName.toLowerCase()));
                    rents.push({ transaction: t, supplier });
                }
            });
            setPendingRents(rents);

        } catch (err) {
            console.error("Error fetching CRM data", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenModal = (data: ExpiringEnrollment | PendingRent, type: 'client' | 'supplier') => {
        setModalData(data);
        setModalType(type);
        setIsModalOpen(true);
    };

    const handleCreateCampaign = async (campInput: CampaignInput) => {
        await addCampaign(campInput);
        setIsCampaignWizardOpen(false);
        fetchData();
    };

    const handleDeleteCampaign = async (id: string) => {
        if(confirm("Eliminare questa campagna?")) {
            await deleteCampaign(id);
            fetchData();
        }
    };

    const handleRunCampaign = (c: Campaign) => {
        setRunningCampaign(c);
        setIsCampaignRunnerOpen(true);
    };

    const isCampaignDue = (c: Campaign) => {
        if (c.status === 'completed') return false;
        return new Date(c.nextRun) <= new Date();
    };

    return (
        <div>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">CRM</h1>
                    <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestione relazioni, scadenze e newsletter.</p>
                </div>
                <button onClick={() => setIsCampaignWizardOpen(true)} className="md-btn md-btn-raised md-btn-green">
                    <PlusIcon />
                    <span className="ml-2">Nuova Campagna</span>
                </button>
            </div>

            <div className="mt-6 border-b mb-6" style={{borderColor: 'var(--md-divider)'}}>
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('campaigns')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'campaigns' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Campagne & Newsletter</button>
                    <button onClick={() => setActiveTab('archive')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'archive' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Archivio</button>
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-indigo-800">Rinnovi Iscrizioni ({expiringEnrollments.length})</h2>
                            {expiringEnrollments.length === 0 ? <p className="text-gray-400 italic">Nessuna scadenza imminente.</p> : 
                                expiringEnrollments.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 border-l-4 border-indigo-500 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold">{item.enrollment.childName}</div>
                                            <div className="text-xs text-gray-500">{item.reason === 'expiry' ? `Scade il ${new Date(item.enrollment.endDate).toLocaleDateString()}` : `${item.enrollment.lessonsRemaining} lezioni rimaste`}</div>
                                        </div>
                                        <button onClick={() => handleOpenModal(item, 'client')} className="md-btn md-btn-flat text-indigo-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-amber-800">Pagamenti Noli ({pendingRents.length})</h2>
                            {pendingRents.length === 0 ? <p className="text-gray-400 italic">Nessun pagamento in sospeso.</p> : 
                                pendingRents.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 border-l-4 border-amber-500 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold">{item.transaction.description}</div>
                                            <div className="text-xs text-red-600 font-bold">{item.transaction.amount}€ da saldare</div>
                                        </div>
                                        <button onClick={() => handleOpenModal(item, 'supplier')} className="md-btn md-btn-flat text-amber-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {activeTab === 'campaigns' && (
                    <div className="space-y-6 animate-fade-in">
                        {campaigns.length === 0 ? <p className="text-center text-gray-400 py-8">Nessuna campagna creata.</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {campaigns.map(c => {
                                    const due = isCampaignDue(c);
                                    return (
                                        <div key={c.id} className={`md-card p-5 border-t-4 ${c.status === 'completed' ? 'border-gray-300 opacity-75' : due ? 'border-green-500 shadow-md' : 'border-blue-400'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-lg">{c.name}</h3>
                                                    <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${c.channel === 'whatsapp' ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>{c.channel}</span>
                                                </div>
                                                {due && <button onClick={() => handleRunCampaign(c)} className="md-btn md-btn-raised md-btn-green text-xs animate-pulse"><PlayIcon/> Esegui Ora</button>}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2"><strong>Oggetto:</strong> {c.subject}</p>
                                            <div className="text-xs text-gray-500 grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded">
                                                <div>Recipients: <strong>{c.recipients.length}</strong></div>
                                                <div>Inviata: <strong>{c.sentCount}</strong> volte</div>
                                                <div>Next Run: <strong>{c.nextRun ? new Date(c.nextRun).toLocaleString() : '-'}</strong></div>
                                                <div>Status: <strong>{c.status}</strong></div>
                                            </div>
                                            <div className="mt-3 flex justify-end">
                                                <button onClick={() => handleDeleteCampaign(c.id)} className="text-red-400 hover:text-red-600"><TrashIcon/></button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'archive' && (
                    <>
                        {/* Mobile View: Cards Layout */}
                        <div className="md:hidden space-y-4">
                            {communicationLogs.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">Nessuna comunicazione in archivio.</p>
                            ) : (
                                communicationLogs.map(log => (
                                    <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                                                    {new Date(log.date).toLocaleDateString()}
                                                </p>
                                                <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{log.subject}</h4>
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ml-2 shrink-0 ${
                                                log.channel === 'whatsapp' ? 'bg-green-100 text-green-800' : 
                                                log.channel === 'email' ? 'bg-indigo-100 text-indigo-800' : 
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {log.channel}
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-gray-600 mb-3 line-clamp-3 bg-gray-50 p-2 rounded border border-gray-100">
                                            {log.message}
                                        </p>

                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                            <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                {log.recipientCount}
                                            </span>
                                            <button 
                                                onClick={() => deleteCommunicationLog(log.id).then(fetchData)} 
                                                className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                                                title="Elimina"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Desktop View: Table Layout */}
                        <div className="hidden md:block md-card p-0 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Canale</th>
                                        <th className="p-3">Oggetto</th>
                                        <th className="p-3">Destinatari</th>
                                        <th className="p-3 text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {communicationLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="p-3 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                                            <td className="p-3 capitalize">{log.channel}</td>
                                            <td className="p-3 max-w-xs truncate font-medium">{log.subject}</td>
                                            <td className="p-3 text-gray-500">{log.recipientCount} destinatari</td>
                                            <td className="p-3 text-right"><button onClick={() => deleteCommunicationLog(log.id).then(fetchData)} className="text-gray-400 hover:text-red-600"><TrashIcon/></button></td>
                                        </tr>
                                    ))}
                                    {communicationLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-400">Nessuna comunicazione in archivio.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                </>
            )}

            {/* Modals */}
            {isModalOpen && modalData && (
                <Modal onClose={() => setIsModalOpen(false)} size="lg">
                    <CommunicationModal data={modalData} type={modalType} templates={templates} onClose={() => setIsModalOpen(false)} onSuccess={fetchData} />
                </Modal>
            )}

            {isCampaignWizardOpen && (
                <Modal onClose={() => setIsCampaignWizardOpen(false)} size="lg">
                    <CampaignWizard clients={allClients} suppliers={allSuppliers} onClose={() => setIsCampaignWizardOpen(false)} onSave={handleCreateCampaign} />
                </Modal>
            )}

            {isCampaignRunnerOpen && runningCampaign && (
                <Modal onClose={() => setIsCampaignRunnerOpen(false)} size="lg">
                    <CampaignRunnerModal campaign={runningCampaign} onClose={() => setIsCampaignRunnerOpen(false)} onComplete={() => { setIsCampaignRunnerOpen(false); fetchData(); }} />
                </Modal>
            )}
        </div>
    );
};

export default CRM;
