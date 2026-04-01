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

## Moduli Completati - 2026-04-01
- **Ricerca Partecipanti Extra (Sprint 15)**: Rifattorizzazione modale `LessonForm`.
    - Sostituto menu a tendina con campo filtro testuale.
    - Filtro per: Nome Genitore, Nome Figlio, Corso (Iscrizione), Sede/Recinto Abituale.
- **Recupero Automatico Intelligente (Sprint 15)**: 
    - La logica di slittamento in `registerAbsence` ora interroga la collezione `school_closures`.
    - Garantito che il nuovo slot non cada in un giorno festivo o di chiusura.
    - Sincronizzazione automatica del campo `endDate`.
- **Tracciabilità Assenze/Recuperi (Sprint 15)**:
    - Implementato sistema di linking tra appuntamento "Absent" e appuntamento "REC-".
    - Nuova sezione "Dettaglio Recuperi" nella Situazione Clienti che elenca cronologicamente le assenze e indica la data dello slittamento (se autorizzato) o lo stato "Nessun recupero" (se credito perso).
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
