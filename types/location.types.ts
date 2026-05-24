import { Note } from './common.types';
import { SlotType } from './course.types';

export interface AvailabilitySlot {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isPubliclyVisible?: boolean;
    minAge?: number;
    maxAge?: number;
    type?: SlotType;
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
    supplierId: string; // Ref to Supplier
    name: string;
    address?: string;
    city?: string;
    color: string;
    capacity?: number;
    rentalCost?: number;
    distance?: number;
    status: 'active' | 'closed';
    closedAt?: string;
    notes?: string;
    notesHistory?: Note[];
    tags?: string[];
    rating?: LocationRating;
    isPubliclyVisible?: boolean;
    availability?: AvailabilitySlot[];
}

export type LocationInput = Omit<Location, 'id'>;
