import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Client, ClientType, ParentClientInput, InstitutionalClientInput, SupplierInput } from '../types';
import { ImportResult } from '../components/ImportModal';

// Helper per leggere il contenuto del file come testo
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};


// Helper per analizzare il contenuto CSV in un array di oggetti
const parseCSV = (content: string): { headers: string[], data: Record<string, string>[] } => {
    const lines = content.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 1) return { headers: [], data: [] };

    // Regex per gestire correttamente i campi quotati che possono contenere virgole
    const parseLine = (line: string) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    };

    const headers = parseLine(lines[0]);
    const data = lines.slice(1).map(line => {
        const values = parseLine(line);
        const entry: Record<string, string> = {};
        headers.forEach((header, index) => {
            entry[header] = values[index];
        });
        return entry;
    });
    return { headers, data };
};


export const importClientsFromCSV = async (file: File): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const content = await readFileAsText(file);
    const { data } = parseCSV(content);

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
            result.errors.push({ row: rowNum, message: 'I campi "email" e "type" sono obbligatori.' });
            continue;
        }

        const clientEmail = row.email.toLowerCase();
        let clientData: ParentClientInput | InstitutionalClientInput;

        try {
            if (row.type === 'parent') {
                if (!row.firstName || !row.lastName || !row.taxCode) {
                     result.errors.push({ row: rowNum, message: 'Per tipo "parent", i campi "firstName", "lastName" e "taxCode" sono obbligatori.' });
                    continue;
                }
                clientData = {
                    clientType: ClientType.Parent,
                    email: row.email,
                    phone: row.phone || '',
                    address: row.address || '',
                    zipCode: row.zipCode || '',
                    city: row.city || '',
                    province: row.province || '',
                    firstName: row.firstName,
                    lastName: row.lastName,
                    taxCode: row.taxCode,
                    avatarUrl: `https://i.pravatar.cc/150?u=${row.email}`,
                    children: [],
                    subscriptions: [],
                };
            } else if (row.type === 'institutional') {
                 if (!row.companyName || !row.vatNumber) {
                    result.errors.push({ row: rowNum, message: 'Per tipo "institutional", i campi "companyName" e "vatNumber" sono obbligatori.' });
                    continue;
                }
                clientData = {
                    clientType: ClientType.Institutional,
                    email: row.email,
                    phone: row.phone || '',
                    address: row.address || '',
                    zipCode: row.zipCode || '',
                    city: row.city || '',
                    province: row.province || '',
                    companyName: row.companyName,
                    vatNumber: row.vatNumber,
                    numberOfChildren: 0,
                    ageRange: '',
                };
            } else {
                result.errors.push({ row: rowNum, message: 'Il campo "type" deve essere "parent" o "institutional".' });
                continue;
            }

            const existingId = existingClientsMap.get(clientEmail);
            if (existingId) {
                const docRef = doc(db, 'clients', existingId);
                batch.update(docRef, clientData);
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


export const importSuppliersFromCSV = async (file: File): Promise<ImportResult> => {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const content = await readFileAsText(file);
    const { data } = parseCSV(content);

    if (data.length === 0) {
        result.errors.push({ row: 0, message: 'File vuoto o non valido.' });
        return result;
    }

    const supplierCollectionRef = collection(db, 'suppliers');
    const existingSuppliersSnapshot = await getDocs(supplierCollectionRef);
    const existingSuppliersMap = new Map<string, string>(); // name -> docId
    existingSuppliersSnapshot.docs.forEach(doc => {
        const supplierData = doc.data() as SupplierInput;
        if (supplierData.name) {
            existingSuppliersMap.set(supplierData.name.toLowerCase(), doc.id);
        }
    });

    const batch = writeBatch(db);

     for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        if (!row.name || !row.contactPerson || !row.email || !row.phone) {
             result.errors.push({ row: rowNum, message: 'Tutti i campi (name, contactPerson, email, phone) sono obbligatori.' });
            continue;
        }

        const supplierName = row.name.toLowerCase();
        const supplierData: SupplierInput = {
            name: row.name,
            contactPerson: row.contactPerson,
            email: row.email,
            phone: row.phone,
            locations: []
        };

        const existingId = existingSuppliersMap.get(supplierName);
        if (existingId) {
            const docRef = doc(db, 'suppliers', existingId);
            batch.update(docRef, supplierData);
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
