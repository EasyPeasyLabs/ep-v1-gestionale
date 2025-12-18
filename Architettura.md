
# Architettura Tecnica - EP v.1

Questo documento descrive in dettaglio l'architettura software, le scelte tecnologiche e il flusso dei dati dell'applicazione "EP v.1".

## 1. Stack Tecnologico

Il progetto è una Single Page Application (SPA) moderna, basata su un'architettura **Serverless** e **Backend-as-a-Service (BaaS)**.

### Frontend
-   **Core**: React 19 + TypeScript.
-   **Build Tool**: Vite (Bundle ESM veloce).
-   **Styling**: TailwindCSS con Design System custom basato su CSS Variables (tematizzazione dinamica).
-   **Visualization**: Chart.js con configurazioni avanzate per dashboard finanziarie.
-   **Reports**: `jspdf` e `jspdf-autotable` per la generazione client-side di PDF (Fatture, Preventivi).
-   **Excel**: `xlsx` per importazione/esportazione dati massivi.

### Backend (Firebase Ecosystem)
-   **Database**: Google Cloud Firestore (NoSQL Document Store).
    -   Modalità Offline: `persistentLocalCache` abilitata per resilienza di rete.
    -   **Indici**: Utilizzo di `firestore.indexes.json` per definire indici composti necessari per query complesse (es. ordinamento per data + filtro per stato cancellazione).
-   **Auth**: Firebase Authentication (Gestione Admin).
-   **Storage**: Firebase Cloud Storage (Media, allegati campagne e attività).
-   **Serverless Functions**: Firebase Cloud Functions Gen 2 (Node.js 20).
    -   Utilizzate per Task Cron (Scheduler notifiche) e logiche server-side sicure.
-   **Messaging**: Firebase Cloud Messaging (FCM) per notifiche Web Push (supporto PWA/Android).

### Deployment
-   **Hosting**: Vercel (CI/CD automatico su push Git).

---

## 2. Architettura Frontend

L'applicazione segue un'architettura modulare basata su **Componenti** e **Servizi**.

### 2.1 Struttura Cartelle
-   `/components`: Componenti UI riutilizzabili (presentazionali).
    -   `Sidebar`, `Header`, `Modal`, `StatCard`.
-   `/pages`: Componenti Container (Smart) che gestiscono lo stato e la logica di business.
-   `/services`: Layer di astrazione per le chiamate al database. Ogni entità (es. `financeService.ts`) incapsula la logica CRUD e di business (es. calcoli fiscali).
-   `/utils`: Helper puri (es. generazione PDF, formattazione date, gestione temi).

### 2.2 Core Engines (Logica Applicativa)

L'intelligenza dell'applicazione risiede in diversi "Motori Logici" eseguiti principalmente client-side per massima reattività:

1.  **Enrollment Engine (`enrollments.tsx`)**:
    -   Gestisce il ciclo di vita delle iscrizioni.
    -   Implementa la logica **Move Mode**: una macchina a stati per lo spostamento di lezioni tra "recinti" (Sedi/Orari) via Drag&Drop o Touch.
    -   Gestisce la generazione automatica delle lezioni (Appointments) basata sulla durata del pacchetto.

2.  **Finance & CFO Engine (`finance.tsx`)**:
    -   Calcola in tempo reale le proiezioni fiscali (Regime Forfettario/Start-up).
    -   Aggrega transazioni per generare il conto economico (P&L) e lo stato patrimoniale.
    -   **Controlling**: Incrocia i dati delle Iscrizioni con le Transazioni per calcolare la profittabilità per Sede (Centro di Costo).

3.  **Notification Engine (`notificationService.ts`)**:
    -   Sistema ibrido che unifica scadenze (Iscrizioni), alert operativi (Fatture non inviate) e pagamenti pendenti.
    -   Supporta notifiche in-app e Push.

### 2.3 Data Integrity (Deep Cleaning)

Per garantire la coerenza in un DB NoSQL non relazionale, è stata implementata una logica di **Cascading Delete** via software:
-   Quando un'entità "padre" (es. Iscrizione o Cliente) viene eliminata, i service (`financeService`, `enrollmentService`) si occupano di eliminare ricorsivamente tutte le entità "figlie" correlate (Lezioni, Presenze, Transazioni, Fatture, Log Attività).

---

## 3. Modello Dati (Firestore)

Il database è strutturato in collezioni principali:

-   `clients`: Anagrafica Genitori ed Enti (include sub-array `children` e `rating`).
-   `suppliers`: Anagrafica Fornitori e Sedi (`locations` nested con availability slots).
-   `enrollments`: Entità pivotale che collega Cliente, Bambino, Sede e Pacchetto. Contiene l'array `appointments` (calendario lezioni).
-   `transactions`: Libro mastro (Ledger) per entrate/uscite. Campi chiave: `allocationId` (per il controllo di gestione), `relatedDocumentId`.
-   `invoices` / `quotes`: Documenti fiscali.
-   `lessons`: Lezioni manuali/extra (fuori dal ciclo iscrizioni).
-   `periodicChecks`: Configurazione scheduler controlli.
-   `communications` / `campaigns`: Log CRM.
-   `activities`: Libreria didattica.
-   `books` / `book_loans`: Gestione biblioteca.

---

## 4. Sicurezza e Performance

-   **Authentication**: Accesso protetto via email/password (Admin).
-   **Security Rules**: Firestore Rules configurate per permettere lettura/scrittura solo agli utenti autenticati.
-   **Performance**:
    -   Uso intensivo di `Promise.all` per il caricamento parallelo dei dati.
    -   Indicizzazione Firestore (`indexes.json`) per query complesse (ordinamenti e filtri multipli).
    -   Lazy loading delle rotte (via Vite) per ridurre il bundle iniziale.
-   **Offline First**: Grazie alla cache persistente di Firestore, l'app è consultabile e parzialmente operativa anche senza rete.

## 5. PWA & Integrazione Mobile

-   **Manifest Dinamico**: Il file `manifest.json` viene manipolato a runtime per iniettare il logo aziendale personalizzato dell'utente.
-   **Service Worker**: Gestisce la cache degli asset statici e la ricezione delle notifiche Push background.
-   **Touch Interactions**: L'interfaccia è ottimizzata per il touch (bottoni grandi, swipe, modalità "Sposta" specifica per mobile).
