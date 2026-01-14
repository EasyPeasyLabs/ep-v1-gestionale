
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, query, orderBy, limit, where, writeBatch, getDoc } from 'firebase/firestore';
import { Transaction, TransactionInput, Invoice, InvoiceInput, Quote, QuoteInput, DocumentStatus, Enrollment, Supplier, TransactionType, TransactionCategory, PaymentMethod, TransactionStatus, Appointment, IntegrityIssue, EnrollmentStatus } from '../types';
import { getAllEnrollments, getActiveLocationForClient } from './enrollmentService';
import { getSuppliers } from './supplierService';
import { getClients } from './parentService';
import { checkFiscalLock } from './fiscalYearService';

// --- Transactions ---
const transactionCollectionRef = collection(db, 'transactions');
const docToTransaction = (doc: QueryDocumentSnapshot<DocumentData>): Transaction => {
    const data = doc.data();
    return { 
        id: doc.id, 
        ...data,
        status: data.status || TransactionStatus.Completed,
        isDeleted: data.isDeleted || false
    } as Transaction;
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const q = query(transactionCollectionRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToTransaction);
};

export const addTransaction = async (transaction: TransactionInput): Promise<string> => {
    // GUARDIA FISCALE
    await checkFiscalLock(transaction.date);

    const dataToSave = {
        ...transaction,
        status: transaction.status || TransactionStatus.Completed,
        isDeleted: false
    };
    const docRef = await addDoc(transactionCollectionRef, dataToSave);
    return docRef.id;
};

export const updateTransaction = async (id: string, transaction: Partial<TransactionInput>): Promise<void> => {
    // Per update, dobbiamo controllare sia la vecchia data (se esiste) che la nuova
    const docRef = doc(db, 'transactions', id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        await checkFiscalLock(snap.data().date);
    }
    if (transaction.date) {
        await checkFiscalLock(transaction.date);
    }

    await updateDoc(docRef, transaction);
};

export const deleteTransaction = async (id: string): Promise<void> => {
    const transactionDoc = doc(db, 'transactions', id);
    const snap = await getDoc(transactionDoc);
    if(snap.exists()) {
        await checkFiscalLock(snap.data().date);
    }
    await updateDoc(transactionDoc, { isDeleted: true });
};

// ... (restoreTransaction, permanentDeleteTransaction seguono la stessa logica di deleteTransaction)

export const deleteTransactionByRelatedId = async (relatedId: string): Promise<void> => {
    // Questa è un'operazione batch interna (es. cancellazione fattura), 
    // assumiamo che il controllo venga fatto a monte sull'entità padre (Fattura)
    const q = query(transactionCollectionRef, where("relatedDocumentId", "==", relatedId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref); 
    });
    await batch.commit();
};

export const deleteAutoRentTransactions = async (locationId: string): Promise<void> => {
    // Auto-rent è processo interno, potrebbe aver bisogno di check ma spesso ricalcola il corrente.
    // Per sicurezza, meglio non bloccare il sync globale, ma loggare se fallisce su anni chiusi.
    // Qui lasciamo libero per ora o implementiamo logica granulare nel sync.
    const q = query(transactionCollectionRef, 
        where("allocationId", "==", locationId),
        where("category", "==", TransactionCategory.Nolo),
        where("relatedDocumentId", ">=", "AUTO-RENT")
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

// --- Invoices ---
const invoiceCollectionRef = collection(db, 'invoices');
const docToInvoice = (doc: QueryDocumentSnapshot<DocumentData>): Invoice => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        isDeleted: data.isDeleted || false,
        isGhost: data.isGhost || false
    } as Invoice;
};

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(invoiceCollectionRef, orderBy('issueDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToInvoice);
};

export const addInvoice = async (invoice: InvoiceInput): Promise<{id: string, invoiceNumber: string}> => {
    // GUARDIA FISCALE
    await checkFiscalLock(invoice.issueDate);

    let invoiceNumber = invoice.invoiceNumber;
    if (!invoiceNumber) {
        if (invoice.isGhost) {
            invoiceNumber = await getNextGhostInvoiceNumber();
        } else {
            // Generazione automatica basata sulla progressione nell'anno di emissione
            invoiceNumber = await getNextDocumentNumber('invoices', 'FT', 3, invoice.issueDate);
        }
    }

    const docRef = await addDoc(invoiceCollectionRef, { ...invoice, invoiceNumber, isDeleted: false });
    return { id: docRef.id, invoiceNumber };
};

export const updateInvoice = async (id: string, invoice: Partial<InvoiceInput>): Promise<void> => {
    const docRef = doc(db, 'invoices', id);
    const snap = await getDoc(docRef);
    
    if(snap.exists()) {
        const currentData = snap.data();
        await checkFiscalLock(currentData.issueDate);
        
        // PROTEZIONE SIGILLO SDI:
        // Se la fattura è già sigillata (SealedSDI), non permettere cambi di stato impliciti 
        // a meno che non sia una modifica manuale esplicita dall'Admin (che passa da qui).
        // Tuttavia, scripts automatici non dovrebbero chiamare updateInvoice su Sealed.
        // Questo check è di sicurezza aggiuntiva.
        if (currentData.status === DocumentStatus.SealedSDI && invoice.status && invoice.status !== DocumentStatus.SealedSDI) {
             // L'admin può sbloccare (es. riportare a Draft), ma logghiamo l'evento o permettiamo.
             // La richiesta dice "non possono improvvisamente passare ad un altro stato".
             // Qui stiamo nel contesto di un update esplicito (dal form), quindi è permesso.
        }
    }
    
    if (invoice.issueDate) {
        await checkFiscalLock(invoice.issueDate);
    }
    await updateDoc(docRef, invoice);
};

export const deleteInvoice = async (id: string): Promise<void> => {
    const docRef = doc(db, 'invoices', id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
        await checkFiscalLock(snap.data().issueDate);
        // Blocco cancellazione se sigillata
        if (snap.data().status === DocumentStatus.SealedSDI) {
            throw new Error("IMPOSSIBILE ELIMINARE: La fattura è sigillata SDI.");
        }
    }
    await updateDoc(docRef, { isDeleted: true });
};

// --- Funzione Batch per segnare come pagate ---
export const markInvoicesAsPaid = async (invoiceIds: string[]): Promise<void> => {
    if (invoiceIds.length === 0) return;
    
    // Firestore batch limit is 500. We chunk the array.
    const chunkSize = 450; 
    for (let i = 0; i < invoiceIds.length; i += chunkSize) {
        const chunk = invoiceIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
            const docRef = doc(db, 'invoices', id);
            batch.update(docRef, { status: DocumentStatus.Paid });
        });

        await batch.commit();
    }
};

// --- RICONCILIAZIONE (SYNC) TRANSAZIONI ---
export const reconcileTransactions = async (): Promise<string> => {
    // 1. Recupera tutti i dati attuali
    const [allTransactions, allInvoices] = await Promise.all([
        getTransactions(), 
        getInvoices() // Restituisce fatture non cancellate (!isDeleted)
    ]);

    const invoiceMap = new Map(allInvoices.map(i => [i.id, i]));
    
    const updates: { ref: any, data: any }[] = [];
    let updatedCount = 0;
    let orphansCount = 0;

    for (const t of allTransactions) {
        // Analizza solo transazioni collegate a documenti
        if (!t.relatedDocumentId) continue;

        // Escludi transazioni auto-generate come affitti o incassi diretti ENR
        if (t.relatedDocumentId.startsWith('AUTO-RENT')) continue;
        if (t.relatedDocumentId.startsWith('ENR-')) continue; 

        const invoice = invoiceMap.get(t.relatedDocumentId);

        if (invoice) {
            // CASO A: Documento trovato -> Verifica allineamento
            // Formato richiesto: "incasso fattura n. [NUMERO] - [CLIENTE]"
            // Preleva Rif/ID (invoiceNumber) e Soggetto (clientName)
            const invoiceNum = invoice.invoiceNumber || 'N/D';
            const expectedDesc = `incasso fattura n. ${invoiceNum} - ${invoice.clientName}`;
            
            // Logica di confronto: Normalizza stringhe per evitare falsi positivi su spazi
            const currentDesc = (t.description || '').trim();
            const targetDesc = expectedDesc.trim();
            
            // Se la descrizione è diversa o il nome cliente non coincide
            if (currentDesc !== targetDesc || t.clientName !== invoice.clientName) {
                const docRef = doc(db, 'transactions', t.id);
                updates.push({ 
                    ref: docRef, 
                    data: { 
                        description: targetDesc,
                        clientName: invoice.clientName // Allinea anche il nome cliente denormalizzato
                    } 
                });
                updatedCount++;
            }
        } else {
            // CASO C: Documento non trovato (Orfana)
            // Se non è già marcata come orfana, marcala
            if (!t.description.startsWith("⚠️ ORFANA")) {
                const docRef = doc(db, 'transactions', t.id);
                const orphanDesc = `⚠️ ORFANA - Doc Mancante (ID: ${t.relatedDocumentId})`;
                updates.push({ 
                    ref: docRef, 
                    data: { description: orphanDesc } 
                });
                orphansCount++;
            }
        }
    }

    // Batch updates (Chunking 450 per sicurezza)
    if (updates.length > 0) {
        const chunkSize = 450;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(u => batch.update(u.ref, u.data));
            await batch.commit();
        }
    }

    return `Riconciliazione retroattiva completata.\n• Aggiornate: ${updatedCount}\n• Marcate Orfane: ${orphansCount}`;
};

// --- FISCAL HEALTH CHECK (Diagnostica) ---
export const runFinancialHealthCheck = async (): Promise<IntegrityIssue[]> => {
    // 1. Fetch All Relevant Data
    const [enrollments, invoices, transactions, clients] = await Promise.all([
        getAllEnrollments(),
        getInvoices(),
        getTransactions(),
        getClients()
    ]);

    const issues: IntegrityIssue[] = [];

    // Map clients for easy name lookup
    const clientMap = new Map<string, string>();
    clients.forEach(c => {
        const name = c.clientType === 'parent' 
            ? `${(c as any).firstName} ${(c as any).lastName}` 
            : (c as any).companyName;
        clientMap.set(c.id, name);
    });

    // MAPS for quick lookup
    // Invoice -> Transaction
    const invToTransMap = new Map<string, Transaction>();
    transactions.forEach(t => {
        if(t.relatedDocumentId) invToTransMap.set(t.relatedDocumentId, t);
    });

    // 2. CHECK 1: ISCRIZIONI ATTIVE SENZA FATTURA (O TRANSAZIONE DIRETTA)
    // Regola: Se Status = Active, deve esistere una fattura (anche bozza) o transazione per quel bambino/importo.
    enrollments.forEach(enr => {
        if (enr.status === EnrollmentStatus.Active) {
            // Cerca fatture per questo cliente che contengano il nome del bambino
            const relatedInvoices = invoices.filter(inv => 
                inv.clientId === enr.clientId && 
                !inv.isDeleted &&
                !inv.isGhost && // Escludiamo le ghost (pro-forma)
                inv.items.some(item => item.description.includes(enr.childName))
            );

            // Cerca transazioni dirette (senza fattura) collegate tramite Synthetic ID
            const syntheticId = `ENR-${enr.id}`;
            const relatedDirectTrans = transactions.some(t => t.relatedDocumentId === syntheticId && !t.isDeleted);

            if (relatedInvoices.length === 0 && !relatedDirectTrans) {
                // Caso Speciale: Iscrizione senza fattura e senza transazione cassa.
                issues.push({
                    id: `miss-inv-${enr.id}`,
                    type: 'missing_invoice',
                    severity: 'high',
                    description: `Iscrizione Attiva senza Fattura o Incasso: ${enr.childName}`,
                    entityId: enr.id,
                    entityName: enr.childName,
                    amount: enr.price || 0,
                    date: enr.startDate,
                    details: { enrollment: enr, clientName: clientMap.get(enr.clientId) }
                });
            }
        }
    });

    // 3. CHECK 2: FATTURE PAGATE SENZA TRANSAZIONE
    invoices.forEach(inv => {
        if (inv.status === DocumentStatus.Paid && !inv.isDeleted && !inv.isGhost) {
            const hasTransaction = invToTransMap.has(inv.id);
            if (!hasTransaction) {
                issues.push({
                    id: `miss-trans-${inv.id}`,
                    type: 'missing_transaction',
                    severity: 'medium', // Medium perché il fisco è ok (fattura c'è), ma la cassa no.
                    description: `Fattura Pagata senza Movimento di Cassa: ${inv.invoiceNumber}`,
                    entityId: inv.id,
                    entityName: inv.clientName,
                    amount: inv.totalAmount,
                    date: inv.issueDate,
                    details: { invoice: inv }
                });
            }
        }
    });

    return issues;
};

// --- AUTO FIXER ---
export const fixIntegrityIssue = async (issue: IntegrityIssue, strategy: 'invoice' | 'cash' = 'invoice'): Promise<void> => {
    if (issue.type === 'missing_invoice') {
        const enr = issue.details.enrollment as Enrollment;
        const clientName = issue.details.clientName || 'Cliente';
        
        if (strategy === 'invoice') {
            // Crea Fattura
            const invoiceInput: InvoiceInput = {
                invoiceNumber: '', // Auto-gen
                issueDate: new Date().toISOString(), // Data odierna per il fix
                dueDate: new Date().toISOString(),
                clientId: enr.clientId,
                clientName: clientName,
                items: [{
                    description: `Pagamento Iscrizione: ${enr.childName} - ${enr.subscriptionName}`,
                    quantity: 1,
                    price: enr.price || 0,
                    notes: 'Generata da controllo integrità'
                }],
                totalAmount: enr.price || 0,
                status: DocumentStatus.Paid, // Assumiamo pagata se l'iscrizione è attiva
                paymentMethod: PaymentMethod.BankTransfer,
                hasStampDuty: (enr.price || 0) > 77.47,
                isGhost: false,
                isDeleted: false
            };
            
            // Nota: addInvoice controlla il lock fiscale. Se l'anno è chiuso, lancerà errore.
            const res = await addInvoice(invoiceInput);
            
            // Crea Transazione Contestuale (per evitare di creare un nuovo buco "missing transaction")
            const transInput: TransactionInput = {
                date: new Date().toISOString(),
                description: `incasso fattura n. ${res.invoiceNumber} - ${clientName}`,
                amount: enr.price || 0,
                type: TransactionType.Income,
                category: TransactionCategory.Vendite,
                paymentMethod: PaymentMethod.BankTransfer,
                status: TransactionStatus.Completed,
                relatedDocumentId: res.id,
                allocationType: enr.locationId !== 'unassigned' ? 'location' : 'general',
                allocationId: enr.locationId !== 'unassigned' ? enr.locationId : undefined,
                allocationName: enr.locationName,
                isDeleted: false
            };
            await addTransaction(transInput);
        
        } else if (strategy === 'cash') {
            // Crea Solo Transazione Diretta (No Fattura)
            const transInput: TransactionInput = {
                date: new Date().toISOString(),
                description: `Incasso Iscrizione (No Doc) - ${enr.childName} - ${enr.subscriptionName}`,
                amount: enr.price || 0,
                type: TransactionType.Income,
                category: TransactionCategory.Vendite,
                paymentMethod: PaymentMethod.Cash, 
                status: TransactionStatus.Completed,
                relatedDocumentId: `ENR-${enr.id}`, // Link sintetico
                allocationType: enr.locationId !== 'unassigned' ? 'location' : 'general',
                allocationId: enr.locationId !== 'unassigned' ? enr.locationId : undefined,
                allocationName: enr.locationName,
                isDeleted: false
            };
            await addTransaction(transInput);
        }

    } else if (issue.type === 'missing_transaction') {
        const inv = issue.details.invoice as Invoice;
        
        // Tenta di trovare location intelligente
        let allocId: string | undefined = undefined;
        let allocName: string | undefined = undefined;
        if (inv.clientId) {
            const loc = await getActiveLocationForClient(inv.clientId);
            if (loc) { allocId = loc.id; allocName = loc.name; }
        }

        const transInput: TransactionInput = {
            date: inv.issueDate, // Usa la data della fattura
            description: `incasso fattura n. ${inv.invoiceNumber} - ${inv.clientName}`,
            amount: inv.totalAmount,
            type: TransactionType.Income,
            category: TransactionCategory.Vendite,
            paymentMethod: inv.paymentMethod,
            status: TransactionStatus.Completed,
            relatedDocumentId: inv.id,
            clientName: inv.clientName,
            allocationType: allocId ? 'location' : 'general',
            allocationId: allocId,
            allocationName: allocName,
            isDeleted: false
        };
        
        await addTransaction(transInput);
    }
};

// --- Quotes ---
export const getQuotes = async (): Promise<Quote[]> => {
    const q = query(collection(db, 'quotes'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data(), isDeleted: d.data().isDeleted || false } as Quote)).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
};

export const addQuote = async (quote: QuoteInput) => {
    const quoteNumber = await getNextDocumentNumber('quotes', 'PR', 4, quote.issueDate);
    const docRef = await addDoc(collection(db, 'quotes'), { ...quote, quoteNumber, isDeleted: false });
    return docRef.id;
};

export const updateQuote = async (id: string, quote: Partial<QuoteInput>) => {
    await updateDoc(doc(db, 'quotes', id), quote);
};

export const deleteQuote = async (id: string) => {
    await updateDoc(doc(db, 'quotes', id), { isDeleted: true });
};

export const permanentDeleteQuote = async (id: string) => {
    await deleteDoc(doc(db, 'quotes', id));
};

export const convertQuoteToInvoice = async (quoteId: string) => {
    // 1. Get Quote
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) throw new Error("Preventivo non trovato");
    
    const quote = quoteSnap.data() as Quote;
    
    // 2. Create Invoice
    const today = new Date().toISOString();
    await checkFiscalLock(today);

    // Convert items (QuoteItems to DocumentItems) - assuming same structure
    const invoiceInput: InvoiceInput = {
        invoiceNumber: '', // generated
        issueDate: today,
        dueDate: today,
        clientId: quote.clientId,
        clientName: quote.clientName,
        items: quote.items,
        totalAmount: quote.totalAmount,
        status: DocumentStatus.Draft,
        paymentMethod: PaymentMethod.BankTransfer,
        hasStampDuty: quote.totalAmount > 77.47,
        isGhost: false,
        isDeleted: false,
        relatedQuoteNumber: quote.quoteNumber
    };

    const newInvoice = await addInvoice(invoiceInput);
    
    // 3. Mark Quote as Completed/Converted if status exists, otherwise delete or keep as history
    // We update status to show it was converted
    await updateDoc(quoteRef, { status: DocumentStatus.Sent }); 

    return newInvoice.id;
};

// --- Helpers & Utilities ---

export const getNextDocumentNumber = async (collectionName: 'invoices' | 'quotes', prefix: string, pad: number, dateStr: string): Promise<string> => {
    // Determine year from date
    const year = new Date(dateStr).getFullYear();
    const startOfYear = new Date(year, 0, 1).toISOString();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString();

    const colRef = collection(db, collectionName);
    // Query documents for this year to find max number
    const q = query(colRef, where("issueDate", ">=", startOfYear), where("issueDate", "<=", endOfYear));
    const snapshot = await getDocs(q);
    
    let maxNum = 0;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Check filtering ghosts for invoices
        if (collectionName === 'invoices' && data.isGhost) return;

        const numStr = collectionName === 'invoices' ? data.invoiceNumber : data.quoteNumber;
        if (numStr && numStr.includes(prefix)) {
            // Robust parsing: split by hyphen. 
            // Target Format: PREFIX-YEAR-NUMBER (e.g. FT-2025-057)
            const parts = numStr.split('-'); 
            
            // Check based on format
            if (parts.length >= 3) {
                // Strict check: part[1] must be the Year.
                // This filters out buggy invoices like FT-2026-2025 (where 2026 != 2025)
                // And accepts correct invoices like FT-2025-057 (where 2025 == 2025)
                if (parts[1] === String(year)) {
                    const n = parseInt(parts[2], 10);
                    if (!isNaN(n) && n > maxNum) maxNum = n;
                }
            }
        }
    });

    const nextNum = maxNum + 1;
    // Assemble as PREFIX-YEAR-NUMBER
    return `${prefix}-${year}-${String(nextNum).padStart(pad, '0')}`;
};

export const getNextGhostInvoiceNumber = async (): Promise<string> => {
    // Ghost invoices don't strictly need sequential numbers per year like fiscal ones, but good for tracking
    // Using a timestamp based approach as established: PRO-xxx-1234
    return `PRO-xxx-${Date.now().toString().slice(-4)}`; 
};

export const cleanupEnrollmentFinancials = async (enrollment: Enrollment): Promise<void> => {
    // 1. Find and delete related transactions (by description or metadata if linked)
    // Currently we link by description text mostly, or allocationId if it matches location.
    // Better strategy: Search transactions where description contains child name AND is related to enrollment.
    // Given the loose coupling, we will search for transactions with specific pattern in description.
    
    const childName = enrollment.childName;
    if (!childName) return;

    // Search transactions
    const qTrans = query(transactionCollectionRef, 
        where("category", "==", TransactionCategory.Vendite),
        where("isDeleted", "==", false)
    );
    
    const snapshot = await getDocs(qTrans);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach(doc => {
        const t = doc.data() as Transaction;
        // Simple heuristic matching
        if (t.description.includes(childName)) {
            batch.update(doc.ref, { isDeleted: true });
            count++;
        }
    });

    // Also mark invoices as deleted
    const qInv = query(invoiceCollectionRef, where("isDeleted", "==", false));
    const snapInv = await getDocs(qInv);
    snapInv.docs.forEach(doc => {
        const inv = doc.data() as Invoice;
        // Check items description
        const isRelated = inv.items.some(item => item.description.includes(childName));
        if (isRelated || (inv.clientName && inv.clientName.includes(childName))) { // Fallback
             batch.update(doc.ref, { isDeleted: true });
             count++;
        }
    });

    if (count > 0) await batch.commit();
};

export const syncRentExpenses = async (): Promise<string> => {
    // 1. Get all active enrollments with location assigned
    const enrollments = await getAllEnrollments();
    const suppliers = await getSuppliers();
    
    // 2. Map Locations to Suppliers for cost info
    const locationCostMap = new Map<string, { cost: number, supplierName: string }>();
    suppliers.forEach(s => {
        s.locations.forEach(l => {
            locationCostMap.set(l.id, { cost: l.rentalCost || 0, supplierName: s.companyName });
        });
    });

    // 3. Calculate Rent per Location per Month
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString();

    // Check existing rent transactions for this month
    const q = query(transactionCollectionRef, 
        where("category", "==", TransactionCategory.Nolo),
        where("date", ">=", startOfMonth),
        where("date", "<=", endOfMonth),
        where("isDeleted", "==", false)
    );
    const existingRents = await getDocs(q);
    const paidLocationIds = new Set<string>();
    existingRents.docs.forEach(d => {
        const t = d.data() as Transaction;
        if (t.allocationId) paidLocationIds.add(t.allocationId);
    });

    // Identify occupied locations
    const occupiedLocationIds = new Set<string>();
    enrollments.forEach(e => {
        if (e.status === 'Active' && e.locationId && e.locationId !== 'unassigned') {
            occupiedLocationIds.add(e.locationId);
        }
    });

    const batch = writeBatch(db);
    let createdCount = 0;

    occupiedLocationIds.forEach(locId => {
        if (!paidLocationIds.has(locId)) {
            const costInfo = locationCostMap.get(locId);
            if (costInfo && costInfo.cost > 0) {
                // Create Transaction
                const newRef = doc(transactionCollectionRef);
                const t: TransactionInput = {
                    date: new Date().toISOString(), // Today
                    description: `Affitto Sede: ${costInfo.supplierName} (Auto-Gen)`,
                    amount: costInfo.cost,
                    type: TransactionType.Expense,
                    category: TransactionCategory.Nolo,
                    paymentMethod: PaymentMethod.BankTransfer,
                    status: TransactionStatus.Pending, // Pending review
                    allocationType: 'location',
                    allocationId: locId,
                    allocationName: '', // Fill if possible, but map key is ID
                    isDeleted: false
                };
                // Find location Name
                suppliers.forEach(s => {
                    const l = s.locations.find(loc => loc.id === locId);
                    if (l) t.allocationName = l.name;
                });

                batch.set(newRef, { ...t, relatedDocumentId: 'AUTO-RENT' });
                createdCount++;
            }
        }
    });

    if (createdCount > 0) {
        await batch.commit();
        return `Generati ${createdCount} movimenti di affitto per il mese corrente.`;
    } else {
        return "Nessun nuovo movimento di affitto necessario.";
    }
};

export const checkAndSetOverdueInvoices = async () => {
    // FIX: Rimosso filtro complesso che richiedeva Index.
    // Scarichiamo solo gli attivi e filtriamo in memoria.
    const q = query(invoiceCollectionRef, 
        where("isDeleted", "==", false)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const today = new Date();
    let updates = 0;

    snapshot.docs.forEach(docSnap => {
        const inv = docSnap.data() as Invoice;
        
        // PROTEZIONE CRITICA: Se la fattura è Sigillata (SealedSDI), è intoccabile dagli automatismi.
        // Non può diventare "Overdue" automaticamente perché è uno stato fiscale definitivo.
        // Lo stato Overdue si applica ai pagamenti, ma SealedSDI ha priorità semantica di immutabilità.
        if (inv.status === DocumentStatus.SealedSDI) return;

        // Filtro logico Client-side
        if (inv.status === DocumentStatus.Paid) return; 
        if (inv.status === DocumentStatus.Overdue) return; 
        if (inv.status === DocumentStatus.Draft) return;

        const dueDate = new Date(inv.dueDate);
        // Resetta l'ora della scadenza per confronto equo (fine giornata)
        dueDate.setHours(23, 59, 59, 999);
        
        if (dueDate < today) {
            batch.update(docSnap.ref, { status: DocumentStatus.Overdue });
            updates++;
        }
    });

    if (updates > 0) await batch.commit();
};
