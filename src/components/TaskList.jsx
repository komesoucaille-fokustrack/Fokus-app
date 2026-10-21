import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { deleteTask, editTask, moveTask, toggleSel } from '../store';

/* Transitions fluides de liste (FLIP) : compare les positions avant/après chaque rendu.
   Après un glisser-déposer, seule la tâche lâchée glisse jusqu'à sa place (les autres y sont déjà). */
function useFlip(listRef, tasks, dropRef) {
  const prev = useRef(null);
  useLayoutEffect(() => {
    const items = [...listRef.current.querySelectorAll('li[data-id]')];
    const pos = Object.fromEntries(items.map((li) => [li.dataset.id, li.offsetTop]));
    const drop = dropRef.current;
    dropRef.current = null;
    if (drop) {
      const li = items.find((x) => x.dataset.id === drop.id);
      if (li) gsap.fromTo(li, { y: drop.top - li.offsetTop }, { y: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform' });
    } else if (prev.current) {
      items.forEach((li) => {
        const b = prev.current[li.dataset.id], a = pos[li.dataset.id];
        if (b === undefined) gsap.from(li, { opacity: 0, y: -14, scale: 0.98, duration: 0.55, ease: 'power4.out', clearProps: 'transform,opacity' });
        else if (Math.abs(b - a) > 1) gsap.from(li, { y: b - a, duration: 0.6, ease: 'expo.out', clearProps: 'transform' });
      });
    }
    prev.current = pos;
  }, [tasks, listRef, dropRef]);
}

/* Poignée « 6 points » : rester appuyé et glisser pour replacer la tâche */
function Grip() {
  return (
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" />))}
    </svg>
  );
}

function Pen() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Task({ t, selected, busy, onGrab }) {
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

  return (
    <li ref={li} data-id={t.id} className={'task ' + (t.done ? 'done' : selected ? 'sel' : '')}>
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
      <span className="flex items-center gap-1">
        {!t.done && <button className="ic pen" onClick={() => setEditing(true)} title="Modifier" aria-label="Modifier"><Pen /></button>}
        <button className="ic" onClick={del} title="Supprimer" aria-label="Supprimer">🗑</button>
        <button
          className="grip"
          title="Rester appuyé et glisser pour déplacer"
          aria-label="Déplacer la tâche"
          disabled={busy || editing}
          onPointerDown={(e) => onGrab(e, li.current, t.id)}
        ><Grip /></button>
      </span>
    </li>
  );
}

export default function TaskList({ tasks, sel, busy }) {
  const list = useRef(null);
  const dropRef = useRef(null);
  useFlip(list, tasks, dropRef);

  /* Glisser-déposer tactile (iPad) et souris : la tâche suit le doigt, les autres s'écartent */
  const onGrab = (e, el, id) => {
    if (busy || e.button > 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    const items = [...list.current.querySelectorAll('li[data-id]')];
    const from = items.indexOf(el);
    const tops = items.map((x) => x.offsetTop), hs = items.map((x) => x.offsetHeight);
    const gap = parseFloat(getComputedStyle(el).marginBottom) || 8, shift = hs[from] + gap;
    const startY = e.clientY;
    let to = from;
    el.classList.add('dragging');
    items.forEach((x) => { if (x !== el) x.style.transition = 'transform .22s cubic-bezier(.22,1,.36,1)'; });

    const move = (ev) => {
      const dy = ev.clientY - startY;
      el.style.transform = `translateY(${dy}px) scale(1.02)`;
      const center = tops[from] + hs[from] / 2 + dy;
      to = from;
      items.forEach((x, i) => {
        if (i === from) return;
        const c = tops[i] + hs[i] / 2;
        if (i > from && center > c) to = Math.max(to, i);
        if (i < from && center < c) to = Math.min(to, i);
      });
      items.forEach((x, i) => {
        if (i === from) return;
        const off = from < to && i > from && i <= to ? -shift : from > to && i < from && i >= to ? shift : 0;
        x.style.transform = off ? `translateY(${off}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      const visualTop = el.getBoundingClientRect().top - list.current.getBoundingClientRect().top;
      el.classList.remove('dragging');
      items.forEach((x) => { x.style.transition = ''; x.style.transform = ''; });
      if (to !== from) {
        dropRef.current = { id, top: visualTop };
        moveTask(id, to);
      } else {
        gsap.fromTo(el, { y: visualTop - el.offsetTop }, { y: 0, duration: 0.3, ease: 'power3.out', clearProps: 'transform' });
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return (
    <ul id="list" ref={list} className="relative p-0">
      {tasks.length ? (
        tasks.map((t) => <Task key={t.id} t={t} selected={sel.has(t.id)} busy={busy} onGrab={onGrab} />)
      ) : (
        <div className="py-6 text-center text-mut">Aucune tâche. Ajoutez-en une ci-dessus.</div>
      )}
    </ul>
  );
}
