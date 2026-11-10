/**
 * Hika-Poker - Service Worker PWA
 * Gestion du cache offline et installation autonome plein écran.
 */

const CACHE_NAME = 'hika-poker-v1.1';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'engine.js',
  'js/audio.js',
  'js/storage.js',
  'js/bot-names.js',
  'js/wheel.js',
  'js/tournament.js',
  'js/ui-table.js',
  'js/ui-controls.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png'
];

// Installation : Mise en cache des ressources essentielles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Hika-Poker SW] Mise en cache des ressources statiques');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Hika-Poker SW] Suppression ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Récupération des ressources (Stratégie Network-First avec repli Cache)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Mode hors-ligne : répondre avec le cache local
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }
        });
      })
  );
});
