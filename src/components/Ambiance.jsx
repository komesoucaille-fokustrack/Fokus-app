import { useEffect } from 'react';
import { ambOf, bgOf } from '../lib/backgrounds';

/* =====================================================================
   AMBIANCE DE L'APP — calque fixe derrière toute l'interface, peint une seule fois.
   Règle d'or : rien ne bouge. Aucun filter: blur(), aucun dégradé animé : les thèmes sont des images pré-calculées
   (lumière diffuse + grain, versions paysage et portrait). Photos : la vraie image nette par défaut (réglage
   « Photo nette », set.ambSharp), sinon des vignettes déjà floutées (-amb.webp).
   La couleur moyenne de l'image est posée en attendant son affichage (aucun flash, aucun décalage).
   ===================================================================== */
export const ambId = (S) => (S.set.amb === 'pomo' ? S.set.bg : S.set.amb);
export default function Ambiance({ S }) {
  const id = ambId(S);
  const b = bgOf(id), lvl = S.set.ambLevel ?? 2;
  // image vive derrière l'app → ombre douce sous les textes posés directement sur le fond (salutation, pied de page)
  const vivid = !!id && id !== 'none' && !b.theme && S.set.ambSharp !== false && lvl > 1;
  useEffect(() => { document.body.classList.toggle('amb-photo', vivid); }, [vivid]);
  if (!id || id === 'none') return null;
  if (b.theme) {
    const dim = [0.42, 0, 0][lvl - 1] || 0;
    return (
      <div className="amb" aria-hidden="true" style={{ background: b.avg }}>
        <picture>
          <source media="(orientation: portrait)" srcSet={`theme/${b.theme}-P.webp`} />
          <img src={`theme/${b.theme}-L.webp`} alt="" decoding="async" fetchPriority="high" />
        </picture>
        {dim > 0 && <div className="amb-shade" style={{ background: `rgba(5,5,6,${dim})` }} />}
        {lvl === 3 && <div className="amb-shade amb-boost" />}
      </div>
    );
  }
  // Photo nette (par défaut) : la vraie image, en haute définition (paysage / portrait), avec un simple voile uniforme
  // selon l'intensité (Intense = aucun voile). Aucun dégradé, aucun flou : l'image est peinte une seule fois.
  if (b.img && S.set.ambSharp !== false) {
    const veil = [0.55, 0.3, 0][lvl - 1] ?? 0.3;
    return (
      <div className="amb" aria-hidden="true" style={{ background: b.avg || '#050608' }}>
        <picture>
          {b.portrait && <source media="(orientation: portrait)" srcSet={b.portrait} />}
          <img src={b.img} alt="" decoding="async" fetchPriority="high" style={b.pos ? { objectPosition: b.pos } : undefined} />
        </picture>
        {veil > 0 && <div className="amb-shade" style={{ background: `rgba(5,5,6,${veil})` }} />}
      </div>
    );
  }
  // Dégradé (fond CSS) : affiché tel quel, voile uniforme selon l'intensité
  if (!b.img && b.css && !b.amb && S.set.ambSharp !== false) {
    const veil = [0.6, 0.35, 0.12][lvl - 1] ?? 0.35;
    return (
      <div className="amb" aria-hidden="true" style={{ background: '#050608' }}>
        <div className="amb-c" style={{ background: b.css }} />
        <div className="amb-shade" style={{ background: `rgba(5,5,6,${veil})` }} />
      </div>
    );
  }
  const k = [0.82, 0.68, 0.52][lvl - 1] ?? 0.68;
  return (
    <div className="amb" aria-hidden="true" style={{ background: '#050608' }}>
      {b.img ? <img src={ambOf(b)} alt="" decoding="async" /> : <div className="amb-c" style={{ background: b.amb || b.css }} />}
      <div className="amb-shade" style={{ background: `linear-gradient(180deg, rgba(5,5,5,${k - 0.12}) 0%, rgba(5,5,5,${k}) 45%, rgba(5,5,5,${Math.min(0.96, k + 0.16)}) 100%)` }} />
    </div>
  );
}
