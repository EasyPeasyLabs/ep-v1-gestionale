
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { parseISO, getDay } from "date-fns";

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

async function forceSmartLink() {
    console.log("--- INIZIO SBLOCCO TOTALE ISCRIZIONI ---");
    
    try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Caricati ${courses.length} corsi validi.`);

        const enrSnap = await getDocs(collection(db, 'enrollments'));
        const activeEnrollments = enrSnap.docs.filter(d => {
            const data = d.data();
            const isActive = ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(data.status || '');
            const remaining = data.lessonsRemaining !== undefined ? data.lessonsRemaining : (data.labRemaining || 0);
            return isActive && remaining > 0;
        });

        console.log(`Analisi di ${activeEnrollments.length} iscrizioni totali (ignorando courseId esistenti)...`);

        let updatedCount = 0;

        for (const enrDoc of activeEnrollments) {
            const enrData = enrDoc.data();
            const mainAppt = enrData.appointments?.[0];
            if (!mainAppt || !mainAppt.date) continue;

            const locId = String(enrData.locationId).trim();
            const time = String(mainAppt.startTime).trim().replace('.', ':');
            
            // Gestione robusta della data ISO o semplice
            let day;
            try {
                day = getDay(parseISO(mainAppt.date));
            } catch (e) {
                day = new Date(mainAppt.date).getDay();
            }

            const match = courses.find(c => 
                String(c.locationId).trim() === locId &&
                Number(c.dayOfWeek) === day &&
                String(c.startTime).trim().replace('.', ':') === time
            );

            if (match) {
                // Se il courseId è diverso da quello attuale, aggiorniamo
                if (enrData.courseId !== match.id) {
                    console.log(`[RE-LINK] ${enrData.childName}: "${enrData.courseId || 'null'}" -> "${match.id}"`);
                    await updateDoc(doc(db, 'enrollments', enrDoc.id), {
                        courseId: match.id,
                        updatedAt: serverTimestamp()
                    });
                    updatedCount++;
                }
            }
        }

        console.log(`\nSblocco completato! Iscrizioni ri-collegate: ${updatedCount}`);
        
    } catch (error) {
        console.error("Errore:", error);
    }
}

forceSmartLink();
