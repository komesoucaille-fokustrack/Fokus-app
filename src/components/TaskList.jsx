import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  addSub, addTag, getState, toast, setTaskField, taskDur, clearFlash, deleteSub, deleteTask, editSub, editTask, moveTask, setDate, setOpen, setWeight, startFocus,
  todayKey, toggleSel, togglePrio, toggleSub, toggleTaskTag, uncheck, useStore,
} from '../store';
import { addDays, dayLabel } from '../lib/dates';
import { EstChip, EstEditor, fmtMin } from './Estimate';

export { fmtMin };

/* Transitions fluides de liste (FLIP) : compare les positions avant/après chaque rendu.
   Après un glisser-déposer, seule la tâche lâchée glisse jusqu'à sa place (les autres y sont déjà). */
function useFlip(listRef, tasks, dropRef) {
  const prev = useRef(null);
  useLayoutEffect(() => {
    const items = [...listRef.current.querySelectorAll(':scope > li[data-id]')];
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

export function TagChip({ tag, on, onClick, small }) {
  const style = { '--tc': tag.color };
  const cls = 'tag ' + (on === false ? 'off ' : '') + (small ? 'sm' : '');
  return onClick
    ? <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={!!on}>{tag.name}</button>
    : <span className={cls} style={style}>{tag.name}</span>;
}

/* Panneau d'options avancées (s'ouvre au tap sur la tâche) */
export function Details({ t, today }) {
  const { S } = useStore();
  const [sub, setSub] = useState('');
  const [tag, setTag] = useState('');
  const wrap = useRef(null);
  useLayoutEffect(() => {
    gsap.from(wrap.current, { height: 0, opacity: 0, duration: 0.45, ease: 'expo.out', clearProps: 'height,opacity' });
  }, []);
  const tomorrow = addDays(today, 1);
  const picked = t.date && t.date > tomorrow;
  const addS = (e) => { e.preventDefault(); const v = sub.trim(); if (v) { addSub(t.id, v); setSub(''); } };
  const addT = (e) => { e.preventDefault(); const v = tag.trim(); if (!v) return; const id = addTag(v); if (id && !t.tags.includes(id)) toggleTaskTag(t.id, id); setTag(''); };
  return (
    <div ref={wrap} className="details" onClick={(e) => e.stopPropagation()}>
      {!t.done && (
        <div className="drow">
          <span className="dlab">Date</span>
          <div className="segs">
            <button type="button" className={'seg ' + (t.date && t.date <= today ? 'on' : '')} onClick={() => setDate(t.id, today)}>Aujourd’hui</button>
            <button type="button" className={'seg ' + (t.date === tomorrow ? 'on' : '')} onClick={() => setDate(t.id, tomorrow)}>Demain</button>
            <label className={'seg relative ' + (picked ? 'on' : '')}>
              📅 {picked ? dayLabel(t.date, today) : 'Choisir une date'}
              <input
                type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" min={today} value={t.date || ''}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* non supporté */ } }}
                onChange={(e) => e.target.value && setDate(t.id, e.target.value)}
              />
            </label>
            <button type="button" className={'seg ' + (t.date === null ? 'on' : '')} onClick={() => setDate(t.id, null)}>Plus tard</button>
          </div>
        </div>
      )}
      <div className="drow">
        <span className="dlab">Points</span>
        <div className="segs">
          {[1, 2, 3].map((w) => (
            <button type="button" key={w} className={'seg ' + (t.weight === w ? 'on' : '')} onClick={() => setWeight(t.id, w)}>{w} pt{w > 1 ? 's' : ''}</button>
          ))}
        </div>
      </div>
      <div className="drow">
        <span className="dlab">Priorité</span>
        <div className="segs">
          <button type="button" className={'seg gold ' + (t.prio ? 'on' : '')} onClick={() => togglePrio(t.id)}>★ Priorité du jour</button>
        </div>
      </div>
      <div className="drow">
        <span className="dlab">Étiquettes</span>
        <div className="segs">
          {S.tags.map((g) => <TagChip key={g.id} tag={g} on={t.tags.includes(g.id)} onClick={() => toggleTaskTag(t.id, g.id)} />)}
          <form className="flex gap-1" onSubmit={addT}>
            <input className="field mini" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nouvelle…" maxLength={24} />
            <button className="seg" aria-label="Créer l’étiquette">+</button>
          </form>
        </div>
      </div>
      <div className="drow items-start!">
        <span className="dlab pt-2.5">Sous-tâches</span>
        <div className="min-w-0 flex-1">
          {t.subs.map((s) => (
            <div key={s.id} className="subrow">
              <button type="button" className={'sck ' + (s.done ? 'on' : '')} onClick={() => toggleSub(t.id, s.id)} aria-label={s.done ? 'Décocher' : 'Cocher'} />
              <input
                className={'subt ' + (s.done ? 'line-through text-mut' : '')} defaultValue={s.text} maxLength={160}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.text) editSub(t.id, s.id, v); else e.target.value = s.text; }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <button type="button" className="ic" onClick={() => deleteSub(t.id, s.id)} aria-label="Supprimer la sous-tâche">✕</button>
            </div>
          ))}
          <form className="mt-1 flex gap-1.5" onSubmit={addS}>
            <input className="field mini flex-1" value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Ajouter une sous-tâche…" maxLength={160} />
            <button className="seg">Ajouter</button>
          </form>
        </div>
      </div>
      <div className="drow">
        <span className="dlab">Temps estimé</span>
        <div className="segs items-center">
          <EstEditor t={t} />
          <span className="text-[13px] text-mut">« ~45 » ou « ~1h30 » à la saisie</span>
        </div>
      </div>
      <div className="drow">
        <span className="dlab">Heure</span>
        <div className="segs items-center">
          <input type="time" className="field mini w-[120px]! flex-none!" value={t.time || ''} aria-label="Heure de début"
            onChange={(e) => setTaskField(t.id, { time: e.target.value || null })} />
          {t.time && <button type="button" className="seg" onClick={() => setTaskField(t.id, { time: null })}>Sans heure</button>}
          <span className="text-[13px] text-mut">{t.time ? `Durée ${fmtMin(taskDur(t, S))}` : 'facultative (« 14h30 » à la saisie)'}</span>
        </div>
      </div>
      <div className="drow">
        <span className="dlab">Concentration</span>
        <div className="segs items-center">
          {!t.done && <button type="button" className="seg on" onClick={() => startFocus(t.id)}>▶ Lancer le minuteur</button>}
          <span className="text-[13px] text-mut">Temps cumulé : {fmtMin(t.focus)}</span>
        </div>
      </div>
    </div>
  );
}

function Task({ t, selected, busy, onGrab, mode, open, flash, today }) {
  const { S } = useStore();
  const auto = S.set.order === 'auto';
  const [editing, setEditing] = useState(false);
  const li = useRef(null);
  const input = useRef(null);

  useLayoutEffect(() => { if (editing) { input.current.focus(); input.current.select(); } }, [editing]);
  useEffect(() => {
    if (!flash) return;
    li.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    gsap.fromTo(li.current, { boxShadow: '0 0 0 2px rgba(255,255,255,.9), 0 0 40px rgba(255,255,255,.25)' }, { boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,.14), 0 10px 30px -10px rgba(0,0,0,.6)', duration: 1.8, delay: 0.3, ease: 'power2.out', clearProps: 'boxShadow' });
    clearFlash();
  }, [flash]);

  const commit = () => {
    const v = input.current.value.trim();
    if (v && v !== t.text) editTask(t.id, v);
    setEditing(false);
  };
  const del = () => gsap.to(li.current, { opacity: 0, x: 40, duration: 0.25, ease: 'power2.in', onComplete: () => deleteTask(t.id) });
  const tags = t.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean);
  const subsDone = t.subs.filter((s) => s.done).length;
  const canSel = mode === 'today';

  return (
    <li ref={li} data-id={t.id} className={'task ' + (t.done ? 'done ' : selected ? 'sel ' : '') + (t.prio ? 'prio ' : '') + (open ? 'open' : '')}>
      {canSel && <button className="ck" aria-label={t.done ? 'Terminée' : 'Sélectionner'} disabled={t.done} onClick={() => toggleSel(t.id)} />}
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
        <button type="button" className="t tbtn" onClick={() => setOpen(t.id)} aria-expanded={open} title="Options de la tâche">
          <span className="tt">{t.prio && <span className="star">★ </span>}{t.text}</span>
          <span className="meta">
            <span className={'chip pts w' + t.weight}>{t.weight} pt{t.weight > 1 ? 's' : ''}</span>
            {t.carried >= 2 && <span className="chip warn">reportée {t.carried}×</span>}
            {tags.map((g) => <TagChip key={g.id} tag={g} small />)}
            {t.subs.length > 0 && (
              <span className="chip flex items-center gap-1.5">
                <span className="mini-bar"><i style={{ width: (subsDone / t.subs.length) * 100 + '%' }} /></span>
                {subsDone}/{t.subs.length}
              </span>
            )}
            {t.time && <span className="chip">🕑 {t.time}</span>}
            {(t.est > 0 || !t.done) && <EstChip t={t} />}
            {t.rid && <span className="chip">↻</span>}
          </span>
        </button>
      )}
      <span className="flex items-center gap-1">
        {t.done
          ? <button className="ic undo" onClick={() => uncheck(t.id)} title="Décocher (remettre à faire)" aria-label="Décocher" disabled={busy}>↺</button>
          : <button className="ic pen" onClick={() => setEditing(true)} title="Modifier" aria-label="Modifier"><Pen /></button>}
        <button className="ic" onClick={del} title="Supprimer" aria-label="Supprimer">🗑</button>
        <button
          className="grip"
          title={auto ? 'Ordre automatique : passe en ordre manuel (Réglages) pour déplacer' : 'Rester appuyé et glisser pour déplacer'}
          aria-label="Déplacer la tâche"
          disabled={busy || editing}
          onPointerDown={(e) => onGrab(e, li.current, t.id)}
          data-auto={auto || undefined}
        ><Grip /></button>
      </span>
      {open && !editing && <Details t={t} today={today} />}
    </li>
  );
}

export default function TaskList({ tasks, sel, busy, mode = 'today', empty }) {
  const { UI } = useStore();
  const list = useRef(null);
  const dropRef = useRef(null);
  useFlip(list, tasks, dropRef);
  const today = todayKey();

  /* Glisser-déposer tactile (iPad) et souris : la tâche suit le doigt, les autres s'écartent */
  const onGrab = (e, el, id) => {
    if (busy || e.button > 0) return;
    e.preventDefault();
    if (getState().set.order === 'auto') {
      toast('Ordre automatique : les tâches sont triées par priorité puis par points. Choisis « Manuel » dans Réglages → Score et affichage pour les déplacer.', null, 5200);
      return;
    }
    const handle = e.currentTarget;
    handle.setPointerCapture?.(e.pointerId);
    const items = [...list.current.querySelectorAll(':scope > li[data-id]')];
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
        moveTask(id, items[to].dataset.id, to > from); // relatif à la tâche visée : l'ordre choisi est conservé partout
      } else {
        gsap.fromTo(el, { y: visualTop - el.offsetTop }, { y: 0, duration: 0.3, ease: 'power3.out', clearProps: 'transform' });
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return (
    <ul ref={list} className="relative p-0">
      {tasks.length ? (
        tasks.map((t) => (
          <Task
            key={t.id} t={t} selected={sel.has(t.id)} busy={busy} onGrab={onGrab} mode={mode}
            open={UI.open === t.id} flash={UI.flash === t.id} today={today}
          />
        ))
      ) : (
        empty ? <div className="py-6 text-center text-mut">{empty}</div> : (
          <div className="empty">
            <span className="empty-i" aria-hidden="true">✓</span>
            <b>Page blanche.</b>
            <span>Ajoute ta première tâche au-dessus — ou savoure le calme.</span>
          </div>
        )
      )}
    </ul>
  );
}
