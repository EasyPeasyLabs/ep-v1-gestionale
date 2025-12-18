
import { db } from '../firebase/config';
import { runTransaction, doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { 
    Enrollment, EnrollmentStatus, 
    PaymentMethod, TransactionType, TransactionCategory, TransactionStatus, 
    Invoice, InvoiceInput, DocumentStatus,
    Client, ClientType, ParentClient, InstitutionalClient
} from '../types';
import { logFinancialAction } from './auditService';
import { getNextDocumentNumber, getNextGhostInvoiceNumber } from './financeService';

interface PaymentResult {
    success: boolean;
    invoiceNumber?: string;
    error?: string;
}

export const processPayment = async (
    enrollment: Enrollment,
    client: Client | undefined,
    amount: number,
    date: string,
    method: PaymentMethod,
    createInvoice: boolean,
    isDeposit: boolean,
    fullPrice: number,
    ghostInvoiceIdToPromote?: string
): Promise<PaymentResult> => {
    
    try {
        let clientName = 'Cliente Sconosciuto';
        if (client) {
            clientName = client.clientType === ClientType.Parent 
                ? `${(client as ParentClient).firstName} ${(client as ParentClient).lastName}` 
                : (client as InstitutionalClient).companyName;
        }

        // Generazione numero reale (FT-YYYY-XXX)
        let nextRealInvoiceNumber = '';
        if (createInvoice || ghostInvoiceIdToPromote) {
            nextRealInvoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3);
        }

        let enrollmentActivated = false;

        await runTransaction(db, async (transaction) => {
            const enrRef = doc(db, 'enrollments', enrollment.id);
            const enrSnap = await transaction.get(enrRef);
            
            if (!enrSnap.exists()) throw new Error("Iscrizione non trovata nel database.");

            let invoiceId = '';
            let finalInvoiceNumber = '';

            // 1. Gestione Fattura (Promozione o Nuova)
            if (ghostInvoiceIdToPromote) {
                const ghostRef = doc(db, 'invoices', ghostInvoiceIdToPromote);
                const ghostSnap = await transaction.get(ghostRef);
                
                if (ghostSnap.exists()) {
                    finalInvoiceNumber = nextRealInvoiceNumber;
                    transaction.update(ghostRef, {
                        isGhost: false,
                        invoiceNumber: finalInvoiceNumber,
                        status: DocumentStatus.PendingSDI,
                        paymentMethod: method,
                        issueDate: new Date(date).toISOString(),
                        totalAmount: amount,
                        promotionHistory: {
                            originalGhostNumber: ghostSnap.data().invoiceNumber,
                            promotedAt: new Date().toISOString()
                        }
                    });
                    invoiceId = ghostInvoiceIdToPromote;
                }
            } else if (createInvoice) {
                const newInvRef = doc(collection(db, 'invoices'));
                finalInvoiceNumber = nextRealInvoiceNumber;
                
                const desc = isDeposit 
                    ? `Acconto Iscrizione: ${enrollment.childName} - ${enrollment.subscriptionName}`
                    : `Saldo/Pagamento Iscrizione: ${enrollment.childName} - ${enrollment.subscriptionName}`;

                const newInvoice: InvoiceInput = {
                    invoiceNumber: finalInvoiceNumber,
                    clientId: enrollment.clientId,
                    clientName,
                    issueDate: new Date(date).toISOString(),
                    dueDate: new Date(date).toISOString(),
                    status: DocumentStatus.PendingSDI,
                    paymentMethod: method,
                    items: [{ description: desc, quantity: 1, price: amount, notes: `Sede: ${enrollment.locationName}` }],
                    totalAmount: amount,
                    hasStampDuty: amount > 77,
                    isGhost: false
                };

                transaction.set(newInvRef, { ...newInvoice, isDeleted: false });
                invoiceId = newInvRef.id;
            }

            // 2. Registrazione Transazione Finanziaria
            if (amount > 0) {
                const transRef = doc(collection(db, 'transactions'));
                transaction.set(transRef, {
                    date: new Date(date).toISOString(),
                    description: `Incasso ${finalInvoiceNumber || 'Iscrizione'} - ${enrollment.childName}`,
                    amount: amount,
                    type: TransactionType.Income,
                    category: TransactionCategory.Sales,
                    paymentMethod: method,
                    status: TransactionStatus.Completed,
                    relatedDocumentId: invoiceId || undefined,
                    allocationType: 'location',
                    allocationId: enrollment.locationId,
                    allocationName: enrollment.locationName,
                    isDeleted: false
                });
            }

            // 3. CAMBIO STATO ISCRIZIONE (Cruciale: Da Dormiente ad Attivo)
            // Se lo stato attuale è Pending, il pagamento conferma l'iscrizione.
            const currentData = enrSnap.data();
            if (currentData.status === EnrollmentStatus.Pending) {
                transaction.update(enrRef, { status: EnrollmentStatus.Active });
                enrollmentActivated = true;
            }
        });

        // 4. Gestione Pro-forma Residua (Post-Transazione)
        if (isDeposit) {
            await createRemainingGhostInvoice(enrollment, clientName, fullPrice - amount, date);
        }

        const logDetails = `Pagamento di ${amount}€ registrato.${enrollmentActivated ? ' Iscrizione ATTIVATA (era Dormiente).' : ''}`;
        await logFinancialAction('PAYMENT', 'ENROLLMENT', enrollment.id, logDetails);
        
        return { success: true, invoiceNumber: nextRealInvoiceNumber };

    } catch (e: any) {
        console.error("Payment registration failed:", e);
        return { success: false, error: e.message };
    }
};

const createRemainingGhostInvoice = async (enrollment: Enrollment, clientName: string, remainingAmount: number, date: string) => {
    if (remainingAmount <= 0) return;

    const ghostNumber = await getNextGhostInvoiceNumber();
    const ghostRef = doc(collection(db, 'invoices'));
    
    const ghostInvoice: InvoiceInput = {
        clientId: enrollment.clientId,
        clientName,
        issueDate: new Date(date).toISOString(),
        dueDate: enrollment.endDate,
        status: DocumentStatus.Draft,
        paymentMethod: PaymentMethod.BankTransfer,
        items: [{ 
            description: `Saldo residuo: ${enrollment.childName}`, 
            quantity: 1, 
            price: remainingAmount, 
            notes: `Riferimento corso ${enrollment.subscriptionName}` 
        }],
        totalAmount: remainingAmount,
        hasStampDuty: remainingAmount > 77,
        isGhost: true,
        invoiceNumber: ghostNumber,
        notes: "Documento pro-forma per il saldo finale."
    };

    const batch = writeBatch(db);
    batch.set(ghostRef, { ...ghostInvoice, isDeleted: false });
    await batch.commit();
};
