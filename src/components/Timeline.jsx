import { useEffect, useMemo, useRef, useState } from 'react';
import { Details, fmtMin } from './TaskList';
import Sheet from './Sheet';
import { setOpen, setTaskField, taskDur, toast, toggleSel, todayKey, useStore } from '../store';

/* =====================================================================
   « MA JOURNÉE » EN CHRONOLOGIE (6 h → 24 h)
   - Tâches à heure fixe = blocs (hauteur ∝ durée, couleur de l'étiquette), chevauchements signalés.
   - Colonne « À caser » : tâches sans heure, à glisser dans la journée.
   - Au doigt : appui long sur un bloc pour le déplacer, poignée du bas pour le redimensionner,
     poignée « 6 points » pour sortir une tâche de « À caser ». Pas de 5 min.
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
  const grid = useRef(null), ghost = useRef(null), drag = useRef(null);
  const nowM = useNowMin();
  const color = (t) => S.tags.find((g) => g.id === t.tags[0])?.color || '#9ca3af';
  const blocks = useMemo(() => layout(tasks.filter((t) => t.time).map((t) => {
    const s = toMin(t.time), d = taskDur(t, S);
    return { t, s, e: s + d, d };
  })), [tasks, S]);
  const loose = tasks.filter((t) => !t.time);
  const overlaps = blocks.filter((b) => b.over).length;

  /* ---------- glisser / redimensionner (événements pointer + blocage du défilement pendant le geste) ---------- */
  const stopScroll = (e) => e.preventDefault();
  const begin = (e, kind, t, el) => {
    if (busy) return;
    const r = el.getBoundingClientRect();
    drag.current = { kind, t, el, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, moved: false };
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
    if (Math.abs(e.clientY - d.y0) + Math.abs(e.clientX - d.x0) > 4) d.moved = true;
    if (d.kind === 'resize') {
      const top = toMin(d.t.time), m = snap(minuteAt(e.clientY, 0));
      d.dur = Math.max(10, Math.min(H1 * 60 - top, m - top));
      d.el.style.height = d.dur * PX + 'px';
      d.el.dataset.dur = fmtMin(d.dur);
    } else place(e);
  };
  const cleanup = () => {
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
    if (!d.moved) { if (d.kind === 'block') toggleSel(d.t.id); return; }
    const time = ghost.current.dataset.time;
    if (d.inside && time) setTaskField(d.t.id, { time });
    else if (d.kind === 'block') { setTaskField(d.t.id, { time: null }); toast('Remise dans « À caser ».'); }
  };
  const cancel = () => { cleanup(); drag.current = null; };

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
          <div key={t.id} className={'tl-item ' + (sel.has(t.id) ? 'sel ' : '') + (t.done ? 'done' : '')} style={{ '--tc': color(t) }}>
            <button className="tl-sel" onClick={() => toggleSel(t.id)} aria-label="Sélectionner" />
            <button className="tl-txt" onClick={() => setOpen(t.id)}>{t.prio && <span className="star">★ </span>}{t.text}<em>{fmtMin(taskDur(t, S))}</em></button>
            <span className="grip" onPointerDown={(e) => { e.preventDefault(); begin(e, 'loose', t, e.currentTarget.parentElement); }} title="Glisser dans la journée" aria-label="Glisser dans la journée">
              <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">{[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" />))}</svg>
            </span>
          </div>
        )) : <p className="text-[13px] text-mut">Tout a une heure. 👌</p>}
        {overlaps > 0 && <p className="tl-warn">⚠︎ {overlaps} tâches se chevauchent</p>}
      </div>
      <div className="tl-grid" ref={grid} style={{ height: (H1 - H0) * 60 * PX }}>
        {hours.map((h) => (
          <div key={h} className="tl-hour" style={{ top: (h - H0) * 60 * PX }}><span>{String(h % 24).padStart(2, '0')}:00</span></div>
        ))}
        {showNow && <div className="tl-now" style={{ top: (nowM - H0 * 60) * PX }} aria-label="Maintenant" />}
        {blocks.map((b) => (
          <div
            key={b.t.id}
            className={'tl-block ' + (sel.has(b.t.id) ? 'sel ' : '') + (b.t.done ? 'done ' : '') + (b.over ? 'over ' : '') + (b.t.prio ? 'prio' : '')}
            style={{
              top: (b.s - H0 * 60) * PX, height: Math.max(26, b.d * PX), '--tc': color(b.t),
              left: `calc(52px + (100% - 60px) * ${b.col / b.cols})`, width: `calc((100% - 60px) / ${b.cols} - 4px)`,
            }}
            data-dur={fmtMin(b.d)}
            onPointerDown={(e) => onBlockDown(e, b.t)}
            onDoubleClick={() => setOpen(b.t.id)}
          >
            <b>{b.t.prio && '★ '}{b.t.text}</b>
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
