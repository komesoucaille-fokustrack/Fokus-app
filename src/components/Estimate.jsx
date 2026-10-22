import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { setTaskField } from '../store';

/* =====================================================================
   TEMPS ESTIMÉ D'UNE TÂCHE (minutes, champ `est`)
   - Puce « sablier » sur la tâche : « 25 min / 1 h 30 » (fait / estimé). Un tap ouvre un petit
     panneau pour modifier l'estimation sans ouvrir les options de la tâche.
   - Même éditeur dans le panneau d'options (préréglages + − / +).
   ===================================================================== */
export const fmtMin = (m) => {
  const v = Math.round(m);
  return v >= 60 ? `${Math.floor(v / 60)} h${v % 60 ? ' ' + String(v % 60).padStart(2, '0') : ''}` : `${v} min`;
};

export function Hourglass({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3v2.5a5 5 0 0 0 2.2 4.1L12 12l2.8-2.4A5 5 0 0 0 17 5.5V3" />
      <path d="M7 21v-2.5a5 5 0 0 1 2.2-4.1L12 12l2.8 2.4a5 5 0 0 1 2.2 4.1V21" />
    </svg>
  );
}

const PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];
const step = (v, dir) => {
  if (!v && dir > 0) return 15;
  const s = v + (dir < 0 ? -1 : 0) < 60 ? 5 : v + (dir < 0 ? -1 : 0) < 180 ? 15 : 30;
  return Math.max(0, Math.min(1440, dir > 0 ? Math.floor(v / s) * s + s : Math.ceil(v / s) * s - s));
};

/* Éditeur : − valeur + et préréglages ; chaque changement est appliqué tout de suite */
export function EstEditor({ t, compact }) {
  const v = t.est || 0, set = (est) => setTaskField(t.id, { est });
  return (
    <div className={'est-ed' + (compact ? ' compact' : '')}>
      <span className="minf">
        <button type="button" onClick={() => set(step(v, -1))} aria-label="Moins de temps" disabled={!v}>−</button>
        <b className="grid min-w-[86px] place-items-center text-[15px] tabular-nums">{v ? fmtMin(v) : '—'}</b>
        <button type="button" onClick={() => set(step(v, 1))} aria-label="Plus de temps">+</button>
      </span>
      <div className="est-pre">
        {PRESETS.map((m) => (
          <button key={m} type="button" className={'seg' + (v === m ? ' on' : '')} onClick={() => set(m)}>{fmtMin(m)}</button>
        ))}
        {v > 0 && <button type="button" className="seg" onClick={() => set(0)}>Aucune</button>}
      </div>
    </div>
  );
}

/* Puce de la tâche + panneau flottant */
export function EstChip({ t }) {
  const [open, setOpen] = useState(false);
  const chip = useRef(null), pop = useRef(null);
  const [pos, setPos] = useState(null);
  const done = t.focus >= 1, over = t.est > 0 && t.focus >= t.est;

  useLayoutEffect(() => {
    if (!open) return;
    const r = chip.current.getBoundingClientRect(), W = Math.min(300, innerWidth - 24), H = pop.current.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - W - 12, r.left + r.width / 2 - W / 2));
    const below = r.bottom + 8 + H < innerHeight - 12 || r.top - 8 - H < 12;
    setPos({ left, width: W, top: below ? r.bottom + 8 : r.top - 8 - H });
    gsap.from(pop.current, { y: below ? -6 : 6, scale: 0.97, opacity: 0, duration: 0.35, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!pop.current?.contains(e.target) && !chip.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    const y0 = scrollY, scroll = () => { if (Math.abs(scrollY - y0) > 30) setOpen(false); };
    addEventListener('pointerdown', close, true);
    addEventListener('keydown', key, true);
    addEventListener('scroll', scroll, { passive: true });
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', key, true); removeEventListener('scroll', scroll); };
  }, [open]);

  const toggle = (e) => { e.stopPropagation(); setOpen((o) => !o); };
  const label = t.est ? (done ? `${fmtMin(t.focus)} / ${fmtMin(t.est)}` : fmtMin(t.est)) : done ? fmtMin(t.focus) : null;
  return (
    <>
      <span
        ref={chip}
        role="button"
        tabIndex={0}
        className={'chip est' + (label ? '' : ' empty') + (over ? ' over' : '') + (open ? ' on' : '')}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } }}
        aria-label={t.est ? `Temps estimé ${fmtMin(t.est)} — modifier` : 'Estimer le temps'}
        title="Temps estimé (toucher pour modifier)"
      >
        <Hourglass />{label}
      </span>
      {open && createPortal(
        <div ref={pop} className="est-pop" role="dialog" aria-label="Temps estimé" style={pos ? pos : { visibility: 'hidden', left: 0, top: 0 }} onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <b className="text-[14px]">Temps estimé</b>
            {done && <span className="text-[12px] text-mut tabular-nums">Déjà fait : {fmtMin(t.focus)}</span>}
          </div>
          <EstEditor t={t} compact />
        </div>,
        document.body,
      )}
    </>
  );
}
