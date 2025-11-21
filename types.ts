
export interface Child {
  id: string; // ID temporaneo per la UI, generato al momento della creazione
  name: string;
  age: string; // Età in formato testo, es: "3 anni", "18 mesi"
}

export enum EnrollmentStatus {
  Pending = 'Pending', // Iscritto ma non pagato (occupa posto)
  Active = 'Active',   // Pagato e frequentante
  Completed = 'Completed', // Terminato regolarmente o Abbandonato
  Expired = 'Expired', // Scaduto
}

export type AppointmentStatus = 'Scheduled' | 'Present' | 'Absent' | 'Cancelled';

export interface Appointment {
    lessonId: string; // ID univoco della singola lezione generata
    date: string; // ISO String
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor?: string;
    childName?: string; // Per visualizzazione calendario
    status?: AppointmentStatus; // Nuovo campo per tracciare presenze/assenze
}

export interface Enrollment {
  id: string;
  clientId: string;
  childId: string;
  childName: string; // Denormalizzato per una visualizzazione più semplice
  subscriptionTypeId: string;
  subscriptionName: string; // Denormalizzato
  price?: number; // Prezzo pattuito al momento dell'iscrizione
  
  // Nuovi campi per legare l'iscrizione alla sede (Aula)
  supplierId: string;
  supplierName: string;
  locationId: string;
  locationName: string;
  locationColor?: string; // Colore ereditato dalla sede

  appointments: Appointment[]; // Array delle lezioni prenotate (può essere vuoto se l'iscrizione è a consumo/open)
  lessonsTotal: number;
  lessonsRemaining: number;
  startDate: string; // ISO String
  endDate: string; // ISO String
  status: EnrollmentStatus;
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

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
  isDeleted?: boolean; // Soft Delete flag
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
export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

export interface AvailabilitySlot {
    dayOfWeek: number; // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
    startTime: string; // HH:mm
    endTime: string; // HH:mm
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
    availability: AvailabilitySlot[]; // Orari disponibili per le lezioni
}

export type LocationInput = Omit<Location, 'id'>;

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
  isDeleted?: boolean; // Soft Delete flag
}

export type SupplierInput = Omit<Supplier, 'id'>;

export interface CompanyInfo {
    id: string;
    denomination?: string; // Denominazione (es. Brand name)
    name: string; // Ragione Sociale
    vatNumber: string;
    address: string;
    email: string;
    phone: string;
    logoBase64?: string; // Logo in formato Base64
}

export interface SubscriptionType {
    id: string;
    name: string;
    price: number;
    lessons: number;
    durationInDays: number; // Es. 30 per mensile, 90 per trimestrale
}

export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;

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

export type LessonInput = Omit<Lesson, 'id'>;

// --- Registro Attività (Libreria) ---
export interface Activity {
    id: string;
    title: string;
    category: string;
    theme: string; // Filo conduttore
    description: string;
    materials: string;
    links?: string;
    createdAt?: string;
}

export type ActivityInput = Omit<Activity, 'id'>;

export interface LessonActivity {
    id: string;
    lessonId: string;
    activityIds: string[];
    date: string;
}

// --- Notifications ---
export interface Notification {
    id: string;
    type: 'expiry' | 'payment_required' | 'action_required' | 'low_lessons';
    message: string;
    clientId?: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

// --- CRM / Communications ---
export interface CommunicationLog {
    id: string;
    date: string; // ISO String
    channel: 'email' | 'whatsapp' | 'sms';
    subject: string;
    message: string;
    recipients: string[]; // Array di nomi o stringa descrittiva
    recipientCount: number;
    type: 'manual' | 'renewal' | 'payment' | 'other';
}

export type CommunicationLogInput = Omit<CommunicationLog, 'id'>;

// --- Finance ---
export enum TransactionType {
    Income = 'income',
    Expense = 'expense',
}

export enum TransactionCategory {
    Sales = 'Vendite',
    Rent = 'Nolo Sedi',
    Salaries = 'Stipendi',
    Equipment = 'Attrezzature',
    Marketing = 'Marketing',
    Utilities = 'Utenze',
    Taxes = 'Tasse',
    // Nuove Categorie Avanzate
    Fuel = 'Carburante',
    Transport = 'Trasporti/Viaggi',
    VehicleMaintenance = 'Manutenzione Veicolo',
    Insurance = 'Assicurazione',
    ProfessionalServices = 'Consulenze/Commercialista',
    Software = 'Software/Servizi',
    Materials = 'Materiali Didattici',
    Training = 'Formazione',
    OtherIncome = 'Altri Ricavi',
    OtherExpense = 'Altre Spese',
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico',
    Cash = 'Contanti',
    CreditCard = 'Carta di Credito',
    PayPal = 'PayPal',
    Other = 'Altro',
}

export enum TransactionStatus {
    Pending = 'pending',
    Completed = 'completed',
}

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod;
    status: TransactionStatus;
    relatedDocumentId?: string;
    // Cost Allocation (Controllo di Gestione)
    allocationType?: 'general' | 'location' | 'enrollment'; // Dove imputare il costo
    allocationId?: string; // ID della Sede o dell'Iscrizione
    allocationName?: string; // Nome denormalizzato per display rapido
    isDeleted?: boolean; // Soft Delete
}

export type TransactionInput = Omit<Transaction, 'id'>;

export enum DocumentStatus {
    Draft = 'draft',
    Sent = 'sent',
    Paid = 'paid',
    Overdue = 'overdue',
    Cancelled = 'cancelled',
    Converted = 'converted',
}

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
    notes?: string;
}

export interface Installment {
    description: string;
    amount: number;
    dueDate: string;
    isPaid: boolean;
}

interface DocumentBase {
    id: string;
    clientId: string;
    clientName: string;
    issueDate: string;
    items: DocumentItem[];
    totalAmount: number;
    status: DocumentStatus;
    notes?: string;
    paymentMethod?: PaymentMethod;
    installments?: Installment[];
    hasStampDuty?: boolean;
    isDeleted?: boolean; // Soft Delete
}

export interface Invoice extends DocumentBase {
    invoiceNumber: string;
    dueDate: string;
    sdiCode?: string;
    isProForma?: boolean;
    relatedQuoteNumber?: string;
}

export interface Quote extends DocumentBase {
    quoteNumber: string;
    expiryDate: string;
}

export type InvoiceInput = Omit<Invoice, 'id'>;
export type QuoteInput = Omit<Quote, 'id'>;

// --- Settings / Checks ---
export enum CheckCategory {
    Payments = 'Pagamenti',
    Documents = 'Documenti',
    Materials = 'Materiali',
    Maintenance = 'Manutenzione',
    Appointments = 'Appuntamenti',
}

export enum AppointmentType {
    Generic = 'Generico',
    Lesson = 'Lezione',
    Meeting = 'Riunione',
}

export interface PeriodicCheck {
    id: string;
    category: CheckCategory;
    subCategory?: AppointmentType | string | null;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    pushEnabled: boolean;
    note?: string;
}

export type PeriodicCheckInput = Omit<PeriodicCheck, 'id'>;