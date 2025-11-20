
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

export interface CompanyInfo {
    id: string;
    denomination?: string; // Denominazione (es. Brand name)
    name: string; // Ragione Sociale
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

// --- Registro Attività (Libreria) ---
export interface Activity {
    id: string;
    title: string;
    category: string;
    theme: string; // Filo conduttore
    description: string;
    materials: string;
    links: string;
    createdAt: string; // ISO String
}

// --- Registro Attività (Storico/Log) ---
export interface LessonActivity {
    id: string;
    lessonId: string; // Link all'appointment.lessonId
    activityIds: string[]; // Array di ID attività svolte
    date: string; // Denormalizzato per query facili
    note?: string; // Eventuali note specifiche per quella lezione
}

// --- Finanza ---

export enum TransactionType {
    Income = 'income',
    Expense = 'expense',
}

export enum TransactionStatus {
    Pending = 'pending',     // Addebitato ma non ancora pagato (es. Nolo calcolato)
    Completed = 'completed', // Pagamento effettuato/Incassato
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
    status: TransactionStatus; // Nuovo campo per gestire "Addebitato" vs "Pagato"
    relatedDocumentId?: string; // Es. id iscrizione o fattura
}

export enum DocumentStatus {
    Draft = 'Bozza',
    Sent = 'Inviato',
    Paid = 'Pagato',
    Overdue = 'Scaduto',
    Cancelled = 'Annullato',
    Converted = 'Convertito',
}

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
    notes?: string; // Note specifiche per la riga
}

export interface Installment {
    amount: number;
    dueDate: string; // ISO String
    description: string; // es. "Acconto", "Saldo"
    isPaid: boolean;
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
    isProForma: boolean;
    sdiCode?: string; // Codice SDI Agenzia Entrate
    paymentMethod?: PaymentMethod;
    installments?: Installment[];
    hasStampDuty?: boolean; // Se ha bollo virtuale > 77€
    notes?: string; // Note generali documento (box in fondo)
    relatedQuoteNumber?: string; // Riferimento al preventivo di origine
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
    paymentMethod?: PaymentMethod;
    installments?: Installment[]; // Piano rateale proposto
    hasStampDuty?: boolean;
    notes?: string; // Note generali documento (box in fondo)
}

// --- Notifiche ---
export interface Notification {
  id: string; 
  type: 'expiry' | 'low_lessons' | 'payment_required' | 'action_required';
  message: string;
  clientId?: string; // Opzionale perché non tutte le notifiche sono legate a un cliente
  date: string; // ISO string
  linkPage?: string; // Opzionale: pagina di destinazione al click
  filterContext?: any; // Dati per pre-filtrare la pagina di destinazione
}

// --- Verifiche Periodiche (Planner) ---
export enum CheckCategory {
    Payments = 'Scadenze Pagamenti',
    Enrollments = 'Scadenze Iscrizioni',
    Transactions = 'Registrazione Transazioni',
    Documents = 'Preventivi e Fatture',
    Materials = 'Restituzione Materiali (Peek-a-Boo)',
    Appointments = 'Appuntamenti'
}

export enum AppointmentType {
    NewClient = 'Nuovi Potenziali Clienti',
    NewSupplier = 'Nuovi Fornitori',
    Accountant = 'Commercialista',
    Generic = 'Generico'
}

export interface PeriodicCheck {
    id: string;
    category: CheckCategory;
    subCategory?: AppointmentType; // Opzionale, usato solo se category è Appointments
    daysOfWeek: number[]; // 0=Domenica, 1=Lunedì... Array di giorni selezionati
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    pushEnabled: boolean;
    note?: string;
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
export type ActivityInput = Omit<Activity, 'id'>;

export type TransactionInput = Omit<Transaction, 'id'>;
export type InvoiceInput = Omit<Invoice, 'id'>;
export type QuoteInput = Omit<Quote, 'id'>;
export type PeriodicCheckInput = Omit<PeriodicCheck, 'id'>;
