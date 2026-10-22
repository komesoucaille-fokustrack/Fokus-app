import { JOURS, K, addDays, parseK } from './dates';

/* =====================================================================
   SAISIE RAPIDE INTELLIGENTE
   « demain », « aujourd'hui », « lundi »… « dimanche », « 25/10 » → date
   « @sport » → catégorie (si elle existe) · « #sport » → étiquette · « ! », « !! », « !!! » → points 1, 2, 3 · « * » → priorité
   « ~45 », « ~1h30 », « ~2h » → temps estimé (« ~2 » = 2 h, « ~20 » = 20 min) · « 14h30 », « 14:30 », « à 9h » → heure de début
   Les mots reconnus sont surlignés pendant la frappe et retirés du titre.
   Un tap sur un mot surligné annule sa détection (il redevient du texte normal).
   Garde-fous : « le monde de demain » garde « demain », « 1/2 pizza » n'est pas une date.
   ===================================================================== */
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// mots qui font d'un jour un nom commun (« le monde de demain », « mes lundis »…)
const BLOCK = new Set(['de', 'du', 'des', "d'", 'le', 'la', 'les', "l'", 'un', 'une', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur', 'au', 'aux']);

function dateOf(word, today, prev) {
  const w = strip(word).replace(/[’']/g, "'").replace(/[.,;:!?]+$/, '');
  const p = prev && strip(prev).replace(/[’']/g, "'");
  const named = w === 'demain' || w === "aujourd'hui" || w === 'auj' || w === 'apres-demain' || JOURS.includes(w);
  if (named && p && (BLOCK.has(p) || /^(d|l)'$/.test(p))) return null;
  if (w === 'demain') return addDays(today, 1);
  if (w === "aujourd'hui" || w === 'auj') return today;
  if (w === 'apres-demain') return addDays(today, 2);
  const j = JOURS.indexOf(w);
  if (j >= 0) {
    const d = parseK(today), diff = (j - d.getDay() + 7) % 7;
    return addDays(today, diff); // le jour même s'il s'agit d'aujourd'hui, sinon le prochain
  }
  const m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (m) {
    const dd = +m[1], mm = +m[2];
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
    if (!m[3] && mm <= 4 && dd < mm) return null; // fractions évidentes : 1/2, 1/3, 2/3, 3/4…
    const t = parseK(today);
    let y = m[3] ? +m[3] : t.getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, mm - 1, dd);
    if (d.getMonth() !== mm - 1) return null; // date impossible (ex. 31/02)
    if (!m[3] && K(d) < today) d.setFullYear(y + 1); // « 25/10 » déjà passé → l'an prochain
    return K(d);
  }
  return null;
}

/* Temps estimé en minutes : « ~45 », « ~45min », « ~1h », « ~1h30 », « ~2 » (≤ 9 sans unité = heures) */
export function estOf(word) {
  const w = word.toLowerCase().replace(/[.,;!?]+$/, '');
  let m = w.match(/^~(\d{1,2})h([0-5]\d)?$/);
  if (m) return +m[1] * 60 + (+m[2] || 0) || null;
  m = w.match(/^~(\d{1,3})(m|mn|min)?$/);
  if (!m) return null;
  const n = +m[1];
  if (!n) return null;
  return !m[2] && n <= 9 ? n * 60 : n <= 1440 ? n : null;
}

/* « 14h30 », « 14:30 » ; « 9h » seulement après « à » (sinon c'est souvent une durée : « courir 1h ») */
function timeOf(word, prev) {
  const w = word.toLowerCase().replace(/[.,;!?]+$/, '');
  let m = w.match(/^([01]?\d|2[0-3])[h:]([0-5]\d)$/);
  if (m) return String(+m[1]).padStart(2, '0') + ':' + m[2];
  m = w.match(/^([01]?\d|2[0-3])h$/);
  if (m && prev && strip(prev) === 'a') return String(+m[1]).padStart(2, '0') + ':00';
  return null;
}

/**
 * @param {Set<string>} ignore clés de mots à ne pas interpréter (voir `tokenKey`)
 * @param {(word: string) => string | null} catOf « @mot » → id de catégorie (ou null : le mot reste du texte)
 * @returns {{ title, date, tags: string[], weight, prio, est, time, tokens: {start,end,kind,key}[] }}
 *   kind : 'date' | 'tag' | 'cat' | 'weight' | 'prio' | 'est' | 'time' | 'off' (détection annulée)
 */
export function parseQuick(text, today, ignore = new Set(), catOf = () => null) {
  const out = { title: '', date: undefined, tags: [], weight: undefined, prio: false, est: undefined, time: undefined, cat: undefined, tokens: [] };
  const raw = [...text.matchAll(/\S+/g)];
  const seen = {};
  const words = [];
  raw.forEach((m, i) => {
    const w = m[0], start = m.index, end = start + w.length, prev = i ? raw[i - 1][0] : null;
    seen[w] = (seen[w] || 0) + 1;
    const key = w + '#' + seen[w];
    let kind = null, d, t, e, c;
    if ((d = dateOf(w, today, prev))) kind = 'date';
    else if (/^#[\p{L}\p{N}_-]+$/u.test(w)) kind = 'tag';
    else if (/^@[\p{L}\p{N}_-]+$/u.test(w) && (c = catOf(w.slice(1)))) kind = 'cat';
    else if (/^!{1,3}$/.test(w)) kind = 'weight';
    else if (w === '*') kind = 'prio';
    else if ((e = estOf(w))) kind = 'est';
    else if ((t = timeOf(w, prev))) kind = 'time';
    if (kind && ignore.has(key)) { out.tokens.push({ start, end, kind: 'off', key }); words.push(w); return; }
    if (!kind) { words.push(w); return; }
    out.tokens.push({ start, end, kind, key });
    if (kind === 'date') out.date = d;
    else if (kind === 'tag') out.tags.push(w.slice(1));
    else if (kind === 'cat') out.cat = c;
    else if (kind === 'weight') out.weight = w.length;
    else if (kind === 'prio') out.prio = true;
    else if (kind === 'est') out.est = e;
    else if (kind === 'time') {
      out.time = t;
      // « à 14h30 » : le « à » disparaît aussi du titre
      if (prev && strip(prev) === 'a' && words.length && strip(words[words.length - 1]) === 'a') words.pop();
    }
  });
  out.title = words.join(' ').trim();
  return out;
}
