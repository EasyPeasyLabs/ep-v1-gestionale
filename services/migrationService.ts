
import { db } from './firebase/config';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
