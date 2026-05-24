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
    currentBankBalance?: number; 
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
    filterContext?: Record<string, unknown>;
}
