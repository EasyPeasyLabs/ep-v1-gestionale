
import { RegimeFiscale, ClienteClasse, ClienteTipo, ClienteStato, FornitoreTipo } from './types';

export const REGIME_FISCALE_OPTIONS = Object.values(RegimeFiscale);
export const CLIENTE_CLASSE_OPTIONS = Object.values(ClienteClasse);
export const CLIENTE_TIPO_OPTIONS = Object.values(ClienteTipo);
export const CLIENTE_STATO_OPTIONS = Object.values(ClienteStato);
export const FORNITORE_TIPO_OPTIONS = Object.values(FornitoreTipo);

export const EMPTY_INDIRIZZO = { via: '', civico: '', cap: '', citta: '', provincia: '' };
export const EMPTY_GENITORE = { cognome: '', nome: '', codiceFiscale: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '' };
export const EMPTY_DITTA = { ragioneSociale: '', partitaIva: '', indirizzo: { ...EMPTY_INDIRIZZO }, telefono: '', email: '', referente: '' };
export const EMPTY_SEDE = { id: '', nome: '', indirizzo: { ...EMPTY_INDIRIZZO }, capienzaMassima: 0, fasciaEta: '', costoNoloOra: 0 };
