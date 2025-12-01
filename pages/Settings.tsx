
import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, CommunicationTemplate, PeriodicCheck, PeriodicCheckInput, CheckCategory } from '../types';
import { getCompanyInfo, updateCompanyInfo, getSubscriptionTypes, addSubscriptionType, updateSubscriptionType, deleteSubscriptionType, getCommunicationTemplates, saveCommunicationTemplate, getPeriodicChecks, addPeriodicCheck, updatePeriodicCheck, deletePeriodicCheck } from '../services/settingsService';
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

// --- Components ---

const SubscriptionForm: React.FC<{ sub?: SubscriptionType | null; onSave: (sub: SubscriptionTypeInput | SubscriptionType) => void; onCancel: () => void; }> = ({ sub, onSave, onCancel }) => { 
    const [name, setName] = useState(sub?.name || ''); 
    const [price, setPrice] = useState(sub?.price || 0); 
    const [lessons, setLessons] = useState(sub?.lessons || 0); 
    const [durationInDays, setDurationInDays] = useState(sub?.durationInDays || 0);
    const [target, setTarget] = useState<'kid' | 'adult'>(sub?.target || 'kid'); // Default Kids

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        
        // Auto-Prefix Logic
        let finalName = name;
        const prefix = target === 'kid' ? 'K - ' : 'A - ';
        if (!finalName.startsWith(prefix) && !finalName.startsWith(target === 'kid' ? 'K-' : 'A-')) {
            finalName = prefix + finalName;
        }

        const subData = { 
            name: finalName, 
            price: Number(price), 
            lessons: Number(lessons), 
            durationInDays: Number(durationInDays),
            target
        }; 
        if (sub?.id) { onSave({ ...subData, id: sub.id }); } else { onSave(subData); } 
    }; 
    
    return ( 
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden"> 
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100"> 
                <h2 className="text-xl font-bold text-gray-800">{sub ? 'Modifica Abbonamento' : 'Nuovo Abbonamento'}</h2> 
            </div> 
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4"> 
                
                {/* Target Selection */}
                <div className="flex gap-4 mb-4">
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${target === 'kid' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}>
                        <input type="radio" name="target" value="kid" checked={target === 'kid'} onChange={() => setTarget('kid')} className="hidden" />
                        👶 Bambini (K)
                    </label>
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition-colors ${target === 'adult' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}>
                        <input type="radio" name="target" value="adult" checked={target === 'adult'} onChange={() => setTarget('adult')} className="hidden" />
                        🧑 Adulti (A)
                    </label>
                </div>

                <div className="md-input-group">
                    <input id="subName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " />
                    <label htmlFor="subName" className="md-input-label">Nome Abbonamento (Prefisso {target === 'kid' ? 'K' : 'A'} auto)</label>
                </div> 
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                    <div className="md-input-group"><input id="subPrice" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className="md-input" placeholder=" " /><label htmlFor="subPrice" className="md-input-label">Prezzo (€)</label></div> 
                    <div className="md-input-group"><input id="subLessons" type="number" value={lessons} onChange={e => setLessons(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subLessons" className="md-input-label">N. Lezioni</label></div> 
                </div> 
                <div className="md-input-group"><input id="subDuration" type="number" value={durationInDays} onChange={e => setDurationInDays(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subDuration" className="md-input-label">Durata (giorni)</label></div> 
            </div> 
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}> 
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> 
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button> 
            </div> 
        </form> 
    ); 
};

const TemplateForm: React.FC<{ template: CommunicationTemplate; onSave: (t: CommunicationTemplate) => void; onCancel: () => void; }> = ({ template, onSave, onCancel }) => { const [subject, setSubject] = useState(template.subject); const [body, setBody] = useState(template.body); const [signature, setSignature] = useState(template.signature); const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...template, subject, body, signature }); }; const placeholders = template.id === 'payment' ? ['{{fornitore}}', '{{descrizione}}'] : ['{{cliente}}', '{{bambino}}', '{{data}}']; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-full overflow-hidden"> <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100"> <h2 className="text-xl font-bold text-gray-800">Modifica Template: {template.label}</h2> </div> <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4"> <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-800"> <strong>Variabili disponibili:</strong> {placeholders.join(', ')} </div> <div className="md-input-group"> <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className="md-input" placeholder=" " /> <label className="md-input-label">Oggetto / Titolo</label> </div> <div className="md-input-group"> <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} required className="w-full p-2 border rounded text-sm bg-transparent focus:border-indigo-500" style={{borderColor: 'var(--md-divider)'}} placeholder="Messaggio..."></textarea> <label className="text-xs text-gray-500 mt-1 block">Corpo del messaggio</label> </div> <div className="md-input-group"> <textarea rows={2} value={signature} onChange={e => setSignature(e.target.value)} className="w-full p-2 border rounded text-sm bg-transparent focus:border-indigo-500" style={{borderColor: 'var(--md-divider)'}} placeholder="Firma..."></textarea> <label className="text-xs text-gray-500 mt-1 block">Firma</label> </div> </div> <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva Template</button> </div> </form> ); };
const CheckForm: React.FC<{ check?: PeriodicCheck | null; onSave: (c: PeriodicCheckInput | PeriodicCheck) => void; onCancel: () => void }> = ({ check, onSave, onCancel }) => { const [category, setCategory] = useState<CheckCategory>(check?.category || CheckCategory.Payments); const [subCategory, setSubCategory] = useState(check?.subCategory || ''); const [daysOfWeek, setDaysOfWeek] = useState<number[]>(check?.daysOfWeek || []); const [startTime, setStartTime] = useState(check?.startTime || '09:00'); const [pushEnabled, setPushEnabled] = useState(check?.pushEnabled || false); const [note, setNote] = useState(check?.note || ''); const daysMap = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']; const toggleDay = (day: number) => { setDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]); }; const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const data: any = { category, subCategory, daysOfWeek: daysOfWeek.sort(), startTime, endTime: startTime, pushEnabled, note }; if (check?.id) onSave({ ...data, id: check.id }); else onSave(data); }; return ( <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden"> <div className="p-6 pb-2 border-b"> <h2 className="text-xl font-bold text-gray-800">{check ? 'Modifica Controllo' : 'Nuovo Controllo Periodico'}</h2> </div> <div className="flex-1 overflow-y-auto p-6 space-y-4"> <div className="md-input-group"> <select value={category} onChange={e => setCategory(e.target.value as CheckCategory)} className="md-input"> {Object.values(CheckCategory).map(c => <option key={c} value={c}>{c}</option>)} </select> <label className="md-input-label">Categoria</label> </div> <div className="md-input-group"> <input type="text" value={subCategory} onChange={e => setSubCategory(e.target.value)} className="md-input" placeholder=" " /> <label className="md-input-label">Dettaglio (es. Commercialista)</label> </div> <div> <label className="block text-xs text-gray-500 mb-2">Giorni della Settimana</label> <div className="flex flex-wrap gap-2"> {daysMap.map((d, i) => ( <button key={i} type="button" onClick={() => toggleDay(i)} className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${daysOfWeek.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`} > {d} </button> ))} </div> </div> <div className="md-input-group"> <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="md-input" /> <label className="md-input-label !top-0">Orario Notifica</label> </div> <div className="flex items-center gap-2 mt-2"> <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="h-4 w-4 text-indigo-600" /> <label className="text-sm text-gray-700">Abilita Notifica Push</label> </div> <div className="md-input-group"> <textarea value={note} onChange={e => setNote(e.target.value)} className="md-input" rows={2} placeholder=" "></textarea> <label className="md-input-label">Nota / Messaggio</label> </div> </div> <div className="p-4 border-t flex justify-end gap-2 bg-gray-50"> <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button> <button type="submit" className="md-btn md-btn-raised md-btn-primary md-btn-sm">Salva</button> </div> </form> ); };

const Settings: React.FC = () => {
    const [info, setInfo] = useState<CompanyInfo | null>(null);
    const [subscriptions, setSubscriptions] = useState<SubscriptionType[]>([]);
    const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
    const [checks, setChecks] = useState<PeriodicCheck[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<SubscriptionType | null>(null);
    const [subToDelete, setSubToDelete] = useState<string | null>(null);
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);

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
            const [companyData, subsData, templatesData, checksData] = await Promise.all([
                getCompanyInfo(), 
                getSubscriptionTypes(),
                getCommunicationTemplates(),
                getPeriodicChecks()
            ]);
            setInfo(companyData); 
            setSubscriptions(subsData);
            setTemplates(templatesData);
            setChecks(checksData);
            
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
    const handleOpenTemplateModal = (t: CommunicationTemplate) => { setEditingTemplate(t); setIsTemplateModalOpen(true); };
    const handleSaveTemplate = async (t: CommunicationTemplate) => { await saveCommunicationTemplate(t); setIsTemplateModalOpen(false); setEditingTemplate(null); fetchAllData(); };
    const handleSaveCheck = async (c: PeriodicCheckInput | PeriodicCheck) => { if ('id' in c) await updatePeriodicCheck(c.id, c); else await addPeriodicCheck(c); setIsCheckModalOpen(false); setEditingCheck(null); fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); };
    const handleDeleteCheck = async (id: string) => { if(confirm("Eliminare questo controllo periodico?")) { await deletePeriodicCheck(id); fetchAllData(); window.dispatchEvent(new Event('EP_DataUpdated')); } };
    const handleColorChange = (newPrimary: string, newBg: string) => { setPrimaryColor(newPrimary); setBgColor(newBg); applyTheme(newPrimary, newBg); };
    const handleResetTheme = () => { handleColorChange(defaultTheme.primary, defaultTheme.bgLight); };

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
                            <div className="pt-4 border-t mt-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Parametri Veicolo Aziendale</h3>
                                <div className="md-input-group"><input id="fuelCons" type="number" step="0.1" value={info.carFuelConsumption || 16.5} onChange={(e) => handleInfoChange('carFuelConsumption', parseFloat(e.target.value))} className="md-input" placeholder=" " /><label htmlFor="fuelCons" className="md-input-label">Consumo Medio (km/l)</label></div>
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
                        {subscriptions.map(sub => (
                            <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        {sub.name}
                                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${sub.target === 'adult' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {sub.target === 'adult' ? 'Adulti' : 'Bambini'}
                                        </span>
                                    </p>
                                    <p className="text-xs" style={{color: 'var(--md-text-secondary)'}}>{sub.lessons} lezioni - {sub.durationInDays} giorni</p>
                                </div>
                                <div className="flex items-center gap-3"><span className="font-bold text-sm">{sub.price}€</span><div className="flex space-x-1"><button onClick={() => handleOpenSubModal(sub)} className="md-icon-btn edit"><PencilIcon /></button><button onClick={() => handleDeleteClick(sub.id)} className="md-icon-btn delete"><TrashIcon /></button></div></div>
                            </div>
                        ))}
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
                            <div key={check.id} className={`p-3 rounded border flex justify-between items-start ${check.pushEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                                <div>
                                    <div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wider">{check.category}</span>{check.pushEnabled && <span className="text-[9px] bg-green-100 text-green-800 px-1 rounded">PUSH</span>}</div>
                                    <p className="text-sm font-medium text-gray-800">{check.subCategory || 'Generico'}</p>
                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><ClockIcon /> {check.startTime} • {check.daysOfWeek.map(d => daysMap[d].substring(0,3)).join(', ')}</div>
                                </div>
                                <div className="flex gap-1"><button onClick={() => { setEditingCheck(check); setIsCheckModalOpen(true); }} className="md-icon-btn edit p-1"><PencilIcon /></button><button onClick={() => handleDeleteCheck(check.id)} className="md-icon-btn delete p-1"><TrashIcon /></button></div>
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
                                <p className="text-[10px] text-gray-500 mt-0.5">Stato Browser: {notifPermission}</p>
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
                    <h2 className="text-lg font-semibold border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>Template Comunicazioni</h2>
                    <div className="mt-4 space-y-3">
                        {templates.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                <div><p className="font-medium text-sm">{t.label}</p><p className="text-xs text-gray-500 truncate max-w-[200px]">{t.subject}</p></div>
                                <button onClick={() => handleOpenTemplateModal(t)} className="md-icon-btn edit"><PencilIcon /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {isSubModalOpen && <Modal onClose={() => setIsSubModalOpen(false)}><SubscriptionForm sub={editingSub} onSave={handleSaveSub} onCancel={() => setIsSubModalOpen(false)} /></Modal>}
        {isTemplateModalOpen && editingTemplate && <Modal onClose={() => setIsTemplateModalOpen(false)}><TemplateForm template={editingTemplate} onSave={handleSaveTemplate} onCancel={() => setIsTemplateModalOpen(false)} /></Modal>}
        {isCheckModalOpen && <Modal onClose={() => setIsCheckModalOpen(false)}><CheckForm check={editingCheck} onSave={handleSaveCheck} onCancel={() => setIsCheckModalOpen(false)} /></Modal>}
        <ConfirmModal isOpen={!!subToDelete} onClose={() => setSubToDelete(null)} onConfirm={handleConfirmDelete} title="Elimina Abbonamento" message="Sei sicuro?" isDangerous={true} />
    </div>
  );
};

export default Settings;
