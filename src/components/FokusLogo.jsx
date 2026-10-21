import font from '../assets/inter-black.typeface.json';
import { LOGO_URL } from '../brand';

/* Convertit un glyphe « typeface » (y vers le haut) en chemin SVG (y vers le bas) */
function glyphPath(ch, x0, base, size) {
  const g = font.glyphs[ch], s = size / font.resolution, o = g.o.split(' ');
  const X = (v) => (x0 + v * s).toFixed(2), Y = (v) => (base - v * s).toFixed(2);
  let d = '';
  for (let i = 0; i < o.length;) {
    const c = o[i++];
    if (c === 'm' || c === 'l') { d += (c === 'm' ? 'M' : 'L') + X(+o[i++]) + ' ' + Y(+o[i++]); }
    else if (c === 'q') { const x = +o[i++], y = +o[i++], cx = +o[i++], cy = +o[i++]; d += `Q${X(cx)} ${Y(cy)} ${X(x)} ${Y(y)}`; }
    else if (c === 'b') { const x = +o[i++], y = +o[i++], a = +o[i++], b = +o[i++], e = +o[i++], f = +o[i++]; d += `C${X(a)} ${Y(b)} ${X(e)} ${Y(f)} ${X(x)} ${Y(y)}`; }
    else if (c === 'z') d += 'Z';
  }
  return { d, adv: g.ha * s };
}

function word(text, x, base, size, spacing) {
  const paths = [];
  for (const ch of text) { const g = glyphPath(ch, x, base, size); paths.push(g.d); x += g.adv + spacing; }
  return paths.join('');
}

const F_W = font.glyphs.F.ha * (20 / font.resolution);
export const LOGO_SVG = {
  badgeF: glyphPath('F', 16 - F_W / 2 + 1, 23, 20).d,
  word: word('FOKUS', 40, 23, 20, 2.4),
};

/* Emplacement .fokus-logo — recopié automatiquement sur l'arche 3D */
export default function FokusLogo({ className = '' }) {
  return (
    <div className={'fokus-logo ' + className} id="logo">
      {LOGO_URL ? (
        <img src={LOGO_URL} alt="Fokus" />
      ) : (
        <svg viewBox="0 0 132 32" role="img" aria-label="Fokus">
          <rect x="1" y="1" width="30" height="30" rx="8" fill="#fff" />
          <path d={LOGO_SVG.badgeF} fill="#000" />
          <path d={LOGO_SVG.word} fill="#fff" />
        </svg>
      )}
    </div>
  );
}
