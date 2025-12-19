
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

## Sessioni Precedenti

(Log archiviato...)
