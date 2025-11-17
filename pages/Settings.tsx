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
        if (sub?.id) {
            onSave({ ...subData, id: sub.id });
        } else {
            onSave(subData);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold mb-4">{sub ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Nome Pacchetto</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full input" placeholder="Es. Mensile"/>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Prezzo (€)</label>
                        <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className="mt-1 block w-full input"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">N. Lezioni</label>
                        <input type="number" value={lessons} onChange={e => setLessons(Number(e.target.value))} required min="1" className="mt-1 block w-full input"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Durata (giorni)</label>
                    <input type="number" value={durationInDays} onChange={e => setDurationInDays(Number(e.target.value))} required min="1" className="mt-1 block w-full input" placeholder="Es. 30 per un mese"/>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                <button type="submit" className="btn-primary">Salva</button>
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
            const [companyData, subsData] = await Promise.all([
                getCompanyInfo(),
                getSubscriptionTypes()
            ]);
            setInfo(companyData);
            setSubscriptions(subsData);
        } catch (err) {
            setError("Impossibile caricare le impostazioni.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleSaveInfo = async () => {
        if (info) {
            try {
                await updateCompanyInfo(info);
                alert("Dati aziendali salvati con successo!");
            } catch (err) {
                console.error(err);
                alert("Errore nel salvataggio dei dati aziendali.");
            }
        }
    };

    const handleOpenSubModal = (sub: SubscriptionType | null = null) => {
        setEditingSub(sub);
        setIsSubModalOpen(true);
    };

    const handleSaveSub = async (sub: SubscriptionTypeInput | SubscriptionType) => {
        if ('id' in sub) {
            await updateSubscriptionType(sub.id, sub);
        } else {
            await addSubscriptionType(sub);
        }
        setIsSubModalOpen(false);
        setEditingSub(null);
        fetchAllData();
    };
    
    const handleDeleteSub = async (id: string) => {
        if (window.confirm("Sei sicuro di voler eliminare questo pacchetto?")) {
            await deleteSubscriptionType(id);
            fetchAllData();
        }
    };


    if (loading) {
        return (
             <div>
                <h1 className="text-3xl font-bold text-slate-800">Impostazioni</h1>
                <p className="mt-1 text-slate-500">Configura i dati aziendali, listini e integrazioni.</p>
                <div className="mt-8 flex justify-center items-center h-64"><Spinner /></div>
            </div>
        );
    }

    if (error) {
        return <p className="text-center text-red-500 py-8">{error}</p>;
    }

  return (
    <div>
        <h1 className="text-3xl font-bold text-slate-800">Impostazioni</h1>
        <p className="mt-1 text-slate-500">Configura i dati aziendali, listini e integrazioni.</p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-slate-700 border-b pb-3">Dati Aziendali</h2>
                {info && (
                    <div className="mt-4 space-y-4 text-sm">
                        <div>
                            <label className="block text-slate-500">Ragione Sociale</label>
                            <input type="text" value={info.name} disabled className="w-full p-2 mt-1 bg-slate-100 border border-slate-200 rounded-md" />
                        </div>
                         <div>
                            <label className="block text-slate-500">P.IVA</label>
                            <input type="text" value={info.vatNumber} disabled className="w-full p-2 mt-1 bg-slate-100 border border-slate-200 rounded-md" />
                        </div>
                         <div>
                            <label className="block text-slate-500">Indirizzo</label>
                            <input type="text" value={info.address} disabled className="w-full p-2 mt-1 bg-slate-100 border border-slate-200 rounded-md" />
                        </div>
                         <div>
                            <label className="block text-slate-500">Email</label>
                            <input type="email" value={info.email} onChange={(e) => setInfo({...info, email: e.target.value})} className="w-full p-2 mt-1 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                         <div>
                            <label className="block text-slate-500">Telefono</label>
                            <input type="text" value={info.phone} onChange={(e) => setInfo({...info, phone: e.target.value})} className="w-full p-2 mt-1 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={handleSaveInfo} className="btn-primary">Salva Modifiche</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center border-b pb-3">
                    <h2 className="text-lg font-semibold text-slate-700">Listino Abbonamenti</h2>
                     <button onClick={() => handleOpenSubModal()} className="btn-primary-outline text-sm">
                        <PlusIcon/>
                        <span className="ml-1">Aggiungi</span>
                    </button>
                </div>
                 <div className="mt-4 space-y-3">
                    {subscriptions.map(sub => (
                        <div key={sub.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-md">
                            <div>
                                <p className="font-semibold">{sub.name}</p>
                                <p className="text-sm text-slate-500">{sub.lessons} lezioni / {sub.durationInDays} giorni - {sub.price}€</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => handleOpenSubModal(sub)} className="text-slate-500 hover:text-indigo-600"><PencilIcon/></button>
                                <button onClick={() => handleDeleteSub(sub.id)} className="text-red-500 hover:text-red-700"><TrashIcon/></button>
                            </div>
                        </div>
                    ))}
                    {subscriptions.length === 0 && <p className="text-sm text-center text-slate-400 py-6">Nessun pacchetto definito.</p>}
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