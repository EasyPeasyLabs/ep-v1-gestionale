
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/micro-apps/Dashboard';
import { Commerciale } from './components/micro-apps/Commerciale';
import { Configuration } from './components/micro-apps/Configuration';
import { Anagrafiche } from './components/micro-apps/Anagrafiche';
import { Flussi } from './components/micro-apps/Flussi';
import { RegimeFiscale, PromemoriaStato } from './types';
import type { AppContextType } from './types';
import { HomeIcon, CogIcon, CommercialeIcon, AnagraficheIcon, WorkflowIcon, LabsIcon, BellIcon } from './components/icons/Icons';
import { useMockData } from './hooks/useMockData';
import { Laboratori } from './components/micro-apps/Laboratori';
import { Promemoria } from './components/micro-apps/Promemoria';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
    const [activeApp, setActiveApp] = useState('Home');
    const { configurazione, promemoria } = useMockData();
    const [regimeFiscale, setRegimeFiscale] = useState<RegimeFiscale>(RegimeFiscale.FORFETTARIO);
    const [showPromemoriaAlert, setShowPromemoriaAlert] = useState(false);

    const activePromemoria = useMemo(() => {
        return promemoria.filter(p => p.stato === PromemoriaStato.ATTIVO);
    }, [promemoria]);

    useEffect(() => {
        if (configurazione?.regimeFiscale) {
            setRegimeFiscale(configurazione.regimeFiscale);
        }
    }, [configurazione]);

    useEffect(() => {
        if (activePromemoria.length > 0) {
            const timer = setTimeout(() => setShowPromemoriaAlert(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [activePromemoria.length]);

    const appContextValue = useMemo(() => ({
        regimeFiscale,
    }), [regimeFiscale]);

    const menuItems = useMemo(() => [
        { id: 'Home', label: 'Home', icon: HomeIcon },
        { id: 'Anagrafiche', label: 'Anagrafiche', icon: AnagraficheIcon },
        { id: 'Laboratori', label: 'Laboratori', icon: LabsIcon },
        { id: 'Flussi', label: 'Flussi', icon: WorkflowIcon },
        { id: 'Promemoria', label: 'Promemoria', icon: BellIcon },
        { id: 'Commerciale', label: 'Commerciale', icon: CommercialeIcon },
        { id: 'Configurazione', label: 'Configurazione', icon: CogIcon },
    ], []);
    
    const renderActiveApp = () => {
        switch (activeApp) {
            case 'Home':
                return <Dashboard setActiveApp={setActiveApp} />;
            case 'Anagrafiche':
                return <Anagrafiche />;
            case 'Laboratori':
                return <Laboratori />;
            case 'Flussi':
                return <Flussi />;
            case 'Promemoria':
                return <Promemoria />;
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
            <Modal
                isOpen={showPromemoriaAlert}
                onClose={() => setShowPromemoriaAlert(false)}
                title="Promemoria Scadenze"
            >
                <div className="text-center">
                    <BellIcon className="h-12 w-12 mx-auto text-yellow-500" />
                    <p className="mt-4 text-lg">
                        Ci sono <strong>{activePromemoria.length}</strong> iscrizioni in scadenza.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">Controlla la sezione Promemoria per i dettagli.</p>
                </div>
                <div className="mt-6 flex justify-center gap-4">
                    <Button variant="secondary" onClick={() => setShowPromemoriaAlert(false)}>Chiudi</Button>
                    <Button variant="primary" onClick={() => {
                        setActiveApp('Promemoria');
                        setShowPromemoriaAlert(false);
                    }}>
                        Vai ai Promemoria
                    </Button>
                </div>
            </Modal>
        </AppContext.Provider>
    );
};

export default App;
