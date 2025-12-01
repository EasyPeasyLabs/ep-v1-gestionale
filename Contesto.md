
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

Di seguito lo stato corrente delle funzionalità implementate:

### Core Features (Completate)
- [x] **Autenticazione**: Login Admin via Firebase Auth.
- [x] **Gestione Clienti**: CRUD completo, anagrafica Genitori/Enti, gestione Figli.
- [x] **Gestione Fornitori**: CRUD completo, gestione Sedi multiple con slot orari.
- [x] **Iscrizioni**: Workflow iscrizione guidato, generazione automatica lezioni, gestione pagamenti (Acconto/Saldo).
- [x] **Iscrizioni Adulti**: Supporto per corsi destinati ai genitori/adulti con listini dedicati (Prefissi K/A).
- [x] **Calendario**: Vista mensile, drag & drop (desktop), gestione lezioni extra.
- [x] **Finanza**: Dashboard CFO, proiezioni fiscali, gestione Transazioni, Fatture e Preventivi.
- [x] **Export PDF**: Generazione documenti fiscali professionali.

### Advanced Features (Completate)
- [x] **Registro Elettronico**:
    - **Lezioni**: Log attività svolte.
    - **Compiti**: Gestione assegnazione compiti (Manuale o Multimedia/Link). Invio liste compiti via WhatsApp a gruppi (Recinti) o singoli.
- [x] **Iniziative & Biblioteca**:
    - **Iniziative**: Gestione progetti speciali e materiali.
    - **Peek-a-Boo(k)**: Sistema di gestione prestiti libri (Inventario, Check-out/Check-in, Tracciamento per studente/sede).
- [x] **CRM**: Gestione rinnovi, comunicazioni massive, campagne marketing.
- [x] **Registro Presenze**: Gestione giornaliera, recuperi automatici o manuali.
- [x] **Registro Attività**: Libreria didattica e assegnazione attività alle lezioni.
- [x] **Controllo di Gestione Avanzato**:
    - Analisi olistica profittabilità Sedi vs Costi.
    - Separazione netta dei costi logistici e di nolo.
    - Dashboard CFO con grafici interattivi 3D e azioni strategiche dinamiche.
- [x] **Rating System**: Valutazione qualitativa a 4 assi per Genitori, Bambini, Fornitori, Sedi.
- [x] **Notifiche**: Sistema ibrido (Scheduler locale + Push Notifications FCM).
- [x] **Deep Cleaning (Cascading Delete)**: Eliminazione a cascata di iscrizioni, lezioni, presenze, transazioni, fatture, noli automatici e log attività didattiche.

### UX & Mobile (Completate)
- [x] **Design System**: UI Enterprise con TailwindCSS, animazioni fluide.
- [x] **PWA**: Icona dinamica personalizzabile, supporto installazione.
- [x] **Mobile Optimization**:
    - [x] **Move Mode**: Gestione spostamenti iscrizioni touch-friendly.
    - [x] Layout responsivi e navigazione a schede.
- [x] **User Preferences**: Toggle visualizzazione Nome/Cognome.

### In Sviluppo / Next Steps
- [ ] **Pagina Iscrizioni Pubblica**: Integrazione con "Buffer Database" (Progetto B).
- [ ] **Importazione Lead**: Funzione per importare i dati dal buffer pubblico.
