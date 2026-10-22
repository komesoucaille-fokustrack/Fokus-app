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
// AAC (.m4a, boucle sans couture, lu par Safari) puis MP3 en secours (lu partout)
const FILES = { rain: 'sounds/pluie', cafe: 'sounds/cafe', forest: 'sounds/foret' };
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
  let last;
  for (const ext of ['.m4a', '.mp3']) {
    try {
      const r = await fetch(FILES[kind] + ext);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.arrayBuffer();
      const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(data, res, rej); p?.catch?.(() => {}); });
      return (buffers[kind] = trim(ctx, buf));
    } catch (e) { last = e; }
  }
  throw last;
}
/* Retire le silence d'encodage en début et fin de fichier (MP3) : la boucle reste sans trou */
function trim(ctx, buf) {
  const d = buf.getChannelData(0), n = d.length, lim = Math.min(4096, n >> 2), eps = 1e-4;
  let a = 0, z = n;
  while (a < lim && Math.abs(d[a]) < eps) a++;
  while (n - z < lim && Math.abs(d[z - 1]) < eps) z--;
  if (a === 0 && z === n) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, z - a, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, z));
  return out;
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
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
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
  clearTimeout(preview);
  preview = null;
  if (cur && !cur.pending) fadeOut(cur);
  cur = null;
}
/* Aperçu de quelques secondes quand on choisit un son (ou règle le volume) minuteur arrêté :
   on entend tout de suite le son choisi ; il se lancera ensuite tout seul avec la concentration. */
let preview = null;
export function previewAmbient(kind, vol, secs = 6) {
  if (!kind || kind === 'none') return stopAmbient();
  clearTimeout(preview);
  playAmbient(kind, vol);
  preview = setTimeout(() => { preview = null; if (cur) { fadeOut(cur, 1.5); cur = null; } }, secs * 1000);
}
export const previewing = () => !!preview;
/* La concentration démarre pendant un aperçu : le son continue, sans arrêt programmé */
export function keepAmbient() { clearTimeout(preview); preview = null; }
export const ambientPlaying = () => !!(cur && !cur.pending);
