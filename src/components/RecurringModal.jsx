import { useState } from 'react';
import Sheet from './Sheet';
import { TagChip } from './TaskList';
import { addRec, addTag, deleteRec, describeRule, useStore } from '../store';
import { JOURS_COURTS } from '../lib/dates';

const TYPES = [['daily', 'Tous les jours'], ['weekdays', 'Certains jours'], ['interval', 'Tous les X jours'], ['monthday', 'Un jour du mois']];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche

export default function RecurringModal({ onClose }) {
  const { S } = useStore();
  const [v, setV] = useState('');
  const [type, setType] = useState('daily');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [every, setEvery] = useState(2);
  const [day, setDay] = useState(1);
  const [weight, setWeight] = useState(S.set.defWeight);
  const [prio, setPrio] = useState(false);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');

  const toggleDay = (d) => setDays((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]));
  const toggleTag = (id) => setTags((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const submit = (e) => {
    e.preventDefault();
    const t = v.trim();
    if (!t) return;
    addRec({ text: t, rule: { type, days, every, day }, weight, tags, prio });
    setV('');
  };
  const createTag = () => { const id = addTag(newTag); if (id) setTags((a) => [...new Set([...a, id])]); setNewTag(''); };

  return (
    <Sheet title="Tâches récurrentes" sub="Ajoutées automatiquement les jours prévus, une seule fois par jour (jamais de doublon)." onClose={onClose} wide>
      <form className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-card p-3" onSubmit={submit}>
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex. : Lire 20 minutes" maxLength={200} autoComplete="off" />
        <div className="segs">
          {TYPES.map(([k, l]) => <button type="button" key={k} className={'seg ' + (type === k ? 'on' : '')} onClick={() => setType(k)}>{l}</button>)}
        </div>
        {type === 'weekdays' && (
          <div className="segs">
            {ORDER.map((d) => <button type="button" key={d} className={'seg w-12 ' + (days.includes(d) ? 'on' : '')} onClick={() => toggleDay(d)}>{JOURS_COURTS[d]}</button>)}
            <button type="button" className="seg" onClick={() => setDays([1, 2, 3, 4, 5])}>Lun–ven</button>
          </div>
        )}
        {type === 'interval' && (
          <label className="flex items-center gap-2 text-[14px]">Tous les
            <input type="number" className="field mini w-20! flex-none!" min={1} max={365} value={every} onChange={(e) => setEvery(Math.max(1, Math.min(365, +e.target.value || 1)))} />
            jours (à partir d’aujourd’hui)
          </label>
        )}
        {type === 'monthday' && (
          <label className="flex items-center gap-2 text-[14px]">Le
            <input type="number" className="field mini w-20! flex-none!" min={1} max={31} value={day} onChange={(e) => setDay(Math.max(1, Math.min(31, +e.target.value || 1)))} />
            de chaque mois <span className="text-[12px] text-mut">(31 → dernier jour des mois courts)</span>
          </label>
        )}
        <div className="segs">
          {[1, 2, 3].map((w) => <button type="button" key={w} className={'seg ' + (weight === w ? 'on' : '')} onClick={() => setWeight(w)}>Poids {w}</button>)}
          <button type="button" className={'seg ' + (prio ? 'on' : '')} onClick={() => setPrio((p) => !p)}>★ Priorité</button>
        </div>
        <div className="segs">
          {S.tags.map((g) => <TagChip key={g.id} tag={g} on={tags.includes(g.id)} onClick={() => toggleTag(g.id)} />)}
          <input className="field mini w-32! flex-none!" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nouvelle étiquette" maxLength={24}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createTag(); } }} />
          {newTag.trim() && <button type="button" className="seg" onClick={createTag}>+</button>}
        </div>
        <button className="b on self-start">Ajouter la récurrence</button>
      </form>
      <ul className="p-0">
        {S.rec.length ? S.rec.map((r) => (
          <li key={r.id} className="task cursor-default!">
            <span className="t">
              <span className="tt">{r.prio && <span className="star">★ </span>}{r.text}</span>
              <span className="meta">
                <span className="chip">{describeRule(r.rule)}</span>
                {r.weight > 1 && <span className="chip">{r.weight} pts</span>}
                {r.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean).map((g) => <TagChip key={g.id} tag={g} small />)}
              </span>
            </span>
            <button className="ic" onClick={() => deleteRec(r.id)} title="Supprimer" aria-label="Supprimer la récurrence">🗑</button>
          </li>
        )) : <div className="py-6 text-center text-mut">Aucune tâche récurrente.</div>}
      </ul>
    </Sheet>
  );
}
