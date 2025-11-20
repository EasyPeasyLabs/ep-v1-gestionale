
import { messaging, db } from '../firebase/config';
import { getToken } from '@firebase/messaging';
import { doc, setDoc } from '@firebase/firestore';

// Sostituisci con la tua VAPID Key generata dalla console Firebase -> Project Settings -> Cloud Messaging -> Web Configuration
const VAPID_KEY = "BPTZtK9J9i7g7z5y_YOUR_GENERATED_KEY_HERE_rX1x2x3x4x5"; 

export const requestNotificationPermission = async (userId: string) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Ottieni il token univoco del dispositivo
      const currentToken = await getToken(messaging, { 
        vapidKey: VAPID_KEY 
      });

      if (currentToken) {
        console.log('FCM Token:', currentToken);
        // Salva il token nel database associandolo all'utente
        await saveTokenToDatabase(currentToken, userId);
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.log('An error occurred while retrieving token. ', error);
    // In molti casi l'errore è dovuto alla mancanza di un Service Worker registrato o HTTPS locale
  }
};

const saveTokenToDatabase = async (token: string, userId: string) => {
    // Usiamo il token come ID del documento per evitare duplicati dello stesso device
    const tokenRef = doc(db, 'fcm_tokens', token);
    await setDoc(tokenRef, {
        token: token,
        userId: userId,
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
    });
};
