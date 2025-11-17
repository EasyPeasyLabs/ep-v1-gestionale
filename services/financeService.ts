import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, getCountFromServer, where, limit } from 'firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus } from '../types';

// --- Transactions ---
const transactionCollectionRef = collection(db, 'transactions');
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => ({ id: doc.id, ...doc.data() } as Transaction);

export const getTransactions = async (): Promise<Transaction[]> => {
    const q = query(transactionCollectionRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToTransaction);
};

export const addTransaction = async (transaction: TransactionInput): Promise<string> => {
    const docRef = await addDoc(transactionCollectionRef, transaction);
    return docRef.id;
};

export const updateTransaction = async (id: string, transaction: Partial<TransactionInput>): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, transaction);
};

export const deleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await deleteDoc(transactionDoc);
};


// --- Document Number Generation ---
const getNextDocumentNumber = async (collectionName: string, prefix: string): Promise<string> => {
    const coll = collection(db, collectionName);
    const q = query(coll, orderBy(`${collectionName.slice(0, -1)}Number`, 'desc'), limit(1));
    const lastDocSnapshot = await getDocs(q);

    if (lastDocSnapshot.empty) {
        return `${prefix}-${new Date().getFullYear()}-001`;
    }

    const lastNumber = lastDocSnapshot.docs[0].data()[`${collectionName.slice(0, -1)}Number`] as string;
    const parts = lastNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    const newSeq = (lastSeq + 1).toString().padStart(3, '0');
    
    return `${prefix}-${new Date().getFullYear()}-${newSeq}`;
};


// --- Invoices ---
const invoiceCollectionRef = collection(db, 'invoices');
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => ({ id: doc.id, ...doc.data() } as Invoice);

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(invoiceCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const addInvoice = async (invoice: InvoiceInput): Promise<string> => {
    const invoiceNumber = await getNextDocumentNumber('invoices', 'FATT');
    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, invoiceNumber });
    return docRef.id;
};

export const updateInvoiceStatus = async (id: string, status: DocumentStatus): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, { status });
};


// --- Quotes ---
const quoteCollectionRef = collection(db, 'quotes');
const docToQuote = (doc: QueryDocumentSnapshot<DocumentData>): Quote => ({ id: doc.id, ...doc.data() } as Quote);

export const getQuotes = async (): Promise<Quote[]> => {
    const q = query(quoteCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToQuote);
};

export const addQuote = async (quote: QuoteInput): Promise<string> => {
    const quoteNumber = await getNextDocumentNumber('quotes', 'PREV');
    const docRef = await addDoc(quoteCollectionRef, { ...quote, quoteNumber });
    return docRef.id;
};

export const updateQuoteStatus = async (id: string, status: DocumentStatus): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, { status });
};