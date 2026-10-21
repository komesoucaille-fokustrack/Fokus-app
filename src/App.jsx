import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Header from './components/Header';
import ProgressCard from './components/ProgressCard';
import TaskList, { TagChip } from './components/TaskList';
import QuickAdd from './components/QuickAdd';
import ValidateButton from './components/ValidateButton';
import Settings from './components/Settings';
import Search from './components/Search';
import MorningTriage from './components/MorningTriage';
import WeeklyReview from './components/WeeklyReview';
import Pomodoro from './components/Pomodoro';
import Upcoming from './components/Upcoming';
import Hello from './components/Hello';
import Ambiance from './components/Ambiance';
import { getColorForPercentage } from './lib/colors';
import { race, canAnimate, skip } from './cinematic/engine';
import { celebrate } from './lib/celebrate';
import { addDays, mondayOf } from './lib/dates';
import { buzz, notify, setBadge } from './lib/notify';
import { chime } from './lib/sound';
import {
  afterValidate, cardText, carriedTasks, checkDay, dismissToast, exportReminder, gainOf, generateTestData, getState, getUI, markSeen,
  moveCarried, needsMorning, needsWeekly, pomoElapsed, pomoTick, scoreFmt, selPoints, setBusy, setModal, setOpen, setPage, setTagFilter,
  simulateMidnight, sortTasks, stats, toast, toastAction, todayKey, todayTasks, useStore, validateSelection, PHASES,
} from './store';

const Scene3D = lazy(() => import('./cinematic/Scene3D'));
const StatsPage = lazy(() => import('./components/StatsPage'));

/* Si WebGL est indisponible, l'app reste utilisable (animation DOM seule) */
class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('Scène 3D désactivée :', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/* Écrans proposés à l'ouverture : minuteur en cours, tri du matin, puis bilan de la semaine */
function prompts() {
  const S = getState(), UI = getUI();
  if (UI.modal || UI.busy) return;
  if (S.pomo && S.pomo.paused == null && UI.page !== 4) { setPage(4); return; }
  if (needsMorning()) { markSeen('morning'); return setModal('morning'); }
  if (needsWeekly()) { markSeen('weekly', mondayOf(todayKey())); return setModal('weekly'); }
}

/* Rappel du soir (notification locale, une fois par jour, seulement s'il reste des tâches) */
function eveningReminder() {
  const S = getState();
  if (!S.set.remind || S.seen.remind === todayKey()) return;
  const d = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (hm < S.set.remindAt) return;
  const s = stats(), left = s.n - s.c;
  markSeen('remind');
  if (left > 0) notify('Fokus', `Il te reste ${left} tâche${left > 1 ? 's' : ''}, ${s.p} % aujourd’hui.`);
}

/* Pomodoro : fait avancer les phases où que l'on soit dans l'app (son, vibration, notification) + titre de l'onglet */
function usePomodoro() {
  useEffect(() => {
    const step = () => {
      const S = getState();
      const ended = pomoTick();
      if (ended) {
        if (S.set.sound) chime(ended);
        buzz(200);
        const msg = ended === 'work' ? 'Session terminée, place à la pause.' : 'Pause terminée, on s’y remet ?';
        if (S.set.pomoNotif && document.hidden) notify('Fokus — Pomodoro', msg);
        else toast((ended === 'work' ? '🍅 ' : '☕ ') + msg);
      }
      const p = getState().pomo;
      if (p && p.paused == null) {
        const left = Math.max(0, Math.ceil(p.dur - pomoElapsed(p)));
        document.title = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')} · ${PHASES[p.phase]} — Fokus`;
      } else if (!document.title.startsWith('Fokus')) document.title = 'Fokus — Tâches & Performance';
    };
    const iv = setInterval(step, 1000);
    document.addEventListener('visibilitychange', step);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', step); };
  }, []);
}

/* Changement de jour automatique à minuit (+ contrôle régulier et au retour sur l'app) */
function useMidnight() {
  useEffect(() => {
    let timer;
    const tick = () => { if (checkDay()) prompts(); eveningReminder(); };
    const arm = () => {
      const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { tick(); arm(); }, next - n);
    };
    arm();
    const iv = setInterval(tick, 30000);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(timer); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, []);
}

/* Action groupée : « Déplacer toutes les tâches reportées vers… » */
function CarriedBar() {
  const [open, setOpenBar] = useState(false);
  const n = carriedTasks().length;
  if (!n) return null;
  const today = todayKey();
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[13px] text-mut">
      <button className="ic px-2! py-2!" onClick={() => setOpenBar((o) => !o)}>↪ {n} tâche{n > 1 ? 's' : ''} reportée{n > 1 ? 's' : ''} · Déplacer vers…</button>
      {open && (
        <span className="flex flex-wrap gap-1.5">
          <button className="seg" onClick={() => { moveCarried(addDays(today, 1)); setOpenBar(false); }}>Demain</button>
          <button className="seg" onClick={() => { moveCarried(null); setOpenBar(false); }}>Plus tard</button>
          <label className="seg relative">📅 Choisir une date
            <input type="date" min={addDays(today, 1)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* non supporté */ } }}
              onChange={(e) => { if (e.target.value) { moveCarried(e.target.value); setOpenBar(false); } }} />
          </label>
        </span>
      )}
    </div>
  );
}

export default function App() {
  const { S, UI } = useStore();
  const s = stats(S.tasks);
  const text = cardText(S);
  const [load3D, setLoad3D] = useState(false);
  const hello = useRef(null), card = useRef(null), form = useRef(null), list = useRef(null), tools = useRef(null), dim = useRef(null), skipBtn = useRef(null), input = useRef(null);
  useMidnight();
  usePomodoro();
  const fmt = scoreFmt(S);

  // Charge la scène 3D en arrière-plan (shaders précompilés avant le premier « Valider »)
  useEffect(() => { const t = setTimeout(() => setLoad3D(true), 250); return () => clearTimeout(t); }, []);

  // Tri du matin / bilan de la semaine / minuteur en cours, puis rappel d'export (tous les 7 jours)
  useEffect(() => {
    const a = setTimeout(prompts, 450), b = setTimeout(exportReminder, 2500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  // après le tri du matin, enchaîne éventuellement sur le bilan de la semaine
  const closeModal = () => { const m = getUI().modal; setModal(null); if (m === 'morning') setTimeout(prompts, 350); };

  // Pastille sur l'icône : nombre de tâches restantes aujourd'hui
  useEffect(() => { setBadge(s.n - s.c); }, [s.n, s.c]);

  // Bloque le défilement pendant la cinématique
  useEffect(() => {
    if (!UI.busy) return;
    const stop = (e) => e.preventDefault();
    addEventListener('wheel', stop, { passive: false });
    addEventListener('touchmove', stop, { passive: false });
    return () => { removeEventListener('wheel', stop); removeEventListener('touchmove', stop); };
  }, [UI.busy]);

  const page = useRef(null);
  useLayoutEffect(() => {
    if (page.current) gsap.from(page.current, { opacity: 0, y: 10, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [UI.page]);

  const validate = () => {
    if (!UI.sel.size || UI.busy) return;
    const { old, nw, ids } = validateSelection();
    const c = card.current, txt = cardText(getState());
    // la face 3D est relevée sur le DOM avant le rendu React : on y met déjà les textes à jour
    if (c.label.firstChild) c.label.firstChild.nodeValue = txt.label;
    const subText = txt.sub;
    // les deux animations sont indépendantes (réglables via le rouage) : barre 3D et/ou confettis à 100 %
    const confettiAt100 = S.confetti && nw >= 100 && old < 100;
    if (S.anim && canAnimate() && old !== nw) {
      // la carte doit être visible au moment du décollage (liste longue, panneau ouvert…)
      const r = c.card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) scrollTo({ top: 0, behavior: 'instant' });
      setBusy(true);
      race(
        { ...c, subText, bg: [document.getElementById('hdr'), hello.current, form.current, tools.current], list: list.current, dim: dim.current, skip: skipBtn.current, canvas: document.getElementById('scene3d') },
        old, nw, () => { setBusy(false); afterValidate(ids); }, { confetti: confettiAt100, fmt: scoreFmt(getState()) },
      );
    } else {
      requestAnimationFrame(() => c.paintBar(nw, true));
      if (confettiAt100) setTimeout(celebrate, 350);
      afterValidate(ids);
    }
  };
  const validateRef = useRef(validate);
  validateRef.current = validate;

  // Raccourcis clavier : N = nouvelle tâche, / = recherche, Entrée = valider la sélection, Échap = fermer
  useEffect(() => {
    const key = (e) => {
      const U = getUI();
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (U.modal) { closeModal(); return; }
        if (typing) { e.target.blur(); return; }
        if (U.open) setOpen(U.open);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || U.busy || U.modal) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setPage(1); setTimeout(() => input.current?.focus(), 30); }
      else if (e.key === '/') { e.preventDefault(); setModal('search'); }
      else if (e.key === 'Enter' && U.sel.size && e.target.tagName !== 'BUTTON') { e.preventDefault(); validateRef.current(); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  // Liste du jour : priorités en tête (liseré blanc), puis l'ordre choisi ; filtre par étiquette
  const today = todayTasks(S.tasks);
  const usedTags = S.tags.filter((g) => today.some((t) => t.tags.includes(g.id)));
  const shown = sortTasks(UI.tag ? today.filter((t) => t.tags.includes(UI.tag)) : today);
  const visibleSel = UI.page === 1 ? UI.sel.size : 0;

  return (
    <>
      <Ambiance S={S} />
      <div id="grain" aria-hidden="true" />

      {UI.update && (
        <div className="fixed inset-x-0 top-0 z-[300] flex items-center justify-center gap-3 border-b border-line bg-cont/95 px-4 py-2.5 text-[14px] backdrop-blur" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
          Nouvelle version disponible
          <button className="b on py-1.5!" onClick={() => { const w = UI.update.waiting; if (w) w.postMessage({ type: 'SKIP_WAITING' }); else location.reload(); }}>Recharger</button>
        </div>
      )}

      <Header />

      <main className="relative z-[1] mx-auto max-w-[760px] px-4 py-[22px] lg:max-w-[1040px] lg:px-8">
        {UI.page === 1 ? (
          <section ref={page} key="p1" className="relative">
            <Hello ref={hello} S={S} />
            <div className={'aura ' + (UI.busy ? 'off' : '')} style={{ '--aura': getColorForPercentage(s.p) }} aria-hidden="true" />
            <ProgressCard ref={card} s={s} text={text} busy={UI.busy} fmt={fmt} />
            <div ref={form}>
              <QuickAdd ref={input} allowRec placeholder="Ajouter une tâche… (ex. « Sport demain #santé »)" />
            </div>
            <div ref={list}>
              {usedTags.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <button className={'tag ' + (!UI.tag ? 'all on' : 'all')} onClick={() => setTagFilter(null)}>Toutes</button>
                  {usedTags.map((g) => <TagChip key={g.id} tag={g} on={!UI.tag || UI.tag === g.id} onClick={() => setTagFilter(g.id)} />)}
                </div>
              )}
              <CarriedBar />
              <TaskList tasks={shown} sel={UI.sel} busy={UI.busy} empty={UI.tag ? 'Aucune tâche avec cette étiquette aujourd’hui.' : undefined} />
            </div>
            <div ref={tools} className="mt-[30px] flex flex-wrap items-center justify-center gap-2">
              <button className="b text-[13px] text-mut" onClick={() => { simulateMidnight(); setTimeout(prompts, 400); }}>Simuler minuit / Jour suivant (Mode Test)</button>
              <button className="b text-[13px] text-mut" onClick={generateTestData}>Générer données test</button>
              <button className="b text-[13px] text-mut" onClick={() => setModal('weekly')}>Bilan de la semaine</button>
            </div>
          </section>
        ) : UI.page === 3 ? (
          <div ref={page} key="p3"><Upcoming /></div>
        ) : UI.page === 4 ? (
          <div ref={page} key="p4"><Pomodoro /></div>
        ) : (
          <div ref={page} key="p2"><Suspense fallback={<div className="card h-[420px]" />}><StatsPage S={S} /></Suspense></div>
        )}
      </main>

      <ValidateButton
        k={visibleSel} onClick={validate}
        gain={!visibleSel ? '' : S.set.scoreMode === 'pts' ? `${selPoints(UI.sel)} pt${selPoints(UI.sel) > 1 ? 's' : ''}` : `${gainOf(UI.sel)}%`}
      />

      {UI.modal === 'settings' && <Settings />}
      {UI.modal === 'search' && <Search onClose={closeModal} />}
      {UI.modal === 'morning' && <MorningTriage onClose={closeModal} />}
      {UI.modal === 'weekly' && <WeeklyReview onClose={closeModal} />}

      <div id="dim" ref={dim} />
      {load3D && <Guard><Suspense fallback={null}><Scene3D /></Suspense></Guard>}
      <button className="b" id="skip" ref={skipBtn} onClick={(e) => { skip(); e.currentTarget.classList.remove('on'); }}>Passer l’animation ⏭</button>

      <div
        className={'fixed left-1/2 z-[200] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-cont/95 py-2 pr-2 pl-5 text-sm shadow-2xl backdrop-blur transition-all duration-500 ease-spring '
          + (UI.toast ? 'opacity-100 ' : 'pointer-events-none translate-y-4 opacity-0 ') + (UI.toast?.action ? '' : 'pr-5! py-2.5! pointer-events-none')}
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
        role="status"
      >
        <span className="min-w-0">{UI.toast?.msg}</span>
        {UI.toast?.action && (
          <>
            <button className="b on shrink-0 py-1.5!" onClick={toastAction}>{UI.toast.action.label}</button>
            <button className="ic shrink-0" onClick={dismissToast} aria-label="Fermer">✕</button>
          </>
        )}
      </div>
    </>
  );
}
