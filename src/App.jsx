import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Header from './components/Header';
import ProgressCard from './components/ProgressCard';
import TaskList, { TagChip } from './components/TaskList';
import QuickAdd from './components/QuickAdd';
import ValidateButton from './components/ValidateButton';
import Upcoming from './components/Upcoming';
import Hello from './components/Hello';
import Ambiance from './components/Ambiance';
import DayStrip from './components/DayStrip';
import { getColorForPercentage, setPalette } from './lib/colors';
import { StyleCard } from './components/Style';
import { useFocusLock } from './lib/lock';
import { startCalendars } from './lib/calendars';
import { LABO } from './env';
import { race, canAnimate, skip } from './cinematic/engine';
import { celebrate } from './lib/celebrate';
import { addDays, mondayOf } from './lib/dates';
import { buzz, notify, setBadge } from './lib/notify';
import { chime } from './lib/sound';
import { keepAmbient, playAmbient, previewing, stopAmbient } from './lib/ambient';
import { usePushSync } from './lib/pushSync';
import {
  afterValidate, cardText, carriedTasks, checkDay, dismissToast, exportReminder, gainOf, generateTestData, getState, getUI, markSeen,
  moveCarried, needsMorning, zenOn, needsWeekly, pomoElapsed, pomoTick, scoreFmt, selPoints, setBusy, setModal, setOpen, setPage, setTagFilter, setCatFilter,
  openSettings, setSetting, simulateMidnight, sortTasks, stats, toast, toastAction, todayKey, todayTasks, useStore, validateSelection, PHASES,
} from './store';
import Icon from './components/Icons';
import { CatChip } from './components/Categories';
import Welcome from './components/Welcome';
import { CloudChoice } from './components/Account';

const Scene3D = lazy(() => import('./cinematic/Scene3D'));
const StatsPage = lazy(() => import('./components/StatsPage'));
// chargés seulement quand on en a besoin (page Pomodoro, Réglages, fenêtres…) : ouverture de l'app plus rapide
const Pomodoro = lazy(() => import('./components/Pomodoro'));
const Settings = lazy(() => import('./components/Settings'));
const Search = lazy(() => import('./components/Search'));
const MorningTriage = lazy(() => import('./components/MorningTriage'));
const WeeklyReview = lazy(() => import('./components/WeeklyReview'));
const Overload = lazy(() => import('./components/Overload'));
const Timeline = lazy(() => import('./components/Timeline'));
const Mine = lazy(() => import('./components/Mine'));
const EveningRitual = lazy(() => import('./components/EveningRitual'));
const TITLE = document.title; // titre de index.html (référencement), remis quand le minuteur s'arrête

/* Si WebGL est indisponible, l'app reste utilisable (animation DOM seule) */
class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('Scène 3D désactivée :', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/* Écrans proposés à l'ouverture : minuteur en cours, tri du matin, puis bilan de la semaine */
function prompts(startup) {
  const S = getState(), UI = getUI();
  if (UI.modal || UI.busy) return;
  if (startup === true && S.pomo && S.pomo.paused == null && UI.page !== 4) { setPage(4); return; }
  if (startup !== 'evening' && needsMorning()) { markSeen('morning'); return setModal('morning'); }
  if (startup !== 'evening' && needsWeekly()) { markSeen('weekly', mondayOf(todayKey())); return setModal('weekly'); }
  // rituel du soir : proposé une fois, à partir de l'heure choisie
  const n = new Date(), hm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  if (S.set.evening && S.seen.evening !== todayKey() && hm >= S.set.eveningAt && todayTasks().length) return setModal('evening');
}

/* Rappel du soir (notification locale, une fois par jour, seulement s'il reste des tâches) */
function eveningReminder() {
  const S = getState();
  if (!S.set.remind || S.set.push || S.seen.remind === todayKey()) return; // avec le push, le serveur s'en charge
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
        if (S.set.pomoNotif && document.hidden && !S.set.push) notify('Fokus — Pomodoro', msg);
        else toast((ended === 'work' ? '⏱️ ' : '☕ ') + msg);
      }
      const p = getState().pomo;
      if (p && p.paused == null) {
        const left = Math.max(0, Math.ceil(p.dur - pomoElapsed(p)));
        document.title = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')} · ${PHASES[p.phase]} — Fokus`;
      } else if (document.title !== TITLE) document.title = TITLE;
    };
    const iv = setInterval(step, 1000);
    document.addEventListener('visibilitychange', step);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', step); };
  }, []);
}

/* Sons d'ambiance : pendant la concentration (et la pause si réglé), où que l'on soit dans l'app */
function useAmbient(S) {
  const p = S.pomo, st = S.set;
  const on = st.ambient !== 'none' && p && p.paused == null && (p.phase === 'work' || !st.ambMute);
  useEffect(() => {
    if (on) { keepAmbient(); playAmbient(st.ambient, st.ambVol); } else if (!previewing()) stopAmbient();
  }, [on, st.ambient, st.ambVol]);
  // (iPad : l'audio est débloqué / relancé à chaque geste par lib/sound.js)
}

/* Changement de jour automatique à minuit (+ contrôle régulier et au retour sur l'app) */
function useMidnight() {
  useEffect(() => {
    let timer;
    // en cours d'utilisation, seul le rituel du soir peut s'ouvrir (à partir de l'heure choisie)
    const tick = () => { if (checkDay()) prompts(); else if (!document.hidden) prompts('evening'); eveningReminder(); };
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
  if (!n || zenOn()) return null; // Tranquille : les reports ne sont pas signalés
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
  setPalette(S.set.style); // Tranquille : couleurs douces (barre, lueur, cinématique, calendrier)
  const s = stats(S.tasks);
  const text = cardText(S);
  const [load3D, setLoad3D] = useState(false);
  const hello = useRef(null), strip = useRef(null), card = useRef(null), form = useRef(null), list = useRef(null), tools = useRef(null), dim = useRef(null), skipBtn = useRef(null), input = useRef(null);
  useMidnight();
  usePomodoro();
  usePushSync();
  useFocusLock();
  useEffect(() => { if ((getState().set.cals || []).length) startCalendars(); }, [S.set.cals]);
  useAmbient(S);
  const fmt = scoreFmt(S);

  // Charge la scène 3D en arrière-plan (shaders précompilés avant le premier « Valider »)
  // La scène 3D (1 Mo) se charge quand l'app est au repos — jamais pendant que l'on tape —, et tout de suite dès qu'une
  // tâche est cochée (le « Valider » arrive). Puis les autres écrans sont préparés en douce : navigation instantanée.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    const h = idle(() => {
      setLoad3D(true);
      idle(() => { import('./components/Pomodoro'); import('./components/Settings'); import('./components/StatsPage'); import('./components/Timeline'); }, { timeout: 6000 });
    }, { timeout: 2500 });
    return () => (window.cancelIdleCallback || clearTimeout)(h);
  }, []);
  useEffect(() => { if (UI.sel.size) setLoad3D(true); }, [UI.sel.size]);

  // Ouverture depuis une notification : ?page=4 (Pomodoro), ?ritual=evening (fermer ma journée)
  useEffect(() => {
    const go = (u) => {
      const q = new URL(u, location.href).searchParams;
      if (q.get('page')) setPage(+q.get('page') || 1);
      if (q.get('ritual') === 'evening') setTimeout(() => setModal('evening'), 300);
    };
    go(location.href);
    if (location.search.match(/page=|ritual=/)) history.replaceState(null, '', location.pathname);
    const msg = (e) => { if (e.data?.type === 'open') go(e.data.url); };
    navigator.serviceWorker?.addEventListener('message', msg);
    return () => navigator.serviceWorker?.removeEventListener('message', msg);
  }, []);

  // Tri du matin / bilan de la semaine / minuteur en cours, puis rappel d'export (tous les 7 jours)
  useEffect(() => {
    const a = setTimeout(() => prompts(true), 450), b = setTimeout(exportReminder, 2500);
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
        { ...c, subText, bg: [document.getElementById('hdr'), hello.current, strip.current, form.current, tools.current].filter(Boolean), list: list.current, dim: dim.current, skip: skipBtn.current, canvas: document.getElementById('scene3d') },
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
  const usedCats = S.cats.filter((c) => today.some((t) => t.cat === c.id));
  const shown = sortTasks(today.filter((t) => (!UI.tag || t.tags.includes(UI.tag)) && (!UI.cat || t.cat === UI.cat)));
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
      {LABO && <a className="labo-pill" href="../" title="Version d’essai : données à part. Toucher pour revenir à l’app.">🧪 Labo · version d’essai</a>}

      <main className="relative z-[1] mx-auto max-w-[760px] px-4 py-[22px] lg:max-w-[1040px] lg:px-8">
        {UI.page === 1 ? (
          <section ref={page} key="p1" className="relative">
            <StyleCard />
            <Welcome />
            <Hello ref={hello} S={S} />
            <div className={'aura ' + (UI.busy ? 'off' : '')} style={{ '--aura': getColorForPercentage(s.p) }} aria-hidden="true" />
            <ProgressCard ref={card} s={s} text={text} busy={UI.busy} fmt={fmt} />
            <DayStrip ref={strip} S={S} />
            <div ref={form}>
              <QuickAdd ref={input} allowRec placeholder={innerWidth < 560 ? "Nouvelle tâche… (ex. « Sport demain »)" : "Ajouter une tâche… (ex. « Sport demain #santé »)"} />
            </div>
            <div ref={list}>
              {usedCats.length + usedTags.length > 0 && (
                <div className="filters mb-3 flex flex-wrap items-center gap-1.5">
                  <button className={'tag ' + (!UI.tag && !UI.cat ? 'all on' : 'all')} onClick={() => { if (UI.tag) setTagFilter(UI.tag); if (UI.cat) setCatFilter(UI.cat); }}>Toutes</button>
                  {usedCats.map((c) => <CatChip key={c.id} cat={c} count={today.filter((t) => t.cat === c.id && !t.done).length || null} on={!UI.cat || UI.cat === c.id} onClick={() => setCatFilter(c.id)} />)}
                  {usedCats.length > 0 && usedTags.length > 0 && <i className="fsep" aria-hidden="true" />}
                  {usedTags.map((g) => <TagChip key={g.id} tag={g} on={!UI.tag || UI.tag === g.id} onClick={() => setTagFilter(g.id)} />)}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CarriedBar />
                <span className="viewseg ml-auto" role="group" aria-label="Affichage">
                  <button className={S.set.planView !== 'timeline' ? 'on' : ''} onClick={() => setSetting('planView', 'list')}>Liste</button>
                  <button className={S.set.planView === 'timeline' ? 'on' : ''} onClick={() => setSetting('planView', 'timeline')}>Chronologie</button>
                  <button onClick={() => setModal('evening')} title="Fermer ma journée" aria-label="Fermer ma journée">🌙</button>
                </span>
              </div>
              {S.set.planView === 'timeline'
                ? <Suspense fallback={<div className="min-h-[60vh]" />}><Timeline tasks={shown} sel={UI.sel} busy={UI.busy} /></Suspense>
                : <TaskList tasks={shown} sel={UI.sel} busy={UI.busy} empty={UI.cat ? 'Aucune tâche de cette catégorie aujourd’hui.' : UI.tag ? 'Aucune tâche avec cette étiquette aujourd’hui.' : undefined} />}
            </div>
            <div ref={tools} className="mt-[30px] flex flex-wrap items-center justify-center gap-2">
              {S.set.testTools !== false && (
                <>
                  <button className="b text-[13px] text-mut" onClick={() => { simulateMidnight(); setTimeout(prompts, 400); }}>Simuler minuit / Jour suivant (Mode Test)</button>
                  <button className="b text-[13px] text-mut" onClick={generateTestData}>Générer données test</button>
                </>
              )}
              <button className="b text-[13px] text-mut" onClick={() => setModal('weekly')}>Bilan de la semaine</button>
            </div>
            <footer className="site-foot">
              <b>Fokus Track</b> — tâches du jour, minuteur Pomodoro et suivi de progression. Gratuit et sans pub.
              <span><a href="./decouvrir/">Découvrir Fokus</a> · <a href="./pomodoro/">Le minuteur Pomodoro</a> · <a href="#contact" onClick={(e) => { e.preventDefault(); openSettings('contact'); }}>Contact</a></span>
            </footer>
          </section>
        ) : UI.page === 3 ? (
          <div ref={page} key="p3"><Upcoming /></div>
        ) : UI.page === 5 && S.set.mine !== false ? (
          <div ref={page} key="p5"><Suspense fallback={<div className="mine-stage" />}><Mine /></Suspense></div>
        ) : UI.page === 4 ? (
          <div ref={page} key="p4"><Suspense fallback={<div className="stage-ph" />}><Pomodoro /></Suspense></div>
        ) : (
          <div ref={page} key="p2"><Suspense fallback={<div className="card h-[420px]" />}><StatsPage S={S} /></Suspense></div>
        )}
      </main>

      <CloudChoice />
      <ValidateButton
        k={visibleSel} onClick={validate}
        gain={!visibleSel ? '' : zenOn(S) ? '🌿' : S.set.scoreMode === 'pts' ? `+${selPoints(UI.sel)} pt${selPoints(UI.sel) > 1 ? 's' : ''}` : `+${gainOf(UI.sel)}%`}
      />

      <Suspense fallback={null}>
        {UI.modal === 'settings' && <Settings />}
        {UI.modal === 'search' && <Search onClose={closeModal} />}
        {UI.modal === 'morning' && <MorningTriage onClose={closeModal} />}
        {UI.modal === 'weekly' && <WeeklyReview onClose={closeModal} />}
        {UI.modal === 'overload' && <Overload onClose={closeModal} />}
        {UI.modal === 'evening' && <EveningRitual onClose={closeModal} />}
      </Suspense>

      <div id="dim" ref={dim} />
      {load3D && <Guard><Suspense fallback={null}><Scene3D /></Suspense></Guard>}
      <button className="b" id="skip" ref={skipBtn} onClick={(e) => { skip(); e.currentTarget.classList.remove('on'); }}>Passer l’animation ⏭</button>

      <div
        className={'fixed left-1/2 z-[200] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-cont/95 py-2 pr-2 pl-5 text-sm shadow-2xl backdrop-blur transition-all duration-500 ease-spring '
          + (UI.toast ? 'opacity-100 ' : 'pointer-events-none translate-y-4 opacity-0 ') + (UI.toast?.action ? '' : 'pr-5! py-2.5! pointer-events-none')}
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
        role="status"
      >
        <span className="toast-msg min-w-0">{UI.toast?.icon && <Icon name={UI.toast.icon} size={17} />}{UI.toast?.msg}</span>
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
