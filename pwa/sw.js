/* Service worker Fokus — fonctionnement hors ligne.
   Généré au build (vite.config.js) : la version et la liste des fichiers sont injectées dans VERSION et ASSETS. */
const VERSION = __VERSION__;
// labo (/labo/) : caches à part, pour que l'app et le labo ne s'effacent pas l'un l'autre
const PREFIX = new URL(self.registration.scope).pathname.endsWith('/labo/') ? 'labo-' : 'fokus-';
const CACHE = PREFIX + VERSION;
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  // précharge toute l'app (y compris les bibliothèques : three, gsap, chart.js…) pour un usage 100 % hors ligne
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...ASSETS])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// le bandeau « Nouvelle version disponible — Recharger » active la nouvelle version
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // pages de présentation (Découvrir, Pomodoro) : réseau, sans jamais remplacer l'app en cache
    const path = new URL(req.url).pathname, root = new URL('./', self.registration.scope).pathname;
    if (path !== root && path !== root + 'index.html') {
      e.respondWith(fetch(req).catch(() => caches.match('./', { ignoreVary: true })));
      return;
    }
    // page : réseau d'abord en contournant le cache HTTP (GitHub Pages le garde 10 min) → mises à jour immédiates
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; })
        .catch(() => caches.match('./', { ignoreVary: true }).then((r) => r || caches.match('./index.html', { ignoreVary: true }))),
    );
    return;
  }
  // fichiers (noms avec empreinte) : cache d'abord
  e.respondWith(
    // ignoreVary : les fichiers mis en cache à l'installation servent aussi aux requêtes de modules (en-tête Origin)
    caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// notification programmée par le serveur (Web Push) : affichée même app fermée
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Fokus', {
    body: d.body || '', tag: d.tag || 'fokus', renotify: true,
    icon: './apple-touch-icon.png', badge: './apple-touch-icon.png', data: { url: d.url || './' },
  }));
});

// tap sur une notification : ouvre (ou ramène) Fokus sur le bon onglet
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.postMessage({ type: 'open', url }); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
