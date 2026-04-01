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

## Moduli Completati - 2026-04-01
- **Ricerca Partecipanti Extra (Sprint 15)**: Rifattorizzazione modale `LessonForm`.
    - Sostituito menu a tendina con campo filtro testuale.
    - Filtro per: Nome Genitore, Nome Figlio, Corso (Iscrizione), Sede/Recinto Abituale.
    - Selezione multipla immediata tramite checkbox sui risultati filtrati.
    - Visualizzazione compatta dei dettagli partecipante (Genitore + Info Iscrizioni).
- **Gestione Corsi (Sprint 13)**: Rifattorizzazione completa. 
    - GUI Mobile-First con footer fisso e scroll.
    - Integrazione CRUD totale in modale.
    - Sistema di visualizzazione allievi iscritti (popup).
...
- **Sincronizzazione Real-Time**: Trigger Firestore per aggiornamento automatico posti disponibili su creazione, cancellazione e modifica iscrizioni.
- **Allineamento API**: Portale Pubblico (Vercel) sincronizzato su API V5 (`getPublicSlotsV5`).

## Note Tecniche
- Risolto bug di sfasamento giorno della settimana dovuto a date ISO UTC (mezzanotte).
- Eseguito `nuclear_fix.js` per ricollegare allievi storici ai nuovi corsi dello Sprint 13.
- Deploy Cloud Functions raccomandato per attivare la logica V5 in produzione.
