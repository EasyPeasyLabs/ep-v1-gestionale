export enum DocumentStatus {
    Draft = 'Draft',
    Sent = 'Sent',
    Paid = 'Paid',
    Overdue = 'Overdue',
    PendingSDI = 'PendingSDI',
    SealedSDI = 'SealedSDI',
    Cancelled = 'cancelled'
}

export enum PaymentMethod {
    BankTransfer = 'Bonifico',
    Cash = 'Contanti',
    CreditCard = 'Carta di Credito',
    PayPal = 'PayPal',
    Check = 'Assegno',
    Other = 'Altro'
}

export interface DocumentItem {
    description: string;
    quantity: number;
    price: number;
    notes?: string;
    discount?: number;
    discountType?: 'percent' | 'amount';
}

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
    paymentMethod?: PaymentMethod | string;
    installments?: Installment[];
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

export interface InvoiceGap {
    number: number;
    prevDate?: string;
    nextDate?: string;
    recommended?: boolean;
}

import { Transaction } from './finance.types';

export interface IntegrityIssueSuggestion {
    type?: 'smart_link' | 'manual' | 'oblivion';
    label?: string;
    reason?: string;
    payload?: {
        transactionId?: string;
        transactionIds?: string[]; // For cumulative matches
        invoiceId?: string;
        fiscalYearId?: string;
    };
    transactionDetails?: Transaction;
    multipleTransactions?: Transaction[]; // For cumulative matches
    invoices?: Invoice[];
    isPerfect?: boolean;
    gap?: number;
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
    enrollmentId?: string;
    ghostId?: string;
    suggestions?: IntegrityIssueSuggestion[];
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

export interface GhostPromotionFilter {
    parentName?: string;
    amount?: number;
    dateFrom?: string;
    dateTo?: string;
    enrollmentId?: string;
}

export interface GhostPromotionCandidate {
    ghost: Invoice;
    realInvoice: Invoice | null;
    matchReason: string;
}
