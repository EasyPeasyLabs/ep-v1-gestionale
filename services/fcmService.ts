
import { messaging, db } from '../firebase/config';
import { getToken } from '@firebase/messaging';
import { doc, setDoc } from '@firebase/firestore';

// Chiave VAPID reale fornita dall'utente
const VAPID_KEY = "BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo";

export const requestNotificationPermission = async (userId: string): Promise<boolean> => {
  console.log("[FCM Service] 1. Inizio procedura richiesta permessi...");
  
  if (!VAPID_KEY) {
      console.error("[FCM Service] ❌ ERRORE CONFIGURAZIONE: Manca la VAPID KEY.");
      return false;
  }

  try {
    if (!('Notification' in window)) {
      console.warn("[FCM Service] Questo browser non supporta le notifiche desktop.");
      return false;
    }

    // 1. Richiesta permesso al browser
    const permission = await Notification.requestPermission();
    console.log(`[FCM Service] 3. Risposta utente: ${permission}`);

    if (permission === 'granted') {
      console.log("[FCM Service] 4. Permesso accordato. Tento di ottenere il token...");
      
      try {
          const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

          if (currentToken) {
            console.log('[FCM Service] 5. FCM Token ottenuto:', currentToken);
            await saveTokenToDatabase(currentToken, userId);
            return true;
          } else {
            console.warn('[FCM Service] 5b. Nessun token disponibile.');
            return false;
          }
      } catch (tokenError: any) {
          console.error('[FCM Service] Errore recupero token:', tokenError);

          // LOGICA DI AUTO-RIPARAZIONE
          // Se l'errore riguarda la chiave o l'accesso, proviamo a pulire la vecchia sottoscrizione
          if (tokenError.message?.includes("applicationServerKey") || 
              tokenError.message?.includes("Subscription failed") ||
              tokenError.message?.includes("not valid")) {
              
              console.warn("[FCM Service] Rilevata sottoscrizione corrotta/vecchia. Tento pulizia...");
              try {
                  const reg = await navigator.serviceWorker.getRegistration();
                  if (reg) {
                      const sub = await reg.pushManager.getSubscription();
                      if (sub) {
                          await sub.unsubscribe();
                          console.log("[FCM Service] Vecchia sottoscrizione rimossa con successo. Riprova a cliccare il pulsante.");
                          alert("Il sistema ha rimosso una configurazione obsoleta. Per favore, clicca di nuovo su 'Rinizializza Servizio' per completare la correzione.");
                          return false;
                      }
                  }
              } catch (cleanErr) {
                  console.error("[FCM Service] Impossibile pulire la sottoscrizione:", cleanErr);
              }
          }
          return false;
      }
    } else {
      console.warn('[FCM Service] Permesso notifiche negato.');
      return false;
    }
  } catch (error) {
    console.error('[FCM Service] ERRORE CRITICO:', error);
    return false;
  }
};

const saveTokenToDatabase = async (token: string, userId: string) => {
    try {
        const tokenRef = doc(db, 'fcm_tokens', token);
        await setDoc(tokenRef, {
            token: token,
            userId: userId,
            updatedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform
        }, { merge: true });
    } catch (e) {
        console.error("[FCM Service] Errore salvataggio DB:", e);
    }
};
