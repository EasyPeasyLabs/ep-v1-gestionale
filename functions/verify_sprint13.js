
const admin = (() => {
    try {
        return require('firebase-admin');
    } catch (e) {
        // Try local path if regular require fails
        return require('./node_modules/firebase-admin');
    }
})();

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'ep-gestionale-v1'
    });
}

const db = admin.firestore();

async function verifyMigration() {
    console.log("--- VERIFICA MIGRAZIONE ---");
    
    const suppliersSnap = await db.collection('suppliers').get();
    let oldLocationCount = 0;
    let oldSlotCount = 0;
    
    suppliersSnap.forEach(doc => {
        const data = doc.data();
        if (data.locations) {
            oldLocationCount += data.locations.length;
            data.locations.forEach(l => {
                if (l.availability) oldSlotCount += l.availability.length;
            });
        }
    });
    
    const newLocationsSnap = await db.collection('locations').get();
    const newCoursesSnap = await db.collection('courses').get();
    
    console.log(`Fornitori: ${suppliersSnap.size}`);
    console.log(`Sedi (teoriche da fornitori): ${oldLocationCount}`);
    console.log(`Fessure (teoriche da fornitori): ${oldSlotCount}`);
    console.log(`---`);
    console.log(`Nuove Sedi (locations): ${newLocationsSnap.size}`);
    console.log(`Nuovi Corsi (courses): ${newCoursesSnap.size}`);
    
    if (newLocationsSnap.size >= oldLocationCount && newCoursesSnap.size >= oldSlotCount) {
        console.log("✅ Migrazione Coerente (Conteggio >= Originale)");
    } else {
        console.log("⚠️ Discrepanza nei conteggi!");
    }
}

async function testAPI(age) {
    console.log(`\n--- TEST API V5 (Age: ${age}) ---`);
    // Simulo la logica interna di getPublicSlotsV5 per verifica
    const coursesSnap = await db.collection('courses')
        .where('status', '==', 'open')
        .where('minAge', '<=', age)
        .where('maxAge', '>=', age)
        .get();
        
    console.log(`Corsi trovati per età ${age}: ${coursesSnap.size}`);
    coursesSnap.forEach(doc => {
        const c = doc.data();
        console.log(` - Corso ID: ${doc.id}, Slot: ${c.slotType}, Range: ${c.minAge}-${c.maxAge}`);
    });
}

async function testTrigger() {
    console.log("\n--- TEST TRIGGER OCCUPANCY ---");
    // Prendo un corso a caso
    const courseSnap = await db.collection('courses').limit(1).get();
    if (courseSnap.empty) return;
    const course = courseSnap.docs[0];
    const initialCount = course.data().activeEnrollmentsCount || 0;
    
    console.log(`Corso Test: ${course.id}, Occupazione Iniziale: ${initialCount}`);
    
    // Creo iscrizione fittizia
    const enrRef = db.collection('enrollments').doc('test-trigger-enrollment');
    await enrRef.set({
        clientId: 'test-client',
        childName: 'Test Child',
        courseId: course.id,
        status: 'active',
        createdAt: new Date().toISOString()
    });
    
    console.log("Iscrizione test creata. Attendo 2 secondi per il trigger...");
    await new Promise(r => setTimeout(r, 2000));
    
    const updatedCourse = await course.ref.get();
    const newCount = updatedCourse.data().activeEnrollmentsCount || 0;
    console.log(`Nuova Occupazione: ${newCount}`);
    
    if (newCount === initialCount + 1) {
        console.log("✅ Trigger Funzionante (+1)");
    } else {
        console.log("❌ Trigger Fallito o in ritardo.");
    }
    
    // Pulizia
    await enrRef.delete();
    console.log("Iscrizione test eliminata. Attendo 2 secondi per il trigger inverse...");
    await new Promise(r => setTimeout(r, 2000));
    
    const finalCourse = await course.ref.get();
    console.log(`Occupazione Finale: ${finalCourse.data().activeEnrollmentsCount || 0}`);
}

async function runAll() {
    try {
        await verifyMigration();
        await testAPI(8);
        await testAPI(4);
        await testTrigger();
    } catch (e) {
        console.error(e);
    }
}

runAll();
