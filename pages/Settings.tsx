
import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput } from '../types';
import { getCompanyInfo, updateCompanyInfo, getSubscriptionTypes, addSubscriptionType, updateSubscriptionType, deleteSubscriptionType } from '../services/settingsService';
import { applyTheme, getSavedTheme } from '../utils/theme';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';


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
            <h2 className="text-xl font-bold mb-4 flex-shrink-0">{sub ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="md-input-group"><input id="subName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="subName" className="md-input-label">Nome Pacchetto</label></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="subPrice" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className="md-input" placeholder=" " /><label htmlFor="subPrice" className="md-input-label">Prezzo (€)</label></div>
                    <div className="md-input-group"><input id="subLessons" type="number" value={lessons} onChange={e => setLessons(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subLessons" className="md-input-label">N. Lezioni</label></div>
                </div>
                <div className="md-input-group"><input id="subDuration" type="number" value={durationInDays} onChange={e => setDurationInDays(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subDuration" className="md-input-label">Durata (giorni)</label></div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-green">Salva</button>
            </div>
        </form>
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

                    <div className="mt-6 p-4 rounded border border-gray-200" style={{backgroundColor: bgColor}}>
                        <p className="text-xs text-gray-500 mb-2">Anteprima Sfondo</p>
                        <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                             <h4 className="font-bold mb-2" style={{color: primaryColor}}>Titolo Esempio</h4>
                             <button className="text-xs text-white px-3 py-1 rounded" style={{backgroundColor: primaryColor}}>Pulsante</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Colonna Destra */}
            <div className="md-card p-6 h-fit">
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

        {isSubModalOpen && (
            <Modal onClose={() => setIsSubModalOpen(false)}>
                <SubscriptionForm sub={editingSub} onSave={handleSaveSub} onCancel={() => setIsSubModalOpen(false)}/>
            </Modal>
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
