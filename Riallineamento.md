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
