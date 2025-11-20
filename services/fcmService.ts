
import { messaging, db } from '../firebase/config';
import { getToken } from '@firebase/messaging';
import { doc, setDoc } from '@firebase/firestore';

// Sostituisci con la tua VAPID Key generata dalla console Firebase
const VAPID_KEY = "BPTZtK9J9i7g7z5y_YOUR_GENERATED_KEY_HERE_rX1x2x3x4x5"; 

export const requestNotificationPermission = async (userId: string): Promise<boolean> => {
  console.log("[FCM Service] 1. Inizio procedura richiesta permessi...");
  
  try {
    if (!('Notification' in window)) {
      console.warn("[FCM Service] Questo browser non supporta le notifiche desktop.");
      return false;
    }

    // 1. Richiesta permesso al browser (Popup nativo)
    console.log("[FCM Service] 2. Richiedo permesso Notification.requestPermission()...");
    const permission = await Notification.requestPermission();
    console.log(`[FCM Service] 3. Risposta utente: ${permission}`);

    if (permission === 'granted') {
      console.log("[FCM Service] 4. Permesso accordato. Tento di ottenere il token da Firebase...");
      
      // 2. Ottieni il token univoco del dispositivo
      // NOTA: Questo step richiede che firebase-messaging-sw.js sia nella root e corretto
      const currentToken = await getToken(messaging, { 
        vapidKey: VAPID_KEY 
      });

      if (currentToken) {
        console.log('[FCM Service] 5. FCM Token ottenuto con successo:', currentToken);
        
        // 3. Salva il token nel database
        console.log("[FCM Service] 6. Salvataggio token nel database Firestore...");
        await saveTokenToDatabase(currentToken, userId);
        console.log("[FCM Service] 7. Token salvato correttamente.");
        return true;
      } else {
        console.warn('[FCM Service] 5b. Nessun token di registrazione disponibile.');
        return false;
      }
    } else {
      console.warn('[FCM Service] 3b. Permesso notifiche negato dall\'utente.');
      return false;
    }
  } catch (error) {
    console.error('[FCM Service] ERRORE CRITICO durante il processo:', error);
    // Non rilanciamo l'errore per non bloccare l'applicazione, ma ritorniamo false
    return false;
  }
};

const saveTokenToDatabase = async (token: string, userId: string) => {
    try {
        // Usiamo il token come ID del documento per evitare duplicati dello stesso device
        const tokenRef = doc(db, 'fcm_tokens', token);
        await setDoc(tokenRef, {
            token: token,
            userId: userId,
            updatedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform
        }, { merge: true });
    } catch (e) {
        console.error("[FCM Service] Errore nel salvataggio su Firestore:", e);
        throw e; // Rilanciamo questo errore specifico
    }
};
