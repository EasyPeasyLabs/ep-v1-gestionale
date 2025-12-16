import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { Initiative, InitiativeInput, Book, BookInput, BookLoan, BookLoanInput } from '../types';

// --- INITIATIVES (CRUD Standard) ---
const initiativeCollectionRef = collection(db, 'initiatives');

const docToInitiative = (doc: QueryDocumentSnapshot<DocumentData>): Initiative => {
    const data = doc.data();
    return { id: doc.id, ...data } as Initiative;
};

export const getInitiatives = async (): Promise<Initiative[]> => {
    const snapshot = await getDocs(initiativeCollectionRef);
    return snapshot.docs.map(docToInitiative);
};

export const addInitiative = async (initiative: InitiativeInput): Promise<string> => {
    const docRef = await addDoc(initiativeCollectionRef, initiative);
    return docRef.id;
};

export const updateInitiative = async (id: string, initiative: Partial<InitiativeInput>): Promise<void> => {
    const docRef = doc(db, 'initiatives', id);
    await updateDoc(docRef, initiative);
};

export const deleteInitiative = async (id: string): Promise<void> => {
    const docRef = doc(db, 'initiatives', id);
    await deleteDoc(docRef);
};

// --- BOOKS (Inventory) ---
const bookCollectionRef = collection(db, 'books');

const docToBook = (doc: QueryDocumentSnapshot<DocumentData>): Book => {
    const data = doc.data();
    return { id: doc.id, ...data } as Book;
};

export const getBooks = async (): Promise<Book[]> => {
    const q = query(bookCollectionRef, orderBy('title'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBook);
};

export const addBook = async (book: BookInput): Promise<string> => {
    const docRef = await addDoc(bookCollectionRef, { ...book, isAvailable: true });
    return docRef.id;
};

export const updateBook = async (id: string, book: Partial<BookInput>): Promise<void> => {
    const docRef = doc(db, 'books', id);
    await updateDoc(docRef, book);
};

export const deleteBook = async (id: string): Promise<void> => {
    const docRef = doc(db, 'books', id);
    await deleteDoc(docRef);
};

// --- BOOK LOANS (Prestiti) ---
const loanCollectionRef = collection(db, 'book_loans');

const docToLoan = (doc: QueryDocumentSnapshot<DocumentData>): BookLoan => {
    const data = doc.data();
    return { id: doc.id, ...data } as BookLoan;
};

export const getActiveLoans = async (): Promise<BookLoan[]> => {
    const q = query(loanCollectionRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToLoan);
};

// Prende un libro in prestito
export const checkOutBook = async (loan: BookLoanInput): Promise<void> => {
    const batch = writeBatch(db);
    
    // 1. Crea il record prestito
    const loanRef = doc(loanCollectionRef);
    batch.set(loanRef, { ...loan, status: 'active' });

    // 2. Segna il libro come non disponibile
    const bookRef = doc(db, 'books', loan.bookId);
    batch.update(bookRef, { isAvailable: false });

    await batch.commit();
};

// Restituisce un libro
export const checkInBook = async (loanId: string, bookId: string): Promise<void> => {
    const batch = writeBatch(db);

    // 1. Aggiorna il prestito come restituito
    const loanRef = doc(db, 'book_loans', loanId);
    batch.update(loanRef, { 
        status: 'returned', 
        returnDate: new Date().toISOString() 
    });

    // 2. Segna il libro come disponibile
    const bookRef = doc(db, 'books', bookId);
    batch.update(bookRef, { isAvailable: true });

    await batch.commit();
};