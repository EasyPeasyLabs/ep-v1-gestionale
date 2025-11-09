export enum RegimeFiscale {
    FORFETTARIO = "Regime forfettario",
    ASSOCIAZIONE_CULTURALE = "Associazione culturale",
    ASSOCIAZIONE_APS = "Associazione APS",
    COOPERATIVA = "Cooperativa",
    SRL = "S.r.l.",
}

export type AppContextType = {
    regimeFiscale: RegimeFiscale;
    setRegimeFiscale: (regime: RegimeFiscale) => void;
};

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

export interface Figlio {
    nome: string;
    eta: string;
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

export interface Sede {
    id: string;
    fornitoreId: string;
    nome: string;
    indirizzo: Indirizzo;
    capienzaMassima: number;
    fasciaEta: string;
    costoNoloOra: number;
}

export interface Fornitore {
    id: string;
    classe: ClienteClasse; // Can reuse 'pubblico/privato'
    tipo: FornitoreTipo;
    stato: ClienteStato; // Can reuse client status
    rating: number;
    dati: DatiDitta;
    sedi: Sede[];
    lastModified?: string;
}

// --- OPERATIVO ---

// Laboratori types
export enum TimeSlotStato {
    PROGRAMMATO = "Programmato",
    CONFERMATO = "Confermato",
    ANTICIPATO = "Anticipato",
    POSTICIPATO = "Posticipato",
    ANNULLATO = "Annullato",
}

export interface TimeSlot {
    id: string;
    laboratorioId: string;
    stato: TimeSlotStato;
    data: string; // Data effettiva dello slot
    ordine: number; // Es. 1 di 4
    iscritti: number;
    partecipanti?: number;
}

export interface Laboratorio {
    id: string;
    codice: string; // Es. SPA.LUN.10:00
    sedeId: string;
    dataInizio: string; // YYYY-MM-DD
    dataFine: string; // YYYY-MM-DD
    prezzoListino: number;
    costoAttivita: number;
    costoLogistica: number;
    timeSlots: TimeSlot[];
}

// Attività types
export enum AttivitaStato {
    PIANIFICATA = "Pianificata",
    APPROVATA = "Approvata",
    SOSPESA = "Sospesa",
    OBSOLETA = "Obsoleta",
}

export enum AttivitaTipo {
    LETTURA = "Lettura",
    MUSICA = "Musica",
    GIOCO = "Gioco",
    ROUTINE = "Routine",
    ASCOLTO_RIPETIZIONE = "Ascolto e Ripetizione",
}

export interface Attivita {
    id: string;
    stato: AttivitaStato;
    tipo: AttivitaTipo;
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

// --- FINANCE ---
export enum TipoMovimento {
    ENTRATA = "Entrata",
    USCITA = "Uscita",
}

export enum CentroDiCosto {
    LAVORO = "Lavoro",
    PERSONALE = "Personale",
}

export enum ImputazioneLavoro {
    LABORATORI = "Laboratori",
    CLIENTI = "Clienti",
    FORNITORI = "Fornitori",
    LOGISTICA = "Logistica",
    FORMAZIONE = "Formazione",
    PUBBLICITA = "Pubblicità",
}

export enum ImputazionePersonale {
    TEMPO_LIBERO = "Tempo Libero",
    VIAGGI = "Viaggi",
    ALTRE_SPESE = "Altre Spese Personali",
}

export type Imputazione = ImputazioneLavoro | ImputazionePersonale;

export interface MovimentoFinance {
    id: string;
    tipo: TipoMovimento;
    centroDiCosto: CentroDiCosto;
    imputazione: Imputazione;
    descrizione: string;
    importo: number;
    data: string; // YYYY-MM-DD
}

// --- DOCUMENTI ---
export enum DocumentoTipo {
    CONTRATTO = "Contratto",
    FATTURA = "Fattura",
    RICEVUTA = "Ricevuta",
    PRIVACY = "Informativa Privacy",
    PREVENTIVO = "Preventivo",
    ALTRO = "Altro",
}

export enum DocumentoStato {
    BOZZA = "Bozza",
    INVIATO = "Inviato",
    FIRMATO = "Firmato",
    PAGATO = "Pagato",
    ARCHIVIATO = "Archiviato",
}

export type Associato = {
    id: string;
    tipo: 'cliente' | 'fornitore';
    nome: string;
}

export interface Documento {
    id: string;
    nome: string;
    tipo: DocumentoTipo;
    stato: DocumentoStato;
    dataCreazione: string; // YYYY-MM-DD
    associatoA?: Associato;
    contenuto: string; // Placeholder for file content/path
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

// --- CRM ---
export enum InterazioneTipo {
    TELEFONATA = "Telefonata",
    EMAIL = "Email",
    INCONTRO = "Incontro",
    NOTA = "Nota",
}

export interface InterazioneCRM {
    id: string;
    clienteId: string;
    data: string; // ISO string for datetime
    tipo: InterazioneTipo;
    oggetto: string;
    descrizione: string;
    followUp?: string; // YYYY-MM-DD
}