
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

async function inspectAges() {
    console.log("--- AGE INSPECTION ---");
    const coursesSnap = await db.collection('courses').limit(20).get();
    coursesSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Course ${doc.id}: minAge=${data.minAge}, maxAge=${data.maxAge}, type=${data.slotType}`);
    });
    
    const subsSnap = await db.collection('subscriptionTypes').get();
    subsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Sub ${doc.id}: allowedAges=${JSON.stringify(data.allowedAges)}, isPubliclyVisible=${data.isPubliclyVisible}`);
    });

    const locsSnap = await db.collection('locations').get();
    locsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Loc ${doc.id}: isPubliclyVisible=${data.isPubliclyVisible}, status=${data.status}`);
    });
}

inspectAges().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
