/* Tests des comptes : jeton Google (signé ici avec une fausse clé « Google »), sessions, sauvegarde / conflits / suppression.
   Les Durable Objects sont simulés en mémoire. Lancer : npm test */
import assert from 'node:assert/strict';
import { Account, accountId, makeSession, newCode, readSession, verifyGoogle } from '../src/account.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
const CLIENT = '123-abc.apps.googleusercontent.com';

// fausse clé « Google »
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
const keys = async () => [jwk];
async function idToken(claims, kid = 'k1') {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '1098765', email: 'a@b.c', email_verified: true, given_name: 'Léa', exp: Math.floor(Date.now() / 1000) + 3600, nonce: 'n1', ...claims }));
  const s = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)));
  return `${h}.${p}.${s}`;
}

// 1. jeton Google
const g = await verifyGoogle(await idToken({}), CLIENT, keys);
assert.equal(g.sub, '1098765'); assert.equal(g.name, 'Léa'); assert.equal(g.nonce, 'n1');
for (const [bad, why] of [[{ aud: 'autre' }, 'destinataire'], [{ iss: 'evil.com' }, 'émetteur'], [{ exp: 1000 }, 'expiré'], [{ email_verified: false }, 'non vérifié']]) {
  await assert.rejects(verifyGoogle(await idToken(bad), CLIENT, keys), new RegExp(why));
}
const tok = await idToken({});
const forged = tok.split('.'); forged[1] = b64u(JSON.stringify({ ...JSON.parse(Buffer.from(forged[1], 'base64url')), sub: '666' }));
await assert.rejects(verifyGoogle(forged.join('.'), CLIENT, keys), /signature/);
await assert.rejects(verifyGoogle(await idToken({}, 'k9'), CLIENT, keys), /clé inconnue/);
console.log('✓ jeton Google : valide accepté, falsifié / mauvais destinataire / expiré refusés');

// 2. sessions
const secret = b64u(crypto.getRandomValues(new Uint8Array(32)));
const id = await accountId(' Lea@Exemple.fr ');
assert.equal(id, await accountId('lea@exemple.fr'), 'même compte quelle que soit la casse');
assert.notEqual(id, await accountId('leo@exemple.fr'));
const sess = await makeSession(id, secret);
assert.equal((await readSession(sess, secret)).id, id);
assert.equal(await readSession(sess.replace(id, await accountId('pirate@x.fr')), secret), null);
assert.equal(await readSession(sess, b64u(crypto.getRandomValues(new Uint8Array(32)))), null);
assert.equal(await readSession(sess, secret, Date.now() + 401 * 864e5), null);
const codes = new Set(Array.from({ length: 2000 }, newCode));
assert.ok([...codes].every((c) => /^\d{6}$/.test(c)) && codes.size > 1900, 'codes à 6 chiffres variés');
console.log('✓ session : signée, non modifiable, expire après ~13 mois ; un compte par adresse e-mail');

// 3. compte (Durable Object simulé)
function memStorage() {
  const m = new Map();
  return {
    m,
    async get(k) { return structuredClone(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') { const e = Object.entries(k); assert.ok(e.length <= 128, 'max 128 clés par écriture'); e.forEach(([a, b]) => m.set(a, structuredClone(b))); } else m.set(k, structuredClone(v)); },
    async delete(k) { m.delete(k); },
    async deleteAll() { m.clear(); },
  };
}
const st = memStorage();
const acc = new Account({ storage: st });
const call = async (path, body) => { const r = await acc.fetch(new Request('https://a' + path, { method: 'POST', body: JSON.stringify(body) })); return { status: r.status, ...(await r.json()) }; };
const iat = Math.floor(Date.now() / 1000);

// code par e-mail : envoi limité, 5 essais, usage unique
let c1 = await call('/code', {});
assert.match(c1.code, /^\d{6}$/);
assert.equal((await call('/code', {})).status, 429, '1 code par minute');
assert.ok(![...st.m.values()].some((v) => JSON.stringify(v).includes(c1.code)), 'le code n’est pas stocké en clair');
assert.equal((await call('/verify', { code: '000000' === c1.code ? '111111' : '000000' })).status, 401);
assert.equal((await call('/verify', { code: c1.code })).ok, true);
assert.equal((await call('/verify', { code: c1.code })).status, 401, 'code à usage unique');
const cm = await st.get('code'); cm.sends = cm.sends.map((t) => t - 61e3); await st.put('code', cm);
const c2 = (await call('/code', {})).code;
for (let i = 0; i < 5; i++) await call('/verify', { code: c2 === '123456' ? '654321' : '123456' });
assert.equal((await call('/verify', { code: c2 })).status, 401, 'bloqué après 5 erreurs');
const cm2 = await st.get('code'); cm2.exp = Date.now() - 1; cm2.tries = 0; await st.put('code', cm2);
assert.equal((await call('/verify', { code: c2 })).status, 401, 'code expiré');
console.log('✓ code par e-mail : 6 chiffres, jamais stocké en clair, 1/min, 5 essais, usage unique, expiration');

assert.equal((await call('/login', { email: 'a@b.c', name: 'Léa' })).isNew, true);
const again = await call('/login', { email: 'a@b.c' }); // connexion par code : pas de prénom fourni
assert.equal(again.isNew, false); assert.equal(again.user.name, 'Léa', 'le prénom Google est gardé');
let r = await call('/get', { iat, have: null });
assert.equal(r.rev, 0); assert.equal(r.data, null); assert.equal(r.user.name, 'Léa');

// grosses données (accents + emojis) découpées puis recollées à l'identique
const big = { tasks: Array.from({ length: 4000 }, (_, i) => ({ id: 't' + i, text: 'Tâche n°' + i + ' 🏃‍♀️ éàü — ' + 'x'.repeat(i % 50) })), hist: {} };
r = await call('/put', { iat, base: 0, data: big });
assert.equal(r.rev, 1);
assert.ok([...st.m.keys()].filter((k) => k.startsWith('c')).length > 5, 'découpé en morceaux');
r = await call('/get', { iat, have: 0 });
assert.deepEqual(r.data, big);
assert.equal((await call('/get', { iat, have: 1 })).same, true);
console.log('✓ sauvegarde : ' + JSON.stringify(big).length + ' caractères découpés et relus à l\'identique');

// un autre appareil part d'une ancienne version → conflit, rien n'est écrasé
r = await call('/put', { iat, base: 0, data: { tasks: [], hist: {} } });
assert.equal(r.status, 409); assert.equal(r.rev, 1);
assert.deepEqual((await call('/get', { iat, have: 0 })).data, big);
// version plus petite : les morceaux en trop sont supprimés
r = await call('/put', { iat, base: 1, data: { tasks: [{ id: 'a' }], hist: {} } });
assert.equal(r.rev, 2);
assert.equal([...st.m.keys()].filter((k) => /^c\d+$/.test(k)).length, 1);
assert.deepEqual((await call('/get', { iat, have: 1 })).data, { tasks: [{ id: 'a' }], hist: {} });
// trop gros → refusé
assert.equal((await call('/put', { iat, base: 2, data: { s: 'x'.repeat(3_600_000) } })).status, 413);
console.log('✓ conflit entre appareils détecté (409), morceaux en trop nettoyés, limite de taille');

// suppression : données effacées, anciennes sessions refusées, nouvelle connexion possible
await call('/delete', { iat });
assert.equal([...st.m.keys()].filter((k) => /^c\d+$/.test(k)).length, 0);
assert.equal((await call('/get', { iat, have: null })).status, 401);
assert.equal((await call('/get', { iat: iat + 5, have: null })).rev, 0);
console.log('✓ suppression du compte : tout est effacé et les anciennes sessions ne marchent plus');
