/* Service worker Fokus — fonctionnement hors ligne.
   Généré au build (vite.config.js) : __VERSION__ et __ASSETS__ sont remplacés par la version et la liste des fichiers. */
const VERSION = __VERSION__;
const CACHE = 'fokus-' + VERSION;
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  // précharge toute l'app (y compris les bibliothèques : three, gsap, chart.js…) pour un usage 100 % hors ligne
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...ASSETS])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fokus-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// le bandeau « Nouvelle version disponible — Recharger » active la nouvelle version
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // page : réseau d'abord (contenu à jour), cache si hors ligne
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; })
        .catch(() => caches.match('./').then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  // fichiers (noms avec empreinte) : cache d'abord
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// tap sur une notification : ouvre (ou ramène) Fokus
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    }),
  );
});
