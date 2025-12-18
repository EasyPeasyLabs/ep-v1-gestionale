import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch } from 'firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus, Enrollment, Supplier, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Appointment } from '../types';

// --- Transactions ---
const transactionCollectionRef = collection(db, 'transactions');
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => {
    const data = doc.data();
    return { 
        id: doc.id, 
        ...data,
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

export const deleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, { isDeleted: true });
};

export const restoreTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, { isDeleted: false });
};

export const permanentDeleteTransaction = async (id: string): Promise<void> => {
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

export const deleteAutoRentTransactions = async (locationId: string): Promise<void> => {
    const q = query(transactionCollectionRef, 
        where("allocationId", "==", locationId),
        where("category", "==", TransactionCategory.Rent),
        where("relatedDocumentId", ">=", "AUTO-RENT")
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

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
            enr.appointments.forEach((app: Appointment) => {
                if (app.status === 'Present') {
                    const date = new Date(app.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const locId = app.locationId || enr.locationId; 
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
            
            const existingTrans = existingTransactions.find(t => 
                !t.isDeleted &&
                t.type === TransactionType.Expense &&
                t.category === TransactionCategory.Rent &&
                t.allocationId === locId &&
                t.description.includes(`${month}/${year}`)
            );

            if (!existingTrans) {
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
export const getNextDocumentNumber = async (collectionName: string, prefix: string, padLength: number = 3): Promise<string> => {
    const coll = collection(db, collectionName);
    const currentYear = new Date().getFullYear().toString();
    
    // Filtriamo per escludere Ghost e documenti di anni precedenti
    let q;
    if (collectionName === 'invoices') {
        q = query(
            coll, 
            where("isGhost", "==", false),
            where("isDeleted", "==", false),
            orderBy('issueDate', 'desc'), 
            limit(100)
        );
    } else {
        q = query(coll, where("isDeleted", "==", false), orderBy('issueDate', 'desc'), limit(100));
    }

    const snapshot = await getDocs(q);
    let lastSeq = 0;

    if (!snapshot.empty) {
        snapshot.docs.forEach(d => {
            const data = d.data() as any;
            const num = collectionName === 'invoices' ? data.invoiceNumber : data.quoteNumber;
            
            // Verifichiamo che il numero appartenga all'anno corrente e segua il pattern PREFIX-YYYY-SEQ
            if (num && num.startsWith(`${prefix}-${currentYear}`)) {
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

export const getNextGhostInvoiceNumber = async (): Promise<string> => {
    const coll = collection(db, 'invoices');
    const currentYear = new Date().getFullYear().toString();
    const prefix = `FT-GHOST-${currentYear}`;
    
    const q = query(coll, where("isGhost", "==", true), where("isDeleted", "==", false));
    const snapshot = await getDocs(q);
    
    let lastSeq = 0;
    snapshot.docs.forEach(d => {
        const num = d.data().invoiceNumber;
        if (num && num.startsWith(prefix)) {
            const parts = num.split('-');
            const seqStr = parts[parts.length - 1];
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > lastSeq) {
                lastSeq = seq;
            }
        }
    });

    const newSeq = (lastSeq + 1).toString().padStart(3, '0');
    return `${prefix}-${newSeq}`;
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
    let invoiceNumber = invoice.invoiceNumber;
    
    if (!invoiceNumber) {
        if (invoice.isGhost) {
            invoiceNumber = await getNextGhostInvoiceNumber();
        } else {
            invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3);
        }
    }

    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, invoiceNumber, isDeleted: false });
    return { id: docRef.id, invoiceNumber };
};

export const updateInvoice = async (id: string, invoice: Partial<InvoiceInput>): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, invoice);
};

export const deleteInvoice = async (id: string): Promise<void> => {
    const invoiceDoc = doc(db, 'invoices', id);
    await updateDoc(invoiceDoc, { isDeleted: true });
};

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
    const q = query(quoteCollectionRef);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToQuote).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
};

export const addQuote = async (quote: QuoteInput): Promise<string> => {
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4);
    const docRef = await addDoc(quoteCollectionRef, { ...quote, quoteNumber, isDeleted: false });
    return docRef.id;
};

export const updateQuote = async (id: string, quote: Partial<QuoteInput>): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, quote);
};

export const deleteQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await updateDoc(quoteDoc, { isDeleted: true });
};

export const permanentDeleteQuote = async (id: string): Promise<void> => {
    const quoteDoc = doc(db, 'quotes', id);
    await deleteDoc(quoteDoc);
};

// --- CLEANUP HELPER ---
export const cleanupEnrollmentFinancials = async (enrollment: Enrollment): Promise<void> => {
    const clientId = enrollment.clientId;
    const childName = enrollment.childName;

    // 1. FATTURE & TRANSAZIONI INCASSO (Entrate)
    const invoices = await getInvoices();
    const searchName = childName.toLowerCase();
    
    const targetInvoices = invoices.filter(i => 
        i.clientId === clientId && 
        !i.isDeleted &&
        (
            (i.notes && i.notes.toLowerCase().includes(searchName)) || 
            i.items.some(item => item.description.toLowerCase().includes(searchName))
        )
    );

    for (const inv of targetInvoices) {
        await deleteTransactionByRelatedId(inv.id);
        await permanentDeleteInvoice(inv.id);
    }

    // 2. TRANSAZIONI "CONTANTI"
    const transactions = await getTransactions();
    const targetIncomeTrans = transactions.filter(t => {
        const desc = t.description.toLowerCase();
        return !t.isDeleted && (t.type === TransactionType.Income) && 
               (desc.includes(`incasso iscrizione (contanti): ${searchName}`) ||
                desc.includes(`incasso iscrizione (contanti) - ${searchName}`));
    });

    for (const t of targetIncomeTrans) {
        await permanentDeleteTransaction(t.id);
    }

    // 3. REGISTRO ATTIVITÀ
    if (enrollment.appointments && enrollment.appointments.length > 0) {
        const lessonIds = enrollment.appointments.map(a => a.lessonId);
        await deleteLessonActivitiesForEnrollment(lessonIds);
    }
};

const deleteLessonActivitiesForEnrollment = async (lessonIds: string[]): Promise<void> => {
    if (lessonIds.length === 0) return;
    const collectionRef = collection(db, 'lesson_activities');
    const snapshot = await getDocs(collectionRef);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (lessonIds.includes(data.lessonId)) {
            batch.delete(docSnap.ref);
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
    }
};

export const resetFinancialData = async (type: TransactionType): Promise<void> => {
    const q = query(transactionCollectionRef, where("type", "==", type));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
    });
    await batch.commit();
};