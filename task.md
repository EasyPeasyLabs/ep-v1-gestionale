# Task: Investigating Data Inconsistency between Project B and Gestionale

- [x] Analyze Project B data fetching logic for packages and availability
    - [x] Identify source of truth for packages and locations in Gestionale (getPublicSlotsV2 API)
    - [x] Review seat calculation logic in Project B vs Gestionale (Project B defers to API)
- [x] Investigate Firestore Schema for `suppliers` and `enrollments`
    - [x] Understand how `appointments` vs `selectedSlot` are stored in enrollments
    - [x] Understand how `slots` map to `subscriptionTypes` in locations
- [x] Investigate Friday vs Saturday mismatch for "LAB + SG" at "IDEE CONTAGIOSE"
- [x] Investigate seat count discrepancy (4 active students not counted)
- [x] Propose fix and request authorization
- [x] Implement and verify (Completed)
    - [x] Run `npm run compile` in functions directory

# Task: UI Available Seats & Push Notification Verification
- [x] Investigate why Project B does not show available seats in the UI
    - [x] Check `RegistrationForm.tsx` for `availableSeats` rendering
    - [x] Propose UI fix (No Frontend fix needed)
- [x] Verify FCM Push Notifications for Lead Submission
    - [x] Inspect `receiveLeadV2` in Gestionale for FCM trigger
    - [x] Inspect `sendPushToAllTokens`
    - [x] Verify notification text and device targeting
- [x] Implement and verify (Completed)
    - [x] Update `functions/src/index.ts`
    - [x] Run `npm run compile` in functions directory

# Task: Restoring Event-Driven Lead Submission
- [x] Analyze current and targeted Architecture for `raw_registrations`
- [x] Propose plan to avoid duplicate lead creation
- [x] Implement and verify (Completed)
    - [x] Run `npm run build` in Project B

# Task: Fixing Firestore Composite Index Error
- [x] Investigate `syncError` logged in Project B
- [x] Locate the failing query in `receiveLeadV2` (Gestionale)
- [x] Propose and implement a fix (Completed)
    - [x] Implemented native composite index in Firebase Console

# Task: Debugging FCM Push Notifications and Payload Leakage
- [x] Investigate why `syncStatus: "pending_sync"` leaks into `incoming_leads`
    - [x] Check `receiveLeadV2` data spreading logic
- [x] Investigate why FCM Push Notifications are failing
    - [x] Read `onLeadCreated` in `ep-v1-gestionale/functions/src/index.ts`
    - [x] Read `sendPushToAllTokens` logic
    - [x] Check mapping variables `[giornoBundle]` and `[NomeSede]`
- [x] Implement fixes and request authorization (Completed)
    - [x] Tested locally and confirmed via compiled index.js

# Task: Fixing Bundle Aggregation (Accorpamento)
- [x] Analyze `getPublicSlotsV2` in Gestionale
    - [x] Understand why "LAB+SG" generates multiple selectable cards instead of one
- [x] Read `SubscriptionType` and `Location slots` mapping
- [x] Propose and implement a fix to group `includedSlots` by Subscription and Day
# Task: Allineamento Progetto C (Portale Iscrizioni)
- [x] Ricerca directory e analisi codice sorgente `ep-portal` (Trovato in `ep-v1-gestionale/pages/EnrollmentPortal.tsx`)
- [x] Analisi flusso di ricezione dati da `incoming_leads` -> `getEnrollmentData`
- [x] Verificare che la UI del Portale mostri correttamente il Bundle aggregato e calcoli il prezzo corretto
- [x] Implementazione e validazione (build OK, exit code 0)

# Task: Sprint 11 — Fix Occupancy Frontend & Diagnosi Sedi
- [x] Analisi discrepanza dati e sedi mancanti (Bug 11)
- [x] [MODIFY] RegistrationForm.tsx: fix calcolo occupancy con `availableSeats`
- [x] [MODIFY] index.ts: potenziamento logging diagnostico per `getPublicSlotsV2`
- [x] Verifica build e deploy functions

# Task: Sprint 12 — Gestione Dati Incompleti e Robustezza ID
- [/] Pianificazione fix robustezza dati (Sprint 12)
- [ ] [MODIFY] index.ts: slot type fallback (LAB)
- [ ] [MODIFY] index.ts: ID mapping robusto
- [ ] Verifica finale presenza ARIA DI FESTA e MEGAMAMMA

# Task: Sprint 13 — Architettura "Corsi & Bundle"
- [ ] Creazione collezione `locations` (Sedi autonome)
- [ ] Creazione collezione `courses` (Ponte Sede-Età-Slot)
- [ ] Refactoring `SubscriptionType` in `Bundles`
- [ ] Implementazione API `getPublicSlotsV5` (Logica 1:1)
- [ ] Migrazione dati storici
