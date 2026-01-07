
# Log Attività e Prompt - EP v.1

Questo file contiene lo storico delle interazioni significative per la tracciabilità del progetto.

## Sessione del 18 Dicembre 2025

### Richiesta 1 - 9
(Log archiviato: Avvio sessione, Bugfix editing fatture, Estensione campi fattura, Refactoring editor righe).

### Richiesta 10
**Prompt:** Aggiornamento logica fiscale per regime forfettario e bolli virtuali.
**Azione:**
- Implementazione logica cumulo bolli (< 5000€) con scadenze trimestrali slittate.
- Creazione simulatore rateazione tasse (2 Tranches).
- Aggiornamento dashboard CFO con KPI fiscali.

### Richiesta 11
**Prompt:** Modifica logica fiscale per scenario "Start-up" (Azienda nata nell'anno corrente).
**Azione:**
- Aggiornamento algoritmo `simulatorData` in `Finance.tsx`.
- **Nuova Logica**: 
    - I Tranche (Giugno): 100% Saldo Anno X + 50% Acconto Anno X+1 (Totale carico 150%).
    - II Tranche (Novembre): 50% Acconto Anno X+1.
- Riflesso immediato su griglia accantonamenti consigliati.

### Richiesta 12
**Prompt:** Ripristino card "Educational" / Smart Insight nel Controllo di Gestione.
**Azione:**
- Ripristino componente `LocationDetailModal` con approccio narrativo ("Explain Like I'm 5").
- Visualizzazione grafico a ciambella semplificato (Torta Ricavi vs Costi).
- Copywriting orientato al business ("Cosa ti rimane in tasca", "Ottimo lavoro").
- Integrazione click sulle card delle sedi nel tab Controlling.

### Richiesta 13
**Prompt:** Sigillo sezione Finanza e aggiornamento documentazione.
**Azione:**
- Aggiornamento `Contesto.md` con feature finali Finanza.
- Aggiornamento `Chat.md` con storico modifiche.
- **STATO FINANZA: STABILE (FROZEN).**

## Sessione del 30 Dicembre 2025

### Richiesta 14
**Prompt:** Fix critico su Modale Creazione/Modifica Abbonamenti (Impostazioni). Errore `NotFoundError: Failed to execute 'insertBefore'` e performance degradate.
**Azione:**
- Analisi stack trace: individuato conflitto tra gestione stato React e DOM updates durante rendering condizionale spinto.
- Refactoring componente `SubscriptionForm` in `Settings.tsx`.
- Rimozione `React.memo` e inizializzazione lazy dello stato (`useState(() => ...)`).
- Adozione pattern standard `useEffect` per la sincronizzazione dei dati del form quando cambia la prop `sub`.
- Risultato: Modale stabile, nessun crash, input fluido.

### Richiesta 15
**Prompt:** Quesiti su architettura PWA, conversione in APK nativo (TWA/Sideloading) e aggiornamento documentazione.
**Azione:**
- Fornite spiegazioni dettagliate su TWA, PWABuilder, Bubblewrap e firma APK con Android Studio.
- Aggiornamento file `Contesto.md`, `Architettura.md` e `Chat.md`.

## Sessione del 2 Gennaio 2026

### Richiesta 16
**Prompt:** Creazione pagina "Archivio Iscrizioni" nella sidebar. Focus su storico date "dal... al...", visualizzazione a card e calendario copertura.
**Azione:**
- Aggiornamento `types.ts`, `Sidebar.tsx`, `App.tsx` per il routing.
- Creazione `pages/EnrollmentArchive.tsx`:
    - **Timeline View**: Lista card raggruppate per studente con periodo validità e importi.
    - **Coverage View**: Gantt chart annuale per visualizzare la copertura temporale delle iscrizioni.
    - **Filtri**: Anno (essenziale per storico), Sede, Ricerca.
- Creazione icona `ArchiveIcon`.
