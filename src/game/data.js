/* =====================================================================
   LA MINE (jeu à côté de Fokus, labo) — données : mondes, minerais, améliorations.
   Valeurs en Fokoins (Fk). Plus un minerai vaut cher, plus il est rare et profond.
   Monde 1 : ~12 h de concentration pour fabriquer le vélo (réglé avec scripts/mine-sim.mjs).
   ===================================================================== */
export const COIN = 'Fk';

/* Tuiles communes à tous les mondes : 0 = galerie creusée, 1 = terre, 2 = roche ; minerais ensuite (id ≥ 3) */
export const AIR = 0, DIRT = 1, ROCK = 2, BEDROCK = -1;

/* Durées visées (heures de concentration, d'après l'utilisateur) : monde 1 = 5 h, 2 = 10 h, 3 = 15 h, 4 = 20 h, 5 = 30 h, 6 = 30 h, 7 = 35 h.
   Mesurées avec node scripts/mine-sim.mjs (monde 1 ≈ 5,0 h ; monde 2 ≈ 10,0 h).
   Minerais du monde 1 (« La mine de ta ville », ancienne mine de charbon) :
   value (Fk), hard (dureté : temps de creusage relatif), w (poids de tirage), deep (préférence de profondeur), min (profondeur mini, en cases),
   colors = [base, clair, sombre] pour le dessin des cristaux / filons */
export const WORLDS = [
  {
    id: 1, name: 'La mine de ta ville', place: 'Ta ville · France', theme: 'ville', emoji: '🏘️', mul: 1, seed: 1013, width: 240, depth: 120, veins: 0.42,
    sky: ['#7ec8f2', '#bfe6ff'], town: '#2f4558',
    // couches de la coupe du sol (dessin) : [nom, couleur, clair, sombre], limites à la limite terre/roche puis à 30, 58, 88 cases
    layers: [['Terre', '#c98b55', '#e4ab76', '#99602f'], ['Argile', '#b9613f', '#d67f5a', '#87412b'], ['Schiste', '#8b4e6c', '#ab6b8c', '#5f3349'],
      ['Granit', '#4f5189', '#6d70aa', '#35366a'], ['Cristal', '#2f6c75', '#4d9099', '#1d4950']],
    layerAt: [30, 58, 88],
    goal: { id: 'velo', name: 'le vélo', emoji: '🚲', book: 1000, build: 3000, next: 'La région · Massif central' },
    tiles: {
      [DIRT]: { id: 'terre', name: 'Terre', value: 0.1, hard: 1, colors: ['#5c3d2c', '#7d5642', '#3a2419'] },
      [ROCK]: { id: 'pierre', name: 'Pierre', value: 0.5, hard: 1.5, colors: ['#433d52', '#5f5874', '#28232f'] },
    },
    ores: [
      { id: 'charbon', name: 'Charbon', value: 1, hard: 1.6, w: 40, deep: 0, min: 0, colors: ['#2a2a2e', '#55555c', '#121214'] },
      { id: 'cuivre', name: 'Cuivre', value: 2, hard: 1.8, w: 26, deep: 0.01, min: 3, colors: ['#c8743c', '#f0a46a', '#7c3f19'] },
      { id: 'fer', name: 'Fer', value: 10, hard: 2.1, w: 13, deep: 0.02, min: 8, colors: ['#b58a6e', '#e2c0a6', '#6d4c3a'] },
      { id: 'quartz', name: 'Quartz', shape: 'crystal', value: 20, hard: 2.3, w: 8, deep: 0.03, min: 14, colors: ['#e9eef5', '#ffffff', '#a8b4c6'] },
      { id: 'argent', name: 'Argent', value: 50, hard: 2.5, w: 4.5, deep: 0.04, min: 20, colors: ['#c9d2dc', '#f4f8fc', '#7e8894'] },
      { id: 'or', name: 'Or', value: 100, hard: 2.7, w: 2.2, deep: 0.05, min: 28, colors: ['#f2c230', '#fff0a0', '#a87a08'] },
      { id: 'amethyste', name: 'Améthyste', shape: 'crystal', value: 250, hard: 3, w: 0.7, deep: 0.06, min: 45, colors: ['#9b5de5', '#d8b4fe', '#5b2a9a'] },
      { id: 'geode', name: 'Géode géante', shape: 'geode', value: 1000, hard: 3.4, w: 0.08, deep: 0.07, min: 70, colors: ['#5ec4d6', '#c8f4fb', '#1f6e7c'] },
    ],
  },
  {
    id: 2, name: 'Les volcans d’Auvergne', place: 'La région · Massif central', theme: 'volcans', emoji: '🌋', mul: 6, tough: 4, seed: 2027, width: 240, depth: 140, veins: 0.42,
    sky: ['#7ec8f2', '#bfe6ff'], town: '#3a3440',
    goal: { id: 'voiture', name: 'la voiture', emoji: '🚗', book: 40000, build: 120000, next: 'Le pays · la côte atlantique' },
    tiles: {
      [DIRT]: { id: 'cendre', name: 'Cendre volcanique', value: 0.6, hard: 1.1, colors: ['#8d8682', '#b3aca6', '#5e5853'] },
      [ROCK]: { id: 'basalte', name: 'Basalte', value: 3, hard: 1.6, colors: ['#4b4a57', '#6c6b7a', '#2e2d38'] },
    },
    ores: [
      { id: 'pouzzolane', name: 'Pouzzolane', value: 6, hard: 1.7, w: 40, deep: 0, min: 0, colors: ['#c4472d', '#f2805e', '#7a2414'] },
      { id: 'soufre', name: 'Soufre', value: 14, hard: 1.8, w: 26, deep: 0.01, min: 3, colors: ['#f2d22e', '#fff59a', '#a88a08'] },
      { id: 'obsidienne', name: 'Obsidienne', value: 60, hard: 2.1, w: 13, deep: 0.02, min: 8, colors: ['#2b2236', '#6c5a8a', '#0d0a12'] },
      { id: 'olivine', name: 'Olivine', shape: 'crystal', value: 120, hard: 2.3, w: 8, deep: 0.03, min: 14, colors: ['#8bc34a', '#d7f59a', '#4a7a1c'] },
      { id: 'zircon', name: 'Zircon', shape: 'crystal', value: 300, hard: 2.5, w: 4.5, deep: 0.04, min: 20, colors: ['#ff8a3d', '#ffd0a8', '#a8460c'] },
      { id: 'grenat', name: 'Grenat', shape: 'crystal', value: 600, hard: 2.7, w: 2.2, deep: 0.05, min: 28, colors: ['#c0283c', '#ff8a9a', '#6a0f1c'] },
      { id: 'saphir', name: 'Saphir du Velay', shape: 'crystal', value: 1500, hard: 3, w: 0.7, deep: 0.06, min: 45, colors: ['#2f6bd8', '#a8c8ff', '#123a8a'] },
      { id: 'lave', name: 'Cœur de lave', shape: 'geode', value: 6000, hard: 3.4, w: 0.08, deep: 0.07, min: 70, colors: ['#ff6a1f', '#ffe08a', '#a8240c'] },
    ],
    layers: [['Cendre', '#9a918b', '#bcb4ad', '#6b645f'], ['Pouzzolane', '#b4533c', '#d77a5f', '#80301f'], ['Basalte', '#4f4d5c', '#6e6c80', '#33313e'],
      ['Lave figée', '#3d2c3f', '#5b4560', '#251a28'], ['Braises', '#5a2a24', '#8a3f2c', '#3a1814']],
    layerAt: [32, 64, 100],
  },
];

/* Pioches : une matière par niveau (le fer de la pioche change de couleur sur le personnage) */
export const PICKS = [
  ['Pioche en bois', '#b07a48'], ['Pioche en pierre', '#8d939b'], ['Pioche en cuivre', '#d0793c'], ['Pioche en fer', '#cfd6dd'],
  ['Pioche en acier', '#9fb7cc'], ['Pioche dorée', '#f5c542'], ['Pioche en émeraude', '#34d399'], ['Pioche en rubis', '#f05252'],
  ['Pioche en saphir', '#4f8ff7'], ['Pioche en améthyste', '#b06df5'], ['Pioche en diamant', '#a5f3fc'], ['Pioche Fokus', '#10b981'], ['Pioche céleste', '#fff3a3'],
];
/* Améliorations par rayon de la boutique : coût du niveau n = base × mult^n ; effet par niveau (voir sim.js) */
export const SHOP_CATS = [['tools', '⛏️ Outils'], ['gear', '🎒 Équipement'], ['body', '💪 Forme'], ['auto', '⚙️ Automatisation'], ['style', '👕 Vestiaire']];
export const UPGRADES = [
  { id: 'pick', cat: 'tools', name: 'Pioche', desc: 'Creuse plus vite', max: 12, base: 60, mult: 2.05, label: (n) => PICKS[n][0], fx: (n) => `× ${(1.3 ** n).toFixed(2)} vitesse` },
  { id: 'bag', cat: 'gear', name: 'Sac à dos', emoji: '🎒', desc: 'Plus de place avant de remonter', max: 12, base: 40, mult: 1.9, fx: (n) => `${bagCap(n)} places` },
  { id: 'lamp', cat: 'gear', name: 'Lampe frontale', emoji: '🔦', desc: 'Éclaire plus loin : le mineur repère les minerais cachés autour de lui et va les chercher', max: 6, base: 120, mult: 2.4, fx: (n) => `repère à ${1 + Math.floor(n / 2)} case${n > 1 ? 's' : ''} · lumière ${(3.5 + n * 0.7).toFixed(1).replace('.', ',')} cases` },
  { id: 'lant', cat: 'gear', name: 'Lanternes', emoji: '🏮', desc: 'Le mineur accroche plus de lanternes : les galeries sont mieux éclairées', max: 4, base: 150, mult: 2.6, fx: (n) => `une lanterne toutes les ${[7, 6, 5, 4, 3][n]} cases` },
  { id: 'compass', cat: 'tools', name: 'Boussole du géologue', emoji: '🧭', desc: 'Le mineur sent les filons de plus loin et va les chercher', max: 3, base: 500, mult: 3, fx: (n) => `+${n} case${n > 1 ? 's' : ''} de repérage` },
  { id: 'cart', cat: 'gear', name: 'Wagonnet et rails', emoji: '🚃', desc: 'Les allers-retours jusqu’au marché se font en wagonnet', max: 6, base: 300, mult: 2.3, fx: (n) => `trajets × ${(1 + 0.35 * n).toFixed(2).replace('.', ',')} plus rapides` },
  { id: 'snack', cat: 'body', name: 'Casse-croûte', emoji: '🥪', desc: 'Un bon repas : les pauses du mineur sont plus courtes', max: 4, base: 400, mult: 2.5, fx: (n) => `repos de ${Math.round(10 * (1 - 0.15 * n))} min` },
  { id: 'loupe', cat: 'auto', name: 'Loupe de joaillier', emoji: '🔍', desc: 'Les pierres sont mieux triées : elles se vendent plus cher au marché', max: 5, base: 350, mult: 2.4, fx: (n) => `prix de vente +${8 * n} %` },
  { id: 'boots', cat: 'body', name: 'Chaussures', emoji: '🥾', desc: 'Marche plus vite dans les galeries', max: 10, base: 80, mult: 2, fx: (n) => `× ${(1 + 0.25 * n).toFixed(2)} vitesse` },
  { id: 'stam', cat: 'body', name: 'Endurance', emoji: '💪', desc: 'Mine plus longtemps avant de se reposer', max: 4, base: 600, mult: 3, fx: (n) => `${stamina(n) / 60} min de minage pour 10 min de repos` },
  { id: 'auto', cat: 'auto', name: 'Tri automatique', emoji: '♻️', desc: 'La terre et la pierre sont vendues sur place (ne prennent plus de place dans le sac)', max: 1, base: 250, mult: 1, fx: (n) => (n ? 'Activé' : 'Désactivé') },
  { id: 'seller', cat: 'auto', name: 'Contrat avec le marché', emoji: '🤝', desc: 'Les minerais sont vendus dès l’arrivée, au prix du jour (sinon ils vont au coffre)', max: 1, base: 900, mult: 1, fx: (n) => (n ? 'Vente automatique' : 'Tu vends toi-même') },
];
/* Vestiaire : tenues du personnage (couleurs de la salopette, de la chemise, du foulard et du casque) */
export const SKINS = [
  { id: 'classic', name: 'Classique', cost: 0, c: null },
  { id: 'foret', name: 'Garde forestier', cost: 1500, c: { suit: '#4a7a3c', shirt: '#eadfb8', scarf: '#c0843f', helm: '#86b85a' } },
  { id: 'nuit', name: 'Nuit étoilée', cost: 2500, c: { suit: '#2b3170', shirt: '#cdd7ff', scarf: '#f5c542', helm: '#eef1ff' } },
  { id: 'rose', name: 'Rose baddie', cost: 3500, c: { suit: '#e0629e', shirt: '#ffe3f0', scarf: '#ffffff', helm: '#ffb3d1' } },
  { id: 'volcan', name: 'Cœur de volcan', cost: 6000, c: { suit: '#3b2a2e', shirt: '#ffb27a', scarf: '#ff5a1f', helm: '#ff8a3d' } },
  { id: 'fokus', name: 'Émeraude Fokus', cost: 10000, c: { suit: '#0f5a3c', shirt: '#d1fae5', scarf: '#10b981', helm: '#34d399' } },
  { id: 'or', name: 'Mineur d’or', cost: 25000, c: { suit: '#1d1d24', shirt: '#f5e6b8', scarf: '#f5c542', helm: '#f5c542' } },
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
  ['ore#1', 6, 80, 'Trouve {n} {ore}'], ['ore#2', 4, 120, 'Trouve {n} {ore}'], ['ore#3', 3, 160, 'Trouve {n} {ore}'],
  ['ore#4', 2, 220, 'Trouve {n} {ore}'], ['ore#5', 1, 300, 'Trouve {n} {ore}'],
  ['depth', 20, 120, 'Descends à {n} m'], ['depth', 50, 260, 'Descends à {n} m'], ['depth', 100, 500, 'Descends à {n} m'],
  ['focus', 50, 100, 'Concentre-toi {n} min'], ['focus', 120, 220, 'Concentre-toi {n} min'],
  ['tasks', 3, 90, 'Valide {n} tâches dans Fokus'], ['tasks', 8, 200, 'Valide {n} tâches dans Fokus'],
  ['sold', 300, 120, 'Vends pour {n} Fk au marché'], ['sold', 1500, 350, 'Vends pour {n} Fk au marché'],
];
export const bagCap = (n) => 12 + 6 * n;
export const stamina = (n) => [60, 75, 90, 105, 120][n] * 60;
export const upCost = (u, n) => Math.round(u.base * u.mult ** n);
export const REST = 600; // 10 min de repos
export const BASE_DIG = 2.4; // secondes pour une tuile de dureté 1 avec la pioche de départ
export const WALK = 1.4; // tuiles par seconde (montée : × 0,6)
/* Récompense des tâches validées dans Fokus */
export const TASK_REWARD = 5;

export const world = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];
