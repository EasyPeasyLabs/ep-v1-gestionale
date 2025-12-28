
export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings' | 'Profile' | 'LoginPage' | 'Calendar' | 'CRM' | 'Enrollments' | 'Attendance' | 'AttendanceArchive' | 'Activities' | 'ActivityLog' | 'Homeworks' | 'Initiatives';

export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
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
    rating?: ChildRating;
}

export interface Client {
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
    isDeleted?: boolean;
}

export interface ParentClient extends Client {
    clientType: ClientType.Parent;
    firstName: string;
    lastName: string;
    taxCode: string;
    children: Child[];
    rating?: ParentRating;
}

export interface InstitutionalClient extends Client {
    clientType: ClientType.Institutional;
    companyName: string;
    vatNumber: string;
    numberOfChildren: number;
    ageRange: string;
}

export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
// Specific inputs for import service
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

export interface AvailabilitySlot {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

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

export interface Location {
    id: string;
    name: string;
    address?: string;
    city?: string;
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

export type LocationInput = Omit<Location, 'id'> & { id?: string }; // id optional for new locations in form

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
    isDeleted: boolean;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    rating?: SupplierRating;
}

export type SupplierInput = Omit<Supplier, 'id'>;

export enum EnrollmentStatus {
    Pending = 'Pending',
    Active = 'Active',
    Completed = 'Completed',
    Expired = 'Expired'
}

export type AppointmentStatus = 'Scheduled' | 'Present' | 'Absent';

export interface Appointment {
    lessonId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId?: string;
    locationName: string;
    locationColor: string;
    childName: string; // Denormalized for calendar
    status: AppointmentStatus;
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
    appointments: Appointment[];
    lessonsTotal: number;
    lessonsRemaining: number;
    startDate: string; // ISO
    endDate: string; // ISO
    status: EnrollmentStatus;
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

export interface LessonAttendee {
    clientId: string;
    childId: string;
    childName: string;
}

export interface Lesson {
    id: string;
    date: string; // ISO
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    description?: string;
    // Legacy fields (single student)
    clientId?: string;
    childName?: string;
    // New field (multiple students)
    attendees?: LessonAttendee[];
}

export type LessonInput = Omit<Lesson, 'id'>;

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
    Cash = 'Contanti',
    BankTransfer = 'Bonifico',
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
    date: string; // ISO
    description: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod;
    status: TransactionStatus;
    allocationType?: 'location' | 'general';
    allocationId?: string;
    allocationName?: string;
    relatedDocumentId?: string; // ID fattura o altro doc
    clientName?: string; // Optional for filtering
    isDeleted: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export enum DocumentStatus {
    Draft = 'Draft',
    Sent = 'Sent',
    Paid = 'Paid',
    Overdue = 'Overdue',
    PendingSDI = 'PendingSDI',
    SealedSDI = 'SealedSDI'
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

export interface Invoice {
    id: string;
    invoiceNumber: string;
    clientId: string;
    clientName: string;
    issueDate: string; // ISO
    dueDate: string; // ISO
    status: DocumentStatus;
    paymentMethod: PaymentMethod;
    items: DocumentItem[];
    totalAmount: number;
    hasStampDuty: boolean;
    isGhost: boolean; // Fattura fantasma (pro-forma interna)
    sdiId?: string; // ID SDI
    sdiCode?: string; // Codice destinatario
    notes?: string;
    installments?: Installment[];
    isDeleted: boolean;
    isProForma?: boolean;
    relatedQuoteNumber?: string;
    promotionHistory?: {
        originalGhostNumber: string;
        promotedAt: string;
    };
}

export type InvoiceInput = Omit<Invoice, 'id'>;

export interface Quote {
    id: string;
    quoteNumber: string;
    clientId: string;
    clientName: string;
    issueDate: string;
    expiryDate: string;
    status: DocumentStatus;
    items: DocumentItem[];
    totalAmount: number;
    notes?: string;
    paymentMethod?: PaymentMethod; // Optional in quote
    installments?: Installment[];
    isDeleted: boolean;
}

export type QuoteInput = Omit<Quote, 'id'>;

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
    validDate?: string; // Date for obsolete or future
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
    Payments = 'Pagamenti',
    Tax = 'Fisco',
    Maintenance = 'Manutenzione',
    Safety = 'Sicurezza',
    Other = 'Altro'
}

export interface PeriodicCheck {
    id: string;
    category: CheckCategory;
    subCategory: string;
    daysOfWeek: number[]; // 0-6
    startTime: string; // HH:mm
    endTime: string; // HH:mm (not used for notif logic but present)
    pushEnabled: boolean;
    note: string;
}

export type PeriodicCheckInput = Omit<PeriodicCheck, 'id'>;

export interface Notification {
    id: string;
    type: 'expiry' | 'low_lessons' | 'payment_required' | 'action_required' | 'balance_due' | 'sdi_deadline' | 'accountant_send';
    message: string;
    clientId?: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

export interface Activity {
    id: string;
    title: string;
    category: string; // e.g. Motoria, Creativa
    theme: string; // e.g. Halloween
    description: string;
    materials: string;
    links: string;
    attachments: string[]; // URLs
    createdAt: string;
}

export type ActivityInput = Omit<Activity, 'id'>;

export interface LessonActivity {
    id: string;
    lessonId: string;
    activityIds: string[];
    date: string;
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
    type: 'client' | 'supplier';
}

export interface Campaign {
    id: string;
    name: string;
    channel: 'email' | 'whatsapp';
    subject: string;
    message: string;
    mediaLinks: string;
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
    assignedDate?: string; // Optional assignment to a lesson date
    assignedLocationId?: string; // Optional assignment to a class/location
    assignedLocationName?: string;
    createdAt: string;
}

export type HomeworkInput = Omit<Homework, 'id'>;

export interface AuditLog {
    id: string;
    timestamp: string;
    userEmail: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT' | 'LOGIN';
    entity: 'CLIENT' | 'ENROLLMENT' | 'INVOICE' | 'TRANSACTION' | 'SETTINGS';
    entityId: string;
    details: string;
}
