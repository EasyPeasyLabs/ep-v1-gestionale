
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
    } catch (error: any) {
        // Gestione graceful per modalità offline
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
             console.warn("Firestore offline: Loaded default user preferences.");
             return {};
        }
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

export const syncDismissedNotifications = async (userId: string, notificationIds: string[]): Promise<void> => {
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        // Use arrayUnion to add new IDs without overwriting existing ones
        // Note: Firestore arrayUnion accepts variable arguments, so we spread the array
        if (notificationIds.length > 0) {
            await setDoc(docRef, { 
                dismissedNotificationIds: arrayUnion(...notificationIds) 
            }, { merge: true });
        }
    } catch (error) {
        console.error("Error syncing dismissed notifications:", error);
        throw error;
    }
};
