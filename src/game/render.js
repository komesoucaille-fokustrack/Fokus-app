import { AIR, BEDROCK, PICKS, SKINS } from './data.js';
import { ENTRY, START_Y, cap, dirtEdge, tile } from './sim.js';
import { OUT, drawTree, drawHeadframe, drawLadder, drawLantern, drawMarket, drawMiner, drawRail, drawShop, drawSupport, drawWorkshop, makeTiles, paintSkyline, skyColors } from './art.js';

/* =====================================================================
   LA MINE — rendu d'une image (DA « Fokus Mine », dessin animé coloré) : caméra qui suit le personnage,
   ciel + puys + ville en surface, coupe du sol en couches colorées, galeries creusées aux bords arrondis.
   Lumière : le sol reste visible, mais l'intérieur des galeries est sombre loin des lanternes et de la lampe
   frontale, et un minerai n'apparaît que s'il est éclairé (la lumière suit les galeries, une case de paroi).
   Ne dessine que les cases visibles ; couches en motifs (un remplissage par couche).
   ===================================================================== */
const SKY_ROWS = 6; // hauteur du ciel au-dessus du sol (en cases)
/* bâtiments de la surface (en cases) : on les touche pour y entrer */
export const BUILDINGS = [
  { id: 'workshop', x0: 0.2, x1: 3.8, h: 3.4 },
  { id: 'shop', x0: 4.4, x1: 7.6, h: 3.6 },
  { id: 'market', x0: 13.6, x1: 17.2, h: 3.4 },
];
const MARKET_X = 15.4; // le personnage vend devant l'étal
const DARK = [22, 12, 26]; // obscurité des galeries (prune très sombre)
const h2 = (x, y) => { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

export function createView(canvas, W) {
  const v = { canvas, ctx: canvas.getContext('2d'), W, tiles: null, TS: 44, dpr: 1, w: 0, h: 0, cam: { x: 0, y: 0 }, follow: true, sky: null, skyKey: '', parts: [], lastHit: 0, shade: document.createElement('canvas'), pat: null };
  v.resize = () => {
    const r = canvas.getBoundingClientRect();
    v.dpr = Math.min(2, devicePixelRatio || 1);
    v.w = r.width; v.h = r.height;
    v.TS = r.width < 600 ? 40 : 52;
    canvas.width = Math.round(r.width * v.dpr); canvas.height = Math.round(r.height * v.dpr);
    v.tiles = makeTiles(v.W, Math.round(v.TS * v.dpr));
    const ctx = v.ctx, T = v.tiles;
    v.pat = { layer: T.layer.map((c) => ctx.createPattern(c, 'repeat')), cave: T.cave.map((c) => ctx.createPattern(c, 'repeat')) };
    v.vig = document.createElement('canvas'); v.vig.width = 256; v.vig.height = 256;
    const vc = v.vig.getContext('2d'), vg = vc.createRadialGradient(128, 128, 80, 128, 128, 182);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,16,.32)'); vc.fillStyle = vg; vc.fillRect(0, 0, 256, 256);
    v.skyKey = '';
  };
  v.resize();
  return v;
}
/* limite (en cases) entre la couche i et la suivante, à l'abscisse wx (cases) : ondulée et continue */
export function layerEdge(W, i, wx) {
  if (i === 0) return dirtEdge(W, wx);
  return W.layerAt[i - 1] + Math.sin(wx * 0.33 + i * 1.7) * 1.3 + Math.sin(wx * 0.91 + i * 4.1) * 0.55;
}
export const layerOf = (W, x, y) => { let i = 0; while (i < W.layers.length - 1 && y + 0.5 >= layerEdge(W, i, x + 0.5)) i++; return i; };

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
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // ciel + puys + ville (préparés pour l'heure courante et la taille de l'écran)
  const hour = new Date().getHours(), night = skyColors(hour)[2];
  const skyH = SKY_ROWS * TS, key = `${v.w}x${skyH}@${hour}:${W.id}`;
  if (v.skyKey !== key) {
    v.sky = document.createElement('canvas'); v.sky.width = Math.round(v.w * dpr); v.sky.height = Math.round(skyH * dpr);
    const sc = v.sky.getContext('2d'); sc.scale(dpr, dpr); paintSkyline(sc, v.w, skyH, hour, 7, W.theme); v.skyKey = key;
  }
  const groundY = -cy; // ligne du sol à l'écran
  ctx.fillStyle = W.layers[W.layers.length - 1][3]; ctx.fillRect(0, 0, v.w, v.h);
  if (groundY > 0) {
    ctx.drawImage(v.sky, 0, groundY - skyH, v.w, skyH);
    ctx.fillStyle = skyColors(hour)[0]; if (groundY - skyH > 0) ctx.fillRect(0, 0, v.w, groundY - skyH + 1);
  }

  // cases visibles
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(W.width - 1, Math.ceil((cx + v.w) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(W.depth - 1, Math.ceil((cy + v.h) / TS));
  const solid = (x, y) => y >= 0 && tile(W, set, x, y) !== AIR;
  const isAir = (x, y) => y >= 0 && tile(W, set, x, y) === AIR;
  const T = v.tiles, m = new DOMMatrix().translateSelf(-cx, -cy).scaleSelf(TS / T.S);
  const fillPat = (pat, path) => { pat.setTransform?.(m); ctx.fillStyle = pat; ctx.fill(path); };
  const gTop = Math.max(0, groundY);

  // ---------- lumière (calculée d'abord : elle décide quels minerais sont visibles) ----------
  const lampR = 4.8 + 0.5 * (g.up.lant || 0), sources = [], lit = [];
  const ly0 = Math.max(0, y0 - 6), ly1 = Math.min(W.depth - 1, y1 + 6), lx0 = Math.max(0, x0 - 6), lx1 = Math.min(W.width - 1, x1 + 6);
  for (const k of g.lamps) {
    const lx = k % W.width, ly = Math.floor(k / W.width);
    if (lx < lx0 || lx > lx1 || ly < ly0 || ly > ly1) continue;
    sources.push({ x: lx + 0.5, y: ly + 0.45, r: lampR * (1 + 0.03 * Math.sin(t * 7 + lx) * Math.sin(t * 4.3 + ly)), i: 1 });
    if (lx >= x0 - 1 && lx <= x1 + 1 && ly >= y0 - 1 && ly <= y1 + 1) lit.push([lx, ly]);
  }
  const helm = { x: hero.x + hero.face * 0.15, y: hero.y - 0.75, r: (3.5 + vision * 0.875) * (1 + Math.sin(t * 6) * 0.01), i: 1, wall: 0.95 };
  sources.push(helm, { x: ENTRY + 0.5, y: -0.5, r: 5, i: 0.9 });
  const cols = x1 - x0 + 3, rows = y1 - y0 + 3, Lx0 = x0 - 1, Ly0 = y0 - 1;
  const L = computeLight(v, W, set, Lx0, Ly0, cols, rows, sources);
  const Lat = (x, y) => (x < Lx0 || y < Ly0 || x >= Lx0 + cols || y >= Ly0 + rows ? 0 : L[(y - Ly0) * cols + (x - Lx0)]);

  // ---------- 1) la coupe du sol : couches colorées, limites ondulées cernées ----------
  const NL = W.layers.length, polys = [], edges = [];
  if (gTop < v.h) {
    const wxOf = (px) => (px + cx) / TS;
    for (let i = 0; i < NL; i++) {
      const p = new Path2D(), e = new Path2D();
      // bord haut
      if (i === 0) { p.moveTo(-4, groundY); p.lineTo(v.w + 4, groundY); }
      else { for (let px = -4; px <= v.w + 10; px += 10) { const y = layerEdge(W, i - 1, wxOf(px)) * TS - cy; px < 0 ? p.moveTo(px, y) : p.lineTo(px, y); } }
      // bord bas (à l'envers)
      if (i === NL - 1) { p.lineTo(v.w + 10, v.h + 4); p.lineTo(-4, v.h + 4); }
      else { for (let px = v.w + 10; px >= -4; px -= 10) { const y = layerEdge(W, i, wxOf(px)) * TS - cy; p.lineTo(px, y); } for (let px = -4; px <= v.w + 10; px += 10) { const y = layerEdge(W, i, wxOf(px)) * TS - cy; px < 0 ? e.moveTo(px, y) : e.lineTo(px, y); } }
      p.closePath(); polys.push(p); edges.push(e);
      fillPat(v.pat.layer[i], p);
    }
    // limites entre couches : trait foncé épais + liseré clair dessous
    for (let i = 0; i < NL - 1; i++) {
      ctx.strokeStyle = OUT; ctx.lineWidth = TS * 0.07; ctx.stroke(edges[i]);
      ctx.save(); ctx.translate(0, TS * 0.06); ctx.strokeStyle = W.layers[i + 1][2]; ctx.globalAlpha = 0.55; ctx.lineWidth = TS * 0.035; ctx.stroke(edges[i]); ctx.restore();
    }
  }
  // ---------- 2) minerais : visibles seulement s'ils sont éclairés (apparition en fondu) ----------
  const ores = [], airs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const k = tile(W, set, x, y);
    if (k === AIR) { airs.push([x, y, x * TS - cx, y * TS - cy]); continue; }
    if (k < 3) continue;
    const l = Lat(x, y);
    if (l < 0.18) continue;
    ores.push([x, y, x * TS - cx, y * TS - cy, k, l]);
    ctx.globalAlpha = Math.min(1, (l - 0.18) * 3);
    ctx.drawImage(T.ore[k][(x * 7 + y * 13) % 3], x * TS - cx, y * TS - cy, TS, TS);
  }
  ctx.globalAlpha = 1;

  // ---------- 3) galeries aux bords arrondis ----------
  const tun = new Path2D();
  for (const [x, y, sx, sy] of airs) {
    const ccx = sx + TS / 2 + (h2(x * 5, y) - 0.5) * TS * 0.1, ccy = sy + TS / 2 + (h2(x, y * 5) - 0.5) * TS * 0.06, rr = TS * (0.52 + h2(x, y) * 0.06);
    tun.moveTo(ccx + rr, ccy); tun.arc(ccx, ccy, rr, 0, Math.PI * 2);
    if (isAir(x + 1, y)) { const hh = TS * (0.46 + h2(x * 3, y) * 0.05); tun.rect(sx + TS / 2, sy + TS / 2 - hh, TS, hh * 2); }
    if (isAir(x, y + 1)) { const ww = TS * (0.4 + h2(x, y * 3) * 0.05); tun.rect(sx + TS / 2 - ww, sy + TS / 2, ww * 2, TS); }
    if (y === 0) tun.rect(sx + TS * 0.1, sy - 1, TS * 0.8, TS / 2 + 1); // ouverture du puits au ras du sol
  }
  // contour épais (la moitié intérieure est recouverte par le creux)
  ctx.strokeStyle = OUT; ctx.lineWidth = TS * 0.17; ctx.stroke(tun);
  ctx.save(); ctx.clip(tun);
  for (let i = 0; i < polys.length; i++) fillPat(v.pat.cave[i], polys[i]);
  // ombres intérieures : sous le plafond et le long des parois
  for (const [x, y, sx, sy] of airs) {
    const up = solid(x, y - 1), lf = solid(x - 1, y), rt = solid(x + 1, y);
    if (up) { const gr = ctx.createLinearGradient(0, sy, 0, sy + TS * 0.55); gr.addColorStop(0, 'rgba(10,4,12,.55)'); gr.addColorStop(1, 'rgba(10,4,12,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - 1, sy - TS * 0.1, TS + 2, TS * 0.65); }
    if (lf) { const gr = ctx.createLinearGradient(sx, 0, sx + TS * 0.3, 0); gr.addColorStop(0, 'rgba(10,4,12,.4)'); gr.addColorStop(1, 'rgba(10,4,12,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - TS * 0.1, sy, TS * 0.4, TS); }
    if (rt) { const gr = ctx.createLinearGradient(sx + TS, 0, sx + TS * 0.7, 0); gr.addColorStop(0, 'rgba(10,4,12,.4)'); gr.addColorStop(1, 'rgba(10,4,12,0)'); ctx.fillStyle = gr; ctx.fillRect(sx + TS * 0.6, sy, TS * 0.4, TS); }
  }
  ctx.restore();
  // décor : rails au sol, boisages, échelles, racines, stalactites, cristaux
  for (const [x, y, sx, sy] of airs) {
    const up = solid(x, y - 1), dn = solid(x, y + 1), lf = solid(x - 1, y), rt = solid(x + 1, y), li = layerOf(W, x, y);
    if (dn && (!lf || !rt)) drawRail(ctx, sx, sy, TS);
    if (up && li === 0 && h2(x, y + 7) < 0.5) {
      ctx.strokeStyle = '#6b4226'; ctx.lineWidth = Math.max(1.5, TS / 26);
      for (let i = 0; i < 2; i++) { const rx = sx + TS * (0.2 + h2(x + i, y) * 0.6), rl = TS * (0.16 + h2(y, x + i) * 0.2); ctx.beginPath(); ctx.moveTo(rx, sy + TS * 0.04); ctx.quadraticCurveTo(rx + TS * 0.06 * Math.sin(t * 0.8 + x), sy + rl * 0.6, rx - TS * 0.03, sy + rl); ctx.stroke(); }
    } else if (up && h2(x * 3, y) < 0.3) {
      for (let i = 0; i < 2; i++) {
        const rx = sx + TS * (0.18 + h2(x, y + i * 5) * 0.64), rl = TS * (0.1 + h2(x + i * 9, y) * 0.12), rw = rl * 0.38, p = new Path2D();
        p.moveTo(rx - rw, sy + TS * 0.04); p.quadraticCurveTo(rx - rw * 0.2, sy + rl * 0.7, rx, sy + TS * 0.04 + rl); p.quadraticCurveTo(rx + rw * 0.2, sy + rl * 0.7, rx + rw, sy + TS * 0.04); p.closePath();
        ctx.fillStyle = W.layers[li][1]; ctx.fill(p); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, TS / 30); ctx.stroke(p);
      }
    }
    if (li >= 3 && (dn || up) && h2(x * 7, y * 3) < 0.12) { // petits cristaux
      const base = dn ? sy + TS * 0.97 : sy + TS * 0.03, dir = dn ? -1 : 1, cxx = sx + TS * (0.3 + h2(x, y * 7) * 0.4), hue = li >= 4 ? ['#5fe0cf', '#d9fff8'] : ['#b59cff', '#efeaff'];
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * TS * 0.08, hh = TS * (0.14 + h2(x + i, y) * 0.12) * (i === 1 ? 1.3 : 1), ww = TS * 0.045, p = new Path2D();
        p.moveTo(cxx + ox - ww, base); p.lineTo(cxx + ox - ww, base + dir * hh * 0.75); p.lineTo(cxx + ox + (i - 1) * ww * 0.5, base + dir * hh); p.lineTo(cxx + ox + ww, base + dir * hh * 0.75); p.lineTo(cxx + ox + ww, base); p.closePath();
        ctx.fillStyle = hue[0]; ctx.fill(p); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, TS / 34); ctx.stroke(p);
        ctx.fillStyle = hue[1]; ctx.fillRect(cxx + ox - ww * 0.6, base + dir * hh * 0.7, ww * 0.5, -dir * hh * 0.5);
      }
    }
    const tunnel = up && dn && (!lf || !rt);
    if (tunnel && h2(x, y) < 0.22 && y > 1) drawSupport(ctx, sx, sy, TS);
    if (isAir(x, y + 1) && ((lf && rt) || (solid(x - 1, y + 1) && solid(x + 1, y + 1)))) drawLadder(ctx, sx, sy + TS * 0.5, TS);
  }
  // fissures sur la case en cours de creusage
  if (hero.target && live && g.prog > 0.02) {
    const [tx2, ty2] = hero.target, sx = tx2 * TS - cx, sy = ty2 * TS - cy;
    ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.8, TS / 22);
    const n = Math.ceil(g.prog * 6);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + tx2, rr = TS * (0.18 + 0.28 * g.prog);
      ctx.beginPath(); ctx.moveTo(sx + TS / 2, sy + TS / 2);
      ctx.lineTo(sx + TS / 2 + Math.cos(a) * rr * 0.55, sy + TS / 2 + Math.sin(a) * rr * 0.55); ctx.lineTo(sx + TS / 2 + Math.cos(a + 0.35) * rr, sy + TS / 2 + Math.sin(a + 0.35) * rr); ctx.stroke();
    }
  }

  // ---------- 4) obscurité dans les galeries loin des lumières (le sol, lui, reste visible) ----------
  if (gTop < v.h && airs.length) {
    const S = v.shade;
    if (S.width !== cols || S.height !== rows) { S.width = cols; S.height = rows; v.img = null; }
    const sc = S.getContext('2d'), img = v.img || (v.img = sc.createImageData(cols, rows)), d = img.data;
    for (let i = 0; i < L.length; i++) { d[i * 4] = DARK[0]; d[i * 4 + 1] = DARK[1]; d[i * 4 + 2] = DARK[2]; d[i * 4 + 3] = Math.round((1 - Math.min(1, Math.pow(L[i], 0.7))) * 235); }
    sc.putImageData(img, 0, 0);
    ctx.save(); ctx.clip(tun); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(S, Lx0 * TS - cx, Ly0 * TS - cy, cols * TS, rows * TS);
    ctx.restore();
  }
  for (const [lx, ly] of lit) drawLantern(ctx, lx * TS - cx, ly * TS - cy, TS, t, solid(lx, ly - 1));

  // ---------- 5) surface : herbe, arbres, bâtiments, chevalement ----------
  if (groundY > -TS) {
    const gx0 = Math.max(0, Math.floor(cx / TS)), gx1 = Math.ceil((cx + v.w) / TS);
    ctx.fillStyle = night ? '#2f7a3c' : '#5cbf45'; ctx.fillRect(0, groundY - TS * 0.12, v.w, TS * 0.3);
    ctx.fillStyle = night ? '#3f9150' : '#86dc5c'; ctx.fillRect(0, groundY - TS * 0.12, v.w, TS * 0.08);
    ctx.strokeStyle = OUT; ctx.lineWidth = TS * 0.06; ctx.beginPath(); ctx.moveTo(0, groundY + TS * 0.18); ctx.lineTo(v.w, groundY + TS * 0.18); ctx.stroke();
    // touffes et petites fleurs
    for (let x = gx0; x <= gx1; x++) {
      if (x === ENTRY) continue;
      const bx = x * TS - cx;
      for (let i = 0; i < 2; i++) {
        const px = bx + TS * h2(x, i), hh = TS * (0.1 + h2(i, x) * 0.1);
        ctx.fillStyle = night ? '#2f7a3c' : '#4caf3c'; ctx.beginPath(); ctx.moveTo(px - TS * 0.06, groundY - TS * 0.1); ctx.lineTo(px, groundY - TS * 0.1 - hh); ctx.lineTo(px + TS * 0.06, groundY - TS * 0.1); ctx.closePath(); ctx.fill();
      }
      if (h2(x, 9) < 0.18) { const fx = bx + TS * h2(x, 3); ctx.fillStyle = ['#ffffff', '#ffd34d', '#ff7a9c'][Math.floor(h2(x, 4) * 3)]; ctx.beginPath(); ctx.arc(fx, groundY - TS * 0.16, TS * 0.045, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); }
    }
    for (const [tx3, sd] of [[8.5, 3], [19.2, 7], [24.5, 9], [30, 4]]) drawTree(ctx, tx3 * TS - cx, groundY - TS * 0.06, TS, night, sd);
    drawWorkshop(ctx, 0.2 * TS - cx, groundY - TS * 0.06, TS, night, goal.progress, goal.built, W.goal.id);
    drawShop(ctx, 4.4 * TS - cx, groundY - TS * 0.06, TS, night);
    drawHeadframe(ctx, (ENTRY + 0.5) * TS - cx, groundY - TS * 0.06, TS, live && g.act !== 'rest' ? t : 0, night);
    drawMarket(ctx, 13.6 * TS - cx, groundY - TS * 0.06, TS, night, t);
  }

  // ---------- 6) éclats de roche, personnage ----------
  if (live && hero.anim === 'dig') {
    const ph = (t * 1.6) % 1;
    if (ph > 0.88 && v.lastHit < 0.88 && hero.target) {
      const [tx2, ty2] = hero.target, col = W.layers[layerOf(W, tx2, ty2)];
      for (let i = 0; i < 7; i++) v.parts.push({ x: (tx2 + 0.5) * TS, y: (ty2 + 0.5) * TS, vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 170, life: 0.7, r: 1.5 + Math.random() * 2.5, c: Math.random() < 0.5 ? col[1] : col[2] });
    }
    v.lastHit = ph;
  }
  v.parts = v.parts.filter((p) => (p.life -= dt) > 0);
  for (const p of v.parts) {
    p.vy += 560 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x - cx, p.y - cy, p.r, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawMiner(ctx, hero.x * TS - cx, hero.y * TS - cy, TS * 1.18, { gender: g.hero.gender, face: hero.face, anim: hero.anim, dig: hero.dig, t, pickColor: (PICKS[g.up.pick] || PICKS[0])[1], bag: g.bagN / cap(g), skin: SKINS.find((k) => k.id === g.skin)?.c });

  // ---------- 7) halos de lumière et éclats des minerais ----------
  ctx.globalCompositeOperation = 'lighter';
  const glow = (px, py, rr, a, c = '255,190,100') => { const gr = ctx.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gr; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2); };
  for (const [lx, ly] of lit) glow((lx + 0.5) * TS - cx, (ly + 0.45) * TS - cy, TS * 2.2, 0.16 + 0.02 * Math.sin(t * 8 + lx));
  const hx = helm.x * TS - cx, hy = helm.y * TS - cy;
  if (hero.y > 0.5 && g.act !== 'rest') {
    const bx = hx + hero.face * TS * 0.25, len = TS * (2.6 + vision * 0.4);
    const bg = ctx.createLinearGradient(bx, 0, bx + hero.face * len, 0); bg.addColorStop(0, 'rgba(255,236,170,.2)'); bg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(bx, hy - TS * 0.06); ctx.lineTo(bx + hero.face * len, hy - TS * 0.7); ctx.lineTo(bx + hero.face * len, hy + TS * 0.8); ctx.closePath(); ctx.fill();
  }
  for (const [x, y, sx, sy, , l] of ores) {
    const ph = (t * 0.7 + x * 0.37 + y * 0.61) % 2.4;
    if (ph < 0.5) {
      const a = Math.sin((ph / 0.5) * Math.PI) * Math.min(1, l), gx = sx + TS * (0.3 + h2(x, y) * 0.4), gy = sy + TS * (0.3 + h2(y, x) * 0.4), rr = TS * 0.22 * a;
      ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
      ctx.beginPath(); ctx.moveTo(gx, gy - rr); ctx.lineTo(gx + rr * 0.16, gy - rr * 0.16); ctx.lineTo(gx + rr, gy); ctx.lineTo(gx + rr * 0.16, gy + rr * 0.16); ctx.lineTo(gx, gy + rr); ctx.lineTo(gx - rr * 0.16, gy + rr * 0.16); ctx.lineTo(gx - rr, gy); ctx.lineTo(gx - rr * 0.16, gy - rr * 0.16); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // vignette légère
  ctx.drawImage(v.vig, -v.w * 0.08, -v.h * 0.08, v.w * 1.16, v.h * 1.16);
  // textes flottants (« +1 Or », « au coffre »…) : gros caractères blancs bordés
  v.pops = (v.pops || []).filter((p) => (p.life -= dt) > 0);
  for (const p of v.pops) {
    const k2 = 1 - p.life / p.max;
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.font = `800 ${Math.round(TS * 0.36)}px Inter Variable, sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(p.text, p.x * TS - cx, p.y * TS - cy - k2 * TS * 1.2);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x * TS - cx, p.y * TS - cy - k2 * TS * 1.2);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';
  return hero;
}

export const SKY = SKY_ROWS;
export const pop = (v, text, x, y, color = '#ffe08a') => { (v.pops = v.pops || []).push({ text, x, y, color, life: 1.6, max: 1.6 }); };
/* bâtiment touché (coordonnées écran → monde) */
export function hitBuilding(v, sx, sy) {
  const wx = (sx + v.cam.x) / v.TS, wy = (sy + v.cam.y) / v.TS;
  return BUILDINGS.find((b) => wx >= b.x0 && wx <= b.x1 && wy <= 0.2 && wy >= -b.h)?.id || null;
}
export { START_Y };
