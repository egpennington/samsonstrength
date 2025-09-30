// sw.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `ladder-pwa-${CACHE_VERSION}-${self.registration.scope || ''}`.replace(/[^a-z0-9\-]/gi, '');
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './main.js',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './images/logoBD2.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Optional: help browsers return something while SW fetches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // enable navigation preload if supported
    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }
    // clean old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // add assets individually to avoid whole install failing on one 404
    await Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)));
  })());
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // App shell navigation fallback (offline)
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Use preload if available, else network
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const net = await fetch(request);
        return net;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cachedShell = await cache.match('./index.html');
        return cachedShell || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Same-origin requests: stale-while-revalidate
  const sameOrigin = new URL(request.url).origin === location.origin;

  if (sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fetchAndUpdate = fetch(request)
        .then(res => {
          // Skip opaque or error responses
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(() => undefined);

      // Return cache first, update in background if possible
      return cached || fetchAndUpdate || new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
    return;
  }

  // Cross-origin: network first, don’t cache opaque by default
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      const cached = await caches.match(request);
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
