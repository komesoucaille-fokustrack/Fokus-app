import { useId } from 'react';
import Icon from './Icons';

/* =====================================================================
   MÉDAILLE FOKUS — l'anneau du logo autour d'une icône
   - Badge obtenu : anneau fermé aux couleurs du palier (bronze, argent, or, émeraude Fokus) + reflet.
   - Badge à obtenir : l'anneau se remplit avec la progression (comme le logo), en gris.
   ===================================================================== */
export const TIER_COLORS = {
  1: ['#7c4a24', '#c98a52', '#f3cfa6'],   // bronze
  2: ['#6b7280', '#c7ccd6', '#f5f6f8'],   // argent
  3: ['#9a6b0e', '#e2b43c', '#fde68a'],   // or
  4: ['#059669', '#10b981', '#86efac'],   // émeraude Fokus (couleurs du logo)
};

export default function Medal({ icon, tier = 1, got, progress = 0, size = 64 }) {
  const id = useId().replace(/:/g, '');
  const [c0, c1, c2] = TIER_COLORS[tier] || TIER_COLORS[1];
  const p = got ? 100 : Math.max(0, Math.min(99.5, progress * 100));
  return (
    <svg className={'medal' + (got ? ' got' : '')} viewBox="0 0 72 72" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={'f' + id} cx="0.5" cy="0.28" r="0.75">
          <stop offset="0" stopColor={got ? '#24252c' : '#1a1b20'} />
          <stop offset="1" stopColor="#08080b" />
        </radialGradient>
        <linearGradient id={'r' + id} x1="1" y1="0.3" x2="0" y2="0.7">
          <stop offset="0" stopColor={c0} />
          <stop offset="0.45" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {/* médaillon sombre, liseré et reflet comme l'icône de l'app */}
      <circle cx="36" cy="36" r="34" fill={`url(#f${id})`} stroke={got ? c1 : 'rgba(255,255,255,.1)'} strokeOpacity={got ? 0.45 : 1} strokeWidth="1" />
      <path d="M12 26a26 26 0 0 1 48 0" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="6" strokeLinecap="round" />
      {/* anneau Fokus : piste + arc de progression (départ en haut, sens horaire) */}
      <circle cx="36" cy="36" r="24" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="6.5" />
      {p > 0 && (
        <circle cx="36" cy="36" r="24" fill="none" stroke={got ? `url(#r${id})` : '#8b8f99'} strokeWidth="6.5" strokeLinecap="round"
          pathLength="100" strokeDasharray={`${p} 100`} transform="rotate(-90 36 36)" />
      )}
      <g transform="translate(24 24)" style={{ color: got ? c2 : '#7d818b' }}>
        <Icon name={icon} size={24} />
      </g>
      {tier === 4 && got && <circle cx="36" cy="36" r="31" fill="none" stroke={c2} strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 3" />}
    </svg>
  );
}
