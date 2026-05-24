import { DocumentStatus, DocumentItem, Installment } from './invoice.types';

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
