
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Configurazione Firebase sincronizzata con ep-gestionale-v1
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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: './lemon_logo_150px.png', 
    badge: './lemon_logo_150px.png',
    data: payload.data,
    tag: 'ep-notification-background'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.link || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// --- PWA OFFLINE CACHING ---
const CACHE_NAME = 'ep-v1-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './lemon_logo_150px.png',
  './manifest.json'
];

// Install: Pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non-GET o verso estensioni chrome
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se la risposta è valida, la cloniamo nella cache e la restituiamo
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // Se la rete fallisce (offline), cerchiamo nella cache
        return caches.match(event.request)
          .then((response) => {
             if (response) {
                 return response;
             }
             // Fallback opzionale per navigazione (es. offline.html) se necessario
          });
      })
  );
});
