# Scripts Directory

Questa directory contiene script di utilità, manutenzione e migrazione dati. 
L'uso di questi script deve essere fatto con cautela, specialmente in produzione.

## Panoramica Script

- **debug_matching.js / microscopic_debug.js**: Script per identificare problemi specifici nei match (probabilmente per le lezioni o prenotazioni).
- **diagnose_db.ts / inspect.js / inspect_db.js**: Analisi dello stato del database, ricerca anomalie.
- **migrate_location.cjs**: Migrazione storiche (es. cambio ID sedi).
- **nuclear_fix.js**: Nome suggerisce fix profondo e distruttivo su dati inconsistenti, NON usare senza prima controllare il codice.
- **oneTimeFixMay2026.ts**: Fix isolato datato maggio 2026, specifico per un bug noto in quel momento.
- **realign_occupancy***: Script multipli per il riallineamento dei contatori di occupazione delle classi/sedi.
- **smart_link***: Collegamenti tra entità orfane o disallineate.
- **realign_vito_figlio.cjs**: Script per fix mirato ad utenze o dati specifici.

## Avvertenze

- **Backup**: Prima di lanciare qualsiasi script di `fix` o `migrate`, assicurarsi di avere un dump del DB o fare dei test nell'emulatore.
- **Node.js Environment**: Alcuni script sono `.cjs` / `.js` mentre altri sono `.ts`, utilizzare strumenti come `npx tsx <file>` per i TypeScript.
