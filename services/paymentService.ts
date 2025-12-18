
import { db } from '../firebase/config';
import { runTransaction, doc, collection, writeBatch } from 'firebase/firestore';
import { 
    Enrollment, EnrollmentStatus, 
    PaymentMethod, TransactionType, TransactionCategory, TransactionStatus, 
    InvoiceInput, DocumentStatus,
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
        // 1. Risoluzione Nome Cliente (Safe)
        let clientName = 'Cliente Sconosciuto';
        if (client) {
            if (client.clientType === ClientType.Parent) {
                const p = client as ParentClient;
                clientName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            } else {
                const i = client as InstitutionalClient;
                clientName = i.companyName || 'Ente Sconosciuto';
            }
        } else if (enrollment.childName) {
            clientName = `Genitore di ${enrollment.childName}`; // Fallback estremo
        }

        // 2. Generazione Numerazione (Fuori Transazione)
        let nextRealInvoiceNumber = '';
        if (createInvoice || ghostInvoiceIdToPromote) {
            nextRealInvoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3);
        }

        const cleanAmount = Number(amount) || 0;
        const paymentDate = new Date(date).toISOString();

        // 3. Preparazione Dati Sanitizzati (No undefined!)
        const safeLocationId = enrollment.locationId || 'unassigned';
        const safeLocationName = enrollment.locationName || 'Sede Non Definita';
        const safeClientId = enrollment.clientId || 'unknown_client';
        const safeChildName = enrollment.childName || 'Allievo';
        const safeSubName = enrollment.subscriptionName || 'Corso';

        await runTransaction(db, async (transaction) => {
            // --- FASE 1: LETTURE ---
            const enrRef = doc(db, 'enrollments', enrollment.id);
            const enrSnap = await transaction.get(enrRef);
            
            if (!enrSnap.exists()) throw new Error("Iscrizione non trovata nel database.");
            const currentEnrData = enrSnap.data();

            let ghostSnapData = null;
            let ghostRef = null;
            if (ghostInvoiceIdToPromote) {
                ghostRef = doc(db, 'invoices', ghostInvoiceIdToPromote);
                const ghostSnap = await transaction.get(ghostRef);
                if (ghostSnap.exists()) {
                    ghostSnapData = ghostSnap.data();
                }
            }

            // --- FASE 2: SCRITTURE ---
            let invoiceIdForTransaction = null;

            // A. Gestione Fattura
            if (ghostRef && ghostSnapData) {
                // Update Ghost
                transaction.update(ghostRef, {
                    isGhost: false,
                    invoiceNumber: nextRealInvoiceNumber,
                    status: DocumentStatus.PendingSDI,
                    paymentMethod: method,
                    issueDate: paymentDate,
                    totalAmount: cleanAmount,
                    promotionHistory: {
                        originalGhostNumber: ghostSnapData.invoiceNumber || 'N/D',
                        promotedAt: new Date().toISOString()
                    }
                });
                invoiceIdForTransaction = ghostInvoiceIdToPromote;
            } else if (createInvoice) {
                // Create New Invoice
                const newInvRef = doc(collection(db, 'invoices'));
                const desc = isDeposit 
                    ? `Acconto Iscrizione: ${safeChildName} - ${safeSubName}`
                    : `Saldo/Pagamento Iscrizione: ${safeChildName} - ${safeSubName}`;

                const newInvoiceData = {
                    invoiceNumber: nextRealInvoiceNumber,
                    clientId: safeClientId,
                    clientName: clientName,
                    issueDate: paymentDate,
                    dueDate: paymentDate,
                    status: DocumentStatus.PendingSDI,
                    paymentMethod: method,
                    items: [{ 
                        description: desc, 
                        quantity: 1, 
                        price: cleanAmount, 
                        notes: `Sede: ${safeLocationName}` 
                    }],
                    totalAmount: cleanAmount,
                    hasStampDuty: cleanAmount > 77,
                    isGhost: false,
                    isDeleted: false
                };
                
                // Conversione in Plain Object per sicurezza estrema (rimuove eventuali undefined nascosti)
                transaction.set(newInvRef, JSON.parse(JSON.stringify(newInvoiceData)));
                invoiceIdForTransaction = newInvRef.id;
            }

            // B. Creazione Transazione
            if (cleanAmount > 0) {
                const transRef = doc(collection(db, 'transactions'));
                
                const transactionData: any = {
                    date: paymentDate,
                    description: `Incasso ${nextRealInvoiceNumber || 'Iscrizione'} - ${safeChildName}`,
                    amount: cleanAmount,
                    type: TransactionType.Income,
                    category: TransactionCategory.Sales,
                    paymentMethod: method,
                    status: TransactionStatus.Completed,
                    allocationType: 'location',
                    allocationId: safeLocationId,
                    allocationName: safeLocationName,
                    isDeleted: false
                };

                if (invoiceIdForTransaction) {
                    transactionData.relatedDocumentId = invoiceIdForTransaction;
                }
                
                transaction.set(transRef, transactionData);
            }

            // C. Attivazione Iscrizione
            // Se lo stato corrente è Pending, forziamo Active.
            if (currentEnrData.status === EnrollmentStatus.Pending) {
                transaction.update(enrRef, { status: EnrollmentStatus.Active });
            }
        });

        // 4. Post-Process (Ghost Invoice Residua)
        if (isDeposit) {
            const remaining = Number(fullPrice) - cleanAmount;
            if (remaining > 0) {
                await createRemainingGhostInvoice(enrollment, clientName, remaining, date);
            }
        }

        await logFinancialAction('PAYMENT', 'ENROLLMENT', enrollment.id, `Pagamento di ${cleanAmount}€ processato.`);
        
        return { success: true, invoiceNumber: nextRealInvoiceNumber };

    } catch (e: any) {
        console.error("[PaymentService] Errore pagamento:", e);
        return { success: false, error: e.message || "Errore sconosciuto durante il salvataggio." };
    }
};

const createRemainingGhostInvoice = async (enrollment: Enrollment, clientName: string, remainingAmount: number, date: string) => {
    try {
        const ghostNumber = await getNextGhostInvoiceNumber();
        const ghostRef = doc(collection(db, 'invoices'));
        
        const safeChildName = enrollment.childName || '';
        const safeSubName = enrollment.subscriptionName || '';

        const ghostInvoice: InvoiceInput = {
            clientId: enrollment.clientId || '',
            clientName: clientName,
            issueDate: new Date(date).toISOString(),
            dueDate: enrollment.endDate || new Date(date).toISOString(),
            status: DocumentStatus.Draft,
            paymentMethod: PaymentMethod.BankTransfer,
            items: [{ 
                description: `Saldo residuo: ${safeChildName}`, 
                quantity: 1, 
                price: remainingAmount, 
                notes: `Riferimento corso ${safeSubName}` 
            }],
            totalAmount: remainingAmount,
            hasStampDuty: remainingAmount > 77,
            isGhost: true,
            invoiceNumber: ghostNumber,
            notes: "Documento pro-forma generato automaticamente."
        };

        const batch = writeBatch(db);
        batch.set(ghostRef, { ...ghostInvoice, isDeleted: false });
        await batch.commit();
    } catch (e) {
        console.error("[PaymentService] Errore creazione Ghost Invoice:", e);
    }
};
