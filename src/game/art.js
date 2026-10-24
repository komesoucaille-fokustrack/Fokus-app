/* =====================================================================
   LA MINE — dessins (Canvas 2D, 100 % vectoriel, aucun fichier image)
   Style « cartoon peint » : contours sombres arrondis, volumes en dégradés, reflets, lumière chaude de la lampe.
   Personnage à la Rayman : mains et pieds flottants (pas de bras ni de jambes) → animations souples et lisibles.
   Les tuiles sont peintes une fois dans de petits canevas (plusieurs variantes), puis simplement recopiées.
   ===================================================================== */
const LINE = 'rgba(26,16,10,.92)';

/* générateur pseudo-aléatoire déterministe (mêmes textures à chaque ouverture) */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
}
function shade(hex, k) { // k > 0 éclaircit, k < 0 assombrit
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
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

/* ---------- tuiles ---------- */
function paintBase(ctx, S, cols, rnd, kind) {
  const [base, light, dark] = cols;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, shade(base, 0.08)); g.addColorStop(1, shade(base, -0.12));
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // taches de matière
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = rnd() < 0.5 ? shade(dark, 0.1) + '' : shade(light, -0.05);
    ctx.globalAlpha = 0.18 + rnd() * 0.18;
    blob(ctx, rnd() * S, rnd() * S, S * (0.12 + rnd() * 0.16), rnd); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (kind === 'dirt') { // petits cailloux
    for (let i = 0; i < 5; i++) {
      const x = rnd() * S, y = rnd() * S, r = S * (0.04 + rnd() * 0.05);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1.5, r, r * 0.75, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shade('#b48a68', rnd() * 0.3 - 0.15); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, 0, 0, 7); ctx.fill();
    }
  } else { // fissures et facettes de la roche
    ctx.strokeStyle = shade(dark, -0.2); ctx.lineWidth = Math.max(1, S / 40); ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); let x = rnd() * S, y = rnd() * S; ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (rnd() - 0.5) * S * 0.45; y += (rnd() - 0.5) * S * 0.45; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { blob(ctx, rnd() * S, rnd() * S, S * 0.08, rnd, 5, 0.5); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
/* minerais : pépites rondes (métaux, charbon) ou cristaux pointus (quartz, améthyste, géode) */
function paintOre(ctx, S, ore, rnd) {
  const [c, cl, cd] = ore.colors;
  const crystal = ['quartz', 'amethyste', 'geode'].includes(ore.id);
  const n = crystal ? 3 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const x = S * (0.18 + rnd() * 0.64), y = S * (0.2 + rnd() * 0.6), r = S * (crystal ? 0.13 + rnd() * 0.07 : 0.09 + rnd() * 0.07);
    ctx.save(); ctx.translate(x, y);
    // ombre portée dans la roche
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.25, r * 1.05, r * 0.9, 0, 0, 7); ctx.fill();
    if (crystal) {
      ctx.rotate((rnd() - 0.5) * 0.9);
      const h = r * 2.1, w = r * 0.9;
      // face gauche / face droite / pointe
      ctx.beginPath(); ctx.moveTo(-w, h * 0.35); ctx.lineTo(-w, -h * 0.15); ctx.lineTo(0, -h * 0.6); ctx.lineTo(0, h * 0.45); ctx.closePath();
      ctx.fillStyle = cl; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, h * 0.45); ctx.lineTo(0, -h * 0.6); ctx.lineTo(w, -h * 0.15); ctx.lineTo(w, h * 0.35); ctx.closePath();
      ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w, h * 0.35); ctx.lineTo(-w, -h * 0.15); ctx.lineTo(0, -h * 0.6); ctx.lineTo(w, -h * 0.15); ctx.lineTo(w, h * 0.35); ctx.lineTo(0, h * 0.45); ctx.closePath();
      ctx.strokeStyle = cd; ctx.lineWidth = Math.max(1, S / 36); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(-w * 0.6, -h * 0.05); ctx.lineTo(-w * 0.2, -h * 0.35); ctx.lineTo(-w * 0.2, 0); ctx.closePath(); ctx.fill();
    } else {
      const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
      gr.addColorStop(0, cl); gr.addColorStop(0.55, c); gr.addColorStop(1, cd);
      blob(ctx, 0, 0, r, rnd, 6, 0.35); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = shade(cd, -0.35); ctx.lineWidth = Math.max(1, S / 40); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
/* fond des galeries creusées : paroi chaude et sombre */
function paintCave(ctx, S, rnd) {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#3a271b'); g.addColorStop(1, '#2a1c13');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = 0.16; ctx.fillStyle = rnd() < 0.5 ? '#4a3324' : '#1c120c';
    blob(ctx, rnd() * S, rnd() * S, S * (0.1 + rnd() * 0.18), rnd); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* Prépare toutes les textures d'un monde : { cave: [], [type]: [3 variantes] } */
export function makeTiles(W, S) {
  const out = { S, cave: [], t: {} };
  const mk = (fn, seed) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'); fn(ctx, rng(seed)); return c;
  };
  for (let v = 0; v < 3; v++) {
    out.cave.push(mk((ctx, r) => paintCave(ctx, S, r), 900 + v));
    out.t[1] = out.t[1] || []; out.t[1].push(mk((ctx, r) => paintBase(ctx, S, W.tiles[1].colors, r, 'dirt'), 100 + v));
    out.t[2] = out.t[2] || []; out.t[2].push(mk((ctx, r) => paintBase(ctx, S, W.tiles[2].colors, r, 'rock'), 200 + v));
    W.ores.forEach((o, i) => {
      out.t[3 + i] = out.t[3 + i] || [];
      out.t[3 + i].push(mk((ctx, r) => { paintBase(ctx, S, W.tiles[2].colors, r, 'rock'); paintOre(ctx, S, o, r); }, 300 + i * 10 + v));
    });
  }
  return out;
}

/* étai en bois (galeries horizontales) */
export function drawBeam(ctx, x, y, S) {
  const w = S * 0.14;
  const wood = (x0, y0, ww, hh) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + ww, 0);
    g.addColorStop(0, '#8a5a32'); g.addColorStop(0.5, '#a97443'); g.addColorStop(1, '#6b4325');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, ww, hh);
    ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(1, S / 30); ctx.strokeRect(x0, y0, ww, hh);
  };
  wood(x + S * 0.05, y + S * 0.12, w, S * 0.88);
  wood(x + S * 0.81, y + S * 0.12, w, S * 0.88);
  wood(x, y, S, S * 0.16);
}
/* échelle (puits verticaux) */
export function drawLadder(ctx, x, y, S) {
  ctx.strokeStyle = '#a97443'; ctx.lineWidth = S * 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + S * 0.28, y); ctx.lineTo(x + S * 0.28, y + S); ctx.moveTo(x + S * 0.72, y); ctx.lineTo(x + S * 0.72, y + S);
  for (let k = 0.2; k < 1; k += 0.3) { ctx.moveTo(x + S * 0.28, y + S * k); ctx.lineTo(x + S * 0.72, y + S * k); }
  ctx.stroke(); ctx.lineCap = 'butt';
}
/* lanterne suspendue */
export function drawLamp(ctx, x, y, S, t) {
  const cx = x + S / 2, sway = Math.sin(t * 1.3 + x) * S * 0.03;
  ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, S / 30);
  ctx.beginPath(); ctx.moveTo(cx, y + S * 0.12); ctx.lineTo(cx + sway, y + S * 0.34); ctx.stroke();
  const g = ctx.createRadialGradient(cx + sway, y + S * 0.45, 1, cx + sway, y + S * 0.45, S * 0.5);
  g.addColorStop(0, 'rgba(255,214,120,.55)'); g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - S * 0.6, y, S * 1.2, S);
  ctx.fillStyle = '#ffe9a8'; ctx.strokeStyle = LINE;
  ctx.beginPath(); ctx.roundRect(cx + sway - S * 0.09, y + S * 0.34, S * 0.18, S * 0.22, S * 0.04); ctx.fill(); ctx.stroke();
}

/* ---------- personnage ---------- */
const HERO = {
  f: { suit: '#ff7a45', suitD: '#c4471c', hair: '#5a3220', skin: '#f6cfae' },
  m: { suit: '#3f7fe0', suitD: '#1f4a99', hair: '#3b2416', skin: '#f2c49c' },
};
/* drawMiner(ctx, x, y = sol, s = taille d'une tuile, { gender, face: 1 | -1, anim, t, dig: 'side' | 'down', prog }) */
export function drawMiner(ctx, x, y, s, o) {
  const P = HERO[o.gender] || HERO.f, t = o.t, f = o.face || 1;
  const lw = Math.max(1.4, s / 22);
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  const k = s / 40; // tout est dessiné pour une tuile de 40 px
  ctx.scale(k, k);
  ctx.lineWidth = lw / k; ctx.lineJoin = 'round'; ctx.strokeStyle = LINE;
  const anim = o.anim;
  const breathe = Math.sin(t * 2.2) * 0.8;
  const walk = anim === 'walk' || anim === 'climb' ? t * 9 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.sin(walk)) * -2.2 : anim === 'sleep' ? 2 : breathe * 0.6;
  // coup de pioche : élan lent puis frappe rapide
  const ph = anim === 'dig' ? (t * 1.6) % 1 : 0;
  const swing = anim === 'dig' ? (ph < 0.7 ? -1.25 * (ph / 0.7) : -1.25 + 2.1 * ((ph - 0.7) / 0.3)) : 0;
  const lean = anim === 'dig' ? swing * 1.5 : 0;

  // ombre
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, -1, 13, 3.2, 0, 0, 7); ctx.fill();
  // pieds (bottes)
  const foot = (dx, ph2) => {
    const lift = anim === 'walk' ? Math.max(0, Math.sin(walk + ph2)) * 4 : 0, fwd = anim === 'walk' ? Math.cos(walk + ph2) * 3.5 : 0;
    ctx.save(); ctx.translate(dx + fwd, -3.2 - lift);
    const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#6b4a34'); g.addColorStop(1, '#3a2619');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(1.5, 0, 6.2, 3.8, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-0.5, -1.5, 2.6, 1.1, -0.2, 0, 7); ctx.fill();
    ctx.restore();
  };
  if (anim === 'sleep') { foot(-6, 0); foot(7, 0); } else { foot(-6, 0); foot(6, Math.PI); }

  ctx.save(); ctx.translate(0, bob);
  if (anim === 'sleep') ctx.rotate(-0.12);
  ctx.rotate(lean * 0.05);
  // corps (salopette)
  const by = -17;
  const g = ctx.createLinearGradient(-9, by - 10, 9, by + 10);
  g.addColorStop(0, shade(P.suit, 0.18)); g.addColorStop(1, P.suitD);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, by, 9.5, 11 + breathe * 0.15, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-3.5, by - 5, 3, 5, -0.3, 0, 7); ctx.fill();
  // bretelles + poche
  ctx.strokeStyle = shade(P.suitD, -0.25); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-5, by - 9); ctx.lineTo(-4, by - 2); ctx.moveTo(5, by - 9); ctx.lineTo(4, by - 2); ctx.stroke();
  ctx.fillStyle = shade(P.suit, -0.08); ctx.strokeStyle = LINE; ctx.lineWidth = lw / k;
  ctx.beginPath(); ctx.roundRect(-4, by - 2, 8, 6, 2); ctx.fill(); ctx.stroke();

  // tête
  const hx = 1, hy = -37;
  // cheveux derrière (couette de la mineuse)
  if (o.gender === 'f') {
    const sw = Math.sin(t * 3 + (anim === 'walk' ? walk : 0)) * 2.5;
    ctx.fillStyle = P.hair;
    ctx.beginPath(); ctx.moveTo(hx - 9, hy - 2); ctx.quadraticCurveTo(hx - 21 + sw, hy + 1, hx - 17 + sw, hy + 11); ctx.quadraticCurveTo(hx - 13, hy + 5, hx - 7, hy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const sg = ctx.createRadialGradient(hx - 4, hy - 4, 2, hx, hy, 14);
  sg.addColorStop(0, shade(P.skin, 0.12)); sg.addColorStop(1, shade(P.skin, -0.12));
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(hx, hy, 12, 11.5, 0, 0, 7); ctx.fill(); ctx.stroke();
  // joues
  ctx.fillStyle = 'rgba(255,120,110,.35)'; ctx.beginPath(); ctx.ellipse(hx + 7, hy + 4, 3, 2, 0, 0, 7); ctx.fill();
  // yeux
  if (anim === 'sleep') {
    ctx.beginPath(); ctx.moveTo(hx + 2, hy + 1); ctx.quadraticCurveTo(hx + 4.5, hy + 3, hx + 7, hy + 1); ctx.moveTo(hx + 8, hy + 1); ctx.quadraticCurveTo(hx + 10, hy + 3, hx + 11.5, hy + 1); ctx.stroke();
  } else {
    const blink = (t % 4.2) > 4.05;
    const look = anim === 'dig' && o.dig === 'down' ? 1.6 : 0;
    for (const ex of [4.6, 9.6]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hx + ex, hy, 2.6, blink ? 0.4 : 3.6, 0, 0, 7); ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
      if (!blink) {
        ctx.fillStyle = '#1b1b24'; ctx.beginPath(); ctx.ellipse(hx + ex + 0.9, hy + 0.6 + look, 1.4, 1.9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + ex + 1.4, hy - 0.4 + look, 0.6, 0, 7); ctx.fill();
      }
    }
    ctx.lineWidth = lw / k;
  }
  // nez + sourire
  ctx.fillStyle = shade(P.skin, -0.15); ctx.beginPath(); ctx.ellipse(hx + 11.5, hy + 3, 2.2, 1.7, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.lineWidth = 1.2; ctx.moveTo(hx + 5, hy + 6.5); ctx.quadraticCurveTo(hx + 8, hy + 8.6, hx + 10.5, hy + 6.3); ctx.stroke();
  ctx.lineWidth = lw / k;
  // mèches (mineur) / frange (mineuse)
  ctx.fillStyle = P.hair;
  ctx.beginPath(); ctx.moveTo(hx - 11, hy - 3); ctx.quadraticCurveTo(hx - 4, hy - 1, hx + 2, hy - 5); ctx.quadraticCurveTo(hx + 7, hy - 2, hx + 12, hy - 5);
  ctx.lineTo(hx + 12, hy - 8); ctx.lineTo(hx - 11, hy - 8); ctx.closePath(); ctx.fill();
  // casque jaune + lampe frontale
  const hg = ctx.createLinearGradient(0, hy - 20, 0, hy - 4);
  hg.addColorStop(0, '#ffe066'); hg.addColorStop(1, '#e0a800');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(hx - 13, hy - 6); ctx.quadraticCurveTo(hx - 12, hy - 22, hx + 1, hy - 21); ctx.quadraticCurveTo(hx + 13, hy - 21, hx + 13, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(hx - 15, hy - 8, 31, 4.2, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(hx - 5, hy - 16, 4, 2.2, -0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9d9d9'; ctx.beginPath(); ctx.ellipse(hx + 12, hy - 12, 3.4, 3.6, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.ellipse(hx + 13, hy - 12, 2, 2.3, 0, 0, 7); ctx.fill();
  ctx.restore();

  // mains flottantes (gants) + pioche
  const hand = (x0, y0) => {
    const gg = ctx.createRadialGradient(x0 - 1, y0 - 1.5, 0.5, x0, y0, 5);
    gg.addColorStop(0, '#fffaf0'); gg.addColorStop(1, '#d8cbb4');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(x0, y0, 4.4, 4, 0, 0, 7); ctx.fill(); ctx.stroke();
  };
  if (anim === 'dig' || anim === 'idle' || anim === 'walk' || anim === 'climb') {
    // pioche tenue à deux mains, pivot à l'épaule
    const piv = o.dig === 'down' && anim === 'dig' ? [6, -24] : [8, -22];
    const base = anim === 'dig' ? (o.dig === 'down' ? 0.5 : 0) : anim === 'walk' ? -0.9 + Math.sin(walk) * 0.08 : -0.7 + breathe * 0.02;
    const a = base + (anim === 'dig' ? swing * (o.dig === 'down' ? 0.9 : 1) : 0);
    ctx.save(); ctx.translate(piv[0], piv[1] + bob); ctx.rotate(a);
    // manche
    const L = 22;
    ctx.fillStyle = '#9b6a3e'; ctx.beginPath(); ctx.roundRect(0, -1.6, L, 3.2, 1.6); ctx.fill(); ctx.stroke();
    // fer de la pioche
    ctx.save(); ctx.translate(L, 0);
    const ig = ctx.createLinearGradient(0, -12, 0, 12); ig.addColorStop(0, '#e9eef3'); ig.addColorStop(0.5, '#9aa4ae'); ig.addColorStop(1, '#5e666f');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.moveTo(-1, -2.5); ctx.quadraticCurveTo(2, -10, -4, -14); ctx.quadraticCurveTo(6, -9, 4, -2.5);
    ctx.lineTo(4, 2.5); ctx.quadraticCurveTo(6, 9, -4, 14); ctx.quadraticCurveTo(2, 10, -1, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    hand(7, 0); hand(14, 0);
    ctx.restore();
  } else if (anim === 'sleep') {
    hand(-9, -13); hand(10, -12);
  }
  ctx.restore();
  // « Z z z » quand il dort
  if (anim === 'sleep') {
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `700 ${Math.round(s * 0.32)}px Inter Variable, sans-serif`;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.fillText('z', x + s * 0.25 + p * s * 0.5, y - s * 1.1 - p * s * 0.8);
    }
    ctx.restore();
  }
}

/* ---------- surface (vue de la ville, chevalement, base) ---------- */
export function skyColors(h) {
  if (h < 6 || h >= 21) return ['#0b1530', '#1d2c55', true];
  if (h < 8) return ['#f6a37a', '#ffd9a8', false];
  if (h >= 18) return ['#5a4a8a', '#f59e8b', false];
  return ['#64b5f0', '#c4e8ff', false];
}
/* fond de ciel + collines + ville (dessiné une fois par taille d'écran dans un canevas mis en cache) */
export function paintSkyline(ctx, w, h, hour, seed = 7) {
  const [top, bottom, night] = skyColors(hour), rnd = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.3 + rnd() * 0.7; ctx.fillRect(rnd() * w, rnd() * h * 0.7, 1.4, 1.4); } ctx.globalAlpha = 1; }
  // soleil / lune
  const sx = w * 0.78, sy = h * 0.28, sr = Math.min(w, h) * 0.07;
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3);
  sg.addColorStop(0, night ? 'rgba(240,240,255,.5)' : 'rgba(255,240,180,.7)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
  ctx.fillStyle = night ? '#eef0ff' : '#fff3c4'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
  // nuages
  if (!night) for (let i = 0; i < 4; i++) {
    const cx = rnd() * w, cy = h * (0.12 + rnd() * 0.25), r = h * (0.05 + rnd() * 0.04);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(cx + j * r * 0.9, cy + (j % 2) * r * 0.2, r * (1 - Math.abs(j - 1.5) * 0.2), r * 0.7, 0, 0, 7); ctx.fill(); }
  }
  // collines lointaines
  const hill = (col, base, amp, n) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 40) ctx.lineTo(x, h * base - Math.sin(x / w * n + seed) * h * amp - Math.sin(x / w * n * 2.3) * h * amp * 0.4);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  hill(night ? '#1a2747' : '#9cc7a9', 0.62, 0.06, 5);
  hill(night ? '#15203b' : '#6fa983', 0.74, 0.05, 7);
  // ville : maisons, toits, clocher, fenêtres
  const ground = h * 0.86;
  let x = w * 0.18;
  while (x < w * 0.98) {
    const bw = w * (0.035 + rnd() * 0.04), bh = h * (0.12 + rnd() * 0.16);
    const col = night ? '#1b2240' : ['#e9d8c4', '#f2e3cf', '#dcc6ae', '#e7cfb8'][Math.floor(rnd() * 4)];
    ctx.fillStyle = col; ctx.strokeStyle = night ? '#0c1022' : 'rgba(60,40,30,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(x, ground - bh, bw, bh); ctx.fill(); ctx.stroke();
    ctx.fillStyle = night ? '#2a1f3a' : ['#b5523b', '#a9472f', '#8f3b2a'][Math.floor(rnd() * 3)];
    ctx.beginPath(); ctx.moveTo(x - bw * 0.08, ground - bh); ctx.lineTo(x + bw / 2, ground - bh - bw * 0.45); ctx.lineTo(x + bw * 1.08, ground - bh); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let wy = ground - bh + bh * 0.2; wy < ground - h * 0.03; wy += bh * 0.28) {
      for (let wx = x + bw * 0.2; wx < x + bw * 0.8; wx += bw * 0.35) {
        ctx.fillStyle = night ? (rnd() < 0.6 ? '#ffd879' : '#2b3150') : '#7aa6c9';
        ctx.fillRect(wx, wy, bw * 0.16, bh * 0.12);
      }
    }
    if (rnd() < 0.12) { // clocher
      ctx.fillStyle = night ? '#1b2240' : '#d9c7b0';
      ctx.fillRect(x + bw * 1.05, ground - bh * 1.9, bw * 0.4, bh * 1.9);
      ctx.beginPath(); ctx.moveTo(x + bw * 1.0, ground - bh * 1.9); ctx.lineTo(x + bw * 1.25, ground - bh * 2.5); ctx.lineTo(x + bw * 1.5, ground - bh * 1.9); ctx.closePath();
      ctx.fillStyle = night ? '#2a1f3a' : '#6d7c8a'; ctx.fill();
      x += bw * 0.5;
    }
    x += bw * (1.02 + rnd() * 0.25);
  }
}

/* chevalement (tour métallique au-dessus du puits, emblème des mines françaises) */
export function drawHeadframe(ctx, cx, groundY, S, t, night) {
  const H = S * 4.2, W2 = S * 1.1;
  ctx.save(); ctx.strokeStyle = night ? '#4d5568' : '#3b3f47'; ctx.lineWidth = S * 0.09; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - W2, groundY); ctx.lineTo(cx - W2 * 0.35, groundY - H);
  ctx.moveTo(cx + W2, groundY); ctx.lineTo(cx + W2 * 0.35, groundY - H);
  for (let k = 1; k < 5; k++) {
    const y1 = groundY - (H * k) / 5, y0 = groundY - (H * (k - 1)) / 5, l = (y) => W2 - (W2 * 0.65 * (groundY - y)) / H;
    ctx.moveTo(cx - l(y0), y0); ctx.lineTo(cx + l(y1), y1); ctx.moveTo(cx + l(y0), y0); ctx.lineTo(cx - l(y1), y1);
    ctx.moveTo(cx - l(y1), y1); ctx.lineTo(cx + l(y1), y1);
  }
  ctx.stroke();
  // jambe de force
  ctx.beginPath(); ctx.moveTo(cx + W2 * 0.35, groundY - H * 0.95); ctx.lineTo(cx + W2 * 2.6, groundY); ctx.stroke();
  // molette (roue) qui tourne
  const wy = groundY - H - S * 0.15, r = S * 0.7;
  ctx.lineWidth = S * 0.08; ctx.strokeStyle = night ? '#8a93a8' : '#23262c';
  ctx.beginPath(); ctx.arc(cx, wy, r, 0, 7); ctx.stroke();
  ctx.lineWidth = S * 0.05;
  for (let i = 0; i < 6; i++) { const a = t * 0.6 + (i * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(cx, wy); ctx.lineTo(cx + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.stroke(); }
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(cx, wy, S * 0.12, 0, 7); ctx.fill();
  ctx.restore();
}
/* cabane de la base (vente des minerais) */
export function drawBase(ctx, x, groundY, S, night) {
  const w = S * 3.4, h = S * 2.2;
  ctx.save(); ctx.lineWidth = Math.max(1.5, S / 20); ctx.strokeStyle = LINE;
  const g = ctx.createLinearGradient(x, groundY - h, x, groundY);
  g.addColorStop(0, night ? '#6d4a32' : '#b97b47'); g.addColorStop(1, night ? '#4a3020' : '#8a5530');
  ctx.fillStyle = g; ctx.fillRect(x, groundY - h, w, h); ctx.strokeRect(x, groundY - h, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  for (let yy = groundY - h + S * 0.35; yy < groundY; yy += S * 0.35) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  ctx.lineWidth = Math.max(1.5, S / 20); ctx.strokeStyle = LINE;
  ctx.fillStyle = night ? '#5a2a2a' : '#c0392b';
  ctx.beginPath(); ctx.moveTo(x - S * 0.3, groundY - h); ctx.lineTo(x + w / 2, groundY - h - S * 1.1); ctx.lineTo(x + w + S * 0.3, groundY - h); ctx.closePath(); ctx.fill(); ctx.stroke();
  // porte + fenêtre éclairée
  ctx.fillStyle = '#4a2c18'; ctx.fillRect(x + w * 0.62, groundY - S * 1.4, S * 0.8, S * 1.4); ctx.strokeRect(x + w * 0.62, groundY - S * 1.4, S * 0.8, S * 1.4);
  ctx.fillStyle = night ? '#ffd879' : '#9fd0f0'; ctx.fillRect(x + w * 0.14, groundY - S * 1.55, S * 0.9, S * 0.7); ctx.strokeRect(x + w * 0.14, groundY - S * 1.55, S * 0.9, S * 0.7);
  // enseigne
  ctx.fillStyle = '#f5e6c8'; ctx.beginPath(); ctx.roundRect(x + w * 0.12, groundY - h - S * 0.55, w * 0.76, S * 0.5, S * 0.1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a3a20'; ctx.font = `800 ${Math.round(S * 0.32)}px Inter Variable, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BASE · MARCHÉ', x + w / 2, groundY - h - S * 0.3);
  ctx.restore();
}

/* pièce Fokoin (anneau du logo Fokus frappé sur une pièce d'or) — SVG pour l'interface */
export const COIN_SVG = (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="fkg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#b8860b"/></radialGradient><linearGradient id="fkr" x1="0" x2="1"><stop offset="0" stop-color="#059669"/><stop offset=".5" stop-color="#10b981"/><stop offset="1" stop-color="#86efac"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#fkg)" stroke="#8a6508" stroke-width="1.4"/><circle cx="16" cy="16" r="11.5" fill="none" stroke="#c99a1c" stroke-width="1"/><circle cx="16" cy="16" r="6.6" fill="none" stroke="url(#fkr)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="33 9" transform="rotate(-90 16 16)"/></svg>`;
