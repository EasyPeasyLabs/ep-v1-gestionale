
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, CommunicationTemplate, PeriodicCheck, PeriodicCheckInput, CheckCategory, Supplier, SubscriptionStatusConfig, SubscriptionStatusType, Client, ParentClient, ClientType, InstitutionalClient } from '../types';
import { getCompanyInfo, updateCompanyInfo, getSubscriptionTypes, addSubscriptionType, updateSubscriptionType, deleteSubscriptionType, getCommunicationTemplates, saveCommunicationTemplate, deleteCommunicationTemplate, getPeriodicChecks, addPeriodicCheck, updatePeriodicCheck, deletePeriodicCheck, getRecoveryPolicies, saveRecoveryPolicies } from '../services/settingsService';
import { getSuppliers } from '../services/supplierService';
import { getClients } from '../services/parentService';
import { requestNotificationPermission } from '../services/fcmService';
import { auth } from '../firebase/config';
import { applyTheme, getSavedTheme, defaultTheme } from '../utils/theme';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import UploadIcon from '../components/icons/UploadIcon';
import ClockIcon from '../components/icons/ClockIcon';
import BellIcon from '../components/icons/BellIcon';

// --- HELPER PURA PER PARSING NOME ---
const parseSubscriptionName = (fullName: string | undefined) => {
    let name = '';
    let year = new Date().getFullYear().toString();
    let annotation = 'standard';

    if (!fullName) return { name, year, annotation };

    if (fullName.includes('.')) {
        const parts = fullName.split('.').map(p => p.trim());
        if (parts.length >= 1) {
            const namePart = parts[0];
            const prefixSeparator = namePart.indexOf('-');
            name = prefixSeparator > -1 ? namePart.substring(prefixSeparator + 1).trim() : namePart;
        }
        if (parts.length >= 2) year = parts[1];
        if (parts.length >= 3) annotation = parts[2];
    } else {
        const prefixSeparator = fullName.indexOf('-');
        name = prefixSeparator > -1 ? fullName.substring(prefixSeparator + 1).trim() : fullName;
    }
    return { name, year, annotation };
};

// --- SUB-COMPONENTS ---

const SubscriptionStatusModal: React.FC<{
    currentConfig?: SubscriptionStatusConfig;
    suppliers: Supplier[];
    onSave: (config: SubscriptionStatusConfig) => void;
    onClose: () => void;
}> = ({ currentConfig, suppliers, onSave, onClose }) => {
    const [status, setStatus] = useState<SubscriptionStatusType>(currentConfig?.status || 'active');
    const [date, setDate] = useState(currentConfig?.validDate || new Date().toISOString().split('T')[0]);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(currentConfig?.discountType || 'percent');
    const [discountValue, setDiscountValue] = useState(currentConfig?.discountValue || 0);
    const [targetLocationIds, setTargetLocationIds] = useState<string[]>(currentConfig?.targetLocationIds || []);
    const [targetClientIds, setTargetClientIds] = useState<string[]>(currentConfig?.targetClientIds || []);
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [clientSearch, setClientSearch] = useState('');

    useEffect(() => {
        let mounted = true;
        if (status === 'promo') {
            const loadClients = async () => {
                setLoadingClients(true);
                try {
                    const data = await getClients();
                    if (mounted) setClients(data);
                } catch (e) { console.error(e); } finally { if (mounted) setLoadingClients(false); }
            };
            loadClients();
        }
        return () => { mounted = false; };
    }, [status]);

    const handleSave = () => {
        const config: SubscriptionStatusConfig = {
            status,
            targetLocationIds: status === 'promo' ? targetLocationIds : [],
            targetClientIds: status === 'promo' ? targetClientIds : []
        };
        if (status !== 'active') config.validDate = date;
        if (status === 'promo') { config.discountType = discountType; config.discountValue = discountValue; }
        onSave(config);
        onClose();
    };

    const toggleLocation = (id: string) => setTargetLocationIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleClient = (id: string) => setTargetClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const allLocations = useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        if (suppliers) { suppliers.forEach(s => { if (s.locations) { s.locations.forEach(l => locs.push({id: l.id, name: l.name})); } }); }
        return locs;
    }, [suppliers]);

    const filteredClients = clients.filter(c => {
        const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName;
        return (name || '').toLowerCase().includes(clientSearch.toLowerCase());
    });

    return (
        <Modal onClose={onClose} size="lg">
            <div className="flex flex-col h-full max-h-[85vh]">
                <div className="p-6 border-b bg-gray-50 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-800">Stato Abbonamento</h3>
                    <p className="text-xs text-gray-500">Definisci disponibilità e regole promozionali.</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setStatus('active')} className={`p-3 border rounded-lg text-sm font-bold transition-all ${status === 'active' ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Attivo</button>
                        <button type="button" onClick={() => setStatus('obsolete')} className={`p-3 border rounded-lg text-sm font-bold transition-all ${status === 'obsolete' ? 'bg-gray-100 border-gray-500 text-gray-700 ring-1 ring-gray-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Obsoleto</button>
                        <button type="button" onClick={() => setStatus('future')} className={`p-3 border rounded-lg text-sm font-bold transition-all ${status === 'future' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Da Attivare</button>
                        <button type="button" onClick={() => setStatus('promo')} className={`p-3 border rounded-lg text-sm font-bold transition-all ${status === 'promo' ? 'bg-yellow-50 border-yellow-500 text-yellow-700 ring-1 ring-yellow-500' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Promo</button>
                    </div>
                    <div className="bg-white border rounded-lg p-4 space-y-4 animate-fade-in">
                        {status === 'active' && <p className="text-sm text-green-600">L'abbonamento è visibile e selezionabile liberamente.</p>}
                        {status === 'obsolete' && (<div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Non più selezionabile dal:</label></div>)}
                        {status === 'future' && (<div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Disponibile a partire dal:</label></div>)}
                        {status === 'promo' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-gray-500">Tipo Sconto</label><select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="md-input"><option value="percent">Percentuale (%)</option><option value="fixed">Importo Fisso (€)</option></select></div>
                                    <div className="md-input-group"><input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} className="md-input" placeholder=" " /><label className="md-input-label">Valore Sconto</label></div>
                                </div>
                                <div className="md-input-group"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" /><label className="md-input-label !top-0">Valido dal:</label></div>
                                <div className="border-t pt-4">
                                    <label className="text-xs font-bold text-indigo-600 uppercase mb-2 block">A) Target Sedi (Recinti)</label>
                                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto mb-4">{allLocations.map(l => (<button key={l.id} type="button" onClick={() => toggleLocation(l.id)} className={`px-2 py-1 rounded border text-xs ${targetLocationIds.includes(l.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>{l.name}</button>))}</div>
                                    <label className="text-xs font-bold text-indigo-600 uppercase mb-2 block">B) Target Clienti</label>
                                    {loadingClients ? <Spinner /> : (<div className="border rounded-lg p-2"><input type="text" placeholder="Cerca cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full text-xs border-b pb-1 mb-2 outline-none"/><div className="max-h-32 overflow-y-auto space-y-1">{filteredClients.map(c => { const name = c.clientType === ClientType.Parent ? `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}` : (c as InstitutionalClient).companyName; return (<label key={c.id} className="flex items-center gap-2 text-xs p-1 hover:bg-gray-50 cursor-pointer"><input type="checkbox" checked={targetClientIds.includes(c.id)} onChange={() => toggleClient(c.id)} className="rounded text-indigo-600"/><span className="truncate">{name}</span></label>); })}</div></div>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0"><button type="button" onClick={onClose} className="md-btn md-btn-flat">Annulla</button><button type="button" onClick={handleSave} className="md-btn md-btn-raised md-btn-primary">Applica Stato</button></div>
            </div>
        </Modal>
    );
};

// ... (Resto dei componenti Form invariati: SubscriptionForm, TemplateForm, CheckForm)
const SubscriptionForm: React.FC<{ sub?: SubscriptionType | null; onSave: (sub: SubscriptionTypeInput | SubscriptionType) => void; onCancel: () => void; suppliers: Supplier[]; }> = ({ sub, onSave, onCancel, suppliers }) => { const [name, setName] = useState(''); const [year, setYear] = useState(''); const [annotation, setAnnotation] = useState(''); const [price, setPrice] = useState('0'); const [lessons, setLessons] = useState('0'); const [durationInDays, setDurationInDays] = useState('0'); const [target, setTarget] = useState<'kid' | 'adult'>('kid'); const [statusConfig, setStatusConfig] = useState<SubscriptionStatusConfig>({ status: 'active' }); const [isStatusModalOpen, setIsStatusModalOpen] = useState(false); useEffect(() => { if (sub) { const parsed = parseSubscriptionName(sub.name); setName(parsed.name); setYear(parsed.year); setAnnotation(parsed.annotation); setPrice(sub.price?.toString() || '0'); setLessons(sub.lessons?.toString() || '0'); setDurationInDays(sub.durationInDays?.toString() || '0'); setTarget(sub.target || 'kid'); setStatusConfig(sub.statusConfig || { status: 'active' }); } else { setName(''); setYear(new Date().getFullYear().toString()); setAnnotation('standard'); setPrice('0'); setLessons('0'); setDurationInDays('0'); setTarget('kid'); setStatusConfig({ status: 'active' }); } }, [sub?.id]); const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!name || !price || !lessons || !durationInDays) { alert("Compila tutti i campi obbligatori."); return; } const prefix = target === 'kid' ? 'K' : 'A'; const finalName = `${prefix}-${name}.${year}.${annotation}`; const subData = { name: finalName, price: Number(price), lessons: Number(lessons), durationInDays: Number(durationInDays), target, statusConfig }; try { if (sub?.id) { await onSave({ ...subData, id: sub.id }); } else { await onSave(subData); } } catch (err) { console.error(err); alert("Errore durante il salvataggio."); } }; const getStatusLabel = () => { const currentStatus = statusConfig?.status || 'active'; switch(currentStatus) { case 'active': return '🟢 Attivo'; case 'obsolete': return '⚫ Obsoleto'; case 'future': return '🔵 Da Attivare'; case 'promo': return '🟡 Promo'; default: return 'Attivo'; } }; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden"> <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100 flex justify-between items-center"> <h2 className="text-xl font-bold text-gray-800">{sub ? 'Modifica Abbonamento' : 'Nuovo Abbonamento'}</h2> <button type="button" onClick={() => setIsStatusModalOpen(true)} className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-700 transition-colors border border-gray-300"> <span>{getStatusLabel()}</span> <PencilIcon /> </button> </div> <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4"> <div className="flex gap-4 mb-4"> <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${target === 'kid' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}> <input type="radio" name="target" value="kid" checked={target === 'kid'} onChange={() => setTarget('kid')} className="hidden" /> 👶 Bambini (K) </label> <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${target === 'adult' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}> <input type="radio" name="target" value="adult" checked={target === 'adult'} onChange={() => setTarget('adult')} className="hidden" /> 🧑 Adulti (A) </label> </div> <div className="flex gap-2 items-end"> <div className="flex-1 md-input-group"> <input id="subName" type="text" value={name} onChange={e => setName(e.target.value)} className="md-input" placeholder=" " autoComplete="off" /> <label htmlFor="subName" className="md-input-label">Nome (es. Trimestrale)</label> </div> <span className="text-gray-400 pb-2">.</span> <div className="w-20 md-input-group"> <input id="subYear" type="text" value={year} onChange={e => setYear(e.target.value)} className="md-input text-center" placeholder=" " autoComplete="off" /> <label htmlFor="subYear" className="md-input-label">Anno</label> </div> <span className="text-gray-400 pb-2">.</span> <div className="w-24 md-input-group"> <input id="subNote" type="text" value={annotation} onChange={e => setAnnotation(e.target.value)} className="md-input" placeholder=" " autoComplete="off" /> <label htmlFor="subNote" className="md-input-label">Note</label> </div> </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> <div className="md-input-group"> <input id="subPrice" type="number" value={price} onChange={e => setPrice(e.target.value)} className="md-input" placeholder=" " autoComplete="off" /> <label htmlFor="subPrice" className="md-input-label">Prezzo (€)</label> </div> <div className="md-input-group"> <input id="subLessons" type="number" value={lessons} onChange={e => setLessons(e.target.value)} className="md-input" placeholder=" " autoComplete="off" /> <label htmlFor="subLessons" className="md-input-label">N. Lezioni</label> </div> </div> <div className="md-input-group"> <input id="subDuration" type="number" value={durationInDays} onChange={e => setDurationInDays(e.target.value)} className="md-input" placeholder=" " autoComplete="off" /> <label htmlFor="subDuration" className="md-input-label">Durata (giorni)</label> </div> <div className="mt-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-center text-gray-500"> Codice generato: <strong>{target === 'kid' ? 'K' : 'A'}-{name}.{year}.{annotation}</strong> </div> {statusConfig && (statusConfig.status === 'promo' || statusConfig.status === 'future') && ( <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800"> <strong>Nota:</strong> Questo abbonamento ha regole speciali di validità ({statusConfig.status}). {statusConfig.discountValue ? ` Sconto attivo: ${statusConfig.discountValue}${statusConfig.discountType === 'percent' ? '%' : '€'}` : ''} </div> )} </div> <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button> </div> {isStatusModalOpen && ( <SubscriptionStatusModal currentConfig={statusConfig} suppliers={suppliers} onSave={setStatusConfig} onClose={() => setIsStatusModalOpen(false)} /> )} </form> ); };
const TemplateForm: React.FC<{ template: CommunicationTemplate; onSave: (t: CommunicationTemplate) => void; onCancel: () => void; }> = ({ template, onSave, onCancel }) => { const [label, setLabel] = useState(template.label || ''); const [subject, setSubject] = useState(template.subject); const [body, setBody] = useState(template.body); const [signature, setSignature] = useState(template.signature); const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...template, label, subject, body, signature }); }; const placeholders = ['{{cliente}}', '{{fornitore}}', '{{bambino}}', '{{data}}', '{{importo}}', '{{descrizione}}', '{{paypal}}', '{{satispay}}', '{{googlePay}}', '{{klarna}}', '{{iban}}']; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden"> <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100"> <h2 className="text-xl font-bold text-gray-800">{template.id ? `Modifica Template: ${template.label}` : 'Nuovo Template'}</h2> </div> <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4"> <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-800"> <strong>Variabili disponibili:</strong> {placeholders.join(', ')} </div> <div className="md-input-group"> <input type="text" value={label} onChange={e => setLabel(e.target.value)} required className="md-input" placeholder=" " /> <label className="md-input-label">Nome Template (Label)</label> </div> <div className="md-input-group"> <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className="md-input" placeholder=" " /> <label className="md-input-label">Oggetto / Titolo</label> </div> <div className="md-input-group"> <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} required className="w-full p-2 border rounded text-sm bg-transparent focus:border-indigo-500" style={{borderColor: 'var(--md-divider)'}} placeholder="Messaggio..."></textarea> <label className="text-xs text-gray-500 mt-1 block">Corpo del messaggio</label> </div> <div className="md-input-group"> <textarea rows={2} value={signature} onChange={e => setSignature(e.target.value)} className="w-full p-2 border rounded text-sm bg-transparent focus:border-indigo-500" style={{borderColor: 'var(--md-divider)'}} placeholder="Firma..."></textarea> <label className="text-xs text-gray-500 mt-1 block">Firma</label> </div> </div> <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Template</button> </div> </form> ); };
const CheckForm: React.FC<{ check?: PeriodicCheck | null; onSave: (c: PeriodicCheckInput | PeriodicCheck) => void; onCancel: () => void }> = ({ check, onSave, onCancel }) => { const [category, setCategory] = useState<CheckCategory>(check?.category || CheckCategory.Payments); const [subCategory, setSubCategory] = useState(check?.subCategory || ''); const [daysOfWeek, setDaysOfWeek] = useState<number[]>(check?.daysOfWeek || []); const [startTime, setStartTime] = useState(check?.startTime || '09:00'); const [pushEnabled, setPushEnabled] = useState(check?.pushEnabled || false); const [note, setNote] = useState(check?.note || ''); const daysMap = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']; const toggleDay = (day: number) => { setDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const data: any = { category, subCategory, daysOfWeek: daysOfWeek.sort(), startTime, endTime: startTime, pushEnabled, note }; if (check?.id) onSave({ ...data, id: check.id }); else onSave(data); }; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden"> <div className="p-6 pb-2 border-b"> <h2 className="text-xl font-bold text-gray-800">{check ? 'Modifica Controllo' : 'Nuovo Controllo Periodico'}</h2> </div> <div className="flex-1 overflow-y-auto p-6 space-y-4"> <div className="md-input-group"> <select value={category} onChange={e => setCategory(e.target.value as CheckCategory)} className="md-input"> {Object.values(CheckCategory).map(c => <option key={c} value={c}>{c}</option>)} </select> <label className="md-input-label">Categoria</label> </div> <div className="md-input-group"> <input type="text" value={subCategory} onChange={e => setSubCategory(e.target.value)} className="md-input" placeholder=" " /> <label className="md-input-label">Dettaglio (es. Commercialista)</label> </div> <div> <label className="block text-xs text-gray-500 mb-2">Giorni della Settimana</label> <div className="flex flex-wrap gap-2"> {daysMap.map((d, i) => ( <button key={i} type="button" onClick={() => toggleDay(i)} className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${daysOfWeek.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`} > {d} </button> ))} </div> </div> <div className="md-input-group"> <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="md-input" /> <label className="md-input-label !top-0">Orario Notifica</label> </div> <div className="flex items-center gap-2 mt-2"> <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="h-4 w-4 text-indigo-600" /> <label className="text-sm text-gray-700">Abilita Notifica Push</label> </div> <div className="md-input-group"> <textarea value={note} onChange={e => setNote(e.target.value)} className="md-input" rows={2} placeholder=" "></textarea> <label className="md-input-label">Nota / Messaggio</label> </div> </div> <div className="p-4 border-t flex justify-end gap-2 bg-gray-50"> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-primary md-btn-sm">Salva</button> </div> </form> ); };

// --- MAIN SETTINGS COMPONENT ---

const Settings: React.FC = () => {
    const [info, setInfo] = useState<CompanyInfo | null>(null);
    const [subscriptions, setSubscriptions] = useState<SubscriptionType[]>([]);
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    const [checks, setChecks] = useState<PeriodicCheck[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [recoveryPolicies, setRecoveryPolicies] = useState<Record<string, 'allowed' | 'forbidden'>>({});
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<SubscriptionType | null>(null);
    const [subToDelete, setSubToDelete] = useState<string | null>(null);
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
    const [editingCheck, setEditingCheck] = useState<PeriodicCheck | null>(null);

    const [primaryColor, setPrimaryColor] = useState(defaultTheme.primary);
    const [bgColor, setBgColor] = useState(defaultTheme.bgLight);
    
    // Notification Status & Debugging
    const [notifPermission, setNotifPermission] = useState(Notification.permission);
    const [debugLog, setDebugLog] = useState<string[]>([]);

    const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [companyData, subsData, templatesData, checksData, supsData, recData] = await Promise.all([
                getCompanyInfo(), 
                getSubscriptionTypes(),
                getCommunicationTemplates(),
                getPeriodicChecks(),
                getSuppliers(),
                getRecoveryPolicies()
            ]);
            setInfo(companyData); 
            setSubscriptions(subsData);
            setTemplates(templatesData);
            setChecks(checksData);
            setSuppliers(supsData);
            setRecoveryPolicies(recData);
            
            const savedTheme = getSavedTheme();
            setPrimaryColor(savedTheme.primary);
            setBgColor(savedTheme.bg);
        } catch (err) {
            setError("Impossibile caricare le impostazioni."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleSaveInfo = async () => { if (info) { try { setIsSaving(true); await updateCompanyInfo(info); window.dispatchEvent(new Event('EP_DataUpdated')); alert("Dati salvati con successo!"); } catch (err) { console.error(err); alert("Errore durante il salvataggio."); } finally { setIsSaving(false); } } };
    const handleInfoChange = (field: keyof CompanyInfo, value: string | number) => { setInfo(prev => prev ? { ...prev, [field]: value } : null); };
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { handleInfoChange('logoBase64', reader.result as string); }; reader.readAsDataURL(file); } };
    const handleOpenSubModal = (sub: SubscriptionType | null = null) => { setEditingSub(sub); setIsSubModalOpen(true); };
    const handleSaveSub = async (sub: SubscriptionTypeInput | SubscriptionType) => { if ('id' in sub) { await updateSubscriptionType(sub.id, sub); } else { await addSubscriptionType(sub); } setIsSubModalOpen(false); setEditingSub(null); fetchAllData(); };
    const handleDeleteClick = (id: string) => { setSubToDelete(id); }
    const handleConfirmDelete = async () => { if(subToDelete) { await deleteSubscriptionType(subToDelete); fetchAllData(); setSubToDelete(null); } };
    
    // Templates CRUD
    const handleCreateTemplate = () => { 
        setEditingTemplate({ id: '', label: '', subject: '', body: '', signature: '' }); 
        setIsTemplateModalOpen(true); 
    };
    const handleOpenTemplateModal = (t: CommunicationTemplate) => { setEditingTemplate(t); setIsTemplateModalOpen(true); };
    const handleSaveTemplate = async (t: CommunicationTemplate) => { await saveCommunicationTemplate(t); setIsTemplateModalOpen(false); setEditingTemplate(null); fetchAllData(); };
    const handleDeleteTemplateClick = (id: string) => { setTemplateToDelete(id); };
    const handleConfirmDeleteTemplate = async () => { if(templateToDelete) { await deleteCommunicationTemplate(templateToDelete); fetchAllData(); setTemplateToDelete(null); } };

    const handleSaveCheck = async (c: PeriodicCheckInput | PeriodicCheck) => { if ('id' in c) await updatePeriodicCheck(c.id, c); else await addPeriodicCheck(c); setIsCheckModalOpen(false); setEditingCheck(null); fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); };
    const handleDeleteCheck = async (id: string) => { if(confirm("Eliminare questo controllo periodico?")) { await deletePeriodicCheck(id); fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); } };
    const handleColorChange = (newPrimary: string, newBg: string) => { setPrimaryColor(newPrimary); setBgColor(newBg); applyTheme(newPrimary, newBg); };
    const handleResetTheme = () => { handleColorChange(defaultTheme.primary, defaultTheme.bgLight); };

    // Recovery Policy Handler
    const handlePolicyChange = async (locationId: string, policy: 'allowed' | 'forbidden') => {
        const newPolicies = { ...recoveryPolicies, [locationId]: policy };
        setRecoveryPolicies(newPolicies);
        await saveRecoveryPolicies(newPolicies);
    };

    // --- DEBUGGING LOGIC ---
    const handleEnableNotifications = async () => {
        setDebugLog([]); // Reset log
        const userId = auth.currentUser?.uid;
        if(userId) {
            addLog("Avvio procedura richiesta permessi...");
            const result = await requestNotificationPermission(userId);
            
            setNotifPermission(result.success ? 'granted' : 'denied');
            
            if(result.success) {
                addLog("TOKEN OTTENUTO! Token inviato al database.");
                addLog(`Token (parziale): ${result.token?.substring(0, 15)}...`);
                
                try {
                    addLog("Tentativo invio notifica LOCALE di test...");
                    
                    // FIX ANDROID: Use Service Worker registration instead of new Notification()
                    if ('serviceWorker' in navigator) {
                        const registration = await navigator.serviceWorker.ready;
                        await registration.showNotification("EP v1: Test", { 
                            body: "Se leggi questo, il browser permette le notifiche!", 
                            icon: info?.logoBase64,
                            tag: 'test-notification'
                        });
                        addLog("Notifica inviata tramite Service Worker (Mobile Friendly)!");
                    } else {
                        // Fallback desktop legacy
                        new Notification("EP v1: Test", { 
                            body: "Se leggi questo, il browser permette le notifiche!", 
                            icon: info?.logoBase64 
                        });
                        addLog("Notifica inviata tramite API Standard.");
                    }
                } catch (e: any) {
                    addLog("Errore invio notifica locale: " + e.message);
                }
            } else {
                addLog("ERRORE: " + result.error);
            }
        } else {
            addLog("Errore: Utente non loggato.");
        }
    };

    // --- HELPERS VISUALI ---
    const getStatusBadgeInfo = (status: string) => {
        switch(status) {
            case 'obsolete': return { label: 'Obsoleto', className: 'bg-gray-100 text-gray-600 border-gray-200' };
            case 'future': return { label: 'Da Attivare', className: 'bg-blue-50 text-blue-600 border-blue-200' };
            case 'promo': return { label: 'Promo', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
            default: return null;
        }
    };

    const daysMap = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    if (loading) return <div className="mt-8 flex justify-center items-center h-64"><Spinner /></div>;
    if (error) return <p className="text-center text-red-500 py-8">{error}</p>;

  return (
    <div>
        <h1 className="text-3xl font-bold">Impostazioni</h1>
        <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Configura i dati aziendali, i listini e il planner operativo.</p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
            {/* Colonna Sinistra (Dati Aziendali) ... */}
            <div className="space-y-8">
                <div className="md-card p-6">
                    <h2 className="text-lg font-semibold border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>Dati Aziendali & Logo</h2>
                    {info && (
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="w-16 h-16 border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50">
                                    {info.logoBase64 ? <img src={info.logoBase64} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">No Logo</span>}
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo Applicazione</label>
                                    <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                                        <UploadIcon /> <span className="ml-2">Carica Immagine</span> <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                </div>
                            </div>
                            <div className="md-input-group"><input id="infoDenom" type="text" value={info.denomination || ''} onChange={(e) => handleInfoChange('denomination', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoDenom" className="md-input-label">Denominazione</label></div>
                            <div className="md-input-group"><input id="infoName" type="text" value={info.name || ''} onChange={(e) => handleInfoChange('name', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoName" className="md-input-label">Ragione Sociale</label></div>
                            <div className="md-input-group"><input id="infoVat" type="text" value={info.vatNumber || ''} onChange={(e) => handleInfoChange('vatNumber', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoVat" className="md-input-label">P.IVA / C.F.</label></div>
                            <div className="md-input-group"><input id="infoAddress" type="text" value={info.address || ''} onChange={(e) => handleInfoChange('address', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoAddress" className="md-input-label">Indirizzo Sede</label></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="md-input-group"><input id="infoEmail" type="email" value={info.email || ''} onChange={(e) => handleInfoChange('email', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoEmail" className="md-input-label">Email</label></div>
                                <div className="md-input-group"><input id="infoPhone" type="tel" value={info.phone || ''} onChange={(e) => handleInfoChange('phone', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoPhone" className="md-input-label">Telefono</label></div>
                            </div>
                            <div className="md-input-group mt-4"><input id="infoIban" type="text" value={info.iban || ''} onChange={(e) => handleInfoChange('iban', e.target.value)} className="md-input font-mono" placeholder=" " /><label htmlFor="infoIban" className="md-input-label">IBAN</label></div>
                            
                            {/* DIRECT MONEY TRANSFER */}
                            <div className="mt-4 pt-4 border-t">
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Direct Money Transfer</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="md-input-group">
                                        <input id="infoPaypal" type="text" value={info.paypal || ''} onChange={(e) => handleInfoChange('paypal', e.target.value)} className="md-input" placeholder=" " />
                                        <label htmlFor="infoPaypal" className="md-input-label">PayPal (Link/Email)</label>
                                    </div>
                                    <div className="md-input-group">
                                        <input id="infoSatispay" type="text" value={info.satispay || ''} onChange={(e) => handleInfoChange('satispay', e.target.value)} className="md-input" placeholder=" " />
                                        <label htmlFor="infoSatispay" className="md-input-label">SatisPay (Link/Numero)</label>
                                    </div>
                                    <div className="md-input-group">
                                        <input id="infoGooglePay" type="text" value={info.googlePay || ''} onChange={(e) => handleInfoChange('googlePay', e.target.value)} className="md-input" placeholder=" " />
                                        <label htmlFor="infoGooglePay" className="md-input-label">Google Pay</label>
                                    </div>
                                    <div className="md-input-group">
                                        <input id="infoKlarna" type="text" value={info.klarna || ''} onChange={(e) => handleInfoChange('klarna', e.target.value)} className="md-input" placeholder=" " />
                                        <label htmlFor="infoKlarna" className="md-input-label">Klarna</label>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t mt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-gray-700">Parametri Veicolo (Logistica)</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="md-input-group"><input id="fuelCons" type="number" step="0.1" value={info.carFuelConsumption || 16.5} onChange={(e) => handleInfoChange('carFuelConsumption', parseFloat(e.target.value))} className="md-input text-sm" placeholder=" " /><label htmlFor="fuelCons" className="md-input-label !text-xs">Consumo (km/l)</label></div>
                                    <div className="md-input-group"><input id="fuelPrice" type="number" step="0.01" value={info.averageFuelPrice || 1.80} onChange={(e) => handleInfoChange('averageFuelPrice', parseFloat(e.target.value))} className="md-input text-sm" placeholder=" " /><label htmlFor="fuelPrice" className="md-input-label !text-xs">Benzina (€/l)</label></div>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 italic">Il costo usura veicolo viene calcolato dinamicamente dalle spese registrate.</p>
                            </div>
                            <div className="flex justify-end pt-4"><button onClick={handleSaveInfo} disabled={isSaving} className="md-btn md-btn-raised md-btn-primary">{isSaving ? 'Salvataggio...' : 'Salva Modifiche'}</button></div>
                        </div>
                    )}
                </div>
                <div className="md-card p-6">
                    <h2 className="text-lg font-semibold border-b pb-3 mb-4" style={{borderColor: 'var(--md-divider)'}}>Personalizzazione Tema</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Colore Primario</label><div className="flex items-center gap-3"><input type="color" value={primaryColor} onChange={(e) => handleColorChange(e.target.value, bgColor)} className="h-10 w-20 rounded border cursor-pointer"/><span className="text-xs text-gray-500">{primaryColor}</span></div></div>
                        <div><label className="block text-sm font-medium mb-1">Colore Sfondo</label><div className="flex items-center gap-3"><input type="color" value={bgColor} onChange={(e) => handleColorChange(primaryColor, e.target.value)} className="h-10 w-20 rounded border cursor-pointer"/><span className="text-xs text-gray-500">{bgColor}</span></div></div>
                        <button onClick={handleResetTheme} className="md-btn md-btn-flat md-btn-sm text-gray-500 mt-2 self-start">Ripristina Default</button>
                    </div>
                </div>
            </div>

            {/* Colonna Destra */}
            <div className="space-y-8">
                {/* Abbonamenti */}
                <div className="md-card p-6">
                    <div className="flex justify-between items-center border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>
                        <h2 className="text-lg font-semibold">Abbonamenti</h2>
                        <button onClick={() => handleOpenSubModal()} className="md-btn md-btn-raised md-btn-green md-btn-sm"><PlusIcon /> Nuovo</button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {subscriptions.map(sub => {
                            const status = sub.statusConfig?.status || 'active';
                            const badgeInfo = status !== 'active' ? getStatusBadgeInfo(status) : null;
                            
                            const cardClass = (() => {
                                switch(status) {
                                    case 'active': return 'bg-green-50 border-green-200';
                                    case 'obsolete': return 'bg-red-50 border-red-200';
                                    case 'future': return 'bg-amber-50 border-amber-200';
                                    case 'promo': return 'bg-cyan-50 border-cyan-200';
                                    default: return 'bg-gray-50 border-gray-200';
                                }
                            })();
                            
                            return (
                                <div key={sub.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded border ${cardClass} gap-3`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium flex flex-wrap items-center gap-2">
                                            {sub.name}
                                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${sub.target === 'adult' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {sub.target === 'adult' ? 'Adulti' : 'Bambini'}
                                            </span>
                                            {badgeInfo && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border whitespace-nowrap ${badgeInfo.className}`}>
                                                    {badgeInfo.label}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs mt-1" style={{color: 'var(--md-text-secondary)'}}>{sub.lessons} lezioni - {sub.durationInDays} giorni</p>
                                    </div>
                                    <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3 mt-2 sm:mt-0">
                                        <span className="font-bold text-sm">{sub.price}€</span>
                                        <div className="flex space-x-1">
                                            <button onClick={() => handleOpenSubModal(sub)} className="md-icon-btn edit p-2"><PencilIcon /></button>
                                            <button onClick={() => handleDeleteClick(sub.id)} className="md-icon-btn delete p-2"><TrashIcon /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Politica Recuperi (New Card) */}
                <div className="md-card p-6 border-l-4 border-orange-500">
                    <h2 className="text-lg font-semibold border-b pb-3 mb-4">Politica Recuperi</h2>
                    <p className="text-xs text-gray-500 mb-4">Definisci se le lezioni perse possono essere recuperate per ciascuna sede (recinto).</p>
                    
                    <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                        {suppliers.flatMap(s => s.locations).length === 0 && <p className="text-sm italic text-gray-400">Nessuna sede configurata.</p>}
                        
                        {suppliers.flatMap(s => s.locations || []).map(loc => {
                            const currentPolicy = recoveryPolicies[loc.id] || 'allowed'; // Default allowed
                            return (
                                <div key={loc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full" style={{backgroundColor: loc.color}}></span>
                                        <span className="text-sm font-bold text-gray-700">{loc.name}</span>
                                    </div>
                                    <div className="flex bg-white rounded border border-gray-300 p-0.5">
                                        <button 
                                            onClick={() => handlePolicyChange(loc.id, 'allowed')}
                                            className={`px-2 py-1 text-[10px] font-bold rounded ${currentPolicy === 'allowed' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                        >
                                            Consenti
                                        </button>
                                        <button 
                                            onClick={() => handlePolicyChange(loc.id, 'forbidden')}
                                            className={`px-2 py-1 text-[10px] font-bold rounded ${currentPolicy === 'forbidden' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                        >
                                            Vieta
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Planner & Controlli */}
                <div className="md-card p-6 bg-white border-l-4 border-indigo-500">
                    <div className="flex justify-between items-center border-b pb-3 mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Planner & Controlli</h2>
                            <p className="text-xs text-gray-500">Notifiche operative ricorrenti</p>
                        </div>
                        <button onClick={() => { setEditingCheck(null); setIsCheckModalOpen(true); }} className="md-btn md-btn-sm md-btn-primary"><PlusIcon /> Nuovo</button>
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                        {checks.map(check => (
                            <div key={check.id} className={`p-3 rounded border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${check.pushEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold uppercase tracking-wider">{check.category}</span>
                                        {check.pushEnabled && <span className="text-[9px] bg-green-100 text-green-800 px-1 rounded">PUSH</span>}
                                    </div>
                                    <p className="text-sm font-medium text-gray-800">{check.subCategory || 'Generico'}</p>
                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><ClockIcon /> {check.startTime} • {check.daysOfWeek.map(d => daysMap[d].substring(0,3)).join(', ')}</div>
                                </div>
                                <div className="flex gap-1 self-end sm:self-auto">
                                    <button onClick={() => { setEditingCheck(check); setIsCheckModalOpen(true); }} className="md-icon-btn edit p-2"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteCheck(check.id)} className="md-icon-btn delete p-2"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stato Servizio Notifiche - Diagnostic Panel */}
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                            <BellIcon /> Diagnostica Notifiche Push
                        </h3>
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="text-sm text-gray-800 font-medium">Target: <span className="font-mono text-indigo-700">Admin</span></p>
                                <p className="text-xs text-gray-500 mt-0.5">Stato Browser: {notifPermission}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <button 
                                    onClick={handleEnableNotifications} 
                                    className="text-[10px] bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 shadow-sm"
                                >
                                    Rinizializza / Test
                                </button>
                            </div>
                        </div>
                        
                        {/* DEBUG CONSOLE */}
                        {debugLog.length > 0 && (
                            <div className="mt-2 bg-black text-green-400 p-2 rounded text-[10px] font-mono h-24 overflow-y-auto">
                                {debugLog.map((log, i) => <div key={i}>{log}</div>)}
                            </div>
                        )}
                        {debugLog.length === 0 && (
                            <p className="text-[10px] text-gray-400 italic">Premi "Rinizializza / Test" per verificare i log di errore.</p>
                        )}
                    </div>
                </div>

                {/* Template Comunicazioni */}
                <div className="md-card p-6">
                    <div className="flex justify-between items-center border-b pb-3 mb-3">
                        <h2 className="text-lg font-semibold">Template Comunicazioni</h2>
                        <button onClick={handleCreateTemplate} className="md-btn md-btn-sm md-btn-raised md-btn-primary"><PlusIcon /> Nuovo</button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {templates.map(t => (
                            <div key={t.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 rounded border border-gray-100 gap-3">
                                <div>
                                    <p className="font-medium text-sm">{t.label}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{t.subject}</p>
                                </div>
                                <div className="flex gap-1 self-end sm:self-auto">
                                    <button onClick={() => handleOpenTemplateModal(t)} className="md-icon-btn edit p-2"><PencilIcon /></button>
                                    <button onClick={() => handleDeleteTemplateClick(t.id)} className="md-icon-btn delete p-2"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {isSubModalOpen && <Modal onClose={() => setIsSubModalOpen(false)}><SubscriptionForm sub={editingSub} onSave={handleSaveSub} onCancel={() => setIsSubModalOpen(false)} suppliers={suppliers} /></Modal>}
        {isTemplateModalOpen && editingTemplate && <Modal onClose={() => setIsTemplateModalOpen(false)}><TemplateForm template={editingTemplate} onSave={handleSaveTemplate} onCancel={() => setIsTemplateModalOpen(false)} /></Modal>}
        {isCheckModalOpen && <Modal onClose={() => setIsCheckModalOpen(false)}><CheckForm check={editingCheck} onSave={handleSaveCheck} onCancel={() => setIsCheckModalOpen(false)} /></Modal>}
        
        <ConfirmModal isOpen={!!subToDelete} onClose={() => setSubToDelete(null)} onConfirm={handleConfirmDelete} title="Elimina Abbonamento" message="Sei sicuro?" isDangerous={true} />
        <ConfirmModal isOpen={!!templateToDelete} onClose={() => setTemplateToDelete(null)} onConfirm={handleConfirmDeleteTemplate} title="Elimina Template" message="Sei sicuro di voler eliminare questo template?" isDangerous={true} />
    </div>
  );
};

export default Settings;
