import { useState } from 'react';
import { PASTELS, addCat, catOf, deleteCat, editCat, useStore } from '../store';

/* =====================================================================
   CATÉGORIES — un grand domaine par tâche (emoji + couleur), en plus des étiquettes libres.
   Puce sur la tâche, sélecteur (ajout rapide, panneau d'options) et rubrique des Réglages.
   ===================================================================== */
export function CatChip({ cat, small, on, onClick, count }) {
  if (!cat) return null;
  const cls = 'cat ' + (small ? 'sm ' : '') + (on === false ? 'off ' : on ? 'on ' : '');
  const body = <><span className="cat-e" aria-hidden="true">{cat.emoji}</span>{cat.name}{count != null && <em>{count}</em>}</>;
  return onClick
    ? <button type="button" className={cls} style={{ '--cc': cat.color }} onClick={onClick} aria-pressed={!!on}>{body}</button>
    : <span className={cls} style={{ '--cc': cat.color }}>{body}</span>;
}

/* Sélecteur natif (sur iPad : la roue / liste du système, rapide au doigt) habillé comme un bouton */
export function CatSelect({ value, onChange, label = 'Catégorie' }) {
  const { S } = useStore();
  const c = catOf(value, S);
  return (
    <label className={'seg catsel ' + (c ? 'on' : '')} style={c ? { '--cc': c.color } : undefined} title="Catégorie">
      <span aria-hidden="true">{c ? `${c.emoji} ${c.name}` : '📂 Catégorie'}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
        <option value="">Aucune catégorie</option>
        {S.cats.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
      </select>
    </label>
  );
}

/* Rubrique « Catégories » des Réglages */
export function CatsSettings({ S, Group }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  return (
    <Group title="Mes catégories" foot="Une catégorie par tâche (le grand domaine), en plus des étiquettes. Astuce : tape « @sport » en ajoutant une tâche.">
      {S.cats.map((c) => (
        <div key={c.id} className="si">
          <input className="field mini w-[54px]! flex-none! text-center text-[18px]" defaultValue={c.emoji} maxLength={8} aria-label="Emoji de la catégorie"
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.emoji) editCat(c.id, { emoji: v }); else e.target.value = c.emoji; }} />
          <input className="field mini min-w-[110px] flex-1" defaultValue={c.name} maxLength={24} aria-label="Nom de la catégorie" style={{ color: c.color }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) editCat(c.id, { name: v }); else e.target.value = c.name; }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          <span className="flex flex-wrap items-center gap-1">
            {PASTELS.map((col) => (
              <button type="button" key={col} className={'swatch ' + (c.color === col ? 'on' : '')} style={{ background: col }} onClick={() => editCat(c.id, { color: col })} aria-label={'Couleur ' + col} />
            ))}
            <button type="button" className="ic" onClick={() => deleteCat(c.id)} aria-label="Supprimer la catégorie">🗑</button>
          </span>
        </div>
      ))}
      <form className="si" onSubmit={(e) => { e.preventDefault(); if (addCat(name, emoji)) { setName(''); setEmoji(''); } }}>
        <input className="field mini w-[54px]! flex-none! text-center text-[18px]" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="📁" maxLength={8} aria-label="Emoji" />
        <input className="field mini flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" maxLength={24} />
        <button className="b on">Créer</button>
      </form>
    </Group>
  );
}
