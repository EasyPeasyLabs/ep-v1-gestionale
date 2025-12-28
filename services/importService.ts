
// FIX: Corrected Firebase import path.
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase/config';
import { Client, ClientType, ParentClientInput, InstitutionalClientInput, SupplierInput, Supplier, EnrollmentInput, EnrollmentStatus, PaymentMethod } from '../types';
import { ImportResult } from '../components/ImportModal';
import { getClients, addClient } from './parentService';
import { getSubscriptionTypes } from './settingsService';
import { getSuppliers } from './supplierService';
import { addEnrollment, activateEnrollmentWithLocation, getAllEnrollments, bulkUpdateLocation } from './enrollmentService';
import { processPayment } from './paymentService';

// Helper per leggere il contenuto del file come ArrayBuffer per xlsx
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Helper per parsing giorni (LUN -> 1, DOM -> 0)
const parseDayString = (dayStr: string | number): number | null => {
    if (typeof dayStr === 'number') return dayStr; // Supporto retroattivo per numeri
    if (!dayStr) return null;
    
    const s = dayStr.toString().trim().toUpperCase().substring(0, 3);
    const map: Record<string, number> = {
        'DOM': 0, 'SUN': 0,
        'LUN': 1, 'MON': 1,
        'MAR': 2, 'TUE': 2,
        'MER': 3, 'WED': 3,
        'GIO': 4, 'THU': 4,
        'VEN': 5, 'FRI': 5,
        'SAB': 6, 'SAT': 6
    };
    return map[s] !== undefined ? map[s] : null;
};

// Helper per parsing metodo pagamento
const parsePaymentMethod = (methodStr: string): PaymentMethod => {
    if (!methodStr) return PaymentMethod.BankTransfer;
    const s = methodStr.toLowerCase();
    if (s.includes('contan')) return PaymentMethod.Cash;
    if (s.includes('carta') || s.includes('credit')) return PaymentMethod.CreditCard;
    if (s.includes('pay')) return PaymentMethod.PayPal;
    return PaymentMethod.BankTransfer;
};

// Helper per parsing booleano (CreateInvoice)
const parseBoolean = (val: any): boolean => {
    if (val === undefined || val === null || val === '') return true; // Default True se non specificato
    const s = String(val).toLowerCase().trim();
    if (['no', 'false', '0', 'n', 'falso'].includes(s)) return false;
    return true;
};

// Helper per analizzare il contenuto di un file Excel
const parseExcel = async (file: File): Promise<Record<string, any>[]> => {
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // header: 1 dice a SheetJS di trattare la prima riga come intestazioni
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) return []; // Se non ci sono dati oltre all'intestazione

    const headers = data[0] as string[];
    const rows = data.slice(1);

    return rows.map(rowArray => {
        const row = rowArray as any[];
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
            // Trim headers to avoid issues with spaces
            const cleanHeader = header ? header.trim() : `col_${index}`;
            obj[cleanHeader] = row[index];
        });
        return obj;
    });
};


export const importClientsFromExcel = async (file: File): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const data = await parseExcel(file);

    if (data.length === 0) {
        result.errors.push({ row: 0, message: 'File vuoto o non valido.' });
        return result;
    }

    const clientCollectionRef = collection(db, 'clients');
    const existingClientsSnapshot = await getDocs(clientCollectionRef);
    const existingClientsMap = new Map<string, string>(); // email -> docId
    existingClientsSnapshot.docs.forEach(doc => {
        const clientData = doc.data() as Client;
        if (clientData.email) {
            existingClientsMap.set(clientData.email.toLowerCase(), doc.id);
        }
    });

    const batch = writeBatch(db);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // +1 for header, +1 for 0-index

        if (!row.email || !row.type) {
            result.errors.push({ row: rowNum, message: 'Le colonne "email" e "type" sono obbligatorie.' });
            continue;
        }

        const clientEmail = String(row.email).toLowerCase();
        let clientData: ParentClientInput | InstitutionalClientInput;

        try {
            if (row.type === 'parent') {
                if (!row.firstName || !row.lastName || !row.taxCode) {
                     result.errors.push({ row: rowNum, message: 'Per tipo "parent", le colonne "firstName", "lastName" e "taxCode" sono obbligatorie.' });
                    continue;
                }
                clientData = {
                    clientType: ClientType.Parent,
                    email: String(row.email),
                    phone: String(row.phone || ''),
                    address: String(row.address || ''),
                    zipCode: String(row.zipCode || ''),
                    city: String(row.city || ''),
                    province: String(row.province || ''),
                    firstName: String(row.firstName),
                    lastName: String(row.lastName),
                    taxCode: String(row.taxCode),
                    children: [],
                    notesHistory: [],
                    tags: [],
                    rating: { availability: 0, complaints: 0, churnRate: 0, distance: 0 }
                };
            } else if (row.type === 'institutional') {
                 if (!row.companyName || !row.vatNumber) {
                    result.errors.push({ row: rowNum, message: 'Per tipo "institutional", le colonne "companyName" e "vatNumber" sono obbligatorie.' });
                    continue;
                }
                clientData = {
                    clientType: ClientType.Institutional,
                    email: String(row.email),
                    phone: String(row.phone || ''),
                    address: String(row.address || ''),
                    zipCode: String(row.zipCode || ''),
                    city: String(row.city || ''),
                    province: String(row.province || ''),
                    companyName: String(row.companyName),
                    vatNumber: String(row.vatNumber),
                    numberOfChildren: 0,
                    ageRange: '',
                    notesHistory: [],
                    tags: []
                };
            } else {
                result.errors.push({ row: rowNum, message: 'Il valore nella colonna "type" deve essere "parent" o "institutional".' });
                continue;
            }

            const existingId = existingClientsMap.get(clientEmail);
            if (existingId) {
                const docRef = doc(db, 'clients', existingId);
                batch.update(docRef, clientData as any);
                result.updated++;
            } else {
                const docRef = doc(clientCollectionRef);
                batch.set(docRef, clientData);
                result.created++;
            }
        } catch (e) {
            result.errors.push({ row: rowNum, message: (e as Error).message });
        }
    }

    if (result.created > 0 || result.updated > 0) {
        await batch.commit();
    }

    return result;
};


export const importSuppliersFromExcel = async (file: File): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const data = await parseExcel(file);

    if (data.length === 0) {
        result.errors.push({ row: 0, message: 'File vuoto o non valido.' });
        return result;
    }

    const supplierCollectionRef = collection(db, 'suppliers');
    const existingSuppliersSnapshot = await getDocs(supplierCollectionRef);
    const existingSuppliersMap = new Map<string, string>(); // companyName -> docId
    existingSuppliersSnapshot.docs.forEach(doc => {
        const supplierData = doc.data() as Supplier;
        if (supplierData.companyName) {
            existingSuppliersMap.set(supplierData.companyName.toLowerCase(), doc.id);
        }
    });

    const batch = writeBatch(db);

     for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        if (!row.companyName || !row.vatNumber || !row.email || !row.phone) {
             result.errors.push({ row: rowNum, message: 'Le colonne companyName, vatNumber, email, phone sono obbligatorie.' });
            continue;
        }

        const supplierName = String(row.companyName).toLowerCase();
        const supplierData: SupplierInput = {
            companyName: String(row.companyName),
            vatNumber: String(row.vatNumber),
            address: String(row.address || ''),
            zipCode: String(row.zipCode || ''),
            city: String(row.city || ''),
            province: String(row.province || ''),
            email: String(row.email),
            phone: String(row.phone),
            locations: [],
            notes: '',
            notesHistory: [],
            tags: [],
            rating: { responsiveness: 0, partnership: 0, negotiation: 0 },
            isDeleted: false
        };

        const existingId = existingSuppliersMap.get(supplierName);
        if (existingId) {
            const docRef = doc(db, 'suppliers', existingId);
            batch.update(docRef, supplierData as any);
            result.updated++;
        } else {
            const docRef = doc(supplierCollectionRef);
            batch.set(docRef, supplierData);
            result.created++;
        }
    }

    if (result.created > 0 || result.updated > 0) {
        await batch.commit();
    }

    return result;
};

// --- NEW ENROLLMENT IMPORT LOGIC ---
export const importEnrollmentsFromExcel = async (file: File): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const data = await parseExcel(file);

    if (data.length === 0) {
        result.errors.push({ row: 0, message: 'File vuoto o non valido.' });
        return result;
    }

    // 1. Fetch Reference Data (Clients, Subscriptions, Suppliers, Existing Enrollments)
    const [clients, subscriptions, suppliers, existingEnrollments] = await Promise.all([
        getClients(),
        getSubscriptionTypes(),
        getSuppliers(),
        getAllEnrollments()
    ]);

    // Helpers for lookup
    const findClient = (email: string, cf: string) => {
        return clients.find(c => 
            (c.email && c.email.toLowerCase() === email.toLowerCase()) || 
            (c.clientType === ClientType.Parent && (c as any).taxCode && (c as any).taxCode.toLowerCase() === cf.toLowerCase())
        );
    };

    const findSubscription = (name: string) => subscriptions.find(s => s.name.toLowerCase() === name.toLowerCase());
    
    const findLocation = (name: string) => {
        for (const s of suppliers) {
            const loc = s.locations.find(l => l.name.toLowerCase() === name.toLowerCase());
            if (loc) return { loc, supplier: s };
        }
        return null;
    };

    // Iterate Rows
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        try {
            // A. Validate Mandatory
            if (!row.ParentEmail || !row.ChildName || !row.SubscriptionName) {
                throw new Error("Mancano dati obbligatori: ParentEmail, ChildName o SubscriptionName.");
            }

            // B. Resolve Parent
            let clientId = '';
            const existingClient = findClient(String(row.ParentEmail), String(row.ParentFiscalCode || ''));
            
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                // Create New Parent
                const newClient: ParentClientInput = {
                    clientType: ClientType.Parent,
                    firstName: String(row.ParentName || 'Genitore'),
                    lastName: String(row.ParentSurname || 'Nuovo'),
                    email: String(row.ParentEmail),
                    phone: String(row.ParentPhone || ''),
                    taxCode: String(row.ParentFiscalCode || ''),
                    // Address Fields
                    address: String(row.ParentAddress || ''),
                    zipCode: String(row.ParentZip || ''),
                    city: String(row.ParentCity || ''),
                    province: String(row.ParentProvince || ''),
                    
                    children: [{
                        id: Date.now().toString(),
                        name: String(row.ChildName),
                        age: String(row.ChildAge || ''),
                        notes: '', notesHistory: [], tags: [], rating: { learning:0, behavior:0, attendance:0, hygiene:0 }
                    }],
                    notesHistory: [], tags: [], rating: { availability:0, complaints:0, churnRate:0, distance:0 }
                };
                clientId = await addClient(newClient);
                result.created++; // Count created client contextually? Let's stick to enrollments.
            }

            // C. Resolve Subscription
            const sub = findSubscription(String(row.SubscriptionName));
            if (!sub) throw new Error(`Pacchetto "${row.SubscriptionName}" non trovato.`);

            // D. Check for Existing Enrollment (Move Logic)
            // Cerca se esiste già un'iscrizione ATTIVA per questo cliente + bambino + pacchetto
            const activeEnrollment = existingEnrollments.find(e => 
                e.clientId === clientId && 
                e.childName.toLowerCase() === String(row.ChildName).toLowerCase() && 
                e.status === EnrollmentStatus.Active &&
                e.subscriptionName === sub.name
            );

            const rowStartDate = row.StartDate ? new Date(row.StartDate).toISOString() : new Date().toISOString();
            const dayOfWeek = parseDayString(row.DayOfWeek);

            if (activeEnrollment && row.LocationName && row.LocationName !== activeEnrollment.locationName) {
                // --- MOVE LOGIC ---
                const locData = findLocation(String(row.LocationName));
                if (locData) {
                    // Esegui cambio sede (Aggiorna lezioni future + location su enrollment)
                    await bulkUpdateLocation(
                        [activeEnrollment.id],
                        rowStartDate, // Data decorrenza
                        locData.loc.id,
                        locData.loc.name,
                        locData.loc.color,
                        String(row.StartTime || activeEnrollment.appointments[0]?.startTime || '16:00'),
                        String(row.EndTime || activeEnrollment.appointments[0]?.endTime || '18:00')
                    );
                    result.updated++;
                    // Skip payment creation for moves usually, or check if specific payment attached
                } else {
                    result.errors.push({ row: rowNum, message: `Sede destinazione "${row.LocationName}" non trovata per spostamento.` });
                }
            } else {
                // --- CREATE LOGIC ---
                // Se non esiste attiva, creane una nuova
                
                const endDateObj = new Date(rowStartDate);
                endDateObj.setDate(endDateObj.getDate() + sub.durationInDays);

                const enrollmentInput: EnrollmentInput = {
                    clientId,
                    childId: `import-${Date.now()}-${i}`,
                    childName: String(row.ChildName),
                    isAdult: false,
                    subscriptionTypeId: sub.id,
                    subscriptionName: sub.name,
                    price: sub.price,
                    supplierId: 'unassigned',
                    supplierName: '',
                    locationId: 'unassigned',
                    locationName: 'Sede Non Definita',
                    locationColor: '#ccc',
                    appointments: [],
                    lessonsTotal: sub.lessons,
                    lessonsRemaining: sub.lessons,
                    startDate: rowStartDate,
                    endDate: endDateObj.toISOString(),
                    status: EnrollmentStatus.Pending
                };

                const enrollmentId = await addEnrollment(enrollmentInput);
                result.created++;

                // Activation (Location Assignment)
                if (row.LocationName && dayOfWeek !== null && row.StartTime) {
                    const locData = findLocation(String(row.LocationName));
                    if (locData) {
                        await activateEnrollmentWithLocation(
                            enrollmentId,
                            locData.supplier.id,
                            locData.supplier.companyName,
                            locData.loc.id,
                            locData.loc.name,
                            locData.loc.color,
                            dayOfWeek,
                            String(row.StartTime),
                            String(row.EndTime || '18:00')
                        );
                    } else {
                        result.errors.push({ row: rowNum, message: `Sede "${row.LocationName}" non trovata. Iscrizione creata come "Da Assegnare".` });
                    }
                }

                // Financials (Payment)
                if (row.AmountPaid && Number(row.AmountPaid) > 0) {
                    const amount = Number(row.AmountPaid);
                    const isDeposit = (row.PaymentType || '').toLowerCase().includes('acconto');
                    const method = parsePaymentMethod(row.PaymentMethod);
                    const paymentDate = row.PaymentDate ? new Date(row.PaymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    const sdiId = row.SDI ? String(row.SDI) : undefined;
                    
                    // NEW: Check invoice creation flag
                    const shouldCreateInvoice = parseBoolean(row.CreateInvoice);

                    // Mock object for processPayment
                    const mockEnr = { ...enrollmentInput, id: enrollmentId } as any; 
                    
                    // Se abbiamo creato la location durante activation, aggiorniamo il mock per la fattura
                    if (row.LocationName && findLocation(String(row.LocationName))) {
                        mockEnr.locationName = row.LocationName;
                    }

                    const payResult = await processPayment(
                        mockEnr,
                        existingClient, 
                        amount,
                        paymentDate,
                        method,
                        shouldCreateInvoice, // Use parsed flag
                        isDeposit, // True = Acconto, False = Saldo/Unica
                        sub.price,
                        undefined // No ghost promo for import
                    );

                    // Se c'è SDI, aggiorniamo la fattura creata
                    if (payResult.success && sdiId) {
                        // Logica extra: trovare la fattura appena creata e mettere SDI. 
                        // Per semplicità, l'utente può metterlo a mano o potremmo estendere processPayment.
                        // Qui lasciamo come TODO o integrazione futura.
                    }
                }
            }

        } catch (e) {
            result.errors.push({ row: rowNum, message: (e as Error).message });
        }
    }

    return result;
};