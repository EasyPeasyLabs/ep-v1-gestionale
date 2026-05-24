export interface PortalText {
    id: string;
    type: 'absence_recovery_warning' | 'payment_method';
    title: string;
    content: string;
    paymentMethod?: string; // Only for payment_method type
    isActive: boolean;
    order: number;
}
