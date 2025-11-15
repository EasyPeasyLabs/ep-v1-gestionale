import { 
    RegimeFiscale, ClienteClasse, ClienteTipo, ClienteStato, FornitoreTipo, 
    AttivitaStato, MaterialeUbicazione, PropostaStato, 
    // FIX: Import new enums and types for Laboratori, Durate, Listini, Iscrizioni
    LaboratorioStato, TimeSlotStato, IscrizioneStato, TimeSlot, Iscrizione, Listino,
    // FIX: Add Finance types
    TipoMovimento, CentroDiCosto, Imputazione, ImputazioneGenerale, ImputazioneCommerciale, ImputazioneOperativa, MovimentoFinance,
// FIX: Add Documenti types
    Documento, DocumentoStato, DocumentoTipoDef,
// FIX: Add CRM types
    InterazioneCRM, InterazioneTipo,
// Add new types for Anagrafiche
    TimeSlotDef, ListinoDef, LaboratorioTipoDef,
// FIX: Import new Promemoria types
    Promemoria, PromemoriaStato,
// FIX: Add Durata types for the legacy Durate micro-app.
    Durata, DurataTipo,
// FIX: Add Relazioni types for the new relationships feature.
    RelazioneDef, RelazioneTipo
} from './types';

export const REGIME_FISCALE_OPTIONS = Object.values(RegimeFiscale);
export const CLIENTE_CLASSE_OPTIONS = Object.values(ClienteClasse);
export const CLIENTE_TIPO_OPTIONS = Object.values(ClienteTipo);
export const CLIENTE_STATO_OPTIONS = Object.values(ClienteStato);
export const FORNITORE_TIPO_OPTIONS = Object.values(FornitoreTipo);
export const ATTIVITA_STATO_OPTIONS = Object.values(AttivitaStato);
export const MATERIALE_UBICAZIONE_OPTIONS = Object.values(MaterialeUbicazione);
export const GIORNI_SETTIMANA = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

// Commerciale Constants
export const PROPOSTA_STATO_OPTIONS = Object.values(PropostaStato);

export const EMPTY_INDIRIZZO = { via: '', civico: '', cap: '', citta: '', provincia: '' };
export const EMPTY_GENITORE = { cognome: '', nome: '', codiceFiscale: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '' };
export const EMPTY_GENITORE_ANAGRAFICA = { id: '', cognome: '', nome: '', codiceFiscale: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '' };
export const EMPTY_FIGLIO_ANAGRAFICA = { id: '', nome: '', eta: '' };
export const EMPTY_FORNITORE_ANAGRAFICA = { id: '', ragioneSociale: '', partitaIva: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '', referente: '' };
export const EMPTY_DITTA = { ragioneSociale: '', partitaIva: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '', referente: '' };
export const EMPTY_SEDE_ANAGRAFICA = { id: '', fornitoreId: '', nome: '', indirizzo: { ...EMPTY_INDIRIZZO }, capienzaMassima: 0, fasciaEta: '', costoNoloOra: 0, colore: '#A0AEC0' };
export const EMPTY_ATTIVITA_ANAGRAFICA = { id: '', nome: '', fasciaEta: '', materialiIds: [] };
export const EMPTY_ATTIVITA = { id: '', stato: AttivitaStato.PIANIFICATA, tipo: '', titolo: '', materiali: [], rating: 0 };
export const EMPTY_MATERIALE = { id: '', nome: '', descrizione: '', unitaMisura: 'pz', quantita: 0, prezzoAbituale: 0, ubicazione: MaterialeUbicazione.HOME };
export const EMPTY_SERVIZIO_PROPOSTA = { id: `new_${Date.now()}`, descrizione: '', quantita: 1, prezzoUnitario: 0 };
export const EMPTY_PROPOSTA = { id: '', codice: '', clienteId: '', dataEmissione: new Date().toISOString().split('T')[0], dataScadenza: '', stato: PropostaStato.BOZZA, servizi: [], totale: 0 };
export const EMPTY_MIA_AZIENDA = { ragioneSociale: '', partitaIva: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '' };
export const EMPTY_CONFIGURAZIONE = { id: 'main', datiAzienda: { ...EMPTY_MIA_AZIENDA }, regimeFiscale: RegimeFiscale.FORFETTARIO };

// FIX: Add constants for Documenti
export const DOCUMENTO_STATO_OPTIONS = Object.values(DocumentoStato);
export const EMPTY_DOCUMENTO: Documento = {
    id: '',
    nome: '',
    dataCreazione: new Date().toISOString().split('T')[0],
    tipo: '',
    stato: DocumentoStato.BOZZA,
    contenuto: '',
};

// FIX: Add new constants for Laboratori, Durate, Listini, Iscrizioni
// Laboratori Constants
export const LABORATORIO_STATO_OPTIONS = Object.values(LaboratorioStato);
export const TIME_SLOT_STATO_OPTIONS = Object.values(TimeSlotStato);
export const DURATA_LABORATORIO_OPTIONS = ['OpenDay', 'Mensile', 'Bimestrale', 'Trimestrale', 'Evento', 'Scolastico', 'Campus'];
export const EMPTY_TIMESLOT: Omit<TimeSlot, 'id' | 'laboratorioId' | 'ordine'> = { data: new Date().toISOString().split('T')[0], stato: TimeSlotStato.PROGRAMMATO, iscritti: 0 };
export const EMPTY_LABORATORIO = { id: '', codice: '', sedeId: '', tipoId: '', stato: LaboratorioStato.PROGRAMMATO, dataInizio: '', dataFine: '', costoAttivita: 0, costoLogistica: 0, timeSlots: [] };

// Iscrizioni Constants
export const ISCRIZIONE_STATO_OPTIONS = Object.values(IscrizioneStato);
export const EMPTY_ISCRIZIONE: Omit<Iscrizione, 'id' | 'codice'> = { 
    clienteId: '', 
    laboratorioId: '', 
    figliIds: [], 
    timeSlotIds: [], 
    listinoDefId: '', 
    stato: IscrizioneStato.PROMEMORIA, 
    importo: 0,
    dataCreazione: new Date().toISOString().split('T')[0]
};

// FIX: Add constant for new Listini feature.
// Listini Constants
export const EMPTY_LISTINO: Omit<Listino, 'id'> = {
    laboratorioId: '',
    listinoDefId: '',
    listinoBase: 0,
    profittoPercentuale: 20,
};

// FIX: Add constants for Promemoria
export const PROMEMORIA_STATO_OPTIONS = Object.values(PromemoriaStato);
export const EMPTY_PROMEMORIA: Omit<Promemoria, 'id'> = {
    iscrizioneId: '',
    genitoreId: '',
    laboratorioCodice: '',
    dataScadenza: '',
    stato: PromemoriaStato.ATTIVO,
};

// FIX: Add constants for Finance
// Finance Constants
export const TIPO_MOVIMENTO_OPTIONS = Object.values(TipoMovimento);
export const CENTRO_DI_COSTO_OPTIONS = Object.values(CentroDiCosto);

// The `as const` assertion ensures that TypeScript treats the array as a readonly tuple of string literals,
// which is necessary for the `includes` method to work correctly in the Finance component without type casting.
// FIX: Replaced Object.values() with explicit array literals of enum members. The `as const`
// assertion is not applicable to function call results, and this change ensures correct, strict typing.
export const IMPUTAZIONI_GENERALI_OPTIONS = [
    ImputazioneGenerale.AFFITTO,
    ImputazioneGenerale.UTENZE,
    ImputazioneGenerale.CONSULENZE,
    ImputazioneGenerale.ASSICURAZIONI,
    ImputazioneGenerale.MARKETING,
    ImputazioneGenerale.VARIE,
] as const;
export const IMPUTAZIONI_COMMERCIALI_OPTIONS = [
    ImputazioneCommerciale.PROPOSTA,
    ImputazioneCommerciale.EVENTO,
] as const;
export const IMPUTAZIONI_OPERATIVE_OPTIONS = [
    ImputazioneOperativa.LABORATORIO,
    ImputazioneOperativa.MATERIALI,
] as const;

export const IMPUTAZIONI_MAP: { [key in CentroDiCosto]: readonly Imputazione[] } = {
    [CentroDiCosto.GENERALE]: IMPUTAZIONI_GENERALI_OPTIONS,
    [CentroDiCosto.COMMERCIALE]: IMPUTAZIONI_COMMERCIALI_OPTIONS,
    [CentroDiCosto.OPERATIVO]: IMPUTAZIONI_OPERATIVE_OPTIONS,
};

export const EMPTY_MOVIMENTO: Omit<MovimentoFinance, 'id'> = {
    data: new Date().toISOString().split('T')[0],
    descrizione: '',
    tipo: TipoMovimento.USCITA,
    importo: 0,
    centroDiCosto: CentroDiCosto.GENERALE,
    imputazione: ImputazioneGenerale.VARIE,
};

// FIX: Add constants for CRM
export const INTERAZIONE_TIPO_OPTIONS = Object.values(InterazioneTipo);
export const EMPTY_INTERAZIONE: Omit<InterazioneCRM, 'id' | 'clienteId'> = {
    data: new Date().toISOString(),
    tipo: InterazioneTipo.TELEFONATA,
    oggetto: '',
    descrizione: '',
    followUp: '',
};

// Anagrafiche Definizioni
// FIX: Add constants for the legacy Durate micro-app.
export const DURATA_TIPO_OPTIONS = Object.values(DurataTipo);
export const EMPTY_DURATA: Omit<Durata, 'id'> = {
    nome: '',
    tipo: DurataTipo.SETTIMANE,
    valore: 4,
};

export const EMPTY_TIMESLOT_DEF: Omit<TimeSlotDef, 'id'> = {
    nome: '',
    valoreInMinuti: 60,
};

export const EMPTY_LISTINO_DEF: Omit<ListinoDef, 'id'> = {
    tipo: '',
    prezzo: 0,
    numeroIncontri: 0,
};

export const EMPTY_LABORATORIO_TIPO_DEF: Omit<LaboratorioTipoDef, 'id'> = {
    tipo: '',
    codice: '',
    // FIX: Replaced `durataId` with `numeroTimeSlots`.
    numeroTimeSlots: 4,
};

export const EMPTY_DOCUMENTO_TIPO_DEF: Omit<DocumentoTipoDef, 'id'> = {
    nome: '',
    codice: '',
};

// FIX: Add constants for the new relationships feature.
export const RELAZIONE_TIPO_OPTIONS = Object.values(RelazioneTipo);
export const ANAGRAFICHE_ENTITIES = [
    'genitori', 
    'figli', 
    'fornitoriAnagrafica', 
    'sedi', 
    'attivitaAnagrafica', 
    'materiali'
] as const;
export const EMPTY_RELAZIONE_DEF: Omit<RelazioneDef, 'id'> = {
    nome: '',
    descrizione: '',
    entitaA: '',
    entitaB: '',
    tipo: RelazioneTipo.UNO_A_MOLTI,
    foreignKeyField: '',
    microAppGenerated: false,
};