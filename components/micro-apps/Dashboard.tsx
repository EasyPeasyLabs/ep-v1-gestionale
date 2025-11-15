import React, { useMemo } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { PromemoriaStato } from '../../types';
import { CalendarView } from '../ui/CalendarView';
import { BellIcon } from '../icons/Icons';

interface DashboardProps {
    setActiveApp: (app: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveApp }) => {
    const { promemoria, laboratori, sedi } = useMockData();
    
    const activePromemoriaCount = useMemo(() => {
        return promemoria.filter(p => p.stato === PromemoriaStato.ATTIVO).length;
    }, [promemoria]);

    const calendarEvents = useMemo(() => {
        const sedeMap = new Map(sedi.map(s => [s.id, s]));
        return laboratori.flatMap(lab => {
            const sede = sedeMap.get(lab.sedeId);
            return lab.timeSlots.map(ts => ({
                id: ts.id,
                title: lab.codice,
                start: new Date(`${ts.data}T00:00:00`), // Assicura che la data sia interpretata come locale
                end: new Date(`${ts.data}T23:59:59`),
                color: sede?.colore || '#A0AEC0',
                data: { laboratorio: lab, timeSlot: ts }
            }));
        });
    }, [laboratori, sedi]);
    
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Home</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Benvenuto in EP v.1, il tuo sistema gestionale per EasyPeasy Labs.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {activePromemoriaCount > 0 && (
                    <button 
                        onClick={() => setActiveApp('Promemoria')}
                        className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="bg-yellow-100 dark:bg-yellow-900/50 p-3 rounded-full">
                            <BellIcon className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-gray-800 dark:text-white">{activePromemoriaCount}</p>
                            <p className="text-gray-500 dark:text-gray-400">Iscrizioni in scadenza</p>
                        </div>
                    </button>
                )}
            </div>

            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 md:p-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Calendario Laboratori</h2>
                <CalendarView events={calendarEvents} />
            </div>
        </div>
    );
};