// EchoLens — Production Progressive Web App (PWA) Service Worker
const CACHE_NAME = 'echolens-pwa-v5';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/style.css',
  '/app.js',
  '/i18n.js',
  '/maps.js',
  '/manifest.json',
  '/favicon.svg',
];

// Install Event — Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Offline-first with stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Stale-While-Revalidate for CDN assets (TensorFlow.js, Google Fonts)
  if (url.origin.includes('cdn.jsdelivr.net') || url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Network-First with Cache Fallback for App Shell navigation
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        return cached || caches.match('/index.html');
      });
    })
  );
});
