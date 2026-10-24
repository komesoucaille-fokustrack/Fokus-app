export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Couleur continue (lueur, moyenne de la Page 2) */
const STOPS_FOKUS = [[0, '#f87171'], [20, '#fb7185'], [40, '#fb923c'], [55, '#fdba74'], [75, '#fde047'], [83, '#059669'], [90, '#065f46'], [94, '#10b981'], [97, '#6ee7b7'], [100, '#86efac']];
/* Style « Tranquille » : lavande → bleu doux → menthe, jamais de rouge (aucune couleur d'alerte) */
const STOPS_ZEN = [[0, '#c4b5fd'], [30, '#a5b4fc'], [55, '#93c5fd'], [75, '#7dd3fc'], [90, '#5eead4'], [100, '#86efac']];
let STOPS = STOPS_FOKUS;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));

export function getColorForPercentage(p) {
  p = clamp(p, 0, 100);
  let i = 1;
  while (i < STOPS.length - 1 && p > STOPS[i][0]) i++;
  const a = STOPS[i - 1], b = STOPS[i], t = (p - a[0]) / (b[0] - a[0]), A = rgb(a[1]), B = rgb(b[1]);
  return '#' + A.map((x, k) => Math.round(x + (B[k] - x) * t).toString(16).padStart(2, '0')).join('');
}

/* Dégradés pastel riches de la barre, par palier */
const TIERS_FOKUS = [
  [20, ['#f87171', '#fb7185']],                       // Rouge corail
  [40, ['#f87171', '#fb923c']],                       // Rouge → Orange
  [55, ['#fb923c', '#fdba74']],                       // Orange doux
  [75, ['#fb923c', '#fde047']],                       // Orange → Jaune
  [90, ['#fde047', '#059669', '#065f46']],            // Fond de jaune → Vert émeraude foncé
  [100, ['#065f46', '#10b981', '#6ee7b7', '#86efac']], // Verts → menthe lumineux
];
const TIERS_ZEN = [
  [30, ['#c4b5fd', '#a5b4fc']], [55, ['#a5b4fc', '#93c5fd']], [75, ['#93c5fd', '#7dd3fc']], [90, ['#7dd3fc', '#5eead4']], [100, ['#93c5fd', '#5eead4', '#86efac']],
];
let TIERS = TIERS_FOKUS;
/* Palette selon le style (appelé au rendu de l'app ; la cinématique utilise les mêmes fonctions) */
export function setPalette(style) {
  STOPS = style === 'zen' ? STOPS_ZEN : STOPS_FOKUS;
  TIERS = style === 'zen' ? TIERS_ZEN : TIERS_FOKUS;
}
export const gradFor = (p) => `linear-gradient(90deg,${TIERS.find((t) => p <= t[0])[1].join(',')})`;
