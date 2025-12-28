
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, CommunicationTemplate, PeriodicCheck, PeriodicCheckInput } from '../types';

const settingsDocRef = doc(db, 'settings', 'companyInfo');
const subscriptionCollectionRef = collection(db, 'subscriptionTypes');
const templateCollectionRef = collection(db, 'communicationTemplates');
const checksCollectionRef = collection(db, 'periodicChecks');
const recoveryPolicyRef = doc(db, 'settings', 'recoveryPolicies');

const DEFAULT_LOGO_BASE64 = ''; // Base64 placeholder or logic

// --- COMPANY INFO ---
const defaultCompanyInfo: CompanyInfo = {
    id: 'companyInfo',
    denomination: 'Easy Peasy Lab',
    name: 'Easy Peasy s.r.l.',
    vatNumber: '12345678901',
    address: 'Via Roma 1, Milano',
    email: 'labeasypeasy@gmail.com',
    phone: '+39 3405234353',
    logoBase64: DEFAULT_LOGO_BASE64,
    carFuelConsumption: 16.5
};

export const getCompanyInfo = async (): Promise<CompanyInfo> => {
    try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as CompanyInfo;
            return { 
                ...data, 
                id: docSnap.id,
                logoBase64: data.logoBase64 || DEFAULT_LOGO_BASE64,
                carFuelConsumption: data.carFuelConsumption || 16.5
            };
        } else {
            // Se non esiste, crealo con default
            await setDoc(settingsDocRef, defaultCompanyInfo);
            return defaultCompanyInfo;
        }
    } catch (error) {
        console.error("Error fetching company info:", error);
        return defaultCompanyInfo;
    }
};

export const updateCompanyInfo = async (info: CompanyInfo): Promise<void> => {
    await setDoc(settingsDocRef, info, { merge: true });
};

// --- SUBSCRIPTION TYPES ---
const docToSub = (doc: QueryDocumentSnapshot<DocumentData>): SubscriptionType => {
    return { id: doc.id, ...doc.data() } as SubscriptionType;
};

export const getSubscriptionTypes = async (): Promise<SubscriptionType[]> => {
    const snapshot = await getDocs(subscriptionCollectionRef);
    return snapshot.docs.map(docToSub);
};

export const addSubscriptionType = async (sub: SubscriptionTypeInput): Promise<string> => {
    const docRef = await addDoc(subscriptionCollectionRef, sub);
    return docRef.id;
};

export const updateSubscriptionType = async (id: string, sub: Partial<SubscriptionTypeInput>): Promise<void> => {
    const docRef = doc(db, 'subscriptionTypes', id);
    await updateDoc(docRef, sub);
};

export const deleteSubscriptionType = async (id: string): Promise<void> => {
    const docRef = doc(db, 'subscriptionTypes', id);
    await deleteDoc(docRef);
};

// --- COMMUNICATION TEMPLATES ---
const docToTemplate = (doc: QueryDocumentSnapshot<DocumentData>): CommunicationTemplate => {
    // FIX: Spread doc.data() first, then overwrite id with doc.id to ensure correct ID is used
    return { ...doc.data(), id: doc.id } as CommunicationTemplate;
};

export const getCommunicationTemplates = async (): Promise<CommunicationTemplate[]> => {
    const snapshot = await getDocs(templateCollectionRef);
    let templates = snapshot.docs.map(docToTemplate);
    
    // Default Templates Init
    if (templates.length === 0) {
        const defaults: CommunicationTemplate[] = [
            { id: 'payment', label: 'Sollecito Pagamento', subject: 'Sollecito Pagamento', body: 'Gentile {{cliente}}, le ricordiamo il pagamento di...', signature: 'Cordiali saluti' },
            { id: 'info', label: 'Info Generiche', subject: 'Informazioni', body: 'Gentile {{cliente}}, ...', signature: 'Cordiali saluti' }
        ];
        return defaults; 
    }
    return templates;
};

export const saveCommunicationTemplate = async (template: CommunicationTemplate): Promise<void> => {
    // FIX: Remove 'id' from the payload to prevent saving empty/duplicate IDs in the document data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...dataToSave } = template;

    if (id) {
        const docRef = doc(db, 'communicationTemplates', id);
        await setDoc(docRef, dataToSave, { merge: true });
    } else {
        await addDoc(templateCollectionRef, dataToSave);
    }
};

export const deleteCommunicationTemplate = async (id: string): Promise<void> => {
    const docRef = doc(db, 'communicationTemplates', id);
    await deleteDoc(docRef);
};

// --- PERIODIC CHECKS ---
const docToCheck = (doc: QueryDocumentSnapshot<DocumentData>): PeriodicCheck => {
    return { id: doc.id, ...doc.data() } as PeriodicCheck;
};

export const getPeriodicChecks = async (): Promise<PeriodicCheck[]> => {
    const snapshot = await getDocs(checksCollectionRef);
    return snapshot.docs.map(docToCheck);
};

export const addPeriodicCheck = async (check: PeriodicCheckInput): Promise<string> => {
    const docRef = await addDoc(checksCollectionRef, check);
    return docRef.id;
};

export const updatePeriodicCheck = async (id: string, check: Partial<PeriodicCheckInput>): Promise<void> => {
    const docRef = doc(db, 'periodicChecks', id);
    await updateDoc(docRef, check);
};

export const deletePeriodicCheck = async (id: string): Promise<void> => {
    const docRef = doc(db, 'periodicChecks', id);
    await deleteDoc(docRef);
};

// --- RECOVERY POLICIES ---
export const getRecoveryPolicies = async (): Promise<Record<string, 'allowed' | 'forbidden'>> => {
    const docSnap = await getDoc(recoveryPolicyRef);
    if (docSnap.exists()) {
        return docSnap.data() as Record<string, 'allowed' | 'forbidden'>;
    }
    return {};
};

export const saveRecoveryPolicies = async (policies: Record<string, 'allowed' | 'forbidden'>): Promise<void> => {
    await setDoc(recoveryPolicyRef, policies, { merge: true });
};
