import { AIR, BADGE_FK, WELCOME_FK, BASE_DIG, BEDROCK, DIRT, MISSIONS, REST, ROCK, TASK_REWARD, UPGRADES, WALK, bagCap, priceMul, stamina, upCost, world } from './data.js';

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

/* limite terre / roche : ondulée et continue (bruit lissé le long de x, utilisable aussi entre deux cases pour le dessin) */
export function dirtEdge(W, x) {
  const n = (u) => hash(Math.floor(u), 0, W.seed + 4), sm = (u) => { const i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f); return n(i) * (1 - k) + n(i + 1) * k; };
  return 6 + sm(x / 7) * 4 + sm(x / 2.3 + 40) * 1.5;
}
/* Contenu d'origine d'une tuile (avant creusage) ; quelques poches de terre plus bas */
export function tileAt(W, x, y) {
  if (x < 0 || x >= W.width || y >= W.depth) return BEDROCK;
  if (y < 0) return AIR;
  if (x === ENTRY && y <= START_Y) return AIR; // puits d'entrée
  const d = y / W.depth;
  // filons : cellules de 3×3, plus fréquents en profondeur
  const cx = Math.floor(x / 3), cy = Math.floor(y / 3);
  const pv = (0.26 + 0.16 * d) * (W.veins || 1);
  if (y >= 2 && hash(cx, cy, W.seed + 1) < pv && hash(x, y, W.seed + 2) < 0.58) {
    const ores = W.ores;
    let tot = 0;
    const ws = ores.map((o) => { const v = o.w * Math.exp(o.deep * y) * (y >= (o.min ?? 6 + o.deep * 400) ? 1 : 0.02); tot += v; return v; });
    let u = hash(cx * 7 + 3, cy * 13 + 5, W.seed + 3) * tot;
    for (let i = 0; i < ores.length; i++) {
      if ((u -= ws[i]) > 0) continue;
      // pierres précieuses : une seule par filon (le reste du filon est du charbon)
      return ores[i].value >= 250 && (x % 3 !== 1 || y % 3 !== 1) ? 3 : 3 + i;
    }
    return 3;
  }
  // roche de base : terre en surface, pierre en profondeur (avec des poches)
  if (y < dirtEdge(W, x)) return DIRT;
  const p = hash(Math.floor(x / 4), Math.floor(y / 4), W.seed + 5);
  return y < 30 && p < 0.07 && hash(x, y, W.seed + 6) < 0.85 ? DIRT : ROCK;
}
export const tileInfo = (W, t) => (t >= 3 ? W.ores[t - 3] : W.tiles[t]);

/* ---------- état ---------- */
export function newGame({ gender, name, focus }) {
  return {
    v: 1, w: 1, ww: world(1).width, hero: { gender, name }, x: ENTRY, y: START_Y, dir: 'right', hdir: 'right', pref: 'right', seg: 0, lamps: [], act: 'dig', prog: 0, walk: 0, route: null,
    fat: 0, rest: 0, bag: {}, bagN: 0, coins: 0, earned: 0, up: { pick: 0, bag: 0, boots: 0, stam: 0, auto: 0, lamp: 0, lant: 0, seller: 0 },
    dug: [], found: {}, base0: focus, used: 0, tasks0: null, tasksPaid: 0, wall: Date.now(), bonus: 0, built: [], at: Date.now(),
    stock: {}, st: { dug: 0, sold: 0, focus: 0, tasks: 0, deep: 0 }, missions: [], mi: 0, badgesPaid: [],
  };
}
/* Parties créées avant une mise à jour : on complète les champs manquants (rien n'est perdu) */
export function fixGame(g) {
  const d = newGame({ gender: 'f', name: '', focus: 0 });
  for (const k of ['stock', 'st', 'missions', 'mi', 'badgesPaid', 'hdir', 'seg']) if (g[k] == null) g[k] = d[k];
  g.up = { ...d.up, ...g.up };
  g.st = { ...d.st, ...g.st };
  if (!g.pref) g.pref = g.dir === 'down' ? 'down' : g.hdir || 'right';
  const W0 = world(g.w);
  if ((g.ww || 120) !== W0.width) { // le monde s'est élargi : on recalcule les numéros de cases
    const ow = g.ww || 120, re = (k) => Math.floor(k / ow) * W0.width + (k % ow);
    g.dug = g.dug.map(re); if (g.lamps) g.lamps = g.lamps.map(re); g.ww = W0.width;
  }
  if (!g.lamps) { // anciennes parties : lanternes posées le long des galeries déjà creusées
    const W = world(g.w);
    g.lamps = [];
    for (const k of g.dug) placeLamp(W, g, k % W.width, Math.floor(k / W.width));
  }
  return g;
}
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/* prix de vente du jour d'un minerai (la terre et la pierre ne varient pas) */
export const price = (W, t, day = dayKey()) => { const o = tileInfo(W, t); return t >= 3 ? o.value * priceMul(o.id, day) : o.value; };
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

/* Galeries aléatoires (comme un vrai mineur qui suit la roche) : des tronçons de longueur variable, à l'horizontale
   surtout, qui descendent d'une ou plusieurs cases, remontent parfois, changent de sens… Tout est tiré par la graine
   de la mine et la position : même partie = mêmes galeries (aucun hasard « achetable »).
   Le choix du joueur (◀ / ⬇ / ▶) n'est qu'une préférence ; un minerai repéré par la lampe frontale attire le mineur. */
const DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
const TOP = 2; // jamais de galerie plus haut (croûte de surface)
const DESCENT = 70;
const other = (d) => (d === 'left' ? 'right' : 'left');
const diggable = (W, set, x, y) => { if (y < TOP) return false; const k = tile(W, set, x, y); return k !== AIR && k !== BEDROCK; };
const isAir = (W, set, x, y) => y >= 0 && tile(W, set, x, y) === AIR;
/* nombre de cases qu'on peut creuser d'affilée dans une direction sans longer une autre galerie */
function openAhead(W, set, x, y, dir, n) {
  const [dx, dy] = DIRS[dir];
  let c = 0;
  for (let i = 1; i <= n; i++) {
    const nx = x + dx * i, ny = y + dy * i;
    if (!diggable(W, set, nx, ny)) break;
    const hug = dy ? isAir(W, set, nx - 1, ny) || isAir(W, set, nx + 1, ny) : isAir(W, set, nx, ny - 1) || isAir(W, set, nx, ny + 1);
    if (hug && i > 1) break;
    if (hug && i === 1 && !(dy === 1 && isAir(W, set, nx, ny - 1))) break;
    c++;
  }
  return c;
}
/* portée de repérage des minerais (lampe frontale) */
export const seeRange = (g) => 1 + Math.floor((g.up.lamp || 0) / 2);
/* lanternes : une toutes les `lampGap` cases creusées */
export const lampGap = (g) => [7, 6, 5, 4, 3][g.up.lant || 0];
function placeLamp(W, g, x, y) {
  const sp = lampGap(g);
  for (let i = g.lamps.length - 1; i >= Math.max(0, g.lamps.length - 40); i--) {
    const k = g.lamps[i], lx = k % W.width, ly = Math.floor(k / W.width);
    if (Math.abs(lx - x) + Math.abs(ly - y) < sp) return;
  }
  g.lamps.push(key(W, x, y));
}
function plan(W, g, set) {
  const r = (k) => hash(g.dug.length * 7 + k, g.x * 977 + g.y * 31, W.seed + 50);
  // 1) un minerai visible à la lampe ? on va le chercher (sans plonger sous le niveau du chantier)
  const R = seeRange(g), floor = g.pref === 'down' ? W.depth : Math.max(g.y, START_Y + 5 + g.dug.length / DESCENT);
  let best = null;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (!d || d > R) continue;
    const x = g.x + dx, y = g.y + dy;
    if (y < TOP || y > floor || tile(W, set, x, y) < 3) continue;
    if (!best || d < best[2]) best = [x, y, d];
  }
  if (best) {
    const dx = best[0] - g.x, dy = best[1] - g.y;
    g.dir = Math.abs(dx) >= Math.abs(dy) && dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (g.dir === 'left' || g.dir === 'right') g.hdir = g.dir;
    g.seg = 1;
    return true;
  }
  // 2) un nouveau tronçon, tiré au sort parmi les directions possibles
  // bord de la mine atteint du côté préféré : la préférence s'inverse (on repart dans l'autre sens)
  if ((g.pref === 'left' && g.x < 4) || (g.pref === 'right' && g.x > W.width - 5)) g.pref = other(g.pref);
  const h = g.hdir || 'right', pref = g.pref || h, wasH = g.dir === 'left' || g.dir === 'right';
  const deep = pref === 'down';
  // niveau visé : la mine s'enfonce peu à peu (une rangée toutes les DESCENT cases creusées), comme un vrai chantier
  const lvl = START_Y + 2 + g.dug.length / DESCENT, hi = g.y < lvl - 2, lo = g.y > lvl + 2 && !g.free;
  g.free = false;
  const run = Math.min(1, (g.run || 0) / 16); // une galerie trop longue tout droit finit par tourner
  const r3 = r(3), dlen = deep ? 2 + Math.floor(r3 * 5) : r3 < 0.75 ? 1 : r3 < 0.95 ? 2 : 3;
  const opts = wasH ? [
    [h, (deep ? 0.8 : 1.6) * (1 - run * 0.85), 2 + Math.floor(r(1) * 6)],
    [other(h), pref === other(h) ? 4 : 0.22, 3 + Math.floor(r(2) * 5)],
    ['down', deep ? 4 : hi ? 2.4 : lo ? 0.02 : 1.1, dlen],
    ['up', g.y > 6 && !deep ? (lo ? 3 : hi ? 0.2 : 1.3) : 0, r(4) < 0.85 ? 1 : 2],
  ] : [
    [h, pref === other(h) ? 0.6 : 5, 2 + Math.floor(r(1) * 6)],
    [other(h), pref === other(h) ? 5 : 1.1, 2 + Math.floor(r(2) * 6)],
    ['down', deep ? 1.5 : hi ? 0.8 : lo ? 0.01 : 0.25, dlen],
    ['up', lo && !deep && g.y > 6 ? 0.6 : 0, 1],
  ];
  let tot = 0;
  const ok = opts.map(([dir, w, len]) => {
    const c = w > 0 ? openAhead(W, set, g.x, g.y, dir, len) : 0;
    const ww = c ? w * (0.35 + 0.65 * (c / len)) : 0;
    tot += ww;
    return [dir, ww, Math.min(len, c)];
  });
  // trop profond et seule la descente reste possible : on repart plutôt d'un endroit moins profond
  if (lo && ok.every(([dir, w]) => !w || dir === 'down')) tot = 0;
  if (tot > 0) {
    let u = r(5) * tot;
    for (const [dir, w, len] of ok) {
      if ((u -= w) > 0 || !w) continue;
      if (dir === 'left' || dir === 'right') { g.run = dir === g.hdir && wasH ? (g.run || 0) + len : len; g.hdir = dir; }
      g.dir = dir; g.seg = len;
      return true;
    }
  }
  // 3) bloqué : on repart d'un autre endroit de la mine (le plus proche où l'on peut ouvrir une galerie,
  //    de préférence pas plus bas que le niveau du chantier)
  for (const strict of [true, false]) {
    const prev = new Map([[key(W, g.x, g.y), -1]]), q = [key(W, g.x, g.y)];
    for (let i = 0; i < q.length && i < 30000; i++) {
      const k = q[i], x = k % W.width, y = Math.floor(k / W.width);
      if (i > 0 && y >= TOP && (!strict || y <= lvl + 2) && (strict && y > lvl + 2 ? ['left', 'right'] : ['left', 'right', 'down']).some((dir) => openAhead(W, set, x, y, dir, 3) >= 2)) {
        const pts = [];
        for (let k2 = k; k2 !== -1; k2 = prev.get(k2)) pts.push([k2 % W.width, Math.floor(k2 / W.width)]);
        g.route = pts.reverse(); g.walkTotal = routeTime(g, g.route) - SURFACE / walkSpeed(g); g.walk = g.walkTotal; g.act = 'move'; g.seg = 0;
        g.free = !strict; // plus rien au niveau du chantier : on a le droit de descendre
        return false;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = key(W, nx, ny);
        if (nx < 0 || nx >= W.width || ny < 0 || prev.has(nk) || !set.has(nk)) continue;
        prev.set(nk, k); q.push(nk);
      }
    }
  }
  g.act = 'done';
  return false;
}

/* Avance la simulation de `sec` secondes de concentration. Renvoie les événements (pour l'affichage). */
export const depthM = (y) => Math.max(0, y - 2) * 2; // profondeur affichée (1 case = 2 m)
export function step(g, sec, set = dugSet(g)) {
  const W = world(g.w), ev = { dug: 0, coins: 0, ores: {}, sold: 0, rested: 0 };
  g.st.focus += sec;
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
        // arrivée au marché : vente au prix du jour (contrat) ou dépôt au coffre
        if (g.up.seller) {
          let v = 0;
          for (const [t2, n] of Object.entries(g.bag)) v += price(W, +t2) * n;
          g.coins += v; g.earned += v; g.st.sold += v; ev.coins += v;
        } else for (const [t2, n] of Object.entries(g.bag)) g.stock[t2] = (g.stock[t2] || 0) + n;
        ev.sold += g.bagN; ev.home = (ev.home || 0) + 1;
        g.bag = {}; g.bagN = 0; g.act = 'toFace'; g.walk = g.walkTotal;
      } else { g.act = 'dig'; g.route = null; }
      continue;
    }
    if (g.act === 'move') { // traversée des galeries jusqu'à un nouveau front de taille
      const r = Math.min(t, g.walk);
      g.walk -= r; t -= r; g.fat += r;
      if (g.walk > 1e-6) continue;
      const [ex, ey] = g.route[g.route.length - 1];
      g.x = ex; g.y = ey; g.route = null; g.act = 'dig'; g.seg = 0; g.prog = 0;
      continue;
    }
    if (g.act !== 'dig') break;
    // creuser
    if (!(g.seg > 0) || !DIRS[g.dir]) { g.prog = 0; if (!plan(W, g, set)) { if (g.act === 'done') break; continue; } }
    const [dx, dy] = DIRS[g.dir], tx = g.x + dx, ty = g.y + dy;
    const tt = tile(W, set, tx, ty);
    if (tt === BEDROCK || (ty < TOP && tt !== AIR)) { g.seg = 0; continue; }
    if (tt === AIR) { // galerie déjà creusée : on avance
      const c = (dy ? 1 / 0.6 : 1) / walkSpeed(g);
      if (t < c * (1 - g.prog)) { g.prog += t / c; g.fat += t; t = 0; break; }
      t -= c * (1 - g.prog); g.fat += c * (1 - g.prog); g.prog = 0; g.x = tx; g.y = ty; g.seg--;
      continue;
    }
    const info = tileInfo(W, tt), need = (BASE_DIG * info.hard) / pickSpeed(g);
    const left = need * (1 - g.prog);
    if (t < left) { g.prog += t / need; g.fat += t; t = 0; break; }
    t -= left; g.fat += left; g.prog = 0;
    set.add(key(W, tx, ty)); g.dug.push(key(W, tx, ty));
    g.x = tx; g.y = ty; ev.dug++; g.st.dug++; g.seg--;
    g.st.deep = Math.max(g.st.deep, depthM(g.y));
    placeLamp(W, g, tx, ty);
    g.found[info.id] = (g.found[info.id] || 0) + 1;
    if (tt >= 3) ev.ores[info.id] = (ev.ores[info.id] || 0) + 1;
    if (tt >= 3) (ev.list = ev.list || []).push(info.id);
    if (tt < 3 && g.up.auto) { g.coins += info.value; g.earned += info.value; g.st.sold += info.value; ev.coins += info.value; continue; }
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

/* ---------- marché : vente du coffre au prix du jour ---------- */
export const stockValue = (g, day) => { const W = world(g.w); return Object.entries(g.stock).reduce((s2, [t2, n]) => s2 + price(W, +t2, day) * n, 0); };
export function sell(g, t2 = null, day = dayKey()) {
  const W = world(g.w);
  let v = 0;
  for (const [k, n] of Object.entries(g.stock)) {
    if (t2 != null && +k !== +t2) continue;
    v += price(W, +k, day) * n; delete g.stock[k];
  }
  g.coins += v; g.earned += v; g.st.sold += v;
  return v;
}

/* ---------- missions (3 à la fois) ---------- */
const mval = (g, type) => (type === 'dig' ? g.st.dug : type === 'depth' ? g.st.deep : type === 'focus' ? g.st.focus / 60 : type === 'tasks' ? g.st.tasks : type === 'sold' ? g.st.sold : g.found[type.slice(4)] || 0);
export function fillMissions(g) {
  while (g.missions.length < 3) {
    // ordre mélangé mais le même pour tout le monde ; on évite deux missions du même type en même temps
    const k = (g.mi * 7 + 3) % MISSIONS.length;
    g.mi++;
    const [type, n, reward, text] = MISSIONS[k];
    if (g.missions.some((m) => m.type === type)) continue;
    if (type === 'depth' && g.st.deep >= n) continue;
    g.missions.push({ type, n, reward, text: text.replace('{n}', n.toLocaleString('fr-FR')), start: type === 'depth' ? 0 : mval(g, type) });
  }
}
export const missionProgress = (g, m) => Math.min(1, (mval(g, m.type) - m.start) / m.n);
export function claim(g, i) {
  const m = g.missions[i];
  if (!m || missionProgress(g, m) < 1) return 0;
  g.missions.splice(i, 1);
  g.coins += m.reward; g.earned += m.reward;
  fillMissions(g);
  return m.reward;
}
/* Badges obtenus dans Fokus → Fokoins selon leur palier (les badges déjà gagnés comptent : prime de bienvenue) */
export function payBadges(g, owned) {
  let total = 0, n = 0;
  const first = g.badgesPaid.length === 0;
  for (const [id, tier] of owned) {
    if (g.badgesPaid.includes(id)) continue;
    g.badgesPaid.push(id); total += BADGE_FK[tier] || 0; n++;
  }
  if (first) total = Math.min(total, WELCOME_FK); // badges déjà gagnés avant la mine : prime plafonnée (l'équilibre du monde 1 reste intact)
  g.coins += total; g.earned += total;
  return { n, total };
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
  g.coins += n * TASK_REWARD; g.earned += n * TASK_REWARD; g.st.tasks += n;
  return n;
}
/* Choix du joueur : préférence de direction (les galeries restent irrégulières) */
export const setDir = (g, dir) => {
  g.pref = dir;
  if (dir !== 'down') g.hdir = dir;
  if (g.act === 'dig') { g.seg = 0; g.prog = 0; }
  if (g.act === 'done') g.act = 'dig';
};
export const goalCost = (W) => W.goal.book + W.goal.build;
