
import { getAllEnrollments } from './enrollmentService';
import { getClients } from './parentService';
import { getInvoices, getQuotes, getTransactions, checkAndSetOverdueInvoices } from './financeService';
import { getFiscalYears } from './fiscalYearService';
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
    
    // 1. Fetch Anni Fiscali Chiusi
    const fiscalYears = await getFiscalYears();
    const closedYears = new Set(fiscalYears.filter(fy => fy.status === 'CLOSED').map(fy => fy.year));

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

    // Helper: Controlla se una data appartiene a un anno fiscale chiuso
    const isClosed = (dateStr: string) => {
        if (!dateStr) return false;
        const year = new Date(dateStr).getFullYear();
        return closedYears.has(year);
    };

    // 1. ISCRIZIONI
    enrollments.forEach(enr => {
        const parentName = clientMap.get(enr.clientId) || 'Cliente';

        // Se l'iscrizione è relativa a un anno chiuso (data fine), ignoriamo le notifiche operative
        if (isClosed(enr.endDate)) return;

        if (enr.status === EnrollmentStatus.Pending) {
            // Per le pending, controlliamo la data di inizio. Se è in un anno chiuso, è una vecchia pendenza da ignorare/gestire altrove.
            if (isClosed(enr.startDate)) return;

            // SMART BALANCE CHECK (Allineamento con Fiscal Doctor)
            // Verifica se l'iscrizione, pur essendo "Pending", è coperta finanziariamente (Fatture + Cassa + Abbuoni)
            const paidInv = invoices.filter(i => i.relatedEnrollmentId === enr.id && !i.isDeleted && !i.isGhost).reduce((s, i) => s + i.totalAmount, 0);
            const paidTrans = transactions.filter(t => t.relatedEnrollmentId === enr.id && !t.isDeleted).reduce((s, t) => s + t.amount, 0);
            const adjustment = Number(enr.adjustmentAmount || 0);
            
            const totalPaid = paidInv + paidTrans + adjustment;
            const price = Number(enr.price || 0);
            const gap = price - totalPaid;

            // Se il GAP è trascurabile (<= 5€), consideriamo l'iscrizione saldata anche se in stato Pending.
            // Questo evita notifiche ridondanti se l'utente ha usato il Fiscal Doctor per sanare ma non ha cambiato stato.
            if (gap <= 5) return;

            notifications.push({
                id: `enr-pending-${enr.id}`,
                type: 'payment_required',
                message: `Iscrizione in attesa di pagamento: ${enr.childName} (${parentName}) - Residuo: ${gap.toFixed(2)}€`,
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

    // 2. FATTURE & GHOSTS
    invoices.forEach(inv => {
        if (inv.isDeleted) return; 
        
        // A. Ghost Invoice Emission Alert
        if (inv.isGhost && inv.status === DocumentStatus.Draft) {
            // Se la data di emissione prevista è in un anno chiuso, non suggerire di emetterla (sarebbe retroattiva su bilancio chiuso)
            if (isClosed(inv.issueDate)) return;

            const issueDate = new Date(inv.issueDate);
            if (issueDate <= today) {
                notifications.push({
                    id: `ghost-emit-${inv.id}`,
                    type: 'invoice_emission',
                    message: `EMETTI ORA: È arrivata la data per la fattura programata di ${inv.clientName} (${inv.totalAmount.toFixed(2)}€).`,
                    clientId: inv.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Finance',
                    filterContext: { tab: 'invoices', searchTerm: inv.clientName }
                });
            }
        }

        // B. Payment Collection Alert (For any active invoice)
        if ((!inv.isGhost || inv.status === DocumentStatus.Sent) && inv.status !== DocumentStatus.Paid) {
            // Se la scadenza era in un anno chiuso, ignoriamo l'alert automatico (gestione recupero crediti straordinaria)
            if (isClosed(inv.dueDate)) return;

            const dueDate = new Date(inv.dueDate);
            if (dueDate <= today) {
                notifications.push({
                    id: `inv-collect-${inv.id}`,
                    type: 'payment_collection',
                    message: `VERIFICA INCASSO: La fattura ${inv.invoiceNumber} di ${inv.clientName} scade oggi o è scaduta.`,
                    clientId: inv.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Finance',
                    filterContext: { tab: 'invoices', searchTerm: inv.invoiceNumber }
                });
            }
        }

        // Legacy Checks (Balance Due)
        if (inv.isGhost && inv.status === DocumentStatus.Draft) {
            if (isClosed(inv.issueDate)) return; // Ignora bozze vecchie anni chiusi

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
        
        // Overdue (Ridondante con B, ma mantenuto per legacy status check)
        if (inv.status === DocumentStatus.Overdue) {
            if (isClosed(inv.dueDate)) return;

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

        // SDI Deadline
        if (inv.status === DocumentStatus.PendingSDI) {
            // Se la fattura è in un anno chiuso, è un problema grave ma non risolvibile con semplice notifica "invia a SDI".
            // Probabilmente richiede intervento manuale o ravvedimento. Nascondiamo dalla routine quotidiana.
            if (isClosed(inv.issueDate)) return;

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
