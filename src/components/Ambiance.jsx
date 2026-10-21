import { bgOf, thumbOf } from '../lib/backgrounds';

/* Ambiance de l'app : la photo ou la couleur choisie, très floutée et assombrie, derrière toute l'interface.
   Calque fixe peint une seule fois (petite image floue) : aucun coût pendant le défilement. */
export const ambId = (S) => (S.set.amb === 'pomo' ? S.set.bg : S.set.amb);
export default function Ambiance({ S }) {
  const id = ambId(S);
  if (!id || id === 'none') return null;
  const b = bgOf(id);
  const k = [0.82, 0.68, 0.52][(S.set.ambLevel ?? 2) - 1] ?? 0.68;
  return (
    <div className="amb" aria-hidden="true" key={id}>
      {b.img ? <img src={thumbOf(b)} alt="" decoding="async" /> : <div className="amb-c" style={{ background: b.amb || b.css }} />}
      <div className="amb-shade" style={{ background: `linear-gradient(180deg, rgba(5,5,5,${k - 0.12}) 0%, rgba(5,5,5,${k}) 45%, rgba(5,5,5,${Math.min(0.96, k + 0.16)}) 100%)` }} />
    </div>
  );
}
