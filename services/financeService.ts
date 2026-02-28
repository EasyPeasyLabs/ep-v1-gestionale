
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, where, writeBatch, getDoc } from 'firebase/firestore';
import { 
    Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, 
    DocumentStatus, PaymentMethod, TransactionType, TransactionCategory, 
    Enrollment, InvoiceGap, IntegrityIssue, RentAnalysisResult, EnrollmentStatus, 
    TransactionStatus, Lesson, Client, ClientType, ParentClient, InstitutionalClient 
} from '../types';
import { getLessons } from './calendarService';
import { getSuppliers } from './supplierService';
import { getClients } from './parentService';
import { isYearClosed } from './fiscalYearService';

// Collections
const transactionsCollectionRef = collection(db, 'transactions');
const invoicesCollectionRef = collection(db, 'invoices');
const quotesCollectionRef = collection(db, 'quotes');

// Helpers
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => ({ id: doc.id, ...doc.data() } as Transaction);
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => ({ id: doc.id, ...doc.data() } as Invoice);
const docToQuote = (doc: QueryDocumentSnapshot<DocumentData>): Quote => ({ id: doc.id, ...doc.data() } as Quote);

// --- TRANSACTIONS ---
export const getTransactions = async (): Promise<Transaction[]> => {
    const q = query(transactionsCollectionRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToTransaction);
};

export const addTransaction = async (t: TransactionInput): Promise<string> => {
    const docRef = await addDoc(transactionsCollectionRef, t);
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
    const q = query(invoicesCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const addInvoice = async (inv: InvoiceInput): Promise<string> => {
    const docRef = await addDoc(invoicesCollectionRef, inv);
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
    const q = query(quotesCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToQuote);
};

export const addQuote = async (q: QuoteInput): Promise<string> => {
    // Generate Quote Number
    if (!q.quoteNumber) {
        const year = new Date().getFullYear();
        const countSnap = await getDocs(query(quotesCollectionRef));
        const count = countSnap.size + 1;
        q.quoteNumber = `PR-${year}-${String(count).padStart(3, '0')}`;
    }
    const docRef = await addDoc(quotesCollectionRef, q);
    return docRef.id;
};

export const updateQuote = async (id: string, q: Partial<QuoteInput>): Promise<void> => {
    await updateDoc(doc(db, 'quotes', id), q);
};

export const deleteQuote = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'quotes', id), { isDeleted: true });
};

export const convertQuoteToInvoice = async (quoteId: string) => {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error("Preventivo non trovato");
    const quote = quoteSnap.data() as Quote;
    const today = new Date().toISOString();
    
    // Generate Invoice Number
    const invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3, today);

    const invoiceInput: InvoiceInput = { 
        invoiceNumber: invoiceNumber, 
        issueDate: today, 
        dueDate: today, 
        clientId: quote.clientId, 
        clientName: quote.clientName, 
        items: quote.items, 
        totalAmount: quote.totalAmount, 
        status: DocumentStatus.Draft, // Converted quotes start as Draft usually
        paymentMethod: PaymentMethod.BankTransfer, 
        hasStampDuty: quote.hasStampDuty || quote.totalAmount > 77.47, 
        globalDiscount: quote.globalDiscount,
        globalDiscountType: quote.globalDiscountType,
        isGhost: false, 
        isDeleted: false, 
        relatedQuoteNumber: quote.quoteNumber 
    };
    const newInvoiceId = await addInvoice(invoiceInput);
    await updateDoc(quoteRef, { status: DocumentStatus.Sent }); // Or converted status if available
    return newInvoiceId;
};

// --- INSTITUTIONAL / DYNAMIC BILLING ---
export const generateInvoicesFromQuote = async (quote: Quote, enrollmentId: string, selectedLessons: Lesson[]): Promise<void> => {
    if (!quote.installments || quote.installments.length === 0) return;

    // Sort lessons chronologically to find N-th lesson
    const sortedLessons = [...selectedLessons].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const batch = writeBatch(db);

    const nextGhostBase = await getNextGhostInvoiceNumber();
    // Parse the base number to increment
    const parts = nextGhostBase.split('-');
    const year = parts[1];
    let seq = parseInt(parts[2]);

    for (let i = 0; i < quote.installments.length; i++) {
        const inst = quote.installments[i];
        let issueDate = inst.dueDate;

        // Dynamic Trigger Logic
        if (inst.triggerType === 'lesson_number' && inst.triggerLessonIndex) {
            const lesson = sortedLessons[inst.triggerLessonIndex - 1]; // 1-based index
            if (lesson) {
                issueDate = lesson.date;
            }
        }

        // Calculate Collection Date
        const termDays = inst.paymentTermDays || 0;
        const dueObj = new Date(issueDate);
        dueObj.setDate(dueObj.getDate() + termDays);
        const collectionDate = dueObj.toISOString();

        // Generate Number
        const ghostNum = `PRO-${year}-${String(seq).padStart(3, '0')}`;
        seq++;

        const invRef = doc(invoicesCollectionRef);
        const invData: InvoiceInput = {
            invoiceNumber: ghostNum,
            issueDate: issueDate,
            dueDate: collectionDate,
            clientId: quote.clientId,
            clientName: quote.clientName,
            status: DocumentStatus.Draft,
            paymentMethod: PaymentMethod.BankTransfer,
            isGhost: true,
            isDeleted: false,
            items: [{
                description: `${inst.description} - Rif. Prev. ${quote.quoteNumber}`,
                quantity: 1,
                price: inst.amount,
                notes: 'Generata automaticamente da piano rateale'
            }],
            totalAmount: inst.amount,
            hasStampDuty: inst.hasStampDuty || false,
            relatedEnrollmentId: enrollmentId,
            relatedQuoteNumber: quote.quoteNumber
        };

        batch.set(invRef, invData);
    }

    await batch.commit();
};

// --- LOGIC: RENT ANALYSIS ---
// NOTE: Now accepts enrollments as argument to avoid circular dependency
export const analyzeRentExpenses = async (month: number, year: number, enrollments: Enrollment[]): Promise<RentAnalysisResult[]> => {
    const suppliers = await getSuppliers();
    const lessons = await getLessons();
    const transactions = await getTransactions(); // To check if paid

    // Build map of location usage
    // Map: LocationId -> Set of unique session keys (date_start_end)
    const uniqueSessions = new Map<string, Set<string>>();

    // A. Count from Enrollments Appointments
    enrollments.forEach(enr => {
        if (enr.appointments) {
            enr.appointments.forEach(app => {
                const d = new Date(app.date);
                // Include Scheduled, Present, and Absent statuses as they represent a lesson that took place or was planned
                const isValidStatus = app.status === 'Present' || app.status === 'Scheduled' || app.status === 'Absent';
                
                if (d.getMonth() === month && d.getFullYear() === year && isValidStatus) {
                    const locId = app.locationId || enr.locationId;
                    if (locId && locId !== 'unassigned') {
                        if (!uniqueSessions.has(locId)) {
                            uniqueSessions.set(locId, new Set());
                        }
                        const sessionKey = `${d.toISOString().split('T')[0]}_${app.startTime}_${app.endTime}`;
                        uniqueSessions.get(locId)!.add(sessionKey);
                    }
                }
            });
        }
    });

    // B. Count from Manual Lessons
    lessons.forEach(l => {
        const d = new Date(l.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
            let locId = l.locationId;
            if (!locId) {
                for (const s of suppliers) {
                    const found = s.locations.find(loc => loc.name === l.locationName);
                    if (found) { locId = found.id; break; }
                }
            }
            if (locId) {
                if (!uniqueSessions.has(locId)) {
                    uniqueSessions.set(locId, new Set());
                }
                const sessionKey = `${d.toISOString().split('T')[0]}_${l.startTime}_${l.endTime}`;
                uniqueSessions.get(locId)!.add(sessionKey);
            }
        }
    });

    // Build Result
    const results: RentAnalysisResult[] = [];
    const monthLabel = `${year}-${String(month+1).padStart(2,'0')}`; // YYYY-MM

    for (const s of suppliers) {
        for (const loc of s.locations) {
            const usage = uniqueSessions.get(loc.id)?.size || 0;
            if (usage > 0) {
                const totalCost = usage * (loc.rentalCost || 0);
                
                // Check if already paid
                const isPaid = transactions.some(t => 
                    t.category === TransactionCategory.Nolo &&
                    t.allocationId === loc.id &&
                    t.relatedDocumentId === `AUTO-RENT-${monthLabel}-${loc.id}` &&
                    !t.isDeleted
                );

                results.push({
                    locationId: loc.id,
                    locationName: loc.name,
                    supplierName: s.companyName,
                    usageCount: usage,
                    unitCost: loc.rentalCost || 0,
                    totalCost: totalCost,
                    isPaid
                });
            }
        }
    }

    return results;
};

export const createRentTransactionsBatch = async (results: RentAnalysisResult[], date: string, monthLabel: string): Promise<void> => {
    const batch = writeBatch(db);
    const dateObj = new Date(date);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;

    results.forEach(res => {
        const ref = doc(transactionsCollectionRef);
        const t: TransactionInput = {
            date: date,
            description: `Nolo ${res.locationName} - ${monthLabel} (${res.usageCount} lezioni)`,
            amount: res.totalCost,
            type: TransactionType.Expense,
            category: TransactionCategory.Nolo,
            paymentMethod: PaymentMethod.BankTransfer,
            status: TransactionStatus.Pending, // Da pagare
            allocationType: 'location',
            allocationId: res.locationId,
            allocationName: res.locationName,
            isDeleted: false,
            relatedDocumentId: `AUTO-RENT-${monthKey}-${res.locationId}`
        };
        batch.set(ref, t);
    });

    await batch.commit();
};

export const deleteAutoRentTransactions = async (locationId: string): Promise<void> => {
    // Delete all auto-generated rent transactions for a location
    const q = query(transactionsCollectionRef, where('allocationId', '==', locationId), where('category', '==', 'Nolo'));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        if (d.data().relatedDocumentId?.startsWith('AUTO-RENT')) {
            batch.delete(d.ref);
        }
    });
    await batch.commit();
};

// --- NUMBERING UTILS ---
export const getNextDocumentNumber = async (collectionName: 'invoices', prefix: string, digits: number, dateRef: string): Promise<string> => {
    const year = new Date(dateRef).getFullYear();
    const q = query(collection(db, collectionName), where('issueDate', '>=', `${year}-01-01`), where('issueDate', '<=', `${year}-12-31`), orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    
    // Filter out ghosts and deleted
    const validDocs = snapshot.docs.filter(d => !d.data().isGhost && !d.data().isDeleted);
    
    // Find max number
    let maxNum = 0;
    validDocs.forEach(d => {
        const numStr = d.data().invoiceNumber;
        const parts = numStr.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    return `${prefix}-${year}-${String(maxNum + 1).padStart(digits, '0')}`;
};

export const getNextGhostInvoiceNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const q = query(invoicesCollectionRef, where('isGhost', '==', true), where('issueDate', '>=', `${year}-01-01`), orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    return `PRO-${year}-${String(count).padStart(3, '0')}`;
};

export const getInvoiceNumberGaps = async (year: number): Promise<InvoiceGap[]> => {
    const q = query(invoicesCollectionRef, where('issueDate', '>=', `${year}-01-01`), where('issueDate', '<=', `${year}-12-31`));
    const snapshot = await getDocs(q);
    const validInvoices = snapshot.docs.map(docToInvoice).filter(i => !i.isDeleted && !i.isGhost);
    
    const numbers = validInvoices.map(inv => {
        const parts = inv.invoiceNumber.split('-');
        return parseInt(parts[parts.length - 1], 10);
    }).filter(n => !isNaN(n)).sort((a,b) => a - b);

    const gaps: InvoiceGap[] = [];
    for (let i = 0; i < numbers.length - 1; i++) {
        if (numbers[i + 1] !== numbers[i] + 1) {
            for (let missing = numbers[i] + 1; missing < numbers[i+1]; missing++) {
                gaps.push({ number: missing });
            }
        }
    }
    return gaps;
};

export const isInvoiceNumberTaken = async (year: number, number: number): Promise<boolean> => {
    const numStr = String(number).padStart(3, '0');
    // Loose check on endswith
    const q = query(invoicesCollectionRef, where('issueDate', '>=', `${year}-01-01`), where('issueDate', '<=', `${year}-12-31`));
    const snapshot = await getDocs(q);
    return snapshot.docs.some(d => !d.data().isDeleted && !d.data().isGhost && d.data().invoiceNumber.endsWith(`-${numStr}`));
};

// --- ORPHAN LOGIC ---
export const getOrphanedFinancialsForClient = async (clientId: string) => {
    const [invSnap, transSnap] = await Promise.all([
        getDocs(query(invoicesCollectionRef, where('clientId', '==', clientId))),
        getDocs(query(transactionsCollectionRef))
    ]);

    const invoices = invSnap.docs.map(docToInvoice).filter(i => !i.isDeleted && !i.relatedEnrollmentId);
    
    // Fetch client to get name for transaction filtering
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId);
    const clientNames = client ? [client.clientType === 'parent' ? `${(client as any).firstName} ${(client as any).lastName}` : (client as any).companyName] : [];

    const transactions = transSnap.docs.map(docToTransaction).filter(t => 
        !t.isDeleted && 
        !t.relatedEnrollmentId && 
        t.type === TransactionType.Income && 
        clientNames.some(name => t.description.includes(name) || t.clientName === name)
    );

    return {
        orphanInvoices: invoices.filter(i => !i.isGhost),
        orphanGhosts: invoices.filter(i => i.isGhost),
        orphanTransactions: transactions
    };
};

export const linkFinancialsToEnrollment = async (enrollmentId: string, invoiceIds: string[], transactionIds: string[], adjustment?: { amount: number, notes: string }) => {
    const batch = writeBatch(db);
    const enrRef = doc(db, 'enrollments', enrollmentId);

    invoiceIds.forEach(id => {
        batch.update(doc(db, 'invoices', id), { relatedEnrollmentId: enrollmentId });
    });
    transactionIds.forEach(id => {
        batch.update(doc(db, 'transactions', id), { relatedEnrollmentId: enrollmentId });
    });

    if (adjustment) {
        batch.update(enrRef, {
            adjustmentAmount: adjustment.amount,
            adjustmentNotes: adjustment.notes
        });
    }

    await batch.commit();
};

export const createGhostInvoiceForEnrollment = async (enrollment: Enrollment, clientName: string, amount: number) => {
    const num = await getNextGhostInvoiceNumber();
    const inv: InvoiceInput = {
        invoiceNumber: num,
        issueDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        clientId: enrollment.clientId,
        clientName: clientName,
        items: [{
            description: `Saldo Iscrizione ${enrollment.childName}`,
            quantity: 1,
            price: amount,
            notes: 'Pro-forma di saldo'
        }],
        totalAmount: amount,
        status: DocumentStatus.Draft,
        isGhost: true,
        isDeleted: false,
        relatedEnrollmentId: enrollment.id,
        hasStampDuty: amount > 77.47,
        paymentMethod: PaymentMethod.BankTransfer
    };
    await addInvoice(inv);
};

export const reconcileTransactions = async () => {
    console.log("Reconciliation running...");
};

// NOTE: Now accepts enrollments/invoices/transactions/clients as arguments to avoid circular dependency
export const runFinancialHealthCheck = async (
    enrollments: Enrollment[], 
    invoices: Invoice[], 
    transactions: Transaction[], 
    clients: Client[]
): Promise<IntegrityIssue[]> => {
    const issues: IntegrityIssue[] = [];

    for (const enr of enrollments) {
        if (enr.status === EnrollmentStatus.Active && enr.price > 0) {
            const paidInv = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted && !i.isGhost).reduce((s, i) => s + i.totalAmount, 0);
            const paidTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted).reduce((s, t) => s + t.amount, 0);
            const totalPaid = paidInv + paidTrans + (enr.adjustmentAmount || 0);
            
            if (totalPaid < enr.price - 5) { // 5 eur tolerance
                
                // --- FIX: Resolve Parent Name ---
                const client = clients.find(c => c.id === enr.clientId);
                let parentName = 'N/D';
                if (client) {
                    if (client.clientType === ClientType.Parent) {
                        const p = client as ParentClient;
                        parentName = `${p.firstName} ${p.lastName}`;
                    } else {
                        const i = client as InstitutionalClient;
                        parentName = i.companyName;
                    }
                }
                // --------------------------------

                issues.push({
                    id: `health-${enr.id}`,
                    type: 'missing_invoice',
                    date: enr.startDate,
                    description: `Iscrizione Attiva ma non saldata: ${enr.childName}`,
                    entityName: enr.childName,
                    parentName: parentName, // Assigned
                    subscriptionName: enr.subscriptionName,
                    lessonsTotal: enr.lessonsTotal, // Added missing mapping for UI
                    amount: enr.price - totalPaid,
                    suggestions: [] 
                });
            }
        }
    }
    return issues;
};

export const fixIntegrityIssue = async (
    issue: IntegrityIssue, 
    strategy: 'invoice' | 'cash' | 'link', 
    manualNum?: string, 
    targetInvoiceIds?: string[], 
    adjustment?: { amount: number, notes: string }, 
    targetTransactionId?: string,
    forceDate?: string // NEW: Override Date parameter
) => {
    // 1. FISCAL YEAR CHECK
    // Determine target date for the check
    const targetDateToCheck = forceDate || issue.date;
    
    // If the year is closed AND no override date is provided, throw error
    if (!forceDate && await isYearClosed(targetDateToCheck)) {
        throw new Error("FISCAL_YEAR_CLOSED");
    }

    // 2. STRATEGY EXECUTION
    const finalDate = forceDate || issue.date; // Use override if present, else original

    if (strategy === 'link') {
        const enrId = issue.id.replace('health-', '');
        await linkFinancialsToEnrollment(enrId, targetInvoiceIds || [], targetTransactionId ? [targetTransactionId] : [], adjustment);
    } 
    else if (strategy === 'cash') {
        // Create Transaction
        // Need to fetch enrollment details or simulate enough info
        const transactionData: TransactionInput = {
            date: finalDate, // Use correct date
            description: `Sanatoria Cassa: ${issue.description}`,
            amount: issue.amount || 0,
            type: TransactionType.Income,
            category: TransactionCategory.Vendite,
            paymentMethod: PaymentMethod.Cash,
            status: TransactionStatus.Completed,
            allocationType: 'general',
            relatedEnrollmentId: issue.id.replace('health-', ''),
            isDeleted: false
        };
        await addTransaction(transactionData);
    }
    else if (strategy === 'invoice') {
        // Just create the invoice with the correct number/date
        // The FixWizard handles the number generation, here we just save?
        // Actually, 'invoice' strategy in FixWizard calls `onFix` with `manualNum`.
        // We need to construct a basic invoice.
        // This part is simplified, usually invoices need full items. 
        // For 'integrity fix', we assume a simple cover invoice.
        
        // This branch is usually handled by UI calling `addInvoice` directly or constructing object
        // But if routed here:
        if (!manualNum) throw new Error("Numero fattura mancante");
        
        const invoiceData: InvoiceInput = {
            invoiceNumber: manualNum,
            issueDate: finalDate,
            dueDate: finalDate,
            clientId: 'unknown', // Ideally passed or fetched
            clientName: issue.parentName || 'Cliente',
            status: DocumentStatus.Paid,
            paymentMethod: PaymentMethod.BankTransfer,
            items: [{
                description: `Rif. ${issue.description}`,
                quantity: 1,
                price: issue.amount || 0
            }],
            totalAmount: issue.amount || 0,
            hasStampDuty: (issue.amount || 0) > 77.47,
            isGhost: false,
            isDeleted: false,
            relatedEnrollmentId: issue.id.replace('health-', '')
        };
        // Need to fetch enrollment to get clientId really...
        // For simplicity, let's assume the calling code does better or we fetch.
        // Better to fetch enrollment to be safe:
        const enrId = issue.id.replace('health-', '');
        const enrRef = doc(db, 'enrollments', enrId);
        const enrSnap = await getDoc(enrRef);
        if (enrSnap.exists()) {
            invoiceData.clientId = enrSnap.data().clientId;
        }
        
        await addInvoice(invoiceData);
    }

    // 3. POST-VERIFICATION (DOUBLE CHECK)
    // Re-run health check logic for this specific enrollment to verify resolution
    const enrId = issue.id.replace('health-', '');
    const enrRef = doc(db, 'enrollments', enrId);
    const enrSnap = await getDoc(enrRef);
    
    if (enrSnap.exists()) {
        const enr = enrSnap.data() as Enrollment;
        // Fetch new state
        const qInv = query(invoicesCollectionRef, where('relatedEnrollmentId', '==', enrId));
        const qTrans = query(transactionsCollectionRef, where('relatedEnrollmentId', '==', enrId));
        const [invs, trans] = await Promise.all([getDocs(qInv), getDocs(qTrans)]);
        
        const paidInv = invs.docs.map(docToInvoice).filter(i => !i.isDeleted && !i.isGhost).reduce((s, i) => s + i.totalAmount, 0);
        const paidTrans = trans.docs.map(docToTransaction).filter(t => !t.isDeleted).reduce((s, t) => s + t.amount, 0);
        const totalPaid = paidInv + paidTrans + (enr.adjustmentAmount || 0);

        if (totalPaid < enr.price - 0.1) {
            // Still failing
            console.warn(`[FiscalDoctor] Verification Failed for ${enrId}. Gap remains: ${enr.price - totalPaid}`);
            // UI will likely reload issues and show it again, which is correct behavior (it didn't fix it).
            // Optionally, we could throw an error here to alert user "Fix Insufficient".
        }
    }
};

export const cleanupEnrollmentFinancials = async (enrollment: Enrollment) => {
    const batch = writeBatch(db);
    
    const qInv = query(invoicesCollectionRef, where('relatedEnrollmentId', '==', enrollment.id));
    const qTrans = query(transactionsCollectionRef, where('relatedEnrollmentId', '==', enrollment.id));
    
    const [invSnap, transSnap] = await Promise.all([getDocs(qInv), getDocs(qTrans)]);
    
    invSnap.forEach(d => batch.update(d.ref, { relatedEnrollmentId: null, notes: `Orphaned from deleted enrollment ${enrollment.childName}` }));
    transSnap.forEach(d => batch.update(d.ref, { relatedEnrollmentId: null }));
    
    await batch.commit();
};

export const anonymizeClientFinancials = async (clientId: string, clientName: string) => {
    const batch = writeBatch(db);
    
    // Anonymize invoices
    const qInv = query(invoicesCollectionRef, where('clientId', '==', clientId));
    const invSnap = await getDocs(qInv);
    invSnap.forEach(d => batch.update(d.ref, { clientName: 'Cliente Cancellato (GDPR)' }));
    
    // Anonymize quotes
    const qQuote = query(quotesCollectionRef, where('clientId', '==', clientId));
    const quoteSnap = await getDocs(qQuote);
    quoteSnap.forEach(d => batch.update(d.ref, { clientName: 'Cliente Cancellato (GDPR)' }));

    // Anonymize transactions by clientName
    if (clientName) {
        const qTrans = query(transactionsCollectionRef, where('clientName', '==', clientName));
        const transSnap = await getDocs(qTrans);
        transSnap.forEach(d => batch.update(d.ref, { clientName: 'Cliente Cancellato (GDPR)' }));
    }
    
    await batch.commit();
};

export const markInvoicesAsPaid = async (invoiceIds: string[]) => {
    const batch = writeBatch(db);
    invoiceIds.forEach(id => {
        batch.update(doc(db, 'invoices', id), { status: DocumentStatus.Paid });
    });
    await batch.commit();
};

export const checkAndSetOverdueInvoices = async () => {
    const today = new Date();
    const q = query(invoicesCollectionRef, where('status', 'in', [DocumentStatus.Sent, DocumentStatus.Draft]));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach(d => {
        const inv = d.data() as Invoice;
        if (new Date(inv.dueDate) < today) {
            batch.update(d.ref, { status: DocumentStatus.Overdue });
            count++;
        }
    });
    if (count > 0) await batch.commit();
};
