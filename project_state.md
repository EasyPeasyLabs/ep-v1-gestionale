# Project State - 2026-04-09

## Overview
Gestione e allineamento dati tra **Progetto B** (Iscrizioni Pubbliche) e **Gestionale** (Backend). Evoluzione verso un sistema di ricorrenza avanzata per i corsi.

## Architettura Fornitori & Sedi
- **Gerarchia**: 1:N annidata. `suppliers` (Collection) -> `locations` (Array) -> `availability` (Array).
- **Persistenza**: `supplierService.ts` gestisce aggiornamenti atomici sull'intero documento del Fornitore.
- **Denormalizzazione**: Campi come `locationName` e `supplierName` sono copiati negli `Enrollments`.
- **ID Sedi**: Utilizzo di stringhe numeriche o `temp-timestamp`.

## Task Correnti
- [x] Allineamento Progetto C (Portale) all'accorpamento Bundle.
- [x] Fix Occupancy Progetto B (ora usa `activeEnrollmentsCount` reale).
- [x] Sblocco Occupazione Storica: Smart Linking di 22 allievi ai nuovi corsi (Sprint 12).
- [x] Fix Trigger `onEnrollmentUpdated`: Gestione cambio corso (`courseId`) e validità carnet.
- [x] **Ricorrenza Avanzata Corsi (Sprint 15)**: Implementazione logica di attivazione mensile e blackout.

## Moduli Completati - 2026-04-09
- **Gestione Corsi (Sprint 13)**: Rifattorizzazione completa. 
    - GUI Mobile-First con footer fisso e scroll.
    - Integrazione CRUD totale in modale.
    - Sistema di visualizzazione allievi iscritti (popup).
- **Ricorrenza Avanzata (Sprint 15)**:
    - Nuovo modello `RecurrenceConfig` in `types.ts`.
    - Logica generativa filtrata in `courseService.ts` (`isDateActive`).
    - UI di configurazione mensile in `Courses.tsx`.
- **Occupazione Dinamica V5**: Logica Cloud Functions basata su `courses` e `activeEnrollmentsCount`.
- **Sincronizzazione Real-Time**: Trigger Firestore per aggiornamento automatico posti disponibili.

## Note Tecniche
- Risolto bug di sfasamento giorno della settimana dovuto a date ISO UTC.
- Implementata la generazione selettiva delle lezioni: il sistema ora rispetta i mesi di attività definiti nel corso.
- Ottimizzazione React: `fetchCourses` ora utilizza `useCallback` per evitare ricaricamenti non necessari.
