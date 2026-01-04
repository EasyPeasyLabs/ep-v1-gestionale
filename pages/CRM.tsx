
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllEnrollments } from '../services/enrollmentService';
import { getTransactions } from '../services/financeService';
import { getClients } from '../services/parentService';
import { getSuppliers } from '../services/supplierService';
import { getCommunicationLogs, logCommunication, deleteCommunicationLog, getCampaigns, addCampaign, updateCampaign, deleteCampaign, updateCommunicationLog } from '../services/crmService';
import { getCommunicationTemplates, getCompanyInfo } from '../services/settingsService';
import { uploadCampaignFile } from '../services/storageService';
import { Enrollment, EnrollmentStatus, Transaction, TransactionStatus, TransactionCategory, Client, Supplier, ClientType, ParentClient, InstitutionalClient, CommunicationLog, Campaign, CampaignInput, CampaignRecipient, CommunicationTemplate, CompanyInfo } from '../types';
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
import RichTextEditor from '../components/RichTextEditor';

// --- Icons ---
const ChatIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> </svg> );
const PaperAirplaneIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);

// --- Helpers ---
const getClientName = (c: Client) => c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName || ''} ${(c as ParentClient).lastName || ''}` : ((c as InstitutionalClient).companyName || '');

// --- Helper Colors ---
const getTextColorForBg = (bgColor: string) => {
    if (!bgColor) return '#000';
    const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ? '#000' : '#fff';
};

// --- Helper HTML Converter ---
const convertHtmlToWhatsApp = (html: string) => {
    let text = html;
    // Replace <br>, <div>, <p> with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    
    // Bold
    text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*');
    text = text.replace(/<strong>(.*?)<\/strong>/gi, '*$1*');
    
    // Italic
    text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_');
    text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_');
    
    // Lists
    text = text.replace(/<li>/gi, '- ');
    text = text.replace(/<\/li>/gi, '\n');
    
    // Strip all other tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities (basic)
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    return txt.value.trim();
};

const convertHtmlToPlainText = (html: string) => {
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<li>/gi, '- ');
    text = text.replace(/<\/li>/gi, '\n');
    
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    // Remove remaining tags
    return txt.value.replace(/<[^>]+>/g, '').trim();
};

// --- Interface Context Data ---
interface CommunicationContext {
    clientName?: string;
    childName?: string;
    supplierName?: string;
    description?: string;
    amount?: string;
    date?: string;
}

// --- Normalized Alert Item for Grouping ---
interface CrmAlertItem {
    id: string; // Unique ID
    type: 'expiry' | 'lessons' | 'rent';
    date: string; // ISO Date String of the event
    locationId: string;
    locationName: string;
    recipientId: string;
    recipientName: string;
    recipientType: 'clients' | 'suppliers';
    description: string;
    details?: string; // Secondary text
    amount?: number;
    rawObj: any; // Original Object (Enrollment or Transaction)
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
    initialSelectedIds?: string[]; // NEW: For Bulk
    initialRecipientType?: 'clients' | 'suppliers'; // NEW: Force type
    contextData?: CommunicationContext | null;
    companyInfo?: CompanyInfo | null;
}> = ({ onClose, onSent, clients, suppliers, initialData, initialSelectedIds, initialRecipientType, contextData, companyInfo }) => {
    
    const [recipientsType, setRecipientsType] = useState<'clients' | 'suppliers' | 'custom'>(initialData?.recipientType || initialRecipientType || 'clients');
    
    // Initialize selectedIds either from single initialData or bulk initialSelectedIds
    const [selectedIds, setSelectedIds] = useState<string[]>(() => {
        if (initialSelectedIds && initialSelectedIds.length > 0) return initialSelectedIds;
        if (initialData?.recipientId) return [initialData.recipientId];
        return [];
    });

    const [customRecipient, setCustomRecipient] = useState('');
    const [subject, setSubject] = useState(initialData?.subject || '');
    const [message, setMessage] = useState(initialData?.message || '');
    const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Templates State
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // Dynamic Context for Placeholders (based on selection)
    const [previewContext, setPreviewContext] = useState<CommunicationContext | null>(contextData || null);

    useEffect(() => {
        getCommunicationTemplates().then(setTemplates);
    }, []);

    // Placeholder Logic Enhancement: Update context when selection changes
    useEffect(() => {
        if (recipientsType !== 'custom' && selectedIds.length > 0) {
            // Find the first selected entity to use as preview data
            const firstId = selectedIds[0];
            let newContext: CommunicationContext = { date: new Date().toLocaleDateString('it-IT') };

            if (recipientsType === 'clients') {
                const c = clients.find(x => x.id === firstId);
                if (c) {
                    newContext.clientName = getClientName(c);
                    if (c.clientType === ClientType.Parent && (c as ParentClient).children.length > 0) {
                        newContext.childName = (c as ParentClient).children[0].name; // Pick first child as example
                    }
                }
            } else {
                const s = suppliers.find(x => x.id === firstId);
                if (s) {
                    newContext.supplierName = s.companyName;
                    newContext.clientName = s.companyName; // Fallback for {{cliente}}
                }
            }
            
            // Merge with passed contextData if available (e.g. from alerts, which has priority on amount/desc)
            if (contextData) {
                newContext = { ...newContext, ...contextData };
            }
            
            setPreviewContext(newContext);
        } else if (recipientsType === 'custom') {
            setPreviewContext(contextData || null);
        }
    }, [selectedIds, recipientsType, clients, suppliers, contextData]);

    const replacePlaceholders = (text: string, ctx: CommunicationContext | null) => {
        let res = text;
        
        if (ctx) {
            if (ctx.clientName) res = res.replace(/{{cliente}}/g, ctx.clientName);
            if (ctx.childName) res = res.replace(/{{bambino}}/g, ctx.childName);
            if (ctx.supplierName) {
                res = res.replace(/{{fornitore}}/g, ctx.supplierName);
                res = res.replace(/{{cliente}}/g, ctx.supplierName); 
            }
            if (ctx.description) res = res.replace(/{{descrizione}}/g, ctx.description);
            if (ctx.amount) res = res.replace(/{{importo}}/g, ctx.amount);
            
            const dateStr = ctx.date || new Date().toLocaleDateString('it-IT');
            res = res.replace(/{{data}}/g, dateStr);
        }

        // Company Info Replacements
        if (companyInfo) {
            if (companyInfo.iban) res = res.replace(/{{iban}}/g, companyInfo.iban);
            if (companyInfo.paypal) res = res.replace(/{{paypal}}/g, companyInfo.paypal);
            if (companyInfo.satispay) res = res.replace(/{{satispay}}/g, companyInfo.satispay);
            if (companyInfo.googlePay) res = res.replace(/{{googlePay}}/g, companyInfo.googlePay);
            if (companyInfo.klarna) res = res.replace(/{{klarna}}/g, companyInfo.klarna);
        }

        return res;
    };

    const handleTemplateChange = (tmplId: string) => {
        setSelectedTemplateId(tmplId);
        const tmpl = templates.find(t => t.id === tmplId);
        if (tmpl) {
            setSubject(replacePlaceholders(tmpl.subject, previewContext));
            let combined = tmpl.body;
            if (tmpl.signature) combined += `<br><br>${tmpl.signature}`;
            // NOTE: We put placeholders in the editor directly. Replacement happens on send or we can preview it.
            // Better to keep placeholders in editor so user sees them, but Replace for Subject immediately.
            setMessage(combined); 
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
        const targetPhones: string[] = []; 

        // Preparazione testo finale (sostituzione placeholder basata sul contesto corrente/primo)
        // Nota: Per invii massivi reali personalizzati, servirebbe un loop qui. 
        // Per WhatsApp: Funziona (apre N tab). Per Email: Mailto apre 1 sola finestra.
        
        // 1. Risolvi il messaggio finale (con conversione HTML -> Plain/Markdown)
        const rawHtmlMessage = replacePlaceholders(message, previewContext);
        
        let finalMessage = "";
        if (channel === 'whatsapp') {
            finalMessage = convertHtmlToWhatsApp(rawHtmlMessage);
        } else {
            // Mailto doesn't support HTML body. We must convert to text.
            finalMessage = convertHtmlToPlainText(rawHtmlMessage);
        }

        const finalSubject = replacePlaceholders(subject, previewContext);

        if (recipientsType === 'custom') {
            recipientsList.push(customRecipient);
            if (channel === 'whatsapp') targetPhones.push(customRecipient);
        } else {
            selectedIds.forEach(id => {
                let name = '';
                let phone = '';

                if (recipientsType === 'clients') {
                    const c = clients.find(x => x.id === id);
                    if (c) { name = getClientName(c); phone = c.phone; }
                } else {
                    const s = suppliers.find(x => x.id === id);
                    if (s) { name = s.companyName; phone = s.phone; }
                }

                if (name) recipientsList.push(name);
                if (phone) targetPhones.push(phone);
            });
        }

        if (recipientsList.length === 0) return alert("Seleziona almeno un destinatario.");

        // Logica Invio
        if (channel === 'whatsapp') {
            if (targetPhones.length === 0) return alert("Nessun numero trovato.");

            const encodedMsg = encodeURIComponent(`*${finalSubject}*\n\n${finalMessage}`);
            
            // Loop per apertura tab (Browser permettendo)
            targetPhones.forEach(rawPhone => {
                let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
                if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
                if (cleanPhone.length === 10) cleanPhone = '39' + cleanPhone;

                if (cleanPhone) window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
            });

        } else {
            const bcc = recipientsType === 'custom' ? customRecipient : ''; 
            const mailto = `mailto:?bcc=${bcc}&subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalMessage)}`;
            window.location.href = mailto;
        }

        await logCommunication({
            date: new Date().toISOString(),
            channel,
            subject: finalSubject,
            message: finalMessage, // Log plain text version
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
                {selectedIds.length > 1 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold ml-2">{selectedIds.length} Destinatari</span>}
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
                
                {/* Rich Text Editor Replaces Textarea */}
                <div>
                    <RichTextEditor 
                        label="Messaggio"
                        value={message} 
                        onChange={setMessage} 
                        placeholder="Scrivi il messaggio..." 
                        className="min-h-[200px]"
                    />
                </div>

                {selectedIds.length > 1 && (
                    <p className="text-xs text-orange-500 italic">Attenzione: inviando a più destinatari via Email, si aprirà un'unica finestra. I placeholder verranno sostituiti con i dati del PRIMO destinatario per anteprima. Per invii massivi personalizzati reali, usare WhatsApp (apre tab multipli).</p>
                )}
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                <button onClick={handleSend} className="md-btn md-btn-raised md-btn-primary">Invia Messaggio</button>
            </div>
        </div>
    );
};

// ... (LogEditor, CampaignWizard remain unchanged) ...
const LogEditor: React.FC<{ log: CommunicationLog; onSave: () => void; onCancel: () => void; }> = ({ log, onSave, onCancel }) => { const [subject, setSubject] = useState(log.subject); const [message, setMessage] = useState(log.message); const [saving, setSaving] = useState(false); const handleSave = async () => { setSaving(true); try { await updateCommunicationLog(log.id, { subject, message }); onSave(); } catch (e) { alert("Errore durante l'aggiornamento."); } finally { setSaving(false); } }; return ( <div className="flex flex-col h-full max-h-[80vh]"> <div className="p-6 border-b flex-shrink-0"> <h3 className="text-xl font-bold text-gray-800">Modifica Log Archivio</h3> </div> <div className="flex-1 p-6 space-y-4"> <div className="md-input-group"> <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " /> <label className="md-input-label">Oggetto / Titolo</label> </div> <div className="md-input-group"> <textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} className="md-input" placeholder="Messaggio..." /> </div> <p className="text-xs text-gray-500 italic">Nota: La modifica aggiorna solo il record nel database, non invia nuovi messaggi.</p> </div> <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0"> <button onClick={onCancel} className="md-btn md-btn-flat">Annulla</button> <button onClick={handleSave} disabled={saving} className="md-btn md-btn-raised md-btn-primary"> {saving ? 'Salvataggio...' : 'Salva Modifiche'} </button> </div> </div> ); };
const CampaignWizard: React.FC<{ onClose: () => void; onSave: () => void; clients: Client[]; campaign?: Campaign; }> = ({ onClose, onSave, clients, campaign }) => { const [step, setStep] = useState(1); const [name, setName] = useState(campaign?.name || ''); const [channel, setChannel] = useState<'email' | 'whatsapp'>(campaign?.channel || 'email'); const [subject, setSubject] = useState(campaign?.subject || ''); const [content, setContent] = useState(campaign?.message || ''); const [mediaUrl, setMediaUrl] = useState(campaign?.mediaLinks || ''); const [targetType, setTargetType] = useState('all'); const initialDate = campaign?.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : ''; const [scheduleDate, setScheduleDate] = useState(initialDate); const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.[0]) { try { const url = await uploadCampaignFile(e.target.files[0]); setMediaUrl(url); } catch(err) { alert("Errore upload"); } } }; const handleSaveCampaign = async () => { const recipients: CampaignRecipient[] = clients.map(c => ({ id: c.id, name: getClientName(c), contact: c.email, type: 'client' })); const campaignData: CampaignInput = { name, channel, subject, message: content, mediaLinks: mediaUrl, recipients: recipients.slice(0, 5), startDate: scheduleDate || new Date().toISOString(), time: '09:00', frequency: 'once', repeatCount: 1, status: 'active', sentCount: 0, nextRun: scheduleDate || new Date().toISOString() }; if (campaign) { await updateCampaign(campaign.id, campaignData); } else { await addCampaign(campaignData); } onSave(); }; return ( <div className="flex flex-col h-full max-h-[90vh]"> <div className="p-6 border-b bg-indigo-600 text-white flex-shrink-0"> <h3 className="text-xl font-bold">{campaign ? 'Modifica Campagna' : 'Creazione Campagna'}</h3> <p className="text-xs opacity-80">Step {step} di 3</p> </div> <div className="flex-1 overflow-y-auto p-6 space-y-6"> {step === 1 && ( <div className="space-y-4 animate-fade-in"> <div className="md-input-group"><input type="text" value={name} onChange={e => setName(e.target.value)} className="md-input" placeholder=" " /><label className="md-input-label">Nome Campagna</label></div> <div> <label className="block text-sm font-bold text-gray-700 mb-2">Canale</label> <div className="grid grid-cols-2 gap-4"> <button onClick={() => setChannel('email')} className={`p-4 border rounded-xl ${channel === 'email' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : ''}`}>📧 Email</button> <button onClick={() => setChannel('whatsapp')} className={`p-4 border rounded-xl ${channel === 'whatsapp' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : ''}`}>📱 WhatsApp</button> </div> </div> </div> )} {step === 2 && ( <div className="space-y-4 animate-fade-in"> <div className="md-input-group"><input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="md-input" placeholder=" " /><label className="md-input-label">Oggetto / Titolo</label></div> <div className="md-input-group"><textarea rows={6} value={content} onChange={e => setContent(e.target.value)} className="md-input" placeholder="Scrivi il contenuto..." /></div> <div> <label className="block text-xs font-bold text-gray-500 mb-1">Media (Opzionale)</label> <div className="flex gap-2 items-center"> <input type="file" onChange={handleFileUpload} className="text-xs" /> {mediaUrl && <span className="text-green-600 text-xs">Caricato!</span>} </div> </div> </div> )} {step === 3 && ( <div className="space-y-4 animate-fade-in"> <div> <label className="block text-sm font-bold text-gray-700 mb-2">Target</label> <select value={targetType} onChange={e => setTargetType(e.target.value)} className="md-input"> <option value="all">Tutti i Clienti Attivi</option> <option value="expired">Clienti Scaduti (Win-back)</option> </select> </div> <div className="md-input-group"><input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Data Invio</label></div> <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800"> La campagna verrà messa in coda e inviata automaticamente alla data stabilita. </div> </div> )} </div> <div className="p-4 border-t flex justify-between bg-gray-50 flex-shrink-0"> {step > 1 ? <button onClick={() => setStep(s => s-1)} className="md-btn md-btn-flat">Indietro</button> : <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>} {step < 3 ? <button onClick={() => setStep(s => s+1)} className="md-btn md-btn-raised md-btn-primary">Avanti</button> : <button onClick={handleSaveCampaign} className="md-btn md-btn-raised md-btn-green">Pianifica</button>} </div> </div> ); };

// --- CRM MAIN PAGE ---
const CRM: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'archive'>('overview');
    
    // Data
    const [crmAlerts, setCrmAlerts] = useState<CrmAlertItem[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [logs, setLogs] = useState<CommunicationLog[]>([]);
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

    // Filters Overview
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [filterTimeFrame, setFilterTimeFrame] = useState<'day'|'week'|'month'|'year'>('month');
    const [currentDate, setCurrentDate] = useState(new Date()); // Stato navigazione temporale
    const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]); // For Bulk Actions

    // Persistent State for Dismissed/Handled Items
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('ep_crm_dismissed_ids') || '[]');
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('ep_crm_dismissed_ids', JSON.stringify(dismissedIds));
    }, [dismissedIds]);

    // UI State for Modals
    const [isFreeCommOpen, setIsFreeCommOpen] = useState(false);
    const [communicationContext, setCommunicationContext] = useState<CommunicationContext | null>(null);
    const [prefilledCommData, setPrefilledCommData] = useState<{
        recipientId: string;
        recipientType: 'clients' | 'suppliers';
        subject: string;
        message: string;
    } | null>(null);
    const [initialBulkRecipients, setInitialBulkRecipients] = useState<string[]>([]);
    const [initialRecipientType, setInitialRecipientType] = useState<'clients'|'suppliers'>('clients');

    const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
    const [editingLog, setEditingLog] = useState<CommunicationLog | undefined>(undefined);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; type: 'campaign' | 'log' } | null>(null);

    // Pagination
    const [archivePage, setArchivePage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [enrollments, transactions, clientsData, suppliersData, logsData, campaignsData, templatesData, companyInfoData] = await Promise.all([
                getAllEnrollments(),
                getTransactions(),
                getClients(),
                getSuppliers(),
                getCommunicationLogs(),
                getCampaigns(),
                getCommunicationTemplates(),
                getCompanyInfo()
            ]);
            
            setClients(clientsData);
            setSuppliers(suppliersData);
            setLogs(logsData);
            setCampaigns(campaignsData);
            setTemplates(templatesData);
            setCompanyInfo(companyInfoData);

            // --- NORMALIZE ALERTS ---
            const alerts: CrmAlertItem[] = [];
            const today = new Date();
            
            // 1. Enrollments
            enrollments.forEach(enr => {
                if (enr.status === EnrollmentStatus.Active) {
                    const endDate = new Date(enr.endDate);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let type: 'expiry' | 'lessons' | null = null;
                    let desc = '';
                    let details = '';
                    let alertDate = enr.endDate; // Event Date

                    if (diffDays >= 0 && diffDays <= 30) {
                        type = 'expiry';
                        desc = `Scadenza Iscrizione: ${enr.childName}`;
                        details = `Scade il ${new Date(enr.endDate).toLocaleDateString()}`;
                    } else if (enr.lessonsRemaining <= 2) {
                        type = 'lessons';
                        desc = `Esaurimento Lezioni: ${enr.childName}`;
                        details = `${enr.lessonsRemaining} lezioni rimaste`;
                        alertDate = new Date().toISOString(); // Urgent now
                    }

                    if (type) {
                        const locId = enr.locationId && enr.locationId !== 'unassigned' ? enr.locationId : 'unknown';
                        const locName = enr.locationName && enr.locationName !== 'Sede Non Definita' ? enr.locationName : 'Sede N/D';
                        
                        alerts.push({
                            id: `enr-${enr.id}`,
                            type,
                            date: alertDate,
                            locationId: locId,
                            locationName: locName,
                            recipientId: enr.clientId,
                            recipientName: clientsData.find(c => c.id === enr.clientId) ? getClientName(clientsData.find(c => c.id === enr.clientId)!) : 'Cliente Sconosciuto',
                            recipientType: 'clients',
                            description: desc,
                            details,
                            rawObj: enr
                        });
                    }
                }
            });

            // 2. Pending Rents
            transactions.forEach(t => {
                if (t.status === TransactionStatus.Pending && t.category === TransactionCategory.Rent) {
                    let supplier = suppliersData.find(s => t.description.toLowerCase().includes((s.companyName || '').toLowerCase()));
                    // Try allocation match
                    if (!supplier && t.allocationId) {
                        supplier = suppliersData.find(s => s.locations.some(l => l.id === t.allocationId));
                    }

                    alerts.push({
                        id: `trn-${t.id}`,
                        type: 'rent',
                        date: t.date,
                        locationId: t.allocationId || 'unknown',
                        locationName: t.allocationName || 'Sede N/D',
                        recipientId: supplier?.id || 'unknown',
                        recipientName: supplier?.companyName || 'Fornitore Sconosciuto',
                        recipientType: 'suppliers',
                        description: `Affitto Sede: ${t.description}`,
                        details: `Importo da saldare`,
                        amount: t.amount,
                        rawObj: t
                    });
                }
            });

            // Sort by Date Descending
            alerts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setCrmAlerts(alerts);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- COLOR MAP MEMO ---
    const locationColors = useMemo(() => {
        const colors: Record<string, string> = {};
        suppliers.forEach(s => s.locations.forEach(l => {
            colors[l.name] = l.color;
        }));
        return colors;
    }, [suppliers]);

    const handleNavigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (filterTimeFrame === 'day') newDate.setDate(newDate.getDate() + direction);
        else if (filterTimeFrame === 'week') newDate.setDate(newDate.getDate() + (direction * 7));
        else if (filterTimeFrame === 'month') newDate.setMonth(newDate.getMonth() + direction);
        else if (filterTimeFrame === 'year') newDate.setFullYear(newDate.getFullYear() + direction);
        setCurrentDate(newDate);
    };

    const getPeriodLabel = () => {
        const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        if (filterTimeFrame === 'day') return currentDate.toLocaleDateString('it-IT', opts);
        if (filterTimeFrame === 'month') return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        if (filterTimeFrame === 'year') return currentDate.getFullYear().toString();
        // Week is trickier, simplified to "Settimana del..."
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        return `Settimana del ${startOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })}`;
    };

    // --- FILTER & GROUP LOGIC ---
    const groupedAlerts = useMemo(() => {
        // 1. Filter based on currentDate navigation
        let startDate = new Date(currentDate);
        let endDate = new Date(currentDate);

        if (filterTimeFrame === 'day') {
            startDate.setHours(0,0,0,0);
            endDate.setHours(23,59,59,999);
        } else if (filterTimeFrame === 'week') {
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); 
            startDate.setDate(diff); startDate.setHours(0,0,0,0);
            endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
        } else if (filterTimeFrame === 'month') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
        } else if (filterTimeFrame === 'year') {
            startDate = new Date(startDate.getFullYear(), 0, 1);
            endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
        }

        const filtered = crmAlerts.filter(a => {
            // New: Exclude dismissed items
            if (dismissedIds.includes(a.id)) return false;

            const d = new Date(a.date);
            const dateMatch = d >= startDate && d <= endDate;
            const locMatch = filterLocation ? a.locationName === filterLocation : true;
            return dateMatch && locMatch;
        });

        // 2. Group: Date -> Location
        // Map<DateString, Map<LocationName, Item[]>>
        const groups: Record<string, Record<string, CrmAlertItem[]>> = {};

        filtered.forEach(item => {
            const dateKey = new Date(item.date).toLocaleDateString('it-IT');
            const locKey = item.locationName;

            if (!groups[dateKey]) groups[dateKey] = {};
            if (!groups[dateKey][locKey]) groups[dateKey][locKey] = [];
            
            groups[dateKey][locKey].push(item);
        });

        return groups; // { "10/10/2023": { "Sede A": [item1, item2], "Sede B": [item3] } }
    }, [crmAlerts, filterLocation, filterTimeFrame, currentDate, dismissedIds]);

    const availableLocations = useMemo(() => Array.from(new Set(crmAlerts.map(a => a.locationName))).sort(), [crmAlerts]);

    // --- Bulk Selection Handlers ---
    const toggleAlertSelect = (id: string) => {
        setSelectedAlertIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleGroupSelect = (items: CrmAlertItem[]) => {
        const ids = items.map(i => i.id);
        const allSelected = ids.every(id => selectedAlertIds.includes(id));
        
        if (allSelected) {
            // Deselect all
            setSelectedAlertIds(prev => prev.filter(id => !ids.includes(id)));
        } else {
            // Select all
            setSelectedAlertIds(prev => [...prev, ...ids.filter(id => !prev.includes(id))]);
        }
    };

    // --- Action Handlers ---
    const handleSingleAction = (item: CrmAlertItem) => {
        setCommunicationContext({
            clientName: item.recipientName,
            childName: item.type !== 'rent' ? item.rawObj.childName : undefined,
            description: item.description,
            amount: item.amount ? item.amount.toFixed(2) : undefined,
            date: new Date().toLocaleDateString('it-IT')
        });

        setPrefilledCommData({
            recipientId: item.recipientId,
            recipientType: item.recipientType,
            subject: item.type === 'rent' ? "Sollecito Pagamento" : "Rinnovo Iscrizione",
            message: "" // Will load from template in modal if matches
        });
        
        // Reset bulk
        setInitialBulkRecipients([]);
        setInitialRecipientType(item.recipientType);
        setIsFreeCommOpen(true);
    };

    const handleBulkSend = () => {
        // Collect recipient IDs from selected alerts
        const selectedItems = crmAlerts.filter(a => selectedAlertIds.includes(a.id));
        // Remove duplicates and unknowns
        const recipientIds = Array.from(new Set(selectedItems.map(i => i.recipientId).filter(id => id !== 'unknown')));
        
        if (recipientIds.length === 0) return alert("Nessun destinatario valido selezionato.");

        // Determine dominant type (clients vs suppliers) - mixed send not perfect in UI but backend handles it
        // We default to clients if mixed, user can switch tab in modal
        const hasSuppliers = selectedItems.some(i => i.recipientType === 'suppliers');
        const hasClients = selectedItems.some(i => i.recipientType === 'clients');
        const type = hasSuppliers && !hasClients ? 'suppliers' : 'clients';

        setInitialBulkRecipients(recipientIds);
        setInitialRecipientType(type);
        setPrefilledCommData(null); // Clear single mode data
        setCommunicationContext(null); // Generic context
        setIsFreeCommOpen(true);
    };

    const handleCommunicationSent = () => {
        setIsFreeCommOpen(false);
        setSelectedAlertIds([]);
        fetchData();
        alert("Messaggio inviato!");
    };

    // --- NEW: Mark group as Handled ---
    const handleMarkGroupHandled = async (items: CrmAlertItem[]) => {
        if (!confirm(`Confermi di aver già gestito/contattato questi ${items.length} contatti? Verrà creato un log di "Gestione Esterna" e le voci saranno nascoste.`)) return;
        
        setLoading(true);
        try {
            // Collect unique recipients
            const recipientsList: string[] = [];
            const idsProcessed = new Set<string>();

            items.forEach(item => {
                if (!idsProcessed.has(item.recipientId) && item.recipientId !== 'unknown') {
                    recipientsList.push(item.recipientName);
                    idsProcessed.add(item.recipientId);
                }
            });

            await logCommunication({
                date: new Date().toISOString(),
                channel: 'email', // Default for system log
                subject: 'MANUALE: Gestione Esterna / Massiva',
                message: `I seguenti contatti sono stati segnati come "Già Gestiti" manualmente dall'operatore: ${recipientsList.join(', ')}.`,
                recipients: recipientsList,
                recipientCount: recipientsList.length,
                type: 'manual'
            });

            // Update persistent dismissed state
            const newDismissed = items.map(i => i.id);
            setDismissedIds(prev => [...prev, ...newDismissed]);

            // Deselect handled items if they were selected
            setSelectedAlertIds(prev => prev.filter(id => !newDismissed.includes(id)));
            
            await fetchData();
            alert("Operazione completata. Voci rimosse dalla vista.");
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio.");
        } finally {
            setLoading(false);
        }
    };

    // --- Other Handlers ---
    const handleCampaignSaved = () => { setIsCampaignWizardOpen(false); setEditingCampaign(undefined); fetchData(); };
    const handleLogSaved = () => { setEditingLog(undefined); fetchData(); };
    const handleDeleteRequest = (id: string, type: 'campaign' | 'log') => { setDeleteConfirm({ isOpen: true, id, type }); };
    const confirmDelete = async () => { if (!deleteConfirm) return; setLoading(true); try { if (deleteConfirm.type === 'campaign') await deleteCampaign(deleteConfirm.id); else await deleteCommunicationLog(deleteConfirm.id); await fetchData(); } catch (e) { alert("Errore eliminazione."); } finally { setLoading(false); setDeleteConfirm(null); } };
    const handleConfirmDeleteAll = async () => { setIsDeleteAllModalOpen(false); setLoading(true); try { if (activeTab === 'campaigns') { const all = await getCampaigns(); for (const c of all) await deleteCampaign(c.id); } else if (activeTab === 'archive') { const all = await getCommunicationLogs(); for (const l of all) await deleteCommunicationLog(l.id); } await fetchData(); alert("Eliminazione completata."); } catch (err) { alert("Errore eliminazione."); } finally { setLoading(false); } };
    
    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
                <div><h1 className="text-3xl font-bold">CRM</h1><p className="mt-1 text-gray-500">Gestione relazioni e comunicazioni.</p></div>
                <div className="flex gap-2">
                    {activeTab !== 'overview' && (
                        <button onClick={() => setIsDeleteAllModalOpen(true)} className="md-btn md-btn-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center text-xs font-bold mr-2"><TrashIcon /> Elimina Tutto</button>
                    )}
                    <button onClick={() => { setPrefilledCommData(null); setCommunicationContext(null); setInitialBulkRecipients([]); setIsFreeCommOpen(true); }} className="md-btn md-btn-raised md-btn-green flex items-center"><PlusIcon /><span className="ml-2">Nuova</span></button>
                    <button onClick={() => { setEditingCampaign(undefined); setIsCampaignWizardOpen(true); }} className="md-btn md-btn-flat border border-gray-300 bg-white flex items-center"><CalendarIcon /><span className="ml-2">Campagna</span></button>
                </div>
            </div>
            
            {/* SCROLLABLE TABS */}
            <div className="border-b border-gray-200 mb-6 -mx-4 md:mx-0">
                <nav className="flex space-x-2 overflow-x-auto scrollbar-hide px-4 md:px-0 pb-1">
                    <button onClick={() => setActiveTab('overview')} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>Panoramica</button>
                    <button onClick={() => setActiveTab('campaigns')} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === 'campaigns' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>Campagne</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all whitespace-nowrap mb-2 ${activeTab === 'archive' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}>Archivio</button>
                </nav>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                <>
                {activeTab === 'overview' && (
                    <div className="animate-fade-in relative pb-20">
                        {/* Filters & View Controls */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-3 rounded-lg border border-gray-200 shadow-sm items-center">
                            <div className="w-full md:w-auto">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Filtra per Sede</label>
                                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="md-input text-sm py-1.5 w-full md:w-48">
                                    <option value="">Tutte le sedi</option>
                                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            
                            <div className="flex-1 flex flex-col sm:flex-row gap-4 items-center justify-end w-full">
                                {/* View Type Buttons */}
                                <div className="flex bg-gray-100 p-1 rounded-lg flex-shrink-0 overflow-x-auto max-w-full">
                                    {['day', 'week', 'month', 'year'].map(t => (
                                        <button 
                                            key={t} 
                                            onClick={() => setFilterTimeFrame(t as any)} 
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${filterTimeFrame === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {t === 'day' ? 'Giorno' : t === 'week' ? 'Settimana' : t === 'month' ? 'Mese' : 'Anno'}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Navigation */}
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                    <button onClick={() => handleNavigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-600 font-bold">&lt;</button>
                                    <span className="text-sm font-bold min-w-[120px] text-center capitalize text-gray-800 select-none">
                                        {getPeriodLabel()}
                                    </span>
                                    <button onClick={() => handleNavigate(1)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-600 font-bold">&gt;</button>
                                </div>
                            </div>
                        </div>

                        {/* Grouped Content */}
                        <div className="space-y-8">
                            {Object.keys(groupedAlerts).length === 0 && (
                                <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    Nessun evento da gestire nel periodo {getPeriodLabel()}.
                                </div>
                            )}

                            {Object.entries(groupedAlerts).map(([date, locGroups]) => (
                                <div key={date}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">{date}</span>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {Object.entries(locGroups).map(([locName, items]) => {
                                            // LOGICA COLORI DINAMICI
                                            // Aggiornamento: l'header prende il colore della sede anche in vista generale (richiesta utente)
                                            const locColor = locationColors[locName] || '#ccc';
                                            const textColor = getTextColorForBg(locColor);
                                            
                                            // Applicazione colori sempre attiva
                                            const headerStyle = { backgroundColor: locColor, color: textColor };
                                            const headerClass = 'px-4 py-2 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2';

                                            return (
                                            <div key={`${date}-${locName}`} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                                <div className={headerClass} style={headerStyle}>
                                                    <h4 className="font-bold flex items-center gap-2 text-sm" style={{color: textColor}}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={items.every(i => selectedAlertIds.includes(i.id))}
                                                            onChange={() => toggleGroupSelect(items)}
                                                            className="rounded focus:ring-indigo-500 text-indigo-600 bg-white border-gray-300"
                                                        />
                                                        {locName}
                                                        {/* Badge conteggio: Stile glass trasparente su sfondo colorato */}
                                                        <span className="text-xs border px-2 py-0.5 rounded font-medium ml-2 bg-white/20 border-white/30">
                                                            {items.length}
                                                        </span>
                                                    </h4>
                                                    
                                                    {/* Bottone Segna Gestiti: Stile glass */}
                                                    <button 
                                                        onClick={() => handleMarkGroupHandled(items)}
                                                        className="text-[10px] px-2 py-1 rounded flex items-center gap-1 font-bold transition-colors border bg-white/20 text-inherit border-white/30 hover:bg-white/30"
                                                        title="Segna tutti questi contatti come già gestiti/contattati manualmente"
                                                    >
                                                        <CheckIcon /> Segna gestiti
                                                    </button>
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {items.map(item => (
                                                        <div key={item.id} className={`p-3 flex justify-between items-center hover:bg-indigo-50/30 transition-colors ${selectedAlertIds.includes(item.id) ? 'bg-indigo-50' : ''}`}>
                                                            <div className="flex items-start gap-3">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedAlertIds.includes(item.id)}
                                                                    onChange={() => toggleAlertSelect(item.id)}
                                                                    className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-sm text-gray-800">{item.recipientName}</p>
                                                                    <p className="text-xs text-gray-600">{item.description}</p>
                                                                    <p className={`text-[10px] font-bold ${item.type === 'rent' ? 'text-red-500' : 'text-amber-500'}`}>
                                                                        {item.details} {item.amount ? `(${item.amount.toFixed(2)}€)` : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => handleSingleAction(item)} className="md-icon-btn text-indigo-600 bg-white border border-indigo-100 hover:bg-indigo-50 shadow-sm">
                                                                <ChatIcon />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Floating Action Bar (Responsive Fix: Changed bottom-24 to bottom-6) */}
                        {selectedAlertIds.length > 0 && (
                            <div className="fixed bottom-6 md:bottom-10 left-4 right-4 md:left-1/2 md:right-auto md:w-auto md:transform md:-translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex justify-between md:justify-center items-center gap-4 animate-slide-up">
                                <span className="font-bold text-sm whitespace-nowrap">{selectedAlertIds.length} selezionati</span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={handleBulkSend}
                                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <PaperAirplaneIcon /> Invia
                                    </button>
                                    <button onClick={() => setSelectedAlertIds([])} className="text-slate-400 hover:text-white text-xs whitespace-nowrap">Annulla</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Campaigns & Archive Tabs (Unchanged logic) */}
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
                                        <button onClick={() => { setEditingCampaign(c); setIsCampaignWizardOpen(true); }} className="md-icon-btn edit"><PencilIcon /></button>
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
                            {logs.slice((archivePage - 1) * itemsPerPage, archivePage * itemsPerPage).map(log => (
                                <div key={log.id} className="bg-white border rounded p-4 shadow-sm group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{log.channel}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingLog(log); }} className="md-icon-btn edit p-1"><PencilIcon /></button>
                                            <button onClick={() => handleDeleteRequest(log.id, 'log')} className="md-icon-btn delete p-1"><TrashIcon /></button>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-sm text-gray-800">{log.subject}</h4>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">{log.message}</p>
                                    <div className="mt-2 text-xs text-indigo-600 font-medium">Inviato a: {log.recipients.length > 3 ? `${log.recipients.length} destinatari` : log.recipients.join(', ')}</div>
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-center text-gray-500 py-10">Nessuna comunicazione in archivio.</p>}
                        </div>
                        <Pagination currentPage={archivePage} totalItems={logs.length} itemsPerPage={itemsPerPage} onPageChange={setArchivePage} />
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
                        initialSelectedIds={initialBulkRecipients}
                        initialRecipientType={initialRecipientType}
                        contextData={communicationContext} 
                        companyInfo={companyInfo}
                    />
                </Modal>
            )}
            
            {isCampaignWizardOpen && <Modal onClose={() => setIsCampaignWizardOpen(false)} size="lg"><CampaignWizard campaign={editingCampaign} onClose={() => setIsCampaignWizardOpen(false)} onSave={handleCampaignSaved} clients={clients} /></Modal>}
            {editingLog && <Modal onClose={() => setEditingLog(undefined)} size="lg"><LogEditor log={editingLog} onSave={handleLogSaved} onCancel={() => setEditingLog(undefined)} /></Modal>}
            <ConfirmModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={confirmDelete} title={deleteConfirm?.type === 'campaign' ? "Elimina Campagna" : "Elimina Log"} message="Sei sicuro?" isDangerous={true} />
            <ConfirmModal isOpen={isDeleteAllModalOpen} onClose={() => setIsDeleteAllModalOpen(false)} onConfirm={handleConfirmDeleteAll} title={`ELIMINA TUTTO (${activeTab.toUpperCase()})`} message="Sei sicuro di voler eliminare tutto?" isDangerous={true} confirmText="Sì, Elimina TUTTO" />
        </div>
    );
};

export default CRM;
