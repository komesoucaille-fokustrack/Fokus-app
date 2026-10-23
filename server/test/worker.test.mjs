/* Test du Worker complet (routes, Durable Objects simulés en mémoire, e-mails et clés Google simulés) :
   connexion par code e-mail et par Google → même compte → sauvegarde → suppression. Lancer : npm test */
import assert from 'node:assert/strict';
import worker, { Account, Keys } from '../src/index.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
function mem() {
  const m = new Map();
  return {
    async get(k) { return structuredClone(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') Object.entries(k).forEach(([a, b]) => m.set(a, structuredClone(b))); else m.set(k, structuredClone(v)); },
    async delete(k) { m.delete(k); }, async deleteAll() { m.clear(); }, async setAlarm() {}, async deleteAlarm() {},
  };
}
function ns(Cls, env) {
  const inst = new Map();
  return {
    idFromName: (n) => n,
    get: (n) => {
      if (!inst.has(n)) inst.set(n, new Cls({ storage: mem() }, env));
      return { fetch: (u, init) => inst.get(n).fetch(new Request(u, init)) };
    },
    count: () => inst.size,
  };
}
const CLIENT = 'c.apps.googleusercontent.com';
const env = { ALLOWED_ORIGIN: 'https://fokus-track.com,https://komesoucaille-fokustrack.github.io', APP_URL: 'https://fokus-track.com/', GOOGLE_CLIENT_ID: CLIENT, RESEND_API_KEY: 're_test', MAIL_FROM: 'Fokus <connexion@fokus-track.com>' };
env.KEYS = ns(Keys, env); env.ACCOUNTS = ns(Account, env);

// faux Google (clés) et faux Resend (boîte aux lettres)
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
const inbox = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => {
  if (String(u).includes('googleapis.com/oauth2/v3/certs')) return Response.json({ keys: [jwk] });
  if (String(u).startsWith('https://api.resend.com/')) { inbox.push(JSON.parse(init.body)); return Response.json({ id: 'x' }); }
  return realFetch(u, init);
};
async function idToken(claims) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const p = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '42', email: 'lea@exemple.fr', email_verified: true, given_name: 'Léa', exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1', ...claims }));
  return `${h}.${p}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)))}`;
}
const post = async (path, body, origin = 'https://fokus-track.com') => {
  const r = await worker.fetch(new Request('https://w' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }), env);
  return { status: r.status, cors: r.headers.get('Access-Control-Allow-Origin'), ...(await r.json().catch(() => ({}))) };
};

// e-mail : code reçu → session
let r = await post('/auth/email/start', { email: 'pas-une-adresse' });
assert.equal(r.status, 400);
r = await post('/auth/email/start', { email: ' Lea@Exemple.fr ' });
assert.equal(r.ok, true); assert.equal(r.cors, 'https://fokus-track.com');
assert.equal(inbox.length, 1); assert.deepEqual(inbox[0].to, ['lea@exemple.fr']);
const code = /(\d{6}) est ton code/.exec(inbox[0].subject)[1];
assert.ok(inbox[0].html.includes(code) && inbox[0].text.includes(code));
assert.equal((await post('/auth/email/start', { email: 'lea@exemple.fr' })).status, 429, 'pas de 2e code dans la minute');
assert.equal((await post('/auth/email/verify', { email: 'lea@exemple.fr', code: code === '000000' ? '111111' : '000000' })).status, 401);
r = await post('/auth/email/verify', { email: 'LEA@exemple.fr', code });
assert.match(r.session, /^v2\.[0-9a-f]{32}\.\d+\./); assert.equal(r.user.email, 'lea@exemple.fr');
const s1 = r.session;
console.log('✓ connexion par e-mail : code envoyé, mauvais code refusé, bon code → session');

// sauvegarde puis Google avec la même adresse → même compte, mêmes données
r = await post('/sync/put', { session: s1, base: 0, data: { tasks: [{ id: 'a', text: 'Courir' }], hist: {} } });
assert.equal(r.rev, 1);
r = await post('/auth/google', { credential: await idToken({}) });
assert.equal(r.user.name, 'Léa');
r = await post('/sync/get', { session: r.session, have: -1 });
assert.equal(r.data.tasks[0].text, 'Courir'); assert.equal(r.user.name, 'Léa');
assert.equal(env.ACCOUNTS.count(), 1, 'un seul compte pour la même adresse');
assert.equal((await post('/auth/google', { credential: await idToken({ email_verified: false, email: 'x@y.fr' }) })).status, 401);
console.log('✓ Google et e-mail mènent au même compte (même adresse) ; adresse Google non vérifiée refusée');

// connexion Google par redirection (app installée) → retour vers l'app avec la session dans l'ancre
const form = new FormData(); form.set('credential', await idToken({})); form.set('g_csrf_token', 'x');
const red = await worker.fetch(new Request('https://w/auth/google/redirect', { method: 'POST', body: form }), env);
assert.equal(red.status, 303);
const loc = new URL(red.headers.get('Location'));
assert.equal(loc.origin + loc.pathname, 'https://fokus-track.com/');
assert.ok(new URLSearchParams(loc.hash.slice(1)).get('fokus-session').startsWith('v2.'));
assert.equal(new URLSearchParams(loc.hash.slice(1)).get('n'), 'n1');
console.log('✓ redirection Google : retour sur fokus-track.com avec la session et le nonce');

// statistiques, suppression
r = await worker.fetch(new Request('https://w/stats'), env).then((x) => x.json());
assert.equal(r.accounts, 1);
assert.equal((await post('/sync/delete', { session: s1 })).ok, true);
assert.equal((await post('/sync/get', { session: s1, have: -1 })).status, 401);
assert.equal((await post('/sync/get', { session: 'v2.abc.1.zzzzzzzzzzzzzzzzzzzzzzzz', have: -1 })).status, 401);
console.log('✓ compteur de comptes ; suppression → session invalidée');

// sans clé Resend : message clair
const off = { ...env, RESEND_API_KEY: '' };
r = await worker.fetch(new Request('https://w/auth/email/start', { method: 'POST', body: JSON.stringify({ email: 'a@b.fr' }) }), off).then(async (x) => ({ status: x.status, ...(await x.json()) }));
assert.equal(r.status, 503);
console.log('✓ connexion par e-mail désactivée tant que la clé Resend manque');
globalThis.fetch = realFetch;
