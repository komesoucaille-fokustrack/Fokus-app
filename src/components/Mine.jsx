import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { focusSecs, getState, setMine, setPage, toast, useStore } from '../store';
import { COIN, UPGRADES, upCost, world } from '../game/data.js';
import { buy, cap, dugSet, goalCost, newGame, payTasks, recover, setDir, step, stam, tileInfo } from '../game/sim.js';
import { createView, drawFrame } from '../game/render.js';
import { COIN_SVG, drawMiner, paintSkyline, drawHeadframe } from '../game/art.js';
import { LABO } from '../env';

/* =====================================================================
   LA MINE — jeu à côté de Fokus (labo) : pendant chaque session de concentration Pomodoro, ton mineur / ta mineuse
   creuse tout seul. Aucun moyen d'accélérer ni d'augmenter sa chance : seul le temps de concentration compte.
   ===================================================================== */
const fmt = (n) => (n < 10 && n % 1 ? n.toFixed(1).replace('.', ',') : Math.floor(n).toLocaleString('fr-FR'));
const Coin = ({ size = 20 }) => <span className="fk-coin" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: COIN_SVG(size) }} />;
export const Fk = ({ n, size }) => <span className="fk"><Coin size={size} />{fmt(n)}</span>;

/* ---------- histoire d'introduction ---------- */
const STORY = [
  ['night', 'Depuis toute petite, {name} lève les yeux vers le ciel. Les étoiles, l’immensité… tout ce qui est mystérieux l’attire.'],
  ['mine', 'Dans sa ville, une vieille mine l’a toujours intriguée. Il y a deux semaines, {elle} a enfin osé y descendre.'],
  ['pick', 'Tout au fond, dans le noir, {elle} a trouvé… une pioche. Comme si elle l’attendait.'],
  ['study', 'Depuis, entre deux cours à la fac, {name} est passionné·e par les minerais rares. Son rêve : les découvrir tous… et partir un jour dans l’espace.'],
  ['go', 'À chaque minute où tu te concentres, {name} creuse. Ensemble, parcourez les mines du monde… jusqu’aux étoiles. 🚀'],
];
function StoryArt({ scene, gender }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = r.width * d; c.height = r.height * d;
    const ctx = c.getContext('2d'); ctx.scale(d, d);
    let raf, t0 = performance.now();
    const W = r.width, H = r.height, S = Math.min(W, H) / 4;
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (scene === 'night' || scene === 'go') {
        paintSkyline(ctx, W, H, 23, scene === 'go' ? 3 : 7);
        if (scene === 'go') { // fusée qui file
          const p = (t * 0.25) % 1, x = W * (0.15 + p * 0.8), y = H * (0.75 - p * 0.65);
          ctx.save(); ctx.translate(x, y); ctx.rotate(-0.7);
          ctx.fillStyle = '#f2f4f7'; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.18, S * 0.42, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(-S * 0.18, S * 0.2); ctx.lineTo(-S * 0.3, S * 0.45); ctx.lineTo(0, S * 0.35); ctx.lineTo(S * 0.3, S * 0.45); ctx.lineTo(S * 0.18, S * 0.2); ctx.fill();
          ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(0, -S * 0.1, S * 0.08, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,190,80,.9)'; ctx.beginPath(); ctx.ellipse(0, S * 0.55 + Math.sin(t * 30) * 2, S * 0.08, S * 0.18, 0, 0, 7); ctx.fill();
          ctx.restore();
        }
        drawMiner(ctx, W * 0.3, H * 0.92, S * 1.3, { gender, face: 1, anim: 'idle', t });
      } else if (scene === 'mine') {
        paintSkyline(ctx, W, H, 18, 4);
        ctx.fillStyle = '#4a3324'; ctx.fillRect(0, H * 0.86, W, H * 0.14);
        drawHeadframe(ctx, W * 0.62, H * 0.86, S * 0.75, t, false);
        drawMiner(ctx, W * 0.28 + (t * 14 % (W * 0.2)), H * 0.92, S * 1.1, { gender, face: 1, anim: 'walk', t });
      } else {
        // fond de mine éclairé à la lampe
        const g = ctx.createRadialGradient(W * 0.45, H * 0.55, 10, W * 0.45, H * 0.55, W * 0.7);
        g.addColorStop(0, '#6b4a32'); g.addColorStop(1, '#120b07');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (scene === 'pick') {
          const glow = 0.5 + Math.sin(t * 2.5) * 0.25;
          const gg = ctx.createRadialGradient(W * 0.68, H * 0.78, 2, W * 0.68, H * 0.78, S * 1.2);
          gg.addColorStop(0, `rgba(255,230,140,${glow})`); gg.addColorStop(1, 'rgba(255,230,140,0)');
          ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
          ctx.save(); ctx.translate(W * 0.68, H * 0.8); ctx.rotate(-0.4);
          ctx.fillStyle = '#9b6a3e'; ctx.fillRect(-S * 0.6, -S * 0.05, S * 1.1, S * 0.1);
          ctx.fillStyle = '#c9d2dc'; ctx.beginPath(); ctx.moveTo(S * 0.5, -S * 0.35); ctx.quadraticCurveTo(S * 0.75, 0, S * 0.5, S * 0.35); ctx.lineTo(S * 0.42, 0); ctx.fill();
          ctx.restore();
          drawMiner(ctx, W * 0.32, H * 0.92, S * 1.2, { gender, face: 1, anim: 'idle', t });
        } else {
          drawMiner(ctx, W * 0.4, H * 0.92, S * 1.3, { gender, face: 1, anim: 'dig', dig: 'side', t });
          // cristaux qui brillent
          for (let i = 0; i < 4; i++) {
            const x = W * (0.72 + (i % 2) * 0.12), y = H * (0.3 + i * 0.15), a = 0.5 + Math.sin(t * 3 + i) * 0.3;
            ctx.fillStyle = ['#9b5de5', '#5ec4d6', '#f2c230', '#e74c3c'][i]; ctx.globalAlpha = a + 0.3;
            ctx.beginPath(); ctx.moveTo(x, y - S * 0.25); ctx.lineTo(x + S * 0.12, y); ctx.lineTo(x, y + S * 0.12); ctx.lineTo(x - S * 0.12, y); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene, gender]);
  return <canvas ref={ref} className="mine-story-art" aria-hidden="true" />;
}

function Intro({ onStart }) {
  const [step2, setStep2] = useState(0);
  const [gender, setGender] = useState('f');
  const [name, setName] = useState('Maé');
  const box = useRef(null);
  useLayoutEffect(() => { if (box.current) gsap.from(box.current, { opacity: 0, y: 12, duration: 0.5, ease: 'expo.out', clearProps: 'all' }); }, [step2]);
  const elle = gender === 'f' ? 'elle' : 'il';
  const txt = (s) => s.replace(/\{name\}/g, name || (gender === 'f' ? 'Maé' : 'Noé')).replace(/\{elle\}/g, elle).replace('passionné·e', gender === 'f' ? 'passionnée' : 'passionné');
  if (step2 === 0) {
    return (
      <div className="mine-intro" ref={box}>
        <h2>⛏️ La mine</h2>
        <p>Choisis ton héros ou ton héroïne. Pendant chacune de tes sessions de concentration, il ou elle creusera pour toi.</p>
        <div className="mine-pick">
          {[['f', 'Mineuse', 'Maé'], ['m', 'Mineur', 'Noé']].map(([g, l, n]) => (
            <button key={g} type="button" className={'mine-hero ' + (gender === g ? 'on' : '')} onClick={() => { setGender(g); if (['Maé', 'Noé', ''].includes(name)) setName(n); }}>
              <StoryArt scene="dig" gender={g} />
              <b>{l}</b>
            </button>
          ))}
        </div>
        <label className="mine-name">Son prénom
          <input className="field" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} maxLength={16} />
        </label>
        <button type="button" className="b on mine-go" onClick={() => setStep2(1)} disabled={!name.trim()}>Découvrir son histoire</button>
      </div>
    );
  }
  const [scene, text] = STORY[step2 - 1];
  const last = step2 === STORY.length;
  return (
    <div className="mine-intro" ref={box} key={step2}>
      <StoryArt scene={scene} gender={gender} />
      <p className="mine-story">{txt(text)}</p>
      <div className="mine-dots">{STORY.map((_, i) => <i key={i} className={i < step2 ? 'on' : ''} />)}</div>
      <div className="flex gap-2">
        <button type="button" className="b" onClick={() => setStep2(step2 - 1)}>Retour</button>
        <button type="button" className="b on mine-go flex-1" onClick={() => (last ? onStart(gender, name.trim()) : setStep2(step2 + 1))}>{last ? 'Commencer l’aventure ⛏️' : 'Suivant'}</button>
      </div>
    </div>
  );
}

/* ---------- boutique, collection, objectif ---------- */
function Shop({ g, onBuy, onClose }) {
  const W = world(g.w);
  return (
    <Sheet title="Boutique" sub="Améliore ton équipement avec tes Fokoins." onClose={onClose} wide>
      <div className="mine-bal">Tu as <Fk n={g.coins} /></div>
      <div className="mine-shop">
        {UPGRADES.map((u) => {
          const n = g.up[u.id], maxed = n >= u.max, c = maxed ? 0 : upCost(u, n);
          return (
            <div key={u.id} className="mine-item">
              <span className="mine-item-e" aria-hidden="true">{u.emoji}</span>
              <span className="mine-item-t"><b>{u.name} <em>niv. {n}{u.max > 1 ? ` / ${u.max}` : ''}</em></b><span>{u.desc}</span>
                <span className="mine-fx">{u.fx(n)}{!maxed && ` → ${u.fx(n + 1)}`}</span></span>
              <button type="button" className="b on" disabled={maxed || g.coins < c} onClick={() => onBuy(u.id)}>{maxed ? 'Max' : <Fk n={c} size={16} />}</button>
            </div>
          );
        })}
      </div>
      <Goal g={g} W={W} onBuy={onBuy} />
    </Sheet>
  );
}
function Goal({ g, W, onBuy }) {
  const G = W.goal, hasBook = g.built.includes(G.id + '-book'), built = g.built.includes(G.id);
  const need = hasBook ? G.build : G.book;
  return (
    <div className="mine-goal">
      <b>🎯 Objectif : fabriquer {G.name} {G.emoji}</b>
      <p>{built ? `Bravo ! ${G.emoji} fabriqué. Prochaine étape : ${G.next} (bientôt).` : hasBook
        ? `Tu as le livre de fabrication. Il reste à acheter les pièces et à le construire.`
        : `D’abord, acheter le livre de fabrication sur internet. Ensuite, les pièces.`}</p>
      {!built && (
        <>
          <div className="mine-bar"><i style={{ width: Math.min(100, (g.coins / need) * 100) + '%' }} /></div>
          <button type="button" className="b on" disabled={g.coins < need} onClick={() => onBuy(hasBook ? 'goal' : 'book')}>
            {hasBook ? `Construire ${G.name}` : 'Acheter le livre de fabrication'} · <Fk n={need} size={16} />
          </button>
        </>
      )}
    </div>
  );
}
function Collection({ g, onClose }) {
  const W = world(g.w);
  const all = [W.tiles[1], W.tiles[2], ...W.ores];
  return (
    <Sheet title="Collection et marché" sub={`${W.name} · prix de vente à la base`} onClose={onClose} wide>
      <div className="mine-col">
        {all.map((o) => {
          const n = g.found[o.id] || 0, known = n > 0;
          return (
            <div key={o.id} className={'mine-ore ' + (known ? '' : 'unk')}>
              <i style={{ background: `radial-gradient(circle at 35% 30%, ${o.colors[1]}, ${o.colors[0]} 55%, ${o.colors[2]})` }} />
              <b>{known ? o.name : '???'}</b>
              <span className="tabular-nums"><Fk n={o.value} size={14} /></span>
              <em className="tabular-nums">{known ? `× ${n.toLocaleString('fr-FR')}` : 'pas encore trouvé'}</em>
            </div>
          );
        })}
      </div>
      <p className="si-d mt-3">Plus un minerai est précieux, plus il est rare et profond. La chance ne s’achète pas : la mine est la même pour tout le monde.</p>
    </Sheet>
  );
}

/* ---------- le jeu ---------- */
const STATUS = { dig: '⛏️ creuse', toBase: '🎒 remonte vendre', toFace: '🚶 redescend', rest: '💤 se repose', done: '🏁 a tout creusé' };
function Game({ initial }) {
  const canvas = useRef(null), view = useRef(null), gr = useRef(null);
  const [, force] = useState(0);
  const [sheet, setSheet] = useState(null);
  if (!gr.current) gr.current = { g: initial, set: dugSet(initial) };
  const { g } = gr.current, W = world(g.w);
  const live = useRef(false);

  // rattrapage : temps de concentration écoulé depuis la dernière visite (+ repos hors sessions)
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
      if (report && (ev.dug || ev.coins)) toast(`⛏️ Pendant ta concentration : ${ev.dug} blocs creusés · +${fmt(ev.coins)} ${COIN}`, null, 5000);
      Object.keys(G.found).forEach((k) => { if (!before[k]) { const o = W.ores.find((x) => x.id === k); if (o) toast(`✨ Nouveau minerai : ${o.name} (${fmt(o.value)} ${COIN})`, null, 4500); } });
    } else recover(G, wall);
    const paid = payTasks(G, S.doneTotal);
    if (paid) toast(`✅ ${paid} tâche${paid > 1 ? 's' : ''} validée${paid > 1 ? 's' : ''} : +${paid * 5} ${COIN}`, null, 4000);
    live.current = budget > 0.05 || (S.pomo && S.pomo.phase === 'work' && S.pomo.paused == null);
  };
  const save = () => setMine({ ...gr.current.g, dug: gr.current.g.dug.slice() });

  useEffect(() => {
    advance(true);
    save();
    const v = view.current = createView(canvas.current, W);
    let raf, t0 = performance.now(), last = t0, saved = Date.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      advance(false);
      drawFrame(v, gr.current.g, gr.current.set, (now - t0) / 1000, dt, live.current, 0);
      if (Date.now() - saved > 4000) { saved = Date.now(); save(); force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onR = () => v.resize();
    addEventListener('resize', onR);
    const vis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onR); document.removeEventListener('visibilitychange', vis); save(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // Échap ferme la boutique / la collection
    const k = (e) => { if (e.key === 'Escape') setSheet(null); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  // glisser pour regarder autour (la caméra se recentre avec le bouton)
  const drag = useRef(null);
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, cx: view.current.cam.x, cy: view.current.cam.y }; };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 6) { view.current.follow = false; force((x) => x + 1); }
    view.current.cam.x = d.cx - (e.clientX - d.x); view.current.cam.y = d.cy - (e.clientY - d.y);
  };
  const up = () => { drag.current = null; };

  const act = (fn) => { fn(gr.current.g); save(); force((x) => x + 1); };
  const onBuy = (id) => act((G) => {
    const Wd = world(G.w), goal = Wd.goal;
    if (id === 'book') { if (G.coins >= goal.book) { G.coins -= goal.book; G.built.push(goal.id + '-book'); toast('📖 Livre de fabrication acheté !'); } return; }
    if (id === 'goal') { if (G.coins >= goal.build) { G.coins -= goal.build; G.built.push(goal.id); toast(`🎉 ${goal.emoji} Fabriqué ! Le voyage continue bientôt…`, null, 6000); } return; }
    if (buy(G, id)) toast('Amélioration achetée ✓');
  });
  const pomo = getState().pomo, working = pomo && pomo.phase === 'work' && pomo.paused == null;
  const depth = Math.max(0, g.y - 2) * 2;
  return (
    <div className="mine">
      <div className="mine-stage">
        <canvas ref={canvas} className="mine-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        <div className="mine-hud">
          <span className="mine-pill mine-coins"><Fk n={g.coins} size={22} /></span>
          <span className="mine-pill">🎒 {g.bagN}/{cap(g)}</span>
          <span className="mine-pill">⬇ {depth} m</span>
          <span className="mine-pill">{g.hero.name} {working ? STATUS[g.act] || '' : g.act === 'rest' ? '💤 se repose' : '⏸ attend ta concentration'}</span>
        </div>
        {!working && (
          <div className="mine-wait">
            <b>{g.hero.name} attend ta prochaine session ⏱️</b>
            <span>Lance une concentration dans l’onglet Pomodoro : {g.hero.gender === 'f' ? 'elle' : 'il'} creuse pendant que tu travailles.</span>
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
        <button type="button" className="b on" onClick={() => setSheet('shop')}>🛒 Boutique</button>
        <button type="button" className="b" onClick={() => setSheet('col')}>💎 Collection</button>
        <span className="mine-goalpill">{W.goal.emoji} <span className="mine-bar sm"><i style={{ width: Math.min(100, (g.coins / goalCost(W)) * 100) + '%' }} /></span></span>
      </div>
      <p className="mine-note">Fatigue : {Math.round((g.fat / stam(g)) * 100)} % · 10 min de repos toutes les {stam(g) / 60} min de minage · {fmt(g.earned)} {COIN} gagnés depuis le début · chaque tâche validée rapporte 5 {COIN}.</p>
      {LABO && (
        <div className="mine-test">
          🧪 Test (labo) : <button type="button" className="b" onClick={() => act((G) => { G.bonus += 3600; })}>+1 h de concentration</button>
          <button type="button" className="b" onClick={() => act((G) => { G.bonus += 600; })}>+10 min</button>
          <button type="button" className="b" onClick={() => { if (confirm('Recommencer la mine à zéro ?')) { setMine(null); location.reload(); } }}>Recommencer</button>
        </div>
      )}
      {sheet === 'shop' && <Shop g={g} onBuy={onBuy} onClose={() => setSheet(null)} />}
      {sheet === 'col' && <Collection g={g} onClose={() => setSheet(null)} />}
    </div>
  );
}

export default function Mine() {
  const { S } = useStore();
  if (!S.mine) {
    return <Intro onStart={(gender, name) => { setMine(newGame({ gender, name, focus: focusSecs(getState()) })); toast(`⛏️ ${name} entre dans la mine. Lance une concentration pour l’aider !`, null, 5000); }} />;
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
