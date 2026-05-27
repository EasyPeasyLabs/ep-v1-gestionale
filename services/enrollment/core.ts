
import { db } from '../../firebase/config';
import { 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    where, 
    DocumentData, 
    QueryDocumentSnapshot 
} from 'firebase/firestore';
import { Enrollment, EnrollmentInput, SchoolClosure, EnrollmentStatus } from '../../types';

export const getEnrollmentCollectionRef = () => collection(db, 'enrollments');
export const getClosuresCollectionRef = () => collection(db, 'school_closures');

export const docToEnrollment = (doc: QueryDocumentSnapshot<DocumentData>): Enrollment => {
    return { id: doc.id, ...doc.data() } as Enrollment;
};

export const getSchoolClosures = async (): Promise<SchoolClosure[]> => {
    const snapshot = await getDocs(getClosuresCollectionRef());
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SchoolClosure));
};

export const getEnrollmentsForClient = async (clientId: string): Promise<Enrollment[]> => {
    const q = query(getEnrollmentCollectionRef(), where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToEnrollment);
};

export const getAllEnrollments = async (): Promise<Enrollment[]> => {
    const snapshot = await getDocs(getEnrollmentCollectionRef());
    return snapshot.docs.map(docToEnrollment);
};

export const addEnrollment = async (enrollment: EnrollmentInput): Promise<string> => {
    const docRef = await addDoc(getEnrollmentCollectionRef(), enrollment);
    return docRef.id;
};

export const getActiveLocationForClient = async (clientId: string): Promise<{id: string, name: string} | null> => {
    try {
        const enrollments = await getEnrollmentsForClient(clientId);
        const activeEnr = enrollments.find(e => 
            e.status === EnrollmentStatus.Active && 
            e.locationId && 
            e.locationId !== 'unassigned'
        );
        
        if (activeEnr) {
            return { id: activeEnr.locationId, name: activeEnr.locationName };
        }
        return null;
    } catch (e) {
        console.warn("Smart Link Error:", e);
        return null;
    }
};
