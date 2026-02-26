
import { initializeApp, FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";

// Helper for boot monitor
const logToScreen = (window as any).logToScreen || console.log;

logToScreen("Configuring Firebase...", "info");

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let messaging: Messaging;

try {
    if (!firebaseConfig.apiKey) {
        throw new Error("ERRORE CRITICO: Configurazione Firebase mancante.");
    }

    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    logToScreen("Firebase App Initialized.", "success");

    // Initialize Firestore with Robust Cache Handling
    try {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
            ignoreUndefinedProperties: true
        });
        logToScreen("Firestore Initialized.", "success");
    } catch (err: any) {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore persistence failed. Clearing cache and retrying...");
            // Non possiamo chiamare clearIndexedDbPersistence su un'istanza non inizializzata facilmente,
            // ma l'errore 'failed-precondition' spesso richiede un reload o un'inizializzazione senza persistenza.
            // Fallback: Memory Cache implicita se la persistenza fallisce.
            db = initializeFirestore(app, {
               ignoreUndefinedProperties: true
            });
        } else {
            throw err;
        }
    }

    auth = getAuth(app);
    storage = getStorage(app);
    messaging = getMessaging(app);
} catch (e: any) {
    logToScreen("FIREBASE INIT ERROR: " + e.message, "error");
    console.error("Firebase Init Error:", e);
}

export { app, db, auth, storage, messaging };
