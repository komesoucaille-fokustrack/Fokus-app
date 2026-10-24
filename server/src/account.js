/* =====================================================================
   COMPTES FOKUS — connexion (Google ou code par e-mail) + sauvegarde de la progression
   - Un compte = une adresse e-mail vérifiée, quelle que soit la façon de se connecter :
     · Google : l'app envoie le jeton d'identité ; le serveur vérifie sa signature (clés publiques de Google),
       son destinataire (notre identifiant client), sa date et que l'e-mail est vérifié par Google ;
     · e-mail : code à 6 chiffres envoyé à l'adresse (valable 10 min, 5 essais, 1 envoi / min, 5 / h).
     Puis le serveur remet une session Fokus signée (HMAC) valable 1 an.
   - Une instance « Account » par adresse (clé = empreinte SHA-256 de l'adresse) : profil, code en attente,
     données de l'app (JSON découpé en morceaux) + un numéro de version « rev » pour ne jamais écraser
     une version plus récente envoyée par un autre appareil.
   Stocké : e-mail, prénom et photo (Google), données de l'app. Rien d'autre.
   ===================================================================== */
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const unb64json = (s) => JSON.parse(new TextDecoder().decode(unb64u(s)));

/* ---------- jeton d'identité Google ---------- */
let certs = null, certsAt = 0;
async function googleCerts() {
  if (certs && Date.now() - certsAt < 3600e3) return certs;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('google certs ' + r.status);
  certs = (await r.json()).keys; certsAt = Date.now();
  return certs;
}

/* Renvoie { sub, email, name, picture, nonce } si le jeton est valide, sinon lève une erreur */
export async function verifyGoogle(token, clientId, keys = googleCerts, now = Date.now()) {
  if (!clientId) throw new Error('client id manquant');
  const [h, p, s] = String(token || '').split('.');
  if (!h || !p || !s) throw new Error('jeton illisible');
  const head = unb64json(h), pay = unb64json(p);
  if (head.alg !== 'RS256') throw new Error('algorithme');
  const jwk = (await keys()).find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('clé inconnue');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(h + '.' + p)))) throw new Error('signature');
  if (pay.iss !== 'accounts.google.com' && pay.iss !== 'https://accounts.google.com') throw new Error('émetteur');
  if (pay.aud !== clientId) throw new Error('destinataire');
  if (!(pay.exp * 1000 > now - 60e3)) throw new Error('jeton expiré');
  if (!/^\d{1,40}$/.test(pay.sub || '')) throw new Error('sub');
  if (!(pay.email_verified === true || pay.email_verified === 'true') || !pay.email) throw new Error('e-mail non vérifié');
  return { sub: pay.sub, email: String(pay.email || ''), name: String(pay.given_name || pay.name || '').slice(0, 60), picture: String(pay.picture || '').slice(0, 300), nonce: pay.nonce || '' };
}

/* ---------- adresse e-mail → identifiant de compte ---------- */
export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
export const normEmail = (e) => String(e || '').trim().toLowerCase();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
export async function accountId(email) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode('fokus:' + normEmail(email)))).slice(0, 32);
}

/* ---------- session Fokus : « v2.<compte>.<émise à (s)>.<signature> » ---------- */
const hmacKey = (secret) => crypto.subtle.importKey('raw', unb64u(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export async function makeSession(id, secret, now = Date.now()) {
  const body = `v2.${id}.${Math.floor(now / 1000)}`;
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
}
export async function readSession(tok, secret, now = Date.now()) {
  const m = /^v2\.([0-9a-f]{32})\.(\d{1,12})\.([\w-]{20,})$/.exec(String(tok || ''));
  if (!m) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(m[3]), enc.encode(`v2.${m[1]}.${m[2]}`));
  const iat = +m[2];
  if (!ok || iat * 1000 > now + 60e3 || now - iat * 1000 > 400 * 864e5) return null;
  return { id: m[1], iat };
}

/* ---------- profil : prénom, nom, pseudo, âge (demandés à la première connexion, modifiables) ---------- */
const clean = (v, max) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const NAME = /^[\p{L}][\p{L}\p{M} '’.-]{0,39}$/u, PSEUDO = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]{1,19}$/u;
export function checkProfile(b) {
  const first = clean(b.first, 40), last = clean(b.last, 40), pseudo = clean(b.pseudo, 20);
  if (!NAME.test(first)) return { error: 'Prénom invalide (lettres, espaces, tirets).' };
  if (!NAME.test(last)) return { error: 'Nom invalide (lettres, espaces, tirets).' };
  if (!PSEUDO.test(pseudo)) return { error: 'Pseudo invalide : 2 à 20 caractères (lettres, chiffres, espace, _ . -).' };
  const age = Number(String(b.age ?? '').trim());
  if (!Number.isInteger(age) || age < 7 || age > 120) return { error: 'Âge invalide (entre 7 et 120 ans).' };
  return { first, last, pseudo, age };
}
// Fokus est réservé aux 15 ans et plus (loi Informatique et Libertés, art. 45) : un âge inférieur bloque le compte,
// définitivement pour cette adresse (seul le propriétaire peut débloquer depuis le tableau de bord, en cas d'erreur de saisie)
export const MIN_AGE = 15;
// l'âge vieillit tout seul : âge donné + années écoulées depuis qu'il a été donné
export const ageNow = (age, at, now = Date.now()) => (age ? age + Math.floor((now - (at || now)) / (365.25 * 864e5)) : 0);
const profileOf = (meta) => ({ name: meta.name || '', email: meta.email || '', picture: meta.picture || '', first: meta.first || '', last: meta.last || '', pseudo: meta.pseudo || '', age: ageNow(meta.age, meta.ageAt), blocked: meta.blocked || '', hasPw: !!meta.pw });

/* Mot de passe (facultatif, en plus du code par e-mail) : PBKDF2-SHA256, 100 000 itérations (maximum des Workers), sel aléatoire.
   Le mot de passe n'est jamais stocké ; 5 essais ratés → 15 minutes d'attente. Oublié ? Le code par e-mail marche toujours. */
export const PW_MIN = 8;
const PW_IT = 100_000;
export async function pwHash(password, salt, it = PW_IT) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64u(salt), iterations: it }, key, 256));
}
export function checkPassword(pw) {
  pw = String(pw || '');
  if (pw.length < PW_MIN) return `Au moins ${PW_MIN} caractères.`;
  if (pw.length > 200) return 'Mot de passe trop long.';
  if (/^(.)\1+$/.test(pw) || /^(?:12345678|motdepasse|password|azertyui|qwertyui)/i.test(pw)) return 'Mot de passe trop facile à deviner.';
  return '';
}

/* Lien d'agenda (flux iCal en lecture seule) : « <compte>.<version>.<signature> ». Changer de version révoque l'ancien lien. */
export async function calToken(id, v, secret) {
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`cal:${id}:${v}`))).slice(0, 27);
  return `${id}.${v}.${sig}`;
}
export async function readCalToken(tok, secret) {
  const m = /^([a-f0-9]{32})\.(\d{1,6})\.([\w-]{27})$/.exec(String(tok || ''));
  if (!m) return null;
  return (await calToken(m[1], +m[2], secret)) === tok ? { id: m[1], v: +m[2] } : null;
}

/* code à 6 chiffres (tirage sans biais) et son empreinte (le code lui-même n'est jamais stocké) */
export function newCode() {
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= 4_294_000_000);
  return String(a[0] % 1_000_000).padStart(6, '0');
}
const codeHash = async (code, salt) => hex(await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + code)));

/* ---------- une instance par compte ---------- */
// morceaux de 32 000 caractères (≤ 96 Ko même tout en accents / emojis), 110 morceaux au plus (une seule écriture groupée)
const CHUNK = 32_000;
export const MAX_DATA = 3_500_000; // ≈ plusieurs années d'utilisation intensive

export class Account {
  constructor(state) { this.state = state; }

  async fetch(req) {
    const path = new URL(req.url).pathname, b = await req.json();
    const st = this.state.storage;
    const meta = (await st.get('meta')) || { rev: 0, at: 0, n: 0, minIat: 0 };

    if (path === '/login') { // profil mis à jour à chaque connexion (prénom / photo seulement s'ils sont fournis)
      const isNew = !meta.created;
      Object.assign(meta, { email: b.email, created: meta.created || Date.now(), seen: Date.now() });
      if (b.name) meta.name = b.name;
      if (b.picture) meta.picture = b.picture;
      await st.put('meta', meta);
      return Response.json({ ok: true, isNew, user: profileOf(meta) });
    }
    if (path === '/code') { // nouveau code : au plus 1 par minute et 5 par heure
      const now = Date.now(), c = (await st.get('code')) || { sends: [] };
      const sends = (c.sends || []).filter((t) => now - t < 3600e3);
      if (sends.length && now - sends[sends.length - 1] < 60e3) return Response.json({ error: 'Un code vient d’être envoyé : attends une minute avant d’en redemander un.' }, { status: 429 });
      if (sends.length >= 5) return Response.json({ error: 'Trop de codes demandés : réessaie dans une heure.' }, { status: 429 });
      const code = newCode(), salt = hex(crypto.getRandomValues(new Uint8Array(8)));
      await st.put('code', { hash: await codeHash(code, salt), salt, exp: now + 10 * 60e3, tries: 0, sends: [...sends, now] });
      return Response.json({ code, isNew: !meta.created }); // remis au Worker seulement, pour l'e-mail (bienvenue ou retour)
    }
    if (path === '/verify') {
      const c = await st.get('code');
      if (!c || !c.hash || Date.now() > c.exp) return Response.json({ error: 'Code expiré : demande-en un nouveau.' }, { status: 401 });
      if (c.tries >= 5) return Response.json({ error: 'Trop d’essais : demande un nouveau code.' }, { status: 401 });
      if ((await codeHash(String(b.code || '').replace(/\D/g, ''), c.salt)) !== c.hash) {
        c.tries++;
        await st.put('code', c);
        return Response.json({ error: c.tries >= 5 ? 'Trop d’essais : demande un nouveau code.' : 'Code incorrect.' }, { status: 401 });
      }
      await st.put('code', { sends: c.sends }); // code utilisé : il ne resservira pas
      return Response.json({ ok: true });
    }
    if (path === '/pwcheck') { // connexion par mot de passe (avant toute session)
      const now = Date.now(), f = meta.pwFail || { n: 0, t: 0 };
      if (f.n >= 5 && now - f.t < 15 * 60e3) return Response.json({ error: 'Trop d’essais : réessaie dans 15 minutes, ou connecte-toi avec un code par e-mail.' }, { status: 429 });
      if (!meta.pw) return Response.json({ error: 'E-mail ou mot de passe incorrect.' }, { status: 401 });
      if ((await pwHash(String(b.password || ''), meta.pw.salt, meta.pw.it)) !== meta.pw.hash) {
        meta.pwFail = { n: (now - f.t < 15 * 60e3 ? f.n : 0) + 1, t: now };
        await st.put('meta', meta);
        return Response.json({ error: 'E-mail ou mot de passe incorrect.' }, { status: 401 });
      }
      delete meta.pwFail;
      await st.put('meta', meta);
      return Response.json({ ok: true });
    }
    if (path === '/caldata') { // flux d'agenda : appelé par le Worker après vérification de la signature du lien
      if (meta.blocked || !meta.calv || meta.calv !== b.v || !meta.n) return Response.json({ error: 'not found' }, { status: 404 });
      let text = '';
      for (let i = 0; i < meta.n; i++) text += (await st.get('c' + i)) || '';
      return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    }
    if (path === '/unblock') { // appelé seulement par le Worker, après vérification du propriétaire
      delete meta.blocked; delete meta.blockedAt;
      Object.assign(meta, { age: 0, ageAt: 0 }); // l'âge sera redemandé à la prochaine ouverture
      await st.put('meta', meta);
      return Response.json({ ok: true });
    }
    if (!(b.iat >= (meta.minIat || 0))) return Response.json({ error: 'session révoquée' }, { status: 401 });
    const user = profileOf(meta);
    if (meta.blocked && (path === '/profile' || path === '/put')) {
      return Response.json({ error: 'Compte bloqué : contacte-nous si c’est une erreur.', blocked: meta.blocked, user }, { status: 403 });
    }
    if (path === '/profile') {
      const p = checkProfile(b);
      if (p.error) return Response.json(p, { status: 400 });
      Object.assign(meta, p, { ageAt: Date.now() });
      if (p.age < MIN_AGE) Object.assign(meta, { blocked: 'age', blockedAt: Date.now() });
      await st.put('meta', meta);
      return Response.json({ ok: true, user: profileOf(meta) });
    }

    if (path === '/pwset') { // définir, changer (password) ou retirer (password vide) le mot de passe
      if (b.password) {
        const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
        meta.pw = { salt, it: PW_IT, hash: await pwHash(String(b.password), salt), at: Date.now() };
      } else delete meta.pw;
      delete meta.pwFail;
      await st.put('meta', meta);
      return Response.json({ ok: true, user: profileOf(meta) });
    }
    if (path === '/calv') { // version du lien d'agenda (créée au premier appel, +1 pour révoquer l'ancien lien)
      if (!meta.calv || b.reset) meta.calv = (meta.calv || 0) + 1;
      await st.put('meta', meta);
      return Response.json({ v: meta.calv });
    }
    if (path === '/get') {
      if (meta.blocked) return Response.json({ rev: meta.rev, at: meta.at, same: true, user }); // compte bloqué : pas de données
      if (b.have === meta.rev) return Response.json({ rev: meta.rev, at: meta.at, same: true, user });
      let text = '';
      for (let i = 0; i < meta.n; i++) text += (await st.get('c' + i)) || '';
      return Response.json({ rev: meta.rev, at: meta.at, data: text ? JSON.parse(text) : null, user });
    }
    if (path === '/put') {
      if (b.base !== meta.rev) return Response.json({ error: 'conflict', rev: meta.rev, at: meta.at }, { status: 409 });
      const text = JSON.stringify(b.data);
      if (text.length > MAX_DATA) return Response.json({ error: 'too large' }, { status: 413 });
      const parts = {};
      for (let i = 0; i * CHUNK < text.length; i++) parts['c' + i] = text.slice(i * CHUNK, (i + 1) * CHUNK);
      const n = Object.keys(parts).length;
      for (let i = n; i < meta.n; i++) await st.delete('c' + i);
      Object.assign(meta, { rev: meta.rev + 1, at: Date.now(), n });
      await st.put({ ...parts, meta }); // écrit en une fois (transaction)
      return Response.json({ rev: meta.rev, at: meta.at });
    }
    if (path === '/delete') { // efface tout et invalide les sessions déjà remises
      await st.deleteAll();
      await st.put('meta', { rev: 0, at: 0, n: 0, minIat: Math.floor(Date.now() / 1000) + 1, deleted: Date.now() });
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}
