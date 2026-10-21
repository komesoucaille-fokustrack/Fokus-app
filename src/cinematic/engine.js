import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { fx } from './shared';
import { clamp, gradFor, getColorForPercentage } from '../lib/colors';

/* =====================================================================
   CHORÉGRAPHIE CINÉMATIQUE
   1. Détourage lumineux : deux traits de lumière glissent le long du contour de la carte
      « Aujourd'hui », qui se décolle de la page (vraie dalle 3D épaisse, ombre portée).
   2. Plan large : la carte flotte, inclinée dans l'espace.
   3. Zoom progressif sur le début de la barre (fond flou).
   4. Le gel s'illumine en bleu électrique jusqu'à l'ancien score, puis avance jusqu'au nouveau ;
      la caméra suit le front de près, avec un effet de vitesse proportionnel à l'écart.
      Plus la course avance, plus la carte redescend : à plat peu après la moitié du trajet
      (FLAT_AT), même perspective, et l'on retrouve simplement la page.
   5. Fin en 2D, sans coupure : la carte 3D se repose exactement sur la carte DOM.
   ===================================================================== */
let tl = null;

/* Cadrage (cf. visuels de référence) */
const CAM = {
  roll: -30,       // la carte monte vers la droite
  yaw: 24,         // son extrémité droite fuit vers le fond
  pitch: 44,       // vue plongeante sur la face (plan large)
  pitchClose: 54,  // … plus rasante en gros plan
  wide: 0.66,      // largeur du plan large (fraction de l'écran occupée par la carte)
  close: 2.5,      // échelle du gros plan sur la barre
};
const FLAT_AT = 0.62; // part de la course (ancien score → nouveau) où la carte est revenue à plat

const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (6 * x - 15) + 10); };
const tiltLeft = (u) => 1 - smoother(u / FLAT_AT);
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
export function race(c, from, to, onDone) {
  const vw = innerWidth, vh = innerHeight, mob = vw < 640;
  const O = { x: vw / 2, y: vh / 2 };
  const r = c.card.getBoundingClientRect(), b = c.pbar.getBoundingClientRect();
  Object.assign(fx, {
    active: true, race: fx.race + 1, intro: 0, zoom: 0, k: 0, lift: 0, p: from, old: from, to, shown: from, pastel: 1, blue: 0, speed: 0,
    arch: 0, as: 0, flash: 0, ring: -1, moving: false, cut: 0, cutGlow: 0, emit: [], O,
    C: { x0: r.left - O.x, y0: r.top - O.y, w: r.width, h: r.height, r: parseFloat(getComputedStyle(c.card).borderRadius) || 16 },
    G: { x0: b.left - O.x, y: b.top + b.height / 2 - O.y, barW: b.width, bh: b.height, mob },
    face: measureFace(c, r),
  });
  const C = fx.C, G = fx.G;
  const close = mob ? 1.8 : vw < 1000 ? 2.2 : CAM.close, wide = Math.min(1, (CAM.wide * vw) / C.w);
  const Aw = { x: 0.02 * vw, y: 0.02 * vh }, Ac = { x: -0.12 * vw, y: 0.14 * vh };
  const hold = { sink: 0 };             // la page reste enfoncée pendant le détourage et le plan large
  const last = { t: 0, p: from };
  const progress = () => (to > from ? (fx.p - from) / (to - from) : 1); // avancement de la course (0 → 1)
  let fired = false;
  const items = [...c.list.querySelectorAll('li')].slice(0, 14);
  const bg = c.bg;

  /* Matrice de la carte : M = T(F + k(A − F) + lift) · Rx(pitch) · Ry(yaw) · Rz(roll) · S · T(−F)
     F = point visé (centre de la carte → front de la barre), A = sa place à l'écran.
     Identité à k = 0 ; en gros plan le front est épinglé en A : la carte glisse en sens inverse. */
  function matrix(t) {
    const k = fx.k, z = fx.zoom, hx = G.x0 + (fx.p / 100) * G.barW, hy = G.y;
    const fxp = lerp(C.x0 + C.w / 2, hx, z), fyp = lerp(C.y0 + C.h / 2, hy, z);
    const ax = lerp(Aw.x, Ac.x, z), ay = lerp(Aw.y, Ac.y, z);
    // effet de vitesse : la caméra recule un peu et tremble quand la barre file
    const s = (1 + k * (wide - 1 + z * (close - wide))) * (1 - 0.1 * fx.speed * k);
    const shake = fx.speed * k * 2.2;
    const drift = (Math.sin(t * 0.7) * 1.4 + Math.sin(t * 1.7) * 0.4) * k;
    const pitch = (lerp(CAM.pitch, CAM.pitchClose, z) + drift * 0.5) * k;
    return `translate3d(${fxp + k * (ax - fxp) + Math.sin(t * 61) * shake}px,${fyp + k * (ay - fyp) + Math.sin(t * 1.2) * 3 * k + Math.cos(t * 53) * shake}px,${90 * fx.lift * tiltLeft(progress())}px) `
      + `rotateX(${pitch}deg) rotateY(${(CAM.yaw + drift) * k}deg) rotateZ(${CAM.roll * k}deg) `
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
    fx.k = fx.intro * tiltLeft(progress());
    // vitesse instantanée de la barre (% / s) → intensité de l'effet de vitesse
    const now = performance.now();
    if (last.t) {
      const dt = Math.max(1e-3, (now - last.t) / 1000), v = (fx.p - last.p) / dt;
      fx.speed += (clamp(v / 45, 0, 1) - fx.speed) * Math.min(1, dt * 10);
    }
    last.t = now;
    last.p = fx.p;
    fx.shown = Math.max(from, fx.p); // l'ancien score reste affiché jusqu'à ce que le bleu le dépasse
    fx.m = new DOMMatrix(matrix(t)).toFloat32Array();
    const s = Math.max(fx.k, hold.sink);
    sinkPage(s);
    c.dim.style.opacity = s;
    c.pct.textContent = Math.round(fx.shown) + '%';
    if (to >= 100 && !fired && fx.p >= 99.4) climax();
    try { fx.render?.(); } catch (e) { console.warn('Rendu 3D interrompu :', e); fx.render = null; tl?.progress(1); }
  }

  function climax() {
    fired = true;
    fx.burst++;
    gsap.fromTo(fx, { flash: 1 }, { flash: 0, duration: 1.3, ease: 'power2.out' });
    gsap.fromTo(fx, { ring: 0 }, { ring: 1, duration: 1.1, ease: 'power2.out', onComplete: () => { fx.ring = -1; } });
    const e = c.pbar.getBoundingClientRect();
    const o = fx.k > 0.3 && fx.archScreen ? fx.archScreen : { x: e.right, y: e.top + e.height / 2 };
    const origin = { x: clamp(o.x / vw, 0, 1), y: clamp(o.y / vh, 0, 1) };
    confetti({ particleCount: 170, spread: 100, startVelocity: 42, origin, zIndex: 300, colors: ['#ffffff', '#93c5fd', '#3b82f6', '#86efac'] });
    setTimeout(() => confetti({ particleCount: 120, spread: 150, startVelocity: 30, origin, zIndex: 300, colors: ['#ffffff', '#bfdbfe', '#60a5fa'] }), 280);
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

  // durée de la poursuite : croît moins vite que l'écart → +50 % d'un coup file très vite, +10 % avance posément
  const run = 0.85 + 1.5 * Math.sqrt((to - from) / 100);
  tl = gsap.timeline({ onUpdate: paint, onComplete: finish });
  /* 1 — Détourage lumineux du contour, puis la carte se décolle de la page */
  tl.to(hold, { sink: 0.35, duration: 0.7, ease: 'sine.inOut' }, 0)
    .to(fx, { cutGlow: 1, duration: 0.25, ease: 'sine.out' }, 0)
    .to(fx, { cut: 1, duration: 1.05, ease: 'sine.inOut' }, 0.02)
    .to(fx, { lift: 1, duration: 0.7, ease: 'back.out(1.6)' }, 1.0)
    .to(fx, { cutGlow: 0, duration: 1.2, ease: 'sine.inOut' }, 1.05)
    .to(hold, { sink: 1, duration: 0.8, ease: 'power2.inOut' }, 1.0)
  /* 2 — Plan large : la carte flotte, inclinée ; l'arche d'arrivée se dresse au bout de la barre */
    .to(fx, { intro: 1, duration: 1.4, ease: 'power3.inOut' }, 1.15)
    .to(fx, { arch: 1, duration: 0.9, ease: 'power2.out' }, 1.6)
    .to(fx, { as: 1, duration: 1.4, ease: 'elastic.out(1, 0.45)' }, 1.7)   // l'arche se gonfle
  /* 3 — Zoom progressif sur le début de la barre */
    .to(fx, { zoom: 1, duration: 1.7, ease: 'power2.inOut' }, 2.35)
  /* 4 — Le gel s'illumine en bleu jusqu'à l'ancien score, puis poursuite jusqu'au nouveau ; la carte redescend peu à peu */
    .addLabel('lit', 3.9)
    .to(fx, { blue: 1, duration: 0.4, ease: 'power2.out' }, 'lit')
    .to(fx, { pastel: 0, duration: 0.6, ease: 'power2.in' }, 'lit+=.1')
    .addLabel('run', 'lit+=.45')
    .call(() => { fx.moving = true; }, null, 'run')
    .to(fx, { p: to, duration: run, ease: to - from > 35 ? 'power3.inOut' : 'power2.inOut' }, 'run')
    .to(hold, { sink: 0, duration: run * 0.6, ease: 'power1.inOut' }, 'run')
    .call(() => { fx.moving = false; }, null, `run+=${run}`)
  /* 5 — Fin en 2D sans coupure (déjà à plat si la barre a dépassé FLAT_AT), la barre reprend son pastel */
    .addLabel('ret', `run+=${run + (to >= 100 ? 0.8 : 0.4)}`)
    .to(fx, { intro: 0, zoom: 0, duration: 1.3, ease: 'expo.inOut' }, 'ret')
    .to(fx, { lift: 0, duration: 1.1, ease: 'power3.inOut' }, 'ret+=.1')
    .to(fx, { arch: 0, duration: 0.5, ease: 'power3.in' }, 'ret')
    .to(fx, { as: 0, duration: 0.3, ease: 'power2.in' }, 'ret+=.3')
    .call(() => { c.card.style.visibility = ''; c.canvas.classList.remove('on'); }, null, 'ret+=1.3')   // relais carte 3D → carte DOM
    .to(c.blue, { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 'ret+=1.3')
    .to(c.glow, { backgroundColor: getColorForPercentage(to), opacity: to ? 0.4 : 0, duration: 1.4, ease: 'power2.inOut' }, 'ret+=1.3');
}
