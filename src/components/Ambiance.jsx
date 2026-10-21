import { ambOf, bgOf } from '../lib/backgrounds';

/* =====================================================================
   AMBIANCE DE L'APP — calque fixe derrière toute l'interface, peint une seule fois.
   Règle d'or : rien ne bouge. Aucun filter: blur(), aucun dégradé animé : les thèmes sont des images pré-calculées
   (lumière diffuse + grain, versions paysage et portrait), les photos des vignettes déjà floutées (-amb.webp).
   La couleur moyenne de l'image est posée en attendant son affichage (aucun flash, aucun décalage).
   ===================================================================== */
export const ambId = (S) => (S.set.amb === 'pomo' ? S.set.bg : S.set.amb);
export default function Ambiance({ S }) {
  const id = ambId(S);
  if (!id || id === 'none') return null;
  const b = bgOf(id), lvl = S.set.ambLevel ?? 2;
  if (b.theme) {
    const dim = [0.42, 0, 0][lvl - 1] || 0;
    return (
      <div className="amb" aria-hidden="true" style={{ background: b.avg }}>
        <picture>
          <source media="(orientation: portrait)" srcSet={`theme/${b.theme}-P.webp`} />
          <img src={`theme/${b.theme}-L.webp`} alt="" decoding="async" fetchpriority="high" />
        </picture>
        {dim > 0 && <div className="amb-shade" style={{ background: `rgba(5,5,6,${dim})` }} />}
        {lvl === 3 && <div className="amb-shade amb-boost" />}
      </div>
    );
  }
  const k = [0.82, 0.68, 0.52][lvl - 1] ?? 0.68;
  return (
    <div className="amb" aria-hidden="true" style={{ background: '#050505' }}>
      {b.img ? <img src={ambOf(b)} alt="" decoding="async" /> : <div className="amb-c" style={{ background: b.amb || b.css }} />}
      <div className="amb-shade" style={{ background: `linear-gradient(180deg, rgba(5,5,5,${k - 0.12}) 0%, rgba(5,5,5,${k}) 45%, rgba(5,5,5,${Math.min(0.96, k + 0.16)}) 100%)` }} />
    </div>
  );
}
