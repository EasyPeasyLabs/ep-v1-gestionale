import React from 'react';
import { Tabs } from '../ui/Tabs';
import { Iscrizioni } from './Iscrizioni';

export const Flussi: React.FC = () => {
    const tabs = [
        { label: 'Iscrizioni', content: <Iscrizioni /> },
        // Altri futuri flussi (es. Ordini, Fatturazione) andranno qui
    ];

    return (
        <div className="p-4 md:p-8">
             <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Flussi Operativi</h1>
             <Tabs tabs={tabs} />
        </div>
    );
};
