export type SlotType = 'LAB' | 'SG' | 'EVT' | 'LAB+SG' | 'READ';

export interface RecurrenceConfig {
    type: 'monthly_pattern' | 'custom_intervals';
    activeMonths?: number[]; // 1-12
    blackoutPeriods?: { start: string; end: string }[];
}

export interface Course {
    id: string;
    locationId: string; // Ref to Location
    dayOfWeek: number; // 0-6
    startTime: string; // HH:mm
    endTime: string;
    slotType: SlotType;
    minAge: number;
    maxAge: number;
    capacity: number;
    activeEnrollmentsCount: number;
    status: 'open' | 'closed';
    startDate?: string; // Data inizio validità corso
    endDate?: string; // Data fine validità corso
    updatedAt?: string;
    comboConfigs?: Partial<Record<SlotType, {
        startTime: string;
        endTime: string;
        minAge: number;
        maxAge: number;
        capacity: number;
    }>>;
    weeklyPlan?: Record<number, SlotType>;
    recurrenceConfig?: RecurrenceConfig;
}

export type CourseInput = Omit<Course, 'id' | 'activeEnrollmentsCount'> & { 
    activeEnrollmentsCount?: number;
    startDate?: string;
    endDate?: string;
    recurrenceConfig?: RecurrenceConfig;
    comboConfigs?: Partial<Record<SlotType, {
        startTime: string;
        endTime: string;
        minAge: number;
        maxAge: number;
        capacity: number;
    }>>;
    weeklyPlan?: Record<number, SlotType>;
};
