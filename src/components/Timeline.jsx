import { useEffect, useMemo, useRef, useState } from 'react';
import { Details, fmtMin } from './TaskList';
import Sheet from './Sheet';
import { addTask, setOpen, setTaskField, taskDur, toast, toggleSel, todayKey, useStore } from '../store';
import { eventsOn, useCalendars } from '../lib/calendars';

/* =====================================================================
   « MA JOURNÉE » EN CHRONOLOGIE (6 h → 24 h)
   - Tâches à heure fixe = blocs (hauteur ∝ durée, couleur de l'étiquette), chevauchements signalés.
   - Colonne « À caser » : tâches sans heure, à glisser dans la journée.
   - Au doigt : appui long sur un bloc pour le déplacer, poignée du bas pour le redimensionner,
     poignée « 6 points » pour sortir une tâche de « À caser ». Pas de 5 min. La page défile toute seule
     quand le doigt approche du haut ou du bas de l'écran (sinon les heures hors écran sont inatteignables).
   - Sans glisser : toucher la poignée d'une tâche « À caser » puis toucher une heure de la grille (quart d'heure).
   - Un tap sélectionne la tâche : la validation reste la même (bouton flottant + animation 3D).
   ===================================================================== */
const H0 = 6, H1 = 24, PX = 64 / 60; // pixels par minute
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const toHM = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const snap = (m) => Math.round(m / 5) * 5;
const clampDay = (m, dur) => Math.max(H0 * 60, Math.min(H1 * 60 - dur, m));

/* Colonnes pour les blocs qui se chevauchent */
function layout(blocks) {
  const sorted = [...blocks].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let group = [], end = -1;
  const flush = () => {
    const cols = [];
    group.forEach((b) => {
      let c = cols.findIndex((last) => last <= b.s);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = b.e;
      b.col = c;
    });
    group.forEach((b) => { b.cols = cols.length; b.over = cols.length > 1; out.push(b); });
    group = [];
  };
  sorted.forEach((b) => { if (b.s >= end && group.length) flush(); group.push(b); end = Math.max(end, b.e); });
  if (group.length) flush();
  return out;
}

function useNowMin() {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setN(new Date()), 60000); return () => clearInterval(iv); }, []);
  return n.getHours() * 60 + n.getMinutes();
}

export default function Timeline({ tasks, sel, busy }) {
  const { S, UI } = useStore();
  const openT = UI.open && S.tasks.find((x) => x.id === UI.open);
  const grid = useRef(null), ghost = useRef(null), drag = useRef(null), raf = useRef(0);
  const [armed, setArmed] = useState(null); // tâche « à caser » touchée : le prochain tap dans la grille lui donne son heure
  const nowM = useNowMin();
  // couleur du bloc : catégorie, sinon première étiquette
  const color = (t) => S.cats.find((c) => c.id === t.cat)?.color || S.tags.find((g) => g.id === t.tags[0])?.color || '#9ca3af';
  const blocks = useMemo(() => layout(tasks.filter((t) => t.time).map((t) => {
    const s = toMin(t.time), d = taskDur(t, S);
    return { t, s, e: s + d, d };
  })), [tasks, S]);
  const loose = tasks.filter((t) => !t.time);
  // événements des agendas reliés (Réglages → Agendas) : en fond, sous les tâches
  const { cache } = useCalendars();
  const evs = useMemo(() => eventsOn(todayKey(), S.set.cals || [], cache), [cache, S.set.cals]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayStart = new Date(todayKey() + 'T00:00').getTime();
  const evAllDay = evs.filter((e) => e.allDay), evTimed = evs.filter((e) => !e.allDay);
  const evTap = (e) => {
    if (armedT) return; // une tâche attend son heure : le tap la place (onGridClick)
    const s0 = Math.max(0, Math.round((e.start - dayStart) / 6e4)), d = Math.max(5, Math.round((e.end - e.start) / 6e4));
    toast(`📅 ${e.title}${e.allDay ? '' : ' · ' + toHM(s0) + '–' + toHM(Math.min(1440, s0 + d))} (${e.cal})`, {
      label: 'En faire une tâche',
      fn: () => { addTask({ text: e.title, date: todayKey(), time: e.allDay ? null : toHM(Math.min(1435, s0)), est: e.allDay ? 0 : Math.min(1440, d) }); toast('Tâche ajoutée ✓'); },
    });
  };
  const overlaps = blocks.filter((b) => b.over).length;

  /* ---------- glisser / redimensionner (événements pointer + blocage du défilement pendant le geste) ---------- */
  const stopScroll = (e) => e.preventDefault();
  const begin = (e, kind, t, el) => {
    if (busy) return;
    const r = el.getBoundingClientRect();
    drag.current = { kind, t, el, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, moved: false, last: { clientX: e.clientX, clientY: e.clientY } };
    let t0 = performance.now();
    const auto = (now) => { // défilement automatique près des bords (vitesse ∝ proximité du bord, pilotée par le temps)
      const d = drag.current;
      if (!d) return;
      const y = d.last.clientY, E = 90, dt = Math.min(50, now - t0);
      t0 = now;
      const k = y < E ? -(E - Math.max(0, y)) / E : y > innerHeight - E ? (Math.min(innerHeight, y) - innerHeight + E) / E : 0;
      if (k && d.moved) {
        const before = scrollY;
        scrollBy(0, k * 1.1 * dt);
        if (scrollY !== before) (d.kind === 'resize' ? move : place)(d.last);
      }
      raf.current = requestAnimationFrame(auto);
    };
    raf.current = requestAnimationFrame(auto);
    addEventListener('touchmove', stopScroll, { passive: false });
    addEventListener('pointermove', move);
    addEventListener('pointerup', end, { once: true });
    addEventListener('pointercancel', cancel, { once: true });
    if (kind !== 'resize') {
      const g = ghost.current;
      g.style.display = 'block';
      g.style.width = r.width + 'px';
      g.style.height = Math.max(36, kind === 'loose' ? taskDur(t, S) * PX : r.height) + 'px';
      g.style.background = color(t) + '33';
      g.style.borderColor = color(t);
      g.textContent = t.text;
      place(e);
      el.classList.add('tl-dragging');
    }
  };
  const minuteAt = (clientY, offset) => {
    const gr = grid.current.getBoundingClientRect();
    return H0 * 60 + (clientY - offset - gr.top) / PX;
  };
  const place = (e) => {
    const d = drag.current, g = ghost.current, gr = grid.current.getBoundingClientRect();
    const inside = e.clientX > gr.left - 20 && e.clientX < gr.right + 20;
    let y = e.clientY - d.dy;
    if (inside) {
      const m = clampDay(snap(minuteAt(e.clientY, d.dy)), taskDur(d.t, S));
      y = gr.top + (m - H0 * 60) * PX;
      g.dataset.time = toHM(m);
      g.style.left = gr.left + 52 + 'px';
      g.style.width = gr.width - 60 + 'px';
    } else {
      g.dataset.time = '';
      g.style.left = e.clientX - d.dx + 'px';
      g.style.width = d.w + 'px';
    }
    g.style.top = y + 'px';
    d.inside = inside;
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    d.last = { clientX: e.clientX, clientY: e.clientY };
    if (Math.abs(e.clientY - d.y0) + Math.abs(e.clientX - d.x0) > 4) d.moved = true;
    if (d.kind === 'resize') {
      const top = toMin(d.t.time), m = snap(minuteAt(e.clientY, 0));
      d.dur = Math.max(10, Math.min(H1 * 60 - top, m - top));
      d.el.style.height = d.dur * PX + 'px';
      d.el.dataset.dur = fmtMin(d.dur);
    } else place(e);
  };
  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    removeEventListener('touchmove', stopScroll);
    removeEventListener('pointermove', move);
    removeEventListener('pointercancel', cancel);
    ghost.current.style.display = 'none';
    drag.current?.el.classList.remove('tl-dragging');
  };
  const end = () => {
    const d = drag.current;
    cleanup();
    drag.current = null;
    if (!d) return;
    if (d.kind === 'resize') { if (d.moved && d.dur) setTaskField(d.t.id, { est: d.dur }); else toggleSel(d.t.id); return; }
    if (!d.moved) {
      if (d.kind === 'block') toggleSel(d.t.id);
      else setArmed((a) => (a === d.t.id ? null : d.t.id));
      return;
    }
    setArmed(null);
    const time = ghost.current.dataset.time;
    if (d.inside && time) setTaskField(d.t.id, { time });
    else if (d.kind === 'block') { setTaskField(d.t.id, { time: null }); toast('Remise dans « À caser ».'); }
  };
  const cancel = () => { cleanup(); drag.current = null; };
  // tap dans la grille avec une tâche « armée » : placée au quart d'heure touché
  const armedT = armed && loose.find((t) => t.id === armed);
  const onGridClick = (e) => {
    if (!armedT || e.target.closest('.tl-block')) return;
    const m = clampDay(Math.floor(minuteAt(e.clientY, 0) / 15) * 15, taskDur(armedT, S));
    setTaskField(armedT.id, { time: toHM(m) });
    setArmed(null);
    toast(`« ${armedT.text} » à ${toHM(m)} ✓`);
  };

  // bloc : appui long (250 ms) pour déplacer ; un tap court sélectionne
  const onBlockDown = (e, t) => {
    if (e.button > 0 || busy) return;
    const el = e.currentTarget, x = e.clientX, y = e.clientY, ev = { clientX: x, clientY: y };
    let moved = false;
    const mv = (m) => { if (Math.abs(m.clientX - x) + Math.abs(m.clientY - y) > 8) moved = true; };
    const up = () => { clearTimeout(timer); removeEventListener('pointermove', mv); removeEventListener('pointercancel', stop); if (!moved && !drag.current) toggleSel(t.id); };
    const stop = () => { clearTimeout(timer); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up, { once: true });
    addEventListener('pointercancel', stop, { once: true });
    const timer = setTimeout(() => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', stop);
      if (!moved) { navigator.vibrate?.(10); begin(ev, 'block', t, el); drag.current.moved = true; }
    }, 250);
  };

  const hours = [];
  for (let h = H0; h <= H1; h++) hours.push(h);
  const showNow = nowM >= H0 * 60 && nowM <= H1 * 60;

  return (
    <div className="tl-wrap">
      <div className="tl-loose">
        <div className="tl-head">À caser <span className="tabular-nums">{loose.length}</span></div>
        {loose.length ? loose.map((t) => (
          <div key={t.id} className={'tl-item ' + (sel.has(t.id) ? 'sel ' : '') + (t.done ? 'done ' : '') + (armed === t.id ? 'armed' : '')} style={{ '--tc': color(t) }}>
            <button className="tl-sel" onClick={() => toggleSel(t.id)} aria-label="Sélectionner" />
            <button className="tl-txt" onClick={() => setOpen(t.id)}>{t.prio && <span className="star">★ </span>}{t.text}<em>{fmtMin(taskDur(t, S))}</em></button>
            <span className="grip" onPointerDown={(e) => { e.preventDefault(); begin(e, 'loose', t, e.currentTarget.parentElement); }} title="Glisser dans la journée (ou toucher, puis toucher une heure)" aria-label="Glisser dans la journée, ou toucher puis toucher une heure">
              <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">{[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" />))}</svg>
            </span>
          </div>
        )) : <p className="text-[13px] text-mut">Tout a une heure. 👌</p>}
        {armedT ? <p className="tl-hint">👉 Touche une heure dans la journée pour placer « {armedT.text} ».</p>
          : loose.length > 0 && <p className="tl-tip">Glisse la poignée ⠿ vers une heure, ou touche-la puis touche l’heure voulue.</p>}
        {evAllDay.length > 0 && (
          <div className="tl-allday">
            {evAllDay.map((e) => <button key={e.id} type="button" className="tl-evchip" style={{ '--ec': e.color }} onClick={() => evTap(e)}>📅 {e.title}</button>)}
          </div>
        )}
        {overlaps > 0 && <p className="tl-warn">⚠️ {overlaps} tâches se chevauchent</p>}
      </div>
      <div className={'tl-grid' + (armedT ? ' armed' : '')} ref={grid} style={{ height: (H1 - H0) * 60 * PX, '--evw': evTimed.length ? '30%' : '0px' }} onClick={onGridClick}>
        {hours.map((h) => (
          <div key={h} className="tl-hour" style={{ top: (h - H0) * 60 * PX }}><span>{String(h % 24).padStart(2, '0')}:00</span></div>
        ))}
        {evTimed.map((e) => {
          const s0 = Math.max(H0 * 60, (e.start - dayStart) / 6e4), e0 = Math.min(H1 * 60, (e.end - dayStart) / 6e4);
          if (e0 <= H0 * 60 || s0 >= H1 * 60) return null;
          return (
            <button key={e.id} type="button" className="tl-ev" style={{ top: (s0 - H0 * 60) * PX, height: Math.max(22, (e0 - s0) * PX), '--ec': e.color }} onClick={() => evTap(e)} title={`${e.title} (${e.cal})`}>
              <span>{e.title}</span><em>{toHM(Math.round(Math.max(0, (e.start - dayStart) / 6e4)))} · {e.cal}</em>
            </button>
          );
        })}
        {showNow && <div className="tl-now" style={{ top: (nowM - H0 * 60) * PX }} aria-label="Maintenant" />}
        {blocks.map((b) => (
          <div
            key={b.t.id}
            className={'tl-block ' + (sel.has(b.t.id) ? 'sel ' : '') + (b.t.done ? 'done ' : '') + (b.over ? 'over ' : '') + (b.t.prio ? 'prio' : '')}
            style={{
              top: (b.s - H0 * 60) * PX, height: Math.max(26, b.d * PX), '--tc': color(b.t),
              left: `calc(52px + (100% - 60px - var(--evw)) * ${b.col / b.cols})`, width: `calc((100% - 60px - var(--evw)) / ${b.cols} - 4px)`,
            }}
            data-dur={fmtMin(b.d)}
            onPointerDown={(e) => onBlockDown(e, b.t)}
            onDoubleClick={() => setOpen(b.t.id)}
          >
            <b>{b.t.prio && '★ '}{b.t.cat && S.cats.find((c) => c.id === b.t.cat)?.emoji + ' '}{b.t.text}</b>
            <span>{b.t.time} – {toHM(Math.min(b.e, 1440))}{b.over && ' · chevauche'}</span>
            <i className="tl-resize" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); begin(e, 'resize', b.t, e.currentTarget.parentElement); }} aria-label="Redimensionner" />
          </div>
        ))}
      </div>
      <div ref={ghost} className="tl-ghost" aria-hidden="true" />
      {openT && <Sheet title={openT.text} onClose={() => setOpen(openT.id)} wide><Details t={openT} today={todayKey()} /></Sheet>}
    </div>
  );
}
