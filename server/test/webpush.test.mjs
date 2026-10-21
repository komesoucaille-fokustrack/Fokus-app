/* Vérifie le chiffrement aes128gcm et la signature VAPID contre les bibliothèques de référence (http_ece, jsonwebtoken-like) */
import crypto from 'node:crypto';
import ece from 'http_ece';
import { encrypt, generateVapid, vapidAuth, b64u } from '../src/webpush.js';

const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = crypto.randomBytes(16);
const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: b64u.enc(ua.getPublicKey()), auth: b64u.enc(auth) } };
const msg = JSON.stringify({ title: 'Fokus', body: 'Pause bien méritée ☕' });
const body = await encrypt(sub, msg);
const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
console.log('déchiffré :', plain.toString() === msg ? 'OK' : 'ÉCHEC ' + plain.toString());

const v = await generateVapid();
const h = await vapidAuth(sub.endpoint, v, 'mailto:a@b.c');
const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
const [hd, cl, sig] = jwt.split('.');
const pub = await crypto.webcrypto.subtle.importKey('raw', b64u.dec(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const ok = await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.dec(sig), new TextEncoder().encode(hd + '.' + cl));
console.log('signature VAPID :', ok ? 'OK' : 'ÉCHEC', JSON.parse(Buffer.from(cl, 'base64url')).aud);
