
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

async function nuclearFix() {
    console.log("--- INIZIO FIX NUCLEARE OCCUPAZIONE ---");
    
    try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const enrSnap = await getDocs(collection(db, 'enrollments'));
        const enrollments = enrSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log(`Analizzando ${courses.length} corsi e ${enrollments.length} iscrizioni...`);

        for (const course of courses) {
            let courseOccupancy = 0;
            console.log(`\nVerifica Corso: ${course.id} (Sede: ${course.locationId}, Giorno: ${course.dayOfWeek}, Ora: ${course.startTime})`);

            for (const enr of enrollments) {
                // Filtro validità iscrizione
                const isActive = ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(enr.status || '');
                const remaining = enr.lessonsRemaining !== undefined ? enr.lessonsRemaining : (enr.labRemaining || 0);
                if (!isActive || remaining <= 0) continue;

                const appt = enr.appointments?.[0];
                if (!appt || !appt.date) continue;

                // Estrazione giorno della settimana robusta (prende i primi 10 caratteri YYYY-MM-DD)
                const dateString = appt.date.substring(0, 10);
                const dayOfWeek = new Date(dateString).getDay();
                
                // Normalizzazione orari
                const enrTime = String(appt.startTime).trim().replace('.', ':');
                const courseTime = String(course.startTime).trim().replace('.', ':');

                // MATCHING
                if (enr.locationId === course.locationId && dayOfWeek === course.dayOfWeek && enrTime === courseTime) {
                    console.log(`   [MATCH FOUND] -> ${enr.childName}`);
                    
                    // Colleghiamo l'iscrizione al corso
                    await updateDoc(doc(db, 'enrollments', enr.id), {
                        courseId: course.id
                    });
                    
                    courseOccupancy++;
                }
            }

            // Aggiorniamo l'occupazione del corso
            console.log(`   >> Aggiorno occupazione corso: ${courseOccupancy}`);
            await updateDoc(doc(db, 'courses', course.id), {
                activeEnrollmentsCount: courseOccupancy,
                lastNuclearFix: new Date().toISOString()
            });
        }

        console.log("\n--- OPERAZIONE COMPLETATA ---");
        console.log("La pagina pubblica ora dovrebbe mostrare i dati corretti.");

    } catch (error) {
        console.error("Errore fatale:", error);
    }
}

nuclearFix();
