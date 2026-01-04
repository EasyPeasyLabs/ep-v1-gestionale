
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Supplier } from '../../types';
import ChevronDownIcon from '../icons/ChevronDownIcon';

// --- Mappatura Gerarchica ---
const CATEGORY_HIERARCHY = {
    "A. LOGISTICA": {
        "Costi Amministrativi": [
            TransactionCategory.RCA,
            TransactionCategory.BolloAuto
        ],
        "Costi Operativi": [
            TransactionCategory.ManutenzioneAuto,
            TransactionCategory.ConsumoAuto,
            TransactionCategory.Carburante,
            TransactionCategory.Parcheggio,
            TransactionCategory.Sanzioni,
            TransactionCategory.BigliettoViaggio
        ]
    },
    "B. GENERALI": {
        "Costi Amministrativi": [
            TransactionCategory.Consulenze,
            TransactionCategory.Tasse,
            TransactionCategory.SpeseBancarie
        ],
        "Costi Operativi": [
            TransactionCategory.InternetTelefonia, // Unificato
            TransactionCategory.Software,
            TransactionCategory.HardwareGenerale,
            TransactionCategory.Formazione // Nuovo
        ],
        "Ricavi Operativi": [
            TransactionCategory.Vendite,
            TransactionCategory.Capitale
        ]
    },
    "C. OPERAZIONI": {
        "Costi Sedi": [
            TransactionCategory.Nolo,
            TransactionCategory.QuoteAssociative,
            TransactionCategory.AttrezzatureSede,
            TransactionCategory.IgieneSicurezza
        ],
        "Costi Corsi": [
            TransactionCategory.Materiali,
            TransactionCategory.Libri,
            TransactionCategory.HardwareSoftwareCorsi
        ],
        "Costi Marketing": [
            TransactionCategory.Stampa,
            TransactionCategory.Social
        ]
    },
    "ALTRO": {
        "Generico": [TransactionCategory.Altro]
    }
};

// --- Colori per Macro Categorie (Design System Updated) ---
const MACRO_STYLES: Record<string, { container: string, titleColor: string, pillSelected: string }> = {
    "A. LOGISTICA": { 
        // Ambra (60% bg approx)
        container: "bg-amber-200/60 border-amber-200", 
        titleColor: "text-amber-800", 
        pillSelected: "bg-amber-700 text-white border-amber-800 shadow-md ring-2 ring-amber-200"
    },
    "B. GENERALI": { 
        // Ciano (60% bg approx)
        container: "bg-cyan-200/60 border-cyan-200", 
        titleColor: "text-cyan-800", 
        pillSelected: "bg-cyan-700 text-white border-cyan-800 shadow-md ring-2 ring-cyan-200"
    },
    "C. OPERAZIONI": { 
        // Smeraldo (60% bg approx)
        container: "bg-emerald-200/60 border-emerald-200", 
        titleColor: "text-emerald-800", 
        pillSelected: "bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-200"
    },
    "ALTRO": { 
        // Grigio (60% bg approx)
        container: "bg-gray-200/60 border-gray-200", 
        titleColor: "text-gray-800", 
        pillSelected: "bg-gray-700 text-white border-gray-800 shadow-md ring-2 ring-gray-200"
    }
};

const TransactionForm: React.FC<{
    transaction?: Transaction | null;
    suppliers: Supplier[];
    onSave: (t: TransactionInput | Transaction) => void;
    onCancel: () => void;
}> = ({ transaction, suppliers, onSave, onCancel }) => {
    const [date, setDate] = useState(transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState(transaction?.description || '');
    const [amount, setAmount] = useState(transaction?.amount || 0);
    const [type, setType] = useState<TransactionType>(transaction?.type || TransactionType.Expense);
    const [category, setCategory] = useState<TransactionCategory>(transaction?.category || TransactionCategory.Materiali);
    const [allocationId, setAllocationId] = useState(transaction?.allocationId || '');
    
    // UI State per il selettore categorie
    const [isCategorySelectorOpen, setIsCategorySelectorOpen] = useState(false);

    const allLocations = useMemo(() => {
        const locs: {id: string, name: string}[] = [];
        suppliers.forEach(s => s.locations.forEach(l => locs.push({id: l.id, name: l.name})));
        return locs.sort((a,b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const locName = allLocations.find(l => l.id === allocationId)?.name;
        
        const data: TransactionInput = {
            date: new Date(date).toISOString(),
            description,
            amount: Number(amount),
            type,
            category,
            paymentMethod: PaymentMethod.Other,
            status: TransactionStatus.Completed,
            allocationType: allocationId ? 'location' : 'general',
            allocationId: (allocationId || null) as any,
            allocationName: (locName || null) as any,
            isDeleted: false
        };

        if (transaction?.id) onSave({ ...data, id: transaction.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{transaction ? 'Modifica Voce' : 'Nuova Voce'}</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Tipo Entrata/Uscita */}
                <div className="flex gap-4">
                    <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center font-bold transition-all ${type === TransactionType.Income ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                        <input type="radio" checked={type === TransactionType.Income} onChange={() => setType(TransactionType.Income)} className="hidden" />
                        Entrata
                    </label>
                    <label className={`flex-1 p-3 border rounded-xl cursor-pointer text-center font-bold transition-all ${type === TransactionType.Expense ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                        <input type="radio" checked={type === TransactionType.Expense} onChange={() => setType(TransactionType.Expense)} className="hidden" />
                        Uscita
                    </label>
                </div>

                {/* Data e Importo */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input font-bold" required />
                        <label className="md-input-label !top-0">Data</label>
                    </div>
                    <div className="md-input-group">
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className="md-input font-mono text-lg font-bold" required />
                        <label className="md-input-label">Importo (€)</label>
                    </div>
                </div>

                <div className="md-input-group">
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="md-input" required placeholder=" " />
                    <label className="md-input-label">Descrizione</label>
                </div>

                {/* Custom Category Selector Trigger */}
                <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Categoria & Famiglia</label>
                    <button 
                        type="button"
                        onClick={() => setIsCategorySelectorOpen(true)}
                        className="w-full text-left border border-gray-300 rounded-xl px-4 py-3 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 transition-all flex justify-between items-center"
                    >
                        <span className="font-bold text-slate-700">{category}</span>
                        <ChevronDownIcon />
                    </button>
                </div>

                {/* Allocazione */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Allocazione Sede (Opzionale)</label>
                    <select value={allocationId} onChange={e => setAllocationId(e.target.value)} className="md-input bg-gray-50 font-medium">
                        <option value="">Generale / Nessuna Sede</option>
                        {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button>
            </div>

            {/* --- CATEGORY SELECTOR OVERLAY (Full width/height on mobile, modal on desktop) --- */}
            {isCategorySelectorOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
                    <div className="bg-slate-50 w-full h-[90vh] sm:h-[85vh] sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                        
                        {/* Header Overlay */}
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Seleziona Categoria</h3>
                                <p className="text-xs text-slate-500">Scegli la voce corretta per il bilancio</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setIsCategorySelectorOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
                            {Object.entries(CATEGORY_HIERARCHY).map(([macroLabel, families]) => {
                                const styles = MACRO_STYLES[macroLabel] || MACRO_STYLES["ALTRO"];
                                
                                return (
                                    <div key={macroLabel} className={`rounded-2xl border ${styles.container} overflow-hidden shadow-sm`}>
                                        {/* Macro Header */}
                                        <div className="px-5 py-3 flex items-center gap-2">
                                            <span className={`font-black text-sm uppercase tracking-wider ${styles.titleColor}`}>{macroLabel}</span>
                                        </div>
                                        
                                        {/* Body */}
                                        <div className="p-3 space-y-3">
                                            {Object.entries(families).map(([familyLabel, items]) => (
                                                <div key={familyLabel} className="bg-white rounded-xl p-3 shadow-sm border border-black/5">
                                                    <h5 className={`text-[11px] font-bold uppercase mb-2 ${styles.titleColor} opacity-90`}>
                                                        {familyLabel}
                                                    </h5>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {items.map(item => {
                                                            const isSelected = category === item;
                                                            return (
                                                                <button
                                                                    key={item}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCategory(item);
                                                                        setIsCategorySelectorOpen(false);
                                                                    }}
                                                                    className={`
                                                                        text-xs font-bold px-3 py-2.5 rounded-lg border transition-all active:scale-95 leading-tight text-center sm:text-left flex items-center justify-center sm:justify-start
                                                                        ${isSelected 
                                                                            ? styles.pillSelected 
                                                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                                                        }
                                                                    `}
                                                                >
                                                                    {item}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default TransactionForm;
