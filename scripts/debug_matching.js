
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, query, where, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugMatching() {
    console.log("--- DEBUG CHIRURGICO MATCHING ---");
    
    try {
        // 1. Analisi Arianna
        const enrSnap = await getDoc(doc(db, 'enrollments', '0eqsgybWuYUhZnhO8HmY'));
        const arianna = enrSnap.data();
        console.log("\nDATI ARIANNA:");
        console.log(`- Status: ${arianna.status}`);
        console.log(`- locationId: "${arianna.locationId}"`);
        console.log(`- Appointments:`, JSON.stringify(arianna.appointments?.[0], null, 2));

        // 2. Analisi Corso Potenziale
        const courseSnap = await getDoc(doc(db, 'courses', 'temp-1768474613763_3_1745'));
        const corso = courseSnap.data();
        console.log("\nDATI CORSO POTENZIALE:");
        console.log(`- locationId: "${corso.locationId}"`);
        console.log(`- dayOfWeek: ${corso.dayOfWeek} (Tipo: ${typeof corso.dayOfWeek})`);
        console.log(`- startTime: "${corso.startTime}"`);

    } catch (error) {
        console.error("Errore durante il debug:", error);
    }
}

debugMatching();
