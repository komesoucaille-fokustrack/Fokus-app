import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { setTaskField } from '../store';

/* =====================================================================
   TEMPS ESTIMÉ D'UNE TÂCHE (minutes, champ `est`)
   - Puce « sablier » sur la tâche : « 1 h 30 » (estimation seule). Un tap ouvre un petit panneau
     pour la modifier sans ouvrir les options de la tâche.
   - Même éditeur dans le panneau d'options : heures + minutes libres et préréglages.
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
const num = (x) => Math.max(0, parseInt(String(x).replace(/\D/g, ''), 10) || 0);

/* Éditeur : heures + minutes saisies librement (n'importe quelle valeur) et préréglages ;
   chaque changement est appliqué tout de suite */
export function EstEditor({ t, compact }) {
  const v = t.est || 0, box = useRef(null);
  const [h, setH] = useState(v >= 60 ? String(Math.floor(v / 60)) : '');
  const [m, setM] = useState(v % 60 ? String(v % 60) : '');
  // valeur changée ailleurs (préréglage, chronologie) : on recale les champs s'ils ne sont pas en cours de saisie
  useEffect(() => {
    if (box.current?.contains(document.activeElement)) return;
    setH(v >= 60 ? String(Math.floor(v / 60)) : '');
    setM(v % 60 ? String(v % 60) : '');
  }, [v]);
  const commit = (hh, mm) => setTaskField(t.id, { est: Math.min(1440, num(hh) * 60 + num(mm)) });
  const pick = (est) => { setH(est >= 60 ? String(Math.floor(est / 60)) : ''); setM(est % 60 ? String(est % 60) : ''); setTaskField(t.id, { est }); };
  const field = (val, set, other, isH, label) => (
    <label className="est-f">
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={isH ? 2 : 4} placeholder="0" value={val} aria-label={label}
        onChange={(e) => { const x = e.target.value.replace(/\D/g, ''); set(x); isH ? commit(x, other) : commit(other, x); }}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <span>{isH ? 'h' : 'min'}</span>
    </label>
  );
  return (
    <div ref={box} className={'est-ed' + (compact ? ' compact' : '')}>
      <div className="est-in">
        {field(h, setH, m, true, 'Heures')}
        {field(m, setM, h, false, 'Minutes')}
      </div>
      <div className="est-pre">
        {PRESETS.map((x) => (
          <button key={x} type="button" className={'seg' + (v === x ? ' on' : '')} onClick={() => pick(x)}>{fmtMin(x)}</button>
        ))}
        {v > 0 && <button type="button" className="seg" onClick={() => pick(0)}>Aucune</button>}
      </div>
    </div>
  );
}

/* Puce de la tâche + panneau flottant */
export function EstChip({ t }) {
  const [open, setOpen] = useState(false);
  const chip = useRef(null), pop = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) return;
    const r = chip.current.getBoundingClientRect(), W = Math.min(300, innerWidth - 24), H = pop.current.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - W - 12, r.left + r.width / 2 - W / 2));
    // au-dessus de la puce quand elle est dans le bas de l'écran (le clavier de l'iPad ne cache pas les champs)
    const below = r.top - 8 - H < 12 || (r.bottom < innerHeight * 0.55 && r.bottom + 8 + H < innerHeight - 12);
    setPos({ left, width: W, top: below ? r.bottom + 8 : r.top - 8 - H });
    gsap.from(pop.current, { y: below ? -6 : 6, scale: 0.97, opacity: 0, duration: 0.35, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!pop.current?.contains(e.target) && !chip.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    const y0 = scrollY, scroll = () => { if (Math.abs(scrollY - y0) > 30 && !pop.current?.contains(document.activeElement)) setOpen(false); };
    addEventListener('pointerdown', close, true);
    addEventListener('keydown', key, true);
    addEventListener('scroll', scroll, { passive: true });
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', key, true); removeEventListener('scroll', scroll); };
  }, [open]);

  const toggle = (e) => { e.stopPropagation(); setOpen((o) => !o); };
  const label = t.est ? fmtMin(t.est) : null;
  return (
    <>
      <span
        ref={chip}
        role="button"
        tabIndex={0}
        className={'chip est' + (label ? '' : ' none') + (open ? ' on' : '')}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } }}
        aria-label={t.est ? `Temps estimé ${fmtMin(t.est)} — modifier` : 'Estimer le temps'}
        title="Temps estimé (toucher pour modifier)"
      >
        <Hourglass />{label}
      </span>
      {open && createPortal(
        <div ref={pop} className="est-pop" role="dialog" aria-label="Temps estimé" style={pos ? pos : { visibility: 'hidden', left: 0, top: 0 }} onClick={(e) => e.stopPropagation()}>
          <b className="mb-2 block text-[14px]">Temps estimé</b>
          <EstEditor t={t} compact />
        </div>,
        document.body,
      )}
    </>
  );
}
