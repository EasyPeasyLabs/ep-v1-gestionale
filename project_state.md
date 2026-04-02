# Project State - 2026-04-01

## Overview
Gestione e allineamento dati tra **Progetto B** (Iscrizioni Pubbliche) e **Gestionale** (Backend).

## Architettura Fornitori & Sedi
- **Gerarchia**: 1:N annidata. `suppliers` (Collection) -> `locations` (Array) -> `availability` (Array).
- **Persistenza**: `supplierService.ts` gestisce aggiornamenti atomici sull'intero documento del Fornitore.
- **Denormalizzazione**: Campi come `locationName` e `supplierName` sono copiati negli `Enrollments`, creando potenziali rischi di disallineamento se rinominati.
- **ID Sedi**: Utilizzo di stringhe numeriche o `temp-timestamp`.

## Task Correnti
- [x] Allineamento Progetto C (Portale) all'accorpamento Bundle.
- [x] Fix Occupancy Progetto B (ora usa `activeEnrollmentsCount` reale).
- [x] Sblocco Occupazione Storica: Smart Linking di 22 allievi ai nuovi corsi (Sprint 12).
- [x] Fix Trigger `onEnrollmentUpdated`: Gestione cambio corso (`courseId`) e validità carnet.
- [x] **Calendario - Eventi Extra**: Migliorata la selezione dei partecipanti con ricerca avanzata (Sprint 15).
- [x] **Presenze - Recupero Automatico**: Lo slittamento ora rispetta festività e chiusure sede, con aggiornamento automatico dell'endDate (Sprint 15).
- [x] **Situazione Clienti - Dettaglio Recuperi**: La scheda cliente ora mostra le date esatte di assenza e la corrispondente data di recupero (Sprint 15).
- [x] **GUI - Nuovo Tema Colore**: Sostituito il colore Indaco con il Grigio Primario (#3C3C52) in tutta l'applicazione (Sprint 15).
- [x] **Fix Calcolo Data Fine**: Risolto slittamento date dovuto al fuso orario nelle iscrizioni standard (Sprint 15).

## Moduli Completati - 2026-04-01
- **Restyling Cromatico (Sprint 15)**:
    - Sostituzione globale del colore Indaco con il Grigio Primario #3C3C52.
    - Aggiornamento palette Tailwind (Config + Runtime CDN) e stili CSS (Input, Label, Bottoni).
    - Preservati colori semantici per Grafici e Badge di stato.
- **Ricerca Partecipanti Extra (Sprint 15)**: Rifattorizzazione modale `LessonForm`.
    - Sostituto menu a tendina con campo filtro testuale (Nome, Genitore, Corso, Sede).
- **Recupero Automatico Intelligente (Sprint 15)**: 
    - Integrazione `school_closures` nello slittamento assenze.
    - Accodamento recuperi alla fine del pacchetto lezioni (non più sovrapposti).
    - Sincronizzazione automatica del campo `endDate`.
- **Tracciabilità Assenze/Recuperi (Sprint 15)**:
    - Linking biunivoco tra assenza e recupero (`recoveryId`).
    - Nuova sezione "Cronologia Didattica" nella Situazione Clienti (UI, PDF, Excel).
    - Utilizzo dei Nomi Commerciali (Public Name) nei report invece dei codici tecnici.
- **Gestione Corsi (Sprint 13)**: Rifattorizzazione completa. 
...
    - Integrazione CRUD totale in modale.
    - Sistema di visualizzazione allievi iscritti (popup).
...
- **Sincronizzazione Real-Time**: Trigger Firestore per aggiornamento automatico posti disponibili su creazione, cancellazione e modifica iscrizioni.
- **Allineamento API**: Portale Pubblico (Vercel) sincronizzato su API V5 (`getPublicSlotsV5`).

## Note Tecniche
- Risolto bug di sfasamento giorno della settimana dovuto a date ISO UTC (mezzanotte).
- Eseguito `nuclear_fix.js` per ricollegare allievi storici ai nuovi corsi dello Sprint 13.
- Deploy Cloud Functions raccomandato per attivare la logica V5 in produzione.
