// DoExam exam client service worker (scope /exam/). Keeps the exam client usable offline:
// - the API is never cached (answers go through the IndexedDB outbox instead);
// - hashed build assets are cache-first (their names change with every build);
// - pages are network-first with the cached shell as fallback.
// No skipWaiting(): a new version activates only after every exam tab is closed, so the
// client never changes in the middle of an exam (09-FRONTEND §5.4).
const CACHE = 'doexam-exam-v1';
const SHELL = '/exam/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(SHELL, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(SHELL, res);
      const assets = [...html.matchAll(/(?:src|href)="(\/(?:assets\/[^"]+|favicon\.svg))"/g)].map((m) => m[1]);
      await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page sends the assets it already loaded (before this worker controlled it).
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls
          .filter((u) => typeof u === 'string' && new URL(u).origin === self.location.origin && new URL(u).pathname.startsWith('/assets/'))
          .map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => {}))),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(CACHE)).put(SHELL, res.clone());
          return res;
        } catch {
          return (await caches.match(SHELL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      })(),
    );
  }
});
