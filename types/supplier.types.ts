import { Note } from './common.types';
import { Location } from './location.types';

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

export interface SupplierRating {
    responsiveness: number;
    partnership: number;
    negotiation: number;
}
