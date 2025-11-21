
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
1.  **Identità Visiva Dinamica**:
    - Implementata logica in `App.tsx` per iniettare il logo aziendale (recuperato da Firestore) come Favicon e Apple Touch Icon a runtime.
    - **Manifest Dinamico**: Creato un sistema che genera un `manifest.json` "virtuale" (Blob URL) contenente il logo personalizzato dell'utente. Questo permette all'app installata su desktop/mobile di avere l'icona corretta dell'attività invece di quella di default.
2.  **Naming Cohesion**: Standardizzato il nome dell'app installata in "EP v1".
3.  **PDF Layout**: Perfezionato l'allineamento e le spaziature nella testata dei documenti PDF (Fatture/Preventivi) per migliorare la leggibilità e la resa estetica.
