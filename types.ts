
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
  lessonId: string;
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
    color: string; // Colore esadecimale per il calendario
}

export interface CompanyInfo {
    id: string;
    name: string;
    vatNumber: string;
    address: string;
    email: string;
    phone: string;
}

export interface SubscriptionType {
    id: string;
    name: string;
    price: number;
    lessons: number;
    durationInDays: number; // Es. 30 per mensile, 90 per trimestrale
}

export interface Lesson {
    id: string;
    date: string; // ISO String
    startTime: string; // Formato HH:mm
    endTime: string; // Formato HH:mm
    supplierId: string;
    locationId: string;
    supplierName: string; // Denormalizzato per UI
    locationName: string; // Denormalizzato per UI
    locationColor?: string; // Denormalizzato per UI
}


// --- Finanza ---

export enum TransactionType {
    Income = 'income',
    Expense = 'expense',
}

export enum TransactionCategory {
    // Income
    Sales = 'Vendite Abbonamenti',
    OtherIncome = 'Altre Entrate',
    // Expense
    Rent = 'Nolo Sedi',
    Materials = 'Materiali Didattici',
    Marketing = 'Marketing',
    Fuel = 'Carburante',
    Transport = 'Trasporti',
    Taxes = 'Imposte e Tasse',
    Admin = 'Costi Amministrativi',
    Training = 'Formazione',
    OtherExpense = 'Altre Spese',
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico Bancario',
    CreditCard = 'Carta di Credito',
    Cash = 'Contanti',
    PayPal = 'PayPal',
    Other = 'Altro',
}

export interface Transaction {
    id: string;
    date: string; // ISO String
    description: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod;
    relatedDocumentId?: string; // Es. id iscrizione o fattura
}

export enum DocumentStatus {
    Draft = 'Bozza',
    Sent = 'Inviato',
    Paid = 'Pagato',
    Overdue = 'Scaduto',
    Cancelled = 'Annullato',
}

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    clientId: string;
    clientName: string; // Denormalizzato
    issueDate: string; // ISO String
    dueDate: string; // ISO String
    items: DocumentItem[];
    totalAmount: number;
    status: DocumentStatus;
}

export interface Quote {
    id: string;
    quoteNumber: string;
    clientId: string;
    clientName: string; // Denormalizzato
    issueDate: string; // ISO String
    expiryDate: string; // ISO String
    items: DocumentItem[];
    totalAmount: number;
    status: DocumentStatus;
}

// --- Notifiche ---
export interface Notification {
  id: string; 
  type: 'expiry' | 'low_lessons';
  message: string;
  clientId: string;
  date: string; // ISO string
}


// --- Tipi di Input per Firestore (senza 'id') ---
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;
export type ClientInput = ParentClientInput | InstitutionalClientInput;

export type SupplierInput = Omit<Supplier, 'id'>;
export type LocationInput = Omit<Location, 'id'>;
export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;
export type LessonInput = Omit<Lesson, 'id'>;
export type EnrollmentInput = Omit<Enrollment, 'id'>;

export type TransactionInput = Omit<Transaction, 'id'>;
export type InvoiceInput = Omit<Invoice, 'id'>;
export type QuoteInput = Omit<Quote, 'id'>;