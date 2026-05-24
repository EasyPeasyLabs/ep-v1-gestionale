import { SlotType } from './course.types';

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
    publicName?: string;
    description?: string;
    price: number;
    lessons: number; 
    labCount: number;
    sgCount: number;
    evtCount: number;
    readCount: number;
    tokens?: { type: SlotType, count: number }[]; // New Bundle concept
    durationInDays: number;
    target: 'kid' | 'adult';
    statusConfig?: SubscriptionStatusConfig;
    isPubliclyVisible?: boolean;
    allowedDays?: number[]; 
    allowedAges?: { min: number, max: number }; // New target age range
}

export type SubscriptionTypeInput = Omit<SubscriptionType, 'id'>;

/**
 * Normalizzazione slot
 */
export const getSlotCount = (sub: SubscriptionType, type: SlotType): number => {
    if (sub.tokens && sub.tokens.length > 0) {
        const token = sub.tokens.find(t => t.type === type);
        if (token !== undefined) return token.count;
    }
    switch (type) {
        case 'LAB':  return sub.labCount  ?? 0;
        case 'SG':   return sub.sgCount   ?? 0;
        case 'EVT':  return sub.evtCount  ?? 0;
        case 'READ': return (sub as any).readCount ?? 0;
        default:     return 0;
    }
};

export const getNormalizedCounts = (sub: SubscriptionType) => ({
    labCount:  getSlotCount(sub, 'LAB'),
    sgCount:   getSlotCount(sub, 'SG'),
    evtCount:  getSlotCount(sub, 'EVT'),
    readCount: getSlotCount(sub, 'READ'),
});

export const hasSlotType = (sub: SubscriptionType, type: SlotType): boolean =>
    getSlotCount(sub, type) > 0;
