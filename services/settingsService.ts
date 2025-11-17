
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CompanyInfo } from '../types';

const settingsDocRef = doc(db, 'settings', 'companyInfo');

// Dati di default se il documento non esiste
const defaultCompanyInfo: CompanyInfo = {
    id: 'companyInfo',
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
        // Se il documento non esiste, lo creo con i dati di default
        await setDoc(settingsDocRef, defaultCompanyInfo);
        return defaultCompanyInfo;
    }
};

export const updateCompanyInfo = async (info: CompanyInfo): Promise<void> => {
    await setDoc(settingsDocRef, info);
};