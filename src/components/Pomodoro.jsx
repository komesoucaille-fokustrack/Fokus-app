import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Clock, { CLOCKS, useNow } from './Clocks';
import { fmtMin } from './TaskList';
import { BGS, bgOf, thumbOf } from '../lib/backgrounds';
import { unlockAudio } from '../lib/sound';
import {
  PHASES, finishFocusTask, focusToday, pomoElapsed, pomoPhase, pomoReset, pomoSkip, pomoState, pomoTask, pomoToday, pomoToggle,
  setSetting, sortTasks, todayTasks, useStore,
} from '../store';

const two = (n) => String(n).padStart(2, '0');

/* Garde l'écran allumé pendant une session (Safari iPadOS 16.4+, Chrome…) */
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return;
    let lock = null, alive = true;
    const req = () => navigator.wakeLock.request('screen').then((l) => { if (alive) lock = l; else l.release(); }).catch(() => {});
    req();
    const vis = () => { if (!document.hidden) req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; lock?.release?.().catch?.(() => {}); document.removeEventListener('visibilitychange', vis); };
  }, [on]);
}

/* Rafraîchit l'affichage 4 fois par seconde (le temps vient des horodatages) */
function useTick(on) {
  const [, t] = useState(0);
  useEffect(() => {
    if (!on) return;
    const iv = setInterval(() => t((n) => n + 1), 250);
    return () => clearInterval(iv);
  }, [on]);
}

function Icon({ d, size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const I = {
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  skip: 'M5 5l10 7-10 7z M19 5v14',
  full: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  exit: 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5',
};

/* Scène : fond choisi + chrono + commandes (dans la page ou en plein écran) */
function Stage({ full, onFull, onExit }) {
  const { S } = useStore();
  const p = pomoState();
  const running = p.paused == null;
  const [hour, setHour] = useState(false);
  const [idle, setIdle] = useState(false);
  const now = useNow(hour);
  useTick(running);
  const bg = bgOf(S.set.bg);
  const t = p.tid && S.tasks.find((x) => x.id === p.tid);

  // en plein écran, les commandes s'effacent après 3 s sans toucher l'écran
  useEffect(() => {
    if (!full) return;
    let tm;
    const wake = () => { setIdle(false); clearTimeout(tm); tm = setTimeout(() => setIdle(true), 3000); };
    wake();
    addEventListener('pointermove', wake);
    addEventListener('pointerdown', wake);
    return () => { clearTimeout(tm); removeEventListener('pointermove', wake); removeEventListener('pointerdown', wake); };
  }, [full]);

  const el = pomoElapsed(p), left = Math.max(0, Math.ceil(p.dur - el));
  const mm = Math.floor(left / 60), ss = left % 60;
  const [a, b, frac] = hour
    ? [two(now.getHours()), two(now.getMinutes()), now.getSeconds() / 60]
    : [two(mm), two(ss), Math.min(1, el / p.dur)];
  const ready = p.paused === 0;
  const scrim = bg.scrim ? (bg.scrim[0] === 'dark' ? `rgba(0,0,0,${bg.scrim[1]})` : `rgba(255,255,255,${bg.scrim[1]})`) : null;
  const toggle = () => { unlockAudio(); pomoToggle(); };

  return (
    <div className={'stage ' + (full ? 'full ' : '') + (full && idle ? 'idle' : '')} style={{ background: bg.back || bg.css || '#050505', color: bg.ink }}>
      {bg.img && <img className="stage-img" src={bg.img} alt="" style={{ objectPosition: bg.pos, objectFit: bg.fit || 'cover' }} />}
      {scrim && <div className="stage-scrim" style={{ background: `radial-gradient(ellipse at 50% 50%, ${scrim}, ${scrim.replace(/[\d.]+\)$/, (m) => Math.min(0.85, parseFloat(m) + 0.2) + ')')})` }} />}
      <div className="stage-in">
        <div className="stage-top">
          <span className="stage-phase">{hour ? 'Heure' : PHASES[p.phase]}</span>
          {!hour && (
            <span className="dots" aria-label={`${p.done % S.set.cycle} / ${S.set.cycle} sessions`}>
              {[...Array(S.set.cycle)].map((_, i) => <i key={i} className={i < p.done % S.set.cycle || (p.phase === 'long' && p.done) ? 'on' : ''} />)}
            </span>
          )}
        </div>
        <div className={'stage-clock ' + (running || hour ? '' : 'paused')}>
          <Clock style={S.set.clock} a={a} b={b} frac={frac} ink={bg.ink} theme={bg.flip} />
        </div>
        <div className="stage-task">{t ? t.text : ' '}</div>
        <div className="stage-ctl">
          <button className="sbtn" onClick={pomoReset} aria-label="Réinitialiser" title="Réinitialiser"><Icon d={I.reset} /></button>
          <button className="sbtn main" onClick={toggle}>{running ? 'Pause' : ready ? 'Démarrer' : 'Reprendre'}</button>
          <button className="sbtn" onClick={pomoSkip} aria-label="Phase suivante" title="Phase suivante"><Icon d={I.skip} /></button>
          {full
            ? <button className={'sbtn ' + (hour ? 'on' : '')} onClick={() => setHour((h) => !h)} title="Afficher l’heure">Heure</button>
            : null}
          {full
            ? <button className="sbtn" onClick={onExit} aria-label="Quitter le plein écran" title="Quitter le plein écran (Échap)"><Icon d={I.exit} /></button>
            : <button className="sbtn" onClick={onFull} aria-label="Plein écran" title="Plein écran (F)"><Icon d={I.full} /></button>}
        </div>
      </div>
    </div>
  );
}

/* Onglet Pomodoro */
export default function Pomodoro() {
  const { S } = useStore();
  const p = pomoState();
  const [full, setFull] = useState(false);
  const fullRef = useRef(null);
  useWakeLock(p.paused == null);
  const today = sortTasks(todayTasks(S.tasks).filter((t) => !t.done));
  const t = p.tid && S.tasks.find((x) => x.id === p.tid);

  const enter = () => setFull(true);
  const exit = () => {
    setFull(false);
    try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* rien */ }
  };
  useLayoutEffect(() => {
    if (!full || !fullRef.current) return;
    const el = fullRef.current;
    gsap.from(el, { opacity: 0, scale: 1.03, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
    try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); } catch { /* overlay seul */ }
    const sync = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) setFull(false); };
    const t0 = setTimeout(() => {
      document.addEventListener('fullscreenchange', sync);
      document.addEventListener('webkitfullscreenchange', sync);
    }, 400);
    return () => { clearTimeout(t0); document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync); };
  }, [full]);

  // Espace = démarrer / pause, F = plein écran, Échap = quitter le plein écran
  useEffect(() => {
    const key = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) && e.key === ' ') return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); unlockAudio(); pomoToggle(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setFull((f) => !f); }
      else if (e.key === 'Escape' && full) exit();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="segs">
          {Object.entries(PHASES).map(([k, l]) => (
            <button key={k} className={'seg ' + (p.phase === k ? 'on' : '')} onClick={() => pomoPhase(k)}>{l}</button>
          ))}
        </div>
        <div className="text-[13px] text-mut tabular-nums">
          Aujourd’hui : <b className="text-white">{pomoToday(S)}</b> session{pomoToday(S) > 1 ? 's' : ''} · <b className="text-white">{fmtMin(focusToday(S))}</b>
        </div>
      </div>

      <Stage onFull={enter} />

      <div className="card mt-4">
        <div className="drow">
          <span className="dlab">Tâche liée</span>
          <div className="segs min-w-0 flex-1">
            <select className="field mini min-w-0 flex-1" value={t ? t.id : ''} onChange={(e) => pomoTask(e.target.value || null)} aria-label="Tâche liée au minuteur">
              <option value="">Aucune (session libre)</option>
              {today.map((x) => <option key={x.id} value={x.id}>{x.prio ? '★ ' : ''}{x.text}</option>)}
              {t && !today.includes(t) && <option value={t.id}>{t.text}</option>}
            </select>
            {t && !t.done && <button className="seg on" onClick={finishFocusTask}>✓ Terminer la tâche</button>}
          </div>
        </div>
        {t && <p className="mt-2 text-[13px] text-mut">Temps cumulé sur cette tâche : {fmtMin(t.focus)}</p>}
      </div>

      <div className="card">
        <div className="drow">
          <span className="dlab">Chrono</span>
          <div className="segs">
            {CLOCKS.map(([k, l]) => <button key={k} className={'seg ' + (S.set.clock === k ? 'on' : '')} onClick={() => setSetting('clock', k)}>{l}</button>)}
          </div>
        </div>
        <div className="drow mt-3 items-start!">
          <span className="dlab pt-2">Fond</span>
          <BgPicker />
        </div>
        <p className="mt-3 text-[12.5px] text-mut">
          {S.set.pomo} min de concentration · pause {S.set.pause} min · pause longue {S.set.longPause} min toutes les {S.set.cycle} sessions.
          Durées, démarrage automatique et son : Réglages ⚙.
        </p>
      </div>

      {full && <div ref={fullRef} className="fixed inset-0 z-[150]"><Stage full onExit={exit} /></div>}
    </section>
  );
}

/* Choix du fond (aussi dans les Réglages) */
export function BgPicker() {
  const { S } = useStore();
  return (
    <div className="bgpick">
      {BGS.map((b) => (
        <button key={b.id} type="button" className={'bgt ' + (S.set.bg === b.id ? 'on' : '')} onClick={() => setSetting('bg', b.id)} title={b.name} aria-label={'Fond : ' + b.name}>
          {b.img ? <img src={thumbOf(b)} alt="" loading="lazy" /> : <span style={{ background: b.css }} />}
          <em>{b.name}</em>
        </button>
      ))}
    </div>
  );
}
