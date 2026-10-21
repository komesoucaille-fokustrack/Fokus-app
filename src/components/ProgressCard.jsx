import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { gradFor, getColorForPercentage } from '../lib/colors';

const plural = (n, w) => w + (n > 1 ? 's' : '');

/* Carte « Aujourd'hui » — rendu de la barre géré impérativement
   (la chorégraphie 3D en prend le contrôle pendant l'animation). */
const ProgressCard = forwardRef(function ProgressCard({ s, busy }, ref) {
  const r = {
    card: useRef(null), pct: useRef(null), pwrap: useRef(null), pbar: useRef(null), fill: useRef(null),
    blue: useRef(null), glow: useRef(null), head: useRef(null), end: useRef(null), rail: useRef(null),
  };

  const paintBar = (p, flash) => {
    const f = r.fill.current, g = r.glow.current, b = r.blue.current;
    r.pct.current.textContent = p + '%';
    f.style.width = p + '%';
    f.style.background = p ? gradFor(p) : 'transparent';
    g.style.width = p + '%';
    g.style.backgroundColor = getColorForPercentage(p);
    g.style.opacity = p ? 0.4 : 0;
    if (flash) gsap.fromTo(b, { opacity: 1 }, { opacity: 0, duration: 1.6, ease: 'power2.inOut' });
    else gsap.set(b, { opacity: 0 });
  };

  useImperativeHandle(ref, () => ({
    ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.current])),
    paintBar,
  }));

  useLayoutEffect(() => { if (!busy) paintBar(s.p); }, [s.p, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" id="pcard" ref={r.card}>
      <div className="slab fx sb" /><div className="slab fx st" /><div className="slab fx sl" /><div className="slab fx sr" />
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[13px] text-mut">Aujourd’hui</div>
          <div className="text-[56px] leading-none font-extrabold tracking-[-0.04em] tabular-nums" ref={r.pct}>0%</div>
        </div>
        <div className="text-right text-[13px] text-mut tabular-nums">
          {s.n ? `${s.c} / ${s.n} ${plural(s.n, 'tâche')} ${plural(s.c, 'terminée')}` : 'Aucune tâche aujourd’hui'}
        </div>
      </div>
      <div id="pwrap" ref={r.pwrap}>
        <div id="glow" ref={r.glow} />
        <div id="pbar" ref={r.pbar}><div id="pfill" ref={r.fill}><div id="pblue" ref={r.blue} /></div></div>
        <div id="rail" className="fx" ref={r.rail} />
        <i className="mark" ref={r.head} style={{ left: 0 }} />
        <i className="mark" ref={r.end} style={{ left: '100%' }} />
      </div>
    </div>
  );
});
export default ProgressCard;
