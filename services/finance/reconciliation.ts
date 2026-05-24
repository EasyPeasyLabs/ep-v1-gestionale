
import { db } from '../../firebase/config';
import { 
    writeBatch,
    doc,
    getDoc,
    query,
    where,
    getDocs,
    collection,
    addDoc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { 
    IntegrityIssue, 
    FiscalYear,
    Enrollment,
    InvoiceInput,
    DocumentStatus,
    PaymentMethod,
    TransactionInput,
    TransactionType,
    TransactionCategory,
    TransactionStatus,
    Invoice,
    GhostPromotionFilter,
    GhostPromotionCandidate
} from '../../types';
import { isYearClosed } from '../fiscalYearService';
import { 
    getInvoicesCollectionRef, 
    getTransactionsCollectionRef, 
    getQuotesCollectionRef,
    addInvoice,
    addTransaction,
    docToInvoice
} from './core';
import { getNextTransactionNumber } from './numbering';

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

export const fixIntegrityIssue = async (
    issue: IntegrityIssue, 
    strategy: 'invoice' | 'cash' | 'link' | 'smart_link' | 'oblivion',
    manualNum?: string, 
    targetInvoiceIds?: string[], 
    adjustment?: { amount: number, notes: string }, 
    targetTransactionId?: string,
    forceDate?: string,
    transactionIds?: string[]
) => {
    const enrId = issue.enrollmentId || (issue.id.startsWith('health-ghost-') ? null : issue.id.replace('health-', ''));
    const targetDateToCheck = forceDate || issue.date;
    
    if (strategy !== 'oblivion' && await isYearClosed(targetDateToCheck)) {
        throw new Error("FISCAL_YEAR_CLOSED");
    }

    const finalDate = forceDate || issue.date;

    if (strategy === 'oblivion') {
        let fyId = issue.suggestions?.find(s => s.type === 'oblivion')?.payload?.fiscalYearId;
        const reason = issue.suggestions?.find(s => s.type === 'oblivion')?.reason || "Oblio applicato manualmente.";
        
        if (!fyId) {
            const targetYear = new Date(finalDate).getFullYear();
            const fiscalSnap = await getDocs(collection(db, 'fiscal_years'));
            const existingFy = fiscalSnap.docs.find(doc => doc.data().year === targetYear || Number(doc.data().year) === targetYear);
            
            if (existingFy) {
                fyId = existingFy.id;
            } else {
                const newFyRef = await addDoc(collection(db, 'fiscal_years'), {
                    year: targetYear,
                    status: 'OPEN',
                    ignoredIssues: [],
                    oblivionNotes: ''
                });
                fyId = newFyRef.id;
            }
        }

        const fyRef = doc(db, 'fiscal_years', fyId as string);
        const fySnap = await getDoc(fyRef);
        
        if (fySnap.exists()) {
            const data = fySnap.data() as FiscalYear;
            const issueToIgnore = issue.ghostId ? `health-ghost-${issue.ghostId}` : issue.id;
            const updatedIgnored = [...(data.ignoredIssues || []), issueToIgnore];
            const timestamp = new Date().toLocaleString('it-IT');
            const newNote = `\n[${timestamp}] Oblio per "${issue.description}": ${reason}`;
            const updatedNotes = (data.oblivionNotes || "") + newNote;

            await updateDoc(fyRef, {
                ignoredIssues: updatedIgnored,
                oblivionNotes: updatedNotes
            });
        }
    }
    else if (strategy === 'smart_link') {
        if (!enrId) {
            console.error("[FiscalDoctor] Impossibile determinare l'ID iscrizione per l'anomalia:", issue.id);
            throw new Error("ID Iscrizione mancante. Impossibile procedere con il collegamento.");
        }
        
        const transactionIdToLink = targetTransactionId || issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.transactionId;
        const transactionIdsToLink = transactionIds || issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.transactionIds || (transactionIdToLink ? [transactionIdToLink] : []);
        
        if (transactionIdsToLink.length === 0) {
            throw new Error("Nessuna transazione identificata per il collegamento.");
        }

        const invoiceIdToLink = issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.invoiceId as string;
        
        await linkFinancialsToEnrollment(enrId as string, invoiceIdToLink ? [invoiceIdToLink] : [], transactionIdsToLink);

        if (issue.id.startsWith('health-ghost-') && issue.ghostId) {
            console.log("[FiscalDoctor] Eliminazione ghost invoice risolta:", issue.ghostId);
            await deleteDoc(doc(db, 'invoices', issue.ghostId));
        }
    }
    else if (strategy === 'link') {
        const suggestedInvoiceId = issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.invoiceId;
        const invoiceIdsToLink = targetInvoiceIds || (suggestedInvoiceId ? [suggestedInvoiceId] : []);
        
        const transactionIdToLink = targetTransactionId || issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.transactionId;
        const transactionIdsToLink = transactionIds || issue.suggestions?.find(s => s.type === 'smart_link')?.payload?.transactionIds || (transactionIdToLink ? [transactionIdToLink] : []);

        if (transactionIdsToLink.length === 0 && invoiceIdsToLink.length === 0) {
            throw new Error("Nessuna transazione o fattura specificata per il collegamento automatico.");
        }
        
        await linkFinancialsToEnrollment(enrId as string, invoiceIdsToLink, transactionIdsToLink, adjustment);
        
        if (issue.id.startsWith('health-ghost-') && transactionIdsToLink.length > 0 && invoiceIdsToLink.length === 0) {
            const ghostId = issue.ghostId || issue.id.replace('health-ghost-', '');
            await deleteDoc(doc(db, 'invoices', ghostId));
        }

        if (invoiceIdsToLink.length > 0) {
            const realInvoice = await getDoc(doc(db, 'invoices', invoiceIdsToLink[0]));
            if (realInvoice.exists()) {
                const realData = realInvoice.data();
                const realAmount = realData.totalAmount || 0;
                
                const ghostQuery = query(
                    collection(db, 'invoices'),
                    where('relatedEnrollmentId', '==', enrId),
                    where('isGhost', '==', true)
                );
                const ghostSnap = await getDocs(ghostQuery);
                
                if (!ghostSnap.empty) {
                    const batch = writeBatch(db);
                    ghostSnap.docs.forEach(gDoc => {
                        const ghostData = gDoc.data();
                        if (Math.abs((ghostData.totalAmount || 0) - realAmount) < 1) {
                            batch.update(doc(db, 'invoices', gDoc.id), { 
                                invoiceNumber: realData.invoiceNumber,
                                issueDate: realData.issueDate,
                                dueDate: realData.dueDate,
                                status: realData.status || DocumentStatus.Sent,
                                isGhost: false,
                                notes: (ghostData.notes || '') + ' [Promossa a fattura reale: ' + realData.invoiceNumber + ']'
                            });
                        }
                    });
                    await batch.commit();
                }
            }
        }
    }
    else if (strategy === 'cash') {
        if (!enrId) {
            console.error("[FiscalDoctor] Impossibile determinare l'ID iscrizione per l'anomalia:", issue.id);
            throw new Error("ID Iscrizione mancante. Impossibile procedere con il collegamento.");
        }

        const transactionData: TransactionInput = {
            date: finalDate,
            description: `Sanatoria Cassa: ${issue.description}`,
            amount: issue.amount || 0,
            type: TransactionType.Income,
            category: TransactionCategory.Vendite,
            paymentMethod: PaymentMethod.Cash,
            status: TransactionStatus.Completed,
            allocationType: 'general',
            relatedEnrollmentId: enrId,
            isDeleted: false
        };
        await addTransaction(transactionData);
        
        if (issue.id.startsWith('health-ghost-')) {
            const ghostId = issue.ghostId || issue.id.replace('health-ghost-', '');
            await deleteDoc(doc(db, 'invoices', ghostId));
        }
    }
    else if (strategy === 'invoice') {
        if (!enrId) {
            console.error("[FiscalDoctor] Impossibile determinare l'ID iscrizione per l'anomalia:", issue.id);
            throw new Error("ID Iscrizione mancante. Impossibile procedere con la creazione della fattura.");
        }

        if (!manualNum) throw new Error("Numero fattura mancante");
        
        const invoiceData: InvoiceInput = {
            invoiceNumber: manualNum,
            issueDate: finalDate,
            dueDate: finalDate,
            clientId: 'unknown',
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
            relatedEnrollmentId: enrId || undefined
        };
        
        const enrRef = doc(db, 'enrollments', enrId);
        const enrSnap = await getDoc(enrRef);
        if (enrSnap.exists()) {
            invoiceData.clientId = enrSnap.data().clientId;
        }
        
        await addInvoice(invoiceData);
        
        if (issue.id.startsWith('health-ghost-')) {
            const ghostId = issue.ghostId || issue.id.replace('health-ghost-', '');
            await deleteDoc(doc(db, 'invoices', ghostId));
        }
    }
};

export const cleanupEnrollmentFinancials = async (enrollment: Enrollment) => {
    const batch = writeBatch(db);
    const qInv = query(getInvoicesCollectionRef(), where('relatedEnrollmentId', '==', enrollment.id));
    const qTrans = query(getTransactionsCollectionRef(), where('relatedEnrollmentId', '==', enrollment.id));
    const [invSnap, transSnap] = await Promise.all([getDocs(qInv), getDocs(qTrans)]);
    invSnap.forEach(d => batch.update(d.ref, { relatedEnrollmentId: null, notes: `Orphaned from deleted enrollment ${enrollment.childName}` }));
    transSnap.forEach(d => batch.update(d.ref, { relatedEnrollmentId: null }));
    await batch.commit();
};

export const anonymizeClientFinancials = async (clientId: string, clientName: string) => {
    const batch = writeBatch(db);
    const qInv = query(getInvoicesCollectionRef(), where('clientId', '==', clientId));
    const invSnap = await getDocs(qInv);
    invSnap.forEach(d => batch.update(d.ref, { clientName: 'Cliente Cancellato (GDPR)' }));
    const qQuote = query(getQuotesCollectionRef(), where('clientId', '==', clientId));
    const quoteSnap = await getDocs(qQuote);
    quoteSnap.forEach(d => batch.update(d.ref, { clientName: 'Cliente Cancellato (GDPR)' }));
    if (clientName) {
        const qTrans = query(getTransactionsCollectionRef(), where('clientName', '==', clientName));
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

export const registerInvoicePayment = async (invoice: Invoice, paymentDate?: string) => {
    const date = paymentDate || new Date().toISOString();
    const transactionNumber = await getNextTransactionNumber(date);
    const batch = writeBatch(db);
    batch.update(doc(db, 'invoices', invoice.id), { status: DocumentStatus.Paid, isGhost: false });
    const transRef = doc(getTransactionsCollectionRef());
    const transData: TransactionInput = {
        transactionNumber,
        date: date,
        description: `Incasso Fattura ${invoice.invoiceNumber} - ${invoice.clientName}`,
        amount: invoice.totalAmount,
        type: TransactionType.Income,
        category: TransactionCategory.Vendite,
        paymentMethod: invoice.paymentMethod || PaymentMethod.BankTransfer,
        status: TransactionStatus.Completed,
        allocationType: 'general',
        relatedDocumentId: invoice.id,
        relatedEnrollmentId: invoice.relatedEnrollmentId,
        clientName: invoice.clientName,
        isDeleted: false
    };
    batch.set(transRef, transData);
    await batch.commit();
};

export const checkAndSetOverdueInvoices = async () => {
    const today = new Date();
    const q = query(getInvoicesCollectionRef(), where('status', 'in', [DocumentStatus.Sent, DocumentStatus.Draft]));
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

export const findGhostPromotionCandidates = async (filter?: GhostPromotionFilter): Promise<GhostPromotionCandidate[]> => {
    let ghostQuery;
    if (filter?.enrollmentId) {
        ghostQuery = query(getInvoicesCollectionRef(), where('isGhost', '==', true), where('relatedEnrollmentId', '==', filter.enrollmentId));
    } else {
        ghostQuery = query(getInvoicesCollectionRef(), where('isGhost', '==', true), where('relatedEnrollmentId', '!=', null));
    }
    const ghostSnap = await getDocs(ghostQuery);
    if (ghostSnap.empty) return [];
    
    const ghosts = ghostSnap.docs.map(docToInvoice);
    const candidates: GhostPromotionCandidate[] = [];
    
    for (const ghost of ghosts) {
        if (!ghost.relatedEnrollmentId || !ghost.totalAmount) continue;
        if (filter?.parentName && ghost.clientName && !ghost.clientName.toLowerCase().includes(filter.parentName.toLowerCase())) continue;
        if (filter?.amount && Math.abs((ghost.totalAmount || 0) - filter.amount) > 1) continue;
        if (filter?.dateFrom && ghost.issueDate && ghost.issueDate < filter.dateFrom) continue;
        if (filter?.dateTo && ghost.issueDate && ghost.issueDate > filter.dateTo) continue;
        
        const realQuery = query(getInvoicesCollectionRef(), where('relatedEnrollmentId', '==', ghost.relatedEnrollmentId), where('isGhost', '==', false));
        const realSnap = await getDocs(realQuery);
        let matchedReal: Invoice | null = null;
        let matchReason = '';
        for (const realDoc of realSnap.docs) {
            const real = { id: realDoc.id, ...realDoc.data() } as Invoice;
            if (Math.abs((real.totalAmount || 0) - (ghost.totalAmount || 0)) < 1) {
                matchedReal = real;
                matchReason = `Match importo: ${ghost.totalAmount}€`;
                break;
            }
        }
        candidates.push({ ghost, realInvoice: matchedReal, matchReason });
    }
    return candidates;
};

export const promoteGhostInvoices = async (invoiceIds: string[]): Promise<{ promoted: number; details: string[] }> => {
    const details: string[] = [];
    if (invoiceIds.length === 0) return { promoted: 0, details: ['Nessuna fattura selezionata.'] };
    const batch = writeBatch(db);
    let promoted = 0;
    for (const ghostId of invoiceIds) {
        const ghostDoc = await getDoc(doc(db, 'invoices', ghostId));
        if (!ghostDoc.exists()) continue;
        const ghost = ghostDoc.data() as Invoice;
        if (!ghost.relatedEnrollmentId || !ghost.totalAmount) continue;
        const realQuery = query(getInvoicesCollectionRef(), where('relatedEnrollmentId', '==', ghost.relatedEnrollmentId), where('isGhost', '==', false));
        const realSnap = await getDocs(realQuery);
        for (const realDoc of realSnap.docs) {
            const real = realDoc.data() as Invoice;
            if (Math.abs((real.totalAmount || 0) - (ghost.totalAmount || 0)) < 1) {
                batch.update(doc(db, 'invoices', ghostId), {
                    invoiceNumber: real.invoiceNumber,
                    issueDate: real.issueDate,
                    dueDate: real.dueDate,
                    status: real.status || DocumentStatus.Sent,
                    isGhost: false,
                    notes: (ghost.notes || '') + ` [Promossa a fattura reale: ${real.invoiceNumber}]`
                });
                promoted++;
                details.push(`Promossa ${ghost.invoiceNumber} → ${real.invoiceNumber} (${real.totalAmount}€)`);
                break;
            }
        }
    }
    if (promoted > 0) await batch.commit();
    return { promoted, details };
};

export const runSmartSanityFix = async (): Promise<void> => {
    console.log('[SanityFix] Nessun fix attivo.');
};

export const reconcileTransactions = async () => {
    // Reconciliation running...
};
