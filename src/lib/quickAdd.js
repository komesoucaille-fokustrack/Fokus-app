import { JOURS, K, addDays, parseK } from './dates';

/* =====================================================================
   SAISIE RAPIDE INTELLIGENTE
   « demain », « aujourd'hui », « lundi »… « dimanche », « 25/10 » → date
   « #sport » → étiquette · « ! », « !! », « !!! » → poids 1, 2, 3 · « * » → priorité
   Les mots reconnus sont retirés du titre et surlignés pendant la frappe.
   ===================================================================== */
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function dateOf(word, today) {
  const w = strip(word).replace(/[’']/g, "'");
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
    const t = parseK(today);
    let y = m[3] ? +m[3] : t.getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (d.getMonth() !== +m[2] - 1) return null; // date invalide (ex. 31/02)
    if (!m[3] && K(d) < today) d.setFullYear(y + 1); // « 25/10 » déjà passé → l'an prochain
    return K(d);
  }
  return null;
}

/**
 * @returns {{ title, date, tags: string[], weight, prio, tokens: {start,end,kind}[] }}
 */
export function parseQuick(text, today) {
  const out = { title: '', date: undefined, tags: [], weight: undefined, prio: false, tokens: [] };
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) {
    const w = m[0], start = m.index, end = start + w.length;
    let kind = null;
    const d = dateOf(w, today);
    if (d) { out.date = d; kind = 'date'; }
    else if (/^#[\p{L}\p{N}_-]+$/u.test(w)) { out.tags.push(w.slice(1)); kind = 'tag'; }
    else if (/^!{1,3}$/.test(w)) { out.weight = w.length; kind = 'weight'; }
    else if (w === '*') { out.prio = true; kind = 'prio'; }
    if (kind) out.tokens.push({ start, end, kind });
    else words.push(w);
  }
  out.title = words.join(' ').trim();
  return out;
}
