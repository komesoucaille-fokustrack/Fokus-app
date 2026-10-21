import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import '@fontsource-variable/oswald';

/* =====================================================================
   FONDS « CONCEPTS » DU POMODORO — le temps fait partie du décor.
   Tout est vectoriel (SVG / CSS) : net sur n'importe quel écran (Retina, 4K).
   Props communes : a, b (paires de chiffres), frac (avancement 0 → 1), phase ('work' | 'short' | 'long').
   ===================================================================== */

/* Taille du conteneur (le décor s'adapte au format : paysage, portrait, vignette) */
function useSize() {
  const ref = useRef(null);
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    const up = () => setS({ w: el.clientWidth, h: el.clientHeight });
    up();
    const ro = new ResizeObserver(up);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, s];
}
const mix = (c1, c2, t) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const x = p(c1), y = p(c2);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const ramp = (stops, t) => {
  const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n));
  return mix(stops[i], stops[i + 1], t * n - i);
};

/* 1. Affiche GT : le « 911 » du mur devient le temps qui passe (chiffres ton sur ton, coins arrondis) */
function PosterGT({ a, b }) {
  const [ref, { w, h }] = useSize();
  const portrait = h > w * 1.05;
  // la voiture reste au-dessus des boutons du chrono
  const carW = Math.min(w * (portrait ? 0.92 : 0.74), h * 0.32 * 3.1), carH = carW / 3.1, carB = portrait ? 132 : Math.max(h * 0.12, 72);
  const top = h * (portrait ? 0.12 : 0.13), bottom = h - carH - carB - h * 0.03;
  const avail = Math.max(10, bottom - top);
  const fs = portrait ? Math.min(avail / 1.72, (w * 0.86) / 1.12) : Math.min(avail / 0.8, (w * 0.86) / 2.42);
  const line = fs * 0.86;
  return (
    <div ref={ref} className="cc cc-gt">
      {w > 0 && (
        <svg className="cc-fill" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <g className="gt-digits" style={{ fontSize: fs, strokeWidth: fs * 0.022 }}>
            {portrait ? (
              <>
                <text x={w / 2} y={top + line * 0.93}>{a}</text>
                <text x={w / 2} y={top + line * 1.93 + fs * 0.06}>{b}</text>
              </>
            ) : <text x={w / 2} y={top + (avail + line * 0.93) / 2}>{a}:{b}</text>}
          </g>
        </svg>
      )}
      <img className="gt-car" src="bg/gt-car.webp" alt="" decoding="async" style={{ width: carW, bottom: carB }} />
    </div>
  );
}

/* 2. Bauhaus : affiche géométrique ; l'arc noir se trace autour du soleil orange au fil de la session.
   Paysage : composition à gauche, chrono à droite ; portrait : composition en haut, chrono dessous. */
function Bauhaus({ a, b, frac, phase }) {
  const [ref, { w, h }] = useSize();
  const land = w >= h;
  const S = land ? Math.min(h * 0.6, w * 0.42) : Math.min(w * 0.62, h * 0.36);
  const ox = land ? w * 0.07 : (w - S) / 2, oy = land ? (h - S) / 2 - h * 0.03 : h * 0.13;
  const u = S / 100; // unité de la composition
  const cx = ox + 62 * u, cy = oy + 40 * u, R = 24 * u, R2 = R + 5 * u, C = 2 * Math.PI * R2;
  const fs = land ? Math.min(h * 0.3, (w - S - w * 0.17) / 2.55) : Math.min(w * 0.3, h * 0.17);
  const tx = land ? w * 0.93 : w / 2, ty = land ? h / 2 + fs * 0.36 : oy + S + fs * 0.95;
  const anchor = land ? 'end' : 'middle';
  return (
    <div ref={ref} className="cc cc-bauhaus">
      {w > 0 && (
        <svg className="cc-fill" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <rect x={ox} y={oy} width={16 * u} height={84 * u} fill="#141414" />
          <rect x={ox + 16 * u} y={oy + 66 * u} width={30 * u} height={18 * u} fill="#c4502a" />
          <circle cx={cx} cy={cy} r={R} fill="#e2662c" />
          <circle cx={cx} cy={cy} r={R2} fill="none" stroke="#141414" strokeWidth={2.4 * u} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform={`rotate(-90 ${cx} ${cy})`} />
          <rect x={ox + 88 * u} y={oy} width={6 * u} height={6 * u} fill="#141414" />
          <line x1={ox} y1={oy + 92 * u} x2={ox + 94 * u} y2={oy + 92 * u} stroke="#141414" strokeWidth={Math.max(1, 0.4 * u)} />
          <text x={ox} y={oy + 99 * u} className="bh-cap" style={{ fontSize: Math.max(8, 2.6 * u) }}>FOKUS — {phase === 'work' ? 'CONCENTRATION' : 'PAUSE'}</text>
          <text x={tx} y={ty} textAnchor={anchor} className="bh-time" style={{ fontSize: fs }}>{a}:{b}</text>
          <text x={tx} y={ty + fs * 0.32} textAnchor={anchor} className="bh-cap" style={{ fontSize: Math.max(8, fs * 0.085) }}>{phase === 'work' ? 'LE TEMPS QUI PASSE' : 'RESPIRER'}</text>
        </svg>
      )}
    </div>
  );
}

/* 3. Horizon : le soleil descend avec le temps, le ciel passe de l'après-midi au crépuscule */
function Horizon({ a, b, frac }) {
  const t = frac;
  const sky = [ramp(['#1f4157', '#3a2b55', '#0b1024'], t), ramp(['#7aa3b5', '#c86a5c', '#3b2846'], t), ramp(['#f0d6ae', '#f6a45c', '#7a3d47'], t)];
  const sx = 1010 - 250 * t, sy = 270 + 520 * t * t;
  const m = (c) => mix(c, '#05070c', t * 0.7);
  return (
    <div className="cc">
      <svg className="cc-fill" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="hz-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky[0]} /><stop offset=".55" stopColor={sky[1]} /><stop offset="1" stopColor={sky[2]} />
          </linearGradient>
          <radialGradient id="hz-glow"><stop offset="0" stopColor="#ffd9a0" stopOpacity=".7" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#hz-sky)" />
        <g opacity={Math.max(0, (t - 0.6) / 0.4)}>
          {[[180, 120], [420, 70], [700, 160], [980, 90], [1320, 140], [1480, 60], [260, 260], [1120, 230], [560, 300]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} fill="#fff" />)}
        </g>
        <circle cx={sx} cy={sy} r="260" fill="url(#hz-glow)" />
        <circle cx={sx} cy={sy} r="62" fill={mix('#fff1d6', '#ff7a45', t)} />
        <path d="M0 720 L180 560 L320 650 L520 470 L700 640 L860 520 L1040 660 L1240 500 L1420 620 L1600 540 L1600 1000 L0 1000Z" fill={m('#4c6b70')} />
        <path d="M0 800 L240 660 L420 760 L640 610 L820 740 L1020 640 L1240 770 L1420 680 L1600 760 L1600 1000 L0 1000Z" fill={m('#2c4a45')} />
        <path d="M0 880 L300 790 L560 860 L820 780 L1100 870 L1380 800 L1600 860 L1600 1000 L0 1000Z" fill={m('#16302b')} />
      </svg>
      <div className="cc-time cc-thin" style={{ color: '#fff' }}>{a}<span className="sep">:</span>{b}</div>
    </div>
  );
}

/* 4. Marée : le niveau monte pendant la concentration (et redescend pendant la pause) ; le chrono s'inverse au passage */
function Maree({ a, b, frac, phase }) {
  const level = phase === 'work' ? frac : 1 - frac;
  return (
    <div className="cc cc-maree">
      <div className="mr-water" style={{ transform: `translateY(${(1 - level) * 100}%)` }}>
        <svg className="mr-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30 V60 H0Z" fill="#e9e1d2" />
        </svg>
      </div>
      <div className="cc-time mr-time">{a}<span className="sep">:</span>{b}</div>
    </div>
  );
}

/* 5. Topographie : courbes de niveau qui dérivent lentement ; une ligne claire se trace avec le temps */
function Topo({ a, b, frac }) {
  const paths = useMemo(() => {
    const out = [];
    for (let k = 0; k < 22; k++) {
      const R = 40 + k * 34, p1 = k * 0.7, p2 = k * 1.3;
      let d = '';
      for (let i = 0; i <= 120; i++) {
        const th = (i / 120) * Math.PI * 2;
        const r = R * (1 + 0.09 * Math.sin(3 * th + p1) + 0.05 * Math.sin(5 * th + p2) + 0.03 * Math.sin(8 * th - p1));
        d += (i ? 'L' : 'M') + (500 + r * Math.cos(th)).toFixed(1) + ' ' + (500 + r * Math.sin(th) * 0.86).toFixed(1);
      }
      out.push(d + 'Z');
    }
    return out;
  }, []);
  return (
    <div className="cc cc-topo">
      <div className="topo-rot"><svg className="cc-fill" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g>
          {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 4 === 0 ? '#9fb59c' : '#3f5c48'} strokeWidth={i % 4 === 0 ? 1.6 : 1} opacity={i % 4 === 0 ? 0.55 : 0.7} />)}
          <path d={paths[9]} fill="none" stroke="#efe6d2" strokeWidth="3.2" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - frac} strokeLinecap="round" />
        </g>
      </svg></div>
      <div className="cc-time cc-thin" style={{ color: '#efe6d2' }}>{a}<span className="sep">:</span>{b}</div>
    </div>
  );
}

const MAP = { gt: PosterGT, bauhaus: Bauhaus, horizon: Horizon, maree: Maree, topo: Topo };
export default function Concept({ kind, ...p }) {
  const C = MAP[kind] || PosterGT;
  return <C {...p} />;
}
