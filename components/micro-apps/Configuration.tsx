import React, { useState, useEffect } from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { REGIME_FISCALE_OPTIONS, EMPTY_CONFIGURAZIONE } from '../../constants';
import { ConfigurazioneAzienda, RegimeFiscale, Indirizzo } from '../../types';

export const Configuration: React.FC = () => {
    const { configurazione, updateConfigurazione } = useMockData();
    const [formData, setFormData] = useState<ConfigurazioneAzienda>(EMPTY_CONFIGURAZIONE);

    useEffect(() => {
        if (configurazione) {
            setFormData(configurazione);
        } else {
            setFormData(EMPTY_CONFIGURAZIONE);
        }
    }, [configurazione]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as RegimeFiscale }));
    };

    const handleAziendaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            datiAzienda: {
                ...prev.datiAzienda,
                [name]: value,
            }
        }));
    };

    const handleIndirizzoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            datiAzienda: {
                ...prev.datiAzienda,
                indirizzo: {
                    ...(prev.datiAzienda.indirizzo as Indirizzo),
                    [name]: value,
                }
            }
        }));
    };

    const handleSave = () => {
        const { id, ...dataToSave } = formData;
        updateConfigurazione(dataToSave).then(() => {
            alert('Configurazione salvata con successo!');
        }).catch((error) => {
            console.error("Errore nel salvataggio della configurazione:", error);
            alert('Si è verificato un errore durante il salvataggio.');
        });
    };
    
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Configurazione</h1>
            
            <div className="space-y-8">
                {/* Dati Azienda */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold mb-4">Dati Azienda</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input id="ragioneSociale" name="ragioneSociale" label="Ragione Sociale" value={formData.datiAzienda.ragioneSociale} onChange={handleAziendaChange} />
                            <Input id="partitaIva" name="partitaIva" label="Partita IVA / C.F." value={formData.datiAzienda.partitaIva} onChange={handleAziendaChange} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input id="email" name="email" label="Email" type="email" value={formData.datiAzienda.email} onChange={handleAziendaChange} />
                            <Input id="telefono" name="telefono" label="Telefono" value={formData.datiAzienda.telefono} onChange={handleAziendaChange} />
                        </div>
                        <div className="pt-4">
                            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Indirizzo Sede Legale</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <div className="md:col-span-2">
                                    <Input id="via" name="via" label="Via / Piazza" value={formData.datiAzienda.indirizzo.via} onChange={handleIndirizzoChange} />
                                </div>
                                <Input id="civico" name="civico" label="N. Civico" value={formData.datiAzienda.indirizzo.civico} onChange={handleIndirizzoChange} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <Input id="cap" name="cap" label="CAP" value={formData.datiAzienda.indirizzo.cap} onChange={handleIndirizzoChange} />
                                <Input id="citta" name="citta" label="Città" value={formData.datiAzienda.indirizzo.citta} onChange={handleIndirizzoChange} />
                                <Input id="provincia" name="provincia" label="Provincia" value={formData.datiAzienda.indirizzo.provincia} onChange={handleIndirizzoChange} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Regime Fiscale */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold mb-4">Impostazioni Fiscali</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Seleziona il regime fiscale da applicare. Questa impostazione influenzerà la creazione dei documenti e le simulazioni.</p>
                    <Select
                        id="regimeFiscale"
                        name="regimeFiscale"
                        label="Regime Fiscale Attuale"
                        options={REGIME_FISCALE_OPTIONS}
                        value={formData.regimeFiscale}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end">
                <Button onClick={handleSave} variant="primary">Salva Modifiche</Button>
            </div>
        </div>
    );
};