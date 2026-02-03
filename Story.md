
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

---

## 5. Roadmap Evolutiva
- [ ] **Paginazione Server-Side:** Ottimizzazione performance per gestire >10.000 record (caricamento incrementale "Load More" / Pagine).
- [ ] **Modulo Sondaggi WhatsApp:** Template automatici per invio survey di soddisfazione a gruppi filtrati per Sede.
- [ ] **Integrazione Bridge:** Connessione protetta tra Project A e Project B per importazione lead.
- [ ] **AI Forecasting:** Predizione del Churn Rate (abbandono) basata sull'analisi dei rating storici.
- [ ] **Reporting Avanzato:** Dashboard per commercialista con export massivo pre-validato dal Fiscal Doctor.
- [ ] **Situazione Clienti:** Concetto e Scopo
    La pagina "Situazione Clienti" funge da scheda cliente completa e interattiva, aggregando in un'unica vista tutte le informazioni operative, anagrafiche, didattiche e finanziarie relative a un cliente (Genitore o Ente). È pensata per essere lo strumento principale di consultazione rapida durante una conversazione telefonica o un check-up amministrativo.
    Struttura della Pagina
        1. Posizionamento e Navigazione
            Menu: Aggiunta di una nuova voce "Situazione Clienti" nella Sidebar, posizionata immediatamente sotto "Clienti".
            Icona: Utilizzeremo un'icona distintiva (es. IdentificationIcon o UserGroupIcon variante) per differenziarla dall'anagrafica pura.
        2. Header (Filtri e Ricerca)
            Contenitore: Una md-card fissa in alto o ben distinta visivamente.
            Campo di Ricerca Globale: Un input text intelligente che filtra in tempo reale per:
                Nome/Cognome Genitore
                Nome/Cognome Figlio
                Ragione Sociale (se Ente)
                Sede (nome location)
                Selettore Sede: Dropdown per filtrare i clienti che hanno almeno un legame storico o attivo con una specifica sede.
            Ordinamento: Dropdown o toggle per ordinare i risultati (A-Z / Z-A).
            Comportamento: La selezione di un cliente dalla lista risultante (o tramite autocompletamento avanzato) popolerà il corpo e il footer della pagina. Fino alla selezione, la parte inferiore mostrerà un placeholder o la lista risultati.
        3. Corpo (Dettaglio Cliente Selezionato)
            Questa sezione è visibile solo dopo aver selezionato un cliente specifico. È divisa in 3 colonne (grid layout):
                Colonna Sinistra (Anagrafica):
                    Card con dati completi: Nome, Cognome, CF/P.IVA, Indirizzo completo, Contatti (Email, Telefono con link rapidi).
                    Rating a 4 assi (stelle) visibile.
                Colonna Centrale (Figli/Riferimenti):
                    Lista card o bullet point dei figli associati.
                    Per ogni figlio: Nome, Età attuale, Note rapide o Tag.
                Colonna Destra (Stato Attuale):
                    "Ultima Posizione Nota": Mostra l'ultima sede frequentata (o quella attuale attiva).
                    Status corrente (Attivo/Inattivo).
                    Badge colorato della sede per riconoscimento visivo immediato.
        4. Footer (Storico Operativo e Finanziario)
            Diviso in due pannelli affiancati (split view 50/50 o adattiva):
                Sinistra: Storico Iscrizioni (Timeline Didattica)
                    Tabella/Griglia cronologica decrescente.
                    Colonne: Periodo (Dal-Al), Pacchetto (es. Trimestrale), Figlio (chi ha frequentato), Stato (Completato/Attivo).
                    Layout compatto: ogni iscrizione occupa una sola riga per massimizzare la densità di informazioni.
                Destra: Storico Pagamenti (Specchio Finanziario)
                    Tabella/Griglia allineata visivamente (se possibile) o logicamente alle iscrizioni.
                    Mostra solo i pagamenti relativi a quell'iscrizione o pagamenti "sciolti".
                    Colonne: Data Pagamento, Importo, Metodo, Riferimento (Fattura N. o Cassa), Stato (Saldato/Acconto).
                    Totali: Un piccolo riepilogo in fondo con Totale Dovuto vs Totale Pagato per l'intero ciclo di vita del cliente.
                Interazioni
                Cliccando su una riga dello storico pagamenti si potrebbe aprire il dettaglio della transazione/fattura (link a Finanza).
                Cliccando sull'iscrizione si potrebbe aprire il dettaglio dell'iscrizione (link a Iscrizioni).

Implementazione del modulo "Situazione Clienti" come richiesto.
Icona: Creata components/icons/IdentificationIcon.tsx.
Types: Aggiornato Page in types.ts.
App: Aggiunta rotta in App.tsx.
Sidebar: Aggiunta voce di menu in components/Sidebar.tsx.
Page: Creata pages/ClientSituation.tsx con la logica "Search & Detail" richiesta. La vista di dettaglio implementa il layout a 3 colonne per il corpo e lo split-view sincronizzato per il footer (Iscrizioni vs Pagamenti).

*Documentazione aggiornata al 20 Gennaio 2026.*
