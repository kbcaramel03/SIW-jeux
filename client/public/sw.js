// Service worker minimal pour l'installation (PWA).
// - Jamais de cache pour l'API et les sockets (jeu 100 % temps réel).
// - Cache définitif pour les fichiers de build (noms hachés par Vite).
// - Réseau d'abord pour les pages (avec repli cache si hors ligne).
const CACHE = 'sj-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Fichiers hachés : cache d'abord (immuables).
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // Navigation : réseau d'abord, repli cache (mode hors ligne minimal).
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('/')))
  );
});
