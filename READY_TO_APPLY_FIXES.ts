// CORREZIONI PRONTE PER APPLICARE

// ============================================================================
// FILE: services/enrollmentService.ts - BUG #2 CORREZIONE
// ============================================================================
// Riga ~107: Aggiungere logging quando recupero fallisce
// PRIMA:
//            } else {
//                console.warn(`[ENROLLMENT] Recupero automatico fallito...`);
//            }
//        }
//    }

// DOPO (completo):
// Cambiare la sezione da riga 101-115 così:
/*
            if (foundDate) {
                const newAppointment: Appointment = {
                    lessonId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    date: nextDate.toISOString(),
                    startTime: lastApp.startTime,
                    endTime: lastApp.endTime,
                    locationName: lastApp.locationName,
                    locationColor: lastApp.locationColor,
                    childName: lastApp.childName,
                    status: 'Scheduled'
                };
                appointments.push(newAppointment);
            } else {
                console.warn(`[ENROLLMENT] ⚠️ Recupero automatico fallito per iscrizione ${enrollmentId}: nessuna data disponibile trovata entro 52 settimane. Lezione ${appointmentLessonId} rimane Absent. Revisione manuale richiesta.`);
            }
*/

// ============================================================================
// FILE: firebase/config.ts - BUG #4 CORREZIONE PARTE 1
// ============================================================================
// PRIMA:
/*
const firebaseConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.appspot.com",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};
*/

// DOPO:
/*
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
*/

// ============================================================================
// FILE: services/fcmService.ts - BUG #4 CORREZIONE PARTE 2
// ============================================================================
// Riga 6: Cambiare
// PRIMA:
// const VAPID_KEY = "BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo";

// DOPO:
// const VAPID_KEY = import.meta.env.VITE_VAPID_KEY || "";

// Inoltre, riga 36: Aggiungere validazione
/*
if (!VAPID_KEY) {
    return { success: false, error: "VAPID KEY mancante. Configurare VITE_VAPID_KEY in .env.local" };
}
*/

// ============================================================================
// FILE: .env.local (NUOVO FILE - NON COMMITTARE!)
// ============================================================================
/*
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM
VITE_FIREBASE_AUTH_DOMAIN=ep-gestionale-v1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ep-gestionale-v1
VITE_FIREBASE_STORAGE_BUCKET=ep-gestionale-v1.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=332612800443
VITE_FIREBASE_APP_ID=1:332612800443:web:d5d434d38a78020dd57e9e

# FCM Configuration
VITE_VAPID_KEY=BOqTrAbRMwoOwkO9dt9r-fAglvqNmmosdNFRcWpfB67V-ecvVkA_VAFcM7RR7EJKK0RuaHwiREwG-6u997AEgXo
*/

// ============================================================================
// FILE: .gitignore (AGGIUNGERE QUESTE LINEE)
// ============================================================================
/*
# Environment variables
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local
*/

// ============================================================================
// FILE: services/notificationService.ts - BUG #6 CORREZIONE
// ============================================================================
// Aggiungere parametro user
// Riga 5: Cambiare firma da:
// export const getNotifications = async (): Promise<Notification[]> => {

// A:
// export const getNotifications = async (userId?: string): Promise<Notification[]> => {

// Riga 10: Cambiare da:
// const ignoredIds = JSON.parse(localStorage.getItem('ep_ignored_notifications') || '[]');

// A:
// const storageKey = userId ? `ep_ignored_notifications_${userId}` : 'ep_ignored_notifications';
// const ignoredIds = JSON.parse(localStorage.getItem(storageKey) || '[]');

// Poi in tutti i componenti che chiamano getNotifications, passare userId:
// Esempio in Header.tsx:
// const fetchAndGenerateNotifications = useCallback(async () => {
//     setLoadingNotifications(true);
//     try {
//         const notifs = await getNotifications(user?.uid);  // ✅ PASSARE userId
//         setNotifications(notifs);
//     } catch (error) {
//         console.error("Failed to fetch notifications:", error);
//     } finally {
//         setLoadingNotifications(false);
//     }
// }, [user?.uid]);

// ============================================================================
// FILE: pages/Finance.tsx (e altri) - BUG #7 CORREZIONE (useCallback)
// ============================================================================
// PRIMA:
/*
const fetchData = async () => {
    // ... fetch logic
};

useEffect(() => {
    fetchData();
    window.addEventListener('EP_DataUpdated', fetchData);
    return () => window.removeEventListener('EP_DataUpdated', fetchData);
}, []);  // ❌ fetchData non è in deps
*/

// DOPO:
/*
const fetchData = useCallback(async () => {
    // ... fetch logic
}, []);  // ✅ Dependencies corrette (potrebbero includere altri state)

useEffect(() => {
    fetchData();
    window.addEventListener('EP_DataUpdated', fetchData);
    return () => window.removeEventListener('EP_DataUpdated', fetchData);
}, [fetchData]);  // ✅ fetchData ora nelle dependencies
*/

// File interessati:
// - pages/Finance.tsx (linea ~340)
// - pages/Enrollments.tsx (linea ~219)
// - pages/Dashboard.tsx (linea ~165)
// - components/Header.tsx (linea ~60)
// - components/Sidebar.tsx (linea ~65)

// ============================================================================
// FILE: package.json - BUG #10 - DEPENDENCY CHECK
// ============================================================================
// Aggiungere se non presenti:
/*
{
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^18.2.0",      // ✅ AGGIUNGERE
    "@types/react-dom": "^18.2.0",  // ✅ AGGIUNGERE
    "typescript": "~5.8.2"
  }
}

// Eseguire: npm install
*/

// ============================================================================
// FILE: components/NotificationScheduler.tsx - BUG #10 CORREZIONE
// ============================================================================
// Riga 24-42: Migliorare scheduling
// PRIMA:
/*
const now = new Date();
const currentDay = now.getDay();
const currentHour = String(now.getHours()).padStart(2, '0');
const currentMinute = String(now.getMinutes()).padStart(2, '0');
const currentTime = `${currentHour}:${currentMinute}`;

if (check.startTime === currentTime) {
    // trigger
}
*/

// DOPO (più robusto):
/*
const now = new Date();
const currentDay = now.getDay();
const currentHour = String(now.getHours()).padStart(2, '0');
const currentMinute = String(now.getMinutes()).padStart(2, '0');
const currentTime = `${currentHour}:${currentMinute}`;

// Window di tolleranza: triggerare se siamo nel minuto specificato O nel minuto precedente (entro 10s di polling)
const lastTime = lastNotifiedRef.current[check.id] || 0;
const minutesAgo = (Date.now() - lastTime) / (1000 * 60);

if (check.startTime === currentTime && minutesAgo >= 1) {
    // trigger - ma solo se almeno 1 minuto è passato dall'ultima notifica
}
*/

// ============================================================================
// FILE: services/enrollmentService.ts - BUG #8 CORREZIONE PARZIALE
// ============================================================================
// Riga ~240: Aggiungere validazione in addRecoveryLessons
// PRIMA:
/*
export const addRecoveryLessons = async (
    enrollmentId: string, 
    startDate: string,
    startTime: string,
    endTime: string,
    numberOfLessons: number,
    locationName: string,
    locationColor: string
): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    // ... continua senza validazione
}
*/

// DOPO (con validazione minima):
/*
export const addRecoveryLessons = async (
    enrollmentId: string, 
    startDate: string,
    startTime: string,
    endTime: string,
    numberOfLessons: number,
    locationName: string,
    locationColor: string
): Promise<void> => {
    const enrollmentDocRef = doc(db, 'enrollments', enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentDocRef);
    
    if (!enrollmentSnap.exists()) throw new Error("Iscrizione non trovata");
    
    const enrollment = enrollmentSnap.data() as Enrollment;
    
    // ✅ AGGIUNGERE VALIDAZIONE:
    if (startTime >= endTime) {
        throw new Error("Ora inizio deve essere prima dell'ora fine");
    }
    
    if (numberOfLessons <= 0) {
        throw new Error("Numero lezioni deve essere almeno 1");
    }
    
    // Verificare che la location sia ancora della sede dell'enrollment
    // (Facoltativo ma consigliato per robustezza)
    
    // ... continua con creazione appointments
}
*/

// ============================================================================
// PROSSIMI PASSI - ORDINE CONSIGLIATO
// ============================================================================
/*
1. npm install @types/react @types/react-dom
   Questo risolverà ~4700 degli errori TS7026

2. Creare .env.local con config Firebase (BUG #4)

3. Aggiornare firebase/config.ts per usare env variables

4. Aggiornare services/fcmService.ts per usare env

5. Aggiungere useCallback a fetchData functions (BUG #7)

6. Applicare logging in registerAbsence (BUG #2)

7. Isolate localStorage per userId (BUG #6)

8. Improved scheduling in NotificationScheduler (BUG #10)

9. Test completo multi-browser e multi-tab

10. Fare backup del .env.local e aggiungerlo a .gitignore
*/
