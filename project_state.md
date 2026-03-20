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
- [/] Rifattorizzazione sezione Fornitori (In attesa di istruzioni specifiche: seguiremo il piano descritto in implementation_plan.md e procederemo con la nuova collezione locations).
