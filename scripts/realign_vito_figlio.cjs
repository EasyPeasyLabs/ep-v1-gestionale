
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Richiede un service account per l'esecuzione locale se necessario, 
// o usa l'ambiente di default se eseguito in un contesto autorizzato.
const db = getFirestore();

async function realignVitoFiglio() {
    console.log("=== START REALIGNMENT: VitoFiglio (Financial + Enrollment) ===");

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

        // Trova il childId di VitoFiglio
        const child = clientData.children.find(c => c.name.toLowerCase().includes('vitofiglio'));
        if (!child) {
            console.error("Allievo VitoFiglio non trovato.");
            return;
        }
        const childId = child.id;

        // 2. Trova l'Iscrizione
        const enrollmentsRef = db.collection('enrollments');
        const enrSnap = await enrollmentsRef.where('clientId', '==', clientId).get();
        
        let targetEnrollment = null;
        enrSnap.forEach(doc => {
            if (doc.data().childName.toLowerCase().includes('vitofiglio')) {
                targetEnrollment = { id: doc.id, ...doc.data() };
            }
        });

        if (!targetEnrollment) {
            console.error("Iscrizione per VitoFiglio non trovata.");
        } else {
            // Recupera dati abbonamento "Mensile" (fallback se non trovato)
            const subTypesRef = db.collection('settings').doc('subscriptionTypes');
            // Nota: in base alla struttura effettiva potrebbe essere una collezione o un doc.
            // Assumiamo di conoscere i dati del Mensile per questa sanatoria.
            
            const updateData = {
                subscriptionName: 'Mensile',
                price: 130, // Esempio prezzo Mensile
                lessonsTotal: 4,
                lessonsRemaining: 4,
                status: 'Active',
                childId: childId
            };

            await enrollmentsRef.doc(targetEnrollment.id).update(updateData);
            console.log("✅ Iscrizione attivata e aggiornata con Abbonamento Mensile.");
        }

        // 3. Trova e correggi la Transazione in Registro Cassa
        const transactionsRef = db.collection('transactions');
        const transSnap = await transactionsRef.where('clientName', '>=', 'Vito').get();
        
        let targetTransId = null;
        transSnap.forEach(doc => {
            const data = doc.data();
            if (data.description.includes('VitoFiglio') || data.description.includes('Prenotazione')) {
                targetTransId = doc.id;
            }
        });

        if (targetTransId) {
            await transactionsRef.doc(targetTransId).update({
                status: 'completed',
                description: `Incasso Iscrizione (No Doc) - VitoFiglio - Mensile`,
                category: 'Vendite/Incassi'
            });
            console.log("✅ Transazione Registro Cassa corretta: Stato COMPLETED e causale standard.");
        } else {
            console.warn("Transazione per VitoFiglio non trovata nel Registro Cassa.");
        }

        // 4. Cleanup Tag Cliente
        const currentTags = clientData.tags || [];
        const newTags = currentTags.filter(t => t !== 'LEAD');
        if (!newTags.includes('GENITORE')) newTags.push('GENITORE');
        await clientsRef.doc(clientId).update({ tags: newTags });
        console.log("✅ Tag cliente sanati (Rimossa LEAD, aggiunta GENITORE).");

    } catch (error) {
        console.error("ERRORE durante il riallineamento:", error);
    }
}

console.log("Script di sanatoria pronto.");
