
import { db } from '../../firebase/config';
import { 
    updateDoc, 
    doc, 
    getDoc, 
    writeBatch,
    getDocs,
    query,
    where
} from 'firebase/firestore';
import { 
    InvoiceInput, 
    Quote, 
    DocumentStatus, 
    PaymentMethod, 
    Lesson, 
    Enrollment
} from '../../types';
import { 
    getNextDocumentNumber, 
    getNextGhostInvoiceNumber 
} from './numbering';
import { 
    addInvoice, 
    getInvoicesCollectionRef 
} from './core';

export const convertQuoteToInvoice = async (quoteId: string) => {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error("Preventivo non trovato");
    const quote = quoteSnap.data() as Quote;
    const today = new Date().toISOString();
    
    const invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3, today);

    const invoiceInput: InvoiceInput = { 
        invoiceNumber: invoiceNumber, 
        issueDate: today, 
        dueDate: today, 
        clientId: quote.clientId, 
        clientName: quote.clientName, 
        items: quote.items, 
        totalAmount: quote.totalAmount, 
        status: DocumentStatus.Draft,
        paymentMethod: quote.paymentMethod || PaymentMethod.BankTransfer,
        hasStampDuty: quote.hasStampDuty || quote.totalAmount > 77.47, 
        globalDiscount: quote.globalDiscount,
        globalDiscountType: quote.globalDiscountType,
        installments: quote.installments || [],
        notes: quote.notes || "",
        isGhost: false, 
        isDeleted: false, 
        relatedQuoteNumber: quote.quoteNumber
    };
    const newInvoiceId = await addInvoice(invoiceInput);
    await updateDoc(quoteRef, { status: DocumentStatus.Sent });
    return newInvoiceId;
};

export const generateInvoicesFromQuote = async (quote: Quote, enrollmentId: string, selectedLessons: Lesson[]): Promise<void> => {
    if (!quote.installments || quote.installments.length === 0) return;

    const existingSnapshot = await getDocs(query(getInvoicesCollectionRef(), 
        where('relatedEnrollmentId', '==', enrollmentId),
        where('isGhost', '==', true),
        where('isDeleted', '==', false)
    ));
    if (!existingSnapshot.empty) {
        console.warn("Ghosts already exist for this enrollment. Skipping generation.");
        return;
    }

    const sortedLessons = [...selectedLessons].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const batch = writeBatch(db);

    const nextGhostBase = await getNextGhostInvoiceNumber();
    const parts = nextGhostBase.split('-');
    const year = parts[1];
    let seq = parseInt(parts[2]);

    for (let i = 0; i < quote.installments.length; i++) {
        const inst = quote.installments[i];
        let issueDate = inst.dueDate;

        if (inst.triggerType === 'lesson_number' && inst.triggerLessonIndex) {
            const lesson = sortedLessons[inst.triggerLessonIndex - 1];
            if (lesson) {
                issueDate = lesson.date;
            }
        }

        const termDays = inst.paymentTermDays || 0;
        const dueObj = new Date(issueDate);
        dueObj.setDate(dueObj.getDate() + termDays);
        const collectionDate = dueObj.toISOString();

        const ghostNum = `PRO-${year}-${String(seq).padStart(3, '0')}`;
        seq++;

        const invRef = doc(getInvoicesCollectionRef());
        const invData: InvoiceInput = {
            invoiceNumber: ghostNum,
            issueDate: issueDate,
            dueDate: collectionDate,
            clientId: quote.clientId,
            clientName: quote.clientName,
            status: DocumentStatus.Draft,
            paymentMethod: quote.paymentMethod || PaymentMethod.BankTransfer,
            isGhost: true,
            isDeleted: false,
            installments: quote.installments || [],
            notes: quote.notes || "",
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
