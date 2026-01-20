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
- **Styling:** TailwindCSS con variabili CSS dinamiche per tematizzazione real-time.
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
- **Scenario Start-up:** Calcolo accantonamenti tasse basato sulla logica 150% (Saldo + Acconto) per nuove attività.
- **Fiscal Doctor:** Algoritmo di scansione integrità che rileva discrepanze tra iscrizioni, fatture emesse e incassi reali (Smart Identity Matching).
- **Sigillo SDI:** Protezione dei documenti fiscali già trasmessi al sistema di interscambio.
- **TCO Logistica:** Calcolo dinamico del costo per chilometro, usura veicolo e carburante ripartito sulle sedi.

### C. Didattica & Registro
- **Registro Elettronico:** Log attività svolte in aula e collegamento alla libreria multimediale.
- **Homeworks:** Sistema di assegnazione compiti con invio massivo via WhatsApp.
- **Peek-a-Boo(k):** Sistema bibliotecario per inventario, prestiti e restituzioni per sede/allievo.

### D. CRM & Automazione
- **Alert Rinnovi:** Notifiche automatiche 30 giorni prima della scadenza del cartellino.
- **WhatsApp Blaster:** Invio massivo di comunicazioni personalizzate tramite placeholder (es. `{{cliente}}`, `{{bambino}}`).
- **Rating 4 Assi:** Valutazione qualitativa costante di allievi (Apprendimento/Condotta) e fornitori (Partnership/Negoziazione).

---

## 4. Storico Sessioni e Milestone

### Milestone Gennaio 2026
- **02/01:** Creazione "Archivio Iscrizioni" con vista Timeline e Calendario Copertura annuale.
- **18/01 (Mattina):** Implementazione "Fiscal Doctor Wizard" con supporto Fuzzy Match per riconciliazione clusterizzata di fatture e movimenti di cassa.
- **18/01 (Pomeriggio):** Refactoring del Manuale Operativo con navigazione a matrice 3-righe ottimizzata per Mobile e integrazione simulatore interattivo.
- **18/01 (Sera):** Consolidamento documentale in `Story.md` e pulizia codebase.

---

## 5. Roadmap Evolutiva
- [ ] **Integrazione Bridge:** Connessione protetta tra Project A e Project B per importazione lead.
- [ ] **AI Forecasting:** Predizione del Churn Rate (abbandono) basata sull'analisi dei rating storici.
- [ ] **Reporting Avanzato:** Dashboard per commercialista con export massivo pre-validato dal Fiscal Doctor.

*Documentazione aggiornata al 18 Gennaio 2026.*