
// --- Base Interfaces ---
export interface DocumentBase {
    id: string;
    clientId: string;
    clientName: string;
    issueDate: string;
    items: DocumentItem[];
    totalAmount: number;
    notes?: string;
    paymentMethod?: PaymentMethod;
    status: DocumentStatus;
    hasStampDuty?: boolean;
    installments?: Installment[];
    isDeleted?: boolean;
}

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
    notes?: string;
}

export interface Installment {
    description: string;
    dueDate: string;
    amount: number;
    isPaid: boolean;
}

// --- Enums ---
export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
}

export enum EnrollmentStatus {
    Pending = 'pending',
    Active = 'active',
    Completed = 'completed',
    Expired = 'expired'
}

export enum TransactionType {
    Income = 'income',
    Expense = 'expense'
}

export enum TransactionCategory {
    Sales = 'Vendite',
    Rent = 'Nolo Sedi',
    Taxes = 'Imposte e Tasse',
    Fuel = 'Carburante',
    Materials = 'Materiali',
    ProfessionalServices = 'Servizi Professionali',
    Software = 'Software',
    Marketing = 'Marketing',
    OtherExpense = 'Altre Spese',
    OtherIncome = 'Altri Ricavi'
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico',
    Cash = 'Contanti',
    CreditCard = 'Carta di Credito',
    PayPal = 'PayPal',
    Check = 'Assegno'
}

export enum TransactionStatus {
    Pending = 'pending',
    Completed = 'completed',
    Cancelled = 'cancelled'
}

export enum DocumentStatus {
    Draft = 'draft',
    Sent = 'sent',
    Paid = 'paid',
    Overdue = 'overdue',
    PendingSDI = 'pending_sdi',
    SealedSDI = 'sealed_sdi',
    Void = 'void'
}

// --- Financial Models ---

export interface Invoice extends DocumentBase {
    invoiceNumber: string;
    dueDate: string;
    sdiCode?: string; // Codice Destinatario (Recipient Code)
    sdiId?: string; // Numero Identificativo SDI (Transaction ID assegnato dall'AdE)
    isProForma?: boolean;
    relatedQuoteNumber?: string;
    isGhost?: boolean; // Fattura "Fantasma" per il saldo futuro
}

export interface Quote extends DocumentBase {
    quoteNumber: string;
    expiryDate: string;
}

export type InvoiceInput = Omit<Invoice, 'id'>;
export type QuoteInput = Omit<Quote, 'id'>;

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
    allocationType?: 'location' | 'project';
    allocationId?: string;
    allocationName?: string;
    isDeleted?: boolean;
    excludeFromStats?: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

// --- Clients ---

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
    rating?: ChildRating;
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
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
    isDeleted?: boolean;
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
}

export interface ParentClient extends BaseClient {
    clientType: ClientType.Parent;
    firstName: string;
    lastName: string;
    taxCode: string;
    children: Child[];
    rating?: ParentRating;
}

export interface InstitutionalClient extends BaseClient {
    clientType: ClientType.Institutional;
    companyName: string;
    vatNumber: string;
    numberOfChildren: number;
    ageRange: string;
}

export type Client = ParentClient | InstitutionalClient;
export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

// --- Suppliers & Locations ---

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
    dayOfWeek: number; // 0-6
    startTime: string; // HH:mm
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
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
    rating?: LocationRating;
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
    city: string;
    province: string;
    zipCode: string;
    locations: Location[];
    rating?: SupplierRating;
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
    isDeleted?: boolean;
}

export type SupplierInput = Omit<Supplier, 'id'>;

// --- Enrollment & Calendar ---

export type AppointmentStatus = 'Scheduled' | 'Present' | 'Absent';

export interface Appointment {
    lessonId: string;
    date: string; // ISO
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    childName: string;
    status: AppointmentStatus;
}

export interface Enrollment {
    id: string;
    clientId: string;
    childId: string;
    childName: string;
    isAdult?: boolean;
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
    startDate: string; // ISO
    endDate: string; // ISO
    status: EnrollmentStatus;
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

export interface Lesson {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor?: string;
    // Manual lessons might not have enrollment/child
    title?: string;
}

export type LessonInput = Omit<Lesson, 'id'>;

// --- Settings ---

export interface CompanyInfo {
    id: string;
    denomination: string;
    name: string;
    vatNumber: string;
    address: string;
    email: string;
    phone: string;
    logoBase64: string;
    carFuelConsumption?: number;
}

export interface SubscriptionType {
    id: string;
    name: string;
    price: number;
    lessons: number;
    durationInDays: number;
    target?: 'kid' | 'adult';
}

export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;

export interface CommunicationTemplate {
    id: string;
    label: string;
    subject: string;
    body: string;
    signature: string;
}

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

export interface RecoveryPolicy {
    policies: Record<string, 'allowed' | 'forbidden'>;
}

// --- Notifications ---

export interface Notification {
    id: string;
    type: 'expiry' | 'low_lessons' | 'payment_required' | 'action_required' | 'balance_due' | 'sdi_deadline' | 'accountant_send';
    message: string;
    clientId?: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

// --- CRM ---

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
    type: 'client' | 'supplier';
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
    repeatCount?: number;
    status: 'active' | 'completed' | 'paused' | 'draft';
    sentCount: number;
    nextRun: string;
}

export type CampaignInput = Omit<Campaign, 'id'>;

// --- Activities & Homework ---

export interface Activity {
    id: string;
    title: string;
    category: string;
    theme?: string;
    description: string;
    materials?: string;
    links?: string;
    attachments?: string[];
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
    description?: string;
    type: 'textbook' | 'link';
    textbookName?: string;
    pageNumber?: string;
    exercises?: string;
    linkUrl?: string;
    expectedOutcome?: string;
    assignedDate?: string;
    assignedLocationId?: string;
    assignedLocationName?: string;
    createdAt: string;
}

export type HomeworkInput = Omit<Homework, 'id'>;

// --- Initiatives & Library ---

export interface Initiative {
    id: string;
    name: string;
    description: string;
    type: 'standard' | 'peek-a-book';
    materials?: string;
    targetLocationIds?: string[];
    targetLocationNames?: string[];
}

export type InitiativeInput = Omit<Initiative, 'id'>;

export interface Book {
    id: string;
    title: string;
    author?: string;
    isbn?: string;
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
    returnDate?: string;
    status: 'active' | 'returned';
}

export type BookLoanInput = Omit<BookLoan, 'id'>;
