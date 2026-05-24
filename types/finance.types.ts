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

import { PaymentMethod } from './invoice.types';

export enum TransactionStatus {
    Completed = 'completed',
    Pending = 'pending',
    Cancelled = 'cancelled'
}

export interface Transaction {
    id: string;
    transactionNumber?: number;
    date: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
    paymentMethod: PaymentMethod | string;
    status: TransactionStatus;
    allocationType?: 'location' | 'general';
    allocationId?: string;
    allocationName?: string;
    relatedDocumentId?: string; // invoice or quote id
    relatedEnrollmentId?: string;
    clientName?: string; // Denormalized
    supplierId?: string; // Ref to Supplier
    isDeleted: boolean;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export interface FinanceStats {
    cashRevenue: number;
    invoicedRevenue: number;
    expenses: number;
    monthlyData: { cash: number; invoiced: number; month: number }[];
    revenue: number;
    profit: number;
    margin: number;
    taxable: number;
    taxableNet: number;
    inps: number;
    tax: number;
    stampDutyTotal: number;
    totalLiability: number;
    totalInpsTax: number;
    totalAll: number;
    savingsSuggestion: number;
    progress: number;
}

export interface FinanceSimulatorData {
    totalTarget: number;
    tranche1: number;
    tranche2: number;
    savingsPlan: { amount: number }[];
}

export interface ReverseEngineering {
    targetMonthlyNet: number;
    currentNetSalary: number;
    grossNeeded: number;
    currentAvgPrice: number;
    recommendedPrice: number;
    studentsNeededTotal: number;
    studentsNeeded: number;
    bestSubscription: { name: string; roi: number } | null;
}

export interface LocationROI {
    name: string;
    color: string;
    revenue: number;
    costs: number;
    breakdown: {
        rent: { total: number; current: number };
        operational: number;
        logistics: number;
        overhead: number;
    };
    costPerLesson: { value: number; min: number; max: number; avg: number };
    costPerStudentPerLesson: number;
    costPerStudent: number;
    studentBasedCosts: number;
    isAccountant?: boolean;
    globalRevenue?: number;
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

export interface FiscalYear {
    id: string;
    year: number;
    status: 'OPEN' | 'CLOSED';
    closedAt?: string;
    closedBy?: string;
    ignoredIssues?: string[];
    oblivionNotes?: string;
    snapshot?: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        taxes: number;
    };
}
