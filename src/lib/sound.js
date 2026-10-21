/* Carillon doux de fin de phase (Web Audio, aucun fichier) — débloqué au premier tap (iOS) */
let ctx, unlocked = false;
export function unlockAudio() {
  try {
    // iPhone / iPad : jouer même si le bouton silencieux est activé (Safari 16.4+)
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (!unlocked) {
      // un son vide joué pendant le tap débloque définitivement l'audio sur iOS
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      unlocked = true;
    }
  } catch { /* audio indisponible */ }
}
export const audioCtx = () => ctx;
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
