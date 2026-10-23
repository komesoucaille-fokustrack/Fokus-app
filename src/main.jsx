import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { restoreIfNeeded } from './lib/backup';
import { ANALYTICS_TOKEN } from './cloud-config';

/* Démarrage : stockage persistant + restauration de la copie IndexedDB si Safari a vidé le localStorage,
   puis chargement du store (qui lit le localStorage à l'import) et de l'interface. */
async function boot() {
  const restored = await Promise.race([restoreIfNeeded('focus_state'), new Promise((r) => setTimeout(() => r(false), 1500))]);
  const [{ default: App }, store, cloud, presence] = await Promise.all([import('./App'), import('./store'), import('./lib/cloud'), import('./lib/presence')]);
  store.checkDay();
  cloud.initCloud(); // compte : retour de connexion + synchronisation
  presence.initPresence(); // signal anonyme « en ligne » + temps passé (tableau de bord du propriétaire)
  if (restored) store.toast('Données restaurées depuis la copie de secours.');
  // connexion obligatoire : écran de connexion tant qu'il n'y a pas de session (l'app s'affiche dès la connexion)
  const Login = cloud.loginRequired() ? (await import('./components/Login')).default : null;
  const [Profile, Intro, Blocked] = cloud.cloudEnabled()
    ? await Promise.all([import('./components/Profile'), import('./components/Intro'), import('./components/Blocked')]).then((m) => m.map((x) => x.default))
    : [null, null, null];
  const Root = () => {
    const c = cloud.useCloud();
    if (Login && !c.session) return <Login />;
    if (Blocked && c.session && c.user?.blocked) return <Blocked />; // moins de 15 ans : compte bloqué (contact pour une erreur)
    if (Profile && cloud.needsProfile(c)) return <Profile />; // prénom, nom, pseudo, âge à la première connexion
    if (Intro && c.session && c.intro) return <Intro />;      // bienvenue + principe de l'app, une fois
    return <App />;
  };
  createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>);
  registerSW(store.setUpdate);
}

/* PWA : service worker (hors ligne) + bandeau « Nouvelle version disponible » */
function registerSW(onUpdate) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let reloading = false;
  // rechargement seulement lors d'une mise à jour (pas à la toute première installation)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdate(reg); });
    if (reg.waiting && navigator.serviceWorker.controller) onUpdate(reg);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

// Android / Chrome : on garde la proposition d'installation pour le bouton « Installer » de la carte de bienvenue
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__fokusInstall = e; dispatchEvent(new Event('fokusinstall')); });

/* Statistiques de visites (Cloudflare Web Analytics : sans cookie, aucune donnée personnelle), chargées au repos */
function analytics() {
  if (!ANALYTICS_TOKEN || !import.meta.env.PROD) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS_TOKEN });
  document.head.appendChild(s);
}
addEventListener('load', () => (window.requestIdleCallback || setTimeout)(analytics, { timeout: 4000 }));

/* Compteur d'images par seconde (vérification sur iPad : ajouter ?fps à l'adresse) */
if (/[?&]fps\b/.test(location.search)) {
  const el = Object.assign(document.createElement('div'), { style: 'position:fixed;left:8px;top:calc(env(safe-area-inset-top) + 8px);z-index:9999;padding:4px 8px;border-radius:8px;background:#000c;color:#86efac;font:600 13px/1.2 ui-monospace,monospace;pointer-events:none' });
  document.documentElement.appendChild(el);
  let n = 0, t0 = performance.now(), worst = 0, last = t0;
  const f = (t) => {
    n++; worst = Math.max(worst, t - last); last = t;
    if (t - t0 >= 500) { el.textContent = `${Math.round((n * 1000) / (t - t0))} i/s · pire ${worst.toFixed(0)} ms`; n = 0; t0 = t; worst = 0; }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

boot();
