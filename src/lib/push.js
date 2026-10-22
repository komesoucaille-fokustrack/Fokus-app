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

/* Active : permission → abonnement push → enregistrement sur le serveur.
   Renvoie { ok, reason, step, detail } : step = étape qui a échoué, detail = message d'erreur (affiché pour le diagnostic) */
export async function enablePush() {
  if (!cfg.url) return { ok: false, reason: 'server', step: 'adresse du serveur' };
  if (!pushSupported()) return { ok: false, reason: isStandalone() ? 'unsupported' : 'homescreen' };
  let perm = Notification.permission;
  // iPad : la demande doit partir directement du geste (aucune attente avant)
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) { return { ok: false, reason: 'denied', step: 'permission', detail: String(e?.message || e) }; } }
  if (perm !== 'granted') return { ok: false, reason: 'denied', step: 'permission', detail: perm === 'denied' ? 'refusée' : 'non accordée' };
  let step = 'service worker';
  try {
    const reg = await swReady();
    step = 'clé du serveur';
    const res = await fetch(cfg.url + '/vapid', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { key } = await res.json();
    step = 'abonnement de l’appareil';
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options?.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey), want = keyBytes(key);
      if (cur.length !== want.length || cur.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
    }
    sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    step = 'enregistrement sur le serveur';
    const r = await fetch(cfg.url + '/sub', { method: 'POST', body: JSON.stringify({ id: cfg.id, sub: sub.toJSON() }), headers: { 'Content-Type': 'text/plain' } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 80));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: step === 'service worker' ? 'sw' : 'server', step, detail: String(e?.message || e).slice(0, 140) };
  }
}

/* Diagnostic pas à pas (Réglages → Rappels) : chaque étape ✓ / ✗ avec un détail lisible */
export async function pushDiagnose() {
  const out = [];
  const add = (label, ok, detail = '') => out.push({ label, ok, detail });
  const ua = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  add('Version d’iPadOS / iOS', !ua || +ua[1] > 16 || (+ua[1] === 16 && +ua[2] >= 4), ua ? `${ua[1]}.${ua[2]}` : 'non détectée');
  add('Ouvert depuis l’icône de l’écran d’accueil', isStandalone(), isStandalone() ? '' : 'ouvert dans Safari : les notifications n’y sont pas disponibles');
  add('Notifications web disponibles', pushSupported(), pushSupported() ? '' : 'PushManager absent');
  const PERM = { granted: 'accordée', denied: 'refusée — à réactiver dans Réglages de l’iPad → Notifications → Fokus', default: 'pas encore demandée (active l’interrupteur ci-dessus)' };
  add('Permission', typeof Notification !== 'undefined' && Notification.permission === 'granted', typeof Notification !== 'undefined' ? PERM[Notification.permission] : 'indisponible');
  let reg = null;
  try { reg = await swReady(); add('Service worker (fonctionnement en arrière-plan)', !!reg?.active, reg?.active ? '' : 'pas encore actif'); }
  catch { add('Service worker (fonctionnement en arrière-plan)', false, 'non prêt — ferme puis rouvre Fokus'); }
  add('Adresse du serveur', !!cfg.url, cfg.url || 'vide');
  if (cfg.url) {
    try {
      const r = await fetch(cfg.url + '/vapid', { cache: 'no-store' });
      add('Serveur joignable', r.ok, r.ok ? '' : 'HTTP ' + r.status);
    } catch (e) { add('Serveur joignable', false, String(e?.message || e).slice(0, 100)); }
  }
  if (reg?.pushManager) {
    try { const s = await reg.pushManager.getSubscription(); add('Abonnement de cet appareil', !!s, s ? new URL(s.endpoint).host : 'aucun'); }
    catch (e) { add('Abonnement de cet appareil', false, String(e?.message || e).slice(0, 100)); }
  }
  add('Identifiant de l’appareil', !!cfg.id, cfg.id ? cfg.id.slice(0, 6) + '…' : 'vide');
  return out;
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
