

import React from 'react';
import { Tabs } from '../ui/Tabs';
import { AnagraficaFamiglie } from './AnagraficaFamiglie';
import { AnagraficaFornitori } from './AnagraficaFornitori';
import { AnagraficaSedi } from './AnagraficaSedi';
import { AnagraficaDistinteBase } from './AnagraficaDistinteBase';
import { AnagraficaDocumenti } from './AnagraficaDocumenti';
import { AnagraficaTimeSlots } from './AnagraficaTimeSlots';
import { AnagraficaListini } from './AnagraficaListini';
import { AnagraficaTipiLaboratorio } from './AnagraficaTipiLaboratorio';

export const Anagrafiche: React.FC = () => {
    const tabs = [
        { label: 'Famiglie', content: <AnagraficaFamiglie /> },
        { label: 'Fornitori', content: <AnagraficaFornitori /> },
        { label: 'Sedi', content: <AnagraficaSedi /> },
        { label: 'Distinte Base', content: <AnagraficaDistinteBase /> },
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