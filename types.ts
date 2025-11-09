
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
}
