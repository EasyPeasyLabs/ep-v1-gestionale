
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { parseISO, getDay, format } from "date-fns";

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

async function microscopicDebug() {
    console.log("--- DEBUG AL MICROSCOPIO ---");
    
    try {
        // 1. Dati Arianna
        const enrSnap = await getDoc(doc(db, 'enrollments', '0eqsgybWuYUhZnhO8HmY'));
        const arianna = enrSnap.data();
        const mainAppt = arianna.appointments?.[0];
        
        console.log("\nISCRIZIONE (Arianna):");
        console.log(`- locationId: [${arianna.locationId}] (Tipo: ${typeof arianna.locationId})`);
        console.log(`- startTime: [${mainAppt?.startTime}] (Tipo: ${typeof mainAppt?.startTime})`);
        console.log(`- date: [${mainAppt?.date}]`);
        
        if (mainAppt?.date) {
            const dateObj = parseISO(mainAppt.date);
            console.log(`- Giorno calcolato (getDay): ${getDay(dateObj)} (${format(dateObj, 'EEEE')})`);
        }

        // 2. Corsi nella stessa sede
        console.log("\nCORSI DISPONIBILI NELLA SEDE temp-1768474613763:");
        const coursesSnap = await getDocs(collection(db, 'courses'));
        coursesSnap.docs.forEach(d => {
            const c = d.data();
            if (c.locationId === 'temp-1768474613763') {
                console.log(`- ID Corso: ${d.id}`);
                console.log(`  - dayOfWeek: [${c.dayOfWeek}] (Tipo: ${typeof c.dayOfWeek})`);
                console.log(`  - startTime: [${c.startTime}] (Tipo: ${typeof c.startTime})`);
            }
        });

    } catch (error) {
        console.error("Errore:", error);
    }
}

microscopicDebug();
