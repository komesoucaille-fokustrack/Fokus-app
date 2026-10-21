import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { fx } from './shared';
import { clamp, gradFor, getColorForPercentage } from '../lib/colors';

/* =====================================================================
   CHORÉGRAPHIE CINÉMATIQUE « IN-PLACE »
   La carte DOM bascule en perspective 3D ; la scène WebGL (arche, néon, étincelles)
   reçoit exactement la même matrice → les deux mondes restent alignés au pixel près.
   ===================================================================== */
let tl = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canAnimate = () => !reduced();

export function skip() { if (tl) tl.timeScale(6); }

// ?slow=0.3 : ralentit toute l'animation (tests visuels)
const slow = typeof location !== 'undefined' && +new URLSearchParams(location.search).get('slow');
if (slow) { gsap.globalTimeline.timeScale(slow); gsap.ticker.lagSmoothing(0); }

/**
 * @param {object} c refs : card, pct, pbar, fill, blue, glow, head, end, rail, bg (éléments qui s'enfoncent), list, dim, skip, canvas
 */
export function race(c, from, to, onDone) {
  const vw = innerWidth, vh = innerHeight;
  const r = c.card.getBoundingClientRect(), b = c.pbar.getBoundingClientRect();
  Object.assign(fx, {
    active: true, k: 0, p: from, to, arch: 0, as: 0, blue: 0, flash: 0, ring: -1, moving: false,
    O: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    G: { cw: r.width, barL: b.left - r.left, barW: b.width, by: b.top + b.height / 2 - (r.top + r.height / 2), bh: b.height, mob: vw < 640, vw, vh },
  });
  let fired = false;
  const G = fx.G;
  const fxEls = [...c.card.querySelectorAll('.fx')];
  const items = [...c.list.querySelectorAll('li')].slice(0, 14);

  function paint() {
    const k = fx.k, t = performance.now() / 1000;
    const tilt = 64 * k, s = 1 + (G.mob ? 0.2 : 0.42) * k;
    const headX = G.barL + (fx.p / 100) * G.barW, endX = G.barL + G.barW;
    const focus = (headX * 0.45 + endX * 0.55) - G.cw / 2;   // la caméra cadre le front de progression ET l'arche
    const tx = k * (vw / 2 - fx.O.x - focus * s);
    const ty = k * (vh * 0.6 - fx.O.y - G.by * s * Math.cos((tilt * Math.PI) / 180));
    const rz = (-9 + 1.4 * Math.sin(t * 1.3)) * k, ry = (6 + 2.2 * Math.sin(t * 1.7)) * k;
    const m = `translate3d(${tx}px,${ty}px,${120 * k}px) rotateX(${tilt}deg) rotateZ(${rz}deg) rotateY(${ry}deg) scale(${s})`;
    c.card.style.transform = `perspective(${fx.P}px) ${m}`;
    c.card.style.boxShadow = `inset 0 1px 0 0 rgba(255,255,255,.14),0 ${10 + 70 * k}px ${30 + 110 * k}px ${-10 + 10 * k}px rgba(0,0,0,${0.6 + 0.3 * k})`;
    fx.m = new DOMMatrix(m).toFloat32Array();
    c.pbar.style.transform = `translateZ(${8 * k}px)`;
    c.fill.style.width = fx.p + '%';
    c.head.style.left = fx.p + '%';
    c.glow.style.width = fx.p + '%';
    c.rail.style.setProperty('--p', fx.p + '%');
    c.pct.textContent = Math.round(fx.p) + '%';
    if (to >= 100 && !fired && fx.p >= 99.4) climax();
    try { fx.render?.(); } catch (e) { console.warn('Rendu 3D interrompu :', e); fx.render = null; c.canvas?.classList.remove('on'); }
  }

  function climax() {
    fired = true;
    fx.burst++;
    gsap.fromTo(fx, { flash: 1 }, { flash: 0, duration: 1.3, ease: 'power2.out' });
    gsap.fromTo(fx, { ring: 0 }, { ring: 1, duration: 1.1, ease: 'power2.out', onComplete: () => { fx.ring = -1; } });
    const o = fx.archScreen ?? (() => { const e = c.end.getBoundingClientRect(); return { x: e.left, y: e.top }; })();
    const origin = { x: clamp(o.x / vw, 0, 1), y: clamp(o.y / vh, 0, 1) };
    confetti({ particleCount: 170, spread: 100, startVelocity: 42, origin, zIndex: 300, colors: ['#ffffff', '#93c5fd', '#3b82f6', '#86efac'] });
    setTimeout(() => confetti({ particleCount: 120, spread: 150, startVelocity: 30, origin, zIndex: 300, colors: ['#ffffff', '#bfdbfe', '#60a5fa'] }), 280);
  }

  function finish() {
    tl = null;
    Object.assign(fx, { active: false, moving: false });
    c.canvas?.classList.remove('on');
    c.card.style.transform = '';
    c.card.style.boxShadow = '';
    c.card.classList.remove('live');
    c.pbar.style.transform = '';
    gsap.set([...c.bg, ...items], { clearProps: 'transform,filter,opacity' });
    gsap.set(c.blue, { clearProps: 'filter' });
    c.dim.classList.remove('on');
    c.skip.classList.remove('on');
    c.fill.style.transition = '';
    c.glow.style.transition = '';
    onDone();
  }

  /* Préparation : la carte passe au-dessus du voile, la barre devient blanche puis bleu électrique */
  c.card.classList.add('live');
  c.dim.classList.add('on');
  c.skip.classList.add('on');
  c.fill.style.transition = 'none';
  c.glow.style.transition = 'none';
  c.fill.style.background = gradFor(to);
  gsap.set(c.blue, { opacity: 1, filter: 'brightness(4) saturate(0)' });
  gsap.set(c.glow, { backgroundColor: '#ffffff', opacity: 0.5 });
  paint();
  if (fx.ready) c.canvas?.classList.add('on');

  tl = gsap.timeline({ onUpdate: paint, onComplete: finish });
  const sink = { z: -180, transformPerspective: 1100, filter: 'blur(8px)', opacity: 0.25, duration: 1.15, ease: 'power3.inOut' };
  /* Phase 1 — plongée de la caméra, l'arrière-plan s'enfonce (flou de profondeur de champ) */
  tl.to(fx, { k: 1, duration: 1.25, ease: 'power3.inOut' }, 0)
    .to(c.bg, sink, 0)
    .to(items, { ...sink, z: -260, rotationX: 12, stagger: 0.035 }, 0.02)
    .to(c.dim, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 0)
    .to(fxEls, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.15)
  /* Phase 2 — l'arche se dresse hors de la piste */
    .to(fx, { as: 1, duration: 0.4, ease: 'power2.out' }, 0.4)
    .to(fx, { arch: 1, duration: 1.15, ease: 'back.out(1.5)' }, 0.4)
  /* Phase 3 — flash blanc → bleu électrique, progression + étincelles */
    .addLabel('run', 1.3)
    .to(c.blue, { filter: 'brightness(1) saturate(1)', duration: 0.5, ease: 'power2.out' }, 'run')
    .to(c.glow, { backgroundColor: '#3b82f6', opacity: 0.95, duration: 0.5 }, 'run')
    .to(fx, { blue: 1, duration: 0.45, ease: 'power2.out' }, 'run')
    .call(() => { fx.moving = true; }, null, 'run')
    .to(fx, { p: to, duration: 2.5, ease: 'power2.inOut' }, 'run')
    .call(() => { fx.moving = false; }, null, 'run+=2.5')
  /* Phase 4 — repli de l'arche et retour 2D sans coupure, la barre reprend son pastel */
    .addLabel('ret', to >= 100 ? 'run+=3.1' : 'run+=2.7')
    .to(fx, { arch: 0, duration: 0.6, ease: 'power3.in' }, 'ret')
    .to(fx, { as: 0, duration: 0.3, ease: 'power2.in' }, 'ret+=.4')
    .to(fx, { k: 0, duration: 1.2, ease: 'expo.inOut' }, 'ret+=.1')
    .to([...c.bg, ...items], { z: 0, rotationX: 0, filter: 'blur(0px)', opacity: 1, duration: 1.05, ease: 'power3.inOut', stagger: 0.012 }, 'ret+=.2')
    .to(c.dim, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 'ret+=.2')
    .to(fxEls, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 'ret+=.35')
    .to(fx, { blue: 0, duration: 1.3, ease: 'power2.inOut' }, 'ret+=.45')
    .to(c.blue, { opacity: 0, duration: 1.5, ease: 'power2.inOut' }, 'ret+=.55')
    .to(c.glow, { backgroundColor: getColorForPercentage(to), opacity: to ? 0.4 : 0, duration: 1.5, ease: 'power2.inOut' }, 'ret+=.55');
}
