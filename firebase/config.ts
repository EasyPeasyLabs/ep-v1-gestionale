
// FIX: Corrected Firebase import paths.
import { initializeApp } from "@firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "@firebase/firestore";
import { getAuth } from "@firebase/auth";
import { getStorage } from "@firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.appspot.com",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Per migliorare la robustezza, abilitiamo la persistenza offline con la nuova API.
// Questo permette all'app di funzionare anche senza connessione (usando dati in cache)
// e gestisce la sincronizzazione tra più schede del browser.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
export const storage = getStorage(app);