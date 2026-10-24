/* =====================================================================
   LA MINE (jeu à côté de Fokus, labo) — données : mondes, minerais, améliorations.
   Valeurs en Fokoins (Fk). Plus un minerai vaut cher, plus il est rare et profond.
   Monde 1 : ~12 h de concentration pour fabriquer le vélo (réglé avec scripts/mine-sim.mjs).
   ===================================================================== */
export const COIN = 'Fk';

/* Tuiles communes à tous les mondes : 0 = galerie creusée, 1 = terre, 2 = roche ; minerais ensuite (id ≥ 3) */
export const AIR = 0, DIRT = 1, ROCK = 2, BEDROCK = -1;

/* Minerais du monde 1 (« La mine de ta ville », ancienne mine de charbon) :
   value (Fk), hard (dureté : temps de creusage relatif), w (poids de tirage), deep (préférence de profondeur),
   colors = [base, clair, sombre] pour le dessin des cristaux / filons */
export const WORLDS = [
  {
    id: 1, name: 'La mine de ta ville', place: 'Ta ville · France', seed: 1013, width: 120, depth: 120,
    sky: ['#7ec8f2', '#bfe6ff'], town: '#2f4558',
    goal: { id: 'velo', name: 'le vélo', emoji: '🚲', book: 2500, build: 7500, next: 'La région · Massif central' },
    tiles: {
      [DIRT]: { id: 'terre', name: 'Terre', value: 0.1, hard: 1, colors: ['#8a5a3b', '#a8714b', '#5e3b24'] },
      [ROCK]: { id: 'pierre', name: 'Pierre', value: 0.5, hard: 1.5, colors: ['#7b7f86', '#9aa0a8', '#52565c'] },
    },
    ores: [
      { id: 'charbon', name: 'Charbon', value: 1, hard: 1.6, w: 40, deep: 0, colors: ['#2a2a2e', '#55555c', '#121214'] },
      { id: 'cuivre', name: 'Cuivre', value: 2, hard: 1.8, w: 26, deep: 0.01, colors: ['#c8743c', '#f0a46a', '#7c3f19'] },
      { id: 'fer', name: 'Fer', value: 10, hard: 2.1, w: 13, deep: 0.02, colors: ['#b58a6e', '#e2c0a6', '#6d4c3a'] },
      { id: 'quartz', name: 'Quartz', value: 20, hard: 2.3, w: 8, deep: 0.03, colors: ['#e9eef5', '#ffffff', '#a8b4c6'] },
      { id: 'argent', name: 'Argent', value: 50, hard: 2.5, w: 4.5, deep: 0.04, colors: ['#c9d2dc', '#f4f8fc', '#7e8894'] },
      { id: 'or', name: 'Or', value: 100, hard: 2.7, w: 2.2, deep: 0.05, colors: ['#f2c230', '#fff0a0', '#a87a08'] },
      { id: 'amethyste', name: 'Améthyste', value: 250, hard: 3, w: 0.7, deep: 0.06, colors: ['#9b5de5', '#d8b4fe', '#5b2a9a'] },
      { id: 'geode', name: 'Géode géante', value: 1000, hard: 3.4, w: 0.08, deep: 0.07, colors: ['#5ec4d6', '#c8f4fb', '#1f6e7c'] },
    ],
  },
];

/* Améliorations : coût du niveau n = base × mult^n ; effet par niveau (voir sim.js) */
export const UPGRADES = [
  { id: 'pick', name: 'Pioche', emoji: '⛏️', desc: 'Creuse plus vite', max: 12, base: 60, mult: 2.05, fx: (n) => `× ${(1.3 ** n).toFixed(2)} vitesse` },
  { id: 'bag', name: 'Sac à dos', emoji: '🎒', desc: 'Plus de place avant de remonter', max: 12, base: 40, mult: 1.9, fx: (n) => `${bagCap(n)} places` },
  { id: 'boots', name: 'Chaussures', emoji: '🥾', desc: 'Marche plus vite dans les galeries', max: 10, base: 80, mult: 2, fx: (n) => `× ${(1 + 0.25 * n).toFixed(2)} vitesse` },
  { id: 'stam', name: 'Endurance', emoji: '💪', desc: 'Mine plus longtemps avant de se reposer', max: 4, base: 600, mult: 3, fx: (n) => `${stamina(n) / 60} min de minage pour 10 min de repos` },
  { id: 'auto', name: 'Tri automatique', emoji: '♻️', desc: 'La terre et la pierre sont vendues sur place (ne prennent plus de place)', max: 1, base: 250, mult: 1, fx: (n) => (n ? 'Activé' : 'Désactivé') },
];
export const bagCap = (n) => 12 + 6 * n;
export const stamina = (n) => [60, 75, 90, 105, 120][n] * 60;
export const upCost = (u, n) => Math.round(u.base * u.mult ** n);
export const REST = 600; // 10 min de repos
export const BASE_DIG = 3.6; // secondes pour une tuile de dureté 1 avec la pioche de départ
export const WALK = 1.4; // tuiles par seconde (montée : × 0,6)
/* Récompense des tâches validées dans Fokus */
export const TASK_REWARD = 5;

export const world = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];
