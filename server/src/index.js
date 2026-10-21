/* =====================================================================
   SERVEUR DE NOTIFICATIONS FOKUS — Cloudflare Worker + Durable Objects
   Stocke uniquement : l'abonnement push de l'appareil, l'heure et le texte des notifications programmées.
   Aucune tâche, aucun historique.

   API (JSON ; aussi accepté en text/plain pour navigator.sendBeacon) :
     GET  /vapid                         → { key } clé publique VAPID (créée au premier appel)
     POST /sub      { id, sub }          → enregistre l'abonnement de l'appareil
     POST /unsub    { id }               → supprime tout pour cet appareil
     POST /schedule { id, key, at, title, body, url, repeat? ('daily'), next? (texte des jours suivants) }
     POST /cancel   { id, key }
     POST /test     { id }               → notification immédiate
   Chaque appareil a son instance « User » : une alarme réveille l'instance à l'heure de la prochaine
   notification (précision de l'ordre de la seconde).
   ===================================================================== */
import { generateVapid, sendPush } from './webpush.js';

const ID = /^[a-z0-9]{16,48}$/;
const KEY = /^[a-z0-9-]{1,24}$/;

function cors(env, req) {
  const o = req.headers.get('Origin') || '';
  const ok = o === env.ALLOWED_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : env.ALLOWED_ORIGIN,
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
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'fokus-push' }, 200, h);
      if (req.method !== 'POST') return json({ error: 'not found' }, 404, h);
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

/* Clés VAPID générées une seule fois et gardées dans le stockage de l'instance */
export class Keys {
  constructor(state) { this.state = state; }
  async fetch() {
    let v = await this.state.storage.get('vapid');
    if (!v) { v = await generateVapid(); await this.state.storage.put('vapid', v); }
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
