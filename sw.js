// Offline-välimuisti. Nosta VERSION aina, kun julkaiset muutoksia.
const VERSION = 'tavusaari-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/app.js',
  'js/audio.js',
  'js/content.js',
  'js/db.js',
  'js/letterPaths.js',
  'js/parent.js',
  'js/progress.js',
  'js/round.js',
  'js/modes/listen.js',
  'js/modes/say.js',
  'js/modes/blend.js',
  'js/modes/draw.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Välimuisti ensin, päivitys taustalla (stale-while-revalidate).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
