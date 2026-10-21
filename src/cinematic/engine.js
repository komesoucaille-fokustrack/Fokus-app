import gsap from 'gsap';
import { celebrate } from '../lib/celebrate';
import { fx } from './shared';
import { clamp, gradFor, getColorForPercentage } from '../lib/colors';

/* =====================================================================
   CHORÉGRAPHIE CINÉMATIQUE (~10 s, lente et lisible)
   1. Détourage lumineux : deux traits de lumière glissent le long du contour de la carte
      « Aujourd'hui », qui se décolle de la page (vraie dalle 3D épaisse, ombre portée).
   2. Le gel s'allume en bleu électrique jusqu'à l'ancien score.
   3. Pose A (visuel 1) : la carte flotte, inclinée, l'arche gonflable se gonfle au bout de la barre ;
      puis gros plan sur le front de la barre (visuel 2).
   4. Course de l'ancien au nouveau score (vitesse proportionnelle à l'écart) : la caméra suit le front
      et, à mesure que la barre avance, la carte se désincline jusqu'à se poser à plat (pose B, visuel 3),
      vue en perspective avec l'arche toujours debout au bout de la barre.
   5. Fin : retour en 2D sans coupure, la carte 3D se repose exactement sur la carte DOM.
   ===================================================================== */
let tl = null;

/* Cadrage (cf. visuels de référence) */
const POSE_A = { roll: -30, yaw: 24, pitch: 44, pitchClose: 54 }; // carte flottante inclinée (visuel 1 / 2)
const POSE_B = { roll: -11, yaw: 9, pitch: 57 };                   // carte posée à plat, vue en perspective (visuel 3)
const CAM = {
  wide: 0.66,      // largeur du plan large (fraction de l'écran occupée par la carte)
  close: 2.4,      // échelle du gros plan sur la barre
  flat: 0.74,      // largeur de la carte posée à plat (fraction de l'écran)
};

/* Dosage selon le pourcentage validé (écart ancien → nouveau score) : [écart, vitesse, étincelles] */
const DOSE = [[0, 0.03, 0.03], [0.1, 0.06, 0.05], [0.25, 0.15, 0.08], [0.5, 0.22, 0.09], [1, 0.34, 0.15]];
function dose(d, i) {
  let j = 1;
  while (j < DOSE.length - 1 && d > DOSE[j][0]) j++;
  const a = DOSE[j - 1], b = DOSE[j], t = clamp((d - a[0]) / (b[0] - a[0]), 0, 1);
  return a[i] + (b[i] - a[i]) * t;
}

const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canAnimate = () => !reduced() && fx.ready;

export function skip() { if (tl) tl.timeScale(5); }

// ?slow=0.3 : ralentit toute l'animation (tests visuels)
const slow = typeof location !== 'undefined' && +new URLSearchParams(location.search).get('slow');
if (slow) { gsap.globalTimeline.timeScale(slow); gsap.ticker.lagSmoothing(0); }

/* Relevé de la face de la carte DOM (textes, piste) pour la redessiner à l'identique en 3D */
function measureFace(c, r) {
  const rel = (el) => { const q = el.getBoundingClientRect(); return { x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height }; };
  const text = (el, extra = {}) => {
    const cs = getComputedStyle(el), q = rel(el), right = cs.textAlign === 'right';
    return {
      text: el.textContent, font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color: cs.color,
      ls: cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing,
      align: right ? 'right' : 'left', x: right ? q.x + q.w : q.x, y: q.y + q.h / 2, ...extra,
    };
  };
  return { w: r.width, h: r.height, track: rel(c.pbar), texts: [text(c.label), text(c.pct, { pct: true }), text(c.sub, c.subText ? { text: c.subText } : {})] };
}

/**
 * @param {object} c refs : card, label, pct, sub, pwrap, pbar, fill, blue, glow, bg (éléments qui s'enfoncent), list, dim, skip, canvas
 */
export function race(c, from, to, onDone, opts = {}) {
  const vw = innerWidth, vh = innerHeight, mob = vw < 640;
  const O = { x: vw / 2, y: vh / 2 };
  const r = c.card.getBoundingClientRect(), b = c.pbar.getBoundingClientRect();
  Object.assign(fx, {
    active: true, race: fx.race + 1, intro: 0, zoom: 0, k: 0, lay: 0, lay0: 0, frame: 0, lift: 0, p: from, old: from, to, shown: from, pastel: 1, blue: 0, speed: 0,
    arch: 0, as: 0, flash: 0, ring: -1, moving: false, cut: 0, cutGlow: 0, emit: [], O,
    C: { x0: r.left - O.x, y0: r.top - O.y, w: r.width, h: r.height, r: parseFloat(getComputedStyle(c.card).borderRadius) || 16 },
    G: { x0: b.left - O.x, y: b.top + b.height / 2 - O.y, barW: b.width, bh: b.height, mob },
    face: measureFace(c, r),
  });
  const C = fx.C, G = fx.G, d = clamp((to - from) / 100, 0, 1);
  fx.fxLevel = dose(d, 1);
  fx.sparkLevel = dose(d, 2);
  // durée de la course : +10 % ≈ 3 s, +25 % ≈ 4 s, +50 % ≈ 5 s, +100 % ≈ 6,5 s (la vitesse croît avec l'écart)
  const run = 1.6 + 4.9 * Math.sqrt(d);
  const vPeak = Math.max(1, (1.9 * (to - from)) / run);   // pic de vitesse (% / s) d'une course power2.inOut

  const close = mob ? 1.8 : vw < 1000 ? 2.1 : CAM.close, wide = Math.min(1, (CAM.wide * vw) / C.w), flat = Math.min(1.1, (CAM.flat * vw) / C.w);
  const Aw = { x: 0.02 * vw, y: 0.02 * vh }, Ac = { x: -0.12 * vw, y: 0.14 * vh }, Ab = { x: 0.03 * vw, y: 0.06 * vh };
  const hold = { sink: 0 };             // la page reste enfoncée pendant le détourage et le plan large
  const last = { t: 0, p: from };
  const progress = () => (to > from ? (fx.p - from) / (to - from) : 1); // avancement de la course (0 → 1)
  let fired = false;
  const items = [...c.list.querySelectorAll('li')].slice(0, 14);
  const bg = c.bg;

  /* Matrice de la carte : M = T(F + k(A − F) + lift) · Rx(pitch) · Ry(yaw) · Rz(roll) · S · T(−F)
     F = point visé, A = sa place à l'écran ; identité à k = 0.
     zoom : plan large → gros plan sur le front (la carte glisse en sens inverse pour le suivre) ;
     lay : pose A inclinée → pose B posée à plat (angles), suit l'avancement de la course ;
     frame : gros plan sur le front → carte entière, seulement en toute fin de course (on reste zoomé sur la barre). */
  function matrix(t) {
    const k = fx.k, z = fx.zoom, b = fx.lay, f = fx.frame, hx = G.x0 + (fx.p / 100) * G.barW, hy = G.y;
    const cx = C.x0 + C.w / 2, cy = C.y0 + C.h / 2;
    const fxp = lerp(lerp(cx, hx, z), cx + C.w * 0.04, f), fyp = lerp(lerp(cy, hy, z), cy, f);
    const ax = lerp(lerp(Aw.x, Ac.x, z), Ab.x, f), ay = lerp(lerp(Aw.y, Ac.y, z), Ab.y, f);
    const s = 1 + k * (lerp(lerp(wide, close, z), flat, f) - 1);
    const drift = (Math.sin(t * 0.5) * 1.1 + Math.sin(t * 1.3) * 0.3) * k * (1 - 0.6 * b);
    const pitch = lerp(lerp(POSE_A.pitch, POSE_A.pitchClose, z), POSE_B.pitch, b) + drift * 0.4;
    const yaw = lerp(POSE_A.yaw, POSE_B.yaw, b) + drift, roll = lerp(POSE_A.roll, POSE_B.roll, b);
    const lift = 90 * fx.lift * (1 - 0.9 * b);                       // posée à plat, la carte touche presque le sol
    return `translate3d(${fxp + k * (ax - fxp)}px,${fyp + k * (ay - fyp) + Math.sin(t * 1.1) * 2.5 * k * (1 - b)}px,${lift}px) `
      + `rotateX(${pitch * k}deg) rotateY(${yaw * k}deg) rotateZ(${roll * k}deg) `
      + `scale3d(${s},${s},${s}) translate3d(${-fxp}px,${-fyp}px,0)`;
  }

  /* La page s'enfonce (flou de profondeur de champ) derrière la carte */
  function sinkPage(s) {
    const set = (el, z) => {
      el.style.transform = s > 0.001 ? `perspective(1100px) translateZ(${-z * s}px)` : '';
      el.style.filter = s > 0.01 ? `blur(${10 * s}px)` : '';
      el.style.opacity = s > 0.001 ? 1 - 0.8 * s : '';
    };
    bg.forEach((el) => set(el, 220));
    items.forEach((el, i) => set(el, 260 + 12 * i));
  }

  function paint() {
    const t = performance.now() / 1000;
    fx.k = fx.intro;
    fx.lay = Math.max(fx.lay0, smoother(progress() * 1.1));   // la carte se pose à plat au fil de la course
    fx.frame = Math.max(fx.lay0, smoother((progress() - 0.8) / 0.2)); // recul sur la carte entière en toute fin de course
    // vitesse instantanée de la barre (% / s) → intensité de l'effet de vitesse
    const now = performance.now();
    if (last.t) {
      const dt = Math.max(1e-3, (now - last.t) / 1000), v = (fx.p - last.p) / dt;
      fx.speed += (clamp(v / vPeak, 0, 1) - fx.speed) * Math.min(1, dt * 6);
    }
    last.t = now;
    last.p = fx.p;
    fx.shown = Math.max(from, fx.p); // l'ancien score reste affiché jusqu'à ce que le bleu le dépasse
    fx.m = new DOMMatrix(matrix(t)).toFloat32Array();
    const s = Math.max(fx.k, hold.sink);
    sinkPage(s);
    c.dim.style.opacity = s;
    c.pct.textContent = Math.round(fx.shown) + '%';
    if (to >= 100 && !fired && fx.p >= 99.4 && fx.moving) climax();
    try { fx.render?.(); } catch (e) { console.warn('Rendu 3D interrompu :', e); fx.render = null; tl?.progress(1); }
  }

  function climax() {
    fired = true;
    fx.burst++;
    gsap.fromTo(fx, { flash: 1 }, { flash: 0, duration: 1.3, ease: 'power2.out' });
    gsap.fromTo(fx, { ring: 0 }, { ring: 1, duration: 1.1, ease: 'power2.out', onComplete: () => { fx.ring = -1; } });
    if (opts.confetti) celebrate();   // pluie de confettis multicolores plein écran (désactivable dans les paramètres)
  }

  function finish() {
    tl = null;
    Object.assign(fx, { active: false, moving: false, emit: [] });
    c.canvas?.classList.remove('on');
    sinkPage(0);
    c.card.style.visibility = '';
    c.dim.style.opacity = '';
    c.dim.classList.remove('on');
    c.skip.classList.remove('on');
    c.fill.style.transition = '';
    c.glow.style.transition = '';
    onDone();
  }

  /* Préparation : la carte DOM est relayée par la carte 3D (identiques au pixel près).
     Sa barre passe en bleu en coulisses pour la fin de l'animation. */
  c.dim.classList.add('on');
  c.skip.classList.add('on');
  c.fill.style.transition = 'none';
  c.glow.style.transition = 'none';
  c.fill.style.background = gradFor(to);
  c.fill.style.width = to + '%';
  c.glow.style.width = to + '%';
  gsap.set(c.blue, { opacity: 1, filter: 'none' });
  gsap.set(c.glow, { backgroundColor: '#3b82f6', opacity: 0.9 });
  c.canvas.classList.add('on');
  paint();
  c.card.style.visibility = 'hidden';

  tl = gsap.timeline({ onUpdate: paint, onComplete: finish });
  /* 1 — Détourage lumineux du contour, puis la carte se décolle de la page */
  tl.to(hold, { sink: 0.35, duration: 0.6, ease: 'sine.inOut' }, 0)
    .to(fx, { cutGlow: 1, duration: 0.15, ease: 'sine.out' }, 0)
    .to(fx, { cut: 1, duration: 0.75, ease: 'power1.inOut' }, 0.03)
    .to(fx, { lift: 1, duration: 0.8, ease: 'back.out(1.4)' }, 0.75)
    .to(fx, { cutGlow: 0, duration: 0.9, ease: 'sine.inOut' }, 0.85)
    .to(hold, { sink: 1, duration: 0.9, ease: 'power2.inOut' }, 0.75)
  /* 2 — Le gel s'allume en bleu électrique de 0 jusqu'à l'ancien score */
    .set(fx, { p: 0 }, 1.0)
    .to(fx, { blue: 1, duration: 0.4, ease: 'power2.out' }, 1.0)
    .to(fx, { pastel: 0, duration: 0.5, ease: 'power2.in' }, 1.1)
    .to(fx, { p: from, duration: 0.9, ease: 'power2.out' }, 1.05)
  /* 3 — Pose A : la carte flotte, inclinée ; l'arche se gonfle ; puis gros plan sur le front */
    .to(fx, { intro: 1, duration: 1.8, ease: 'power3.inOut' }, 1.15)
    .to(fx, { arch: 1, duration: 1.0, ease: 'power2.out' }, 1.75)
    .to(fx, { as: 1, duration: 1.6, ease: 'elastic.out(1, 0.5)' }, 1.85)
    .to(fx, { zoom: 1, duration: 1.8, ease: 'power2.inOut' }, 2.8)
  /* 4 — Course jusqu'au nouveau score : la carte se désincline et se pose à plat (pose B) */
    .addLabel('run', 4.5)
    .call(() => { fx.moving = true; }, null, 'run')
    .to(fx, { p: to, duration: run, ease: 'power2.inOut' }, 'run')
    .call(() => { fx.moving = false; }, null, `run+=${run}`)
    .to(fx, { lay0: 1, duration: 0.45, ease: 'sine.inOut' }, `run+=${run}`)   // à l'arrivée : bien à plat, carte entière avec l'arche
  /* 5 — Fin en 2D sans coupure, la barre reprend son pastel */
    .addLabel('ret', `run+=${run + (to >= 100 ? 0.5 : 0.3)}`)
    .to(fx, { arch: 0, duration: 0.4, ease: 'power3.in' }, 'ret')
    .to(fx, { as: 0, duration: 0.3, ease: 'power2.in' }, 'ret+=.2')
    .to(fx, { intro: 0, duration: 0.95, ease: 'power3.inOut' }, 'ret+=.1')
    .to(fx, { lift: 0, duration: 0.85, ease: 'power3.inOut' }, 'ret+=.15')
    .to(hold, { sink: 0, duration: 0.85, ease: 'power2.inOut' }, 'ret+=.15')
    .call(() => { c.card.style.visibility = ''; c.canvas.classList.remove('on'); }, null, 'ret+=1.05')   // relais carte 3D → carte DOM
    .to(c.blue, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 'ret+=1.05')
    .to(c.glow, { backgroundColor: getColorForPercentage(to), opacity: to ? 0.4 : 0, duration: 0.8, ease: 'power2.inOut' }, 'ret+=1.05');
}
