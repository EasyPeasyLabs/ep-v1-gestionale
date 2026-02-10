
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

---

## 5. Roadmap Evolutiva
- [ ] **Paginazione Server-Side:** Ottimizzazione performance per gestire >10.000 record (caricamento incrementale "Load More" / Pagine).
- [ ] **Modulo Sondaggi WhatsApp:** Template automatici per invio survey di soddisfazione a gruppi filtrati per Sede.
- [ ] **Integrazione Bridge:** Connessione protetta tra Project A e Project B per importazione lead.
- [ ] **AI Forecasting:** Predizione del Churn Rate (abbandono) basata sull'analisi dei rating storici.
- [ ] **Reporting Avanzato:** Dashboard per commercialista con export massivo pre-validato dal Fiscal Doctor.

*Documentazione aggiornata al 25 Febbraio 2026.*
