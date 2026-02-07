
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, doc, deleteDoc, DocumentData, QueryDocumentSnapshot, query, orderBy, updateDoc } from '@firebase/firestore';
import { CommunicationLog, CommunicationLogInput, Campaign, CampaignInput } from '../types';

// --- LOGS ---
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

export const updateCommunicationLog = async (id: string, log: Partial<CommunicationLogInput>): Promise<void> => {
    const docRef = doc(db, 'communications', id);
    await updateDoc(docRef, log);
};

export const deleteCommunicationLog = async (id: string): Promise<void> => {
    const docRef = doc(db, 'communications', id);
    await deleteDoc(docRef);
};

// --- CAMPAIGNS ---
const campaignsCollectionRef = collection(db, 'campaigns');

const docToCampaign = (doc: QueryDocumentSnapshot<DocumentData>): Campaign => {
    const data = doc.data();
    return { id: doc.id, ...data } as Campaign;
};

export const getCampaigns = async (): Promise<Campaign[]> => {
    const q = query(campaignsCollectionRef, orderBy('nextRun', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToCampaign);
};

export const addCampaign = async (campaign: CampaignInput): Promise<string> => {
    const docRef = await addDoc(campaignsCollectionRef, campaign);
    return docRef.id;
};

export const updateCampaign = async (id: string, campaign: Partial<CampaignInput>): Promise<void> => {
    const docRef = doc(db, 'campaigns', id);
    await updateDoc(docRef, campaign);
};

export const deleteCampaign = async (id: string): Promise<void> => {
    const docRef = doc(db, 'campaigns', id);
    await deleteDoc(docRef);
};