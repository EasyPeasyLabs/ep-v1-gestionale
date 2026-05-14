const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        // Se si avvia in Cloud Shell o ambiente autenticato non servono credenziali. 
        // Altrimenti serve serviceAccountKey.json
        projectId: 'ep-gestionale-v1'
    });
}

const db = admin.firestore();

// Funzione di utilità per il batching
async function commitBatches(operations) {
    const BATCH_SIZE = 450;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = operations.slice(i, i + BATCH_SIZE);
        for (const op of chunk) {
            batch.update(op.ref, op.data);
        }
        await batch.commit();
        console.log(`Commit batch completato: da ${i} a ${i + chunk.length}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 3) {
        console.error("Uso: node migrate_location.cjs <sourceLocationId> <targetLocationId> <fromDate_YYYY-MM-DD>");
        console.error("Esempio: node scripts/migrate_location.cjs abc123def456 ghi789jkl012 2026-09-01");
        process.exit(1);
    }
    
    const [sourceLocationId, targetLocationId, fromDate] = args;
    console.log(`--- INIZIO MIGRAZIONE MASSIVA SEDE ---`);
    console.log(`Da Location ID: ${sourceLocationId}`);
    console.log(`A Location ID:  ${targetLocationId}`);
    console.log(`A partire dal:  ${fromDate}`);
    console.log(`--------------------------------------`);

    const sourceLocationDoc = await db.collection('locations').doc(sourceLocationId).get();
    const targetLocationDoc = await db.collection('locations').doc(targetLocationId).get();

    if (!sourceLocationDoc.exists) {
        console.error("Errore: La Sede di Origine (sourceLocationId) non esiste.");
        process.exit(1);
    }
    if (!targetLocationDoc.exists) {
        console.error("Errore: La Sede di Destinazione (targetLocationId) non esiste.");
        process.exit(1);
    }

    const targetLocation = targetLocationDoc.data();

    // Recupero Dati Fornitore della Nuova Sede
    const targetSupplierDoc = await db.collection('suppliers').doc(targetLocation.supplierId).get();
    const targetSupplierName = targetSupplierDoc.exists ? targetSupplierDoc.data().name : '';

    const operations = [];

    // 1. Migrazione Corsi Attivi (senza endDate o con endDate >= fromDate)
    console.log("Analisi Corsi...");
    const coursesSnap = await db.collection('courses').where('locationId', '==', sourceLocationId).get();
    let countCourses = 0;
    for (const doc of coursesSnap.docs) {
        const data = doc.data();
        if (!data.endDate || data.endDate >= fromDate) {
            operations.push({
                ref: doc.ref,
                data: { locationId: targetLocationId }
            });
            countCourses++;
        }
    }

    // 2. Migrazione Iscrizioni (endDate >= fromDate)
    console.log("Analisi Iscrizioni...");
    const enrollmentsSnap = await db.collection('enrollments').where('locationId', '==', sourceLocationId).get();
    let countEnrollments = 0;
    for (const doc of enrollmentsSnap.docs) {
        const data = doc.data();
        if (!data.endDate || data.endDate >= fromDate) {
            operations.push({
                ref: doc.ref,
                data: {
                    locationId: targetLocationId,
                    locationName: targetLocation.name,
                    locationColor: targetLocation.color || '#000000',
                    supplierId: targetLocation.supplierId,
                    supplierName: targetSupplierName
                }
            });
            countEnrollments++;
        }
    }

    // 3. Migrazione Lezioni Future (date >= fromDate)
    console.log("Analisi Lezioni...");
    const lessonsSnap = await db.collection('lessons').where('locationId', '==', sourceLocationId).where('date', '>=', fromDate).get();
    let countLessons = 0;
    for (const doc of lessonsSnap.docs) {
        operations.push({
            ref: doc.ref,
            data: {
                locationId: targetLocationId,
                locationName: targetLocation.name,
                locationColor: targetLocation.color || '#000000'
            }
        });
        countLessons++;
    }

    // 4. Migrazione Transazioni Allocate alla Sede (date >= fromDate)
    console.log("Analisi Transazioni...");
    const transactionsSnap = await db.collection('transactions')
        .where('allocationType', '==', 'location')
        .where('allocationId', '==', sourceLocationId)
        .where('date', '>=', fromDate)
        .get();
        
    let countTransactions = 0;
    for (const doc of transactionsSnap.docs) {
        operations.push({
            ref: doc.ref,
            data: {
                allocationId: targetLocationId,
                allocationName: targetLocation.name,
                supplierId: targetLocation.supplierId,
                // Aggiorniamo qui manualmente poichè name non è normalmente denorm. lì, ma aggiungiamo la ref in caso.
            }
        });
        countTransactions++;
    }

    console.log(`
Risultati dell'Analisi:
- Corsi da aggiornare:       ${countCourses}
- Iscrizioni da aggiornare:  ${countEnrollments}
- Lezioni da aggiornare:     ${countLessons}
- Transazioni da aggiornare: ${countTransactions}
Totale aggiornamenti:        ${operations.length}
    `);

    if (operations.length > 0) {
        console.log("Applicazione delle modifiche salvate nel database...");
        try {
            await commitBatches(operations);
            console.log("Modifiche completate con successo!");
        } catch (error) {
            console.error("Errore durante l'applicazione del commit massivo:", error);
        }
    } else {
        console.log("Nessun dato da aggiornare trovato.");
    }
}

main().catch(console.error);
