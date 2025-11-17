import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase/config';
import { Client, ClientType, ParentClientInput, InstitutionalClientInput, SupplierInput, Supplier } from '../types';
import { ImportResult } from '../components/ImportModal';

// Helper per leggere il contenuto del file come ArrayBuffer per xlsx
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
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
            obj[header] = row[index];
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
                    avatarUrl: `https://i.pravatar.cc/150?u=${row.email}`,
                    children: [],
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
            locations: []
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