import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/* Fenêtre modale commune (fond flouté, entrée « spring », fermeture au tap à l'extérieur ; Échap géré par App) */
export default function Sheet({ title, sub, onClose, children, wide, top }) {
  const card = useRef(null);
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 20, scale: 0.97, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <div
      className={'fixed inset-0 z-70 flex justify-center bg-black/70 p-4 backdrop-blur-sm ' + (top ? 'items-start pt-[max(16px,env(safe-area-inset-top))]' : 'items-center')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={card} role="dialog" aria-label={title} className={'card m-0! max-h-[88vh] w-full overflow-auto overscroll-contain bg-cont! ' + (wide ? 'max-w-[620px]' : 'max-w-[480px]')}>
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
