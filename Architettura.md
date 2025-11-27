
# Architettura dell'Applicazione "EP v.1"

Questo documento descrive l'architettura software, le scelte tecnologiche e il modello dei dati dell'applicazione gestionale "EP v.1".

## 1. Panoramica Generale

"EP v.1" è una Single Page Application (SPA) progettata per gestire tutte le operazioni di una scuola di lingua inglese per bambini. L'architettura è basata su un frontend moderno e reattivo che interagisce con i servizi BaaS (Backend-as-a-Service) di Google Firebase, garantendo scalabilità, sicurezza e sviluppo rapido.

## 2. Stack Tecnologico

- **Frontend**:
  - **Libreria UI**: React.js
  - **Linguaggio**: TypeScript
  - **Styling**: TailwindCSS con un sistema di design custom basato su Material Design (variabili CSS).
  - **Librerie Aggiuntive**: `chart.js` per i grafici, `xlsx` per l'import/export da Excel, `jspdf` per la generazione documenti.
- **Backend (BaaS)**:
  - **Database**: Google Firestore (NoSQL, document-based)
  - **Autenticazione**: Firebase Authentication
  - **Storage**: Firebase Storage (per futuri upload di file come PDF)
  - **Serverless**: **Firebase Cloud Functions (Gen 2)** con Node.js 20 per logiche backend complesse (es. cron jobs).
  - **Scheduler**: **Firebase Cloud Scheduler** per l'esecuzione di task periodici (es. controllo notifiche ogni minuto).
  - **Notifications**: Sistema Ibrido.
    - *Frontend*: Scheduler locale (React) per notifiche a browser aperto.
    - *Backend*: **Web Push Notifications via Firebase Cloud Messaging (FCM)** triggerate dal server per notifiche a browser chiuso (supporto Android/PWA).
- **Deployment**:
  - **Hosting**: Vercel

## 3. Architettura Frontend

### 3.1. Struttura delle Cartelle

La codebase è organizzata in modo modulare per favorire la manutenibilità e la scalabilità.

- `/` (root): Contiene i file di configurazione (`index.html`, `tsconfig.json`, `metadata.json`) e il punto di ingresso dell'app (`index.tsx`).
- `/components`: Contiene componenti React riutilizzabili e "stupidi" (presentazionali), come `Modal.tsx`, `Spinner.tsx`, `Sidebar.tsx`.
  - `/components/icons`: Sotto-cartella per componenti SVG icona.
  - **Note UI**: Le modali sono progettate con `max-h-[90dvh]` e scroll interno per garantire l'accessibilità su tutti i dispositivi.
- `/pages`: Contiene i componenti "intelligenti" (container) che rappresentano le pagine principali dell'applicazione, come `Clients.tsx`, `Dashboard.tsx`. Questi componenti gestiscono la logica di business e il recupero dei dati.
- `/services`: Contiene la logica per la comunicazione con Firebase. Ogni file (es. `parentService.ts`, `supplierService.ts`, `settingsService.ts`) astrae le operazioni CRUD per una specifica collection di Firestore, disaccoppiando la logica di accesso ai dati dalle pagine.
- `/firebase`: Contiene la configurazione e l'inizializzazione di Firebase (`config.ts`).
- `/types`: Contiene le definizioni dei tipi TypeScript (`types.ts`) usate in tutta l'applicazione, garantendo la coerenza del modello dati.
- `/functions`: Contiene il codice backend Node.js per le Cloud Functions.
- `/data`: Inizialmente conteneva dati di mock, ora è obsoleto in favore di Firebase.

### 3.2. Gestione dello Stato e Flusso Dati

Lo stato è gestito principalmente a livello di componente tramite i React Hooks (`useState`, `useEffect`, `useCallback`).
- **Stato Globale**: Non è presente una libreria di state management globale (come Redux o Zustand) per semplicità. Lo stato dell'utente autenticato è gestito nel componente radice `App.tsx` e passato tramite props.
- **Event Bus**: È stato introdotto un semplice sistema di eventi custom (`window.dispatchEvent('EP_DataUpdated')`) per notificare i componenti (es. `Header` per le notifiche) quando i dati vengono modificati in altre parti dell'app.
- **PWA Dinamica**: La gestione del file `manifest.json` (essenziale per l'installazione dell'app) è ibrida. Esiste un file statico di fallback (`public/manifest.json`), ma `App.tsx` genera a runtime un manifest "virtuale" (Blob URL) che inietta il logo aziendale recuperato da Firestore come icona dell'app e forza il nome a "EP v1".

### 3.3. Routing

Il routing è gestito internamente dal componente `App.tsx` attraverso uno stato (`currentPage`). Questo approccio è semplice e adatto per un'applicazione gestionale interna. Il cambio di pagina avviene tramite la funzione `setCurrentPage`, passata come prop.

### 3.4. Pagina Pubblica & Buffer Database (Nuova Feature)

Per gestire la raccolta iscrizioni online in sicurezza ("Lead Generation"), viene adottato il pattern **"Buffer Database"** con separazione fisica dei progetti:

1.  **Front-End Pubblico (Progetto Separato)**: Un'applicazione web distinta (repo `ep-iscrizioni-public`), accessibile a chiunque senza login. Usa un proprio progetto Firebase dedicato (**Project B**).
2.  **Database "Buffer" (Project B)**: Un database Firestore separato con regole di sicurezza che permettono la scrittura pubblica (`create`) ma non la lettura/modifica. Contiene solo i dati grezzi dei lead.
3.  **Importazione (EP v.1 - Project A)**: L'applicazione principale EP v.1 implementerà una funzione "Importa dal Web". Questa funzione utilizzerà una connessione secondaria a Firebase inizializzata con le credenziali di Project B (solo lato Admin) per leggere i lead, importarli nel database principale (Project A) e cancellarli dal buffer.
    *   Questo garantisce un "Air Gap" di sicurezza: il database principale non è mai esposto pubblicamente.

## 4. Architettura Backend (Firebase)

### 4.1. Firestore Data Model

Il database NoSQL Firestore è strutturato in collection di documenti.

- `clients`: Contiene le anagrafiche dei clienti.
  - **Struttura**: Include un array `children` per i genitori. 
  - **Novità**: Supporto per `notesHistory` (array di oggetti {id, date, content}) sia per il genitore che per i figli, sostituendo la logica della singola stringa note. Supporto campi avanzati figli: `rating` (4 criteri), `tags`.
- `suppliers`: Contiene i fornitori e le loro sedi (`locations` nested). 
  - **Novità**: Supporto `notesHistory` anche per Fornitori e Location.
- `settings`: Collection che contiene documenti singleton per le impostazioni globali (`companyInfo`).
- `subscriptionTypes`: Collection per i tipi di abbonamento/pacchetti lezione.
- `periodicChecks`: Collection per la gestione del planner delle verifiche periodiche.
- `lessons`: Contiene le lezioni manuali/extra create a calendario.
- `enrollments`: Collection centrale che lega un allievo a un corso.
  - **Struttura**: Contiene un array `appointments` che elenca tutte le date previste per il corso.
  - **Stato Lezioni**: Ogni oggetto in `appointments` ha un campo `status` (`Scheduled`, `Present`, `Absent`, `Cancelled`) per tracciare la frequenza.
  - **Automazione Finanziaria**: Il pagamento genera una Fattura e una Transazione collegata a essa.
- `transactions`: Collection per tutte le transazioni finanziarie.
  - Supporta nuova categoria `Capital` (Capitale Iniziale) per gestire budget di partenza.
- `invoices` & `quotes`: Collection per i documenti fiscali.
- `activities`: Collection "Libreria" delle attività didattiche disponibili.
- `lesson_activities`: Collection di log che associa una lezione (`lessonId`) a una o più attività svolte (`activityIds`).
- `fcm_tokens`: Collection di sistema per memorizzare i token dei dispositivi autorizzati a ricevere notifiche push.

### 4.2. Cloud Functions

Le Cloud Functions (Gen 2) eseguono logica server-side critica.
- `checkPeriodicNotifications`: Funzione schedulata (Cron Job ogni minuto) che controlla la collection `periodicChecks` e invia notifiche multicast ai device registrati in `fcm_tokens` se l'orario e il giorno coincidono.

### 4.3. Firebase Authentication

Viene utilizzato il servizio di autenticazione di Firebase per gestire il login degli utenti tramite email e password.

## 5. Moduli Funzionali

L'applicazione è suddivisa logicamente nei seguenti moduli:

- **Dashboard**: Vista d'insieme con KPI, grafici finanziari, avvisi e occupazione aule. Include la tab **Qualità & Rating** per analisi aggregata.
- **Clienti**: Gestione CRUD completa dei clienti e profilazione dettagliata figli (rating/tag/storico note).
- **Fornitori**: Gestione CRUD completa dei fornitori con storico note e sedi.
- **Calendario**: Pianificazione lezioni e visualizzazione occupazione.
- **Finanza**: Gestione transazioni, fatture, preventivi, automazione pagamenti e **Capitale Iniziale**.
- **CRM**: Gestione rinnovi, scadenze e sistema di **Comunicazione Libera** (invio messaggi manuali o massivi a liste di distribuzione via Email/WhatsApp).
- **Iscrizioni**: Gestione dei contratti attivi, monitoraggio avanzamento lezioni (progress bar).
- **Registro Presenze**: Modulo per la gestione giornaliera delle lezioni. Permette di segnare assenze e gestire automaticamente i recuperi.
- **Lezioni (Log Attività)**: Modulo per assegnare e tracciare le attività didattiche svolte durante ogni lezione.
- **Attività**: Libreria/Repository delle attività didattiche (titolo, tema, materiali, link).
- **Impostazioni**: Configurazione dati aziendali, listini, **Planner Verifiche Periodiche** e diagnostica notifiche.
