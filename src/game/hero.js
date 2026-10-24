/* =====================================================================
   LA MINE — le personnage (Canvas 2D vectoriel, style dessin animé)
   Personnage complet : bottes, jambes, salopette (bavette, bretelles, poche brodée de l'anneau Fokus), chemise,
   bras qui tiennent vraiment la pioche, gants de cuir, foulard noué, sac à dos qui grossit avec le butin,
   casque jaune à lampe (pastille Fokus). Contours épais OUT, aplats + une ombre et un reflet.
   Tout est dessiné pour une case de 40 unités, origine aux pieds, regard vers la droite (face = -1 : miroir).
   ===================================================================== */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (h, k) => { const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)); const [r, g, b] = hex(h); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const OUT = '#2b1a16';

/* tenues : salopette, chemise, foulard, cheveux, peau, yeux */
const HERO = {
  f: { suit: '#16a37a', shirt: '#f6dcb0', scarf: '#ff7a3d', hair: '#6b3420', skin: '#ffd5b8', iris: '#3a2416', freckles: true },
  m: { suit: '#3767d6', shirt: '#f2d28a', scarf: '#e5484d', hair: '#3a2214', skin: '#f3c39c', iris: '#2b1a12' },
};
const GLOVE = '#c0843f', BOOT = '#6a4228', HELM = '#ffc928', BRASS = '#d9a441', PACK = '#a8703c';

/* drawMiner(ctx, x, y = sol, s = taille d'une case, { gender, face: 1 | -1, anim: idle|walk|climb|dig|sleep, t,
   dig: 'side' | 'down', tool (false = sans pioche), helmet (false = cheveux), wave, reach, pickColor, bag (0 → 1), lamp }) */
export function drawMiner(ctx, x, y, s, o) {
  const P = HERO[o.gender] || HERO.f, t = o.t || 0, f = o.face || 1, anim = o.anim || 'idle', home = o.helmet === false;
  const k = s / 40;
  ctx.save(); ctx.translate(x, y); ctx.scale(f * k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const W = 2; // épaisseur du contour (unités)
  const fillOut = (fill, w = W) => { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = w; ctx.stroke(); };
  const tube = (x1, y1, x2, y2, w, col) => { // membre : contour puis couleur
    ctx.strokeStyle = OUT; ctx.lineWidth = w + W * 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const breathe = Math.sin(t * 2.2);
  const walk = anim === 'walk' || anim === 'climb' ? t * 9 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.sin(walk)) * -1.6 : anim === 'sleep' ? 1.5 : breathe * 0.45;
  // coup de pioche : élan lent puis frappe rapide
  const ph = anim === 'dig' ? (t * 1.6) % 1 : 0;
  const swing = anim === 'dig' ? (ph < 0.7 ? -1.25 * (ph / 0.7) : -1.25 + 2.1 * ((ph - 0.7) / 0.3)) : 0;

  // ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, -0.6, 12, 2.6, 0, 0, 7); ctx.fill();

  // jambes + bottes
  const feet = [];
  for (const [dx, p2] of [[-4.3, 0], [4.3, Math.PI]]) {
    const lift = anim === 'walk' ? Math.max(0, Math.sin(walk + p2)) * 3.6 : anim === 'climb' ? Math.max(0, Math.sin(walk + p2)) * 4.5 : 0;
    const fwd = anim === 'walk' ? Math.cos(walk + p2) * 3.4 : 0;
    feet.push([dx + fwd, -3.2 - lift]);
  }
  const hipY = -13 + bob;
  for (const [fx, fy] of feet) tube(fx * 0.55, hipY, fx, fy - 2, 5.6, shade(P.suit, -0.22));
  for (const [fx, fy] of feet) {
    ctx.save(); ctx.translate(fx, fy);
    ctx.beginPath(); ctx.moveTo(-4, 2.8); ctx.quadraticCurveTo(-4.6, -3, 0.5, -3.2); ctx.quadraticCurveTo(6.4, -2.6, 6.6, 1.4); ctx.quadraticCurveTo(6.4, 3, 3.6, 3); ctx.closePath();
    fillOut(BOOT);
    ctx.fillStyle = shade(BOOT, 0.3); ctx.beginPath(); ctx.ellipse(3.4, -0.6, 2.4, 1.6, 0, 0, 7); ctx.fill(); // bout renforcé
    ctx.fillStyle = '#3a2416'; ctx.fillRect(-3.8, 1.6, 10, 1.4); // semelle
    ctx.restore();
  }

  ctx.save(); ctx.translate(0, bob);
  const sh = -24.5; // hauteur des épaules
  // sac à dos (derrière)
  if (!home) {
    const bag = Math.max(0, Math.min(1, o.bag || 0)), bw = 7 + bag * 3.5, bh = 12 + bag * 4;
    ctx.beginPath(); ctx.roundRect(-8.5 - bw, -25, bw + 3, bh, 3.4); fillOut(PACK);
    ctx.beginPath(); ctx.roundRect(-8.8 - bw, -25.6, bw + 3.4, bh * 0.36, 3); fillOut(shade(PACK, -0.18));
    ctx.fillStyle = BRASS; ctx.beginPath(); ctx.arc(-7.2 - bw / 2, -25.6 + bh * 0.36, 1.2, 0, 7); ctx.fill();
    if (bag > 0.5) for (const [gx, c] of [[-bw * 0.7 - 7, '#f5c542'], [-bw * 0.35 - 7, '#b06df5']]) { ctx.beginPath(); ctx.moveTo(gx, -25.6); ctx.lineTo(gx + 1.5, -29.2); ctx.lineTo(gx + 3, -25.6); ctx.closePath(); fillOut(c, 1.2); }
  }

  // positions des mains selon l'action (+ pioche)
  let hands, pick = null;
  if (o.tool === false || anim === 'sleep') {
    const sw = anim === 'walk' ? Math.sin(walk) * 3.4 : breathe * 0.4;
    if (o.wave) { const wv = Math.sin(t * 6) * 3; hands = [[-10, -15 + sw], [12 + wv * 0.3, -40 + wv]]; }
    else if (o.reach) hands = [[-9, -15], [15, -21 + Math.sin(t * 2) * 1.2]];
    else if (anim === 'climb') { const c = Math.sin(walk); hands = [[-6, -34 + c * 3.5], [7, -34 - c * 3.5]]; }
    else if (anim === 'sleep') hands = [[-7, -13], [8, -13]];
    else hands = [[-10, -13.5 + sw], [10.5, -13.5 - sw]];
  } else if (anim === 'climb') {
    const c = Math.sin(walk); hands = [[-6, -34 + c * 3.5], [7, -34 - c * 3.5]];
  } else {
    const piv = o.dig === 'down' && anim === 'dig' ? [5, -23] : [6, -21];
    const base = anim === 'dig' ? (o.dig === 'down' ? 0.5 : 0) : anim === 'walk' ? -0.95 + Math.sin(walk) * 0.06 : -0.75 + breathe * 0.02;
    const a = base + (anim === 'dig' ? swing * (o.dig === 'down' ? 0.9 : 1) : 0);
    pick = { px: piv[0], py: piv[1], a };
    hands = [[piv[0] + Math.cos(a) * 5, piv[1] + Math.sin(a) * 5], [piv[0] + Math.cos(a) * 12, piv[1] + Math.sin(a) * 12]];
  }
  // bras arrière (derrière le corps)
  tube(-4.5, sh + 1.5, hands[0][0], hands[0][1], 4.2, shade(P.shirt, -0.12));

  // corps : chemise, salopette, ceinture
  ctx.beginPath(); ctx.roundRect(-8.4, sh - 1.5, 16.8, 15.5, [6, 6, 5, 5]); fillOut(P.shirt);
  ctx.beginPath(); ctx.moveTo(-8.4, -16); ctx.lineTo(-5.6, -16); ctx.lineTo(-5.6, sh + 2.5); ctx.lineTo(5.6, sh + 2.5); ctx.lineTo(5.6, -16); ctx.lineTo(8.4, -16);
  ctx.lineTo(8.4, -12); ctx.quadraticCurveTo(8.4, -9, 5, -9); ctx.lineTo(-5, -9); ctx.quadraticCurveTo(-8.4, -9, -8.4, -12); ctx.closePath(); fillOut(P.suit);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-5, sh + 3.2, 3, 7);
  // bretelles + boutons
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-4.6, sh + 2.6); ctx.lineTo(-3.4, sh - 1.4); ctx.moveTo(4.6, sh + 2.6); ctx.lineTo(3.4, sh - 1.4); ctx.stroke();
  ctx.strokeStyle = P.suit; ctx.lineWidth = 1.4; ctx.stroke();
  for (const bx of [-4, 4]) { ctx.beginPath(); ctx.arc(bx, sh + 3.4, 1.1, 0, 7); fillOut(BRASS, 0.8); }
  // poche avec l'anneau Fokus brodé
  ctx.beginPath(); ctx.roundRect(-3.2, sh + 5.2, 6.4, 5, 1.4); fillOut(shade(P.suit, -0.12), 1.2);
  ctx.strokeStyle = '#86efac'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, sh + 7.7, 1.5, -1.3, 4.3); ctx.stroke();
  // ceinture + boucle + sacoche à outils
  ctx.beginPath(); ctx.rect(-8.5, -15.6, 17, 2.4); fillOut('#5a3820', 1.4);
  ctx.beginPath(); ctx.roundRect(-1.4, -16.1, 3.2, 3.4, 0.8); fillOut(BRASS, 1);
  ctx.beginPath(); ctx.roundRect(5.4, -14.5, 4, 4.6, 1); fillOut('#8a5a32', 1.2);

  // foulard noué
  ctx.beginPath(); ctx.ellipse(0.6, sh - 0.6, 7.4, 2.6, 0, 0, 7); fillOut(P.scarf, 1.6);
  const fl = Math.sin(t * 5) * (anim === 'walk' ? 1.6 : 0.6);
  ctx.beginPath(); ctx.moveTo(-5, sh - 0.4); ctx.quadraticCurveTo(-9, sh + 1 + fl, -11.5, sh + 3.5 + fl); ctx.lineTo(-8.5, sh + 4.4 + fl); ctx.quadraticCurveTo(-7, sh + 1.6, -4, sh + 0.8); ctx.closePath(); fillOut(P.scarf, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(2.4, sh - 1.4, 3.4, 0.8, 0, 0, 7); ctx.fill();

  // tête
  ctx.save(); if (anim === 'sleep') { ctx.translate(1, -26); ctx.rotate(0.18); ctx.translate(-1, 26); }
  const hx = 1, hy = -36.5;
  if (o.gender === 'f') { // queue de cheval qui se balance
    const sw = Math.sin(t * 3 + (anim === 'walk' ? walk : 0)) * 2;
    ctx.beginPath(); ctx.moveTo(hx - 9, hy - 5); ctx.quadraticCurveTo(hx - 20 + sw, hy - 4, hx - 18 + sw * 1.3, hy + 8); ctx.quadraticCurveTo(hx - 14, hy + 3, hx - 8, hy + 1); ctx.closePath(); fillOut(P.hair, 1.6);
    ctx.beginPath(); ctx.arc(hx - 10.5, hy - 3.6, 1.8, 0, 7); fillOut(P.scarf, 1.2);
  }
  ctx.beginPath(); ctx.ellipse(hx, hy, 12.2, 11.6, 0, 0, 7); fillOut(P.skin);
  ctx.fillStyle = shade(P.skin, -0.12); ctx.beginPath(); ctx.ellipse(hx - 3, hy + 5, 8, 4.5, 0.2, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - 9.6, hy + 1, 2.4, 3, 0, 0, 7); fillOut(P.skin, 1.4); // oreille
  ctx.fillStyle = 'rgba(255,110,110,.35)'; ctx.beginPath(); ctx.ellipse(hx + 7.6, hy + 4, 2.6, 1.6, 0, 0, 7); ctx.fill();
  if (P.freckles) { ctx.fillStyle = 'rgba(150,80,50,.55)'; for (const [a, b] of [[6, 2.4], [7.6, 1.6], [9, 2.6], [5.2, 3.6]]) { ctx.beginPath(); ctx.arc(hx + a, hy + b, 0.42, 0, 7); ctx.fill(); } }
  // yeux
  if (anim === 'sleep') {
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(hx + 2.4, hy); ctx.quadraticCurveTo(hx + 4.6, hy + 1.8, hx + 6.8, hy); ctx.moveTo(hx + 8.2, hy); ctx.quadraticCurveTo(hx + 10, hy + 1.8, hx + 11.6, hy); ctx.stroke();
  } else {
    const blink = (t % 4.2) > 4.05, look = anim === 'dig' && o.dig === 'down' ? 1.3 : 0;
    for (const ex of [4.5, 9.6]) {
      ctx.beginPath(); ctx.ellipse(hx + ex, hy - 0.2, 2.5, blink ? 0.35 : 3.4, 0, 0, 7); fillOut('#ffffff', 1.1);
      if (!blink) {
        ctx.fillStyle = P.iris; ctx.beginPath(); ctx.ellipse(hx + ex + 0.8, hy + 0.4 + look, 1.6, 2.2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + ex + 1.3, hy - 0.5 + look, 0.65, 0, 7); ctx.fill();
        if (o.gender === 'f') { ctx.strokeStyle = OUT; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx + ex + 1.6, hy - 3.2); ctx.lineTo(hx + ex + 3.2, hy - 4.3); ctx.stroke(); }
      }
    }
    ctx.strokeStyle = shade(P.hair, -0.1); ctx.lineWidth = 1.2; // sourcils
    ctx.beginPath(); ctx.moveTo(hx + 2.8, hy - 4.8); ctx.quadraticCurveTo(hx + 4.6, hy - 5.8, hx + 6.4, hy - 5); ctx.moveTo(hx + 8.2, hy - 5); ctx.quadraticCurveTo(hx + 9.9, hy - 5.8, hx + 11.4, hy - 4.8); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(hx + 11.6, hy + 2.4, 1.9, 1.6, 0, 0, 7); fillOut(shade(P.skin, -0.06), 1.1); // nez
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 5.4, hy + 6); ctx.quadraticCurveTo(hx + 8, hy + 8.3, hx + 10.4, hy + 5.8); ctx.stroke();
  if (home) { // cheveux (à la maison)
    ctx.beginPath(); ctx.moveTo(hx - 12, hy + 1.5); ctx.quadraticCurveTo(hx - 13.8, hy - 15.5, hx + 1, hy - 14.2); ctx.quadraticCurveTo(hx + 13.4, hy - 13.8, hx + 12.4, hy - 4);
    ctx.quadraticCurveTo(hx + 7, hy - 3.4, hx + 3.2, hy - 6.8); ctx.quadraticCurveTo(hx - 2, hy - 2.2, hx - 12, hy + 1.5); ctx.closePath(); fillOut(P.hair, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(hx - 3, hy - 10, 4.5, 1.5, -0.3, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = P.hair; ctx.beginPath(); ctx.moveTo(hx - 11.5, hy - 2.6); ctx.quadraticCurveTo(hx - 3, hy - 1.2, hx + 3, hy - 5.6); ctx.quadraticCurveTo(hx + 8, hy - 3, hx + 12.2, hy - 5.6); ctx.lineTo(hx + 12, hy - 8.5); ctx.lineTo(hx - 11.5, hy - 8.5); ctx.closePath(); ctx.fill();
    // casque : coque jaune, nervure, visière, reflet, pastille Fokus, lampe
    ctx.beginPath(); ctx.moveTo(hx - 13, hy - 6); ctx.bezierCurveTo(hx - 13, hy - 22.5, hx + 13.6, hy - 23, hx + 13.6, hy - 6); ctx.closePath(); fillOut(HELM);
    ctx.fillStyle = shade(HELM, -0.18); ctx.beginPath(); ctx.moveTo(hx - 13, hy - 6); ctx.bezierCurveTo(hx - 12.6, hy - 12, hx - 9, hy - 16, hx - 6, hy - 18); ctx.lineTo(hx - 4, hy - 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx + 0.4, hy - 20.4); ctx.quadraticCurveTo(hx + 1.6, hy - 13, hx + 0.8, hy - 6.5); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + 1.8, hy - 6.2, 16, 2.6, 0, 0, 7); fillOut(shade(HELM, -0.08), 1.8);
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.ellipse(hx + 5, hy - 16.6, 3.4, 1.4, 0.35, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 6, hy - 11.5, 2.3, 0, 7); fillOut('#0f2a20', 1); ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx - 6, hy - 11.5, 1.3, -1.2, 4.2); ctx.stroke();
    const lx = hx + 12.4, ly = hy - 12.6, on = o.lamp !== false && anim !== 'sleep';
    if (on) { const lg = ctx.createRadialGradient(lx + 1, ly, 0, lx + 1, ly, 7); lg.addColorStop(0, 'rgba(255,240,180,.9)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx + 1, ly, 7, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(lx, ly, 3.4, 3.8, 0, 0, 7); fillOut(BRASS, 1.4);
    ctx.fillStyle = on ? '#fffbe6' : '#d8d0b8'; ctx.beginPath(); ctx.ellipse(lx + 0.9, ly, 2.1, 2.5, 0, 0, 7); ctx.fill();
  }
  ctx.restore();

  // pioche (manche en bois, fer à la couleur du niveau)
  if (pick) {
    ctx.save(); ctx.translate(pick.px, pick.py); ctx.rotate(pick.a);
    ctx.beginPath(); ctx.roundRect(-2, -1.6, 24, 3.2, 1.6); fillOut('#b47a45', 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, -1.1, 20, 0.9);
    ctx.translate(22, 0);
    const pc = o.pickColor || '#9aa4ae';
    ctx.beginPath(); ctx.moveTo(-1.2, -2.6); ctx.quadraticCurveTo(2.4, -10, -4, -15); ctx.quadraticCurveTo(7, -9.5, 4.4, -2.6); ctx.lineTo(4.4, 2.6); ctx.quadraticCurveTo(7, 9.5, -4, 15); ctx.quadraticCurveTo(2.4, 10, -1.2, 2.6); ctx.closePath(); fillOut(pc, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(1, -3); ctx.quadraticCurveTo(3.4, -8.6, -0.6, -12.4); ctx.quadraticCurveTo(2.2, -8, 0, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(pc, -0.3); ctx.beginPath(); ctx.moveTo(1, 3); ctx.quadraticCurveTo(4, 8.6, -0.6, 12.4); ctx.quadraticCurveTo(5.4, 8, 4, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // bras avant + gants
  tube(4.6, sh + 1.5, hands[1][0], hands[1][1], 4.2, shade(P.shirt, -0.04));
  for (const [gx, gy] of hands) {
    ctx.beginPath(); ctx.ellipse(gx, gy, 3.6, 3.3, 0, 0, 7); fillOut(GLOVE, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(gx - 0.9, gy - 1.2, 1.4, 0.8, -0.3, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // « z z z » quand il se repose
  if (anim === 'sleep') {
    ctx.save(); ctx.font = `800 ${Math.round(s * 0.3)}px Inter Variable, sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.strokeText('z', x + s * 0.25 + p * s * 0.5, y - s * 1.2 - p * s * 0.8); ctx.fillText('z', x + s * 0.25 + p * s * 0.5, y - s * 1.2 - p * s * 0.8);
    }
    ctx.restore();
  }
}
