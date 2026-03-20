# Piano Esecutivo: Refactoring Architetturale "Corsi & Bundle" (Sprint 13)

Questo piano descrive la transizione dal modello "Fornitore -> Sede (Array) -> Slot" al modello "Bundle (Gettoni) -> Corsi (Gettoniere)".

---

## 🏗️ 1. Evoluzione del Data Model (Firestore)

### [NEW] Collezione `locations` (Sedi)
Le sedi escono dall'array Fornitore per vivere di vita propria.
- `id`: string (ID persistente)
- `supplierId`: string (rif. fornitore)
- `name`, `address`, `city`, `color`: basic info
- `rentalCost`: per ROI (Costo nolo ora/slot)
- `distance`: per logistica
- `status`: 'active' | 'closed'

### [NEW] Collezione `courses` (Il Corso / "La Fessura")
Rappresenta l'offerta formativa specifica di una sede.
- `id`: string
- `locationId`: string (ref `locations`)
- `dayOfWeek`: number (0-6)
- `startTime`, `endTime`: string (es. "10:00", "11:00")
- `slotType`: 'LAB' | 'SG' | 'EVT'
- `minAge`, `maxAge`: number (Target d'età rigoroso)
- `capacity`: number (Capienza max)
- `activeEnrollmentsCount`: number (Contatore atomico per occupancy instantanea)

### [MOD] Collezione `subscriptions` -> Concept di `Bundles`
L'abbonamento diventa un contenitore di gettoni compatibili.
- `id`: string
- `name`: string
- `tokens`: { type: 'LAB' | 'SG' | 'EVT', count: number }[]
- `allowedAges`: { min: number, max: number }

### [MOD] Collezione `enrollments` (Iscrizioni)
Traccia il possesso di un Bundle e l'assegnazione ai Corsi.
- `bundleId`: string
- `tokensRemaining`: { LAB: number, SG: number, EVT: number }
- `courseAssignments`: { courseId: string, date: string, status: 'attended' | 'missed' | 'pending' }[]

---

## ⚡ 2. Refactoring Backend (Cloud Functions)

### API `getPublicSlotsV3` (Nuova generazione)
Elimina il loop triplo attuale.
1.  **Input**: Età allievo (`age`).
2.  **Query**: `courses.where('minAge', '<=', age).where('maxAge', '>=', age).where('status', '==', 'open')`.
3.  **Matching**: Incrocia i `slotType` dei corsi trovati con i `Bundles` pubblici che offrono quei gettoni.
4.  **Output**: Restituisce la disponibilità reale basata sul campo `activeEnrollmentsCount` del corso.

### Triggers Atomici (Cloud Functions)
-   `onEnrollmentCreated`: Incrementa automaticamente `activeEnrollmentsCount` nel documento `course`.
-   `onEnrollmentDeleted`: Decrementa il contatore.
*Nessun ricalcolo dinamico pesante ad ogni chiamata API.*

---

## 📅 3. Piano di Sviluppo (Step-by-Step)

### Step 1: Migrazione Dati (Script `/tmp/migrate_courses.ts`)
- Script per estrarre ogni `AvailabilitySlot` dagli array `suppliers.locations` e creare un corrispondente documento in `courses`.
- Script per popolare la collezione `locations` dai dati esistenti.
- Salvaguardia degli ID: Ogni nuova sede Manterrà l'ID `temp-timestamp` o numerico già esistente.

### Step 2: Update Gestionale (Frontend)
- **Nuova Pagina "Corsi"**: Interfaccia per gestire l'apertura/chiusura dei corsi per singola sede.
- **Form Iscrizione**: La scelta del corso filtrerà automaticamente i bundle compatibili (ed età).

### Step 3: Implementazione Validazione 1:1
- Il sistema impedirà l'iscrizione se l'età dell'allievo non corrisponde al target del corso.
- Gestione flessibile: Spostare un allievo in un'altra sede significa semplicemente spostare il suo "Gettone" in una nuova "Fessura" compatibile.

---

## 📈 4. Effetti e Benefici
- **Zero Errori di Matching**: Il legame 1:1 (Gettone -> Fessura) rende impossibile l'overbooking o l'inserimento in fasce d'età errate.
- **ROI di Precisione Totale**: I noli verranno calcolati sui corsi effettivamente attivi.
- **Progetto B Real-Time**: Caricamento istantaneo delle disponibilità senza filtri complessi in frontend.
- **Integrità Storica**: Ogni presenza sarà legata a un `courseId` specifico, tracciando perfettamente la storia dell'allievo.

---

> [!IMPORTANT]
> Manterremo la compatibilità con le vecchie API `V2` durante la fase di migrazione per non interrompere il servizio nel Progetto B corrente.
