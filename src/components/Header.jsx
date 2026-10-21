import { useEffect, useState } from 'react';
import FokusLogo from './FokusLogo';
import { Gear } from './Settings';
import { setModal, setPage, useStore } from '../store';

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
  return (
    <header
      id="hdr"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-cont/85 px-4 py-3 backdrop-blur-md"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <FokusLogo />
      <nav className="flex flex-wrap items-center gap-2">
        <button className={'b ' + (UI.page === 1 ? 'on' : '')} onClick={() => setPage(1)}>Mes Tâches</button>
        <button className={'b ' + (UI.page === 3 ? 'on' : '')} onClick={() => setPage(3)}>
          À venir{upcoming > 0 && <span className="ml-1.5 text-[12px] opacity-60 tabular-nums">{upcoming}</span>}
        </button>
        <button className={'b ' + (UI.page === 2 ? 'on' : '')} onClick={() => setPage(2)}>Ma Progression</button>
        <button className="b" onClick={() => open('rec')}>Récurrentes</button>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <button className="b icon-b" onClick={() => open('search')} aria-label="Rechercher" title="Rechercher (/)"><Loupe /></button>
        {canFull && <button className={'b icon-b ' + (full ? 'on' : '')} onClick={toggleFullscreen} aria-label="Plein écran">{full ? '✕' : '⛶'}<span className="hidden sm:inline">{full ? ' Quitter le plein écran' : ' Plein écran'}</span></button>}
        <button className={'b icon-b ' + (UI.modal === 'settings' ? 'on' : '')} onClick={() => open('settings')} aria-label="Réglages" title="Réglages"><Gear /></button>
      </div>
    </header>
  );
}
