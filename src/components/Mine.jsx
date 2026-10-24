import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { BADGES, focusSecs, getState, setMine, setPage, toast, useStore } from '../store';
import { BADGE_FK, COIN, PICKS, SHOP_CATS, TASK_REWARD, UPGRADES, upCost, world } from '../game/data.js';
import {
  buy, canTravel, cap, claim, dayKey, depthM, dugSet, fillMissions, fixGame, goalCost, missionProgress, newGame, payBadges, payTasks, price,
  recover, sell, setDir, stam, step, stockValue, travel,
} from '../game/sim.js';
import { createView, drawFrame, hitBuilding, pop } from '../game/render.js';
import { COIN_SVG, drawHeadframe, drawMiner, drawPickIconAt, drawWorkshop, paintCave, paintSkyline } from '../game/art.js';
import { LABO } from '../env';

/* =====================================================================
   LA MINE — jeu à côté de Fokus (labo) : pendant chaque session de concentration Pomodoro, ton mineur / ta mineuse
   creuse tout seul. Aucun moyen d'accélérer ni d'augmenter sa chance : seul le temps de concentration compte.
   En surface : l'Atelier (objectif : fabriquer le véhicule), la Boutique (améliorations) et le Marché (coffre + cours du jour).
   Fokoins aussi gagnés avec les tâches validées, les badges de Fokus (selon leur palier) et les missions.
   ===================================================================== */
const fmt = (n) => (n < 10 && n % 1 ? n.toFixed(1).replace('.', ',') : Math.floor(n).toLocaleString('fr-FR'));
const Coin = ({ size = 20 }) => <span className="fk-coin" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: COIN_SVG(size) }} />;
export const Fk = ({ n, size }) => <span className="fk"><Coin size={size} />{fmt(n)}</span>;
const gem = (o) => ({ background: `radial-gradient(circle at 35% 30%, ${o.colors[1]}, ${o.colors[0]} 55%, ${o.colors[2]})` });

/* ---------- l'histoire : chapitre 1 (texte au masculin / féminin : {féminin|masculin}) ---------- */
const STORY = [
  ['night', 'Il y a des enfants qui comptent les moutons pour s’endormir. {name}, {elle|lui}, comptait les étoiles. Chaque nuit, le front collé à la fenêtre, {elle|il} se demandait ce qui se cachait là-haut… et tout au fond de la Terre.'],
  ['town', 'Au bout de sa rue se dresse le vieux chevalement de la mine, fermée depuis cinquante ans. « Il n’y a plus rien là-dessous », disent les grands. {name} n’y a jamais cru.'],
  ['descent', 'Il y a deux semaines, un soir d’orage, la grille était entrouverte. Une lampe frontale, une grande inspiration… et {name} est {descendue|descendu} pour la première fois dans le noir.'],
  ['pick', 'Tout au fond de la dernière galerie, quelque chose brillait. Une pioche ancienne, plantée dans la roche, comme si elle {l’|l’}attendait depuis toujours. Sur le manche, trois lettres gravées : F · K · S.'],
  ['study', 'Depuis, sa vie a changé. Le jour, les cours à la fac. Le soir, les livres de géologie. {name} a un rêve fou : trouver les pierres les plus rares du monde… et partir un jour dans l’espace.'],
  ['go', 'Mais un rêve pareil ne se réalise pas seul. Chaque minute où tu te concentres, {name} creuse. Ton travail devient sa force.'],
  ['final', 'L’aventure commence ici, dans la mine de ta ville. Premier objectif : réunir assez de Fokoins pour fabriquer un vélo… et partir explorer la région. 🚲'],
];
/* chapitre 2 : en route vers les volcans d'Auvergne (monde 2) */
const STORY2 = [
  ['ride', 'Le vélo grince un peu, mais il roule. {name} pédale vers le sud, la pioche attachée sur le porte-bagages. À l’horizon se lèvent des montagnes rondes comme des bols renversés : les volcans d’Auvergne.'],
  ['volcans', 'Ici, la terre a brûlé il y a des milliers d’années. Sous la cendre grise et la pouzzolane rouge dorment le soufre, l’obsidienne… et une vieille galerie que tout le monde a oubliée.'],
  ['saphir', 'Au village, une vieille dame raconte la légende des saphirs du Velay, bleus comme un ciel d’été, cachés tout au fond. {name} sourit : avec du temps et de la patience, on finit toujours par trouver.'],
  ['go2', 'Nouvel objectif : construire une voiture pour traverser le pays jusqu’à l’océan. Attention, le basalte est bien plus dur que la roche de la ville : il faudra de bonnes pioches… et toute ta concentration. 🚗'],
];
const said = (s, g, name) => s.replace(/\{name\}/g, name).replace(/\{([^|}]*)\|([^}]*)\}/g, (_, f, m) => (g === 'f' ? f : m));

function StoryArt({ scene, gender }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = r.width * d; c.height = r.height * d;
    const ctx = c.getContext('2d'); ctx.scale(d, d);
    let raf;
    const t0 = performance.now(), W = r.width, H = r.height, S = Math.min(W, H) / 4;
    const hero = (x, y, s, o) => drawMiner(ctx, x, y, s, { gender, face: 1, tool: false, ...o });
    const cave = (cx, cy, lit) => paintCave(ctx, W, H, cx, cy, lit);
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (scene === 'night') {
        paintSkyline(ctx, W, H, 23, 7);
        // étoile filante
        const p = (t * 0.35) % 1;
        if (p < 0.35) { ctx.strokeStyle = `rgba(255,255,255,${1 - p / 0.35})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * (0.2 + p), H * (0.1 + p * 0.3)); ctx.lineTo(W * (0.14 + p), H * (0.06 + p * 0.3)); ctx.stroke(); }
        hero(W * 0.24, H * 0.95, S * 1.25, { anim: 'idle', t, helmet: false });
      } else if (scene === 'town') {
        paintSkyline(ctx, W, H, 19, 4);
        ctx.fillStyle = '#4a3324'; ctx.fillRect(0, H * 0.86, W, H * 0.14);
        ctx.fillStyle = '#5cae4f'; ctx.fillRect(0, H * 0.86, W, H * 0.03);
        drawHeadframe(ctx, W * 0.66, H * 0.86, S * 0.55, t * 0.3, false);
        hero(W * 0.16 + ((t * 18) % (W * 0.3)), H * 0.93, S * 1.1, { anim: 'walk', t, helmet: false });
      } else if (scene === 'descent') {
        cave(W * 0.45, H * 0.45, 0.55);
        ctx.strokeStyle = '#a97443'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(W * 0.38, 0); ctx.lineTo(W * 0.38, H); ctx.moveTo(W * 0.52, 0); ctx.lineTo(W * 0.52, H);
        for (let y = 10; y < H; y += 26) { ctx.moveTo(W * 0.38, y); ctx.lineTo(W * 0.52, y); }
        ctx.stroke();
        hero(W * 0.45, H * 0.55 + Math.sin(t * 2) * 6, S * 1.15, { anim: 'climb', t });
        // pluie dehors, en haut
        ctx.strokeStyle = 'rgba(160,190,255,.35)'; ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) { const x = (i * 53 + t * 140) % W, y = ((i * 29 + t * 300) % (H * 0.25)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); }
      } else if (scene === 'pick') {
        cave(W * 0.62, H * 0.7, 0.6);
        const glow = 0.45 + Math.sin(t * 2.5) * 0.25;
        const gg = ctx.createRadialGradient(W * 0.7, H * 0.72, 2, W * 0.7, H * 0.72, S * 1.4);
        gg.addColorStop(0, `rgba(255,230,140,${glow})`); gg.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#4a3322'; ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.7 - S * 0.75, H); ctx.quadraticCurveTo(W * 0.66, H * 0.8, W * 0.7, H * 0.8); ctx.quadraticCurveTo(W * 0.75, H * 0.8, W * 0.7 + S * 0.8, H); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.translate(W * 0.7, H * 0.74); ctx.rotate(-1.1); drawPickIconAt(ctx, 0, 0, S * 1.1, '#cfd6dd'); ctx.restore();
        for (let i = 0; i < 5; i++) { const a = t * 1.5 + i * 1.3, rr = S * (0.6 + (i % 3) * 0.2); ctx.fillStyle = `rgba(255,240,180,${0.4 + 0.4 * Math.sin(a * 2)})`; ctx.beginPath(); ctx.arc(W * 0.7 + Math.cos(a) * rr, H * 0.7 + Math.sin(a) * rr * 0.6, 2, 0, 7); ctx.fill(); }
        hero(W * 0.3, H * 0.94, S * 1.2, { anim: 'idle', t, reach: true });
      } else if (scene === 'study') {
        // chambre d'étudiant le soir : mur chaud, fenêtre étoilée à rideaux, bureau en bois, lampe, livres, cailloux
        let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2338'); g.addColorStop(1, '#1a1524');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const wx = W * 0.6, wy = H * 0.1, ww = W * 0.3, wh = H * 0.4;
        g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#0a1430'); g.addColorStop(1, '#1d2a55');
        ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 16; i++) { ctx.globalAlpha = 0.4 + ((i * 37) % 6) / 10; ctx.fillRect(wx + ((i * 37) % (ww - 4)), wy + ((i * 23) % (wh - 4)), 1.5, 1.5); } ctx.globalAlpha = 1;
        ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 4; ctx.strokeRect(wx, wy, ww, wh); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
        for (const [cx2, d2] of [[wx - 6, 1], [wx + ww + 6, -1]]) { g = ctx.createLinearGradient(cx2 - 10, 0, cx2 + 10, 0); g.addColorStop(0, '#7a3b3b'); g.addColorStop(1, '#4e2424'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx2 - 9 * d2, wy - 6); ctx.lineTo(cx2 + 9 * d2, wy - 6); ctx.quadraticCurveTo(cx2 + 4 * d2, wy + wh * 0.6, cx2 + 12 * d2, wy + wh + 8); ctx.lineTo(cx2 - 9 * d2, wy + wh + 8); ctx.closePath(); ctx.fill(); }
        const lg = ctx.createRadialGradient(W * 0.88, H * 0.58, 2, W * 0.88, H * 0.58, W * 0.35); lg.addColorStop(0, 'rgba(255,206,130,.4)'); lg.addColorStop(1, 'rgba(255,206,130,0)');
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
        g = ctx.createLinearGradient(0, H * 0.66, 0, H * 0.73); g.addColorStop(0, '#8a5c38'); g.addColorStop(1, '#5a3a22');
        ctx.fillStyle = g; ctx.fillRect(W * 0.46, H * 0.66, W * 0.52, H * 0.06); ctx.fillStyle = '#3f2816'; ctx.fillRect(W * 0.5, H * 0.72, W * 0.025, H * 0.3); ctx.fillRect(W * 0.93, H * 0.72, W * 0.025, H * 0.3);
        ['#7e3b3b', '#2f5a6e', '#a8873a', '#4a3f6b'].forEach((c2, i) => { ctx.fillStyle = c2; ctx.fillRect(W * (0.5 + i * 0.035), H * (0.5 + (i % 2) * 0.02), W * 0.03, H * (0.16 - (i % 2) * 0.02)); ctx.fillStyle = 'rgba(255,230,180,.35)'; ctx.fillRect(W * (0.5 + i * 0.035) + 2, H * 0.55, W * 0.03 - 4, 2); });
        ctx.strokeStyle = '#2b2b2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.92, H * 0.66); ctx.lineTo(W * 0.9, H * 0.5); ctx.lineTo(W * 0.86, H * 0.46); ctx.stroke();
        ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.moveTo(W * 0.83, H * 0.47); ctx.lineTo(W * 0.89, H * 0.44); ctx.lineTo(W * 0.885, H * 0.52); ctx.closePath(); ctx.fill();
        [['#b06df5', '#e6d0ff'], ['#5ec4d6', '#d8f6fb'], ['#f5c542', '#fff0a0']].forEach(([c2, c3], i) => { const gx = W * (0.7 + i * 0.05), gy = H * 0.64; const gg = ctx.createRadialGradient(gx - 2, gy - 2, 0, gx, gy, 7); gg.addColorStop(0, c3); gg.addColorStop(1, c2); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, 6, 0, 7); ctx.fill(); });
        hero(W * 0.28, H * 0.95, S * 1.25, { anim: 'idle', t, helmet: false });
      } else if (scene === 'go' || scene === 'final') {
        paintSkyline(ctx, W, H, scene === 'go' ? 23 : 10, scene === 'go' ? 3 : 9);
        if (scene === 'go') {
          const p = (t * 0.22) % 1, x = W * (0.45 + p * 0.5), y = H * (0.85 - p * 0.75);
          ctx.save(); ctx.translate(x, y); ctx.rotate(0.75);
          ctx.fillStyle = 'rgba(255,190,80,.9)'; ctx.beginPath(); ctx.ellipse(0, S * 0.55 + Math.sin(t * 30) * 2, S * 0.09, S * 0.22, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#f2f4f7'; ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.18, S * 0.45, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(-S * 0.18, S * 0.18); ctx.lineTo(-S * 0.32, S * 0.45); ctx.lineTo(0, S * 0.36); ctx.lineTo(S * 0.32, S * 0.45); ctx.lineTo(S * 0.18, S * 0.18); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(0, -S * 0.1, S * 0.08, 0, 7); ctx.fill(); ctx.stroke();
          ctx.restore();
          hero(W * 0.22, H * 0.95, S * 1.25, { anim: 'idle', t, wave: true });
        } else {
          ctx.fillStyle = '#4a3324'; ctx.fillRect(0, H * 0.86, W, H * 0.14); ctx.fillStyle = '#5cae4f'; ctx.fillRect(0, H * 0.86, W, H * 0.03);
          drawHeadframe(ctx, W * 0.72, H * 0.86, S * 0.55, t * 0.5, false);
          hero(W * 0.3, H * 0.93, S * 1.25, { anim: 'idle', t, wave: true });
        }
      } else if (scene === 'ride' || scene === 'go2') {
        paintSkyline(ctx, W, H, 10, 5, 'volcans');
        ctx.fillStyle = '#6b5a4e'; ctx.fillRect(0, H * 0.88, W, H * 0.12); ctx.fillStyle = '#5cbf45'; ctx.fillRect(0, H * 0.86, W, H * 0.03);
        if (scene === 'ride') {
          const bx = W * 0.15 + ((t * 40) % (W * 0.7)), gy = H * 0.9, r = S * 0.28;
          ctx.strokeStyle = '#2b1a16'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          const bike = () => { ctx.beginPath(); ctx.arc(bx - S * 0.42, gy - r, r, 0, 7); ctx.moveTo(bx + S * 0.42 + r, gy - r); ctx.arc(bx + S * 0.42, gy - r, r, 0, 7); ctx.moveTo(bx - S * 0.42, gy - r); ctx.lineTo(bx - S * 0.05, gy - r - S * 0.34); ctx.lineTo(bx + S * 0.3, gy - r - S * 0.34); ctx.lineTo(bx + S * 0.42, gy - r); ctx.moveTo(bx - S * 0.05, gy - r - S * 0.34); ctx.lineTo(bx + S * 0.04, gy - r); ctx.lineTo(bx + S * 0.3, gy - r - S * 0.34); ctx.moveTo(bx + S * 0.3, gy - r - S * 0.34); ctx.lineTo(bx + S * 0.36, gy - r - S * 0.55); ctx.stroke(); };
          bike(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; bike();
          hero(bx, gy - r - S * 0.12, S * 1.05, { anim: 'walk', t, reach: false });
        } else {
          drawWorkshop(ctx, W * 0.5, H * 0.88, S * 0.8, false, 0.15, false, 'voiture');
          hero(W * 0.22, H * 0.93, S * 1.2, { anim: 'idle', t, wave: true });
        }
      } else if (scene === 'volcans') {
        paintSkyline(ctx, W, H, 19, 8, 'volcans');
        ctx.fillStyle = '#4b4a57'; ctx.beginPath(); ctx.moveTo(W * 0.48, H); ctx.quadraticCurveTo(W * 0.7, H * 0.42, W * 0.98, H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2b1a16'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#16101a'; ctx.beginPath(); ctx.moveTo(W * 0.66, H); ctx.lineTo(W * 0.66, H * 0.78); ctx.quadraticCurveTo(W * 0.72, H * 0.68, W * 0.78, H * 0.78); ctx.lineTo(W * 0.78, H); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b97a43'; ctx.fillRect(W * 0.65, H * 0.76, W * 0.14, H * 0.04); ctx.strokeRect(W * 0.65, H * 0.76, W * 0.14, H * 0.04);
        ctx.fillStyle = '#6b5a4e'; ctx.fillRect(0, H * 0.9, W * 0.5, H * 0.1); ctx.fillStyle = '#5cbf45'; ctx.fillRect(0, H * 0.88, W * 0.5, H * 0.03);
        hero(W * 0.3, H * 0.93, S * 1.2, { anim: 'idle', t, wave: (t % 4) < 1.6 });
      } else if (scene === 'saphir') {
        cave(W * 0.66, H * 0.62, 0.62);
        const glow = 0.5 + Math.sin(t * 2.4) * 0.2, gx = W * 0.68, gy = H * 0.8;
        const gg = ctx.createRadialGradient(gx, gy - S * 0.3, 2, gx, gy - S * 0.3, S * 1.5); gg.addColorStop(0, `rgba(120,170,255,${glow})`); gg.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
        [[-0.5, 0.55], [0, 0.85], [0.45, 0.6]].forEach(([a, hh]) => { ctx.save(); ctx.translate(gx + a * S * 0.3, gy); ctx.rotate(a * 0.7); const w2 = S * 0.12, h2 = S * hh; ctx.beginPath(); ctx.moveTo(-w2, 0); ctx.lineTo(-w2, -h2 * 0.7); ctx.lineTo(0, -h2); ctx.lineTo(w2, -h2 * 0.7); ctx.lineTo(w2, 0); ctx.closePath(); ctx.fillStyle = '#2f6bd8'; ctx.fill(); ctx.fillStyle = '#a8c8ff'; ctx.beginPath(); ctx.moveTo(-w2, 0); ctx.lineTo(-w2, -h2 * 0.7); ctx.lineTo(0, -h2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2b1a16'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w2, 0); ctx.lineTo(-w2, -h2 * 0.7); ctx.lineTo(0, -h2); ctx.lineTo(w2, -h2 * 0.7); ctx.lineTo(w2, 0); ctx.stroke(); ctx.restore(); });
        hero(W * 0.3, H * 0.94, S * 1.2, { anim: 'idle', t, reach: true });
      } else { // aperçu du choix du personnage
        cave(W * 0.5, H * 0.55, 0.7);
        hero(W * 0.5, H * 0.92, S * 1.5, { anim: 'idle', t, wave: (t % 4) < 1.6 });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, gender]);
  return <canvas ref={ref} className="mine-story-art" aria-hidden="true" />;
}

function Intro({ onStart }) {
  const [i, setI] = useState(0);
  const [gender, setGender] = useState('f');
  const [name, setName] = useState('Maé');
  const box = useRef(null);
  useLayoutEffect(() => { if (box.current) gsap.from(box.current, { opacity: 0, y: 12, duration: 0.55, ease: 'expo.out', clearProps: 'all' }); }, [i]);
  const nm = name.trim() || (gender === 'f' ? 'Maé' : 'Noé');
  if (i === 0) {
    return (
      <div className="mine-intro" ref={box}>
        <span className="mine-kicker">Nouvelle aventure</span>
        <h2>⛏️ La mine</h2>
        <p>Choisis qui va vivre cette aventure. Pendant chacune de tes sessions de concentration, {gender === 'f' ? 'elle' : 'il'} creusera pour toi.</p>
        <div className="mine-pick">
          {[['f', 'Mineuse', 'Maé'], ['m', 'Mineur', 'Noé']].map(([g, l, n]) => (
            <button key={g} type="button" className={'mine-hero ' + (gender === g ? 'on' : '')} onClick={() => { setGender(g); if (['Maé', 'Noé', ''].includes(name)) setName(n); }}>
              <StoryArt scene="pickhero" gender={g} />
              <b>{l}</b>
            </button>
          ))}
        </div>
        <label className="mine-name">Son prénom
          <input className="field" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} maxLength={16} />
        </label>
        <button type="button" className="b on mine-go" onClick={() => setI(1)} disabled={!name.trim()}>Découvrir son histoire</button>
      </div>
    );
  }
  const [scene, text] = STORY[i - 1], last = i === STORY.length;
  return (
    <div className="mine-intro" ref={box} key={i}>
      <span className="mine-kicker">Chapitre 1 · La mine de la ville</span>
      <StoryArt scene={scene} gender={gender} />
      <p className="mine-story">{said(text, gender, nm)}</p>
      <div className="mine-dots">{STORY.map((_, k) => <i key={k} className={k < i ? 'on' : ''} />)}</div>
      <div className="flex gap-2">
        <button type="button" className="b" onClick={() => setI(i - 1)}>Retour</button>
        <button type="button" className="b on mine-go flex-1" onClick={() => (last ? onStart(gender, nm) : setI(i + 1))}>{last ? 'Prendre la pioche ⛏️' : 'Suivant'}</button>
      </div>
    </div>
  );
}

/* Chapitre suivant (raconté au départ vers un nouveau monde) */
function Chapter({ g, scenes, kicker, finish, onDone, onClose }) {
  const [i, setI] = useState(0);
  const [scene, text] = scenes[i], last = i === scenes.length - 1;
  return (
    <Sheet title={kicker} onClose={onClose} wide>
      <div className="mine-intro mine-intro-sheet" key={i}>
        <StoryArt scene={scene} gender={g.hero.gender} />
        <p className="mine-story">{said(text, g.hero.gender, g.hero.name)}</p>
        <div className="mine-dots">{scenes.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
        <div className="flex gap-2">
          {i > 0 && <button type="button" className="b" onClick={() => setI(i - 1)}>Retour</button>}
          <button type="button" className="b on mine-go flex-1" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? finish : 'Suivant'}</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- lieux de la surface ---------- */
function PickIcon({ tier, size = 40 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, d = Math.min(2, devicePixelRatio || 1);
    c.width = c.height = size * d;
    const ctx = c.getContext('2d'); ctx.scale(d, d);
    ctx.translate(size / 2, size / 2); ctx.rotate(-0.75);
    drawPickIconAt(ctx, 0, 0, size * 0.9, (PICKS[tier] || PICKS[0])[1]);
  }, [tier, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

function Shop({ g, onBuy, onClose }) {
  const [cat, setCat] = useState('tools');
  return (
    <Sheet title="🛠️ Boutique d’équipement" sub="« Un bon outil, c’est la moitié du travail. » — le vieux Marcel, vendeur depuis 1972" onClose={onClose} wide>
      <div className="mine-bal">Ta bourse : <Fk n={g.coins} size={22} /></div>
      <div className="mine-tabs" role="tablist">
        {SHOP_CATS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={cat === k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      <div className="mine-shop">
        {UPGRADES.filter((u) => u.cat === cat).map((u) => {
          const n = g.up[u.id] || 0, maxed = n >= u.max, c = maxed ? 0 : upCost(u, n), can = !maxed && g.coins >= c;
          return (
            <div key={u.id} className={'mine-item ' + (can ? 'can' : '')}>
              <span className="mine-item-e" aria-hidden="true">{u.id === 'pick' ? <PickIcon tier={maxed ? n : n + 1} /> : u.emoji}</span>
              <span className="mine-item-t">
                <b>{u.label ? (maxed ? u.label(n) : `Passer à la ${u.label(n + 1).toLowerCase()}`) : u.name} <em>{u.max > 1 ? `niv. ${n} / ${u.max}` : n ? 'acquis' : ''}</em></b>
                <span>{u.desc}</span>
                <span className="mine-fx">{u.fx(n)}{!maxed && ` → ${u.fx(n + 1)}`}</span>
                {u.max > 1 && <span className="mine-lv">{[...Array(u.max)].map((_, k) => <i key={k} className={k < n ? 'on' : ''} />)}</span>}
              </span>
              <button type="button" className="b on" disabled={!can} onClick={() => onBuy(u.id)}>{maxed ? 'Max' : <Fk n={c} size={16} />}</button>
            </div>
          );
        })}
      </div>
      {cat === 'tools' && (
        <div className="mine-picks" aria-label="Toutes les pioches">
          {PICKS.map(([nm], k) => <span key={nm} className={k <= g.up.pick ? 'on' : ''} title={nm}><PickIcon tier={k} size={30} /></span>)}
        </div>
      )}
    </Sheet>
  );
}

function Market({ g, onSell, onClose }) {
  const W = world(g.w), day = dayKey(), yday = dayKey(Date.now() - 864e5);
  const types = [1, 2, ...W.ores.map((_, k) => 3 + k)];
  const known = types.filter((t) => (g.found[(t >= 3 ? W.ores[t - 3] : W.tiles[t]).id] || 0) > 0);
  const total = stockValue(g, day);
  return (
    <Sheet title="🏪 Marché aux minerais" sub={`Cours du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · les prix changent chaque jour`} onClose={onClose} wide>
      <div className="mine-stock">
        <span>📦 Ton coffre vaut <Fk n={total} size={20} /> aujourd’hui</span>
        <button type="button" className="b on" disabled={!total} onClick={() => onSell(null)}>Tout vendre</button>
      </div>
      {g.up.seller ? <p className="si-d">🤝 Contrat actif : tes minerais sont vendus automatiquement en arrivant, au cours du jour.</p> : null}
      <div className="mine-prices">
        {known.length === 0 && <p className="si-d">Aucun minerai trouvé pour l’instant. Lance une concentration !</p>}
        {known.map((t) => {
          const o = t >= 3 ? W.ores[t - 3] : W.tiles[t], p = price(W, t, day), py = price(W, t, yday), q = g.stock[t] || 0;
          const pct = Math.round((p / o.value - 1) * 100);
          return (
            <div key={t} className="mine-price">
              <i style={gem(o)} />
              <span className="mine-price-n"><b>{o.name}</b><em>{q ? `× ${q.toLocaleString('fr-FR')} au coffre` : 'rien au coffre'}</em></span>
              <span className="mine-price-v"><Fk n={p} size={14} />{t >= 3 && <em className={pct > 0 ? 'up' : pct < 0 ? 'down' : ''} title={`Hier : ${fmt(py)} Fk`}>{pct > 0 ? '+' : ''}{pct} %</em>}</span>
              <button type="button" className="b" disabled={!q} onClick={() => onSell(t)}>Vendre</button>
            </div>
          );
        })}
      </div>
      <p className="si-d mt-3">💡 Les cours varient chaque jour de −25 % à +25 % autour du prix normal (le pourcentage affiché). Garde tes pierres précieuses au coffre et vends-les un jour où leur prix monte !</p>
    </Sheet>
  );
}

function Workshop({ g, onBuy, onTravel, onClose }) {
  const W = world(g.w), G = W.goal, hasBook = g.built.includes(G.id + '-book'), built = g.built.includes(G.id);
  const need = hasBook ? G.build : G.book;
  return (
    <Sheet title="🔧 Atelier" sub={`Objectif du monde : fabriquer ${G.name} ${G.emoji} pour partir vers « ${G.next} »`} onClose={onClose} wide>
      <div className="mine-goal">
        <div className="mine-steps">
          <span className={hasBook ? 'ok' : 'cur'}>1 · 📖 Livre de fabrication <Fk n={G.book} size={14} /></span>
          <span className={built ? 'ok' : hasBook ? 'cur' : ''}>2 · 🔩 Pièces et montage <Fk n={G.build} size={14} /></span>
          <span className={built ? 'ok cur' : ''}>3 · {G.emoji} Départ</span>
        </div>
        <p>{built ? (canTravel(g) ? `Bravo ! ${G.name[0].toUpperCase() + G.name.slice(1)} est prêt. Le coffre sera vendu au cours du jour avant le départ ; tes Fokoins, tes améliorations et ta collection te suivent.` : `Bravo ! ${G.name[0].toUpperCase() + G.name.slice(1)} est prêt. La suite du voyage arrive bientôt dans le labo.`)
          : hasBook ? 'Le livre est sur l’établi. Il reste à acheter les pièces et à tout monter.'
            : 'D’abord, commander le livre de fabrication sur internet : il explique tout, pièce par pièce.'}</p>
        {built && canTravel(g) && <button type="button" className="b on mine-go" onClick={onTravel}>Partir vers « {G.next} » {G.emoji}</button>}
        {!built && (
          <>
            <div className="mine-bar"><i style={{ width: Math.min(100, (g.coins / need) * 100) + '%' }} /></div>
            <button type="button" className="b on" disabled={g.coins < need} onClick={() => onBuy(hasBook ? 'goal' : 'book')}>
              {hasBook ? `Construire ${G.name}` : 'Commander le livre'} · <Fk n={need} size={16} />
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Collection({ g, onClose }) {
  const W = world(g.w), all = [W.tiles[1], W.tiles[2], ...W.ores];
  const got = all.filter((o) => g.found[o.id]).length;
  return (
    <Sheet title="💎 Collection" sub={`${W.name} · ${got} / ${all.length} trouvés`} onClose={onClose} wide>
      <div className="mine-col">
        {all.map((o) => {
          const n = g.found[o.id] || 0;
          return (
            <div key={o.id} className={'mine-ore ' + (n ? '' : 'unk')}>
              <i style={gem(o)} />
              <b>{n ? o.name : '???'}</b>
              <span className="tabular-nums"><Fk n={o.value} size={14} /></span>
              <em className="tabular-nums">{n ? `× ${n.toLocaleString('fr-FR')}` : 'pas encore trouvé'}</em>
            </div>
          );
        })}
      </div>
      <p className="si-d mt-3">Plus un minerai est précieux, plus il est rare et profond. La chance ne s’achète pas : la mine est la même pour tout le monde.</p>
    </Sheet>
  );
}

function Missions({ g, onClaim }) {
  return (
    <div className="mine-missions">
      <b className="mine-missions-t">📜 Missions</b>
      {g.missions.map((m, i) => {
        const p = missionProgress(g, m), done = p >= 1;
        return (
          <div key={m.text + i} className={'mine-mission ' + (done ? 'done' : '')}>
            <span className="mine-mission-t">{m.text}</span>
            <span className="mine-bar sm2"><i style={{ width: p * 100 + '%' }} /></span>
            {done ? <button type="button" className="b on" onClick={() => onClaim(i)}>Récupérer <Fk n={m.reward} size={14} /></button> : <span className="mine-mission-r"><Fk n={m.reward} size={14} /></span>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- le jeu ---------- */
const STATUS = { dig: '⛏️ creuse', toBase: '🎒 remonte au marché', toFace: '🚶 redescend', rest: '💤 se repose', done: '🏁 a tout creusé' };
const tierOf = Object.fromEntries(BADGES.map((b) => [b.id, b.tier]));
function Game({ initial }) {
  const canvas = useRef(null), view = useRef(null), gr = useRef(null);
  const [, force] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [chapter, setChapter] = useState(false);
  if (!gr.current) { const g0 = fixGame(structuredClone(initial)); fillMissions(g0); gr.current = { g: g0, set: dugSet(g0) }; }
  const { g } = gr.current, W = world(g.w);
  const live = useRef(false);

  // rattrapage : temps de concentration écoulé depuis la dernière visite (+ repos hors sessions), tâches, badges
  const advance = (report) => {
    const S = getState(), G = gr.current.g, now = Date.now();
    const budget = focusSecs(S) + G.bonus - G.base0 - G.used;
    const wall = Math.max(0, (now - G.wall) / 1000);
    G.wall = now;
    const before = { ...G.found };
    if (budget > 0) {
      recover(G, Math.max(0, wall - budget));
      const ev = step(G, budget, gr.current.set);
      G.used += budget;
      if (report && ev.dug) toast(`⛏️ Pendant ta concentration : ${ev.dug} blocs creusés${ev.sold ? ` · ${ev.sold} minerais rapportés` : ''}`, null, 5000);
      if (!report && view.current) {
        (ev.list || []).forEach((id) => { const o = world(G.w).ores.find((x) => x.id === id); if (o) pop(view.current, `+1 ${o.name}`, G.x + 0.5, G.y + 0.2, o.colors[1]); });
        if (ev.home) pop(view.current, G.up.seller ? `+${fmt(ev.coins)} Fk` : '📦 au coffre', 15.4, -2.2, '#ffe08a');
      }
      Object.keys(G.found).forEach((k) => { if (!before[k]) { const o = world(G.w).ores.find((x) => x.id === k); if (o) toast(`✨ Nouveau minerai découvert : ${o.name} (${fmt(o.value)} ${COIN})`, null, 4500); } });
    } else recover(G, wall);
    const paid = payTasks(G, S.doneTotal);
    if (paid) toast(`✅ ${paid} tâche${paid > 1 ? 's' : ''} validée${paid > 1 ? 's' : ''} : +${paid * TASK_REWARD} ${COIN}`, null, 4000);
    const b = payBadges(G, Object.keys(S.badges || {}).filter((id) => tierOf[id]).map((id) => [id, tierOf[id]]));
    if (b.n) toast(G.badgesPaid.length === b.n && b.n > 2 ? `🏅 Prime de bienvenue : tes ${b.n} badges Fokus rapportent +${fmt(b.total)} ${COIN} !` : `🏅 ${b.n > 1 ? `${b.n} badges` : 'Nouveau badge'} : +${fmt(b.total)} ${COIN}`, null, 5500);
    live.current = S.pomo && S.pomo.phase === 'work' && S.pomo.paused == null;
  };
  const save = () => setMine({ ...gr.current.g, dug: gr.current.g.dug.slice() });

  useEffect(() => {
    advance(true);
    save();
    const v = view.current = createView(canvas.current, W);
    let raf, last = performance.now(), saved = Date.now();
    const t0 = last;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      advance(false);
      const G = gr.current.g, Wd = world(G.w), goal = Wd.goal;
      const need = G.built.includes(goal.id + '-book') ? goal.build : goal.book;
      drawFrame(v, G, gr.current.set, (now - t0) / 1000, dt, live.current, (G.up.lamp || 0) * 0.8, { progress: Math.min(1, G.coins / need), built: G.built.includes(goal.id) });
      if (Date.now() - saved > 4000) { saved = Date.now(); save(); force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onR = () => v.resize();
    addEventListener('resize', onR);
    const vis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', vis);
    const key = (e) => { if (e.key === 'Escape') setSheet(null); };
    addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onR); document.removeEventListener('visibilitychange', vis); removeEventListener('keydown', key); save(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // glisser pour regarder autour ; toucher un bâtiment pour y entrer
  const drag = useRef(null);
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, cx: view.current.cam.x, cy: view.current.cam.y, moved: false }; };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 8) { d.moved = true; view.current.follow = false; force((x) => x + 1); }
    if (d.moved) { view.current.cam.x = d.cx - (e.clientX - d.x); view.current.cam.y = d.cy - (e.clientY - d.y); }
  };
  const up = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || d.moved || e.type !== 'pointerup') return;
    const r = canvas.current.getBoundingClientRect(), b = hitBuilding(view.current, e.clientX - r.left, e.clientY - r.top);
    if (b) setSheet(b);
  };

  const act = (fn) => { fn(gr.current.g); save(); force((x) => x + 1); };
  const onBuy = (id) => act((G) => {
    const goal = world(G.w).goal;
    if (id === 'book') { if (G.coins >= goal.book) { G.coins -= goal.book; G.built.push(goal.id + '-book'); toast('📖 Livre de fabrication commandé !'); } return; }
    if (id === 'goal') { if (G.coins >= goal.build) { G.coins -= goal.build; G.built.push(goal.id); toast(`🎉 ${goal.emoji} ${goal.name[0].toUpperCase() + goal.name.slice(1)} est prêt ! Ouvre l’Atelier pour partir.`, null, 6000); } return; }
    if (buy(G, id)) toast(id === 'pick' ? `⛏️ ${PICKS[G.up.pick][0]} !` : 'Amélioration achetée ✓');
  });
  const onTravel = () => { setSheet(null); setChapter(true); };
  const doTravel = () => {
    act((G) => {
      const v = travel(G);
      gr.current.set = dugSet(G);
      if (view.current) { view.current.W = world(G.w); view.current.resize(); view.current.follow = true; }
      const NW = world(G.w);
      toast(`${NW.emoji} Bienvenue dans « ${NW.name} »${v ? ` · coffre vendu : +${fmt(v)} ${COIN}` : ''}`, null, 6000);
    });
    setChapter(false);
  };
  const onSell = (t) => act((G) => { const v = sell(G, t); if (v) toast(`💰 Vendu : +${fmt(v)} ${COIN}`); });
  const onClaim = (i) => act((G) => { const v = claim(G, i); if (v) toast(`📜 Mission accomplie : +${fmt(v)} ${COIN}`); });
  const working = live.current;
  const stockN = Object.values(g.stock).reduce((a, b) => a + b, 0);
  const goal = W.goal, need = goal.book + goal.build, spent = (g.built.includes(goal.id + '-book') ? goal.book : 0) + (g.built.includes(goal.id) ? goal.build : 0);
  return (
    <div className="mine">
      <div className="mine-stage">
        <canvas ref={canvas} className="mine-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { drag.current = null; }} />
        <div className="mine-hud">
          <span className="mine-pill mine-coins"><Fk n={g.coins} size={22} /></span>
          <span className="mine-pill" title={W.name}>{W.emoji} <span className="mine-wide">Monde </span>{g.w}</span>
          <span className="mine-pill">🎒 {g.bagN}/{cap(g)}</span>
          {stockN > 0 && !g.up.seller ? <button type="button" className="mine-pill mine-sell" onClick={() => setSheet('market')}><span>📦 {stockN}<span className="mine-wide"> au coffre</span> · vendre</span></button> : <span className="mine-pill">📦 {stockN}</span>}
          <span className="mine-pill">⬇ {depthM(g.y)} m</span>
          <span className="mine-pill">{g.hero.name} {working ? STATUS[g.act] || '' : g.act === 'rest' ? '💤 se repose' : '⏳ attend ta concentration'}</span>
        </div>
        {!working && (
          <div className="mine-wait">
            <span className="mine-wait-t"><b>{g.hero.name} attend ta prochaine session ⏱️</b>
              <span>{g.hero.gender === 'f' ? 'Elle' : 'Il'} creuse pendant que tu travailles. Touche un bâtiment pour y entrer.</span></span>
            <button type="button" className="b on" onClick={() => setPage(4)}>Aller au Pomodoro</button>
          </div>
        )}
        {view.current && !view.current.follow && <button type="button" className="mine-recenter" onClick={() => { view.current.follow = true; force((x) => x + 1); }}>🎯 Recentrer</button>}
      </div>
      <div className="mine-ctl">
        <div className="mine-dirs" role="group" aria-label="Direction">
          {[['left', '◀ Gauche'], ['down', '⬇ Descendre'], ['right', 'Droite ▶']].map(([d, l]) => (
            <button key={d} type="button" className={'seg ' + (g.dir === d ? 'on' : '')} onClick={() => act((G) => setDir(G, d))}>{l}</button>
          ))}
        </div>
        <button type="button" className="b on" onClick={() => setSheet('market')}>🏪 Marché</button>
        <button type="button" className="b" onClick={() => setSheet('shop')}>🛠️ Boutique</button>
        <button type="button" className="b" onClick={() => setSheet('workshop')}>🔧 Atelier</button>
        <button type="button" className="b" onClick={() => setSheet('col')}>💎</button>
        <span className="mine-goalpill" title="Objectif du monde">{goal.emoji} <span className="mine-bar sm"><i style={{ width: Math.min(100, ((spent + g.coins) / need) * 100) + '%' }} /></span></span>
      </div>
      <Missions g={g} onClaim={onClaim} />
      <p className="mine-note">Fatigue : {Math.round((g.fat / stam(g)) * 100)} % · 10 min de repos toutes les {stam(g) / 60} min de minage · {fmt(g.earned)} {COIN} gagnés depuis le début.
        Bonus : chaque tâche validée +{TASK_REWARD} {COIN}, chaque badge Fokus +{BADGE_FK[1]} à +{BADGE_FK[4]} {COIN} selon sa difficulté.</p>
      {LABO && (
        <div className="mine-test">
          🧪 Test (labo) : <button type="button" className="b" onClick={() => act((G) => { G.bonus += 3600; })}>+1 h de concentration</button>
          <button type="button" className="b" onClick={() => act((G) => { G.bonus += 600; })}>+10 min</button>
          {!g.built.includes(W.goal.id) && <button type="button" className="b" onClick={() => act((G) => { const go = world(G.w).goal; G.built.push(go.id + '-book', go.id); toast(`${go.emoji} Débloqué pour le test : ouvre l’Atelier.`); })}>Débloquer {W.goal.emoji}</button>}
          <button type="button" className="b" onClick={() => { if (confirm('Recommencer la mine à zéro ?')) { setMine(null); location.reload(); } }}>Recommencer</button>
        </div>
      )}
      {sheet === 'shop' && <Shop g={g} onBuy={onBuy} onClose={() => setSheet(null)} />}
      {sheet === 'market' && <Market g={g} onSell={onSell} onClose={() => setSheet(null)} />}
      {sheet === 'workshop' && <Workshop g={g} onBuy={onBuy} onTravel={onTravel} onClose={() => setSheet(null)} />}
      {chapter && g.w === 1 && <Chapter g={g} scenes={STORY2} kicker="Chapitre 2 · Les volcans d’Auvergne" finish="Descendre dans le volcan 🌋" onDone={doTravel} onClose={() => setChapter(false)} />}
      {sheet === 'col' && <Collection g={g} onClose={() => setSheet(null)} />}
    </div>
  );
}

export default function Mine() {
  const { S } = useStore();
  if (!S.mine) {
    return <Intro onStart={(gender, name) => { setMine(newGame({ gender, name, focus: focusSecs(getState()) })); toast(`⛏️ ${name} prend la pioche. Lance une concentration pour l’aider !`, null, 5000); }} />;
  }
  return <Game initial={S.mine} />;
}

/* Petite carte dans l'onglet Pomodoro : l'état de la mine en un coup d'œil */
export function MineCard() {
  const { S } = useStore();
  const g = S.mine;
  return (
    <button type="button" className="card mine-card" onClick={() => setPage(5)}>
      <span className="mine-card-e" aria-hidden="true">⛏️</span>
      <span className="mine-card-t">
        <b>{g ? `La mine de ${g.hero.name}` : 'La mine'}</b>
        <span>{g ? <>Pendant ta concentration, {g.hero.gender === 'f' ? 'elle' : 'il'} creuse pour toi · <Fk n={g.coins} size={14} /></> : 'Un mineur ou une mineuse creuse pendant tes sessions. Entre !'}</span>
      </span>
      <span className="mine-card-go">Entrer →</span>
    </button>
  );
}
