import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { restoreIfNeeded } from './lib/backup';

/* Démarrage : stockage persistant + restauration de la copie IndexedDB si Safari a vidé le localStorage,
   puis chargement du store (qui lit le localStorage à l'import) et de l'interface. */
async function boot() {
  const restored = await Promise.race([restoreIfNeeded('focus_state'), new Promise((r) => setTimeout(() => r(false), 1500))]);
  const [{ default: App }, store] = await Promise.all([import('./App'), import('./store')]);
  store.checkDay();
  if (restored) store.toast('Données restaurées depuis la copie de secours.');
  createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
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

boot();
