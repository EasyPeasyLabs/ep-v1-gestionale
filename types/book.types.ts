export interface Book {
    id: string;
    bookNumber: string; // e.g. "001"
    title: string;
    isAvailable: boolean;
    publisher?: string;
    authors?: string;
    targetTags?: string[];
    categoryTags?: string[];
    themeTags?: string[];
    homeLocationId?: string;
    createdAt?: string;
}

export interface BookInput {
    bookNumber: string;
    title: string;
    isAvailable: boolean;
    publisher?: string;
    authors?: string;
    targetTags?: string[];
    categoryTags?: string[];
    themeTags?: string[];
    homeLocationId?: string;
    createdAt?: string;
}

export interface BookLoan {
    id: string;
    bookId: string;
    bookTitle: string;
    studentId: string;
    studentName: string;
    locationId: string;
    locationName: string;
    locationColor: string;
    borrowDate: string;
    returnDate?: string;
    status: 'active' | 'returned';
}

export type BookLoanInput = Omit<BookLoan, 'id'>;
