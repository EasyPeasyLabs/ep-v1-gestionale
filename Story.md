
# Story of EP v.1: Enterprise Management Ecosystem

## 1. Visione di Progetto
**EP v.1** è una piattaforma gestionale di livello enterprise progettata per una scuola di lingue per l'infanzia ("EasyPeasy Lab"). Il sistema non funge da semplice database, ma da "motore di profittabilità", automatizzando i flussi fiscali, logistici e didattici per minimizzare l'errore umano e massimizzare il ROI (Return on Investment) delle sedi operative.

### Identità del Brand
- **Denominazione:** EP v.1 (EasyPeasy)
- **Repository:** `ep-v1-gestionale` (EasyPeasyLabs)
- **Design System:** Inter font, Palette Indigo/Amber (#3C3C52 / #FFBF00), Design pulito e responsivo.

---

## 2. Architettura Tecnica

### Stack Tecnologico
- **Frontend:** React 19 + TypeScript + Vite (SPA).
- **Styling (Hybrid-Freeze Engine):**
    - **Livello 1 (Componenti Core):** CSS Vanilla puro (`index.css`) per garantire il rendering strutturale immediato (Layout, Card, Bottoni, Input) indipendente dalla compilazione.
    - **Livello 2 (Utility):** TailwindCSS via CDN Runtime per la gestione atomica delle spaziature e dei colori, bypassando la catena di build PostCSS per massima compatibilità Vercel.
- **Backend (BaaS):** Firebase (Google Cloud).
    - **Firestore:** Database NoSQL con cache persistente (Offline-first).
    - **Auth:** Gestione accessi amministrativi.
    - **Storage:** Asset multimediali per attività e campagne.
    - **Cloud Functions:** Task automatici (Cron) per notifiche push.
    - **Messaging (FCM):** Sistema di notifiche Web Push per PWA.
- **Reporting:** Esportazione Excel (`xlsx`) e generazione PDF client-side (`jsPDF`).

### Modello Dati Integrato
L'ecosistema è diviso in due progetti Firebase distinti per sicurezza (Isolation Pattern):
1. **Project A (Gestionale):** Core operativo con permessi Read/Write per Admin.
2. **Project B (EP Public):** Landing page per iscrizioni online con permessi **Write-Only** (Buffer Database). I lead vengono poi importati nel Project A.

---

## 3. Caratteristiche Funzionali Core

### A. Gestione Operativa (Recinti & Cartellini)
- **Recinti (Locations):** Sedi fisiche con slot orari definiti. Ogni recinto ha parametri di capienza e costo nolo.
- **Cartellini (Iscrizioni):** Rapporto contrattuale tra Allievo/Genitore e Pacchetto (K-Kid o A-Adult).
- **Move Mode:** Interfaccia touch-friendly per spostare allievi tra sedi e orari con ricalcolo automatico delle lezioni future.

### B. Finanza & Fiscal Doctor
- **Scenario Start-up:** Calcolo accantonamenti tasse basato sulla logica 150% (Saldo + Acconto) tipica delle nuove attività.
- **Fiscal Doctor:** Algoritmo di scansione integrità che rileva discrepanze tra iscrizioni, fatture emesse e incassi reali (Smart Identity Matching).
- **Fiscal Smart Counters:** Monitoraggio in tempo reale del Lordo, dell'Imponibile (78%) e del debito Bolli virtuali direttamente nel database fatture.
- **Sigillo SDI:** Protezione dei documenti fiscali già trasmessi al sistema di interscambio.
- **TCO Logistica:** Calcolo dinamico del costo per chilometro, usura veicolo e carburante ripartito sulle sedi.

### C. Didattica & Registro
- **Registro Elettronico:** Log attività svolte in aula e collegamento alla libreria multimediale.
- **Homeworks:** Sistema di assegnazione compiti con invio massivo via WhatsApp.
- **Peek-a-Boo(k):** Sistema bibliotecario per inventario, prestiti e restituzioni per sede/allievo.

### D. CRM & Automazione
- **Alert Rinnovi:** Notifiche automatiche 30 giorni prima della scadenza del cartellino.
- **Progetti Istituzionali:** Trasformazione dei preventivi Enti in iscrizioni operative con monitoraggio rateale e billing alert automatico.
- **WhatsApp Blaster:** Invio massivo di comunicazioni personalizzate tramite placeholder (es. `{{cliente}}`, `{{bambino}}`).
- **Rating 4 Assi:** Valutazione qualitativa costante di allievi (Apprendimento/Condotta) e fornitori (Partnership/Negoziazione).
- **Routine Manager:** Sistema di pianificazione avvisi personalizzati (es. manutenzioni) con supporto per la settimana lavorativa italiana (Lun-Dom).

---

## 4. Storico Sessioni e Milestone

### Milestone Gennaio 2026
- **02/01:** Creazione "Archivio Iscrizioni" con vista Timeline e Calendario Copertura annuale.
- **18/01 (Mattina):** Implementazione "Fiscal Doctor Wizard" con supporto Fuzzy Match per riconciliazione clusterizzata di fatture e movimenti di cassa.
- **18/01 (Pomeriggio):** Refactoring del Manuale Operativo con navigazione a matrice 3-righe ottimizzata per Mobile e integrazione simulatore interattivo.
- **18/01 (Sera):** Lancio Modulo "Progetti Istituzionali": attivazione iscrizioni da preventivi Enti, link referenziale lezioni "Extra" e automazione billing rateale.
- **18/01 (Notte):** Consolidamento fiscale avanzato. Introduzione dei contatori dinamici per Lordo, Imponibile (Coefficiente 78%) e Bolli Virtuali.
- **19/01 (Mattina):** Refactoring Presenze & Absence Logic Engine. Interfaccia Card-based responsive e Wizard Assenze con recupero automatico.
- **19/01 (Pomeriggio):** **Advanced Reporting & Deployment Fix.**
    - Risoluzione criticità TypeScript per build stabili su Vercel.
    - Implementazione logica "Recinto History" nel report Excel: tracciamento cronologico degli spostamenti sede dell'allievo (es. "Sede A -> Sede B").
    - Arricchimento report con incrocio dati tra presenze reali, abbuoni fiscali e riferimenti pagamenti.
- **20/01 (Mattina):** **Upgrade CRM & Comunicazione.**
    - Aggiunta filtro per Sede/Recinto nel modulo Nuova Comunicazione.
    - Integrazione Cloud Storage per invio allegati (file e link) nelle comunicazioni massive.

### Milestone Febbraio 2026
- **18/02 (Mattina):** **Notification Engine Upgrade & Localization.**
    - Implementazione regole di notifica personalizzate (Custom Rules) per task ricorrenti non legati agli allievi.
    - **UX Localization:** Adattamento dell'interfaccia "Pianificazione Avvisi" alla settimana italiana (Lunedì-Domenica) tramite mapping visivo, mantenendo la compatibilità tecnica internazionale (0=Dom) per il backend Cloud Functions.
- **18/02 (Pomeriggio):** **Client 360° View.**
    - Rilascio del modulo "Situazione Clienti": dashboard unificata per l'analisi finanziaria e anagrafica del singolo cliente.
    - **Financial Aggregation Logic:** Algoritmo di aggregazione che incrocia dati da 4 collezioni (Clients, Enrollments, Invoices, Transactions) per mostrare lo stato dei pagamenti e rilevare elementi orfani in tempo reale.
- **18/02 (Sera):** **UX Refinements (Registro Presenze).**
    - **Grouped Time Slots:** Nuova visualizzazione gerarchica nel registro presenze (Sede -> Giorno -> Slot Orario) per migliorare la leggibilità e l'operatività.
    - **Bulk Actions:** Introduzione di azioni massive per slot orario ("Tutti Presenti" / "Tutti Assenti") e refactoring del Wizard Assenze per supportare input multipli.
    - **Box Liberation Strategy:** Risoluzione conflitti di clipping CSS sui menu a discesa delle card presenze, rimuovendo `overflow-hidden` dai contenitori e gestendo manualmente il `border-radius` per mantenere il design pulito.
- **25/02 (Mattina):** **Cristallizzazione Architettura Ibrida (Deploy Stability).**
    - **Problema:** I conflitti ricorrenti tra la pipeline di build standard di Vercel e le direttive `@apply` di Tailwind causavano "pagine bianche" e stili mancanti in produzione.
    - **Soluzione:** Adozione definitiva dell'architettura **Hybrid-Freeze**.
        1.  **Tailwind Runtime:** Il motore grafico è stato spostato nel browser via CDN (`cdn.tailwindcss.com`). Questo garantisce che le utility classes siano sempre generate correttamente indipendentemente dall'ambiente di build server-side.
        2.  **CSS Vanilla Core:** I componenti critici (`.md-card`, `.md-btn`, input forms) sono stati riscritti in CSS standard puro in `index.css`. Questo assicura che l'interfaccia Enterprise sia visibile e funzionale anche prima che il motore JS si carichi completamente (No FOUC).
        3.  **Build Pipeline:** Rimozione delle dipendenze PostCSS dalla build di Vite. Vercel ora compila solo il JS/TS, trattando gli stili come asset statici immutabili.
    - **Risultato:** Una configurazione di deploy "intoccabile" e robusta, immune agli aggiornamenti delle dipendenze di build.

### Milestone Marzo 2026
- **06/03:** **Integrazione Bridge (Project A <-> Project B).**
    - **CORS & Security:** Risoluzione del blocco CORS sulla Cloud Function `receiveLead` (Project A) abilitando il preflight (`OPTIONS`) e l'header `Authorization`. Configurazione di Cloud Run per consentire invocazioni non autenticate, delegando la sicurezza al controllo del Bearer Token nel codice.
    - **Degrado Grazioso (Project B):** Implementazione di un sistema di salvataggio locale prioritario nel frontend pubblico. Se l'API del Gestionale fallisce, il lead viene salvato in locale con stato `pending_sync`, garantendo zero perdita di dati e un'esperienza utente fluida.
- **07/03 (Mattina):** **Adattamento Payload e Data-Driven Bundles.**
    - **Payload Translation:** Modifica chirurgica della funzione `receiveLead` per tradurre il payload strutturato in arrivo dal Progetto B (es. `locationName`, oggetto `selectedSlot`) nel formato "legacy" atteso dalla pagina `LeadsPage.tsx` del Gestionale (es. `selectedLocation`, stringa `selectedSlot`, e campo `createdAt` per l'ordinamento). Questo garantisce la retrocompatibilità senza toccare il frontend del Gestionale.
    - **Strategia "Bundle" (Pacchetti Commerciali):** Definizione dell'architettura per mostrare slot raggruppati (es. "LAB + SG") nella Pagina Pubblica. Invece di stravolgere il database del Gestionale creando una nuova entità, si è optato per un approccio *Data-Driven* che sfrutta la collezione esistente `subscriptions` (Abbonamenti).
- **09/03 (Mattina):** **Upgrade Portale Iscrizioni & Real-time BI.**
    - **Fiscal Logic (Bollo Virtuale):** Implementazione della maggiorazione automatica di 2€ per il bollo virtuale su tutti gli abbonamenti con prezzo base ≥ 77€. La modifica è visibile sia nel Riepilogo che nella modale di conferma finale del Portale Iscrizioni (Progetto C).
    - **Slot Formatting Engine:** Introduzione di un motore di parsing per gli orari combinati (es. "LAB + SG"). Il sistema ora scompone le stringhe complesse contenenti il separatore `&` e le visualizza in righe separate e leggibili, indicando chiaramente il numero di ingressi e la tipologia di lezione.
    - **Push Notification Engine (FCM):** Attivazione di trigger Cloud Functions per notifiche push istantanee su dispositivi mobili per 4 eventi critici:
        1. **Nuovi Lead:** Notifica dettagliata per ogni contatto dalla Pagina Pubblica.
        2. **Nuove Iscrizioni:** Avviso immediato per iscrizioni da Portale (distinguendo tra Pagate e Da Saldare).
        3. **Payment Reminder:** Promemoria automatico per la registrazione dell'incasso in caso di scelta "Paga in Sede".
        4. **Fiscal Assistant:** Notifica intelligente per l'emissione fattura, con alert specifico per la soglia dei 77€ per prevenire l'omissione del bollo virtuale.
        5. **Public Gateway Isolation (Security Shield):** Implementazione di una Cloud Function `enrollmentGateway` che funge da proxy sicuro. Il link inviato su WhatsApp punta ora al Progetto B (Pagina Pubblica), nascondendo l'URL tecnico del Gestionale e abilitando l'anteprima con Logo e ID unico tramite Meta Tag Open Graph dinamici. In una frazione di secondo, il gateway reindirizza l'utente al modulo di iscrizione reale in modo invisibile.
- **12/03:** **Centralizzazione Calcolo Disponibilità (Single Source of Truth).**
    - **Refactoring Architetturale:** Spostamento della logica di calcolo dei posti disponibili dalla Pagina Pubblica (Progetto B) al Gestionale (Progetto A). Il Progetto B diventa un "Dumb Client" che si limita a visualizzare i dati forniti dall'API.
    - **Smart API (getPublicSlotsV2):** La Cloud Function ora agisce come un vero motore di booking. Calcola l'occupazione reale analizzando gli allievi attivi (con `lessonsRemaining > 0` e stato valido) e incrociando i loro appuntamenti futuri o della settimana in corso.
    - **Risoluzione Overbooking/Blocchi:** Eliminati i falsi positivi e negativi causati dal conteggio basato sui "Lead" (raw_registrations). Il sistema ora sottrae dalla capienza della sede solo i posti fisicamente occupati dagli allievi iscritti nel Gestionale, garantendo dati esatti in tempo reale.
    - **Push Notification Fallback Logic:** Ottimizzazione della Cloud Function `onLeadCreated` per la ricezione dei lead. Implementato un sistema di risoluzione a cascata (ID Sede -> Nome Sede da Payload -> Fallback Generico) per garantire che le notifiche push mostrino sempre informazioni coerenti, eliminando il problema del testo "Sede non specificata".
- **14/03 (Sera):** **Security & Architecture Hardening (Fix Critici).**
    - **Risoluzione Bug Blocher (Project C):** Correzione del `ReferenceError: BanknotesIcon` nel Portale Iscrizioni causato da un'importazione mancante e rimozione di un errore di sintassi (doppio blocco `catch`) che impediva il caricamento corretto della pagina in alcuni browser.
    - **Shield XSS (Gateway):** Implementazione della sanificazione obbligatoria dell'ID sessione nella Cloud Function `enrollmentGateway`. Questo previene attacchi di Script Injection tramite URL manipolati che venivano iniettati direttamente nel DOM della SPA.
    - **Server-Side Price Validation:** Introduzione di un controllo di integrità nel backend (`processEnrollment`). Il sistema non si fida più del prezzo inviato dal frontend, ma ricalcola l'importo (inclusi i 2€ di bollo virtuale) interrogando direttamente la collezione `subscriptionTypes` su Firestore, eliminando vulnerabilità di manomissione dei prezzi lato client.
    - **Standardizzazione API Bridge:** Allineamento delle funzioni `receiveLeadV2` e `getPublicSlotsV2` agli standard di sicurezza enterprise. Aggiunto supporto per l'header `Authorization: Bearer` (oltre alla `x-bridge-key`) e gestione manuale dei preflight `OPTIONS` per garantire la compatibilità CORS con Project B indipendentemente dal browser.
    - **Data Integrity (Enrollment Portal):** Rafforzamento della logica di matching delle sedi e degli slot nel Portale Iscrizioni per gestire payload destrutturati (Oggetti) in arrivo dalla nuova Pagina Pubblica, garantendo la retrocompatibilità con i lead storici.
- **14/03 (Notte):** **Evoluzione Bridge ID & "Infallible Matching".**
    - **Preservazione "ID Infallibile":** Refactoring radicale della funzione `receiveLeadV2`. Il sistema non trasforma più le scelte del Progetto B in testo semplice, ma clona l'intero oggetto `selectedSlot` (contenente il `bundleId` originale) nel database del Gestionale. Questo garantisce che il Progetto C legga una copia identica all'originale di Firebase Progetto B.
    - **Atomic Matching Engine:** Il Portale Iscrizioni (Progetto C) ora dà priorità assoluta al `bundleId` tecnico per identificare l'abbonamento. Se l'ID è presente, il sistema aggancia istantaneamente prezzo e descrizione certificata, eliminando i "vuoti" causati dai fallimenti delle ricerche testuali.
    - **Fallback UI Intelligente:** In caso di abbonamenti non più attivi o ID corrotti, il Portale non "collassa" più (mostrando pagine vuote), ma forza la visualizzazione della lista abbonamenti filtrata per età e sede, permettendo al lead di completare comunque l'iscrizione con una scelta alternativa valida.

### Milestone 16 Marzo 2026
- **16/03 (Mattina):** **Full-Stack Ecosystem Hardening & Calendar Sync.**
    - **Security Shield (Data Privacy):** Implementazione di un filtro rigoroso nella funzione `getEnrollmentData`. Il sistema ora espone al Portale Iscrizioni solo i campi pubblici dei fornitori (`name`, `address`, `availability`), oscurando dati sensibili come margini, note private o contatti non destinati all'utente finale.
    - **Calendar Integration (Missing Lesson Fix):** Risoluzione di una criticità architettonica nel flusso di iscrizione. Precedentemente, il Portale creava l'iscrizione ma non generava le lezioni nel calendario, rendendo l'allievo "invisibile" nel registro presenze.
    - **Physical Lesson Engine:** La Cloud Function `processEnrollment` è stata potenziata con un motore di generazione massiva. Al momento dell'iscrizione, il sistema ora crea fisicamente tutti i documenti nella collezione `lessons` per l'intera durata dell'abbonamento, ricalcolando le date settimanali e saltando automaticamente i giorni festivi italiani.
    - **Server-Side Price Integrity:** Rafforzamento della validazione dei prezzi. Il backend ora ignora i dati finanziari inviati dal client e ricalcola autonomamente l'importo totale (incluso il bollo virtuale ≥ 77€) interrogando i tipi di abbonamento certificati nel database, prevenendo manomissioni fraudolente del prezzo durante l'iscrizione.
    - **Timezone Awareness:** Allineamento del calcolo delle date del calendario al fuso orario italiano (CET/CEST) nelle Cloud Functions, eliminando il rischio di slittamento dei giorni dovuto all'esecuzione dei server in formato UTC.

- **16/03 (Pomeriggio):** **AI Financial Intelligence & Deep Integrity.**
    - **Fiscal Doctor Evolution (AI Agent):** Trasformazione dello strumento di controllo finanziario da passivo a proattivo. Il sistema ora agisce come un'intelligenza artificiale che, rilevando un'incongruenza, scansiona automaticamente le transazioni "orfane" e suggerisce istantaneamente un **"Smart Link"** se trova corrispondenze di importo e data, riducendo l'intervento manuale della segreteria.
    - **Deep Delete Strategy:** Implementazione della cancellazione atomica delle iscrizioni. La funzione `deleteEnrollment` è stata potenziata per eseguire una pulizia profonda: eliminando un'iscrizione, il sistema ora rimuove istantaneamente tutte le lezioni fisiche associate nella collezione `lessons`, prevenendo la proliferazione di "lezioni fantasma" e garantendo che i posti nelle sedi vengano liberati in tempo reale nel calendario.
    - **End-to-End Simulation (Fantozzi Test):** Verifica completa dell'ecosistema tramite simulazione con dati mock. Testata con successo la resilienza del sistema ai tentativi di manomissione dei prezzi e la corretta propagazione dei dati tra i tre progetti (Public -> Gateway -> Portal -> Gestionale).

- **16/03 (Notte):** **Deployment Stability & Ecosystem Reintegration.**
    - **Vercel Build Recovery:** Risoluzione critica di un blocco totale della pipeline di build causato da errori di tipizzazione TypeScript e dipendenze mancanti in moduli orfani.
    - **Module Relocation & Refactoring:** Reintegro completo dei moduli `LeadsPage` e `EnrollmentPortal` nel percorso di build principale. I file sono stati spostati nella cartella `pages/` standard e linkati correttamente in `App.tsx`, garantendo la coerenza strutturale del progetto.
    - **Zero-Dependency Date Engine:** Eliminazione della dipendenza esterna instabile `date-fns`. Il sistema ora utilizza helper nativi JavaScript ultra-leggeri per la gestione delle date e della formattazione locale (italiano), rimuovendo il rischio di errori "module not found" in fase di compilazione server-side.
    - **Icon Wrapper Strategy:** Implementazione di componenti wrapper per le icone locali. Questa soluzione ha permesso di utilizzare gli asset grafici esistenti come sostituti diretti delle icone Lucide, mantenendo intatto il design system Tailwind e risolvendo gli errori di prop-types (`className`).
    - **Final Build Success:** Validazione finale tramite compilazione `tsc` pulita, che garantisce il deploy automatico e stabile su Vercel per tutti i rami dell'ecosistema.
    - **Fiscal Doctor UI (Oblio & Smart Match):** Il Fiscal Doctor ora mostra suggerimenti AI direttamente nell'interfaccia (⭐ MATCH ECCELLENTE, 👤 Corrispondenza Cognome) e permette di applicare l'Oblio per esercizi chiusi con un click.

---

## 5. Roadmap Evolutiva
- [ ] **Paginazione Server-Side:** Ottimizzazione performance per gestire >10.000 record (caricamento incrementale "Load More" / Pagine).
- [ ] **Modulo Sondaggi WhatsApp:** Template automatici per invio survey di soddisfazione a gruppi filtrati per Sede.
- [x] **Integrazione Bridge:** Connessione protetta tra Project A e Project B per importazione lead.
- [x] **Generazione Automatica Lezioni:** Sincronizzazione automatica tra Portale e Calendario Gestionale.
- [x] **Fiscal AI Agent:** Motore di suggerimento automatico per la riconciliazione finanziaria (Smart Match).
- [x] **AI Book Cataloging:** Sistema intelligente di numerazione e classificazione automatica biblioteca.
- [x] **Build Stability:** Risoluzione conflitti TypeScript e consolidamento architettura per deploy Vercel.
- [ ] **AI Forecasting:** Predizione del Churn Rate (abbandono) basata sull'analisi dei rating storici.
- [ ] **Reporting Avanzato:** Dashboard per commercialista con export massivo pre-validato dal Fiscal Doctor.

*Documentazione aggiornata al 16 Marzo 2026 (Notte).*

---

# Prosegui da qui: Evoluzione Fiscal Doctor (Oblio & AI Matching)

## 1. Ultima Richiesta Utente
> **Obiettivo:** Rendere il Fiscal Doctor meno rigido e più "umano".
> **A. Matching Multicriterio (AI):** Identificare transazioni potenziali basandosi su:
>   - *Temporale:* Date prossime (+/- 60gg).
>   - *Economico:* Importi simili (+/- 15€).
>   - *Causale:* Corrispondenza cognome allievo/genitore.
> **B. Diritto all'Oblio:** Per anomalie risalenti a esercizi fiscali **CHIUSI**:
>   - Proporre l'azione "Ignora/Oblio".
>   - Non richiedere riconciliazione forzata.
>   - Salvare una nota permanente nell'Esercizio Fiscale chiuso e smettere di segnalare l'anomalia.

## 2. Stato Avanzamento Lavori (Backend & Tipi)
**✅ Completato:**
1.  **`types.ts`**: Aggiornate interfacce `FiscalYear` (campi `ignoredIssues`, `oblivionNotes`) e `IntegrityIssueSuggestion` (tipo `oblivion`, `reason`, payload `fiscalYearId`).
2.  **`services/financeService.ts` - `runFinancialHealthCheck`**:
    *   Implementato recupero `fiscal_years`.
    *   Aggiunto filtro iniziale: se l'issue è in `ignoredIssues`, viene saltata.
    *   Implementato **AI Smart Matching** (Controllo importo fuzzy, controllo data, controllo cognome nella descrizione).
    *   Implementata logica **Oblio**: se l'anno è `CLOSED`, aggiunge un suggerimento speciale di tipo `oblivion`.
3.  **`services/financeService.ts` - `fixIntegrityIssue`**:
    *   Implementata la strategia `oblivion`: aggiorna il documento `fiscal_years` aggiungendo l'ID anomalia e la nota di audit.

## 3. Da Fare (Domani)
Ci siamo fermati durante l'analisi del componente UI `FixWizard` in `pages/Finance.tsx`.

**Prossimi Passi:**
1.  **Aggiornamento UI (`pages/Finance.tsx`):**
    *   Modificare `FixWizard` per gestire il rendering dei suggerimenti di tipo `oblivion`.
    *   Mostrare un blocco distinto (es. "Esercizio Chiuso: Azione Consigliata") se è presente un suggerimento di oblio.
    *   Collegare il click sul suggerimento alla funzione `onFix(..., 'oblivion')`.
    *   Gestire visualmente i nuovi suggerimenti "Smart Match" (che ora hanno label più descrittive come "⭐ MATCH ECCELLENTE" o "👤 Corrispondenza Cognome").
2.  **Verifica Compilazione:**
    *   Eseguire `npx tsc --noEmit` per assicurarsi che le modifiche ai tipi in `Finance.tsx` siano corrette.
3.  **Chiusura:**
    *   Aggiornare `Story.md`.
    *   Eseguire Git Push.

## 4. Note Tecniche
*   Il file `pages/Finance.tsx` è stato letto fino alla riga 350 circa. La definizione di `FixWizard` inizia alla riga 217. Bisogna riprendere la modifica da lì.

---

## 5. Interventi Eseguiti (Claude Haiku 4.5 - 17.03.2026 10:15)
- Esteso `FixWizard` per gestire suggerimenti di tipo `oblivion` e `smart_link`.
- Aggiunta UI per mostrare il badge “Esercizio fiscale chiuso” e la possibilità di applicare l’oblio direttamente dalla vista anomalia.
- Aggiornata la lista laterale per evidenziare (badge + sfondo) le anomalie che hanno suggerimenti `oblivion`, rendendole immediatamente riconoscibili.
- Aggiunto un badge testuale `(Oblio)` accanto al tipo di anomalia (es. “Manca Fattura (Oblio)”).
- Verificata compilazione TypeScript con `npx tsc --noEmit` (esito: OK).

---

