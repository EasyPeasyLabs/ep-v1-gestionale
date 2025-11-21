
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch } from '@firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus, Enrollment, Supplier, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus } from '../types';

// --- Transactions ---
const transactionCollectionRef = collection(db, 'transactions');
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => {
    const data = doc.data();
    return { 
        id: doc.id, 
        ...data,
        // Retrocompatibilità
        status: data.status || TransactionStatus.Completed,
        isDeleted: data.isDeleted || false
    } as Transaction;
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const q = query(transactionCollectionRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToTransaction);
};

export const addTransaction = async (transaction: TransactionInput): Promise<string> => {
    const dataToSave = {
        ...transaction,
        status: transaction.status || TransactionStatus.Completed,
        isDeleted: false
    };
    const docRef = await addDoc(transactionCollectionRef, dataToSave);
    return docRef.id;
};

export const updateTransaction = async (id: string, transaction: Partial<TransactionInput>): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, transaction);
};

// Soft Delete
export const deleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, { isDeleted: true });
};

// Restore
export const restoreTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, { isDeleted: false });
};

// Hard Delete
export const permanentDeleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await deleteDoc(transactionDoc);
};

export const deleteTransactionByRelatedId = async (relatedId: string): Promise<void> => {
    const q = query(transactionCollectionRef, where("relatedDocumentId", "==", relatedId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref); // Qui manteniamo l'eliminazione fisica per coerenza con l'eliminazione del padre
    });
    await batch.commit();
};

// Funzione di Batch per aggiungere multiple transazioni
export const batchAddTransactions = async (transactions: TransactionInput[]): Promise<void> => {
    const batch = writeBatch(db);
    transactions.forEach(t => {
        const docRef = doc(transactionCollectionRef);
        batch.set(docRef, { ...t, isDeleted: false });
    });
    await batch.commit();
};

// --- Rent Expenses Automation ---
export const calculateRentTransactions = (
    enrollments: Enrollment[], 
    suppliers: Supplier[], 
    existingTransactions: Transaction[]
): TransactionInput[] => {
    const newTransactions: TransactionInput[] = [];
    const locationMap = new Map<string, {cost: number, name: string}>();
    suppliers.forEach(s => {
        s.locations.forEach(l => {
            locationMap.set(l.id, { cost: l.rentalCost || 0, name: l.name });
        });
    });

    const aggregates = new Map<string, number>();

    enrollments.forEach(enr => {
        if (enr.appointments) {
            enr.appointments.forEach(app => {
                if (app.status === 'Present') {
                    const date = new Date(app.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const locId = enr.locationId; 
                    const key = `${monthKey}|${locId}`;
                    const currentCount = aggregates.get(key) || 0;
                    aggregates.set(key, currentCount + 1);
                }
            });
        }
    });

    aggregates.forEach((count, key) => {
        const [monthKey, locId] = key.split('|');
        const [year, month] = monthKey.split('-');
        const locData = locationMap.get(locId);

        if (locData && locData.cost > 0) {
            const totalCost = count * locData.cost;
            const description = `Nolo Sede: ${locData.name} - ${month}/${year}`;
            
            // Verifica se esiste già una transazione ATTIVA (non deleted)
            const exists = existingTransactions.some(t => 
                !t.isDeleted &&
                t.type === TransactionType.Expense &&
                t.category === TransactionCategory.Rent &&
                t.description === description
            );

            if (!exists) {
                const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);
                newTransactions.push({
                    date: lastDayOfMonth.toISOString(),
                    description: description,
                    amount: totalCost,
                    type: TransactionType.Expense,
                    category: TransactionCategory.Rent,
                    paymentMethod: PaymentMethod.BankTransfer, 
                    status: TransactionStatus.Pending,
                    relatedDocumentId: `AUTO-RENT-${key}`,
                    allocationType: 'location',
                    allocationId: locId,
                    allocationName: locData.name
                });
            }
        }
    });

    return newTransactions;
};


// --- Document Number Generation ---
const getNextDocumentNumber = async (collectionName: string, prefix: string, padLength: number = 3): Promise<string> => {
    const coll = collection(db, collectionName);
    const q = query(coll, orderBy('issueDate', 'desc'), limit(50)); 
    const snapshot = await getDocs(q);
    
    const currentYear = new Date().getFullYear().toString();
    let lastSeq = 0;

    if (!snapshot.empty) {
        snapshot.docs.forEach(d => {
            const data = d.data();
            // Salta i documenti eliminati per il calcolo del numero progressivo? 
            // Di solito NO, il buco di numerazione fiscale non è ammesso. 
            // Quindi consideriamo anche i cancellati per la numerazione.
            
            const num = collectionName === 'invoices' ? data.invoiceNumber : data.quoteNumber;
            if (num && num.includes(currentYear)) {
                const parts = num.split('-');
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
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => ({ 
    id: doc.id, 
    ...doc.data(),
    isDeleted: doc.data().isDeleted || false 
} as Invoice);

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(invoiceCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const checkAndSetOverdueInvoices = async (): Promise<void> => {
    const q = query(invoiceCollectionRef, where("status", "==", DocumentStatus.Sent));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    let updatesCount = 0;

    snapshot.docs.forEach((docSnap) => {
        const invoice = docSnap.data() as Invoice;
        // Non marchiamo come overdue se è nel cestino
        if (!invoice.isDeleted) {
            const dueDate = new Date(invoice.dueDate);
            if (dueDate < today) {
                batch.update(docSnap.ref, { status: DocumentStatus.Overdue });
                updatesCount++;
            }
        }
    });

    if (updatesCount > 0) {
        await batch.commit();
    }
};

export const addInvoice = async (invoice: InvoiceInput): Promise<{id: string, invoiceNumber: string}> => {
    const invoiceNumber = invoice.invoiceNumber || await getNextDocumentNumber('invoices', 'FT', 3);
    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, invoiceNumber, isDeleted: false });
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

// Soft Delete
export const deleteInvoice = async (id: string): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, { isDeleted: true });
};

// Restore
export const restoreInvoice = async (id: string): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, { isDeleted: false });
};

// Hard Delete
export const permanentDeleteInvoice = async (id: string): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await deleteDoc(invoiceDoc);
};


// --- Quotes ---
const quoteCollectionRef = collection(db, 'quotes');
const docToQuote = (doc: QueryDocumentSnapshot<DocumentData>): Quote => ({ 
    id: doc.id, 
    ...doc.data(),
    isDeleted: doc.data().isDeleted || false
} as Quote);

export const getQuotes = async (): Promise<Quote[]> => {
    const q = query(quoteCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToQuote);
};

export const addQuote = async (quote: QuoteInput): Promise<string> => {
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4); 
    const docRef = await addDoc(quoteCollectionRef, { ...quote, quoteNumber, isDeleted: false });
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

// Soft Delete
export const deleteQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, { isDeleted: true });
};

// Restore
export const restoreQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, { isDeleted: false });
};

// Hard Delete
export const permanentDeleteQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await deleteDoc(quoteDoc);
};
