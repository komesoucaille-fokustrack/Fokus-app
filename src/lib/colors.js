export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Couleur continue (lueur, moyenne de la Page 2) */
const STOPS_FOKUS = [[0, '#f87171'], [20, '#fb7185'], [40, '#fb923c'], [55, '#fdba74'], [75, '#fde047'], [83, '#059669'], [90, '#065f46'], [94, '#10b981'], [97, '#6ee7b7'], [100, '#86efac']];
/* Style « Tranquille » : uniquement du bleu (clair → franc), ni rouge ni vert : aucune couleur qui juge */
const STOPS_ZEN = [[0, '#bfdbfe'], [40, '#93c5fd'], [75, '#60a5fa'], [100, '#3b82f6']];
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
  [40, ['#bfdbfe', '#93c5fd']], [75, ['#93c5fd', '#60a5fa']], [100, ['#93c5fd', '#60a5fa', '#3b82f6']],
];
export const ZEN_BLUE = '#60a5fa';
let TIERS = TIERS_FOKUS;
/* Palette selon le style (appelé au rendu de l'app ; la cinématique utilise les mêmes fonctions) */
export function setPalette(style) {
  STOPS = style === 'zen' ? STOPS_ZEN : STOPS_FOKUS;
  TIERS = style === 'zen' ? TIERS_ZEN : TIERS_FOKUS;
}
export const gradFor = (p) => `linear-gradient(90deg,${TIERS.find((t) => p <= t[0])[1].join(',')})`;
