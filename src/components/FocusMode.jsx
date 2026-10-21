import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { fmtMin } from './TaskList';
import { finishFocusTask, focusToday, pausePomo, pomoElapsed, pomoTick, skipPhase, stopFocus, useStore } from '../store';
import { buzz, notify } from '../lib/notify';

const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

/* Minuteur de concentration plein écran (noir et blanc) — temps calculé par horodatages,
   juste même si l'écran se verrouille. */
export default function FocusMode() {
  const { S } = useStore();
  const p = S.pomo;
  const [, tick] = useState(0);
  const root = useRef(null);
  const t = p && S.tasks.find((x) => x.id === p.tid);

  useLayoutEffect(() => {
    gsap.from(root.current, { opacity: 0, scale: 1.02, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);

  useEffect(() => {
    const step = () => {
      const ended = pomoTick();
      if (ended) {
        buzz(200);
        if (S.set.pomoNotif) {
          if (ended === 'work') notify('Pause bien méritée', `Session de concentration terminée. Pause de ${S.set.pause} min.`);
          else notify('Pause terminée', 'On reprend quand tu veux : appuie sur ▶.');
        }
      }
      tick((n) => n + 1);
    };
    const iv = setInterval(step, 250);
    document.addEventListener('visibilitychange', step);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', step); };
  }, [S.set.pomoNotif, S.set.pause]);

  if (!p || !t) return null;
  const el = pomoElapsed(p), left = p.dur - el, frac = Math.min(1, el / p.dur);
  const R = 120, C = 2 * Math.PI * R;
  const paused = p.paused != null;
  const ready = p.phase === 'work' && paused && p.paused === 0;

  return (
    <div ref={root} className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-6 bg-[#050505] px-5 text-center" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="text-[13px] tracking-[0.2em] text-mut uppercase">{p.phase === 'work' ? 'Concentration' : 'Pause'}</div>
      <div className="max-w-[560px] text-2xl font-semibold tracking-tight break-words">{t.text}</div>
      <div className="relative grid place-items-center">
        <svg width="280" height="280" viewBox="0 0 280 280" className="max-w-[72vw]" aria-hidden="true">
          <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
          <circle cx="140" cy="140" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 140 140)" style={{ transition: 'stroke-dashoffset .25s linear', opacity: p.phase === 'work' ? 1 : 0.45 }} />
        </svg>
        <div className="absolute text-[64px] font-extrabold tracking-[-0.04em] tabular-nums" role="timer" aria-live="off">{mmss(left)}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button className="b on min-w-[130px] py-3!" onClick={pausePomo}>{paused ? (ready ? '▶ Démarrer' : '▶ Reprendre') : 'Pause'}</button>
        <button className="b py-3!" onClick={skipPhase}>{p.phase === 'work' ? 'Passer à la pause ⏭' : 'Passer la pause ⏭'}</button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {!t.done && <button className="b py-3!" onClick={finishFocusTask}>✓ Terminer la tâche</button>}
        <button className="b py-3! text-mut" onClick={() => stopFocus()}>Quitter</button>
      </div>
      <div className="text-[13px] text-mut tabular-nums">Cette tâche : {fmtMin(t.focus)} · Aujourd’hui : {fmtMin(focusToday(S))}</div>
    </div>
  );
}
