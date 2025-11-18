
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch } from '@firebase/firestore';
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

export const deleteTransactionByRelatedId = async (relatedId: string): Promise<void> => {
    const q = query(transactionCollectionRef, where("relatedDocumentId", "==", relatedId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};


// --- Document Number Generation ---
const getNextDocumentNumber = async (collectionName: string, prefix: string, padLength: number = 3): Promise<string> => {
    const coll = collection(db, collectionName);
    // Ordina per numero documento decrescente. Nota: questo funziona bene se il formato è consistente.
    // Se cambiamo formato (es da 3 a 4 cifre), l'ordinamento stringa potrebbe dare problemi.
    // Per semplicità qui assumiamo che l'anno corrente sia parte della query o gestito nel prefix.
    // Qui usiamo una logica semplificata basata sull'ultimo inserito.
    const q = query(coll, orderBy('issueDate', 'desc'), limit(50)); // Prendiamo gli ultimi 50 per trovare l'ultimo numero dell'anno corrente
    const snapshot = await getDocs(q);
    
    const currentYear = new Date().getFullYear().toString();
    let lastSeq = 0;

    if (!snapshot.empty) {
        // Cerca il numero più alto per l'anno corrente
        snapshot.docs.forEach(d => {
            const num = d.data()[collectionName === 'invoices' ? 'invoiceNumber' : 'quoteNumber'] as string;
            // Formato atteso: PREFIX-YYYY-SEQ (es. PR-2025-0001) o PREFIX-SEQ (vecchio)
            if (num && num.includes(currentYear)) {
                const parts = num.split('-');
                // Assumiamo che l'ultima parte sia sempre la sequenza
                const seqStr = parts[parts.length - 1];
                const seq = parseInt(seqStr, 10);
                if (!isNaN(seq) && seq > lastSeq) {
                    lastSeq = seq;
                }
            }
        });
    }

    const newSeq = (lastSeq + 1).toString().padStart(padLength, '0');
    return `${prefix}-${currentYear}-${newSeq}`;
};


// --- Invoices ---
const invoiceCollectionRef = collection(db, 'invoices');
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => ({ id: doc.id, ...doc.data() } as Invoice);

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(invoiceCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const checkAndSetOverdueInvoices = async (): Promise<void> => {
    // Ottieni tutte le fatture con stato 'Inviato'
    const q = query(invoiceCollectionRef, where("status", "==", DocumentStatus.Sent));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizza a inizio giornata

    let updatesCount = 0;

    snapshot.docs.forEach((docSnap) => {
        const invoice = docSnap.data() as Invoice;
        const dueDate = new Date(invoice.dueDate);
        
        // Se la data di scadenza è precedente a oggi
        if (dueDate < today) {
            batch.update(docSnap.ref, { status: DocumentStatus.Overdue });
            updatesCount++;
        }
    });

    if (updatesCount > 0) {
        await batch.commit();
    }
};

export const addInvoice = async (invoice: InvoiceInput): Promise<{id: string, invoiceNumber: string}> => {
    // Se è proforma, magari non consumiamo il numero ufficiale? 
    // Per semplicità, generiamo sempre un numero interno, ma la UI potrà visualizzare "PROFORMA"
    const invoiceNumber = invoice.invoiceNumber || await getNextDocumentNumber('invoices', 'FT', 3);
    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, invoiceNumber });
    return { id: docRef.id, invoiceNumber };
};

export const updateInvoiceStatus = async (id: string, status: DocumentStatus): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, { status });
};

export const updateInvoice = async (id: string, invoice: Partial<InvoiceInput>): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, invoice);
};

export const deleteInvoice = async (id: string): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await deleteDoc(invoiceDoc);
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
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4); // 4 cifre per preventivi
    const docRef = await addDoc(quoteCollectionRef, { ...quote, quoteNumber });
    return docRef.id;
};

export const updateQuoteStatus = async (id: string, status: DocumentStatus): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, { status });
};

export const updateQuote = async (id: string, quote: Partial<QuoteInput>): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, quote);
};

export const deleteQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await deleteDoc(quoteDoc);
};
