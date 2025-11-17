
import React, { useState, useEffect, useCallback } from 'react';
import { CompanyInfo } from '../types';
import { getCompanyInfo, updateCompanyInfo } from '../services/settingsService';
import Spinner from '../components/Spinner';


const Settings: React.FC = () => {
    const [info, setInfo] = useState<CompanyInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInfo = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCompanyInfo();
            setInfo(data);
        } catch (err) {
            setError("Impossibile caricare le informazioni aziendali.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    const handleSave = async () => {
        if (info) {
            try {
                await updateCompanyInfo(info);
                alert("Impostazioni salvate con successo!");
            } catch (err) {
                console.error(err);
                alert("Errore nel salvataggio delle impostazioni.");
            }
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

    if (error || !info) {
        return <p className="text-center text-red-500 py-8">{error}</p>;
    }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800">Impostazioni</h1>
      <p className="mt-1 text-slate-500">Configura i dati aziendali, listini e integrazioni.</p>

      <div className="mt-8 max-w-2xl">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-slate-700 border-b pb-3">Dati Aziendali</h2>
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
                    <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors">Salva Modifiche</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
