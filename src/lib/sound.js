/* Carillon doux de fin de phase (Web Audio, aucun fichier) — débloqué au premier tap (iOS) */
let ctx;
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio indisponible */ }
}
export function chime(kind = 'work') {
  try {
    unlockAudio();
    if (!ctx) return;
    const notes = kind === 'work' ? [659.25, 783.99, 1046.5] : [1046.5, 783.99, 659.25];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.22, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.2);
    });
  } catch { /* audio indisponible */ }
}
