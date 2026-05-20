import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
    const courses = await getDocs(collection(db, 'courses'));
    const locations = await getDocs(collection(db, 'locations')); // actually locations are under suppliers
    const suppliers = await getDocs(collection(db, 'suppliers'));

    const locs = [];
    suppliers.docs.forEach(s => {
        const data = s.data();
        (data.locations || []).forEach(l => {
            locs.push({ ...l, supplierName: data.name });
        });
    });

    console.log("=== COURSES ===");
    courses.docs.forEach(c => {
        const d = c.data();
        if (d.name.includes("MEG") || d.name.includes("MCT")) {
            console.log(c.id, d.name, d.locationId);
        }
    });

    console.log("=== LOCS ===");
    locs.forEach(l => {
        if (l.name.includes("MEG") || l.name.includes("MCT")) {
            console.log(l.id, l.name);
        }
    });
    
    process.exit(0);
}

inspect();
