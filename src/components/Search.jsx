import { useState } from 'react';
import Sheet from './Sheet';
import { TagChip } from './TaskList';
import { dayLabel } from '../lib/dates';
import { describeRule, goToTask, todayKey, useStore } from '../store';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Recherche dans toutes les tâches (aujourd'hui, à venir, plus tard, sous-tâches, étiquettes, récurrences) */
export default function Search({ onClose }) {
  const { S } = useStore();
  const [q, setQ] = useState('');
  const today = todayKey();
  const f = fold(q.trim());
  const tagName = (id) => S.tags.find((g) => g.id === id)?.name || '';
  const hits = f
    ? S.tasks.filter((t) => fold([t.text, ...t.subs.map((s) => s.text), ...t.tags.map(tagName)].join(' ')).includes(f)).slice(0, 50)
    : [];
  const recs = f ? S.rec.filter((r) => fold(r.text).includes(f)) : [];
  return (
    <Sheet title="Rechercher" onClose={onClose} top>
      <input
        autoFocus className="field mb-3 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Une tâche, une sous-tâche, une étiquette…"
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) goToTask(hits[0].id); }} enterKeyHint="search"
      />
      {f && !hits.length && !recs.length && <div className="py-6 text-center text-mut">Aucun résultat.</div>}
      <ul className="p-0">
        {hits.map((t) => (
          <li key={t.id} className={'task cursor-pointer ' + (t.done ? 'done' : '')} onClick={() => goToTask(t.id)}>
            <span className="t">
              <span className="tt">{t.prio && <span className="star">★ </span>}{t.text}</span>
              <span className="meta">
                <span className="chip">{t.done ? 'Terminée' : dayLabel(t.date && t.date < today ? today : t.date, today)}</span>
                {t.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean).map((g) => <TagChip key={g.id} tag={g} small />)}
              </span>
            </span>
            <span className="text-mut">›</span>
          </li>
        ))}
        {recs.map((r) => (
          <li key={r.id} className="task">
            <span className="t"><span className="tt">{r.text}</span><span className="meta"><span className="chip">↻ {describeRule(r.rule)}</span></span></span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
