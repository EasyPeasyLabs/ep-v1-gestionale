
import React, { useState, createContext, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/micro-apps/Dashboard';
import { Clienti } from './components/micro-apps/Clienti';
import { Fornitori } from './components/micro-apps/Fornitori';
import { Sedi } from './components/micro-apps/Sedi';
import { Durate } from './components/micro-apps/Durate';
import { Laboratori } from './components/micro-apps/Laboratori.tsx';
import { Iscrizioni } from './components/micro-apps/Iscrizioni';
import { Attivita } from './components/micro-apps/Attivita';
import { Materiali } from './components/micro-apps/Materiali';
import { Listini } from './components/micro-apps/Listini';
import { Finance } from './components/micro-apps/Finance';
import { Documenti } from './components/micro-apps/Documenti';
import { Commerciale } from './components/micro-apps/Commerciale';
import { Rating } from './components/micro-apps/Rating';
import { CRM } from './components/micro-apps/CRM';
import { Brain } from './components/micro-apps/Brain';
import { Configuration } from './components/micro-apps/Configuration';
import { RegimeFiscale } from './types';
import type { AppContextType } from './types';
import { FornitoriIcon, ClientiIcon, HomeIcon, CogIcon, LabsIcon, AttivitaIcon, MaterialiIcon, FinanzaIcon, DocumentiIcon, CommercialeIcon, RatingIcon, CrmIcon, BrainIcon, BuildingIcon, ClockIcon, ListinoIcon, IscrizioniIcon } from './components/icons/Icons';

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
        { id: 'Durate', label: 'Durate', icon: ClockIcon },
        { id: 'Laboratori', label: 'Laboratori', icon: LabsIcon },
        { id: 'Iscrizioni', label: 'Iscrizioni', icon: IscrizioniIcon },
        { id: 'Attivita', label: 'Attività', icon: AttivitaIcon },
        { id: 'Materiali', label: 'Materiali', icon: MaterialiIcon },
        { id: 'Listini', label: 'Listini', icon: ListinoIcon },
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
            case 'Sedi':
                return <Sedi />;
            case 'Durate':
                return <Durate />;
            case 'Laboratori':
                return <Laboratori />;
            case 'Iscrizioni':
                return <Iscrizioni />;
            case 'Attivita':
                return <Attivita />;
            case 'Materiali':
                return <Materiali />;
            case 'Listini':
                return <Listini />;
            case 'Finance':
                return <Finance />;
            case 'Documenti':
                return <Documenti />;
            case 'Commerciale':
                return <Commerciale />;
            case 'Rating':
                return <Rating />;
            case 'CRM':
                return <CRM />;
            case 'Brain':
                return <Brain />;
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
