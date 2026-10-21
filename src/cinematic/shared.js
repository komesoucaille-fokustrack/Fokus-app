/* État partagé entre la timeline GSAP (engine.js) et la scène WebGL (Scene3D.jsx).
   Tout est en pixels CSS. Repère « carte » : origine au centre de l'écran (= œil de la caméra),
   x → droite, y → haut, z → vers la caméra. La face de la carte est le plan z = 0 ;
   au repos, la carte 3D recouvre exactement la carte DOM. */
export const fx = {
  ready: false,   // scène 3D chargée et compilée
  active: false,  // animation en cours
  warm: false,    // rendu de préchauffage (compilation des shaders)
  race: 0,        // identifiant de la course (reconstruit textures/géométries)
  intro: 0,       // entrée dans la vue 3D (0 → 1)
  zoom: 0,        // plan large de la carte (0) → gros plan sur la barre (1)
  k: 0,           // entrée dans la vue 3D effective
  lay: 0,         // pose A inclinée (0) → pose B posée à plat (1), suit l'avancement de la course
  lay0: 0,        // plancher de lay (garantit la pose à plat à l'arrivée)
  frame: 0,       // cadrage : gros plan sur le front (0) → carte entière (1), en fin de course
  lift: 0,        // décollement de la carte hors de la page
  p: 0,           // front de la barre bleue (%)
  old: 0,         // progression avant validation (%)
  to: 0,          // progression cible (%)
  shown: 0,       // pourcentage affiché sur la face de la carte
  pastel: 1,      // opacité du gel pastel
  blue: 0,        // intensité du néon bleu électrique
  arch: 0,        // redressement de l'arche (0 = à plat, 1 = debout)
  as: 0,          // échelle de l'arche
  flash: 0,       // flash blanc de l'arche à 100 %
  ring: -1,       // onde de choc (0 → 1), -1 = inactive
  moving: false,  // la barre avance → étincelles
  speed: 0,       // allure du moment (0 → 1, 1 = pic de vitesse de la course)
  fxLevel: 0,     // intensité de l'effet de vitesse, selon le pourcentage validé
  sparkLevel: 0,  // quantité d'étincelles, selon le pourcentage validé
  burst: 0,       // compteur de gerbes d'étincelles
  cut: 0,         // détourage lumineux du contour de la carte (0 → 1)
  cutGlow: 0,     // intensité du détourage
  emit: [],       // points d'émission d'étincelles additionnels
  P: 1100,        // perspective (distance œil → écran)
  O: { x: 600, y: 400 },                                        // œil de la caméra à l'écran
  C: { x0: -380, y0: -80, w: 760, h: 160, r: 16 },                // carte au repos (coin haut-gauche, CSS relatif à O)
  G: { x0: -340, y: 40, barW: 680, bh: 26, mob: false },          // barre au repos (x0, y en CSS relatifs à O)
  face: null,     // contenu de la face (textes et piste mesurés sur le DOM)
  m: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), // matrice CSS de la carte (hors perspective)
  archScreen: null, // position écran du fronton (pour les confettis)
  render: null,     // rend une image WebGL synchronisée (fourni par Scene3D)
};

export const TRACK_Z = 0;  // face de la carte
export const GEL_TOP = 8;  // dessus du gel de la barre

/* Géométrie de la barre dans le repère carte (y vers le haut) */
export const barGeo = () => {
  const G = fx.G, x0 = G.x0;
  return { x0, x1: x0 + G.barW, y: -G.y, z: GEL_TOP, h: G.bh, w: G.barW, head: x0 + (fx.p / 100) * G.barW };
};
