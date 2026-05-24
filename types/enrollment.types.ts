import { ClientType } from './client.types';
import { PaymentMethod } from './invoice.types';
import { Appointment } from './attendance.types';

export enum EnrollmentStatus {
    Pending = 'Pending',
    Active = 'Active',
    Completed = 'Completed',
    Expired = 'Expired'
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
    lessonsUsed?: number;
    courseId?: string; // New: link to Course document
    isRenewal?: boolean;
    previousEnrollmentId?: string;
    /**
     * @deprecated Cache di sola lettura. Fonte di verità: lesson.attendees[].
     */
    appointments?: Appointment[];
    lessonsTotal: number;
    lessonsRemaining: number;
    labCount?: number;
    sgCount?: number;
    evtCount?: number;
    readCount?: number;
    labRemaining?: number;
    sgRemaining?: number;
    evtRemaining?: number;
    readRemaining?: number;
    labUsed?: number;
    sgUsed?: number;
    evtUsed?: number;
    readUsed?: number;
    startDate: string;
    endDate: string;
    status: EnrollmentStatus;
    preferredPaymentMethod?: PaymentMethod;
    adjustmentAmount?: number;
    adjustmentNotes?: string;
    isQuoteBased?: boolean;
    relatedQuoteId?: string;
    masterEnrollmentId?: string;
    createdAt?: string;
}

export type EnrollmentInput = Omit<Enrollment, 'id'>;

import { Invoice } from './invoice.types';
import { Transaction } from './finance.types';
import { Client } from './client.types';
import { Supplier } from './supplier.types';

export interface AdvancedEnrollmentExportData {
    enrollment: Enrollment;
    client?: Client;
    supplier?: Supplier;
    invoices: Invoice[];
    transactions: Transaction[];
}
