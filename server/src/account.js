/* =====================================================================
   COMPTES FOKUS — connexion Google + sauvegarde de la progression
   - L'app envoie le jeton d'identité Google (« Se connecter avec Google ») ; le serveur vérifie sa signature
     (clés publiques de Google), son destinataire (notre identifiant client) et sa date, puis remet une
     session Fokus signée (HMAC) valable 1 an : plus besoin de Google ensuite.
   - Une instance « Account » par compte Google (clé = identifiant Google « sub ») : les données de l'app
     (JSON découpé en morceaux) + un numéro de version « rev » pour éviter d'écraser une version
     plus récente envoyée par un autre appareil.
   Stocké : identifiant Google, e-mail, prénom, photo, données de l'app. Rien d'autre.
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
  return { sub: pay.sub, email: String(pay.email || ''), name: String(pay.given_name || pay.name || '').slice(0, 60), picture: String(pay.picture || '').slice(0, 300), nonce: pay.nonce || '' };
}

/* ---------- session Fokus : « v1.<sub>.<émise à (s)>.<signature> » ---------- */
const hmacKey = (secret) => crypto.subtle.importKey('raw', unb64u(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
export async function makeSession(sub, secret, now = Date.now()) {
  const body = `v1.${sub}.${Math.floor(now / 1000)}`;
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
}
export async function readSession(tok, secret, now = Date.now()) {
  const m = /^v1\.(\d{1,40})\.(\d{1,12})\.([\w-]{20,})$/.exec(String(tok || ''));
  if (!m) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(m[3]), enc.encode(`v1.${m[1]}.${m[2]}`));
  const iat = +m[2];
  if (!ok || iat * 1000 > now + 60e3 || now - iat * 1000 > 400 * 864e5) return null;
  return { sub: m[1], iat };
}

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

    if (path === '/login') { // profil mis à jour à chaque connexion
      const isNew = !meta.created;
      Object.assign(meta, { email: b.email, name: b.name, picture: b.picture, created: meta.created || Date.now(), seen: Date.now() });
      await st.put('meta', meta);
      return Response.json({ ok: true, isNew });
    }
    if (!(b.iat >= (meta.minIat || 0))) return Response.json({ error: 'session révoquée' }, { status: 401 });
    const user = { name: meta.name || '', email: meta.email || '', picture: meta.picture || '' };

    if (path === '/get') {
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
      await st.put('meta', { rev: 0, at: 0, n: 0, minIat: Math.floor(Date.now() / 1000) + 1 });
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }
}
