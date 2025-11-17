export interface Child {
  id: string; // ID temporaneo per la UI, generato al momento della creazione
  name: string;
  age: string; // Età in formato testo, es: "3 anni", "18 mesi"
}

export enum SubscriptionStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Expired = 'Expired',
}

export interface Subscription {
  id: string;
  packageName: string;
  lessonsTotal: number;
  lessonsRemaining: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}

export enum ClientType {
  Parent = 'Parent',
  Institutional = 'Institutional',
}

interface ClientBase {
  id:string;
  clientType: ClientType;
  address: string;
  zipCode: string; // CAP
  city: string;
  province: string;
  email: string;
  phone: string;
}

export interface ParentClient extends ClientBase {
  clientType: ClientType.Parent;
  firstName: string;
  lastName: string;
  taxCode: string; // Codice Fiscale
  avatarUrl: string;
  children: Child[];
  subscriptions: Subscription[];
}

export interface InstitutionalClient extends ClientBase {
  clientType: ClientType.Institutional;
  companyName: string; // Ragione Sociale
  vatNumber: string; // Partita IVA / Codice Fiscale
  numberOfChildren: number;
  ageRange: string; // es. "3-5 anni"
}

export type Client = ParentClient | InstitutionalClient;

export interface Supplier {
  id: string;
  companyName: string; // Ragione Sociale
  vatNumber: string; // Partita IVA
  address: string;
  zipCode: string;
  city: string;
  province: string;
  email: string;
  phone: string;
  locations: Location[];
}

export interface Location {
    id: string; // ID temporaneo per la UI o da Firestore
    name: string; // Nome Sede
    address: string;
    zipCode: string;
    city: string;
    province: string;
    capacity: number; // Capienza
    rentalCost: number; // Costo nolo
    distance: number; // Distanza in km
}

export interface CompanyInfo {
    id: string;
    name: string;
    vatNumber: string;
    address: string;
    email: string;
    phone: string;
}


export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;
export type ClientInput = ParentClientInput | InstitutionalClientInput;

export type SupplierInput = Omit<Supplier, 'id'>;
export type LocationInput = Omit<Location, 'id'>;