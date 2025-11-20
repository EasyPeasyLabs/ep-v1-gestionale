
import React, { useEffect, useRef } from 'react';
import { getPeriodicChecks } from '../services/settingsService';
import { PeriodicCheck } from '../types';

const NotificationScheduler: React.FC = () => {
    const checksRef = useRef<PeriodicCheck[]>([]);
    const lastNotifiedRef = useRef<Record<string, number>>({});
    const intervalRef = useRef<any>(null);

    useEffect(() => {
        // Caricamento iniziale dei check
        const loadChecks = async () => {
            try {
                const data = await getPeriodicChecks();
                checksRef.current = data;
            } catch (e) {
                console.error("Scheduler: Failed to load checks", e);
            }
        };
        loadChecks();

        // Polling ogni 10 secondi
        intervalRef.current = setInterval(() => {
            const now = new Date();
            const currentDay = now.getDay(); // 0-6 (Dom-Sab)
            const currentHour = String(now.getHours()).padStart(2, '0');
            const currentMinute = String(now.getMinutes()).padStart(2, '0');
            const currentTime = `${currentHour}:${currentMinute}`;

            if (!checksRef.current) return;

            checksRef.current.forEach(check => {
                // 1. Verifica abilitazione e giorno
                if (check.pushEnabled && check.daysOfWeek.includes(currentDay)) {
                    // 2. Verifica Orario
                    if (check.startTime === currentTime) {
                        // 3. Verifica Anti-Spam (evita notifiche multiple nello stesso minuto)
                        const lastTime = lastNotifiedRef.current[check.id] || 0;
                        if (Date.now() - lastTime > 60000) { // Almeno 1 minuto dall'ultima
                            
                            sendNotification(check);
                            lastNotifiedRef.current[check.id] = Date.now();
                        }
                    }
                }
            });

        }, 10000); // Check ogni 10s

        // Aggiorna i dati se l'utente modifica le impostazioni (tramite evento globale)
        const handleDataUpdate = () => loadChecks();
        window.addEventListener('EP_DataUpdated', handleDataUpdate);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('EP_DataUpdated', handleDataUpdate);
        };
    }, []);

    const sendNotification = (check: PeriodicCheck) => {
        if (!('Notification' in window)) return;
        
        // Tenta di inviare solo se permesso concesso
        if (Notification.permission === 'granted') {
            try {
                // Utilizziamo il logo dell'app se disponibile
                new Notification(`EP Planner: ${check.category}`, {
                    body: check.note || `È ora del controllo periodico: ${check.subCategory || check.category}`,
                    icon: '/lemon_logo_150px.png',
                    tag: `ep-check-${check.id}`, // Tag univoco per evitare duplicati nel centro notifiche
                    requireInteraction: true // Richiede azione utente per sparire (più visibile)
                });
            } catch (e) {
                console.warn("Errore invio notifica:", e);
            }
        }
    };

    return null; // Componente senza UI
};

export default NotificationScheduler;
