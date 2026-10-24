import { useSyncExternalStore } from 'react';
import { calFetch, cloudEnabled, sessionToken } from './cloud';
import { getState } from '../store';
import { K, addDays } from './dates';

/* =====================================================================
   AGENDAS EXTERNES (Google Agenda, iCloud, Outlook… : lien « iCal » / « .ics ») affichés dans Fokus
   - liste dans set.cals = [{ id, name, url, color, on }] (synchronisée avec le compte) ;
   - le serveur lit l'agenda (les agendas n'autorisent pas la lecture directe depuis une page web) ;
   - lecture iCal ici : événements simples et récurrents (RRULE quotidienne / hebdo / mensuelle / annuelle, INTERVAL,
     COUNT, UNTIL, BYDAY, EXDATE, occurrences modifiées), fuseaux (TZID), journées entières ;
   - événements d'hier à J+30 gardés sur l'appareil (localStorage « fokus_cal »), relus toutes les 15 minutes.
   ===================================================================== */
const LS = 'fokus_cal', TTL = 15 * 60e3;
let cache = {};
try { cache = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { cache = {}; }
const subs = new Set();
let snap = { cache, loading: false };
const emit = () => { snap = { ...snap, cache }; subs.forEach((f) => f()); };
const save = () => { cache = { ...cache }; /* nouvelle référence : les écrans se recalculent */ try { localStorage.setItem(LS, JSON.stringify(cache)); } catch { /* plein */ } emit(); };
export const useCalendars = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap);
export const CAL_COLORS = ['#93c5fd', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd', '#5eead4', '#fde68a', '#fca5a5'];

/* ---------- lecture iCal ---------- */
const unesc = (t) => t.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
function props(block) {
  const out = [];
  for (const line of block) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const p = {};
    params.forEach((x) => { const [k, v] = x.split('='); if (k) p[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); });
    out.push({ name: name.toUpperCase(), p, v: line.slice(i + 1) });
  }
  return out;
}
/* décalage (ms) du fuseau tz à l'instant t ; null si le fuseau est inconnu (noms Windows d'Outlook…) */
function tzOffset(t, tz) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const q = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour % 24, +q.minute, +q.second) - t;
  } catch { return null; }
}
/* « 20261024T140000Z », « 20261024T140000 » (+ TZID), « 20261024 » → { t (ms), allDay } */
function parseDate(v, p) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se, z] = m;
  if (!h || p.VALUE === 'DATE') return { t: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
  if (z) return { t: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(se || 0)), allDay: false };
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(se || 0));
  if (p.TZID) {
    const o1 = tzOffset(wall, p.TZID);
    if (o1 != null) { const o2 = tzOffset(wall - o1, p.TZID); return { t: wall - (o2 ?? o1), allDay: false }; }
  }
  return { t: new Date(+y, +mo - 1, +d, +h, +mi, +(se || 0)).getTime(), allDay: false }; // heure « flottante » = heure locale
}
const DUR = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
const durMs = (v) => { const m = DUR.exec(v || ''); return m ? ((+m[2] || 0) * 7 * 864e5 + (+m[3] || 0) * 864e5 + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3) : 0; };
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/* Occurrences d'une règle RRULE entre from et to (ms), à partir de l'heure murale locale de start */
function expand(start, rule, from, to, exdates) {
  const r = Object.fromEntries(rule.split(';').map((x) => x.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
  const freq = r.FREQ, every = Math.max(1, +r.INTERVAL || 1), count = +r.COUNT || 0;
  const until = r.UNTIL ? parseDate(r.UNTIL, {})?.t ?? Infinity : Infinity;
  const byday = (r.BYDAY || '').split(',').map((x) => x.replace(/^[+-]?\d+/, '')).filter((x) => DAYS.includes(x)).map((x) => DAYS.indexOf(x));
  const s = new Date(start), out = [];
  let n = 0;
  const push = (d) => {
    const t = d.getTime();
    if (t < start || t > until) return t > until;
    n++;
    if (t >= from && t <= to && !exdates.has(t)) out.push(t);
    return count && n >= count;
  };
  const at = (base, addD) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + addD, s.getHours(), s.getMinutes(), s.getSeconds());
  // sans COUNT, on saute directement près de la fenêtre (règle quotidienne commencée il y a des années…)
  const span = { DAILY: 864e5, WEEKLY: 7 * 864e5, MONTHLY: 28 * 864e5, YEARLY: 365 * 864e5 }[freq] * every;
  const i0 = !count && span && from > start ? Math.max(0, Math.floor((from - start) / span) - 2) : 0;
  for (let i = i0; i < i0 + 3000; i++) {
    let stop = false;
    if (freq === 'DAILY') stop = push(at(s, i * every));
    else if (freq === 'WEEKLY') {
      const wk = at(s, i * 7 * every - s.getDay()); // dimanche de la semaine
      for (const d of (byday.length ? byday : [s.getDay()]).sort()) { if ((stop = push(at(wk, d)))) break; }
    } else if (freq === 'MONTHLY') stop = push(new Date(s.getFullYear(), s.getMonth() + i * every, s.getDate(), s.getHours(), s.getMinutes()));
    else if (freq === 'YEARLY') stop = push(new Date(s.getFullYear() + i * every, s.getMonth(), s.getDate(), s.getHours(), s.getMinutes()));
    else { push(s); break; }
    if (stop) break;
    if (start + i * span > to + 864e5 * 31) break;
  }
  return out;
}

/* Texte iCal → événements { id, title, start, end, allDay } dans la fenêtre [from, to] */
export function parseIcs(text, from, to) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const evs = [];
  let cur = null;
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = [];
    else if (l === 'END:VEVENT') { if (cur) evs.push(props(cur)); cur = null; } else if (cur) cur.push(l);
  }
  const out = [], moved = new Map(); // occurrences modifiées (RECURRENCE-ID) : remplacent l'occurrence d'origine
  const parsed = evs.map((ps) => {
    const g = (k) => ps.find((x) => x.name === k), all = (k) => ps.filter((x) => x.name === k);
    const ds = g('DTSTART') && parseDate(g('DTSTART').v, g('DTSTART').p);
    if (!ds || (g('STATUS')?.v || '').toUpperCase() === 'CANCELLED') return null;
    const de = g('DTEND') && parseDate(g('DTEND').v, g('DTEND').p);
    const len = de ? Math.max(0, de.t - ds.t) : g('DURATION') ? durMs(g('DURATION').v) : ds.allDay ? 864e5 : 0;
    const uid = g('UID')?.v || Math.random().toString(36).slice(2);
    const rid = g('RECURRENCE-ID') && parseDate(g('RECURRENCE-ID').v, g('RECURRENCE-ID').p);
    if (rid) moved.set(uid, [...(moved.get(uid) || []), rid.t]);
    const ex = new Set(all('EXDATE').flatMap((x) => x.v.split(',').map((v) => parseDate(v, x.p)?.t).filter(Boolean)));
    return { uid, title: unesc(g('SUMMARY')?.v || '(sans titre)').slice(0, 120), ds, len, rule: !rid && g('RRULE')?.v, ex, rid };
  }).filter(Boolean);
  for (const e of parsed) {
    (moved.get(e.uid) || []).forEach((t) => { if (!e.rid) e.ex.add(t); });
    const starts = e.rule ? expand(e.ds.t, e.rule, from - e.len, to, e.ex) : (e.ds.t + e.len >= from && e.ds.t <= to ? [e.ds.t] : []);
    for (const t of starts.slice(0, 400)) out.push({ id: e.uid + '@' + t, title: e.title, start: t, end: t + e.len, allDay: e.ds.allDay });
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ---------- lecture des agendas (via le serveur) ---------- */
const range = () => { const k = K(new Date()); return [new Date(addDays(k, -1) + 'T00:00').getTime(), new Date(addDays(k, 31) + 'T00:00').getTime()]; };
export async function refreshCal(cal, force = false) {
  const c = cache[cal.id];
  if (!force && c && c.url === cal.url && Date.now() - c.at < TTL && !c.err) return;
  try {
    const [from, to] = range();
    const events = parseIcs(await calFetch(cal.url), from, to);
    cache[cal.id] = { at: Date.now(), url: cal.url, events: events.slice(0, 1500), err: '' };
  } catch (e) {
    cache[cal.id] = { ...(c || { events: [] }), at: Date.now(), url: cal.url, err: e.message };
  }
  save();
}
export async function refreshAll(force = false) {
  const cals = (getState().set.cals || []).filter((c) => c.on !== false);
  if (!cals.length || !cloudEnabled() || !sessionToken()) return;
  snap = { ...snap, loading: true }; emit();
  await Promise.all(cals.map((c) => refreshCal(c, force)));
  snap = { ...snap, loading: false }; emit();
}
export function forgetCal(id) { delete cache[id]; save(); }

/* Événements d'un jour (heure locale), agendas actifs seulement, avec la couleur de leur agenda */
export function eventsOn(k, cals = getState().set.cals || [], c = cache) {
  const a = new Date(k + 'T00:00').getTime(), b = a + 864e5;
  return cals.filter((x) => x.on !== false).flatMap((cal) => (c[cal.id]?.events || [])
    .filter((e) => e.start < b && (e.end > a || e.start >= a))
    .map((e) => ({ ...e, cal: cal.name, color: cal.color })));
}

/* Relecture automatique : à l'ouverture, au retour sur l'app et toutes les 15 minutes */
let started = false;
export function startCalendars() {
  if (started) return;
  started = true;
  setTimeout(() => refreshAll(), 2500);
  setInterval(() => !document.hidden && refreshAll(), TTL);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
}
