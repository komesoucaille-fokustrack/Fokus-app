import { useSyncExternalStore } from 'react';
import { EMAIL_LOGIN, GOOGLE_CLIENT_ID, REQUIRE_LOGIN } from '../cloud-config';
import { PUSH_URL } from '../push-config';
import { applyRemote, getState, onSave, resetAll, toast } from '../store';
import { isStandalone } from './push';

/* =====================================================================
   COMPTE FOKUS — connexion (Google ou code par e-mail) + sauvegarde de la progression sur le serveur (server/src/account.js)
   - REQUIRE_LOGIN : écran de connexion obligatoire avant l'app (Login.jsx) dès qu'une méthode est configurée ;
     sinon compte facultatif (Réglages → Compte) et, sans compte, les données restent sur l'appareil.
   - Connecté : chaque modification est envoyée ~2,5 s plus tard ; à l'ouverture (et au retour dans l'app) on récupère
     la version du serveur si un autre appareil l'a changée. Numéro de version « rev » : jamais d'écrasement silencieux ;
     si les deux appareils ont changé, la version la plus récente gagne et l'autre reste récupérable (« Annuler »).
   - Première connexion sur un appareil qui a déjà des données alors que le compte en a aussi : on demande (CloudChoice).
   Méta (propre à l'appareil, jamais exportée) : localStorage « fokus_cloud » = { session, user, rev, dirty, at, syncedAt }.
   ===================================================================== */
const LS = 'fokus_cloud', NONCE = 'fokus_nonce';
const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
let m = read();
let ui = { busy: false, error: '', choice: null };
let snap = { ...m, ...ui };
const subs = new Set();
const notify = () => { snap = { ...m, ...ui }; subs.forEach((f) => f()); };
const persist = () => { try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* stockage indisponible */ } notify(); };
const setUi = (p) => { ui = { ...ui, ...p }; notify(); };

export const googleLogin = () => !!GOOGLE_CLIENT_ID;
export const emailLogin = () => !!EMAIL_LOGIN;
export const cloudEnabled = () => googleLogin() || emailLogin();
export const loginRequired = () => !!REQUIRE_LOGIN && cloudEnabled();
export const useCloud = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap);

const base = () => (getState().set.pushUrl || PUSH_URL || '').replace(/\/+$/, '');
async function api(path, body, keepalive = false) {
  // text/plain : pas de requête préalable CORS (un aller-retour de moins)
  const r = await fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), keepalive });
  let j = {};
  try { j = await r.json(); } catch { /* réponse vide */ }
  if (path === '/sync/get' && r.ok) j.admin = r.headers.get('X-Fokus-Admin') === '1'; // propriétaire du site (tableau de bord)
  if (r.status === 401 && path.startsWith('/sync/')) { signOut(); throw new Error('Session expirée : reconnecte-toi.'); }
  if (!r.ok && r.status !== 409) throw new Error(j.error || 'Erreur ' + r.status);
  return { status: r.status, ...j };
}

// tout l'état de l'app, sauf l'identifiant de notifications propre à l'appareil
const payload = () => { const o = { ...getState() }; delete o.pushId; return o; };
const hasData = (o) => !!(o && ((o.tasks && o.tasks.length) || (o.hist && Object.keys(o.hist).length)));

/* ---------- envoi ---------- */
let ver = 0, timer = 0;
const later = (ms = 2500) => { clearTimeout(timer); timer = setTimeout(push, ms); };
function changed(remote) {
  if (!m.session || remote) return;
  ver++;
  m.dirty = true; m.at = Date.now();
  persist();
  later();
}

let postponed = false;
export async function push(keepalive = false) {
  if (!m.session || !m.dirty || ui.choice || (m.rev == null && postponed)) return;
  if (ui.busy) return later();
  if (m.rev == null) return pull(); // jamais synchronisé sur cet appareil : on regarde d'abord le compte
  const v = ver, body = JSON.stringify({ session: m.session, base: m.rev, data: payload() });
  setUi({ busy: true });
  try {
    const r = await api('/sync/put', JSON.parse(body), keepalive && body.length < 60000);
    setUi({ busy: false });
    if (r.status === 409) return pull(); // un autre appareil a envoyé une version plus récente
    m.rev = r.rev; m.syncedAt = Date.now();
    if (ver === v) m.dirty = false; // sinon : modifié pendant l'envoi → nouvel envoi
    ui.error = '';
    persist();
    if (m.dirty) later();
  } catch (e) {
    setUi({ busy: false, error: navigator.onLine === false ? 'Hors ligne : envoi dès le retour du réseau.' : e.message });
    if (m.session) later(30000); // nouvel essai dans 30 s
  }
}

/* ---------- réception ---------- */
function adopt(r) {
  m.rev = r.rev; m.dirty = false; m.syncedAt = Date.now(); // avant applyRemote : le changement de jour éventuel sera renvoyé
  persist();
  applyRemote(r.data);
}
function keepMine(rev) { m.rev = rev; m.dirty = true; m.at = Date.now(); persist(); push(); }

let lastPull = 0;
export async function pull() {
  if (!m.session || ui.choice) return;
  if (ui.busy) return;
  lastPull = Date.now();
  setUi({ busy: true });
  let r;
  try { r = await api('/sync/get', { session: m.session, have: m.rev ?? -1 }); }
  catch (e) { setUi({ busy: false, error: navigator.onLine === false ? 'Hors ligne.' : e.message }); return; }
  ui.busy = false; ui.error = '';
  if (r.user) m.user = { ...m.user, ...r.user };
  if (m.user && 'admin' in r) m.user = { ...m.user, admin: r.admin };
  if (r.same) { m.syncedAt = Date.now(); persist(); if (m.dirty) push(); return; }
  if (m.rev == null) { // première synchronisation de cet appareil
    if (!r.data) return keepMine(r.rev);           // compte vide : on y met les données de l'appareil
    if (!hasData(getState())) return adopt(r);       // appareil vide : on récupère le compte
    persist();
    setUi({ choice: { rev: r.rev, at: r.at, data: r.data } }); // les deux ont des données : on demande
    return;
  }
  if (!r.data) return keepMine(r.rev);               // compte effacé depuis un autre appareil : on renvoie
  if (!m.dirty) return adopt(r);
  // les deux appareils ont changé : la version la plus récente gagne, l'autre reste récupérable
  if ((r.at || 0) > (m.at || 0)) {
    const mine = payload();
    adopt(r);
    toast('Version plus récente de ton autre appareil chargée.', { label: 'Annuler', fn: () => { applyRemote(mine); keepMine(m.rev); } }, 9000);
  } else keepMine(r.rev);
}

/* Choix à la première connexion : 'account' (garder le compte), 'device' (garder cet appareil)
   ou 'later' (fenêtre fermée : rien n'est envoyé, la question reviendra à la prochaine ouverture) */
export function resolveChoice(which) {
  const c = ui.choice;
  if (!c) return;
  setUi({ choice: null });
  if (which === 'account') adopt(c);
  else if (which === 'device') keepMine(c.rev);
  else postponed = true;
}

/* ---------- connexion / déconnexion ---------- */
function signedIn(session, user, extra = {}) {
  m = { session, user, rev: null, dirty: false, at: 0, syncedAt: 0, ...extra };
  persist();
  toast(`Connecté${user?.name ? ' : ' + user.name : ''}. Ta progression est sauvegardée.`);
  pull();
}
/* wipe : efface aussi les données de cet appareil (connexion obligatoire : appareil partagé, la copie est sur le compte) */
export function signOut(wipe = false) {
  clearTimeout(timer);
  m = {};
  ui = { busy: false, error: '', choice: null };
  persist();
  try { window.google?.accounts.id.disableAutoSelect(); } catch { /* bibliothèque non chargée */ }
  if (wipe) resetAll(true);
}
/* Déconnexion volontaire : envoie d'abord les dernières modifications ; renvoie false si elles n'ont pas pu partir */
export async function logout(force = false) {
  if (m.dirty && m.rev != null) await push();
  if (m.dirty && !force) return false;
  signOut(loginRequired());
  return true;
}
export async function deleteAccount() {
  await api('/sync/delete', { session: m.session });
  signOut(loginRequired());
  toast(loginRequired() ? 'Compte et données supprimés.' : 'Compte supprimé du serveur. Tes données restent sur cet appareil.');
}

/* Profil (prénom, nom, pseudo, âge) : demandé à la première connexion, modifiable dans Réglages → Compte.
   Juste après l'inscription : écran de bienvenue (Intro.jsx) tant que m.intro est vrai. */
export const needsProfile = (c = snap) => !!(c.session && c.user && 'pseudo' in c.user && (!c.user.pseudo || !c.user.age));
export async function setProfile(p) {
  const first = !m.user?.pseudo; // inscription (et pas simple ajout de l'âge ou modification)
  const r = await api('/profile/set', { session: m.session, ...p });
  m.user = { ...m.user, ...r.user };
  if (first) m.intro = true;
  persist();
}
export const dismissIntro = () => { delete m.intro; persist(); };

/* Formulaire de contact (connecté : l'adresse du compte est utilisée) ; déblocage d'un compte (propriétaire) */
export const sendContact = ({ topic, message, email }) => api('/contact', { session: m.session || undefined, email, topic, message });
export const adminUnblock = (email) => api('/admin/unblock', { session: m.session, email });

export const sessionToken = () => m.session || '';
export const serverUrl = base;
/* Tableau de bord du propriétaire : 'summary' (en ligne + récap) ou 'accounts' (liste des comptes) */
export const adminApi = (what) => api('/admin/' + what, { session: m.session });

/* Agenda : lien d'abonnement au flux iCal de Fokus (reset = nouveau lien) ; lecture d'un agenda externe (.ics) via le serveur */
export const calLink = (reset = false) => api('/cal/link', { session: m.session, reset });
export async function calFetch(url) {
  const r = await fetch(base() + '/cal/fetch', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ session: m.session, url }) });
  if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* vide */ } throw new Error(j.error || 'Erreur ' + r.status); }
  return r.text();
}

/* Mot de passe (facultatif) : connexion e-mail + mot de passe ; défini / changé / retiré dans Réglages → Compte */
export async function passwordLogin(email, password) {
  const r = await api('/auth/password/login', { email, password });
  signedIn(r.session, r.user);
}
export async function setPassword(password) {
  const r = await api('/auth/password/set', { session: m.session, password });
  m.user = { ...m.user, ...r.user };
  persist();
}

/* Inscription en une fois (onglet « Créer un compte ») : code reçu (adresse vérifiée) → profil + mot de passe → session.
   Le profil n'est enregistré que pour un compte neuf : si l'adresse avait déjà un compte, on s'y connecte simplement. */
export async function signupVerify(email, code, profile, password) {
  const r = await api('/auth/email/verify', { email, code });
  let user = r.user || {};
  const fresh = !user.pseudo;
  let warn = '';
  try {
    if (fresh) user = { ...user, ...(await api('/profile/set', { session: r.session, ...profile })).user };
    if (password && (fresh || !user.hasPw)) user = { ...user, ...(await api('/auth/password/set', { session: r.session, password })).user };
  } catch (e) { warn = e.message; } // connecté quand même : le profil sera redemandé, le mot de passe se crée dans Réglages
  signedIn(r.session, user, fresh && user.pseudo ? { intro: true } : {}); // compte neuf : écran de bienvenue (Intro)
  return { fresh, warn };
}

/* Connexion par code e-mail : 1) envoi du code 2) vérification → session */
export const emailStart = (email) => api('/auth/email/start', { email });
export async function emailVerify(email, code) {
  const r = await api('/auth/email/verify', { email, code });
  signedIn(r.session, r.user);
}

let gis = null;
const loadGis = () => gis || (gis = new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client?hl=fr';
  s.async = true;
  s.onload = () => ok(window.google);
  s.onerror = () => { gis = null; ko(new Error('Google injoignable (hors ligne ?)')); };
  document.head.appendChild(s);
}));

/* Bouton « Continuer avec Google » officiel dans el. App installée (écran d'accueil) : redirection (les fenêtres
   surgissantes y sont peu fiables) ; navigateur : petite fenêtre Google. */
export async function renderGoogleButton(el, width) {
  const google = await loadGis();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(NONCE, nonce); } catch { /* rien */ }
  const redirect = isStandalone();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce,
    ux_mode: redirect ? 'redirect' : 'popup',
    login_uri: base() + '/auth/google/redirect',
    callback: async ({ credential }) => {
      setUi({ busy: true, error: '' });
      try { const r = await api('/auth/google', { credential }); setUi({ busy: false }); signedIn(r.session, r.user); }
      catch (e) { setUi({ busy: false, error: e.message }); }
    },
    itp_support: true,
    cancel_on_tap_outside: true,
  });
  google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'fr', width: Math.min(400, width || 300) });
}

/* Retour de la connexion par redirection : #fokus-session=…&n=… (vérifie que la demande vient bien de cet appareil) */
function fromRedirect() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('fokus-session') && !h.has('fokus-login-error')) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (h.has('fokus-login-error')) { setTimeout(() => toast('Connexion Google impossible : ' + h.get('fokus-login-error')), 600); return; }
  let nonce = '';
  try { nonce = localStorage.getItem(NONCE) || ''; localStorage.removeItem(NONCE); } catch { /* rien */ }
  if (!nonce || h.get('n') !== nonce) { setTimeout(() => toast('Connexion refusée (demande inconnue) : réessaie.'), 600); return; }
  signedIn(h.get('fokus-session'), { name: h.get('name') || '', email: h.get('email') || '', picture: h.get('picture') || '', admin: h.get('admin') === '1' });
}

/* Démarrage (main.jsx) */
export function initCloud() {
  if (!cloudEnabled()) return;
  fromRedirect();
  onSave(changed);
  document.addEventListener('visibilitychange', () => {
    if (!m.session) return;
    if (document.hidden) { if (m.dirty) push(true); } // départ de l'app : envoi immédiat
    else if (Date.now() - lastPull > 20000) pull();     // retour : un autre appareil a peut-être changé quelque chose
  });
  addEventListener('online', () => { if (m.session) (m.dirty ? push() : pull()); });
  if (!m.session) return;
  if (m.dirty && m.rev != null) push(); else pull();
}
