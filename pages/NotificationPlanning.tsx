
import React, { useEffect, useState } from 'react';
import { NotificationRule, NotificationType } from '../types';
import { getNotificationRules, saveNotificationRule, deleteNotificationRule } from '../services/settingsService';
import Spinner from '../components/Spinner';
import BellIcon from '../components/icons/BellIcon';
import ClockIcon from '../components/icons/ClockIcon';
import ExclamationIcon from '../components/icons/ExclamationIcon';
import ChecklistIcon from '../components/icons/ChecklistIcon';
import EuroCoinIcon from '../components/icons/EuroCoinIcon';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

// Mappa Icone per Tipo
const getIconForType = (type: string, isCustom?: boolean) => {
    if (isCustom) return <span className="text-teal-500"><BellIcon /></span>;
    switch (type) {
        case 'payment_required': return <span className="text-red-500"><ExclamationIcon /></span>;
        case 'expiry': return <span className="text-amber-500"><ClockIcon /></span>;
        case 'balance_due': return <span className="text-orange-500"><EuroCoinIcon /></span>;
        case 'low_lessons': return <span className="text-indigo-500"><ChecklistIcon /></span>;
        case 'institutional_billing': return <span className="text-blue-500"><BellIcon /></span>; 
        default: return <BellIcon />;
    }
};

// Configurazione Settimana Italiana (Lunedì -> Domenica)
// Il valore numerico corrisponde allo standard JS/Cloud Functions (0=Dom, 1=Lun...)
const weekDaysConfig = [
    { label: 'L', value: 1 },
    { label: 'M', value: 2 },
    { label: 'M', value: 3 },
    { label: 'G', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
    { label: 'D', value: 0 },
];

// --- Componente Form per Nuova Regola ---
const RuleForm: React.FC<{ 
    rule?: NotificationRule | null;
    onSave: (rule: NotificationRule) => void;
    onCancel: () => void;
}> = ({ rule, onSave, onCancel }) => {
    const [label, setLabel] = useState(rule?.label || '');
    const [description, setDescription] = useState(rule?.description || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newRule: NotificationRule = {
            id: rule?.id || `custom_${Date.now()}`,
            label,
            description,
            enabled: rule ? rule.enabled : true,
            days: rule ? rule.days : [],
            time: rule ? rule.time : '09:00',
            pushEnabled: rule ? rule.pushEnabled : false,
            isCustom: true
        };
        onSave(newRule);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{rule ? 'Modifica Avviso Personalizzato' : 'Nuovo Avviso Personalizzato'}</h3>
            </div>
            <div className="flex-1 p-6 space-y-4">
                <div className="md-input-group">
                    <input 
                        type="text" 
                        value={label} 
                        onChange={e => setLabel(e.target.value)} 
                        className="md-input" 
                        required 
                        placeholder=" " 
                    />
                    <label className="md-input-label">Titolo Avviso (es. Controllo Estintori)</label>
                </div>
                <div className="md-input-group">
                    <textarea 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        className="md-input" 
                        rows={3} 
                        required 
                        placeholder="Descrizione..." 
                    />
                    <label className="md-input-label">Messaggio Notifica</label>
                </div>
                <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-700">
                    <strong>Nota:</strong> Questo avviso verrà inviato come promemoria (testo statico) nei giorni e orari che configurerai nella card.
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 flex-shrink-0">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button>
            </div>
        </form>
    );
};

const NotificationPlanning: React.FC = () => {
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await getNotificationRules();
            setRules(data);
        } catch (e) {
            console.error("Failed to load rules", e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleEnable = async (rule: NotificationRule) => {
        const updated = { ...rule, enabled: !rule.enabled };
        await updateRule(updated);
    };

    const handleTogglePush = async (rule: NotificationRule) => {
        const updated = { ...rule, pushEnabled: !rule.pushEnabled };
        await updateRule(updated);
    };

    const handleTimeChange = async (rule: NotificationRule, newTime: string) => {
        const updated = { ...rule, time: newTime };
        await updateRule(updated);
    };

    const handleDayToggle = async (rule: NotificationRule, dayIndex: number) => {
        const newDays = rule.days.includes(dayIndex)
            ? rule.days.filter(d => d !== dayIndex)
            : [...rule.days, dayIndex].sort();
        const updated = { ...rule, days: newDays };
        await updateRule(updated);
    };

    const updateRule = async (rule: NotificationRule) => {
        setSavingId(rule.id);
        setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
        try {
            await saveNotificationRule(rule);
        } catch (e) {
            console.error("Error saving rule", e);
        } finally {
            setSavingId(null);
        }
    };

    // --- Custom Rule Handlers ---
    const handleSaveCustomRule = async (rule: NotificationRule) => {
        setIsModalOpen(false);
        setLoading(true);
        try {
            await saveNotificationRule(rule);
            await loadRules();
        } catch (e) {
            console.error(e);
            alert("Errore salvataggio");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async () => {
        if (!deleteId) return;
        setLoading(true);
        try {
            await deleteNotificationRule(deleteId);
            await loadRules();
        } catch (e) {
            alert("Errore eliminazione");
        } finally {
            setLoading(false);
            setDeleteId(null);
        }
    };

    return (
        <div className="pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><BellIcon /></span>
                        Pianificazione Avvisi
                    </h1>
                    <p className="mt-2 text-gray-500">Configura la tua routine di controllo automatica.</p>
                </div>
                <button 
                    onClick={() => { setEditingRule(null); setIsModalOpen(true); }} 
                    className="md-btn md-btn-raised md-btn-green flex items-center gap-2"
                >
                    <PlusIcon /> Nuovo Avviso
                </button>
            </div>

            {loading ? <div className="flex justify-center py-20"><Spinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {rules.map(rule => (
                        <div key={rule.id} className={`md-card p-6 border-l-4 transition-all ${rule.enabled ? (rule.isCustom ? 'border-teal-500 shadow-lg' : 'border-indigo-500 shadow-lg') : 'border-gray-300 opacity-80 grayscale'}`}>
                            
                            {/* HEADER CARD */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${rule.enabled ? (rule.isCustom ? 'bg-teal-50' : 'bg-indigo-50') : 'bg-gray-100'}`}>
                                        {getIconForType(rule.id, rule.isCustom)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{rule.label}</h3>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={rule.description}>{rule.description}</p>
                                    </div>
                                </div>
                                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name={`toggle-${rule.id}`} 
                                        id={`toggle-${rule.id}`} 
                                        checked={rule.enabled} 
                                        onChange={() => handleToggleEnable(rule)} 
                                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-5"
                                        style={{ top: '2px', left: '2px' }}
                                    />
                                    <label htmlFor={`toggle-${rule.id}`} className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ${rule.enabled ? (rule.isCustom ? 'bg-teal-500' : 'bg-indigo-500') : 'bg-gray-300'}`}></label>
                                </div>
                            </div>

                            {/* CONTROLS (Solo se attivo) */}
                            {rule.enabled && (
                                <div className="space-y-6 animate-slide-up">
                                    {/* Day Selector - UPDATED to use weekDaysConfig */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Giorni Attivi</label>
                                        <div className="flex justify-between gap-1">
                                            {weekDaysConfig.map((dayConfig) => {
                                                const isActive = rule.days.includes(dayConfig.value);
                                                return (
                                                    <button
                                                        key={dayConfig.value}
                                                        onClick={() => handleDayToggle(rule, dayConfig.value)}
                                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isActive ? (rule.isCustom ? 'bg-teal-600 text-white shadow-md scale-110' : 'bg-indigo-600 text-white shadow-md scale-110') : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                    >
                                                        {dayConfig.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Time & Push */}
                                    <div className="flex items-end justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Orario Report</label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="time" 
                                                    value={rule.time} 
                                                    onChange={(e) => handleTimeChange(rule, e.target.value)}
                                                    className="bg-transparent font-black text-xl text-gray-800 outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors w-full max-w-[120px]"
                                                />
                                                <ClockIcon />
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col items-end">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <span className={`text-xs font-bold transition-colors ${rule.pushEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>Push Notif.</span>
                                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${rule.pushEnabled ? (rule.isCustom ? 'bg-teal-600 border-teal-600' : 'bg-indigo-600 border-indigo-600') : 'border-gray-300 bg-white'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={rule.pushEnabled} 
                                                        onChange={() => handleTogglePush(rule)} 
                                                        className="hidden" 
                                                    />
                                                    {rule.pushEnabled && <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons for Custom Rules */}
                                    {rule.isCustom && (
                                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                            <button onClick={() => { setEditingRule(rule); setIsModalOpen(true); }} className="md-icon-btn edit p-1.5"><PencilIcon /></button>
                                            <button onClick={() => setDeleteId(rule.id)} className="md-icon-btn delete p-1.5"><TrashIcon /></button>
                                        </div>
                                    )}

                                    {savingId === rule.id && (
                                        <p className="text-[10px] text-indigo-400 text-center animate-pulse">Salvataggio...</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            <style>{`
                .toggle-checkbox:checked {
                    right: 0;
                    border-color: #68D391;
                }
                .toggle-checkbox:checked + .toggle-label {
                    background-color: #68D391;
                }
            `}</style>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} size="md">
                    <RuleForm 
                        rule={editingRule} 
                        onSave={handleSaveCustomRule} 
                        onCancel={() => setIsModalOpen(false)} 
                    />
                </Modal>
            )}

            <ConfirmModal 
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDeleteRule}
                title="Elimina Avviso"
                message="Sei sicuro di voler eliminare questo avviso personalizzato?"
                isDangerous={true}
            />
        </div>
    );
};

export default NotificationPlanning;
