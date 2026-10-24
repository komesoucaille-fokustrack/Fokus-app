import { LABO } from '../env';

/* Importé en tout premier (main.jsx) : dans le labo, toutes les clés du stockage local sont préfixées
   → les essais ne touchent jamais aux vraies données de l'app (même domaine, même navigateur). */
if (LABO) {
  const P = 'labo:', proto = Storage.prototype;
  for (const m of ['getItem', 'setItem', 'removeItem']) {
    const orig = proto[m];
    proto[m] = function (k, ...a) { return orig.call(this, P + k, ...a); };
  }
  document.title = 'Fokus Labo 🧪';
}
