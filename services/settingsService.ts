
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from '@firebase/firestore';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, PeriodicCheck, PeriodicCheckInput } from '../types';

// --- Company Info ---
const settingsDocRef = doc(db, 'settings', 'companyInfo');
const defaultCompanyInfo: Omit<CompanyInfo, 'id'> = {
    denomination: 'EASY PEASY',
    name: 'ILARIA TAVANI',
    vatNumber: 'IT 09038130721',
    address: 'VIA CHIANCARO 2 N, 70010 ADELFIA (BARI)',
    email: 'labeasypeasy@gmail.com',
    phone: '(+39) 340 523 4353'
};

export const getCompanyInfo = async (): Promise<CompanyInfo> => {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CompanyInfo;
    } else {
        await setDoc(settingsDocRef, defaultCompanyInfo);
        return { id: 'companyInfo', ...defaultCompanyInfo };
    }
};

export const updateCompanyInfo = async (info: CompanyInfo): Promise<void> => {
    // Rimuoviamo l'id dall'oggetto prima di salvarlo
    const { id, ...dataToSave } = info;
    await setDoc(settingsDocRef, dataToSave);
};


// --- Subscription Types ---
const subscriptionTypesCollectionRef = collection(db, 'subscriptionTypes');

const docToSub = (doc: any): SubscriptionType => ({ id: doc.id, ...doc.data() } as SubscriptionType);

export const getSubscriptionTypes = async (): Promise<SubscriptionType[]> => {
    const q = query(subscriptionTypesCollectionRef, orderBy('price'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToSub);
};

export const addSubscriptionType = async (sub: SubscriptionTypeInput): Promise<string> => {
    const docRef = await addDoc(subscriptionTypesCollectionRef, sub);
    return docRef.id;
};

export const updateSubscriptionType = async (id: string, sub: Partial<SubscriptionTypeInput>): Promise<void> => {
    const subDoc = doc(db, 'subscriptionTypes', id);
    await updateDoc(subDoc, sub);
};

export const deleteSubscriptionType = async (id: string): Promise<void> => {
    const subDoc = doc(db, 'subscriptionTypes', id);
    await deleteDoc(subDoc);
};

// --- Periodic Checks (Planner) ---
const periodicChecksCollectionRef = collection(db, 'periodicChecks');

const docToCheck = (doc: any): PeriodicCheck => ({ id: doc.id, ...doc.data() } as PeriodicCheck);

export const getPeriodicChecks = async (): Promise<PeriodicCheck[]> => {
    // Ordiniamo per categoria per averli raggruppati nella UI
    const q = query(periodicChecksCollectionRef, orderBy('category'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToCheck);
};

export const addPeriodicCheck = async (check: PeriodicCheckInput): Promise<string> => {
    const docRef = await addDoc(periodicChecksCollectionRef, check);
    return docRef.id;
};

export const updatePeriodicCheck = async (id: string, check: Partial<PeriodicCheckInput>): Promise<void> => {
    const checkDoc = doc(db, 'periodicChecks', id);
    await updateDoc(checkDoc, check);
};

export const deletePeriodicCheck = async (id: string): Promise<void> => {
    const checkDoc = doc(db, 'periodicChecks', id);
    await deleteDoc(checkDoc);
};
