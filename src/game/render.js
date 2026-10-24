import { AIR, BEDROCK } from './data.js';
import { ENTRY, START_Y, tile } from './sim.js';
import { drawBase, drawBeam, drawHeadframe, drawLadder, drawLamp, drawMiner, makeTiles, paintSkyline, skyColors } from './art.js';

/* =====================================================================
   LA MINE — rendu d'une image (caméra qui suit le personnage, ciel + ville en surface, galeries, lumière de la lampe)
   Ne dessine que les tuiles visibles ; textures, ciel et obscurité préparés une fois (canevas hors écran).
   ===================================================================== */
const SKY_ROWS = 6; // hauteur du ciel au-dessus du sol (en tuiles)
const BASE_X = 2; // la cabane de la base en surface

export function createView(canvas, W) {
  const v = { canvas, ctx: canvas.getContext('2d'), W, tiles: null, TS: 44, dpr: 1, w: 0, h: 0, cam: { x: 0, y: 0 }, follow: true, sky: null, skyKey: '', dark: document.createElement('canvas'), parts: [], lastHit: 0 };
  v.resize = () => {
    const r = canvas.getBoundingClientRect();
    v.dpr = Math.min(2, devicePixelRatio || 1);
    v.w = r.width; v.h = r.height;
    v.TS = r.width < 600 ? 36 : 46;
    canvas.width = Math.round(r.width * v.dpr); canvas.height = Math.round(r.height * v.dpr);
    v.tiles = makeTiles(W, Math.round(v.TS * v.dpr));
    v.dark.width = Math.ceil(r.width / 2); v.dark.height = Math.ceil(r.height / 2);
    v.skyKey = '';
  };
  v.resize();
  return v;
}

/* position (pieds) du personnage en tuiles + pose */
export function heroPose(g, set, W, live) {
  const anim = (a) => (live ? a : 'idle');
  if (g.act === 'rest') return { x: g.x + 0.5, y: g.y + 1, anim: 'sleep', face: g.dir === 'left' ? -1 : 1 };
  if ((g.act === 'toBase' || g.act === 'toFace') && g.route) {
    // chemin : galeries jusqu'au puits, puis la surface jusqu'à la base
    const pts = g.route.map(([x, y]) => [x + 0.5, y + 1]).concat([[ENTRY + 0.5, 0], [BASE_X + 1.7, 0]]);
    const segs = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const v = pts[i][1] !== pts[i - 1][1] ? 1.66 : 1; const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * v; segs.push(l); tot += l; }
    let d = (g.act === 'toBase' ? 1 - g.walk / g.walkTotal : g.walk / g.walkTotal) * tot;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const k = segs[i] ? Math.min(1, d / segs[i]) : 1, a = pts[i], b = pts[i + 1];
        const goingRight = g.act === 'toBase' ? b[0] > a[0] : a[0] > b[0];
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, anim: anim(a[1] !== b[1] ? 'climb' : 'walk'), face: a[0] === b[0] ? 1 : goingRight ? 1 : -1 };
      }
      d -= segs[i];
    }
  }
  const face = g.dir === 'left' ? -1 : g.dir === 'right' ? 1 : g.hdir === 'left' ? -1 : 1;
  // avance dans une galerie déjà creusée : glissement entre deux tuiles
  const d = { right: [1, 0], left: [-1, 0], down: [0, 1] }[g.dir] || [0, 0];
  const tx = g.x + d[0], ty = g.y + d[1];
  if (g.act === 'dig' && tile(W, set, tx, ty) === AIR) return { x: g.x + 0.5 + d[0] * g.prog, y: g.y + 1 + d[1] * g.prog, anim: anim(d[1] ? 'climb' : 'walk'), face };
  return { x: g.x + 0.5, y: g.y + 1, anim: g.act === 'dig' ? anim('dig') : 'idle', face, dig: g.dir === 'down' ? 'down' : 'side', target: g.act === 'dig' ? [tx, ty] : null };
}

/* une image */
export function drawFrame(v, g, set, t, dt, live, vision) {
  const { ctx, W, TS, dpr } = v;
  const hero = heroPose(g, set, W, live);
  // caméra : suit le personnage en douceur
  const tx = hero.x * TS - v.w / 2, ty = hero.y * TS - v.h * 0.55;
  const maxX = W.width * TS - v.w, minY = -SKY_ROWS * TS, maxY = W.depth * TS - v.h;
  if (v.follow) {
    const k = 1 - Math.exp(-dt * 4);
    v.cam.x += (tx - v.cam.x) * k; v.cam.y += (ty - v.cam.y) * k;
  }
  v.cam.x = Math.max(0, Math.min(maxX, v.cam.x)); v.cam.y = Math.max(minY, Math.min(maxY, v.cam.y));
  const cx = v.cam.x, cy = v.cam.y;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  // ciel + ville (préparés pour l'heure courante et la taille de l'écran)
  const hour = new Date().getHours(), night = skyColors(hour)[2];
  const skyH = SKY_ROWS * TS, key = `${v.w}x${skyH}@${hour}`;
  if (v.skyKey !== key) {
    v.sky = document.createElement('canvas'); v.sky.width = Math.round(v.w * dpr); v.sky.height = Math.round(skyH * dpr);
    const sc = v.sky.getContext('2d'); sc.scale(dpr, dpr); paintSkyline(sc, v.w, skyH, hour); v.skyKey = key;
  }
  ctx.fillStyle = '#120c08'; ctx.fillRect(0, 0, v.w, v.h);
  const groundY = -cy; // ligne du sol à l'écran
  if (groundY > 0) {
    ctx.drawImage(v.sky, 0, groundY - skyH, v.w, skyH);
    ctx.fillStyle = skyColors(hour)[0]; if (groundY - skyH > 0) ctx.fillRect(0, 0, v.w, groundY - skyH);
  }

  // tuiles visibles
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(W.width - 1, Math.ceil((cx + v.w) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(W.depth - 1, Math.ceil((cy + v.h) / TS));
  const T = v.tiles, var3 = (x, y) => (x * 7 + y * 13) % 3;
  const solid = (x, y) => { const k = tile(W, set, x, y); return k !== AIR; };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = tile(W, set, x, y), sx = x * TS - cx, sy = y * TS - cy;
      if (k === BEDROCK) continue;
      if (k === AIR) {
        ctx.drawImage(T.cave[var3(x, y)], sx, sy, TS, TS);
        // ombre sous le plafond, sol plus clair
        if (y > 0 && solid(x, y - 1)) { const gr = ctx.createLinearGradient(0, sy, 0, sy + TS * 0.45); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(sx, sy, TS, TS * 0.45); }
        if (solid(x, y + 1)) { ctx.fillStyle = 'rgba(120,80,50,.45)'; ctx.fillRect(sx, sy + TS * 0.9, TS, TS * 0.1); }
        const horiz = solid(x, y - 1) && solid(x, y + 1) && (!solid(x - 1, y) || !solid(x + 1, y));
        if (horiz && x % 6 === 0) drawBeam(ctx, sx, sy, TS);
        else if (!solid(x, y - 1) && solid(x - 1, y) && solid(x + 1, y) && y > 0) drawLadder(ctx, sx, sy, TS);
        if (horiz && x % 9 === 4) drawLamp(ctx, sx, sy, TS, t);
      } else {
        ctx.drawImage(T.t[k][var3(x, y)], sx, sy, TS, TS);
        if (y === 0) { // herbe en surface
          ctx.fillStyle = night ? '#2f5a3a' : '#5cae4f'; ctx.fillRect(sx, sy, TS, TS * 0.2);
          ctx.fillStyle = night ? '#3d7049' : '#79c96a';
          for (let i = 0; i < 4; i++) { const gx = sx + ((x * 31 + i * 11) % 10) / 10 * TS; ctx.beginPath(); ctx.moveTo(gx, sy + TS * 0.2); ctx.lineTo(gx + TS * 0.05, sy - TS * 0.12); ctx.lineTo(gx + TS * 0.12, sy + TS * 0.2); ctx.fill(); }
        }
      }
    }
  }
  // fissures sur la tuile en cours de creusage
  if (hero.target && live && g.prog > 0.02) {
    const [tx2, ty2] = hero.target, sx = tx2 * TS - cx, sy = ty2 * TS - cy;
    ctx.strokeStyle = 'rgba(15,8,4,.8)'; ctx.lineWidth = Math.max(1.5, TS / 22); ctx.lineCap = 'round';
    const n = Math.ceil(g.prog * 5);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + tx2, r = TS * (0.2 + 0.25 * g.prog);
      ctx.beginPath(); ctx.moveTo(sx + TS / 2, sy + TS / 2);
      ctx.lineTo(sx + TS / 2 + Math.cos(a) * r * 0.6, sy + TS / 2 + Math.sin(a) * r * 0.6); ctx.lineTo(sx + TS / 2 + Math.cos(a + 0.4) * r, sy + TS / 2 + Math.sin(a + 0.4) * r); ctx.stroke();
    }
  }
  // surface : base et chevalement
  if (groundY > -TS) {
    drawBase(ctx, BASE_X * TS - cx, groundY, TS, night);
    drawHeadframe(ctx, (ENTRY + 0.5) * TS - cx, groundY, TS, live && g.act !== 'rest' ? t : 0, night);
  }
  // éclats de roche
  if (live && hero.anim === 'dig') {
    const ph = (t * 1.6) % 1;
    if (ph > 0.88 && v.lastHit < 0.88 && hero.target) {
      const [tx2, ty2] = hero.target;
      for (let i = 0; i < 6; i++) v.parts.push({ x: (tx2 + 0.5) * TS, y: (ty2 + 0.5) * TS, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 160, life: 0.6, c: Math.random() < 0.5 ? '#c9a27e' : '#7b6a5c' });
    }
    v.lastHit = ph;
  }
  v.parts = v.parts.filter((p) => (p.life -= dt) > 0);
  for (const p of v.parts) {
    p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - cx - 2, p.y - cy - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  // personnage
  drawMiner(ctx, hero.x * TS - cx, hero.y * TS - cy, TS, { gender: g.hero.gender, face: hero.face, anim: hero.anim, dig: hero.dig, t });

  // obscurité sous terre, trouée par la lampe frontale et les lanternes
  const D = v.dark, dc = D.getContext('2d'), s = 0.5;
  dc.setTransform(1, 0, 0, 1, 0, 0); dc.clearRect(0, 0, D.width, D.height);
  const top = Math.max(0, groundY + TS * 0.6);
  if (top < v.h) {
    dc.globalCompositeOperation = 'source-over';
    const fade = dc.createLinearGradient(0, (groundY + TS * 0.2) * s, 0, (groundY + TS * 2.6) * s);
    fade.addColorStop(0, 'rgba(8,5,3,0)'); fade.addColorStop(1, 'rgba(8,5,3,.93)');
    dc.fillStyle = fade; dc.fillRect(0, Math.max(0, groundY) * s, D.width, D.height);
    dc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const gr = dc.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.8})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr; dc.fillRect((x - r) * s, (y - r) * s, r * 2 * s, r * 2 * s);
    };
    const flick = 1 + Math.sin(t * 7) * 0.015;
    hole(hero.x * TS - cx + hero.face * TS * 0.3, hero.y * TS - cy - TS * 0.8, TS * (3.4 + vision) * flick);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x % 9 !== 4 || tile(W, set, x, y) !== AIR) continue;
      if (solid(x, y - 1) && solid(x, y + 1)) hole((x + 0.5) * TS - cx, (y + 0.5) * TS - cy, TS * 2.3, 0.85);
    }
    dc.globalCompositeOperation = 'source-over';
    ctx.drawImage(D, 0, 0, v.w, v.h);
    // reflet chaud de la lampe
    const lx = hero.x * TS - cx + hero.face * TS * 0.3, ly = hero.y * TS - cy - TS * 0.9;
    const warm = ctx.createRadialGradient(lx, ly, 0, lx, ly, TS * 2.6);
    warm.addColorStop(0, 'rgba(255,200,120,.16)'); warm.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = warm; ctx.fillRect(lx - TS * 3, ly - TS * 3, TS * 6, TS * 6);
  }
  return hero;
}

export const SKY = SKY_ROWS;
export { START_Y };
