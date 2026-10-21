import { forwardRef, useState } from 'react';
import { parseQuick } from '../lib/quickAdd';
import { JOURS_COURTS, dayLabel } from '../lib/dates';
import { TagChip } from './TaskList';
import { addRec, addTask, deleteRec, describeRule, toast, todayKey, useStore } from '../store';

const KIND = { date: 'hl-date', tag: 'hl-tag', weight: 'hl-w', prio: 'hl-p' };
const TYPES = [['daily', 'Tous les jours'], ['interval', 'Tous les X jours'], ['weekdays', 'Certains jours'], ['monthday', 'Un jour du mois']];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche

/* Récurrence (onglet à côté de « Ajouter ») : type de répétition + liste des récurrences existantes */
function RecPanel({ rule, setRule }) {
  const { S } = useStore();
  const { type, days, every, day } = rule;
  const up = (p) => setRule({ ...rule, ...p });
  const toggleDay = (d) => up({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  return (
    <div className="recpanel">
      <div className="segs">
        {TYPES.map(([k, l]) => <button type="button" key={k} className={'seg ' + (type === k ? 'on' : '')} onClick={() => up({ type: k })}>{l}</button>)}
      </div>
      {type === 'weekdays' && (
        <div className="segs">
          {ORDER.map((d) => <button type="button" key={d} className={'seg w-12 ' + (days.includes(d) ? 'on' : '')} onClick={() => toggleDay(d)}>{JOURS_COURTS[d]}</button>)}
          <button type="button" className="seg" onClick={() => up({ days: [1, 2, 3, 4, 5] })}>Lun–ven</button>
          <button type="button" className="seg" onClick={() => up({ days: [0, 6] })}>Week-end</button>
        </div>
      )}
      {type === 'interval' && (
        <label className="flex flex-wrap items-center gap-2 text-[14px]">Tous les
          <input type="number" className="field mini w-20! flex-none!" min={1} max={365} value={every} onChange={(e) => up({ every: Math.max(1, Math.min(365, +e.target.value || 1)) })} />
          jours, à partir d’aujourd’hui
        </label>
      )}
      {type === 'monthday' && (
        <label className="flex flex-wrap items-center gap-2 text-[14px]">Le
          <input type="number" className="field mini w-20! flex-none!" min={1} max={31} value={day} onChange={(e) => up({ day: Math.max(1, Math.min(31, +e.target.value || 1)) })} />
          de chaque mois <span className="text-[12px] text-mut">(31 = dernier jour des mois courts)</span>
        </label>
      )}
      {S.rec.length > 0 && (
        <ul className="m-0 mt-1 p-0">
          {S.rec.map((r) => (
            <li key={r.id} className={'task cursor-default! py-1.5! ' + (r.prio ? 'prio' : '')}>
              <span className="t">
                <span className="tt">{r.prio && <span className="star">★ </span>}{r.text}</span>
                <span className="meta">
                  <span className="chip">↻ {describeRule(r.rule)}</span>
                  <span className="chip">{r.weight} pt{r.weight > 1 ? 's' : ''}</span>
                  {r.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean).map((g) => <TagChip key={g.id} tag={g} small />)}
                </span>
              </span>
              <button type="button" className="ic" onClick={() => deleteRec(r.id)} title="Supprimer la récurrence" aria-label="Supprimer la récurrence">🗑</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Saisie rapide intelligente : « Sport demain #santé !! * »
   Les mots reconnus sont surlignés pendant la frappe (calque miroir sous le champ) puis retirés du titre.
   Points (1, 2, 3) et priorité se choisissent directement à l'ajout ; « ↻ Récurrence » transforme l'ajout en tâche récurrente. */
const QuickAdd = forwardRef(function QuickAdd({ defaultDate, placeholder, allowRec }, ref) {
  const { S } = useStore();
  const [text, setText] = useState('');
  const [scroll, setScroll] = useState(0);
  const [weight, setWeight] = useState(null);
  const [prio, setPrio] = useState(false);
  const [rec, setRec] = useState(false);
  const [rule, setRule] = useState({ type: 'daily', days: [1, 2, 3, 4, 5], every: 2, day: 1 });
  const today = todayKey();
  const q = parseQuick(text, today);
  const w = q.weight ?? weight ?? S.set.defWeight;
  const pr = q.prio || prio;

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
    if (rec) {
      if (rule.type === 'weekdays' && !rule.days.length) { toast('Choisis au moins un jour.'); return; }
      addRec({ text: q.title, rule, weight: w, tags: q.tags, prio: pr });
    } else {
      const date = q.date === undefined ? defaultDate : q.date;
      addTask({ text: q.title, date, weight: w, prio: pr, tags: q.tags });
      if (date !== defaultDate) toast(`Ajoutée : ${dayLabel(date, today)}`);
    }
    setText('');
    setScroll(0);
    setPrio(false);
    setWeight(null);
  };

  return (
    <form className="mb-3.5" onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        <div className="field qa min-w-[200px]">
          <div className="qa-mirror" aria-hidden="true"><span style={{ transform: `translateX(${-scroll}px)` }}>{parts}{'​'}</span></div>
          <input
            ref={ref} value={text} maxLength={200} autoComplete="off" enterKeyHint="done" aria-label={rec ? 'Nouvelle tâche récurrente' : 'Nouvelle tâche'}
            placeholder={rec ? 'Tâche récurrente… (ex. « Lire 20 min #lecture »)' : placeholder}
            onChange={(e) => { setText(e.target.value); sync(e); }}
            onScroll={sync} onKeyUp={sync} onClick={sync} onSelect={sync}
          />
        </div>
        <span className="flex gap-2">
          <button className="b on">Ajouter</button>
          {allowRec && (
            <button type="button" className={'b ' + (rec ? 'on' : '')} onClick={() => setRec((r) => !r)} aria-pressed={rec} title="Ajouter une tâche récurrente">↻ Récurrence</button>
          )}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <button type="button" key={n} className={'seg pts ' + (w === n ? 'on' : '')} onClick={() => setWeight(n)} aria-pressed={w === n}>{n} pt{n > 1 ? 's' : ''}</button>
        ))}
        <button type="button" className={'seg gold ' + (pr ? 'on' : '')} onClick={() => setPrio((p) => !p)} aria-pressed={pr}>★ Priorité</button>
        {q.date !== undefined && !rec && <span className="chip hl-date">📅 {dayLabel(q.date, today)}</span>}
        {q.tags.map((t) => <span key={t} className="chip hl-tag">#{t}</span>)}
      </div>
      {rec && <RecPanel rule={rule} setRule={setRule} />}
    </form>
  );
});
export default QuickAdd;
