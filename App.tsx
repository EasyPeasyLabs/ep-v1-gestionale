
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/micro-apps/Dashboard';
import { Commerciale } from './components/micro-apps/Commerciale';
import { Configuration } from './components/micro-apps/Configuration';
import { Anagrafiche } from './components/micro-apps/Anagrafiche';
import { Relazioni } from './components/micro-apps/Relazioni';
import { GenericRelationManager } from './components/micro-apps/GenericRelationManager';
import { RegimeFiscale } from './types';
import type { AppContextType } from './types';
import { HomeIcon, CogIcon, CommercialeIcon, AnagraficheIcon, LinkIcon, PuzzleIcon } from './components/icons/Icons';
import { useMockData } from './hooks/useMockData';

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
    const [activeApp, setActiveApp] = useState('Home');
    const { configurazione, relazioni } = useMockData();
    const [regimeFiscale, setRegimeFiscale] = useState<RegimeFiscale>(RegimeFiscale.FORFETTARIO);

    useEffect(() => {
        if (configurazione?.regimeFiscale) {
            setRegimeFiscale(configurazione.regimeFiscale);
        }
    }, [configurazione]);

    const appContextValue = useMemo(() => ({
        regimeFiscale,
    }), [regimeFiscale]);

    const generatedMenuItems = useMemo(() => relazioni
        .filter(r => r.microAppGenerated)
        .map(r => ({
            id: `rel-${r.id}`,
            label: r.nome,
            icon: PuzzleIcon,
        })), [relazioni]);

    const menuItems = useMemo(() => [
        { id: 'Home', label: 'Home', icon: HomeIcon },
        { id: 'Anagrafiche', label: 'Anagrafiche', icon: AnagraficheIcon },
        { id: 'Relazioni', label: 'Relazioni', icon: LinkIcon },
        ...generatedMenuItems,
        { id: 'Commerciale', label: 'Commerciale', icon: CommercialeIcon },
        { id: 'Configurazione', label: 'Configurazione', icon: CogIcon },
    ], [generatedMenuItems]);
    
    const renderActiveApp = () => {
        if (activeApp.startsWith('rel-')) {
            const relazioneId = activeApp.substring(4);
            return <GenericRelationManager relazioneId={relazioneId} />;
        }

        switch (activeApp) {
            case 'Home':
                return <Dashboard />;
            case 'Anagrafiche':
                return <Anagrafiche />;
            case 'Relazioni':
                return <Relazioni />;
            case 'Commerciale':
                return <Commerciale />;
            case 'Configurazione':
                return <Configuration />;
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

export default App;
