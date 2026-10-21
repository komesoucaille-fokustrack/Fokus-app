import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MOVES, deleteTask, editTask, moveTask, toggleSel } from '../store';

/* Transitions fluides de liste (FLIP) : compare les positions avant/après chaque rendu */
function useFlip(listRef, tasks) {
  const prev = useRef(null);
  useLayoutEffect(() => {
    const items = [...listRef.current.querySelectorAll('li[data-id]')];
    const pos = Object.fromEntries(items.map((li) => [li.dataset.id, li.offsetTop]));
    if (prev.current) {
      items.forEach((li) => {
        const b = prev.current[li.dataset.id], a = pos[li.dataset.id];
        if (b === undefined) gsap.from(li, { opacity: 0, y: -14, scale: 0.98, duration: 0.55, ease: 'power4.out', clearProps: 'transform,opacity' });
        else if (Math.abs(b - a) > 1) gsap.from(li, { y: b - a, duration: 0.6, ease: 'expo.out', clearProps: 'transform' });
      });
    }
    prev.current = pos;
  }, [tasks, listRef]);
}

function Task({ t, i, n, selected, busy, dragId, setDragId }) {
  const [editing, setEditing] = useState(false);
  const li = useRef(null);
  const input = useRef(null);

  useLayoutEffect(() => { if (editing) { input.current.focus(); input.current.select(); } }, [editing]);

  const commit = () => {
    const v = input.current.value.trim();
    if (v && v !== t.text) editTask(t.id, v);
    setEditing(false);
  };
  const del = () => gsap.to(li.current, { opacity: 0, x: 40, duration: 0.25, ease: 'power2.in', onComplete: () => deleteTask(t.id) });
  const mv = (k) => () => !busy && moveTask(t.id, MOVES[k]);

  return (
    <li
      ref={li}
      data-id={t.id}
      draggable={!editing && !busy}
      className={'task ' + (t.done ? 'done' : selected ? 'sel' : '') + (dragId === t.id ? ' drag' : '')}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); setDragId(t.id); }}
      onDragEnd={() => setDragId(null)}
    >
      <button className="ck" aria-label="Sélectionner" onClick={() => toggleSel(t.id)} />
      {editing ? (
        <input
          ref={input}
          className="field t py-1.5!"
          defaultValue={t.text}
          maxLength={200}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <span className="t" onDoubleClick={() => !t.done && setEditing(true)}>{t.text}</span>
      )}
      <span className="flex items-center">
        <span className="mv flex items-center">
          <button className="ic" disabled={i === 0} onClick={mv('top')} title="Tout en haut (priorité max)">⏫</button>
          <button className="ic" disabled={i === 0} onClick={mv('up')} title="Monter d’un cran">▲</button>
          <button className="ic" disabled={i === n - 1} onClick={mv('dn')} title="Descendre d’un cran">▼</button>
          <button className="ic" disabled={i === n - 1} onClick={mv('bot')} title="Tout en bas">⏬</button>
        </span>
        {!t.done && <button className="ic" onClick={() => setEditing(true)} title="Modifier">✎</button>}
        <button className="ic" onClick={del} title="Supprimer">🗑</button>
      </span>
    </li>
  );
}

export default function TaskList({ tasks, sel, busy }) {
  const list = useRef(null);
  const [dragId, setDragId] = useState(null);
  useFlip(list, tasks);

  /* Glisser-déposer : réordonne l'état en direct, la FLIP anime le reste */
  const onDragOver = (e) => {
    if (!dragId) return;
    e.preventDefault();
    const items = [...list.current.querySelectorAll('li[data-id]')].filter((li) => li.dataset.id !== dragId);
    const after = items.findIndex((li) => { const r = li.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    const target = after === -1 ? tasks.length - 1 : after;
    if (tasks.findIndex((t) => t.id === dragId) !== target) moveTask(dragId, target);
  };

  return (
    <ul id="list" ref={list} className="p-0" onDragOver={onDragOver} onDrop={(e) => e.preventDefault()}>
      {tasks.length ? (
        tasks.map((t, i) => (
          <Task key={t.id} t={t} i={i} n={tasks.length} selected={sel.has(t.id)} busy={busy} dragId={dragId} setDragId={setDragId} />
        ))
      ) : (
        <div className="py-6 text-center text-mut">Aucune tâche. Ajoutez-en une ci-dessus.</div>
      )}
    </ul>
  );
}
