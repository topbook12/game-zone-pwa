/* Game Zone — Service Worker (PWA offline support) */
const CACHE_NAME = 'game-zone-v7';
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-64.png',
  '/images/racing-banner.jpg',
  '/images/quiz-banner.jpg',
  '/images/2048-banner.jpg',
  '/images/snake-banner.jpg',
];

// Install: cache core assets one-by-one (allSettled → a missing/failed asset
// can never break the whole SW install)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(CORE_ASSETS.map((a) => cache.add(a)))
      )
  );
});

// Message: allow the page to activate a waiting worker instantly
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - navigation  → network-first (fresh page), fallback to cached shell offline
//  - /api/scores → network-first, fallback to last cached leaderboard offline
//  - static      → cache-first (immutable assets = zero repeat data usage)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch dev hot-reload
  if (url.pathname.includes('webpack-hmr') || url.pathname.includes('_rsc')) {
    return;
  }

  // Page navigation: network first, fall back to cache when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // API: network first with cache fallback (leaderboard still visible offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(
          () =>
            caches.match(request).then(
              (cached) =>
                cached ||
                new Response(JSON.stringify({ offline: true, scores: [] }), {
                  headers: { 'Content-Type': 'application/json' },
                })
            )
        )
    );
    return;
  }

  // Static files: cache first, then network (and cache the result)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Only cache responses that are actually cacheable
          // (dev-mode chunks send no-store — never cache those)
          const cc = (res.headers.get('cache-control') || '').toLowerCase();
          const cacheable = res.ok && !cc.includes('no-store') && !cc.includes('no-cache');
          if (cacheable) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
