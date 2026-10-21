import { useState } from 'react';
import Sheet from './Sheet';
import { fmtMin } from './TaskList';
import { planned } from './DayStrip';
import { addDays } from '../lib/dates';
import { setDate, taskDur, todayKey, todayTasks, toast, useStore } from '../store';

/* Sélection rapide des tâches à repousser à demain (n'empêche jamais d'ajouter) */
export default function Overload({ onClose }) {
  const { S } = useStore();
  const list = todayTasks(S.tasks).filter((t) => !t.done);
  const [sel, setSel] = useState(() => new Set());
  const gain = list.filter((t) => sel.has(t.id)).reduce((n, t) => n + (t.est || t.time || t.dur ? taskDur(t, S) : 0), 0);
  const left = planned(S) - gain;
  const go = () => {
    const k = addDays(todayKey(), 1);
    sel.forEach((id) => setDate(id, k));
    toast(`${sel.size} tâche${sel.size > 1 ? 's' : ''} déplacée${sel.size > 1 ? 's' : ''} à demain.`);
    onClose();
  };
  return (
    <Sheet title="Alléger la journée" sub={`Temps disponible : ${fmtMin(S.set.capacity)}. Coche ce qui peut attendre demain.`} onClose={onClose}>
      <ul className="m-0 p-0">
        {list.map((t) => (
          <li key={t.id} className={'task cursor-pointer ' + (sel.has(t.id) ? 'sel' : '')} onClick={() => setSel((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>
            <span className="ck" aria-hidden="true" />
            <span className="t"><span className="tt">{t.prio && <span className="star">★ </span>}{t.text}</span>
              <span className="meta"><span className="chip">{t.est || t.time || t.dur ? fmtMin(taskDur(t, S)) : 'non estimée'}</span></span></span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={'text-[13px] tabular-nums ' + (left > S.set.capacity ? 'text-[#fdba74]' : 'text-[#86efac]')}>Reste prévu : {fmtMin(Math.max(0, left))}</span>
        <button className="b on" disabled={!sel.size} onClick={go}>Déplacer à demain{sel.size ? ` (${sel.size})` : ''}</button>
      </div>
    </Sheet>
  );
}
