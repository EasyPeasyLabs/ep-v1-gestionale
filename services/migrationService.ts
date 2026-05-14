
import { db } from '../firebase/config';
import { collection, getDocs, doc, setDoc, serverTimestamp, writeBatch, query, where, getDoc } from 'firebase/firestore';

export const migrateLocations = async () => {
    console.log("Starting migration...");
    const suppliersSnap = await getDocs(collection(db, 'suppliers'));
    let count = 0;

    for (const sDoc of suppliersSnap.docs) {
        const supplier = sDoc.data();
        const locations = supplier.locations || [];
        
        for (const loc of locations) {
            if (!loc.id) continue;
            
            await setDoc(doc(db, 'locations', loc.id), {
                ...loc,
                supplierId: sDoc.id,
                status: loc.closedAt ? 'closed' : 'active',
                updatedAt: serverTimestamp()
            });
            count++;
            console.log(`Synced location: ${loc.name} (${loc.id})`);
        }
    }
    
    console.log(`Migration finished. ${count} locations synced.`);
    return count;
};

export const migrateLocationRecords = async (sourceLocationId: string, targetLocationId: string, fromDate: string) => {
    const sourceLocDoc = await getDoc(doc(db, 'locations', sourceLocationId));
    const targetLocDoc = await getDoc(doc(db, 'locations', targetLocationId));

    if (!sourceLocDoc.exists() || !targetLocDoc.exists()) {
        throw new Error("Una delle sedi specificate (origine o destinazione) non esiste.");
    }

    const targetLocation = targetLocDoc.data();
    
    const targetSupplierDoc = await getDoc(doc(db, 'suppliers', targetLocation.supplierId));
    const targetSupplierName = targetSupplierDoc.exists() ? targetSupplierDoc.data()?.companyName : '';

    const batch = writeBatch(db);
    let operationCount = 0;
    
    // Chunking utility
    const operations: { ref: any, data: { [key: string]: any } }[] = [];

    // 1. Courses
    const coursesQ = query(collection(db, 'courses'), where('locationId', '==', sourceLocationId));
    const coursesSnap = await getDocs(coursesQ);
    for (const d of coursesSnap.docs) {
        const data = d.data();
        if (!data.endDate || data.endDate >= fromDate) {
            operations.push({ ref: d.ref, data: { locationId: targetLocationId } });
        }
    }

    // 2. Enrollments
    const enrollmentsQ = query(collection(db, 'enrollments'), where('locationId', '==', sourceLocationId));
    const enrollmentsSnap = await getDocs(enrollmentsQ);
    for (const d of enrollmentsSnap.docs) {
        const data = d.data();
        if (!data.endDate || data.endDate >= fromDate) {
            operations.push({
                ref: d.ref,
                data: {
                    locationId: targetLocationId,
                    locationName: targetLocation.name,
                    locationColor: targetLocation.color || '#000000',
                    supplierId: targetLocation.supplierId,
                    supplierName: targetSupplierName || ''
                }
            });
        }
    }

    // 3. Lessons
    const lessonsQ = query(collection(db, 'lessons'), where('locationId', '==', sourceLocationId), where('date', '>=', fromDate));
    const lessonsSnap = await getDocs(lessonsQ);
    for (const d of lessonsSnap.docs) {
        operations.push({
            ref: d.ref,
            data: {
                locationId: targetLocationId,
                locationName: targetLocation.name,
                locationColor: targetLocation.color || '#000000'
            }
        });
    }

    // 4. Transactions
    const transactionsQ = query(collection(db, 'transactions'), 
        where('allocationType', '==', 'location'),
        where('allocationId', '==', sourceLocationId),
        where('date', '>=', fromDate)
    );
    const transactionsSnap = await getDocs(transactionsQ);
    for (const d of transactionsSnap.docs) {
        operations.push({
            ref: d.ref,
            data: {
                allocationId: targetLocationId,
                allocationName: targetLocation.name,
                supplierId: targetLocation.supplierId
            }
        });
    }

    const BATCH_SIZE = 450;
    let b = writeBatch(db);
    let opCount = 0;
    for (const op of operations) {
        b.update(op.ref, op.data);
        opCount++;
        if (opCount === BATCH_SIZE) {
            await b.commit();
            b = writeBatch(db);
            opCount = 0;
        }
    }
    if (opCount > 0) {
        await b.commit();
    }
    
    return operations.length;
};
