/* NOVA service worker: cache the shell, never cache API or money responses. */
const SHELL_CACHE = 'nova-shell-v20261006-02';
const SHELL_ASSETS = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // never serve money or auth data from cache
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline').then((response) => response ?? Response.error())),
    );
  }
});
