
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

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

async function smartLinkEnrollments() {
    console.log("--- INIZIO SMART LINKING V2 (FIX DAY OF WEEK) ---");
    
    try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Caricati ${courses.length} corsi per il matching.`);

        const enrSnap = await getDocs(collection(db, 'enrollments'));
        const activeEnrollments = enrSnap.docs.filter(d => {
            const data = d.data();
            const isActive = ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(data.status || '');
            const remaining = data.lessonsRemaining !== undefined ? data.lessonsRemaining : (data.labRemaining || 0);
            return isActive && remaining > 0 && !data.courseId;
        });

        console.log(`Trovate ${activeEnrollments.length} iscrizioni attive da ricollegare.`);

        let linkedCount = 0;
        let skipCount = 0;

        for (const enrDoc of activeEnrollments) {
            const enrData = enrDoc.data();
            const appts = enrData.appointments || [];
            if (appts.length === 0) {
                skipCount++;
                continue;
            }

            const mainAppt = appts[0];
            const locId = enrData.locationId;
            const start = mainAppt.startTime;
            
            // CALCOLO DINAMICO DEL GIORNO DELLA SETTIMANA
            let day = mainAppt.dayOfWeek;
            if (day === undefined && mainAppt.date) {
                // Se manca dayOfWeek, lo ricaviamo dalla data (YYYY-MM-DD)
                const dateObj = new Date(mainAppt.date);
                day = dateObj.getDay(); 
            } else if (typeof day === 'string') {
                day = parseInt(day);
            }

            if (day === undefined || isNaN(day)) {
                console.log(`- Iscrizione ${enrDoc.id} (${enrData.childName}): Impossibile determinare il giorno. Skip.`);
                skipCount++;
                continue;
            }

            // Cerchiamo il corso corrispondente
            const matchedCourse = courses.find(c => 
                c.locationId === locId && 
                c.dayOfWeek === day && 
                c.startTime === start
            );

            if (matchedCourse) {
                console.log(`- Iscrizione ${enrDoc.id} (${enrData.childName}): Collegata al corso ${matchedCourse.id} (Giorno ${day}, Ore ${start})`);
                await updateDoc(doc(db, 'enrollments', enrDoc.id), {
                    courseId: matchedCourse.id,
                    updatedAt: serverTimestamp()
                });
                linkedCount++;
            } else {
                console.log(`- Iscrizione ${enrDoc.id} (${enrData.childName}): Nessun corso trovato per Loc:${locId}, Day:${day}, Time:${start}. Skip.`);
                skipCount++;
            }
        }

        console.log(`\n--- SMART LINKING COMPLETATO ---`);
        console.log(`Iscrizioni collegate: ${linkedCount}`);
        console.log(`Iscrizioni saltate: ${skipCount}`);

    } catch (error) {
        console.error("Errore durante lo smart linking:", error);
    }
}

smartLinkEnrollments();
