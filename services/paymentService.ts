import { db } from '../firebase/config';
import { runTransaction, doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { 
    Enrollment, EnrollmentStatus, 
    PaymentMethod, TransactionType, TransactionCategory, TransactionStatus, 
    Invoice, InvoiceInput, DocumentStatus,
    Client, ClientType, ParentClient, InstitutionalClient
} from '../types';
import { logFinancialAction } from './auditService';
import { getNextDocumentNumber } from './financeService';

interface PaymentResult {
    success: boolean;
    invoiceNumber?: string;
    error?: string;
}

/**
 * Gestisce il flusso di pagamento in modo ATOMICO.
 * 1. Crea Fattura Reale (Opzionale) o PROMUOVE Fattura Ghost
 * 2. Crea Transazione
 * 3. Aggiorna Iscrizione (Status)
 * 4. Gestisce Fatture Fantasma future (Saldo Logic)
 */
export const processPayment = async (
    enrollment: Enrollment,
    client: Client | undefined,
    amount: number,
    date: string,
    method: PaymentMethod,
    createInvoice: boolean,
    isDeposit: boolean, // È un acconto?
    fullPrice: number,
    ghostInvoiceIdToPromote?: string // NEW: Se presente, promuoviamo questa fattura
): Promise<PaymentResult> => {
    
    try {
        let clientName = 'Cliente Sconosciuto';
        if (client) {
            if (client.clientType === ClientType.Parent) {
                const p = client as ParentClient;
                clientName = `${p.firstName} ${p.lastName}`;
            } else {
                const i = client as InstitutionalClient;
                clientName = i.companyName;
            }
        }

        // Calcoliamo il prossimo numero reale FUORI dalla transazione ma in modo sicuro?
        // Firestore transactions require reads before writes. 
        // getNextDocumentNumber fa una query. Non possiamo farla dentro la transaction facilmente senza index.
        // Accettiamo una "optimistic generation" o la facciamo dentro?
        // Per semplicità e coerenza con financeService, generiamo il numero qui (piccolo rischio race condition ma accettabile per questo volume)
        let nextRealInvoiceNumber = '';
        if (createInvoice || ghostInvoiceIdToPromote) {
            nextRealInvoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3);
        }

        await runTransaction(db, async (t) => {
            
            // 1. Manage Invoice (Create or Promote)
            let invoiceRef;
            let invoiceNumber = '';

            if (ghostInvoiceIdToPromote) {
                // --- PROMOTION LOGIC ---
                invoiceRef = doc(db, 'invoices', ghostInvoiceIdToPromote);
                const ghostSnap = await t.get(invoiceRef);
                
                if (!ghostSnap.exists()) throw new Error("Fattura Ghost non trovata per la promozione.");
                
                const ghostData = ghostSnap.data() as Invoice;
                const originalNumber = ghostData.invoiceNumber;

                // Update to Real Invoice
                t.update(invoiceRef, {
                    isGhost: false,
                    invoiceNumber: nextRealInvoiceNumber,
                    status: DocumentStatus.PendingSDI, // O Paid, ma PendingSDI avvia il flusso corretto
                    paymentMethod: method,
                    promotionHistory: {
                        originalGhostNumber: originalNumber,
                        promotedAt: new Date().toISOString()
                    },
                    // Aggiorna l'importo se differisce (es. saldo parziale su saldo previsto)
                    totalAmount: amount,
                    items: ghostData.items.map(item => ({...item, price: amount, description: item.description.replace('Saldo residuo', 'Saldo')}))
                });
                
                invoiceNumber = nextRealInvoiceNumber;

            } else if (createInvoice) {
                // --- CREATION LOGIC ---
                invoiceRef = doc(collection(db, 'invoices'));
                invoiceNumber = nextRealInvoiceNumber;

                let desc = `Iscrizione: ${enrollment.childName} - ${enrollment.subscriptionName}`;
                if (isDeposit) desc = `Acconto: ${desc}`;
                else if (amount < fullPrice) desc = `Saldo/Parziale: ${desc}`;

                const newInvoice: InvoiceInput = {
                    invoiceNumber,
                    clientId: enrollment.clientId,
                    clientName,
                    issueDate: new Date(date).toISOString(),
                    dueDate: new Date(date).toISOString(),
                    status: DocumentStatus.PendingSDI,
                    paymentMethod: method,
                    items: [{ 
                        description: desc, 
                        quantity: 1, 
                        price: amount, 
                        notes: `Sede: ${enrollment.locationName}` 
                    }],
                    totalAmount: amount,
                    hasStampDuty: amount > 77,
                    notes: `Rif. Iscrizione ${enrollment.childName}`,
                    isGhost: false
                };

                t.set(invoiceRef, { ...newInvoice, isDeleted: false });
            }

            // 2. Create Transaction
            if (amount > 0) {
                const transRef = doc(collection(db, 'transactions'));
                t.set(transRef, {
                    date: new Date(date).toISOString(),
                    description: `${(createInvoice || ghostInvoiceIdToPromote) ? `Incasso FT ${invoiceNumber}` : 'Incasso'} - ${enrollment.childName}`,
                    amount: amount,
                    type: TransactionType.Income,
                    category: TransactionCategory.Sales,
                    paymentMethod: method,
                    status: TransactionStatus.Completed,
                    relatedDocumentId: invoiceRef ? invoiceRef.id : undefined,
                    allocationType: 'location',
                    allocationId: enrollment.locationId,
                    allocationName: enrollment.locationName,
                    excludeFromStats: !(createInvoice || ghostInvoiceIdToPromote), 
                    isDeleted: false
                });
            }

            // 3. Update Enrollment Status
            const enrRef = doc(db, 'enrollments', enrollment.id);
            if (enrollment.status === EnrollmentStatus.Pending) {
                t.update(enrRef, { status: EnrollmentStatus.Active });
            }
        });

        // --- POST TRANSACTION LOGIC (GHOST INVOICES FUTURE) ---
        // Se abbiamo appena promosso una ghost, non ne creiamo un'altra a meno che non ci sia ANCORA un residuo.
        // Ma handleGhostInvoices voida le vecchie.
        // Se ghostInvoiceIdToPromote era presente, è già stata aggiornata (non è più ghost/draft), quindi handleGhostInvoices non la toccherà.
        
        await handleGhostInvoices(enrollment, clientName, amount, fullPrice, date);

        // Audit
        await logFinancialAction('PAYMENT', 'ENROLLMENT', enrollment.id, `Pagamento registrato: ${amount}€ ${ghostInvoiceIdToPromote ? '(Promozione Ghost)' : ''}`);

        return { success: true };

    } catch (e: any) {
        console.error("Payment Transaction Failed:", e);
        return { success: false, error: e.message };
    }
};

// Funzione separata per gestire i saldi multipli
const handleGhostInvoices = async (
    enrollment: Enrollment, 
    clientName: string,
    paidAmount: number, 
    totalPrice: number,
    paymentDate: string
) => {
    const batch = writeBatch(db);
    
    // 1. Trova tutte le Ghost Invoices attive RIMASTE (Draft & isGhost=true)
    const q = query(
        collection(db, 'invoices'), 
        where("clientId", "==", enrollment.clientId),
        where("isGhost", "==", true),
        where("status", "==", DocumentStatus.Draft),
        where("isDeleted", "==", false)
    );
    
    const snapshot = await getDocs(q);
    
    // Annulla (Void) tutte le vecchie ghost per rigenerare il calcolo corretto
    snapshot.docs.forEach(d => {
        const data = d.data() as Invoice;
        // Solo se relative a questo bambino/corso
        if (data.items.some(i => i.description.includes(enrollment.childName))) {
            batch.update(d.ref, { status: DocumentStatus.Void, notes: `Annullata per ricalcolo saldo il ${new Date().toLocaleDateString()}` });
        }
    });

    // 2. Calcola residuo totale BASANDOSI SULLE FATTURE REALI
    // Ora che l'eventuale promozione è avvenuta, la fattura appena pagata è "Reale" (isGhost=false), quindi verrà contata qui.
    const realInvoicesQuery = query(
        collection(db, 'invoices'),
        where("clientId", "==", enrollment.clientId),
        where("isGhost", "==", false),
        where("isDeleted", "==", false)
    );
    const realSnaps = await getDocs(realInvoicesQuery);
    let totalPaid = 0;
    realSnaps.docs.forEach(d => {
        const inv = d.data() as Invoice;
        if (inv.items.some(i => i.description.includes(enrollment.childName))) {
            totalPaid += inv.totalAmount;
        }
    });
    
    const remaining = totalPrice - totalPaid;

    if (remaining > 1) { // Tolleranza 1€
        // Importante: Generiamo un numero "FT-GHOST-..." per la nuova previsione
        const ghostNumber = await import('./financeService').then(m => m.getNextGhostInvoiceNumber());
        
        const ghostRef = doc(collection(db, 'invoices'));
        const ghostInvoice: InvoiceInput = {
            clientId: enrollment.clientId,
            clientName: clientName,
            issueDate: new Date(paymentDate).toISOString(),
            dueDate: enrollment.endDate,
            status: DocumentStatus.Draft,
            paymentMethod: PaymentMethod.BankTransfer,
            items: [{
                description: `Saldo residuo: ${enrollment.childName}`,
                quantity: 1,
                price: remaining,
                notes: `Generata automaticamente. Totale corso: ${totalPrice}€`
            }],
            totalAmount: remaining,
            hasStampDuty: remaining > 77,
            notes: 'Fattura pro-forma per saldo futuro.',
            invoiceNumber: ghostNumber, // Use dedicated Ghost Number
            isGhost: true
        };
        batch.set(ghostRef, { ...ghostInvoice, isDeleted: false });
    }

    await batch.commit();
};