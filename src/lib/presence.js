import { PUSH_URL } from '../push-config';
import { focusTotal, getState, onSave } from '../store';
import { sessionToken } from './cloud';

/* =====================================================================
   SIGNAL DE PRÉSENCE (statistiques du tableau de bord, server/src/stats.js)
   Toutes les minutes tant que l'app est à l'écran : un numéro d'appareil tiré au hasard + ce qui s'est passé depuis
   le signal précédent (secondes passées dans l'app, secondes de concentration, tâches validées). Aucun texte, aucune tâche.
   « bye » au départ de l'app (l'appareil n'est plus compté en ligne).
   ===================================================================== */
const KEY = 'fokus_vid', EVERY = 60e3;
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
let vid = '';
try { vid = localStorage.getItem(KEY) || ''; if (!/^[a-z0-9]{12,40}$/.test(vid)) { vid = rand(); localStorage.setItem(KEY, vid); } } catch { vid = rand(); }

const url = () => (getState().set.pushUrl || PUSH_URL || '').replace(/\/+$/, '') + '/ping';
const now = () => performance.now();
const vals = () => { const S = getState(); return { f: Math.round(focusTotal(S) * 60), t: S.doneTotal || 0 }; };
let secs = 0, last = now(), base = vals(), timer = 0;

function tick() {
  const t = now();
  if (!document.hidden) secs += Math.min(t - last, 2 * EVERY) / 1000; // jamais le temps passé en arrière-plan
  last = t;
}
function send(bye = false) {
  tick();
  // compteurs qui ne font que monter : une tâche décochée puis recochée ne compte pas deux fois
  const v = vals(), f = Math.max(0, v.f - base.f), t = Math.max(0, v.t - base.t);
  base = { f: Math.max(base.f, v.f), t: Math.max(base.t, v.t) };
  const s = Math.floor(secs);
  secs -= s;
  const body = JSON.stringify({ vid, s, f, t, bye: bye || undefined, session: sessionToken() || undefined });
  try {
    if (bye && navigator.sendBeacon) navigator.sendBeacon(url(), new Blob([body], { type: 'text/plain' }));
    else fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  } catch { /* hors ligne */ }
}
const start = () => { clearInterval(timer); last = now(); send(); timer = setInterval(send, EVERY); };

/* Démarrage (main.jsx) : en production, ou en local si une adresse de serveur est réglée */
export function initPresence() {
  if (!import.meta.env.PROD && !getState().set.pushUrl) return;
  if (!(getState().set.pushUrl || PUSH_URL)) return;
  // données reçues d'un autre appareil (ou effacées) : nouvelle base, rien n'est compté
  onSave((remote) => { if (remote) base = vals(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(timer); send(true); } else start();
  });
  addEventListener('pagehide', () => send(true));
  if (!document.hidden) start();
}
