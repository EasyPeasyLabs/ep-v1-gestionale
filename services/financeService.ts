
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch, runTransaction, getDoc } from 'firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus, Enrollment, Supplier, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Appointment, IntegrityIssue, IntegrityIssueSuggestion, EnrollmentStatus, FiscalYear, ClientType, ParentClient, InstitutionalClient } from '../types';
import { getAllEnrollments, getActiveLocationForClient } from './enrollmentService';
import { getSuppliers } from './supplierService';
import { getClients } from './parentService';
import { checkFiscalLock, getFiscalYears } from './fiscalYearService';
import { getLessons } from './calendarService'; // NEW IMPORT

// --- Transactions ---
const transactionCollectionRef = collection(db, 'transactions');
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => {
    const data = doc.data();
    return { 
        id: doc.id, 
        ...data,
        amount: Number(data.amount || 0), // Casting esplicito
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
    await checkFiscalLock(transaction.date);
    const dataToSave = {
        ...transaction,
        amount: Number(transaction.amount),
        status: transaction.status || TransactionStatus.Completed,
        isDeleted: false
    };
    const docRef = await addDoc(transactionCollectionRef, dataToSave);
    return docRef.id;
};

export const updateTransaction = async (id: string, transaction: Partial<TransactionInput>): Promise<void> => {
    const docRef = doc(db, 'transactions', id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        await checkFiscalLock(snap.data().date);
    }
    if (transaction.date) {
        await checkFiscalLock(transaction.date);
    }
    // Cast amount if present
    const dataToUpdate = { ...transaction };
    if (dataToUpdate.amount !== undefined) dataToUpdate.amount = Number(dataToUpdate.amount);
    
    await updateDoc(docRef, dataToUpdate);
};

export const deleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    await updateDoc(transactionDoc, { isDeleted: true });
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
        where("category", "==", TransactionCategory.Nolo),
        where("relatedDocumentId", ">=", "AUTO-RENT")
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

// --- Invoices ---
const invoiceCollectionRef = collection(db, 'invoices');
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        totalAmount: Number(data.totalAmount || 0), // Casting esplicito
        isDeleted: data.isDeleted || false,
        isGhost: data.isGhost || false
    } as Invoice;
};

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(invoiceCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const addInvoice = async (invoice: InvoiceInput): Promise<{id: string, invoiceNumber: string}> => {
    await checkFiscalLock(invoice.issueDate);
    let invoiceNumber = invoice.invoiceNumber;
    if (!invoiceNumber) {
        if (invoice.isGhost) {
            invoiceNumber = await getNextGhostInvoiceNumber();
        } else {
            invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3, invoice.issueDate);
        }
    }
    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, totalAmount: Number(invoice.totalAmount), invoiceNumber, isDeleted: false });
    return { id: docRef.id, invoiceNumber };
};

export const updateInvoice = async (id: string, invoice: Partial<InvoiceInput>): Promise<void> => {
    const docRef = doc(db, 'invoices', id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        const currentData = snap.data();
        await checkFiscalLock(currentData.issueDate);
    }
    if (invoice.issueDate) {
        await checkFiscalLock(invoice.issueDate);
    }
    const dataToUpdate = { ...invoice };
    if (dataToUpdate.totalAmount !== undefined) dataToUpdate.totalAmount = Number(dataToUpdate.totalAmount);

    await updateDoc(docRef, dataToUpdate);
};

export const deleteInvoice = async (id: string): Promise<void> => {
    const docRef = doc(db, 'invoices', id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        await checkFiscalLock(snap.data().issueDate);
        if (snap.data().status === DocumentStatus.SealedSDI) {
            throw new Error("IMPOSSIBILE ELIMINARE: La fattura è sigillata SDI.");
        }
    }
    await updateDoc(docRef, { isDeleted: true });
};

export const markInvoicesAsPaid = async (invoiceIds: string[]): Promise<void> => {
    if (invoiceIds.length === 0) return;
    const chunkSize = 450; 
    for (let i = 0; i < invoiceIds.length; i += chunkSize) {
        const chunk = invoiceIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(id => {
            const docRef = doc(db, 'invoices', id);
            batch.update(docRef, { status: DocumentStatus.Paid });
        });
        await batch.commit();
    }
};

// --- RICONCILIAZIONE POTENZIATA (AI-Like Scan) ---
export const reconcileTransactions = async (): Promise<string> => {
    const [allTransactions, allInvoices] = await Promise.all([
        getTransactions(), 
        getInvoices()
    ]);
    const invoiceMap = new Map(allInvoices.map(i => [i.id, i]));
    const invoiceNumberMap = new Map(allInvoices.map(i => [i.invoiceNumber, i]));
    
    const updates: { ref: any, data: any }[] = [];
    let updatedCount = 0;
    let autoLinkedCount = 0;
    let orphansCount = 0;

    // Pattern regex per trovare numeri fattura tipo FT-2025-010 o FT2025010
    const invoiceRegex = /FT[-]?\d{4}[-]?\d{3,}/i;

    for (const t of allTransactions) {
        if (t.isDeleted) continue;
        if (t.relatedDocumentId?.startsWith('AUTO-RENT')) continue;
        if (t.relatedDocumentId?.startsWith('ENR-')) continue; 

        // CASO 1: Già collegata -> Aggiorna metadati se necessario
        if (t.relatedDocumentId) {
            const invoice = invoiceMap.get(t.relatedDocumentId);
            if (invoice) {
                const invoiceNum = invoice.invoiceNumber || 'N/D';
                const expectedDesc = `incasso fattura n. ${invoiceNum} - ${invoice.clientName}`;
                const currentDesc = (t.description || '').trim();
                const targetDesc = expectedDesc.trim();
                if (currentDesc !== targetDesc || t.clientName !== invoice.clientName) {
                    const docRef = doc(db, 'transactions', t.id);
                    updates.push({ ref: docRef, data: { description: targetDesc, clientName: invoice.clientName } });
                    updatedCount++;
                }
            } else {
                if (!t.description.startsWith("⚠️ ORFANA")) {
                    const docRef = doc(db, 'transactions', t.id);
                    const orphanDesc = `⚠️ ORFANA - Doc Mancante (ID: ${t.relatedDocumentId})`;
                    updates.push({ ref: docRef, data: { description: orphanDesc } });
                    orphansCount++;
                }
            }
        } 
        // CASO 2: Orfana -> Prova a scoprire il legame tramite testo
        else if (t.type === TransactionType.Income) {
            const match = t.description.match(invoiceRegex);
            if (match) {
                let foundInvoiceNum = match[0].toUpperCase();
                // Normalizza se mancano i trattini (es FT2025010 -> FT-2025-010)
                if (!foundInvoiceNum.includes('-')) {
                    foundInvoiceNum = `FT-${foundInvoiceNum.substring(2,6)}-${foundInvoiceNum.substring(6)}`;
                }

                const linkedInv = invoiceNumberMap.get(foundInvoiceNum);
                // Verifica importo (tolleranza 2€ per bolli virtuali o piccoli arrotondamenti)
                if (linkedInv && Math.abs(Number(linkedInv.totalAmount) - Number(t.amount)) <= 2.01) {
                    const docRef = doc(db, 'transactions', t.id);
                    updates.push({ 
                        ref: docRef, 
                        data: { 
                            relatedDocumentId: linkedInv.id,
                            relatedEnrollmentId: linkedInv.relatedEnrollmentId || null,
                            clientName: linkedInv.clientName 
                        } 
                    });
                    autoLinkedCount++;
                }
            }
        }
    }

    if (updates.length > 0) {
        const chunkSize = 450;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(u => batch.update(u.ref, u.data));
            await batch.commit();
        }
    }
    return `Riconciliazione completata.\n• Aggiornate: ${updatedCount}\n• Auto-collegate: ${autoLinkedCount}\n• Orfane: ${orphansCount}`;
};

// --- HELPER: Subset Sum Algorithm (Cluster Matching con Fuzzy logic e Deduplicazione) ---
function findCandidateClusters(invoices: Invoice[], target: number, maxGap: number = 35): IntegrityIssueSuggestion[] {
    const results: IntegrityIssueSuggestion[] = [];
    
    const uniqueContentMap = new Map<string, Invoice>();
    invoices.forEach(inv => {
        const key = `${inv.invoiceNumber}|${inv.issueDate}|${Number(inv.totalAmount).toFixed(2)}`;
        if (!uniqueContentMap.has(key)) {
            uniqueContentMap.set(key, inv);
        }
    });

    const uniqueInvoices = Array.from(uniqueContentMap.values());
    const len = uniqueInvoices.length;
    const limit = Math.min(len, 12); 

    for (let i = 1; i < (1 << limit); i++) {
        const subset: Invoice[] = [];
        let sum = 0;
        for (let j = 0; j < limit; j++) {
            if ((i >> j) & 1) {
                subset.push(uniqueInvoices[j]);
                sum += Number(Number(uniqueInvoices[j].totalAmount).toFixed(2));
            }
        }
        
        const gap = Number((target - sum).toFixed(2));
        const absGap = Math.abs(gap);

        if (absGap < 0.05) {
            results.push({ invoices: subset, isPerfect: true, gap: 0 });
        } 
        else if (gap > 0 && (gap <= maxGap || sum >= target * 0.8)) {
            results.push({ invoices: subset, isPerfect: false, gap: gap });
        }
    }

    const finalResults: IntegrityIssueSuggestion[] = [];
    const seenCombos = new Set<string>();

    results.sort((a,b) => (a.isPerfect === b.isPerfect) ? (a.gap - b.gap) : (a.isPerfect ? -1 : 1))
    .forEach(res => {
        const comboKey = res.invoices.map(inv => inv.id).sort().join('|');
        if (!seenCombos.has(comboKey)) {
            finalResults.push(res);
            seenCombos.add(comboKey);
        }
    });

    return finalResults;
}

export const runFinancialHealthCheck = async (): Promise<IntegrityIssue[]> => {
    // ... (unchanged) ...
    const [enrollments, invoices, transactions, clients, fiscalYears] = await Promise.all([
        getAllEnrollments(),
        getInvoices(),
        getTransactions(),
        getClients(),
        getFiscalYears()
    ]);

    const closedYears = new Set(fiscalYears.filter(y => y.status === 'CLOSED').map(y => y.year));
    const issues: IntegrityIssue[] = [];

    const clientMap = new Map<string, string>();
    clients.forEach(c => {
        const name = c.clientType === ClientType.Parent 
            ? `${(c as ParentClient).lastName || ''} ${(c as ParentClient).firstName || ''}` 
            : (c as InstitutionalClient).companyName;
        clientMap.set(c.id, name.trim());
    });

    const activeInvoices = invoices.filter(i => !i.isDeleted);
    const activeTransactions = transactions.filter(t => !t.isDeleted && t.type === TransactionType.Income);

    // 1. VERIFICA COPERTURA FISCALE (Fatture mancanti per Iscrizioni)
    enrollments.forEach(enr => {
        const startYear = new Date(enr.startDate).getFullYear();
        if (closedYears.has(startYear)) return;

        if (enr.status === EnrollmentStatus.Active || enr.status === EnrollmentStatus.Pending) {
            const linkedDocs = activeInvoices.filter(inv => inv.relatedEnrollmentId === enr.id);
            const totalCoveredAmount = Number(linkedDocs.reduce((sum, inv) => sum + Number(Number(inv.totalAmount).toFixed(2)), 0).toFixed(2));
            const linkedCash = activeTransactions.filter(t => t.relatedEnrollmentId === enr.id || t.relatedDocumentId === `ENR-${enr.id}`);
            const cashAmount = Number(linkedCash.reduce((sum, t) => sum + Number(Number(t.amount).toFixed(2)), 0).toFixed(2));
            const adjustment = Number(Number(enr.adjustmentAmount || 0).toFixed(2));
            
            const totalDetectedCoverage = Number((Math.max(totalCoveredAmount, cashAmount) + adjustment).toFixed(2));
            const enrollmentPrice = Number(Number(enr.price || 0).toFixed(2));
            const missingAmount = Number((enrollmentPrice - totalDetectedCoverage).toFixed(2));

            if (missingAmount > 0.1) {
                const enrStart = new Date(enr.startDate);
                const enrEnd = new Date(enr.endDate);
                const bufferDays = 45 * 24 * 60 * 60 * 1000; 
                
                const clientOrphans = activeInvoices.filter(inv => 
                    !inv.relatedEnrollmentId && 
                    inv.clientId === enr.clientId &&
                    new Date(inv.issueDate).getTime() >= enrStart.getTime() - bufferDays &&
                    new Date(inv.issueDate).getTime() <= enrEnd.getTime() + bufferDays
                );

                const suggestions = findCandidateClusters(clientOrphans, Number((enrollmentPrice - adjustment).toFixed(2)));

                const orphansTrans = activeTransactions.filter(t => 
                    !t.relatedDocumentId && 
                    !t.relatedEnrollmentId &&
                    Math.abs(Number(t.amount) - missingAmount) <= 1.0 && // Match importo (fuzzy)
                    (
                        (t.clientName && clientMap.get(enr.clientId) && t.clientName.toLowerCase().includes(clientMap.get(enr.clientId)!.toLowerCase())) ||
                        (t.description && clientMap.get(enr.clientId) && t.description.toLowerCase().includes(clientMap.get(enr.clientId)!.toLowerCase())) ||
                        (t.description && enr.childName && t.description.toLowerCase().includes(enr.childName.toLowerCase()))
                    )
                );

                orphansTrans.forEach(t => {
                    const tDate = new Date(t.date);
                    const diffTime = Math.abs(tDate.getTime() - enrStart.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isConfident = diffDays <= 45;
                    
                    suggestions.push({
                        invoices: [], 
                        transactionDetails: t,
                        isPerfect: isConfident,
                        gap: 0
                    });
                });

                issues.push({
                    id: `miss-inv-${enr.id}`,
                    type: 'missing_invoice',
                    severity: 'high',
                    description: `Scoperto Fiscale: ${enr.childName}`,
                    entityId: enr.id,
                    entityName: enr.childName,
                    parentName: clientMap.get(enr.clientId) || 'Genitore N/D',
                    subscriptionName: enr.subscriptionName,
                    amount: missingAmount,
                    date: enr.startDate,
                    endDate: enr.endDate,
                    lessonsTotal: enr.lessonsTotal,
                    createdAt: enr.createdAt || enr.startDate,
                    paymentMethod: enr.preferredPaymentMethod || PaymentMethod.BankTransfer,
                    suggestions: suggestions.length > 0 ? suggestions : undefined,
                    details: { enrollment: enr, clientName: clientMap.get(enr.clientId) }
                });
            }
        }
    });

    activeInvoices.filter(i => !i.isGhost && !i.isDeleted).forEach(inv => {
        const invYear = new Date(inv.issueDate).getFullYear();
        if (closedYears.has(invYear)) return;

        if (inv.status === DocumentStatus.Paid || inv.status === DocumentStatus.SealedSDI) {
            const hasTransaction = activeTransactions.some(t => t.relatedDocumentId === inv.id);
            if (!hasTransaction) {
                const linkedEnr = enrollments.find(e => e.id === inv.relatedEnrollmentId);

                const orphanTransactions = activeTransactions.filter(t => 
                    !t.relatedDocumentId && 
                    Math.abs(Number(t.amount) - Number(inv.totalAmount)) <= 2.01 &&
                    (t.description.includes(inv.invoiceNumber) || t.clientName === inv.clientName)
                );

                const suggestions: IntegrityIssueSuggestion[] = orphanTransactions.map(t => ({
                    invoices: [inv], 
                    isPerfect: Math.abs(Number(t.amount) - Number(inv.totalAmount)) < 0.1,
                    gap: Number((Number(inv.totalAmount) - Number(t.amount)).toFixed(2)),
                    transactionDetails: t 
                }));

                issues.push({
                    id: `miss-trans-${inv.id}`,
                    type: 'missing_transaction',
                    severity: 'medium',
                    description: `Fattura senza Cassa: ${inv.invoiceNumber}`,
                    entityId: inv.id,
                    entityName: linkedEnr?.childName || 'Soggetto N/D',
                    parentName: inv.clientName,
                    subscriptionName: linkedEnr?.subscriptionName || 'Documento Orfano',
                    amount: Number(inv.totalAmount) || 0,
                    date: inv.issueDate,
                    paymentMethod: inv.paymentMethod,
                    createdAt: inv.issueDate, 
                    suggestions: suggestions.length > 0 ? (suggestions as any) : undefined,
                    details: { invoice: inv }
                });
            }
        }
    });

    return issues;
};

export const linkFinancialsToEnrollment = async (
    enrollmentId: string, 
    invoiceIds: string[], 
    transactionIds: string[], 
    adjustment: { amount: number, notes: string }
): Promise<void> => {
    const enrRef = doc(db, 'enrollments', enrollmentId);
    const enrSnap = await getDoc(enrRef);
    if (!enrSnap.exists()) throw new Error("Iscrizione non trovata.");
    const enrData = enrSnap.data() as Enrollment;

    const batch = writeBatch(db);

    // 1. Collega Fatture
    for (const invId of invoiceIds) {
        const invRef = doc(db, 'invoices', invId);
        batch.update(invRef, { relatedEnrollmentId: enrollmentId });
    }

    // 2. Collega Transazioni
    for (const trnId of transactionIds) {
        const trnRef = doc(db, 'transactions', trnId);
        batch.update(trnRef, { 
            relatedEnrollmentId: enrollmentId,
            allocationId: enrData.locationId !== 'unassigned' ? enrData.locationId : undefined,
            allocationName: enrData.locationName !== 'Sede Non Definita' ? enrData.locationName : undefined
        });
    }

    // 3. Aggiorna Iscrizione con Abbuono
    const updates: Partial<Enrollment> = {
        adjustmentAmount: Number(adjustment.amount.toFixed(2)),
        adjustmentNotes: adjustment.notes
    };

    if (enrData.status === EnrollmentStatus.Pending) {
        updates.status = EnrollmentStatus.Active;
    }

    batch.update(enrRef, updates);
    await batch.commit();
};

export const getOrphanedFinancialsForClient = async (clientId: string) => {
    const [allInvoices, allTransactions] = await Promise.all([
        getInvoices(),
        getTransactions()
    ]);

    const orphanInvoices = allInvoices.filter(i => 
        !i.isDeleted && 
        !i.isGhost && 
        i.clientId === clientId && 
        !i.relatedEnrollmentId
    );

    const orphanGhosts = allInvoices.filter(i =>
        !i.isDeleted &&
        i.isGhost &&
        i.clientId === clientId &&
        !i.relatedEnrollmentId
    );

    const orphanTransactions = allTransactions.filter(t => 
        !t.isDeleted && 
        t.type === TransactionType.Income &&
        t.category !== TransactionCategory.Capitale &&
        !t.relatedEnrollmentId &&
        // Proviamo a matchare per nome cliente se disponibile, altrimenti resta orfana pura
        (t.clientName?.toLowerCase().includes(clientId.toLowerCase()) || !t.clientName) 
    );

    return { orphanInvoices, orphanTransactions, orphanGhosts };
};

export const createGhostInvoiceForEnrollment = async (enrollment: Enrollment, clientName: string, amount: number): Promise<void> => {
    const ghostNumber = await getNextGhostInvoiceNumber();
    const formattedEnrDate = new Date(enrollment.startDate).toLocaleDateString('it-IT');
    const desc = `Saldo residuo Iscrizione di: ${enrollment.childName} del ${formattedEnrDate} per ${enrollment.subscriptionName} Sede: ${enrollment.locationName}`;

    const ghostInvoice: InvoiceInput = {
        clientId: enrollment.clientId,
        clientName: clientName,
        issueDate: new Date().toISOString(),
        dueDate: enrollment.endDate,
        status: DocumentStatus.Draft,
        paymentMethod: PaymentMethod.BankTransfer,
        relatedEnrollmentId: enrollment.id,
        items: [{ 
            description: desc, 
            quantity: 1, 
            price: amount, 
            notes: "Documento pro-forma generato manualmente dal wizard di riconciliazione." 
        }],
        totalAmount: amount,
        hasStampDuty: amount > 77.47,
        isGhost: true,
        invoiceNumber: ghostNumber,
        isDeleted: false
    };

    await addDoc(invoiceCollectionRef, ghostInvoice);
};

export const linkInvoicesToEnrollment = async (invoiceIds: string[], enrollmentId: string, adjustment?: { amount: number, notes: string }): Promise<void> => {
    const [enrSnap, allTransactions] = await Promise.all([
        getDoc(doc(db, 'enrollments', enrollmentId)),
        getTransactions()
    ]);

    if (!enrSnap.exists()) throw new Error("Iscrizione non trovata.");
    const enrData = enrSnap.data() as Enrollment;

    const batch = writeBatch(db);

    for (const invId of invoiceIds) {
        const invoiceRef = doc(db, 'invoices', invId);
        batch.update(invoiceRef, { relatedEnrollmentId: enrollmentId });

        const relatedTrans = allTransactions.filter(t => t.relatedDocumentId === invId && !t.isDeleted);
        relatedTrans.forEach(t => {
            const transRef = doc(db, 'transactions', t.id);
            batch.update(transRef, {
                relatedEnrollmentId: enrollmentId,
                allocationId: enrData.locationId !== 'unassigned' ? enrData.locationId : t.allocationId,
                allocationName: enrData.locationName !== 'Sede Non Definita' ? enrData.locationName : t.allocationName
            });
        });
    }

    const enrollmentUpdates: Partial<Enrollment> = {};
    if (adjustment && adjustment.amount > 0) {
        enrollmentUpdates.adjustmentAmount = Number((Number(enrData.adjustmentAmount || 0) + Number(adjustment.amount)).toFixed(2));
        enrollmentUpdates.adjustmentNotes = (enrData.adjustmentNotes ? enrData.adjustmentNotes + " | " : "") + adjustment.notes;
    }

    if (enrData.status === EnrollmentStatus.Pending) {
        enrollmentUpdates.status = EnrollmentStatus.Active;
    }

    if (Object.keys(enrollmentUpdates).length > 0) {
        batch.update(enrSnap.ref, enrollmentUpdates);
    }

    await batch.commit();
};

export interface InvoiceGap {
    number: number;
    year: number;
    recommended: boolean;
    prevDate?: string;
    nextDate?: string;
}

export const getInvoiceNumberGaps = async (targetYear: number): Promise<InvoiceGap[]> => {
    const allInvoices = await getInvoices();
    const yearInvoices = allInvoices
        .filter(i => !i.isDeleted && !i.isGhost && new Date(i.issueDate).getFullYear() === targetYear)
        .sort((a,b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());

    const numbersData = yearInvoices.map(inv => {
        const parts = inv.invoiceNumber.split('-');
        const n = parseInt(parts[parts.length - 1], 10);
        return { n, date: inv.issueDate };
    }).filter(x => !isNaN(x.n)).sort((a,b) => a.n - b.n);

    const gaps: InvoiceGap[] = [];
    if (numbersData.length === 0) return gaps;

    for (let i = 0; i < numbersData.length - 1; i++) {
        if (numbersData[i+1].n !== numbersData[i].n + 1) {
            for (let m = numbersData[i].n + 1; m < numbersData[i+1].n; m++) {
                gaps.push({
                    number: m,
                    year: targetYear,
                    recommended: false,
                    prevDate: numbersData[i].date,
                    nextDate: numbersData[i+1].date
                });
            }
        }
    }
    if (numbersData[0].n > 1) {
        for (let m = 1; m < numbersData[0].n; m++) {
            gaps.push({ number: m, year: targetYear, recommended: false, nextDate: numbersData[0].date });
        }
    }
    return gaps;
};

export const isInvoiceNumberTaken = async (year: number, num: number): Promise<boolean> => {
    const all = await getInvoices();
    const targetSuffix = String(num).padStart(3, '0');
    const targetPrefix = `FT-${year}`;
    return all.some(i => !i.isDeleted && i.invoiceNumber.startsWith(targetPrefix) && i.invoiceNumber.endsWith(targetSuffix));
};

export const fixIntegrityIssue = async (issue: IntegrityIssue, strategy: 'invoice' | 'cash' | 'link' = 'invoice', manualInvoiceNumber?: string, targetInvoiceIds?: string[], adjustment?: { amount: number, notes: string }, targetTransactionId?: string): Promise<void> => {
    // ... (unchanged fix logic) ...
    if (strategy === 'link' && issue.type === 'missing_transaction' && targetTransactionId) {
        const inv = issue.details.invoice as Invoice;
        const transRef = doc(db, 'transactions', targetTransactionId);
        await updateDoc(transRef, {
            relatedDocumentId: inv.id,
            relatedEnrollmentId: inv.relatedEnrollmentId || null,
            clientName: inv.clientName
        });
        return;
    }
    if (strategy === 'link' && issue.type === 'missing_invoice' && targetTransactionId) {
        await linkFinancialsToEnrollment(issue.entityId, [], [targetTransactionId], { amount: 0, notes: '' });
        return;
    }
    if (strategy === 'link' && targetInvoiceIds && targetInvoiceIds.length > 0) {
        await linkInvoicesToEnrollment(targetInvoiceIds, issue.entityId, adjustment);
        return;
    }
    if (issue.type === 'missing_invoice') {
        const enr = issue.details.enrollment as Enrollment;
        const clientName = issue.details.clientName || 'Cliente';
        const finalAmount = Number(issue.amount) || 0; 
        const competenceDate = enr.startDate;
        if (strategy === 'invoice') {
            const invoiceInput: InvoiceInput = {
                invoiceNumber: manualInvoiceNumber || '',
                issueDate: competenceDate,
                dueDate: competenceDate,
                clientId: enr.clientId,
                clientName: clientName,
                relatedEnrollmentId: enr.id,
                items: [{ description: `Pagamento Iscrizione: ${enr.childName}`, quantity: 1, price: finalAmount }],
                totalAmount: finalAmount,
                status: DocumentStatus.Paid,
                paymentMethod: enr.preferredPaymentMethod || PaymentMethod.BankTransfer,
                hasStampDuty: finalAmount > 77.47,
                isGhost: false,
                isDeleted: false
            };
            const res = await addInvoice(invoiceInput);
            const transInput: TransactionInput = {
                date: competenceDate,
                description: `incasso fattura n. ${res.invoiceNumber} - ${clientName}`,
                amount: finalAmount,
                type: TransactionType.Income,
                category: TransactionCategory.Vendite,
                paymentMethod: invoiceInput.paymentMethod,
                status: TransactionStatus.Completed,
                relatedDocumentId: res.id,
                relatedEnrollmentId: enr.id,
                allocationType: enr.locationId !== 'unassigned' ? 'location' : 'general',
                allocationId: enr.locationId !== 'unassigned' ? enr.locationId : undefined,
                allocationName: enr.locationName,
                isDeleted: false
            };
            await addTransaction(transInput);
        } else if (strategy === 'cash') {
            const transInput: TransactionInput = {
                date: competenceDate,
                description: `Incasso Iscrizione (No Doc) - ${enr.childName}`,
                amount: finalAmount,
                type: TransactionType.Income,
                category: TransactionCategory.Vendite,
                paymentMethod: PaymentMethod.Cash, 
                status: TransactionStatus.Completed,
                relatedDocumentId: `ENR-${enr.id}`,
                relatedEnrollmentId: enr.id,
                allocationType: enr.locationId !== 'unassigned' ? 'location' : 'general',
                allocationId: enr.locationId !== 'unassigned' ? enr.locationId : undefined,
                allocationName: enr.locationName,
                isDeleted: false
            };
            await addTransaction(transInput);
        }
    } else if (issue.type === 'missing_transaction') {
        const inv = issue.details.invoice as Invoice;
        let allocId: string | undefined = undefined;
        let allocName: string | undefined = undefined;
        if (inv.clientId) {
            const loc = await getActiveLocationForClient(inv.clientId);
            if (loc) { allocId = loc.id; allocName = loc.name; }
        }
        const transInput: TransactionInput = {
            date: inv.issueDate,
            description: `incasso fattura n. ${inv.invoiceNumber} - ${inv.clientName}`,
            amount: Number(inv.totalAmount) || 0,
            type: TransactionType.Income,
            category: TransactionCategory.Vendite,
            paymentMethod: inv.paymentMethod,
            status: TransactionStatus.Completed,
            relatedDocumentId: inv.id,
            relatedEnrollmentId: inv.relatedEnrollmentId,
            clientName: inv.clientName,
            allocationType: allocId ? 'location' : 'general',
            allocationId: allocId,
            allocationName: allocName,
            isDeleted: false
        };
        await addTransaction(transInput);
    }
};

export const getQuotes = async (): Promise<Quote[]> => {
    const q = query(collection(db, 'quotes'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), isDeleted: d.data().isDeleted || false } as Quote)).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
};

export const addQuote = async (quote: QuoteInput) => {
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4, quote.issueDate);
    const docRef = await addDoc(collection(db, 'quotes'), { ...quote, quoteNumber, isDeleted: false });
    return docRef.id;
};

export const updateQuote = async (id: string, quote: Partial<QuoteInput>) => {
    await updateDoc(doc(db, 'quotes', id), quote);
};

export const deleteQuote = async (id: string) => {
    await updateDoc(doc(db, 'quotes', id), { isDeleted: true });
};

export const permanentDeleteQuote = async (id: string) => {
    await deleteDoc(doc(db, 'quotes', id));
};

export const convertQuoteToInvoice = async (quoteId: string) => {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error("Preventivo non trovato");
    const quote = quoteSnap.data() as Quote;
    const today = new Date().toISOString();
    const invoiceInput: InvoiceInput = { invoiceNumber: '', issueDate: today, dueDate: today, clientId: quote.clientId, clientName: quote.clientName, items: quote.items, totalAmount: quote.totalAmount, status: DocumentStatus.Paid, paymentMethod: PaymentMethod.BankTransfer, hasStampDuty: quote.totalAmount > 77.47, isGhost: false, isDeleted: false, relatedQuoteNumber: quote.quoteNumber };
    const newInvoice = await addInvoice(invoiceInput);
    await updateDoc(quoteRef, { status: DocumentStatus.Sent }); 
    return newInvoice.id;
};

export const getNextDocumentNumber = async (collectionName: 'invoices' | 'quotes', prefix: string, pad: number, dateStr: string): Promise<string> => {
    const year = new Date(dateStr).getFullYear();
    const startOfYear = new Date(year, 0, 1).toISOString();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString();
    const colRef = collection(db, collectionName);
    const q = query(colRef, where("issueDate", ">=", startOfYear), where("issueDate", "<=", endOfYear));
    const snapshot = await getDocs(q);
    let maxNum = 0;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (collectionName === 'invoices' && data.isGhost) return;
        const numStr = collectionName === 'invoices' ? data.invoiceNumber : data.quoteNumber;
        if (numStr && numStr.includes(prefix)) {
            const parts = numStr.split('-'); 
            if (parts.length >= 3) {
                if (parts[1] === String(year)) {
                    const n = parseInt(parts[2], 10);
                    if (!isNaN(n) && n > maxNum) maxNum = n;
                }
            }
        }
    });
    const nextNum = maxNum + 1;
    return `${prefix}-${year}-${String(nextNum).padStart(pad, '0')}`;
};

export const getNextGhostInvoiceNumber = async (): Promise<string> => {
    return `PRO-xxx-${Date.now().toString().slice(-4)}`; 
};

export const cleanupEnrollmentFinancials = async (enrollment: Enrollment): Promise<void> => {
    const enrId = enrollment.id;
    if (!enrId) return;
    const batch = writeBatch(db);
    let count = 0;
    const qTransById = query(transactionCollectionRef, where("relatedEnrollmentId", "==", enrId), where("isDeleted", "==", false));
    const transSnapById = await getDocs(qTransById);
    transSnapById.docs.forEach(doc => { batch.update(doc.ref, { isDeleted: true }); count++; });
    const qInvById = query(invoiceCollectionRef, where("relatedEnrollmentId", "==", enrId), where("isDeleted", "==", false));
    const invSnapById = await getDocs(qInvById);
    invSnapById.docs.forEach(doc => { batch.update(doc.ref, { isDeleted: true }); count++; });
    if (count > 0) await batch.commit();
};

export const syncRentExpenses = async (targetMonth?: number, targetYear?: number): Promise<string> => {
    const [enrollments, suppliers, lessons] = await Promise.all([
        getAllEnrollments(),
        getSuppliers(),
        getLessons()
    ]);

    const locationCostMap = new Map<string, { cost: number, supplierName: string }>();
    const now = new Date();
    const month = targetMonth !== undefined ? targetMonth : now.getMonth();
    const year = targetYear !== undefined ? targetYear : now.getFullYear();
    
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const competenceMonthLabel = `${String(month + 1).padStart(2, '0')}/${year}`;

    suppliers.forEach(s => { 
        s.locations.forEach(l => { 
            const isClosedAlready = l.closedAt && new Date(l.closedAt) < new Date(startOfMonth); 
            if (!isClosedAlready) { 
                locationCostMap.set(l.id, { cost: l.rentalCost || 0, supplierName: s.companyName }); 
            } 
        }); 
    });

    const q = query(transactionCollectionRef, 
        where("category", "==", TransactionCategory.Nolo), 
        where("date", ">=", startOfMonth), 
        where("date", "<=", endOfMonth), 
        where("isDeleted", "==", false)
    );
    const existingRents = await getDocs(q);
    const paidLocationIds = new Set<string>();
    existingRents.docs.forEach(d => { 
        const t = d.data() as Transaction; 
        if (t.allocationId) paidLocationIds.add(t.allocationId); 
    });

    const occupiedLocationIds = new Set<string>();
    
    // 1. Check Standard Enrollments
    enrollments.forEach(e => { 
        if (e.appointments && e.locationId && e.locationId !== 'unassigned') {
            const hasPresenceInPeriod = e.appointments.some(app => {
                const appDate = new Date(app.date);
                return app.status === 'Present' && 
                       appDate >= new Date(startOfMonth) && 
                       appDate <= new Date(endOfMonth);
            });
            if (hasPresenceInPeriod) {
                occupiedLocationIds.add(e.locationId);
            }
        } 
    });

    // 2. Check Manual Lessons (Institutional or Extra)
    lessons.forEach(l => {
        const lDate = new Date(l.date);
        if (lDate >= new Date(startOfMonth) && lDate <= new Date(endOfMonth)) {
             // Find matching location ID from name
             for (const s of suppliers) {
                 const loc = s.locations.find(loc => loc.name === l.locationName);
                 if (loc) {
                     occupiedLocationIds.add(loc.id);
                     break;
                 }
             }
        }
    });

    const batch = writeBatch(db);
    let createdCount = 0;

    occupiedLocationIds.forEach(locId => {
        if (!paidLocationIds.has(locId)) {
            const costInfo = locationCostMap.get(locId);
            if (costInfo && costInfo.cost > 0) {
                const newRef = doc(transactionCollectionRef);
                const t: TransactionInput = { 
                    date: endOfMonth, 
                    description: `Affitto Sede: ${costInfo.supplierName} - ${competenceMonthLabel} (Auto-Gen)`, 
                    amount: costInfo.cost, 
                    type: TransactionType.Expense, 
                    category: TransactionCategory.Nolo, 
                    paymentMethod: PaymentMethod.BankTransfer, 
                    status: TransactionStatus.Completed, 
                    allocationType: 'location', 
                    allocationId: locId, 
                    allocationName: '', 
                    isDeleted: false 
                };
                suppliers.forEach(s => { 
                    const l = s.locations.find(loc => loc.id === locId); 
                    if (l) t.allocationName = l.name; 
                });
                batch.set(newRef, { ...t, relatedDocumentId: 'AUTO-RENT' });
                createdCount++;
            }
        }
    });

    if (createdCount > 0) { 
        await batch.commit(); 
        return `Generati ${createdCount} movimenti affitto per ${competenceMonthLabel}.`; 
    } else { 
        return `Nessun nuovo movimento necessario per ${competenceMonthLabel} (nessuna presenza rilevata o noli già saldati).`; 
    }
};

export const checkAndSetOverdueInvoices = async () => {
    const q = query(invoiceCollectionRef, where("isDeleted", "==", false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const today = new Date();
    let updates = 0;
    snapshot.docs.forEach(docSnap => {
        const inv = docSnap.data() as Invoice;
        if (inv.status === DocumentStatus.SealedSDI || inv.status === DocumentStatus.Paid || inv.status === DocumentStatus.Overdue || inv.status === DocumentStatus.Draft) return;
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(23, 59, 59, 999);
        if (dueDate < today) { batch.update(docSnap.ref, { status: DocumentStatus.Overdue }); updates++; }
    });
    if (updates > 0) await batch.commit();
};
