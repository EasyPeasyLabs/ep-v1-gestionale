
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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

// Esporta le istanze dei servizi Firebase per usarle nel resto dell'app
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);


// Per migliorare la robustezza, abilitiamo la persistenza offline.
// Questo permette all'app di funzionare anche senza connessione (usando dati in cache)
// e gestisce meglio gli errori di connessione iniziale dovuti a credenziali errate.
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Si verifica se l'app è aperta in più schede. La persistenza funziona solo in una.
      console.warn("Firestore persistence failed: more than one tab open.");
    } else if (err.code == 'unimplemented') {
      // Si verifica se il browser non supporta la persistenza offline.
      console.warn("Firestore persistence is not supported in this browser.");
    }
  });
