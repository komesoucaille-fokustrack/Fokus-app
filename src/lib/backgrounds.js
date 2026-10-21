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
  // Photos haute définition (Unsplash, licence libre) : version paysage 2560 px + version portrait 1290×2796
  { id: 'p01', group: 'photo', name: 'Lampe ambrée', by: 'Apekshit Srivastava', img: 'bg/p01-L.webp', portrait: 'bg/p01-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p02', group: 'photo', name: 'Salon rouge', by: 'The Grid Rooms', img: 'bg/p02-L.webp', portrait: 'bg/p02-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p03', group: 'photo', name: 'Lounge chair', by: 'Clay Banks', img: 'bg/p03-L.webp', portrait: 'bg/p03-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p04', group: 'photo', name: 'Fougères', by: 'Nima Saffari', img: 'bg/p04-L.webp', portrait: 'bg/p04-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p05', group: 'photo', name: 'Horloge chromée', by: 'Djim Loic', img: 'bg/p05-L.webp', portrait: 'bg/p05-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p06', group: 'photo', name: 'Bureau flip', by: 'Jerry Wang', img: 'bg/p06-L.webp', portrait: 'bg/p06-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p07', group: 'photo', name: 'Flip sur brique', by: 'Goeran Meyer', img: 'bg/p07-L.webp', portrait: 'bg/p07-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p08', group: 'photo', name: 'GT de nuit', by: 'Stephen Olmo', img: 'bg/p08-L.webp', portrait: 'bg/p08-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p09', group: 'photo', name: '911 classique', by: 'Aleksandr Zaitsev', img: 'bg/p09-L.webp', portrait: 'bg/p09-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p10', group: 'photo', name: 'Sommet noir', by: 'Kerensa Pickett', img: 'bg/p10-L.webp', portrait: 'bg/p10-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p11', group: 'photo', name: 'Sommet dans la brume', by: 'Tyler Lastovich', img: 'bg/p11-L.webp', portrait: 'bg/p11-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p12', group: 'photo', name: 'Forêt sombre', by: 'Roksolana Zasiadko', img: 'bg/p12-L.webp', portrait: 'bg/p12-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p13', group: 'photo', name: 'Chat au salon', by: 'Chris Chow', img: 'bg/p13-L.webp', portrait: 'bg/p13-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p14', group: 'photo', name: 'Poudreuse 1930', by: 'Austrian National Library', img: 'bg/p14-L.webp', portrait: 'bg/p14-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p15', group: 'photo', name: 'Machine à écrire', by: 'Johnny Briggs', img: 'bg/p15-L.webp', portrait: 'bg/p15-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p16', group: 'photo', name: 'Sentier en forêt', by: 'Patrick Mueller', img: 'bg/p16-L.webp', portrait: 'bg/p16-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p17', group: 'photo', name: 'Vinyle', by: 'Pierre Gui', img: 'bg/p17-L.webp', portrait: 'bg/p17-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p18', group: 'photo', name: 'Faille moussue', by: 'Yuheng Ouyang', img: 'bg/p18-L.webp', portrait: 'bg/p18-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p19', group: 'photo', name: 'Hautes terres', by: 'K. K.', img: 'bg/p19-L.webp', portrait: 'bg/p19-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p20', group: 'photo', name: 'Brume sur les pins', by: 'Tobias Tullius', img: 'bg/p20-L.webp', portrait: 'bg/p20-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  // Dégradés
  { id: 'noir', group: 'grad', name: 'Noir', css: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,.05), transparent 70%), #050505', ink: '#fff', flip: 'dark' },
  { id: 'graphite', group: 'grad', name: 'Graphite', css: 'radial-gradient(ellipse at 30% 20%, #2a2a30, #0c0c0e 70%)', ink: '#fff', flip: 'dark' },
  { id: 'foret', group: 'grad', name: 'Forêt', css: 'radial-gradient(ellipse at 70% 15%, #35503f, #16251c 55%, #0b120e)', ink: '#f4f1e8', flip: 'dark' },
  { id: 'braise', group: 'grad', name: 'Braise', css: 'radial-gradient(ellipse at 75% 80%, #e2783c 0%, #8a3518 30%, #2b120a 65%, #120806)', ink: '#fff3e6', flip: 'dark' },
  { id: 'papier', group: 'grad', name: 'Papier', css: 'radial-gradient(ellipse at 50% 30%, #f6f2ea, #e6dfd2)', ink: '#141414', flip: 'light' },
];
export const BG_GROUPS = [['concept', 'Concepts'], ['photo', 'Photos'], ['grad', 'Dégradés']];
export const bgOf = (id) => BGS.find((b) => b.id === id) || BGS.find((b) => b.id === 'noir');
export const thumbOf = (b) => (b.img ? b.img.replace(/(-L)?\.(jpg|webp)$/, '-mini.jpg') : null);
