
import React, { useState, createContext, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/micro-apps/Dashboard';
import { Clienti } from './components/micro-apps/Clienti';
import { Fornitori } from './components/micro-apps/Fornitori';
import { Configuration } from './components/micro-apps/Configuration';
import { RegimeFiscale } from './types';
import type { AppContextType } from './types';
import { FornitoriIcon, ClientiIcon, HomeIcon, CogIcon, LabsIcon, AttivitaIcon, MaterialiIcon, FinanzaIcon, DocumentiIcon, CommercialeIcon, RatingIcon, CrmIcon, BrainIcon } from './components/icons/Icons';

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
    const [activeApp, setActiveApp] = useState('Home');
    const [regimeFiscale, setRegimeFiscale] = useState<RegimeFiscale>(RegimeFiscale.FORFETTARIO);

    const appContextValue = useMemo(() => ({
        regimeFiscale,
        setRegimeFiscale,
    }), [regimeFiscale]);

    const menuItems = [
        { id: 'Home', label: 'Home', icon: HomeIcon },
        { id: 'Clienti', label: 'Clienti', icon: ClientiIcon },
        { id: 'Fornitori', label: 'Fornitori', icon: FornitoriIcon },
        { id: 'Sedi', label: 'Sedi', icon: BuildingIcon },
        { id: 'Laboratori', label: 'Laboratori', icon: LabsIcon },
        { id: 'Attivita', label: 'Attività', icon: AttivitaIcon },
        { id: 'Materiali', label: 'Materiali', icon: MaterialiIcon },
        { id: 'Finance', label: 'Finance', icon: FinanzaIcon },
        { id: 'Documenti', label: 'Documenti', icon: DocumentiIcon },
        { id: 'Commerciale', label: 'Commerciale', icon: CommercialeIcon },
        { id: 'Rating', label: 'Rating', icon: RatingIcon },
        { id: 'CRM', label: 'CRM', icon: CrmIcon },
        { id: 'Brain', label: 'Brain', icon: BrainIcon },
        { id: 'Configurazione', label: 'Configurazione', icon: CogIcon },
    ];
    
    const renderActiveApp = () => {
        switch (activeApp) {
            case 'Home':
                return <Dashboard />;
            case 'Clienti':
                return <Clienti />;
            case 'Fornitori':
                return <Fornitori />;
             case 'Configurazione':
                return <Configuration />;
            // Add cases for other micro-apps here
            default:
                return <div className="p-8"><h1 className="text-2xl font-bold">Benvenuto in {activeApp}</h1><p>Micro-app in costruzione.</p></div>;
        }
    };

    return (
        <AppContext.Provider value={appContextValue}>
            <Layout
                menuItems={menuItems}
                activeApp={activeApp}
                setActiveApp={setActiveApp}
            >
                {renderActiveApp()}
            </Layout>
        </AppContext.Provider>
    );
};

// Placeholder icons for menu items that don't have one yet
const BuildingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0v-4m6 4v-4m6 4v-4m-9-4h5m6 0h2" /></svg>;


export default App;
