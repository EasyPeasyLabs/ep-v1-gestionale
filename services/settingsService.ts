
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from '@firebase/firestore';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, PeriodicCheck, PeriodicCheckInput, CommunicationTemplate, RecoveryPolicy } from '../types';

// --- Company Info ---
const settingsDocRef = doc(db, 'settings', 'companyInfo');

// LOGO DEFAULT (Lemon Icon SVG in Base64)
const DEFAULT_LOGO_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBkPSJNODUgNDUgQzg1IDY3IDY3IDg1IDQ1IDg1IEMyMyA4NSA1IDY3IDUgNDUgQzUgMjMgMjMgNSA0NSA1IEM1NSA1IDY1IDkgNzMgMTUgTDg1IDUgWiIgZmlsbD0iI0ZERDgzbSIvPjxwYXRoIGQ9Ik03MyAxNSBMODUgNSBMODUgMjAgWiIgZmlsbD0iIzQzQTA0NyIvPjx0ZXh0IHg9IjQ1IiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RVA8L3RleHQ+PC9zdmc+";

const defaultCompanyInfo: Omit<CompanyInfo, 'id'> = {
    denomination: 'EASY PEASY',
    name: 'ILARIA TAVANI',
    vatNumber: 'IT 09038130721',
    address: 'VIA CHIANCARO 2 N, 70010 ADELFIA (BARI)',
    email: 'labeasypeasy@gmail.com',
    phone: '+39 3405234353',
    logoBase64: DEFAULT_LOGO_BASE64,
    carFuelConsumption: 16.5 // km/l default
};

export const getCompanyInfo = async (): Promise<CompanyInfo> => {
    try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as Omit<CompanyInfo, 'id'>;
            return {
                ...data,
                id: docSnap.id,
                logoBase64: data.logoBase64 || DEFAULT_LOGO_BASE64,
                carFuelConsumption: data.carFuelConsumption || 16.5
            };
        } else {
            try {
                await setDoc(settingsDocRef, defaultCompanyInfo);
                return { id: 'companyInfo', ...defaultCompanyInfo };
            } catch (e) {
                console.warn("Impossibile creare company info default:", e);
                return { id: 'companyInfo', ...defaultCompanyInfo };
            }
        }
    } catch (e) {
        console.warn("Errore caricamento Company Info (possibile offline):", e);
        return { id: 'companyInfo', ...defaultCompanyInfo };
    }
};

export const updateCompanyInfo = async (info: CompanyInfo): Promise<void> => {
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

// --- Recovery Policies ---
const recoveryDocRef = doc(db, 'settings', 'recoverySettings');

export const getRecoveryPolicies = async (): Promise<Record<string, 'allowed' | 'forbidden'>> => {
    try {
        const docSnap = await getDoc(recoveryDocRef);
        if (docSnap.exists()) {
            return (docSnap.data() as RecoveryPolicy).policies || {};
        }
        return {};
    } catch(e) {
        console.warn("Error fetching recovery policies", e);
        return {};
    }
};

export const saveRecoveryPolicies = async (policies: Record<string, 'allowed' | 'forbidden'>): Promise<void> => {
    await setDoc(recoveryDocRef, { policies });
};


// --- Periodic Checks (Planner) ---
const periodicChecksCollectionRef = collection(db, 'periodicChecks');

const docToCheck = (doc: any): PeriodicCheck => ({ id: doc.id, ...doc.data() } as PeriodicCheck);

export const getPeriodicChecks = async (): Promise<PeriodicCheck[]> => {
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

// --- Communication Templates ---
const templatesRef = collection(db, 'communicationTemplates');

const defaultTemplates: CommunicationTemplate[] = [
    {
        id: 'expiry',
        label: 'Scadenza Iscrizione',
        subject: 'Rinnovo Iscrizione in scadenza - {{bambino}}',
        body: 'Gentile {{cliente}},\n\nTi ricordiamo che l\'iscrizione di {{bambino}} scadrà il {{data}}.\nPer confermare il posto per il prossimo periodo, ti preghiamo di effettuare il rinnovo.',
        signature: 'A presto,\nEasy Peasy'
    },
    {
        id: 'lessons',
        label: 'Esaurimento Lezioni',
        subject: 'Avviso esaurimento lezioni - {{bambino}}',
        body: 'Gentile {{cliente}},\n\nLe lezioni del pacchetto di {{bambino}} stanno per terminare.\nTi invitiamo a rinnovare l\'iscrizione per non perdere la continuità didattica.',
        signature: 'A presto,\nEasy Peasy'
    },
    {
        id: 'payment',
        label: 'Pagamento Fornitore',
        subject: 'Avviso Pagamento Nolo - {{descrizione}}',
        body: 'Spett.le {{fornitore}},\n\nVi informiamo che abbiamo preso in carico il pagamento per: {{descrizione}}.\nIl bonifico verrà effettuato nei prossimi giorni.',
        signature: 'Cordiali saluti,\nAmministrazione Easy Peasy'
    }
];

export const getCommunicationTemplates = async (): Promise<CommunicationTemplate[]> => {
    const snapshot = await getDocs(templatesRef);
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunicationTemplate));
    
    const merged = [...defaultTemplates];
    templates.forEach(t => {
        const idx = merged.findIndex(d => d.id === t.id);
        if (idx >= 0) merged[idx] = t;
        else merged.push(t);
    });
    return merged;
};

export const saveCommunicationTemplate = async (template: CommunicationTemplate): Promise<void> => {
    const docRef = doc(db, 'communicationTemplates', template.id);
    await setDoc(docRef, template);
};
