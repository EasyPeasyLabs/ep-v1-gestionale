
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getFunctions, Functions } from "firebase/functions";

// Helper for boot monitor
const logToScreen = (window as unknown as { logToScreen?: (msg: string, level: string) => void }).logToScreen || console.log;

logToScreen("Configuring Firebase...", "info");

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;
let functions: Functions;

try {
    if (!firebaseConfig.apiKey) {
        throw new Error("ERRORE CRITICO: Configurazione Firebase mancante.");
    }

    // Initialize Firebase safely (handles Vite HMR)
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        logToScreen("Firebase App Initialized.", "success");
        
        // Initialize Firestore with Robust Cache Handling only on first init
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
                ignoreUndefinedProperties: true
            });
            logToScreen("Firestore Initialized.", "success");
        } catch (err: unknown) {
            const error = err as { code?: string };
            if (error.code === 'failed-precondition') {
                console.warn("Firestore persistence failed. Clearing cache and retrying...");
                db = initializeFirestore(app, {
                   ignoreUndefinedProperties: true
                });
            } else {
                throw err;
            }
        }
    } else {
        app = getApp();
        db = getFirestore(app);
        logToScreen("Firebase App Retrieved from cache.", "info");
    }

    auth = getAuth(app);
    storage = getStorage(app);
    functions = getFunctions(app, "europe-west1");
    
    // Messaging is only supported in browsers with service workers
    isSupported().then((supported) => {
        if (supported) {
            messaging = getMessaging(app);
        }
    }).catch(console.error);

} catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logToScreen("FIREBASE INIT ERROR: " + errorMessage, "error");
    console.error("Firebase Init Error:", e instanceof Error ? e.message : e);
}

export { app, db, auth, storage, messaging, functions };
