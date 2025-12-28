
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionInput, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Supplier } from '../../types';

// --- Mappatura Categorie Italiano & Suggerimenti ---
const categoryDetails: Record<TransactionCategory, { label: string; help: string }> = {
    [TransactionCategory.Sales]: { label: 'Vendite / Incassi', help: 'Entrate da iscrizioni, vendita libri o servizi extra.' },
    [TransactionCategory.Rent]: { label: 'Affitto / Locazione', help: 'Canone mensile per la sede o affitto sale a ore.' },
    [TransactionCategory.Taxes]: { label: 'Tasse & Bolli', help: 'Pagamenti F24, INPS, marche da bollo o imposte statali.' },
    [TransactionCategory.Fuel]: { label: 'Carburante & Trasporti', help: 'Benzina, pedaggi, biglietti treno/aereo o rimborsi chilometrici.' },
    [TransactionCategory.Materials]: { label: 'Materiali & Cancelleria', help: 'Acquisto libri, penne, carta, giochi o attrezzature per lezioni.' },
    [TransactionCategory.ProfessionalServices]: { label: 'Servizi & Consulenze', help: 'Commercialista, avvocato, pulizie, manutenzioni o collaboratori esterni.' },
    [TransactionCategory.Software]: { label: 'Software & Internet', help: 'Abbonamenti (Zoom, Canva, Gestionale), sito web o telefonia.' },
    [TransactionCategory.Marketing]: { label: 'Marketing & Pubblicità', help: 'Sponsorizzate social, stampa volantini, gadget o eventi.' },
    [TransactionCategory.Capital]: { label: 'Capitale / Versamenti Propri', help: 'Soldi versati dal tuo conto personale a quello aziendale. NON è tassato.' },
    [TransactionCategory.Other]: { label: 'Altro / Spese Bancarie', help: 'Commissioni bancarie, interessi o voci non presenti sopra.' },
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
    const [category, setCategory] = useState<TransactionCategory>(transaction?.category || TransactionCategory.Materials);
    const [allocationId, setAllocationId] = useState(transaction?.allocationId || '');

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
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 border-b flex-shrink-0">
                <h3 className="text-xl font-bold">{transaction ? 'Modifica Voce' : 'Nuova Voce'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex gap-4 mb-4">
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center font-bold ${type === TransactionType.Income ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white text-gray-500'}`}>
                        <input type="radio" checked={type === TransactionType.Income} onChange={() => setType(TransactionType.Income)} className="hidden" />
                        Entrata
                    </label>
                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer text-center font-bold ${type === TransactionType.Expense ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white text-gray-500'}`}>
                        <input type="radio" checked={type === TransactionType.Expense} onChange={() => setType(TransactionType.Expense)} className="hidden" />
                        Uscita
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="md-input-group">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="md-input" required />
                        <label className="md-input-label !top-0">Data</label>
                    </div>
                    <div className="md-input-group">
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className="md-input" required />
                        <label className="md-input-label">Importo (€)</label>
                    </div>
                </div>

                <div className="md-input-group">
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="md-input" required placeholder=" " />
                    <label className="md-input-label">Descrizione</label>
                </div>

                <div>
                    <div className="md-input-group">
                        <select value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} className="md-input">
                            {Object.values(TransactionCategory).map(c => (
                                <option key={c} value={c}>
                                    {categoryDetails[c]?.label || c}
                                </option>
                            ))}
                        </select>
                        <label className="md-input-label !top-0">Categoria</label>
                    </div>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 items-start animate-fade-in">
                        <span className="text-xl">💡</span>
                        <div>
                            <p className="text-xs font-bold text-blue-800 uppercase mb-0.5">Guida alla Categoria</p>
                            <p className="text-xs text-blue-700 leading-snug">
                                {categoryDetails[category]?.help || "Seleziona una categoria per vedere i dettagli."}
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Allocazione (Opzionale - Per ROI Sede)</label>
                    <select value={allocationId} onChange={e => setAllocationId(e.target.value)} className="md-input bg-gray-50">
                        <option value="">Generale / Nessuna Sede</option>
                        {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button type="button" onClick={onCancel} className="md-btn md-btn-flat">Annulla</button>
                <button type="submit" className="md-btn md-btn-raised md-btn-primary">Salva</button>
            </div>
        </form>
    );
};

export default TransactionForm;