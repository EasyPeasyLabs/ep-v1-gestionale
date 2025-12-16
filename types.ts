
export interface Note {
    id: string;
    date: string;
    content: string;
}

export interface Rating {
    [key: string]: number;
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

export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
}

export interface BaseClient {
    id: string;
    email: string;
    phone: string;
    address: string;
    zipCode: string;
    city: string;
    province: string;
    notesHistory: Note[];
    tags: string[];
    clientType: ClientType;
    isDeleted?: boolean;
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

export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

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
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
    rating?: LocationRating;
}

export type LocationInput = Omit<Location, 'id'> & { id?: string };

export interface SupplierRating {
    responsiveness: number;
    partnership: number;
    negotiation: number;
}

export interface Supplier {
    id: string;
    companyName: string;
    vatNumber: string;
    address: string;
    zipCode: string;
    city: string;
    province: string;
    email: string;
    phone: string;
    locations: Location[];
    rating: SupplierRating;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    isDeleted?: boolean;
}

export type SupplierInput = Omit<Supplier, 'id'>;

export enum EnrollmentStatus {
    Pending = 'pending',
    Active = 'active',
    Completed = 'completed',
    Expired = 'expired'
}

export enum AppointmentStatus {
    Scheduled = 'Scheduled',
    Present = 'Present',
    Absent = 'Absent'
}

export interface Appointment {
    lessonId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId?: string; // Added for historical tracking of rent costs
    locationName: string;
    locationColor: string;
    childName: string;
    status: AppointmentStatus | string;
}

export interface Enrollment {
    id: string;
    clientId: string;
    childId: string;
    childName: string;
    isAdult: boolean;
    subscriptionTypeId: string;
    subscriptionName: string;
    price: number;
    supplierId: string;
    supplierName: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    lessonsTotal: number;
    lessonsRemaining: number;
    startDate: string;
    endDate: string;
    status: EnrollmentStatus;
    appointments: Appointment[];
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

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
    statusConfig: SubscriptionStatusConfig;
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
    Payments = 'Payments',
    Administrative = 'Administrative',
    Maintenance = 'Maintenance',
    Other = 'Other'
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

export enum TransactionType {
    Income = 'income',
    Expense = 'expense'
}

export enum TransactionCategory {
    Sales = 'Sales',
    Rent = 'Rent',
    Taxes = 'Taxes',
    Fuel = 'Fuel',
    Materials = 'Materials',
    ProfessionalServices = 'ProfessionalServices',
    Software = 'Software',
    Marketing = 'Marketing',
    Capital = 'Capital',
    Other = 'Other'
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico',
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
    allocationType?: 'location' | 'general';
    allocationId?: string;
    allocationName?: string;
    excludeFromStats?: boolean;
    clientName?: string;
    isDeleted?: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export enum DocumentStatus {
    Draft = 'Draft',
    Sent = 'Sent',
    Paid = 'Paid',
    Overdue = 'Overdue',
    PendingSDI = 'PendingSDI',
    SealedSDI = 'SealedSDI',
    Void = 'Void'
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

export interface BaseDocument {
    id: string;
    clientId: string;
    clientName: string;
    issueDate: string;
    items: DocumentItem[];
    totalAmount: number;
    notes?: string;
    status: DocumentStatus;
    isDeleted?: boolean;
}

export interface Invoice extends BaseDocument {
    invoiceNumber: string;
    dueDate: string;
    paymentMethod: PaymentMethod;
    hasStampDuty: boolean;
    sdiCode?: string;
    sdiId?: string;
    isProForma?: boolean;
    relatedQuoteNumber?: string;
    isGhost?: boolean; // True if it's a provisional ghost invoice
    promotionHistory?: {
        originalGhostNumber: string;
        promotedAt: string;
    };
    installments?: Installment[];
}

export type InvoiceInput = Omit<Invoice, 'id'>;

export interface Quote extends BaseDocument {
    quoteNumber: string;
    expiryDate: string;
    paymentMethod?: PaymentMethod;
    installments?: Installment[];
}

export type QuoteInput = Omit<Quote, 'id'>;

export interface Notification {
    id: string;
    type: 'payment_required' | 'expiry' | 'low_lessons' | 'balance_due' | 'action_required' | 'sdi_deadline' | 'accountant_send';
    message: string;
    clientId?: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

export interface Lesson {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
}

export type LessonInput = Omit<Lesson, 'id'>;

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
    type: 'client' | 'supplier' | 'custom';
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
    returnDate?: string;
    status: 'active' | 'returned';
}

export type BookLoanInput = Omit<BookLoan, 'id'>;

// --- AUDIT TRAIL ---
export interface AuditLog {
    id: string;
    timestamp: string;
    userEmail?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT';
    entity: 'INVOICE' | 'TRANSACTION' | 'ENROLLMENT';
    entityId: string;
    details: string;
}
