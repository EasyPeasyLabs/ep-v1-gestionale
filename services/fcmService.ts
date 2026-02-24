
import { messaging, db } from '../firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';

// Chiave VAPID reale fornita dall'utente
const VAPID_KEY = "BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo";

// Funzione per registrare esplicitamente il SW (utile per PWA)
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      // FIX: Check robusto sullo stato del documento
      // Evita "Failed to register a ServiceWorker: The document is in an invalid state"
      if (document.readyState === 'loading') {
          // Se sta ancora caricando, aspettiamo
          await new Promise<void>((resolve) => {
              window.addEventListener('load', () => resolve(), { once: true });
          });
      }

      // Costruiamo l'URL completo
      const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin).href;
      
      const registration = await navigator.serviceWorker.register(swUrl);
      return registration;
    } catch (err: any) {
      // Gestione silenziosa se l'errore è "invalid state" (può capitare in fase di unmount/reload rapido)
      if (err.name === 'InvalidStateError' || err.message?.includes('invalid state')) {
          console.warn('[FCM Service] Registrazione SW saltata: stato documento non valido.');
          return null;
      }
      console.error('[FCM Service] Errore CRITICO registrazione SW:', err);
      return null;
    }
  }
  return null;
};

// Modificata per ritornare un oggetto dettagliato invece di boolean
export const requestNotificationPermission = async (userId: string): Promise<{ success: boolean; token?: string; error?: string; step?: string }> => {
  
  // 1. Check Browser Support
  if (!('Notification' in window)) {
      return { success: false, error: "Questo browser non supporta le notifiche." };
  }

  // 2. Registrazione SW
  const registration = await registerServiceWorker();
  if (!registration) {
      // Se fallisce per invalid state, non è un errore bloccante per l'uso dell'app, ma le notifiche non andranno.
      return { success: false, error: "Service Worker non registrato (contesto non sicuro o stato non valido)." };
  }

  // 3. Richiesta Permesso Utente
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
      return { success: false, error: "Permesso negato dall'utente nelle impostazioni del browser." };
  }

  // 4. Recupero Token Firebase
  try {
      if (!VAPID_KEY) return { success: false, error: "VAPID KEY mancante nel codice." };

      // Attendiamo che il SW sia pronto, se la registrazione è avvenuta
      let activeRegistration = registration;
      if (!activeRegistration.active) {
          try {
            activeRegistration = await navigator.serviceWorker.ready;
          } catch (e) {
             console.warn("[FCM] SW ready timeout, using initial registration.");
          }
      }
      
      const currentToken = await getToken(messaging, { 
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: activeRegistration
      });

      if (currentToken) {
        await saveTokenToDatabase(currentToken, userId);
        return { success: true, token: currentToken };
      } else {
        return { success: false, error: "Firebase non ha restituito nessun token (Token Null)." };
      }
  } catch (error: any) {
      console.error('[FCM Service] Error:', error);
      let errMsg = error.message || "Errore sconosciuto";
      
      if (errMsg.includes("Subscription failed")) errMsg = "Sottoscrizione fallita (VAPID Key errata o Push Service bloccato).";
      if (errMsg.includes("communication with the push service")) errMsg = "Impossibile contattare i server di notifica (Blocco di rete/AdBlock?).";
      
      return { success: false, error: errMsg };
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

export const setupForegroundMessaging = () => {
    if (!messaging) return;
    
    try {
        onMessage(messaging, (payload) => {
            console.log('[FCM] Message received in foreground:', payload);
            
            if ('Notification' in window && Notification.permission === 'granted') {
                const title = payload.notification?.title || 'Nuova Notifica';
                const options = {
                    body: payload.notification?.body,
                    icon: '/lemon_logo_150px.png',
                    data: payload.data,
                };
                
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification(title, options);
                    }).catch(err => {
                        new Notification(title, options);
                    });
                } else {
                    new Notification(title, options);
                }
            }
        });
    } catch (e) {
        console.error('[FCM] Error setting up foreground messaging:', e);
    }
};
