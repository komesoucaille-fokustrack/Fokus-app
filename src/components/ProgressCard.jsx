import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { gradFor, getColorForPercentage } from '../lib/colors';

/* Carte « Aujourd'hui » — rendu de la barre géré impérativement
   (la chorégraphie 3D en prend le contrôle pendant l'animation). */
const ProgressCard = forwardRef(function ProgressCard({ s, text, busy, fmt }, ref) {
  const r = {
    card: useRef(null), label: useRef(null), sub: useRef(null), pct: useRef(null), pwrap: useRef(null), pbar: useRef(null), fill: useRef(null),
    blue: useRef(null), glow: useRef(null),
  };

  const paintBar = (p, flash) => {
    const f = r.fill.current, g = r.glow.current, b = r.blue.current;
    r.pct.current.textContent = fmt(p);
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

  useLayoutEffect(() => { if (!busy) paintBar(s.p); }, [s.p, s.pt, busy, fmt(100)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" id="pcard" ref={r.card}>
      {/* textes partagés avec la face 3D (cardText du store) : un seul nœud texte par élément */}
      <div className="truncate text-[13px] text-mut tabular-nums" ref={r.label}>{text.label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-[56px] leading-none font-extrabold tracking-[-0.04em] tabular-nums" ref={r.pct}>0%</div>
        <div className="text-right text-[13px] text-mut tabular-nums" ref={r.sub}>{text.sub}</div>
      </div>
      <div id="pwrap" ref={r.pwrap}>
        <div id="glow" ref={r.glow} />
        <div id="pbar" ref={r.pbar}><div id="pfill" ref={r.fill}><div id="pblue" ref={r.blue} /></div></div>
      </div>
    </div>
  );
});
export default ProgressCard;
