import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/* Page figée derrière les fenêtres : le corps passe en position fixe (iPad / iPhone ignorent overflow: hidden),
   puis revient exactement au même endroit à la fermeture. Compteur : plusieurs fenêtres empilées possibles. */
let locks = 0, y0 = 0;
function lockScroll() {
  if (locks++) return;
  y0 = scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${y0}px`, left: '0', right: '0', width: '100%' });
  const h = document.getElementById('hdr'); // en-tête « sticky » : gardé en haut de l'écran pendant que la page est figée
  if (h) h.style.transform = `translateY(${y0}px)`;
}
function unlockScroll() {
  if (--locks) return;
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '' });
  const h = document.getElementById('hdr');
  if (h) h.style.transform = '';
  scrollTo({ top: y0, behavior: 'instant' });
}

/* Fenêtre modale commune (fond figé, entrée « spring », fermeture au tap à l'extérieur ; Échap géré par App) */
export default function Sheet({ title, sub, onClose, children, wide, top, xl }) {
  const card = useRef(null);
  useLayoutEffect(() => { lockScroll(); return unlockScroll; }, []);
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 20, scale: 0.97, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <div
      className={'fixed inset-0 z-70 flex justify-center bg-black/75 p-4 ' + (top ? 'items-start pt-[max(16px,env(safe-area-inset-top))]' : 'items-center')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={card} role="dialog" aria-label={title} className={'card m-0! max-h-[88vh] w-full overflow-auto overscroll-contain bg-cont! ' + (xl ? 'sheet-xl' : wide ? 'max-w-[620px]' : 'max-w-[480px]')}>
        {title && (
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <b className="text-lg tracking-tight">{title}</b>
            <button className="ic close" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        )}
        {sub && <p className="mb-3.5 text-[13px] text-mut">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
