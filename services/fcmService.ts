
import { messaging, db } from '../firebase/config';
import { getToken } from '@firebase/messaging';
import { doc, setDoc } from '@firebase/firestore';

// Chiave VAPID reale fornita dall'utente
const VAPID_KEY = "BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo";

// Funzione per registrare esplicitamente il SW (utile per PWA)
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[FCM Service] Service Worker registrato con scope:', registration.scope);
      return registration;
    } catch (err) {
      console.error('[FCM Service] Registrazione Service Worker fallita:', err);
      return null;
    }
  }
  return null;
};

export const requestNotificationPermission = async (userId: string): Promise<boolean> => {
  console.log("[FCM Service] 1. Inizio procedura richiesta permessi...");
  
  // Assicura che il SW sia registrato prima di chiedere il token
  await registerServiceWorker();

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
          // Ottieni il token passando esplicitamente la VAPID key
          const currentToken = await getToken(messaging, { 
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') 
          });

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
