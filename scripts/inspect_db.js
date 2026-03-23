
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";

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

async function inspectData() {
    console.log("--- ISPEZIONE DATI ---");
    
    try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        console.log(`\nCORSI (${coursesSnap.size}):`);
        coursesSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- Corso ${doc.id}: Occupazione=${data.activeEnrollmentsCount}, Capienza=${data.capacity}, Status=${data.status}`);
        });

        const enrSnap = await getDocs(query(collection(db, 'enrollments'), limit(10)));
        console.log(`\nCAMPIONE ISCRIZIONI (Ultime 10):`);
        enrSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`- Iscrizione ${doc.id}: courseId=${data.courseId || 'MANCANTE'}, status=${data.status}, child=${data.childName}`);
        });

    } catch (error) {
        console.error("Errore durante l'ispezione:", error);
    }
}

inspectData();
