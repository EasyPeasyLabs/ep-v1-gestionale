
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, doc, deleteDoc, DocumentData, QueryDocumentSnapshot, query, orderBy } from '@firebase/firestore';
import { CommunicationLog, CommunicationLogInput } from '../types';

const communicationCollectionRef = collection(db, 'communications');

const docToCommunication = (doc: QueryDocumentSnapshot<DocumentData>): CommunicationLog => {
    const data = doc.data();
    return { id: doc.id, ...data } as CommunicationLog;
};

export const getCommunicationLogs = async (): Promise<CommunicationLog[]> => {
    const q = query(communicationCollectionRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToCommunication);
};

export const logCommunication = async (comm: CommunicationLogInput): Promise<string> => {
    const docRef = await addDoc(communicationCollectionRef, comm);
    return docRef.id;
};

export const deleteCommunicationLog = async (id: string): Promise<void> => {
    const docRef = doc(db, 'communications', id);
    await deleteDoc(docRef);
};
