import { getAllEnrollments } from './enrollmentService';
import { getClients } from './parentService';
import { getInvoices, getQuotes, getTransactions, checkAndSetOverdueInvoices } from './financeService';
import { Notification, EnrollmentStatus, ClientType, ParentClient, InstitutionalClient, DocumentStatus, TransactionStatus, Quote } from '../types';

// Helper per calcolare data meno 30 giorni lavorativi (circa 42 giorni solari)
const getBillingDeadlineThreshold = () => {
    const d = new Date();
    // 30gg lavorativi sono circa 6 settimane
    d.setDate(d.getDate() + 42);
    return d;
};

export const getNotifications = async (): Promise<Notification[]> => {
    await checkAndSetOverdueInvoices();
    const ignoredIds = JSON.parse(localStorage.getItem('ep_ignored_notifications') || '[]');
    const [enrollments, clients, invoices, quotes, transactions] = await Promise.all([
        getAllEnrollments(),
        getClients(),
        getInvoices(),
        getQuotes(),
        getTransactions()
    ]);

    const clientMap = new Map<string, string>();
    clients.forEach(c => {
        if (c.clientType === ClientType.Parent) {
            clientMap.set(c.id, `${(c as ParentClient).firstName} ${(c as ParentClient).lastName}`);
        } else {
            clientMap.set(c.id, (c as InstitutionalClient).companyName);
        }
    });

    const notifications: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);
    const billingThreshold = getBillingDeadlineThreshold();

    // 1. ISCRIZIONI
    enrollments.forEach(enr => {
        const parentName = clientMap.get(enr.clientId) || 'Cliente';

        // --- NEW: Monitoraggio Billing Istituzionale (Rate Preventivo) ---
        if (enr.isQuoteBased && enr.relatedQuoteId) {
            const quote = quotes.find(q => q.id === enr.relatedQuoteId);
            if (quote && quote.installments) {
                quote.installments.forEach((inst, idx) => {
                    const dueDate = new Date(inst.dueDate);
                    // Alert se siamo a meno di 30gg lavorativi (42 solari) dalla scadenza rata
                    if (!inst.isPaid && dueDate <= billingThreshold && dueDate >= today) {
                        notifications.push({
                            id: `billing-${enr.id}-${idx}`,
                            type: 'institutional_billing',
                            message: `⚠️ Fatturazione Pronta: Rata n.${idx+1} per ${enr.childName} (${inst.amount.toFixed(2)}€) entro il ${dueDate.toLocaleDateString()}`,
                            clientId: enr.clientId,
                            date: new Date().toISOString(),
                            linkPage: 'Finance',
                            filterContext: { tab: 'invoices', searchTerm: enr.childName }
                        });
                    }
                });
            }
        }

        if (enr.status === EnrollmentStatus.Pending) {
            notifications.push({
                id: `enr-pending-${enr.id}`,
                type: 'payment_required',
                message: `Iscrizione in attesa di pagamento: ${enr.childName} (${parentName}) - ${enr.price}€`,
                clientId: enr.clientId,
                date: new Date().toISOString(),
                linkPage: 'Enrollments',
                filterContext: { status: 'pending', searchTerm: enr.childName }
            });
        }

        if (enr.status === EnrollmentStatus.Active) {
            const endDate = new Date(enr.endDate);
            if (endDate >= today && endDate <= sevenDaysFromNow) {
                const diffTime = endDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                notifications.push({
                    id: `enr-exp-${enr.id}`,
                    type: 'expiry',
                    message: `L'iscrizione di ${enr.childName} (${parentName}) scade tra ${diffDays} giorni.`,
                    clientId: enr.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Enrollments',
                    filterContext: { status: 'active', searchTerm: enr.childName }
                });
            }
            if (enr.lessonsRemaining > 0 && enr.lessonsRemaining <= 2) {
                notifications.push({
                    id: `enr-low-${enr.id}`,
                    /* Fixed typo: changed low_lessons to 'low_lessons' */
                    type: 'low_lessons',
                    message: `Restano solo ${enr.lessonsRemaining} lezioni per ${enr.childName} (${parentName}).`,
                    clientId: enr.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Enrollments',
                    filterContext: { status: 'active', searchTerm: enr.childName }
                });
            }
        }
    });

    // 2. FATTURE
    invoices.forEach(inv => {
        if (inv.isDeleted) return; 
        if (inv.isGhost && inv.status === DocumentStatus.Draft) {
            const createdDate = new Date(inv.issueDate);
            const daysSinceCreation = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceCreation >= 30) {
                notifications.push({
                    id: `inv-balance-${inv.id}`,
                    type: 'balance_due',
                    message: `SALDO DOVUTO: Sono passati 30gg dall'acconto di ${inv.clientName}. Saldo: ${inv.totalAmount.toFixed(2)}€.`,
                    clientId: inv.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Finance',
                    filterContext: { tab: 'invoices', searchTerm: inv.clientName }
                });
            }
        }
        if (inv.status === DocumentStatus.Overdue) {
            notifications.push({
                id: `inv-overdue-${inv.id}`,
                type: 'expiry',
                message: `Fattura Scaduta ${inv.invoiceNumber} (${inv.totalAmount.toFixed(2)}€) - ${inv.clientName}`,
                clientId: inv.clientId,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: { tab: 'invoices', invoiceStatus: DocumentStatus.Overdue }
            });
        }
        if (inv.status === DocumentStatus.PendingSDI) {
            const issueDate = new Date(inv.issueDate);
            let deadline = new Date(issueDate);
            deadline.setDate(deadline.getDate() + 12);
            if (issueDate.getMonth() === 11) {
                const dec30 = new Date(issueDate.getFullYear(), 11, 30);
                if (deadline > dec30) deadline = dec30;
            }
            const diffTime = deadline.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            notifications.push({
                id: `inv-sdi-${inv.id}`,
                type: 'sdi_deadline',
                message: `SDI: Registra fattura ${inv.invoiceNumber} entro ${daysLeft} giorni!`,
                clientId: inv.clientId,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: { tab: 'invoices', invoiceStatus: DocumentStatus.PendingSDI }
            });
        }
    });

    return notifications.filter(n => !ignoredIds.includes(n.id));
};