import { useSyncExternalStore } from 'react';
import { K, parseK } from './lib/dates';
import { clamp } from './lib/colors';

/* ---------- État persistant (compatible avec l'ancien index.html) ---------- */
const KEY = 'focus_state';
const DEF = { tasks: [], rec: [], hist: {}, last: '', off: 0, anim: true, confetti: true };

function load() {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; }
}

let S = load();
/* État d'interface (non persisté) */
let UI = { sel: new Set(), busy: false, page: 1, toast: '' };

const listeners = new Set();
let snapshot = { S, UI };
const emit = () => { snapshot = { S, UI }; listeners.forEach((l) => l()); };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* stockage indisponible */ } };

function set(patch) { S = { ...S, ...patch }; save(); emit(); }
function setUI(patch) { UI = { ...UI, ...patch }; emit(); }

export const getState = () => S;
export const getUI = () => UI;
export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot);
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const now = () => new Date(Date.now() + S.off * 864e5);
export function stats(tasks = S.tasks) {
  const n = tasks.length, c = tasks.filter((t) => t.done).length;
  return { n, c, p: n ? Math.round((c / n) * 100) : 0 };
}

/* ---------- Tâches ---------- */
export function addTask(text) { set({ tasks: [...S.tasks, { id: uid(), text, done: false }] }); }
export function editTask(id, text) { set({ tasks: S.tasks.map((t) => (t.id === id ? { ...t, text } : t)) }); }
export function deleteTask(id) {
  if (UI.sel.has(id)) { const sel = new Set(UI.sel); sel.delete(id); UI = { ...UI, sel }; }
  set({ tasks: S.tasks.filter((t) => t.id !== id) });
}
export function moveTask(id, to) {
  const i = S.tasks.findIndex((t) => t.id === id);
  if (i < 0) return;
  const j = clamp(typeof to === 'function' ? to(i, S.tasks.length) : to, 0, S.tasks.length - 1);
  if (i === j) return;
  const tasks = [...S.tasks];
  const [t] = tasks.splice(i, 1);
  tasks.splice(j, 0, t);
  set({ tasks });
}
export const MOVES = {
  top: () => 0,
  up: (i) => i - 1,
  dn: (i) => i + 1,
  bot: (i, n) => n - 1,
};
export function toggleSel(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t || t.done || UI.busy) return;
  const sel = new Set(UI.sel);
  sel.has(id) ? sel.delete(id) : sel.add(id);
  setUI({ sel });
}
/* Valide la sélection ; renvoie l'ancien et le nouveau pourcentage */
export function validateSelection() {
  const old = stats().p;
  const tasks = S.tasks.map((t) => (UI.sel.has(t.id) ? { ...t, done: true } : t));
  UI = { ...UI, sel: new Set() };
  set({ tasks });
  return { old, nw: stats().p };
}
export const setBusy = (busy) => setUI({ busy });
export const setPage = (page) => setUI({ page });
export const setAnim = (anim) => set({ anim });
export const setConfetti = (confetti) => set({ confetti });

let toastTimer;
export function toast(msg) {
  clearTimeout(toastTimer);
  setUI({ toast: msg });
  toastTimer = setTimeout(() => setUI({ toast: '' }), 3200);
}

/* ---------- Tâches récurrentes ---------- */
const withRec = (tasks, rec) => {
  const out = [...tasks];
  rec.forEach((r) => { if (!out.some((t) => t.rid === r.id)) out.push({ id: uid(), text: r.text, done: false, rid: r.id }); });
  return out;
};
export function addRec(text) {
  const rec = [...S.rec, { id: uid(), text }];
  set({ rec, tasks: withRec(S.tasks, rec) });
}
export function deleteRec(id) { set({ rec: S.rec.filter((r) => r.id !== id) }); }

/* ---------- Changement de jour (minuit) ----------
   Score du jour → historique, tâches réalisées retirées, tâches non réalisées reportées,
   tâches récurrentes ajoutées. Les jours sans ouverture de l'app sont enregistrés à 0 %. */
export function checkDay() {
  if (UI.busy) return false;
  const tk = K(now());
  if (!S.last) { set({ last: tk, tasks: withRec(S.tasks, S.rec) }); return false; }
  if (S.last >= tk) return false;
  const hist = { ...S.hist };
  const d = parseK(S.last);
  let i = 0;
  while (K(d) < tk && i++ < 800) {
    if (i === 1) { const s = stats(); hist[K(d)] = { p: s.p, d: s.c, t: s.n }; } else hist[K(d)] = { p: 0, d: 0, t: 0 };
    d.setDate(d.getDate() + 1);
  }
  UI = { ...UI, sel: new Set() };
  set({ hist, last: tk, tasks: withRec(S.tasks.filter((t) => !t.done), S.rec) });
  return true;
}
export function simulateMidnight() {
  if (UI.busy) return;
  S = { ...S, off: S.off + 1 };
  checkDay();
  toast('Nouveau jour : tâches réalisées archivées, tâches restantes reportées.');
}
export function generateTestData() {
  const n = now(), hist = { ...S.hist };
  for (let i = 1; i <= 365; i++) {
    const k = K(new Date(n.getFullYear(), n.getMonth(), n.getDate() - i));
    if (hist[k]) continue;
    const t = 3 + Math.floor(Math.random() * 6);
    const p = clamp(55 + 28 * Math.sin(i / 9) + (Math.random() - 0.5) * 50, 0, 100);
    const dn = Math.round((p / 100) * t);
    hist[k] = { p: Math.round((dn / t) * 100), d: dn, t };
  }
  set({ hist });
  toast('Données de test générées (365 jours). Ouvrez « Ma Progression ».');
}

/* ---------- Export / Import ---------- */
export function exportJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'Fokus', ...S }, null, 2)], { type: 'application/json' }));
  a.download = 'fokus-sauvegarde-' + K(new Date()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function importJSON(text) {
  const o = JSON.parse(text);
  if (!Array.isArray(o.tasks) || typeof o.hist !== 'object') throw new Error('invalid');
  delete o.app;
  S = { ...DEF, ...o };
  UI = { ...UI, sel: new Set() };
  save();
  checkDay();
  emit();
}
