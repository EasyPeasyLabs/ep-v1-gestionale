
import React from 'react';

export const Dashboard: React.FC = () => {
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Home</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Benvenuto in EP v.1, il tuo sistema gestionale per EasyPeasy Labs.</p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold">Prossimi Laboratori</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Nessun laboratorio in programma per oggi.</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold">Clienti Attivi</h2>
                    <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 mt-2">2</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold">Promemoria</h2>
                    <ul className="list-disc list-inside mt-2 text-gray-500 dark:text-gray-400">
                        <li>Contattare "Asilo Nido Sole"</li>
                        <li>Ordinare materiali per attività musicale</li>
                    </ul>
                </div>
            </div>

             <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Calendario Laboratori</h2>
                {/* Placeholder for the monthly calendar view */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                    <p className="text-gray-500">Il calendario mensile sarà visualizzato qui.</p>
                </div>
            </div>
        </div>
    );
};
