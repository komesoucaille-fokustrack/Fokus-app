import { PHASES, getState, pomoElapsed, pomoToggle, stats } from '../store';
import { getColorForPercentage } from './colors';
import { LOGO_SVG, RING } from '../components/FokusLogo';

/* =====================================================================
   MINI-FENÊTRE FOKUS (Picture-in-Picture)
   Une fenêtre flottante qui reste à l'écran quand on quitte l'app (au-dessus des autres apps sur iPad),
   déplaçable et redimensionnable (pincer pour agrandir / réduire). Le contenu est dessiné sur un canevas
   puis diffusé comme une vidéo : minuteur en cours (avec l'anneau Fokus) ou progression du jour.
   Le bouton lecture / pause de la fenêtre met le minuteur en pause ou le relance.
   ===================================================================== */
const W = 640, H = 400;
let st = null; // { canvas, ctx, video, iv, wrap, ours }

export function pipSupported() {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video');
  const canvasStream = !!HTMLCanvasElement.prototype.captureStream;
  return canvasStream && (!!document.pictureInPictureEnabled || typeof v.webkitSetPresentationMode === 'function');
}
export const pipActive = () => !!st;
const emit = () => dispatchEvent(new Event('fokuspip')); // l'interface suit l'état de la fenêtre

function content() {
  const S = getState(), p = S.pomo, mode = S.set.pipMode || 'auto';
  const timer = mode === 'timer' || (mode === 'auto' && p && (p.paused == null || p.paused > 0));
  if (timer) {
    const q = p || { phase: 'work', dur: S.set.pomo * 60, paused: 0, flow: S.set.pomoMode === 'flow' };
    const el = pomoElapsed(q), flow = !q.dur;
    const sec = Math.max(0, Math.round(flow ? el : q.dur - el));
    const t = (sec >= 3600 ? Math.floor(sec / 3600) + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0') : String(Math.floor(sec / 60)).padStart(2, '0')) + ':' + String(sec % 60).padStart(2, '0');
    const task = q.tid && S.tasks.find((x) => x.id === q.tid);
    return {
      label: q.paused != null && q.paused > 0 ? 'En pause' : (flow && q.phase === 'work' ? 'Chrono libre' : PHASES[q.phase]),
      value: t, sub: task ? task.text : q.phase === 'work' ? 'Concentration' : 'Respire un peu',
      // compte à rebours : l'anneau se vide avec le temps restant ; chrono libre : il se remplit sur l'heure
      frac: flow ? (el % 3600) / 3600 : Math.max(0, 1 - el / Math.max(1, q.dur)),
      colors: q.phase === 'work' ? ['#059669', '#10b981', '#86efac'] : ['#2563eb', '#60a5fa', '#bfdbfe'],
    };
  }
  const s = stats(), left = s.n - s.c, c = getColorForPercentage(s.p || 1);
  return {
    label: 'Aujourd’hui', value: s.p + ' %',
    sub: s.n ? (left ? `${left} tâche${left > 1 ? 's' : ''} à faire · ${s.c}/${s.n}` : 'Tout est fait ✓') : 'Aucune tâche aujourd’hui',
    frac: s.p / 100, colors: [c, c, '#ffffff'],
  };
}

function draw(ctx = st.ctx) {
  const d = content();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#111218'); g.addColorStop(1, '#050608');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // reflet doux en haut (verre)
  const hl = ctx.createRadialGradient(W * 0.3, -40, 10, W * 0.3, -40, 420);
  hl.addColorStop(0, 'rgba(255,255,255,.07)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, W, H);
  // anneau Fokus : piste + arc de progression (départ en haut) + point central
  const cx = 150, cy = H / 2, r = 104;
  ctx.lineCap = 'round';
  ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  if (d.frac > 0.003) {
    const rg = ctx.createLinearGradient(cx + r, cy - r * 0.4, cx - r, cy + r * 0.4);
    rg.addColorStop(0, d.colors[0]); rg.addColorStop(0.45, d.colors[1]); rg.addColorStop(1, d.colors[2]);
    ctx.strokeStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.frac)); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
  // textes
  const x = 300;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a7abb4';
  ctx.font = '600 30px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.fillText(d.label.toUpperCase(), x, 128);
  ctx.fillStyle = '#f5f6f8';
  ctx.font = '800 112px "Inter Variable", Inter, system-ui, sans-serif';
  if ('fontVariantNumeric' in ctx) ctx.fontVariantNumeric = 'tabular-nums';
  ctx.fillText(d.value, x - 4, 246, W - x - 24);
  ctx.fillStyle = '#c9ccd3';
  ctx.font = '500 28px "Inter Variable", Inter, system-ui, sans-serif';
  let sub = d.sub;
  while (sub.length > 4 && ctx.measureText(sub).width > W - x - 30) sub = sub.slice(0, -2);
  ctx.fillText(sub === d.sub ? sub : sub + '…', x, 300);
  // logotype Fokus (le O = anneau vert), mêmes tracés que l'en-tête
  const k = 22 / 75;
  ctx.save();
  ctx.translate(x - 4.7 * k, 334 + 1.1 * k);
  ctx.scale(k, k);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fill(new Path2D(LOGO_SVG.track), 'evenodd');
  const lg = ctx.createLinearGradient(135.4, 21.4, 60.4, 51.4);
  RING.forEach(([o, c]) => lg.addColorStop(+o, c));
  ctx.fillStyle = lg;
  ctx.fill(new Path2D(LOGO_SVG.arc));
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(LOGO_SVG.word));
  ctx.restore();
}

/* Ouvre la mini-fenêtre (à appeler depuis un tap) ; renvoie true si elle s'est ouverte */
export async function openPip() {
  if (st) { await closePip(); return false; }
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('autopictureinpicture', '');
  video.autoPictureInPicture = true;
  // la vidéo doit faire partie de la page (invisible) pour Safari
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;overflow:hidden;z-index:-1';
  wrap.appendChild(video);
  document.body.appendChild(wrap);
  st = { canvas, ctx, video, wrap, ours: false };
  draw();
  video.srcObject = canvas.captureStream(10);
  st.iv = setInterval(() => st && draw(), 250);
  // lecture / pause depuis la fenêtre → minuteur
  video.addEventListener('pause', () => {
    if (!st || st.ours) return;
    const S = getState();
    if (S.pomo || S.set.pipMode === 'timer') pomoToggle(); // pause ↔ reprise du minuteur
    st.ours = true; video.play().catch(() => {}).finally(() => { if (st) st.ours = false; });
  });
  const end = () => closePip();
  video.addEventListener('leavepictureinpicture', end);
  video.addEventListener('webkitpresentationmodechanged', () => { if (video.webkitPresentationMode === 'inline') end(); });
  try {
    await video.play();
    if (video.requestPictureInPicture) await video.requestPictureInPicture();
    else video.webkitSetPresentationMode('picture-in-picture');
    emit();
    return true;
  } catch (e) {
    await closePip();
    throw e;
  }
}
export async function closePip() {
  if (!st) return;
  const s = st;
  st = null;
  clearInterval(s.iv);
  try { if (document.pictureInPictureElement === s.video) await document.exitPictureInPicture(); } catch { /* déjà fermée */ }
  try { if (s.video.webkitPresentationMode === 'picture-in-picture') s.video.webkitSetPresentationMode('inline'); } catch { /* rien */ }
  s.video.srcObject?.getTracks().forEach((t) => t.stop());
  s.wrap.remove();
  emit();
}

/* Image d'une vignette de la mini-fenêtre (aperçu, tests) */
export function pipFrame() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  draw(c.getContext('2d'));
  return c.toDataURL('image/png');
}
