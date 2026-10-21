import { useSyncExternalStore } from 'react';
import { K, addDays, daysBetween, mondayOf, parseK } from './lib/dates';
import { clamp } from './lib/colors';
import { scheduleBackup } from './lib/backup';
import { buzz } from './lib/notify';

/* =====================================================================
   MODÈLE DE DONNÉES (version 3) — clé localStorage « focus_state »
   Tâche      { id, text, done, date: 'YYYY-MM-DD' | null (= Plus tard), weight: 1|2|3, prio, tags: [tagId],
                subs: [{ id, text, done }], carried (nombre de reports), focus (minutes), rid? (récurrence d'origine),
                est (estimation en pomodoros, 0 = aucune), time ('HH:MM' | null, heure de début), dur (minutes | null, durée ajustée) }
   Journal    sessions = [[début (s), durée (s), tâche | null, 'c' (classique) | 'f' (libre)]] — purgé au-delà de 2 ans
   Idées      ideas = [{ id, text, at }] — bloc-notes de distractions du minuteur
   Récurrence { id, text, rule: { type: 'daily' | 'weekdays' (days: [0-6]) | 'interval' (every) | 'monthday' (day) },
                start, weight, tags, prio, last (dernier jour généré → jamais de doublon) }
   Historique hist['YYYY-MM-DD'] = { p, d, t, pd, pt, pr, prt, fm, tg: { tagId: n }, jk? }
              p = %, d/t = tâches faites/totales, pd/pt = points, pr/prt = priorités, fm = minutes de concentration,
              tg = tâches validées par étiquette, jk = joker utilisé ce jour-là
   Réglages   set = DEF_SET
   ===================================================================== */
export const VERSION = 3;
const KEY = 'focus_state';
export const PASTELS = ['#fca5a5', '#fdba74', '#fde68a', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4', '#5eead4'];
export const DEF_SET = {
  threshold: 80, jokers: 2, defWeight: 1, scoreMode: 'pct',
  pomo: 25, pause: 5, longPause: 15, cycle: 4, autoBreak: true, autoWork: false, sound: true, clock: 'classic', bg: 'noir',
  amb: 'p12', ambLevel: 2,
  remind: false, remindAt: '20:00', pomoNotif: false, push: false,
  showStreak: true, showBadges: true, morning: true,
  order: 'manual', pomoMode: 'classic', flowRatio: 5, ambient: 'none', ambVol: 0.5, ambMute: true,
  defDur: 30, capacity: 360, evening: true, eveningAt: '21:00',
};
const base = () => ({
  version: VERSION, tasks: [], rec: [], hist: {}, tags: [], last: '', off: 0, anim: true, confetti: true,
  set: { ...DEF_SET }, badges: {}, doneTotal: 0, fmDay: { d: '', m: 0 }, lastExport: '', since: '', seen: {}, pomo: null, pomoDay: { d: '', n: 0 },
  sessions: [], ideas: [], pushId: '',
});

export const uid = () => Math.random().toString(36).slice(2, 9);
const arr = (x) => (Array.isArray(x) ? x : []);
const W = (w) => ([1, 2, 3].includes(+w) ? +w : 1);
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const r1 = (x) => Math.round(x * 10) / 10;
export const isHM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
/* Journal des sessions : on garde 2 ans (stockage léger) */
const purgeSessions = (a) => { const lim = Date.now() / 1000 - 2 * 366 * 864e2; return a.filter((x) => x[0] >= lim).slice(-20000); };

function normRule(r) {
  if (!r || typeof r !== 'object') return { type: 'daily' };
  if (r.type === 'weekdays') {
    const days = [...new Set(arr(r.days).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
    return days.length ? { type: 'weekdays', days } : { type: 'daily' };
  }
  if (r.type === 'interval') return { type: 'interval', every: clamp(Math.round(+r.every) || 2, 1, 365) };
  if (r.type === 'monthday') return { type: 'monthday', day: clamp(Math.round(+r.day) || 1, 1, 31) };
  return { type: 'daily' };
}

/* Complète une sauvegarde (v1 de l'ancien index.html, ou v2) avec les nouveaux champs, sans rien perdre */
export function migrate(raw) {
  const o = raw && typeof raw === 'object' ? { ...raw } : {};
  delete o.app;
  const off = Number.isFinite(+o.off) ? +o.off : 0;
  const today = K(new Date(Date.now() + off * 864e5));
  const last = isKey(o.last) ? o.last : '';
  const tasks = arr(o.tasks).filter((t) => t && typeof t === 'object').map((t) => ({
    ...t,
    id: String(t.id || uid()),
    text: String(t.text ?? ''),
    done: !!t.done,
    date: t.date === null ? null : isKey(t.date) ? t.date : last || today,
    weight: W(t.weight),
    prio: !!t.prio,
    tags: arr(t.tags).map(String),
    subs: arr(t.subs).filter((x) => x && typeof x === 'object').map((x) => ({ id: String(x.id || uid()), text: String(x.text ?? ''), done: !!x.done })),
    carried: Math.max(0, Math.round(+t.carried) || 0),
    focus: Math.max(0, +t.focus || 0),
    est: clamp(Math.round(+t.est) || 0, 0, 40),
    time: isHM(t.time) ? t.time : null,
    dur: Number.isFinite(+t.dur) && +t.dur >= 5 ? Math.round(+t.dur) : null,
  }));
  const rec = arr(o.rec).filter((r) => r && typeof r === 'object').map((r) => {
    const id = String(r.id || uid());
    return {
      ...r, id,
      text: String(r.text ?? ''),
      rule: normRule(r.rule),
      start: isKey(r.start) ? r.start : last || today,
      weight: W(r.weight),
      tags: arr(r.tags).map(String),
      prio: !!r.prio,
      est: clamp(Math.round(+r.est) || 0, 0, 40),
      // ancienne récurrence déjà présente aujourd'hui → considérée comme générée (pas de doublon)
      last: isKey(r.last) ? r.last : tasks.some((t) => t.rid === id) ? last : '',
    };
  });
  const hist = {};
  const h0 = o.hist && typeof o.hist === 'object' ? o.hist : {};
  for (const k of Object.keys(h0)) {
    const h = h0[k];
    if (!isKey(k) || !h || typeof h !== 'object') continue;
    const t = Math.max(0, Math.round(+h.t) || 0), d = Math.max(0, Math.round(+h.d) || 0);
    hist[k] = {
      ...h, p: clamp(Math.round(+h.p) || 0, 0, 100), d, t,
      pd: Number.isFinite(+h.pd) ? +h.pd : d, pt: Number.isFinite(+h.pt) ? +h.pt : t,
      pr: Math.max(0, +h.pr || 0), prt: Math.max(0, +h.prt || 0), fm: Math.max(0, +h.fm || 0),
      tg: h.tg && typeof h.tg === 'object' ? h.tg : {},
    };
  }
  const keys = Object.keys(hist).sort();
  return {
    ...base(), ...o,
    version: VERSION, tasks, rec, hist, last, off,
    tags: arr(o.tags).filter((x) => x && x.id).map((x, i) => ({ id: String(x.id), name: String(x.name ?? 'Étiquette'), color: x.color || PASTELS[i % PASTELS.length] })),
    anim: o.anim !== false,
    confetti: o.confetti !== false,
    set: { ...DEF_SET, ...(o.set && typeof o.set === 'object' ? o.set : {}) },
    badges: o.badges && typeof o.badges === 'object' ? o.badges : {},
    doneTotal: Number.isFinite(o.doneTotal) ? o.doneTotal : keys.reduce((s, k) => s + hist[k].d, 0) + tasks.filter((t) => t.done).length,
    fmDay: o.fmDay && typeof o.fmDay.d === 'string' ? { d: o.fmDay.d, m: Math.max(0, +o.fmDay.m || 0) } : { d: '', m: 0 },
    lastExport: isKey(o.lastExport) ? o.lastExport : '',
    since: isKey(o.since) ? o.since : keys[0] || last || today,
    seen: o.seen && typeof o.seen === 'object' ? o.seen : {},
    pomo: o.pomo && typeof o.pomo === 'object' && Number.isFinite(o.pomo.start)
      ? { tid: o.pomo.tid || null, phase: ['work', 'short', 'long'].includes(o.pomo.phase) ? o.pomo.phase : 'short', start: o.pomo.start, dur: +o.pomo.dur || 1500,
          paused: o.pomo.paused ?? null, done: o.pomo.done | 0, cr: +o.pomo.cr || 0 }
      : null,
    pomoDay: o.pomoDay && typeof o.pomoDay.d === 'string' ? { d: o.pomoDay.d, n: o.pomoDay.n | 0 } : { d: '', n: 0 },
    sessions: purgeSessions(arr(o.sessions).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]))
      .map((x) => [Math.round(x[0]), Math.round(x[1]), x[2] ? String(x[2]) : null, x[3] === 'f' ? 'f' : 'c'])),
    ideas: arr(o.ideas).filter((x) => x && x.text).map((x) => ({ id: String(x.id || uid()), text: String(x.text), at: +x.at || Date.now() })),
    pushId: typeof o.pushId === 'string' ? o.pushId : '',
  };
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
  if (!raw) return migrate({});
  try { return migrate(JSON.parse(raw)); } catch {
    try { localStorage.setItem(KEY + '_illisible', raw); } catch { /* rien */ }
    return migrate({});
  }
}

let S = load();
/* État d'interface (non persisté) */
let UI = { sel: new Set(), busy: false, page: 1, toast: null, open: null, tag: null, modal: null, flash: null, newBadge: null, update: false };

const listeners = new Set();
let snapshot = { S, UI };
const emit = () => { snapshot = { S, UI }; listeners.forEach((l) => l()); };
const save = () => {
  const json = JSON.stringify(S);
  try { localStorage.setItem(KEY, json); } catch { /* stockage indisponible */ }
  scheduleBackup(json);
};
save(); // enregistre tout de suite la version migrée (+ copie de secours)

function set(patch) { S = { ...S, ...patch }; save(); emit(); }
function setUI(patch) { UI = { ...UI, ...patch }; emit(); }

export const getState = () => S;
export const getUI = () => UI;
export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot);
}

export const now = () => new Date(Date.now() + S.off * 864e5);
export const todayKey = () => K(now());

/* ---------- Calculs ---------- */
export const isToday = (t, k = todayKey()) => !!t.date && t.date <= k;
export const todayTasks = (tasks = S.tasks, k = todayKey()) => tasks.filter((t) => isToday(t, k));
/* Score du jour par points : points faits / points totaux (tâches du jour uniquement) */
export function stats(tasks = S.tasks, k = todayKey()) {
  let n = 0, c = 0, pt = 0, pd = 0, prt = 0, pr = 0;
  for (const t of tasks) {
    if (!isToday(t, k)) continue;
    n++; pt += t.weight;
    if (t.done) { c++; pd += t.weight; }
    if (t.prio) { prt++; if (t.done) pr++; }
  }
  return { n, c, pt, pd, prt, pr, p: pt ? Math.round((pd / pt) * 100) : 0 };
}
/* Gain (en points de %) si la sélection était validée */
export function gainOf(sel = UI.sel) {
  const s = stats();
  if (!s.pt) return 0;
  let add = 0;
  for (const t of S.tasks) if (sel.has(t.id) && !t.done && isToday(t)) add += t.weight;
  return Math.round(((s.pd + add) / s.pt) * 100) - s.p;
}
/* Ordre d'affichage du jour : priorités en tête, puis l'ordre choisi (ordre du tableau, toujours respecté) */
/* Ordre d'affichage : priorités (or) en tête, puis 3 pts > 2 pts > 1 pt ; à égalité, l'ordre choisi (tri stable) */
/* Ordre « Manuel » (défaut) : seul l'ordre choisi compte. « Automatique » : priorités puis 3 > 2 > 1 pt (tri stable). */
export const sortTasks = (a, St = S) => (St.set.order === 'auto' ? [...a].sort((x, y) => (y.prio - x.prio) || (y.weight - x.weight)) : a);

/* Jour réussi : true / false / null (neutre : aucune tâche, ou joker utilisé) */
export const dayOk = (h, th) => (!h || !h.t || h.jk ? null : h.p >= th);

let memo = { S: null, v: null };
/* Séries quotidienne et hebdomadaire (calculées à partir de l'historique + aujourd'hui) */
export function streaks(St = S) {
  if (memo.S === St) return memo.v;
  const th = St.set.threshold, tk = K(new Date(Date.now() + St.off * 864e5));
  const keys = Object.keys(St.hist).filter((k) => k < tk).sort();
  let run = 0, best = 0;
  const wk = {};
  for (const k of keys) {
    const h = St.hist[k], ok = dayOk(h, th);
    if (ok || h.jk) wk[mondayOf(k)] = (wk[mondayOf(k)] || 0) + 1;
    if (ok === null) continue;
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const s = stats(St.tasks, tk), todayOk = s.n > 0 && s.p >= th;
  if (todayOk) wk[mondayOf(tk)] = (wk[mondayOf(tk)] || 0) + 1;
  const cur = run + (todayOk ? 1 : 0);
  best = Math.max(best, cur);
  const wOk = (m) => (wk[m] || 0) >= 5;
  let m = mondayOf(tk), wcur = wOk(m) ? 1 : 0;
  for (m = addDays(m, -7); wOk(m); m = addDays(m, -7)) wcur++;
  let wbest = 0, wrun = 0;
  if (keys.length) {
    for (let x = mondayOf(keys[0]); x <= mondayOf(tk); x = addDays(x, 7)) {
      wrun = wOk(x) ? wrun + 1 : x === mondayOf(tk) ? wrun : 0;
      wbest = Math.max(wbest, wrun);
    }
  }
  wbest = Math.max(wbest, wcur);
  const weeksOk = Object.keys(wk).filter(wOk).length;
  const v = { cur, best, run, todayOk, wcur, wbest, weeksOk };
  memo = { S: St, v };
  return v;
}

const jokersUsed = (hist, ym) => Object.keys(hist).filter((k) => k.startsWith(ym) && hist[k].jk).length;
/* Jokers : un jour raté ne casse pas la série tant qu'il reste des jokers ce mois-ci */
function applyJokers(hist, keys, set) {
  if (!keys.length) return 0;
  let run = 0, used = 0;
  for (const k of Object.keys(hist).sort()) {
    if (k >= keys[0]) break;
    const ok = dayOk(hist[k], set.threshold);
    if (ok !== null) run = ok ? run + 1 : 0;
  }
  for (const k of keys) {
    const ok = dayOk(hist[k], set.threshold);
    if (ok === null) continue;
    if (!ok && run > 0 && jokersUsed(hist, k.slice(0, 7)) < set.jokers) { hist[k] = { ...hist[k], jk: true }; used++; continue; }
    run = ok ? run + 1 : 0;
  }
  return used;
}
export const jokersLeft = (St = S) => Math.max(0, St.set.jokers - jokersUsed(St.hist, K(new Date(Date.now() + St.off * 864e5)).slice(0, 7)));

/* Minutes de concentration d'aujourd'hui */
export const focusToday = (St = S) => (St.fmDay.d === K(new Date(Date.now() + St.off * 864e5)) ? St.fmDay.m : 0);
export const focusTotal = (St = S) => Object.values(St.hist).reduce((s, h) => s + (h.fm || 0), 0) + focusToday(St);

/* Textes de la carte « Aujourd'hui » (partagés avec la face 3D de l'animation) */
const plural = (n, w) => w + (n > 1 ? 's' : '');
export function cardText(St = S) {
  const s = stats(St.tasks), parts = ['Aujourd’hui'];
  if (s.prt) parts.push((typeof innerWidth !== 'undefined' && innerWidth < 480 ? '★ ' : 'Priorités : ') + `${s.pr}/${s.prt}`);
  if (St.set.showStreak) {
    const z = streaks(St);
    if (z.cur || z.best) parts.push(`🔥 ${z.cur} j` + (z.best > z.cur ? ` (record ${z.best})` : '') + (z.wcur ? ` · ${z.wcur} sem.` : ''));
  }
  const tasks = `${s.c} / ${s.n} ${plural(s.n, 'tâche')} ${plural(s.c, 'terminée')}`;
  return {
    label: parts.join('  ·  '),
    sub: !s.n ? 'Aucune tâche aujourd’hui' : St.set.scoreMode === 'pts' ? `sur ${s.pt} pts · ${tasks}` : tasks,
  };
}
/* Affichage du score : pourcentage, ou points (convertis depuis le % pour le compteur animé) */
export const scoreFmt = (St = S) => {
  if (St.set.scoreMode !== 'pts') return (v) => Math.round(v) + '%';
  const pt = stats(St.tasks).pt;
  return (v) => { const n = Math.round((v / 100) * pt); return n + (n > 1 ? ' pts' : ' pt'); };
};
export function selPoints(sel = UI.sel) {
  let n = 0;
  for (const t of S.tasks) if (sel.has(t.id) && !t.done && isToday(t)) n += t.weight;
  return n;
}

/* ---------- Notifications (toasts) : file d'attente, avec action « Annuler » ---------- */
let tq = [], tTimer;
function nextToast() {
  clearTimeout(tTimer);
  const t = tq.shift() || null;
  setUI({ toast: t });
  if (t) tTimer = setTimeout(nextToast, t.ms);
}
export function toast(msg, action, ms) {
  const t = { id: uid(), msg, action, ms: ms || (action ? 6000 : 3200) };
  if (action) { tq = tq.filter((x) => !x.action); tq.unshift(t); } else tq.push(t);
  if (UI.busy) return; // affichée après l'animation
  if (action || !UI.toast) nextToast();
}
export function toastAction() { const t = UI.toast; nextToast(); t?.action?.fn(); }
export const dismissToast = () => nextToast();

/* ---------- Interface ---------- */
export function setBusy(busy) {
  setUI({ busy });
  if (!busy && !UI.toast && tq.length) nextToast();
}
export const setPage = (page) => { if (!UI.busy) setUI({ page, open: null }); };
export const setModal = (modal) => setUI({ modal });
export const setOpen = (id) => setUI({ open: UI.open === id ? null : id });
export const setTagFilter = (tag) => setUI({ tag: UI.tag === tag ? null : tag });
export const setUpdate = (update) => setUI({ update });
export const clearFlash = () => setUI({ flash: null });
export const clearNewBadge = () => setUI({ newBadge: null });
/* Aller à une tâche (recherche) : bonne page, panneau ouvert, surlignée */
export function goToTask(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  setUI({ page: isToday(t) ? 1 : 3, open: id, flash: id, modal: null, tag: null });
}

/* ---------- Étiquettes ---------- */
const norm = (s) => s.trim().toLowerCase();
function resolveTags(names, tags) {
  const list = [...tags];
  const ids = names.map((n) => {
    let t = list.find((x) => norm(x.name) === norm(n));
    if (!t) { t = { id: uid(), name: n.trim(), color: PASTELS[list.length % PASTELS.length] }; list.push(t); }
    return t.id;
  });
  return { ids: [...new Set(ids)], tags: list };
}
export function addTag(name) {
  const n = name.trim();
  if (!n) return null;
  const r = resolveTags([n], S.tags);
  set({ tags: r.tags });
  return r.ids[0];
}
export const renameTag = (id, name) => name.trim() && set({ tags: S.tags.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)) });
export const recolorTag = (id, color) => set({ tags: S.tags.map((t) => (t.id === id ? { ...t, color } : t)) });
export function deleteTag(id) {
  const strip = (x) => ({ ...x, tags: x.tags.filter((g) => g !== id) });
  if (UI.tag === id) UI = { ...UI, tag: null };
  set({ tags: S.tags.filter((t) => t.id !== id), tasks: S.tasks.map(strip), rec: S.rec.map(strip) });
}

/* ---------- Tâches ---------- */
/* 3 priorités maximum par jour (aujourd'hui = toutes les tâches du jour, sinon la date exacte) */
function prioCount(tasks, date, except) {
  if (!date) return 0;
  const k = todayKey(), today = date <= k;
  return tasks.filter((t) => t.prio && t.id !== except && (today ? isToday(t, k) : t.date === date)).length;
}
export const canPrio = (date, except) => !date || prioCount(S.tasks, date, except) < 3;

export function addTask({ text, date, weight, prio, tags = [], est = 0, time = null }) {
  const d = date === undefined ? todayKey() : date;
  const r = resolveTags(tags, S.tags);
  if (UI.tag && d && d <= todayKey() && !r.ids.includes(UI.tag)) r.ids.push(UI.tag);
  let p = !!prio;
  if (p && !canPrio(d)) { p = false; toast('3 priorités maximum par jour.'); }
  const t = { id: uid(), text, done: false, date: d, weight: W(weight ?? S.set.defWeight), prio: p, tags: r.ids, subs: [], carried: 0, focus: 0, est: est | 0, time: isHM(time) ? time : null, dur: null };
  set({ tasks: [...S.tasks, t], tags: r.tags });
  return t;
}
const patch = (id, f) => set({ tasks: S.tasks.map((t) => (t.id === id ? { ...t, ...(typeof f === 'function' ? f(t) : f) } : t)) });
export const editTask = (id, text) => patch(id, { text });
export const setWeight = (id, weight) => patch(id, { weight: W(weight) });
export function togglePrio(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  if (!t.prio && !canPrio(t.date, id)) { toast('3 priorités maximum par jour.'); return; }
  patch(id, { prio: !t.prio });
  // ordre manuel : la priorité ne bouge pas toute seule, on propose de la remonter
  if (!t.prio && S.set.order !== 'auto') toast('★ Priorité ajoutée — remonter en tête ?', { label: 'Remonter', fn: () => moveToTop(id) });
}
/* Remonte une tâche en tête de sa liste (même jour, ou « Plus tard ») */
export function moveToTop(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const k = todayKey(), same = (x) => (isToday(t, k) ? isToday(x, k) : x.date === t.date);
  const first = S.tasks.find((x) => x.id !== id && same(x));
  if (first) moveTask(id, first.id, false);
}
export function setDate(id, date) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t || t.done) return;
  const p = t.prio && !canPrio(date, id) ? false : t.prio;
  if (t.prio && !p) toast('Priorité retirée : 3 priorités maximum ce jour-là.');
  if (!(date && date <= todayKey()) && UI.sel.has(id)) { const sel = new Set(UI.sel); sel.delete(id); UI = { ...UI, sel }; }
  patch(id, { date, prio: p, carried: date && date <= todayKey() ? t.carried : 0 });
}
export function toggleTaskTag(id, tag) {
  patch(id, (t) => ({ tags: t.tags.includes(tag) ? t.tags.filter((g) => g !== tag) : [...t.tags, tag] }));
}
export const addSub = (id, text) => patch(id, (t) => ({ subs: [...t.subs, { id: uid(), text, done: false }] }));
export const toggleSub = (id, sid) => patch(id, (t) => ({ subs: t.subs.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) }));
export const editSub = (id, sid, text) => patch(id, (t) => ({ subs: t.subs.map((s) => (s.id === sid ? { ...s, text } : s)) }));
export const deleteSub = (id, sid) => patch(id, (t) => ({ subs: t.subs.filter((s) => s.id !== sid) }));

export function deleteTask(id, silent) {
  const i = S.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = S.tasks[i];
  if (UI.sel.has(id)) { const sel = new Set(UI.sel); sel.delete(id); UI = { ...UI, sel }; }
  if (UI.open === id) UI = { ...UI, open: null };
  set({ tasks: S.tasks.filter((x) => x.id !== id), doneTotal: S.doneTotal - (t.done ? 1 : 0) });
  if (!silent) {
    toast('Tâche supprimée', {
      label: 'Annuler',
      fn: () => {
        if (S.tasks.some((x) => x.id === id)) return;
        const tasks = [...S.tasks];
        tasks.splice(Math.min(i, tasks.length), 0, t);
        set({ tasks, doneTotal: S.doneTotal + (t.done ? 1 : 0) });
      },
    });
  }
}
/* Décocher une tâche terminée (recalcule le score du jour) */
export function uncheck(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t || !t.done || UI.busy) return;
  patch(id, { done: false });
  set({ doneTotal: Math.max(0, S.doneTotal - 1) });
}
/* Réorganisation relative à une tâche cible (la liste affichée peut être filtrée ou triée) */
export function moveTask(id, targetId, after) {
  if (id === targetId) return;
  const tasks = [...S.tasks];
  const i = tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = tasks.splice(i, 1);
  const j = tasks.findIndex((x) => x.id === targetId);
  if (j < 0) return;
  tasks.splice(after ? j + 1 : j, 0, t);
  set({ tasks });
}
export function toggleSel(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t || t.done || UI.busy || !isToday(t)) return;
  const sel = new Set(UI.sel);
  sel.has(id) ? sel.delete(id) : sel.add(id);
  setUI({ sel });
}
export const select = (id) => { const sel = new Set(UI.sel); sel.add(id); setUI({ sel }); };

/* Valide la sélection ; renvoie l'ancien et le nouveau pourcentage */
export function validateSelection() {
  const old = stats().p;
  const ids = S.tasks.filter((t) => UI.sel.has(t.id) && !t.done && isToday(t)).map((t) => t.id);
  const tasks = S.tasks.map((t) => (ids.includes(t.id) ? { ...t, done: true } : t));
  UI = { ...UI, sel: new Set() };
  set({ tasks, doneTotal: S.doneTotal + ids.length });
  buzz(18);
  return { old, nw: stats().p, ids };
}
/* Après la validation (ou après l'animation) : toast « Annuler » pendant 6 s + badges */
export function afterValidate(ids) {
  if (!ids.length) return;
  toast(`${ids.length} ${plural(ids.length, 'tâche')} ${plural(ids.length, 'validée')}`, {
    label: 'Annuler',
    fn: () => {
      const back = S.tasks.filter((t) => ids.includes(t.id) && t.done).length;
      set({ tasks: S.tasks.map((t) => (ids.includes(t.id) ? { ...t, done: false } : t)), doneTotal: Math.max(0, S.doneTotal - back) });
      toast('Validation annulée.');
    },
  });
  checkBadges();
}

export const setAnim = (anim) => set({ anim });
export const setConfetti = (confetti) => set({ confetti });
export function setSetting(k, v) {
  set({ set: { ...S.set, [k]: v } });
  // minuteur prêt (pas encore lancé) : la nouvelle durée s'applique tout de suite
  const p = S.pomo, ph = { pomo: 'work', pause: 'short', longPause: 'long' }[k];
  if (p && ph === p.phase && p.paused === 0) set({ pomo: { ...p, dur: v * 60 } });
}
export const markSeen = (k, v = todayKey()) => set({ seen: { ...S.seen, [k]: v } });

/* ---------- Tâches reportées ---------- */
export const carriedTasks = () => todayTasks().filter((t) => !t.done && t.carried > 0);
export function moveCarried(date) {
  const ids = carriedTasks().map((t) => t.id);
  ids.forEach((id) => setDate(id, date));
  toast(`${ids.length} ${plural(ids.length, 'tâche')} ${plural(ids.length, 'déplacée')}.`);
}
export const needsMorning = (St = S) => St.set.morning && St.seen.morning !== todayKey() && carriedTasks().length > 0;

/* ---------- Tâches récurrentes ---------- */
export function isDue(r, k) {
  const R = r.rule;
  if (R.type === 'weekdays') return R.days.includes(parseK(k).getDay());
  if (R.type === 'interval') { const n = daysBetween(r.start, k); return n >= 0 && n % R.every === 0; }
  if (R.type === 'monthday') {
    const d = parseK(k), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(R.day, dim); // le 31 → dernier jour des mois plus courts
  }
  return true;
}
/* Génère les récurrences du jour k. Jamais de doublon : une seule fois par jour (r.last),
   et pas de nouvelle occurrence tant que la précédente n'est pas terminée. */
function spawn(tasks, rec, k) {
  const out = [...tasks];
  let pc = prioCount(out, k);
  const rec2 = rec.map((r) => {
    if (r.last === k || !isDue(r, k)) return r;
    if (!out.some((t) => t.rid === r.id && !t.done)) {
      const p = r.prio && pc < 3;
      if (p) pc++;
      out.push({ id: uid(), text: r.text, done: false, date: k, weight: r.weight, prio: p, tags: [...r.tags], subs: [], carried: 0, focus: 0, est: r.est | 0, time: null, dur: null, rid: r.id });
    }
    return { ...r, last: k };
  });
  return { tasks: out, rec: rec2 };
}
/* tags = noms d'étiquettes (créées si besoin) */
export function addRec({ text, rule, weight, tags = [], prio }) {
  const t = resolveTags(tags, S.tags);
  const r = { id: uid(), text, rule: normRule(rule), start: todayKey(), weight: W(weight ?? S.set.defWeight), tags: t.ids, prio: !!prio, last: '' };
  set({ tags: t.tags, ...spawn(S.tasks, [...S.rec, r], todayKey()) });
  toast(`Récurrence ajoutée : ${describeRule(r.rule).toLowerCase()}.`);
}
export const deleteRec = (id) => set({ rec: S.rec.filter((r) => r.id !== id) });
export function describeRule(rule) {
  const J = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  if (rule.type === 'weekdays') {
    const d = rule.days;
    if (d.join() === '1,2,3,4,5') return 'Du lundi au vendredi';
    if (d.join() === '0,6') return 'Le week-end';
    return 'Chaque ' + [...d.filter((x) => x), ...d.filter((x) => !x)].map((x) => J[x]).join(', ');
  }
  if (rule.type === 'interval') return rule.every === 1 ? 'Tous les jours' : `Tous les ${rule.every} jours`;
  if (rule.type === 'monthday') return `Le ${rule.day === 1 ? '1er' : rule.day} de chaque mois`;
  return 'Tous les jours';
}

/* ---------- Badges ---------- */
export const BADGES = [
  { id: 'first100', icon: '💯', name: 'Première journée à 100 %' },
  { id: 'streak7', icon: '🔥', name: '7 jours de série' },
  { id: 'streak30', icon: '🔥', name: '30 jours de série' },
  { id: 'streak100', icon: '🏆', name: '100 jours de série' },
  { id: 'tasks100', icon: '✓', name: '100 tâches validées' },
  { id: 'tasks500', icon: '✓✓', name: '500 tâches validées' },
  { id: 'tasks1000', icon: '★', name: '1000 tâches validées' },
  { id: 'week1', icon: '📅', name: 'Première semaine réussie' },
  { id: 'focus10', icon: '⏱', name: '10 h de concentration' },
];
export function checkBadges() {
  const z = streaks(), s = stats();
  const ok = {
    first100: (s.n > 0 && s.p >= 100) || Object.values(S.hist).some((h) => h.t > 0 && h.p >= 100),
    streak7: z.best >= 7, streak30: z.best >= 30, streak100: z.best >= 100,
    tasks100: S.doneTotal >= 100, tasks500: S.doneTotal >= 500, tasks1000: S.doneTotal >= 1000,
    week1: z.weeksOk > 0, focus10: focusTotal() >= 600,
  };
  const fresh = BADGES.filter((b) => ok[b.id] && !S.badges[b.id]);
  if (!fresh.length) return;
  const badges = { ...S.badges };
  fresh.forEach((b) => { badges[b.id] = todayKey(); });
  UI = { ...UI, newBadge: fresh[fresh.length - 1].id };
  set({ badges });
  if (S.set.showBadges) fresh.forEach((b) => toast(`🏅 Nouveau badge : ${b.name}`));
}

/* ---------- Pomodoro — calcul par horodatages (juste même écran verrouillé) ----------
   pomo = { tid (tâche liée ou null), phase: 'work' | 'short' | 'long', start (ms), dur (s), paused (s écoulées si en pause, 0 = prêt),
            done (sessions terminées dans le cycle), cr (secondes déjà créditées sur cette phase) } */
export const PHASES = { work: 'Concentration', short: 'Pause courte', long: 'Pause longue' };
const durOf = (phase) => (phase === 'work' ? S.set.pomo : phase === 'short' ? S.set.pause : S.set.longPause) * 60;
export const pomoElapsed = (p = S.pomo, t = Date.now()) => (p.paused != null ? p.paused : (t - p.start) / 1000);
export const pomoState = () => S.pomo || { tid: null, phase: 'work', start: 0, dur: durOf('work'), paused: 0, done: 0, cr: 0 };
export const pomoRunning = () => !!S.pomo && S.pomo.paused == null;
export const pomoToday = (St = S) => (St.pomoDay.d === K(new Date(Date.now() + St.off * 864e5)) ? St.pomoDay.n : 0);

function credit(tid, sec) {
  if (sec < 5) return;
  const m = sec / 60, k = todayKey();
  set({
    tasks: tid ? S.tasks.map((t) => (t.id === tid ? { ...t, focus: r1(t.focus + m) } : t)) : S.tasks,
    fmDay: { d: k, m: r1((S.fmDay.d === k ? S.fmDay.m : 0) + m) },
  });
}
/* Crédite le temps de concentration pas encore compté (tâche liée + journée) */
function creditWork(p) {
  if (p.phase !== 'work') return p;
  const el = Math.min(pomoElapsed(p), p.dur), add = el - (p.cr || 0);
  if (add >= 5) { credit(p.tid, add); return { ...p, cr: el }; }
  return p;
}
const fresh = (p, phase, run, start = Date.now()) => ({ ...p, phase, start, dur: durOf(phase), paused: run ? null : 0, cr: 0 });

/* Démarrer / mettre en pause */
export function pomoToggle() {
  const p = pomoState();
  if (p.paused != null) set({ pomo: { ...p, start: Date.now() - p.paused * 1000, paused: null } });
  else set({ pomo: { ...creditWork(p), paused: pomoElapsed(p) } });
}
/* Choisir une phase (Concentration / Pause courte / Pause longue) */
export function pomoPhase(phase) {
  const p = creditWork(pomoState());
  set({ pomo: fresh(p, phase, false) });
}
export function pomoReset() {
  const p = creditWork(pomoState());
  set({ pomo: fresh(p, p.phase, false) });
}
/* Phase suivante : après une concentration, pause courte (ou longue tous les N cycles) ; après une pause, concentration */
function nextPhase(p, natural, at) {
  if (p.phase === 'work') {
    const done = p.done + (natural ? 1 : 0);
    const phase = done > 0 && done % S.set.cycle === 0 ? 'long' : 'short';
    return { ...fresh(p, phase, S.set.autoBreak, at), done };
  }
  return { ...fresh(p, 'work', S.set.autoWork, at), done: p.phase === 'long' ? 0 : p.done };
}
export function pomoSkip() {
  const p = creditWork(pomoState());
  set({ pomo: nextPhase(p, false) });
}
/* Lier une tâche au minuteur (le temps déjà fait reste à l'ancienne tâche) */
export function pomoTask(tid) {
  const p = creditWork(pomoState());
  set({ pomo: { ...p, tid: tid || null } });
}
/* Fait avancer les phases terminées ; renvoie la phase qui vient de finir ('work' | 'short' | 'long') ou null */
export function pomoTick() {
  let p = S.pomo, ended = null;
  for (let i = 0; p && i < 6; i++) {
    if (p.paused != null || pomoElapsed(p) < p.dur) break;
    const end = p.start + p.dur * 1000;
    if (p.phase === 'work') {
      p = creditWork(p);
      const k = todayKey();
      set({ pomoDay: { d: k, n: (S.pomoDay.d === k ? S.pomoDay.n : 0) + 1 } });
    }
    ended = p.phase;
    p = nextPhase(p, true, end);
  }
  if (ended) { set({ pomo: p }); checkBadges(); }
  return ended;
}
/* Bouton ▶ d'une tâche : la lie au minuteur, démarre et ouvre l'onglet Pomodoro */
export function startFocus(tid) {
  let p = creditWork(pomoState());
  p = { ...p, tid };
  if (p.phase !== 'work' || p.paused == null) p = { ...fresh(p, 'work', true), done: p.done };
  set({ pomo: p });
  setUI({ page: 4, open: null, modal: null });
}
/* « Terminer la tâche » : met le minuteur en pause et sélectionne la tâche pour validation */
export function finishFocusTask() {
  const p0 = pomoState(), tid = p0.tid;
  const p = creditWork(p0);
  set({ pomo: { ...p, paused: p.paused ?? pomoElapsed(p), tid: null } });
  const t = S.tasks.find((x) => x.id === tid);
  if (!t || t.done) return;
  if (!isToday(t)) setDate(tid, todayKey());
  setUI({ page: 1 });
  select(tid);
}

/* ---------- Changement de jour (minuit) ----------
   Score du jour → historique (points, priorités, concentration, étiquettes) ; tâches terminées retirées ;
   tâches non terminées reportées (compteur « carried ») ; tâches datées du nouveau jour affichées ;
   récurrences du jour ajoutées ; jokers appliqués ; badges vérifiés.
   Les jours sans ouverture de l'app sont enregistrés avec les tâches restantes (0 %). */
function entry(tasks, k, St) {
  const s = stats(tasks, k), tg = {};
  for (const t of tasks) if (t.done && isToday(t, k)) for (const g of t.tags) tg[g] = (tg[g] || 0) + 1;
  return { p: s.p, d: s.c, t: s.n, pd: s.pd, pt: s.pt, pr: s.pr, prt: s.prt, fm: St.fmDay.d === k ? r1(St.fmDay.m) : 0, ps: St.pomoDay.d === k ? St.pomoDay.n : 0, tg };
}
export function checkDay() {
  if (UI.busy) return false;
  const tk = todayKey();
  if (!S.last) { set({ last: tk, since: S.since || tk, ...spawn(S.tasks, S.rec, tk) }); return false; }
  if (S.last >= tk) return false;
  const hist = { ...S.hist }, keys = [S.last];
  hist[S.last] = entry(S.tasks, S.last, S);
  let rest = S.tasks.filter((t) => !t.done);
  for (let k = addDays(S.last, 1), i = 0; k < tk && i < 800; k = addDays(k, 1), i++) { hist[k] = entry(rest, k, S); keys.push(k); }
  const jk = applyJokers(hist, keys, S.set);
  rest = rest.map((t) => (t.date && t.date < tk ? { ...t, date: tk, carried: t.carried + 1 } : t));
  // au plus 3 priorités dans la liste du jour (dans l'ordre choisi)
  let pc = 0;
  rest = rest.map((t) => (t.prio && isToday(t, tk) ? (++pc > 3 ? { ...t, prio: false } : t) : t));
  UI = { ...UI, sel: new Set(), open: null };
  set({ hist, last: tk, ...spawn(rest, S.rec, tk) });
  if (jk) toast(jk > 1 ? `${jk} jokers utilisés, ta série continue 🔥` : 'Joker utilisé, ta série continue 🔥', null, 4500);
  checkBadges();
  return true;
}
export function simulateMidnight() {
  if (UI.busy) return;
  S = { ...S, off: S.off + 1 };
  checkDay();
  toast('Nouveau jour : tâches terminées archivées, tâches restantes reportées.');
}

/* ---------- Mode test : 365 jours d'historique + tâches d'exemple ---------- */
export function generateTestData() {
  const tk = todayKey(), hist = { ...S.hist };
  let tags = S.tags;
  if (tags.length < 3) tags = resolveTags(['Sport', 'Travail', 'Lecture', 'Maison'], tags).tags;
  const keys = [];
  let added = 0;
  for (let i = 365; i >= 1; i--) {
    const k = addDays(tk, -i);
    if (hist[k]) continue;
    const t = 3 + Math.floor(Math.random() * 6);
    const ws = [...Array(t)].map(() => 1 + Math.floor(Math.random() * 3));
    const pt = ws.reduce((a, b) => a + b, 0);
    const target = clamp(62 + 28 * Math.sin(i / 9) + (Math.random() - 0.5) * 50, 0, 100) / 100;
    let pd = 0, d = 0;
    const tg = {};
    ws.forEach((w) => {
      if (Math.random() < target) {
        pd += w; d++;
        const g = tags[Math.floor(Math.random() * tags.length)].id;
        tg[g] = (tg[g] || 0) + 1;
      }
    });
    const prt = Math.min(3, t, Math.floor(Math.random() * 4));
    const pr = Math.min(prt, Math.round(prt * target + (Math.random() - 0.5)));
    const fm = Math.random() < 0.7 ? Math.round(15 + Math.random() * 110) : 0;
    hist[k] = { p: Math.round((pd / pt) * 100), d, t, pd, pt, pr: Math.max(0, pr), prt, fm, tg };
    keys.push(k);
    added += d;
  }
  applyJokers(hist, keys, S.set);
  const g = (n) => tags.find((x) => x.name === n)?.id;
  const ex = (text, date, weight, prio, tg, more = {}) => ({ id: uid(), text, done: false, date, weight, prio, tags: tg.filter(Boolean), subs: [], carried: 0, focus: 0, ...more });
  const pc = prioCount(S.tasks, tk);
  const samples = [
    ex('Séance de sport', tk, 2, pc < 3, [g('Sport')], {
      subs: [{ id: uid(), text: 'Échauffement', done: true }, { id: uid(), text: 'Course 5 km', done: false }, { id: uid(), text: 'Étirements', done: false }], focus: 25,
    }),
    ex('Répondre aux mails importants', tk, 1, false, [g('Travail')], { carried: 3 }),
    ex('Lire 20 pages', tk, 1, false, [g('Lecture')], { carried: 1 }),
    ex('Préparer la réunion', addDays(tk, 1), 3, true, [g('Travail')]),
    ex('Rendez-vous dentiste', addDays(tk, 3), 1, false, []),
    ex('Ranger le garage', null, 3, false, [g('Maison')]),
  ];
  set({ hist, tags, tasks: [...S.tasks, ...samples], doneTotal: S.doneTotal + added });
  checkBadges();
  toast('Données de test générées (365 jours + tâches d’exemple). Ouvrez « Ma Progression ».');
}

/* ---------- Bilan de la semaine ---------- */
export function weekReview(St = S, monday) {
  const tk = K(new Date(Date.now() + St.off * 864e5));
  const m = monday || addDays(mondayOf(tk), -7);
  const live = (k) => {
    if (k !== tk) return St.hist[k];
    const s = stats(St.tasks, tk);
    return { p: s.p, d: s.c, t: s.n, pr: s.pr, prt: s.prt, fm: focusToday(St) };
  };
  const days = (from) => [...Array(7)].map((_, i) => addDays(from, i)).map((k) => ({ k, h: live(k) })).filter((x) => x.h && x.h.t > 0);
  const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x.h.p, 0) / a.length) : null);
  const cur = days(m), prev = days(addDays(m, -7));
  const best = cur.reduce((b, x) => (!b || x.h.p > b.h.p ? x : b), null);
  const sumOf = (f) => cur.reduce((s, x) => s + (x.h[f] || 0), 0);
  return {
    from: m, to: addDays(m, 6), avg: avg(cur), prevAvg: avg(prev), best,
    ok: cur.filter((x) => dayOk(x.h, St.set.threshold) || x.h.jk).length, n: cur.length,
    pr: sumOf('pr'), prt: sumOf('prt'), fm: sumOf('fm'), done: sumOf('d'), z: streaks(St),
  };
}
export const needsWeekly = (St = S) => {
  const m = mondayOf(todayKey());
  return St.seen.weekly !== m && weekReview(St).n > 0;
};

/* ---------- Export / Import / Réinitialisation ---------- */
export function exportJSON() {
  const a = document.createElement('a');
  set({ lastExport: todayKey() });
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'Fokus', ...S }, null, 2)], { type: 'application/json' }));
  a.download = 'fokus-sauvegarde-' + K(new Date()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || !Array.isArray(o.tasks) || typeof o.hist !== 'object') throw new Error('invalid');
  S = migrate(o);
  UI = { ...UI, sel: new Set(), open: null, tag: null };
  save();
  checkDay();
  emit();
}
export function resetAll() {
  S = migrate({});
  UI = { ...UI, sel: new Set(), open: null, tag: null, modal: null, page: 1 };
  tq = [];
  save();
  checkDay();
  emit();
  toast('Toutes les données ont été effacées.');
}
/* Rappel discret d'export tous les 7 jours */
export function exportReminder() {
  const tk = todayKey(), ref = S.lastExport || S.since || tk, n = daysBetween(ref, tk);
  if (n < 7 || S.seen.nag === tk) return;
  markSeen('nag');
  toast(S.lastExport ? `Dernière sauvegarde il y a ${n} jours` : `Aucune sauvegarde depuis ${n} jours`, { label: 'Exporter maintenant', fn: exportJSON }, 9000);
}
