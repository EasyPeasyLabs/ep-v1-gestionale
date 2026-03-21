# Project State - 2026-03-20

## Overview
Gestione e allineamento dati tra **Progetto B** (Iscrizioni Pubbliche) e **Gestionale** (Backend).

## Architettura Fornitori & Sedi
- **Gerarchia**: 1:N annidata. `suppliers` (Collection) -> `locations` (Array) -> `availability` (Array).
- **Persistenza**: `supplierService.ts` gestisce aggiornamenti atomici sull'intero documento del Fornitore.
- **Denormalizzazione**: Campi come `locationName` e `supplierName` sono copiati negli `Enrollments`, creando potenziali rischi di disallineamento se rinominati.
- **ID Sedi**: Utilizzo di stringhe numeriche o `temp-timestamp`.

## Task Correnti
- [x] Allineamento Progetto C (Portale) all'accorpamento Bundle.
- [x] Fix Occupancy Progetto B (ora usa `availableSeats` reale).
- [x] Diagnosi Log Firebase (ARIA DI FESTA mancante per Tipo Slot undefined).
## Moduli Completati - 2026-03-21
- **Gestione Corsi (Sprint 13)**: Rifattorizzazione completa. 
    - GUI Mobile-First con footer fisso e scroll.
    - Integrazione CRUD totale in modale.
    - Sistema di visualizzazione allievi iscritti (popup).
- **Occupazione Dinamica**: Logica Cloud Functions basata su `lessonsRemaining`.
- **Allineamento API**: Portale Pubblico (Vercel) sincronizzato su API V5.

## Note Tecniche
- Risolti errori di tipo TypeScript su componenti Icon e Modal.
- Deploy Cloud Functions effettuato con successo (Regione: europe-west1).
