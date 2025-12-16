import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Configurazione Firebase
// Tenta di leggere da variabili d'ambiente (Vite).
// Se non presenti (es. ambiente di sviluppo locale senza .env o problemi di build),
// utilizza i valori di fallback per garantire l'avvio.

// Safe access: previene crash se import.meta.env non è definito
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ep-gestionale-v1.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

// Fallback check per evitare crash bianchi se le env non sono settate e i fallback falliscono
if (!firebaseConfig.apiKey) {
    console.error("ERRORE CRITICO: Configurazione Firebase mancante. Verifica le variabili d'ambiente (.env) o la configurazione di Vite.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Abilitiamo la persistenza offline con la nuova API.
// Reintroduciamo experimentalForceLongPolling: true perché l'ambiente attuale sembra bloccare i WebSockets,
// causando il timeout "Backend didn't respond within 10 seconds".
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);