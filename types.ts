
export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings' | 'Profile' | 'LoginPage' | 'Calendar' | 'CRM' | 'Enrollments' | 'EnrollmentArchive' | 'Attendance' | 'AttendanceArchive' | 'Activities' | 'ActivityLog' | 'Homeworks' | 'Initiatives' | 'Manual';

export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
}

export enum TransactionType {
    Income = 'income',
    Expense = 'expense'
}

// NUOVA GERARCHIA CATEGORIE
export enum TransactionCategory {
    // A. LOGISTICA
    // 1. Costi Amministrativi
    RCA = 'RCA',
    BolloAuto = 'Bollo Auto',
    // 2. Costi Operativi
    ManutenzioneAuto = 'Manutenzione Auto',
    ConsumoAuto = 'Consumo Auto', // Usura
    Carburante = 'Carburante',
    Parcheggio = 'Parcheggio',
    Sanzioni = 'Sanzioni',
    BigliettoViaggio = 'Biglietto Viaggio',

    // B. GENERALI
    // 1. Costi Amministrativi
    Consulenze = 'Consulenze/Commercialista',
    Tasse = 'Tasse/Bollo',
    SpeseBancarie = 'Spese Bancarie',
    // 2. Costi Operativi
    InternetTelefonia = 'Internet e telefonia', // Unificato (Fibra + SIM)
    Formazione = 'Formazione', // Nuova voce
    Software = 'Licenze Software',
    HardwareGenerale = 'Hardware Ufficio',
    // 3. Ricavi Operativi (Income)
    Vendite = 'Vendite/Incassi',
    Capitale = 'Capitale/Versamenti',

    // C. OPERAZIONI
    // 1. Costi Sedi
    Nolo = 'Nolo',
    QuoteAssociative = 'Quote Associative',
    AttrezzatureSede = 'Attrezzature Sede',
    IgieneSicurezza = 'Igiene e Sicurezza',
    // 2. Costi Corsi
    Materiali = 'Materiali/Cancelleria',
    Libri = 'Libri',
    HardwareSoftwareCorsi = 'Hardware/Software Didattico',
    // 3. Costi Marketing
    Stampa = 'Stampa',
    Social = 'Social',
    
    // Fallback
    Altro = 'Altro'
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico Bancario',
    Cash = 'Contanti',
    CreditCard = 'Carta di Credito',
    PayPal = 'PayPal',
    Other = 'Altro'
}

export enum TransactionStatus {
    Pending = 'pending',
    Completed = 'completed',
    Cancelled = 'cancelled'
}

export enum DocumentStatus {
    Draft = 'Draft',
    Sent = 'Sent',
    Paid = 'Paid',
    Overdue = 'Overdue',
    PendingSDI = 'PendingSDI',
    SealedSDI = 'SealedSDI'
}

export enum EnrollmentStatus {
    Pending = 'Pending',
    Active = 'Active',
    Completed = 'Completed',
    Expired = 'Expired'
}

export enum CheckCategory {
    Payments = 'Payments',
    Communications = 'Communications',
    Maintenance = 'Maintenance',
    Deadlines = 'Deadlines',
    Other = 'Other'
}

export interface IntegrityIssueSuggestion {
    invoices: Invoice[];
    isPerfect: boolean;
    gap: number;
    transactionDetails?: Transaction; // Supporto per transazioni orfane
}

export interface IntegrityIssue {
    id: string;
    type: 'missing_invoice' | 'missing_transaction';
    severity: 'high' | 'medium';
    description: string;
    entityId: string; // ID dell'entità sorgente (es. Iscrizione o Fattura)
    entityName: string; // Nome bambino
    parentName?: string; // Nome genitore
    subscriptionName?: string; // Nome pacchetto
    amount: number;
    date: string; // Data inizio iscrizione o data fattura
    endDate?: string;
    lessonsTotal?: number;
    paymentMethod?: string;
    createdAt?: string;
    suggestions?: IntegrityIssueSuggestion[]; // UPDATED: Supporto per Fuzzy/Cluster Match
    details?: any; // Dati tecnici per il fix automatico
}

export interface Note {
    id: string;
    date: string;
    content: string;
}

export interface ParentRating {
    availability: number;
    complaints: number;
    churnRate: number;
    distance: number;
}

export interface ChildRating {
    learning: number;
    behavior: number;
    attendance: number;
    hygiene: number;
}

export interface Child {
    id: string;
    name: string;
    age: string;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    rating: ChildRating;
}

export interface BaseClient {
    id: string;
    email: string;
    phone: string;
    address: string;
    zipCode: string;
    city: string;
    province: string;
    clientType: ClientType;
    notesHistory: Note[];
    tags: string[];
    isDeleted: boolean;
}

export interface ParentClient extends BaseClient {
    firstName: string;
    lastName: string;
    taxCode: string;
    children: Child[];
    rating: ParentRating;
}

export interface InstitutionalClient extends BaseClient {
    companyName: string;
    vatNumber: string;
    numberOfChildren: number;
    ageRange: string;
}

export type Client = ParentClient | InstitutionalClient;
export type ClientInput = Omit<ParentClient, 'id' | 'isDeleted'> | Omit<InstitutionalClient, 'id' | 'isDeleted'>;
export type ParentClientInput = Omit<ParentClient, 'id' | 'isDeleted'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id' | 'isDeleted'>;

export interface LocationRating {
    cost: number;
    distance: number;
    parking: number;
    availability: number;
    safety: number;
    environment: number;
    distractions: number;
    modifiability: number;
    prestige: number;
}

export interface AvailabilitySlot {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

export interface Location {
    id: string;
    name: string;
    address: string;
    city: string;
    capacity: number;
    rentalCost: number;
    distance: number;
    color: string;
    availability: AvailabilitySlot[];
    notes: string;
    notesHistory: Note[];
    tags: string[];
    rating: LocationRating;
    closedAt?: string; // Data di chiusura/dismissione (ISO String YYYY-MM-DD)
}

export type LocationInput = Omit<Location, 'id'>;

export interface SupplierRating {
    responsiveness: number;
    partnership: number;
    negotiation: number;
}

export interface Supplier {
    id: string;
    companyName: string;
    vatNumber: string;
    email: string;
    phone: string;
    address: string;
    zipCode: string;
    city: string;
    province: string;
    locations: Location[];
    rating: SupplierRating;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    isDeleted: boolean;
}

export type SupplierInput = Omit<Supplier, 'id'>;

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod;
    status: TransactionStatus;
    allocationType?: 'location' | 'general';
    allocationId?: string;
    allocationName?: string;
    relatedDocumentId?: string;
    relatedEnrollmentId?: string; // NEW
    clientName?: string;
    isDeleted: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
    notes?: string;
    discount?: number;
    discountType?: 'percent' | 'amount';
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    clientId: string;
    clientName: string;
    items: DocumentItem[];
    totalAmount: number;
    status: DocumentStatus;
    paymentMethod: PaymentMethod;
    hasStampDuty: boolean;
    sdiId?: string;
    sdiCode?: string;
    isGhost: boolean;
    notes?: string;
    isDeleted: boolean;
    relatedQuoteNumber?: string;
    relatedEnrollmentId?: string; // NEW
    globalDiscount?: number;
    globalDiscountType?: 'percent' | 'amount';
    promotionHistory?: {
        originalGhostNumber: string;
        promotedAt: string;
    };
}

export type InvoiceInput = Omit<Invoice, 'id'>;

export interface Installment {
    description: string;
    dueDate: string;
    amount: number;
    isPaid: boolean;
}

export interface Quote {
    id: string;
    quoteNumber: string;
    issueDate: string;
    expiryDate: string;
    clientId: string;
    clientName: string;
    items: DocumentItem[];
    totalAmount: number;
    installments: Installment[];
    notes?: string;
    status: DocumentStatus;
    isDeleted: boolean;
    paymentMethod?: string;
}

export type QuoteInput = Omit<Quote, 'id'>;

export type AppointmentStatus = 'Scheduled' | 'Present' | 'Absent' | 'Suspended';

export interface Appointment {
    lessonId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    childName: string;
    status: AppointmentStatus;
}

export interface Enrollment {
    id: string;
    clientId: string;
    clientType?: ClientType; // NEW: Tracciabilità tipo cliente
    childId: string;
    childName: string;
    isAdult: boolean;
    isQuoteBased?: boolean; // NEW: Progetto istituzionale
    relatedQuoteId?: string; // NEW: Rif preventivo
    subscriptionTypeId: string;
    subscriptionName: string;
    price: number;
    supplierId: string;
    supplierName: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    appointments: Appointment[];
    lessonsTotal: number;
    lessonsRemaining: number;
    startDate: string;
    endDate: string;
    status: EnrollmentStatus;
    isEarlyClosure?: boolean; // NEW: Track early terminations
    createdAt?: string; // NEW: Tracciabilità creazione
    preferredPaymentMethod?: PaymentMethod; // NEW: Tracciabilità metodo previsto
    adjustmentAmount?: number; // NEW: Gestione abbuoni fiscali
    adjustmentNotes?: string; // NEW: Nota tecnica abbuono
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

export interface LessonAttendee {
    clientId: string;
    childId: string;
    childName: string;
    enrollmentId?: string; // NEW: Collegamento diretto a iscrizione istituzionale
}

export interface Lesson {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    description: string;
    attendees: LessonAttendee[];
    // Legacy support
    clientId?: string;
    childName?: string;
}

export type LessonInput = Omit<Lesson, 'id'>;

export interface SchoolClosure {
    id: string;
    date: string; // ISO Date YYYY-MM-DD
    reason: string;
    createdAt: string;
}

export interface CompanyInfo {
    id: string;
    denomination: string;
    name: string;
    vatNumber: string;
    address: string;
    city?: string;
    province?: string;
    zipCode?: string;
    email: string;
    phone: string;
    logoBase64: string;
    carFuelConsumption: number;
    averageFuelPrice?: number;
    // carWearAndTearCost rimosso dalla logica (diventa dinamico)
    iban?: string;
    paypal?: string;
    satispay?: string;
    googlePay?: string;
    klarna?: string; 
}

export type SubscriptionStatusType = 'active' | 'obsolete' | 'future' | 'promo';

export interface SubscriptionStatusConfig {
    status: SubscriptionStatusType;
    validDate?: string;
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
    targetLocationIds?: string[];
    targetClientIds?: string[];
}

export interface SubscriptionType {
    id: string;
    name: string;
    price: number;
    lessons: number;
    durationInDays: number;
    target: 'kid' | 'adult';
    statusConfig?: SubscriptionStatusConfig;
}

export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;

export interface CommunicationTemplate {
    id: string;
    label: string;
    subject: string;
    body: string;
    signature: string;
}

export interface ContractTemplate {
    id: string;
    title: string;
    content: string;
    category?: string;
}

export interface PeriodicCheck {
    id: string;
    category: CheckCategory;
    subCategory: string;
    daysOfWeek: number[];
    startTime: string;
    endTime?: string;
    pushEnabled: boolean;
    note: string;
}

export type PeriodicCheckInput = Omit<PeriodicCheck, 'id'>;

export interface Notification {
    id: string;
    type: 'payment_required' | 'expiry' | 'low_lessons' | 'balance_due' | 'action_required' | 'sdi_deadline' | 'accountant_send' | 'institutional_billing';
    message: string;
    clientId?: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userEmail: string;
    action: string;
    entity: string;
    entityId: string;
    details: string;
}

export interface CommunicationLog {
    id: string;
    date: string;
    channel: 'email' | 'whatsapp';
    subject: string;
    message: string;
    recipients: string[];
    recipientCount: number;
    type: 'manual' | 'campaign';
}

export type CommunicationLogInput = Omit<CommunicationLog, 'id'>;

export interface CampaignRecipient {
    id: string;
    name: string;
    contact: string;
    type: 'client' | 'lead';
}

export interface Campaign {
    id: string;
    name: string;
    channel: 'email' | 'whatsapp';
    subject: string;
    message: string;
    mediaLinks?: string;
    recipients: CampaignRecipient[];
    startDate: string;
    time: string;
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    repeatCount: number;
    status: 'active' | 'completed' | 'paused';
    sentCount: number;
    nextRun: string;
}

export type CampaignInput = Omit<Campaign, 'id'>;

export interface Activity {
    id: string;
    title: string;
    category: string;
    theme: string;
    description: string;
    materials: string;
    links: string;
    attachments: string[];
    createdAt: string;
}

export type ActivityInput = Omit<Activity, 'id'>;

export interface LessonActivity {
    id: string;
    lessonId: string;
    activityIds: string[];
    date: string;
}

export interface Homework {
    id: string;
    title: string;
    description: string;
    type: 'textbook' | 'link';
    textbookName?: string;
    pageNumber?: string;
    exercises?: string;
    linkUrl?: string;
    expectedOutcome: string;
    assignedDate?: string;
    assignedLocationId?: string;
    assignedLocationName?: string;
    createdAt: string;
}

export type HomeworkInput = Omit<Homework, 'id'>;

export interface Book {
    id: string;
    title: string;
    isAvailable: boolean;
}

export type BookInput = Omit<Book, 'id'>;

export interface BookLoan {
    id: string;
    bookId: string;
    bookTitle: string;
    studentId: string;
    studentName: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    borrowDate: string;
    status: 'active' | 'returned';
    returnDate?: string;
}

export type BookLoanInput = Omit<BookLoan, 'id'>;

export interface Initiative {
    id: string;
    name: string;
    description: string;
    type: 'standard' | 'peek-a-book';
    materials: string;
    targetLocationIds: string[];
    targetLocationNames: string[];
}

export type InitiativeInput = Omit<Initiative, 'id'>;

export interface FiscalYear {
    id: string;
    year: number;
    status: 'OPEN' | 'CLOSED';
    closedAt?: string;
    closedBy?: string;
    snapshot: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        taxes: number;
    };
}
