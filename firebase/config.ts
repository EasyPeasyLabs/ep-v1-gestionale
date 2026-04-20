
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getFunctions, Functions } from "firebase/functions";

import firebaseAppletConfig from "../firebase-applet-config.json" assert { type: "json" };

// Helper for boot monitor
const logToScreen = (window as unknown as { logToScreen?: (msg: string, level: string) => void }).logToScreen || console.log;

logToScreen("Configuring Firebase...", "info");

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

// PRIORITA': firebase-applet-config.json (se presente) > Env Vars > Fallback
const config = firebaseAppletConfig as Record<string, unknown> | null;
const firebaseConfig = {
  apiKey: (config?.apiKey as string) || env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: (config?.authDomain as string) || env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: (config?.projectId as string) || env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: (config?.storageBucket as string) || "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: (config?.messagingSenderId as string) || env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: (config?.appId as string) || env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

const firestoreDatabaseId = (config?.firestoreDatabaseId as string) || env.VITE_FIREBASE_DATABASE_ID || "(default)";

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
        db = getFirestore(app, firestoreDatabaseId);
        logToScreen("Firebase App Retrieved from cache.", "info");
    }

    // BOOT TEST: Firestore Connection
    const testConnection = async () => {
        try {
            logToScreen("Testing Firestore connection...", "info");
            await getDocFromServer(doc(db, 'system', 'connection_test'));
            logToScreen("Firestore Connection: OK", "success");
        } catch (error) {
            if (error instanceof Error && error.message.includes('the client is offline')) {
                logToScreen("FIREBASE ERROR: Client is OFFLINE. Check network/config.", "error");
            } else {
                logToScreen("FIREBASE ERROR: " + (error as Error).message, "error");
            }
        }
    };
    testConnection();

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
