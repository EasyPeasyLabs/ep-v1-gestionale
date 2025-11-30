
import { messaging, db } from '../firebase/config';
import { getToken } from '@firebase/messaging';
import { doc, setDoc } from '@firebase/firestore';

// Chiave VAPID reale fornita dall'utente
const VAPID_KEY = "BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo";

// Funzione per registrare esplicitamente il SW (utile per PWA)
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      // FIX: Usiamo un percorso relativo assoluto.
      // Non usiamo window.location.origin perché in ambienti di preview può differire dall'origine reale di esecuzione,
      // causando errori di sicurezza (Origin Mismatch).
      // Rimuoviamo anche 'scope: "/"' per lasciare che il browser usi il default (la root), evitando risoluzioni errate.
      const swUrl = '/firebase-messaging-sw.js';
      
      const registration = await navigator.serviceWorker.register(swUrl);
      return registration;
    } catch (err: any) {
      console.error('[FCM Service] Errore CRITICO registrazione SW:', err);
      // Tentativo di fallback con percorso relativo corrente
      try {
          const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
          return registration;
      } catch (fallbackErr) {
          console.error('[FCM Service] Fallback fallito:', fallbackErr);
          return null;
      }
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
      return { success: false, error: "Impossibile registrare il Service Worker. Verifica di essere su HTTPS o localhost." };
  }

  // 3. Richiesta Permesso Utente
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
      return { success: false, error: "Permesso negato dall'utente nelle impostazioni del browser." };
  }

  // 4. Recupero Token Firebase
  try {
      if (!VAPID_KEY) return { success: false, error: "VAPID KEY mancante nel codice." };

      const activeRegistration = registration || await navigator.serviceWorker.ready;
      
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
