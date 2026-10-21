const CACHE = 'codrive-v9-roles';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/jakarta.woff2', '/mono.woff2'];
self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const response = await cache.match('/');
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"<>]+)"/g)]
   .map(match => new URL(match[1].replaceAll('&amp;', '&'), self.location.origin))
   .filter(url => url.origin === self.location.origin && url.pathname.startsWith('/_next/static/'))
   .map(url => url.href);
  await cache.addAll([...new Set(assets)]);
  await self.skipWaiting();
 })());
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('codrive-') || key.startsWith('fleetpro-') || key.startsWith('tempo-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 // The API is always network-only; offline data is a read-only frontend snapshot.
 if (new URL(event.request.url).pathname.startsWith('/api/')) return;
 if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
 if (event.request.mode === 'navigate') {
  event.respondWith(fetch(event.request).then(response => {
   if (response.ok && new URL(event.request.url).pathname === '/') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/', copy))); }
   return response;
  }).catch(() => caches.match('/')));
 } else {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
   if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
   return response;
  })));
 }
});
