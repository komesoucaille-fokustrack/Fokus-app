import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { setAnim, setConfetti, useStore } from '../store';

/* Rouage (icône paramètres) */
function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Row({ title, desc, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:bg-hov">
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-mut">{desc}</span>
      </span>
      <span className="sw shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <i />
      </span>
    </label>
  );
}

/* Bouton rouage + panneau des paramètres d'animation */
export default function Settings() {
  const { S, UI } = useStore();
  const [open, setOpen] = useState(false);
  const panel = useRef(null), wrap = useRef(null), btn = useRef(null);

  useLayoutEffect(() => {
    if (open && panel.current) gsap.from(panel.current, { y: -8, scale: 0.97, opacity: 0, duration: 0.4, ease: 'expo.out', clearProps: 'transform,opacity' });
    if (btn.current) gsap.to(btn.current.querySelector('svg'), { rotation: open ? 90 : 0, duration: 0.6, ease: 'expo.out' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.key === 'Escape' || (e.type === 'pointerdown' && !wrap.current.contains(e.target))) setOpen(false); };
    addEventListener('pointerdown', close);
    addEventListener('keydown', close);
    return () => { removeEventListener('pointerdown', close); removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      <button ref={btn} className={'b flex items-center justify-center px-2.5! ' + (open ? 'on' : '')} aria-label="Paramètres" title="Paramètres" disabled={UI.busy} onClick={() => setOpen((o) => !o)}>
        <Gear />
      </button>
      {open && (
        <div ref={panel} className="card absolute top-[calc(100%+10px)] right-0 z-40 m-0! w-[min(360px,calc(100vw-32px))] bg-cont! p-3!" role="dialog" aria-label="Paramètres">
          <div className="px-1 pt-1 pb-3 text-[13px] font-semibold tracking-wide text-mut uppercase">Animations</div>
          <div className="flex flex-col gap-2">
            <Row title="Animation de la barre" desc="Cinématique 3D à chaque validation de tâches" checked={S.anim} onChange={setAnim} />
            <Row title="Confettis à 100 %" desc="Pluie de confettis multicolores quand la journée est complétée" checked={S.confetti} onChange={setConfetti} />
          </div>
        </div>
      )}
    </div>
  );
}
