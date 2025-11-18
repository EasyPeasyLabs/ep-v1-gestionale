
# Architettura dell'Applicazione "EP v.1"

Questo documento descrive l'architettura software, le scelte tecnologiche e il modello dei dati dell'applicazione gestionale "EP v.1".

## 1. Panoramica Generale

"EP v.1" è una Single Page Application (SPA) progettata per gestire tutte le operazioni di una scuola di lingua inglese per bambini. L'architettura è basata su un frontend moderno e reattivo che interagisce con i servizi BaaS (Backend-as-a-Service) di Google Firebase, garantendo scalabilità, sicurezza e sviluppo rapido.

## 2. Stack Tecnologico

- **Frontend**:
  - **Libreria UI**: React.js
  - **Linguaggio**: TypeScript
  - **Styling**: TailwindCSS con un sistema di design custom basato su Material Design (variabili CSS).
  - **Librerie Aggiuntive**: `chart.js` per i grafici, `xlsx` per l'import/export da Excel.
- **Backend (BaaS)**:
  - **Database**: Google Firestore (NoSQL, document-based)
  - **Autenticazione**: Firebase Authentication
  - **Storage**: Firebase Storage (per futuri upload di file come PDF)
- **Deployment**:
  - **Hosting**: Vercel

## 3. Architettura Frontend

### 3.1. Struttura delle Cartelle

La codebase è organizzata in modo modulare per favorire la manutenibilità e la scalabilità.

- `/` (root): Contiene i file di configurazione (`index.html`, `tsconfig.json`, `metadata.json`) e il punto di ingresso dell'app (`index.tsx`).
- `/components`: Contiene componenti React riutilizzabili e "stupidi" (presentazionali), come `Modal.tsx`, `Spinner.tsx`, `Sidebar.tsx`.
  - `/components/icons`: Sotto-cartella per componenti SVG icona.
- `/pages`: Contiene i componenti "intelligenti" (container) che rappresentano le pagine principali dell'applicazione, come `Clients.tsx`, `Dashboard.tsx`. Questi componenti gestiscono la logica di business e il recupero dei dati.
- `/services`: Contiene la logica per la comunicazione con Firebase. Ogni file (es. `parentService.ts`, `supplierService.ts`) astrae le operazioni CRUD per una specifica collection di Firestore, disaccoppiando la logica di accesso ai dati dalle pagine.
- `/firebase`: Contiene la configurazione e l'inizializzazione di Firebase (`config.ts`).
- `/types`: Contiene le definizioni dei tipi TypeScript (`types.ts`) usate in tutta l'applicazione, garantendo la coerenza del modello dati.
- `/data`: Inizialmente conteneva dati di mock, ora è obsoleto in favore di Firebase.

### 3.2. Gestione dello Stato e Flusso Dati

Lo stato è gestito principalmente a livello di componente tramite i React Hooks (`useState`, `useEffect`, `useCallback`).
- **Stato Globale**: Non è presente una libreria di state management globale (come Redux o Zustand) per semplicità. Lo stato dell'utente autenticato è gestito nel componente radice `App.tsx` e passato tramite props.
- **Flusso Dati**: È unidirezionale. Le `pages` recuperano i dati tramite i `services`, li memorizzano nel loro stato locale e li passano ai componenti figli (`components`) come props. Le azioni utente nei componenti figli vengono gestite tramite callback passate dai componenti genitori.

### 3.3. Routing

Il routing è gestito internamente dal componente `App.tsx` attraverso uno stato (`currentPage`). Questo approccio è semplice e adatto per un'applicazione gestionale interna dove gli URL complessi non sono un requisito primario. Il cambio di pagina avviene tramite la funzione `setCurrentPage`, passata come prop.

## 4. Architettura Backend (Firebase)

### 4.1. Firestore Data Model

Il database NoSQL Firestore è strutturato in collection di documenti.

- `clients`: Contiene le anagrafiche dei clienti. Un campo `clientType` (`Parent` o `Institutional`) distingue i due tipi di cliente, permettendo una struttura di documento flessibile all'interno della stessa collection. I figli dei clienti `Parent` sono un array di oggetti nidificati.
- `suppliers`: Contiene i fornitori. Le sedi (`locations`) sono un array di oggetti nidificati all'interno di ogni documento fornitore.
- `settings`: Collection che contiene documenti singleton per le impostazioni globali.
  - `companyInfo` (documento): Memorizza i dati dell'azienda.
- `subscriptionTypes`: Collection per i tipi di abbonamento/pacchetti lezione.
- `lessons`: Sostituisce la vecchia collection `scheduledClasses`. Contiene ogni singola lezione come un evento datato (con un campo `date` invece di `dayOfWeek`), permettendo una pianificazione flessibile. Utilizza dati denormalizzati (es. `supplierName`, `locationName`) per semplificare le query di lettura.
- `enrollments`: Collection che lega un `clientId` e un `childId` a un `subscriptionTypeId` e a un `lessonId`, rappresentando l'associazione di un allievo a una lezione specifica e datata.
- `transactions`: Collection per tutte le transazioni finanziarie (entrate e uscite). Include un campo `relatedDocumentId` per collegare la transazione alla fattura o iscrizione che l'ha generata.
- `invoices` & `quotes`: Collection per i documenti fiscali.

### 4.2. Firebase Authentication

Viene utilizzato il servizio di autenticazione di Firebase per gestire il login degli utenti tramite email e password. Il componente `App.tsx` ha un listener `onAuthStateChanged` che reagisce ai cambiamenti dello stato di autenticazione per mostrare la pagina di login o l'interfaccia principale.

## 5. Moduli Funzionali

L'applicazione è suddivisa logicamente nei seguenti moduli, che corrispondono alle pagine principali:

- **Dashboard**: Fornisce una vista d'insieme con statistiche chiave.
- **Clienti**: Gestione CRUD completa dei clienti (genitori e istituzionali), inclusa la gestione dei figli e delle iscrizioni.
- **Fornitori**: Gestione CRUD completa dei fornitori e delle loro sedi operative.
- **Calendario**: Potente strumento di pianificazione con una vista di calendario mensile interattiva. Supporta la creazione di lezioni singole in date specifiche e la generazione automatica di lezioni ricorrenti.
- **Finanza**: 
    - Tracciamento completo di entrate e uscite.
    - **Automazione**: Le fatture in stato "Pagato" generano automaticamente (o aggiornano) una transazione di entrata corrispondente, mantenendo una relazione 1-a-1 rigorosa per evitare duplicati.
    - **Visualizzazione**: Dashboard finanziaria con grafici a barre (mensile), grafici a ciambella (ripartizione costi e ricavi con percentuali) e proiezioni fiscali per regime forfettario.
    - **Documenti**: Gestione fatture e preventivi con generazione PDF.
- **Impostazioni**: Configurazione dei dati aziendali e del listino prezzi (pacchetti abbonamento).
- **Importazione Dati**: Funzionalità per l'import di massa di clienti e fornitori da file Excel.

## 6. Sicurezza

- **Regole di Firestore**: Le regole di sicurezza di Firestore verranno configurate per garantire che solo gli utenti autenticati possano leggere e scrivere i dati.
- **Autenticazione**: L'accesso all'intera applicazione è protetto da login.
