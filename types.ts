export interface Child {
  id: string; // ID temporaneo per la UI, generato al momento della creazione
  name: string;
  age: string; // Età in formato testo, es: "3 anni", "18 mesi"
}

export enum EnrollmentStatus {
  Active = 'Active',
  Completed = 'Completed',
  Expired = 'Expired',
}

export interface Enrollment {
  id: string;
  clientId: string;
  childId: string;
  childName: string; // Denormalizzato per una visualizzazione più semplice
  subscriptionTypeId: string;
  subscriptionName: string; // Denormalizzato
  scheduledClassId: string;
  lessonsTotal: number;
  lessonsRemaining: number;
  startDate: string; // ISO String
  endDate: string; // ISO String
  status: EnrollmentStatus;
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

// Nuove interfacce per listino e calendario
export interface SubscriptionType {
    id: string;
    name: string;
    price: number;
    lessons: number;
    durationInDays: number; // Es. 30 per mensile, 90 per trimestrale
}

export interface ScheduledClass {
    id: string;
    dayOfWeek: 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | 'Sabato' | 'Domenica';
    startTime: string; // Formato HH:mm
    endTime: string; // Formato HH:mm
    supplierId: string;
    locationId: string;
    supplierName: string; // Denormalizzato per UI
    locationName: string; // Denormalizzato per UI
}


export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;
export type ClientInput = ParentClientInput | InstitutionalClientInput;

export type SupplierInput = Omit<Supplier, 'id'>;
export type LocationInput = Omit<Location, 'id'>;
export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;
export type ScheduledClassInput = Omit<ScheduledClass, 'id'>;
export type EnrollmentInput = Omit<Enrollment, 'id'>;