
# Cronologia del Progetto "EP v.1"

Questo file documenta la cronologia delle interazioni, delle richieste e delle modifiche apportate all'applicazione, sessione per sessione.

---

## Sessione 1 (25 Maggio 2024)

### Obiettivo della Sessione
Creare la struttura e le funzionalità di base dell'applicazione gestionale "EP v.1" sulla base della richiesta iniziale.

### Riepilogo delle Attività
1.  **Richiesta Iniziale**: Definizione requisiti per gestionale scuola di inglese.
2.  **Sviluppo Base**: Creazione impalcatura React, Firebase config, Auth, CRUD base (Clienti, Fornitori, Finanza).
3.  **Correzioni**: Risoluzione problemi su modali genitori e salvataggio sedi fornitori.

---

## Sessione 2 (26 Maggio 2024)

### Obiettivo della Sessione
Rendere l'applicazione completamente responsiva e ottimizzata per dispositivi mobili.

### Riepilogo delle Attività
1.  **Responsività**: Implementazione menu hamburger, layout a schede per mobile, griglie adattive.
2.  **Robustezza**: Miglioramento qualità codice e accessibilità.

---

## Sessione 3 (27 Maggio 2024)

### Obiettivo della Sessione
Risolvere bug specifici segnalati dall'utente.

### Riepilogo delle Attività
1.  **UI Fornitori**: Spostamento pulsanti per coerenza UI.
2.  **Bug Fixing**: Risolto problema salvataggio figli (form nested) e salvataggio lezioni calendario.

---

## Sessione 4 (28 Maggio 2024)

### Obiettivo della Sessione
Evolvere il Calendario in uno strumento di pianificazione strategica.

### Riepilogo delle Attività
1.  **Refactoring Calendario**: Abbandono logica settimanale per logica mensile/data specifica.
2.  **Lezioni Ricorrenti**: Implementazione generazione automatica lezioni ricorrenti.

---

## Sessione 5 (29 Maggio 2024)

### Obiettivo della Sessione
Perfezionare la gestione finanziaria e automazione fatture.

### Riepilogo delle Attività
1.  **Automazione Finanziaria**: Generazione automatica transazioni da fatture pagate.
2.  **Visualizzazione**: Aggiunta grafici ripartizione costi/ricavi e proiezione fiscale.

---

## Sessione 6 (30 Maggio 2024)

### Obiettivo della Sessione
Implementare la gestione delle presenze, il recupero lezioni e l'iscrizione multipla.

### Riepilogo delle Attività

1.  **Iscrizione Multipla**:
    - Modificato il form di iscrizione (`EnrollmentForm`) per permettere la selezione di più figli contemporaneamente (checkbox dropdown).
    - Aggiornata la logica di salvataggio per generare N iscrizioni separate in un'unica operazione.

2.  **Registro Presenze**:
    - Creata una nuova pagina **Registro Presenze** (`Attendance.tsx`) accessibile dal menu principale.
    - La pagina permette di navigare giorno per giorno e visualizzare la lista cronologica delle lezioni previste.
    - Visualizzazione stato (Presente/Assente) per ogni lezione.

3.  **Gestione Assenze e Recuperi (Logica Ibrida)**:
    - Implementata la logica di business richiesta per le assenze: l'assenza non consuma lo slot se viene recuperata.
    - Aggiunta la funzione `registerAbsence` nel service. Quando si segna un'assenza dal Registro Presenze, il sistema chiede se si vuole recuperare la lezione.
    - **Algoritmo di Recupero**: Il sistema calcola automaticamente la prima data utile successiva alla fine del corso, mantenendo lo stesso giorno della settimana e saltando le festività italiane standard (es. Natale, Ferragosto).

---

## Sessione 7 (31 Maggio 2024)

### Obiettivo della Sessione
Espandere le funzionalità CRM e introdurre strumenti di pianificazione e controllo operativo (Planner).

### Riepilogo delle Attività

1.  **CRM Avanzato - Comunicazioni Libere**:
    - Aggiunta una nuova modale nella pagina CRM per l'invio di comunicazioni non legate a eventi specifici (es. scadenze).
    - Implementata la selezione multipla dei destinatari (Clienti, Fornitori o Inserimento Manuale).
    - Supporto per invio massivo tramite **Email (BCC)** per privacy o **WhatsApp** (apertura sequenziale chat).

2.  **Planner Verifiche Periodiche (Frontend)**:
    - Creata una nuova sezione "Pianificazione & Controllo" nel menu **Impostazioni**.
    - Implementato un sistema CRUD (`periodicChecks`) per definire task ricorrenti (es. Controllo Pagamenti, Restituzione Materiali Peek-a-Boo, Appuntamenti Commercialista).
    - Configurazione scheduler locale (React) per notifiche a browser aperto.

---

## Sessione 8 (1 Giugno 2024)

### Obiettivo della Sessione
Implementare l'infrastruttura server-side per le notifiche e il Controllo di Gestione.

### Riepilogo delle Attività

1.  **Cloud Functions**: Configurazione e deploy delle funzioni Firebase per lo scheduling delle notifiche.
2.  **Controllo di Gestione**:
    - Aggiunta categorizzazione granulare delle spese.
    - Implementazione sistema di imputazione costi (Centro di Costo: Sede o Iscrizione).
    - Nuova Dashboard "Reports" in Finanza con analisi profittabilità per sede.

---

## Sessione 9 (1 Giugno 2024)

### Obiettivo della Sessione
Risoluzione bug critici (Service Worker origin) e aggiornamento Roadmap.

### Riepilogo delle Attività
1.  **Bug Fix Service Worker**: Risolto errore di registrazione SW modificando l'URL dello script in assoluto (`window.location.origin`).
2.  **Roadmap Update**: Aggiornata documentazione per riflettere il completamento del modulo Gestione Costi.

---

## Sessione 10 (1 Giugno 2024) - Stop & Polish

### Obiettivo della Sessione
Revisione Roadmap, congelamento feature, polishing grafico (UI/UX) e correzione bug critici notifiche.

### Riepilogo delle Attività
1.  **Stop & Polish (UI/UX)**:
    - **Design System**: Aggiornato `index.html` con ombre più morbide (stile Apple/Stripe), animazioni di pagina (`slide-up-fade`) e pulsanti moderni.
    - **Sidebar**: Restyling completo con stato attivo "ghost" più leggero, logo gradiente e layout pulito.
    - **Dashboard**: Nuove "Premium Stat Cards" con icone, bolle colorate e animazioni a cascata.
    - **Transizioni**: Implementata animazione fluida al cambio pagina in `App.tsx`.

2.  **Bug Fix Notifiche**:
    - Corretto un bug critico in `services/fcmService.ts` dove la funzione `getToken` falliva nel recuperare la registrazione del Service Worker. Ora viene passato l'oggetto `registration` esplicito ottenuto dalla promise di registrazione.

3.  **Posticipo SDI**: L'integrazione fiscale è stata ufficialmente posticipata per garantire la stabilità e mantenere il focus sull'operatività.

---

## Sessione 11 (2 Giugno 2024)

### Obiettivo della Sessione
Personalizzazione Branding e Identità PWA.

### Riepilogo delle Attività
1.  **Identità Visiva Dinamica (PWA & Branding)**:
    - Implementata logica in `App.tsx` per iniettare il logo aziendale (recuperato da Firestore) come Favicon e Apple Touch Icon a runtime.
    - **Manifest Dinamico**: Creato un sistema che genera un `manifest.json` "virtuale" (Blob URL) contenente il logo personalizzato dell'utente. Questo permette all'app installata su desktop/mobile di avere l'icona corretta dell'attività invece di quella di default.
    - **Naming**: Forzato il nome dell'applicazione installata a **"EP v1"** sia nel manifest statico che in quello dinamico.
2.  **PDF Layout**: Perfezionato l'allineamento e le spaziature nella testata dei documenti PDF (Fatture/Preventivi) per migliorare la leggibilità e la resa estetica.

---

## Sessione 12 (3 Giugno 2024)

### Obiettivo della Sessione
Potenziamento del CRM con storico comunicazioni e analisi architetturale per l'espansione web (Sito Vetrina).

### Riepilogo delle Attività
1.  **Archivio Comunicazioni (CRM)**:
    -   **Backend**: Creato il modello `CommunicationLog` e il servizio `crmService` per tracciare ogni messaggio inviato.
    -   **Frontend**: Riorganizzata la pagina CRM in tab ("Panoramica" e "Archivio").
    -   **Funzionalità**: Implementato il salvataggio automatico post-invio e la funzione "Riusa" per duplicare messaggi precedenti.
    -   **UX**: Aggiunti filtri di ricerca (per oggetto, messaggio, destinatario) e ordinamento (cronologico/alfabetico) nell'archivio.

2.  **Consulenza Architetturale (Sito Web)**:
    -   Analizzata la fattibilità di un sito vetrina per iscrizioni e pagamenti automatici.
    -   **Strategia Definita**: Utilizzo di un secondo progetto Vercel per il frontend pubblico.
    -   **Sicurezza**: Adozione di Vercel Functions (o Cloud Functions) come middleware per gestire le scritture su Firebase (iscrizioni) tramite Admin SDK, mantenendo le regole di sicurezza del database "chiuse" al pubblico.

---

## Sessione 13 (4 Giugno 2024)

### Obiettivo della Sessione
Implementazione del sistema di Rating avanzato per i Figli (Enterprise Features) e Dashboard Qualitativa.

### Riepilogo delle Attività
1.  **Rating & Profilazione Figli**:
    -   Aggiornato il modello dati per includere rating a stelle su 4 parametri (Apprendimento, Condotta, Assenza, Igiene), Tags e Note.
    -   Implementato `ChildEditor` nella scheda cliente per gestire questi dati in modo dettagliato.
2.  **Dashboard Qualità**:
    -   Creata una nuova Tab "Qualità & Rating" nella Dashboard principale.
    -   Sviluppata logica per calcolare medie aggregate di rating per Genitori, Figli, Fornitori e Sedi.
3.  **Insights Automatici**:
    -   Aggiunta logica condizionale per generare "massime" riassuntive nelle card della dashboard (es. "Bravi ma con troppe assenze" o "Sedi belle ma costose") basate sulla combinazione dei punteggi.

---

## Sessione 14 (5 Giugno 2024)

### Obiettivo della Sessione
Ottimizzazione del flusso finanziario per i pagamenti iscrizioni via Bonifico.

### Riepilogo delle Attività
1.  **Automazione Finanziaria Iscrizioni**:
    -   Modificata la funzione `executePayment` in `Enrollments.tsx`.
    -   Alla conferma del pagamento con Bonifico, il sistema ora:
        1.  Genera una **Fattura** con stato `Paid`.
        2.  Crea una singola **Transazione** di entrata collegata direttamente alla fattura (`relatedDocumentId`).
    -   Questo flusso garantisce la corretta tracciabilità fiscale ed evita la duplicazione delle entrate nel bilancio.

---

## Sessione 15 (6 Giugno 2024)

### Obiettivo della Sessione
Introduzione del "Capitale Iniziale" nel sistema finanziario.

### Riepilogo delle Attività
1.  **Capitale Iniziale (Budget di Partenza)**:
    -   Aggiornato il modello `types.ts` aggiungendo la categoria `TransactionCategory.Capital`.
    -   Abilitata la selezione di questa categoria nel form delle transazioni di Entrata in `Finance.tsx`.
    -   **Logica Fiscale**: Modificato il calcolo del "Fatturato Annuo" per la proiezione fiscale: le entrate marcate come "Capitale Iniziale" vengono escluse dal calcolo dell'imponibile, in quanto non costituiscono ricavo soggetto a tassazione nel regime forfettario, pur contribuendo al saldo cassa positivo.

---

## Sessione 16 (6 Giugno 2024 - Parte 2)

### Obiettivo della Sessione
Miglioramento della gestione delle Note con storico strutturato e pulizia UI Clienti.

### Riepilogo delle Attività
1.  **Storico Note Strutturato (Data + Contenuto)**:
    -   Sostituiti i vecchi campi di testo libero "Note" con un nuovo componente `NotesManager` che permette di inserire note multiple, ciascuna con la propria data.
    -   Aggiornato il Modello Dati (`types.ts`) introducendo l'array `notesHistory` per:
        -   Genitori (in `Clients.tsx`)
        -   Figli (in `Clients.tsx`)
        -   Fornitori (in `Suppliers.tsx`)
        -   Sedi/Locations (in `Suppliers.tsx`)
    -   Mantenuta retrocompatibilità: le vecchie note testuali vengono preservate ma visualizzate separatamente o migrate alla prima modifica.

2.  **UI Cleanup Clienti**:
    -   Rimossa l'informazione ridondante (testo esteso) del rating dalla card del cliente nella lista, mantenendo solo il badge compatto con le stelle sotto l'etichetta "Genitore" per un look più pulito.

---

## Sessione 17 (7 Giugno 2024)

### Obiettivo della Sessione
Risoluzione problemi di layout nella modale di iscrizione.

### Riepilogo delle Attività
1.  **UI Fix Iscrizioni**:
    -   Aggiornato il componente `EnrollmentForm` per garantire che il contenuto della form sia scrollabile verticalmente (`overflow-y-auto`) mentre l'header e il footer (con i bottoni di azione) rimangono fissi. Questo risolve un problema di usabilità su schermi più piccoli dove i bottoni "Conferma" potevano risultare inaccessibili.

---

## Sessione 18 (8 Giugno 2024)

### Obiettivo della Sessione
Pianificazione della "Pagina Pubblica" (Lead Generation) con architettura sicura.

### Riepilogo delle Attività
1.  **Analisi Fattibilità**:
    -   Valutata l'ipotesi di integrare Google Moduli con Webhook.
    -   Scelta l'alternativa "Buffer Database" per un maggiore controllo sul branding e sulla logica, mantenendo i costi bassi.

2.  **Definizione Architettura (Buffer Database)**:
    -   Definita la struttura a "doppio progetto" per sicurezza (Air Gap):
        -   **Progetto A (EP v.1)**: Gestionale Privato (Admin Only).
        -   **Progetto B (Public)**: Pagina di Iscrizione pubblica che scrive su un database Firebase separato e "sacrificabile".
    -   EP v.1 leggerà i dati dal Progetto B per importarli come "Nuovi Iscritti".

3.  **Aggiornamento Documentazione**:
    -   Aggiornati `Contesto.md` e `Architettura.md` con le specifiche del nuovo modulo.
    -   **Fork Operativo**: È stato deciso di sviluppare la parte pubblica in un nuovo contesto (nuova chat/progetto) per mantenere il codice pulito. I file `.md` specifici per il nuovo progetto sono stati generati.

---

## Sessione 19 (8 Giugno 2024 - Parte 2)

### Obiettivo della Sessione
Generazione dei file di bootstrap per il nuovo progetto.

### Riepilogo delle Attività
1.  **Generazione File**: Creati i file `Contesto_1.md` e `Architettura_1.md` contenenti le specifiche per il nuovo progetto "EP Public".
2.  **Istruzioni**: Questi file verranno utilizzati come prompt iniziale per l'AI nel nuovo repository.

---

## Sessione 20 (9 Giugno 2024)

### Obiettivo della Sessione
Miglioramento UX Mobile per le Iscrizioni e gestione storico spostamenti.

### Riepilogo delle Attività
1.  **UX Mobile Iscrizioni (Move Mode)**:
    -   Implementata la modalità "Sposta" (`isMoveMode`) in `Enrollments.tsx`.
    -   Risolto il problema del Drag & Drop su dispositivi touch: l'utente ora può toccare una card per selezionarla e toccare uno slot orario per spostarla.
    -   Aggiunto pulsante toggle "✋ Sposta" visibile solo su mobile.

2.  **Storico Iscrizioni Spostate**:
    -   Le iscrizioni "vecchie" derivanti da uno spostamento (status `Completed`) ora rimangono visibili nella griglia.
    -   **Visualizzazione**: Applicato stile distintivo (scala di grigi, opacità 60%, bordo grigio) per differenziarle chiaramente dalle iscrizioni attive.
    -   **Interazioni**: Disabilitato Drag & Drop, Click e Modifica su queste card per prevenire errori. Mantenuta solo la possibilità di eliminazione (per pulizia storico).

3.  **Dettagli Fattura**:
    -   Aggiornata la generazione fatture da iscrizione per includere il nome della **Sede** nelle note dell'articolo, migliorando la chiarezza contabile.

---

## Sessione 21 (10 Giugno 2024)

### Obiettivo della Sessione
Potenziamento del sistema di pulizia dati (Cascading Delete) e revisione olistica della sezione Finanza/Controllo di Gestione.

### Riepilogo delle Attività
1.  **Deep Cleaning (Data Integrity)**:
    -   Aggiornata la funzione `cleanupEnrollmentFinancials` in `services/financeService.ts`.
    -   Quando viene eliminata un'iscrizione, ora vengono rimossi automaticamente:
        -   Transazioni di Entrata collegate.
        -   Fatture collegate.
        -   Transazioni "Contanti" non fatturate.
        -   **Transazioni "Nolo Sede"**: eliminate le spese generate automaticamente (`AUTO-RENT`).
        -   Il sistema delle lezioni (Activity Log) viene pulito se associato.
    -   Poiché lezioni, presenze e calendario dipendono dall'array `appointments` dentro `Enrollment`, l'eliminazione del documento padre pulisce automaticamente queste viste.

2.  **Controllo di Gestione Olistico**:
    -   Riorganizzata la tab "Controlling" in `pages/Finance.tsx`.
    -   Create due card separate e dettagliate:
        -   **Profittabilità Immobiliare**: Focus su Ricavi vs Affitto Sede.
        -   **Efficienza Logistica**: Focus separato su Km, Carburante e Usura.
    -   Nessuna omissione di dati: tutte le metriche sono visibili.

3.  **CFO Dashboard 2.0**:
    -   Implementati grafici simulati in **3D** (tramite gradienti e ombreggiature Chart.js) per i trend di cassa.
    -   Reintegrate e rese dinamiche le card "Azioni Tattiche (Urgenti)" e "Strategiche (Lungo Termine)" basate sul gap finanziario calcolato.

---

## Sessione 22 (11 Giugno 2024)

### Obiettivo della Sessione
Completamento del sistema di pulizia "Cascading Delete" su tutte le entità collegate e finalizzazione della UI Finanza.

### Riepilogo delle Attività
1.  **Deep Cleaning Esteso**:
    -   Implementata la funzione `deleteLessonActivitiesForEnrollment` per rimuovere anche i record del Registro Attività collegati alle lezioni cancellate.
    -   Aggiornata `cleanupEnrollmentFinancials` per accettare l'oggetto `Enrollment` completo (necessario per recuperare gli ID delle lezioni).
    -   L'eliminazione di un'iscrizione ora rimuove in un colpo solo: Iscrizione, Transazioni, Fatture, Noli Automatici e Attività Didattiche.

2.  **Finanza & CFO UI**:
    -   Ridisegnata la pagina `Finance.tsx` per separare nettamente "Profittabilità Immobiliare" da "Efficienza Logistica" come richiesto.
    -   Implementato il grafico "simil-3D" usando gradienti `canvas` in Chart.js.
    -   Ripristinate tutte le metriche di controllo (ROI, Margini, Costi occulti).

---

## Sessione 23 (12 Giugno 2024)

### Obiettivo della Sessione
Supporto per l'iscrizione di Clienti Adulti (corsi Business/Adult) e miglioramenti UI nelle card Clienti.

### Riepilogo delle Attività
1.  **Iscrizione Adulti**:
    -   Aggiornato il modello dati `Enrollment` per gestire il flag `isAdult`.
    -   Aggiornato `SubscriptionType` per includere il target ('kid' | 'adult') con prefissi automatici (K - / A -).
    -   Implementato in `EnrollmentForm.tsx` un toggle per scegliere chi iscrivere: Figlio (Standard) o Genitore/Cliente (Adulto). Nel caso adulto, l'ID del bambino punta all'ID del cliente stesso.
    -   Aggiornata la gestione dei listini per mostrare solo gli abbonamenti pertinenti al target scelto.

2.  **UX Clienti (Nome/Cognome)**:
    -   Aggiunto un toggle nella pagina `Clients.tsx` per invertire la visualizzazione dei nomi sulle card (Nome Cognome vs Cognome Nome), facilitando la ricerca visiva.

3.  **Policy di Sviluppo "Imperativa"**:
    -   Istituita regola ferrea per prevenire modifiche strutturali, rimozioni o troncamenti non esplicitamente richiesti nelle future iterazioni.

---

## Sessione 24 (13 Giugno 2024)

### Obiettivo della Sessione
Ristrutturazione completa delle aree "Lezioni" e "Attività" in "Registro Elettronico" e "Iniziative", introducendo moduli avanzati per la didattica e la biblioteca.

### Riepilogo delle Attività
1.  **Registro Elettronico**:
    -   Rinominato il menu principale e suddiviso in due moduli.
    -   **Lezioni**: Migliorata la visualizzazione con il raggruppamento per sede e data.
    -   **Compiti**: Nuovo modulo per creare liste di compiti (Manuali/Link), assegnarle a specifici Recinti (Lezioni/Sedi) e inviarle via WhatsApp ai genitori con formattazione automatica.

2.  **Iniziative & Biblioteca**:
    -   Ristrutturato il menu "Attività" in un dropdown.
    -   **Iniziative**: Nuovo modulo per gestire progetti speciali.
    -   **Peek-a-Boo(k)**: Implementato un sistema bibliotecario completo (senza barcode) per:
        -   Gestire l'inventario libri (CRUD).
        -   Registrare prestiti (Check-out) associando Libro + Allievo + Sede.
        -   Gestire le restituzioni (Check-in).
        -   Visualizzare lo storico dei prestiti attivi.

3.  **Miglioramenti UI**:
    -   Resa cliccabile la card "Fornitori" nella Dashboard.
    -   Aggiornate le icone della Sidebar per riflettere le nuove sezioni.
