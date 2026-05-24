import { Note } from './common.types';

export enum ClientType {
    Parent = 'parent',
    Institutional = 'institutional'
}

export interface Client {
    id: string;
    clientType: ClientType;
    email: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    zipCode: string;
    notesHistory: Note[];
    tags: string[];
    isDeleted?: boolean;
    preferredLocation?: string;
    preferredSlot?: string;
    source?: 'web_lead' | 'portal' | 'manual';
}

export interface ParentClient extends Client {
    firstName: string;
    lastName: string;
    taxCode: string;
    children: Child[];
    rating: ParentRating;
}

export interface InstitutionalClient extends Client {
    companyName: string;
    vatNumber: string;
    numberOfChildren: number;
    ageRange: string;
}

export type ClientInput = Omit<ParentClient, 'id'> | Omit<InstitutionalClient, 'id'>;
export type ParentClientInput = Omit<ParentClient, 'id'>;
export type InstitutionalClientInput = Omit<InstitutionalClient, 'id'>;

export interface Child {
    id: string;
    name: string;
    age: string;
    dateOfBirth?: string;
    notes: string;
    notesHistory: Note[];
    tags: string[];
    rating: ChildRating;
}

export interface ParentRating {
    availability: number;
    complaints: number;
    churnRate: number;
    distance: number;
}

export interface ChildRating {
    learning: number;
    behavior: number;
    attendance: number;
    hygiene: number;
}

