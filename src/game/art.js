/* =====================================================================
   LA MINE — dessins (Canvas 2D, 100 % vectoriel, aucun fichier image)
   DA « Fokus Mine » : dessin animé net et coloré (contours épais, aplats + une ombre et un reflet, couleurs franches),
   coupe du sol en couches colorées (terre caramel → argile → schiste prune → granit indigo → cristal turquoise),
   puys d'Auvergne et petite ville française en surface, émeraude Fokus en accent.
   Tout est peint une fois dans des canevas hors écran (motifs de 4 × 4 cases sans raccord), puis recopié.
   ===================================================================== */
export const OUT = '#2b1a16'; // contour commun
const LINE = OUT;

/* générateur pseudo-aléatoire déterministe (mêmes dessins à chaque ouverture) */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export function shade(h, k) { // k > 0 éclaircit, k < 0 assombrit
  const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  const [r, g, b] = hex(h);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('');
}
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function blob(ctx, x, y, r, rnd, pts = 7, wob = 0.3, sy = 1) { // forme organique fermée
  ctx.beginPath();
  const a0 = rnd() * 6.28, ps = [];
  for (let i = 0; i < pts; i++) { const a = a0 + (i / pts) * 6.283, rr = r * (1 - wob / 2 + rnd() * wob); ps.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy]); }
  for (let i = 0; i < pts; i++) {
    const p = ps[i], q = ps[(i + 1) % pts], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) { const l = ps[pts - 1]; ctx.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2); }
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/* ---------- couches du sol : motifs sans raccord de PATCH × PATCH cases ---------- */
export const PATCH = 4;
function wrap(N, x, y, r, fn) {
  for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
    if (x + dx + r < 0 || x + dx - r > N || y + dy + r < 0 || y + dy - r > N) continue;
    fn(x + dx, y + dy);
  }
}
function paintLayer(ctx, N, S, cols, rnd, i) {
  const [, base, light, dark] = cols;
  ctx.fillStyle = base; ctx.fillRect(0, 0, N, N);
  // grandes nuances douces
  for (let k = 0; k < 18; k++) {
    const x = rnd() * N, y = rnd() * N, r = S * (0.6 + rnd() * 1.2), c = rnd() < 0.5 ? light : dark;
    wrap(N, x, y, r, (px, py) => { const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(c, 0.18)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2); });
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // petits traits (strates, fissures)
  for (let k = 0; k < 26; k++) {
    const x = rnd() * N, y = rnd() * N, l = S * (0.12 + rnd() * 0.22), a = (rnd() - 0.5) * 0.5;
    wrap(N, x, y, l, (px, py) => { ctx.strokeStyle = rgba(dark, 0.55); ctx.lineWidth = Math.max(1, S / 26); ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + l * 0.5, py + Math.sin(a) * l - S * 0.03, px + l, py + Math.sin(a) * l); ctx.stroke(); });
  }
  // cailloux cernés (style dessin animé)
  for (let k = 0; k < 22; k++) {
    const x = rnd() * N, y = rnd() * N, r = S * (0.05 + rnd() * 0.08), c = rnd() < 0.55 ? shade(base, 0.22) : shade(base, -0.18), sd = rnd() * 1e6;
    wrap(N, x, y, r * 1.5, (px, py) => {
      const rr = rng(sd);
      blob(ctx, px, py, r, rr, 6, 0.35, 0.78); ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = rgba(dark, 0.9); ctx.lineWidth = Math.max(1, S / 30); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.3, r * 0.35, r * 0.18, -0.5, 0, 7); ctx.fill();
    });
  }
  // détails selon la couche : racines (terre), coquillages fossiles (argile, schiste), éclats de cristal (granit, cristal)
  for (let k = 0; k < 3; k++) {
    const x = rnd() * N, y = rnd() * N;
    wrap(N, x, y, S * 0.4, (px, py) => {
      ctx.strokeStyle = rgba(dark, 0.85); ctx.lineWidth = Math.max(1, S / 28);
      if (i === 0) { ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + S * 0.15, py + S * 0.2, px + S * 0.05, py + S * 0.4); ctx.moveTo(px + S * 0.08, py + S * 0.15); ctx.lineTo(px + S * 0.22, py + S * 0.24); ctx.stroke(); }
      else if (i <= 2) { ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) { const rr = S * 0.012 * a; ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } ctx.stroke(); }
      else { ctx.fillStyle = shade(light, 0.35); ctx.beginPath(); ctx.moveTo(px, py + S * 0.12); ctx.lineTo(px + S * 0.05, py - S * 0.08); ctx.lineTo(px + S * 0.1, py + S * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    });
  }
}
/* fond des galeries creusées : la même couche, bien plus sombre, avec des coups de pioche */
function paintCavity(ctx, N, S, cols, rnd) {
  const [, base, , dark] = cols, c = mix(dark, '#170f1a', 0.62);
  ctx.fillStyle = c; ctx.fillRect(0, 0, N, N);
  for (let k = 0; k < 14; k++) {
    const x = rnd() * N, y = rnd() * N, r = S * (0.5 + rnd()), cc = rnd() < 0.5 ? base : '#000000';
    wrap(N, x, y, r, (px, py) => { const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(cc, 0.1)); g.addColorStop(1, rgba(cc, 0)); ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2); });
  }
  ctx.lineCap = 'round';
  for (let k = 0; k < 40; k++) {
    const x = rnd() * N, y = rnd() * N, l = S * (0.1 + rnd() * 0.15), a = -1 + rnd() * 0.6 + (rnd() < 0.5 ? 0 : 1.9);
    wrap(N, x, y, l, (px, py) => { ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, S / 30); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke(); });
  }
}

/* ---------- minerais : pépites et cristaux cernés, bien brillants ---------- */
const CRYSTALS = ['quartz', 'amethyste'];
function nugget(ctx, x, y, r, c, cl, cd, rnd, S) {
  const k = 6 + Math.floor(rnd() * 2), a0 = rnd() * 6, pts = [];
  for (let j = 0; j < k; j++) { const a = a0 + (j / k) * 6.283; pts.push([x + Math.cos(a) * r * (0.82 + rnd() * 0.3), y + Math.sin(a) * r * (0.75 + rnd() * 0.3)]); }
  ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, cl); g.addColorStop(0.5, c); g.addColorStop(1, cd);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 20); ctx.stroke();
  // facettes
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...pts[k - 1]); ctx.lineTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...pts[Math.floor(k / 2)]); ctx.lineTo(...pts[Math.floor(k / 2) + 1]); ctx.closePath(); ctx.fill();
  // éclat blanc
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.12, -0.6, 0, 7); ctx.fill();
}
function prism(ctx, x, y, w, h, rot, c, cl, cd, S) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.7); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.7); ctx.lineTo(w, 0); ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.7); ctx.lineTo(0, -h); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.moveTo(w * 0.35, 0); ctx.lineTo(w * 0.35, -h * 0.82); ctx.lineTo(w, -h * 0.7); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 22); ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.7); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.7); ctx.lineTo(w, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(-w * 0.6, -h * 0.25); ctx.lineTo(-w * 0.35, -h * 0.62); ctx.lineTo(-w * 0.35, -h * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function paintOre(ctx, S, ore, rnd) {
  const [c, cl, cd] = ore.colors, cx = S / 2, cy = S / 2;
  // logement sombre dans la roche
  ctx.fillStyle = 'rgba(30,16,14,.35)'; blob(ctx, cx, cy + S * 0.04, S * 0.36, rnd, 8, 0.25, 0.8); ctx.fill();
  if (ore.id === 'geode') {
    const R = S * 0.33;
    ctx.fillStyle = '#8d8f99'; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.92, 0, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = S / 18; ctx.stroke();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, cl); g.addColorStop(1, cd);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.72, R * 0.66, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283, r0 = R * 0.7, r1 = R * 0.32;
      ctx.fillStyle = i % 2 ? cl : c; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - 0.22) * r0, cy + Math.sin(a - 0.22) * r0 * 0.92); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a + 0.22) * r0, cy + Math.sin(a + 0.22) * r0 * 0.92); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = S / 26; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.72, R * 0.66, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx - R * 0.5, cy - R * 0.55, R * 0.2, R * 0.1, -0.6, 0, 7); ctx.fill();
    return;
  }
  if (CRYSTALS.includes(ore.id)) {
    const bx = S * (0.4 + rnd() * 0.2), by = S * (0.72 + rnd() * 0.08);
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const rot = -0.7 + (i / (n - 1)) * 1.4 + (rnd() - 0.5) * 0.2, h = S * (0.32 + rnd() * 0.18) * (i === Math.floor(n / 2) ? 1.25 : 1), w = S * (0.07 + rnd() * 0.03);
      prism(ctx, bx + rot * S * 0.08, by, w, h, rot, c, cl, cd, S);
    }
    return;
  }
  const n = ore.id === 'charbon' ? 3 : 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const x = S * (0.28 + rnd() * 0.44), y = S * (0.3 + rnd() * 0.4), r = S * (ore.id === 'charbon' ? 0.13 : 0.12 + rnd() * 0.06);
    nugget(ctx, x, y, r, c, cl, cd, rnd, S);
  }
}

/* Prépare tous les motifs d'un monde (S = taille d'une case en pixels réels) */
export function makeTiles(W, S) {
  const N = S * PATCH, out = { S, N, layer: [], cave: [], ore: {} };
  W.layers.forEach((L, i) => {
    const a = canvas(N); paintLayer(a.getContext('2d'), N, S, L, rng(100 + i * 7), i); out.layer.push(a);
    const b = canvas(N); paintCavity(b.getContext('2d'), N, S, L, rng(300 + i * 7)); out.cave.push(b);
  });
  W.ores.forEach((o, i) => {
    out.ore[3 + i] = [0, 1, 2].map((v) => { const c = canvas(S); paintOre(c.getContext('2d'), S, o, rng(500 + i * 10 + v)); return c; });
  });
  return out;
}

/* ---------- boisages, échelles, lanternes, rails ---------- */
function beam(ctx, x, y, w, h, S, vertical) {
  ctx.fillStyle = '#b97a43'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d99a5c'; vertical ? ctx.fillRect(x, y, w * 0.35, h) : ctx.fillRect(x, y, w, h * 0.35);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; vertical ? ctx.fillRect(x + w * 0.72, y, w * 0.28, h) : ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 22); ctx.strokeRect(x, y, w, h);
}
export function drawSupport(ctx, x, y, S) {
  const w = S * 0.14;
  beam(ctx, x + S * 0.06, y + S * 0.12, w, S * 0.86, S, true);
  beam(ctx, x + S * 0.8, y + S * 0.12, w, S * 0.86, S, true);
  beam(ctx, x - S * 0.02, y + S * 0.02, S * 1.04, S * 0.14, S, false);
  ctx.fillStyle = OUT; for (const px of [x + S * 0.13, x + S * 0.87]) { ctx.beginPath(); ctx.arc(px, y + S * 0.09, S * 0.022, 0, 7); ctx.fill(); }
}
export function drawLadder(ctx, x, y, S) {
  for (let k = 0.12; k < 1; k += 0.28) beam(ctx, x + S * 0.27, y + S * k, S * 0.46, S * 0.07, S, false);
  beam(ctx, x + S * 0.22, y, S * 0.08, S, S, true);
  beam(ctx, x + S * 0.7, y, S * 0.08, S, S, true);
}
export function drawRail(ctx, x, y, S) {
  const fy = y + S * 0.93;
  for (let k = 0.05; k < 1; k += 0.32) { ctx.fillStyle = '#7a4f2c'; ctx.fillRect(x + S * k, fy - S * 0.03, S * 0.18, S * 0.07); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(x + S * k, fy - S * 0.03, S * 0.18, S * 0.07); }
  ctx.fillStyle = '#9aa3ad'; ctx.fillRect(x, fy - S * 0.07, S, S * 0.045); ctx.fillStyle = '#e7edf3'; ctx.fillRect(x, fy - S * 0.07, S, S * 0.014);
}
export function drawLantern(ctx, x, y, S, t, hang = true) {
  const sway = hang ? Math.sin(t * 1.1 + x * 0.01) * S * 0.025 : 0;
  const cx = x + S / 2 + sway, top = hang ? y + S * 0.2 : y + S * 0.32, w = S * 0.2, h = S * 0.28;
  const flick = 0.9 + 0.1 * Math.sin(t * 9 + x) * Math.sin(t * 5.3 + y);
  ctx.save(); ctx.lineJoin = 'round';
  if (hang) { ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, S / 34); ctx.beginPath(); ctx.moveTo(x + S / 2, y + S * 0.03); ctx.lineTo(cx, top); ctx.stroke(); }
  const g = ctx.createRadialGradient(cx, top + h * 0.55, 0, cx, top + h * 0.55, S * 0.8);
  g.addColorStop(0, `rgba(255,214,120,${0.5 * flick})`); g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - S * 0.8, top - S * 0.3, S * 1.6, S * 1.6);
  ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.roundRect(cx - w / 2, top + h * 0.15, w, h * 0.72, w * 0.3); ctx.fill();
  ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.ellipse(cx, top + h * 0.52, w * 0.18, h * 0.2 * flick, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 24); ctx.beginPath(); ctx.roundRect(cx - w / 2, top + h * 0.15, w, h * 0.72, w * 0.3); ctx.stroke();
  ctx.fillStyle = '#3d3a40'; ctx.beginPath(); ctx.moveTo(cx - w * 0.65, top + h * 0.18); ctx.lineTo(cx, top - h * 0.06); ctx.lineTo(cx + w * 0.65, top + h * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx - w * 0.6, top + h * 0.84, w * 1.2, h * 0.14, 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* fond de grotte pour les scènes de l'histoire (couche de roche + lumière chaude) */
const caveCache = new Map();
export function paintCave(ctx, w, h, cx, cy, lit) {
  const d = Math.max(1, ctx.getTransform().a), N = Math.ceil(Math.max(w, h) * d);
  let c = caveCache.get(N);
  if (!c) { c = canvas(N); paintLayer(c.getContext('2d'), N, N / 6, ['', '#8b4e6c', '#ab6b8c', '#5f3349'], rng(77), 2); caveCache.set(N, c); }
  ctx.drawImage(c, 0, 0, N / d, N / d);
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * lit);
  g.addColorStop(0, 'rgba(255,214,140,.25)'); g.addColorStop(0.5, 'rgba(30,14,30,.35)'); g.addColorStop(1, 'rgba(18,8,20,.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/* ---------- personnage : voir hero.js ---------- */
export { drawMiner } from './hero.js';

/* ---------- surface : ciel, puys d'Auvergne, ville (peints une fois, mis en cache) ---------- */
const SKIES = {
  night: ['#0b1838', '#1c2f63', '#2c4377', '#3d5488'],
  dawn: ['#4d6fb8', '#9a8fc8', '#f2a6a0', '#ffd2a1'],
  dusk: ['#3e4c9a', '#8a69b0', '#ef8f86', '#ffc18c'],
  day: ['#3aa2f0', '#62b8f5', '#9dd4fa', '#d6efff'],
};
const skyKind = (h) => (h < 6 || h >= 21 ? 'night' : h < 8 ? 'dawn' : h >= 18 ? 'dusk' : 'day');
export function skyColors(h) { const s = SKIES[skyKind(h)]; return [s[0], s[3], skyKind(h) === 'night']; }
export function paintSkyline(ctx, w, h, hour, seed = 7) {
  const kind = skyKind(hour), P = SKIES[kind], night = kind === 'night', rnd = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P[0]); g.addColorStop(0.45, P[1]); g.addColorStop(0.8, P[2]); g.addColorStop(1, P[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (night || kind === 'dusk') for (let i = 0; i < (night ? 110 : 30); i++) {
    const x = rnd() * w, y = rnd() * h * 0.55, r = rnd() < 0.12 ? 1.6 : 0.8;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // soleil / lune, cernés
  const sx = w * 0.82, sy = h * (kind === 'day' ? 0.22 : 0.3), sr = Math.min(w, h) * 0.06;
  const sg = ctx.createRadialGradient(sx, sy, sr, sx, sy, sr * 3.2); sg.addColorStop(0, night ? 'rgba(220,230,255,.35)' : 'rgba(255,240,170,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  ctx.fillStyle = night ? '#f2f4ff' : '#ffe066'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
  ctx.strokeStyle = night ? '#9aa6d6' : '#f2a93b'; ctx.lineWidth = 2.5; ctx.stroke();
  if (night) { ctx.fillStyle = '#d6dbf2'; ctx.beginPath(); ctx.arc(sx + sr * 0.3, sy - sr * 0.2, sr * 0.22, 0, 7); ctx.arc(sx - sr * 0.35, sy + sr * 0.3, sr * 0.15, 0, 7); ctx.fill(); }
  // nuages ronds (dessous légèrement bleuté)
  for (let i = 0; i < 5; i++) {
    const cx = rnd() * w, cy = h * (0.1 + rnd() * 0.28), r = h * (0.04 + rnd() * 0.03);
    const top = night ? '#3e5287' : '#ffffff', bot = night ? '#2c3e6e' : '#d6e9fb';
    ctx.fillStyle = bot; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(cx + (j - 2) * r * 0.9, cy + r * 0.25 - Math.sin((j / 4) * Math.PI) * r * 0.5, r * (0.7 + Math.sin((j / 4) * Math.PI) * 0.45), 0, 7); ctx.fill(); }
    ctx.fillStyle = top; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(cx + (j - 2) * r * 0.9, cy - Math.sin((j / 4) * Math.PI) * r * 0.5, r * (0.65 + Math.sin((j / 4) * Math.PI) * 0.45), 0, 7); ctx.fill(); }
  }
  const dim = (c) => (night ? mix(c, '#1a2550', 0.65) : kind === 'day' ? c : mix(c, '#7a5a8a', 0.3));
  // montagnes lointaines enneigées
  const peaks = (base, amp, col, snow, n) => {
    ctx.fillStyle = dim(col); ctx.beginPath(); ctx.moveTo(0, h);
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = (i / n) * w, y = h * base - (i % 2 ? amp * h * (0.6 + rnd() * 0.4) : amp * h * 0.15 * rnd()); pts.push([x, y]); ctx.lineTo(x, y); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    if (snow) { ctx.fillStyle = dim('#f4f8ff'); for (let i = 1; i < pts.length - 1; i += 2) { const [px, py] = pts[i], [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1], k = 0.28; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (ax - px) * k, py + (ay - py) * k); ctx.lineTo(px + (ax - px) * k * 0.6, py + (ay - py) * k * 0.9 + 3); ctx.lineTo(px, py + (ay - py) * k * 0.7); ctx.lineTo(px + (bx - px) * k * 0.6, py + (by - py) * k * 0.9 + 3); ctx.lineTo(px + (bx - px) * k, py + (by - py) * k); ctx.closePath(); ctx.fill(); } }
  };
  peaks(0.6, 0.28, '#8fb3d9', true, 9);
  // puys (volcans arrondis d'Auvergne, avec leur cratère)
  const puy = (x, base, r, col) => {
    ctx.fillStyle = dim(col); ctx.beginPath(); ctx.moveTo(x - r * 1.6, base); ctx.quadraticCurveTo(x - r * 0.9, base - r * 0.95, x - r * 0.28, base - r);
    ctx.quadraticCurveTo(x, base - r * 0.86, x + r * 0.28, base - r); ctx.quadraticCurveTo(x + r * 0.9, base - r * 0.95, x + r * 1.6, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(x - r * 1.2, base); ctx.quadraticCurveTo(x - r * 0.8, base - r * 0.8, x - r * 0.3, base - r * 0.96); ctx.quadraticCurveTo(x - r * 0.5, base - r * 0.5, x - r * 0.6, base); ctx.closePath(); ctx.fill();
  };
  for (let i = 0; i < 5; i++) puy(w * (0.08 + i * 0.22 + rnd() * 0.08), h * 0.8, h * (0.16 + rnd() * 0.08), i % 2 ? '#6fae6a' : '#5f9f63');
  // collines et rideau d'arbres
  ctx.fillStyle = dim('#79c15f'); ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 4; x += 4) ctx.lineTo(x, h * 0.84 - Math.sin(x / w * 9 + seed) * h * 0.025);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  const ground = h * 0.9;
  for (let x = -10; x < w + 10; x += 10 + rnd() * 16) { const r = h * (0.03 + rnd() * 0.025); ctx.fillStyle = dim(rnd() < 0.5 ? '#3f8f4f' : '#4c9c58'); ctx.beginPath(); ctx.arc(x, ground - r * 0.9, r, 0, 7); ctx.fill(); }
  // petite ville : maisons crème, toits rouges ou ardoise, clocher (contours fins)
  let x = w * 0.22;
  const lit = night || kind === 'dusk';
  while (x < w * 0.98) {
    const bw = w * (0.032 + rnd() * 0.03), bh = h * (0.08 + rnd() * 0.08), top = ground - bh;
    ctx.fillStyle = dim(['#f4e6cf', '#f0dcc0', '#e9d3b4', '#fbefdc'][Math.floor(rnd() * 4)]); ctx.strokeStyle = dim('#6b4b3a'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(x, top, bw, bh); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dim(rnd() < 0.6 ? '#d0583f' : '#5b6578'); ctx.beginPath(); ctx.moveTo(x - bw * 0.1, top); ctx.lineTo(x + bw / 2, top - bw * 0.5); ctx.lineTo(x + bw * 1.1, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let wy = top + bh * 0.22; wy < ground - bh * 0.18; wy += bh * 0.3) for (let wx = x + bw * 0.2; wx < x + bw * 0.78; wx += bw * 0.34) {
      ctx.fillStyle = lit && rnd() < 0.6 ? '#ffd56a' : dim('#7fb6dc'); ctx.fillRect(wx, wy, bw * 0.17, bh * 0.14);
    }
    if (rnd() < 0.1) { // clocher
      ctx.fillStyle = dim('#f0dcc0'); ctx.beginPath(); ctx.rect(x + bw * 1.08, ground - bh * 1.9, bw * 0.4, bh * 1.9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dim('#5b6578'); ctx.beginPath(); ctx.moveTo(x + bw * 1.02, ground - bh * 1.9); ctx.lineTo(x + bw * 1.28, ground - bh * 2.6); ctx.lineTo(x + bw * 1.54, ground - bh * 1.9); ctx.closePath(); ctx.fill(); ctx.stroke();
      x += bw * 0.55;
    }
    x += bw * (1.05 + rnd() * 0.35);
  }
}

/* arbre en boule (dessin animé) */
export function drawTree(ctx, x, groundY, S, night, seed = 1) {
  const rnd = rng(seed), h = S * (2 + rnd() * 0.8), leaf = night ? '#2f6047' : '#4caf50', leafD = night ? '#234836' : '#2f8a3c';
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, S / 18);
  ctx.fillStyle = night ? '#4a3527' : '#8a5a34'; ctx.beginPath(); ctx.moveTo(x - S * 0.1, groundY); ctx.lineTo(x - S * 0.06, groundY - h * 0.5); ctx.lineTo(x + S * 0.06, groundY - h * 0.5); ctx.lineTo(x + S * 0.11, groundY); ctx.closePath(); ctx.fill(); ctx.stroke();
  const blobs = [[-S * 0.34, -h * 0.55, S * 0.42], [S * 0.36, -h * 0.57, S * 0.44], [0, -h * 0.62, S * 0.58], [0, -h * 0.88, S * 0.44]];
  ctx.beginPath(); for (const [bx, by, r] of blobs) { ctx.moveTo(x + bx + r, groundY + by); ctx.arc(x + bx, groundY + by, r, 0, 7); }
  ctx.fillStyle = leafD; ctx.fill(); ctx.stroke();
  ctx.fillStyle = leaf; for (const [bx, by, r] of blobs) { ctx.beginPath(); ctx.arc(x + bx - r * 0.12, groundY + by - r * 0.12, r * 0.82, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x - S * 0.2, groundY - h * 0.95, S * 0.16, S * 0.08, -0.5, 0, 7); ctx.fill();
  ctx.restore();
}

/* chevalement : tour en acier peint, rivets, molette rouge, câble */
export function drawHeadframe(ctx, cx, groundY, S, t, night) {
  const H = S * 4.2, W2 = S * 1.1, steel = night ? '#4c6476' : '#3f6f86', steelL = night ? '#62809a' : '#5a92ad';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const l = (y) => W2 - (W2 * 0.65 * (groundY - y)) / H;
  const bar = (x1, y1, x2, y2, w) => {
    ctx.strokeStyle = OUT; ctx.lineWidth = w + Math.max(2, S / 14); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = steel; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = steelL; ctx.lineWidth = w * 0.35; ctx.beginPath(); ctx.moveTo(x1 - w * 0.15, y1); ctx.lineTo(x2 - w * 0.15, y2); ctx.stroke();
  };
  bar(cx + W2 * 0.35, groundY - H * 0.95, cx + W2 * 2.5, groundY, S * 0.11);
  for (let k = 1; k <= 5; k++) {
    const y1 = groundY - (H * k) / 5, y0 = groundY - (H * (k - 1)) / 5;
    bar(cx - l(y0), y0, cx + l(y1), y1, S * 0.05); bar(cx + l(y0), y0, cx - l(y1), y1, S * 0.05);
    bar(cx - l(y1), y1, cx + l(y1), y1, S * 0.07);
  }
  bar(cx - W2, groundY, cx - W2 * 0.35, groundY - H, S * 0.11);
  bar(cx + W2, groundY, cx + W2 * 0.35, groundY - H, S * 0.11);
  // plate-forme + molette
  const wy = groundY - H - S * 0.22, r = S * 0.72;
  ctx.fillStyle = steel; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, S / 18);
  ctx.beginPath(); ctx.rect(cx - W2 * 0.55, groundY - H - S * 0.06, W2 * 1.1, S * 0.14); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = S * 0.14; ctx.beginPath(); ctx.arc(cx, wy, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#d64933'; ctx.lineWidth = S * 0.08; ctx.beginPath(); ctx.arc(cx, wy, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = S * 0.045;
  for (let i = 0; i < 6; i++) { const a = t * 0.6 + (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(cx, wy); ctx.lineTo(cx + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.stroke(); }
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(cx, wy, S * 0.13, 0, 7); ctx.fill(); ctx.lineWidth = Math.max(1.5, S / 20); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 30); ctx.beginPath(); ctx.moveTo(cx + r, wy); ctx.lineTo(cx + r * 0.1, groundY + S * 0.4); ctx.stroke();
  ctx.restore();
}

/* pièce Fokoin (anneau du logo Fokus frappé sur une pièce d'or) — SVG pour l'interface */
export const COIN_SVG = (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="fkg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#b8860b"/></radialGradient><linearGradient id="fkr" x1="0" x2="1"><stop offset="0" stop-color="#059669"/><stop offset=".5" stop-color="#10b981"/><stop offset="1" stop-color="#86efac"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#fkg)" stroke="#8a6508" stroke-width="1.4"/><circle cx="16" cy="16" r="11.5" fill="none" stroke="#c99a1c" stroke-width="1"/><circle cx="16" cy="16" r="6.6" fill="none" stroke="url(#fkr)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="33 9" transform="rotate(-90 16 16)"/></svg>`;

/* ---------- bâtiments de la surface (on les touche pour y entrer) ---------- */
/* panneau en bois cerné, lettres blanches bordées (lisible comme dans un jeu) */
function sign(ctx, cx, y, S, text, accent = '#10b981') {
  ctx.font = `800 ${Math.round(S * 0.3)}px Inter Variable, sans-serif`;
  const w = ctx.measureText(text).width + S * 0.7, h = S * 0.52;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2, y + 4, w, h, S * 0.12); ctx.fill();
  ctx.fillStyle = '#c98a4e'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, S * 0.12); ctx.fill();
  ctx.fillStyle = '#e0a868'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h * 0.45, [S * 0.12, S * 0.12, 0, 0]); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.8, S / 16); ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, S * 0.12); ctx.stroke();
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx - w / 2 + S * 0.2, y + h / 2, S * 0.07, 0, 7); ctx.arc(cx + w / 2 - S * 0.2, y + h / 2, S * 0.07, 0, 7); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2.5, S / 10); ctx.strokeStyle = OUT; ctx.strokeText(text, cx, y + h / 2 + 1);
  ctx.fillStyle = '#ffffff'; ctx.fillText(text, cx, y + h / 2 + 1);
}
function outlined(ctx, S, fill, path) { ctx.fillStyle = fill; ctx.fill(path); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.8, S / 16); ctx.stroke(path); }
function rect(x, y, w, h, r = 0) { const p = new Path2D(); r ? p.roundRect(x, y, w, h, r) : p.rect(x, y, w, h); return p; }
function windowLit(ctx, x, y, w, h, S, night) {
  const p = rect(x, y, w, h, S * 0.05);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, night ? '#ffe28a' : '#bfe6ff'); g.addColorStop(1, night ? '#ffb347' : '#7fc4f0');
  outlined(ctx, S, g, p);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(x + w * 0.12, y + h * 0.12); ctx.lineTo(x + w * 0.45, y + h * 0.12); ctx.lineTo(x + w * 0.12, y + h * 0.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S / 26); ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
}
function groundShadow(ctx, x, groundY, w, S) {
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2, groundY + S * 0.02, w * 0.56, S * 0.12, 0, 0, 7); ctx.fill();
}
/* Marché : étal en bois, auvent rouge et blanc à festons, caisses de pierres précieuses, ardoise des cours */
export function drawMarket(ctx, x, groundY, S, night, t) {
  const w = S * 3.6, h = S * 1.8;
  ctx.save(); ctx.lineJoin = 'round';
  groundShadow(ctx, x, groundY, w, S);
  outlined(ctx, S, night ? '#7a5434' : '#b07443', rect(x + S * 0.12, groundY - h, w - S * 0.24, h));
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + S * 0.12, groundY - (h * i) / 5); ctx.lineTo(x + w - S * 0.12, groundY - (h * i) / 5); ctx.stroke(); }
  for (const px of [x, x + w - S * 0.16]) outlined(ctx, S, '#8a5a32', rect(px, groundY - h - S * 0.12, S * 0.16, h + S * 0.12));
  // comptoir
  outlined(ctx, S, '#d99a5c', rect(x - S * 0.15, groundY - S * 0.95, w + S * 0.3, S * 0.22, S * 0.05));
  outlined(ctx, S, night ? '#6a4529' : '#9a6237', rect(x + S * 0.05, groundY - S * 0.73, w - S * 0.1, S * 0.73));
  // caisses de gemmes
  const gems = [['#f5c542', '#fff0a0'], ['#9b5de5', '#d8b4fe'], ['#5ec4d6', '#c8f4fb'], ['#e2563f', '#ffb3a3'], ['#c9d2dc', '#ffffff']];
  for (let i = 0; i < 4; i++) {
    const bx = x + S * 0.3 + i * S * 0.78, by = groundY - S * 1.32;
    for (let k = 0; k < 3; k++) { const [c, cl] = gems[(i + k) % gems.length], gx = bx + S * (0.13 + k * 0.17), gy = by - S * 0.02 - (k % 2) * S * 0.06; const p = new Path2D(); p.moveTo(gx, gy - S * 0.12); p.lineTo(gx + S * 0.1, gy); p.lineTo(gx, gy + S * 0.08); p.lineTo(gx - S * 0.1, gy); p.closePath(); outlined(ctx, S * 1.4, c, p); ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(gx, gy - S * 0.1); ctx.lineTo(gx - S * 0.06, gy - S * 0.01); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fill(); }
    outlined(ctx, S, '#c47e45', rect(bx, by, S * 0.62, S * 0.36, S * 0.04));
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx + 2, by + 2, S * 0.62 - 4, S * 0.08);
  }
  // ardoise des cours
  outlined(ctx, S, '#26332d', rect(x + w - S * 1.05, groundY - S * 0.62, S * 0.8, S * 0.5, S * 0.04));
  ctx.strokeStyle = '#86efac'; ctx.lineWidth = Math.max(1.5, S / 22); ctx.beginPath();
  for (let i = 0; i < 6; i++) ctx.lineTo(x + w - S * 0.97 + i * S * 0.13, groundY - S * 0.3 - Math.sin(i * 1.7 + 1 + t * 0.2) * S * 0.1);
  ctx.stroke();
  // auvent à festons
  const n = 7, aw = (w + S * 0.5) / n, ay = groundY - h - S * 0.32;
  for (let i = 0; i < n; i++) {
    const x0 = x - S * 0.25 + i * aw, p = new Path2D();
    p.moveTo(x0, ay - S * 0.15); p.lineTo(x0 + aw, ay - S * 0.15); p.lineTo(x0 + aw, ay + S * 0.42);
    p.quadraticCurveTo(x0 + aw / 2, ay + S * 0.68 + Math.sin(t * 1.4 + i) * 0.8, x0, ay + S * 0.42); p.closePath();
    outlined(ctx, S, i % 2 ? '#fff6ea' : night ? '#a8323a' : '#e5484d', p);
  }
  outlined(ctx, S, '#8a5a32', rect(x - S * 0.32, ay - S * 0.28, w + S * 0.64, S * 0.16, S * 0.05));
  drawLantern(ctx, x + w - S * 0.55, ay + S * 0.36, S * 0.9, t, true);
  sign(ctx, x + w / 2, ay - S * 0.92, S, 'MARCHÉ', '#f5c542');
  ctx.restore();
}
/* Boutique : façade émeraude Fokus, corniche dorée, grande vitrine avec pioches */
export function drawShop(ctx, x, groundY, S, night) {
  const w = S * 3.2, h = S * 2.5;
  ctx.save(); ctx.lineJoin = 'round';
  groundShadow(ctx, x, groundY, w, S);
  outlined(ctx, S, night ? '#0f6b4f' : '#13956b', rect(x, groundY - h, w, h));
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + 2, groundY - h + 2, w * 0.3, h - 4);
  outlined(ctx, S, '#f2c14e', rect(x - S * 0.2, groundY - h - S * 0.26, w + S * 0.4, S * 0.3, S * 0.06));
  outlined(ctx, S, '#0b5c43', rect(x - S * 0.05, groundY - h + S * 0.04, w + S * 0.1, S * 0.16));
  // marquise rayée
  const n = 6, mw = (S * 1.9) / n, mx = x + S * 0.2, my = groundY - S * 1.98;
  for (let i = 0; i < n; i++) { const p = new Path2D(); p.moveTo(mx + i * mw, my); p.lineTo(mx + (i + 1) * mw, my); p.lineTo(mx + (i + 1) * mw + S * 0.04, my + S * 0.3); p.lineTo(mx + i * mw + S * 0.04, my + S * 0.3); p.closePath(); outlined(ctx, S, i % 2 ? '#ffffff' : '#f2c14e', p); }
  // vitrine
  const vx = x + S * 0.3, vy = groundY - S * 1.6, vw = S * 1.55, vh = S * 1.0;
  windowLit(ctx, vx, vy, vw, vh, S, night);
  ctx.save(); ctx.translate(vx + vw * 0.3, vy + vh * 0.62); ctx.rotate(-0.7); drawPickIconAt(ctx, 0, 0, S * 0.6, '#cfd6dd'); ctx.restore();
  ctx.save(); ctx.translate(vx + vw * 0.72, vy + vh * 0.62); ctx.rotate(-0.35); drawPickIconAt(ctx, 0, 0, S * 0.52, '#f5c542'); ctx.restore();
  // porte
  const dx = x + w - S * 1.1, dh = S * 1.6;
  outlined(ctx, S, '#7a4a28', rect(dx, groundY - dh, S * 0.78, dh, S * 0.06));
  windowLit(ctx, dx + S * 0.14, groundY - dh + S * 0.16, S * 0.5, S * 0.55, S, night);
  ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(dx + S * 0.64, groundY - S * 0.72, S * 0.06, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
  sign(ctx, x + w / 2, groundY - h - S * 0.95, S, 'BOUTIQUE', '#10b981');
  ctx.restore();
}
/* Atelier : garage en briques rouges, porte en arc ouverte, établi ; le vélo se dessine avec la progression */
export function drawWorkshop(ctx, x, groundY, S, night, progress, built) {
  const w = S * 3.6, h = S * 2.1;
  ctx.save(); ctx.lineJoin = 'round';
  groundShadow(ctx, x, groundY, w, S);
  const wall = rect(x, groundY - h, w, h);
  ctx.fillStyle = night ? '#8a3d2c' : '#c4573b'; ctx.fill(wall);
  ctx.save(); ctx.clip(wall); ctx.strokeStyle = 'rgba(80,20,10,.45)'; ctx.lineWidth = 1.4;
  for (let r = 0, yy = groundY - h; yy < groundY; r++, yy += S * 0.2) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let xx = x + (r % 2) * S * 0.2; xx < x + w; xx += S * 0.4) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + S * 0.2); ctx.stroke(); } }
  ctx.restore(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.8, S / 16); ctx.stroke(wall);
  // toit
  const roof = new Path2D(); roof.moveTo(x - S * 0.25, groundY - h + S * 0.05); roof.lineTo(x + w / 2, groundY - h - S * 0.85); roof.lineTo(x + w + S * 0.25, groundY - h + S * 0.05); roof.closePath();
  outlined(ctx, S, night ? '#4d5866' : '#5d6b7c', roof);
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(x - S * 0.1, groundY - h); ctx.lineTo(x + w / 2, groundY - h - S * 0.75); ctx.lineTo(x + w / 2, groundY - h - S * 0.55); ctx.lineTo(x + S * 0.2, groundY - h); ctx.closePath(); ctx.fill();
  // porte en arc
  const dx = x + S * 0.4, dw = w - S * 0.8, dh = S * 1.6, top = groundY - dh;
  const door = new Path2D(); door.moveTo(dx, groundY); door.lineTo(dx, top + dw * 0.2); door.quadraticCurveTo(dx + dw / 2, top - dw * 0.12, dx + dw, top + dw * 0.2); door.lineTo(dx + dw, groundY); door.closePath();
  const ig = ctx.createLinearGradient(0, top, 0, groundY); ig.addColorStop(0, '#3a2618'); ig.addColorStop(1, night ? '#7a5228' : '#5c3e22');
  outlined(ctx, S, ig, door);
  ctx.save(); ctx.clip(door);
  const lg = ctx.createRadialGradient(dx + dw / 2, top + S * 0.3, 0, dx + dw / 2, top + S * 0.3, dw * 0.7); lg.addColorStop(0, 'rgba(255,214,140,.5)'); lg.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = lg; ctx.fillRect(dx, top - S, dw, dh + S);
  ctx.restore();
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(dx + dw / 2, top + S * 0.28, S * 0.12, S * 0.05, 0, 0, 7); ctx.fill();
  outlined(ctx, S, '#c98a4e', rect(dx + dw - S * 0.9, groundY - S * 0.5, S * 0.82, S * 0.12, S * 0.03));
  // le vélo : contours qui se remplissent avec la progression vers l'objectif
  const cx = dx + dw * 0.42, cy = groundY - S * 0.34, r = S * 0.28;
  ctx.globalAlpha = built ? 1 : 0.35 + 0.65 * progress;
  ctx.lineCap = 'round';
  const bike = () => {
    ctx.beginPath(); ctx.arc(cx - S * 0.44, cy, r, 0, 7); ctx.moveTo(cx + S * 0.44 + r, cy); ctx.arc(cx + S * 0.44, cy, r, 0, 7);
    ctx.moveTo(cx - S * 0.44, cy); ctx.lineTo(cx - S * 0.08, cy - S * 0.36); ctx.lineTo(cx + S * 0.3, cy - S * 0.36); ctx.lineTo(cx + S * 0.44, cy);
    ctx.moveTo(cx - S * 0.08, cy - S * 0.36); ctx.lineTo(cx + S * 0.02, cy); ctx.lineTo(cx + S * 0.3, cy - S * 0.36);
    ctx.moveTo(cx + S * 0.3, cy - S * 0.36); ctx.lineTo(cx + S * 0.38, cy - S * 0.58); ctx.lineTo(cx + S * 0.5, cy - S * 0.6);
    ctx.moveTo(cx - S * 0.13, cy - S * 0.45); ctx.lineTo(cx, cy - S * 0.45); ctx.stroke();
  };
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(3, S / 9); bike();
  ctx.strokeStyle = built ? '#34d399' : '#f2c14e'; ctx.lineWidth = Math.max(1.6, S / 18); bike();
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  sign(ctx, x + w / 2 + S * 0.35, groundY - h - S * 1.45, S, 'ATELIER', '#e5484d');
  ctx.restore();
}

export function drawPickIconAt(ctx, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.4, size / 14);
  ctx.fillStyle = '#9b6a3e'; ctx.beginPath(); ctx.roundRect(-size * 0.45, -size * 0.06, size * 0.9, size * 0.12, size * 0.06); ctx.fill(); ctx.stroke();
  const ig = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
  ig.addColorStop(0, shade(color, 0.55)); ig.addColorStop(0.5, color); ig.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.moveTo(size * 0.3, -size * 0.08); ctx.quadraticCurveTo(size * 0.42, -size * 0.32, size * 0.18, -size * 0.48); ctx.quadraticCurveTo(size * 0.55, -size * 0.3, size * 0.48, -size * 0.08);
  ctx.lineTo(size * 0.48, size * 0.08); ctx.quadraticCurveTo(size * 0.55, size * 0.3, size * 0.18, size * 0.48); ctx.quadraticCurveTo(size * 0.42, size * 0.32, size * 0.3, size * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(size * 0.36, -size * 0.22, size * 0.04, size * 0.1, -0.4, 0, 7); ctx.fill();
  ctx.restore();
}
