import { useEffect, useState } from 'react';

/* Chronos du Pomodoro. Chaque style reçoit deux paires de chiffres (a:b = mm:ss, ou hh:mm en mode Heure),
   l'avancement (0 → 1), la couleur du texte et le thème des cartes (flip). */

/* Carte « flip » : la moitié haute tombe, la nouvelle moitié basse se rabat (comme une horloge à palettes) */
function FlipCard({ v }) {
  const [st, setSt] = useState({ cur: v, prev: v, k: 0 });
  if (v !== st.cur) setSt({ cur: v, prev: st.cur, k: st.k + 1 });
  const go = st.k > 0 ? ' go' : '';
  return (
    <div className="flip">
      <div className="fh top"><span>{st.cur}</span></div>
      <div className="fh bot"><span>{st.prev}</span></div>
      <div key={'a' + st.k} className={'fh top flap-a' + go}><span>{st.prev}</span></div>
      <div key={'b' + st.k} className={'fh bot flap-b' + go}><span>{st.cur}</span></div>
    </div>
  );
}

function Flip({ a, b, theme }) {
  return (
    <div className={'flipclock ' + theme}>
      <FlipCard v={a} />
      <FlipCard v={b} />
    </div>
  );
}

function Classic({ a, b, ink }) {
  return <div className="ck-classic" style={{ color: ink }}>{a}<span className="sep">:</span>{b}</div>;
}

function Ring({ a, b, frac, ink }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div className="ck-ring" style={{ color: ink }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth="2.2" />
        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset .5s linear' }} />
      </svg>
      <div className="ck-ring-t">{a}:{b}</div>
    </div>
  );
}

function Minimal({ a, b, frac, ink }) {
  return (
    <div className="ck-min" style={{ color: ink }}>
      <div className="ck-min-t">{a}<span className="sep">:</span>{b}</div>
      <div className="ck-min-bar"><i style={{ width: frac * 100 + '%' }} /></div>
    </div>
  );
}

export const CLOCKS = [['classic', 'Classique'], ['flip', 'Flip'], ['ring', 'Anneau'], ['minimal', 'Minimal']];

export default function Clock({ style, a, b, frac, ink, theme }) {
  if (style === 'flip') return <Flip a={a} b={b} theme={theme} />;
  if (style === 'ring') return <Ring a={a} b={b} frac={frac} ink={ink} />;
  if (style === 'minimal') return <Minimal a={a} b={b} frac={frac} ink={ink} />;
  return <Classic a={a} b={b} ink={ink} />;
}

/* Heure actuelle (rafraîchie chaque seconde) */
export function useNow(on) {
  const [n, setN] = useState(() => new Date());
  useEffect(() => {
    if (!on) return;
    const iv = setInterval(() => setN(new Date()), 1000);
    return () => clearInterval(iv);
  }, [on]);
  return n;
}
