
# Architettura dell'Applicazione "EP v.1"

Questo documento descrive l'architettura software, le scelte tecnologiche e il modello dei dati dell'applicazione gestionale "EP v.1".

## 1. Panoramica Generale

"EP v.1" è una Single Page Application (SPA) progettata per gestire tutte le operazioni di una scuola di lingua inglese per bambini. L'architettura è basata su un frontend moderno e reattivo che interagisce con i servizi BaaS (Backend-as-a-Service) di Google Firebase, garantendo scalabilità, sicurezza e sviluppo rapido.

## 2. Stack Tecnologico

- **Frontend**:
  - **Libreria UI**: React.js
  - **Linguaggio**: TypeScript
  - **Styling**: TailwindCSS con un sistema di design custom basato su Material Design (variabili CSS).
  - **Librerie Aggiuntive**: `chart.js` per i grafici (con config avanzate per effetti 3D), `xlsx` per l'import/export da Excel, `jspdf` per la generazione documenti.
- **Backend (BaaS)**:
  - **Database**: Google Firestore (NoSQL, document-based)
  - **Autenticazione**: Firebase Authentication
  - **Storage**: Firebase Storage (per upload file campagne e allegati attività)
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
- `/pages`: Contiene i componenti "intelligenti" (container) che rappresentano le pagine principali dell'applicazione (es. `Clients.tsx`, `Dashboard.tsx`, `Initiatives.tsx`). Questi componenti gestiscono la logica di business e il recupero dei dati.
- `/services`: Contiene la logica per la comunicazione con Firebase. Ogni file (es. `homeworkService.ts`, `initiativeService.ts`) astrae le operazioni CRUD per una specifica collection di Firestore.
- `/firebase`: Contiene la configurazione e l'inizializzazione di Firebase (`config.ts`).
- `/types`: Contiene le definizioni dei tipi TypeScript (`types.ts`) usate in tutta l'applicazione, garantendo la coerenza del modello dati.
- `/functions`: Contiene il codice backend Node.js per le Cloud Functions.
- `/data`: Inizialmente conteneva dati di mock, ora è obsoleto in favore di Firebase.

### 3.2. Modello Dati Esteso

Oltre alle entità base (Clienti, Fornitori, Iscrizioni), il sistema gestisce:
- **Homework**: Compiti assegnati, linkati opzionalmente a date e sedi.
- **Initiative**: Progetti speciali.
- **Book & BookLoan**: Sistema di inventario e prestiti per la biblioteca "Peek-a-Boo(k)".
- **Activity**: Libreria didattica multimediale.

### 3.3. Gestione dello Stato e Flusso Dati

Lo stato è gestito principalmente a livello di componente tramite i React Hooks (`useState`, `useEffect`, `useCallback`).
- **Stato Globale**: Non è presente una libreria di state management globale (come Redux o Zustand) per semplicità. Lo stato dell'utente autenticato è gestito nel componente radice `App.tsx` e passato tramite props.
- **Event Bus**: È stato introdotto un semplice sistema di eventi custom (`window.dispatchEvent('EP_DataUpdated')`) per notificare i componenti (es. `Header` per le notifiche) quando i dati vengono modificati in altre parti dell'app.
- **PWA Dinamica**: La gestione del file `manifest.json` è ibrida. `App.tsx` genera a runtime un manifest "virtuale" (Blob URL) che inietta il logo aziendale recuperato da Firestore come icona dell'app.

### 3.4. UX Mobile & Interazioni

L'applicazione adotta strategie specifiche per l'uso mobile:
- **Move Mode (Macchina a Stati)**: Nella gestione delle iscrizioni (`Enrollments.tsx`) e Calendario, è stata implementata una logica ibrida per lo spostamento degli elementi (Tap-to-Select -> Tap-to-Place).
- **Visual Feedback**: Uso intensivo di indicatori visivi per comunicare lo stato degli oggetti senza hover.
- **Navigazione**: Sidebar a scomparsa con backdrop blur e menu header ottimizzato.

### 3.5. Integrità Dati e Pulizia (Cascading Deletes)

Per mantenere la coerenza del database, è stata implementata una logica di **Deep Cleaning**:
- Quando un'iscrizione viene eliminata, il sistema (via `financeService.ts`) intercetta e rimuove tutte le entità correlate (transazioni, fatture, log attività, noli automatici).
