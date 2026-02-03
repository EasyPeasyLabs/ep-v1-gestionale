
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FocusConfig } from '../types';
import { getUserPreferences, saveUserFocusConfig } from '../services/profileService';
import { auth } from '../firebase/config';
import Spinner from './Spinner';

interface FocusModeConfigModalProps {
    onClose: () => void;
    onSave: (config: FocusConfig) => void;
}

const DEFAULT_CONFIG: FocusConfig = {
    enabled: false,
    days: [1, 3, 5], // Lun, Mer, Ven default
    time: '09:00'
};

const FocusModeConfigModal: React.FC<FocusModeConfigModalProps> = ({ onClose, onSave }) => {
    const [config, setConfig] = useState<FocusConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const prefs = await getUserPreferences(user.uid);
                    if (prefs.focusConfig) {
                        setConfig(prefs.focusConfig);
                    }
                } catch (e) {
                    console.error("Error loading focus config", e);
                }
            }
            setLoading(false);
        };
        loadConfig();
    }, []);

    const toggleDay = (dayIndex: number) => {
        setConfig(prev => ({
            ...prev,
            days: prev.days.includes(dayIndex) 
                ? prev.days.filter(d => d !== dayIndex)
                : [...prev.days, dayIndex]
        }));
    };

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user) return;

        setSaving(true);
        try {
            await saveUserFocusConfig(user.uid, config);
            onSave(config);
            onClose();
        } catch (e) {
            alert("Errore durante il salvataggio delle preferenze.");
        } finally {
            setSaving(false);
        }
    };

    const daysMap = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    return (
        <Modal onClose={onClose} size="md">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Pianificazione Focus</h3>
                        <p className="text-sm text-slate-500">Imposta la tua routine di controllo avvisi.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {loading ? <Spinner /> : (
                            <>
                                <label className="text-xs font-bold text-slate-500 uppercase">Stato:</label>
                                <button 
                                    onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="py-10 flex justify-center"><Spinner /></div>
                ) : (
                    <div className={`space-y-6 transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        
                        {/* Days Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Giorni Attivi</label>
                            <div className="flex justify-between gap-1">
                                {daysMap.map((day, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => toggleDay(idx)}
                                        className={`
                                            w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                            ${config.days.includes(idx) 
                                                ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                            }
                                        `}
                                    >
                                        {day.substring(0, 1)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 text-center">
                                Seleziona i giorni in cui vuoi vedere il briefing mattutino.
                            </p>
                        </div>

                        {/* Time Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Orario di Attivazione</label>
                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <input 
                                    type="time" 
                                    value={config.time} 
                                    onChange={(e) => setConfig(prev => ({ ...prev, time: e.target.value }))}
                                    className="text-xl font-bold bg-transparent border-none outline-none text-slate-800"
                                />
                                <div className="h-8 w-px bg-slate-200"></div>
                                <p className="text-xs text-slate-500 leading-tight">
                                    Il pop-up apparirà al primo accesso dopo questo orario nei giorni selezionati.
                                </p>
                            </div>
                        </div>

                    </div>
                )}

                <div className="mt-8 flex justify-end gap-2">
                    <button onClick={onClose} className="md-btn md-btn-flat">Annulla</button>
                    <button onClick={handleSave} disabled={loading || saving} className="md-btn md-btn-raised md-btn-primary">
                        {saving ? 'Salvataggio...' : 'Salva Programmazione'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default FocusModeConfigModal;
