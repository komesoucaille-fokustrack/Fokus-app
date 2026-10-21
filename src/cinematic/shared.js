/* État partagé entre la timeline GSAP (engine.js) et la scène WebGL (Scene3D.jsx).
   Tout est en pixels CSS ; repère « carte » : origine au centre de la carte, x → droite, y → haut, z → hors de la carte. */
export const fx = {
  ready: false,   // scène 3D chargée et compilée
  active: false,  // animation en cours
  warm: false,    // rendu de préchauffage (compilation des shaders)
  k: 0,           // bascule 3D (0 = 2D, 1 = plongée complète)
  p: 0,           // progression affichée (%)
  to: 0,          // progression cible (%)
  arch: 0,        // redressement de l'arche (0 = à plat, 1 = debout)
  as: 0,          // échelle de l'arche
  blue: 0,        // intensité du néon bleu électrique
  flash: 0,       // flash blanc de l'arche à 100 %
  ring: -1,       // onde de choc (0 → 1), -1 = inactive
  moving: false,  // la barre avance → étincelles
  burst: 0,       // compteur de gerbes d'étincelles
  P: 1100,        // perspective CSS
  O: { x: 600, y: 400 },                                   // centre de la carte à l'écran (origine de la transformation)
  G: { cw: 720, barL: 20, barW: 680, by: 30, bh: 26, mob: false },
  m: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), // matrice CSS de la carte (hors perspective)
  archScreen: null, // position écran du fronton (pour les confettis)
  render: null,     // rend une image WebGL synchronisée (fourni par Scene3D)
};

/* Géométrie de la barre dans le repère carte */
export const barGeo = () => {
  const G = fx.G, x0 = G.barL - G.cw / 2;
  return { x0, x1: x0 + G.barW, y: -G.by, z: 8 * fx.k, h: G.bh, head: x0 + (fx.p / 100) * G.barW };
};
