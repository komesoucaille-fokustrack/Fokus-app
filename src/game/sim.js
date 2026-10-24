import { AIR, BASE_DIG, BEDROCK, DIRT, REST, ROCK, TASK_REWARD, UPGRADES, WALK, bagCap, stamina, upCost, world } from './data.js';

/* =====================================================================
   LA MINE — génération de la mine et simulation (pure : aucun DOM, testable dans Node).
   - La mine est déterminée par une graine : la même tuile contient toujours le même minerai (aucun tirage au moment
     du minage → impossible d'augmenter sa chance, tout le monde a la même mine).
   - Le temps de jeu = les secondes de concentration Pomodoro faites depuis le début de l'aventure (impossible d'accélérer).
   - Le mineur : creuse dans sa direction → sac plein → remonte vendre à la base → redescend ; 10 min de repos par
     heure de minage (endurance) ; il récupère aussi pendant les pauses et quand l'app est fermée.
   ===================================================================== */
export const ENTRY = 10; // colonne du puits d'entrée (la base est à gauche, en surface)
export const START_Y = 3; // premier niveau creusé

/* hachage entier → [0, 1) (rapide, sans état) */
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* Contenu d'origine d'une tuile (avant creusage) */
export function tileAt(W, x, y) {
  if (x < 0 || x >= W.width || y >= W.depth) return BEDROCK;
  if (y < 0) return AIR;
  if (x === ENTRY && y <= START_Y) return AIR; // puits d'entrée
  const d = y / W.depth;
  // filons : cellules de 3×3, plus fréquents en profondeur
  const cx = Math.floor(x / 3), cy = Math.floor(y / 3);
  const pv = 0.26 + 0.16 * d;
  if (y >= 2 && hash(cx, cy, W.seed + 1) < pv && hash(x, y, W.seed + 2) < 0.58) {
    const ores = W.ores;
    let tot = 0;
    const ws = ores.map((o) => { const v = o.w * Math.exp(o.deep * y) * (y >= 6 + o.deep * 400 ? 1 : 0.02); tot += v; return v; });
    let u = hash(cx * 7 + 3, cy * 13 + 5, W.seed + 3) * tot;
    for (let i = 0; i < ores.length; i++) { u -= ws[i]; if (u <= 0) return 3 + i; }
    return 3;
  }
  // roche de base : terre en surface, pierre en profondeur (avec des poches)
  const n = hash(Math.floor(x / 2), Math.floor(y / 2), W.seed + 4);
  return y < 5 + n * 6 || (y < 18 && n < 0.18) ? DIRT : ROCK;
}
export const tileInfo = (W, t) => (t >= 3 ? W.ores[t - 3] : W.tiles[t]);

/* ---------- état ---------- */
export function newGame({ gender, name, focus }) {
  return {
    v: 1, w: 1, hero: { gender, name }, x: ENTRY, y: START_Y, dir: 'right', hdir: 'right', down: 0, act: 'dig', prog: 0, walk: 0, route: null,
    fat: 0, rest: 0, bag: {}, bagN: 0, coins: 0, earned: 0, up: { pick: 0, bag: 0, boots: 0, stam: 0, auto: 0 },
    dug: [], found: {}, base0: focus, used: 0, tasks0: null, tasksPaid: 0, wall: Date.now(), bonus: 0, built: [], at: Date.now(),
  };
}
const key = (W, x, y) => y * W.width + x;
export const dugSet = (g) => new Set(g.dug);
export const tile = (W, set, x, y) => (x < 0 || x >= W.width || y >= W.depth ? BEDROCK : set.has(key(W, x, y)) ? AIR : tileAt(W, x, y));

const pickSpeed = (g) => 1.3 ** g.up.pick;
const walkSpeed = (g) => WALK * (1 + 0.25 * g.up.boots);
export const cap = (g) => bagCap(g.up.bag);
export const stam = (g) => stamina(g.up.stam);

/* Chemin le plus court dans les galeries jusqu'à l'entrée (largeur d'abord) → liste de points, du mineur à la sortie */
export function routeToEntry(W, set, x0, y0) {
  const ok = (x, y) => (x === ENTRY && y <= START_Y) || (y >= 0 && set.has(key(W, x, y)));
  const goal = key(W, ENTRY, 0), start = key(W, x0, y0);
  const prev = new Map([[start, -1]]), q = [start];
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    if (k === goal) break;
    const x = k % W.width, y = Math.floor(k / W.width);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy, nk = key(W, nx, ny);
      if (nx < 0 || nx >= W.width || ny < 0 || prev.has(nk) || !ok(nx, ny)) continue;
      prev.set(nk, k); q.push(nk);
    }
  }
  if (!prev.has(goal)) return [[x0, y0], [ENTRY, 0]];
  const pts = [];
  for (let k = goal; k !== -1; k = prev.get(k)) pts.push([k % W.width, Math.floor(k / W.width)]);
  return pts.reverse();
}
/* durée de marche d'un chemin (montées plus lentes) + trajet en surface jusqu'à la base */
const SURFACE = 7;
function routeTime(g, pts) {
  let t = SURFACE / walkSpeed(g);
  for (let i = 1; i < pts.length; i++) t += (pts[i][1] !== pts[i - 1][1] ? 1 / 0.6 : 1) / walkSpeed(g);
  return t;
}

/* Déplacement automatique en « galeries » : tout droit à l'horizontale ; au bord, on descend de 3 tuiles puis on repart
   dans l'autre sens (une galerie toutes les 3 tuiles : la vision permettra de repérer les minerais entre deux galeries).
   « Descendre » (choisi par le joueur) : tout droit vers le bas jusqu'au fond, puis reprise des galeries. */
const DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1] };
const GAP = 3;
function target(W, g) {
  const d = DIRS[g.dir];
  return [g.x + d[0], g.y + d[1]];
}
function turn(W, g, set) {
  if (g.dir === 'down') { // fond atteint (ou bord) : repartir à l'horizontale, du côté le moins creusé
    g.down = 0;
    const h = g.hdir === 'left' ? 'right' : g.hdir === 'right' ? 'left' : g.x < W.width / 2 ? 'right' : 'left';
    for (const dir of [h, h === 'right' ? 'left' : 'right']) {
      const [dx] = DIRS[dir];
      if (tile(W, set, g.x + dx, g.y) !== BEDROCK && !edgeDone(W, set, g.x, g.y, dir)) { g.dir = dir; g.hdir = dir; return true; }
    }
    return false; // tout est creusé
  }
  // bord atteint à l'horizontale : descendre de GAP tuiles
  if (tile(W, set, g.x, g.y + 1) === BEDROCK) return false;
  g.hdir = g.dir; g.dir = 'down'; g.down = GAP;
  return true;
}
/* plus rien à creuser dans cette direction sur cette ligne (tout est déjà creusé jusqu'au bord) */
function edgeDone(W, set, x, y, dir) {
  const dx = DIRS[dir][0];
  for (let i = x + dx; i >= 0 && i < W.width; i += dx) if (!set.has(key(W, i, y))) return false;
  return true;
}
/* après chaque pas vers le bas en mode galeries : au bout de GAP tuiles, nouvelle galerie dans l'autre sens */
function afterDown(W, g, set) {
  if (g.dir !== 'down' || !g.down) return;
  if (--g.down > 0) return;
  const dir = g.hdir === 'right' ? 'left' : 'right';
  g.dir = dir; g.hdir = dir;
  if (tile(W, set, ...target(W, g)) === BEDROCK) turn(W, g, set);
}

const sellValue = (W, bag) => Object.entries(bag).reduce((s, [t, n]) => s + tileInfo(W, +t).value * n, 0);

/* Avance la simulation de `sec` secondes de concentration. Renvoie les événements (pour l'affichage). */
export function step(g, sec, set = dugSet(g)) {
  const W = world(g.w), ev = { dug: 0, coins: 0, ores: {}, sold: 0, rested: 0 };
  let t = sec, guard = 0;
  while (t > 1e-6 && guard++ < 200000) {
    if (g.act === 'rest') {
      const r = Math.min(t, g.rest);
      g.rest -= r; t -= r; ev.rested += r;
      if (g.rest <= 1e-6) { g.rest = 0; g.fat = 0; g.act = g.after || 'dig'; g.after = null; }
      continue;
    }
    if (g.fat >= stam(g)) { g.after = g.act; g.act = 'rest'; g.rest = REST; continue; }
    if (g.act === 'toBase' || g.act === 'toFace') {
      const r = Math.min(t, g.walk);
      g.walk -= r; t -= r; g.fat += r;
      if (g.walk > 1e-6) continue;
      if (g.act === 'toBase') {
        const v = sellValue(W, g.bag);
        g.coins += v; g.earned += v; ev.coins += v; ev.sold += g.bagN;
        g.bag = {}; g.bagN = 0; g.act = 'toFace'; g.walk = g.walkTotal;
      } else { g.act = 'dig'; g.route = null; }
      continue;
    }
    // creuser
    let [tx, ty] = target(W, g);
    let tt = tile(W, set, tx, ty);
    if (tt === BEDROCK) { if (!turn(W, g, set)) { g.act = 'done'; break; } continue; }
    if (tt === AIR && g.dir !== 'down' && edgeDone(W, set, g.x, g.y, g.dir)) { if (!turn(W, g, set)) { g.act = 'done'; break; } continue; }
    if (tt === AIR) { // galerie déjà creusée : on avance
      const c = (ty !== g.y ? 1 / 0.6 : 1) / walkSpeed(g);
      if (t < c * (1 - g.prog)) { g.prog += t / c; g.fat += t; t = 0; break; }
      const down = ty > g.y;
      t -= c * (1 - g.prog); g.fat += c * (1 - g.prog); g.prog = 0; g.x = tx; g.y = ty;
      if (down) afterDown(W, g, set);
      continue;
    }
    const info = tileInfo(W, tt), need = (BASE_DIG * info.hard) / pickSpeed(g);
    const left = need * (1 - g.prog);
    if (t < left) { g.prog += t / need; g.fat += t; t = 0; break; }
    t -= left; g.fat += left; g.prog = 0;
    set.add(key(W, tx, ty)); g.dug.push(key(W, tx, ty));
    const wentDown = ty > g.y;
    g.x = tx; g.y = ty; ev.dug++;
    if (wentDown) afterDown(W, g, set);
    g.found[info.id] = (g.found[info.id] || 0) + 1;
    if (tt >= 3) ev.ores[info.id] = (ev.ores[info.id] || 0) + 1;
    if (tt < 3 && g.up.auto) { g.coins += info.value; g.earned += info.value; ev.coins += info.value; continue; }
    g.bag[tt] = (g.bag[tt] || 0) + 1; g.bagN++;
    if (g.bagN >= cap(g)) {
      const pts = routeToEntry(W, set, g.x, g.y);
      g.route = pts; g.walkTotal = routeTime(g, pts); g.walk = g.walkTotal; g.act = 'toBase';
    }
  }
  return ev;
}

/* Repos hors concentration (pauses, app fermée) : la fatigue baisse 6 fois plus vite qu'elle ne monte */
export function recover(g, wallSec) {
  if (g.act === 'rest') { g.rest = Math.max(0, g.rest - wallSec); if (!g.rest) { g.fat = 0; g.act = g.after || 'dig'; g.after = null; } return; }
  g.fat = Math.max(0, g.fat - wallSec * (stam(g) / REST));
}

/* ---------- boutique ---------- */
export function buy(g, id) {
  const u = UPGRADES.find((x) => x.id === id), n = g.up[id];
  if (!u || n >= u.max) return false;
  const c = upCost(u, n);
  if (g.coins < c) return false;
  g.coins -= c; g.up[id] = n + 1;
  return true;
}
/* Tâches validées dans Fokus → Fokoins (une seule fois chacune, même après « Annuler ») */
export function payTasks(g, doneTotal) {
  if (g.tasks0 == null) { g.tasks0 = doneTotal; g.tasksPaid = doneTotal; return 0; }
  const n = Math.max(0, doneTotal - g.tasksPaid);
  g.tasksPaid = Math.max(g.tasksPaid, doneTotal);
  g.coins += n * TASK_REWARD; g.earned += n * TASK_REWARD;
  return n;
}
/* Choix du joueur : « tout droit » (à gauche / à droite) ou « descendre » (jusqu'au fond) */
export const setDir = (g, dir) => {
  g.dir = dir; g.down = 0; g.prog = 0;
  if (dir !== 'down') g.hdir = dir;
  if (g.act === 'done') g.act = 'dig';
};
export const goalCost = (W) => W.goal.book + W.goal.build;
