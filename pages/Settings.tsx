
import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput } from '../types';
import { getCompanyInfo, updateCompanyInfo, getSubscriptionTypes, addSubscriptionType, updateSubscriptionType, deleteSubscriptionType } from '../services/settingsService';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
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
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">{sub ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}</h2>
            <div className="space-y-4">
                <div className="md-input-group"><input id="subName" type="text" value={name} onChange={e => setName(e.target.value)} required className="md-input" placeholder=" " /><label htmlFor="subName" className="md-input-label">Nome Pacchetto</label></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group"><input id="subPrice" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className="md-input" placeholder=" " /><label htmlFor="subPrice" className="md-input-label">Prezzo (€)</label></div>
                    <div className="md-input-group"><input id="subLessons" type="number" value={lessons} onChange={e => setLessons(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subLessons" className="md-input-label">N. Lezioni</label></div>
                </div>
                <div className="md-input-group"><input id="subDuration" type="number" value={durationInDays} onChange={e => setDurationInDays(Number(e.target.value))} required min="1" className="md-input" placeholder=" " /><label htmlFor="subDuration" className="md-input-label">Durata (giorni)</label></div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
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
    const [error, setError] = useState<string | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<SubscriptionType | null>(null);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [companyData, subsData] = await Promise.all([getCompanyInfo(), getSubscriptionTypes()]);
            setInfo(companyData); setSubscriptions(subsData);
        } catch (err) {
            setError("Impossibile caricare le impostazioni."); console.error(err);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleSaveInfo = async () => {
        if (info) {
            try {
                await updateCompanyInfo(info); alert("Dati aziendali salvati con successo!");
            } catch (err) {
                console.error(err); alert("Errore nel salvataggio dei dati aziendali.");
            }
        }
    };

    const handleOpenSubModal = (sub: SubscriptionType | null = null) => { setEditingSub(sub); setIsSubModalOpen(true); };

    const handleSaveSub = async (sub: SubscriptionTypeInput | SubscriptionType) => {
        if ('id' in sub) { await updateSubscriptionType(sub.id, sub); } 
        else { await addSubscriptionType(sub); }
        setIsSubModalOpen(false); setEditingSub(null); fetchAllData();
    };
    
    const handleDeleteSub = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo pacchetto?")) {
            await deleteSubscriptionType(id); fetchAllData();
        }
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
            <div className="md-card p-6">
                <h2 className="text-lg font-semibold border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>Dati Aziendali</h2>
                {info && (
                    <div className="mt-4 space-y-4">
                        <div className="md-input-group"><input id="infoName" type="text" value={info.name} disabled className="md-input bg-gray-100" placeholder=" "/><label htmlFor="infoName" className="md-input-label">Ragione Sociale</label></div>
                        <div className="md-input-group"><input id="infoVat" type="text" value={info.vatNumber} disabled className="md-input bg-gray-100" placeholder=" "/><label htmlFor="infoVat" className="md-input-label">P.IVA</label></div>
                        <div className="md-input-group"><input id="infoAddr" type="text" value={info.address} disabled className="md-input bg-gray-100" placeholder=" "/><label htmlFor="infoAddr" className="md-input-label">Indirizzo</label></div>
                        <div className="md-input-group"><input id="infoEmail" type="email" value={info.email} onChange={(e) => setInfo({...info, email: e.target.value})} className="md-input" placeholder=" "/><label htmlFor="infoEmail" className="md-input-label">Email</label></div>
                        <div className="md-input-group"><input id="infoPhone" type="text" value={info.phone} onChange={(e) => setInfo({...info, phone: e.target.value})} className="md-input" placeholder=" "/><label htmlFor="infoPhone" className="md-input-label">Telefono</label></div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={handleSaveInfo} className="md-btn md-btn-raised md-btn-green">Salva Modifiche</button>
                        </div>
                    </div>
                )}
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
                                <button onClick={() => handleDeleteSub(sub.id)} className="md-icon-btn delete" aria-label={`Elimina pacchetto ${sub.name}`}><TrashIcon/></button>
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

    </div>
  );
};

export default Settings;