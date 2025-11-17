import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput } from '../types';

// --- Company Info ---
const settingsDocRef = doc(db, 'settings', 'companyInfo');
const defaultCompanyInfo: Omit<CompanyInfo, 'id'> = {
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