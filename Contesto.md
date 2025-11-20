
# Contesto del Progetto "EP v.1"

Questo documento contiene la richiesta utente iniziale che ha dato il via allo sviluppo dell'applicazione gestionale "EP v.1".

## Richiesta Utente Originale

Crea un'app gestionale completa di livello enterprise per la mia attività.
L'applicazione deve chiamarsi "EP v.1"
Sto già usando VS Code per tenere traccia del codebase.
Ho già creato:
- un SDK su Firebase
- un account GitHub per il progetto che si chiama "EasyPeasyLabs" e il relativo repository che si chiama "ep-v1-gestionale" (https://github.com/EasyPeasyLabs/ep-v1-gestionale)
- un account Vercel per il deploy in produzione (https://vercel.com/easypeasylabs-projects/ep-v1-gestionale).

La mia attività (per la quale ho bisogno dell'app) è questa: io gestisco una scuola per l'insegnamento della lingua inglese a bambini.
I dati della mia ragione sociale sono: "Rag.Soc. EasyPeasy".

### Requisiti Funzionali

#### 1. Gestione Fornitori
- La scuola gestisce le anagrafiche dei fornitori e delle loro varie sedi.
- Deve poter importare i dati da appositi file CSV formattati secondo uno schema di importazione definito.
- La scuola non ha una sede fissa: usa le sedi dei fornitori esterni, pagando il nolo per ogni lezione erogata.
- Le lezioni sono time-slot di un'ora in un determinato giorno della settimana.

#### 2. Gestione Clienti Privati (Genitori)
- La scuola gestisce le anagrafiche dei genitori e dei loro vari figli.
- Deve poter importare i dati da appositi file CSV.
- I genitori acquistano "pacchetti" di lezioni (abbonamenti) per i figli.
- I pacchetti si svolgono in una o più sedi dei fornitori.
- Il pacchetto si esaurisce con il consumo delle lezioni o in base al tipo di abbonamento (es. mensile per 4 lezioni, settimanale, bimestrale, trimestrale, lezione singola, ecc.).

#### 3. Gestione Clienti Istituzionali
- La scuola gestisce le anagrafiche dei "clienti istituzionali" (asili, fondazioni, enti) e delle loro sedi.
- Deve poter importare i dati da appositi file CSV.
- La scuola gestisce contratti di servizio con questi clienti.
- L'iscrizione avviene "a forfait" per un numero "n" di bambini, non per singolo bambino.
- Il processo è: preventivo -> accettazione -> contratto di servizio -> erogazione lezioni presso la sede del cliente -> pagamento (anche a rate, es. 30gg data fattura).

#### 4. Gestione Listino Prezzi
- I prezzi dei pacchetti sono definiti da un listino standard.
- Il listino può subire variazioni (promozioni, sconti %, sconti per pacchetti multipli, programmi fedeltà).

#### 5. Gestione Finanziaria
- La scuola gestisce le "entrate": pagamenti ricevuti, incassi, risparmi (mese per mese, anno per anno).
- La scuola gestisce le "uscite" e i costi:
  - **Costi operativi**: ideazione piano didattico, materiali.
  - **Costi logistici**: spostamenti in auto (carburante, manutenzione, bollo, assicurazione) o treno/bus.
  - **Costi amministrativi**: dipendono dal regime fiscale (forfettario, cooperativa, associazione, srl, ecc.) e influenzano fatture, bolli, acconti, imposte.
  - **Costi per la formazione**: per il titolare (unico dipendente).
- La scuola registra costi, ricavi, entrate, uscite, forme di pagamento, sistema SDI.
- La scuola produce ed emette preventivi e fatture, con possibilità di generare e stampare PDF da inviare via email.

#### 6. Sistema di Promemoria e Alert
- Un sistema di "promemoria" per gestire scadenze fiscali, commerciali, di pagamento (attive e passive), di iscrizione, obsolescenza materiali.
- Il sistema deve visualizzare "alert" per ogni entità e proporre azioni commerciali (logiche di profitto, continuità fiducia cliente).

#### 7. Sistema di Comunicazioni
- Basato sui promemoria: invio di SMS ed email diretti ai clienti.
- Post e reel sulle pagine social della scuola.

#### 8. Metriche e Statistiche
- Tracciare metriche qualitative ed economico-finanziarie.
- Individuare punti deboli, costi, criticità, perdite, EBITDA, margini di profitto.
- Proporre azioni correttive e di miglioramento.

### Requisiti Non Funzionali e Standard di Qualità

L'applicazione deve superare con un successo >= 99,9% i seguenti test e benchmark durante tutto il ciclo di vita del software:
- robustezza
- affidabilità
- attendibilità
- funzionalità
- coerenza
- consistenza
- integrità dati e Logiche CRUD
- deliverabilità
- conformità
- architettura
- ingegneria
- standard universali correttezza codice e linguaggi
- difetti architetturali
- decisioni di progettazione giuste/sbagliate
- funzionalità valide/non valide/errate
- vulnerabilità (front-end, back-end, database, sicurezza)
- scalabilità e problemi di scalabilità
- **Test Suite Completa:**
  - test unitario, di integrazione, di sistema, di accettazione
  - test white-box, black-box, ad hoc (per ogni riga di codice)
  - test delle API, esplorativi, di regressione, di sanità, smoke test
  - test di accettazione degli utenti (UAT)
  - test di ripristino, delle prestazioni, di carico, di stress, di sicurezza
  - test di ragionevolezza, di usabilità, sugli indicatori visivi di avanzamento
  - test di compatibilità, sul form factor, sul refactoring

### Processo di Sviluppo
Prima di iniziare a scrivere codice, devono essere creati e compilati i seguenti documenti:
1.  **"Contesto.md"**: Questo file, per prendere nota di questo prompt.
2.  **"Architettura.md"**: Per documentare la progettazione strutturale, funzionale e modulistica dell'app.
3.  **"Chat.md"**: Per registrare la storia cronologica delle modifiche e delle richieste, sessione per sessione.

Ad ogni sessione, questi 3 file devono essere letti prima di produrre codice.

---

## Roadmap Futura (Aggiornata)

La seguente roadmap delinea lo stato di avanzamento e le attività future:

### Completate
- **Gestione Avanzata Iscrizioni**: Implementata l'iscrizione multipla (selezione di più figli contemporaneamente per lo stesso corso).
- **Registro Presenze**: Creata una sezione dedicata per la gestione giornaliera delle presenze.
- **Logica Assenze e Recuperi**: Implementato un sistema ibrido per gestire le assenze con slittamento (recupero) automatico della lezione alla prima data utile, tenendo conto delle festività.
- **Registro Attività (Log)**: Creata sezione per assegnare attività didattiche svolte ad ogni singola lezione e storico.
- **CRM Avanzato (Comunicazioni Libere)**: Implementata modale per invio messaggi massivi o singoli a clienti/fornitori via Email (BCC) o WhatsApp.
- **Planner Verifiche Periodiche**: Sistema CRUD per definire controlli ricorrenti (scadenze, pagamenti, materiali) con gestione giorni della settimana e abilitazione notifiche Push.

### In Programma
1.  **Gestione Costi e Controllo di Gestione**
    - **Categorizzazione Avanzata**: Implementazione dettagliata dei costi Logistici, Amministrativi e Operativi.
    - **Imputazione Costi**: Collegamento dei costi operativi a lezioni e abbonamenti.
    - **Analisi Profitto**: Algoritmi per il calcolo della percentuale reale di profitto per abbonamento/cliente.

2.  **Integrazione Fiscale e SDI**
    - **Studio di Fattibilità**: Analisi delle API e dei servizi web dell'Agenzia delle Entrate.
    - **Integrazione (se fattibile)**: Connessione diretta per l'invio fatture elettroniche.

3.  **Business Intelligence**
    - **Metriche Avanzate**: Dashboard per KPI qualitativi ed economici più profondi.
