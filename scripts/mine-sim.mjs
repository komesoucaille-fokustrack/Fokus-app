/* Équilibrage de la mine : joue des parties avec une stratégie simple (achète l'amélioration la moins chère utile)
   et mesure les heures de concentration nécessaires pour fabriquer l'objectif du monde 1.  node scripts/mine-sim.mjs */
import { UPGRADES, upCost, world } from '../src/game/data.js';
import { newGame, step, buy, dugSet, recover, goalCost, sell, fillMissions, claim, missionProgress, travel } from '../src/game/sim.js';
let W = world(1), h1 = 0;
const g = newGame({ gender: 'f', name: 'Maé', focus: 0 });
let set = dugSet(g);
let h = 0, log = [];
const prio = ['auto', 'pick', 'bag', 'pick', 'boots', 'bag', 'stam'];
while (h < 90) {
  for (let i = 0; i < 2; i++) { step(g, 25 * 60, set); recover(g, 5 * 60); } // pomodoros 25/5
  h += 50 / 60;
  g.st.tasks += 3; // ~3 tâches validées par heure
  g.coins += 15;
  sell(g, null, 'moyenne-' + Math.floor(h)); // vente au cours du jour
  fillMissions(g);
  for (let i = g.missions.length - 1; i >= 0; i--) if (missionProgress(g, g.missions[i]) >= 1) claim(g, i);
  // achats : garder de quoi atteindre l'objectif à la fin
  for (let k = 0; k < 6; k++) {
    const opts = UPGRADES.filter((u) => g.up[u.id] < u.max).map((u) => ({ u, c: upCost(u, g.up[u.id]) })).sort((a, b) => a.c - b.c);
    const o = opts.find((x) => x.c <= g.coins * 0.6 && (x.u.id !== 'stam' || g.up.pick > 3));
    if (!o || g.coins >= goalCost(W) * 0.5) break; // près de l'objectif : on économise
    buy(g, o.u.id);
  }
  if (Math.abs(h % 2) < 0.84) log.push(`${h.toFixed(1)} h · ${Math.round(g.coins)} Fk (gagnés ${Math.round(g.earned)}) · prof ${g.y} · pioche ${g.up.pick} sac ${g.up.bag} bottes ${g.up.boots} end ${g.up.stam} tri ${g.up.auto} · trouvés ${JSON.stringify(g.found)}`);
  if (g.coins >= goalCost(W)) {
    log.push(`→ OBJECTIF du monde ${g.w} (${goalCost(W)} Fk) atteint en ${h.toFixed(1)} h${g.w > 1 ? ` (${(h - h1).toFixed(1)} h dans ce monde)` : ''}`);
    if (g.w >= 2 || process.argv[2] === '1') break;
    g.coins -= goalCost(W); g.built.push(W.goal.id + '-book', W.goal.id);
    travel(g); W = world(g.w); set = dugSet(g); h1 = h;
  }
}
console.log(log.join('\n'));
