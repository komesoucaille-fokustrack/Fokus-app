import { AIR, BEDROCK, PICKS } from './data.js';
import { ENTRY, START_Y, cap, dirtEdge, tile, tileAt } from './sim.js';
import { PATCH, drawTree, drawHeadframe, drawLadder, drawLantern, drawMarket, drawMiner, drawShop, drawSupport, drawWorkshop, makeTiles, paintSkyline, skyColors } from './art.js';

/* =====================================================================
   LA MINE — rendu d'une image : caméra qui suit le personnage, ciel + ville en surface, galeries creusées.
   Lumière : sous terre tout est noir ; seules les lanternes posées par le mineur et sa lampe frontale éclairent.
   La lumière se propage le long des galeries (pas à travers la roche) et n'éclaire qu'une case de paroi :
   impossible de voir un minerai qui n'est pas au bord d'une galerie éclairée.
   Ne dessine que les cases visibles ; matières en motifs (une seule passe par matière), lumière calculée par case
   puis lissée en agrandissant une toute petite image.
   ===================================================================== */
const SKY_ROWS = 6; // hauteur du ciel au-dessus du sol (en cases)
/* bâtiments de la surface (en cases) : on les touche pour y entrer */
export const BUILDINGS = [
  { id: 'workshop', x0: 0.2, x1: 3.8, h: 3.4 },
  { id: 'shop', x0: 4.4, x1: 7.6, h: 3.6 },
  { id: 'market', x0: 13.6, x1: 17.2, h: 3.4 },
];
const MARKET_X = 15.4; // le personnage vend devant l'étal
const DARK = [8, 7, 18]; // couleur de l'obscurité (indigo très sombre, jamais un noir plat)
const h2 = (x, y) => { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

export function createView(canvas, W) {
  const v = { canvas, ctx: canvas.getContext('2d'), W, tiles: null, TS: 44, dpr: 1, w: 0, h: 0, cam: { x: 0, y: 0 }, follow: true, sky: null, skyKey: '', parts: [], lastHit: 0, shade: document.createElement('canvas'), pat: null };
  v.resize = () => {
    const r = canvas.getBoundingClientRect();
    v.dpr = Math.min(2, devicePixelRatio || 1);
    v.w = r.width; v.h = r.height;
    v.TS = r.width < 600 ? 38 : 48;
    canvas.width = Math.round(r.width * v.dpr); canvas.height = Math.round(r.height * v.dpr);
    v.tiles = makeTiles(W, Math.round(v.TS * v.dpr));
    const ctx = v.ctx, T = v.tiles;
    v.pat = { mat: {}, wall: {} };
    for (const k of [1, 2]) { v.pat.mat[k] = ctx.createPattern(T.mat[k], 'repeat'); v.pat.wall[k] = ctx.createPattern(T.wall[k], 'repeat'); }
    // vignette (préparée une fois)
    v.vig = document.createElement('canvas'); v.vig.width = 256; v.vig.height = 256;
    const vc = v.vig.getContext('2d'), vg = vc.createRadialGradient(128, 128, 60, 128, 128, 182);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); vc.fillStyle = vg; vc.fillRect(0, 0, 256, 256);
    v.skyKey = '';
  };
  v.resize();
  return v;
}

/* position (pieds) du personnage en cases + pose */
function alongRoute(pts, k) {
  const segs = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) { const vv = pts[i][1] !== pts[i - 1][1] ? 1.66 : 1; const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * vv; segs.push(l); tot += l; }
  let d = k * tot;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const u = segs[i] ? Math.min(1, d / segs[i]) : 1, a = pts[i], b = pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, vert: a[1] !== b[1], dx: b[0] - a[0] };
    }
    d -= segs[i];
  }
  return { x: pts[0][0], y: pts[0][1], vert: false, dx: 0 };
}
export function heroPose(g, set, W, live) {
  const anim = (a) => (live ? a : 'idle');
  if (g.act === 'rest') return { x: g.x + 0.5, y: g.y + 1, anim: 'sleep', face: g.hdir === 'left' ? -1 : 1 };
  if ((g.act === 'toBase' || g.act === 'toFace') && g.route) {
    // chemin : galeries jusqu'au puits, puis la surface jusqu'au marché
    const pts = g.route.map(([x, y]) => [x + 0.5, y + 1]).concat([[ENTRY + 0.5, 0], [MARKET_X, 0]]);
    const back = g.act === 'toFace', p = alongRoute(pts, back ? g.walk / g.walkTotal : 1 - g.walk / g.walkTotal);
    return { x: p.x, y: p.y, anim: anim(p.vert ? 'climb' : 'walk'), face: p.dx === 0 ? 1 : (p.dx > 0) !== back ? 1 : -1 };
  }
  if (g.act === 'move' && g.route) { // traversée vers un nouveau front de taille
    const p = alongRoute(g.route.map(([x, y]) => [x + 0.5, y + 1]), 1 - g.walk / g.walkTotal);
    return { x: p.x, y: p.y, anim: anim(p.vert ? 'climb' : 'walk'), face: p.dx === 0 ? 1 : p.dx > 0 ? 1 : -1 };
  }
  const face = g.dir === 'left' ? -1 : g.dir === 'right' ? 1 : g.hdir === 'left' ? -1 : 1;
  const d = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[g.dir] || [0, 0];
  const tx = g.x + d[0], ty = g.y + d[1];
  // avance dans une galerie déjà creusée : glissement entre deux cases
  if (g.act === 'dig' && g.prog > 0 && tile(W, set, tx, ty) === AIR) return { x: g.x + 0.5 + d[0] * g.prog, y: g.y + 1 + d[1] * g.prog, anim: anim(d[1] ? 'climb' : 'walk'), face };
  return { x: g.x + 0.5, y: g.y + 1, anim: g.act === 'dig' ? anim('dig') : 'idle', face, dig: g.dir === 'down' ? 'down' : 'side', target: g.act === 'dig' && tile(W, set, tx, ty) !== AIR ? [tx, ty] : null };
}

/* ---------- lumière ---------- */
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/* Lumière par case dans la zone [lx0, lx0 + cols) × [ly0, ly0 + rows) */
function computeLight(v, W, set, lx0, ly0, cols, rows, sources) {
  const L = v.L && v.L.length === cols * rows ? v.L.fill(0) : (v.L = new Float32Array(cols * rows));
  const inside = (x, y) => x >= lx0 && y >= ly0 && x < lx0 + cols && y < ly0 + rows;
  const put = (x, y, val) => { if (!inside(x, y)) return; const i = (y - ly0) * cols + (x - lx0); if (val > L[i]) L[i] = val; };
  const air = (x, y) => y < 0 || tile(W, set, x, y) === AIR;
  // surface : le ciel éclaire le haut du sol (coupe du terrain)
  for (let y = ly0; y < Math.min(ly0 + rows, 3); y++) for (let x = lx0; x < lx0 + cols; x++) put(x, y, y < 0 ? 1 : [1, 0.42, 0.08][y]);
  for (const s of sources) {
    const R = s.r, x0 = Math.floor(s.x), y0 = Math.floor(s.y), max = Math.ceil(R * 1.5);
    if (x0 + R < lx0 - 1 || x0 - R > lx0 + cols || y0 + R < ly0 - 1 || y0 - R > ly0 + rows) continue;
    // la lumière suit les galeries (largeur d'abord), puis éclaire une case de paroi
    const seen = new Map([[x0 * 4096 + y0, 0]]), q = [[x0, y0]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], st = seen.get(x * 4096 + y);
      const val = Math.min(1, s.i * 1.25 * smooth(1 - Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) / R));
      if (val <= 0.01 && st > 1) continue;
      put(x, y, val);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy, k = nx * 4096 + ny;
        if (air(nx, ny)) {
          if (dx && dy) continue; // déplacement en croix seulement dans les galeries
          if (!seen.has(k) && st < max) { seen.set(k, st + 1); q.push([nx, ny]); }
        } else {
          put(nx, ny, Math.min(1, s.i * 1.25 * smooth(1 - Math.hypot(nx + 0.5 - s.x, ny + 0.5 - s.y) / R)) * (s.wall || 0.92));
        }
      }
    }
  }
  return L;
}

/* une image */
export function drawFrame(v, g, set, t, dt, live, vision, goal = { progress: 0, built: false }) {
  const { ctx, W, TS, dpr } = v;
  const hero = heroPose(g, set, W, live);
  // caméra : suit le personnage en douceur ; près de la surface, le sol est cadré vers le milieu (bâtiments en entier)
  const tx = hero.x * TS - v.w / 2, ty = hero.y * TS < v.h * 0.4 ? -v.h * 0.45 : hero.y * TS - v.h * 0.55;
  const maxX = W.width * TS - v.w, minY = -SKY_ROWS * TS, maxY = W.depth * TS - v.h;
  if (v.follow) {
    const k = 1 - Math.exp(-dt * 4);
    v.cam.x += (tx - v.cam.x) * k; v.cam.y += (ty - v.cam.y) * k;
  }
  v.cam.x = Math.max(0, Math.min(maxX, v.cam.x)); v.cam.y = Math.max(minY, Math.min(maxY, v.cam.y));
  const cx = v.cam.x, cy = v.cam.y;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'source-over';

  // ciel + ville (préparés pour l'heure courante et la taille de l'écran)
  const hour = new Date().getHours(), night = skyColors(hour)[2];
  const skyH = SKY_ROWS * TS, key = `${v.w}x${skyH}@${hour}`;
  if (v.skyKey !== key) {
    v.sky = document.createElement('canvas'); v.sky.width = Math.round(v.w * dpr); v.sky.height = Math.round(skyH * dpr);
    const sc = v.sky.getContext('2d'); sc.scale(dpr, dpr); paintSkyline(sc, v.w, skyH, hour); v.skyKey = key;
  }
  ctx.fillStyle = `rgb(${DARK})`; ctx.fillRect(0, 0, v.w, v.h);
  const groundY = -cy; // ligne du sol à l'écran
  if (groundY > 0) {
    ctx.drawImage(v.sky, 0, groundY - skyH, v.w, skyH);
    ctx.fillStyle = skyColors(hour)[0]; if (groundY - skyH > 0) ctx.fillRect(0, 0, v.w, groundY - skyH + 1);
  }

  // cases visibles (+ une case de marge pour les formes arrondies)
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(W.width - 1, Math.ceil((cx + v.w) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(W.depth - 1, Math.ceil((cy + v.h) / TS));
  const T = v.tiles;
  const solid = (x, y) => y >= 0 && tile(W, set, x, y) !== AIR;
  const isAir = (x, y) => y >= 0 && tile(W, set, x, y) === AIR;
  const m = new DOMMatrix().translateSelf(-cx, -cy).scaleSelf(TS / T.S);
  const fillPat = (pat, path) => { pat.setTransform?.(m); ctx.fillStyle = pat; path ? ctx.fill(path) : ctx.fill(); };
  const gTop = Math.max(0, groundY);
  const ores = [], airs = [];
  if (gTop < v.h) {
    // 1) la roche, d'un seul tenant
    ctx.beginPath(); ctx.rect(0, gTop, v.w, v.h - gTop); fillPat(v.pat.mat[2]);
    // 2) la couche de terre : limite ondulée continue (même formule que la simulation) + poches arrondies
    const dirt = new Path2D();
    dirt.moveTo(-2, groundY);
    for (let px = -2; px <= v.w + 8; px += 8) dirt.lineTo(px, dirtEdge(W, (px + cx) / TS - 0.5) * TS - cy);
    dirt.lineTo(v.w + 8, groundY); dirt.closePath();
    for (let y = Math.max(y0, 8); y <= Math.min(y1, 32); y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (tileAt(W, x, y) !== 1 || y < dirtEdge(W, x)) continue;
      const rr = TS * (0.68 + h2(x, y) * 0.1), px = x * TS - cx + TS / 2, py = y * TS - cy + TS / 2;
      dirt.moveTo(px + rr, py); dirt.ellipse(px, py, rr, rr * 0.9, 0, 0, 7);
    }
    fillPat(v.pat.mat[1], dirt);
    // liseré à la limite terre / roche (la ligne ondulée seulement)
    const edge = new Path2D();
    for (let px = -2; px <= v.w + 8; px += 8) { const ey = dirtEdge(W, (px + cx) / TS - 0.5) * TS - cy; px < 0 ? edge.moveTo(px, ey) : edge.lineTo(px, ey); }
    ctx.strokeStyle = 'rgba(14,9,16,.5)'; ctx.lineWidth = TS * 0.08; ctx.stroke(edge);
    ctx.save(); ctx.translate(0, -TS * 0.04); ctx.strokeStyle = 'rgba(255,220,190,.07)'; ctx.lineWidth = TS * 0.03; ctx.stroke(edge); ctx.restore();
  }
  // 3) minerais (visibles seulement s'ils sont éclairés : l'obscurité les recouvre ensuite)
  for (let y = y0; y <= y1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const k = tile(W, set, x, y);
    if (k === AIR) { airs.push([x, y, x * TS - cx, y * TS - cy]); continue; }
    if (k >= 3) { ores.push([x, y, x * TS - cx, y * TS - cy, k]); ctx.drawImage(T.ore[k][(x * 7 + y * 13) % 3], x * TS - cx, y * TS - cy, TS, TS); }
  }
  // 4) galeries aux bords organiques : union de disques (une case) et de passages (entre deux cases voisines)
  const tun = new Path2D();
  for (const [x, y, sx, sy] of airs) {
    // centre légèrement décalé et rayon variable : parois irrégulières, jamais un festonnage régulier
    const ccx = sx + TS / 2 + (h2(x * 5, y) - 0.5) * TS * 0.14, ccy = sy + TS / 2 + (h2(x, y * 5) - 0.5) * TS * 0.1, rr = TS * (0.5 + h2(x, y) * 0.1);
    tun.moveTo(ccx + rr, ccy); tun.arc(ccx, ccy, rr, 0, Math.PI * 2);
    if (isAir(x + 1, y)) { const hh = TS * (0.42 + h2(x * 3, y) * 0.1); tun.rect(sx + TS / 2, sy + TS / 2 - hh + (h2(x, y * 9) - 0.5) * TS * 0.06, TS, hh * 2); }
    if (isAir(x, y + 1)) { const ww = TS * (0.38 + h2(x, y * 3) * 0.08); tun.rect(sx + TS / 2 - ww, sy + TS / 2, ww * 2, TS); }
    if (y === 0) tun.rect(sx + TS * 0.08, sy - 1, TS * 0.84, TS / 2 + 1); // ouverture du puits au ras du sol
  }
  // rebord de roche : contour sombre + arête claire sous le sol des galeries (dessinés avant le creux, qui en recouvre la moitié)
  ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(0, TS * 0.045); ctx.strokeStyle = 'rgba(255,228,200,.22)'; ctx.lineWidth = TS * 0.09; ctx.stroke(tun); ctx.restore();
  ctx.strokeStyle = 'rgba(10,8,18,.75)'; ctx.lineWidth = TS * 0.1; ctx.stroke(tun);
  fillPat(v.pat.wall[2], tun);
  ctx.save(); ctx.clip(tun);
  if (gTop < v.h) { // paroi de terre au-dessus de la limite terre / roche
    const dw = new Path2D(); dw.moveTo(-2, groundY);
    for (let px = -2; px <= v.w + 8; px += 8) dw.lineTo(px, dirtEdge(W, (px + cx) / TS - 0.5) * TS - cy);
    dw.lineTo(v.w + 8, groundY); dw.closePath(); fillPat(v.pat.wall[1], dw);
  }
  // ombres intérieures (plafond, parois, sol) — à l'intérieur du creux seulement
  for (const [x, y, sx, sy] of airs) {
    const up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
    if (up) { const gr = ctx.createLinearGradient(0, sy, 0, sy + TS * 0.6); gr.addColorStop(0, 'rgba(6,5,14,.75)'); gr.addColorStop(1, 'rgba(6,5,14,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - 1, sy - TS * 0.1, TS + 2, TS * 0.7); }
    if (dn) { const gr = ctx.createLinearGradient(0, sy + TS, 0, sy + TS * 0.72); gr.addColorStop(0, 'rgba(6,5,14,.4)'); gr.addColorStop(1, 'rgba(6,5,14,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - 1, sy + TS * 0.72, TS + 2, TS * 0.4); }
    if (lf) { const gr = ctx.createLinearGradient(sx, 0, sx + TS * 0.35, 0); gr.addColorStop(0, 'rgba(6,5,14,.5)'); gr.addColorStop(1, 'rgba(6,5,14,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - TS * 0.1, sy, TS * 0.45, TS); }
    if (rt) { const gr = ctx.createLinearGradient(sx + TS, 0, sx + TS * 0.65, 0); gr.addColorStop(0, 'rgba(6,5,14,.5)'); gr.addColorStop(1, 'rgba(6,5,14,0)'); ctx.fillStyle = gr; ctx.fillRect(sx + TS * 0.65, sy, TS * 0.45, TS); }
  }
  ctx.restore();
  // 5) décor des galeries : gravier, racines, stalactites, cristaux, boisages, échelles
  for (const [x, y, sx, sy] of airs) {
    const up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
    if (dn) for (let i = 0; i < 3; i++) { // gravier au sol
      const px = sx + TS * (0.05 + h2(x * 5 + i, y) * 0.9), pr = TS * (0.025 + h2(x, y * 3 + i) * 0.04), py = sy + TS * (0.98 + Math.abs(px - sx - TS / 2) / TS * 0.06) - pr * 0.7;
      ctx.fillStyle = i % 2 ? '#4d4458' : '#2c2735'; ctx.beginPath(); ctx.ellipse(px, py, pr * 1.4, pr, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,210,.1)'; ctx.beginPath(); ctx.ellipse(px - pr * 0.3, py - pr * 0.4, pr * 0.5, pr * 0.25, 0, 0, 7); ctx.fill();
    }
    if (up && y < 12 && h2(x, y + 7) < 0.5) { // racines qui pendent près de la surface
      ctx.strokeStyle = 'rgba(70,45,30,.9)'; ctx.lineWidth = Math.max(1, TS / 36);
      for (let i = 0; i < 2; i++) { const rx = sx + TS * (0.2 + h2(x + i, y) * 0.6), rl = TS * (0.18 + h2(y, x + i) * 0.22); ctx.beginPath(); ctx.moveTo(rx, sy + TS * 0.04); ctx.quadraticCurveTo(rx + TS * 0.06 * Math.sin(t * 0.8 + x), sy + rl * 0.6, rx - TS * 0.03, sy + rl); ctx.stroke(); }
    } else if (up && h2(x * 3, y) < 0.35) { // stalactites
      for (let i = 0; i < 2; i++) {
        const rx = sx + TS * (0.15 + h2(x, y + i * 5) * 0.7), rl = TS * (0.08 + h2(x + i * 9, y) * 0.12), rw = rl * 0.35;
        const gr = ctx.createLinearGradient(0, sy, 0, sy + rl); gr.addColorStop(0, '#2a2534'); gr.addColorStop(1, '#5c5470');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(rx - rw, sy + TS * 0.02); ctx.lineTo(rx, sy + TS * 0.02 + rl); ctx.lineTo(rx + rw, sy + TS * 0.02); ctx.closePath(); ctx.fill();
      }
    }
    if (y > 30 && (dn || up) && h2(x * 7, y * 3) < 0.12) { // petits cristaux décoratifs dans les profondeurs
      const base = dn ? sy + TS * 0.98 : sy + TS * 0.02, dir = dn ? -1 : 1, cxx = sx + TS * (0.3 + h2(x, y * 7) * 0.4), hue = y > 70 ? ['#7ee0d0', '#d9fff8'] : ['#a99cff', '#efeaff'];
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * TS * 0.07, hh = TS * (0.12 + h2(x + i, y) * 0.14) * (i === 1 ? 1.3 : 1), ww = TS * 0.035;
        const gr = ctx.createLinearGradient(cxx + ox - ww, 0, cxx + ox + ww, 0); gr.addColorStop(0, hue[1]); gr.addColorStop(1, hue[0]);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(cxx + ox - ww, base); ctx.lineTo(cxx + ox - ww * 0.8 + (i - 1) * ww, base + dir * hh * 0.8); ctx.lineTo(cxx + ox + (i - 1) * ww * 1.2, base + dir * hh); ctx.lineTo(cxx + ox + ww, base); ctx.closePath(); ctx.fill();
      }
    }
    const tunnel = up && dn && (!lf || !rt);
    if (tunnel && h2(x, y) < 0.2 && y > 1) drawSupport(ctx, sx, sy, TS);
    // échelle seulement dans les puits étroits (pas dans les grandes salles)
    if (isAir(x, y + 1) && ((lf && rt) || (solid(x - 1, y + 1) && solid(x + 1, y + 1)))) drawLadder(ctx, sx, sy + TS * 0.5, TS);
  }
  // teinte de profondeur : la roche change de couleur en descendant (terre chaude → ardoise violette → bleu → turquoise)
  if (gTop < v.h) {
    const dg = ctx.createLinearGradient(0, groundY, 0, groundY + W.depth * TS);
    dg.addColorStop(0, 'rgb(255,246,236)'); dg.addColorStop(0.25, 'rgb(226,218,240)'); dg.addColorStop(0.6, 'rgb(190,204,240)'); dg.addColorStop(1, 'rgb(170,218,214)');
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = dg; ctx.fillRect(0, gTop, v.w, v.h - gTop);
    ctx.globalCompositeOperation = 'source-over';
  }
  // lanternes posées par le mineur
  const lampR = 4.8 + 0.5 * (g.up.lant || 0), sources = [], lit = [];
  const ly0 = Math.max(0, y0 - 6), ly1 = Math.min(W.depth - 1, y1 + 6), lx0 = Math.max(0, x0 - 6), lx1 = Math.min(W.width - 1, x1 + 6);
  for (const k of g.lamps) {
    const lx = k % W.width, ly = Math.floor(k / W.width);
    if (lx < lx0 || lx > lx1 || ly < ly0 || ly > ly1) continue;
    const fl = 1 + 0.03 * Math.sin(t * 7 + lx) * Math.sin(t * 4.3 + ly);
    sources.push({ x: lx + 0.5, y: ly + 0.45, r: lampR * fl, i: 1 });
    if (lx >= x0 - 1 && lx <= x1 + 1 && ly >= y0 - 1 && ly <= y1 + 1) lit.push([lx, ly]);
  }
  for (const [lx, ly] of lit) drawLantern(ctx, lx * TS - cx, ly * TS - cy, TS, t, solid(lx, ly - 1));
  // fissures sur la case en cours de creusage
  if (hero.target && live && g.prog > 0.02) {
    const [tx2, ty2] = hero.target, sx = tx2 * TS - cx, sy = ty2 * TS - cy;
    ctx.strokeStyle = 'rgba(10,6,3,.8)'; ctx.lineWidth = Math.max(1.4, TS / 26); ctx.lineCap = 'round';
    const n = Math.ceil(g.prog * 6);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + tx2, rr = TS * (0.18 + 0.28 * g.prog);
      ctx.beginPath(); ctx.moveTo(sx + TS / 2, sy + TS / 2);
      ctx.lineTo(sx + TS / 2 + Math.cos(a) * rr * 0.55, sy + TS / 2 + Math.sin(a) * rr * 0.55); ctx.lineTo(sx + TS / 2 + Math.cos(a + 0.35) * rr, sy + TS / 2 + Math.sin(a + 0.35) * rr); ctx.stroke();
    }
  }
  // surface : herbe, bâtiments, chevalement
  if (groundY > -TS) {
    const gx0 = Math.max(0, Math.floor(cx / TS)), gx1 = Math.ceil((cx + v.w) / TS);
    const gg = ctx.createLinearGradient(0, groundY - TS * 0.1, 0, groundY + TS * 0.22);
    gg.addColorStop(0, night ? '#2f4d38' : '#6c9a4e'); gg.addColorStop(1, night ? '#1d3022' : '#3f6430');
    ctx.fillStyle = gg; ctx.fillRect(0, groundY - TS * 0.04, v.w, TS * 0.22);
    ctx.strokeStyle = night ? '#3c6448' : '#86b862'; ctx.lineWidth = Math.max(1, TS / 30); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = gx0; x <= gx1; x++) for (let i = 0; i < 6; i++) {
      if (x === ENTRY) continue;
      const bx = x * TS - cx + TS * h2(x, i), bh = TS * (0.08 + h2(i, x) * 0.14), lean = (h2(x + i, 3) - 0.5) * TS * 0.08;
      ctx.moveTo(bx, groundY); ctx.quadraticCurveTo(bx + lean * 0.3, groundY - bh * 0.6, bx + lean, groundY - bh);
    }
    ctx.stroke();
    // la terre s'assombrit doucement sous l'herbe (raccord avec le sous-sol)
    const sg = ctx.createLinearGradient(0, groundY + TS * 0.15, 0, groundY + TS * 1.4);
    sg.addColorStop(0, 'rgba(8,7,18,0)'); sg.addColorStop(1, 'rgba(8,7,18,.45)');
    ctx.fillStyle = sg; ctx.fillRect(0, groundY + TS * 0.15, v.w, TS * 1.25);
    for (const [tx3, sd] of [[8.4, 3], [9.1, 5], [18.2, 7], [19.4, 2], [23.5, 9]]) drawTree(ctx, tx3 * TS - cx, groundY, TS, night, sd);
    drawWorkshop(ctx, 0.2 * TS - cx, groundY, TS, night, goal.progress, goal.built);
    drawShop(ctx, 4.4 * TS - cx, groundY, TS, night);
    drawHeadframe(ctx, (ENTRY + 0.5) * TS - cx, groundY, TS, live && g.act !== 'rest' ? t : 0, night);
    drawMarket(ctx, 13.6 * TS - cx, groundY, TS, night, t);
  }
  // éclats de roche
  if (live && hero.anim === 'dig') {
    const ph = (t * 1.6) % 1;
    if (ph > 0.88 && v.lastHit < 0.88 && hero.target) {
      const [tx2, ty2] = hero.target;
      for (let i = 0; i < 7; i++) v.parts.push({ x: (tx2 + 0.5) * TS, y: (ty2 + 0.5) * TS, vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 170, life: 0.7, r: 1 + Math.random() * 2.2, c: Math.random() < 0.5 ? '#b49478' : '#6e5d50' });
    }
    v.lastHit = ph;
  }
  v.parts = v.parts.filter((p) => (p.life -= dt) > 0);
  for (const p of v.parts) {
    p.vy += 560 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x - cx, p.y - cy, p.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // personnage
  drawMiner(ctx, hero.x * TS - cx, hero.y * TS - cy, TS * 1.15, { gender: g.hero.gender, face: hero.face, anim: hero.anim, dig: hero.dig, t, pickColor: (PICKS[g.up.pick] || PICKS[0])[1], bag: g.bagN / cap(g) });

  // ---------- lumière ----------
  const under = groundY < v.h;
  if (under) {
    const helm = { x: hero.x + hero.face * 0.15, y: hero.y - 0.75, r: (3.5 + vision * 0.875) * (1 + Math.sin(t * 6) * 0.01), i: 1, wall: 0.95 };
    sources.push(helm, { x: ENTRY + 0.5, y: -0.5, r: 5, i: 0.9 });
    const cols = x1 - x0 + 3, rows = y1 - y0 + 3, Lx0 = x0 - 1, Ly0 = y0 - 1;
    const L = computeLight(v, W, set, Lx0, Ly0, cols, rows, sources);
    // image d'obscurité à deux points par case : dans la roche, seule la moitié tournée vers la galerie est éclairée
    // (la lumière ne « traverse » pas : un minerai à deux cases d'une galerie reste invisible)
    const S = v.shade, C2 = cols * 2, R2 = rows * 2;
    if (S.width !== C2 || S.height !== R2) { S.width = C2; S.height = R2; v.img = null; }
    const sc = S.getContext('2d'), img = v.img || (v.img = sc.createImageData(C2, R2)), d = img.data;
    const open = (x, y) => y < 0 || tile(W, set, x, y) === AIR;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = Lx0 + i, y = Ly0 + j, l = L[j * cols + i], so = !open(x, y);
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        let val = l;
        if (so && l > 0) { const hx = x + (a ? 1 : -1), vy = y + (b ? 1 : -1); if (!(open(hx, y) || open(x, vy) || open(hx, vy))) val = l * 0.6; }
        const o = ((j * 2 + b) * C2 + i * 2 + a) * 4;
        d[o] = DARK[0]; d[o + 1] = DARK[1]; d[o + 2] = DARK[2]; d[o + 3] = Math.round((1 - Math.min(1, Math.pow(val, 0.75))) * 255);
      }
    }
    // flou 3 × 3 sur l'opacité : bords de lumière doux, jamais en escalier
    const A = v.alpha && v.alpha.length === C2 * R2 ? v.alpha : (v.alpha = new Uint8ClampedArray(C2 * R2));
    for (let i = 0; i < C2 * R2; i++) A[i] = d[i * 4 + 3];
    for (let j = 0; j < R2; j++) for (let i = 0; i < C2; i++) {
      let sum = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= C2 || jj >= R2) continue; sum += A[jj * C2 + ii]; n++; }
      d[(j * C2 + i) * 4 + 3] = sum / n;
    }
    sc.putImageData(img, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(S, Lx0 * TS - cx, Ly0 * TS - cy, cols * TS, rows * TS); // lissé en agrandissant
    const Lat = (x, y) => (x < Lx0 || y < Ly0 || x >= Lx0 + cols || y >= Ly0 + rows ? 0 : L[(y - Ly0) * cols + (x - Lx0)]);
    // halos chauds (ajoutés)
    ctx.globalCompositeOperation = 'lighter';
    const glow = (px, py, rr, a, c = '255,170,90') => { const gr = ctx.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gr; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2); };
    for (const [lx, ly] of lit) glow((lx + 0.5) * TS - cx, (ly + 0.45) * TS - cy, TS * 2.4, 0.2 + 0.02 * Math.sin(t * 8 + lx));
    const hx = helm.x * TS - cx, hy = helm.y * TS - cy;
    glow(hx, hy, TS * 2.2, 0.13, '255,214,150');
    // faisceau de la lampe frontale
    if (g.act !== 'rest') {
      const bx = hx + hero.face * TS * 0.25, len = TS * (2.6 + vision * 0.4);
      const bg = ctx.createLinearGradient(bx, 0, bx + hero.face * len, 0); bg.addColorStop(0, 'rgba(255,230,180,.13)'); bg.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(bx, hy - TS * 0.06); ctx.lineTo(bx + hero.face * len, hy - TS * 0.7); ctx.lineTo(bx + hero.face * len, hy + TS * 0.8); ctx.closePath(); ctx.fill();
    }
    // minerais éclairés : lueur colorée + éclats qui scintillent
    for (const [x, y, sx, sy, k] of ores) {
      const l = Lat(x, y);
      if (l < 0.3) continue;
      const o = W.ores[k - 3];
      if (o.value >= 20) glow(sx + TS / 2, sy + TS / 2, TS * 0.8, 0.12 * l, hexRgb(o.colors[0]));
      const ph = (t * 0.6 + x * 0.37 + y * 0.61) % 2.6;
      if (ph < 0.45) {
        const a = Math.sin((ph / 0.45) * Math.PI) * l, gx = sx + TS * (0.25 + h2(x, y) * 0.5), gy = sy + TS * (0.25 + h2(y, x) * 0.5), rr = TS * 0.2 * a;
        ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
        ctx.beginPath(); ctx.moveTo(gx, gy - rr); ctx.lineTo(gx + rr * 0.18, gy - rr * 0.18); ctx.lineTo(gx + rr, gy); ctx.lineTo(gx + rr * 0.18, gy + rr * 0.18); ctx.lineTo(gx, gy + rr); ctx.lineTo(gx - rr * 0.18, gy + rr * 0.18); ctx.lineTo(gx - rr, gy); ctx.lineTo(gx - rr * 0.18, gy - rr * 0.18); ctx.closePath(); ctx.fill();
      }
    }
    // poussière qui flotte dans la lumière
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996, rr = TS * (0.5 + ((i * 37) % 10) / 10 * 3), px = hx + Math.cos(a + t * 0.05) * rr, py = hy + Math.sin(a * 1.3 + t * 0.08) * rr * 0.6;
      const l = Lat(Math.floor((px + cx) / TS), Math.floor((py + cy) / TS));
      if (l < 0.2) continue;
      ctx.fillStyle = `rgba(255,236,200,${(0.1 + 0.1 * Math.sin(t * 0.8 + i)) * l})`; ctx.beginPath(); ctx.arc(px, py, Math.max(0.7, TS * 0.025), 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // rayons de jour qui descendent dans le puits
  if (groundY > -TS * 2 && groundY < v.h) {
    const px = (ENTRY + 0.5) * TS - cx, ray = ctx.createLinearGradient(0, groundY, 0, groundY + TS * 4.5);
    ray.addColorStop(0, night ? 'rgba(170,190,255,.14)' : 'rgba(255,240,200,.22)'); ray.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = ray;
    ctx.beginPath(); ctx.moveTo(px - TS * 0.42, groundY); ctx.lineTo(px + TS * 0.42, groundY); ctx.lineTo(px + TS * 0.9, groundY + TS * 4.5); ctx.lineTo(px - TS * 0.2, groundY + TS * 4.5); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // grain fin (texture préparée une fois)
  if (!v.grain) {
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gx = gc.getContext('2d'), im = gx.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) { const n = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255; }
    gx.putImageData(im, 0, 0); v.grain = ctx.createPattern(gc, 'repeat');
  }
  ctx.globalAlpha = 0.035; ctx.fillStyle = v.grain; ctx.fillRect(0, 0, v.w, v.h); ctx.globalAlpha = 1;
  // vignette
  ctx.drawImage(v.vig, -v.w * 0.08, -v.h * 0.08, v.w * 1.16, v.h * 1.16);
  // textes flottants (« +1 Or », « au coffre »…)
  v.pops = (v.pops || []).filter((p) => (p.life -= dt) > 0);
  for (const p of v.pops) {
    const k2 = 1 - p.life / p.max;
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.font = `700 ${Math.round(TS * 0.32)}px Inter Variable, sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, p.x * TS - cx, p.y * TS - cy - k2 * TS * 1.2);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * TS - cx, p.y * TS - cy - k2 * TS * 1.2);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';
  return hero;
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };

export const SKY = SKY_ROWS;
export const pop = (v, text, x, y, color = '#ffe08a') => { (v.pops = v.pops || []).push({ text, x, y, color, life: 1.6, max: 1.6 }); };
/* bâtiment touché (coordonnées écran → monde) */
export function hitBuilding(v, sx, sy) {
  const wx = (sx + v.cam.x) / v.TS, wy = (sy + v.cam.y) / v.TS;
  return BUILDINGS.find((b) => wx >= b.x0 && wx <= b.x1 && wy <= 0.2 && wy >= -b.h)?.id || null;
}
export { START_Y };
