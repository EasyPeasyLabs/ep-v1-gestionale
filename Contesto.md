
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
- [x] **Calendario**: Vista mensile, drag & drop (desktop), gestione lezioni extra.
- [x] **Finanza**: Dashboard CFO, proiezioni fiscali, gestione Transazioni, Fatture e Preventivi.
- [x] **Export PDF**: Generazione documenti fiscali professionali.

### Advanced Features (Completate)
- [x] **CRM**: Gestione rinnovi, comunicazioni massive, campagne marketing.
- [x] **Registro Presenze**: Gestione giornaliera, recuperi automatici o manuali.
- [x] **Registro Attività**: Libreria didattica e assegnazione attività alle lezioni.
- [x] **Controllo di Gestione**: Analisi profittabilità per sede, costi logistica.
- [x] **Rating System**: Valutazione qualitativa a 4 assi per Genitori, Bambini, Fornitori, Sedi.
- [x] **Notifiche**: Sistema ibrido (Scheduler locale + Push Notifications FCM).

### UX & Mobile (Completate)
- [x] **Design System**: UI Enterprise con TailwindCSS, animazioni fluide.
- [x] **PWA**: Icona dinamica personalizzabile, supporto installazione.
- [x] **Mobile Optimization**:
    - [x] **Move Mode**: Gestione spostamenti iscrizioni touch-friendly.
    - [x] Layout responsivi e navigazione a schede.

### In Sviluppo / Next Steps
- [ ] **Pagina Iscrizioni Pubblica**: Integrazione con "Buffer Database" (Progetto B).
- [ ] **Importazione Lead**: Funzione per importare i dati dal buffer pubblico.
