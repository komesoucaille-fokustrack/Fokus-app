/* État partagé entre la timeline GSAP (engine.js) et la scène WebGL (Scene3D.jsx).
   Tout est en pixels CSS. Repère « bloc » : origine au centre de l'écran (= œil de la caméra),
   x → droite, y → haut, z → vers la caméra. Au repos, la piste 3D recouvre exactement la barre DOM. */
export const fx = {
  ready: false,   // scène 3D chargée et compilée
  active: false,  // animation en cours
  warm: false,    // rendu de préchauffage (compilation des shaders)
  race: 0,        // identifiant de la course (reconstruit textures/géométries)
  k: 0,           // caméra de poursuite (0 = vue 2D, 1 = 3e personne derrière la barre)
  lift: 0,        // détachement du bloc de progression
  p: 0,           // front de la barre bleue (%)
  old: 0,         // progression pastel avant validation (%)
  to: 0,          // progression cible (%)
  pastel: 1,      // opacité du remplissage pastel
  blue: 0,        // intensité du néon bleu électrique
  rail: 0,        // allumage des rails de la piste (0 → 1, de 0 % vers l'arrivée)
  ground: 0,      // sol réfléchissant
  arch: 0,        // redressement de l'arche (0 = à plat, 1 = debout)
  as: 0,          // échelle de l'arche
  flash: 0,       // flash blanc de l'arche à 100 %
  ring: -1,       // onde de choc (0 → 1), -1 = inactive
  moving: false,  // la barre avance → étincelles
  burst: 0,       // compteur de gerbes d'étincelles
  P: 1100,        // perspective (distance œil → écran)
  O: { x: 600, y: 400 },                                       // œil de la caméra à l'écran
  G: { x0: -340, y: 0, barW: 680, bh: 26, mob: false },          // barre au repos (x0, y en px CSS relatifs à O)
  m: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), // matrice CSS du bloc (hors perspective)
  archScreen: null, // position écran du fronton (pour les confettis)
  render: null,     // rend une image WebGL synchronisée (fourni par Scene3D)
  intro: 0,         // entrée dans la vue de poursuite (k = intro × inclinaison restante)
  cut: 0,           // découpe laser du contour du bloc (0 → 1)
  cutGlow: 0,       // incandescence de la découpe
  emit: [],         // points d'émission d'étincelles de la découpe (repère bloc)
};

export const TRACK_Z = 8; // épaisseur de la piste : la surface de roulement est à z = 8

/* Géométrie de la barre dans le repère bloc (y vers le haut) */
export const barGeo = () => {
  const G = fx.G, x0 = G.x0;
  return { x0, x1: x0 + G.barW, y: -G.y, z: TRACK_Z + 1, h: G.bh, w: G.barW, head: x0 + (fx.p / 100) * G.barW };
};
