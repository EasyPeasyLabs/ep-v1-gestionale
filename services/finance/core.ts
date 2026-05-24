
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    doc, 
    DocumentData, 
    QueryDocumentSnapshot, 
    query, 
    orderBy 
} from 'firebase/firestore';
import { 
    Transaction, 
    TransactionInput, 
    Invoice, 
    InvoiceInput, 
    Quote, 
    QuoteInput 
} from '../../types';
import { getNextTransactionNumber } from './numbering';

// Collections
export const getTransactionsCollectionRef = () => collection(db, 'transactions');
export const getInvoicesCollectionRef = () => collection(db, 'invoices');
export const getQuotesCollectionRef = () => collection(db, 'quotes');

// Helpers
export const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => ({ id: doc.id, ...doc.data() } as Transaction);
export const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => ({ id: doc.id, ...doc.data() } as Invoice);
export const docToQuote = (doc: QueryDocumentSnapshot<DocumentData>): Quote => ({ id: doc.id, ...doc.data() } as Quote);

// --- TRANSACTIONS ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const q = query(getTransactionsCollectionRef(), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToTransaction);
};

export const addTransaction = async (t: TransactionInput): Promise<string> => {
    if (t.transactionNumber === undefined) {
        t.transactionNumber = await getNextTransactionNumber(t.date);
    }
    const docRef = await addDoc(getTransactionsCollectionRef(), t);
    return docRef.id;
};

export const updateTransaction = async (id: string, t: Partial<TransactionInput>): Promise<void> => {
    await updateDoc(doc(db, 'transactions', id), t);
};

export const deleteTransaction = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'transactions', id), { isDeleted: true });
};

// --- INVOICES ---
export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(getInvoicesCollectionRef(), orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const addInvoice = async (inv: InvoiceInput): Promise<string> => {
    const docRef = await addDoc(getInvoicesCollectionRef(), inv);
    return docRef.id;
};

export const updateInvoice = async (id: string, inv: Partial<InvoiceInput>): Promise<void> => {
    await updateDoc(doc(db, 'invoices', id), inv);
};

export const deleteInvoice = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'invoices', id), { isDeleted: true });
};

// --- QUOTES ---
export const getQuotes = async (): Promise<Quote[]> => {
    const q = query(getQuotesCollectionRef(), orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToQuote);
};

export const addQuote = async (q: QuoteInput): Promise<string> => {
    if (!q.quoteNumber) {
        const year = new Date().getFullYear();
        const countSnap = await getDocs(query(getQuotesCollectionRef()));
        const count = countSnap.size + 1;
        q.quoteNumber = `PR-${year}-${String(count).padStart(3, '0')}`;
    }
    const docRef = await addDoc(getQuotesCollectionRef(), q);
    return docRef.id;
};

export const updateQuote = async (id: string, q: Partial<QuoteInput>): Promise<void> => {
    await updateDoc(doc(db, 'quotes', id), q);
};

export const deleteQuote = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'quotes', id), { isDeleted: true });
};
