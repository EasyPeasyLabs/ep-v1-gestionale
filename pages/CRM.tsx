
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCommunicationLogs, logCommunication, deleteCommunicationLog, getCampaigns, addCampaign, updateCampaign, deleteCampaign, updateCommunicationLog } from '../services/crmService';
import { getCommunicationTemplates } from '../services/settingsService';
import { uploadCampaignFile } from '../services/storageService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient, CommunicationLog, Campaign, CampaignInput, CampaignRecipient, CommunicationTemplate } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import PencilIcon from '../components/icons/PencilIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import UploadIcon from '../components/icons/UploadIcon';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

// --- Icons ---
const ChatIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> </svg> );

// --- Helpers ---
const getClientName = (c: Client) => c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName || ''} ${(c as ParentClient).lastName || ''}` : ((c as InstitutionalClient).companyName || '');

// --- Interface Context Data ---
interface CommunicationContext {
    clientName?: string;
    childName?: string;
    supplierName?: string;
    description?: string;
    amount?: string;
    date?: string;
}

// --- Communication Modal (Invio Diretto) ---
const CommunicationModal: React.FC<{ 
    onClose: () => void; 
    onSent: () => void;
    clients: Client[];
    suppliers: Supplier[];
    initialData?: {
        recipientId: string;
        recipientType: 'clients' | 'suppliers';
        subject: string;
        message: string;
    } | null;
    contextData?: CommunicationContext | null; // NEW: Dati per ricalcolo template
}> = ({ onClose, onSent, clients, suppliers, initialData, contextData }) => {
    const [recipientsType, setRecipientsType] = useState<'clients' | 'suppliers' | 'custom'>(initialData?.recipientType || 'clients');
    const [selectedIds, setSelectedIds] = useState<string[]>(initialData?.recipientId ? [initialData.recipientId] : []);
    const [customRecipient, setCustomRecipient] = useState('');
    const [subject, setSubject] = useState(initialData?.subject || '');
    const [message, setMessage] = useState(initialData?.message || '');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Templates State
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    useEffect(() => {
        getCommunicationTemplates().then(setTemplates);
    }, []);

    // Update state if initialData changes (e.g. modal re-opened with diff props)
    useEffect(() => {
        if (initialData) {
            setRecipientsType(initialData.recipientType);
            setSelectedIds([initialData.recipientId]);
            setSubject(initialData.subject);
            setMessage(initialData.message);
        }
    }, [initialData]);

    const replacePlaceholders = (text: string) => {
        if (!contextData) return text;
        let res = text;
        
        // Sostituzioni standard
        if (contextData.clientName) res = res.replace(/{{cliente}}/g, contextData.clientName);
        if (contextData.childName) res = res.replace(/{{bambino}}/g, contextData.childName);
        if (contextData.supplierName) {
            res = res.replace(/{{fornitore}}/g, contextData.supplierName);
            // Fallback: se il template fornitore usa {{cliente}}, lo sostituiamo col nome fornitore
            res = res.replace(/{{cliente}}/g, contextData.supplierName); 
        }
        if (contextData.description) res = res.replace(/{{descrizione}}/g, contextData.description);
        if (contextData.amount) res = res.replace(/{{importo}}/g, contextData.amount);
        
        // Data corrente se non specificata nel context
        const dateStr = contextData.date || new Date().toLocaleDateString('it-IT');
        res = res.replace(/{{data}}/g, dateStr);

        return res;
    };

    const handleTemplateChange = (tmplId: string) => {
        setSelectedTemplateId(tmplId);
        const tmpl = templates.find(t => t.id === tmplId);
        if (tmpl) {
            // Applica replacePlaceholders al soggetto e al corpo
            setSubject(replacePlaceholders(tmpl.subject));
            
            let combined = tmpl.body;
            if (tmpl.signature) combined += `\n\n${tmpl.signature}`;
            
            setMessage(replacePlaceholders(combined));
        }
    };

    const filteredList = recipientsType === 'clients' 
        ? clients.filter(c => getClientName(c).toLowerCase().includes(searchTerm.toLowerCase()))
        : suppliers.filter(s => (s.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const toggleId = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSend = async () => {
        const recipientsList: string[] = [];
        const targetPhones: string[] = []; // Accumula i numeri di telefono

        if (recipientsType === 'custom') {
            recipientsList.push(customRecipient);
            // Se il canale è WhatsApp, assumiamo che l'input manuale sia un numero
            if (channel === 'whatsapp') {
                targetPhones.push(customRecipient);
            }
        } else {
            selectedIds.forEach(id => {
                let name = '';
                let phone = '';

                if (recipientsType === 'clients') {
                    const c = clients.find(x => x.id === id);
                    if (c) {
                        name = getClientName(c);
                        phone = c.phone;
                    }
                } else {
                    const s = suppliers.find(x => x.id === id);
                    if (s) {
                        name = s.companyName;
                        phone = s.phone;
                    }
                }

                if (name) recipientsList.push(name);
                if (phone) targetPhones.push(phone);
            });
        }

        if (recipientsList.length === 0) return alert("Seleziona almeno un destinatario.");

        // Logica Invio
        if (channel === 'whatsapp') {
            if (targetPhones.length === 0) {
                return alert("Nessun numero di telefono trovato per i destinatari selezionati.");
            }

            const encodedMsg = encodeURIComponent(`*${subject}*\n\n${message}`);
            
            // Apri le chat. Attenzione: i browser bloccano popup multipli.
            targetPhones.forEach(rawPhone => {
                // 1. Pulisce il numero: rimuove tutto tranne le cifre
                let cleanPhone = rawPhone.replace(/[^0-9]/g, '');

                // 2. Rimuove '00' iniziale se presente (standard internazionale)
                if (cleanPhone.startsWith('00')) {
                    cleanPhone = cleanPhone.substring(2);
                }

                // 3. Logica Prefisso Italia (Smart Fix)
                // Se il numero ha 10 cifre (es. 3331234567), assumiamo sia un mobile italiano senza prefisso.
                // Aggiungiamo '39' automaticamente. Se ne ha 12 ed inizia con 39, è già corretto.
                if (cleanPhone.length === 10) {
                    cleanPhone = '39' + cleanPhone;
                }

                if (cleanPhone) {
                    window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                }
            });

        } else {
            const bcc = recipientsType === 'custom' ? customRecipient : ''; 
            // Nota: mailto con troppi destinatari potrebbe troncarsi o non aprirsi.
            const mailto = `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.location.href = mailto;
        }

        // Logga l'azione
        await logCommunication({
            date: new Date().toISOString(),
            channel,
            subject,
            message,
            recipients: recipientsList,
            recipientCount: recipientsList.length,
            type: 'manual'
        });

        onSent();
    };

    return (
        <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">Nuova Comunicazione</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Recipients Selection */}
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Destinatari</label>
                    <div className="flex gap-2 mb-2">
                        <button onClick={() => { setRecipientsType('clients'); setSelectedIds([]); }} className={`px-3 py-1 rounded text-xs ${recipientsType === 'clients' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Clienti</button>
                        <button onClick={() => { setRecipientsType('suppliers'); setSelectedIds([]); }} className={`px-3 py-1 rounded text-xs ${recipientsType === 'suppliers' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Fornitori</button>
                        <button onClick={() => { setRecipientsType('custom'); setSelectedIds([]); }} className={`px-3 py-1 rounded text-xs ${recipientsType === 'custom' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Manuale</button>
                    </div>

                    {recipientsType === 'custom' ? (
                        <input type="text" value={customRecipient} onChange={e => setCustomRecipient(e.target.value)} className="md-input" placeholder={channel === 'whatsapp' ? "Numero di telefono (es. 3331234567)" : "Email o Telefono..."} />
                    ) : (
                        <div className="border rounded-md h-40 overflow-hidden flex flex-col">
                            <div className="p-2 border-b bg-gray-50">
                                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full text-xs p-1 border rounded" placeholder="Cerca..." />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {filteredList.map(item => (
                                    <label key={item.id} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleId(item.id)} />
                                        <span>{recipientsType === 'clients' ? getClientName(item as Client) : (item as Supplier).companyName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Channel & Template */}
                <div className="flex justify-between items-center">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Canale</label>
                        <div className="flex gap-4">
                            <label className="flex items-center"><input type="radio" checked={channel === 'email'} onChange={() => setChannel('email')} className="mr-1" /> Email</label>
                            <label className="flex items-center"><input type="radio" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} className="mr-1" /> WhatsApp</label>
                        </div>
                    </div>
                    <div>
                        <select value={selectedTemplateId} onChange={(e) => handleTemplateChange(e.target.value)} className="text-sm border border-gray-300 rounded p-1 bg-white focus:border-indigo-500">
                            <option value="">Carica da Template...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="md-input-group">
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " />
                    <label className="md-input-label">Oggetto / Titolo</label>
                </div>
                <div className="md-input-group">
                    <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} className="md-input" placeholder="Scrivi il messaggio..." />
                </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-primary">Invia Messaggio</button>
            </div>
        </div>
    );
};

// --- Log Editor (Edit History) ---
const LogEditor: React.FC<{
    log: CommunicationLog;
    onSave: () => void;
    onCancel: () => void;
}> = ({ log, onSave, onCancel }) => {
    const [subject, setSubject] = useState(log.subject);
    const [message, setMessage] = useState(log.message);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateCommunicationLog(log.id, { subject, message });
            onSave();
        } catch (e) {
            alert("Errore durante l'aggiornamento.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[80vh]">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">Modifica Log Archivio</h3>
            </div>
            <div className="flex-1 p-6 space-y-4">
                <div className="md-input-group">
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " />
                    <label className="md-input-label">Oggetto / Titolo</label>
                </div>
                <div className="md-input-group">
                    <textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} className="md-input" placeholder="Messaggio..." />
                </div>
                <p className="text-xs text-gray-500 italic">Nota: La modifica aggiorna solo il record nel database, non invia nuovi messaggi.</p>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button onClick={handleSave} disabled={saving} className="md-btn md-btn-raised md-btn-primary">
                    {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
            </div>
        </div>
    );
};

// --- Campaign Wizard ---
const CampaignWizard: React.FC<{ 
    onClose: () => void; 
    onSave: () => void;
    clients: Client[];
    campaign?: Campaign; // Optional for edit mode
}> = ({ onClose, onSave, clients, campaign }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState(campaign?.name || '');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>(campaign?.channel || 'email');
    const [subject, setSubject] = useState(campaign?.subject || '');
    const [content, setContent] = useState(campaign?.message || '');
    const [mediaUrl, setMediaUrl] = useState(campaign?.mediaLinks || '');
    const [targetType, setTargetType] = useState('all'); // Logic to be refined if editing
    
    // Date formatting for input type=date
    const initialDate = campaign?.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : '';
    const [scheduleDate, setScheduleDate] = useState(initialDate);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files?.[0]) {
            try {
                const url = await uploadCampaignFile(e.target.files[0]);
                setMediaUrl(url);
            } catch(err) { alert("Errore upload"); }
        }
    };

    const handleSaveCampaign = async () => {
        // Build recipients based on logic (simplified)
        const recipients: CampaignRecipient[] = clients.map(c => ({
            id: c.id,
            name: getClientName(c),
            contact: c.email,
            type: 'client'
        }));

        const campaignData: CampaignInput = {
            name, channel, subject, message: content, mediaLinks: mediaUrl,
            recipients: recipients.slice(0, 5), // Demo limit
            startDate: scheduleDate || new Date().toISOString(),
            time: '09:00',
            frequency: 'once', repeatCount: 1,
            status: 'active', sentCount: 0, nextRun: scheduleDate || new Date().toISOString()
        };

        if (campaign) {
            await updateCampaign(campaign.id, campaignData);
        } else {
            await addCampaign(campaignData);
        }
        onSave();
    };

    return (
        <div className="flex flex-col h-full max-h-[90vh]">
            <div className="p-6 border-b bg-indigo-600 text-white flex-shrink-0">
                <h3 className="text-xl font-bold">{campaign ? 'Modifica Campagna' : 'Creazione Campagna'}</h3>
                <p className="text-xs opacity-80">Step {step} di 3</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {step === 1 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} className="md-input" placeholder=" " /><label className="md-input-label">Nome Campagna</label></div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Canale</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setChannel('email')} className={`p-4 border rounded-xl ${channel === 'email' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : ''}`}>📧 Email</button>
                                <button onClick={() => setChannel('whatsapp')} className={`p-4 border rounded-xl ${channel === 'whatsapp' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : ''}`}>📱 WhatsApp</button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="md-input-group"><input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " /><label className="md-input-label">Oggetto / Titolo</label></div>
                        <div className="md-input-group"><textarea rows={6} value={content} onChange={e => setContent(e.target.value)} className="md-input" placeholder="Scrivi il contenuto..." /></div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Media (Opzionale)</label>
                            <div className="flex gap-2 items-center">
                                <input type="file" onChange={handleFileUpload} className="text-xs" />
                                {mediaUrl && <span className="text-green-600 text-xs">Caricato!</span>}
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Target</label>
                            <select value={targetType} onChange={e => setTargetType(e.target.value)} className="md-input">
                                <option value="all">Tutti i Clienti Attivi</option>
                                <option value="expired">Clienti Scaduti (Win-back)</option>
                            </select>
                        </div>
                        <div className="md-input-group"><input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Data Invio</label></div>
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800">
                            La campagna verrà messa in coda e inviata automaticamente alla data stabilita.
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t flex justify-between bg-gray-50 flex-shrink-0">
                {step > 1 ? <button onClick={() => setStep(s => s-1)} className="md-btn md-btn-flat">Indietro</button> : <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>}
                {step < 3 ? <button onClick={() => setStep(s => s+1)} className="md-btn md-btn-raised md-btn-primary">Avanti</button> : <button onClick={handleSaveCampaign} className="md-btn md-btn-raised md-btn-green">Pianifica</button>}
            </div>
        </div>
    );
};


// --- CRM MAIN PAGE ---
interface ExpiringEnrollment { enrollment: Enrollment; client: Client | undefined; daysRemaining: number; reason: 'expiry' | 'lessons'; }
interface PendingRent { transaction: Transaction; supplier: Supplier | undefined; locationColor?: string; }

const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'archive'>('overview');
    
    const [expiringEnrollments, setExpiringEnrollments] = useState<ExpiringEnrollment[]>([]);
    const [pendingRents, setPendingRents] = useState<PendingRent[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [logs, setLogs] = useState<CommunicationLog[]>([]);
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    
    // Data References
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // UI State for Modals
    const [isFreeCommOpen, setIsFreeCommOpen] = useState(false);
    
    // State per context data
    const [communicationContext, setCommunicationContext] = useState<CommunicationContext | null>(null);

    const [prefilledCommData, setPrefilledCommData] = useState<{
        recipientId: string;
        recipientType: 'clients' | 'suppliers';
        subject: string;
        message: string;
    } | null>(null);

    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    
    // CRUD States
    const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
    const [editingLog, setEditingLog] = useState<CommunicationLog | undefined>(undefined);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; type: 'campaign' | 'log' } | null>(null);

    // Pagination
    const [archivePage, setArchivePage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clientsData, suppliersData, logsData, campaignsData, templatesData] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
                getCommunicationLogs(),
                getCampaigns(),
                getCommunicationTemplates()
            ]);
            
            setClients(clientsData);
            setSuppliers(suppliersData);
            setLogs(logsData);
            setCampaigns(campaignsData);
            setTemplates(templatesData);

            // 1. Renewals logic
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
                    if (reason) expiring.push({ enrollment: enr, client: clientsData.find(c => c.id === enr.clientId), daysRemaining: diffDays, reason });
                }
            });
            setExpiringEnrollments(expiring);

            // 2. Pending Rents logic
            const rents: PendingRent[] = [];
            transactions.forEach(t => {
                if (t.status === TransactionStatus.Pending && t.category === TransactionCategory.Rent) {
                    let supplier: Supplier | undefined = undefined;

                    // 1. Try match by Location ID (allocationId)
                    if (t.allocationId) {
                        supplier = suppliersData.find(s => s.locations.some(l => l.id === t.allocationId));
                    }

                    // 2. Fallback: Match by Name in Description
                    if (!supplier) {
                        supplier = suppliersData.find(s => t.description.toLowerCase().includes((s.companyName || '').toLowerCase()));
                    }

                    rents.push({ transaction: t, supplier, locationColor: '#ccc' });
                }
            });
            setPendingRents(rents);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCommunicationSent = () => {
        setIsFreeCommOpen(false);
        setPrefilledCommData(null);
        setCommunicationContext(null); // Reset context
        fetchData();
        alert("Messaggio inviato e archiviato!");
    };

    const handleCampaignSaved = () => {
        setIsCampaignWizardOpen(false);
        setEditingCampaign(undefined);
        fetchData();
        alert("Campagna salvata!");
    };

    const handleLogSaved = () => {
        setEditingLog(undefined);
        fetchData();
    };

    // --- Action Handlers ---
    const handleContactClient = (item: ExpiringEnrollment) => {
        const client = item.client;
        if (!client) return;

        // Prepara il context per il ricalcolo in caso di cambio template
        const context: CommunicationContext = {
            clientName: getClientName(client),
            childName: item.enrollment.childName,
            date: new Date().toLocaleDateString('it-IT')
        };
        setCommunicationContext(context);

        // Trova il template "Info" o usa default
        const tmpl = templates.find(t => t.id === 'info') || { subject: "Rinnovo Iscrizione", body: "Gentile {{cliente}}, l'iscrizione di {{bambino}} è in scadenza. La invitiamo a rinnovare.", signature: "La Direzione" };
        
        // Sostituzione variabili iniziale
        let body = tmpl.body;
        body = body.replace(/{{cliente}}/g, context.clientName || '');
        body = body.replace(/{{bambino}}/g, context.childName || '');
        body = body.replace(/{{data}}/g, context.date || '');
        
        if (tmpl.signature) body += `\n\n${tmpl.signature}`;

        setPrefilledCommData({
            recipientId: client.id,
            recipientType: 'clients',
            subject: tmpl.subject,
            message: body
        });
        setIsFreeCommOpen(true);
    };

    const handleContactSupplier = (item: PendingRent) => {
        const supplier = item.supplier;
        // Se il fornitore non è linkato direttamente (es. cancellato), usiamo comunque il dato parziale se possibile o alert
        if (!supplier) {
            alert("Fornitore non trovato in anagrafica per questa transazione. Assicurati che la sede sia correttamente allocata nella transazione o che il nome del fornitore sia nella descrizione.");
            return;
        }

        // Prepara il context
        const context: CommunicationContext = {
            supplierName: supplier.companyName,
            clientName: supplier.companyName, // Fallback
            description: item.transaction.description,
            amount: item.transaction.amount.toFixed(2),
            date: new Date().toLocaleDateString('it-IT')
        };
        setCommunicationContext(context);

        // Trova template "Payment" o default
        const tmpl = templates.find(t => t.id === 'payment') || { subject: "Sollecito Pagamento", body: "Gentile {{fornitore}}, in allegato il dettaglio per il pagamento di {{descrizione}}.", signature: "Amministrazione" };

        let body = tmpl.body;
        // Placeholder adattati al contesto fornitore (alcuni template usano {{cliente}}, qui mappiamo mentalmente)
        body = body.replace(/{{cliente}}/g, supplier.companyName); 
        body = body.replace(/{{fornitore}}/g, supplier.companyName);
        body = body.replace(/{{descrizione}}/g, item.transaction.description);
        body = body.replace(/{{importo}}/g, item.transaction.amount.toFixed(2));

        if (tmpl.signature) body += `\n\n${tmpl.signature}`;

        setPrefilledCommData({
            recipientId: supplier.id,
            recipientType: 'suppliers',
            subject: tmpl.subject,
            message: body
        });
        setIsFreeCommOpen(true);
    };

    // --- CRUD Handlers ---
    const handleEditCampaign = (c: Campaign) => {
        setEditingCampaign(c);
        setIsCampaignWizardOpen(true);
    };

    const handleEditLog = (l: CommunicationLog) => {
        setEditingLog(l);
    };

    const handleDeleteRequest = (id: string, type: 'campaign' | 'log') => {
        setDeleteConfirm({ isOpen: true, id, type });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setLoading(true);
        try {
            if (deleteConfirm.type === 'campaign') {
                await deleteCampaign(deleteConfirm.id);
            } else {
                await deleteCommunicationLog(deleteConfirm.id);
            }
            await fetchData();
        } catch (e) {
            alert("Errore durante l'eliminazione.");
        } finally {
            setLoading(false);
            setDeleteConfirm(null);
        }
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeleteAllModalOpen(false);
        setLoading(true);
        try {
            if (activeTab === 'campaigns') {
                const all = await getCampaigns();
                for (const c of all) await deleteCampaign(c.id);
            } else if (activeTab === 'archive') {
                const all = await getCommunicationLogs();
                for (const l of all) await deleteCommunicationLog(l.id);
            }
            await fetchData();
            alert("Eliminazione completata.");
        } catch (err) {
            alert("Errore durante l'eliminazione.");
        } finally {
            setLoading(false);
        }
    };

    const paginatedLogs = useMemo(() => {
        const start = (archivePage - 1) * itemsPerPage;
        return logs.slice(start, start + itemsPerPage);
    }, [logs, archivePage]);

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div><h1 className="text-3xl font-bold">CRM</h1><p className="mt-1 text-gray-500">Gestione relazioni e comunicazioni.</p></div>
                <div className="flex gap-2">
                    {activeTab !== 'overview' && (
                        <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>
                    )}
                    <button onClick={() => { setPrefilledCommData(null); setCommunicationContext(null); setIsFreeCommOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /><span className="ml-2">Nuova</span></button>
                    <button onClick={() => { setEditingCampaign(undefined); setIsCampaignWizardOpen(true); }} className="md-btn md-btn-flat border border-gray-300 bg-white flex items-center"><CalendarIcon /><span className="ml-2">Campagna</span></button>
                </div>
            </div>
            
            <div className="mt-6 border-b mb-6 border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button onClick={() => setActiveTab('overview')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('campaigns')} className={`shrink-0 py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'campaigns' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Campagne</button>
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
                                    <div key={idx} className="md-card p-4 flex justify-between items-center border-l-4 border-l-indigo-500">
                                        <div>
                                            <div className="font-bold">{item.enrollment.childName}</div>
                                            <div className="text-xs text-gray-500">{item.reason === 'expiry' ? `Scade il ${new Date(item.enrollment.endDate).toLocaleDateString()}` : `${item.enrollment.lessonsRemaining} lezioni rimaste`}</div>
                                        </div>
                                        <button onClick={() => handleContactClient(item)} className="md-btn md-btn-flat text-indigo-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-amber-800">Pagamenti Noli ({pendingRents.length})</h2>
                            {pendingRents.length === 0 ? <p className="text-gray-400 italic">Nessun pagamento in sospeso.</p> : 
                                pendingRents.map((item, idx) => (
                                    <div key={idx} className="md-card p-4 flex justify-between items-center border-l-4 border-l-amber-500">
                                        <div>
                                            <div className="font-bold">{item.transaction.description}</div>
                                            <div className="text-xs text-red-600 font-bold">{item.transaction.amount}€ da saldare</div>
                                        </div>
                                        <button onClick={() => handleContactSupplier(item)} className="md-btn md-btn-flat text-amber-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
                
                {activeTab === 'campaigns' && (
                    <div className="animate-slide-up space-y-4">
                        {campaigns.map(c => (
                            <div key={c.id} className="md-card p-4 flex justify-between items-center group">
                                <div>
                                    <h4 className="font-bold text-gray-800">{c.name}</h4>
                                    <p className="text-xs text-gray-500">{c.status} • Next: {new Date(c.nextRun).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${c.channel === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{c.channel.toUpperCase()}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditCampaign(c)} className="md-icon-btn edit"><PencilIcon /></button>
                                        <button onClick={() => handleDeleteRequest(c.id, 'campaign')} className="md-icon-btn delete"><TrashIcon /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {campaigns.length === 0 && <p className="text-center text-gray-500 py-10">Nessuna campagna attiva.</p>}
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="animate-slide-up">
                        <div className="space-y-3">
                            {paginatedLogs.map(log => (
                                <div key={log.id} className="bg-white border rounded p-4 shadow-sm group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{log.channel}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditLog(log)} className="md-icon-btn edit p-1"><PencilIcon /></button>
                                            <button onClick={() => handleDeleteRequest(log.id, 'log')} className="md-icon-btn delete p-1"><TrashIcon /></button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-sm text-gray-800">{log.subject}</h4>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{log.message}</p>
                                    <div className="mt-2 text-xs text-indigo-600 font-medium">Inviato a: {log.recipients.length > 3 ? `${log.recipients.length} destinatari` : log.recipients.join(', ')}</div>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-center text-gray-500 py-10">Nessuna comunicazione in archivio.</p>}
                        </div>
                        <Pagination 
                            currentPage={archivePage} 
                            totalItems={logs.length} 
                            itemsPerPage={itemsPerPage} 
                            onPageChange={setArchivePage} 
                        />
                    </div>
                )}
                </>
            )}

            {/* Modals */}
            {isFreeCommOpen && (
                <Modal onClose={() => setIsFreeCommOpen(false)} size="lg">
                    <CommunicationModal 
                        onClose={() => setIsFreeCommOpen(false)} 
                        onSent={handleCommunicationSent}
                        clients={clients}
                        suppliers={suppliers}
                        initialData={prefilledCommData}
                        contextData={communicationContext} // PASSAGGI DATI
                    />
                </Modal>
            )}
            
            {isCampaignWizardOpen && (
                <Modal onClose={() => setIsCampaignWizardOpen(false)} size="lg">
                    <CampaignWizard 
                        campaign={editingCampaign}
                        onClose={() => setIsCampaignWizardOpen(false)}
                        onSave={handleCampaignSaved}
                        clients={clients}
                    />
                </Modal>
            )}

            {editingLog && (
                <Modal onClose={() => setEditingLog(undefined)} size="lg">
                    <LogEditor 
                        log={editingLog} 
                        onSave={handleLogSaved} 
                        onCancel={() => setEditingLog(undefined)} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={confirmDelete}
                title={deleteConfirm?.type === 'campaign' ? "Elimina Campagna" : "Elimina Log"}
                message="Sei sicuro di voler eliminare questo elemento? L'operazione è irreversibile."
                isDangerous={true}
            />

            <ConfirmModal 
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleConfirmDeleteAll}
                title={`ELIMINA TUTTO (${activeTab.toUpperCase()})`}
                message="⚠️ ATTENZIONE: Stai per eliminare TUTTI i record di questa sezione. Questa operazione è irreversibile. Confermi?"
                isDangerous={true}
                confirmText="Sì, Elimina TUTTO"
            />
        </div>
    );
};

export default CRM;
