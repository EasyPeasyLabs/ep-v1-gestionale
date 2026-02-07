
import { db, auth } from '../firebase/config';
import { collection, doc, getDoc, setDoc, getDocs, query, orderBy } from '@firebase/firestore';
import { FiscalYear } from '../types';

const fiscalCollectionRef = collection(db, 'fiscal_years');

// Cache locale semplice per evitare letture ripetute durante operazioni massive
let closedYearsCache: Set<number> | null = null;

export const getFiscalYears = async (): Promise<FiscalYear[]> => {
    const q = query(fiscalCollectionRef, orderBy('year', 'desc'));
    const snapshot = await getDocs(q);
    const years = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiscalYear));
    
    // Aggiorna cache
    closedYearsCache = new Set(years.filter(y => y.status === 'CLOSED').map(y => y.year));
    
    return years;
};

export const getFiscalYear = async (year: number): Promise<FiscalYear | null> => {
    const docRef = doc(db, 'fiscal_years', year.toString());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as FiscalYear;
    }
    return null;
};

export const closeFiscalYear = async (year: number, snapshotData: FiscalYear['snapshot']): Promise<void> => {
    const docRef = doc(db, 'fiscal_years', year.toString());
    const userEmail = auth.currentUser?.email || 'System';

    const fiscalYearData: FiscalYear = {
        id: year.toString(),
        year: year,
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closedBy: userEmail,
        snapshot: snapshotData
    };

    await setDoc(docRef, fiscalYearData);
    
    // Invalida cache
    closedYearsCache = null;
};

export const reopenFiscalYear = async (year: number): Promise<void> => {
    // Funzione di emergenza (Admin Only)
    const docRef = doc(db, 'fiscal_years', year.toString());
    await setDoc(docRef, { status: 'OPEN' }, { merge: true });
    closedYearsCache = null;
};

// --- GUARDIA GLOBALE ---
export const isYearClosed = async (dateString: string): Promise<boolean> => {
    const year = new Date(dateString).getFullYear();
    
    // Usa cache se disponibile
    if (closedYearsCache !== null) {
        return closedYearsCache.has(year);
    }

    // Fallback DB
    const fy = await getFiscalYear(year);
    return fy?.status === 'CLOSED';
};

export const checkFiscalLock = async (dateString: string) => {
    if (await isYearClosed(dateString)) {
        const year = new Date(dateString).getFullYear();
        throw new Error(`OPERAZIONE BLOCCATA: L'anno fiscale ${year} è chiuso. Riaprilo dalle impostazioni per modificare.`);
    }
};