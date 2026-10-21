import { useEffect, useRef, useState } from 'react';
import FokusLogo from './FokusLogo';
import Settings from './Settings';
import { exportJSON, importJSON, setPage, toast, useStore } from '../store';

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

export default function Header({ onRecurring }) {
  const { UI } = useStore();
  const file = useRef(null);
  const full = useFullscreen();
  const [canFull] = useState(fsSupported);
  const go = (p) => { if (!UI.busy) setPage(p); };
  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { importJSON(r.result); toast('Données importées.'); }
      catch { toast('Fichier invalide : ce n’est pas une sauvegarde Fokus.'); }
    };
    r.readAsText(f);
    e.target.value = '';
  };
  return (
    <header
      id="hdr"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-cont/85 px-4 py-3 backdrop-blur-md"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <FokusLogo />
      <nav className="flex flex-wrap items-center gap-2">
        <button className={'b ' + (UI.page === 1 ? 'on' : '')} onClick={() => go(1)}>Mes Tâches</button>
        <button className={'b ' + (UI.page === 2 ? 'on' : '')} onClick={() => go(2)}>Ma Progression</button>
        <button className="b" onClick={onRecurring}>Tâches Récurrentes</button>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <button className="b" onClick={exportJSON}>Exporter (JSON)</button>
        <button className="b" onClick={() => file.current.click()}>Importer (JSON)</button>
        {canFull && <button className={'b ' + (full ? 'on' : '')} onClick={toggleFullscreen}>{full ? 'Quitter le plein écran' : '⛶ Plein écran'}</button>}
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
        <Settings />
      </div>
    </header>
  );
}
