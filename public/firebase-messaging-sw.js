
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Configurazione Firebase identica a quella dell'app
const firebaseConfig = {
  apiKey: "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM",
  authDomain: "ep-gestionale-v1.firebaseapp.com",
  projectId: "ep-gestionale-v1",
  storageBucket: "ep-gestionale-v1.appspot.com",
  messagingSenderId: "332612800443",
  appId: "1:332612800443:web:d5d434d38a78020dd57e9e"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Gestione notifiche in background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    // UPDATE: Percorso relativo per supportare hosting in sottocartelle
    icon: './lemon_logo_150px.png', 
    badge: './lemon_logo_150px.png',
    data: payload.data,
    tag: 'ep-notification' // Raggruppa notifiche simili
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione click sulla notifica (Apre l'app o fa focus sulla tab esistente)
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  event.notification.close();

  // URL di destinazione (default alla root relativa se non specificato)
  const urlToOpen = event.notification.data?.link || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Se c'è già una tab aperta, usala
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // Controlla se l'URL corrisponde alla base dell'app
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
