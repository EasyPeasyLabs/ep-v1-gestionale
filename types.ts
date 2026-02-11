
export type Page = 'Dashboard' | 'Clients' | 'Suppliers' | 'Finance' | 'Settings' | 'NotificationPlanning' | 'Profile' | 'Calendar' | 'CRM' | 'Enrollments' | 'EnrollmentArchive' | 'Attendance' | 'AttendanceArchive' | 'Activities' | 'ActivityLog' | 'Homeworks' | 'Initiatives' | 'Manual' | 'ClientSituation';

export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
}

export interface Client {
    id: string;
    clientType: ClientType;
    email: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    zipCode: string;
    notesHistory: Note[];
    tags: string[];
    isDeleted?: boolean;
}

export interface ParentClient extends Client {
    firstName: string;
    lastName: string;
    taxCode: string;
    children: Child[];
    rating: ParentRating;
}

export interface InstitutionalClient extends Client {
    companyName: string;
    vatNumber: string;
    numberOfChildren: number;
    ageRange: string;
}

export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

export interface Child {
    id: string;
    name: string;
    age: string;
    dateOfBirth?: string;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    rating: ChildRating;
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
    rating: SupplierRating;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    isDeleted: boolean;
}

export type SupplierInput = Omit<Supplier, 'id'>;

export interface Location {
    id: string;
    name: string;
    address?: string;
    city?: string;
    color: string;
    capacity?: number;
    rentalCost?: number;
    distance?: number;
    closedAt?: string;
    availability?: AvailabilitySlot[];
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
    rating?: LocationRating;
}

export type LocationInput = Omit<Location, 'id'>;

export interface AvailabilitySlot {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

export interface SupplierRating {
    responsiveness: number;
    partnership: number;
    negotiation: number;
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

export enum TransactionType {
    Income = 'income',
    Expense = 'expense'
}

export enum TransactionCategory {
    Materiali = 'Materiali',
    Nolo = 'Nolo',
    RCA = 'RCA',
    BolloAuto = 'Bollo Auto',
    ManutenzioneAuto = 'Manutenzione Auto',
    ConsumoAuto = 'Consumo Auto',
    Carburante = 'Carburante',
    Parcheggio = 'Parcheggio',
    Sanzioni = 'Sanzioni',
    BigliettoViaggio = 'Biglietto Viaggio',
    Consulenze = 'Consulenze/Commercialista',
    Tasse = 'Tasse/Bollo',
    SpeseBancarie = 'Spese Bancarie',
    InternetTelefonia = 'Internet e telefonia',
    Software = 'Licenze Software',
    HardwareGenerale = 'Hardware Ufficio',
    Formazione = 'Formazione',
    Vendite = 'Vendite/Incassi',
    Capitale = 'Capitale/Versamenti',
    QuoteAssociative = 'Quote Associative',
    AttrezzatureSede = 'Attrezzature Sede',
    IgieneSicurezza = 'Igiene e Sicurezza',
    Libri = 'Libri',
    HardwareSoftwareCorsi = 'Hardware/Software Didattico',
    Stampa = 'Stampa',
    Social = 'Social',
    Altro = 'Altro'
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico',
    Cash = 'Contanti',
    CreditCard = 'Carta di Credito',
    PayPal = 'PayPal',
    Check = 'Assegno',
    Other = 'Altro'
}

export enum TransactionStatus {
    Completed = 'completed',
    Pending = 'pending',
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
    allocationType?: 'location' | 'general';
    allocationId?: string;
    allocationName?: string;
    relatedDocumentId?: string; // invoice or quote id
    relatedEnrollmentId?: string;
    clientName?: string; // Denormalized
    isDeleted: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export enum DocumentStatus {
    Draft = 'Draft',
    Sent = 'Sent',
    Paid = 'Paid',
    Overdue = 'Overdue',
    PendingSDI = 'PendingSDI',
    SealedSDI = 'SealedSDI',
    Cancelled = 'cancelled'
}

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
    paymentMethod?: PaymentMethod;
    hasStampDuty?: boolean;
    globalDiscount?: number;
    globalDiscountType?: 'percent' | 'amount';
    isGhost: boolean;
    isDeleted: boolean;
    sdiId?: string;
    sdiCode?: string; // alias
    notes?: string;
    relatedEnrollmentId?: string;
    relatedQuoteNumber?: string;
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
    // New Fields for Dynamic Billing
    triggerType?: 'date' | 'lesson_number';
    triggerLessonIndex?: number;
    paymentTermDays?: number;
    collectionDate?: string; // Calculated: dueDate + terms
    hasStampDuty?: boolean;
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
    globalDiscount?: number;
    globalDiscountType?: 'percent' | 'amount';
    hasStampDuty?: boolean;
}

export type QuoteInput = Omit<Quote, 'id'>;

export interface CompanyInfo {
    id: string;
    denomination: string;
    name: string;
    vatNumber: string;
    address: string;
    city: string;
    province: string;
    zipCode: string;
    email: string;
    phone: string;
    logoBase64: string;
    carFuelConsumption: number;
    averageFuelPrice: number;
    iban: string;
    paypal: string;
    satispay: string;
    googlePay: string;
    klarna: string;
    currentBankBalance?: number; // Nuovo campo per saldo reale C/C
}

export interface SubscriptionStatusConfig {
    status: SubscriptionStatusType;
    validDate?: string;
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
    targetLocationIds?: string[];
    targetClientIds?: string[];
}

export type SubscriptionStatusType = 'active' | 'obsolete' | 'future' | 'promo';

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
    category: string;
    content: string;
}

export enum CheckCategory {
    Payments = 'Payments',
    Operations = 'Operations',
    Maintenance = 'Maintenance',
    Compliance = 'Compliance'
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

export interface NotificationRule {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    days: number[]; // 0-6
    time: string; // HH:mm
    pushEnabled: boolean;
    isCustom?: boolean;
}

export type NotificationType = 'payment_required' | 'expiry' | 'balance_due' | 'low_lessons' | 'institutional_billing' | 'sdi_deadline' | 'action_required' | 'invoice_emission' | 'payment_collection';

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    clientId: string;
    date: string;
    linkPage?: string;
    filterContext?: any;
}

export enum EnrollmentStatus {
    Pending = 'Pending',
    Active = 'Active',
    Completed = 'Completed',
    Expired = 'Expired'
}

export enum AppointmentStatus {
    Scheduled = 'Scheduled',
    Present = 'Present',
    Absent = 'Absent',
    Suspended = 'Suspended'
}

export interface Appointment {
    lessonId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    childName: string;
    status: AppointmentStatus | string;
}

export interface Enrollment {
    id: string;
    clientId: string;
    clientType: ClientType;
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
    startDate: string;
    endDate: string;
    status: EnrollmentStatus;
    preferredPaymentMethod?: PaymentMethod;
    adjustmentAmount?: number;
    adjustmentNotes?: string;
    isQuoteBased?: boolean;
    relatedQuoteId?: string;
    createdAt?: string;
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

export interface LessonAttendee {
    clientId: string;
    childId: string;
    childName: string;
    enrollmentId?: string;
}

export interface Lesson {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationColor: string;
    description: string;
    childName?: string; // Legacy
    clientId?: string; // Legacy
    attendees?: LessonAttendee[];
}

export type LessonInput = Omit<Lesson, 'id'>;

export interface SchoolClosure {
    id: string;
    date: string;
    reason: string;
    createdAt: string;
}

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

export interface FocusConfig {
    enabled: boolean;
    days: number[];
    time: string;
}

export interface UserPreferences {
    focusConfig?: FocusConfig;
    lastFocusDate?: string;
    dismissedNotificationIds?: string[]; // IDs of notifications marked as read/done
}

export interface FiscalYear {
    id: string;
    year: number;
    status: 'OPEN' | 'CLOSED';
    closedAt?: string;
    closedBy?: string;
    snapshot?: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        taxes: number;
    };
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userEmail: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT' | 'CLOSE_YEAR';
    entity: 'INVOICE' | 'TRANSACTION' | 'QUOTE' | 'ENROLLMENT' | 'FISCAL_YEAR';
    entityId: string;
    details: string;
}

export interface IntegrityIssueSuggestion {
    transactionDetails?: Transaction;
    invoices: Invoice[];
    isPerfect: boolean;
    gap: number;
}

export interface IntegrityIssue {
    id: string;
    type: 'missing_invoice' | 'missing_transaction' | 'amount_mismatch';
    date: string;
    description: string;
    entityName: string;
    parentName?: string;
    subscriptionName?: string;
    lessonsTotal?: number;
    amount?: number;
    suggestions?: IntegrityIssueSuggestion[];
}

export interface InvoiceGap {
    number: number;
    prevDate?: string;
    nextDate?: string;
    recommended?: boolean;
}

export interface RentAnalysisResult {
    locationId: string;
    locationName: string;
    supplierName: string;
    usageCount: number;
    unitCost: number;
    totalCost: number;
    isPaid: boolean;
}
