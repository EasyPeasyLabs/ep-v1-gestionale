
export interface Child {
  id: string;
  name: string;
  age: string; // Età in formato testo, es: "3 anni", "18 mesi"
  subscriptionId: string;
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
  id: string;
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
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  locations: Location[];
}

export interface Location {
    id: string;
    address: string;
    city: string;
    capacity: number;
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
