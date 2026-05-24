
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    where 
} from 'firebase/firestore';
import { InvoiceGap } from '../../types';
import { getInvoicesCollectionRef } from './core';

export const getNextDocumentNumber = async (collectionName: 'invoices', prefix: string, digits: number, dateRef: string): Promise<string> => {
    const year = new Date(dateRef).getFullYear();
    const q = query(
        collection(db, collectionName), 
        where('issueDate', '>=', `${year}-01-01`), 
        where('issueDate', '<=', `${year}-12-31`), 
        orderBy('issueDate', 'desc')
    );
    const snapshot = await getDocs(q);
    
    const validDocs = snapshot.docs.filter(d => !d.data().isGhost && !d.data().isDeleted);
    
    let maxNum = 0;
    validDocs.forEach(d => {
        const numStr = d.data().invoiceNumber;
        const parts = numStr.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    return `${prefix}-${year}-${String(maxNum + 1).padStart(digits, '0')}`;
};

export const getNextTransactionNumber = async (dateRef: string): Promise<number> => {
    const year = new Date(dateRef).getFullYear();
    const q = query(
        collection(db, 'transactions'), 
        where('date', '>=', `${year}-01-01`), 
        where('date', '<=', `${year}-12-31`)
    );
    const snapshot = await getDocs(q);
    
    let maxNum = 0;
    snapshot.docs.forEach(d => {
        const data = d.data();
        if (!data.isDeleted && typeof data.transactionNumber === 'number') {
            if (data.transactionNumber > maxNum) maxNum = data.transactionNumber;
        }
    });

    return maxNum + 1;
};

export const getNextGhostInvoiceNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const q = query(
        getInvoicesCollectionRef(), 
        where('isGhost', '==', true), 
        where('issueDate', '>=', `${year}-01-01`), 
        orderBy('issueDate', 'desc')
    );
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    return `PRO-${year}-${String(count).padStart(3, '0')}`;
};

export const getInvoiceNumberGaps = async (year: number): Promise<InvoiceGap[]> => {
    const q = query(getInvoicesCollectionRef(), where('issueDate', '>=', `${year}-01-01`), where('issueDate', '<=', `${year}-12-31`));
    const snapshot = await getDocs(q);
    const validInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(i => !i.isDeleted && !i.isGhost);
    
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
    const q = query(getInvoicesCollectionRef(), where('issueDate', '>=', `${year}-01-01`), where('issueDate', '<=', `${year}-12-31`));
    const snapshot = await getDocs(q);
    return snapshot.docs.some(d => !d.data().isDeleted && !d.data().isGhost && d.data().invoiceNumber.endsWith(`-${numStr}`));
};
