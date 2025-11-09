
import React, { useContext } from 'react';
import { AppContext } from '../../App';
import { Select } from '../ui/Select';
import { REGIME_FISCALE_OPTIONS } from '../../constants';
import { RegimeFiscale } from '../../types';
import type { AppContextType } from '../../types';

export const Configuration: React.FC = () => {
    const { regimeFiscale, setRegimeFiscale } = useContext(AppContext) as AppContextType;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRegimeFiscale(e.target.value as RegimeFiscale);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-md bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Configurazione Fiscale</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Seleziona il regime fiscale da applicare. Questa impostazione influenzerà la creazione dei documenti e le simulazioni.</p>
                
                <Select
                    id="regime-fiscale"
                    label="Regime Fiscale Attuale"
                    options={REGIME_FISCALE_OPTIONS}
                    value={regimeFiscale}
                    onChange={handleChange}
                />

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                Hai selezionato: <span className="font-medium">{regimeFiscale}</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
