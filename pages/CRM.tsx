
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import TrashIcon from '../components/icons/TrashIcon';
import CalendarIcon from '../components/icons/CalendarIcon';
import UploadIcon from '../components/icons/UploadIcon';
import Pagination from '../components/Pagination';

// --- Icons ---
const ChatIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> </svg> );

// --- Helpers ---
const getClientName = (c: Client) => c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;

// --- Communication Modal (Invio Diretto) ---
const CommunicationModal: React.FC<{ 
    onClose: () => void; 
    onSent: () => void;
    clients: Client[];
    suppliers: Supplier[];
}> = ({ onClose, onSent, clients, suppliers }) => {
    const [recipientsType, setRecipientsType] = useState<'clients' | 'suppliers' | 'custom'>('clients');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [customRecipient, setCustomRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredList = recipientsType === 'clients' 
        ? clients.filter(c => getClientName(c).toLowerCase().includes(searchTerm.toLowerCase()))
        : suppliers.filter(s => s.companyName.toLowerCase().includes(searchTerm.toLowerCase()));

    const toggleId = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSend = async () => {
        const recipientsList: string[] = [];
        if (recipientsType === 'custom') {
            recipientsList.push(customRecipient);
        } else {
            selectedIds.forEach(id => {
                const name = recipientsType === 'clients' 
                    ? getClientName(clients.find(c => c.id === id)!) 
                    : suppliers.find(s => s.id === id)?.companyName || '';
                recipientsList.push(name);
            });
        }

        if (recipientsList.length === 0) return alert("Seleziona almeno un destinatario.");

        // Simulazione invio (in realtà aprirebbe WA o mailto)
        if (channel === 'whatsapp') {
            const encodedMsg = encodeURIComponent(`*${subject}*\n\n${message}`);
            window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
        } else {
            const bcc = recipientsType === 'custom' ? customRecipient : ''; 
            const mailto = `mailto:?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.location.href = mailto;
        }

        // Logga
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
                        <input type="text" value={customRecipient} onChange={e => setCustomRecipient(e.target.value)} className="md-input" placeholder="Email o Telefono..." />
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

                {/* Channel */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Canale</label>
                    <div className="flex gap-4">
                        <label className="flex items-center"><input type="radio" checked={channel === 'email'} onChange={() => setChannel('email')} className="mr-1" /> Email</label>
                        <label className="flex items-center"><input type="radio" checked={channel === 'whatsapp'} onChange={() => setChannel('whatsapp')} className="mr-1" /> WhatsApp</label>
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

// --- Campaign Wizard ---
const CampaignWizard: React.FC<{ 
    onClose: () => void; 
    onSave: () => void;
    clients: Client[];
}> = ({ onClose, onSave, clients }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [targetType, setTargetType] = useState('all');
    const [scheduleDate, setScheduleDate] = useState('');

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

        await addCampaign({
            name, channel, subject, message: content, mediaLinks: mediaUrl,
            recipients: recipients.slice(0, 5), // Demo limit
            startDate: scheduleDate || new Date().toISOString(),
            time: '09:00',
            frequency: 'once', repeatCount: 1,
            status: 'active', sentCount: 0, nextRun: scheduleDate || new Date().toISOString()
        });
        onSave();
    };

    return (
        <div className="flex flex-col h-full max-h-[90vh]">
            <div className="p-6 border-b bg-indigo-600 text-white flex-shrink-0">
                <h3 className="text-xl font-bold">Creazione Campagna</h3>
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
    
    // Data References
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // UI State for Modals
    const [isFreeCommOpen, setIsFreeCommOpen] = useState(false);
    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);

    // Pagination
    const [archivePage, setArchivePage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clientsData, suppliersData, logsData, campaignsData] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
                getCommunicationLogs(),
                getCampaigns()
            ]);
            
            setClients(clientsData);
            setSuppliers(suppliersData);
            setLogs(logsData);
            setCampaigns(campaignsData);

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
                    const supplier = suppliersData.find(s => t.description.toLowerCase().includes(s.companyName.toLowerCase()));
                    rents.push({ transaction: t, supplier, locationColor: '#ccc' });
                }
            });
            setPendingRents(rents);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCommunicationSent = () => {
        setIsFreeCommOpen(false);
        fetchData();
        alert("Messaggio inviato e archiviato!");
    };

    const handleCampaignSaved = () => {
        setIsCampaignWizardOpen(false);
        fetchData();
        alert("Campagna pianificata!");
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
                    <button onClick={() => setIsFreeCommOpen(true)} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /><span className="ml-2">Nuova</span></button>
                    <button onClick={() => setIsCampaignWizardOpen(true)} className="md-btn md-btn-flat border border-gray-300 bg-white flex items-center"><CalendarIcon /><span className="ml-2">Campagna</span></button>
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
                                        <button onClick={() => setIsFreeCommOpen(true)} className="md-btn md-btn-flat text-indigo-600"><ChatIcon /> Contatta</button>
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
                                        <button onClick={() => setIsFreeCommOpen(true)} className="md-btn md-btn-flat text-amber-600"><ChatIcon /> Contatta</button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
                
                {activeTab === 'campaigns' && (
                    <div className="animate-slide-up space-y-4">
                        {campaigns.map(c => (
                            <div key={c.id} className="md-card p-4 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-800">{c.name}</h4>
                                    <p className="text-xs text-gray-500">{c.status} • Next: {new Date(c.nextRun).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${c.channel === 'email' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{c.channel.toUpperCase()}</span>
                            </div>
                        ))}
                        {campaigns.length === 0 && <p className="text-center text-gray-500 py-10">Nessuna campagna attiva.</p>}
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="animate-slide-up">
                        <div className="space-y-3">
                            {paginatedLogs.map(log => (
                                <div key={log.id} className="bg-white border rounded p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{log.channel}</span>
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
                    />
                </Modal>
            )}
            
            {isCampaignWizardOpen && (
                <Modal onClose={() => setIsCampaignWizardOpen(false)} size="lg">
                    <CampaignWizard 
                        onClose={() => setIsCampaignWizardOpen(false)}
                        onSave={handleCampaignSaved}
                        clients={clients}
                    />
                </Modal>
            )}
        </div>
    );
};

export default CRM;
