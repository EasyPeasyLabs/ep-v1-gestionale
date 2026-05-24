
import { 
    getDocs, 
    query, 
    where 
} from 'firebase/firestore';
import { 
    Invoice, 
    Transaction, 
    ClientType, 
    ParentClient, 
    InstitutionalClient, 
    TransactionType 
} from '../../types';
import { 
    getInvoicesCollectionRef, 
    getTransactionsCollectionRef, 
    docToInvoice, 
    docToTransaction 
} from './core';
import { getClients } from '../parentService';

export const getOrphanedFinancialsForClient = async (clientId: string): Promise<{
    orphanInvoices: Invoice[];
    orphanTransactions: Transaction[];
    orphanGhosts: Invoice[];
}> => {
    const [invSnap, transSnap] = await Promise.all([
        getDocs(query(getInvoicesCollectionRef(), where('clientId', '==', clientId))),
        getDocs(query(getTransactionsCollectionRef()))
    ]);

    const invoices = invSnap.docs.map(docToInvoice).filter(i => !i.isDeleted && !i.relatedEnrollmentId);
    
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId);
    const clientNames = client ? [
        client.clientType === ClientType.Parent 
            ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}` 
            : (client as InstitutionalClient).companyName
    ] : [];

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
