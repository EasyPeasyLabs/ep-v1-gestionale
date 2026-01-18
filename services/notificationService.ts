
import { getAllEnrollments } from './enrollmentService';
import { getClients } from './parentService';
import { getInvoices, getQuotes, getTransactions, checkAndSetOverdueInvoices } from './financeService';
import { Notification, EnrollmentStatus, ClientType, ParentClient, InstitutionalClient, DocumentStatus, TransactionStatus } from '../types';

export const getNotifications = async (): Promise<Notification[]> => {
    // 1. Aggiorna stati critici (es. fatture scadute)
    await checkAndSetOverdueInvoices();

    // Recupera lista notifiche ignorate da LocalStorage
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

    // 1. ISCRIZIONI
    enrollments.forEach(enr => {
        const parentName = clientMap.get(enr.clientId) || 'Cliente';

        // Iscrizioni PENDING (Da Pagare)
        if (enr.status === EnrollmentStatus.Pending) {
            notifications.push({
                id: `enr-pending-${enr.id}`,
                type: 'payment_required',
                message: `Iscrizione in attesa di pagamento: ${enr.childName} (${parentName}) - ${enr.price}€`,
                clientId: enr.clientId,
                date: new Date().toISOString(),
                linkPage: 'Enrollments',
                filterContext: {
                    status: 'pending',
                    searchTerm: enr.childName
                }
            });
        }

        // NEW: CHIUSURA ANTICIPATA ALERT
        if (enr.isEarlyClosure) {
            notifications.push({
                id: `enr-early-closure-${enr.id}`,
                type: 'action_required',
                message: `Chiusura Anticipata: ${enr.childName}. Ricorda: il pagamento è acquisito. Per rimborsi emetti Nota di Credito manuale.`,
                clientId: enr.clientId,
                date: new Date().toISOString(),
                linkPage: 'EnrollmentArchive', // Likely already in archive
                filterContext: {
                    searchTerm: enr.childName
                }
            });
        }

        // Iscrizioni ACTIVE (Scadenze e Lezioni in esaurimento)
        if (enr.status === EnrollmentStatus.Active) {
            const endDate = new Date(enr.endDate);
            
            // Scadenza temporale
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
                    filterContext: {
                        status: 'active',
                        searchTerm: enr.childName
                    }
                });
            }

            // Esaurimento lezioni
            if (enr.lessonsRemaining > 0 && enr.lessonsRemaining <= 2) {
                notifications.push({
                    id: `enr-low-${enr.id}`,
                    type: 'low_lessons',
                    message: `Restano solo ${enr.lessonsRemaining} lezioni per ${enr.childName} (${parentName}).`,
                    clientId: enr.clientId,
                    date: new Date().toISOString(),
                    linkPage: 'Enrollments',
                    filterContext: {
                        status: 'active',
                        searchTerm: enr.childName
                    }
                });
            }
        }
    });

    // 2. FATTURE
    // Check per fatture sigillate nel mese corrente (per notifica invio commercialista)
    let sealedInvoicesCount = 0;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    invoices.forEach(inv => {
        if (inv.isDeleted) return; 

        // Notifica Saldo (Fattura Fantasma in scadenza o scaduta)
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
                    filterContext: {
                        tab: 'invoices',
                        searchTerm: inv.clientName
                    }
                });
            }
        }

        // Fatture Scadute
        if (inv.status === DocumentStatus.Overdue) {
            notifications.push({
                id: `inv-overdue-${inv.id}`,
                type: 'expiry',
                message: `Fattura Scaduta ${inv.invoiceNumber} (${inv.totalAmount.toFixed(2)}€) - ${inv.clientName}`,
                clientId: inv.clientId,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: {
                    tab: 'invoices',
                    invoiceStatus: DocumentStatus.Overdue
                }
            });
        }
        // Fatture Bozza (Escludendo le Fantasma)
        if (inv.status === DocumentStatus.Draft && !inv.isGhost) {
            notifications.push({
                id: `inv-draft-${inv.id}`,
                type: 'action_required',
                message: `Bozza Fattura da inviare: ${inv.clientName} (${inv.totalAmount.toFixed(2)}€)`,
                clientId: inv.clientId,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: {
                    tab: 'invoices',
                    invoiceStatus: DocumentStatus.Draft
                }
            });
        }

        // --- NUOVO: Controllo SDI Pending (12 giorni) ---
        if (inv.status === DocumentStatus.PendingSDI) {
            const issueDate = new Date(inv.issueDate);
            issueDate.setHours(0,0,0,0);
            
            // Calcola scadenza (12 giorni o 30 Dicembre)
            let deadline = new Date(issueDate);
            deadline.setDate(deadline.getDate() + 12);

            // Regola Dicembre: Se fattura è di Dicembre, max 30 Dicembre
            if (issueDate.getMonth() === 11) { // Dicembre è 11
                const dec30 = new Date(issueDate.getFullYear(), 11, 30);
                if (deadline > dec30) {
                    deadline = dec30;
                }
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
                filterContext: {
                    tab: 'invoices',
                    invoiceStatus: DocumentStatus.PendingSDI
                }
            });
        }

        // Conteggio Sealed per il mese corrente
        if (inv.status === DocumentStatus.SealedSDI) {
            const invDate = new Date(inv.issueDate);
            if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
                sealedInvoicesCount++;
            }
        }
    });

    // Notifica Invio Commercialista
    if (sealedInvoicesCount > 0) {
        notifications.push({
            id: `accountant-send-${currentMonth}-${currentYear}`,
            type: 'accountant_send',
            message: `Trasmettere a commercialista: ${sealedInvoicesCount} fatture sigillate questo mese.`,
            date: new Date().toISOString(),
            linkPage: 'Finance',
            filterContext: {
                tab: 'invoices',
                invoiceStatus: DocumentStatus.SealedSDI
            }
        });
    }

    // 3. PREVENTIVI
    quotes.forEach(quote => {
        if (quote.isDeleted) return; 

        if (quote.status === DocumentStatus.Draft) {
            notifications.push({
                id: `quote-draft-${quote.id}`,
                type: 'action_required',
                message: `Bozza Preventivo da inviare: ${quote.clientName} (${quote.totalAmount.toFixed(2)}€)`,
                clientId: quote.clientId,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: {
                    tab: 'quotes'
                }
            });
        }
    });

    // 4. TRANSAZIONI (SPESE PENDING)
    transactions.forEach(trans => {
        if (trans.isDeleted) return; 

        if (trans.status === TransactionStatus.Pending) {
            notifications.push({
                id: `trans-pending-${trans.id}`,
                type: 'payment_required',
                message: `Da Saldare: ${trans.description} (${trans.amount.toFixed(2)}€)`,
                date: new Date().toISOString(),
                linkPage: 'Finance',
                filterContext: {
                    tab: 'transactions',
                    transactionStatus: 'pending'
                }
            });
        }
    });

    // Filtra quelle ignorate
    return notifications.filter(n => !ignoredIds.includes(n.id));
};
