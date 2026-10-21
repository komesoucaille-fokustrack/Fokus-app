import { PUSH_URL } from '../push-config';

/* =====================================================================
   NOTIFICATIONS WEB PUSH (programmées côté serveur, reçues même app fermée)
   iPad / iPhone : uniquement pour Fokus ajouté à l'écran d'accueil (iPadOS / iOS 16.4+).
   Toute erreur est silencieuse : sans serveur ou sans permission, l'app marche comme avant.
   ===================================================================== */
let cfg = { url: PUSH_URL, id: '' };
export const configurePush = (url, id) => { cfg = { url: (url || PUSH_URL || '').replace(/\/+$/, ''), id }; };
export const pushServer = () => cfg.url;

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';

// attend le service worker, sans bloquer plus de 4 s (première ouverture, navigation privée…)
const swReady = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('sw')), 4000))]);
const keyBytes = (b64) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
async function post(path, data, beacon) {
  if (!cfg.url || !cfg.id) return null;
  const body = JSON.stringify({ id: cfg.id, ...data });
  // text/plain : pas de requête préalable CORS, et utilisable par sendBeacon quand l'app passe en arrière-plan
  if (beacon && navigator.sendBeacon && navigator.sendBeacon(cfg.url + path, new Blob([body], { type: 'text/plain' }))) return { ok: true };
  try {
    const r = await fetch(cfg.url + path, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true });
    return r.ok ? await r.json().catch(() => ({ ok: true })) : null;
  } catch { return null; }
}

/* Active : permission → abonnement push → enregistrement sur le serveur. Renvoie { ok, reason } */
export async function enablePush() {
  if (!cfg.url) return { ok: false, reason: 'server' };
  if (!pushSupported()) return { ok: false, reason: isStandalone() ? 'unsupported' : 'homescreen' };
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const reg = await swReady();
    const { key } = await fetch(cfg.url + '/vapid').then((r) => r.json());
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey), want = keyBytes(key);
      if (cur.length !== want.length || cur.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
    }
    sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const r = await post('/sub', { sub: sub.toJSON() });
    return r ? { ok: true } : { ok: false, reason: 'server' };
  } catch { return { ok: false, reason: 'server' }; }
}
export async function disablePush() {
  await post('/unsub', {});
  try { const s = await (await swReady()).pushManager.getSubscription(); await s?.unsubscribe(); } catch { /* rien */ }
}
export async function pushStatus() {
  if (!pushSupported()) return { active: false, reason: isStandalone() ? 'unsupported' : 'homescreen' };
  if (Notification.permission === 'denied') return { active: false, reason: 'denied' };
  try {
    const s = await (await swReady()).pushManager.getSubscription();
    if (!s) return { active: false, reason: 'off' };
    if (!cfg.url) return { active: false, reason: 'server' };
    const r = await fetch(cfg.url + '/', { cache: 'no-store' }).then((x) => x.ok).catch(() => false);
    return r ? { active: true } : { active: false, reason: 'server' };
  } catch { return { active: false, reason: 'off' }; }
}
export const testPush = () => post('/test', {});

/* Programmation : on ne renvoie au serveur que ce qui a changé */
const sent = {};
export function schedule(key, job, beacon) {
  const sig = JSON.stringify(job);
  if (sent[key] === sig) return;
  sent[key] = sig;
  post('/schedule', { key, ...job }, beacon);
}
export function cancel(key, beacon) {
  if (sent[key] === null) return;
  sent[key] = null;
  post('/cancel', { key }, beacon);
}
