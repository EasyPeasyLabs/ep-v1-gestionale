
import { db } from '../firebase/config';
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';

async function realignOccupancy() {
    console.log("--- INIZIO RIALLINEAMENTO STORICO ---");
    
    try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        console.log(`Analisi di ${coursesSnap.size} corsi in corso...`);

        let updatedCount = 0;

        for (const courseDoc of coursesSnap.docs) {
            const courseId = courseDoc.id;
            const courseData = courseDoc.data();

            // 1. Recupera TUTTE le iscrizioni per questo corso
            const enrQuery = query(
                collection(db, 'enrollments'),
                where('courseId', '==', courseId)
            );
            
            const enrSnap = await getDocs(enrQuery);
            
            // 2. Filtra per Realtà Operativa (Stato Attivo + Lezioni > 0)
            const realCount = enrSnap.docs.filter(d => {
                const data = d.data();
                const isActive = ['active', 'Active', 'confirmed', 'Confirmed', 'pending', 'Pending'].includes(data.status);
                const remaining = data.lessonsRemaining !== undefined ? data.lessonsRemaining : (data.labRemaining || 0);
                return isActive && remaining > 0;
            }).length;

            // 3. Allineamento se necessario
            if (courseData.activeEnrollmentsCount !== realCount) {
                console.log(`RIALLINEAMENTO [${courseId}]: ${courseData.activeEnrollmentsCount || 0} -> ${realCount}`);
                await updateDoc(doc(db, 'courses', courseId), {
                    activeEnrollmentsCount: realCount,
                    lastSyncAt: new Date().toISOString()
                });
                updatedCount++;
            }
        }

        console.log(`--- RIALLINEAMENTO COMPLETATO: ${updatedCount} corsi aggiornati ---`);
    } catch (error) {
        console.error("Errore durante il riallineamento:", error);
    }
}

realignOccupancy();
