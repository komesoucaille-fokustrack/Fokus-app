/* =====================================================================
   LA MINE — dessins (Canvas 2D, 100 % vectoriel, aucun fichier image)
   Direction artistique « premium » : matières peintes sans raccord (terre, roche, parois creusées), minerais
   facettés, bois et laiton, palette sourde ; la lumière (lanternes, lampe frontale) fait tout le travail.
   Personnage à la Rayman : mains et pieds flottants (pas de bras ni de jambes) → animations souples et lisibles.
   Tout est peint une fois dans des canevas hors écran (textures 4 × 4 cases), puis simplement recopié.
   ===================================================================== */
const LINE = 'rgba(34,22,14,.82)';

/* générateur pseudo-aléatoire déterministe (mêmes textures à chaque ouverture) */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function shade(h, k) { // k > 0 éclaircit, k < 0 assombrit
  const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  const [r, g, b] = hex(h);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('');
}
function blob(ctx, x, y, r, rnd, pts = 7, wob = 0.28) { // forme organique fermée
  ctx.beginPath();
  const a0 = rnd() * 6.28, ps = [];
  for (let i = 0; i < pts; i++) { const a = a0 + (i / pts) * 6.283, rr = r * (1 - wob / 2 + rnd() * wob); ps.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  for (let i = 0; i < pts; i++) {
    const p = ps[i], q = ps[(i + 1) % pts], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) { const l = ps[pts - 1]; ctx.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2); }
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- matières : textures sans raccord de PATCH × PATCH cases ---------- */
export const PATCH = 4;
/* dessine un motif aux 9 positions (bords qui se raccordent) */
function wrap(N, x, y, r, fn) {
  for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
    if (x + dx + r < 0 || x + dx - r > N || y + dy + r < 0 || y + dy - r > N) continue;
    fn(x + dx, y + dy);
  }
}
function grain(ctx, N, amt, rnd) {
  const im = ctx.getImageData(0, 0, N, N), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
  ctx.putImageData(im, 0, 0);
}
function paintMaterial(ctx, N, S, kind, cols, rnd) {
  const [base, light, dark] = cols;
  ctx.fillStyle = base; ctx.fillRect(0, 0, N, N);
  // grandes nuances douces
  for (let i = 0; i < 34; i++) {
    const x = rnd() * N, y = rnd() * N, r = S * (0.5 + rnd() * 1.3), c = rnd() < 0.5 ? light : dark, a = 0.1 + rnd() * 0.16;
    wrap(N, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  // strates : fines couches ondulées (période = largeur de la texture → raccord parfait)
  for (let i = 0; i < 7; i++) {
    const y0 = rnd() * N, th = S * (0.04 + rnd() * 0.12), amp = S * (0.08 + rnd() * 0.18), k = 1 + Math.floor(rnd() * 2), ph = rnd() * 6.28;
    ctx.fillStyle = rgba(rnd() < 0.55 ? dark : light, 0.1 + rnd() * 0.1);
    for (const oy of [-N, 0, N]) {
      ctx.beginPath();
      for (let x = 0; x <= N; x += N / 48) ctx.lineTo(x, oy + y0 + Math.sin((x / N) * 6.283 * k + ph) * amp);
      for (let x = N; x >= 0; x -= N / 48) ctx.lineTo(x, oy + y0 + th + Math.sin((x / N) * 6.283 * k + ph + 0.6) * amp);
      ctx.closePath(); ctx.fill();
    }
  }
  if (kind === 'dirt') {
    // cailloux enchâssés
    for (let i = 0; i < 20; i++) {
      const x = rnd() * N, y = rnd() * N, r = S * (0.025 + rnd() * 0.05), sq = 0.6 + rnd() * 0.3, rot = rnd() * 3, tone = rnd() * 0.5 - 0.25;
      wrap(N, x, y, r * 2, (px, py) => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
        ctx.fillStyle = 'rgba(20,10,4,.38)'; ctx.beginPath(); ctx.ellipse(r * 0.12, r * 0.28, r * 1.08, r * sq * 1.08, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
        g.addColorStop(0, shade('#7a6152', tone)); g.addColorStop(1, shade('#3e2f26', tone - 0.1));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * sq, 0, 0, 7); ctx.fill();
        ctx.restore();
      });
    }
    // radicelles
    ctx.strokeStyle = rgba(dark, 0.35); ctx.lineWidth = Math.max(1, S / 60); ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      let x = rnd() * N, y = rnd() * N;
      wrap(N, x, y, S, (px, py) => {
        ctx.beginPath(); ctx.moveTo(px, py);
        let qx = px, qy = py;
        for (let k = 0; k < 4; k++) { const nx = qx + (rnd() - 0.5) * S * 0.5, ny = qy + rnd() * S * 0.35; ctx.quadraticCurveTo(qx + (rnd() - 0.5) * S * 0.3, (qy + ny) / 2, nx, ny); qx = nx; qy = ny; }
        ctx.stroke();
      });
    }
  } else {
    // facettes taillées : arête claire en haut à gauche, sombre en bas à droite
    for (let i = 0; i < 30; i++) {
      const x = rnd() * N, y = rnd() * N, r = S * (0.14 + rnd() * 0.32), n = 5 + Math.floor(rnd() * 2), a0 = rnd() * 6.28;
      const pts = [...Array(n)].map((_, k) => { const a = a0 + (k / n) * 6.283, rr = r * (0.7 + rnd() * 0.45); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
      const tint = rnd() < 0.5 ? light : dark, al = 0.06 + rnd() * 0.08;
      wrap(N, x, y, r * 1.2, (px, py) => {
        ctx.beginPath(); pts.forEach(([qx, qy], k) => (k ? ctx.lineTo(px + qx, py + qy) : ctx.moveTo(px + qx, py + qy))); ctx.closePath();
        ctx.fillStyle = rgba(tint, al); ctx.fill();
        for (let k = 0; k < n; k++) {
          const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % n], nx = -(by - ay), ny = bx - ax, lit = (nx * -1 + ny * -1) / Math.hypot(nx, ny);
          ctx.strokeStyle = lit > 0 ? `rgba(255,240,220,${0.09 * lit})` : `rgba(10,6,4,${-0.2 * lit})`;
          ctx.lineWidth = Math.max(1, S / 46);
          ctx.beginPath(); ctx.moveTo(px + ax, py + ay); ctx.lineTo(px + bx, py + by); ctx.stroke();
        }
      });
    }
    // fissures gravées
    for (let i = 0; i < 7; i++) {
      const x = rnd() * N, y = rnd() * N, seg = [];
      let qx = 0, qy = 0; seg.push([0, 0]);
      for (let k = 0; k < 4; k++) { qx += (rnd() - 0.5) * S * 0.5; qy += (rnd() - 0.5) * S * 0.5; seg.push([qx, qy]); }
      wrap(N, x, y, S * 1.2, (px, py) => {
        for (const [off, col, w] of [[1, 'rgba(255,235,210,.07)', 1], [0, 'rgba(8,5,3,.32)', 1]]) {
          ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, S / 50) * w; ctx.beginPath();
          seg.forEach(([sx, sy], k) => (k ? ctx.lineTo(px + sx + off, py + sy + off) : ctx.moveTo(px + sx + off, py + sy + off))); ctx.stroke();
        }
      });
    }
    // paillettes de mica
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,248,230,${0.15 + rnd() * 0.35})`; const x = rnd() * N, y = rnd() * N, r = Math.max(0.6, S / 70); ctx.fillRect(x, y, r, r); }
  }
  // grain fin
  for (let i = 0; i < 900; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.06)'; ctx.fillRect(rnd() * N, rnd() * N, Math.max(1, S / 46), Math.max(1, S / 46)); }
  grain(ctx, N, 9, rnd);
}
/* paroi du fond des galeries : même roche, en retrait (plus sombre, moins contrastée) + traces de pioche */
function paintWall(ctx, N, S, src, rnd) {
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = 'rgba(12,9,10,.52)'; ctx.fillRect(0, 0, N, N);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N, y = rnd() * N, l = S * (0.12 + rnd() * 0.2), a = -0.9 + rnd() * 0.5 + (rnd() < 0.5 ? 0 : 1.6);
    wrap(N, x, y, l, (px, py) => {
      ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = Math.max(1, S / 34);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,200,.06)'; ctx.lineWidth = Math.max(1, S / 60);
      ctx.beginPath(); ctx.moveTo(px + 1, py + 1); ctx.lineTo(px + 1 + Math.cos(a) * l, py + 1 + Math.sin(a) * l); ctx.stroke();
    });
  }
}

/* ---------- minerais (sprites transparents posés sur la roche) ---------- */
const CRYSTALS = ['quartz', 'amethyste'];
function prism(ctx, x, y, w, h, rot, c, cl, cd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // corps hexagonal vu de côté : face gauche claire, face droite saturée, pointe
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.72); ctx.lineTo(0, -h); ctx.lineTo(0, 0); ctx.closePath();
  let g = ctx.createLinearGradient(-w, 0, 0, -h); g.addColorStop(0, shade(cl, -0.05)); g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g; ctx.globalAlpha = 0.95; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.72); ctx.lineTo(w, 0); ctx.closePath();
  g = ctx.createLinearGradient(0, 0, w, -h); g.addColorStop(0, cd); g.addColorStop(1, c);
  ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(cd.startsWith('#') ? cd : '#000000', 0.9); ctx.lineWidth = Math.max(0.8, w / 6);
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.72); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.72); ctx.lineTo(w, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(0.7, w / 8);
  ctx.beginPath(); ctx.moveTo(0, -h * 0.08); ctx.lineTo(0, -h * 0.94); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(-w * 0.75, -h * 0.25); ctx.lineTo(-w * 0.45, -h * 0.62); ctx.lineTo(-w * 0.45, -h * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function paintOre(ctx, S, ore, rnd) {
  const [c, cl, cd] = ore.colors, cx = S / 2, cy = S / 2;
  if (ore.id === 'geode') {
    const R = S * 0.36;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(cx + S * 0.03, cy + S * 0.05, R * 1.08, R, 0, 0, 7); ctx.fill();
    let g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.05);
    g.addColorStop(0, '#9aa3ab'); g.addColorStop(1, '#4b5157');
    ctx.fillStyle = g; blob(ctx, cx, cy, R, rnd, 9, 0.12); ctx.fill();
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8); g.addColorStop(0, cl); g.addColorStop(0.5, c); g.addColorStop(1, shade(cd, -0.3));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.74, R * 0.7, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 16; i++) { // dents de cristal tournées vers le cœur
      const a = (i / 16) * 6.283 + rnd() * 0.2, r0 = R * 0.72, r1 = R * (0.3 + rnd() * 0.18);
      ctx.fillStyle = i % 2 ? cl : shade(c, 0.15);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - 0.2) * r0, cy + Math.sin(a - 0.2) * r0 * 0.95); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a + 0.2) * r0, cy + Math.sin(a + 0.2) * r0 * 0.95); ctx.closePath(); ctx.fill();
    }
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.4); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, S / 40); ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 3.6, 4.9); ctx.stroke();
    return;
  }
  if (CRYSTALS.includes(ore.id)) {
    // halo intérieur + amas de prismes qui sortent d'une même fissure
    const bx = S * (0.35 + rnd() * 0.3), by = S * (0.62 + rnd() * 0.15);
    let g = ctx.createRadialGradient(bx, by - S * 0.15, 0, bx, by - S * 0.15, S * 0.5);
    g.addColorStop(0, rgba(c, 0.45)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(8,5,3,.6)'; ctx.beginPath(); ctx.ellipse(bx, by + S * 0.02, S * 0.2, S * 0.07, 0, 0, 7); ctx.fill();
    const n = 4 + Math.floor(rnd() * 2);
    const ps = [...Array(n)].map((_, i) => ({ rot: -0.85 + (i / (n - 1)) * 1.7 + (rnd() - 0.5) * 0.25, h: S * (0.28 + rnd() * 0.24) * (i === Math.floor(n / 2) ? 1.25 : 1), w: S * (0.06 + rnd() * 0.035) }));
    ps.sort((a, b) => a.h - b.h).forEach((p) => prism(ctx, bx + p.rot * S * 0.06, by, p.w, p.h, p.rot, c, cl, cd));
    return;
  }
  // métaux et charbon : veine minérale + pépites en relief
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = rgba(c, 0.35); ctx.lineWidth = S * (0.03 + rnd() * 0.03);
    ctx.beginPath(); let x = rnd() * S * 0.3, y = rnd() * S; ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) { const nx = x + S * 0.3, ny = y + (rnd() - 0.5) * S * 0.5; ctx.quadraticCurveTo((x + nx) / 2, y + (rnd() - 0.5) * S * 0.3, nx, ny); x = nx; y = ny; }
    ctx.stroke();
  }
  const n = 3 + Math.floor(rnd() * 3), coal = ore.id === 'charbon';
  for (let i = 0; i < n; i++) {
    const x = S * (0.2 + rnd() * 0.6), y = S * (0.22 + rnd() * 0.56), r = S * (0.08 + rnd() * 0.08);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.3, r * 1.1, r * 0.92, 0, 0, 7); ctx.fill();
    if (coal) { // éclats anguleux, reflets bleutés
      const k = 5 + Math.floor(rnd() * 2), a0 = rnd() * 6;
      const pts = [...Array(k)].map((_, j) => { const a = a0 + (j / k) * 6.283; return [Math.cos(a) * r * (0.8 + rnd() * 0.35), Math.sin(a) * r * (0.8 + rnd() * 0.35)]; });
      ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      ctx.fillStyle = '#16161a'; ctx.fill();
      ctx.fillStyle = 'rgba(150,170,210,.35)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(200,215,255,.22)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(...pts[k - 1]); ctx.lineTo(...pts[k - 2]); ctx.closePath(); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r * 1.15);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, cl); g.addColorStop(0.6, c); g.addColorStop(1, cd);
      blob(ctx, 0, 0, r, rnd, 6, 0.35); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = shade(cd, -0.4); ctx.lineWidth = Math.max(0.8, S / 60); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.11, -0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}

/* Prépare toutes les textures d'un monde (S = taille d'une case en pixels réels) */
export function makeTiles(W, S) {
  const N = S * PATCH, out = { S, N, mat: {}, wall: {}, ore: {} };
  const dirt = canvas(N), rock = canvas(N);
  paintMaterial(dirt.getContext('2d'), N, S, 'dirt', W.tiles[1].colors, rng(101));
  paintMaterial(rock.getContext('2d'), N, S, 'rock', W.tiles[2].colors, rng(202));
  out.mat[1] = dirt; out.mat[2] = rock;
  for (const k of [1, 2]) { const c = canvas(N); paintWall(c.getContext('2d'), N, S, out.mat[k], rng(300 + k)); out.wall[k] = c; }
  W.ores.forEach((o, i) => {
    out.ore[3 + i] = [0, 1, 2].map((v) => { const c = canvas(S); paintOre(c.getContext('2d'), S, o, rng(500 + i * 10 + v)); return c; });
  });
  return out;
}

/* fond de grotte pour les scènes de l'histoire (texture de roche + lumière chaude) */
const caveCache = new Map();
export function paintCave(ctx, w, h, cx, cy, lit) {
  const d = Math.max(1, ctx.getTransform().a), N = Math.ceil(Math.max(w, h) * d), key = N;
  let c = caveCache.get(key);
  if (!c) { c = canvas(N); paintMaterial(c.getContext('2d'), N, N / 6, 'rock', ['#4d443c', '#6e6258', '#2b241f'], rng(77)); caveCache.set(key, c); }
  ctx.drawImage(c, 0, 0, N / d, N / d);
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * lit);
  g.addColorStop(0, 'rgba(255,190,120,.14)'); g.addColorStop(0.45, 'rgba(10,7,5,.35)'); g.addColorStop(1, 'rgba(6,5,4,.93)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/* ---------- boiseries, rails, échelles, lanternes ---------- */
function timber(ctx, x, y, w, h, vertical) {
  const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#7a5434'); g.addColorStop(0.45, '#9a6c42'); g.addColorStop(1, '#4e321d');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(40,24,12,.45)'; ctx.lineWidth = Math.max(0.8, (vertical ? w : h) / 9);
  ctx.beginPath();
  if (vertical) { ctx.moveTo(x + w * 0.35, y); ctx.lineTo(x + w * 0.38, y + h); ctx.moveTo(x + w * 0.7, y + h * 0.1); ctx.lineTo(x + w * 0.66, y + h * 0.9); }
  else { ctx.moveTo(x, y + h * 0.4); ctx.lineTo(x + w, y + h * 0.36); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,12,6,.7)'; ctx.lineWidth = Math.max(0.8, (vertical ? w : h) / 7); ctx.strokeRect(x, y, w, h);
}
/* cadre de soutènement (deux montants + chapeau, colliers en fer) */
export function drawSupport(ctx, x, y, S) {
  const w = S * 0.13;
  timber(ctx, x + S * 0.06, y + S * 0.1, w, S * 0.9, true);
  timber(ctx, x + S * 0.81, y + S * 0.1, w, S * 0.9, true);
  timber(ctx, x - S * 0.02, y, S * 1.04, S * 0.14, false);
  ctx.fillStyle = '#3c3f44';
  for (const px of [x + S * 0.06, x + S * 0.81]) { ctx.fillRect(px - 1, y + S * 0.16, w + 2, S * 0.045); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px - 1, y + S * 0.16, w + 2, 1); ctx.fillStyle = '#3c3f44'; }
}
/* voie ferrée au sol des galeries horizontales */
export function drawRail(ctx, x, y, S) {
  const fy = y + S * 0.94;
  ctx.fillStyle = '#3d2a1b';
  for (let k = 0.08; k < 1; k += 0.33) ctx.fillRect(x + S * k, fy - S * 0.035, S * 0.16, S * 0.07);
  ctx.fillStyle = '#5d636b'; ctx.fillRect(x, fy - S * 0.07, S, S * 0.04);
  ctx.fillStyle = 'rgba(230,236,242,.55)'; ctx.fillRect(x, fy - S * 0.07, S, Math.max(1, S * 0.012));
}
/* échelle (puits verticaux) */
export function drawLadder(ctx, x, y, S) {
  for (const px of [0.26, 0.7]) timber(ctx, x + S * px, y, S * 0.07, S, true);
  for (let k = 0.15; k < 1; k += 0.3) timber(ctx, x + S * 0.26, y + S * k, S * 0.51, S * 0.06, false);
}
/* lanterne en laiton (suspendue au plafond ou accrochée à la paroi) */
export function drawLantern(ctx, x, y, S, t, hang = true) {
  const sway = hang ? Math.sin(t * 1.1 + x * 0.01) * S * 0.025 : 0;
  const cx = x + S / 2 + sway, top = hang ? y + S * 0.18 : y + S * 0.3, flick = 0.85 + 0.15 * Math.sin(t * 9 + x) * Math.sin(t * 5.3 + y);
  ctx.save();
  if (hang) { ctx.strokeStyle = '#2b2b2e'; ctx.lineWidth = Math.max(1, S / 40); ctx.beginPath(); ctx.moveTo(x + S / 2, y + S * 0.02); ctx.lineTo(cx, top); ctx.stroke(); }
  else { ctx.fillStyle = '#3b3326'; ctx.fillRect(x + S * 0.3, top + S * 0.12, S * 0.12, S * 0.04); }
  const w = S * 0.2, h = S * 0.3;
  // halo
  const g = ctx.createRadialGradient(cx, top + h * 0.6, 0, cx, top + h * 0.6, S * 0.7);
  g.addColorStop(0, `rgba(255,200,120,${0.42 * flick})`); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - S * 0.7, top - S * 0.2, S * 1.4, S * 1.4);
  // verre
  const gl = ctx.createLinearGradient(0, top, 0, top + h);
  gl.addColorStop(0, '#fff3c9'); gl.addColorStop(1, `rgba(255,190,90,${0.85 * flick})`);
  ctx.fillStyle = gl; ctx.beginPath(); ctx.roundRect(cx - w / 2, top + h * 0.12, w, h * 0.78, w * 0.25); ctx.fill();
  // flamme
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, top + h * 0.55, w * 0.14, h * 0.18 * flick, 0, 0, 7); ctx.fill();
  // armature
  ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = Math.max(1, S / 36);
  ctx.beginPath(); ctx.roundRect(cx - w / 2, top + h * 0.12, w, h * 0.78, w * 0.25); ctx.moveTo(cx, top + h * 0.12); ctx.lineTo(cx, top + h * 0.9); ctx.stroke();
  ctx.fillStyle = '#7a5a26'; ctx.beginPath(); ctx.moveTo(cx - w * 0.6, top + h * 0.14); ctx.lineTo(cx, top - h * 0.05); ctx.lineTo(cx + w * 0.6, top + h * 0.14); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - w * 0.55, top + h * 0.88, w * 1.1, h * 0.1);
  ctx.restore();
}
/* ---------- personnage : voir hero.js ---------- */
export { drawMiner } from './hero.js';

/* ---------- surface : ciel, montagnes, ville (peints une fois, mis en cache) ---------- */
const SKIES = {
  night: ['#060a1a', '#0f1938', '#24305a', '#3b3f6b'],
  dawn: ['#2c3a6a', '#7d6a98', '#e59a8c', '#f6c79b'],
  dusk: ['#1f2550', '#5d4b85', '#c66f86', '#f2a27c'],
  day: ['#3c78bd', '#6fa5dc', '#a9cdea', '#dfeaf0'],
};
const skyKind = (h) => (h < 6 || h >= 21 ? 'night' : h < 8 ? 'dawn' : h >= 18 ? 'dusk' : 'day');
/* [haut, bas, nuit ?] — gardé pour les appels existants */
export function skyColors(h) { const s = SKIES[skyKind(h)]; return [s[0], s[3], skyKind(h) === 'night']; }
export function paintSkyline(ctx, w, h, hour, seed = 7) {
  const kind = skyKind(hour), P = SKIES[kind], night = kind === 'night', rnd = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P[0]); g.addColorStop(0.45, P[1]); g.addColorStop(0.8, P[2]); g.addColorStop(1, P[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (night || kind === 'dusk') {
    for (let i = 0; i < (night ? 140 : 40); i++) {
      const x = rnd() * w, y = rnd() * h * 0.62, r = rnd() < 0.08 ? 1.3 : 0.7;
      ctx.fillStyle = `rgba(255,255,255,${(night ? 0.35 : 0.2) + rnd() * 0.55})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  // astre
  const sx = w * 0.78, sy = h * (kind === 'day' ? 0.24 : 0.36), sr = Math.min(w, h) * 0.055;
  let sg = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
  sg.addColorStop(0, night ? 'rgba(220,228,255,.35)' : 'rgba(255,236,190,.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
  sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
  sg.addColorStop(0, night ? '#ffffff' : '#fffaf0'); sg.addColorStop(1, night ? '#cfd6ee' : '#ffe2a6');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
  if (night) { ctx.fillStyle = 'rgba(150,160,190,.25)'; ctx.beginPath(); ctx.arc(sx + sr * 0.3, sy - sr * 0.2, sr * 0.25, 0, 7); ctx.arc(sx - sr * 0.35, sy + sr * 0.3, sr * 0.18, 0, 7); ctx.fill(); }
  // nuages : longues traînées douces
  for (let i = 0; i < 5; i++) {
    const cx = rnd() * w, cy = h * (0.1 + rnd() * 0.32), cw = w * (0.12 + rnd() * 0.16), ch = h * (0.025 + rnd() * 0.03);
    const col = night ? 'rgba(120,130,170,.10)' : kind === 'day' ? 'rgba(255,255,255,.55)' : 'rgba(255,214,200,.35)';
    for (let k = 0; k < 6; k++) {
      const ex = cx + (k - 2.5) * cw * 0.22, ey = cy - Math.sin((k / 5) * Math.PI) * ch * 0.8, r = ch * (0.9 + Math.sin((k / 5) * Math.PI) * 0.8);
      const cg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 2.2); cg.addColorStop(0, col); cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg; ctx.fillRect(ex - r * 2.2, ey - r * 2.2, r * 4.4, r * 4.4);
    }
  }
  // chaînes de montagnes : perspective atmosphérique (les plus lointaines se fondent dans le ciel)
  const haze = P[3], ridge = night ? '#0b1022' : kind === 'day' ? '#4f6f73' : '#3d3150';
  const range = (base, amp, f, t, s2) => {
    ctx.fillStyle = mix(ridge, haze, t); ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 4; x += 4) {
      const u = x / w;
      const y = h * base - h * amp * (0.55 * Math.sin(u * f + s2) + 0.3 * Math.sin(u * f * 2.7 + s2 * 2) + 0.15 * Math.abs(Math.sin(u * f * 6.1 + s2)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  range(0.58, 0.12, 5, 0.72, seed);
  range(0.66, 0.1, 7, 0.52, seed + 3);
  range(0.75, 0.07, 11, 0.32, seed + 5);
  // lisière d'arbres
  const ground = h * 0.88, tree = mix(night ? '#0a0f1c' : kind === 'day' ? '#2f4a3c' : '#2a2238', haze, 0.18);
  ctx.fillStyle = tree;
  for (let x = -10; x < w + 10; x += 6 + rnd() * 10) { const r = h * (0.025 + rnd() * 0.03); ctx.beginPath(); ctx.ellipse(x, ground - r * 0.6, r * 0.8, r * 1.3, 0, 0, 7); ctx.fill(); }
  ctx.fillRect(0, ground - h * 0.02, w, h);
  // ville en silhouettes sur deux plans (plus élégant que des façades détaillées), fenêtres allumées le soir
  const lit = night || kind === 'dusk' || kind === 'dawn';
  const town = (scale, t2, so) => {
    const r2 = rng(seed + so), col = mix(ridge, haze, t2), wins = [];
    ctx.fillStyle = col;
    let x = w * 0.16 * scale - 20;
    while (x < w + 10) {
      const bw = w * (0.024 + r2() * 0.03) * scale, bh = h * (0.06 + r2() * 0.11) * scale, top = ground - bh, kindR = r2();
      ctx.beginPath(); ctx.rect(x, top, bw, bh + 2);
      if (kindR < 0.45) { ctx.moveTo(x - bw * 0.05, top); ctx.lineTo(x + bw / 2, top - bw * 0.45); ctx.lineTo(x + bw * 1.05, top); }
      else if (kindR < 0.55) { ctx.rect(x + bw * 0.35, top - bh * 0.9, bw * 0.3, bh * 0.9); ctx.moveTo(x + bw * 0.3, top - bh * 0.9); ctx.lineTo(x + bw / 2, top - bh * 1.45); ctx.lineTo(x + bw * 0.7, top - bh * 0.9); }
      else if (kindR < 0.7) ctx.rect(x + bw * 0.7, top - bh * 0.18, bw * 0.12, bh * 0.18);
      ctx.fill();
      for (let wy = top + bh * 0.2; wy < ground - bh * 0.15; wy += bh * 0.22) for (let wx = x + bw * 0.2; wx < x + bw * 0.8; wx += bw * 0.3) {
        if (r2() < (night ? 0.45 : lit ? 0.3 : 0.12)) wins.push([wx, wy, bw * 0.12, bh * 0.09]);
      }
      x += bw * (0.92 + r2() * 0.35);
    }
    for (const [wx, wy, ww, wh] of wins) {
      ctx.fillStyle = lit ? 'rgba(255,206,130,.95)' : rgba(haze, 0.5); ctx.fillRect(wx, wy, ww, wh);
      if (lit) { const lg = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 3); lg.addColorStop(0, 'rgba(255,190,110,.22)'); lg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = lg; ctx.fillRect(wx - ww * 3, wy - ww * 3, ww * 7, ww * 7); }
    }
  };
  town(0.8, 0.45, 11);
  town(1, 0.22, 23);
  // brume au pied de la ville
  const mg = ctx.createLinearGradient(0, ground - h * 0.12, 0, h);
  mg.addColorStop(0, rgba(haze, 0)); mg.addColorStop(1, rgba(haze, night ? 0.12 : 0.3));
  ctx.fillStyle = mg; ctx.fillRect(0, ground - h * 0.12, w, h);
}

/* arbre stylisé (feuillage en volumes doux, liseré de lumière) */
export function drawTree(ctx, x, groundY, S, night, seed = 1) {
  const rnd = rng(seed), h = S * (2.2 + rnd() * 0.9), leaf = night ? '#1d3a33' : '#3c6b4a', trunk = night ? '#2a2019' : '#5a3e2a';
  ctx.save();
  ctx.fillStyle = trunk; ctx.beginPath(); ctx.moveTo(x - S * 0.08, groundY); ctx.lineTo(x - S * 0.04, groundY - h * 0.55); ctx.lineTo(x + S * 0.04, groundY - h * 0.55); ctx.lineTo(x + S * 0.09, groundY); ctx.closePath(); ctx.fill();
  const blobs = [[0, -h * 0.62, S * 0.62], [-S * 0.32, -h * 0.5, S * 0.42], [S * 0.34, -h * 0.52, S * 0.44], [0, -h * 0.86, S * 0.46]];
  for (const [bx, by, r] of blobs) {
    const g = ctx.createRadialGradient(x + bx - r * 0.35, groundY + by - r * 0.4, r * 0.1, x + bx, groundY + by, r * 1.05);
    g.addColorStop(0, shade(leaf, night ? 0.12 : 0.3)); g.addColorStop(1, shade(leaf, -0.3));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + bx, groundY + by, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* chevalement : tour en acier riveté au-dessus du puits, molette et câble */
export function drawHeadframe(ctx, cx, groundY, S, t, night) {
  const H = S * 4.2, W2 = S * 1.1, steel = night ? '#55607a' : '#2f343c', hi = night ? 'rgba(200,210,240,.25)' : 'rgba(255,255,255,.22)';
  ctx.save(); ctx.lineCap = 'round';
  const l = (y) => W2 - (W2 * 0.65 * (groundY - y)) / H;
  const beam = (x1, y1, x2, y2, w) => {
    ctx.strokeStyle = steel; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = hi; ctx.lineWidth = Math.max(1, w * 0.25); ctx.beginPath(); ctx.moveTo(x1 - w * 0.2, y1); ctx.lineTo(x2 - w * 0.2, y2); ctx.stroke();
  };
  // jambe de force
  beam(cx + W2 * 0.35, groundY - H * 0.95, cx + W2 * 2.5, groundY, S * 0.1);
  for (let k = 1; k <= 5; k++) {
    const y1 = groundY - (H * k) / 5, y0 = groundY - (H * (k - 1)) / 5;
    beam(cx - l(y0), y0, cx + l(y1), y1, S * 0.045); beam(cx + l(y0), y0, cx - l(y1), y1, S * 0.045);
    beam(cx - l(y1), y1, cx + l(y1), y1, S * 0.06);
  }
  beam(cx - W2, groundY, cx - W2 * 0.35, groundY - H, S * 0.1);
  beam(cx + W2, groundY, cx + W2 * 0.35, groundY - H, S * 0.1);
  // plate-forme et molette
  const wy = groundY - H - S * 0.2, r = S * 0.72;
  ctx.fillStyle = steel; ctx.fillRect(cx - W2 * 0.5, groundY - H - S * 0.05, W2, S * 0.12);
  ctx.strokeStyle = night ? '#9aa5bd' : '#1f2328'; ctx.lineWidth = S * 0.09; ctx.beginPath(); ctx.arc(cx, wy, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = S * 0.025; ctx.beginPath(); ctx.arc(cx, wy, r, 3.4, 5.2); ctx.stroke();
  ctx.strokeStyle = night ? '#9aa5bd' : '#2a2f36'; ctx.lineWidth = S * 0.035;
  for (let i = 0; i < 8; i++) { const a = t * 0.6 + (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(cx, wy); ctx.lineTo(cx + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.stroke(); }
  ctx.fillStyle = '#b5893b'; ctx.beginPath(); ctx.arc(cx, wy, S * 0.11, 0, 7); ctx.fill();
  // câble qui descend dans le puits
  ctx.strokeStyle = 'rgba(30,30,34,.9)'; ctx.lineWidth = Math.max(1, S / 40); ctx.beginPath(); ctx.moveTo(cx + r, wy); ctx.lineTo(cx + r * 0.15, groundY + S * 0.5); ctx.stroke();
  ctx.restore();
}

/* pièce Fokoin (anneau du logo Fokus frappé sur une pièce d'or) — SVG pour l'interface */
export const COIN_SVG = (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="fkg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#b8860b"/></radialGradient><linearGradient id="fkr" x1="0" x2="1"><stop offset="0" stop-color="#059669"/><stop offset=".5" stop-color="#10b981"/><stop offset="1" stop-color="#86efac"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#fkg)" stroke="#8a6508" stroke-width="1.4"/><circle cx="16" cy="16" r="11.5" fill="none" stroke="#c99a1c" stroke-width="1"/><circle cx="16" cy="16" r="6.6" fill="none" stroke="url(#fkr)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="33 9" transform="rotate(-90 16 16)"/></svg>`;

/* ---------- bâtiments de la surface (on les touche pour y entrer) ---------- */
const GOLD = '#d8b46a';
/* plaque émaillée sombre, lettres dorées espacées */
function plaque(ctx, cx, y, S, text) {
  const t = text.split('').join(' ');
  ctx.font = `700 ${Math.round(S * 0.24)}px Inter Variable, sans-serif`;
  const w = ctx.measureText(t).width + S * 0.6, h = S * 0.44;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(cx - w / 2 + 2, y + 3, w, h, S * 0.08); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2a2119'); g.addColorStop(1, '#16110c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, S * 0.08); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, S / 34); ctx.beginPath(); ctx.roundRect(cx - w / 2 + S * 0.05, y + S * 0.05, w - S * 0.1, h - S * 0.1, S * 0.05); ctx.stroke();
  ctx.fillStyle = '#f1d593'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx, y + h / 2 + 0.5);
}
function boards(ctx, x, y, w, h, c, step) { // bardage horizontal
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, shade(c, 0.06)); g.addColorStop(1, shade(c, -0.2));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  for (let yy = y + step; yy < y + h; yy += step) {
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, yy, w, Math.max(1, step * 0.08));
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, yy + Math.max(1, step * 0.08), w, Math.max(1, step * 0.05));
  }
}
function bricks(ctx, x, y, w, h, c, S) {
  ctx.fillStyle = shade(c, -0.35); ctx.fillRect(x, y, w, h);
  const bh = S * 0.16, bw = S * 0.36, rnd = rng(Math.round(x * 13 + y));
  for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
    for (let xx = x - (r % 2) * bw * 0.5; xx < x + w; xx += bw) {
      const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + bw - 1);
      if (x1 <= x0) continue;
      ctx.fillStyle = shade(c, rnd() * 0.14 - 0.07); ctx.fillRect(x0, yy + 1, x1 - x0, Math.min(bh - 2, y + h - yy - 1));
    }
  }
  const sg = ctx.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, 'rgba(255,255,255,.06)'); sg.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = sg; ctx.fillRect(x, y, w, h);
}
function warmWindow(ctx, x, y, w, h, S, night) { // vitre éclairée de l'intérieur + croisillons
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, night ? '#ffd27a' : '#f6deae'); g.addColorStop(1, night ? '#e8964a' : '#d9a86a');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (night) { const lg = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 1.4); lg.addColorStop(0, 'rgba(255,190,100,.28)'); lg.addColorStop(1, 'rgba(255,190,100,0)'); ctx.fillStyle = lg; ctx.fillRect(x - w, y - h, w * 3, h * 3); }
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.45, y); ctx.lineTo(x, y + h * 0.55); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = Math.max(1.2, S / 22); ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = Math.max(1, S / 36); ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
}
function shadowAt(ctx, x, groundY, w, S) {
  const g = ctx.createLinearGradient(0, groundY - S * 0.25, 0, groundY);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g; ctx.fillRect(x - S * 0.1, groundY - S * 0.25, w + S * 0.2, S * 0.25);
}
/* Marché : étal couvert, auvent bordeaux et crème, caisses de minerais, ardoise des cours */
export function drawMarket(ctx, x, groundY, S, night, t) {
  const w = S * 3.6, h = S * 1.85;
  ctx.save(); ctx.lineJoin = 'round';
  // fond de l'étal + poteaux
  boards(ctx, x + S * 0.1, groundY - h, w - S * 0.2, h, night ? '#4a3626' : '#8a6142', S * 0.26);
  timber(ctx, x, groundY - h - S * 0.1, S * 0.14, h + S * 0.1, true);
  timber(ctx, x + w - S * 0.14, groundY - h - S * 0.1, S * 0.14, h + S * 0.1, true);
  // comptoir
  timber(ctx, x - S * 0.12, groundY - S * 0.9, w + S * 0.24, S * 0.18, false);
  boards(ctx, x + S * 0.05, groundY - S * 0.72, w - S * 0.1, S * 0.72, night ? '#3a2a1d' : '#6e4b30', S * 0.24);
  // caisses de minerais qui brillent
  const gems = [['#2a2a2e', '#55555c'], ['#c8743c', '#f0a46a'], ['#c9d2dc', '#ffffff'], ['#f2c230', '#fff0a0'], ['#9b5de5', '#d8b4fe']];
  for (let i = 0; i < 4; i++) {
    const bx = x + S * 0.3 + i * S * 0.78, by = groundY - S * 1.28;
    timber(ctx, bx, by, S * 0.6, S * 0.36, false);
    for (let k = 0; k < 4; k++) {
      const [c, cl] = gems[(i + k) % gems.length], gx = bx + S * (0.1 + k * 0.13), gy = by - S * 0.02 - (k % 2) * S * 0.04;
      const gg = ctx.createRadialGradient(gx - S * 0.03, gy - S * 0.03, 0, gx, gy, S * 0.09); gg.addColorStop(0, cl); gg.addColorStop(1, c);
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, S * 0.085, 0, 7); ctx.fill();
    }
  }
  // ardoise des cours
  ctx.fillStyle = '#1d2621'; ctx.fillRect(x + w - S * 1.05, groundY - S * 0.66, S * 0.82, S * 0.52);
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = Math.max(1.5, S / 20); ctx.strokeRect(x + w - S * 1.05, groundY - S * 0.66, S * 0.82, S * 0.52);
  ctx.strokeStyle = '#86efac'; ctx.lineWidth = Math.max(1, S / 30); ctx.beginPath();
  for (let i = 0; i < 6; i++) ctx.lineTo(x + w - S * 0.98 + i * S * 0.13, groundY - S * 0.3 - Math.sin(i * 1.7 + 1 + t * 0.2) * S * 0.1);
  ctx.stroke();
  // auvent
  const n = 8, aw = (w + S * 0.5) / n, ay = groundY - h - S * 0.32;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x - S * 0.1, ay + S * 0.5, w + S * 0.2, S * 0.18);
  for (let i = 0; i < n; i++) {
    const x0 = x - S * 0.25 + i * aw, c = i % 2 ? (night ? '#b9ad98' : '#efe4cf') : night ? '#5a1f26' : '#8e2b33';
    const g = ctx.createLinearGradient(0, ay, 0, ay + S * 0.62); g.addColorStop(0, shade(c, 0.08)); g.addColorStop(1, shade(c, -0.15));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 + aw * 0.08, ay - S * 0.12); ctx.lineTo(x0 + aw * 1.08, ay - S * 0.12); ctx.lineTo(x0 + aw, ay + S * 0.5);
    ctx.quadraticCurveTo(x0 + aw / 2, ay + S * 0.7 + Math.sin(t * 1.4 + i) * 0.8, x0, ay + S * 0.5); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#5b3f25'; ctx.fillRect(x - S * 0.25, ay - S * 0.2, w + S * 0.5, S * 0.1);
  // lanterne
  drawLantern(ctx, x + w - S * 0.5, ay + S * 0.42, S * 0.9, t, true);
  plaque(ctx, x + w / 2, ay - S * 0.72, S, 'MARCHÉ');
  shadowAt(ctx, x, groundY, w, S);
  ctx.restore();
}
/* Boutique d'équipement : façade vert sapin, filets dorés, grande vitrine éclairée */
export function drawShop(ctx, x, groundY, S, night) {
  const w = S * 3.2, h = S * 2.55;
  ctx.save();
  boards(ctx, x, groundY - h, w, h, night ? '#1e3029' : '#2f4a3e', S * 0.28);
  // corniche et bandeau
  timber(ctx, x - S * 0.18, groundY - h - S * 0.22, w + S * 0.36, S * 0.24, false);
  ctx.fillStyle = night ? '#16231d' : '#243a31'; ctx.fillRect(x - S * 0.08, groundY - h - S * 0.02, w + S * 0.16, S * 0.12);
  ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, S / 40);
  ctx.strokeRect(x + S * 0.12, groundY - h + S * 0.18, w - S * 0.24, h - S * 0.18);
  // vitrine : pioches exposées
  const vx = x + S * 0.3, vy = groundY - S * 1.7, vw = S * 1.5, vh = S * 1.05;
  warmWindow(ctx, vx, vy, vw, vh, S, night);
  ctx.save(); ctx.translate(vx + vw * 0.33, vy + vh * 0.62); ctx.rotate(-0.7); drawPickIconAt(ctx, 0, 0, S * 0.62, '#cfd6dd'); ctx.restore();
  ctx.save(); ctx.translate(vx + vw * 0.7, vy + vh * 0.6); ctx.rotate(-0.4); drawPickIconAt(ctx, 0, 0, S * 0.5, '#f5c542'); ctx.restore();
  // porte vitrée
  const dx = x + w - S * 1.12, dh = S * 1.62;
  ctx.fillStyle = '#20150d'; ctx.fillRect(dx, groundY - dh, S * 0.78, dh);
  warmWindow(ctx, dx + S * 0.12, groundY - dh + S * 0.14, S * 0.54, S * 0.6, S, night);
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(dx + S * 0.66, groundY - S * 0.75, S * 0.05, 0, 7); ctx.fill();
  // marquise
  ctx.fillStyle = night ? '#3a1d21' : '#5e2a30'; ctx.beginPath(); ctx.moveTo(vx - S * 0.12, vy - S * 0.08); ctx.lineTo(vx + vw + S * 0.12, vy - S * 0.08); ctx.lineTo(vx + vw + S * 0.22, vy - S * 0.36); ctx.lineTo(vx - S * 0.22, vy - S * 0.36); ctx.closePath(); ctx.fill();
  plaque(ctx, x + w / 2, groundY - h - S * 0.78, S, 'BOUTIQUE');
  shadowAt(ctx, x, groundY, w, S);
  ctx.restore();
}
/* Atelier : garage en briques, grande porte cintrée, établi ; le vélo se dessine avec la progression */
export function drawWorkshop(ctx, x, groundY, S, night, progress, built) {
  const w = S * 3.6, h = S * 2.15;
  ctx.save();
  bricks(ctx, x, groundY - h, w, h, night ? '#6b3b2d' : '#9a5340', S);
  // toit à deux pans en zinc
  const rg = ctx.createLinearGradient(0, groundY - h - S * 0.85, 0, groundY - h);
  rg.addColorStop(0, night ? '#4b525e' : '#7b8590'); rg.addColorStop(1, night ? '#2c3139' : '#4c545e');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x - S * 0.22, groundY - h + S * 0.04); ctx.lineTo(x + w / 2, groundY - h - S * 0.82); ctx.lineTo(x + w + S * 0.22, groundY - h + S * 0.04); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
  for (let k = 1; k < 9; k++) { const px = x - S * 0.22 + ((w + S * 0.44) * k) / 9; ctx.beginPath(); ctx.moveTo(px, groundY - h + S * 0.04); ctx.lineTo(x + w / 2 + (px - x - w / 2) * 0.1, groundY - h - S * 0.7); ctx.stroke(); }
  // porte cintrée ouverte : intérieur chaud
  const dx = x + S * 0.38, dw = w - S * 0.76, dh = S * 1.62, top = groundY - dh;
  ctx.fillStyle = '#d9cbb3'; ctx.beginPath(); ctx.moveTo(dx - S * 0.08, groundY); ctx.lineTo(dx - S * 0.08, top + dw * 0.18); ctx.quadraticCurveTo(dx + dw / 2, top - dw * 0.14, dx + dw + S * 0.08, top + dw * 0.18); ctx.lineTo(dx + dw + S * 0.08, groundY); ctx.closePath(); ctx.fill();
  const ig = ctx.createLinearGradient(0, top, 0, groundY);
  ig.addColorStop(0, night ? '#3a2716' : '#2d2014'); ig.addColorStop(1, night ? '#6e4a26' : '#4e3620');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.moveTo(dx, groundY); ctx.lineTo(dx, top + dw * 0.18); ctx.quadraticCurveTo(dx + dw / 2, top - dw * 0.08, dx + dw, top + dw * 0.18); ctx.lineTo(dx + dw, groundY); ctx.closePath(); ctx.fill();
  // lampe d'atelier + outils au mur + établi
  const lg = ctx.createRadialGradient(dx + dw / 2, top + S * 0.35, 0, dx + dw / 2, top + S * 0.35, dw * 0.7);
  lg.addColorStop(0, 'rgba(255,205,130,.45)'); lg.addColorStop(1, 'rgba(255,205,130,0)'); ctx.fillStyle = lg; ctx.fillRect(dx, top, dw, dh);
  ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.ellipse(dx + dw / 2, top + S * 0.3, S * 0.12, S * 0.05, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(200,190,170,.5)'; ctx.lineWidth = Math.max(1, S / 30);
  for (let k = 0; k < 4; k++) { const tx = dx + S * 0.25 + k * S * 0.18; ctx.beginPath(); ctx.moveTo(tx, top + S * 0.45); ctx.lineTo(tx, top + S * 0.75); ctx.stroke(); }
  timber(ctx, dx + dw - S * 0.85, groundY - S * 0.5, S * 0.8, S * 0.1, false);
  // le vélo (contours qui se remplissent avec la progression vers l'objectif)
  const cx = dx + dw * 0.42, cy = groundY - S * 0.36, r = S * 0.3;
  ctx.globalAlpha = built ? 1 : 0.3 + 0.7 * progress;
  ctx.strokeStyle = built ? '#86efac' : '#efe6d6'; ctx.lineWidth = Math.max(1.5, S / 18); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx - S * 0.45, cy, r, 0, 7); ctx.moveTo(cx + S * 0.45 + r, cy); ctx.arc(cx + S * 0.45, cy, r, 0, 7); ctx.stroke();
  ctx.lineWidth = Math.max(1, S / 34);
  for (const wx of [cx - S * 0.45, cx + S * 0.45]) for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * r, cy - Math.sin(a) * r); ctx.lineTo(wx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  ctx.lineWidth = Math.max(1.5, S / 18);
  ctx.beginPath(); ctx.moveTo(cx - S * 0.45, cy); ctx.lineTo(cx - S * 0.08, cy - S * 0.38); ctx.lineTo(cx + S * 0.3, cy - S * 0.38); ctx.lineTo(cx + S * 0.45, cy);
  ctx.moveTo(cx - S * 0.08, cy - S * 0.38); ctx.lineTo(cx + S * 0.02, cy); ctx.lineTo(cx + S * 0.3, cy - S * 0.38);
  ctx.moveTo(cx + S * 0.3, cy - S * 0.38); ctx.lineTo(cx + S * 0.38, cy - S * 0.6); ctx.lineTo(cx + S * 0.5, cy - S * 0.62);
  ctx.moveTo(cx - S * 0.12, cy - S * 0.46); ctx.lineTo(cx - S * 0.0, cy - S * 0.46); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  plaque(ctx, x + w / 2, groundY - h - S * 1.38, S, 'ATELIER');
  shadowAt(ctx, x, groundY, w, S);
  ctx.restore();
}

/* icône de pioche (boutique, vitrine) */
export function drawPickIconAt(ctx, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(1.2, size / 18);
  ctx.fillStyle = '#9b6a3e'; ctx.beginPath(); ctx.roundRect(-size * 0.45, -size * 0.06, size * 0.9, size * 0.12, size * 0.06); ctx.fill(); ctx.stroke();
  const ig = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
  ig.addColorStop(0, shade(color, 0.55)); ig.addColorStop(0.5, color); ig.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.moveTo(size * 0.3, -size * 0.08); ctx.quadraticCurveTo(size * 0.42, -size * 0.32, size * 0.18, -size * 0.48); ctx.quadraticCurveTo(size * 0.55, -size * 0.3, size * 0.48, -size * 0.08);
  ctx.lineTo(size * 0.48, size * 0.08); ctx.quadraticCurveTo(size * 0.55, size * 0.3, size * 0.18, size * 0.48); ctx.quadraticCurveTo(size * 0.42, size * 0.32, size * 0.3, size * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(size * 0.36, -size * 0.22, size * 0.04, size * 0.1, -0.4, 0, 7); ctx.fill();
  ctx.restore();
}
