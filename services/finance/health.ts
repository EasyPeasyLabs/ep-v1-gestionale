
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
} from 'firebase/firestore';
import { 
    IntegrityIssue, 
    IntegrityIssueSuggestion, 
    TransactionType, 
    TransactionCategory, 
    Enrollment, 
    Invoice, 
    Transaction, 
    Client, 
    ClientType, 
    ParentClient, 
    InstitutionalClient, 
    FiscalYear,
    EnrollmentStatus
} from '../../types';

export const runFinancialHealthCheck = async (
    enrollments: Enrollment[], 
    invoices: Invoice[], 
    transactions: Transaction[], 
    clients: Client[]
): Promise<IntegrityIssue[]> => {
    const issues: IntegrityIssue[] = [];

    const [quotesSnap, fiscalSnap] = await Promise.all([
        getDocs(collection(db, 'quotes')),
        getDocs(collection(db, 'fiscal_years'))
    ]);
    const quotes = quotesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const fiscalYears = fiscalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FiscalYear));

    for (const enr of enrollments) {
        if (enr.status === EnrollmentStatus.Active && enr.price > 0) {
            
            const relatedQuote = enr.relatedQuoteId ? quotes.find(q => q.id === enr.relatedQuoteId) : null;
            const quoteNumber = relatedQuote ? relatedQuote.quoteNumber : null;

            const linkedInvoices = invoices.filter(i => 
                !i.isDeleted && 
                (i.relatedEnrollmentId === enr.id || (quoteNumber && i.relatedQuoteNumber === quoteNumber))
            );

            const paidInv = linkedInvoices.filter(i => !i.isGhost).reduce((s, i) => s + i.totalAmount, 0);
            const ghostInv = linkedInvoices.filter(i => i.isGhost).reduce((s, i) => s + i.totalAmount, 0);
            
            const paidTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted).reduce((s, t) => s + t.amount, 0);
            const totalPaid = paidInv + paidTrans + (enr.adjustmentAmount || 0);
            
            const missingAmount = enr.price - totalPaid - ghostInv;

            const enrDate = new Date(enr.startDate);
            const enrYear = enrDate.getFullYear();
            const fiscalYear = fiscalYears.find(fy => Number(fy.year) === enrYear);
            const isClosed = fiscalYear?.status === 'CLOSED' || String(fiscalYear?.status).toUpperCase() === 'CLOSED';

            if (fiscalYear?.ignoredIssues?.includes(`health-${enr.id}`)) {
                continue;
            }

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

            if (missingAmount > 5) {
                const suggestions: IntegrityIssueSuggestion[] = [];

                const childLastName = enr.childName.split(' ').pop()?.toLowerCase() || '';
                const institutionalName = client?.clientType === ClientType.Institutional ? (client as InstitutionalClient).companyName.toLowerCase() : '';
                const enrollmentSearchKey = enr.childName.split(' - ')[0].toLowerCase();

                const candidates = transactions.filter(t => 
                    !t.relatedEnrollmentId && 
                    !t.isDeleted &&
                    t.type === TransactionType.Income && 
                    Math.abs((new Date(t.date).getTime() - enrDate.getTime()) / (1000 * 3600 * 24)) < 90 &&
                    (
                        Math.abs(t.amount - missingAmount) < 15 || 
                        (childLastName && childLastName.length > 2 && t.description.toLowerCase().includes(childLastName)) ||
                        (institutionalName && (t.description.toLowerCase().includes(institutionalName) || t.allocationName?.toLowerCase().includes(institutionalName) || t.clientName?.toLowerCase().includes(institutionalName))) ||
                        (enrollmentSearchKey && enrollmentSearchKey.length > 2 && (t.description.toLowerCase().includes(enrollmentSearchKey) || t.allocationName?.toLowerCase().includes(enrollmentSearchKey)))
                    ) &&
                    (
                        (!t.allocationId && !t.supplierId) || 
                        t.allocationId === enr.clientId || 
                        t.supplierId === enr.clientId ||
                        (institutionalName && (t.description.toLowerCase().includes(institutionalName) || t.allocationName?.toLowerCase().includes(institutionalName))) ||
                        (enrollmentSearchKey && (t.description.toLowerCase().includes(enrollmentSearchKey) || t.allocationName?.toLowerCase().includes(enrollmentSearchKey)))
                    ) &&
                    t.category !== TransactionCategory.Nolo &&
                    !['nolo', 'affitto', 'uscita'].some(keyword => t.description.toLowerCase().includes(keyword))
                );

                candidates.forEach(t => {
                    const isPerfectAmount = Math.abs(t.amount - missingAmount) < 5;
                    const hasCausalMatch = childLastName && t.description.toLowerCase().includes(childLastName);
                    
                    let label = `Collega Transazione: ${t.description} (${t.amount}€ del ${t.date})`;
                    if (isPerfectAmount && hasCausalMatch) label = `⭐ MATCH ECCELLENTE: ${t.description} (${t.amount}€)`;
                    else if (hasCausalMatch) label = `👤 Corrispondenza Cognome: ${t.description} (${t.amount}€)`;
                    else if (isPerfectAmount) label = `💰 Corrispondenza Importo: ${t.description} (${t.date})`;

                    suggestions.push({
                        type: 'smart_link',
                        label: label,
                        reason: `Hai registrato in data ${new Date(t.date).toLocaleDateString()} un incasso manuale di ${t.amount}€ senza collegamento diretto a un'iscrizione, che corrisponde esattamente a questa anomalia. Vuoi abbinarlo per chiudere la pendenza?`,
                        payload: { transactionId: t.id }
                    });
                });

                const orphanTransactions = transactions.filter(t => 
                    !t.relatedEnrollmentId && 
                    !t.isDeleted &&
                    t.type === TransactionType.Income && 
                    Math.abs((new Date(t.date).getTime() - enrDate.getTime()) / (1000 * 3600 * 24)) < 150 &&
                    (
                        t.allocationId === enr.clientId || 
                        t.supplierId === enr.clientId ||
                        (childLastName && childLastName.length > 2 && t.description.toLowerCase().includes(childLastName)) ||
                        (institutionalName && (t.description.toLowerCase().includes(institutionalName) || t.allocationName?.toLowerCase().includes(institutionalName) || t.clientName?.toLowerCase().includes(institutionalName))) ||
                        (enrollmentSearchKey && enrollmentSearchKey.length > 2 && (t.description.toLowerCase().includes(enrollmentSearchKey) || t.allocationName?.toLowerCase().includes(enrollmentSearchKey)))
                    ) &&
                    t.category !== TransactionCategory.Nolo &&
                    !['nolo', 'affitto', 'uscita'].some(keyword => t.description.toLowerCase().includes(keyword))
                );

                if (orphanTransactions.length > 1) {
                    const totalOrphan = orphanTransactions.reduce((sum, t) => sum + t.amount, 0);
                    if (Math.abs(totalOrphan - missingAmount) < 10 || (totalOrphan > missingAmount && totalOrphan - missingAmount < 50)) {
                        suggestions.push({
                            type: 'smart_link',
                            label: `⭐ MATCH CUMULATIVO: ${orphanTransactions.length} incassi (${totalOrphan.toFixed(2)}€)`,
                            reason: `L'AI ha individuato ${orphanTransactions.length} incassi manuali orfani che sommati coprono il debito di ${missingAmount.toFixed(2)}€. Vuoi abbinarli cumulativamente?`,
                            payload: { transactionIds: orphanTransactions.map(t => t.id) },
                            multipleTransactions: orphanTransactions
                        });
                    }
                }

                if (fiscalYear) {
                    suggestions.push({
                        type: 'oblivion',
                        label: isClosed ? `🚫 Applica Oblio (Esercizio ${enrYear} Chiuso)` : `🚫 Applica Oblio (Ignora Anomalia)`,
                        reason: isClosed ? `L'anomalia risale al ${enrYear}, un esercizio fiscale già consolidato e chiuso. Non è necessaria riconciliazione contabile.` : `Applica l'oblio per ignorare questa anomalia e rimuoverla dalle segnalazioni del Fiscal Doctor.`,
                        payload: { fiscalYearId: fiscalYear.id }
                    });
                }

                issues.push({
                    id: `health-${enr.id}`,
                    type: 'missing_invoice',
                    date: enr.startDate,
                    description: `Iscrizione Attiva ma non saldata: ${enr.childName}`,
                    entityName: enr.childName,
                    parentName: parentName,
                    subscriptionName: enr.subscriptionName,
                    lessonsTotal: enr.lessonsTotal,
                    amount: missingAmount,
                    enrollmentId: enr.id,
                    suggestions: suggestions
                });
            }

            const today = new Date().toISOString().split('T')[0];
            const overdueGhosts = linkedInvoices.filter(i => i.isGhost && i.dueDate && i.dueDate < today);
            for (const ghost of overdueGhosts) {
                if (fiscalYear?.ignoredIssues?.includes(`health-ghost-${ghost.id}`)) {
                    continue;
                }

                const ghostSuggestions: IntegrityIssueSuggestion[] = [];
                
                const childLastName = enr.childName.split(' ').pop()?.toLowerCase() || '';
                const institutionalName = client?.clientType === ClientType.Institutional ? (client as InstitutionalClient).companyName.toLowerCase() : '';
                const enrollmentSearchKey = enr.childName.split(' - ')[0].toLowerCase();
                const ghostAmount = ghost.totalAmount;
                const ghostDate = new Date(ghost.dueDate);

                const ghostCandidates = transactions.filter(t => 
                    !t.relatedEnrollmentId && 
                    !t.isDeleted &&
                    t.type === TransactionType.Income && 
                    Math.abs((new Date(t.date).getTime() - ghostDate.getTime()) / (1000 * 3600 * 24)) < 90 &&
                    (
                        Math.abs(t.amount - ghostAmount) < 15 || 
                        (childLastName && childLastName.length > 2 && t.description.toLowerCase().includes(childLastName)) ||
                        (institutionalName && (t.description.toLowerCase().includes(institutionalName) || t.allocationName?.toLowerCase().includes(institutionalName) || t.clientName?.toLowerCase().includes(institutionalName))) ||
                        (enrollmentSearchKey && enrollmentSearchKey.length > 2 && (t.description.toLowerCase().includes(enrollmentSearchKey) || t.allocationName?.toLowerCase().includes(enrollmentSearchKey)))
                    ) &&
                    (
                        (!t.allocationId && !t.supplierId) || 
                        t.allocationId === enr.clientId || 
                        t.supplierId === enr.clientId ||
                        (institutionalName && (t.description.toLowerCase().includes(institutionalName) || t.allocationName?.toLowerCase().includes(institutionalName))) ||
                        (enrollmentSearchKey && (t.description.toLowerCase().includes(enrollmentSearchKey) || t.allocationName?.toLowerCase().includes(enrollmentSearchKey)))
                    ) &&
                    t.category !== TransactionCategory.Nolo &&
                    !['nolo', 'affitto', 'uscita'].some(keyword => t.description.toLowerCase().includes(keyword))
                );

                ghostCandidates.forEach(t => {
                    const isPerfectAmount = Math.abs(t.amount - ghostAmount) < 5;
                    const hasCausalMatch = childLastName && t.description.toLowerCase().includes(childLastName);
                    
                    let label = `Collega Transazione: ${t.description} (${t.amount}€ del ${t.date})`;
                    if (isPerfectAmount && hasCausalMatch) label = `⭐ MATCH ECCELLENTE: ${t.description} (${t.amount}€)`;
                    else if (hasCausalMatch) label = `👤 Corrispondenza Cognome: ${t.description} (${t.amount}€)`;
                    else if (isPerfectAmount) label = `💰 Corrispondenza Importo: ${t.description} (${t.date})`;

                    ghostSuggestions.push({
                        type: 'smart_link',
                        label: label,
                        reason: `Hai registrato in data ${new Date(t.date).toLocaleDateString()} un incasso manuale di ${t.amount}€ senza collegamento diretto a un'iscrizione, che corrisponde esattamente a questa anomalia. Vuoi abbinarlo per chiudere la pendenza?`,
                        payload: { transactionId: t.id }
                    });
                });

                if (fiscalYear) {
                    ghostSuggestions.push({
                        type: 'oblivion',
                        label: isClosed ? `🚫 Applica Oblio (Esercizio ${enrYear} Chiuso)` : `🚫 Applica Oblio (Ignora Anomalia)`,
                        reason: isClosed ? `La proforma risale al ${enrYear}, un esercizio fiscale già consolidato e chiuso. Non è necessaria riconciliazione contabile.` : `Applica l'oblio per ignorare questa proforma scaduta e rimuoverla dalle segnalazioni.`,
                        payload: { fiscalYearId: fiscalYear.id }
                    });
                }
                
                issues.push({
                    id: `health-ghost-${ghost.id}-${enr.id}`,
                    type: 'missing_invoice',
                    date: ghost.dueDate,
                    description: `Rata scaduta non fatturata: ${enr.childName}`,
                    entityName: enr.childName,
                    parentName: parentName,
                    subscriptionName: enr.subscriptionName,
                    lessonsTotal: enr.lessonsTotal,
                    amount: ghost.totalAmount,
                    enrollmentId: enr.id,
                    ghostId: ghost.id,
                    suggestions: ghostSuggestions
                });
            }
        }
    }
    return issues;
};
