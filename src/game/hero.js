/* =====================================================================
   LA MINE — le personnage (Canvas 2D vectoriel)
   Style dessin animé : grosse tête, contours épais, couleurs franches (manteau émeraude Fokus ou bleu roi),
   reflets nets. Mains et pieds flottants (à la Rayman) → animations souples ; écharpe qui ondule, sac à dos qui grossit
   avec le butin. Tout est dessiné pour une case de 40 unités, origine aux pieds.
   ===================================================================== */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (h, k) => { const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)); const [r, g, b] = hex(h); return `rgb(${f(r)},${f(g)},${f(b)})`; };

const HERO = {
  f: { coat: '#16a37a', scarf: '#ff8a3d', hair: '#5a2e1a', skin: '#ffd2b3', iris: '#2b1a12' },
  m: { coat: '#3b6fd8', scarf: '#ffcf3d', hair: '#3a2214', skin: '#f6c49d', iris: '#2b1a12' },
};
const LEATHER = '#b57a3f', BOOT = '#5a3a26', HELM = '#ffc928', BRASS = '#c9973f', OUT = '#2b1a16';

/* drawMiner(ctx, x, y = sol, s = taille d'une case, { gender, face: 1 | -1, anim: idle|walk|climb|dig|sleep, t,
   dig: 'side' | 'down', tool (false = sans pioche), helmet (false = cheveux), wave, reach, pickColor, bag (0 → 1), lamp (allumée) }) */
export function drawMiner(ctx, x, y, s, o) {
  const P = HERO[o.gender] || HERO.f, t = o.t || 0, f = o.face || 1, anim = o.anim || 'idle';
  const k = s / 40;
  ctx.save(); ctx.translate(x, y); ctx.scale(f * k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = (c, w = 1.1) => { ctx.strokeStyle = OUT; ctx.lineWidth = w * 1.9; }; // contour épais commun (dessin animé)
  const breathe = Math.sin(t * 2.2);
  const walk = anim === 'walk' || anim === 'climb' ? t * 9 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.sin(walk)) * -2 : anim === 'sleep' ? 3 : breathe * 0.5;
  // coup de pioche : élan lent puis frappe rapide
  const ph = anim === 'dig' ? (t * 1.6) % 1 : 0;
  const swing = anim === 'dig' ? (ph < 0.7 ? -1.25 * (ph / 0.7) : -1.25 + 2.1 * ((ph - 0.7) / 0.3)) : 0;
  const lean = anim === 'dig' ? swing * 0.06 : anim === 'walk' ? 0.05 : 0;

  // ombre douce au sol
  const sg = ctx.createRadialGradient(0, -0.5, 0, 0, -0.5, 13);
  sg.addColorStop(0, 'rgba(0,0,0,.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, -0.5, 13, 3, 0, 0, 7); ctx.fill();

  // bottes flottantes
  const boot = (dx, ph2) => {
    const lift = anim === 'walk' ? Math.max(0, Math.sin(walk + ph2)) * 4 : anim === 'climb' ? Math.max(0, Math.sin(walk + ph2)) * 5 : 0;
    const fwd = anim === 'walk' ? Math.cos(walk + ph2) * 3.5 : 0;
    ctx.save(); ctx.translate(dx + fwd, -3.4 - lift);
    const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, shade(BOOT, 0.25)); g.addColorStop(1, BOOT);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4.5, 2.6); ctx.quadraticCurveTo(-5.2, -3.2, 0, -3.4); ctx.quadraticCurveTo(6.8, -3, 7.2, 1.2); ctx.quadraticCurveTo(7, 3, 4, 3); ctx.lineTo(-3.5, 3); ctx.closePath(); ctx.fill();
    line(BOOT, 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(1.5, -1.6, 3, 0.9, -0.1, 0, 7); ctx.fill();
    ctx.restore();
  };
  if (anim === 'sleep') { boot(-7, 0); boot(5, 0); } else { boot(-5.5, 0); boot(5.5, Math.PI); }

  ctx.save(); ctx.translate(0, bob); ctx.rotate(lean);
  if (anim === 'sleep') { ctx.translate(0, 2); ctx.rotate(-0.1); }
  const by = -17;

  // écharpe : deux pans qui flottent derrière
  const wind = anim === 'walk' || anim === 'climb' ? 1 : 0.35;
  const tail = (len, w, off) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([-5 - u * len, by - 10 + u * (4 + off) + Math.sin(t * 5 + u * 4 + off) * 2.2 * u * wind]); }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] - w / 2);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1] - (w / 2) * (1 - i / 9));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + (w / 2) * (1 - i / 9));
    ctx.closePath();
  };
  ctx.fillStyle = shade(P.scarf, -0.18); tail(11 + wind * 4, 3.6, 3); ctx.fill();
  ctx.fillStyle = P.scarf; tail(14 + wind * 5, 4.2, 0); ctx.fill(); line(P.scarf, 0.8); ctx.stroke();

  // sac à dos (grossit avec le butin)
  const bag = Math.max(0, Math.min(1, o.bag || 0)), bw = 7 + bag * 4, bh = 13 + bag * 4;
  ctx.save(); ctx.translate(-8.5, by + 1);
  if (o.helmet === false) ctx.globalAlpha = 0; // à la maison : pas de sac
  let g = ctx.createLinearGradient(-bw, 0, 0, 0); g.addColorStop(0, shade(LEATHER, -0.35)); g.addColorStop(1, LEATHER);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-bw, -bh / 2, bw + 2, bh, 3.4); ctx.fill(); line(LEATHER); ctx.stroke();
  ctx.fillStyle = shade(LEATHER, -0.2); ctx.beginPath(); ctx.roundRect(-bw - 0.4, -bh / 2 - 0.5, bw + 2.6, bh * 0.38, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = BRASS; ctx.fillRect(-bw / 2 - 0.6, -bh / 2 + bh * 0.3, 2, 2);
  if (bag > 0.5) { // éclats qui dépassent du sac plein
    for (const [gx, c] of [[-bw * 0.7, '#f5c542'], [-bw * 0.35, '#c8a6ff']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(gx, -bh / 2 - 0.5); ctx.lineTo(gx + 1.4, -bh / 2 - 3.6); ctx.lineTo(gx + 2.8, -bh / 2 - 0.5); ctx.closePath(); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // manteau (corps en goutte, liseré clair côté lampe)
  g = ctx.createLinearGradient(-9, by - 10, 9, by + 10);
  g.addColorStop(0, shade(P.coat, -0.25)); g.addColorStop(0.6, P.coat); g.addColorStop(1, shade(P.coat, 0.18));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, by - 11 + breathe * 0.2); ctx.bezierCurveTo(8.5, by - 11, 10.5, by + 2, 9, by + 9); ctx.quadraticCurveTo(0, by + 12.5, -9, by + 9); ctx.bezierCurveTo(-10.5, by + 2, -8.5, by - 11, 0, by - 11 + breathe * 0.2); ctx.closePath();
  ctx.fill(); line(P.coat); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,200,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(7.6, by - 6); ctx.quadraticCurveTo(9.6, by + 1, 8.2, by + 7.5); ctx.stroke();
  // ceinture + boucle, bretelle du sac
  ctx.fillStyle = shade(P.coat, -0.45); ctx.beginPath(); ctx.moveTo(-9.6, by + 4); ctx.quadraticCurveTo(0, by + 6.2, 9.6, by + 4); ctx.lineTo(9.4, by + 6.2); ctx.quadraticCurveTo(0, by + 8.4, -9.4, by + 6.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = BRASS; ctx.beginPath(); ctx.roundRect(1.5, by + 4.4, 3.4, 3, 0.8); ctx.fill();
  if (o.helmet !== false) { ctx.strokeStyle = shade(LEATHER, -0.3); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5, by - 9.5); ctx.quadraticCurveTo(2, by - 4, 6.5, by + 3.6); ctx.stroke(); }
  // col de l'écharpe
  ctx.fillStyle = P.scarf; ctx.beginPath(); ctx.ellipse(0.5, by - 10.5, 8, 3.2, 0.05, 0, 7); ctx.fill(); line(P.scarf, 0.8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(2.5, by - 11.6, 4, 1, 0, 0, 7); ctx.fill();

  // tête (un peu plus grosse : proportions de dessin animé)
  ctx.save(); ctx.translate(1, -30); ctx.scale(1.14, 1.14); ctx.translate(-1, 30);
  const hx = 1, hy = -36.5;
  if (o.helmet === false || o.gender === 'f') { // queue de cheval (mineuse) ou chevelure arrière
    const sw = Math.sin(t * 3 + (anim === 'walk' ? walk : 0)) * 2.2;
    if (o.gender === 'f') {
      ctx.fillStyle = P.hair;
      ctx.beginPath(); ctx.moveTo(hx - 8, hy - 5); ctx.quadraticCurveTo(hx - 19 + sw, hy - 3, hx - 17 + sw * 1.4, hy + 9); ctx.quadraticCurveTo(hx - 15, hy + 3, hx - 7, hy + 2); ctx.closePath(); ctx.fill(); line(P.hair, 0.8); ctx.stroke();
    }
  }
  g = ctx.createRadialGradient(hx + 3, hy - 3, 2, hx, hy, 13);
  g.addColorStop(0, shade(P.skin, 0.12)); g.addColorStop(1, shade(P.skin, -0.1));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(hx, hy, 11.3, 11, 0, 0, 7); ctx.fill(); line(P.skin, 0.9); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,110,.28)'; ctx.beginPath(); ctx.ellipse(hx + 7.5, hy + 3.8, 2.8, 1.7, 0, 0, 7); ctx.fill();
  // yeux
  if (anim === 'sleep') {
    ctx.strokeStyle = shade(P.skin, -0.6); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(hx + 2.5, hy + 0.5); ctx.quadraticCurveTo(hx + 4.6, hy + 2.2, hx + 6.8, hy + 0.5); ctx.moveTo(hx + 8, hy + 0.5); ctx.quadraticCurveTo(hx + 9.8, hy + 2.2, hx + 11.4, hy + 0.5); ctx.stroke();
  } else {
    const blink = (t % 4.2) > 4.06, look = anim === 'dig' && o.dig === 'down' ? 1.4 : 0;
    for (const ex of [4.6, 9.4]) {
      ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.ellipse(hx + ex, hy, 2.5, blink ? 0.35 : 3.3, 0, 0, 7); ctx.fill();
      if (!blink) {
        ctx.fillStyle = P.iris; ctx.beginPath(); ctx.ellipse(hx + ex + 0.8, hy + 0.5 + look, 1.6, 2.2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + ex + 1.3, hy - 0.5 + look, 0.6, 0, 7); ctx.fill();
        if (o.gender === 'f') { ctx.strokeStyle = P.iris; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(hx + ex + 1.6, hy - 2.9); ctx.lineTo(hx + ex + 3.2, hy - 4); ctx.stroke(); }
      }
    }
    // sourcils
    ctx.strokeStyle = shade(P.hair, 0.1); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hx + 3, hy - 4.6); ctx.quadraticCurveTo(hx + 4.8, hy - 5.4, hx + 6.4, hy - 4.8); ctx.moveTo(hx + 8.2, hy - 4.8); ctx.quadraticCurveTo(hx + 9.8, hy - 5.4, hx + 11.2, hy - 4.6); ctx.stroke();
  }
  // nez + sourire
  ctx.fillStyle = shade(P.skin, -0.12); ctx.beginPath(); ctx.ellipse(hx + 11.2, hy + 2.6, 1.9, 1.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = shade(P.skin, -0.55); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx + 5.6, hy + 6); ctx.quadraticCurveTo(hx + 8, hy + 7.8, hx + 10.2, hy + 5.8); ctx.stroke();

  if (o.helmet === false) { // cheveux (à la maison)
    ctx.fillStyle = P.hair;
    ctx.beginPath(); ctx.moveTo(hx - 11.8, hy + 1); ctx.quadraticCurveTo(hx - 13.5, hy - 15, hx + 1, hy - 13.8); ctx.quadraticCurveTo(hx + 13, hy - 13.5, hx + 12, hy - 4);
    ctx.quadraticCurveTo(hx + 7, hy - 3.6, hx + 3.2, hy - 6.6); ctx.quadraticCurveTo(hx - 2, hy - 2.4, hx - 11.8, hy + 1); ctx.closePath(); ctx.fill(); line(P.hair, 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(hx - 3, hy - 10, 4.5, 1.6, -0.3, 0, 7); ctx.fill();
  } else {
    // mèche sous le casque
    ctx.fillStyle = P.hair; ctx.beginPath(); ctx.moveTo(hx - 11, hy - 3); ctx.quadraticCurveTo(hx - 3, hy - 1.5, hx + 3, hy - 5.5); ctx.quadraticCurveTo(hx + 8, hy - 3, hx + 12, hy - 5.5); ctx.lineTo(hx + 12, hy - 8); ctx.lineTo(hx - 11, hy - 8); ctx.closePath(); ctx.fill();
    // casque : coque ocre, visière, reflet
    g = ctx.createLinearGradient(0, hy - 21, 0, hy - 5);
    g.addColorStop(0, shade(HELM, 0.35)); g.addColorStop(0.55, HELM); g.addColorStop(1, shade(HELM, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(hx - 12.5, hy - 6); ctx.bezierCurveTo(hx - 12.5, hy - 21.5, hx + 13, hy - 22, hx + 13, hy - 6); ctx.closePath(); ctx.fill(); line(HELM, 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx + 0.5, hy - 19.6); ctx.lineTo(hx + 0.5, hy - 7); ctx.stroke();
    g = ctx.createLinearGradient(0, hy - 8.5, 0, hy - 4.5); g.addColorStop(0, shade(HELM, 0.1)); g.addColorStop(1, shade(HELM, -0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(hx + 1.5, hy - 6.4, 15.5, 2.4, 0, 0, 7); ctx.fill(); line(HELM, 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(hx - 4.8, hy - 15.8, 3.6, 1.6, -0.55, 0, 7); ctx.fill();
    // lampe frontale en laiton
    const lx = hx + 12.2, ly = hy - 12.5, on = o.lamp !== false && anim !== 'sleep';
    if (on) { const lg = ctx.createRadialGradient(lx + 1, ly, 0, lx + 1, ly, 7); lg.addColorStop(0, 'rgba(255,236,180,.85)'); lg.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx + 1, ly, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = BRASS; ctx.beginPath(); ctx.ellipse(lx, ly, 3.3, 3.6, 0, 0, 7); ctx.fill(); line(BRASS, 0.8); ctx.stroke();
    ctx.fillStyle = on ? '#fff8dc' : '#cfc7b0'; ctx.beginPath(); ctx.ellipse(lx + 0.9, ly, 2, 2.4, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  // mains flottantes (gants de cuir) + pioche
  const hand = (x0, y0) => {
    const gg = ctx.createRadialGradient(x0 - 1, y0 - 1.4, 0.4, x0, y0, 5);
    gg.addColorStop(0, shade(LEATHER, 0.3)); gg.addColorStop(1, shade(LEATHER, -0.2));
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(x0, y0, 4.1, 3.7, 0, 0, 7); ctx.fill(); line(LEATHER, 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x0 - 1, y0 - 1.4, 1.6, 0.8, -0.3, 0, 7); ctx.fill();
  };
  if (o.tool === false) {
    const sw = anim === 'walk' ? Math.sin(walk) * 3 : breathe * 0.4;
    if (o.wave) { const wv = Math.sin(t * 6) * 3; hand(-11, -19 + bob + sw); hand(13 + wv * 0.3, -44 + wv); }
    else if (o.reach) { hand(-10, -16 + bob); hand(17, -22 + bob + Math.sin(t * 2) * 1.2); }
    else if (anim === 'climb') { const c = Math.sin(walk); hand(-6, -36 + c * 4); hand(8, -36 - c * 4); }
    else { hand(-11, -14 + bob + sw); hand(12, -14 + bob - sw); }
  } else if (anim === 'sleep') {
    hand(-8, -12); hand(9, -11);
  } else if (anim === 'climb') {
    const c = Math.sin(walk); hand(-6, -36 + c * 4); hand(8, -36 - c * 4);
  } else {
    // pioche tenue à deux mains, pivot à l'épaule
    const piv = o.dig === 'down' && anim === 'dig' ? [6, -24] : [8, -22];
    const base = anim === 'dig' ? (o.dig === 'down' ? 0.5 : 0) : anim === 'walk' ? -0.9 + Math.sin(walk) * 0.08 : -0.7 + breathe * 0.02;
    const a = base + (anim === 'dig' ? swing * (o.dig === 'down' ? 0.9 : 1) : 0);
    ctx.save(); ctx.translate(piv[0], piv[1] + bob); ctx.rotate(a);
    const L = 22;
    let hg = ctx.createLinearGradient(0, -1.6, 0, 1.6); hg.addColorStop(0, '#b98552'); hg.addColorStop(1, '#6e4524');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(0, -1.5, L, 3, 1.5); ctx.fill(); line('#8a5a30', 0.8); ctx.stroke();
    ctx.save(); ctx.translate(L, 0);
    const pc = o.pickColor || '#9aa4ae';
    hg = ctx.createLinearGradient(-4, -13, 4, 13); hg.addColorStop(0, shade(pc, 0.6)); hg.addColorStop(0.45, pc); hg.addColorStop(1, shade(pc, -0.45));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-1, -2.4); ctx.quadraticCurveTo(2, -10, -4, -14.5); ctx.quadraticCurveTo(6.5, -9, 4, -2.4);
    ctx.lineTo(4, 2.4); ctx.quadraticCurveTo(6.5, 9, -4, 14.5); ctx.quadraticCurveTo(2, 10, -1, 2.4); ctx.closePath(); ctx.fill(); line(pc, 0.8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(2.5, -4); ctx.quadraticCurveTo(3.6, -9, 0, -12.5); ctx.stroke();
    ctx.restore();
    hand(7, 0); hand(14, 0);
    ctx.restore();
  }
  ctx.restore();
  // « z z z » quand il se repose
  if (anim === 'sleep') {
    ctx.save(); ctx.fillStyle = 'rgba(235,240,255,.9)'; ctx.font = `600 ${Math.round(s * 0.28)}px Inter Variable, sans-serif`;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.fillText('z', x + s * 0.25 + p * s * 0.5, y - s * 1.15 - p * s * 0.8);
    }
    ctx.restore();
  }
}
