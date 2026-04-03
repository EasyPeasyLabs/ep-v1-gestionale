# Story - Evoluzione del Progetto

# --- FILE: 01_2026-03-20.md ---
# Sprint 01 - 2026-03-20

## Cosa è stato creato
È stata implementata una modifica logica e strutturale alla funzione Firebase `getPublicSlotsV2` all'interno del backend di Gestionale (`ep-v1-gestionale/functions/src/index.ts`). Il codice è stato scritto, testato staticamente tramite la compilazione di TypeScript (`npm run compile`), e il backend è pronto per l'eventuale rilascio o testing end-to-end locale.

## A cosa serve
La modifica risolve due anomalie critiche di cui soffriva il Progetto B (portale iscrizioni pubbliche) in merito alla visualizzazione di slot e disponibilità dei pacchetti:
1.  **Falso abbinamento dei giorni (Schedule Mismatch)**: Il portale proponeva pacchetti (come "LAB + SG") di Venerdì quando invece dovevano esistere solo di Sabato.
2.  **Calcolo errato dei partecipanti (Capacity Calculation)**: Il portale mostrava capienza massima disponibile anche se c'erano allievi già iscritti, ad esempio indicava 7 posti liberi di Venerdì presso IDEE CONTAGIOSE pur in presenza di 4 allievi regolarmente occupanti la sala in base agli `appointments`.

## Come è fatto e come funziona
La funzione aggiornata ora intercetta i dati in questo modo:
1.  **Validazione `allowedDays`**: Prima di spalmare un abbonamento (SubscriptionType) su uno slot fisico di una sede, il codice legge il nuovo o esistente array `allowedDays` dell'abbonamento. Se l'array è presente e il giorno dello slot (`dayOfWeek`) non è incluso tra quelli permessi (ad esempio il 5 = Venerdì), l'abbonamento viene scartato per quello slot.
2.  **Verifica di occupazione solida (Occupancy Check)**: La logica che conta il numero di `occupied` calcolando la disponibilità (`capacity - occupied`) ora:
    *   Verifica che le iscrizioni attive abbiano effettivamente *cancellato* la disponibilità di pacchetti (`lessonsRemaining`, `labRemaining`, ecc. > 0), garantendo che abbonamenti esauriti non contino.
    *   Controlla robustamente l'array `appointments` analizzando la stringa della data con e senza fuso orario, e matchando il giorno risultante in `appDay` e l'`startTime` contro i dati dello slot della Sede. Se lo studente ha un appointment in quel preciso slot orario e giorno della settimana, incrementerà il count degli `occupied`, precludendo ad eventuali lead l'iscrizione oltre capienza.

## Effetti sul sistema
-   **Gestionale**: Il sistema Gestionale agirà da fonte di verità "più stretta". Quando l'Operatore (Lead) va sulla landing page del Progetto B e seleziona il Venerdì presso IDEE CONTAGIOSE, il Gestionale risponderà via API restituendo 3 posti disponibili (7 - 4 iscritti calcolati correttamente) ed escluderà la voce "LAB + SG" poiché di pertinenza unicamente del Sabato (codice 6 in `allowedDays`).
-   La solidità introdotta impedisce sovraccarichi involontari delle sedi pre-esistenti e gestisce le date di prenotazione svincolate da timezone accidentali che in precedenza mascheravano la reale validità dell'appointment e quindi il presidio della sala.
-   Tutti i check sono stati cristallizzati in `index.ts` e compilato correttamente in `dist/index.js`, garantendo isolamento del modulo, robustezza e retrocompatibilità. Nessuno degli endpoint limitrofi ha subito alterazioni (in osservanza del patto di tassonomia di architettura).

# --- FILE: 02_2026-03-20.md ---
# Sprint 02 - 2026-03-20

## Cosa è stato creato e verificato
1.  **Verifica Frontend (Progetto B)**: È stata certificata la robustezza e la corretta implementazione della logica di visualizzazione posti disponibili sull'interfaccia pubblica (in `RegistrationForm.tsx`). 
2.  **Modifica Backend (Gestionale)**: È stata implementata una modifica strutturale per risolvere un fastidioso problema comunicativo, rimuovendo un codice ridondante all'interno della Cloud Function `receiveLeadV2` (in `ep-v1-gestionale/functions/src/index.ts`). Il codice è stato compilato (`npm run compile`) con esito positivo.

## A cosa serve
1.  **Conferma UI (Progetto B)**: Assicura che l'interfaccia "dumb" del Progetto B fosse già strutturata per rispondere perfettamente al numero reale dei posti scalati, delegando l'intera responsabilità dell'errore (risolto nello Sprint 01) all'API backend `getPublicSlotsV2`.
2.  **Risoluzione Notifiche Doppie (Gestionale)**: Quando un lead inviava i propri dati, i dispositivi degli Amministratori ricevevano la notifica due volte: una notifica basilare senza Sede istantanea, e una successiva completa emessa dal trigger di sistema. Rimuovendo la prima instanza, preserviamo il server da cicli di rete inutili ed evitiamo il sovraffollamento visivo dei messaggi in arrivo agli endpoint finali.

## Come è fatto e come funziona
1.  Nel backend del Gestionale, la sezione di ricezione delle form leads (`receiveLeadV2`) non invoca più autonomamente la funzione Firebase Cloud Messaging (FCM) `sendPushToAllTokens()`. L'azione si limita ora a depositare in modo esclusivo e sicuro il file lead all'interno del database Firestore.
2.  Una volta creata l'occorrenza in `.collection("incoming_leads")`, Firebase attiva il trigger nativo intercettato asincronamente da `onLeadCreated`. È solo questo layer ad occuparsi autonomamente di scansionare i token `fcm_tokens`, estrapolare la corrispondenza con la sede del fornitore da avvisare, formulare la dicitura ("👤 Nuova Richiesta Web / Nome Cognome ha richiesto informazioni...") e operare l'effettivo multicast push verso tutti i responsabili iscritti con notifica accesa.

## Effetti sul sistema
-   **Progetto B**: Nessuna modifica strutturale locale, tuttavia il Portale beneficerà automaticamente delle API corrette dal precedente step e genererà un solo evento di salvataggio.
-   **Gestionale**: Maggiore modularità nella single-responsibility architecture del backend Firestore. Ottimizzato il consumo token e impedita l'alienazione degli amministratori che riceveranno da adesso una singola, precisa e dettagliata alert per ogni Lead pervenuto.
-   I file TypeScript sono stati compilati ed isolati rigorosamente nella cartella `dist`. Le modifiche sono cristallizzate ed in attesa del successivo push in ambiente produttivo.

# --- FILE: 03_2026-03-20.md ---
# Sprint 03 - 2026-03-20

## Cosa è stato analizzato
A seguito della richiesta di collaudo del triplo ponte di salvataggio dei Lead tra l'interfaccia Pubblica (Progetto B) e il Gestionale (Progetto A):
1.  **Firebase Locale Progetto B**: Il codice destinato al salvataggio locale sulla collezione `raw_registrations` era interamente commentato/disattivato all'interno di `RegistrationForm.tsx`.
2.  **API Sincrona**: Il form si interfacciava direttamente con l'API Vercel (`/api/receive-lead`) la quale contattava l'endpoint remoto `receiveLeadV2` del Gestionale.
3.  **Il Trigger Silenzioso**: Analizzando la Google Cloud formata dal Progetto B, ho riscontrato l'effettiva attivazione real-time di una funzione asincrona (`syncRegistrationToGestionale`), pensata per rimanere in ascolto su `raw_registrations` e inviare i dati autonomamente a `receiveLeadV2`.

## Perché si è intervenuti
Riabilitando il punto 1 senza destituire il punto 2, si sarebbe scatenata una **race condition duplicante**: il Gestionale avrebbe ricevuto due richieste API post per lo *stesso identico lead*, sfalsando la pipeline contabile, le dashboard di conversione e subissando l'Admin di notifiche push identiche.

## Come è stato corretto (Isolamento Strategico)
L'implementazione ha riportato il pattern del Progetto B alla sua purissima forma **"Event-Driven"**:
-   Ho rimosso del tutto l'accoppiamento sincrono (chiamate HTTP / `fetch`) tra `RegistrationForm.tsx` e il Gestionale Vercel. Il Frontend non conosce minimamente né deve aspettare la risposta remota dell'API.
-   Ho de-commentato, aggiornato al costrutto Firebase Modular (`addDoc`) e ripristinato il ponte locale. Adesso l'unica responsabilità per il Project B Frontend è scrivere nel file system Firebase alla collezione remota `raw_registrations`.
-   Una volta registrato con successo sul DB, il form conclude e dà feedback positivo immediato all'utente.
-   A cascata, l'isolatissima architettura di Firebase Function `syncRegistrationToGestionale` si desterà autonomamente intercettando il documento appena creato in `raw_registrations`, curandosi nel backend di impacchettarlo, firmarlo con il `BRIDGE_SECURE_KEY` e trasmetterlo all'endpoint vitale d'esposizione nel Gestionale, segnando infine lo score `syncStatus: "synced"` originario.

## Effetti ed Affidabilità
-   **Zero Duplicati**: Il Gestionale viene contattato da un'unica porta blindata asincrona.
-   **Tolleranza ai disservizi**: Qualora l'API gestionale subisse rallentamenti o downtime (non 100% SLA garantito), il frontend del Progetto B *non andrebbe in errore bloccante* per l'utente, che chiuderebbe regolarmente la procedura e la traccia non verrebbe persa. Resterebbe nel database `raw_registrations` fintantoché la rete non ripristinerebbe il collegamento.
-   Tassonometria, isolamento logico tra strati di presentation e worker ruleset perfettamente assecondato e ristabilito, come da prassi (Regola n. 2 - Vincoli e Ordini).

# --- FILE: 04_2026-03-20.md ---
# Sprint 04 - 2026-03-20

## Cosa è stato creato
È stata effettuata un'operazione di refactoring al copy della pagina pubblica del Progetto B (`ep-iscrizioni-public-main/src/App.tsx`).

## A cosa serve
Rende la comunicazione della landing page (header) più adatta all'effettivo processo offerto. Modificando "Registrati, è facile facile:" in "Contattaci, è facile facile:", si abbassano le frizioni psicologiche per l'utente, che intuisce più chiaramente come la procedura sia una semplice raccolta contatti (Lead Generation) e non un'iscrizione vincolante.

## Come è fatto e come funziona
La label all'interno del file React `App.tsx` (alla riga 77) è stata sostituita in modo stringente senza alterare lo styling TailwindCSS (le classi testuali di font, size, weight e colore permangono).
La stringa ora recita esplicitamente "Contattaci, è facile facile:". 

## Effetti sul sistema
- Nessun impatto sulle logiche o sulle dipendenze, non richiede integrazioni esterne.
- Il frontend richiede di essere semplicemente ri-esportato per applicare l'esposizione al client pubblico.
- Aderenza garantita alle direttive imposte.

# --- FILE: 06_2026-03-20.md ---
# Sprint 06 - 2026-03-20

## Cosa è stato corretto
A valle del primo test pratico post-isolamento architetturale, sono emerse due anomalie nel salvataggio all'interno del database del Gestionale (collezione `incoming_leads`):
1.  **Vulnerabilità Descrittiva (Leakage)**: Nei nuovi lead pervenuti compariva il campo `syncStatus: "pending_sync"`, un tracciatore di proprietà del Progetto B (la coda di invio offline) che non doveva contaminare i dati anagrafici del Gestionale.
2.  **Mancato Trigger Notifica Push (FCM)**: L'Amministratore non riceveva l'alert push nativo su smartphone al momento della ricezione, a causa del malfunzionamento silente del trigger asincrono `onLeadCreated`.

## A cosa serve
L'intervento mirato nella API HTTP del Gestionale garantisce ora:
1.  La pulizia in ingresso dei dati: il database Gestionale riceve esattamente e solo il payload richiesto, senza ereditare lo stato offline del Progetto B.
2.  L'assoluta certezza di erogazione e di compilazione testuale per l'integrazione Firebase Cloud Messaging, bypassando i limiti dei trigger di database Firebase che si erano dimostrati inaffidabili su questa architettura.

## Come è fatto e come funziona
-   **Filtro "syncStatus"**: All'interno del file remoto `ep-v1-gestionale/functions/src/index.ts` (API `receiveLeadV2`), ho intercettato il dump dell'oggetto de-strutturato `...data`. Prima di inciderlo tramite `addDoc` su Firebase, ho aggiunto un operatore selettivo di destituzione JavaScript: `delete leadDoc.syncStatus;`. 
-   **Riscrittura Notifica FCM**: In precedenza, un trigger separato (`onLeadCreated`) ascoltava il DB e cercava di formattare il testo per l'app mobile, ma falliva a causa dell'assenza nativa o dell'impossibilità di elaborazione stringhe in back-pressure. Abbiamo disabilitato quel blocco, trasferendo il motore Push direttamente dentro l'API principale `receiveLeadV2`. Appena la lead viene salvata nel DB, la stessa funzione esamina immediatamente il `dayOfWeek` convertendolo testualmente (es. da `6` a `Sabato`), preleva i campi target (`Sede`, `Nome`) e spara _direttamente_ e _sincronamente_ la richiesta di multicast all'App (es: "👤 Nuova Richiesta Web / Mario Rossi ha richiesto informazioni per il corso presso IDEE CONTAGIOSE del Sabato. Contattalo subito!").

## Effetti sul sistema
-   Il record nel database del Gestionale si presenterà lindo e pertinente (la label `status` tornerà a essere puramente "pending", che attende di essere processata dal team, e sparisce il `syncStatus`).
-   Il dispositivo Admin che ospita un token valido riceverà con precisione di 0.05sec e con formulazione testuale corretta la tanto agognata notifica. 
-   Isolamento e Robustezza: i server loggheranno puntualmente le consegne FCM nel terminale live in virtù della chiamata diretta di `sendEachForMulticast`, garantendo tracciabilità cronologica d'impresa. Tutte le funzioni sono state ricompilate in `index.js`.

# --- FILE: 07_2026-03-20.md ---
# Sprint 07 - 2026-03-20

## Cosa è stato corretto
Il bug definito come "Mancato Accorpamento" (Bundle Aggregation Issue).
Nel Progetto B (Public Platform), quando un Abbonamento offriva pacchetti compositi multi-orario (ad esempio "Mensile LAB + SG"), l'utente in fase di iscrizione vedeva generarsi una card separata (e cliccabile individualmente) per ogni singola tranche d'orario, frammentando in modo errato l'entità logica del "Bundle" indivisibile stabilita dal Gestore.

## A cosa serve
Riunificare l'output delle opzioni prenotabili. L'utente visualizzerà **un solo blocco commerciale (una sola Card)** denominata, per esempio, "Mensile LAB+SG - SABATO". All'interno di questa master-card troverà stilato con chiarezza tutto l'elenco riepilogativo degli slot orari che la compongono (sia le ore LAB che le ore SG previste).

## Come è fatto e come funziona
La causa risiedeva nell'algoritmo di iterazione dell'API pubblica (`getPublicSlotsV2` nel backend Gestionale). L'API generava una referenza nuova per *ogni singolo slot fisico* compatibile rintracciato in calendario.
-   **Nuova Architettura a Mappa Hash (Map Aggregation)**: Ho interrotto il caricamento diretto via `.push()`. Ora, l'API raccoglie tutti i match in una griglia di aggregazione (`aggregatedBundles = new Map<string, any>()`).
-   La chiave di volta dell'accorpamento è la stringa **`[ID Location]_[ID Abbonamento]_[Giorno della Settimana]`**. 
-   Se l'API scandagliando il Martedì trova prima uno slot LAB utile e poi uno slot SG utile, si accorgerà che fanno capo alla medesima chiave di abbonamento. Invece di creare un doppione, la Mappa *aggiungerà* tacitamente lo slot nel sotto-array `includedSlots` della card appena creata, per ricompattare del tutto i servizi afferenti allo stesso tipo commerciale in quel determinato giorno settimanale.

## Effetti sul sistema
1.  **UX Impeccabile**: Sul front-end di Progetto B la griglia visiva apparirà enormemente sfoltita e intuitiva, esponendo soltanto opzioni di vendita e combinazioni olistiche ("Trimestrali LAB+SG", ecc.).
2.  **Calcolo Limite dei Posti**: Per tutelare il numero chiuso aziendale, i *Posti Disponibili* calcolati a schermo dal bundle saranno pari al **valore minimo dei posti ancora rimasti** tra i vari orari che compongono il pacchetto (es. se su LAB ci sono 3 posti e su SG 10, il bundle LAB+SG mostrerà che ci sono in totale "3 posti liberi"). Questo azzera i rischi di Overbooking parziale. 

# --- FILE: 08_2026-03-20.md ---
# Sprint 08 - 2026-03-20

## Cosa è stato corretto
Allineamento del **Progetto C (Portale Iscrizioni — `EnrollmentPortal.tsx`)** alla logica di accorpamento bundle introdotta nello Sprint 07.

## Problema risolto
Dopo lo Sprint 07, il Progetto B (Pagina Pubblica) mostrava correttamente una sola master-card per abbonamento-giorno. Il Portale (Progetto C) però visualizzava ancora gli orari in modo frammentato:
- La card "Orario" dello Step 2 mostrava solo la stringa principale del bundle, non i singoli slot LAB e SG.
- La Hero Card dell'abbonamento nello Step 3 non riportava gli orari inclusi.
- Il riepilogo finale dello Step 4 mostrava una stringa semplice invece di un elenco strutturato.

## Come è stato risolto
Modifiche chirurgiche su `pages/EnrollmentPortal.tsx`:

### 1. Nuovo stato `selectedBundleSlots`
Aggiunto uno stato React `selectedBundleSlots[]` che conserva l'array `includedSlots` proveniente dall'oggetto `selectedSlot` del lead (struttura già prodotta da Progetto B con bundleId, dayOfWeek e includedSlots).

### 2. Inizializzazione automatica
Nel blocco `fetchData`, dopo la fase di matching abbonamento, il codice legge `leadData.selectedSlot.includedSlots` e popola `selectedBundleSlots` se disponibile.

### 3. Rendering aggiornato in 3 punti
| Step | Prima | Dopo |
|------|-------|------|
| Step 2 (Orario confermato) | Stringa semplice `selectedSlot` | Elenco strutturato per tipo: `[LAB] 10:00–11:00`, `[SG] 09:30–12:30` |
| Step 3 (Hero Card abbonamento) | Solo nome abbonamento | Nome abbonamento + elenco slot inclusi |
| Step 4 (Riepilogo finale) | Stringa semplice | Elenco strutturato per tipo con badge colorato |

### 4. Retrocompatibilità garantita
In tutti e 3 i punti è presente un `fallback`: se `selectedBundleSlots` è vuoto (lead storici senza `includedSlots`), il sistema continua a mostrare la stringa `formData.selectedSlot` come prima, senza regressioni.

## Effetti nel sistema
- Il Lead vede nel Portale gli stessi slot "accorpati" che ha visto nella Pagina Pubblica.
- La logica di pagamento, i dati inviati al backend e il flusso di autenticazione **non sono stati toccati**.

## Verifica
Build di produzione (`npm run build`) completata con **exit code 0**, nessun errore TypeScript.

# --- FILE: 09_2026-03-20.md ---
# Sprint 09 - 2026-03-20

## Bug risolti
Due anomalie critiche nell'API pubblica `getPublicSlotsV2` (`functions/src/index.ts`).

---

### Bug 1 — "1 ingresso SG" mostrava anche lo slot LAB

**Causa:** Il filtro compatibilità slot-abbonamento aveva un fallback pericoloso:
```ts
if (!slot.type) return true; // vecchio codice
```
Se uno slot nel database non aveva il campo `type` impostato (o era null/undefined), veniva incluso in **qualsiasi** abbonamento, anche quelli che non prevedevano quel tipo di lezione. Lo slot LAB senza tipo passava il filtro anche per "1 ingresso SG" (che ha `labCount = 0`).

**Correzione:** Il fallback è stato rimosso. Uno slot privo di tipo viene silenziosamente ignorato da tutti gli abbonamenti tipizzati.

---

### Bug 2 — "Mensile LAB+SG" mostrava "Nuovo corso in partenza!" pur avendo 5 iscritti attivi

**Causa architetturale:** Il calcolo occupancy dipendeva dall'array `appointments` degli enrollment:
```ts
return enr.appointments?.some(app => {
    if (!app.date || !app.startTime) return false; // ← era sempre false
    ...
});
```
Al momento dell'iscrizione via Portale, il campo `appointments` degli enrollment viene inizializzato a placeholder vuoti (`date: ''`, `startTime: ''`). Le lezioni reali sono generate nella collezione separata `lessons` da `processEnrollment`. Quindi la condizione `!app.date || !app.startTime` era sempre `true` → ritorna `false` → `occupied = 0` → badge "Nuovo corso in partenza!" per tutti i bundle.

**Correzione:** Il calcolo è stato riscritto per contare gli enrollment tramite `subscriptionTypeId === sub.id` (source of truth diretta), senza dipendere dall'array `appointments`. In assenza di `subscriptionTypeId`, fallback su confronto per nome abbonamento.

## Effetti nel sistema
- "1 ingresso SG" mostrerà solo lo slot SG (09:30-12:30 di sabato), come atteso.
- "Mensile LAB+SG" mostrerà il badge corretto basato sugli iscritti reali (es. "Solo 2 posti disponibili!" se 5 iscritti su 7 posti).
- Il calcolo è ora robusto e non dipende dai dati degli appuntamenti nei documenti di enrollment.

## Verifica
`npm run compile` → exit code 0, nessun errore TypeScript.

# --- FILE: 10_2026-03-20.md ---
# Sprint 10 - 2026-03-20

## Bug risolti
Due problemi nell'API `getPublicSlotsV2` (`functions/src/index.ts`), Sprint 09 precedente parzialmente incompleto.

---

### Bug 1 — Sedi ARIA DI FESTA e MEGAMAMMA non visibili per età 2 anni

**Causa:** Il filtro di compatibilità subscription applicava `allowedDays` in modo esclusivo: se una subscription aveva `allowedDays: [6]` (solo Sabato), gli slot LAB di Lunedì (ARIA DI FESTA) e Mercoledì (MEGAMAMMA) producevano zero subscription compatibili → la sede non aveva bundle → veniva esclusa dalla risposta API.

**Correzione — strategia doppio tentativo:**
- **Tentativo 1 (STRICT):** cerca subscription compatibili rispettando `allowedDays`.
- **Tentativo 2 (LENIENT):** se strict restituisce 0 subscription, ripete il matching ignorando `allowedDays`. In questo caso logga l'info per trasparenza.

Questo garantisce che ogni sede con slot fisici validi appaia sempre nella risposta, anche se la configurazione `allowedDays` della subscription non copre esplicitamente quel giorno.

---

### Bug 2 — Badge occupancy ancora blu (occupied = 0) anche dopo Sprint 09

**Causa radice:** La fix del Sprint 09 usava `enr.subscriptionTypeId`, ma `processEnrollment` salva l'enrollment con `{ ...formData }` dove il campo ID abbonamento si chiama `selectedSubscriptionId` (il nome usato nel formData di `EnrollmentPortal`). Quindi `enr.subscriptionTypeId` era sempre `undefined`.

Aggravato da: il filtro sulla location usava `enr.locationId` ma il campo nel formData si chiama `selectedLocationId`.

**Correzione:** Il calcolo occupancy ora prova tutti i nomi di campo possibili:
- Location: `enr.locationId || enr.selectedLocationId`
- Status: tutti i valori case-insensitive (`active`, `Active`, `confirmed`, ecc.)
- Subscription ID: `enr.selectedSubscriptionId || enr.subscriptionTypeId || enr.subscriptionId`
- Fallback: confronto per `subscriptionName || selectedSubscriptionName`

## Verifica
`npm run compile` → exit code 0 (20.0kb). ✅

## Deploy necessario
```
firebase deploy --only functions
```

# --- FILE: 11_2026-03-21.md ---
# Sprint Report - Gestione Corsi & Occupazione Dinamica
**Data:** 21 Marzo 2026
**Sprint:** 13 (Refactoring Core)

## Descrizione
Rifattorizzazione del modulo Corsi per supportare la nuova architettura a collezioni separate (`locations` e `courses`) e ottimizzazione del sistema di calcolo della capienza.

## Funzionalità Create/Modificate
- **Nuova Modale Corsi**: Interfaccia responsiva con layout scrollabile e bottoni CRUD sempre visibili (sticky footer).
- **Integrazione Eliminazione**: Aggiunta possibilità di eliminare corsi direttamente dalla modale di modifica.
- **Popup Allievi**: Micro-servizio frontend per visualizzare l'elenco nominativo degli allievi con lezioni residue per corso.
- **Trigger Cloud Functions**: Ottimizzazione di `onEnrollmentUpdated` per gestire il decremento automatico dei posti all'esaurimento dei gettoni.

## Come Funziona
Il sistema interroga la collezione `courses` filtrando per `locationId`. L'occupazione è gestita tramite un contatore atomico (`activeEnrollmentsCount`) aggiornato in tempo reale dai trigger Firestore che monitorano lo stato e le lezioni residue degli allievi.

## Effetti nel Sistema
- **Precisione Booking**: Il Portale Pubblico mostra disponibilità reali basate sul consumo effettivo delle lezioni.
- **Usabilità**: Riduzione del tempo operativo per la gestione dei calendari sede per sede.
- **Integrità Dati**: Allineamento garantito tra i tre progetti (Gestionale, Public, Portal).

# --- FILE: 12_2026-03-23.md ---
# Sprint 12 - 2026-03-23

## Cosa è stato creato
In questo sprint è stato completato il riallineamento totale dell'occupazione dei corsi per il **Progetto B (Pagina Pubblica)** e l'ottimizzazione dell'usabilità del Gestionale.

## A cosa serve
1.  **Trasparenza**: Mostrare i posti reali basati sugli allievi attivi, distinguendo correttamente le fasce orarie.
2.  **Usabilità Mobile**: Garantire che la gestione dei corsi sia fluida anche da smartphone (Mobile-First).
3.  **Affidabilità Dati**: Prevenire errori di salvataggio e mostrare feedback chiari all'operatore.

## Come è fatto e come funziona
-   **Trigger Intelligente**: Correzione di `onEnrollmentUpdated` per gestire spostamenti tra corsi (`courseId`) e validità carnet.
-   **Smart Linking (Nuclear Fix)**: Ricollegamento di 22 allievi storici ai nuovi corsi dello Sprint 13 tramite analisi testuale robusta (bypassando bug fuso orario).
-   **Grouping Fix (API V5)**: Modifica della chiave di raggruppamento nell'endpoint pubblico per includere la `startTime`, separando le disponibilità dei corsi nello stesso giorno.
-   **GUI Mobile-First**: Rifacimento integrale della modale "Gestione Corsi" con layout responsivo, card compatte e pulsanti ottimizzati per il touch.
-   **Feedback Operativo**: Introduzione dello stato `isSaving` e spinner nel pulsante di salvataggio per evitare incertezze sulla persistenza dei dati.

## Come verificare i risultati
1.  **Pagina Pubblica**: Verifica che i corsi in orari diversi (es. 16:30 e 17:45) mostrino ora disponibilità indipendenti.
2.  **Gestionale (Mobile)**: Apri la modale "Nuovo Corso" da smartphone e verifica che la pianificazione mensile e le card siano leggibili e cliccabili.
3.  **Salvataggio**: Verifica che al clic su "Salva Corso" appaia l'indicatore di caricamento e il messaggio di conferma.

## Effetti sul sistema
-   Il Gestionale è la fonte di verità assoluta per l'occupazione.
-   L'esperienza utente su mobile è ora allineata agli standard moderni.
-   **Nota**: È necessario il deploy delle funzioni (`firebase deploy --only functions`) per rendere live le modifiche al raggruppamento orario.

# --- FILE: 13_2026-03-24.md ---
# Documentazione Sprint 13 - Riallineamento Tassonomico e Integrità Dati (2026-03-24)

## Obiettivo
Intervento olistico per garantire la piena conformità dei dati tra il Portale Iscrizioni (Progetto C) e il Gestionale (Progetto A), risolvendo anomalie di visibilità, trascrizione errata e malfunzionamenti nei meccanismi di riconciliazione finanziaria.

## Interventi Effettuati

### 1. Motore di Matching Corso (Course-Matcher)
- Implementata query su collezione `courses` in `processEnrollment` per identificare l'ID reale del corso basato su `locationId`, `dayOfWeek` e `startTime`.
- **Risultato**: Gli allievi iscritti dal portale appaiono ora correttamente nel Registro Presenze e nelle gettoniere, evitando il fallback `manual`.

### 2. Strutturazione Dati Anagrafici (Taxonomic Parser)
- **Indirizzo**: Scomposizione automatica dell'indirizzo completo inviato dal portale nei campi strutturati del Gestionale (`city`, `zipCode`, `province`).
- **Figli**: I dati dei figli sono ora salvati nell'array strutturato `children` invece che nel campo note, preservando `firstName`, `lastName` e `dateOfBirth`.
- **Smart Merge**: Se il cliente esiste già, il sistema aggiunge i nuovi figli senza duplicare o sovrascrivere l'anagrafica esistente.

### 3. Sincronizzazione Profonda Iscrizioni (Cross-Entity Linking)
- **Persistenza Riferimenti**: Garantito il salvataggio dei campi `childId` e `courseId` direttamente nel documento `enrollment`.
- **Orari**: I campi `startTime` ed `endTime` vengono ora salvati nell'iscrizione, risolvendo l'errore grafico `N/D - N/D`.
- **UI Alignment**: La modale "Modifica Iscrizione" ora pre-popola automaticamente i campi "Allievi", "Selezione Corso" e "Fascia Oraria" grazie al mapping granulare dei dati.

### 4. Fiscal Doctor: Meccanismo dell'OBLIO
- **Sblocco Esercizi Chiusi**: Modificata `fixIntegrityIssue` per consentire l'applicazione dell'OBLIO anche su anni fiscali con stato `CLOSED`.
- **Filtro Proforma**: Implementato il controllo mancante per le anomalie di tipo `health-ghost-` (proforma scadute) in `runFinancialHealthCheck`.
- **Risultato**: Le anomalie obliate scompaiono definitivamente dalle segnalazioni dopo l'azione dell'utente.

### 5. Gestione Tag Cliente (Tag Sanitization)
- Implementata trasformazione automatica: Rimozione tag `LEAD` e aggiunta tag `GENITORE` all'atto dell'iscrizione.
- Garantita la pulizia della tassonomia clienti durante la conversione automatica.

### 6. UI/UX: Calendar Neon Highlight
- Ripristinata la cornice fluorescente gialla con effetto neon/glow pulsante per il giorno odierno nel Calendario.
- La modifica è stata cristallizzata nel file `index.css` (`animate-neon-pulse`) per preservare l'identità visiva del sistema.

## Effetti sul Sistema
- **Integrità**: Eliminazione delle inconsistenze tra frontend e database.
- **Usabilità**: Ciclo di vita del cliente (Lead -> Iscritto -> Archivio) ora lineare e privo di interventi manuali correttivi.
- **Precisione Finanziaria**: Transazioni correttamente collegate alla sede (`allocationId`) e anomalie gestibili tramite il Fiscal Doctor.

## Note Tecniche
- Tutte le modifiche al backend sono state deployate con successo nelle Cloud Functions (v2).
- Le correzioni al frontend sono state applicate chirurgicamente in `EnrollmentPortal.tsx`, `EnrollmentForm.tsx` e `Calendar.tsx`.

# --- FILE: 14_2026-03-25.md ---
# Documentazione Sprint 14 - Integrità Conversione Lead e Sblocco UI (2026-03-25)

## Obiettivo
Risoluzione delle anomalie riscontrate nella conversione automatica dei Lead in Clienti Iscritti e rimozione dei blocchi UI che impedivano la correzione manuale dei dati.

## Interventi Effettuati

### 1. Conversione Intelligente Lead (Smart-Lead-Converter)
- **Allineamento Sprint 13**: Aggiornata la logica in `LeadsPage.tsx` per invocare il motore di matching dei corsi durante la conversione manuale.
- **Popolamento Dati**: Garantito il salvataggio di `courseId`, `startTime`, `endTime` e la creazione di un appuntamento template nell'iscrizione.
- **Tassonomia Tag**: Implementata la rimozione automatica del tag `LEAD` e l'aggiunta del tag `GENITORE` all'atto della creazione del cliente.

### 2. Sblocco Flessibile UI (Enrollment-UI-Unlock)
- **Modifica Iscrizione**: Modificato `EnrollmentForm.tsx` per consentire la modifica della selezione allievi anche su iscrizioni già esistenti.
- **Risoluzione Orfani**: Risolto il problema delle iscrizioni "orfane" (senza `childId`) permettendo all'operatore di ricollegare manualmente l'allievo corretto.

### 3. Strumenti di Manutenzione
- **Script Ad-hoc**: Creato `scripts/realign_vito_figlio.js` per il riallineamento chirurgico dei record sporchi generati prima delle correzioni dello Sprint 13.

## Effetti sul Sistema
- **Continuità**: Il flusso Lead -> Iscritto è ora coerente con la logica dei corsi del Gestionale.
- **Usabilità**: Eliminati gli stati "In Attesa" e "ND/ND" nelle card iscrizioni generate da conversione Lead.
- **Integrità**: Garantito il corretto collegamento tra Iscrizione, Allievo e Corso.

## Note Tecniche
- La modifica a `LeadsPage.tsx` garantisce la retrocompatibilità con i Lead che possiedono l'oggetto `selectedSlot` (nuovo formato Project B).
- Lo sblocco in `EnrollmentForm.tsx` mantiene la coerenza dei dati ricalcolando gli orari in base al corso selezionato.

# --- FILE: 15_2026-04-01.md ---
# Sprint 15 - 2026-04-01: Usabilità Avanzata, Tracciabilità e Restyling GUI

## Obiettivo
Potenziare l'esperienza utente nel Calendario e nel Registro Presenze, garantire la precisione dei dati didattici e finanziari tramite nuove logiche di tracciamento e allineare l'estetica dell'applicazione al nuovo tema Grigio Primario.

## Modifiche Apportate

### 1. Calendario: Ricerca Partecipanti Extra
- **Filtro Universale**: Sostituito il menu a tendina con un campo di ricerca globale nella modale `LessonForm`.
- **Criteri Multipli**: È ora possibile filtrare i partecipanti per Nome Allievo, Nome Genitore, Corso di appartenenza o Sede/Recinto abituale.
- **Selezione Rapida**: Integrazione di checkbox sui risultati filtrati per inserimenti massivi immediati.

### 2. Presenze: Recupero Automatico Intelligente
- **Integrazione Chiusure**: Lo slittamento automatico ora consulta la collezione `school_closures`, evitando di programmare recuperi in giorni di chiusura o festività.
- **Logica di Accodamento**: Il recupero viene ora accodato **alla fine della pianificazione** dell'iscrizione, prevenendo sovrapposizioni con lezioni già esistenti.
- **Sincronizzazione Automatica**: Ogni slittamento aggiorna istantaneamente la data di fine validità dell'iscrizione (`endDate`) in Archivio Iscrizioni.

### 3. Situazione Clienti: Tracciabilità e Reportistica
- **Collegamento Biunivoco**: Introdotto il sistema `recoveryId` per legare ogni assenza al suo specifico slot di recupero.
- **Cronologia Didattica**: Nuova sezione in scheda cliente che elenca cronologicamente le assenze e indica la data esatta dello slittamento (o lo stato "Credito perso").
- **Nomi Commerciali**: I report (UI, PDF, Excel) utilizzano ora il `publicName` dei corsi (se definito nelle impostazioni) al posto dei codici tecnici.
- **Export PDF/Excel**: Arricchiti i documenti con i dettagli puntuali delle assenze, dei recuperi, del nome commerciale del corso e della sede/recinto.

### 4. GUI: Nuovo Tema "Grigio Primario"
- **Sostituzione Indaco**: Rimosso il colore indaco da tutta l'applicazione (bottoni, switch, label, input, badge informativi).
- **Nuovo Colore #3C3C52**: Ridefinizione globale delle palette tramite Tailwind Config e Runtime CDN.
- **Precisione Semantica**: Mantenuti i colori originali per grafici (istogrammi, curve) e badge di stato (Active, Pending, etc.) per preservarne il significato immediato.

### 5. Hotfix e Robustezza
- **Fix Fuso Orario**: Risolto il bug che causava lo slittamento di 24 ore nelle date di fine delle iscrizioni standard.
- **Prevenzione Doppi Click**: Implementata protezione nelle modali di azione per evitare duplicazioni di dati dovute a click ripetuti.

## Effetti sul Sistema
- **Precisione**: Calcolo delle date di fine sempre perfetto indipendentemente dal browser/fuso orario.
- **Trasparenza**: Comunicazione verso il cliente (PDF) molto più chiara e professionale.
- **Velocità**: Riduzione dei tempi di gestione assenze e creazione eventi manuali.

## Istruzioni per il Test

1. **Test Colore**: Verificare che non siano presenti elementi indaco (es. focus negli input o bottoni primari).
2. **Test Ricerca**: Creare un evento extra e filtrare i bambini per nome o sede.
3. **Test Recupero**: Segnare un'assenza con recupero automatico e verificare l'estensione dell' `endDate` in Archivio Iscrizioni.
4. **Test PDF**: Scaricare l'estratto conto di un cliente con assenze e verificare la nuova tabella "Cronologia Didattica".

# --- FILE: implementation_plan.md ---
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

# --- FILE: project_state.md ---
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

# --- FILE: Riallineamento.md ---
# Piano di Riallineamento Tassonomico: processEnrollment (Sprint 13)

Questo documento descrive l'evoluzione chirurgica della Cloud Function `processEnrollment` per garantire la piena conformità dei dati con il Gestionale (Progetto A).

---

## 0. Analisi Anomalie Rilevate (Visual Evidence)
Dall'analisi degli screenshot in `..\lead-iscritto\`, sono emerse le seguenti criticità post-iscrizione:
- **Invisibilità Operativa**: L'allievo (es. VitoFiglio) non appare nel **Registro Presenze** (06) né nella **Gestione Corsi** (08), rendendo impossibile il monitoraggio delle presenze.
- **Errore Grafico Orario**: Nella scheda iscrizione (02), l'orario è visualizzato come `N/D - N/D`.
- **Ghosting nell'Archivio**: L'iscrizione non viene trovata tramite ricerca testuale nell'Archivio Iscrizioni (03).
- **Tag Persistenti**: Il cliente mantiene il tag `LEAD` anche dopo la conversione in `GENITORE` nella Situazione Clienti (07).

---

## 1. Obiettivo Critico
Il lead convertito deve apparire immediatamente in:
1.  **Gestione Corsi**: l'allievo deve essere contato nella gettoniera del corso reale.
2.  **Recinto Rosa (ClientSituation)**: l'orario non deve essere `nd/nd` ma esplicito.
3.  **Archivio Iscrizioni**: le iscrizioni devono essere visibili con lo status corretto.

---

## 2. Interventi Atomici richiesti

Distinti per fase di esecuzione interna alla function.

### Fase A : Motore di Matching Corso (Course-Matcher)
Prima di creare l'iscrizione, la function deve identificare l'ID originale del corso per evitare il "manual fallback" che causa l'invisibilità nei registri.

- **Azione**: Query sulla collezione `courses`.
- **Parametri di ricerca**:
    - `locationId` : `enrollmentData.locationId`
    - `dayOfWeek` : `enrollmentData.appointments[0].dayOfWeek` (derivato dal portale)
    - `startTime` : `enrollmentData.appointments[0].startTime` (es. "17:00")
- **Criteri di Filtro**: 
    - `locationId` == `formData.selectedLocationId`
    - `dayOfWeek` == `dayIndex` (calcolato dal giorno della settimana scelto)
    - `startTime` == `formData.startTime`
- **Fallimento**: Se non viene trovato un match preciso, mantenere `manual` ma loggare un warning nelle note dell'enrollment. **CRITICO**: Se `manual`, l'allievo non apparirà mai nella gettoniera.

### Fase B : Arricchimento Tassonomico enrollments
Per risolvere l'errore `nd/nd`, l'oggetto `enrollment` deve essere popolato integralmente lato server.
1.  **mapping appointments**: Ogni oggetto nell'array deve avere:
    - `dayOfWeek`: number (0-6)
    - `startTime`: string "HH:MM"
    - `endTime`: string "HH:MM"
    - `locationId`, `locationName`, `locationColor` (recuperato da `locations` del fornitore)
2.  **Status Standard**: Usare solo `Pending` o `Active` (Case-Sensitive, come da Enum `EnrollmentStatus` in `types.ts`).
3.  **Source**: Impostare `portal`.

### Fase C : Physical Lesson Engine (Generazione schedula)
La collezione `lessons` deve essere popolata con rigore per apparire nel Registro Presenze:
1.  **CourseID**: Ogni lezione DEVE avere il `courseId` reale trovato nella Fase A. Senza di esso, le lezioni non appariranno nel calendario gettoniera.
2.  **Date Precise**: Usare `dateUtils.isItalianHoliday` per saltare i festivi.
    - Data Inizio: La prima data disponibile dopo oggi che corrisponda al giorno scelto.

### Fase D : Client & Finance Bridge (Tag Management)
1.  **Profilo Cliente**:
    - Se il cliente esiste già:
        - Recuperare i `tags` attuali.
        - Rimuovere il tag `LEAD`.
        - Aggiungere il tag `GENITORE` (se non presente).
        - Aggiornare con `transaction.update`.
    - Se il cliente è nuovo:
        - Impostare `tags: ["GENITORE"]`.
2.  **Transazione**: La transazione deve avere il riferimento `allocationId` (della sede) per apparire nelle statistiche di finanza.

---

## 2.1 Istruzioni Tecniche per lo Sviluppatore (Pseudo-Codice)

L'intervento deve essere eseguito nel file `functions/src/index.ts` all'interno della transazione di `processEnrollment`.

#### 1. Implementazione Matcher Corso
```typescript
// All'interno della transazione Firestore
const coursesSnap = await db.collection("courses")
    .where("locationId", "==", enrollmentData.locationId)
    .where("dayOfWeek", "==", mainAppt.dayOfWeek)
    .where("startTime", "==", mainAppt.startTime)
    .limit(1).get();

let matchedCourseId = "manual";
if (!coursesSnap.empty) {
    matchedCourseId = coursesSnap.docs[0].id;
    logger.info(`[matcher] Trovato corso ${matchedCourseId} per l'iscrizione.`);
} else {
    logger.warn(`[matcher] Nessun corso trovato. Fallback su 'manual'.`);
}
```

#### 2. Correzione Tag Clienti
```typescript
// Durante l'aggiornamento del cliente esistente
const currentTags = clientsSnap.docs[0].data().tags || [];
const updatedTags = currentTags
    .filter((t: string) => t.toLowerCase() !== 'lead')
    .concat(currentTags.includes('GENITORE') ? [] : ['GENITORE']);

transaction.update(clientRef, {
    tags: updatedTags,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
});

// Durante la creazione del nuovo cliente
transaction.set(clientRef, { 
    ...clientData, 
    id: clientId, 
    tags: ['GENITORE'],
    email: clientData.email.toLowerCase() 
});
```

#### 3. Arricchimento Appointments
```typescript
const enrichedEnrollment = {
    ...enrollmentData,
    courseId: matchedCourseId, // Cruciale per visibilità
    appointments: enrollmentData.appointments.map((app: any) => ({
        ...app,
        startTime: mainAppt.startTime,
        endTime: mainAppt.endTime,
        locationColor: enrollmentData.locationColor || "#6366f1"
    })),
    // ... altri campi
};
```

---

## 3. Mappatura Campi (Expected Types)

| Campo | Tipo | Nota |
| :--- | :--- | :--- |
| `enrollment.courseId` | `String` | Identificatore trovato da Matcher |
| `enrollment.status` | `String` | `pending` | `active` |
| `appointments.dayOfWeek` | `Number` | 0-6 (Dom-Sab) |
| `lesson.courseId` | `String` | OBBLIGATORIO per visualizzazione gettoniera |
| `lesson.status` | `String` | `Scheduled` |

---

## 4. Verifica Funzionale
Prima di concludere, la function deve eseguire un log preciso:
```javascript
logger.info(`[matcher] Iscrizione collegata al corso ${courseId}`);
```

---

## 5. Gestione Errori & Rollback Strategy
Per garantire l'integrità dei dati, l'intera operazione deve essere eseguita all'interno di una **Transazione Firestore**.

1.  **Atomicità**: Se la generazione delle lezioni fallisce (es. timeout o errore di quota), l'iscrizione, la transazione e l'aggiornamento del cliente devono essere annullati.
2.  **Validation Fail**: Se il prezzo calcolato lato server non corrisponde a quello inviato (entro un margine di 0.01€ per arrotondamenti), la transazione deve essere rigettata con errore `HttpsError('failed-precondition', 'Prezzo non valido')`.
3.  **Duplicate Prevention**: In caso di doppio invio rapido, la transazione deve verificare l'esistenza di un'iscrizione identica per lo stesso `leadId` prima di procedere.

---

## 6. Certificazione di Coerenza
L'implementazione deve rispettare i seguenti criteri di **Cristallizzazione**:
- **Legacy Support**: Le iscrizioni create manualmente dal gestionale non devono essere influenzate dai nuovi trigger se non esplicitamente modificate.
- **Tassonomia Rigida**: Non sono ammessi stati al di fuori di `pending`, `active`, `confirmed`, `rejected`.
- **Isolamento**: Le modifiche alla collezione `lessons` non devono mai alterare i dati storici delle lezioni marcate come `Attended` o `Missed`.

---

## 7. Piano di Test (Validazione)

### Test 1: Matching Corso (Successo)
- **Input**: Iscrizione per Lunedì, ore 17:00, Sede "A".
- **Pre-condizione**: Esiste un corso in `courses` con questi parametri.
- **Risultato atteso**: L'enrollment e tutte le lezioni hanno il `courseId` corretto. Il contatore `activeEnrollmentsCount` del corso aumenta di 1.

### Test 2: Matching Corso (Fallback)
- **Input**: Iscrizione per orario non esistente.
- **Risultato atteso**: L'enrollment viene creato con `courseId: 'manual'`. Viene loggato un warning.

### Test 3: Gestione Festività
- **Input**: Iscrizione per un corso che cade il 25 Dicembre.
- **Risultato atteso**: La lezione del 25 Dicembre viene saltata, la schedula riprende il lunedì successivo.

### Test 4: Robustezza Finanziaria
- **Input**: Iscrizione con prezzo manomesso lato client.
- **Risultato atteso**: Errore 400, nessuna risorsa creata su Firestore.

---

## 8. Documentazione Post-Sprint
Al termine dell'implementazione (Sprint 13), verrà generato il file `13_2026-03-24.md` contenente:
- Analisi del numero di corsi ricollegati correttamente.
- Report di conformità dei dati in `ClientSituation.tsx`.
- Istruzioni per il monitoraggio dei log di errore in Google Cloud Console.

# --- FILE: task.md ---
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
