import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { fx, TRACK_Z } from './shared';
import { clamp, gradFor, getColorForPercentage } from '../lib/colors';

/* =====================================================================
   CHORÉGRAPHIE CINÉMATIQUE — caméra de poursuite à la 3e personne
   1. Le bloc de progression se détache de la carte (la page s'enfonce, floue).
   2. La caméra plonge et zoome sur le 0 % : vue rasante derrière la barre,
      la ligne d'arrivée (arche FOKUS 100%) visible au fond.
   3. La piste s'illumine, la barre bleue avance jusqu'au pourcentage exact ;
      le bloc glisse en sens inverse → la caméra suit le front de près, zoom constant.
   4. Retour en 2D sans coupure : la piste 3D se repose exactement sur la barre DOM.
   ===================================================================== */
let tl = null;

/* Cadrage de la caméra de poursuite */
const CHASE = {
  yaw: 58,     // la piste file vers le fond de l'écran
  pitch: 21,   // caméra basse, légèrement plongeante (vue rasante)
  zoom: 2.0,   // zoom constant pendant la poursuite
  ax: -0.1,    // position écran du front (fraction de la largeur, depuis le centre)
  ay: 0.2,     // … et de la hauteur
  az: -60,     // recul en profondeur
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const canAnimate = () => !reduced() && fx.ready;

export function skip() { if (tl) tl.timeScale(5); }

// ?slow=0.3 : ralentit toute l'animation (tests visuels)
const slow = typeof location !== 'undefined' && +new URLSearchParams(location.search).get('slow');
if (slow) { gsap.globalTimeline.timeScale(slow); gsap.ticker.lagSmoothing(0); }

/**
 * @param {object} c refs : card, pct, pwrap, pbar, fill, blue, glow, bg (éléments qui s'enfoncent), list, dim, skip, canvas, hud
 */
export function race(c, from, to, onDone) {
  const vw = innerWidth, vh = innerHeight, mob = vw < 640;
  const O = { x: vw / 2, y: vh / 2 };
  const b = c.pbar.getBoundingClientRect(), w = c.pwrap.getBoundingClientRect();
  Object.assign(fx, {
    active: true, race: fx.race + 1, k: 0, lift: 0, p: 0, old: from, to, pastel: 1, blue: 0, rail: 0, ground: 0,
    arch: 0, as: 0, flash: 0, ring: -1, moving: false, O,
    G: { x0: b.left - O.x, y: b.top + b.height / 2 - O.y, barW: b.width, bh: b.height, mob },
  });
  const G = fx.G;
  const zoom = mob ? 1.45 : vw < 1000 ? 1.75 : CHASE.zoom;
  const A = { x: CHASE.ax * vw, y: CHASE.ay * vh, z: CHASE.az };
  let fired = false;
  const items = [...c.list.querySelectorAll('li')].slice(0, 14);
  const bg = [c.card, ...c.bg];
  const hudNum = c.hud.querySelector('b');

  // l'origine de la transformation du bloc DOM = l'œil de la caméra (centre de l'écran)
  c.pwrap.style.transformOrigin = `${O.x - w.left}px ${O.y - w.top}px`;

  /* Matrice du bloc : M = T(h + k(A − h)) · Rx(−pitch·k) · Ry(yaw·k) · Rx(90°·k) · S · T(−h)
     → identité à k = 0 ; à k = 1 le front h est épinglé en A et le bloc glisse en sens inverse. */
  function matrix(t) {
    const k = fx.k, hx = G.x0 + (fx.p / 100) * G.barW, hy = G.y;
    const s = 1 + (zoom - 1) * k;
    const sway = (Math.sin(t * 0.8) * 1.6 + Math.sin(t * 1.9) * 0.5) * k;
    const bob = Math.sin(t * 1.3) * 4 * k;
    return `translate3d(${hx + k * (A.x - hx)}px,${hy + k * (A.y - hy) + bob}px,${k * A.z + 70 * fx.lift}px) `
      + `rotateX(${-(CHASE.pitch + sway * 0.4) * k}deg) rotateY(${(CHASE.yaw + sway) * k}deg) rotateX(${90 * k}deg) `
      + `scale3d(${s},${s},${s}) translate3d(${-hx}px,${-hy}px,0)`;
  }

  function paint() {
    const t = performance.now() / 1000, m = matrix(t);
    const M = new DOMMatrix(m);
    fx.m = M.toFloat32Array();
    if (+c.pwrap.style.opacity !== 0) c.pwrap.style.transform = `perspective(${fx.P}px) ${m}`;
    c.fill.style.width = to + '%';
    // compteur qui accompagne le front de la barre
    const hp = M.transformPoint(new DOMPoint(G.x0 + (fx.p / 100) * G.barW, G.y, TRACK_Z));
    const f = fx.P / Math.max(1, fx.P - hp.z);
    c.hud.style.transform = `translate3d(${O.x + hp.x * f}px,${O.y + hp.y * f - 70 - 40 * fx.k}px,0) translate(-50%,-100%)`;
    hudNum.textContent = Math.round(fx.p) + '%';
    // à l'approche de l'arche, le compteur s'efface pour laisser place au « 100% » de l'arche
    c.hud.style.setProperty('--fade', to >= 100 ? clamp((95 - fx.p) / 8, 0, 1) : 1);
    c.pct.textContent = Math.round(Math.max(fx.p, fx.blue > 0.5 ? 0 : from)) + '%';
    if (to >= 100 && !fired && fx.p >= 99.4) climax();
    try { fx.render?.(); } catch (e) { console.warn('Rendu 3D interrompu :', e); fx.render = null; tl?.progress(1); }
  }

  function climax() {
    fired = true;
    fx.burst++;
    gsap.fromTo(fx, { flash: 1 }, { flash: 0, duration: 1.3, ease: 'power2.out' });
    gsap.fromTo(fx, { ring: 0 }, { ring: 1, duration: 1.1, ease: 'power2.out', onComplete: () => { fx.ring = -1; } });
    const o = fx.archScreen ?? { x: vw / 2, y: vh / 3 };
    const origin = { x: clamp(o.x / vw, 0, 1), y: clamp(o.y / vh, 0, 1) };
    confetti({ particleCount: 170, spread: 100, startVelocity: 42, origin, zIndex: 300, colors: ['#ffffff', '#93c5fd', '#3b82f6', '#86efac'] });
    setTimeout(() => confetti({ particleCount: 120, spread: 150, startVelocity: 30, origin, zIndex: 300, colors: ['#ffffff', '#bfdbfe', '#60a5fa'] }), 280);
  }

  function finish() {
    tl = null;
    Object.assign(fx, { active: false, moving: false });
    c.canvas?.classList.remove('on');
    gsap.set(c.pwrap, { clearProps: 'transform,transformOrigin,opacity' });
    gsap.set([...bg, ...items], { clearProps: 'transform,filter,opacity' });
    gsap.set(c.hud, { opacity: 0 });
    c.dim.classList.remove('on');
    c.skip.classList.remove('on');
    c.fill.style.transition = '';
    c.glow.style.transition = '';
    onDone();
  }

  /* Préparation : la barre DOM passe en bleu (cachée derrière la piste 3D jusqu'au retour) */
  c.dim.classList.add('on');
  c.skip.classList.add('on');
  c.fill.style.transition = 'none';
  c.glow.style.transition = 'none';
  c.fill.style.background = gradFor(to);
  c.fill.style.width = to + '%';
  c.glow.style.width = to + '%';
  gsap.set(c.blue, { opacity: 1, filter: 'none' });
  gsap.set(c.glow, { backgroundColor: '#3b82f6', opacity: 0.9 });
  gsap.set(c.pwrap, { opacity: 1 });
  gsap.set(c.hud, { opacity: 0 });
  c.canvas.classList.add('on');
  paint();

  const run = 1.3 + 2.2 * (to / 100);                       // durée de la poursuite : proportionnelle au chemin parcouru
  const sink = { z: -220, transformPerspective: 1100, filter: 'blur(9px)', opacity: 0.18, duration: 1.1, ease: 'power3.inOut' };
  tl = gsap.timeline({ onUpdate: paint, onComplete: finish });
  /* 1 — Le bloc de progression se détache, la page s'enfonce */
  tl.to(c.pwrap, { opacity: 0, duration: 0.2, ease: 'none' }, 0.02)        // relais instantané DOM → piste 3D (alignées au pixel)
    .to(fx, { lift: 1, duration: 0.55, ease: 'power2.out' }, 0)
    .to(bg, sink, 0.05)
    .to(items, { ...sink, z: -300, rotationX: 10, stagger: 0.03 }, 0.08)
    .to(c.dim, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0)
  /* 2 — Plongée de la caméra et zoom sur le 0 % ; l'arrivée apparaît au fond */
    .to(fx, { k: 1, duration: 1.6, ease: 'power3.inOut' }, 0.3)
    .to(fx, { lift: 0, duration: 1.2, ease: 'power2.inOut' }, 0.6)
    .to(fx, { ground: 1, duration: 1.1, ease: 'power2.out' }, 0.55)
    .to(fx, { pastel: 0, duration: 0.7, ease: 'power2.in' }, 1.1)
    .to(fx, { as: 1, duration: 0.4, ease: 'power2.out' }, 1.0)
    .to(fx, { arch: 1, duration: 1.2, ease: 'back.out(1.4)' }, 1.0)
  /* 3 — La piste s'illumine en bleu, puis poursuite jusqu'au pourcentage exact */
    .addLabel('lit', 1.85)
    .to(fx, { blue: 1, duration: 0.35, ease: 'power2.out' }, 'lit')
    .to(fx, { rail: 1, duration: 0.9, ease: 'power2.inOut' }, 'lit')
    .to(c.hud, { opacity: 1, duration: 0.4 }, 'lit+=.15')
    .addLabel('run', 'lit+=.45')
    .call(() => { fx.moving = true; }, null, 'run')
    .to(fx, { p: to, duration: run, ease: 'power1.inOut' }, 'run')
    .call(() => { fx.moving = false; }, null, `run+=${run}`)
  /* 4 — Retour en 2D sans coupure, la barre reprend son pastel */
    .addLabel('ret', `run+=${run + (to >= 100 ? 1.0 : 0.55)}`)
    .to(c.hud, { opacity: 0, duration: 0.3 }, 'ret')
    .to(fx, { k: 0, duration: 1.5, ease: 'expo.inOut' }, 'ret')
    .to(fx, { arch: 0, duration: 0.6, ease: 'power3.in' }, 'ret')
    .to(fx, { as: 0, duration: 0.3, ease: 'power2.in' }, 'ret+=.4')
    .to(fx, { ground: 0, rail: 0, duration: 0.9, ease: 'power2.inOut' }, 'ret+=.2')
    .to([...bg, ...items], { z: 0, rotationX: 0, filter: 'blur(0px)', opacity: 1, duration: 1.1, ease: 'power3.inOut', stagger: 0.012 }, 'ret+=.3')
    .to(c.dim, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 'ret+=.4')
    .set(c.pwrap, { opacity: 1, transform: 'none' }, 'ret+=1.5')        // relais piste 3D → barre DOM (k = 0)
    .call(() => c.canvas.classList.remove('on'), null, 'ret+=1.5')
    .to(c.blue, { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 'ret+=1.5')
    .to(c.glow, { backgroundColor: getColorForPercentage(to), opacity: to ? 0.4 : 0, duration: 1.4, ease: 'power2.inOut' }, 'ret+=1.5');
}
