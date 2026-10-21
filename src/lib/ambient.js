import { audioCtx, unlockAudio } from './sound';

/* =====================================================================
   SONS D'AMBIANCE PENDANT LA CONCENTRATION
   - Bruit blanc et bruit brun : générés en Web Audio (aucun fichier).
   - Pluie, café, forêt : boucles courtes sous licence libre (public/sounds), chargées à la première écoute
     puis gardées en cache hors ligne par le service worker.
   Boucles sans couture (AudioBufferSourceNode.loop), fondus à l'entrée et à la sortie.
   ===================================================================== */
export const SOUNDS = [
  ['none', 'Aucun'], ['rain', 'Pluie'], ['cafe', 'Café'], ['forest', 'Forêt'], ['brown', 'Bruit brun'], ['white', 'Bruit blanc'],
];
export const CREDITS = {
  rain: 'Pluie : alex36917 (freesound, CC BY 3.0), montage Porrumentzio / Blanket',
  cafe: 'Café : « Restaurant Ambiance », stephan (soundbible, domaine public)',
  forest: 'Forêt : kvgarlic (freesound, CC0), montage Porrumentzio / Blanket',
};
const FILES = { rain: 'sounds/pluie.m4a', cafe: 'sounds/cafe.m4a', forest: 'sounds/foret.m4a' };
const buffers = {};
let cur = null; // { kind, src, gain }

function noise(ctx, kind) {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  if (kind === 'white') for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
  else {
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    // raccord de boucle : fondu sur les 2000 derniers échantillons vers le début
    for (let i = 0; i < 2000; i++) { const t = i / 2000, j = len - 2000 + i; d[j] = d[j] * (1 - t) + d[i] * t; }
  }
  return buf;
}
async function bufferOf(ctx, kind) {
  if (buffers[kind]) return buffers[kind];
  if (kind === 'white' || kind === 'brown') return (buffers[kind] = noise(ctx, kind));
  const data = await fetch(FILES[kind]).then((r) => r.arrayBuffer());
  return (buffers[kind] = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)));
}

function fadeOut(c, secs = 1) {
  const ctx = audioCtx();
  if (!c || !ctx) return;
  const g = c.gain.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(g.value, ctx.currentTime);
  g.linearRampToValueAtTime(0, ctx.currentTime + secs);
  setTimeout(() => { try { c.src.stop(); c.src.disconnect(); c.gain.disconnect(); } catch { /* déjà arrêté */ } }, secs * 1000 + 100);
}

/* Lance (ou garde) le son `kind` au volume `vol` (0 → 1) ; 'none' coupe */
export async function playAmbient(kind, vol) {
  if (!kind || kind === 'none') return stopAmbient();
  const ctx = audioCtx() || (unlockAudio(), audioCtx());
  if (!ctx) return;
  const v = Math.max(0, Math.min(1, vol)) ** 1.6 * 0.9;
  if (cur && cur.kind === kind) { cur.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.25); return; }
  stopAmbient();
  const token = (cur = { kind, pending: true });
  let buf;
  try { buf = await bufferOf(ctx, kind); } catch { if (cur === token) cur = null; return; }
  if (cur !== token) return; // un autre choix est arrivé entre-temps
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf;
  src.loop = true;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 1.5);
  src.connect(gain).connect(ctx.destination);
  src.start();
  cur = { kind, src, gain };
}
export function stopAmbient() {
  if (cur && !cur.pending) fadeOut(cur);
  cur = null;
}
