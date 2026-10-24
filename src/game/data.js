/* =====================================================================
   LA MINE (jeu à côté de Fokus, labo) — données : mondes, minerais, améliorations.
   Valeurs en Fokoins (Fk). Plus un minerai vaut cher, plus il est rare et profond.
   Monde 1 : ~12 h de concentration pour fabriquer le vélo (réglé avec scripts/mine-sim.mjs).
   ===================================================================== */
export const COIN = 'Fk';

/* Tuiles communes à tous les mondes : 0 = galerie creusée, 1 = terre, 2 = roche ; minerais ensuite (id ≥ 3) */
export const AIR = 0, DIRT = 1, ROCK = 2, BEDROCK = -1;

/* Minerais du monde 1 (« La mine de ta ville », ancienne mine de charbon) :
   value (Fk), hard (dureté : temps de creusage relatif), w (poids de tirage), deep (préférence de profondeur), min (profondeur mini, en cases),
   colors = [base, clair, sombre] pour le dessin des cristaux / filons */
export const WORLDS = [
  {
    id: 1, name: 'La mine de ta ville', place: 'Ta ville · France', seed: 1013, width: 240, depth: 120, veins: 0.42,
    sky: ['#7ec8f2', '#bfe6ff'], town: '#2f4558',
    goal: { id: 'velo', name: 'le vélo', emoji: '🚲', book: 3000, build: 9000, next: 'La région · Massif central' },
    tiles: {
      [DIRT]: { id: 'terre', name: 'Terre', value: 0.1, hard: 1, colors: ['#5c3d2c', '#7d5642', '#3a2419'] },
      [ROCK]: { id: 'pierre', name: 'Pierre', value: 0.5, hard: 1.5, colors: ['#433d52', '#5f5874', '#28232f'] },
    },
    ores: [
      { id: 'charbon', name: 'Charbon', value: 1, hard: 1.6, w: 40, deep: 0, min: 0, colors: ['#2a2a2e', '#55555c', '#121214'] },
      { id: 'cuivre', name: 'Cuivre', value: 2, hard: 1.8, w: 26, deep: 0.01, min: 3, colors: ['#c8743c', '#f0a46a', '#7c3f19'] },
      { id: 'fer', name: 'Fer', value: 10, hard: 2.1, w: 13, deep: 0.02, min: 8, colors: ['#b58a6e', '#e2c0a6', '#6d4c3a'] },
      { id: 'quartz', name: 'Quartz', value: 20, hard: 2.3, w: 8, deep: 0.03, min: 14, colors: ['#e9eef5', '#ffffff', '#a8b4c6'] },
      { id: 'argent', name: 'Argent', value: 50, hard: 2.5, w: 4.5, deep: 0.04, min: 20, colors: ['#c9d2dc', '#f4f8fc', '#7e8894'] },
      { id: 'or', name: 'Or', value: 100, hard: 2.7, w: 2.2, deep: 0.05, min: 28, colors: ['#f2c230', '#fff0a0', '#a87a08'] },
      { id: 'amethyste', name: 'Améthyste', value: 250, hard: 3, w: 0.7, deep: 0.06, min: 45, colors: ['#9b5de5', '#d8b4fe', '#5b2a9a'] },
      { id: 'geode', name: 'Géode géante', value: 1000, hard: 3.4, w: 0.08, deep: 0.07, min: 70, colors: ['#5ec4d6', '#c8f4fb', '#1f6e7c'] },
    ],
  },
];

/* Pioches : une matière par niveau (le fer de la pioche change de couleur sur le personnage) */
export const PICKS = [
  ['Pioche en bois', '#b07a48'], ['Pioche en pierre', '#8d939b'], ['Pioche en cuivre', '#d0793c'], ['Pioche en fer', '#cfd6dd'],
  ['Pioche en acier', '#9fb7cc'], ['Pioche dorée', '#f5c542'], ['Pioche en émeraude', '#34d399'], ['Pioche en rubis', '#f05252'],
  ['Pioche en saphir', '#4f8ff7'], ['Pioche en améthyste', '#b06df5'], ['Pioche en diamant', '#a5f3fc'], ['Pioche Fokus', '#10b981'], ['Pioche céleste', '#fff3a3'],
];
/* Améliorations par rayon de la boutique : coût du niveau n = base × mult^n ; effet par niveau (voir sim.js) */
export const SHOP_CATS = [['tools', '⛏️ Outils'], ['gear', '🎒 Équipement'], ['body', '💪 Forme'], ['auto', '⚙️ Automatisation']];
export const UPGRADES = [
  { id: 'pick', cat: 'tools', name: 'Pioche', desc: 'Creuse plus vite', max: 12, base: 60, mult: 2.05, label: (n) => PICKS[n][0], fx: (n) => `× ${(1.3 ** n).toFixed(2)} vitesse` },
  { id: 'bag', cat: 'gear', name: 'Sac à dos', emoji: '🎒', desc: 'Plus de place avant de remonter', max: 12, base: 40, mult: 1.9, fx: (n) => `${bagCap(n)} places` },
  { id: 'lamp', cat: 'gear', name: 'Lampe frontale', emoji: '🔦', desc: 'Éclaire plus loin : le mineur repère les minerais cachés autour de lui et va les chercher', max: 6, base: 120, mult: 2.4, fx: (n) => `repère à ${1 + Math.floor(n / 2)} case${n > 1 ? 's' : ''} · lumière ${(3.5 + n * 0.7).toFixed(1).replace('.', ',')} cases` },
  { id: 'lant', cat: 'gear', name: 'Lanternes', emoji: '🏮', desc: 'Le mineur accroche plus de lanternes : les galeries sont mieux éclairées', max: 4, base: 150, mult: 2.6, fx: (n) => `une lanterne toutes les ${[7, 6, 5, 4, 3][n]} cases` },
  { id: 'boots', cat: 'body', name: 'Chaussures', emoji: '🥾', desc: 'Marche plus vite dans les galeries', max: 10, base: 80, mult: 2, fx: (n) => `× ${(1 + 0.25 * n).toFixed(2)} vitesse` },
  { id: 'stam', cat: 'body', name: 'Endurance', emoji: '💪', desc: 'Mine plus longtemps avant de se reposer', max: 4, base: 600, mult: 3, fx: (n) => `${stamina(n) / 60} min de minage pour 10 min de repos` },
  { id: 'auto', cat: 'auto', name: 'Tri automatique', emoji: '♻️', desc: 'La terre et la pierre sont vendues sur place (ne prennent plus de place dans le sac)', max: 1, base: 250, mult: 1, fx: (n) => (n ? 'Activé' : 'Désactivé') },
  { id: 'seller', cat: 'auto', name: 'Contrat avec le marché', emoji: '🤝', desc: 'Les minerais sont vendus dès l’arrivée, au prix du jour (sinon ils vont au coffre)', max: 1, base: 900, mult: 1, fx: (n) => (n ? 'Vente automatique' : 'Tu vends toi-même') },
];
/* Prix du marché : chaque minerai varie chaque jour entre −25 % et +25 % (même cours pour tout le monde) */
export function priceMul(oreId, day) {
  let h = 2166136261;
  for (const c of oreId + ':' + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 0.75 + ((h >>> 0) % 1000) / 1999;
}
/* Badges de Fokus → Fokoins (plus le palier est dur, plus ça rapporte) */
export const BADGE_FK = [0, 40, 120, 300, 800];
export const WELCOME_FK = 1500; // prime de bienvenue maximale pour les badges obtenus avant de commencer la mine
/* Missions (3 à la fois, renouvelées) : [type, cible, récompense, texte] — {n} = cible */
export const MISSIONS = [
  ['dig', 40, 60, 'Creuse {n} blocs'], ['dig', 120, 150, 'Creuse {n} blocs'], ['dig', 300, 320, 'Creuse {n} blocs'],
  ['ore:cuivre', 6, 80, 'Trouve {n} cuivre'], ['ore:fer', 4, 120, 'Trouve {n} fer'], ['ore:quartz', 3, 160, 'Trouve {n} quartz'],
  ['ore:argent', 2, 220, 'Trouve {n} argent'], ['ore:or', 1, 300, 'Trouve {n} pépite d’or'],
  ['depth', 20, 120, 'Descends à {n} m'], ['depth', 50, 260, 'Descends à {n} m'], ['depth', 100, 500, 'Descends à {n} m'],
  ['focus', 50, 100, 'Concentre-toi {n} min'], ['focus', 120, 220, 'Concentre-toi {n} min'],
  ['tasks', 3, 90, 'Valide {n} tâches dans Fokus'], ['tasks', 8, 200, 'Valide {n} tâches dans Fokus'],
  ['sold', 300, 120, 'Vends pour {n} Fk au marché'], ['sold', 1500, 350, 'Vends pour {n} Fk au marché'],
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
