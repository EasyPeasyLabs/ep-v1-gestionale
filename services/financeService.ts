
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch } from 'firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus, Enrollment, Supplier, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Appointment } from '../types';
import { getAllEnrollments } from './enrollmentService';
import { getSuppliers } from './supplierService';

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

// --- Rent Expenses Automation (NEW LOGIC) ---

// Helper per festività
const isItalianHoliday = (date: Date): boolean => {
    const d = date.getDate();
    const m = date.getMonth() + 1; // 1-12
    const y = date.getFullYear();

    // Date fisse
    if (d === 1 && m === 1) return true; // Capodanno
    if (d === 6 && m === 1) return true; // Epifania
    if (d === 25 && m === 4) return true; // Liberazione
    if (d === 1 && m === 5) return true; // Lavoro
    if (d === 2 && m === 6) return true; // Repubblica
    if (d === 15 && m === 8) return true; // Ferragosto
    if (d === 1 && m === 11) return true; // Ognissanti
    if (d === 8 && m === 12) return true; // Immacolata
    if (d === 25 && m === 12) return true; // Natale
    if (d === 26 && m === 12) return true; // S.Stefano

    // Pasquetta (Lunedì dell'Angelo) - Hardcoded 2024-2030 per semplicità
    const easterMondays: Record<number, string> = {
        2024: '4-1',  // 1 Aprile
        2025: '4-21', // 21 Aprile
        2026: '4-6',  // 6 Aprile
        2027: '3-29', // 29 Marzo
        2028: '4-17', // 17 Aprile
        2029: '4-2',  // 2 Aprile
        2030: '4-22'  // 22 Aprile
    };

    const key = `${m}-${d}`;
    if (easterMondays[y] === key) return true;

    return false;
};

export const calculateRentTransactions = (
    enrollments: Enrollment[], 
    suppliers: Supplier[], 
    existingTransactions: Transaction[]
): TransactionInput[] => {
    // Deprecated for direct usage, kept for reference if needed, 
    // but the UI now calls syncRentExpenses directly.
    return [];
};

export const syncRentExpenses = async (): Promise<string> => {
    console.log("[Finance] Avvio sincronizzazione Noli (Logica: Affitto Sala / Flat Rate)...");
    
    const [enrollments, suppliers, transactions] = await Promise.all([
        getAllEnrollments(),
        getSuppliers(),
        getTransactions()
    ]);

    // Counters for Feedback
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // 1. Mappa Costi Sedi
    const locationMap = new Map<string, {cost: number, name: string}>();
    suppliers.forEach(s => {
        s.locations.forEach(l => {
            locationMap.set(l.id, { cost: l.rentalCost || 0, name: l.name });
        });
    });

    // 2. DEDUPLICAZIONE SLOT (Logica Affitto Sala)
    // Identifichiamo gli slot unici occupati (Data + Ora Inizio + Sede)
    // Indipendentemente da quanti bambini ci sono.
    const uniqueSlots = new Set<string>(); // Key format: YYYY-MM-DD|HH:mm|LOC_ID

    enrollments.forEach(enr => {
        if (enr.appointments) {
            enr.appointments.forEach((app: Appointment) => {
                const date = new Date(app.date);
                
                // Filtro Festività
                if (isItalianHoliday(date)) return;

                // Identificazione Sede (Storicizzata o Attuale)
                const locId = app.locationId || enr.locationId; 
                
                // Se la sede non è definita o è "unassigned", salta
                if (!locId || locId === 'unassigned') return;

                // Costruisci chiave univoca per lo slot
                // Usa la parte data ISO (YYYY-MM-DD) + Ora Inizio + ID Sede
                const dateStr = app.date.split('T')[0];
                const slotKey = `${dateStr}|${app.startTime}|${locId}`;
                
                uniqueSlots.add(slotKey);
            });
        }
    });

    // 3. AGGREGAZIONE COSTI (Basata sugli slot unici)
    // Key: YYYY-MM|LOCATION_ID -> Count
    const aggregates = new Map<string, number>();

    uniqueSlots.forEach(slotKey => {
        const [dateStr, startTime, locId] = slotKey.split('|');
        const date = new Date(dateStr);
        
        // Chiave aggregazione mensile
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const aggKey = `${monthKey}|${locId}`;
        
        const currentCount = aggregates.get(aggKey) || 0;
        aggregates.set(aggKey, currentCount + 1);
    });

    // 4. Preparazione Batch Write
    const batch = writeBatch(db);
    const processedKeys = new Set<string>();

    // Transazioni esistenti di tipo AUTO-RENT
    const autoRentTransactions = transactions.filter(t => 
        !t.isDeleted && 
        t.relatedDocumentId?.startsWith('AUTO-RENT-')
    );

    // Mappa per accesso rapido alle transazioni esistenti
    const existingMap = new Map<string, Transaction>();
    autoRentTransactions.forEach(t => {
        if (t.relatedDocumentId) existingMap.set(t.relatedDocumentId, t);
    });

    // Processa Aggregati (Upsert)
    aggregates.forEach((count, key) => {
        const [monthKey, locId] = key.split('|');
        const [year, month] = monthKey.split('-');
        const locData = locationMap.get(locId);

        if (locData && locData.cost > 0) {
            const totalCost = count * locData.cost;
            const docId = `AUTO-RENT-${key}`;
            const description = `Nolo Sede: ${locData.name} - ${month}/${year} (${count} slot unici)`;
            
            processedKeys.add(docId);

            if (existingMap.has(docId)) {
                // UPDATE
                const existing = existingMap.get(docId)!;
                // Aggiorna solo se l'importo o la descrizione (count) è cambiata
                if (Math.abs(existing.amount - totalCost) > 0.01 || existing.description !== description) {
                    const ref = doc(db, 'transactions', existing.id);
                    batch.update(ref, { 
                        amount: totalCost,
                        description: description 
                    });
                    updated++;
                }
            } else {
                // CREATE
                const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);
                const newRef = doc(collection(db, 'transactions'));
                batch.set(newRef, {
                    date: lastDayOfMonth.toISOString(),
                    description: description,
                    amount: totalCost,
                    type: TransactionType.Expense,
                    category: TransactionCategory.Rent,
                    paymentMethod: PaymentMethod.BankTransfer, 
                    status: TransactionStatus.Pending,
                    relatedDocumentId: docId,
                    allocationType: 'location',
                    allocationId: locId,
                    allocationName: locData.name,
                    isDeleted: false
                });
                created++;
            }
        }
    });

    // 5. Pulizia Obsoleti (Delete)
    // Se una transazione esiste ma non è più negli aggregati (es. spostamento totale alunni o cancellazione), eliminala.
    autoRentTransactions.forEach(t => {
        if (t.relatedDocumentId && !processedKeys.has(t.relatedDocumentId)) {
            const ref = doc(db, 'transactions', t.id);
            batch.delete(ref); 
            deleted++;
        }
    });

    await batch.commit();
    console.log(`[Finance] Sync completato. C:${created} U:${updated} D:${deleted}`);
    return `Sincronizzazione Noli Completata.\n\n✅ Create: ${created}\n📝 Aggiornate: ${updated}\n🗑️ Eliminate: ${deleted}\n\nVai alla tab "Controllo di Gestione" per vedere i nuovi importi aggiornati.`;
};


// --- Document Number Generation ---
export const getNextDocumentNumber = async (
    collectionName: string, 
    prefix: string, 
    padLength: number = 3,
    referenceDate: string | Date = new Date()
): Promise<string> => {
    const coll = collection(db, collectionName);
    
    // Determina l'anno di riferimento dalla data del documento, non dalla data di sistema
    const dateObj = new Date(referenceDate);
    const targetYear = dateObj.getFullYear().toString();
    
    // Definisci il range dell'anno per la query
    const startOfYear = new Date(dateObj.getFullYear(), 0, 1).toISOString();
    const endOfYear = new Date(dateObj.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    
    // Filtriamo per escludere Ghost e documenti di anni precedenti (usando il range)
    let q;
    if (collectionName === 'invoices') {
        q = query(
            coll, 
            where("isGhost", "==", false),
            where("isDeleted", "==", false),
            where("issueDate", ">=", startOfYear),
            where("issueDate", "<=", endOfYear),
            orderBy('issueDate', 'desc'), 
            limit(100) // Prende le ultime 100 dell'anno target
        );
    } else {
        q = query(
            coll, 
            where("isDeleted", "==", false),
            where("issueDate", ">=", startOfYear),
            where("issueDate", "<=", endOfYear),
            orderBy('issueDate', 'desc'), 
            limit(100)
        );
    }

    const snapshot = await getDocs(q);
    let lastSeq = 0;

    if (!snapshot.empty) {
        snapshot.docs.forEach(d => {
            const data = d.data() as any;
            const num = collectionName === 'invoices' ? data.invoiceNumber : data.quoteNumber;
            
            // Verifichiamo che il numero appartenga all'anno target e segua il pattern PREFIX-YYYY-SEQ
            if (num && num.startsWith(`${prefix}-${targetYear}`)) {
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
    return `${prefix}-${targetYear}-${newSeq}`;
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
            // Passiamo la data della fattura per generare il numero nell'anno corretto
            invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3, invoice.issueDate);
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
    // Passiamo la data del preventivo per l'anno corretto
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4, quote.issueDate);
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
