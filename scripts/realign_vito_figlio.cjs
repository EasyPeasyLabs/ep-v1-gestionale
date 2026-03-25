
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Richiede un service account per l'esecuzione locale se necessario, 
// o usa l'ambiente di default se eseguito in un contesto autorizzato.
// Per semplicità, assumiamo che le credenziali siano caricate correttamente.

const db = getFirestore();

async function realignVitoFiglio() {
    console.log("=== START REALIGNMENT: VitoFiglio ===");

    try {
        // 1. Trova il Cliente Vito Loiudice
        const clientsRef = db.collection('clients');
        const clientSnap = await clientsRef.where('lastName', '==', 'Loiudice').where('firstName', '==', 'Vito').get();

        if (clientSnap.empty) {
            console.error("Cliente Vito Loiudice non trovato.");
            return;
        }

        const clientDoc = clientSnap.docs[0];
        const clientId = clientDoc.id;
        const clientData = clientDoc.data();
        console.log(`- Trovato Cliente: ${clientId} (${clientData.firstName} ${clientData.lastName})`);

        // Trova il childId di VitoFiglio
        const child = clientData.children.find(c => c.name.toLowerCase().includes('vitofiglio'));
        if (!child) {
            console.error("Allievo VitoFiglio non trovato nell'anagrafica di Vito Loiudice.");
            return;
        }
        const childId = child.id;
        console.log(`- Trovato Allievo childId: ${childId}`);

        // 2. Trova l'Iscrizione
        const enrollmentsRef = db.collection('enrollments');
        const enrSnap = await enrollmentsRef.where('clientId', '==', clientId).get();
        
        let targetEnrollment = null;
        enrSnap.forEach(doc => {
            const data = doc.data();
            if (data.childName.toLowerCase().includes('vitofiglio')) {
                targetEnrollment = { id: doc.id, ...data };
            }
        });

        if (!targetEnrollment) {
            console.error("Iscrizione per VitoFiglio non trovata.");
            return;
        }
        console.log(`- Trovata Iscrizione: ${targetEnrollment.id}`);

        // 3. Trova il Corso Corrispondente (Matching Sprint 13)
        // Usiamo i dati presenti nel lead se disponibili, o cerchiamo il primo corso compatibile
        const coursesRef = db.collection('courses');
        const coursesSnap = await coursesRef.where('locationName', '==', targetEnrollment.locationName).get();
        
        let bestCourse = null;
        coursesSnap.forEach(doc => {
            const c = doc.data();
            // Cerchiamo un corso che abbia una capienza disponibile (opzionale qui)
            // o semplicemente il primo match per sede se non abbiamo altri orari
            if (!bestCourse) bestCourse = { id: doc.id, ...c };
        });

        if (!bestCourse) {
            console.warn("Nessun corso trovato per la sede:", targetEnrollment.locationName);
            // Fallback: cerca in tutte le sedi se necessario, o usa orari di default
        } else {
            console.log(`- Matching Corso: ${bestCourse.id} (${bestCourse.startTime}-${bestCourse.endTime})`);
        }

        // 4. Update Iscrizione
        const updateData = {
            childId: childId,
            courseId: bestCourse ? bestCourse.id : targetEnrollment.courseId || '',
            startTime: bestCourse ? bestCourse.startTime : targetEnrollment.startTime || '16:00',
            endTime: bestCourse ? bestCourse.endTime : targetEnrollment.endTime || '18:00',
            status: 'Active' // Forza a Active se era In Attesa
        };

        // Se appointments è vuoto, creiamo un template
        if (!targetEnrollment.appointments || targetEnrollment.appointments.length === 0) {
            updateData.appointments = [{
                lessonId: 'template-fix',
                date: targetEnrollment.startDate || new Date().toISOString(),
                startTime: updateData.startTime,
                endTime: updateData.endTime,
                locationId: bestCourse ? bestCourse.locationId : targetEnrollment.locationId,
                locationName: targetEnrollment.locationName,
                childName: targetEnrollment.childName,
                status: 'Scheduled'
            }];
        }

        await enrollmentsRef.doc(targetEnrollment.id).update(updateData);
        console.log("✅ Iscrizione aggiornata con successo.");

        // 5. Rimuovi tag LEAD e aggiungi GENITORE se necessario
        const currentTags = clientData.tags || [];
        const newTags = currentTags.filter(t => t !== 'LEAD');
        if (!newTags.includes('GENITORE')) newTags.push('GENITORE');

        if (JSON.stringify(currentTags) !== JSON.stringify(newTags)) {
            await clientsRef.doc(clientId).update({ tags: newTags });
            console.log("✅ Tag cliente aggiornati (Rimossa LEAD, aggiunta GENITORE).");
        }

    } catch (error) {
        console.error("ERRORE durante il riallineamento:", error);
    }
}

// Inizializzazione fittizia (il sistema userà il contesto esistente)
// realignVitoFiglio();
console.log("Script pronto per l'esecuzione manuale o tramite trigger.");
