import React, { useState, useEffect, useRef } from 'react';
import Spinner from '../components/Spinner';

// --- TYPES PER IL SIMULATORE ---
interface MissionStep {
    id: number;
    caption: string;
    handX: string;
    handY: string;
    action: 'idle' | 'click' | 'drag' | 'type';
    focusId?: string;
    description: string;
}

interface Mission {
    title: string;
    steps: MissionStep[];
    emulatorType: string;
}

interface MissionDetails {
    objective: string;
    pros: string[];
}

// --- CONFIGURAZIONE DETTAGLI DINAMICI ---
const MISSION_DETAILS: Record<string, MissionDetails> = {
    'Dashboard': {
        objective: "La Dashboard è il centro di controllo strategico. Aggrega dati da Finanza, Iscrizioni e Fornitori per offrire una vista olistica sulla salute dell'attività. Le card ROI (Return on Investment) calcolano la profittabilità incrociando gli incassi reali con i costi di nolo e logistica, permettendo di identificare i 'centri di costo' improduttivi. L'AI Strategy Advisor analizza i trend di iscrizione per suggerire manovre correttive in tempo reale.",
        pros: [
            "Monitora il limite dei 85k: l'indicatore diventa rosso sopra l'80% per pianificare la fiscalità.",
            "Usa la vista 'Saturazione' per decidere se aprire nuovi corsi o compattare le classi.",
            "I grafici sono interattivi: clicca sulle card per approfondire le analisi educative."
        ]
    },
    'Calendario': {
        objective: "Il Calendario gestisce la logica temporale dell'attività. Visualizza sia gli appuntamenti generati dai 'Cartellini' (Iscrizioni) che le lezioni extra (Manual Lessons). È interconnesso con il modulo Fornitori: se una sede viene dismessa, gli slot sul calendario vengono marcati come orfani. Permette il drag-and-drop per la riprogrammazione rapida degli slot manuali.",
        pros: [
            "La vista 'Cluster' raggruppa gli allievi per slot orario: ideale per vedere chi è in aula.",
            "Le lezioni extra (EXT) non scalano i crediti delle iscrizioni standard.",
            "Il colore della card riflette l'identità cromatica della sede impostata in Fornitori."
        ]
    },
    'Iscrizioni': {
        objective: "È il motore operativo primario. Qui si creano i 'Cartellini' che definiscono il rapporto tra Allievo, Pacchetto e Sede. Ogni iscrizione genera a cascata un piano di lezioni nel Calendario e un'aspettativa di incasso in Finanza. La funzione 'Move Mode' è una macchina a stati complessa che sposta l'intera validità temporale tra recinti diversi, ricalcolando automaticamente presenze future e costi nolo.",
        pros: [
            "Usa il tasto 'Sposta' per gestire i cambi sede massivi senza cancellare dati.",
            "I cartellini 'Dormienti' (Pending) indicano iscrizioni senza ancora un incasso registrato.",
            "La data fine viene calcolata dal sistema, ma puoi sbloccarla per gestire chiusure anticipate."
        ]
    },
    'Archivio Iscrizioni': {
        objective: "L'Archivio gestisce lo storico e l'integrità finanziaria. Permette di visualizzare la timeline di copertura di ogni allievo attraverso gli anni solari. Include il 'Financial Wizard' (Bottone €), uno strumento critico per riconciliare incassi orfani, gestire abbuoni fiscali per pareggio contabile e trasformare pro-forma (Ghost) in fatture reali.",
        pros: [
            "Usa la vista 'Calendario Copertura' per individuare buchi temporali tra un rinnovo e l'altro.",
            "Se un allievo ha un debito residuo, genera una 'Pro-forma di Saldo' per silenziare l'alert.",
            "L'Archivio è il posto giusto per gestire i rimborsi tramite Nota di Credito."
        ]
    },
    'Registro Elettronico': {
        objective: "Modulo dedicato alla tracciabilità didattica. Permette di documentare l'esperienza in aula collegando le lezioni svolte alla libreria delle 'Attività'. È strettamente legato al modulo Compiti (Homeworks): una volta loggata un'attività, puoi assegnare compiti specifici che verranno inviati direttamente via WhatsApp ai genitori del recinto selezionato.",
        pros: [
            "Puoi assegnare un'attività a interi gruppi di lezioni con un solo click.",
            "Usa i filtri temporali per produrre report trimestrali sull'andamento didattico.",
            "Il registro mostra quali lezioni non hanno ancora un'attività assegnata (Gap didattico)."
        ]
    },
    'Presenze': {
        objective: "Gestione chirurgica degli slot consumati. Ogni 'Presenza' marcata scala un credito dal Cartellino dell'allievo. La logica 'Register & Recover' attiva flussi di recupero automatici: se segni un assente, il sistema propone una data alternativa saltando automaticamente le festività nazionali italiane, garantendo che l'allievo non perda valore economico.",
        pros: [
            "Il pulsante 'Tutti Presenti' velocizza il lavoro al termine della giornata.",
            "I recuperi programmati estendono automaticamente la validità temporale dell'iscrizione.",
            "Verifica sempre gli 'Slot Residui' prima di concedere recuperi extra fuori pacchetto."
        ]
    },
    'Finanza': {
        objective: "Il sistema nervoso fiscale. Gestisce il ciclo documentale (Preventivi -> Fatture) e il registro di cassa. Implementa il 'Fiscal Doctor', un algoritmo di riconciliazione che scansiona anomalie tra documenti e movimenti bancari. È interdipendente con Iscrizioni: ogni pagamento registrato aggiorna lo stato dell'allievo e sigilla SDI i documenti per integrità legale.",
        pros: [
            "Il Sigillo SDI impedisce modifiche accidentali a fatture già trasmesse al fisco.",
            "Usa il Simulatore CFO per calcolare l'accantonamento tasse basato sullo scenario Start-up.",
            "Controlla regolarmente le 'Fatture senza Cassa' nel Medico Fiscale."
        ]
    },
    'CRM': {
        objective: "Gestione delle relazioni massive. Utilizza i dati di Clienti e Iscrizioni per automatizzare la comunicazione. Include la gestione delle scadenze (Alert Rinnovi) e il WhatsApp Blaster per invii massivi a interi recinti (sedi). Ogni interazione viene archiviata nel Log Comunicazioni per garantire la tracciabilità storica del rapporto.",
        pros: [
            "Usa sempre {{cliente}} e {{bambino}} nei template per personalizzare l'invio massivo.",
            "Segna come 'Gestiti' i contatti contattati esternamente per pulire la dashboard.",
            "Le campagne programmate lavorano in background tramite il cloud scheduler."
        ]
    },
    'Clienti': {
        objective: "Anagrafica centralizzata per Genitori ed Enti Istituzionali. È il punto di origine di ogni dato. Include il sistema di 'Rating a 4 Assi' per valutare qualità dell'apprendimento, condotta e rischio Churn (abbandono). Ogni modifica ai dati anagrafici si propaga istantaneamente su tutte le fatture e i contratti generati dal sistema.",
        pros: [
            "Raggruppa per sede per vedere rapidamente la distribuzione geografica della community.",
            "Il Rating 5 stelle aiuta a identificare i 'Champions' per manovre di referral.",
            "L'eliminazione di un cliente attiva la pulizia a cascata di tutte le sue iscrizioni e finanze."
        ]
    },
    'Fornitori': {
        objective: "Gestione degli Asset Logistici (Sedi e Proprietà). Qui si definiscono i 'Recinti' (Sedi con slot orari) che abilitano il modulo Iscrizioni. Ogni sede ha parametri di costo nolo e distanza che alimentano il calcolo del ROI e del TCO (Total Cost of Ownership) veicolo. Permette la generazione di contratti legali in PDF precompilati.",
        pros: [
            "Imposta correttamente la capienza aule per abilitare gli avvisi di over-booking.",
            "Usa la 'Dismissione Sede' invece della cancellazione per preservare i bilanci storici.",
            "Configura gli slot orari precisi per permettere il drag-and-drop nel calendario."
        ]
    },
    'Attività': {
        objective: "Libreria didattica e materiale multimediale. Funge da database centrale per la preparazione delle lezioni. Include il sistema 'Peek-a-Boo(k)' per la gestione dei prestiti bibliotecari. Le attività qui salvate diventano selezionabili nel Registro Elettronico, creando un ponte tra pianificazione e didattica reale.",
        pros: [
            "Inserisci link YouTube o Pinterest per averli pronti durante la lezione in aula.",
            "Il sistema prestiti avvisa se un libro non è stato restituito da oltre 14 giorni.",
            "Categorizza le attività per 'Tema' per ritrovarle facilmente l'anno successivo."
        ]
    },
    'Impostazioni': {
        objective: "La spina dorsale del sistema. Configura i parametri aziendali (IBAN, Logo), i listini abbonamento (K-Kid, A-Adult) e le policy di recupero. Le modifiche qui effettuate hanno un impatto sistemico immediato su calcoli fiscali, layout dei PDF e permessi del service worker per le notifiche push.",
        pros: [
            "Testa regolarmente le notifiche push dal pannello di diagnostica.",
            "Usa i placeholder nel footer legale per automatizzare le diciture IVA forfettario.",
            "I listini promozionali possono avere target specifici (solo certe sedi o certi clienti)."
        ]
    }
};

// --- COMPONENTE CURSORE VIRTUALE ---
const VirtualHand: React.FC<{ active: boolean; x: string; y: string; action: string }> = ({ active, x, y, action }) => (
    <div 
        className={`absolute z-[100] pointer-events-none transition-all duration-1000 ease-in-out ${active ? 'opacity-100' : 'opacity-0'}`}
        style={{ left: x, top: y }}
    >
        <div className="relative">
            <span className={`text-4xl filter drop-shadow-xl transition-transform duration-300 ${action === 'click' ? 'scale-75' : 'scale-100'}`}>
                {action === 'drag' ? '✊' : '👆'}
            </span>
            {action === 'click' && (
                <div className="absolute top-0 left-0 w-12 h-12 -mt-3 -ml-3 rounded-full border-4 border-amber-400 opacity-0 animate-manual-ping"></div>
            )}
        </div>
    </div>
);

// --- MINI-APP SIMULATOR CORE ---
const UIEmulator: React.FC<{ mission: Mission }> = ({ mission }) => {
    const [stepIdx, setStepIdx] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    
    useEffect(() => {
        setStepIdx(0);
    }, [mission.title]);

    useEffect(() => {
        if (!isAutoPlaying || !mission.steps.length) return;
        const timer = setTimeout(() => {
            setStepIdx((prev) => (prev + 1) % mission.steps.length);
        }, 4000);
        return () => clearTimeout(timer);
    }, [stepIdx, isAutoPlaying, mission.steps.length]);

    const currentStep = mission.steps[stepIdx];

    if (!currentStep) return <div className="w-full aspect-video flex items-center justify-center bg-slate-900 rounded-[40px]"><Spinner /></div>;

    return (
        <div className="w-full bg-slate-900 md:rounded-[40px] rounded-2xl p-1 border-[6px] md:border-[12px] border-slate-800 shadow-2xl overflow-hidden relative aspect-video flex flex-col group">
            
            <div className="bg-slate-800 px-4 md:px-6 py-2 md:py-3 flex justify-between items-center border-b border-slate-700/50">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                </div>
                <div className="bg-slate-900 px-3 md:px-4 py-0.5 md:py-1 rounded-full border border-slate-700">
                    <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {mission.title} • Passo {stepIdx + 1} di {mission.steps.length}
                    </p>
                </div>
                <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase hover:text-white transition-colors">
                    {isAutoPlaying ? 'Pausa' : 'Riproduci'}
                </button>
            </div>

            <div className="flex-1 bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/5 pointer-events-none z-10"></div>
                <VirtualHand active={true} x={currentStep.handX} y={currentStep.handY} action={currentStep.action} />

                <div className="p-4 md:p-8 h-full">
                    {mission.emulatorType === 'clients' && <ClientCreationScenario step={stepIdx} />}
                    {mission.emulatorType === 'finance' && <FinanceCycleScenario step={stepIdx} />}
                    {mission.emulatorType === 'move' && <MoveModeScenario step={stepIdx} />}
                    {mission.emulatorType === 'attendance' && <AttendanceScenario step={stepIdx} />}
                    {mission.emulatorType === 'crm' && <CRMScenario step={stepIdx} />}
                    {mission.emulatorType === 'dashboard' && <DashboardScenario step={stepIdx} />}
                    {mission.emulatorType === 'suppliers' && <SupplierScenario step={stepIdx} />}
                    {mission.emulatorType === 'settings' && <SettingsScenario step={stepIdx} />}
                    {mission.emulatorType === 'calendar' && <CalendarScenario step={stepIdx} />}
                    {mission.emulatorType === 'archive' && <ArchiveScenario step={stepIdx} />}
                    {mission.emulatorType === 'activities' && <ActivitiesScenario step={stepIdx} />}
                    {mission.emulatorType === 'log' && <LogScenario step={stepIdx} />}
                </div>

                <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-4/5 bg-white/95 backdrop-blur shadow-2xl border-l-4 border-indigo-600 p-3 md:p-4 rounded-xl md:rounded-2xl z-50 animate-manual-slide-up">
                    <p className="text-indigo-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1">{currentStep.caption}</p>
                    <p className="text-slate-700 text-xs md:text-sm font-bold leading-tight">{currentStep.description}</p>
                </div>
            </div>

            <style>{`
                @keyframes manual-ping { 0% { transform: scale(0.2); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
                @keyframes manual-slide-up { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                .animate-manual-ping { animation: manual-ping 1s infinite; }
                .animate-manual-slide-up { animation: manual-slide-up 0.5s ease-out; }
            `}</style>
        </div>
    );
};

// --- MINI SCENARI PER IL SIMULATORE ---
const CalendarScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="bg-white rounded-xl p-3 md:p-4 shadow-xl border h-full">
        <div className="flex justify-between items-center mb-2 md:mb-4 px-1 md:px-2">
            <span className="font-bold text-xs md:text-sm">{step === 0 ? "Gennaio 2026" : "Febbraio 2026"}</span>
            <div className="flex gap-1">
                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold border ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>&gt;</div>
            </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="aspect-square border border-gray-100 rounded bg-gray-50/50 flex flex-col p-1">
                    <span className="text-[6px] md:text-[8px] text-gray-300 font-bold">{i+1}</span>
                    {i === 3 && <div className="mt-auto h-1 md:h-1.5 bg-blue-400 rounded-full w-full"></div>}
                    {i === 8 && <div className="mt-auto h-1 md:h-1.5 bg-indigo-500 rounded-full w-full"></div>}
                </div>
            ))}
        </div>
    </div>
);

const ArchiveScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="space-y-2 md:space-y-4">
        <div className="bg-white p-3 md:p-5 rounded-xl border shadow-xl">
            <div className="flex justify-between items-center mb-2 md:mb-4">
                <h4 className="font-bold text-xs md:text-sm">Timeline Copertura</h4>
                <span className="text-[8px] md:text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">2026</span>
            </div>
            <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2 md:gap-3">
                    <span className="w-12 md:w-16 text-[7px] md:text-[9px] font-bold text-gray-400 uppercase">Luca Rossi</span>
                    <div className="flex-1 h-2 md:h-3 bg-gray-100 rounded-full relative overflow-hidden">
                        <div className={`h-full bg-indigo-500 transition-all duration-2000 ${step >= 0 ? 'w-2/3' : 'w-0'}`}></div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 opacity-50">
                    <span className="w-12 md:w-16 text-[7px] md:text-[9px] font-bold text-gray-400 uppercase">Sara B.</span>
                    <div className="flex-1 h-2 md:h-3 bg-gray-100 rounded-full relative overflow-hidden">
                        <div className={`h-full bg-blue-400 transition-all duration-2000 ${step >= 0 ? 'w-1/2' : 'w-0'}`}></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const ActivitiesScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="grid grid-cols-2 gap-2 md:gap-4">
        <div className={`md-card p-2 md:p-4 transition-all ${step === 0 ? 'ring-2 md:ring-4 ring-indigo-500' : 'opacity-40'}`}>
            <div className="w-full h-12 md:h-20 bg-slate-200 rounded-lg mb-1 md:mb-2 flex items-center justify-center text-xl md:text-2xl">🎨</div>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-800">Pittura Creativa</p>
            <span className="text-[6px] md:text-[8px] text-indigo-600 font-bold uppercase">Motoria</span>
        </div>
        <div className={`md-card p-2 md:p-4 transition-all ${step === 1 ? 'ring-2 md:ring-4 ring-indigo-500' : 'opacity-40'}`}>
            <div className="w-full h-12 md:h-20 bg-slate-200 rounded-lg mb-1 md:mb-2 flex items-center justify-center text-xl md:text-2xl">⚽</div>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-800">Outdoor Games</p>
            <span className="text-[6px] md:text-[8px] text-indigo-600 font-bold uppercase">Sport</span>
        </div>
    </div>
);

const LogScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden border">
        <table className="w-full text-[8px] md:text-[10px]">
            <thead className="bg-gray-50 border-b">
                <tr><th className="p-1 md:p-2 text-left">Ora</th><th className="p-1 md:p-2 text-left">Allievi</th><th className="p-1 md:p-2 text-left">Attività</th></tr>
            </thead>
            <tbody>
                <tr className={step === 1 ? 'bg-indigo-50' : ''}>
                    <td className="p-1 md:p-2 font-mono">16:30</td>
                    <td className="p-1 md:p-2 font-bold">Luca R. +3</td>
                    <td className="p-1 md:p-2">
                        {step === 1 ? <span className="bg-green-100 text-green-700 px-1 md:px-2 py-0.5 rounded-full font-bold">✓ Pittura</span> : <span className="text-gray-300 italic">...</span>}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
);

const DashboardScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="grid grid-cols-2 gap-2 md:gap-4">
        <div className={`md-card p-2 md:p-4 transition-all duration-1000 ${step === 0 ? 'ring-2 md:ring-4 ring-indigo-500 shadow-2xl scale-105 z-20' : 'opacity-40'}`}>
            <p className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase">ROI Sede Bari</p>
            <p className="text-xs md:text-xl font-black text-indigo-700">+4.500€</p>
        </div>
        <div className={`md-card p-2 md:p-4 transition-all duration-1000 ${step === 1 ? 'ring-2 md:ring-4 ring-amber-400 shadow-2xl scale-105 z-20 bg-white' : 'opacity-40'}`}>
            <p className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase">Dettaglio Smart</p>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-600">"In tasca"</p>
        </div>
    </div>
);

const ClientCreationScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-xl border border-slate-200">
        <div className="flex gap-1 md:gap-2 mb-3 md:mb-6 border-b pb-1 md:pb-2">
            {['Dati', 'Figli', 'Rating'].map((t, i) => (
                <div key={t} className={`text-[7px] md:text-[10px] font-black px-2 md:px-3 py-0.5 md:py-1 rounded-full ${step === i ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>{t}</div>
            ))}
        </div>
        <div className="space-y-2 md:space-y-4">
            {step === 0 && <div className="space-y-1 md:space-y-2 animate-fade-in"><div className="h-6 md:h-8 bg-slate-100 rounded-lg w-full flex items-center px-2 md:px-3 text-[8px] md:text-[10px] text-slate-700">Mario Rossi</div><div className="h-6 md:h-8 bg-slate-100 rounded-lg w-full flex items-center px-2 md:px-3 text-[8px] md:text-[10px] text-slate-700">mario@email.it</div></div>}
            {step === 1 && <div className="space-y-1 md:space-y-2 animate-fade-in"><div className="p-2 md:p-3 border rounded-xl flex justify-between items-center"><span className="text-[10px] md:text-xs font-bold text-slate-800">Luca Rossi</span><span className="text-[8px] md:text-[10px] text-slate-400">5 anni</span></div></div>}
            {step === 2 && <div className="flex gap-0.5 md:gap-1 justify-center py-2 md:py-4 animate-fade-in">{[1,2,3,4,5].map(s => <span key={s} className={`text-lg md:text-2xl ${s <= 4 ? 'text-amber-400' : 'text-slate-200'} transition-all`}>★</span>)}</div>}
            {step === 3 && <div className="flex justify-center py-6 md:py-10 animate-fade-in"><div className="bg-green-500 text-white px-4 md:px-8 py-2 md:py-3 rounded-full font-black text-[10px] md:text-xs shadow-lg animate-bounce">OK! ✓</div></div>}
        </div>
    </div>
);

const FinanceCycleScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="space-y-2 md:space-y-4">
        {step <= 2 && (
            <div className={`md-card p-3 md:p-4 transition-all ${step === 2 ? 'border-indigo-500 ring-2 md:ring-4 ring-indigo-50' : ''}`}>
                <div className="flex justify-between items-center">
                    <div><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">Preventivo</p><p className="text-xs md:text-sm font-bold">Mario Rossi</p></div>
                    <div className="text-sm md:text-lg font-black">250€</div>
                </div>
                {step === 2 && <button className="mt-2 md:mt-4 w-full bg-indigo-600 text-white py-1.5 md:py-2 rounded-lg font-black text-[8px] md:text-[10px]">🪄 FATTURA</button>}
            </div>
        )}
        {step === 3 && (
            <div className="md-card p-3 md:p-4 border-green-500 animate-fade-in bg-green-50/50">
                <p className="text-[8px] md:text-[10px] font-black text-green-600 uppercase">Fattura OK!</p>
            </div>
        )}
        {step === 4 && (
            <div className="md-card p-3 md:p-4 animate-fade-in">
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Registro Cassa</p>
                <div className="flex justify-between items-center mt-1 border-l-2 md:border-l-4 border-green-500 pl-2">
                    <p className="text-[10px] md:text-xs font-bold text-slate-700">Incasso</p>
                    <span className="text-[10px] md:text-xs font-black text-green-600">+250€</span>
                </div>
            </div>
        )}
    </div>
);

const MoveModeScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="flex justify-between items-center gap-2 md:gap-8 h-full">
        <div className={`flex-1 h-20 md:h-32 border md:border-2 border-dashed rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${step === 1 ? 'border-indigo-500 bg-indigo-50' : 'bg-white'}`}>
            {step <= 1 && <div className="p-1 md:p-3 bg-white shadow-xl rounded-lg md:rounded-xl border border-indigo-100 font-black text-[8px] md:text-[10px]">LUCA ROSSI</div>}
        </div>
        <div className="text-xl md:text-4xl opacity-20">→</div>
        <div className={`flex-1 h-20 md:h-32 border md:border-2 border-dashed rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${step === 2 ? 'border-green-500 bg-green-50' : 'bg-white'}`}>
            {step >= 2 && <div className="p-1 md:p-3 bg-white shadow-xl rounded-lg md:rounded-xl border border-green-200 font-black text-[8px] md:text-[10px] text-green-700">OK! ✓</div>}
        </div>
    </div>
);

const AttendanceScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="space-y-2 md:space-y-4">
        <div className="bg-white p-3 md:p-4 rounded-xl border shadow-sm flex justify-between items-center">
            <span className="font-bold text-xs md:text-sm">Sara Bianchi</span>
            <div className={`px-2 md:w-16 h-6 md:h-8 rounded text-[8px] md:text-[10px] flex items-center justify-center font-bold ${step === 0 ? 'bg-green-100 text-green-700' : 'bg-red-500 text-white animate-pulse'}`}>{step === 0 ? 'PRESENTE' : 'ASSENTE'}</div>
        </div>
        {step === 1 && (
            <div className="md-card p-3 md:p-4 bg-white border-2 border-indigo-500 animate-manual-slide-up shadow-2xl relative z-50">
                <h5 className="text-[10px] md:text-xs font-black text-indigo-700 mb-1 md:mb-2 uppercase">Recupero</h5>
                <button className="w-full bg-indigo-600 text-white py-1 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black uppercase">SI, RECUPERA</button>
            </div>
        )}
    </div>
);

const CRMScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="space-y-2 md:space-y-4">
        <div className="bg-white rounded-xl p-3 md:p-5 border shadow-xl">
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase mb-2 md:mb-3">Template WA</p>
            <div className="bg-slate-50 p-2 md:p-3 rounded-lg border text-[9px] md:text-[11px] text-slate-700 font-medium leading-tight italic">
                {step === 0 ? "Ciao {{cliente}}..." : "Ciao Marco Rossi..."}
            </div>
        </div>
    </div>
);

const SupplierScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="space-y-2 md:space-y-4">
        <div className="md-card p-3 md:p-4">
            <h4 className="font-bold text-xs md:text-sm">Scuola Verdi</h4>
            <div className={`mt-2 md:mt-3 p-2 md:p-3 border-2 rounded-xl transition-all ${step === 1 ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100'}`}>
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Capienza: 12</p>
            </div>
        </div>
    </div>
);

const SettingsScenario: React.FC<{ step: number }> = ({ step }) => (
    <div className="flex flex-col h-full justify-center space-y-2 md:space-y-4">
        <div className="md-card p-3 md:p-4 bg-white">
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase mb-1 md:mb-2">Nuovo Listino</p>
            <div className={`h-8 md:h-10 bg-slate-50 border rounded-lg flex items-center px-2 md:px-4 ${step === 1 ? 'ring-2 ring-indigo-500' : ''}`}>
                <span className="text-[10px] md:text-sm font-bold">{step === 0 ? "Nome..." : "K-Trimestrale"}</span>
            </div>
        </div>
    </div>
);


// --- CONFIGURAZIONE MISSIONI ---
const MISSIONS: Record<string, Mission> = {
    'Dashboard': {
        title: 'Business Intelligence',
        emulatorType: 'dashboard',
        steps: [
            { id: 0, caption: 'Analisi ROI', description: 'Monitora la salute finanziaria delle singole sedi con le card interattive.', handX: '20%', handY: '20%', action: 'click' },
            { id: 1, caption: 'Smart Insights', description: 'Clicca sulle card per ottenere suggerimenti strategici dall\'AI.', handX: '70%', handY: '20%', action: 'click' }
        ]
    },
    'Calendario': {
        title: 'Gestione Calendario',
        emulatorType: 'calendar',
        steps: [
            { id: 0, caption: 'Navigazione Mese', description: 'Usa le frecce per spostarti tra i periodi dell\'anno.', handX: '80%', handY: '20%', action: 'click' },
            { id: 1, caption: 'Visualizzazione Cluster', description: 'Gli allievi sono raggruppati per sede e orario nello slot giornaliero.', handX: '50%', handY: '50%', action: 'idle' }
        ]
    },
    'Iscrizioni': {
        title: 'Logica dei Recinti',
        emulatorType: 'move',
        steps: [
            { id: 0, caption: 'Move Mode', description: 'Attiva il tasto "Sposta" per riorganizzare gli allievi.', handX: '15%', handY: '10%', action: 'click' },
            { id: 1, caption: 'Trascinamento', description: 'Trascina l\'allievo dal box "In Attesa" allo slot della sede desiderata.', handX: '30%', handY: '45%', action: 'drag' },
            { id: 2, caption: 'Conferma', description: 'Rilascia nello slot: il sistema ricalcola presenze e costi nolo.', handX: '70%', handY: '45%', action: 'click' }
        ]
    },
    'Archivio Iscrizioni': {
        title: 'Storico Coperture',
        emulatorType: 'archive',
        steps: [
            { id: 0, caption: 'Verifica Timeline', description: 'Controlla graficamente se l\'allievo ha copertura per l\'intero anno solare.', handX: '50%', handY: '50%', action: 'idle' }
        ]
    },
    'Registro Elettronico': {
        title: 'Registro Lezioni',
        emulatorType: 'log',
        steps: [
            { id: 0, caption: 'Log Attività', description: 'Seleziona le lezioni svolte per collegare le attività didattiche.', handX: '10%', handY: '50%', action: 'click' },
            { id: 1, caption: 'Assegnazione', description: 'Scegli l\'attività dalla libreria per storicizzare l\'esperienza in aula.', handX: '50%', handY: '80%', action: 'click' }
        ]
    },
    'Presenze': {
        title: 'Recupero Crediti',
        emulatorType: 'attendance',
        steps: [
            { id: 0, caption: 'Segna Assenza', description: 'Clicca su assente per attivare il workflow di recupero.', handX: '85%', handY: '15%', action: 'click' },
            { id: 1, caption: 'Wizard Recupero', description: 'Scegli se programmare subito il recupero o abbuonare lo slot.', handX: '50%', handY: '60%', action: 'click' },
            { id: 2, caption: 'Auto-Scheduling', description: 'Il sistema prenota il recupero saltando automaticamente le festività.', handX: '50%', handY: '30%', action: 'idle' }
        ]
    },
    'Finanza': {
        title: 'Ciclo Documentale',
        emulatorType: 'finance',
        steps: [
            { id: 0, caption: 'Nuovo Preventivo', description: 'Apri il form per creare una proposta commerciale.', handX: '90%', handY: '10%', action: 'click' },
            { id: 1, caption: 'Compilazione', description: 'Inserisci le voci di costo e il piano rateale.', handX: '50%', handY: '40%', action: 'type' },
            { id: 2, caption: 'Conversione Magica', description: 'Usa la bacchetta magica per trasformare il preventivo in fattura reale.', handX: '50%', handY: '45%', action: 'click' },
            { id: 3, caption: 'Documento Fiscale', description: 'La fattura è stata generata e sigillata SDI automaticamente.', handX: '50%', handY: '20%', action: 'idle' },
            { id: 4, caption: 'Registro Cassa', description: 'Verifica la creazione automatica della transazione di entrata.', handX: '50%', handY: '50%', action: 'idle' }
        ]
    },
    'CRM': {
        title: 'Marketing Automation',
        emulatorType: 'crm',
        steps: [
            { id: 0, caption: 'Template Placeholders', description: 'Usa le variabili {{cliente}} per personalizzare i messaggi.', handX: '50%', handY: '45%', action: 'type' },
            { id: 1, caption: 'Anteprima Reale', description: 'Il sistema sostituisce i dati reali prima dell\'invio.', handX: '50%', handY: '45%', action: 'idle' },
            { id: 2, caption: 'WhatsApp Blaster', description: 'Invia massivamente a interi recinti con un solo click.', handX: '50%', handY: '80%', action: 'click' }
        ]
    },
    'Clienti': {
        title: 'Gestione Anagrafiche',
        emulatorType: 'clients',
        steps: [
            { id: 0, caption: 'Anagrafica', description: 'Inserisci i dati fiscali e di contatto del genitore o dell\'ente.', handX: '20%', handY: '15%', action: 'type' },
            { id: 1, caption: 'Gestione Figli', description: 'Aggiungi i bambini associati all\'anagrafica genitore.', handX: '45%', handY: '15%', action: 'click' },
            { id: 2, caption: 'Rating Qualitativo', description: 'Valuta l\'andamento didattico tramite il sistema a 4 assi.', handX: '75%', handY: '15%', action: 'click' },
            { id: 3, caption: 'Salvataggio', description: 'Conferma l\'inserimento per generare la scheda cliente.', handX: '50%', handY: '85%', action: 'click' }
        ]
    },
    'Fornitori': {
        title: 'Configurazione Asset',
        emulatorType: 'suppliers',
        steps: [
            { id: 0, caption: 'Anagrafica Sede', description: 'Inserisci indirizzo e parametri di costo del nolo.', handX: '50%', handY: '20%', action: 'type' },
            { id: 1, caption: 'Slot Orari', description: 'Configura la disponibilità oraria per abilitare l\'assegnazione.', handX: '80%', handY: '45%', action: 'click' }
        ]
    },
    'Attività': {
        title: 'Libreria Didattica',
        emulatorType: 'activities',
        steps: [
            { id: 0, caption: 'Archivio Idee', description: 'Consulta le proposte didattiche caricate in precedenza.', handX: '30%', handY: '30%', action: 'idle' },
            { id: 1, caption: 'Nuovo Materiale', description: 'Aggiungi link multimediali o foto per le lezioni future.', handX: '80%', handY: '80%', action: 'click' }
        ]
    },
    'Impostazioni': {
        title: 'Controllo Sistema',
        emulatorType: 'settings',
        steps: [
            { id: 0, caption: 'Nuovo Listino', description: 'Crea pacchetti K- (Kid) o A- (Adult).', handX: '50%', handY: '20%', action: 'click' },
            { id: 1, caption: 'Naming Enterprise', description: 'Usa il formato corretto per la tracciabilità fiscale.', handX: '50%', handY: '45%', action: 'type' }
        ]
    }
};

const Manual: React.FC = () => {
    const [activeMissionKey, setActiveMissionKey] = useState<string>('Dashboard');
    const [loading, setLoading] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    const navItems = [
        { key: 'Dashboard', label: 'Dashboard', icon: '📊' },
        { key: 'Calendario', label: 'Calendario', icon: '📅' },
        { key: 'Iscrizioni', label: 'Iscrizioni', icon: '📝' },
        { key: 'Archivio Iscrizioni', label: 'Archivio Iscrizioni', icon: '📁' },
        { key: 'Registro Elettronico', label: 'Registro Elettronico', icon: '📖' },
        { key: 'Presenze', label: 'Presenze', icon: '✅' },
        { key: 'Finanza', label: 'Finanza', icon: '💰' },
        { key: 'CRM', label: 'CRM', icon: '📱' },
        { key: 'Clienti', label: 'Clienti', icon: '👥' },
        { key: 'Fornitori', label: 'Fornitori', icon: '🏢' },
        { key: 'Attività', label: 'Attività', icon: '⚽' },
        { key: 'Impostazioni', label: 'Impostazioni', icon: '⚙️' }
    ];

    const currentMission = MISSIONS[activeMissionKey] || MISSIONS['Dashboard'];
    const currentDetails = MISSION_DETAILS[activeMissionKey] || MISSION_DETAILS['Dashboard'];

    if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4 md:gap-8 animate-fade-in pb-20">
            
            {/* Sidebar / Navbar Top (Mobile Adaptivity) */}
            <aside className="lg:w-80 flex-shrink-0 order-first">
                <div className="sticky top-0 lg:top-8 bg-white p-4 md:p-6 lg:rounded-[32px] rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 md:mb-6 px-2 md:px-4">Moduli Sistema</h3>
                    
                    {/* Griglia a 3 righe per Mobile, Lista per Desktop */}
                    <div className="overflow-x-auto overflow-y-auto lg:overflow-visible">
                        <ul className="grid lg:block grid-rows-3 grid-flow-col gap-2 min-w-max lg:min-w-0 lg:space-y-1 pb-2 lg:pb-0">
                            {navItems.map(item => (
                                <li key={item.key}>
                                    <button 
                                        onClick={() => {
                                            setActiveMissionKey(item.key);
                                            contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className={`lg:w-full text-left px-3 lg:px-4 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap ${activeMissionKey === item.key ? 'bg-indigo-600 text-white shadow-lg ring-2 lg:ring-4 ring-indigo-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                                    >
                                        <span className="text-xs md:text-sm">{item.icon}</span>
                                        <span className="uppercase tracking-tighter">{item.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </aside>

            {/* Area Simulatore & Content */}
            <main 
                ref={contentRef}
                className="flex-1 bg-white p-4 md:p-12 md:rounded-[48px] rounded-3xl border border-slate-200 shadow-2xl overflow-y-auto custom-scrollbar lg:h-[calc(100vh-140px)]"
            >
                <div className="w-full mx-auto lg:max-w-4xl">
                    <div className="mb-8 md:mb-12">
                        <div className="flex items-center gap-3 md:gap-4 mb-1 md:mb-2">
                            <span className="h-1 w-8 md:w-12 bg-indigo-600 rounded-full"></span>
                            <p className="text-slate-400 font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-[8px] md:text-[10px]">Learning Simulation EP v.1</p>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic">
                            Guida: {activeMissionKey}
                        </h1>
                    </div>

                    <div className="mb-8 md:mb-12 w-full">
                        <UIEmulator mission={currentMission} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                        {/* OBIETTIVO OPERATIVO DINAMICO */}
                        <div className="bg-slate-50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 transition-all duration-500">
                            <h4 className="text-[10px] md:text-[11px] font-black text-indigo-700 uppercase mb-3 md:mb-4 tracking-widest flex items-center gap-2">
                                <span className="text-base md:text-lg">🎯</span> Obiettivo Operativo
                            </h4>
                            <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-bold">
                                {currentDetails.objective}
                            </p>
                        </div>

                        {/* CONSIGLI PRO DINAMICI */}
                        <div className="bg-amber-50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-amber-200 transition-all duration-500">
                            <h4 className="text-[10px] md:text-[11px] font-black text-amber-700 uppercase mb-3 md:mb-4 tracking-widest flex items-center gap-2">
                                <span className="text-base md:text-lg">💡</span> Consigli Pro
                            </h4>
                            <ul className="text-[10px] md:text-xs text-amber-900 font-bold space-y-2 md:space-y-3">
                                {currentDetails.pros.map((pro, i) => (
                                    <li key={i} className="flex gap-2">
                                        <span className="text-amber-400">•</span>
                                        <span>{pro}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 md:mt-20 pt-8 md:pt-12 border-t border-slate-100 text-center">
                        <div className="inline-block bg-slate-900 px-6 md:px-10 py-3 md:py-5 rounded-3xl md:rounded-[32px] shadow-2xl">
                            <p className="text-[9px] md:text-[11px] text-white font-black uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center gap-3 md:gap-4">
                                <span className="text-amber-400 text-xl md:text-2xl animate-pulse">✨</span> 
                                Manuale Operativo Aggiornato: 18/01/2026
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Manual;