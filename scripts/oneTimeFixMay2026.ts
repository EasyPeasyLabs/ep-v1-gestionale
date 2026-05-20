import { db } from '../firebase/config';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Invoice, Transaction, Enrollment, DocumentStatus } from '../types';

/**
 * Fix chirurgici una-tantum per dati storici Maggio 2026.
 * NON invocare da UI. Eseguire manualmente via console Firebase o script Node.
 * File mantenuto per documentazione storica.
 */
export const runSmartSanityFix_May2026 = async (): Promise<void> => {
    const invoicesSnap = await getDocs(collection(db, 'invoices'));
    const transactionsSnap = await getDocs(collection(db, 'transactions'));
    const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));

    const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
    const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    const enrollments = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));

    const batch = writeBatch(db);
    let count = 0;

    // 1. SNUPY Fix
    const snupyEnr = enrollments.find(e => e.childName?.toUpperCase().includes('SNUPY'));
    if (snupyEnr) {
        const snupyGhost = invoices.find(i => i.isGhost && i.relatedEnrollmentId === snupyEnr.id && i.issueDate.startsWith('2026-02-12'));
        if (snupyGhost) {
            batch.update(doc(db, 'invoices', snupyGhost.id), { status: DocumentStatus.Paid });
            count++;
            const sanatoria = transactions.find(t => t.amount === 120 && t.description?.includes('Sanatoria') && t.date.startsWith('2026-02'));
            if (sanatoria) {
                batch.update(doc(db, 'transactions', sanatoria.id), { relatedDocumentId: snupyGhost.id, relatedEnrollmentId: snupyEnr.id });
                count++;
            }
        }
        transactions.forEach(t => {
            if (t.clientName?.toUpperCase().includes('SNUPY') && !t.relatedEnrollmentId && !t.isDeleted) {
                batch.update(doc(db, 'transactions', t.id), { relatedEnrollmentId: snupyEnr.id });
                count++;
            }
        });
    }

    // 2. LA SCINTILLA Fix
    const scintillaGhost = invoices.find(i => i.isGhost && i.invoiceNumber === 'PRO-2026-001');
    if (scintillaGhost) {
        batch.delete(doc(db, 'invoices', scintillaGhost.id));
        count++;
    }

    // 5. CUBE Fix (Duplicates)
    const cubeGhosts = invoices.filter(i => i.isGhost && i.clientName?.toUpperCase().includes('CUBE') && i.issueDate.startsWith('2026-05-16') && !i.isDeleted);
    if (cubeGhosts.length > 1) {
        cubeGhosts.slice(1).forEach(g => {
            batch.delete(doc(db, 'invoices', g.id));
            count++;
        });
    }

    if (count > 0) {
        await batch.commit();
        console.log(`[SanityFix] Applicate ${count} correzioni.`);
    }
};
