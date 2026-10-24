/* Test du Worker complet (routes, Durable Objects simulés en mémoire, e-mails et clés Google simulés) :
   connexion par code e-mail et par Google → même compte → sauvegarde → suppression. Lancer : npm test */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { Account, Keys, Stats } from '../src/index.js';
import { periodStarts } from '../src/stats.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
// base SQLite en mémoire au format de Cloudflare (storage.sql.exec(requête, ...valeurs).toArray())
function sqlite() {
  const db = new DatabaseSync(':memory:');
  return { exec: (q, ...b) => { const st = db.prepare(q); const rows = /^\s*select/i.test(q) ? st.all(...b) : (st.run(...b), []); return { toArray: () => rows.map((r) => ({ ...r })) }; } };
}
function mem() {
  const m = new Map();
  return {
    sql: sqlite(),
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
env.KEYS = ns(Keys, env); env.ACCOUNTS = ns(Account, env); env.STATS = ns(Stats, env);
env.ADMIN_EMAILS = 'Patron@Fokus.fr, autre@x.fr';

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
assert.ok(inbox[0].html.includes('Bienvenue dans Fokus') && inbox[0].text.includes('Le principe est simple'), 'inscription : e-mail de bienvenue');
assert.match(inbox[0].subject, /bienvenue/);
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

// tableau de bord : présence, totaux, comptes, accès réservé
assert.deepEqual(periodStarts('2026-10-23'), { today: '2026-10-23', week: '2026-10-19', month: '2026-10-01', year: '2026-01-01', all: '0000-00-00' });
assert.deepEqual(periodStarts('2026-10-19').week, '2026-10-19'); assert.deepEqual(periodStarts('2026-10-25').week, '2026-10-19');
assert.equal((await post('/ping', { vid: 'bad' })).status, 400);
await post('/ping', { vid: 'appareil0000001', s: 60, f: 1500, t: 2, session: s1 });
await post('/ping', { vid: 'appareil0000001', s: 60, session: s1 });
await post('/ping', { vid: 'appareil0000002', s: 99999, t: 9999 }); // valeurs bornées
await post('/ping', { vid: 'appareil0000003', s: 30, bye: true });  // quitte l'app
assert.equal((await post('/admin/summary', { session: s1 })).status, 403, 'pas propriétaire → refusé');
assert.equal((await post('/admin/summary', { session: 'nimporte' })).status, 401);
await post('/auth/email/start', { email: 'patron@fokus.fr' });
const boss = await post('/auth/email/verify', { email: 'patron@fokus.fr', code: /(\d{6}) est ton code/.exec(inbox.at(-1).subject)[1] });
assert.equal(boss.user.admin, true, 'propriétaire reconnu (casse indifférente)');
assert.equal(r.user?.admin ?? false, false);
const sum = await post('/admin/summary', { session: boss.session });
assert.equal(sum.online, 2, '2 appareils en ligne (le 3e est parti)');
assert.equal(sum.onlineAccounts, 1);
for (const k of ['today', 'week', 'month', 'year', 'all']) {
  assert.equal(sum.periods[k].visitors, 3); assert.equal(sum.periods[k].secs, 60 + 60 + 600 + 30);
  assert.equal(sum.periods[k].focus, 1500); assert.equal(sum.periods[k].done, 2 + 100); assert.equal(sum.periods[k].signups, 2);
}
assert.equal(sum.daily.length, 30); assert.equal(sum.daily.at(-1).visitors, 3); assert.equal(sum.accounts, 2);
const list = await post('/admin/accounts', { session: boss.session });
assert.deepEqual(list.accounts.map((a) => [a.email, a.via]).sort(), [['lea@exemple.fr', 'email'], ['patron@fokus.fr', 'email']]);
console.log('✓ tableau de bord : en ligne (2 dont 1 connecté), totaux par période, valeurs bornées, liste des comptes, accès réservé');

// profil : prénom, nom, pseudo (validés, modifiables, visibles dans le tableau de bord)
assert.equal((await post('/profile/set', { session: s1, first: 'Léa', last: 'Martin', pseudo: 'x' })).status, 400, 'pseudo trop court');
assert.equal((await post('/profile/set', { session: s1, first: '<b>', last: 'Martin', pseudo: 'lea' })).status, 400, 'balises refusées');
assert.equal((await post('/profile/set', { session: 'faux', first: 'Léa', last: 'Martin', pseudo: 'lea' })).status, 401);
assert.equal((await post('/profile/set', { session: s1, first: 'Léa', last: 'Martin', pseudo: 'lea' })).status, 400, 'âge obligatoire');
assert.equal((await post('/profile/set', { session: s1, first: 'Léa', last: 'Martin', pseudo: 'lea', age: 3 })).status, 400, 'âge trop petit');
assert.equal((await post('/profile/set', { session: s1, first: 'Léa', last: 'Martin', pseudo: 'lea', age: '17.5' })).status, 400, 'âge entier');
r = await post('/profile/set', { session: s1, first: '  Léa ', last: "D'Arc-Martin", pseudo: 'Léa_42', age: '17' });
assert.deepEqual([r.user.first, r.user.last, r.user.pseudo, r.user.age], ['Léa', "D'Arc-Martin", 'Léa_42', 17]);
r = await post('/sync/get', { session: s1, have: -1 });
assert.equal(r.user.pseudo, 'Léa_42', 'profil renvoyé à la synchronisation');
r = await post('/profile/set', { session: s1, first: 'Léa', last: "D'Arc-Martin", pseudo: 'Lele', age: 18 });
assert.equal(r.user.pseudo, 'Lele', 'pseudo modifiable');
const acc2 = (await post('/admin/accounts', { session: boss.session })).accounts.find((a) => a.email === 'lea@exemple.fr');
assert.deepEqual([acc2.first, acc2.last, acc2.pseudo, acc2.age], ['Léa', "D'Arc-Martin", 'Lele', 18]);
// connexion suivante d'un compte existant : e-mail « content de te revoir » (pas le mode d'emploi)

await post('/auth/email/start', { email: 'boss-unused@x.fr' }); // (autre adresse : pas de limite d'une minute)
const ret = (await import('../src/index.js')).codeMail('111111', false);
assert.ok(ret.html.includes('Content de te revoir') && !ret.html.includes('Le principe'), 'retour : petit mot, pas le mode d’emploi');
const { ageNow } = await import('../src/account.js');
assert.equal(ageNow(17, Date.now() - 366 * 864e5), 18, 'l’âge avance avec le temps');
r = await post('/auth/email/start', { email: 'nouveau@x.fr' });
r = await post('/auth/email/verify', { email: 'nouveau@x.fr', code: /(\d{6}) est ton code/.exec(inbox.at(-1).subject)[1] });
assert.equal(r.user.pseudo, '', 'nouveau compte : profil à remplir'); assert.equal(r.user.age, 0);
console.log('✓ profil : prénom / nom / pseudo validés, modifiables, renvoyés à l’app et visibles dans le tableau de bord');

// moins de 15 ans : compte bloqué (pas de nouvel essai possible), déblocage par le propriétaire seulement
await post('/auth/email/start', { email: 'jeune@x.fr' });
const kid = await post('/auth/email/verify', { email: 'jeune@x.fr', code: /(\d{6}) est ton code/.exec(inbox.at(-1).subject)[1] });
r = await post('/profile/set', { session: kid.session, first: 'Tom', last: 'Petit', pseudo: 'tom', age: 12 });
assert.equal(r.user.blocked, 'age', '12 ans → bloqué');
r = await post('/profile/set', { session: kid.session, first: 'Tom', last: 'Petit', pseudo: 'tom', age: 30 });
assert.equal(r.status, 403, 'impossible de changer l’âge ensuite');
assert.equal((await post('/sync/put', { session: kid.session, base: 0, data: { tasks: [], hist: {} } })).status, 403, 'pas de sauvegarde');
r = await post('/sync/get', { session: kid.session, have: -1 });
assert.equal(r.user.blocked, 'age'); assert.equal(r.data, undefined, 'aucune donnée renvoyée');
assert.equal((await post('/admin/unblock', { session: s1, email: 'jeune@x.fr' })).status, 403, 'déblocage réservé au propriétaire');
let list3 = (await post('/admin/accounts', { session: boss.session })).accounts;
assert.equal(list3.find((a) => a.email === 'jeune@x.fr').blocked, 'age', 'visible dans le tableau de bord');
assert.equal((await post('/admin/unblock', { session: boss.session, email: 'jeune@x.fr' })).ok, true);
r = await post('/sync/get', { session: kid.session, have: -1 });
assert.equal(r.user.blocked, ''); assert.equal(r.user.age, 0, 'âge redemandé après déblocage');
r = await post('/profile/set', { session: kid.session, first: 'Tom', last: 'Petit', pseudo: 'tom', age: 21 });
assert.equal(r.user.blocked, ''); assert.equal(r.user.age, 21);
console.log('✓ moins de 15 ans : compte bloqué sans nouvel essai, aucune donnée ; déblocage par le propriétaire, âge redemandé');

// contact : formulaire → boîte du propriétaire, réponse directe à l'utilisateur
const before = inbox.length;
assert.equal((await post('/contact', { topic: 'age', message: 'ok' })).status, 400, 'message trop court');
assert.equal((await post('/contact', { topic: 'age', message: 'Je me suis trompé d’âge' })).status, 400, 'adresse requise sans compte');
r = await post('/contact', { email: 'visiteur@x.fr', topic: 'age', message: 'J’ai tapé 2 au lieu de 20, <b>désolé</b>' });
assert.equal(r.ok, true);
const m = inbox.at(-1);
assert.deepEqual(m.to, ['patron@fokus.fr', 'autre@x.fr']); assert.equal(m.reply_to, 'visiteur@x.fr');
assert.match(m.subject, /Âge saisi par erreur/); assert.ok(m.html.includes('&lt;b&gt;désolé'), 'texte échappé');
r = await post('/contact', { session: kid.session, email: 'usurpe@x.fr', topic: 'idee', message: 'Une idée géniale pour Fokus' });
assert.equal(inbox.at(-1).reply_to, 'jeune@x.fr', 'connecté : l’adresse du compte fait foi');
assert.equal(inbox.length, before + 2);
console.log('✓ contact : message envoyé au propriétaire, réponse à l’utilisateur, texte échappé, adresse du compte vérifiée');

// agenda : lien d'abonnement signé → flux iCal (tâche validée barrée à l'heure de validation) ; nouveau lien = ancien révoqué
const get = (path) => worker.fetch(new Request('https://w' + path), env);
const dk = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), D3 = dk(3), D0 = dk(0), Dm4 = dk(-4), C = (k) => k.replace(/-/g, '');
r = await post('/sync/get', { session: s1, have: -1 });
r = await post('/sync/put', { session: s1, base: r.rev, data: { tz: 'Europe/Paris', set: { defDur: 30 }, cats: [{ id: 'c-sport', name: 'Sport', emoji: '🏃' }],
  tasks: [{ id: 'run', text: 'Courir', date: D3, time: '17:00', est: 45, cat: 'c-sport', done: false },
    { id: 'lu', text: 'Lire, un peu; beaucoup', date: D3, time: null, done: false },
    { id: 'ok', text: 'Courir', date: D0, time: '17:00', done: true, doneAt: D0 + 'T14:05' }],
  arch: [{ id: 'old', text: 'Ancienne', date: Dm4, done: true, doneAt: Dm4 + 'T09:30' }] } });
assert.ok(r.rev > 0);
const link = await post('/cal/link', { session: s1 });
assert.match(link.url, /^https:\/\/w\/cal\/[0-9a-f]{32}\.1\.[\w-]{27}\.ics$/);
let ics = await get(new URL(link.url).pathname);
assert.equal(ics.status, 200); assert.match(ics.headers.get('Content-Type'), /text\/calendar/);
ics = await ics.text();
assert.ok(ics.includes('X-WR-TIMEZONE:Europe/Paris') && ics.includes('\r\n'), 'en-têtes, fins de ligne CRLF');
assert.ok(ics.includes(`DTSTART;TZID=Europe/Paris:${C(D3)}T170000`) && ics.includes(`DTEND;TZID=Europe/Paris:${C(D3)}T174500`), 'heure + durée estimée');
assert.ok(ics.includes('SUMMARY:🏃 Courir'), 'emoji de la catégorie');
assert.ok(ics.includes(`DTSTART;VALUE=DATE:${C(D3)}`) && ics.includes('Lire\\, un peu\\; beaucoup'), 'sans heure = toute la journée, texte échappé');
assert.ok(ics.includes(`DTSTART;TZID=Europe/Paris:${C(D0)}T140500`) && ics.includes('✅ C\u0336o\u0336u\u0336r\u0336i\u0336r\u0336'), 'validée : barrée, à l’heure de validation');
assert.ok(ics.includes('UID:old@fokus-track.com'), 'tâches archivées après minuit gardées');
assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'lignes de 75 octets au plus');
assert.equal((await get('/cal/abc.1.xxxxxxxxxxxxxxxxxxxxxxxxxxx.ics')).status, 404, 'lien inventé');
const link2 = await post('/cal/link', { session: s1, reset: true });
assert.notEqual(link2.url, link.url);
assert.equal((await get(new URL(link.url).pathname)).status, 404, 'ancien lien révoqué');
assert.equal((await get(new URL(link2.url).pathname)).status, 200);
assert.equal((await post('/cal/link', { session: 'faux' })).status, 401);
console.log('✓ agenda : lien signé, flux iCal (heures, durée, toute la journée, validée barrée à son heure, archives), nouveau lien = ancien révoqué');

// agenda externe : lu par le serveur (https seulement, pas d'adresse locale, contenu iCal vérifié)
const prevFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => (String(u).startsWith('https://calendar.google.com/') ? new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR') : String(u).startsWith('https://pas-un-agenda.fr/') ? new Response('<html>') : prevFetch(u, init));
const raw = async (path, body) => { const x = await worker.fetch(new Request('https://w' + path, { method: 'POST', headers: { Origin: 'https://fokus-track.com' }, body: JSON.stringify(body) }), env); return { status: x.status, text: await x.text() }; };
r = await raw('/cal/fetch', { session: s1, url: 'webcal://calendar.google.com/calendar/ical/x/basic.ics' });
assert.equal(r.status, 200); assert.ok(r.text.startsWith('BEGIN:VCALENDAR'), 'webcal:// accepté');
for (const bad of ['http://calendar.google.com/x.ics', 'https://localhost/x.ics', 'https://127.0.0.1/x.ics', 'https://intranet/x.ics', 'https://a:b@calendar.google.com/x', 'file:///etc/passwd']) {
  assert.equal((await raw('/cal/fetch', { session: s1, url: bad })).status, 400, bad);
}
assert.equal((await raw('/cal/fetch', { session: s1, url: 'https://pas-un-agenda.fr/x' })).status, 422, 'pas un iCal');
assert.equal((await raw('/cal/fetch', { url: 'https://calendar.google.com/x.ics' })).status, 401, 'session requise');
globalThis.fetch = prevFetch;
console.log('✓ agenda externe : webcal → https, adresses locales / http refusées, contenu vérifié, session requise');

// mot de passe : défini dans Réglages → Compte, puis connexion e-mail + mot de passe ; 5 essais ratés → attente
assert.equal((await post('/auth/password/set', { session: s1, password: 'court' })).status, 400, 'trop court');
assert.equal((await post('/auth/password/set', { session: s1, password: '12345678' })).status, 400, 'trop facile');
assert.equal((await post('/auth/password/login', { email: 'lea@exemple.fr', password: 'Fokus-2026!' })).status, 401, 'pas encore de mot de passe');
r = await post('/auth/password/set', { session: s1, password: 'Fokus-2026!' });
assert.equal(r.ok, true); assert.equal(r.user.hasPw, true);
r = await post('/auth/password/login', { email: ' LEA@exemple.fr ', password: 'Fokus-2026!' });
assert.match(r.session, /^v2\./); assert.equal(r.user.email, 'lea@exemple.fr');
for (let i = 0; i < 5; i++) assert.equal((await post('/auth/password/login', { email: 'lea@exemple.fr', password: 'mauvais-mdp' })).status, 401);
r = await post('/auth/password/login', { email: 'lea@exemple.fr', password: 'Fokus-2026!' });
assert.equal(r.status, 429, 'bloqué 15 min après 5 essais ratés'); assert.match(r.error, /15 minutes/);
assert.equal((await post('/auth/password/set', { session: s1, password: '' })).user.hasPw, false, 'mot de passe retiré');
console.log('✓ mot de passe : règles, connexion (adresse normalisée), 5 essais ratés → attente, retrait');

// statistiques, suppression
r = await worker.fetch(new Request('https://w/stats'), env).then((x) => x.json());
assert.equal(r.accounts, 4);
assert.equal((await post('/sync/delete', { session: s1 })).ok, true);
assert.deepEqual((await post('/admin/accounts', { session: boss.session })).accounts.map((a) => a.email).sort(), ['jeune@x.fr', 'nouveau@x.fr', 'patron@fokus.fr'], 'compte supprimé retiré de la liste');
assert.equal((await post('/sync/get', { session: s1, have: -1 })).status, 401);
assert.equal((await post('/sync/get', { session: 'v2.abc.1.zzzzzzzzzzzzzzzzzzzzzzzz', have: -1 })).status, 401);
console.log('✓ compteur de comptes ; suppression → session invalidée');

// sans clé Resend : message clair
const off = { ...env, RESEND_API_KEY: '' };
r = await worker.fetch(new Request('https://w/auth/email/start', { method: 'POST', body: JSON.stringify({ email: 'a@b.fr' }) }), off).then(async (x) => ({ status: x.status, ...(await x.json()) }));
assert.equal(r.status, 503);
console.log('✓ connexion par e-mail désactivée tant que la clé Resend manque');
globalThis.fetch = realFetch;
