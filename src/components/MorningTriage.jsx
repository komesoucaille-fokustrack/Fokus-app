import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { TagChip } from './TaskList';
import { carriedTasks, deleteTask, setDate, todayKey, useStore } from '../store';
import { addDays } from '../lib/dates';

/* « Tri du matin » : les tâches reportées, carte par carte, à trier au pouce */
export default function MorningTriage({ onClose }) {
  const { S } = useStore();
  const [list] = useState(() => carriedTasks().map((t) => t.id));
  const [i, setI] = useState(0);
  const card = useRef(null);
  const t = S.tasks.find((x) => x.id === list[i]);

  useLayoutEffect(() => {
    if (card.current) gsap.from(card.current, { x: 40, opacity: 0, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [i]);

  const next = (fn, dir = -1) => {
    gsap.to(card.current, {
      x: dir * 60, opacity: 0, duration: 0.22, ease: 'power2.in',
      onComplete: () => { fn(); if (i + 1 >= list.length) onClose(); else setI(i + 1); },
    });
  };
  if (!t) { if (i + 1 < list.length) setTimeout(() => setI(i + 1)); else setTimeout(onClose); return null; }
  const today = todayKey();
  const tags = t.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean);

  return (
    <Sheet title="Tri du matin" sub={`${list.length} tâche${list.length > 1 ? 's' : ''} reportée${list.length > 1 ? 's' : ''} depuis hier. On garde quoi aujourd’hui ?`} onClose={onClose}>
      <div className="mb-3 text-center text-[12px] text-mut tabular-nums">{i + 1} / {list.length}</div>
      <div ref={card} className="mb-4 rounded-2xl border border-line bg-card p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
        <div className="text-xl font-semibold tracking-tight break-words">{t.prio && '★ '}{t.text}</div>
        <div className="meta mt-2 justify-center">
          <span className="chip warn">reportée {t.carried}×</span>
          {t.weight > 1 && <span className="chip">{t.weight} pts</span>}
          {tags.map((g) => <TagChip key={g.id} tag={g} small />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="b on py-3!" onClick={() => next(() => {}, 1)}>Garder aujourd’hui</button>
        <button className="b py-3!" onClick={() => next(() => setDate(t.id, addDays(today, 1)))}>Demain</button>
        <button className="b py-3!" onClick={() => next(() => setDate(t.id, null))}>Plus tard</button>
        <button className="b py-3!" onClick={() => next(() => deleteTask(t.id, true))}>Supprimer</button>
      </div>
      <button className="b mt-3 w-full py-3! text-mut" onClick={onClose}>Tout garder</button>
    </Sheet>
  );
}
