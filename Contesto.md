
# Contesto del Progetto "EP v.1"

Questo documento contiene la richiesta utente iniziale che ha dato il via allo sviluppo dell'applicazione gestionale "EP v.1".

## Richiesta Utente Originale

Crea un'app gestionale completa di livello enterprise per la mia attività.
L'applicazione deve chiamarsi "EP v.1"
Sto già usando VS Code per tenere traccia del codebase.
Ho già creato:
- un SDK su Firebase
- un account GitHub per il progetto che si chiama "EasyPeasyLabs" e il relativo repository che si chiama "ep-v1-gestionale"

## Stato di Avanzamento (Roadmap)

Di seguito lo stato corrente delle funzionalità implementate al **18 Dicembre 2025**:

### Core Features (Completate)
- [x] **Autenticazione**: Login Admin via Firebase Auth.
- [x] **Gestione Clienti**: CRUD completo, anagrafica Genitori/Enti, gestione Figli.
- [x] **Gestione Fornitori**: CRUD completo, gestione Sedi multiple con slot orari.
- [x] **Iscrizioni**: Workflow iscrizione guidato, generazione automatica lezioni, gestione pagamenti (Acconto/Saldo).
- [x] **Iscrizioni Adulti**: Supporto per corsi destinati ai genitori/adulti con listini dedicati (Prefissi K/A).
- [x] **Calendario**: Vista mensile, drag & drop (desktop), gestione lezioni extra.
- [x] **Finanza (SIGILLATO)**: 
    - **Dashboard CFO**: Strategia con proiezioni fiscali Regime Forfettario.
    - **Scenario Start-up**: Logica fiscale specifica per nuove attività (I Tranche al 150% del saldo corrente, II Tranche al 50%).
    - **Simulatore Rate**: Calcolo automatico accantonamenti mensili e scadenze Bolli Virtuali (con logica cumulo).
    - **Smart Insight (Educational)**: Card interattive per l'analisi della profittabilità delle sedi spiegate in linguaggio naturale ("Torta Ricavi", "Cosa ti rimane in tasca").
    - **Documentale**: Gestione completa Transazioni, Fatture (con Sigillo SDI, Bollo Virtuale auto-calcolato) e Preventivi.
    - **Modifica Avanzata**: Editor completo post-emissione per fatture.
- [x] **Export PDF**: Generazione client-side di documenti fiscali professionali.

### Advanced Features (Completate)
- [x] **Registro Elettronico**:
    - **Lezioni**: Log attività svolte e collegamenti didattici.
    - **Compiti**: Gestione assegnazione compiti (Manuale o Multimedia) e invio WhatsApp.
- [x] **Iniziative & Biblioteca**:
    - **Iniziative**: Gestione progetti speciali.
    - **Peek-a-Boo(k)**: Sistema bibliotecario (Inventario, Prestiti, Restituzioni per studente/sede).
- [x] **CRM**: 
    - Gestione rinnovi e scadenze.
    - Campagne marketing e comunicazioni massive (Email/WhatsApp).
    - Archivio Log Comunicazioni.
- [x] **Registro Presenze**: Gestione giornaliera/mensile, calcolo presenze, recuperi automatici o manuali.
- [x] **Controllo di Gestione Avanzato**:
    - Analisi profittabilità Sedi (Ricavi Reali vs Costi Nolo).
    - TCO Logistica (Costo per km, usura, carburante).
    - AI Reverse Engineering per obiettivi di fatturato.
- [x] **Rating System**: Valutazione qualitativa a 4 assi per Genitori, Bambini, Fornitori, Sedi.
- [x] **Notifiche**: Sistema ibrido (Scheduler locale + Push Notifications FCM server-side).
- [x] **Deep Cleaning (Cascading Delete)**: Integrità referenziale gestita via software (eliminazione a cascata di entità collegate).

### UX & Mobile (Completate)
- [x] **Design System**: UI Enterprise con TailwindCSS, animazioni fluide, palette personalizzabile.
- [x] **PWA**: Icona dinamica personalizzabile, supporto installazione, Service Worker.
- [x] **Mobile Optimization**:
    - [x] **Move Mode**: Gestione spostamenti iscrizioni touch-friendly.
    - [x] Layout responsivi, bottom navigation tabs e sidebar a scomparsa.
- [x] **User Preferences**: Toggle visualizzazione Nome/Cognome, Temi colore.

### In Sviluppo / Next Steps
- [ ] **Pagina Iscrizioni Pubblica**: Integrazione con "Buffer Database" (Progetto B).
- [ ] **Importazione Lead**: Funzione per importare i dati dal buffer pubblico.
