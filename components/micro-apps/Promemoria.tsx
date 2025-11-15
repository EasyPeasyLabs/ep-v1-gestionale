import React from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { Promemoria as PromemoriaType, PromemoriaStato } from '../../types';

export const Promemoria: React.FC = () => {
    const { promemoria, genitori, updatePromemoria } = useMockData();

    const getGenitoreNome = (genitoreId: string) => {
        const genitore = genitori.find(g => g.id === genitoreId);
        return genitore ? `${genitore.cognome} ${genitore.nome}` : 'N/D';
    };

    const handleUpdateStatus = (p: PromemoriaType, stato: PromemoriaStato) => {
        if (window.confirm(`Sei sicuro di voler impostare questo promemoria come "${stato}"?`)) {
            updatePromemoria({ ...p, stato });
        }
    };
    
    const getStatoBadgeColor = (stato: PromemoriaStato) => {
        switch(stato) {
            case PromemoriaStato.ATTIVO: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case PromemoriaStato.GESTITO: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case PromemoriaStato.ANNULLATO: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Promemoria Scadenze</h1>
            
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Data Scadenza</th>
                            <th scope="col" className="px-6 py-3">Genitore</th>
                            <th scope="col" className="px-6 py-3">Laboratorio</th>
                            <th scope="col" className="px-6 py-3">Stato</th>
                            <th scope="col" className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {promemoria.map(p => (
                            <tr key={p.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-semibold">{new Date(p.dataScadenza).toLocaleDateString('it-IT')}</td>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{getGenitoreNome(p.genitoreId)}</th>
                                <td className="px-6 py-4 font-mono">{p.laboratorioCodice}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatoBadgeColor(p.stato)}`}>{p.stato}</span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    {p.stato === PromemoriaStato.ATTIVO && (
                                        <>
                                            <Button size="sm" variant="primary" onClick={() => handleUpdateStatus(p, PromemoriaStato.GESTITO)}>Gestito</Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(p, PromemoriaStato.ANNULLATO)}>Annulla</Button>
                                        </>
                                    )}
                                    {p.stato !== PromemoriaStato.ATTIVO && (
                                         <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(p, PromemoriaStato.ATTIVO)}>Riattiva</Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {promemoria.length === 0 && (
                             <tr><td colSpan={5} className="text-center py-8 text-gray-500">Nessun promemoria trovato.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};