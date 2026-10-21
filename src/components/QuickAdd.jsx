import { forwardRef, useState } from 'react';
import { parseQuick } from '../lib/quickAdd';
import { dayLabel } from '../lib/dates';
import { addTask, toast, todayKey } from '../store';

const KIND = { date: 'hl-date', tag: 'hl-tag', weight: 'hl-w', prio: 'hl-p' };

/* Saisie rapide intelligente : « Sport demain #santé !! * »
   Les mots reconnus sont surlignés pendant la frappe (calque miroir sous le champ) puis retirés du titre. */
const QuickAdd = forwardRef(function QuickAdd({ defaultDate, placeholder }, ref) {
  const [text, setText] = useState('');
  const [scroll, setScroll] = useState(0);
  const today = todayKey();
  const q = parseQuick(text, today);

  const parts = [];
  let i = 0;
  q.tokens.forEach((t, n) => {
    if (t.start > i) parts.push(text.slice(i, t.start));
    parts.push(<mark key={n} className={'hl ' + KIND[t.kind]}>{text.slice(t.start, t.end)}</mark>);
    i = t.end;
  });
  parts.push(text.slice(i));

  const sync = (e) => setScroll(e.currentTarget.scrollLeft);
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!q.title) { toast('Ajoute un titre à la tâche.'); return; }
    const date = q.date === undefined ? defaultDate : q.date;
    addTask({ text: q.title, date, weight: q.weight, prio: q.prio, tags: q.tags });
    if (date !== defaultDate) toast(`Ajoutée : ${dayLabel(date, today)}`);
    setText('');
    setScroll(0);
  };

  return (
    <form className="mb-3.5" onSubmit={submit}>
      <div className="flex gap-2">
        <div className="field qa">
          <div className="qa-mirror" aria-hidden="true"><span style={{ transform: `translateX(${-scroll}px)` }}>{parts}{'​'}</span></div>
          <input
            ref={ref} value={text} maxLength={200} autoComplete="off" enterKeyHint="done" aria-label="Nouvelle tâche"
            placeholder={placeholder}
            onChange={(e) => { setText(e.target.value); sync(e); }}
            onScroll={sync} onKeyUp={sync} onClick={sync} onSelect={sync}
          />
        </div>
        <button className="b on">Ajouter</button>
      </div>
      {q.tokens.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          {q.date !== undefined && <span className="chip hl-date">📅 {dayLabel(q.date, today)}</span>}
          {q.tags.map((t) => <span key={t} className="chip hl-tag">#{t}</span>)}
          {q.weight && <span className="chip hl-w">Poids {q.weight}</span>}
          {q.prio && <span className="chip hl-p">★ Priorité</span>}
        </div>
      )}
    </form>
  );
});
export default QuickAdd;
