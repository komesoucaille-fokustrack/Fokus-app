/* Fonds du Pomodoro et de l'app : concepts (décor vectoriel où le temps fait partie de l'image), photos (public/bg,
   classées par `sub` : rose, ville, mer, nature, cosy, rétro) et dégradés.
   ink = couleur du texte et des pastilles ; scrim = voile de lisibilité pour les photos ('dark' | 'light', opacité) ;
   flip = cartes claires ou sombres ; pos = cadrage de la photo. Les concepts affichent leur propre chrono. */
export const BGS = [
  // Thèmes de l'app (fonds pré-calculés : lumière diffuse et grain rendus à l'avance, aucun filtre en direct)
  { id: 't-obsidienne', group: 'theme', name: 'Obsidienne', theme: 'obsidienne', img: 'theme/obsidienne-L.webp', portrait: 'theme/obsidienne-P.webp', avg: '#0b1018', ink: '#fff', flip: 'dark', css: 'radial-gradient(ellipse at 15% 10%, #16244a, transparent 55%), radial-gradient(ellipse at 90% 95%, #0d3a2e, transparent 55%), #050608' },
  { id: 't-graphite', group: 'theme', name: 'Graphite lunaire', theme: 'graphite', img: 'theme/graphite-L.webp', portrait: 'theme/graphite-P.webp', avg: '#16181c', ink: '#fff', flip: 'dark', css: 'radial-gradient(ellipse at 50% -10%, #3a3f48, transparent 60%), #060607' },
  { id: 't-ambre', group: 'theme', name: 'Ambre fumé', theme: 'ambre', img: 'theme/ambre-L.webp', portrait: 'theme/ambre-P.webp', avg: '#170c08', ink: '#fff', flip: 'dark', css: 'radial-gradient(ellipse at 5% 100%, #4a2610, transparent 55%), radial-gradient(ellipse at 98% 0%, #3a0f18, transparent 50%), #060504' },
  // Concepts
  { id: 'c-gt', group: 'concept', name: 'Affiche GT', concept: 'gt', ink: '#e7efe9', flip: 'dark', amb: 'radial-gradient(ellipse at 40% 20%, #3a5444, #1b2a21 55%, #0b120e)' },
  { id: 'c-bauhaus', group: 'concept', name: 'Bauhaus', concept: 'bauhaus', ink: '#141414', flip: 'light', amb: 'radial-gradient(ellipse at 70% 15%, #e2662c, #6b2a12 35%, #1a120d 70%)' },
  { id: 'c-horizon', group: 'concept', name: 'Horizon', concept: 'horizon', ink: '#fff', flip: 'dark', amb: 'linear-gradient(180deg, #2b3f58, #8a5a68 45%, #c8794f 70%, #16302b)' },
  { id: 'c-maree', group: 'concept', name: 'Marée', concept: 'maree', ink: '#fff', flip: 'dark', blend: true, amb: 'radial-gradient(ellipse at 50% 110%, #e9e1d2, #3c3a35 40%, #0b0f0d 75%)' },
  { id: 'c-topo', group: 'concept', name: 'Topographie', concept: 'topo', ink: '#efe6d2', flip: 'dark', amb: 'radial-gradient(ellipse at 50% 30%, #2c4a37, #0d1812 70%)' },
  // Photos
  { id: 'salon-orange', group: 'photo', sub: 'cosy', name: 'Salon orange', img: 'bg/salon-orange.jpg', pos: '50% 55%', ink: '#fff3e6', scrim: ['dark', 0.35], flip: 'dark' },
  // Photos haute définition (Unsplash, licence libre) : version paysage 2560 px + version portrait 1290×2796
  { id: 'p01', group: 'photo', sub: 'cosy', name: 'Lampe ambrée', by: 'Apekshit Srivastava', img: 'bg/p01-L.webp', portrait: 'bg/p01-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p02', group: 'photo', sub: 'cosy', name: 'Salon rouge', by: 'The Grid Rooms', img: 'bg/p02-L.webp', portrait: 'bg/p02-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p03', group: 'photo', sub: 'cosy', name: 'Lounge chair', by: 'Clay Banks', img: 'bg/p03-L.webp', portrait: 'bg/p03-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p04', group: 'photo', sub: 'nature', name: 'Fougères', by: 'Nima Saffari', img: 'bg/p04-L.webp', portrait: 'bg/p04-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p05', group: 'photo', sub: 'retro', name: 'Horloge chromée', by: 'Djim Loic', img: 'bg/p05-L.webp', portrait: 'bg/p05-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p06', group: 'photo', sub: 'retro', name: 'Bureau flip', by: 'Jerry Wang', img: 'bg/p06-L.webp', portrait: 'bg/p06-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p07', group: 'photo', sub: 'retro', name: 'Flip sur brique', by: 'Goeran Meyer', img: 'bg/p07-L.webp', portrait: 'bg/p07-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p08', group: 'photo', sub: 'retro', name: 'GT de nuit', by: 'Stephen Olmo', img: 'bg/p08-L.webp', portrait: 'bg/p08-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p09', group: 'photo', sub: 'retro', name: '911 classique', by: 'Aleksandr Zaitsev', img: 'bg/p09-L.webp', portrait: 'bg/p09-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p10', group: 'photo', sub: 'nature', name: 'Sommet noir', by: 'Kerensa Pickett', img: 'bg/p10-L.webp', portrait: 'bg/p10-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p11', group: 'photo', sub: 'nature', name: 'Sommet dans la brume', by: 'Tyler Lastovich', img: 'bg/p11-L.webp', portrait: 'bg/p11-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p12', group: 'photo', sub: 'nature', name: 'Forêt sombre', by: 'Roksolana Zasiadko', img: 'bg/p12-L.webp', portrait: 'bg/p12-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p13', group: 'photo', sub: 'cosy', name: 'Chat au salon', by: 'Chris Chow', img: 'bg/p13-L.webp', portrait: 'bg/p13-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p14', group: 'photo', sub: 'retro', name: 'Poudreuse 1930', by: 'Austrian National Library', img: 'bg/p14-L.webp', portrait: 'bg/p14-P.webp', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'p15', group: 'photo', sub: 'cosy', name: 'Machine à écrire', by: 'Johnny Briggs', img: 'bg/p15-L.webp', portrait: 'bg/p15-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p16', group: 'photo', sub: 'nature', name: 'Sentier en forêt', by: 'Patrick Mueller', img: 'bg/p16-L.webp', portrait: 'bg/p16-P.webp', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'p17', group: 'photo', sub: 'cosy', name: 'Vinyle', by: 'Pierre Gui', img: 'bg/p17-L.webp', portrait: 'bg/p17-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p18', group: 'photo', sub: 'nature', name: 'Faille moussue', by: 'Yuheng Ouyang', img: 'bg/p18-L.webp', portrait: 'bg/p18-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p19', group: 'photo', sub: 'nature', name: 'Hautes terres', by: 'K. K.', img: 'bg/p19-L.webp', portrait: 'bg/p19-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'p20', group: 'photo', sub: 'nature', name: 'Brume sur les pins', by: 'Tobias Tullius', img: 'bg/p20-L.webp', portrait: 'bg/p20-P.webp', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  // Nouvelles photos (Unsplash, licence libre) classées par ambiance : rose, ville, mer, nature, cosy
  { id: 'q01', group: 'photo', sub: 'rose', name: 'Ville rose', by: 'Meiying Ng', img: 'bg/q01-L.webp', portrait: 'bg/q01-P.webp', avg: '#d9a4b9', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'q02', group: 'photo', sub: 'rose', name: 'Ciel rose', by: 'Ernest Brillo', img: 'bg/q02-L.webp', portrait: 'bg/q02-P.webp', avg: '#926e90', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q03', group: 'photo', sub: 'rose', name: 'Nuage étoilé', by: 'Nacho Rochon', img: 'bg/q03-L.webp', portrait: 'bg/q03-P.webp', avg: '#474247', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q04', group: 'photo', sub: 'rose', name: 'Barbe à papa', by: 'Vishal Yadav', img: 'bg/q04-L.webp', portrait: 'bg/q04-P.webp', avg: '#a98ea4', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q05', group: 'photo', sub: 'rose', name: 'Lune pastel', by: 'Victoria Morgan', img: 'bg/q05-L.webp', portrait: 'bg/q05-P.webp', avg: '#cf9fa3', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'q06', group: 'photo', sub: 'rose', name: 'Sakura de nuit', by: 'David Brooke Martin', img: 'bg/q06-L.webp', portrait: 'bg/q06-P.webp', avg: '#110f12', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q07', group: 'photo', sub: 'rose', name: 'Branche de cerisier', by: 'Mi Min', img: 'bg/q07-L.webp', portrait: 'bg/q07-P.webp', avg: '#fbd9dc', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'q08', group: 'photo', sub: 'rose', name: 'Roseraie', by: 'Muhammet Cengiz', img: 'bg/q08-L.webp', portrait: 'bg/q08-P.webp', avg: '#533337', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q09', group: 'photo', sub: 'rose', name: 'Pivoine', by: 'Veronika Kireeva', img: 'bg/q09-L.webp', portrait: 'bg/q09-P.webp', avg: '#f2cedc', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'q10', group: 'photo', sub: 'rose', name: 'Lavande', by: 'Antony BEC', img: 'bg/q10-L.webp', portrait: 'bg/q10-P.webp', avg: '#746593', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q11', group: 'photo', sub: 'ville', name: 'Tour Eiffel', by: 'Kiarash Mansouri', img: 'bg/q11-L.webp', portrait: 'bg/q11-P.webp', avg: '#131312', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q12', group: 'photo', sub: 'ville', name: 'Paris sur Seine', by: 'Julie', img: 'bg/q12-L.webp', portrait: 'bg/q12-P.webp', avg: '#54565d', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q13', group: 'photo', sub: 'ville', name: 'Ruelle néon', by: 'Alex Knight', img: 'bg/q13-L.webp', portrait: 'bg/q13-P.webp', avg: '#1f243d', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q14', group: 'photo', sub: 'ville', name: 'Tokyo rose', by: 'Jezael Melgoza', img: 'bg/q14-L.webp', portrait: 'bg/q14-P.webp', avg: '#794d60', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q15', group: 'photo', sub: 'ville', name: 'Brooklyn', by: 'Kai Pilger', img: 'bg/q15-L.webp', portrait: 'bg/q15-P.webp', avg: '#373b36', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q16', group: 'photo', sub: 'ville', name: 'Canal illuminé', by: 'Sora Sagano', img: 'bg/q16-L.webp', portrait: 'bg/q16-P.webp', avg: '#7e5052', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q17', group: 'photo', sub: 'mer', name: 'Crépuscule mauve', by: 'Quino Al', img: 'bg/q17-L.webp', portrait: 'bg/q17-P.webp', avg: '#726f96', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q18', group: 'photo', sub: 'mer', name: 'Plage rose', by: 'Jernej Graj', img: 'bg/q18-L.webp', portrait: 'bg/q18-P.webp', avg: '#684c51', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q19', group: 'photo', sub: 'mer', name: 'Plage dorée', by: 'Sean Oulashin', img: 'bg/q19-L.webp', portrait: 'bg/q19-P.webp', avg: '#b8b8b1', ink: '#111', scrim: ['light', 0.3], flip: 'light' },
  { id: 'q20', group: 'photo', sub: 'mer', name: 'Palmier au couchant', by: 'Simon Spring', img: 'bg/q20-L.webp', portrait: 'bg/q20-P.webp', avg: '#5c301a', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q21', group: 'photo', sub: 'mer', name: 'Vague au couchant', by: 'Silas Baisch', img: 'bg/q21-L.webp', portrait: 'bg/q21-P.webp', avg: '#696468', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q22', group: 'photo', sub: 'mer', name: 'Océan sombre', by: 'Michael Benz', img: 'bg/q22-L.webp', portrait: 'bg/q22-P.webp', avg: '#06171d', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q23', group: 'photo', sub: 'nature', name: 'Aurore boréale', by: 'Vincent Guth', img: 'bg/q23-L.webp', portrait: 'bg/q23-P.webp', avg: '#334441', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q24', group: 'photo', sub: 'nature', name: 'Aurore rose', by: 'Jonatan Pie', img: 'bg/q24-L.webp', portrait: 'bg/q24-P.webp', avg: '#404a52', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q25', group: 'photo', sub: 'nature', name: 'Lac Moraine', by: 'John Lee', img: 'bg/q25-L.webp', portrait: 'bg/q25-P.webp', avg: '#4c7c8f', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q26', group: 'photo', sub: 'nature', name: 'Lac au crépuscule', by: 'Ansgar Scheffold', img: 'bg/q26-L.webp', portrait: 'bg/q26-P.webp', avg: '#5a5c61', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q27', group: 'photo', sub: 'nature', name: 'Dunes', by: 'Ze Paulo', img: 'bg/q27-L.webp', portrait: 'bg/q27-P.webp', avg: '#a5896c', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q28', group: 'photo', sub: 'nature', name: 'Dune rouge', by: 'Mikk Tõnissoo', img: 'bg/q28-L.webp', portrait: 'bg/q28-P.webp', avg: '#86513b', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q29', group: 'photo', sub: 'nature', name: 'Voie lactée', by: 'Jeremy Thomas', img: 'bg/q29-L.webp', portrait: 'bg/q29-P.webp', avg: '#2e4773', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q30', group: 'photo', sub: 'nature', name: 'Nuit violette', by: 'Tyler Clemmensen', img: 'bg/q30-L.webp', portrait: 'bg/q30-P.webp', avg: '#2f255d', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q31', group: 'photo', sub: 'cosy', name: 'Lampe de café', by: 'Juzzepo', img: 'bg/q31-L.webp', portrait: 'bg/q31-P.webp', avg: '#4b4a3a', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q32', group: 'photo', sub: 'cosy', name: 'Relax', by: 'Clem Onojeghuo', img: 'bg/q32-L.webp', portrait: 'bg/q32-P.webp', avg: '#2b2b1c', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  { id: 'q33', group: 'photo', sub: 'cosy', name: 'Bibliothèque', by: 'Susan Q Yin', img: 'bg/q33-L.webp', portrait: 'bg/q33-P.webp', avg: '#96836e', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q34', group: 'photo', sub: 'cosy', name: 'Pluie en ville', by: 'Max van den Oetelaar', img: 'bg/q34-L.webp', portrait: 'bg/q34-P.webp', avg: '#4d4f42', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'q35', group: 'photo', sub: 'cosy', name: 'Bougies et pluie', by: 'allison christine', img: 'bg/q35-L.webp', portrait: 'bg/q35-P.webp', avg: '#3b3832', ink: '#fff', scrim: ['dark', 0.22], flip: 'dark' },
  // Dégradés
  { id: 'noir', group: 'grad', name: 'Noir', css: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,.05), transparent 70%), #050505', ink: '#fff', flip: 'dark' },
  { id: 'graphite', group: 'grad', name: 'Graphite', css: 'radial-gradient(ellipse at 30% 20%, #2a2a30, #0c0c0e 70%)', ink: '#fff', flip: 'dark' },
  { id: 'foret', group: 'grad', name: 'Forêt', css: 'radial-gradient(ellipse at 70% 15%, #35503f, #16251c 55%, #0b120e)', ink: '#f4f1e8', flip: 'dark' },
  { id: 'braise', group: 'grad', name: 'Braise', css: 'radial-gradient(ellipse at 75% 80%, #e2783c 0%, #8a3518 30%, #2b120a 65%, #120806)', ink: '#fff3e6', flip: 'dark' },
  // Dégradés chaleureux « rose baddie » (fixes, sans animation)
  { id: 'baddie', group: 'grad', name: 'Rose baddie', css: 'radial-gradient(ellipse 70% 55% at 15% 5%, #ffb3d1 0%, transparent 60%), radial-gradient(ellipse 65% 55% at 95% 100%, #ffb38a 0%, transparent 60%), linear-gradient(160deg, #e0559b 0%, #a83a7c 50%, #4a1640 100%)', ink: '#fff', flip: 'dark', avg: '#a83a7c' },
  { id: 'peche', group: 'grad', name: 'Pêche', css: 'radial-gradient(ellipse 70% 60% at 80% 0%, #ffd6b8 0%, transparent 60%), linear-gradient(170deg, #ff9a8b 0%, #ff6a88 55%, #b23a6b 100%)', ink: '#fff', flip: 'dark', avg: '#e66a80' },
  { id: 'lilas', group: 'grad', name: 'Lilas', css: 'radial-gradient(ellipse 70% 60% at 20% 0%, #f5c6ff 0%, transparent 60%), linear-gradient(165deg, #c084fc 0%, #8b5cf6 50%, #3b1d6e 100%)', ink: '#fff', flip: 'dark', avg: '#8b5cf6' },
  { id: 'nuit-rose', group: 'grad', name: 'Nuit rose', css: 'radial-gradient(ellipse 80% 60% at 50% 110%, #ff5fa2 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 0% 0%, #6b2a7a 0%, transparent 60%), #14060f', ink: '#fff', flip: 'dark', avg: '#3a0f2c' },
  { id: 'papier', group: 'grad', name: 'Papier', css: 'radial-gradient(ellipse at 50% 30%, #f6f2ea, #e6dfd2)', ink: '#141414', flip: 'light' },
];
export const BG_GROUPS = [['theme', 'Thèmes'], ['concept', 'Concepts'], ['photo', 'Photos'], ['grad', 'Dégradés']];
/* Catégories des photos (filtre en puces dans le sélecteur) */
export const PHOTO_SUBS = [['rose', 'Rose & doux'], ['ville', 'Ville'], ['mer', 'Mer & plages'], ['nature', 'Nature'], ['cosy', 'Cosy'], ['retro', 'Rétro & voitures']];
export const bgOf = (id) => BGS.find((b) => b.id === id) || BGS.find((b) => b.id === 'noir');
export const thumbOf = (b) => (b.img ? b.img.replace(/(-L)?\.(jpg|webp)$/, '-mini.jpg') : null);
export const ambOf = (b) => (b.img ? b.img.replace(/(-L)?\.(jpg|webp)$/, '-amb.webp') : null);
