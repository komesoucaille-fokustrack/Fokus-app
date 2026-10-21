/* Fonds du Pomodoro : dégradés (CSS) et photos (public/bg).
   ink = couleur du chrono ; scrim = voile pour la lisibilité ('dark' | 'light', opacité) ; flip = cartes claires ou sombres ;
   pos = cadrage de la photo (object-position) ; fit 'contain' pour garder l'affiche entière. */
export const BGS = [
  { id: 'noir', name: 'Noir', css: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,.05), transparent 70%), #050505', ink: '#fff', flip: 'dark' },
  { id: 'graphite', name: 'Graphite', css: 'radial-gradient(ellipse at 30% 20%, #2a2a30, #0c0c0e 70%)', ink: '#fff', flip: 'dark' },
  { id: 'foret', name: 'Forêt', css: 'radial-gradient(ellipse at 70% 15%, #35503f, #16251c 55%, #0b120e)', ink: '#f4f1e8', flip: 'dark' },
  { id: 'braise', name: 'Braise', css: 'radial-gradient(ellipse at 75% 80%, #e2783c 0%, #8a3518 30%, #2b120a 65%, #120806)', ink: '#fff3e6', flip: 'dark' },
  { id: 'papier', name: 'Papier', css: 'radial-gradient(ellipse at 50% 30%, #f6f2ea, #e6dfd2)', ink: '#141414', flip: 'light' },
  { id: 'flip-rouge', name: 'Horloges rétro', img: 'bg/flip-rouge.jpg', pos: '50% 50%', ink: '#fffaf0', scrim: ['dark', 0.42], flip: 'light' },
  { id: 'flip-chrome', name: 'Flip chromé', img: 'bg/flip-chrome.jpg', pos: '50% 40%', ink: '#111', scrim: ['light', 0.35], flip: 'light' },
  { id: 'gt-vert', name: 'GT verte', img: 'bg/gt-vert.jpg', pos: '50% 60%', ink: '#eef3ee', scrim: ['dark', 0.2], flip: 'dark' },
  { id: 'gt-dessus', name: 'GT vue du dessus', img: 'bg/gt-dessus.jpg', pos: '50% 50%', ink: '#fff', scrim: ['dark', 0.38], flip: 'dark' },
  { id: 'salon-orange', name: 'Salon orange', img: 'bg/salon-orange.jpg', pos: '50% 55%', ink: '#fff3e6', scrim: ['dark', 0.35], flip: 'dark' },
  { id: 'chat', name: 'Velours vert', img: 'bg/chat.jpg', pos: '50% 70%', ink: '#f4f1e8', scrim: ['dark', 0.2], flip: 'dark' },
  { id: 'ski', name: 'Poudreuse', img: 'bg/ski.jpg', pos: '50% 50%', ink: '#fff', scrim: ['dark', 0.4], flip: 'light' },
  { id: 'prairie', name: 'Prairie', img: 'bg/prairie.jpg', pos: '50% 60%', ink: '#fff', scrim: ['dark', 0.3], flip: 'dark' },
  { id: 'falaises', name: 'Falaises', img: 'bg/falaises.jpg', pos: '50% 45%', ink: '#fff', scrim: ['dark', 0.32], flip: 'dark' },
  { id: 'proud', name: 'Don’t stop', img: 'bg/proud.jpg', pos: '50% 50%', fit: 'contain', back: '#ffffff', ink: '#1d2340', scrim: ['light', 0.55], flip: 'light' },
];
export const bgOf = (id) => BGS.find((b) => b.id === id) || BGS[0];
export const thumbOf = (b) => (b.img ? b.img.replace('.jpg', '-mini.jpg') : null);
