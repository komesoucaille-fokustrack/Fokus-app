import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Clock, { CLOCKS, useNow } from './Clocks';
import { fmtMin } from './TaskList';
import Concept from './Concepts';
import { BGS, BG_GROUPS, bgOf, thumbOf } from '../lib/backgrounds';
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
      {bg.img && <img className="stage-img" src={bg.img} alt="" decoding="async" style={{ objectPosition: bg.pos, objectFit: bg.fit || 'cover' }} />}
      {bg.concept && <Concept kind={bg.concept} a={a} b={b} frac={frac} phase={p.phase} />}
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
          {!bg.concept && <Clock style={S.set.clock} a={a} b={b} frac={frac} ink={bg.ink} theme={bg.flip} />}
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
            {bgOf(S.set.bg).concept && <span className="text-[12.5px] text-mut">Le fond « {bgOf(S.set.bg).name} » affiche son propre chrono.</span>}
          </div>
        </div>
        <div className="drow mt-3 items-start!">
          <span className="dlab pt-2">Fond</span>
          <BgPicker />
        </div>
        <div className="drow mt-4 items-start!">
          <span className="dlab pt-2">Durées</span>
          <div className="min-w-0 flex-1"><Durations /></div>
        </div>
        <p className="mt-3 text-[12.5px] text-mut">
          Pause longue toutes les {S.set.cycle} sessions. Cycle, démarrage automatique et son : Réglages ⚙ → Pomodoro.
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
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {BG_GROUPS.map(([g, label]) => (
        <div key={g}>
          <div className="mb-1.5 text-[12px] font-semibold tracking-wide text-mut uppercase">{label}</div>
          <div className="bgpick">
            {BGS.filter((b) => b.group === g).map((b) => (
              <button key={b.id} type="button" className={'bgt ' + (S.set.bg === b.id ? 'on' : '')} onClick={() => setSetting('bg', b.id)} title={b.name} aria-label={'Fond : ' + b.name}>
                {b.img
                  ? <img src={thumbOf(b)} alt="" loading="lazy" decoding="async" />
                  : b.concept
                    ? <div className="bgt-concept"><Concept kind={b.concept} a="25" b="00" frac={0.4} phase="work" /></div>
                    : <span style={{ background: b.css }} />}
                <em>{b.name}</em>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Durée en minutes, au choix (1 à 180), avec − / + et saisie directe */
export function MinuteField({ value, onChange, label, max = 180 }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const put = (v) => { const n = Math.max(1, Math.min(max, Math.round(v) || 1)); onChange(n); setTxt(String(n)); };
  return (
    <span className="minf" aria-label={label}>
      <button type="button" onClick={() => put(value - 1)} aria-label={label + ' : moins une minute'} disabled={value <= 1}>−</button>
      <input
        inputMode="numeric" value={txt} aria-label={label + ' (minutes)'}
        onChange={(e) => setTxt(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={() => put(+txt)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <span className="minf-u">min</span>
      <button type="button" onClick={() => put(value + 1)} aria-label={label + ' : plus une minute'} disabled={value >= max}>+</button>
    </span>
  );
}

export const PRESETS = [['Classique', 25, 5, 15], ['Court', 15, 3, 10], ['Long', 50, 10, 30], ['Deep work', 90, 20, 30]];
/* Durées du Pomodoro : préréglages + minutes libres */
export function Durations() {
  const { S } = useStore();
  const st = S.set;
  const apply = ([, w, s, l]) => { setSetting('pomo', w); setSetting('pause', s); setSetting('longPause', l); };
  return (
    <div className="flex flex-col gap-3">
      <div className="segs">
        {PRESETS.map((p) => (
          <button type="button" key={p[0]} className={'seg ' + (st.pomo === p[1] && st.pause === p[2] && st.longPause === p[3] ? 'on' : '')} onClick={() => apply(p)}>
            {p[0]} <span className="opacity-60 tabular-nums">{p[1]}/{p[2]}</span>
          </button>
        ))}
      </div>
      <div className="durs">
        <label><span>Concentration</span><MinuteField label="Concentration" value={st.pomo} onChange={(v) => setSetting('pomo', v)} /></label>
        <label><span>Pause courte</span><MinuteField label="Pause courte" value={st.pause} max={60} onChange={(v) => setSetting('pause', v)} /></label>
        <label><span>Pause longue</span><MinuteField label="Pause longue" value={st.longPause} max={90} onChange={(v) => setSetting('longPause', v)} /></label>
      </div>
    </div>
  );
}
