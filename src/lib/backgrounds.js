/* Fonds du Pomodoro : concepts (décor vectoriel où le temps fait partie de l'image), photos (public/bg) et dégradés.
   ink = couleur du texte et des pastilles ; scrim = voile de lisibilité pour les photos ('dark' | 'light', opacité) ;
   flip = cartes claires ou sombres ; pos = cadrage de la photo. Les concepts affichent leur propre chrono. */
export const BGS = [
  // Concepts
  { id: 'c-gt', group: 'concept', name: 'Affiche GT', concept: 'gt', ink: '#e7efe9', flip: 'dark' },
  { id: 'c-bauhaus', group: 'concept', name: 'Bauhaus', concept: 'bauhaus', ink: '#141414', flip: 'light' },
  { id: 'c-horizon', group: 'concept', name: 'Horizon', concept: 'horizon', ink: '#fff', flip: 'dark' },
  { id: 'c-maree', group: 'concept', name: 'Marée', concept: 'maree', ink: '#fff', flip: 'dark', blend: true },
  { id: 'c-topo', group: 'concept', name: 'Topographie', concept: 'topo', ink: '#efe6d2', flip: 'dark' },
  // Photos
  { id: 'salon-orange', group: 'photo', name: 'Salon orange', img: 'bg/salon-orange.jpg', pos: '50% 55%', ink: '#fff3e6', scrim: ['dark', 0.35], flip: 'dark' },
  { id: 'gt-vert', group: 'photo', name: 'GT verte', img: 'bg/gt-vert.jpg', pos: '50% 60%', ink: '#eef3ee', scrim: ['dark', 0.2], flip: 'dark' },
  // Dégradés
  { id: 'noir', group: 'grad', name: 'Noir', css: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,.05), transparent 70%), #050505', ink: '#fff', flip: 'dark' },
  { id: 'graphite', group: 'grad', name: 'Graphite', css: 'radial-gradient(ellipse at 30% 20%, #2a2a30, #0c0c0e 70%)', ink: '#fff', flip: 'dark' },
  { id: 'foret', group: 'grad', name: 'Forêt', css: 'radial-gradient(ellipse at 70% 15%, #35503f, #16251c 55%, #0b120e)', ink: '#f4f1e8', flip: 'dark' },
  { id: 'braise', group: 'grad', name: 'Braise', css: 'radial-gradient(ellipse at 75% 80%, #e2783c 0%, #8a3518 30%, #2b120a 65%, #120806)', ink: '#fff3e6', flip: 'dark' },
  { id: 'papier', group: 'grad', name: 'Papier', css: 'radial-gradient(ellipse at 50% 30%, #f6f2ea, #e6dfd2)', ink: '#141414', flip: 'light' },
];
export const BG_GROUPS = [['concept', 'Concepts'], ['photo', 'Photos'], ['grad', 'Dégradés']];
export const bgOf = (id) => BGS.find((b) => b.id === id) || BGS.find((b) => b.id === 'noir');
export const thumbOf = (b) => (b.img ? b.img.replace('.jpg', '-mini.jpg') : null);
