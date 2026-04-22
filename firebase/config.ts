
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getFunctions, Functions } from "firebase/functions";

// Configurazione Fallback
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ep-gestionale-v1.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ep-gestionale-v1",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ep-gestionale-v1.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "332612800443",
  appId: env.VITE_FIREBASE_APP_ID || "1:332612800443:web:d5d434d38a78020dd57e9e"
};

const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || "(default)";

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;
let functions: Functions;

try {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
                ignoreUndefinedProperties: true
            }, firestoreDatabaseId);
        } catch (err: any) {
            db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firestoreDatabaseId);
        }
    } else {
        app = getApp();
        db = getFirestore(app, firestoreDatabaseId);
    }

    auth = getAuth(app);
    storage = getStorage(app);
    functions = getFunctions(app, "europe-west1");
    
    isSupported().then(supported => {
        if (supported) messaging = getMessaging(app);
    }).catch(console.error);

    getDocFromServer(doc(db, 'system', 'connection_test')).catch(() => {});

} catch (e: any) {
    console.error("Firebase Init Error:", e);
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    functions = getFunctions(app);
}

export { app, db, auth, storage, messaging, functions };
