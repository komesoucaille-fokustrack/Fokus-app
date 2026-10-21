import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Header from './components/Header';
import ProgressCard from './components/ProgressCard';
import TaskList from './components/TaskList';
import ValidateButton from './components/ValidateButton';
import RecurringModal from './components/RecurringModal';
import { race, canAnimate, skip } from './cinematic/engine';
import { celebrate } from './lib/celebrate';
import { addTask, checkDay, generateTestData, setBusy, simulateMidnight, stats, useStore, validateSelection } from './store';

const Scene3D = lazy(() => import('./cinematic/Scene3D'));
const StatsPage = lazy(() => import('./components/StatsPage'));

/* Si WebGL est indisponible, l'app reste utilisable (animation DOM seule) */
class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.warn('Scène 3D désactivée :', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

/* Changement de jour automatique à minuit (+ contrôle régulier et au retour sur l'app) */
function useMidnight() {
  useEffect(() => {
    let timer;
    const arm = () => {
      const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { checkDay(); arm(); }, next - n);
    };
    arm();
    const iv = setInterval(checkDay, 30000);
    const vis = () => { if (!document.hidden) checkDay(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(timer); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, []);
}

export default function App() {
  const { S, UI } = useStore();
  const s = stats(S.tasks);
  const [recOpen, setRecOpen] = useState(false);
  const [load3D, setLoad3D] = useState(false);
  const card = useRef(null), form = useRef(null), list = useRef(null), tools = useRef(null), dim = useRef(null), skipBtn = useRef(null);
  const [text, setText] = useState('');
  useMidnight();

  // Charge la scène 3D en arrière-plan (shaders précompilés avant le premier « Valider »)
  useEffect(() => { const t = setTimeout(() => setLoad3D(true), 250); return () => clearTimeout(t); }, []);

  // Bloque le défilement pendant la cinématique
  useEffect(() => {
    if (!UI.busy) return;
    const stop = (e) => e.preventDefault();
    addEventListener('wheel', stop, { passive: false });
    addEventListener('touchmove', stop, { passive: false });
    return () => { removeEventListener('wheel', stop); removeEventListener('touchmove', stop); };
  }, [UI.busy]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') setRecOpen(false); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);

  const page = useRef(null);
  useLayoutEffect(() => {
    if (page.current) gsap.from(page.current, { opacity: 0, y: 10, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [UI.page]);

  const validate = () => {
    if (!UI.sel.size || UI.busy) return;
    const { old, nw } = validateSelection();
    const c = card.current, s2 = stats();
    const pl = (n, w) => w + (n > 1 ? 's' : '');
    const subText = `${s2.c} / ${s2.n} ${pl(s2.n, 'tâche')} ${pl(s2.c, 'terminée')}`;
    // les deux animations sont indépendantes (réglables via le rouage) : barre 3D et/ou confettis à 100 %
    const confettiAt100 = S.confetti && nw >= 100 && old < 100;
    if (S.anim && canAnimate() && old !== nw) {
      setBusy(true);
      race(
        { ...c, subText, bg: [document.getElementById('hdr'), form.current, tools.current], list: list.current, dim: dim.current, skip: skipBtn.current, canvas: document.getElementById('scene3d') },
        old, nw, () => setBusy(false), { confetti: confettiAt100 },
      );
    } else {
      requestAnimationFrame(() => c.paintBar(nw, true));
      if (confettiAt100) setTimeout(celebrate, 350);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    addTask(v);
    setText('');
  };

  return (
    <>
      <svg id="grain" aria-hidden="true">
        <filter id="gn"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#gn)" />
      </svg>

      <Header onRecurring={() => setRecOpen(true)} />

      <main className="mx-auto max-w-[760px] px-4 py-[22px] lg:max-w-[1040px] lg:px-8">
        {UI.page === 1 ? (
          <section ref={page} key="p1">
            <ProgressCard ref={card} s={s} busy={UI.busy} />
            <form ref={form} className="mb-3.5 flex gap-2" onSubmit={submit}>
              <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une tâche… (Entrée)" maxLength={200} autoComplete="off" enterKeyHint="done" />
              <button className="b on">Ajouter</button>
            </form>
            <div ref={list}><TaskList tasks={S.tasks} sel={UI.sel} busy={UI.busy} /></div>
            <div ref={tools} className="mt-[30px] flex flex-wrap items-center justify-center gap-2">
              <button className="b text-[13px] text-mut" onClick={simulateMidnight}>Simuler minuit / Jour suivant (Mode Test)</button>
              <button className="b text-[13px] text-mut" onClick={generateTestData}>Générer données test</button>
            </div>
          </section>
        ) : (
          <div ref={page} key="p2"><Suspense fallback={<div className="card h-[420px]" />}><StatsPage S={S} /></Suspense></div>
        )}
      </main>

      <ValidateButton k={UI.page === 1 ? UI.sel.size : 0} s={s} onClick={validate} />
      {recOpen && <RecurringModal onClose={() => setRecOpen(false)} />}

      <div id="dim" ref={dim} />
      {load3D && <Guard><Suspense fallback={null}><Scene3D /></Suspense></Guard>}
      <button className="b" id="skip" ref={skipBtn} onClick={(e) => { skip(); e.currentTarget.classList.remove('on'); }}>Passer l’animation ⏭</button>

      <div
        className={'pointer-events-none fixed left-1/2 z-[200] -translate-x-1/2 rounded-full border border-line bg-cont/95 px-5 py-2.5 text-sm shadow-2xl backdrop-blur transition-all duration-500 ease-spring ' + (UI.toast ? 'opacity-100' : 'translate-y-4 opacity-0')}
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >{UI.toast}</div>
    </>
  );
}
