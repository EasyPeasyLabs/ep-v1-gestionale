export interface Homework {
    id: string;
    title: string;
    description: string;
    type: 'textbook' | 'link';
    textbookName?: string;
    pageNumber?: string;
    exercises?: string;
    linkUrl?: string;
    expectedOutcome: string;
    assignedDate?: string;
    assignedLocationId?: string;
    assignedLocationName?: string;
    createdAt: string;
}

export type HomeworkInput = Omit<Homework, 'id'>;
