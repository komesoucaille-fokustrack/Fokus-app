import { useRef } from 'react';
import FokusLogo from './FokusLogo';
import { exportJSON, importJSON, setAnim, setPage, toast, useStore } from '../store';

export default function Header({ onRecurring }) {
  const { S, UI } = useStore();
  const file = useRef(null);
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
        <label className="sw">
          <input type="checkbox" checked={S.anim} onChange={(e) => setAnim(e.target.checked)} />
          <i />Animation
        </label>
        <button className="b" onClick={exportJSON}>Exporter (JSON)</button>
        <button className="b" onClick={() => file.current.click()}>Importer (JSON)</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
      </div>
    </header>
  );
}
