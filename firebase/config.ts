
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Helper for boot monitor
const logToScreen = (window as any).logToScreen || console.log;

logToScreen("Configuring Firebase...", "info");

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ep-gestionale-v1.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

let app, db, auth, storage, messaging;

try {
    if (!firebaseConfig.apiKey) {
        throw new Error("ERRORE CRITICO: Configurazione Firebase mancante.");
    }

    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    logToScreen("Firebase App Initialized.", "success");

    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true
    });
    logToScreen("Firestore Initialized.", "success");

    auth = getAuth(app);
    storage = getStorage(app);
    messaging = getMessaging(app);
} catch (e: any) {
    logToScreen("FIREBASE INIT ERROR: " + e.message, "error");
    console.error(e);
}

export { app, db, auth, storage, messaging };
