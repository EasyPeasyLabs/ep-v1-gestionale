export interface Initiative {
    id: string;
    name: string;
    description: string;
    type: 'standard' | 'peek-a-book';
    materials: string;
    targetLocationIds: string[];
    targetLocationNames: string[];
}

export type InitiativeInput = Omit<Initiative, 'id'>;
