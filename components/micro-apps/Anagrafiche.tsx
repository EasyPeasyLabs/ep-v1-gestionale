

import React from 'react';
import { Tabs } from '../ui/Tabs';
import { AnagraficaGenitori } from './AnagraficaGenitori';
import { AnagraficaFigli } from './AnagraficaFigli';
import { AnagraficaFornitori } from './AnagraficaFornitori';
import { AnagraficaSedi } from './AnagraficaSedi';
import { AnagraficaAttivita } from './AnagraficaAttivita';
import { Materiali } from './Materiali';
import { AnagraficaDocumenti } from './AnagraficaDocumenti';
import { AnagraficaTimeSlots } from './AnagraficaTimeSlots';
import { AnagraficaListini } from './AnagraficaListini';
import { AnagraficaTipiLaboratorio } from './AnagraficaTipiLaboratorio';

export const Anagrafiche: React.FC = () => {
    const tabs = [
        { label: 'Genitori', content: <AnagraficaGenitori /> },
        { label: 'Figli', content: <AnagraficaFigli /> },
        { label: 'Fornitori', content: <AnagraficaFornitori /> },
        { label: 'Sedi', content: <AnagraficaSedi /> },
        { label: 'Attività', content: <AnagraficaAttivita /> },
        { label: 'Materiali', content: <Materiali /> },
        { label: 'Time Slot', content: <AnagraficaTimeSlots /> },
        { label: 'Tipi Lab', content: <AnagraficaTipiLaboratorio /> },
        { label: 'Listini', content: <AnagraficaListini /> },
        { label: 'Tipi Documento', content: <AnagraficaDocumenti /> },
    ];

    return (
        <div className="p-4 md:p-8">
             <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Anagrafiche</h1>
             <Tabs tabs={tabs} />
        </div>
    );
};