
import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, PeriodicCheck, PeriodicCheckInput, CheckCategory, AppointmentType } from '../types';
import { getCompanyInfo, updateCompanyInfo, getSubscriptionTypes, addSubscriptionType, updateSubscriptionType, deleteSubscriptionType, getPeriodicChecks, addPeriodicCheck, updatePeriodicCheck, deletePeriodicCheck } from '../services/settingsService';
import { applyTheme, getSavedTheme } from '../utils/theme';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon';
import ClockIcon from '../components/icons/ClockIcon';
import BellIcon from '../components/icons/BellIcon';


const SubscriptionForm: React.FC<{
    sub?: SubscriptionType | null;
    onSave: (sub: SubscriptionTypeInput | SubscriptionType) => void;
    onCancel: () => void;
}> = ({ sub, onSave, onCancel }) => {
    const [name, setName] = useState(sub?.name || '');
    const [price, setPrice] = useState(sub?.price || 0);
    const [lessons, setLessons] = useState(sub?.lessons || 0);
    const [durationInDays, setDurationInDays] = useState(sub?.durationInDays || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subData = { name, price: Number(price), lessons: Number(lessons), durationInDays: Number(durationInDays) };
        if (sub?.id) { onSave({ ...subData, id: sub.id }); } 
        else { onSave(subData); }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{sub ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}</h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div className="md-input-group"><input id="subName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="subName" className="md-input-label">Nome Pacchetto</label></div>
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

const PeriodicCheckForm: React.FC<{
    check?: PeriodicCheck | null;
    onSave: (check: PeriodicCheckInput | PeriodicCheck) => void;
    onCancel: () => void;
}> = ({ check, onSave, onCancel }) => {
    const [category, setCategory] = useState<CheckCategory>(check?.category || CheckCategory.Payments);
    const [subCategory, setSubCategory] = useState<AppointmentType | ''>(check?.subCategory || '');
    const [selectedDays, setSelectedDays] = useState<number[]>(check?.daysOfWeek || []);
    const [startTime, setStartTime] = useState(check?.startTime || '09:00');
    const [endTime, setEndTime] = useState(check?.endTime || '10:00');
    const [pushEnabled, setPushEnabled] = useState(check?.pushEnabled || false);
    const [note, setNote] = useState(check?.note || '');

    const daysMap = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => 
            prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedDays.length === 0) {
            alert("Seleziona almeno un giorno della settimana.");
            return;
        }

        // Request notification permission if enabling push
        if (pushEnabled && Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert("Attenzione: Non hai concesso i permessi per le notifiche al browser. Le notifiche push non funzioneranno.");
            }
        }

        const checkData: PeriodicCheckInput = {
            category,
            subCategory: category === CheckCategory.Appointments ? (subCategory as AppointmentType) : undefined,
            daysOfWeek: selectedDays.sort(),
            startTime,
            endTime,
            pushEnabled,
            note
        };

        if (check?.id) { onSave({ ...checkData, id: check.id }); }
        else { onSave(checkData); }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 pb-2 flex-shrink-0 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{check ? 'Modifica Verifica' : 'Nuova Verifica Periodica'}</h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                
                {/* Category Selection */}
                <div className="md-input-group">
                    <select 
                        id="checkCat" 
                        value={category} 
                        onChange={e => {
                            setCategory(e.target.value as CheckCategory);
                            if (e.target.value !== CheckCategory.Appointments) setSubCategory('');
                            else setSubCategory(AppointmentType.Generic);
                        }} 
                        className="md-input"
                    >
                        {Object.values(CheckCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label htmlFor="checkCat" className="md-input-label !top-0 !text-xs !text-gray-500">Categoria Controllo</label>
                </div>

                {/* SubCategory for Appointments */}
                {category === CheckCategory.Appointments && (
                    <div className="md-input-group animate-fade-in">
                        <select id="subCat" value={subCategory} onChange={e => setSubCategory(e.target.value as AppointmentType)} className="md-input">
                            {Object.values(AppointmentType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <label htmlFor="subCat" className="md-input-label !top-0 !text-xs !text-gray-500">Tipo Appuntamento</label>
                    </div>
                )}

                {/* Days Selection */}
                <div>
                    <label className="block text-xs text-gray-500 mb-2">Giorni della settimana (Ripetizione)</label>
                    <div className="flex flex-wrap gap-2">
                        {daysMap.map((label, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => toggleDay(idx)}
                                className={`w-10 h-10 rounded-full text-xs font-bold transition-colors flex items-center justify-center border ${selectedDays.includes(idx) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="chkStart" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="md-input"/><label htmlFor="chkStart" className="md-input-label !top-0 !text-xs !text-gray-500">Dalle</label></div>
                    <div className="md-input-group"><input id="chkEnd" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="md-input"/><label htmlFor="chkEnd" className="md-input-label !top-0 !text-xs !text-gray-500">Alle</label></div>
                </div>

                {/* Push Notification Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center">
                        <BellIcon />
                        <div className="ml-3">
                            <span className="block text-sm font-medium text-gray-900">Notifiche Push</span>
                            <span className="block text-xs text-gray-500">Ricevi avviso su mobile anche se l'app è chiusa.</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                <div className="md-input-group">
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} className="md-input" placeholder=" " />
                    <label className="md-input-label">Note / Dettagli (Opzionale)</label>
                </div>

            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat md-btn-sm">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green md-btn-sm">Salva</button>
            </div>
        </form>
    );
};

const PeriodicChecksModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [checks, setChecks] = useState<PeriodicCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCheck, setEditingCheck] = useState<PeriodicCheck | null>(null);

    const fetchChecks = async () => {
        setLoading(true);
        const data = await getPeriodicChecks();
        setChecks(data);
        setLoading(false);
    };

    useEffect(() => { fetchChecks(); }, []);

    const handleSave = async (check: PeriodicCheckInput | PeriodicCheck) => {
        if ('id' in check) await updatePeriodicCheck(check.id, check);
        else await addPeriodicCheck(check);
        setIsFormOpen(false);
        setEditingCheck(null);
        fetchChecks();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Eliminare questa regola?")) {
            await deletePeriodicCheck(id);
            fetchChecks();
        }
    };

    const daysMapShort = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    return (
        <Modal onClose={onClose} size="xl">
            {isFormOpen ? (
                <PeriodicCheckForm check={editingCheck} onSave={handleSave} onCancel={() => { setIsFormOpen(false); setEditingCheck(null); }} />
            ) : (
                <div className="flex flex-col h-full max-h-[90vh]">
                    <div className="p-6 pb-4 border-b flex justify-between items-center flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold">Planner Verifiche Periodiche</h2>
                            <p className="text-sm text-gray-500">Pianifica i controlli ricorrenti e le notifiche.</p>
                        </div>
                        <button onClick={() => setIsFormOpen(true)} className="md-btn md-btn-raised md-btn-primary md-btn-sm">
                            <PlusIcon /> <span className="ml-2">Aggiungi Verifica</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                        {loading ? <Spinner /> : checks.length === 0 ? (
                            <p className="text-center text-gray-400 italic py-10">Nessuna verifica pianificata.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {checks.map(check => (
                                    <div key={check.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between relative group">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-2 inline-block">
                                                    {check.category}
                                                </span>
                                                {check.pushEnabled && <span className="text-gray-400" title="Notifiche Attive"><BellIcon /></span>}
                                            </div>
                                            <h3 className="font-bold text-gray-800 mb-1">
                                                {check.subCategory ? `${check.subCategory}` : check.category}
                                            </h3>
                                            <div className="text-sm text-gray-600 flex items-center gap-2 mb-2">
                                                <ClockIcon /> {check.startTime} - {check.endTime}
                                            </div>
                                            <div className="flex gap-1 flex-wrap mb-2">
                                                {check.daysOfWeek.sort().map(d => (
                                                    <span key={d} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                        {daysMapShort[d]}
                                                    </span>
                                                ))}
                                            </div>
                                            {check.note && <p className="text-xs text-gray-500 italic mt-2">"{check.note}"</p>}
                                        </div>
                                        
                                        <div className="mt-4 pt-3 border-t flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingCheck(check); setIsFormOpen(true); }} className="md-icon-btn edit"><PencilIcon /></button>
                                            <button onClick={() => handleDelete(check.id)} className="md-icon-btn delete"><TrashIcon /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-white flex justify-end flex-shrink-0">
                        <button onClick={onClose} className="md-btn md-btn-flat">Chiudi</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};


const Settings: React.FC = () => {
    const [info, setInfo] = useState<CompanyInfo | null>(null);
    const [subscriptions, setSubscriptions] = useState<SubscriptionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<SubscriptionType | null>(null);
    const [subToDelete, setSubToDelete] = useState<string | null>(null);
    
    // Theme state
    const [primaryColor, setPrimaryColor] = useState('#3F51B5');
    const [bgColor, setBgColor] = useState('#f5f5f5');

    // Checks Modal
    const [isChecksModalOpen, setIsChecksModalOpen] = useState(false);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [companyData, subsData] = await Promise.all([getCompanyInfo(), getSubscriptionTypes()]);
            setInfo(companyData); setSubscriptions(subsData);
            
            const savedTheme = getSavedTheme();
            setPrimaryColor(savedTheme.primary);
            setBgColor(savedTheme.bg);

        } catch (err) {
            setError("Impossibile caricare le impostazioni."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleSaveInfo = async () => {
        if (info) {
            try {
                setIsSaving(true);
                await updateCompanyInfo(info); 
                alert("Dati aziendali salvati con successo!");
            } catch (err) {
                console.error(err);
                alert("Errore durante il salvataggio.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleInfoChange = (field: keyof CompanyInfo, value: string) => {
        setInfo(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleOpenSubModal = (sub: SubscriptionType | null = null) => { setEditingSub(sub); setIsSubModalOpen(true); };

    const handleSaveSub = async (sub: SubscriptionTypeInput | SubscriptionType) => {
        if ('id' in sub) { await updateSubscriptionType(sub.id, sub); } 
        else { await addSubscriptionType(sub); }
        setIsSubModalOpen(false); setEditingSub(null); fetchAllData();
    };
    
    const handleDeleteClick = (id: string) => {
        setSubToDelete(id);
    }

    const handleConfirmDelete = async () => {
        if(subToDelete) {
            await deleteSubscriptionType(subToDelete);
            fetchAllData();
            setSubToDelete(null);
        }
    };

    const handleColorChange = (newPrimary: string, newBg: string) => {
        setPrimaryColor(newPrimary);
        setBgColor(newBg);
        applyTheme(newPrimary, newBg);
    };

    const handleResetTheme = () => {
        const defPrimary = '#3F51B5';
        const defBg = '#f5f5f5';
        handleColorChange(defPrimary, defBg);
    };

    if (loading) {
        return (
             <div>
                <h1 className="text-3xl font-bold">Impostazioni</h1>
                <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Configura i dati aziendali, listini e integrazioni.</p>
                <div className="mt-8 flex justify-center items-center h-64"><Spinner /></div>
            </div>
        );
    }
    if (error) { return <p className="text-center text-red-500 py-8">{error}</p>; }

  return (
    <div>
        <h1 className="text-3xl font-bold">Impostazioni</h1>
        <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Configura i dati aziendali, listini e integrazioni.</p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonna Sinistra */}
            <div className="space-y-8">
                <div className="md-card p-6">
                    <h2 className="text-lg font-semibold border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>Dati Aziendali</h2>
                    {info && (
                        <div className="mt-4 space-y-4">
                            <div className="md-input-group"><input id="infoDenom" type="text" value={info.denomination || ''} onChange={(e) => handleInfoChange('denomination', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoDenom" className="md-input-label">Denominazione</label></div>
                            <div className="md-input-group"><input id="infoName" type="text" value={info.name || ''} onChange={(e) => handleInfoChange('name', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoName" className="md-input-label">Ragione Sociale</label></div>
                            <div className="md-input-group"><input id="infoVat" type="text" value={info.vatNumber || ''} onChange={(e) => handleInfoChange('vatNumber', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoVat" className="md-input-label">P.IVA</label></div>
                            <div className="md-input-group"><input id="infoAddr" type="text" value={info.address || ''} onChange={(e) => handleInfoChange('address', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoAddr" className="md-input-label">Indirizzo</label></div>
                            <div className="md-input-group"><input id="infoEmail" type="email" value={info.email || ''} onChange={(e) => handleInfoChange('email', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoEmail" className="md-input-label">Email</label></div>
                            <div className="md-input-group"><input id="infoPhone" type="text" value={info.phone || ''} onChange={(e) => handleInfoChange('phone', e.target.value)} className="md-input" placeholder=" "/><label htmlFor="infoPhone" className="md-input-label">Telefono</label></div>
                            <div className="pt-4 flex justify-end">
                                <button onClick={handleSaveInfo} disabled={isSaving} className="md-btn md-btn-raised md-btn-green">
                                    {isSaving ? <Spinner /> : 'Salva Modifiche'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Card Personalizzazione Tema */}
                <div className="md-card p-6">
                    <div className="flex justify-between items-center border-b pb-3 mb-4" style={{borderColor: 'var(--md-divider)'}}>
                         <h2 className="text-lg font-semibold">Personalizzazione Interfaccia</h2>
                         <button onClick={handleResetTheme} className="text-xs text-indigo-600 hover:underline">Ripristina Default</button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Seleziona i colori per personalizzare l'aspetto dell'applicazione.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Colore Primario</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={primaryColor} 
                                    onChange={(e) => handleColorChange(e.target.value, bgColor)}
                                    className="h-10 w-16 cursor-pointer border border-gray-300 rounded p-1"
                                />
                                <span className="text-xs text-gray-500 uppercase">{primaryColor}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Colore di intestazioni, pulsanti principali e icone attive.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Colore Sfondo</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={bgColor} 
                                    onChange={(e) => handleColorChange(primaryColor, e.target.value)}
                                    className="h-10 w-16 cursor-pointer border border-gray-300 rounded p-1"
                                />
                                <span className="text-xs text-gray-500 uppercase">{bgColor}</span>
                            </div>
                             <p className="text-xs text-gray-400 mt-1">Colore di sfondo generale delle pagine.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Colonna Destra */}
            <div className="space-y-8">
                {/* Pianificazione & Controllo (NEW) */}
                <div className="md-card p-6 bg-indigo-50 border border-indigo-100">
                    <div className="flex justify-between items-center border-b border-indigo-200 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <ChecklistIcon />
                            <h2 className="text-lg font-semibold text-indigo-900">Pianificazione & Controllo</h2>
                        </div>
                    </div>
                    <p className="text-sm text-indigo-800 mb-6">
                        Gestisci scadenze, controlli ricorrenti e appuntamenti importanti per la tua attività.
                    </p>
                    <button 
                        onClick={() => setIsChecksModalOpen(true)}
                        className="w-full md-btn md-btn-raised md-btn-primary flex items-center justify-center"
                    >
                        <span className="mr-2"><ClockIcon /></span> Gestisci Verifiche Periodiche
                    </button>
                </div>

                <div className="md-card p-6">
                    <div className="flex justify-between items-center border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>
                        <h2 className="text-lg font-semibold">Listino Abbonamenti</h2>
                        <button onClick={() => handleOpenSubModal()} className="md-btn md-btn-flat md-btn-primary text-sm">
                            <PlusIcon/><span className="ml-1">Aggiungi</span>
                        </button>
                    </div>
                    <div className="mt-4 space-y-3">
                        {subscriptions.map(sub => (
                            <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                                <div>
                                    <p className="font-semibold">{sub.name}</p>
                                    <p className="text-sm" style={{color: 'var(--md-text-secondary)'}}>{sub.lessons} lezioni / {sub.durationInDays} giorni - {sub.price}€</p>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button onClick={() => handleOpenSubModal(sub)} className="md-icon-btn edit" aria-label={`Modifica pacchetto ${sub.name}`}><PencilIcon/></button>
                                    <button onClick={() => handleDeleteClick(sub.id)} className="md-icon-btn delete" aria-label={`Elimina pacchetto ${sub.name}`}><TrashIcon/></button>
                                </div>
                            </div>
                        ))}
                        {subscriptions.length === 0 && <p className="text-sm text-center py-6" style={{color: 'var(--md-text-secondary)'}}>Nessun pacchetto definito.</p>}
                    </div>
                </div>
            </div>
        </div>

        {isSubModalOpen && (
            <Modal onClose={() => setIsSubModalOpen(false)}>
                <SubscriptionForm sub={editingSub} onSave={handleSaveSub} onCancel={() => setIsSubModalOpen(false)}/>
            </Modal>
        )}

        {isChecksModalOpen && (
            <PeriodicChecksModal onClose={() => setIsChecksModalOpen(false)} />
        )}

        <ConfirmModal 
            isOpen={!!subToDelete}
            onClose={() => setSubToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Elimina Pacchetto"
            message="Sei sicuro di voler eliminare questo pacchetto abbonamento?"
            isDangerous={true}
        />

    </div>
  );
};

export default Settings;
