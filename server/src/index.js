/* =====================================================================
   SERVEUR DE NOTIFICATIONS FOKUS — Cloudflare Worker + Durable Objects
   Stocke uniquement : l'abonnement push de l'appareil, l'heure et le texte des notifications programmées.
   Les tâches ne sont stockées que pour les comptes connectés avec Google (sauvegarde de la progression).

   API (JSON ; aussi accepté en text/plain pour navigator.sendBeacon) :
     GET  /vapid                         → { key } clé publique VAPID (créée au premier appel)
     POST /sub      { id, sub }          → enregistre l'abonnement de l'appareil
     POST /unsub    { id }               → supprime tout pour cet appareil
     POST /schedule { id, key, at, title, body, url, repeat? ('daily'), next? (texte des jours suivants) }
     POST /cancel   { id, key }
     POST /test     { id }               → notification immédiate
   Comptes (voir account.js) :
     POST /auth/google          { credential }        → { session, user } (jeton Google vérifié → session Fokus d'un an)
     POST /auth/google/redirect (formulaire Google)   → retour vers l'app avec la session (iPad / iPhone en mode app)
     POST /sync/get    { session, have }               → { rev, at, data? , user }
     POST /sync/put    { session, base, data }         → { rev, at } ou 409 si un autre appareil a envoyé une version plus récente
     POST /sync/delete { session }                     → efface le compte du serveur
     GET  /stats                                       → { accounts } nombre de comptes créés
   Chaque appareil a son instance « User » : une alarme réveille l'instance à l'heure de la prochaine
   notification (précision de l'ordre de la seconde).
   ===================================================================== */
import { generateVapid, sendPush } from './webpush.js';
import { Account, makeSession, readSession, verifyGoogle } from './account.js';

export { Account };

const ID = /^[a-z0-9]{16,48}$/;
const KEY = /^[a-z0-9-]{1,24}$/;

const origins = (env) => String(env.ALLOWED_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean);
function cors(env, req) {
  const o = req.headers.get('Origin') || '';
  const ok = origins(env).includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : origins(env)[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/vapid') {
        const v = await env.KEYS.get(env.KEYS.idFromName('vapid')).fetch('https://k/get').then((r) => r.json());
        return json({ key: v.publicKey }, 200, h);
      }
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'fokus-push', accounts: !!env.GOOGLE_CLIENT_ID }, 200, h);
      if (req.method === 'GET' && url.pathname === '/stats') return json(await keys(env, '/stats'), 200, h);
      if (req.method !== 'POST') return json({ error: 'not found' }, 404, h);
      if (url.pathname === '/auth/google/redirect') return await redirectLogin(req, env);
      if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/sync/')) return await accountRoute(req, env, url.pathname, h);
      const text = await req.text();
      if (text.length > 8000) return json({ error: 'too large' }, 413, h);
      const body = JSON.parse(text || '{}');
      if (!ID.test(body.id || '')) return json({ error: 'bad id' }, 400, h);
      const stub = env.USERS.get(env.USERS.idFromName(body.id));
      const r = await stub.fetch('https://u' + url.pathname, { method: 'POST', body: JSON.stringify(body) });
      return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', ...h } });
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, h);
    }
  },
};

/* ---------- comptes ---------- */
const keys = (env, path) => env.KEYS.get(env.KEYS.idFromName('vapid')).fetch('https://k' + path).then((r) => r.json());
const account = (env, sub, path, body) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('g:' + sub))
  .fetch('https://a' + path, { method: 'POST', body: JSON.stringify(body) });

/* Jeton Google → session Fokus (+ profil enregistré, compteur de comptes) */
async function login(env, credential) {
  const g = await verifyGoogle(credential, env.GOOGLE_CLIENT_ID);
  const { secret } = await keys(env, '/auth');
  const r = await account(env, g.sub, '/login', { email: g.email, name: g.name, picture: g.picture }).then((x) => x.json());
  if (r.isNew) await keys(env, '/count');
  return { session: await makeSession(g.sub, secret), user: { name: g.name, email: g.email, picture: g.picture }, nonce: g.nonce };
}

async function accountRoute(req, env, path, h) {
  const text = await req.text();
  if (text.length > 3_800_000) return json({ error: 'too large' }, 413, h);
  const b = JSON.parse(text || '{}');
  if (path === '/auth/google') {
    try { const r = await login(env, b.credential); return json({ session: r.session, user: r.user }, 200, h); }
    catch (e) { return json({ error: 'connexion refusée : ' + e.message }, 401, h); }
  }
  const { secret } = await keys(env, '/auth');
  const s = await readSession(b.session, secret);
  if (!s) return json({ error: 'session invalide' }, 401, h);
  const op = { '/sync/get': '/get', '/sync/put': '/put', '/sync/delete': '/delete' }[path];
  if (!op) return json({ error: 'not found' }, 404, h);
  const r = await account(env, s.sub, op, { ...b, session: undefined, iat: s.iat });
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', ...h } });
}

/* Connexion par redirection (app installée sur l'écran d'accueil) : Google envoie le formulaire ici,
   on renvoie vers l'app avec la session dans l'ancre (#), jamais dans les journaux du serveur. */
async function redirectLogin(req, env) {
  const app = env.APP_URL || env.CONTACT;
  try {
    const f = await req.formData();
    const r = await login(env, f.get('credential'));
    const frag = new URLSearchParams({ 'fokus-session': r.session, n: r.nonce, name: r.user.name, email: r.user.email, picture: r.user.picture });
    return Response.redirect(app + '#' + frag, 303);
  } catch (e) {
    return Response.redirect(app + '#' + new URLSearchParams({ 'fokus-login-error': String(e.message || e).slice(0, 80) }), 303);
  }
}

/* Clés VAPID et secret des sessions générés une seule fois et gardés dans le stockage de l'instance ; compteur de comptes */
export class Keys {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const path = new URL(req.url).pathname, st = this.state.storage;
    if (path === '/auth') {
      let secret = await st.get('auth');
      if (!secret) {
        secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await st.put('auth', secret);
      }
      return Response.json({ secret });
    }
    if (path === '/count') { const n = ((await st.get('accounts')) || 0) + 1; await st.put('accounts', n); return Response.json({ n }); }
    if (path === '/stats') return Response.json({ accounts: (await st.get('accounts')) || 0 });
    let v = await st.get('vapid');
    if (!v) { v = await generateVapid(); await st.put('vapid', v); }
    return Response.json(v);
  }
}

/* Une instance par appareil : abonnement + notifications programmées (clé → { at, title, body, url, repeat, next }) */
export class User {
  constructor(state, env) { this.state = state; this.env = env; }

  async vapid() {
    if (!this.v) this.v = await this.env.KEYS.get(this.env.KEYS.idFromName('vapid')).fetch('https://k/get').then((r) => r.json());
    return this.v;
  }

  async arm() {
    const jobs = (await this.state.storage.get('jobs')) || {};
    const next = Math.min(...Object.values(jobs).map((j) => j.at));
    if (Number.isFinite(next)) await this.state.storage.setAlarm(Math.max(Date.now(), next));
    else await this.state.storage.deleteAlarm();
  }

  async send(data) {
    const sub = await this.state.storage.get('sub');
    if (!sub) return 0;
    const status = await sendPush(sub, data, await this.vapid(), this.env.CONTACT);
    if (status === 404 || status === 410) await this.state.storage.deleteAll(); // abonnement expiré : on oublie tout
    return status;
  }

  async fetch(req) {
    const path = new URL(req.url).pathname, b = await req.json();
    const store = this.state.storage;
    if (path === '/sub') {
      const s = b.sub;
      if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return Response.json({ error: 'bad sub' }, { status: 400 });
      await store.put('sub', { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
      return Response.json({ ok: true });
    }
    if (path === '/unsub') { await store.deleteAll(); await store.deleteAlarm(); return Response.json({ ok: true }); }
    if (path === '/test') {
      const status = await this.send({ title: 'Fokus', body: 'Les notifications fonctionnent ✓', url: './?page=1', tag: 'fokus-test' });
      return Response.json({ ok: status >= 200 && status < 300, status }, { status: status ? 200 : 404 });
    }
    if (path === '/schedule') {
      if (!KEY.test(b.key || '') || !Number.isFinite(b.at)) return Response.json({ error: 'bad job' }, { status: 400 });
      const jobs = (await store.get('jobs')) || {};
      jobs[b.key] = {
        at: b.at, title: String(b.title || 'Fokus').slice(0, 80), body: String(b.body || '').slice(0, 240),
        url: String(b.url || './').slice(0, 120), repeat: b.repeat === 'daily' ? 'daily' : null, next: b.next ? String(b.next).slice(0, 240) : null,
      };
      await store.put('jobs', jobs);
      await this.arm();
      return Response.json({ ok: true });
    }
    if (path === '/cancel') {
      const jobs = (await store.get('jobs')) || {};
      delete jobs[b.key];
      await store.put('jobs', jobs);
      await this.arm();
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  async alarm() {
    const jobs = (await this.state.storage.get('jobs')) || {};
    const now = Date.now();
    for (const [k, j] of Object.entries(jobs)) {
      if (j.at > now + 1000) continue;
      // une notification trop ancienne (appareil hors ligne, panne) n'est plus pertinente
      if (now - j.at < 30 * 60 * 1000) await this.send({ title: j.title, body: j.body, url: j.url, tag: 'fokus-' + k });
      if (j.repeat === 'daily') { jobs[k] = { ...j, at: j.at + 864e5 * Math.max(1, Math.ceil((now - j.at + 1) / 864e5)), body: j.next || j.body }; }
      else delete jobs[k];
    }
    if (!(await this.state.storage.get('sub'))) { await this.state.storage.deleteAll(); return; }
    await this.state.storage.put('jobs', jobs);
    await this.arm();
  }
}
