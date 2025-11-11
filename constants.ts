import { 
    RegimeFiscale, ClienteClasse, ClienteTipo, ClienteStato, FornitoreTipo, 
    AttivitaStato, MaterialeUbicazione, TipoMovimento, CentroDiCosto,
    ImputazioneLavoro, ImputazionePersonale, Imputazione,
    DocumentoTipo, DocumentoStato, PropostaStato, InterazioneTipo,
    TimeSlotStato,
    DurataTipo,
    LaboratorioStato,
    IscrizioneStato
} from './types';

export const REGIME_FISCALE_OPTIONS = Object.values(RegimeFiscale);
export const CLIENTE_CLASSE_OPTIONS = Object.values(ClienteClasse);
export const CLIENTE_TIPO_OPTIONS = Object.values(ClienteTipo);
export const CLIENTE_STATO_OPTIONS = Object.values(ClienteStato);
export const FORNITORE_TIPO_OPTIONS = Object.values(FornitoreTipo);
export const ATTIVITA_STATO_OPTIONS = Object.values(AttivitaStato);
export const MATERIALE_UBICAZIONE_OPTIONS = Object.values(MaterialeUbicazione);
export const GIORNI_SETTIMANA = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
export const TIME_SLOT_STATO_OPTIONS = Object.values(TimeSlotStato);
export const DURATA_TIPO_OPTIONS = Object.values(DurataTipo);
export const LABORATORIO_STATO_OPTIONS = Object.values(LaboratorioStato);
export const ISCRIZIONE_STATO_OPTIONS = Object.values(IscrizioneStato);
export const DURATA_LABORATORIO_OPTIONS = ['OpenDay', 'Mensile', 'Bimestrale', 'Trimestrale', 'Evento', 'Scolastico', 'Campus'];


// Finance Constants
export const TIPO_MOVIMENTO_OPTIONS = Object.values(TipoMovimento);
export const CENTRO_DI_COSTO_OPTIONS = Object.values(CentroDiCosto);
export const IMPUTAZIONI_LAVORO_OPTIONS = Object.values(ImputazioneLavoro);
export const IMPUTAZIONI_PERSONALE_OPTIONS = Object.values(ImputazionePersonale);

// FIX: Added an explicit type to IMPUTAZIONI_MAP to prevent TypeScript from inferring
// a union of array types, which causes issues with array methods like .includes().
// The new type ensures the array elements are treated as a union type `Imputazione[]`.
export const IMPUTAZIONI_MAP: Record<CentroDiCosto, Imputazione[]> = {
    [CentroDiCosto.LAVORO]: IMPUTAZIONI_LAVORO_OPTIONS,
    [CentroDiCosto.PERSONALE]: IMPUTAZIONI_PERSONALE_OPTIONS,
};

// Documenti Constants
export const DOCUMENTO_TIPO_OPTIONS = Object.values(DocumentoTipo);
export const DOCUMENTO_STATO_OPTIONS = Object.values(DocumentoStato);

// Commerciale Constants
export const PROPOSTA_STATO_OPTIONS = Object.values(PropostaStato);

// CRM Constants
export const INTERAZIONE_TIPO_OPTIONS = Object.values(InterazioneTipo);

export const EMPTY_INDIRIZZO = { via: '', civico: '', cap: '', citta: '', provincia: '' };
export const EMPTY_GENITORE = { cognome: '', nome: '', codiceFiscale: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '' };
export const EMPTY_DITTA = { ragioneSociale: '', partitaIva: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '', referente: '' };
export const EMPTY_SEDE = { id: '', fornitoreId: '', nome: '', indirizzo: { ...EMPTY_INDIRIZZO }, capienzaMassima: 0, fasciaEta: '', costoNoloOra: 0, colore: '#A0AEC0' };
export const EMPTY_DURATA = { id: '', nome: '', tipo: DurataTipo.INCONTRI, valore: 1 };
export const EMPTY_LABORATORIO = { id: '', codice: '', sedeId: '', stato: LaboratorioStato.PROGRAMMATO, dataInizio: '', dataFine: '', costoAttivita: 0, costoLogistica: 0, timeSlots: [] };
export const EMPTY_TIMESLOT = { stato: TimeSlotStato.PROGRAMMATO, data: new Date().toISOString().split('T')[0], iscritti: 0, partecipanti: 0 };
export const EMPTY_ATTIVITA = { id: '', stato: AttivitaStato.PIANIFICATA, tipo: '', titolo: '', materiali: [], rating: 0 };
export const EMPTY_MATERIALE = { id: '', nome: '', descrizione: '', unitaMisura: 'pz', quantita: 0, prezzoAbituale: 0, ubicazione: MaterialeUbicazione.HOME };
export const EMPTY_MOVIMENTO = { id: '', tipo: TipoMovimento.USCITA, centroDiCosto: CentroDiCosto.LAVORO, imputazione: ImputazioneLavoro.LABORATORI, descrizione: '', importo: 0, data: new Date().toISOString().split('T')[0] };
export const EMPTY_DOCUMENTO = { id: '', nome: '', tipo: DocumentoTipo.ALTRO, stato: DocumentoStato.BOZZA, dataCreazione: new Date().toISOString().split('T')[0], contenuto: '' };
export const EMPTY_SERVIZIO_PROPOSTA = { id: `new_${Date.now()}`, descrizione: '', quantita: 1, prezzoUnitario: 0 };
export const EMPTY_PROPOSTA = { id: '', codice: '', clienteId: '', dataEmissione: new Date().toISOString().split('T')[0], dataScadenza: '', stato: PropostaStato.BOZZA, servizi: [], totale: 0 };
export const EMPTY_INTERAZIONE = { id: '', clienteId: '', data: new Date().toISOString(), tipo: InterazioneTipo.NOTA, oggetto: '', descrizione: '' };
export const EMPTY_LISTINO = { id: '', laboratorioId: '', listinoBase: 0, profittoPercentuale: 20 };
export const EMPTY_ISCRIZIONE = { id: '', clienteId: '', laboratorioId: '', figliIscritti: [], listinoBaseApplicato: 0, scadenza: '', stato: IscrizioneStato.PROMEMORIA, tipoIscrizione: '' };