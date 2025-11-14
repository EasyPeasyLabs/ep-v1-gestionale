// FIX: Removed self-import of `RegimeFiscale` which was causing a conflict with its own declaration.
export enum RegimeFiscale {
    FORFETTARIO = "Regime forfettario",
    ASSOCIAZIONE_CULTURALE = "Associazione culturale",
    ASSOCIAZIONE_APS = "Associazione APS",
    COOPERATIVA = "Cooperativa",
    SRL = "S.r.l.",
}

export type AppContextType = {
    regimeFiscale: RegimeFiscale;
};

// --- CONFIGURAZIONE ---
export interface DatiMiaAzienda {
    ragioneSociale: string;
    partitaIva: string;
    indirizzo: Indirizzo;
    telefono: string;
    email: string;
}

export interface ConfigurazioneAzienda {
    id: string; // Should be a fixed ID like 'main'
    datiAzienda: DatiMiaAzienda;
    regimeFiscale: RegimeFiscale;
}


// --- ANAGRAFICHE ---

// Clienti types
export enum ClienteClasse {
    PUBBLICO = "Pubblico",
    PRIVATO = "Privato",
}

export enum ClienteTipo {
    ENTE = "Ente",
    AZIENDA = "Azienda",
    FAMIGLIA = "Famiglia",
}

export enum ClienteStato {
    ATTIVO = "Attivo",
    DORMIENTE = "Dormiente",
    SOSPESO = "Sospeso",
    CESSATO = "Cessato",
    PROSPECT = "Prospect",
}

export interface Indirizzo {
    via: string;
    civico: string;
    cap: string;
    citta: string;
    provincia: string;
}

export interface DatiDitta {
    ragioneSociale: string;
    partitaIva: string;
    indirizzo: Indirizzo;
    telefono: string;
    email: string;
    referente: string;
}

export interface BambiniEnte {
    quantita: number;
    fasciaEta: string;
}

export interface Genitore {
    cognome: string;
    nome: string;
    codiceFiscale: string;
    indirizzo: Indirizzo;
    telefono: string;
    email: string;
}

export interface GenitoreAnagrafica {
    id: string;
    cognome: string;
    nome: string;
    codiceFiscale: string;
    indirizzo: Indirizzo;
    telefono: string;
    email: string;
    lastModified?: string;
}

export interface Figlio {
    id: string;
    nome: string;
    eta: string;
}

export interface FiglioAnagrafica {
    id: string;
    nome: string;
    eta: string;
    lastModified?: string;
}

export interface FornitoreAnagrafica {
    id: string;
    ragioneSociale: string;
    partitaIva: string;
    indirizzo: Indirizzo;
    telefono: string;
    email: string;
    referente: string;
    lastModified?: string;
}

export interface SedeAnagrafica {
    id: string;
    fornitoreId: string;
    nome: string;
    indirizzo: Indirizzo;
    capienzaMassima: number;
    fasciaEta: string;
    costoNoloOra: number;
    colore: string;
    lastModified?: string;
}

export interface AttivitaAnagrafica {
    id: string;
    nome: string;
    fasciaEta: string;
    materiali: string[];
    lastModified?: string;
}

export interface DatiFamiglia {
    genitore1: Genitore;
    genitore2?: Partial<Genitore>;
    figli: Figlio[];
}

export interface ClienteBase {
    id: string;
    classe: ClienteClasse;
    tipo: ClienteTipo;
    stato: ClienteStato;
    rating: number;
    lastModified?: string; // Data e ora dell'ultima modifica
}

export interface ClienteEnteAzienda extends ClienteBase {
    tipo: ClienteTipo.ENTE | ClienteTipo.AZIENDA;
    dati: DatiDitta;
    bambini?: BambiniEnte;
}

export interface ClienteFamiglia extends ClienteBase {
    tipo: ClienteTipo.FAMIGLIA;
    dati: DatiFamiglia;
}

export type Cliente = ClienteEnteAzienda | ClienteFamiglia;

// Fornitori types
export enum FornitoreTipo {
    ENTE = "Ente",
    AZIENDA = "Azienda",
}

export interface Fornitore {
    id: string;
    classe: ClienteClasse; // Can reuse 'pubblico/privato'
    tipo: FornitoreTipo;
    stato: ClienteStato; // Can reuse client status
    rating: number;
    dati: DatiDitta;
    lastModified?: string;
}

// --- OPERATIVO ---

// Attività types
export enum AttivitaStato {
    PIANIFICATA = "Pianificata",
    APPROVATA = "Approvata",
    SOSPESA = "Sospesa",
    OBSOLETA = "Obsoleta",
}

export interface AttivitaTipoDef {
    id: string;
    nome: string;
}

// FIX: Add LaboratorioTipoDef to support managing laboratory types.
export interface LaboratorioTipoDef {
    id: string;
    tipo: string;
    codice: string;
}

export interface Attivita {
    id: string;
    stato: AttivitaStato;
    tipo: string; // Nome del tipo da collezione AttivitaTipoDef
    titolo: string;
    materiali: string[]; // Lista di ID Materiale
    rating: number; // 1 to 5
}


// Materiali types
export enum MaterialeUbicazione {
    HOME = "Magazzino EasyPeasy",
    TERZI = "Magazzino Fornitore",
}

export interface Materiale {
    id: string;
    nome: string;
    descrizione: string;
    unitaMisura: string;
    quantita: number;
    prezzoAbituale: number;
    ubicazione: MaterialeUbicazione;
}

// --- COMMERCIALE ---
export enum PropostaStato {
    BOZZA = "Bozza",
    INVIATA = "Inviata",
    ACCETTATA = "Accettata",
    RIFIUTATA = "Rifiutata",
    SCADUTA = "Scaduta",
}

export interface PropostaServizio {
    id: string;
    descrizione: string;
    quantita: number;
    prezzoUnitario: number;
}

export interface PropostaCommerciale {
    id: string;
    codice: string;
    clienteId: string;
    dataEmissione: string; // YYYY-MM-DD
    dataScadenza: string; // YYYY-MM-DD
    stato: PropostaStato;
    servizi: PropostaServizio[];
    totale: number;
}

// --- LABORATORI ---
export enum LaboratorioStato {
    PROGRAMMATO = "Programmato",
    ATTIVO = "Attivo",
    IN_PAUSA = "In Pausa",
    TERMINATO = "Terminato",
    ANNULLATO = "Annullato",
}

export enum TimeSlotStato {
    PROGRAMMATO = "Programmato",
    CONFERMATO = "Confermato",
    ANNULLATO = "Annullato",
    POSTICIPATO = "Posticipato",
    ANTICIPATO = "Anticipato",
}

export interface TimeSlot {
    id: string;
    laboratorioId: string;
    ordine: number;
    data: string; // YYYY-MM-DD
    stato: TimeSlotStato;
    iscritti: number;
    partecipanti?: number;
}

export interface Laboratorio {
    id: string;
    codice: string;
    sedeId: string;
    // FIX: Added optional 'tipo' property to link laboratori to their type definition.
    tipo?: string;
    stato: LaboratorioStato;
    dataInizio: string; // YYYY-MM-DD
    dataFine: string; // YYYY-MM-DD
    costoAttivita: number;
    costoLogistica: number;
    timeSlots: TimeSlot[];
}

// --- DURATE ---
export enum DurataTipo {
    INCONTRI = "Incontri",
    SETTIMANE = "Settimane",
    MESI = "Mesi",
}

export interface Durata {
    id: string;
    nome: string;
    tipo: DurataTipo;
    valore: number;
}

// --- LISTINI ---
export interface Listino {
    id: string;
    laboratorioId: string;
    listinoBase: number;
    profittoPercentuale: number;
}

// --- ISCRIZIONI ---
export enum IscrizioneStato {
    PROMEMORIA = "Promemoria",
    PAGATO = "Pagato",
    ANNULLATO = "Annullato",
}

export interface Iscrizione {
    id: string;
    codice: string;
    clienteId: string;
    laboratorioId: string;
    figliIds: string[];
    timeSlotIds: string[];
    listinoId: string;
    stato: IscrizioneStato;
    importo: number;
    dataCreazione: string; // YYYY-MM-DD
}

// --- FINANCE ---
export enum TipoMovimento {
    ENTRATA = "Entrata",
    USCITA = "Uscita",
}

export enum CentroDiCosto {
    GENERALE = "Costi Generali",
    COMMERCIALE = "Commerciale",
    OPERATIVO = "Operativo",
}

export enum ImputazioneGenerale {
    AFFITTO = "Affitto",
    UTENZE = "Utenze",
    CONSULENZE = "Consulenze",
    ASSICURAZIONI = "Assicurazioni",
    MARKETING = "Marketing",
    VARIE = "Varie",
}

export enum ImputazioneCommerciale {
    PROPOSTA = "Proposta Commerciale",
    EVENTO = "Evento Promozionale",
}

export enum ImputazioneOperativa {
    LABORATORIO = "Laboratorio",
    MATERIALI = "Acquisto Materiali",
}

export type Imputazione = ImputazioneGenerale | ImputazioneCommerciale | ImputazioneOperativa;

export interface MovimentoFinance {
    id: string;
    data: string; // YYYY-MM-DD
    descrizione: string;
    tipo: TipoMovimento;
    importo: number;
    centroDiCosto: CentroDiCosto;
    imputazione: Imputazione;
}

// FIX: Add types for CRM feature
// --- CRM ---
export enum InterazioneTipo {
    TELEFONATA = "Telefonata",
    EMAIL = "Email",
    INCONTRO = "Incontro",
    MESSAGGIO = "Messaggio",
}

export interface InterazioneCRM {
    id: string;
    clienteId: string;
    data: string; // ISO datetime string, es. 2024-07-30T10:00
    tipo: InterazioneTipo;
    oggetto: string;
    descrizione: string;
    followUp?: string; // YYYY-MM-DD
}

// --- DOCUMENTI ---
export interface DocumentoTipoDef {
    id: string;
    nome: string;
    codice: string;
}

export enum DocumentoStato {
    BOZZA = "Bozza",
    FINALE = "Finale",
    ARCHIVIATO = "Archiviato",
}

export interface Associato {
    id: string;
    tipo: 'cliente' | 'fornitore';
    nome: string;
}

export interface Documento {
    id: string;
    nome: string;
    dataCreazione: string; // YYYY-MM-DD
    tipo: string;
    stato: DocumentoStato;
    associatoA?: Associato;
    contenuto: string; // URL or reference
}

// --- ANAGRAFICHE / DEFINIZIONI ---

export interface TimeSlotDef {
    id: string;
    nome: string; // e.g., "1 Ora", "90 Minuti"
    valoreInMinuti: number;
}

export interface ListinoDef {
    id: string;
    tipo: string;
    prezzo: number;
}

// --- RELAZIONI ---
export enum RelazioneTipo {
    UNO_A_MOLTI = "Uno a Molti",
    MOLTI_A_MOLTI = "Molti a Molti",
}

export interface RelazioneDef {
    id: string;
    nome: string;
    descrizione: string;
    entitaA: string; // collection name
    entitaB: string; // collection name
    tipo: RelazioneTipo;
    // For UNO_A_MOLTI, this field is on the 'MOLTI' side entity
    // For MOLTI_A_MOLTI, this could be the name of the join collection
    foreignKeyField: string; 
    microAppGenerated: boolean;
}