import { useSyncExternalStore } from 'react';
import { K, addDays, daysBetween, mondayOf, parseK } from './lib/dates';
import { clamp } from './lib/colors';
import { scheduleBackup } from './lib/backup';
import { buzz } from './lib/notify';

/* =====================================================================
   MODÈLE DE DONNÉES (version 5) — clé localStorage « focus_state »
   Catégories cats = [{ id, name, emoji, color }] (v5) — une par tâche au plus (tâche.cat / récurrence.cat), en plus des étiquettes ;
              hist[jour].cg = { catId: tâches validées } ; session[7] = catégorie
   Tâche      { id, text, done, date: 'YYYY-MM-DD' | null (= Plus tard), weight: 1|2|3, prio, tags: [tagId], cat: catId | null,
                subs: [{ id, text, done }], carried (nombre de reports), focus (minutes), rid? (récurrence d'origine),
                est (temps estimé en minutes, 0 = aucun ; = durée du bloc en chronologie), time ('HH:MM' | null, heure de début) }
              v4 : l'estimation passe de pomodoros à minutes (migrate : est × durée du pomodoro, ou ancienne durée ajustée `dur`)
   Journal    sessions = [[début (s), durée (s), tâche | null, 'c' (classique) | 'f' (libre), terminée 0|1, [étiquettes], titre]] — purgé au-delà de 2 ans
   Historique (v3) hist[jour].ea = [minutes estimées, minutes réelles] des tâches estimées terminées (précision des estimations)
   Idées      ideas = [{ id, text, at }] — bloc-notes de distractions du minuteur
   Récurrence { id, text, rule: { type: 'daily' | 'weekdays' (days: [0-6]) | 'interval' (every) | 'monthday' (day) },
                start, weight, tags, prio, last (dernier jour généré → jamais de doublon) }
   Historique hist['YYYY-MM-DD'] = { p, d, t, pd, pt, pr, prt, fm, tg: { tagId: n }, jk? }
              p = %, d/t = tâches faites/totales, pd/pt = points, pr/prt = priorités, fm = minutes de concentration,
              tg = tâches validées par étiquette, jk = joker utilisé ce jour-là
   Réglages   set = DEF_SET
   ===================================================================== */
export const VERSION = 5;
const KEY = 'focus_state';
export const PASTELS = ['#fca5a5', '#fdba74', '#fde68a', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4', '#5eead4'];
/* Catégories (v5) : un grand domaine par tâche (emoji + couleur), en plus des étiquettes libres */
export const DEF_CATS = [
  ['c-travail', 'Travail', '💼', '#93c5fd'], ['c-devoirs', 'Devoirs', '📚', '#c4b5fd'], ['c-sport', 'Sport', '🏃', '#86efac'], ['c-sante', 'Santé', '❤️', '#fca5a5'],
  ['c-maison', 'Maison', '🏠', '#fdba74'], ['c-courses', 'Courses', '🛒', '#fde68a'], ['c-perso', 'Perso', '✨', '#f9a8d4'], ['c-social', 'Social', '👥', '#5eead4'],
].map(([id, name, emoji, color]) => ({ id, name, emoji, color }));
export const DEF_SET = {
  threshold: 80, jokers: 2, defWeight: 1, scoreMode: 'pct',
  pomo: 25, pause: 5, longPause: 15, cycle: 4, autoBreak: true, autoWork: false, sound: true, clock: 'classic', bg: 't-obsidienne',
  amb: 't-obsidienne', ambLevel: 2,
  remind: false, remindAt: '20:00', pomoNotif: false, push: false, pushUrl: '',
  showStreak: true, showBadges: true, morning: true,
  order: 'manual', pomoMode: 'classic', flowRatio: 5, ambient: 'none', ambVol: 0.5, ambMute: true,
  defDur: 30, capacity: 360, evening: true, eveningAt: '21:00', planView: 'list', testTools: true, pipMode: 'auto',
};
const base = () => ({
  version: VERSION, tasks: [], rec: [], hist: {}, tags: [], cats: DEF_CATS.map((c) => ({ ...c })), last: '', off: 0, anim: true, confetti: true,
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
  // v4 : estimation en minutes (avant : en pomodoros de `set.pomo` minutes, durée ajustée dans `dur`)
  const v0 = +o.version || 0, pm = clamp(Math.round(+(o.set && o.set.pomo)) || 25, 1, 180);
  // v5 : catégories (liste par défaut si absente) ; tâche.cat / récurrence.cat = id de catégorie ou null
  const cats = Array.isArray(o.cats)
    ? o.cats.filter((c) => c && c.id).map((c, i) => ({ id: String(c.id), name: String(c.name ?? 'Catégorie').slice(0, 24), emoji: String(c.emoji ?? '📁').slice(0, 8), color: c.color || PASTELS[i % PASTELS.length] }))
    : DEF_CATS.map((c) => ({ ...c }));
  const catOk = (id) => (id && cats.some((c) => c.id === id) ? String(id) : null);
  const estMin = (x) => clamp(Math.round(v0 < 4 ? (+x.dur >= 5 ? +x.dur : (+x.est || 0) * pm) : +x.est) || 0, 0, 1440);
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
    est: estMin(t),
    time: isHM(t.time) ? t.time : null,
    cat: catOk(t.cat),
  }));
  tasks.forEach((t) => delete t.dur);
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
      est: clamp(Math.round(v0 < 4 ? (+r.est || 0) * pm : +r.est) || 0, 0, 1440),
      cat: catOk(r.cat),
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
      ...(h.cg && typeof h.cg === 'object' ? { cg: h.cg } : {}),
    };
  }
  const keys = Object.keys(hist).sort();
  // Thème Obsidienne (v3) : remplace une seule fois l'ancienne ambiance par défaut « Forêt sombre »
  const set0 = { ...DEF_SET, ...(o.set && typeof o.set === 'object' ? o.set : {}) };
  const seen0 = o.seen && typeof o.seen === 'object' ? { ...o.seen } : {};
  if (!seen0.thm) { if (set0.amb === 'p12') set0.amb = 't-obsidienne'; seen0.thm = 1; }
  return {
    ...base(), ...o,
    version: VERSION, tasks, rec, hist, last, off,
    tags: arr(o.tags).filter((x) => x && x.id).map((x, i) => ({ id: String(x.id), name: String(x.name ?? 'Étiquette'), color: x.color || PASTELS[i % PASTELS.length] })),
    cats,
    anim: o.anim !== false,
    confetti: o.confetti !== false,
    set: set0,
    badges: o.badges && typeof o.badges === 'object' ? o.badges : {},
    doneTotal: Number.isFinite(o.doneTotal) ? o.doneTotal : keys.reduce((s, k) => s + hist[k].d, 0) + tasks.filter((t) => t.done).length,
    fmDay: o.fmDay && typeof o.fmDay.d === 'string' ? { d: o.fmDay.d, m: Math.max(0, +o.fmDay.m || 0) } : { d: '', m: 0 },
    lastExport: isKey(o.lastExport) ? o.lastExport : '',
    since: isKey(o.since) ? o.since : keys[0] || last || today,
    seen: seen0,
    pomo: o.pomo && typeof o.pomo === 'object' && Number.isFinite(o.pomo.start)
      ? { tid: o.pomo.tid || null, phase: ['work', 'short', 'long'].includes(o.pomo.phase) ? o.pomo.phase : 'short', start: o.pomo.start, dur: Number.isFinite(+o.pomo.dur) ? +o.pomo.dur : 1500, flow: !!o.pomo.flow,
          paused: o.pomo.paused ?? null, done: o.pomo.done | 0, cr: +o.pomo.cr || 0 }
      : null,
    pomoDay: o.pomoDay && typeof o.pomoDay.d === 'string' ? { d: o.pomoDay.d, n: o.pomoDay.n | 0 } : { d: '', n: 0 },
    sessions: purgeSessions(arr(o.sessions).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]))
      .map((x) => [Math.round(x[0]), Math.round(x[1]), x[2] ? String(x[2]) : null, x[3] === 'f' ? 'f' : 'c', x[4] ? 1 : 0, arr(x[5]).map(String), String(x[6] || '').slice(0, 40), x[7] ? String(x[7]) : null])),
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
export function toast(msg, action, ms, icon) {
  const t = { id: uid(), msg, action, icon, ms: ms || (action ? 6000 : 3200) };
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

/* ---------- Catégories ---------- */
export const catOf = (id, St = S) => (id ? St.cats.find((c) => c.id === id) || null : null);
const fold = (x) => x.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/* « @sport », « @sant » → catégorie (nom sans accents, début du nom accepté) */
export function catByName(name, St = S) {
  const n = fold(String(name).replace(/^@/, ''));
  if (!n) return null;
  return St.cats.find((c) => fold(c.name) === n) || St.cats.find((c) => fold(c.name).startsWith(n)) || null;
}
export function addCat(name, emoji = '📁') {
  const n = name.trim();
  if (!n) return null;
  const same = catByName(n);
  if (same && fold(same.name) === fold(n)) return same.id;
  const c = { id: 'c-' + uid(), name: n.slice(0, 24), emoji: emoji.trim() || '📁', color: PASTELS[S.cats.length % PASTELS.length] };
  set({ cats: [...S.cats, c] });
  return c.id;
}
export const editCat = (id, f) => set({ cats: S.cats.map((c) => (c.id === id ? { ...c, ...f } : c)) });
export function deleteCat(id) {
  const strip = (x) => (x.cat === id ? { ...x, cat: null } : x);
  if (UI.cat === id) UI = { ...UI, cat: null };
  set({ cats: S.cats.filter((c) => c.id !== id), tasks: S.tasks.map(strip), rec: S.rec.map(strip) });
}
export const setCatFilter = (cat) => setUI({ cat: UI.cat === cat ? null : cat });

/* ---------- Tâches ---------- */
/* 3 priorités maximum par jour (aujourd'hui = toutes les tâches du jour, sinon la date exacte) */
function prioCount(tasks, date, except) {
  if (!date) return 0;
  const k = todayKey(), today = date <= k;
  return tasks.filter((t) => t.prio && t.id !== except && (today ? isToday(t, k) : t.date === date)).length;
}
export const canPrio = (date, except) => !date || prioCount(S.tasks, date, except) < 3;

export function addTask({ text, date, weight, prio, tags = [], est = 0, time = null, cat = null }) {
  const d = date === undefined ? todayKey() : date;
  const r = resolveTags(tags, S.tags);
  if (UI.tag && d && d <= todayKey() && !r.ids.includes(UI.tag)) r.ids.push(UI.tag);
  let p = !!prio;
  if (p && !canPrio(d)) { p = false; toast('3 priorités maximum par jour.'); }
  // filtre de catégorie actif sur la page du jour : la nouvelle tâche du jour en hérite
  const c = catOf(cat) ? cat : UI.cat && d && d <= todayKey() ? UI.cat : null;
  const t = { id: uid(), text, done: false, date: d, weight: W(weight ?? S.set.defWeight), prio: p, tags: r.ids, subs: [], carried: 0, focus: 0, est: clamp(est | 0, 0, 1440), time: isHM(time) ? time : null, cat: c };
  set({ tasks: [...S.tasks, t], tags: r.tags });
  return t;
}
const patch = (id, f) => set({ tasks: S.tasks.map((t) => (t.id === id ? { ...t, ...(typeof f === 'function' ? f(t) : f) } : t)) });
export const editTask = (id, text) => patch(id, { text });
export const setTaskField = (id, f) => patch(id, f);
/* Durée d'une tâche (chronologie, surcharge) : temps estimé, sinon durée par défaut */
export const taskDur = (t, St = S) => t.est || St.set.defDur;
/* Total estimé du jour (tâches restantes ou faites) et temps fait */
export function dayLoad(St = S, k = K(new Date(Date.now() + St.off * 864e5))) {
  let est = 0, done = 0, any = false;
  for (const t of St.tasks) {
    if (!isToday(t, k)) continue;
    if (t.est) { any = true; est += t.est; }
    done += t.focus || 0;
  }
  return { est, done, any };
}
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
/* Notifications push : identifiant aléatoire de l'appareil (adresse auprès du serveur, sans lien avec les données) */
export function ensurePushId() {
  if (!S.pushId) set({ pushId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 28) });
  return S.pushId;
}
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
      out.push({ id: uid(), text: r.text, done: false, date: k, weight: r.weight, prio: p, tags: [...r.tags], subs: [], carried: 0, focus: 0, est: r.est | 0, time: null, cat: r.cat || null, rid: r.id });
    }
    return { ...r, last: k };
  });
  return { tasks: out, rec: rec2 };
}
/* tags = noms d'étiquettes (créées si besoin) */
export function addRec({ text, rule, weight, tags = [], prio, est = 0, cat = null }) {
  const t = resolveTags(tags, S.tags);
  const r = { id: uid(), text, rule: normRule(rule), start: todayKey(), weight: W(weight ?? S.set.defWeight), tags: t.ids, prio: !!prio, est: clamp(est | 0, 0, 1440), cat: catOf(cat) ? cat : null, last: '' };
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

/* ---------- Badges ----------
   Chaque badge : id (stable, déjà obtenu = gardé), cat (rubrique de la vitrine), icon, name, et
   goal + v(c) (valeur actuelle) → progression « 12 / 30 » tant qu'il est verrouillé. */
export const BADGE_CATS = [['reg', 'Régularité'], ['top', 'Journées parfaites'], ['task', 'Tâches'], ['focus', 'Concentration'], ['habit', 'Habitudes'], ['fokus', 'Collection Fokus']];
/* Paliers des médailles : 1 bronze, 2 argent, 3 or, 4 émeraude Fokus (légendaire) */
export const TIERS = ['', 'Bronze', 'Argent', 'Or', 'Émeraude'];
const B = (cat, id, icon, name, goal, v, tier = 1) => ({ cat, id, icon, name, goal, v, tier });
export const BADGES = [
  B('reg', 'streak3', 'sprout', '3 jours de série', 3, (c) => c.z.best, 1),
  B('reg', 'streak7', 'flame', '7 jours de série', 7, (c) => c.z.best, 1),
  B('reg', 'streak14', 'flame', '14 jours de série', 14, (c) => c.z.best, 2),
  B('reg', 'streak30', 'flame', '30 jours de série', 30, (c) => c.z.best, 2),
  B('reg', 'streak60', 'comet', '60 jours de série', 60, (c) => c.z.best, 3),
  B('reg', 'streak100', 'trophy', '100 jours de série', 100, (c) => c.z.best, 3),
  B('reg', 'streak200', 'trophy', '200 jours de série', 200, (c) => c.z.best, 4),
  B('reg', 'streak365', 'crown', 'Un an de série', 365, (c) => c.z.best, 4),
  B('reg', 'week1', 'calendar', 'Première semaine réussie', 1, (c) => c.z.weeksOk, 1),
  B('reg', 'week4', 'calendar', '4 semaines réussies', 4, (c) => c.z.weeksOk, 2),
  B('reg', 'week12', 'calendar', '12 semaines réussies', 12, (c) => c.z.weeksOk, 3),
  B('reg', 'week26', 'layers', '26 semaines réussies', 26, (c) => c.z.weeksOk, 3),
  B('reg', 'week52', 'crown', '52 semaines réussies', 52, (c) => c.z.weeksOk, 4),
  B('reg', 'active30', 'sun', '30 jours actifs', 30, (c) => c.active, 1),
  B('reg', 'active100', 'sun', '100 jours actifs', 100, (c) => c.active, 2),
  B('reg', 'active365', 'sun', '365 jours actifs', 365, (c) => c.active, 4),
  B('reg', 'comeback', 'repeat', 'Retour en force : 100 % après une journée sous 50 %', 1, (c) => c.comeback, 1),
  B('reg', 'comeback5', 'repeat', '5 retours en force', 5, (c) => c.comeback, 3),
  B('top', 'first100', 'target', 'Première journée à 100 %', 1, (c) => c.perfect, 1),
  B('top', 'perfect10', 'target', '10 journées à 100 %', 10, (c) => c.perfect, 2),
  B('top', 'perfect50', 'diamond', '50 journées à 100 %', 50, (c) => c.perfect, 3),
  B('top', 'perfect100', 'diamond', '100 journées à 100 %', 100, (c) => c.perfect, 4),
  B('top', 'perfect3row', 'sparkle', '3 journées à 100 % d’affilée', 3, (c) => c.perfectRow, 1),
  B('top', 'perfect7row', 'star', '7 journées à 100 % d’affilée', 7, (c) => c.perfectRow, 2),
  B('top', 'perfect14row', 'star', '14 journées à 100 % d’affilée', 14, (c) => c.perfectRow, 3),
  B('top', 'perfect30row', 'crown', '30 journées à 100 % d’affilée', 30, (c) => c.perfectRow, 4),
  B('top', 'weekend', 'sun', 'Week-end au top : samedi et dimanche à 100 %', 1, (c) => c.weekend, 1),
  B('top', 'weekend4', 'sun', '4 week-ends au top', 4, (c) => c.weekend, 3),
  B('top', 'month80', 'chart', 'Mois solide : 80 % de moyenne sur un mois', 1, (c) => c.month80, 2),
  B('top', 'month90', 'chart', 'Mois d’excellence : 90 % de moyenne sur un mois', 1, (c) => c.month90, 3),
  B('task', 'tasks10', 'check', '10 tâches validées', 10, (c) => c.done, 1),
  B('task', 'tasks50', 'check', '50 tâches validées', 50, (c) => c.done, 1),
  B('task', 'tasks100', 'check', '100 tâches validées', 100, (c) => c.done, 2),
  B('task', 'tasks250', 'layers', '250 tâches validées', 250, (c) => c.done, 2),
  B('task', 'tasks500', 'layers', '500 tâches validées', 500, (c) => c.done, 3),
  B('task', 'tasks1000', 'star', '1000 tâches validées', 1000, (c) => c.done, 3),
  B('task', 'tasks2500', 'rocket', '2500 tâches validées', 2500, (c) => c.done, 4),
  B('task', 'tasks5000', 'rocket', '5000 tâches validées', 5000, (c) => c.done, 4),
  B('task', 'day10', 'bolt', '10 tâches en une journée', 10, (c) => c.dayMax, 2),
  B('task', 'day15', 'bolt', '15 tâches en une journée', 15, (c) => c.dayMax, 3),
  B('task', 'day20', 'bolt', '20 tâches en une journée', 20, (c) => c.dayMax, 4),
  B('task', 'pts20', 'dumbbell', '20 points en une journée', 20, (c) => c.ptsMax, 2),
  B('task', 'pts40', 'dumbbell', '40 points en une journée', 40, (c) => c.ptsMax, 4),
  B('task', 'prio25', 'star', '25 priorités tenues', 25, (c) => c.prio, 1),
  B('task', 'prio100', 'star', '100 priorités tenues', 100, (c) => c.prio, 2),
  B('task', 'prio250', 'star', '250 priorités tenues', 250, (c) => c.prio, 3),
  B('task', 'prioAll7', 'target', '7 jours avec toutes les priorités tenues', 7, (c) => c.prioAll, 2),
  B('task', 'prioAll30', 'target', '30 jours avec toutes les priorités tenues', 30, (c) => c.prioAll, 3),
  B('focus', 'pomo1', 'focus', 'Première session de concentration terminée', 1, (c) => c.pomos, 1),
  B('focus', 'pomo25', 'focus', '25 sessions terminées', 25, (c) => c.pomos, 1),
  B('focus', 'pomo100', 'focus', '100 sessions terminées', 100, (c) => c.pomos, 2),
  B('focus', 'pomo500', 'medal', '500 sessions terminées', 500, (c) => c.pomos, 3),
  B('focus', 'pomo1000', 'medal', '1000 sessions terminées', 1000, (c) => c.pomos, 4),
  B('focus', 'focus1', 'hourglass', '1 h de concentration', 60, (c) => c.focus, 1),
  B('focus', 'focus10', 'hourglass', '10 h de concentration', 600, (c) => c.focus, 1),
  B('focus', 'focus25', 'hourglass', '25 h de concentration', 1500, (c) => c.focus, 2),
  B('focus', 'focus50', 'hourglass', '50 h de concentration', 3000, (c) => c.focus, 2),
  B('focus', 'focus100', 'brain', '100 h de concentration', 6000, (c) => c.focus, 3),
  B('focus', 'focus500', 'brain', '500 h de concentration', 30000, (c) => c.focus, 4),
  B('focus', 'deep90', 'leaf', '90 min d’affilée en une session', 90, (c) => c.deep, 2),
  B('focus', 'deep120', 'leaf', '2 h d’affilée en une session', 120, (c) => c.deep, 3),
  B('focus', 'deep180', 'leaf', '3 h d’affilée en une session', 180, (c) => c.deep, 4),
  B('focus', 'flow1', 'wave', 'Premier chrono libre', 1, (c) => c.flow, 1),
  B('focus', 'flow25', 'wave', '25 sessions en chrono libre', 25, (c) => c.flow, 2),
  B('focus', 'day4h', 'battery', '4 h de concentration en un jour', 240, (c) => c.fmMax, 2),
  B('focus', 'day6h', 'battery', '6 h de concentration en un jour', 360, (c) => c.fmMax, 3),
  B('focus', 'week20h', 'chart', '20 h de concentration en une semaine', 1200, (c) => c.fmWeek, 3),
  B('habit', 'early', 'sunrise', 'Lève-tôt : une session avant 7 h', 1, (c) => c.early, 1),
  B('habit', 'early10', 'sunrise', '10 sessions avant 7 h', 10, (c) => c.early, 3),
  B('habit', 'night', 'moon', 'Oiseau de nuit : une session après 22 h', 1, (c) => c.night, 1),
  B('habit', 'night10', 'moon', '10 sessions après 22 h', 10, (c) => c.night, 2),
  B('habit', 'estim', 'target', 'Bonne estimation : à 10 % près sur au moins 1 h', 1, (c) => c.estim, 1),
  B('habit', 'estim10', 'target', '10 journées bien estimées', 10, (c) => c.estim, 3),
  B('habit', 'tags5', 'tag', '5 étiquettes', 5, (c) => c.tags, 1),
  B('habit', 'cats5', 'layers', 'Polyvalent : des tâches validées dans 5 catégories', 5, (c) => c.catsUsed, 1),
  B('habit', 'catDay3', 'sparkle', 'Touche-à-tout : 3 catégories en une journée', 3, (c) => c.catDay, 2),
  B('task', 'cat100', 'target', 'Spécialiste : 100 tâches dans une même catégorie', 100, (c) => c.catMax, 3),
  B('habit', 'rec3', 'repeat', '3 tâches récurrentes', 3, (c) => c.recs, 1),
  B('habit', 'planner', 'clock', 'Planificateur : 5 tâches à heure fixe', 5, (c) => c.timed, 1),
  B('habit', 'backup', 'save', 'Première sauvegarde exportée', 1, (c) => c.backup, 1),
  B('habit', 'joker', 'joker', 'Premier joker utilisé', 1, (c) => c.joker, 1),
  B('habit', 'aesthete', 'palette', 'Esthète : une ambiance à ton goût', 1, (c) => c.aesthete, 1),
  B('habit', 'music', 'headphones', 'Concentration en musique : un son d’ambiance', 1, (c) => c.music, 1),
  B('habit', 'since30', 'gift', 'Un mois avec Fokus', 30, (c) => c.since, 1),
  B('habit', 'since100', 'gift', '100 jours avec Fokus', 100, (c) => c.since, 2),
  B('habit', 'since365', 'gift', 'Un an avec Fokus', 365, (c) => c.since, 4),
  B('fokus', 'fokus10', 'ring', 'Fokus Bronze : 10 badges', 10, (c) => c.count, 1),
  B('fokus', 'fokus25', 'ring', 'Fokus Argent : 25 badges', 25, (c) => c.count, 2),
  B('fokus', 'fokus50', 'ring', 'Fokus Or : 50 badges', 50, (c) => c.count, 3),
  B('fokus', 'fokus75', 'ring', 'Légende Fokus : 75 badges', 75, (c) => c.count, 4),
];
const META = new Set(['fokus10', 'fokus25', 'fokus50', 'fokus75']);

/* Valeurs utiles aux badges (historique + aujourd'hui + journal des sessions), calculées une fois */
export function badgeCtx(St = S) {
  const tk = K(new Date(Date.now() + St.off * 864e5)), s = stats(St.tasks, tk);
  const days = Object.keys(St.hist).filter((k) => k < tk).sort().map((k) => [k, St.hist[k]]);
  const cgToday = {};
  St.tasks.forEach((t) => { if (t.done && t.cat && isToday(t, tk)) cgToday[t.cat] = (cgToday[t.cat] || 0) + 1; });
  if (s.n) days.push([tk, { p: s.p, d: s.c, t: s.n, pd: s.pd, pr: s.pr, prt: s.prt, fm: focusToday(St), cg: cgToday }]);
  let perfect = 0, row = 0, perfectRow = 0, comeback = 0, weekend = 0, dayMax = 0, ptsMax = 0, prio = 0, prioAll = 0, fmMax = 0, estim = 0, joker = 0, active = 0;
  let prev = null, catDay = 0;
  const months = {}, weeks = {}, catTot = {};
  for (const [k, h] of days) {
    const act = h.t > 0, full = act && h.p >= 100;
    if (act) active++;
    if (full) { perfect++; row++; perfectRow = Math.max(perfectRow, row); } else if (act) row = 0;
    if (full && prev && prev[1].t > 0 && prev[1].p < 50 && daysBetween(prev[0], k) === 1) comeback++;
    if (full && parseK(k).getDay() === 0 && prev && prev[1].t > 0 && prev[1].p >= 100 && daysBetween(prev[0], k) === 1) weekend++;
    dayMax = Math.max(dayMax, h.d || 0);
    if (h.cg) { catDay = Math.max(catDay, Object.keys(h.cg).length); for (const [id, n] of Object.entries(h.cg)) catTot[id] = (catTot[id] || 0) + n; }
    ptsMax = Math.max(ptsMax, h.pd || 0);
    prio += h.pr || 0;
    if (h.prt > 0 && h.pr >= h.prt) prioAll++;
    fmMax = Math.max(fmMax, h.fm || 0);
    weeks[mondayOf(k)] = (weeks[mondayOf(k)] || 0) + (h.fm || 0);
    if (h.ea && h.ea[0] >= 60 && Math.abs(h.ea[1] - h.ea[0]) <= h.ea[0] * 0.1) estim++;
    if (h.jk) joker = 1;
    if (act) { const m = (months[k.slice(0, 7)] ||= [0, 0]); m[0] += h.p; m[1]++; }
    if (act) prev = [k, h];
  }
  const monthAvg = (min) => (Object.values(months).some(([sum, n]) => n >= 20 && sum / n >= min) ? 1 : 0);
  let pomos = 0, deep = 0, flow = 0, early = 0, night = 0;
  for (const x of St.sessions) {
    if (x[3] === 'c' && x[4]) pomos++;
    if (x[3] === 'f') flow++;
    deep = Math.max(deep, Math.floor(x[1] / 60));
    if (x[1] >= 600) { const h = new Date(x[0] * 1000).getHours(); if (h >= 4 && h < 7) early++; if (h >= 22 || h < 2) night++; }
  }
  return {
    z: streaks(St), perfect, perfectRow, comeback, weekend, month80: monthAvg(80), month90: monthAvg(90), done: St.doneTotal, dayMax, ptsMax, prio, prioAll, active,
    pomos, focus: focusTotal(St), deep, flow, fmMax, fmWeek: Math.max(0, ...Object.values(weeks)), early, night, estim, tags: St.tags.length, recs: St.rec.length,
    timed: St.tasks.filter((t) => t.time).length, backup: St.lastExport ? 1 : 0, joker,
    aesthete: St.set.amb && St.set.amb !== DEF_SET.amb ? 1 : 0, music: St.set.ambient && St.set.ambient !== 'none' ? 1 : 0,
    since: daysBetween([St.since, ...Object.keys(St.hist)].filter(Boolean).sort()[0] || tk, tk) + 1,
    count: BADGES.filter((b) => !META.has(b.id) && St.badges[b.id]).length,
    catsUsed: Object.keys(catTot).length, catMax: Math.max(0, ...Object.values(catTot)), catDay,
  };
}
export function checkBadges() {
  const c = badgeCtx();
  const fresh = BADGES.filter((b) => !META.has(b.id) && !S.badges[b.id] && b.v(c) >= b.goal);
  c.count += fresh.length; // les badges « Collection » tiennent compte de ceux qui tombent maintenant
  fresh.push(...BADGES.filter((b) => META.has(b.id) && !S.badges[b.id] && b.v(c) >= b.goal));
  if (!fresh.length) return;
  const badges = { ...S.badges };
  fresh.forEach((b) => { badges[b.id] = todayKey(); });
  UI = { ...UI, newBadge: fresh[fresh.length - 1].id };
  set({ badges });
  if (!S.set.showBadges) return;
  // plusieurs badges d'un coup (import, données test) : un seul message
  if (fresh.length > 2) toast(`🏅 ${fresh.length} nouveaux badges débloqués !`);
  else fresh.forEach((b) => toast(`🏅 Nouveau badge : ${b.name}`));
}

/* ---------- Pomodoro — calcul par horodatages (juste même écran verrouillé) ----------
   pomo = { tid (tâche liée ou null), phase: 'work' | 'short' | 'long', start (ms), dur (s ; 0 = chrono libre), paused (s écoulées si en pause, 0 = prêt),
            done (sessions terminées dans le cycle), cr (secondes déjà créditées sur cette phase), flow (mode Libre) }
   Aucune punition : pause, réinitialisation ou fermeture de l'app ne font jamais rien perdre (le temps fait est toujours crédité). */
export const PHASES = { work: 'Concentration', short: 'Pause courte', long: 'Pause longue' };
const flowOn = () => S.set.pomoMode === 'flow';
const durOf = (phase) => (phase === 'work' ? (flowOn() ? 0 : S.set.pomo) : phase === 'short' ? S.set.pause : S.set.longPause) * 60;
export const pomoElapsed = (p = S.pomo, t = Date.now()) => (p.paused != null ? p.paused : (t - p.start) / 1000);
export const pomoState = () => S.pomo || { tid: null, phase: 'work', start: 0, dur: durOf('work'), paused: 0, done: 0, cr: 0, flow: flowOn() };
export const pomoRunning = () => !!S.pomo && S.pomo.paused == null;
export const pomoToday = (St = S) => (St.pomoDay.d === K(new Date(Date.now() + St.off * 864e5)) ? St.pomoDay.n : 0);

function credit(tid, sec, done, flow) {
  if (sec < 5) return;
  const m = sec / 60, k = todayKey(), now = Math.round(Date.now() / 1000);
  // journal compact : [début (s), durée (s), tâche, mode, terminée, étiquettes, titre] (titre et étiquettes gardés pour les stats)
  const tk = tid && S.tasks.find((t) => t.id === tid);
  const log = sec >= 60 ? [...S.sessions, [now - Math.round(sec), Math.round(sec), tid || null, flow ? 'f' : 'c', done ? 1 : 0, tk ? tk.tags : [], tk ? tk.text.slice(0, 40) : '', tk?.cat || null]] : S.sessions;
  set({
    tasks: tid ? S.tasks.map((t) => (t.id === tid ? { ...t, focus: r1(t.focus + m) } : t)) : S.tasks,
    fmDay: { d: k, m: r1((S.fmDay.d === k ? S.fmDay.m : 0) + m) },
    sessions: log.length > 20000 ? log.slice(-20000) : log,
  });
}
/* Crédite le temps de concentration pas encore compté (tâche liée + journée + journal) */
function creditWork(p, done) {
  if (p.phase !== 'work') return p;
  const el = p.flow ? pomoElapsed(p) : Math.min(pomoElapsed(p), p.dur), add = el - (p.cr || 0);
  if (add >= 5) { credit(p.tid, add, done, p.flow); return { ...p, cr: el }; }
  return p;
}
const fresh = (p, phase, run, start = Date.now(), dur) => ({
  ...p, phase, start, dur: dur ?? durOf(phase), paused: run ? null : 0, cr: 0, flow: phase === 'work' && flowOn(),
});

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
/* Pomodoro classique ou chrono Libre (méthode Flowtime) — mémorisé */
export function setPomoMode(mode) {
  const p = creditWork(pomoState());
  S = { ...S, set: { ...S.set, pomoMode: mode } };
  set({ pomo: { ...fresh(p, 'work', false), done: 0 } });
}
/* Phase suivante : après une concentration, pause courte (ou longue tous les N cycles) ; après une pause, concentration.
   En mode Libre, la pause proposée vaut 1/N du temps fait (réglable). */
function nextPhase(p, natural, at) {
  if (p.phase === 'work') {
    const done = p.done + (natural ? 1 : 0);
    if (p.flow) {
      const br = Math.max(60, Math.round(pomoElapsed(p) / Math.max(2, S.set.flowRatio) / 60) * 60);
      return { ...fresh(p, 'short', S.set.autoBreak, at, br), done };
    }
    const phase = done > 0 && done % S.set.cycle === 0 ? 'long' : 'short';
    return { ...fresh(p, phase, S.set.autoBreak, at), done };
  }
  return { ...fresh(p, 'work', S.set.autoWork, at), done: p.phase === 'long' ? 0 : p.done };
}
export function pomoSkip() {
  const p = creditWork(pomoState());
  set({ pomo: nextPhase(p, false) });
}
/* Mode Libre : « Terminer la session » → temps crédité, session comptée, pause proportionnelle proposée */
export function flowStop() {
  const p0 = pomoState();
  if (!p0.flow || pomoElapsed(p0) < 5) return;
  const p = creditWork(p0, true);
  const k = todayKey();
  set({ pomoDay: { d: k, n: (S.pomoDay.d === k ? S.pomoDay.n : 0) + 1 }, pomo: nextPhase(p, true) });
  checkBadges();
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
    if (p.paused != null || !p.dur || pomoElapsed(p) < p.dur) break;
    const end = p.start + p.dur * 1000;
    if (p.phase === 'work') {
      p = creditWork(p, true);
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
  if (p.phase !== 'work' || p.paused != null) p = { ...fresh(p, 'work', true), done: p.done };
  set({ pomo: p });
  setUI({ page: 4, open: null, modal: null });
}
/* « Terminer la tâche » : met le minuteur en pause et sélectionne la tâche pour validation */
export function finishFocusTask() {
  const p0 = pomoState(), tid = p0.tid;
  const p = creditWork(p0, true);
  set({ pomo: { ...p, paused: p.paused ?? pomoElapsed(p), tid: null } });
  const t = S.tasks.find((x) => x.id === tid);
  if (!t || t.done) return;
  if (!isToday(t)) setDate(tid, todayKey());
  setUI({ page: 1 });
  select(tid);
}

/* ---------- Bloc-notes de distractions ---------- */
export const addIdea = (text) => text.trim() && set({ ideas: [...S.ideas, { id: uid(), text: text.trim().slice(0, 200), at: Date.now() }] });
export const removeIdea = (id) => set({ ideas: S.ideas.filter((x) => x.id !== id) });

/* ---------- Changement de jour (minuit) ----------
   Score du jour → historique (points, priorités, concentration, étiquettes) ; tâches terminées retirées ;
   tâches non terminées reportées (compteur « carried ») ; tâches datées du nouveau jour affichées ;
   récurrences du jour ajoutées ; jokers appliqués ; badges vérifiés.
   Les jours sans ouverture de l'app sont enregistrés avec les tâches restantes (0 %). */
function entry(tasks, k, St) {
  const s = stats(tasks, k), tg = {}, cg = {}, ea = [0, 0];
  for (const t of tasks) {
    if (!t.done || !isToday(t, k)) continue;
    for (const g of t.tags) tg[g] = (tg[g] || 0) + 1;
    if (t.cat) cg[t.cat] = (cg[t.cat] || 0) + 1;
    if (t.est) { ea[0] += t.est; ea[1] += r1(t.focus || 0); }
  }
  const e = { p: s.p, d: s.c, t: s.n, pd: s.pd, pt: s.pt, pr: s.pr, prt: s.prt, fm: St.fmDay.d === k ? r1(St.fmDay.m) : 0, ps: St.pomoDay.d === k ? St.pomoDay.n : 0, tg };
  if (ea[0]) e.ea = ea;
  if (Object.keys(cg).length) e.cg = cg;
  return e;
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
  const keys = [], sess = [];
  let added = 0;
  for (let i = 365; i >= 1; i--) {
    const k = addDays(tk, -i);
    if (hist[k]) continue;
    const t = 3 + Math.floor(Math.random() * 6);
    const ws = [...Array(t)].map(() => 1 + Math.floor(Math.random() * 3));
    const pt = ws.reduce((a, b) => a + b, 0);
    const target = clamp(62 + 28 * Math.sin(i / 9) + (Math.random() - 0.5) * 50, 0, 100) / 100;
    let pd = 0, d = 0;
    const tg = {}, cg = {};
    const cats = S.cats.length ? S.cats : DEF_CATS;
    ws.forEach((w) => {
      if (Math.random() < target) {
        pd += w; d++;
        const g = tags[Math.floor(Math.random() * tags.length)].id;
        tg[g] = (tg[g] || 0) + 1;
        const c = cats[Math.floor(Math.random() ** 1.6 * cats.length)].id; // surtout Travail, Devoirs, Sport
        cg[c] = (cg[c] || 0) + 1;
      }
    });
    const prt = Math.min(3, t, Math.floor(Math.random() * 4));
    const pr = Math.min(prt, Math.round(prt * target + (Math.random() - 0.5)));
    const fm = Math.random() < 0.7 ? Math.round(15 + Math.random() * 110) : 0;
    hist[k] = { p: Math.round((pd / pt) * 100), d, t, pd, pt, pr: Math.max(0, pr), prt, fm, tg, ps: Math.round(fm / 25), ...(d ? { cg } : {}) };
    if (fm && Math.random() < 0.5) hist[k].ea = [Math.round(fm * (0.75 + Math.random() * 0.4)), fm];
    // journal de sessions cohérent avec les minutes du jour (pics le matin et en début d'après-midi)
    const day0 = parseK(k).getTime() / 1000 - S.off * 864e2;
    for (let left = fm; left > 0;) {
      const len = Math.min(left, Math.random() < 0.8 ? 25 : 40 + Math.round(Math.random() * 30));
      const h = [8, 9, 9, 10, 10, 11, 14, 14, 15, 16, 17, 20, 21][Math.floor(Math.random() * 13)];
      const gids = Object.keys(tg), g1 = gids.length ? [gids[Math.floor(Math.random() * gids.length)]] : [];
      const title = ['Rapport trimestriel', 'Réviser l’anglais', 'Lecture', 'Préparer la présentation', 'Code du projet', 'Mails'][Math.floor(Math.random() * 6)];
      const cids = Object.keys(cg), c1 = cids.length ? cids[Math.floor(Math.random() * cids.length)] : null;
      sess.push([Math.round(day0 + h * 3600 + Math.random() * 1800), len * 60, null, len > 25 ? 'f' : 'c', 1, g1, title, c1]);
      left -= len;
    }
    keys.push(k);
    added += d;
  }
  applyJokers(hist, keys, S.set);
  const g = (n) => tags.find((x) => x.name === n)?.id;
  const ex = (text, date, weight, prio, tg, more = {}) => ({ id: uid(), text, done: false, date, weight, prio, tags: tg.filter(Boolean), subs: [], carried: 0, focus: 0, est: 0, time: null, cat: null, ...more });
  const pc = prioCount(S.tasks, tk);
  const samples = [
    ex('Séance de sport', tk, 2, pc < 3, [g('Sport')], { cat: 'c-sport',
      subs: [{ id: uid(), text: 'Échauffement', done: true }, { id: uid(), text: 'Course 5 km', done: false }, { id: uid(), text: 'Étirements', done: false }], focus: 25, est: 45, time: '18:30',
    }),
    ex('Répondre aux mails importants', tk, 1, false, [g('Travail')], { cat: 'c-travail', carried: 3, est: 20, time: '09:00' }),
    ex('Lire 20 pages', tk, 1, false, [g('Lecture')], { cat: 'c-perso', carried: 1, est: 30 }),
    ex('Rapport trimestriel', tk, 3, false, [g('Travail')], { cat: 'c-travail', est: 90, focus: 40, time: '10:00' }),
    ex('Appeler le plombier', tk, 1, false, [g('Maison')], { cat: 'c-maison', time: '10:30' }),
    ex('Préparer la réunion', addDays(tk, 1), 3, true, [g('Travail')], { cat: 'c-travail', est: 60, time: '14:00' }),
    ex('Rendez-vous dentiste', addDays(tk, 3), 1, false, [], { cat: 'c-sante' }),
    ex('Ranger le garage', null, 3, false, [g('Maison')], { cat: 'c-maison' }),
  ];
  const ideas = [...S.ideas, { id: uid(), text: 'Acheter des piles demain #maison', at: Date.now() }, { id: uid(), text: 'Idée d’article sur la concentration', at: Date.now() }];
  samples.forEach((x) => { if (!catOf(x.cat)) x.cat = null; });
  set({ hist, tags, tasks: [...S.tasks, ...samples], doneTotal: S.doneTotal + added, sessions: purgeSessions([...S.sessions, ...sess].sort((a, b) => a[0] - b[0])), ideas });
  checkBadges();
  toast('Données de test générées : 365 jours, sessions, estimations, heures et idées. Ouvrez « Ma Progression ».');
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
