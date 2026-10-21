import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { addRec, deleteRec, useStore } from '../store';

export default function RecurringModal({ onClose }) {
  const { S } = useStore();
  const [v, setV] = useState('');
  const card = useRef(null);
  useLayoutEffect(() => { gsap.from(card.current, { y: 20, scale: 0.97, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' }); }, []);
  const submit = (e) => { e.preventDefault(); const t = v.trim(); if (!t) return; addRec(t); setV(''); };
  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={card} className="card m-0! max-h-[85vh] w-full max-w-[460px] overflow-auto bg-cont!">
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-lg tracking-tight">Tâches récurrentes</b>
          <button className="ic" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <p className="mb-3.5 text-[13px] text-mut">Ajoutées automatiquement à chaque nouveau jour.</p>
        <form className="mb-3.5 flex gap-2" onSubmit={submit}>
          <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex. : Lire 20 minutes" maxLength={200} autoComplete="off" />
          <button className="b on">Ajouter</button>
        </form>
        <ul className="p-0">
          {S.rec.length ? S.rec.map((r) => (
            <li key={r.id} className="task cursor-default!">
              <span className="t">{r.text}</span>
              <button className="ic" onClick={() => deleteRec(r.id)} title="Supprimer">🗑</button>
            </li>
          )) : <div className="py-6 text-center text-mut">Aucune tâche récurrente.</div>}
        </ul>
      </div>
    </div>
  );
}
