
import { db } from './firebase/config';
import { collection, getDocs } from 'firebase/firestore';

async function diagnose() {
    console.log("--- GO ---");
    const locsSnap = await getDocs(collection(db, 'locations'));
    console.log("Locations count:", locsSnap.size);
    locsSnap.forEach(doc => console.log("Loc:", doc.id, doc.data().name));

    const coursesSnap = await getDocs(collection(db, 'courses'));
    console.log("Courses count:", coursesSnap.size);
    coursesSnap.forEach(doc => console.log("Course:", doc.id, doc.data().locationId, doc.data().startTime));
    console.log("--- END ---");
}
diagnose();
