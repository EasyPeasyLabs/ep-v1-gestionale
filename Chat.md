
# Log Attività e Prompt - EP v.1

Questo file contiene lo storico delle interazioni significative per la tracciabilità del progetto.

## Sessione del 18 Dicembre 2025

### Richiesta 1
Inizio sessione. Verifica stato progetto.

### Richiesta 2
**Prompt:** Risoluzione bug bottone "modifica" nella griglia fatture (Finanza).
**Azione:**
- Analisi codice: Rilevato blocco logico che impediva apertura modale per le fatture.
- Creazione componente `InvoiceEditForm` preliminare.
- Aggiornamento stati `Finance.tsx` per gestire la modale di editing fattura.

### Richiesta 3
**Prompt:** Estensione funzionalità modale modifica. Richiesta di poter modificare tutti i campi chiave (Numero, Date, Importo, Metodo, Note, SDI).
**Azione:**
- Aggiornamento `InvoiceEditForm` con campi input aggiuntivi.
- Aggiunta logica condizionale per mostrare campo SDI solo se documento sigillato.
- Alert UX per disallineamento importi manuali.

### Richiesta 4
**Prompt:** Implementazione modifica completa fatture incluse le righe articoli.
**Azione:**
- **Refactoring completo** di `InvoiceEditForm`.
- Implementazione state array per `items` (righe fattura).
- Aggiunta funzioni `addItem`, `removeItem`, `updateItem`.
- **Logica Ricalcolo**: `useEffect` per ricalcolare automaticamente il `totalAmount` in base alla somma delle righe + eventuale bollo.
- **UX**: Layout modale con header e footer "sticky" (fissi) e corpo scrollabile per migliore usabilità su schermi piccoli o fatture lunghe.

## Sessioni Precedenti

(Log archiviato...)
