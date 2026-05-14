# Problemi e incongruenze rilevate in `ep-v1-gestionale`

## 1. Enrollments / Pagamenti / Finanza
- `services/paymentService.ts`: gestione dei pagamenti usa logiche di ghost invoice/transaction incoerenti, con ID sintetici e condizioni diverse per promozione di fatture fantasma.
- `services/enrollmentService.ts`: creazione e gestione di quote/progetti istituzionali disallineata rispetto ai pagamenti. In `components/finance/InstitutionalWizard.tsx` solo la prima iscrizione genera una fattura preventivo corretta.
- `services/financeService.ts`: generazione ghost invoice da quote non è esplicitamente allineata con la logica `enrollment`/`transaction` di `paymentService`.
- Conflitti tra:
  - iscrizioni con `relatedQuoteId` / `isQuoteBased`,
  - pagamenti senza fattura reale,
  - ghost invoice e transazioni su più iscrizioni.

## 2. Abbinamenti Iscrizioni / Corsi / Sedi / Calendario
- `services/enrollmentService.ts`: iscrizioni istituzionali spesso memorizzano `locationId: 'institutional'` mentre le lezioni effettive usano sedi reali. Questo crea inconsistenza tra filtro sede e visualizzazione.
- `components/EnrollmentForm.tsx`: selezione corso/sede è ibrida; quando `selectedCourseId` è presente la sede finale viene sovrascritta dal corso, ma il corso stesso può usare un orario `LAB+SG` con logiche di token miste.
- `components/EnrollmentForm.tsx` e `pages/EnrollmentPortal.tsx`: il modello di sottoscrizione è misto tra `SubscriptionType.tokens` e legacy `labCount/sgCount/evtCount/readCount`. Se `tokens` esiste, il codice fa fallback ai campi legacy in modo non consistente.
- `services/courseService.ts`: `generateCourseLessons` per `slotType === 'LAB+SG'` usa `Math.ceil(day / 7)` per estrarre `weeklyPlan`, suddividendo male il mese invece di applicare un piano di corso stabile.
- `services/enrollmentService.ts`: `bookStudentIntoCourseLessons` incrementa i contatori di quota anche quando lo studente è già prenotato, consumando slot a vuoto.

## 3. Abbonamenti / Bundle / Slot / Consumo slot
- `types.ts`: `SubscriptionType.tokens` è il nuovo modello bundle, ma molte parti ignorano o trasformano ad hoc questa struttura in contatori legacy.
- `components/EnrollmentForm.tsx`: `getTokenCount` cerca prima `tokens`, poi campi legacy; questo rende difficile capire quale fonte sia autorevole.
- `pages/EnrollmentPortal.tsx`: estrazione del bundle da `leadData.selectedSlot` è fragile; usa `bundleId.split('_')[0]` e parsing testo con `split(',')`, soggetto a formati variabili.
- `pages/EnrollmentPortal.tsx`: per i bundle viene selezionato solo il primo slot di `selectedBundleSlots`, ignorando bundle multi-slot o slot misti.
- Filtro `showOtherSubscriptions` dipende sia da contatori legacy che da `tokens`, creando possibili false esclusioni.

## 4. Registro presenze / Slot / Sync Attendance
- `pages/Attendance.tsx`: unisce appuntamenti per data/orario ma tratta diversamente la vecchia architettura (`enrollment.appointments`) e la nuova (`lesson.attendees`). Questo può nascondere o duplicare righe.
- `pages/Attendance.tsx`: chiave di deduplicazione usa `enrollmentId + appDateStr` per institutional ma `enrollmentId + date + startTime` per corsi; può mascherare multi-sessioni istituzionali nello stesso giorno.
- `pages/Attendance.tsx`: `lessonsRemaining` spesso mostra fallback a `enr.labRemaining || 0` quando `lessonsRemaining` è undefined, sbagliando i contatori per abbonamenti misti.
- `services/enrollmentService.ts`: `syncAttendanceToEnrollmentCache` aggiorna solo se c'è un appuntamento legacy con lo stesso `lessonId`, ignorando nuovi casi architetturali.
- `services/enrollmentService.ts`: `calculateRemainingCounters` conta tipi mancanti come `LAB` quando `a.type` è undefined, distorcendo `labRemaining` e `lessonsRemaining`.
- `services/enrollmentService.ts`: `registerAbsence`, `registerPresence`, `resetAppointmentStatus`, `toggleAppointmentStatus`, `deleteAppointment` gestiscono le due architetture ma non normalizzano i contatori in modo coerente.

## 5. Calendario / Lezioni / Chiusure
- `services/calendarService.ts`: CRUD lezioni manuali fa sync solo su `enrollment.appointments`, non su `lesson.attendees`, quindi la nuova architettura non è allineata.
- `services/enrollmentService.ts`: `syncEnrollmentFromLessonUpdate` aggiorna solo gli appointment delle enrollments se `lessonId` è presente; non copre casi di attendance non legata correttamente.
- `services/enrollmentService.ts`: `syncEnrollmentFromLessonDeletion` usa match fuzzy su data/ora/sede per rimuovere appuntamenti, ma non gestisce `courseId` o più lezioni simili nello stesso slot.
- `services/enrollmentService.ts`: `suspendLessonsForClosure` sospende solo `Scheduled` in `enrollment.appointments` e aggiunge `[SOSPESO]` nella descrizione delle lezioni, senza aggiornare gli `attendees` in `lessons`.
- `services/enrollmentService.ts`: `restoreSuspendedLessons` ripristina le descrizioni ma non verifica stato coerente degli `attendees`.
- `pages/Calendar.tsx`: raggruppa master/slave solo su `date/startTime/locationName`, non su `courseId`/`slotType`, quindi corsi diversi possono essere erroneamente fusi.
- `pages/Calendar.tsx`: normalizzazione sedi master avviene solo per nome, non per `locationId`, con possibili classificazioni errate.

## 6. Architettura complessiva / Confusione vecchia vs nuova
- La codebase convive con due modelli di presenza:
  - `enrollment.appointments` (legacy),
  - `lessons.attendees` + `lesson` master (nuovo).
- Questa convivenza non è formalizzata: manca una fonte unica di verità.
- Molte funzioni replicano sincronizzazione e deduplicazione, aumentando il rischio di regressioni.
- La gestione `SubscriptionType.tokens` vs contatori legacy è un altro esempio di modello nuovo non applicato coerentemente.

## File coinvolti
- `services/enrollmentService.ts`
- `services/paymentService.ts`
- `services/financeService.ts`
- `services/courseService.ts`
- `services/calendarService.ts`
- `components/EnrollmentForm.tsx`
- `pages/EnrollmentPortal.tsx`
- `pages/Attendance.tsx`
- `pages/Calendar.tsx`
- `pages/Settings.tsx`
- `components/finance/InstitutionalWizard.tsx`
- `components/Finance/EnrollmentFinancialWizard.tsx` (se presente)
- `types.ts`

## Prompt specifico per Claude AI

### Obiettivo
Sei Claude AI. Ricevi un codice React/TypeScript con backend Firestore. Devi elaborare un piano risolutivo completo per allineare i seguenti domini:

1. iscrizioni / pagamenti / preventivi / fatture ghost / Fiscal Doctor;
2. abbinamento iscrizioni / corsi / sedi / calendario;
3. modello abbonamenti / bundle / token / slot;
4. presenza / consumo slot / sincronizzazione legacy vs nuova architettura;
5. gestione lezioni manuali e chiusure scolastiche.

### Informazioni chiave
- Il progetto usa due architetture di presenza: `enrollment.appointments` e `lessons.attendees`.
- Il nuovo modello subscription bundle è `SubscriptionType.tokens`, ma il codice ancora usa i campi legacy `labCount, sgCount, evtCount, readCount`.
- Il calendario mostra eventi e raggruppa slot, ma non considera `courseId`/`slotType` in modo robusto.
- Le chiusure scolastiche sono gestite con `suspendLessonsForClosure` / `restoreSuspendedLessons`, ma la logica interessa solo descrizioni e `appointments` legacy.
- Le operazioni di update/delete sulle lezioni manuali (calendarService) propagano modifiche solo agli `appointments` dell'enrollment.
- La finanza ha conflitti in ghost invoices, analisi affitti, riconciliazione e pulizia collegamenti enrollmentId.

### Richieste specifiche
Elabora un piano che includa almeno:

- una mappa dei vincoli e delle fonti di verità per dati di:
  - iscrizione,
  - lezione,
  - attendee,
  - sottoscrizione/bundle;
- una strategia per normalizzare `SubscriptionType.tokens` e mantenere compatibilità con la configurazione legacy;
- un piano per correggere i processi di booking dei corsi (`bookStudentIntoCourseLessons`) e la generazione delle lezioni `LAB+SG`;
- un piano per ristrutturare la sincronizzazione tra calendario e iscrizioni, con casi d'uso `updateLesson`, `deleteLesson`, `suspendLessonsForClosure`, `restoreSuspendedLessons`;
- una strategia per ricondurre l'interfaccia presenze (`pages/Attendance.tsx`) a una sola fonte di verità, riducendo deduplicazioni per data/ora e mantenendo i conteggi corretti;
- una proposta di refactor dei servizi chiave (`enrollmentService`, `courseService`, `calendarService`, `paymentService`, `financeService`) per separare chiaramente business logic, sincronizzazione e accesso Firestore;
- risoluzione conflitti finanza: standardizzazione ghost invoices, fix analisi affitti duplicazioni, riconciliazione multi-iscrizione, pulizia enrollmentId.

### Output richiesto
Crea un piano dettagliato con:

- passaggi operativi in ordine di priorità;
- modifiche di file raccomandate;
- rischi principali e possibili regressioni;
- suggerimenti per test automatici o validazioni manuali.

### Contenuto extra
Aggiungi anche:

- una stima di quali parti del codice possono essere modificate in modo incrementale senza rompere il resto;
- quali funzionalità possono essere lasciate temporaneamente in compatibilità legacy prima di un refactor completo;
- quali parti del codice possono essere modificate in modo incrementale senza rompere il resto, e quali non devono essere modificate in un piano coerente e tassonomico per un refactor completo.

---

Questo file deve essere usato come documento unico di input per pianificare la risoluzione completa dell'architettura dei corsi, delle presenze, degli abbonamenti, del calendario e della finanza.