import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { Gear } from './Settings';
import { pomoElapsed, setModal, setPage, toast, useStore } from '../store';
import Icon from './Icons';
import { openPip, pipActive, pipSupported } from '../lib/pip';

/* Plein écran (Safari iPad : API préfixée webkit) */
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsSupported = () => {
  const el = document.documentElement;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return !standalone && !!(el.requestFullscreen || el.webkitRequestFullscreen);
};
function toggleFullscreen() {
  const el = document.documentElement;
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
}

function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!fsElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync); };
  }, []);
  return on;
}

/* rafraîchit le temps restant affiché dans l'onglet Pomodoro */
function useTick(on) {
  const [, t] = useState(0);
  useEffect(() => {
    if (!on) return;
    const iv = setInterval(() => t((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [on]);
}

function FullIcon({ exit }) {
  const d = exit ? 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5' : 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5';
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Loupe() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function Header() {
  const { S, UI } = useStore();
  const full = useFullscreen();
  const [canFull] = useState(fsSupported);
  const upcoming = S.tasks.filter((t) => !t.done && (t.date === null || t.date > S.last)).length;
  const open = (m) => { if (!UI.busy) setModal(m); };
  const p = S.pomo, left = p && p.paused == null ? Math.max(0, Math.ceil(p.dur - pomoElapsed(p))) : null;
  const live = left != null && UI.page !== 4 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
  useTick(left != null && UI.page !== 4);

  // pastille blanche qui glisse sous l'onglet actif
  const nav = useRef(null), ind = useRef(null), first = useRef(true);
  useLayoutEffect(() => {
    const place = (anim) => {
      const b = nav.current?.querySelector(`[data-p="${UI.page}"]`);
      if (!b) return;
      const to = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight };
      if (anim) gsap.to(ind.current, { ...to, duration: 0.55, ease: 'expo.out' });
      else gsap.set(ind.current, to);
    };
    place(!first.current);
    first.current = false;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(nav.current);
    return () => ro.disconnect();
  }, [UI.page, live, upcoming]);
  return (
    <header
      id="hdr"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-cont/85 px-4 py-3 backdrop-blur-md"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <FokusLogo />
      <nav className="navseg" ref={nav}>
        <i className="navind" ref={ind} aria-hidden="true" />
        {[[1, 'Mes Tâches', 'Tâches'], [3, 'À venir', 'À venir', upcoming || ''], [4, 'Pomodoro', 'Pomodoro', live], [2, 'Ma Progression', 'Progrès']].map(([n, l, sl, x]) => (
          <button key={n} data-p={n} className={UI.page === n ? 'on' : ''} onClick={() => setPage(n)} aria-current={UI.page === n ? 'page' : undefined}>
            <span className="hidden sm:inline">{l}</span><span className="sm:hidden">{sl}</span>
            {x ? <span className="ml-1 text-[11px] opacity-60 tabular-nums">{x}</span> : null}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-2 sm:order-none">
        <button className="b icon-b" onClick={() => open('search')} aria-label="Rechercher" title="Rechercher (/)"><Loupe /></button>
        <PipButton />
        {canFull && <button className={'b icon-b ' + (full ? 'on' : '')} onClick={toggleFullscreen} aria-label="Plein écran"><FullIcon exit={full} /><span className="ml-1.5 hidden sm:inline">{full ? 'Quitter le plein écran' : 'Plein écran'}</span></button>}
        <button className={'b icon-b ' + (UI.modal === 'settings' ? 'on' : '')} onClick={() => open('settings')} aria-label="Réglages" title="Réglages"><Gear /></button>
      </div>
    </header>
  );
}

/* Mini-fenêtre flottante (Picture-in-Picture) : reste à l'écran quand on quitte l'app */
export function usePip() {
  const [on, setOn] = useState(pipActive());
  useEffect(() => { const f = () => setOn(pipActive()); addEventListener('fokuspip', f); return () => removeEventListener('fokuspip', f); }, []);
  const toggle = () => openPip().catch(() => toast('La mini-fenêtre n’est pas disponible sur cet appareil.', null, 4000));
  return [on, toggle];
}
function PipButton() {
  const [on, toggle] = usePip();
  if (!pipSupported()) return null;
  return (
    <button className={'b icon-b ' + (on ? 'on' : '')} onClick={toggle} aria-label={on ? 'Fermer la mini-fenêtre' : 'Mini-fenêtre'} title="Mini-fenêtre : reste à l’écran quand tu quittes Fokus">
      <Icon name="pip" size={18} />
    </button>
  );
}
