
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from '@firebase/firestore';
import { UserPreferences, FocusConfig } from '../types';

const COLLECTION_NAME = 'user_preferences';

export const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as UserPreferences;
        }
        return {};
    } catch (error) {
        console.error("Error fetching user preferences:", error);
        return {};
    }
};

export const saveUserFocusConfig = async (userId: string, config: FocusConfig): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        await setDoc(docRef, { focusConfig: config }, { merge: true });
    } catch (error) {
        console.error("Error saving focus config:", error);
        throw error;
    }
};

export const markFocusAsSeen = async (userId: string): Promise<void> => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const docRef = doc(db, COLLECTION_NAME, userId);
        await setDoc(docRef, { lastFocusDate: todayStr }, { merge: true });
    } catch (error) {
        console.error("Error marking focus as seen:", error);
    }
};
