
import React from 'react';

const CRM: React.FC = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold">CRM</h1>
            <p className="mt-1" style={{color: 'var(--md-text-secondary)'}}>Gestione relazioni clienti e rinnovi.</p>

            <div className="mt-8 md-card p-6 flex flex-col items-center justify-center h-64 bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Sezione in arrivo</h3>
                <p className="text-gray-500 text-center max-w-sm mt-2">
                    Questa sezione mostrerà le proposte commerciali per le iscrizioni in scadenza, suggerendo rinnovi o nuovi pacchetti in base alla data di inizio e fine delle iscrizioni.
                </p>
            </div>
        </div>
    );
};

export default CRM;
