
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { CompanyInfo, SubscriptionType, SubscriptionTypeInput, CommunicationTemplate, PeriodicCheck, PeriodicCheckInput, ContractTemplate, NotificationRule, NotificationType } from '../types';

const settingsDocRef = doc(db, 'settings', 'companyInfo');
const subscriptionCollectionRef = collection(db, 'subscriptionTypes');
const templateCollectionRef = collection(db, 'communicationTemplates');
const contractTemplateCollectionRef = collection(db, 'contract_templates');
const checksCollectionRef = collection(db, 'periodicChecks');
const recoveryPolicyRef = doc(db, 'settings', 'recoveryPolicies');
const notificationRulesCollectionRef = collection(db, 'notification_rules');

const DEFAULT_LOGO_BASE64 = ''; // Base64 placeholder or logic

// --- COMPANY INFO ---
const defaultCompanyInfo: CompanyInfo = {
    id: 'companyInfo',
    denomination: 'Easy Peasy Lab',
    name: 'Easy Peasy s.r.l.',
    vatNumber: '12345678901',
    address: 'Via Roma 1',
    city: 'Milano',
    province: 'MI',
    zipCode: '20100',
    email: 'labeasypeasy@gmail.com',
    phone: '+39 3405234353',
    logoBase64: DEFAULT_LOGO_BASE64,
    carFuelConsumption: 16.5,
    averageFuelPrice: 1.80, 
    iban: '',
    paypal: '',
    satispay: '',
    googlePay: '',
    klarna: '',
    currentBankBalance: 0
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
                carFuelConsumption: data.carFuelConsumption || 16.5,
                averageFuelPrice: data.averageFuelPrice || 1.80,
                iban: data.iban || '',
                paypal: data.paypal || '',
                satispay: data.satispay || '',
                googlePay: data.googlePay || '',
                klarna: data.klarna || '',
                city: data.city || '',
                province: data.province || '',
                zipCode: data.zipCode || '',
                currentBankBalance: data.currentBankBalance || 0
            };
        } else {
            // Se non esiste, crealo con default
            await setDoc(settingsDocRef, defaultCompanyInfo);
            return defaultCompanyInfo;
        }
    } catch (error: any) {
        // Gestione graceful per modalità offline
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
             console.warn("Firestore offline: Loaded default company info.");
             return defaultCompanyInfo;
        }
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
    // Strip ID from payload to avoid Firestore errors or redundancy
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, ...data } = sub as any;
    await updateDoc(docRef, data);
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

// --- CONTRACT TEMPLATES ---
const docToContractTemplate = (doc: QueryDocumentSnapshot<DocumentData>): ContractTemplate => {
    return { ...doc.data(), id: doc.id } as ContractTemplate;
};

export const getContractTemplates = async (): Promise<ContractTemplate[]> => {
    const snapshot = await getDocs(contractTemplateCollectionRef);
    let templates = snapshot.docs.map(docToContractTemplate);

    // Initial Seeding
    if (templates.length === 0) {
        const defaultNolo: Omit<ContractTemplate, 'id'> = {
            title: "Contratto di Nolo Sede",
            category: "Fornitori",
            content: `
<div style="text-align: center;"><strong>SCRITTURA PRIVATA DI CONCESSIONE IN USO DI SPAZI E ATTREZZATURE</strong></div>
<br>
<div><strong>TRA</strong></div>
<br>
<div>[Nome Fornitore], con sede in [Indirizzo Fornitore], C.F./P.IVA [C.F./P.IVA Fornitore], d'ora in avanti denominato "<strong>Concedente</strong>";</div>
<br>
<div><strong>E</strong></div>
<br>
<div>[Ragione Sociale Admin], con sede in [Indirizzo Admin], C.F./P.IVA [C.F./P.IVA Admin], d'ora in avanti denominato "<strong>Utilizzatore</strong>".</div>
<br>
<div><strong>1. OGGETTO DEL CONTRATTO</strong></div>
<div>Il Concedente concede in uso:</div>
<div>[ ] gratuito      [ ] oneroso</div>
<div>all’Utilizzatore i locali ubicati presso [Nome Sede] siti in [Indirizzo Sede], unitamente alle attrezzature, impianti e spazi pertinenziali ivi presenti.</div>
<br>
<div><strong>2. DURATA E RECESSO</strong></div>
<div>Il contratto ha decorrenza dal [Data inizio] e si rinnova tacitamente salvo cessazione concordata anche verbalmente tra le parti senza necessità di disdetta formale.</div>
<br>
<div><strong>3. CORRISPETTIVO E MODALITÀ DI PAGAMENTO</strong></div>
<div>Qualora l'uso concordato sia oneroso, l'Utilizzatore si impegna a corrispondere al Concedente la somma di € [Importo Nolo] (IVA inclusa).</div>
<div>Il pagamento sarà corrisposto (selezionare l'opzione concordata):</div>
<div>[ ] in un'unica soluzione mensilmente entro il primo giorno successivo alla fine dell'ultimo utilizzo del mese di competenza</div>
<div>ovvero</div>
<div>[ ] periodicamente per la sola quota corrispondente a ciascun utilizzo, entro il primo giorno lavorativo successivo all'utilizzo.</div>
<br>
<div><strong>4. OBBLIGHI DELL’UTILIZZATORE E SICUREZZA</strong></div>
<div>L’Utilizzatore dichiara di aver visionato i locali e le attrezzature e di averli trovati in buono stato e idonei all'uso pattuito.</div>
<div>La manutenzione ordinaria è a carico dell'Utilizzatore.</div>
<div>La manutenzione straordinaria è a carico del Concedente.</div>
<br>
<div><strong>5. RESPONSABILITÀ E ASSICURAZIONE</strong></div>
<div>L'Utilizzatore è responsabile di ogni danno causato ai locali, agli impianti e attrezzature durante il periodo di utilizzo, ad eccezione di danni dipendenti o derivanti da eventi straordinari o da inerzia e/o inadempienza del Concedente.</div>
<div>In ogni caso si attesta che il Concedente è dotato di apposita polizza assicurativa RC.</div>
<br>
<div><strong>6. DIVIETO DI CESSIONE E SUBLOCAZIONE</strong></div>
<div>È fatto espresso divieto all'Utilizzatore di cedere il presente contratto o di sublocare, anche parzialmente, gli spazi e le attrezzature oggetto della scrittura senza consenso scritto del Concedente.</div>
<br>
<div><strong>7. FORO COMPETENTE</strong></div>
<div>Per qualsiasi controversia sarà esclusivamente competente il Foro di Bari.</div>
<br>
<div>[Luogo],  lì [Data]</div>
<br>
<div>Il Concedente:</div>
<br>
<br>
<div>L'Utilizzatore:</div>
            `
        };
        const docRef = await addDoc(contractTemplateCollectionRef, defaultNolo);
        templates = [{ ...defaultNolo, id: docRef.id }];
    }
    
    return templates;
};

export const saveContractTemplate = async (template: ContractTemplate): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...dataToSave } = template;

    if (id) {
        const docRef = doc(db, 'contract_templates', id);
        await setDoc(docRef, dataToSave, { merge: true });
    } else {
        await addDoc(contractTemplateCollectionRef, dataToSave);
    }
};

export const deleteContractTemplate = async (id: string): Promise<void> => {
    const docRef = doc(db, 'contract_templates', id);
    await deleteDoc(docRef);
};

// --- PERIODIC CHECKS (LEGACY - WILL BE REPLACED BY NOTIFICATION RULES) ---
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

// --- NEW: NOTIFICATION RULES (ROUTINE MANAGER) ---

const DEFAULT_RULES: NotificationRule[] = [
    { id: 'payment_required', label: 'Sollecito Pagamenti', description: 'Iscrizioni in attesa di pagamento', enabled: true, days: [1, 4], time: '09:00', pushEnabled: true },
    { id: 'expiry', label: 'Scadenze Iscrizioni', description: 'Iscrizioni in scadenza a breve', enabled: true, days: [5], time: '10:00', pushEnabled: true },
    { id: 'balance_due', label: 'Saldi Sospesi', description: 'Acconti versati da oltre 30gg', enabled: true, days: [3], time: '11:00', pushEnabled: false },
    { id: 'low_lessons', label: 'Pacchetti in Esaurimento', description: 'Meno di 2 lezioni rimaste', enabled: true, days: [1, 3, 5], time: '17:00', pushEnabled: false },
    { id: 'institutional_billing', label: 'Billing Enti', description: 'Scadenze rate per progetti istituzionali', enabled: true, days: [1], time: '09:00', pushEnabled: true }
];

export const getNotificationRules = async (): Promise<NotificationRule[]> => {
    const snapshot = await getDocs(notificationRulesCollectionRef);
    const storedRules = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NotificationRule));
    
    // Merge con default se mancano
    if (storedRules.length < DEFAULT_RULES.length) {
        const missing = DEFAULT_RULES.filter(def => !storedRules.some( stored => stored.id === def.id));
        // Save missing defaults
        for (const rule of missing) {
            await setDoc(doc(db, 'notification_rules', rule.id), rule);
            storedRules.push(rule);
        }
    }
    
    return storedRules;
};

export const saveNotificationRule = async (rule: NotificationRule): Promise<void> => {
    const docRef = doc(db, 'notification_rules', rule.id);
    await setDoc(docRef, rule, { merge: true });
};

export const deleteNotificationRule = async (id: string): Promise<void> => {
    const docRef = doc(db, 'notification_rules', id);
    await deleteDoc(docRef);
};
