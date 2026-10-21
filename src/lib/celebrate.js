import confetti from 'canvas-confetti';

/* Pluie de confettis multicolores sur tout l'écran (journée complétée à 100 %) */
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff7eb6', '#4cc9f0', '#ffffff', '#f9844a'];
const base = { colors: COLORS, zIndex: 300, disableForReducedMotion: true, ticks: 260 };

export function celebrate() {
  // grande gerbe centrale
  confetti({ ...base, particleCount: 140, spread: 150, startVelocity: 48, origin: { x: 0.5, y: 0.45 }, scalar: 1.05 });
  // canons latéraux continus pendant ~2 s (une image sur deux, peu de particules → fluide)
  const end = performance.now() + 2000;
  let odd = false;
  (function frame() {
    odd = !odd;
    if (odd) {
      confetti({ ...base, particleCount: 4, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.8 } });
      confetti({ ...base, particleCount: 4, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.8 } });
    }
    if (performance.now() < end) requestAnimationFrame(frame);
  })();
  // pluie depuis le haut de l'écran
  setTimeout(() => confetti({ ...base, particleCount: 110, spread: 170, startVelocity: 25, gravity: 0.8, origin: { x: 0.3, y: -0.05 } }), 450);
  setTimeout(() => confetti({ ...base, particleCount: 110, spread: 170, startVelocity: 25, gravity: 0.8, origin: { x: 0.7, y: -0.05 } }), 800);
}
