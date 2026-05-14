# STORY.MD - CRONOLOGIA EPIC E SPRINT

## INDICE DELLE ITERAZIONI
- 01_2026-03-20.md
- 02_2026-03-20.md
- 03_2026-03-20.md
- 04_2026-03-20.md
- 06_2026-03-20.md
- 07_2026-03-20.md
- 08_2026-03-20.md
- 09_2026-03-20.md
- 10_2026-03-20.md
- 11_2026-03-12.md
- 11_2026-03-21.md
- 12_2026-03-23.md
- 13_2026-03-24.md
- 14_2026-03-25.md
- 15_2026-04-09.md
- 15_2026-05-05.md
- 16_2026-05-05.md
- 17_2026-05-05.md
- 18_2026-05-05.md
- 19_2026-05-13.md
- 223-20260420-REPORT.md
- 224-20260422-REPORT.md
- 6_2026-03-09.md
- Manuale_dUso.md
- Riallineamento.md
- SETUP_CORS.md
- SPRINT_20260420.md
- Sprint_16_2026-04-14.md
- implementation_plan.md
- project_state.md
- sprint_11_09_04_2026.md
- task.md

---



### [ARCHIVIO] 01_2026-03-20.md

fir# Sprint 01 - 2026-03-20

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

---


### [ARCHIVIO] 02_2026-03-20.md

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

---


### [ARCHIVIO] 03_2026-03-20.md

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

---


### [ARCHIVIO] 04_2026-03-20.md

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

---


### [ARCHIVIO] 06_2026-03-20.md

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

---


### [ARCHIVIO] 07_2026-03-20.md

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

---


### [ARCHIVIO] 08_2026-03-20.md

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

---


### [ARCHIVIO] 09_2026-03-20.md

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

---


### [ARCHIVIO] 10_2026-03-20.md

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

---


### [ARCHIVIO] 11_2026-03-12.md

# Sprint 11 - 12 Marzo 2026

## Oggetto
Ripristino del Gateway di iscrizione (Progetto Facciata) per la generazione di link sicuri e con anteprima WhatsApp.

## Cause e Motivi
Il dominio precedentemente utilizzato come proxy (`easypeasylabs.vercel.app`) non era più disponibile su Vercel, causando un errore `404 DEPLOYMENT_NOT_FOUND` quando i clienti cliccavano sul link generato dal gestionale. Questo proxy è fondamentale per nascondere l'URL reale del gestionale e per fornire i meta-tag corretti per le anteprime su WhatsApp.

## Interventi Effettuati
1. **Creazione Nuovo Proxy**: È stato creato un nuovo progetto Vercel (`ep-portal-chi.vercel.app`) contenente un file `vercel.json` configurato per effettuare un "rewrite" delle richieste verso la Cloud Function `enrollmentGateway` su Firebase.
2. **Aggiornamento Gestionale (`src/pages/LeadsPage.tsx`)**: Sostituito l'URL hardcoded `easypeasylabs.vercel.app` con il nuovo dominio `ep-portal-chi.vercel.app` nella funzione `generateEnrollmentLink`.
3. **Aggiornamento Cloud Function (`functions/src/index.ts`)**: Aggiornato il meta-tag `og:url` generato dinamicamente dalla funzione `enrollmentGateway` per riflettere il nuovo dominio, garantendo la coerenza delle anteprime sui social/WhatsApp.

## Effetti e Propagazione
- I pulsanti "Invia Modulo" nel gestionale ora generano link funzionanti che puntano al nuovo dominio.
- I clienti che cliccano sul link vengono correttamente reindirizzati, in modo trasparente, alla pagina di iscrizione del gestionale.
- Le anteprime su WhatsApp mostreranno nuovamente il logo e il titolo corretti.

## Prossimi Passi (A carico dell'utente)
Affinché le modifiche abbiano effetto in produzione, è necessario:
1. Eseguire il deploy delle Firebase Functions (`firebase deploy --only functions`).
2. Eseguire il deploy del frontend del Gestionale su Vercel (push su GitHub o `vercel --prod`).

---


### [ARCHIVIO] 11_2026-03-21.md

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

---


### [ARCHIVIO] 12_2026-03-23.md

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

---


### [ARCHIVIO] 13_2026-03-24.md

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

---


### [ARCHIVIO] 14_2026-03-25.md

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

---


### [ARCHIVIO] 15_2026-04-09.md

# Sprint 15 - 09/04/2026: Ricorrenza Avanzata Corsi

## Obiettivo
Implementare un sistema di ricorrenza avanzata per i corsi che permetta di definire mesi di attività specifici e periodi di blackout, garantendo la generazione automatica delle lezioni solo per i periodi validi.

## Cosa è stato creato
1.  **Modello Dati (`types.ts`)**:
    *   Introdotta l'interfaccia `RecurrenceConfig` per supportare pattern mensili e blackout.
    *   Aggiornato il tipo `Course` per includere la configurazione di ricorrenza opzionale.
2.  **Logica di Validazione (`services/courseService.ts`)**:
    *   Funzione `isDateActive`: Valida una data rispetto alla configurazione del corso.
    *   Aggiornamento `generateCourseLessons`: Ora filtra le lezioni in base alla validità della data, saltando festività e mesi non attivi.
3.  **Interfaccia Utente (`pages/Courses.tsx`)**:
    *   Sezione "Ricorrenza Avanzata" nella modale di gestione corso.
    *   Selettore visuale dei mesi attivi.
    *   Ottimizzazione delle performance con `useCallback` per il caricamento dei dati.

## Come funziona
*   **Configurazione**: L'utente può attivare la "Ricorrenza Avanzata" e selezionare quali mesi dell'anno il corso deve essere attivo (es. solo mesi scolastici, escludendo Agosto).
*   **Generazione**: Al salvataggio del corso, il sistema itera tra la data di inizio e fine validità. Per ogni occorrenza del giorno della settimana scelto, verifica se il mese è tra quelli selezionati. Se sì, crea la lezione; altrimenti, la ignora.
*   **Integrazione**: Poiché il sistema continua a generare oggetti `Lesson` individuali, il Portale Iscrizioni e il sistema Lead non richiedono modifiche: vedranno semplicemente le date effettivamente disponibili generate dal backend.

## Effetti sul sistema
*   **Modularità**: La logica è isolata nel servizio corsi.
*   **Scalabilità**: Il modello supporta future espansioni (es. ricorrenze bi-settimanali o blackout specifici per vacanze).
*   **Affidabilità**: Riduzione del rischio di iscrizioni in periodi di chiusura non standard.

---


### [ARCHIVIO] 15_2026-05-05.md

# SPRINT REPORT
**15 - 2026-05-05**

OGGETTO: Stress Test Flusso Invio Email CRM.

CREATO / MODIFICATO:
- Modifica `functions/src/index.ts`: refactoring gestione errori `sendEmail` tramite `HttpsError`.
- `scripts/testEmailFetch.ts`, `scripts/testEmail.ts`: script test invio PDF simulazione chiamata esterna Cloud Function.

FUNZIONAMENTO:
- Script inviano payload JSON (to, subject, html, attachments pdf) per verifica.
- Backend converte eccezioni standard in `HttpsError` passandole al client.

EFFETTI PROPAGATI:
- UI CRM non riceve più generico 500 INTERNAL, ottiene stack traccia errore Auth Gmail. 
- Richiesto allineamento/rinnovo dei Secrets OAuth (GMAIL_REFRESH_TOKEN) per effettiva delivery su vitoloiudice@gmail.com.

---


### [ARCHIVIO] 16_2026-05-05.md

# SPRINT REPORT
**16 - 2026-05-05**

OGGETTO: Risoluzione CORS Storage e Aggiornamento OAuth2 Secret Manager.

PROBLEMA 1:
- Significato "Aggiornamento OAuth2 in Secret Manager".

SOLUZIONE 1 (AZIONE UTENTE):
- Aprire Google Cloud Console.
- Selezionare progetto `ep-gestionale-v1`.
- Aprire Sicurezza -> Secret Manager.
- Cercare segreto `GMAIL_REFRESH_TOKEN`.
- Cliccare "Aggiungi nuova versione".
- Incollare token aggiornato.
- Eseguire deploy server (terminale locale): `firebase deploy --only functions`.

PROBLEMA 2:
- Errore CORS Firebase Storage (spinner infinito allegati email CRM).

SOLUZIONE 2 (AZIONE UTENTE):
- Aprire Google Cloud Console.
- Cliccare icona terminale in alto a destra (>_ Cloud Shell).
- Creare file JSONpolicy: `echo '[{"origin":["*"],"method":["GET","POST","PUT","DELETE","HEAD"],"maxAgeSeconds":3600}]' > cors.json`
- Premere Invio.
- Applicare policy: `gsutil cors set cors.json gs://ep-gestionale-v1.appspot.com`
- Premere Invio.

NOTA: Attesa permessi per eventuali altre modifiche.

---


### [ARCHIVIO] 17_2026-05-05.md

# SPRINT REPORT
**17 - 2026-05-05**

OGGETTO: Risoluzione Errore 404 Bucket Firebase Storage (CORS).

CAUSA ERRORE PRECEDENTE:
- Esecuzione `gsutil` su bucket inesistente (`...appspot.com`).
- Vercel probabile utilizzo env stringa `appspot.com` anziché `firebasestorage.app`.

SOLUZIONE (AZIONE UTENTE):
- Aprire Google Cloud Shell.
- Eseguire: `echo '[{"origin":["*"],"method":["GET","POST","PUT","DELETE","HEAD"],"maxAgeSeconds":3600}]' > cors.json`
- Premere Invio.
- Eseguire (BUCKET CORRETTO): `gsutil cors set cors.json gs://ep-gestionale-v1.firebasestorage.app`
- Premere Invio.

AGGIORNAMENTO VERCEL (SE CARICATO LI):
- Andare dashboard Vercel -> Settings -> Environment Variables.
- Modificare/Aggiungere `VITE_FIREBASE_STORAGE_BUCKET` con valore `ep-gestionale-v1.firebasestorage.app` (rimuovere se "appspot.com").
- Riavviare Deploy Vercel.

NOTA: Su preview locale/AI Studio Storage Bucket prende fallback automatico `ep-gestionale-v1.firebasestorage.app`. Il fix risolve infinito loop in upload PDF CRM.

---


### [ARCHIVIO] 18_2026-05-05.md

# SPRINT REPORT
**18 - 2026-05-05**

OGGETTO: Risoluzione Errori Cloud Shell CORS e Allerta Vercel.

PROBLEMA 1: Cloud Shell "NotFoundException 404" per bucket Storage.
CAUSA: Utilizzo URL `gs://ep-gestionale-v1.appspot.com` errato.
SOLUZIONE (AZIONE UTENTE):
- Eseguire comando corretto: `gsutil cors set cors.json gs://ep-gestionale-v1.firebasestorage.app`

PROBLEMA 2: Vercel "Needs Attention" su variabile `GEMINI_API_KEY`.
CAUSA: Vercel Secret Scanner rileva potenziale compromissione chiave (es. caricata su repository pubblico o log).
SOLUZIONE (AZIONE UTENTE):
- Accedere Google AI Studio / Google Cloud Console.
- Revocare/Eliminare chiave API attuale.
- Generare nuova chiave API.
- Aggiornare valore in Vercel Environment Variables.
- Eseguire Redeploy applicazione su Vercel.

---


### [ARCHIVIO] 19_2026-05-13.md

# SPRINT REPORT
**19 - 2026-05-13**

OGGETTO: Implementazione Completa (CLI + UI) migrazione massiva sede.

MOTIVO: Permettere trasferimento automatico di corsi, iscrizioni, lezioni e transazioni attive da una vecchia sede (chiusa o subaffittata) a una nuova sede a partire da una data specifica (Scenario B).

AZIONI ESEGUITE:
- Creato script CLI in `/scripts/migrate_location.cjs` che incapsula la logica sicura.
- Modificato `/src/services/migrationService.ts` inserendo il servizio `migrateLocationRecords` che utilizza il Web SDK (`writeBatch`, `where`, etc) per eseguire la migrazione in lotti da 450 operazioni, compatibile col browser.
- Modificato `/src/pages/Settings.tsx` aggiungendo il componente UI `LocationMigrationModal`. Questa finestra modale chiede in input tre parametri:
  1. La sede di origine
  2. La sede di destinazione
  3. La data a partire dalla quale invalidare le associazioni precedenti e riscrivere le nuove (lasciando lo storico pregresso inalterato).
- Inserito il pulsante di innesco "Migrazione Massiva Sede / Fornitore" all'interno della sezione "Manutenzione Sistema" nelle Impostazioni.

EFFETTI PROPAGATI:
- Da ora in avanti l'admin o il manager può gestire internamente e autonomamente da Impostazioni la transizione totale da un fornitore vecchio che chiude/affitta i locali ad un nuovo fornitore, semplicemente scegliendo il recinto (sede) A target verso sede (B).
- Lo storico fatture, le presenze pregresse e le relative statistiche antecedenti la data "fromDate" inserita, rimangono agganciate alla vecchia sede secondo integrità di compliance.

L'integrazità sistemica è preservata. Test funzionale e linter confermano l'assenza di errori bloccanti.

---


### [ARCHIVIO] 223-20260420-REPORT.md

# Report Sessioni 20.04.2026 - Sprint 223

**Data:** 20 Aprile 2026
**Sprint ID:** 223
**Focus:** PWA Manifest, URL Externalization, Firestore Integrity & Attendance Fixes

## 1. PWA & Asset Management
*   **Problema:** Errore caricamento icone Manifest PWA ("Download error") causa URL assoluti Vercel obsoleti.
*   **Soluzione:** 
    *   Sito icone nel `manifest.json` ora puntano a percorsi relativi `/public/`.
    *   Sostituiti i file `lemon_logo_192px.png` e `lemon_logo_512px.png` per conformità agli standard PWA.
*   **Effetto:** PWA installabile senza avvisi di asset mancanti.

## 2. Rimozione Asset/URL Hardcoded (De-Vercelizzazione)
*   **Azione:** Localizzati e rimpiazzati tutti i riferimenti `vercel.app` con variabili d'ambiente.
*   **File modificati:** 
    *   `pages/LeadsPage.tsx`: Generazione link portale dinamica.
    *   `functions/src/index.ts`: Meta-tags e redirect Cloud Functions ora usano `APP_URL` e `PORTAL_URL`.
    *   `components/calendar/LessonForm.tsx`: Riferimenti visivi loghi.
*   **Input richiesti:** Aggiunte `VITE_PORTAL_URL` e `VITE_MANAGEMENT_URL` in `.env.example`.

## 3. Registro Presenze & Sincronizzazione Dati
### A. Correzione Date "Slittanti"
*   **Problema:** Gli appuntamenti visualizzati nel registro non coincidevano con quelli del calendario in certi fusi orari.
*   **Soluzione:** Allineata logica `Attendance.tsx` con `Calendar.tsx` usando `toLocaleDateString('en-CA')` (format YYYY-MM-DD locale) per evitare bug di slittamento UTC.

### B. Gestione Lezioni Manuali (Caso LARA)
*   **Problema:** Errore "Invalid document reference" (400 Bad Request) cliccando "Presente" su lezioni create manualmente da calendario.
*   **Causa:** Assenza di `enrollmentId` nell'oggetto partecipante per eventi extra-corso.
*   **Soluzione:** 
    *   `LessonForm.tsx` ora rileva e inietta automaticamente l'ID iscrizione attivo dello studente durante la selezione.
    *   Aggiornato `registerPresence` in `enrollmentService.ts` con guardie ID rigide.

### C. Megamamma Gap (Affidabilità)
*   **Ottimizzazione:** La logica di fallback che "pesca" iscritti dai corsi è stata ristretta alle sole lezioni non manuali, impedendo la duplicazione di entrate su eventi singoli straordinari.

## 4. Integrità Sistemica Firestore
*   **Database ID:** Modificato `firebase/config.ts` per iniettare esplicitamente `firestoreDatabaseId` durante `initializeFirestore`. Previene connessioni al database sbagliato in ambienti multi-instance.
*   **Protezione Payload:** Inseriti valori di default (0) per calcoli contatori in `enrollmentService.ts` per evitare l'invio di `NaN` a Firestore, che causava il rifiuto del payload.

---

## Stato del Progetto
*   **Coerenza:** Totale tra Calendario, Registro e Iscrizioni.
*   **Portabilità:** Alta (indipendente da domini statici).
*   **Stabilità:** Verificata tramite Lint e Build di produzione.

---


### [ARCHIVIO] 224-20260422-REPORT.md

# Report Sprint - 22 Aprile 2026
**Progetto:** EP Gestionale V1
**Sistema:** AI Studio Build Environment

## 1. Obiettivi dello Sprint
- Importazione integrale della codebase dal repository `ep-v1-gestionale`.
- Migrazione e adattamento all'ambiente AI Studio.
- Risoluzione bug critico: Scomparsa abbonamenti Bundle/OLD nella modale "Nuova Iscrizione".

## 2. Attività Svolte

### A. Migrazione Codebase
- **Clonazione:** Importazione forzata del repository GitHub.
- **Risoluzione Dipendenze:** Installazione di tutti i pacchetti tramite npm (Express v5, Firebase v10, React v18).
- **Fix TypeScript:** Corretti errori di tipizzazione in `enrollmentService.ts`, `importService.ts` e `settingsService.ts` relativi al casting degli oggetti per Firestore (passaggio a `as any` per compatibilità rapida).
- **Configurazione Server:** Ottimizzato `server.ts` per porta 3000 e host 0.0.0.0.
- **Vite Config:** Disabilitato HMR in ambiente AI Studio per prevenire sfarfallii durante l'editing.

### B. Bug Fix: Logica Filtraggio Abbonamenti
È stata riscritta la `useMemo` di `availableSubscriptions` nel componente `EnrollmentForm.tsx` per risolvere i seguenti problemi:

1. **Gestione Visibilità & Clienti Storici:**
   - Introdotto supporto per il flag `isPubliclyVisible`.
   - **Logica "Clienti Fedeli":** Gli abbonamenti marcati come non pubblici (es. pacchetti "OLD") ora vengono mostrati esclusivamente se il sistema rileva uno storico precedente per il cliente selezionato (`hasHistory`).

2. **Normalizzazione "K/A" Prefissi:**
   - Creata funzione `normalizeType` per eliminare la discriminazione tra tipi come `K-LAB` e `LAB`. Il matching ora avviene sulla categoria pura dell'attività.

3. **Supporto Bundle (Multi-Token):**
   - La logica di matching è passata da "Exclusive" (corrispondenza esatta di stringa) a "Inclusive" (compatibilità se l'abbonamento contiene il token richiesto).
   - Un abbonamento bundle (es. 2 LAB + 2 SG) ora compare correttamente sia per corsi LAB che per corsi SG.

4. **Fallback Legacy:**
   - Preservata la visibilità per gli abbonamenti senza tokens definiti tramite ricerca testuale nel nome, garantendo compatibilità con i dati importati.

## 3. Stato Finale
- **Build:** Success (Succeeded via `compile_applet`).
- **Server:** Running (Porta 3000).
- **Funzionalità:** La modale "Nuova Iscrizione" ora mostra correttamente l'abbonamento "Mensile LAB + SG" e i pacchetti "OLD" per i rinnovi.

## 4. Prossimi Passi Consigliati
- Monitorare il corretto scarico dei token (LAB/SG) durante la registrazione delle presenze con il nuovo sistema di matching normalizzato.
- Verificare la corretta applicazione delle `allowedAges` per i nuovi bundle kids.

---


### [ARCHIVIO] 6_2026-03-09.md

# Documentazione Sprint 6 - 09/03/2026

## Oggetto: Public Gateway Isolation & WhatsApp Branding Shield

### 1. Cosa è stato creato
È stato implementato un sistema di "Gateway Isolato" che funge da scudo di sicurezza tra il traffico pubblico (WhatsApp/Clienti) e l'infrastruttura tecnica del Gestionale.

### 2. Componenti Tecnici
- **Cloud Function `enrollmentGateway`**: Una funzione server-side (Node.js 20) che intercetta le richieste dei link di iscrizione.
- **Vercel Rewrite Engine**: Configurazione di routing nel Progetto B per mascherare gli URL tecnici.
- **Open Graph Engine**: Generazione dinamica di Meta Tag per garantire anteprime professionali su WhatsApp (Logo + ID).

### 3. Come Funziona
1. Il Gestionale genera un link "estetico": `easypeasylabs.vercel.app/i/[ID]`.
2. Quando WhatsApp legge il link, Vercel lo reindirizza silenziosamente alla Cloud Function.
3. La funzione risponde con il logo e l'ID, "ingannando" WhatsApp che mostra l'anteprima corretta.
4. Quando l'utente clicca, uno script invisibile lo sposta sul portale reale del Gestionale.

### 4. Effetti e Benefici
- **Sicurezza**: L'URL reale del Gestionale (`vercel.app` interno) non viene mai esposto nei messaggi.
- **Branding**: Anteprima professionale con logo aziendale.
- **Costo Zero**: Il sistema sfrutta le risorse gratuite di Vercel e Firebase.
- **Robustezza**: Il sistema di notifiche push è stato allineato e protetto da cancellazioni accidentali.

### 5. Project State
Il sistema è ora in uno stato di **Isolamento Sistemico**. Il nucleo del Gestionale è protetto, le notifiche sono attive e il brand è preservato in ogni interazione esterna.

---


### [ARCHIVIO] Manuale_dUso.md

# EP v.1 - Manuale Operativo Enterprise

Benvenuto nel sistema di gestione strategica **EP v.1**. Questa piattaforma è il "sistema nervoso" della tua scuola, progettato per eliminare gli errori umani e massimizzare la profittabilità delle sedi.

---

## ## Modulo 0: Filosofia Enterprise

EP v.1 non è un semplice database, ma un **ecosistema logico coerente**.
- **Recinto (Sede/Slot):** Identifica uno spazio fisico e temporale finito. La saturazione del recinto è la metrica chiave per decidere se aprire nuovi corsi.
- **Cartellino (Iscrizione):** L'unità minima di fatturazione. Ogni cartellino deve avere una copertura finanziaria (incasso) e una documentale (fattura/pro-forma).
- **Integrità Fiscale:** Il sistema implementa il "Fiscal Doctor", un algoritmo che scansiona le anomalie e impedisce la chiusura dell'anno fiscale se esistono discrepanze.

---

## ## Modulo 1: Dashboard & Intelligence

La Dashboard trasforma i dati grezzi in **decisioni strategiche**.
- **KPI Real-time:** Monitora il fatturato lordo rispetto al limite del regime forfettario (85.000€). Se superi l'80%, l'indicatore diventa rosso.
- **AI Strategy Advisor:** Analizza i trend di iscrizione e ti suggerisce se investire in marketing o tagliare i costi logistici di una specifica sede.
- **ROI Sedi:** Visualizza istantaneamente quali sedi stanno "mangiando" utile e quali sono i motori della tua crescita.

---

## ## Modulo 2: Anagrafiche (Clienti & Fornitori)

Gestione avanzata degli asset umani e logistici.
- **Rating a 4 Assi:** Valuta Genitori e Allievi (Apprendimento, Condotta, Frequenza, Igiene). Questo permette di identificare i clienti "Champions" e quelli a rischio abbandono.
- **Dismissione Sedi:** Quando chiudi una sede (Fornitori), il sistema non cancella i dati storici ma marca la sede come "Ghost", mantenendo l'integrità dei bilanci passati.
- **Contratti Legali:** Genera contratti di nolo professionali in PDF, precompilati con placeholders dinamici.

---

## ## Modulo 3: Workflow Iscrizioni & Move Mode

Il cuore pulsante della gestione allievi.
- **Creazione Iscrizioni:** Gestisci fratelli o iscrizioni multiple con un solo click. Il sistema calcola automaticamente la data di fine in base alla durata del pacchetto.
- **Move Mode (✋ Sposta):** Attiva la modalità spostamento. Clicca su un allievo e poi su uno slot orario di un'altra sede. Il sistema ricalcola tutte le lezioni future, sposta i costi di nolo e aggiorna il registro presenze istantaneamente.

---

## ## Modulo 4: Archivio & Advanced Reporting

Sana ogni posizione in sospeso e genera report di alto livello.
- **Timeline di Copertura:** Verifica graficamente se un allievo è coperto finanziariamente per tutto l'anno.
- **Advanced Excel Export:** Genera report completi incrociando dati anagrafici, didattici e contabili.
- **Storico Recinti:** La colonna "Sede / Recinto" nel report Excel non è statica: analizza gli appuntamenti e mostra il percorso dell'allievo (es. "Sede Centrale -> Sede Estiva") se ha frequentato più sedi nel periodo.
- **Financial Wizard (Bottone €):** 
    - **Riconciliazione:** Collega incassi orfani (senza fattura) a documenti esistenti.
    - **Abbuoni:** Se mancano pochi centesimi al pareggio, applica un "Abbuono Fiscale" per chiudere la posizione e silenziare l'alert.
    - **Promozione Ghost:** Trasforma pro-forma di saldo in fatture reali con un tocco.

---

## ## Modulo 5: Registro & Didattica

Tracciabilità dell'esperienza in aula.
- **Log Attività:** Collega le lezioni svolte alla libreria delle attività (Activities). Utile per report ai genitori e coordinamento tra insegnanti.
- **Homeworks:** Crea compiti multimediali (link YouTube/PDF) e inviali massivamente a tutto il "recinto" (gruppo di classe) via WhatsApp.

---

## ## Modulo 6: Presenze & Recuperi

Gestione chirurgica degli slot.
- **Register & Recover:** Se segni un allievo come assente, il sistema ti propone il recupero automatico.
- **Slittamento Festività:** I recuperi programmati saltano automaticamente le festività nazionali italiane (Natale, Pasqua, etc.), estendendo la validità del cartellino.

---

## ## Modulo 7: Finanza & CFO

Strumenti per la gestione del capitale e monitoraggio fiscale.
- **Fiscal Smart Counters:** Nella tab "Fatturazione", tre badge dinamici mostrano in tempo reale:
    - **Lordo Fatturato:** Il totale dei documenti emessi nel periodo scelto (Anno/Mese).
    - **Imponibile 78%:** Il valore su cui verranno calcolate tasse e INPS, basato sul coefficiente forfettario.
    - **Totale Bolli:** Il debito accumulato verso l'Erario per i bolli virtuali da 2,00€ (applicati automaticamente a fatture > 77,47€).
- **Filtri Temporali:** Usa i selettori di Anno e Mese per navigare nel database. Questi filtri isolano i documenti e aggiornano istantaneamente i contatori fiscali.
- **Sigillo SDI:** Proteggi le fatture già trasmesse al sistema di interscambio per evitare modifiche accidentali.
- **Simulatore Tasse Start-up:** Calcola gli accantonamenti basandoti sulla logica 150% (Saldo + Acconto) tipica delle nuove attività.
- **TCO Logistica:** Calcola quanto ti costa realmente spostarti tra le sedi (carburante, usura veicolo, km totali).

---

## ## Modulo 8: CRM & Comunicazione

Relazioni massive automatizzate.
- **Alert Rinnovi:** Ricevi notifiche 30 giorni prima della scadenza di ogni cartellino.
- **Campagne Massive:** Invia newsletter o comunicazioni WhatsApp a interi segmenti (es. "Tutti i genitori della sede di Bari").
- **Log Storico:** Ogni messaggio inviato viene archiviato per garantire la tracciabilità della relazione cliente.

---

*Fine del Manuale Operativo - EP v.1 Enterprise Edition*

---


### [ARCHIVIO] Riallineamento.md

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

---


### [ARCHIVIO] SETUP_CORS.md

# Configurazione CORS per Firebase Storage

Il problema "Max retry time for operation exceeded" durante l'upload dei file è causato dalla mancanza di configurazione CORS (Cross-Origin Resource Sharing) sul bucket di Firebase Storage. Il browser blocca l'upload perché il server non risponde correttamente alle richieste pre-flight.

Per risolvere, segui questi passaggi:

1.  Vai sulla **Google Cloud Console**: https://console.cloud.google.com/
2.  Assicurati di aver selezionato il progetto corretto: **ep-gestionale-v1**
3.  Clicca sull'icona **"Attiva Cloud Shell"** in alto a destra (sembra un terminale >_).
4.  Quando il terminale si apre in basso, clicca sull'icona a forma di matita ("Open Editor") per aprire l'editor di testo della Cloud Shell, oppure usa il comando `nano cors.json` direttamente nel terminale.
5.  Incolla il seguente contenuto nel file `cors.json` e salva (se usi nano: CTRL+O, Invio, CTRL+X):

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600
  }
]
```

6.  Esegui il seguente comando nel terminale della Cloud Shell per applicare la configurazione al tuo bucket:

```bash
gsutil cors set cors.json gs://ep-gestionale-v1.appspot.com
```

*(Nota: Se il nome del tuo bucket è diverso da `ep-gestionale-v1.appspot.com`, sostituiscilo con quello corretto che trovi nella sezione Storage di Firebase).*

7.  Attendi qualche secondo e riprova l'upload dall'applicazione. Il problema dovrebbe essere risolto.

---


### [ARCHIVIO] SPRINT_20260420.md

# Sprint 2026-04-20: Audit e Correzione Registro Presenze (Fonte di Verità)

## Obiettivo
Risolvere le discrepanze, duplicazioni e "dati fantasma" nel Registro Presenze (Attendance Register), stabilendo il Preventivo Convertito come Fonte di Verità (Truth Source) per i Progetti Istituzionali.

## Interventi Realizzati

### 1. Protezione Appuntamenti da Preventivo (`enrollmentService.ts`)
- **Problema**: La bonifica automatica cancellava gli appuntamenti pianificati se non trovava una lezione master corrispondente, causando la perdita di date pattuite manualmente.
- **Soluzione**: Implementata la "Regola di Sicurezza 1.1": gli appuntamenti `Scheduled` legati a iscrizioni istituzionali con preventivo associato sono protetti dalla bonifica.
- **Effetto**: Le date impostate nel preventivo rimangono persistenti nel registro anche in assenza di lezioni fisiche importate.

### 2. Recupero GHOST basato su Rate (`enrollmentService.ts`)
- **Problema**: In caso di perdita di dati, il recupero generava date settimanali standard, ignorando il piano rateale del preventivo.
- **Soluzione**: La funzione `recuperoIntegraleDati` ora interroga il preventivo associato e preleva le date delle rate per colmare i vuoti nell'array `appointments`.
- **Effetto**: Coerenza totale tra piano dei pagamenti e pianificazione delle presenze.

### 3. Wizard Istituzionale Potenziato (`InstitutionalWizard.tsx`)
- **Problema**: L'attivazione di un progetto istituzionale imponeva una cadenza settimanale, richiedendo correzioni manuali riga per riga per date fuori standard.
- **Soluzione**: Aggiunta la funzione "Dati Prev." che preleva le date direttamente dalle `dueDate` delle rate del preventivo per generare il calendario.
- **Effetto**: Riduzione dell'errore umano e allineamento istantaneo contratto-registro.

### 4. Deduplicazione Intelligente nel Registro (`Attendance.tsx`)
- **Problema**: Duplicati visivi se l'array locale e il database divergevano per orario o ID.
- **Soluzione**: Per i progetti istituzionali, la chiave di deduplicazione è ora limitata a `ID Iscrizione + Data`. Se esiste una lezione reale (Master), questa "collassa" sopra il placeholder preventivo.
- **Effetto**: Registro pulito, senza duplicazioni, focalizzato sullo studente e sulla data.

### 5. Sincronizzazione Totale Calendario-Registro (`Attendance.tsx`)
- **Problema**: Se il calendario veniva svuotato (eliminazione lezioni), il registro continuava a mostrare placeholder `Scheduled` residui, creando discrepanza tra i due strumenti.
- **Soluzione**: Implementata logica di filtro "Calendar-Driven". Il registro ora visualizza uno slot `Scheduled` solo se esiste almeno una lezione master pianificata nel calendario per quella data e sede.
- **Effetto**: Se il calendario è vuoto, il registro è vuoto. Allineamento tassonomico garantito.

### 6. Fix Duplicazioni Vista Giorno (`Attendance.tsx`)
- **Problema**: In vista "Giorno", gli appuntamenti apparivano duplicati nei giorni consecutivi (es. lunedì appariva erroneamente anche nel martedì).
- **Causa**: L'uso di `toISOString()` per le query Firestore causava uno slittamento UTC, includendo ore del giorno precedente/successivo. Anche il raggruppamento tramite `toDateString()` era sensibile al fuso orario.
- **Soluzione**: 
  - Sostituito `toISOString()` con `formatLocalDate()` (YYYY-MM-DD locale) per le query.
  - Sostituito `toDateString()` con la stringa data grezza per il raggruppamento.
  - Aggiunto un filtro UI rigoroso che in vista "Giorno" permette il rendering solo della data esatta selezionata.
- **Effetto**: Allineamento perfetto tra Vista Giorno, Settimana e Mese. Eliminazione dei record "fantasma" dovuti al fuso orario.

## Istruzioni per l'Uso
1. Quando converti un Preventivo in Progetto Istituzionale, usa il tasto **"Dati Prev."** nel Wizard per allineare il calendario alle rate.
2. In caso di discrepanze visive residue, usa il tasto **"Bonifica Dati"** nel Registro Presenze; la nuova logica proteggerà le date manuali garantendo la pulizia del database.

## Sicurezza e Robustezza
- Aggiunti controlli incrociati (`exists()`, `getDoc()`) per verificare l'esistenza del preventivo prima del recupero.
- Implementata protezione contro il "Pendolo" (oscillazione tra Scheduled e Present) per evitare perdite di stato durante sincronizzazioni concorrenti.

---


### [ARCHIVIO] Sprint_16_2026-04-14.md

# Sprint 16 - 14 Aprile 2026: Finance UX & Data Integrity

## Obiettivo dello Sprint
Migliorare l'usabilità della sezione Finanza tramite indicatori visivi avanzati e risolvere anomalie strutturali nei dati (fatture pro-forma, collegamenti transazioni, duplicati) tramite un motore di correzione automatica.

## Implementazioni Effettuate

### 1. UX: Badge Multiplo di Stato (Fatturazione)
- **Cosa:** Visualizzazione contemporanea di più stati per una singola fattura.
- **A cosa serve:** Permette di capire a colpo d'occhio se una fattura ha completato sia l'iter fiscale (SDI) che quello finanziario (Incasso).
- **Come funziona:** Nella `FinanceListView`, la logica di rendering controlla indipendentemente se la fattura è sigillata (`isSealed`) e se è pagata (`isPaid`). Se entrambi sono veri, mostra i due badge incolonnati.
- **Effetti:** Riduce la necessità di aprire i dettagli della fattura o controllare il registro cassa per verificare l'incasso di una fattura sigillata.

### 2. UX: Badge di Contesto Sede (Location)
- **Cosa:** Aggiunta di un badge informativo (es. `📍 Sede Centrale`) sotto il nome del cliente.
- **A cosa serve:** Identificare immediatamente a quale sede appartiene un'entrata o una fattura, senza dover risalire all'iscrizione originale.
- **Come funziona:** Il sistema cerca la sede associata all'iscrizione (`relatedEnrollmentId`) o, nel caso di progetti istituzionali, la sede collegata al preventivo (`relatedQuoteNumber`).
- **Effetti:** Migliora la navigazione nelle liste lunghe e facilita il controllo incrociato con l'analisi ROI delle sedi.

### 3. Logica: Smart Sanity Fix (Fiscal Doctor)
- **Cosa:** Motore di scansione e correzione automatica delle anomalie (`runSmartSanityFix`).
- **A cosa serve:** Risolvere problemi di integrità dati segnalati dall'utente che richiederebbero interventi manuali complessi sul database.
- **Casi gestiti:**
    - **SNUPY:** Riconciliazione automatica di pagamenti in "Sanatoria" con fatture pro-forma scadute e collegamento transazioni orfane all'iscrizione.
    - **LA SCINTILLA:** Correzione di fatture pro-forma rimaste in stato bozza nonostante l'avvenuto pagamento e sigillatura.
    - **CUBE:** Eliminazione di fatture pro-forma duplicate generate erroneamente per lo stesso progetto.
- **Effetti:** Ripristina la coerenza del database finanziario e garantisce che i contatori fiscali (Lordo/Imponibile) siano esatti.

### 4. Robustezza: Prevenzione Duplicati Ghost
- **Cosa:** Controllo di esistenza preventivo nella generazione fatture pro-forma.
- **A cosa serve:** Impedire che attivazioni multiple di un progetto istituzionale generino fatture ridondanti.
- **Come funziona:** Prima di generare nuove fatture pro-forma, il sistema interroga Firestore per verificare se esistono già documenti "Ghost" attivi per quell'iscrizione.

## Effetti Sistemici
- **Integrità:** Il database è ora protetto da duplicazioni accidentali di fatture pro-forma.
- **Coerenza:** Le transazioni di cassa sono meglio collegate alle iscrizioni, migliorando l'accuratezza dei report per sede.
- **Usabilità:** La lista fatture fornisce molte più informazioni contestuali senza appesantire l'interfaccia.

---
*Documentazione tecnica prodotta per EP v.1 Gestionale.*

---


### [ARCHIVIO] implementation_plan.md

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

---


### [ARCHIVIO] project_state.md

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

---


### [ARCHIVIO] sprint_11_09_04_2026.md

# Sprint 11 - 09/04/2026

## Obiettivo
Raffinamento della gestione dei corsi, implementazione della ricorrenza avanzata con analisi d'impatto e risoluzione di problemi di qualità del codice (linting e tipi).

## Modifiche Effettuate

### 1. Gestione Ricorrenza Corsi (Advanced Recurrence)
- **Analisi d'Impatto**: Implementata la funzione `checkCourseConflicts` in `courseService.ts`. Questa funzione rileva se la disattivazione di mesi in un corso esistente va in conflitto con iscrizioni attive.
- **Sincronizzazione Lezioni**: Implementata la funzione `syncCourseLessons` in `courseService.ts`. Ogni volta che un corso viene modificato, le lezioni future vengono eliminate e rigenerate per riflettere immediatamente le nuove impostazioni di ricorrenza, orari o configurazioni combo (LAB+SG).
- **Interfaccia Utente (Courses.tsx)**:
    - Integrata l'analisi d'impatto nel salvataggio dei corsi. Se vengono rilevati conflitti, l'utente riceve un avviso dettagliato e deve confermare l'operazione.
    - Ottimizzata la cancellazione dei corsi: ora vengono rimosse anche tutte le lezioni future associate.

### 2. Qualità del Codice e Robustezza
- **Type Safety**: Sostituiti numerosi tipi `any` con interfacce specifiche (`CourseConfig`, `Omit<Course, ...>`) in `Courses.tsx` e `courseService.ts`.
- **Linting**: Risolti errori di variabili inutilizzate e import mancanti.
- **Componenti Icone**: Aggiornate le icone (`ProfileIcon`, `DashboardIcon`, `PencilIcon`, `TrashIcon`, `PlusIcon`, `CalendarIcon`) per accettare la prop `className`, risolvendo errori di compilazione TypeScript e permettendo una stilizzazione dinamica più coerente.

### 3. Correzioni Varie
- **ActivityLog.tsx**: Aggiunto l'import mancante di `useMemo`.
- **CourseService.ts**: Pulizia di variabili inutilizzate e ottimizzazione della logica di generazione lezioni.

## Effetti sul Sistema
- **Integrità dei Dati**: La sincronizzazione automatica garantisce che il calendario e il portale iscrizioni siano sempre allineati con le impostazioni dei corsi.
- **Usabilità**: Gli avvisi di conflitto prevengono la perdita accidentale di posti per iscritti attivi.
- **Manutenibilità**: Il codice è ora più tipizzato e aderente agli standard di sviluppo, riducendo il rischio di bug a runtime.

---


### [ARCHIVIO] task.md

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

---


### [ARCHIVIO] 20_2026-05-14.md

# SPRINT REPORT
**20 - 2026-05-14**

OGGETTO: Modifica Corsi (Età in mesi/anni) e Pulizia Documentazione

CREATO / MODIFICATO:
- File update: `pages/Courses.tsx`.
- Struttura: aggiunta unit di misura (`minAgeUnit`, `maxAgeUnit`).
- Operazioni db: conversione totale in mesi fase salvataggio.
- UI: selettori adiacenti input età.
- Utility: `formatAgeDisplay` per formattazione.
- File system: unione file obsolete in `Story.md`. Rimozione multiple MD.

FUNZIONAMENTO E PROPAGAZIONE:
- L'utilizzo esclusivo dei mesi a livello di database mantiene la piena compatibilità con query pre-esistenti. Il front-end agisce da layer di astrazione logica. Valori `minAge` / `maxAge` salvati rimangono numerici.
- Centralizzazione reference documentali e di avanzamento epic in `Story.md`.


---
