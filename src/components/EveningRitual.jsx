import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { TagChip, fmtMin } from './TaskList';
import { addDays } from '../lib/dates';
import { getColorForPercentage } from '../lib/colors';
import { scoreFmt, canPrio, deleteTask, markSeen, setDate, setSetting, stats, taskDur, todayKey, todayTasks, togglePrio, toast, useStore } from '../store';

/* =====================================================================
   RITUEL DU SOIR « FERMER MA JOURNÉE » — 3 écrans rapides, au pouce :
   1. ce qui est fait (avec le score) · 2. ce qui reste : Demain / Plus tard / Supprimer · 3. les 3 priorités de demain
   Une fois tout trié, le tri du matin est sauté.
   ===================================================================== */
export default function EveningRitual({ onClose }) {
  const { S } = useStore();
  const tk = todayKey(), tomorrow = addDays(tk, 1);
  const [step, setStep] = useState(0);
  const [left] = useState(() => todayTasks().filter((t) => !t.done).map((t) => t.id));
  const [i, setI] = useState(0);
  const body = useRef(null), card = useRef(null);
  useLayoutEffect(() => { gsap.from(body.current, { x: 30, opacity: 0, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' }); }, [step]);
  useLayoutEffect(() => { if (card.current) gsap.from(card.current, { x: 40, opacity: 0, duration: 0.4, ease: 'expo.out', clearProps: 'transform,opacity' }); }, [i]);

  const s = stats(), done = todayTasks().filter((t) => t.done);
  const close = () => { markSeen('evening'); onClose(); };
  const finish = () => {
    markSeen('evening');
    // tout est trié : pas de tri du matin demain
    if (!todayTasks().some((t) => !t.done)) markSeen('morning', tomorrow);
    toast('Journée fermée. Bonne soirée 🌙');
    onClose();
  };
  const next = (fn) => {
    gsap.to(card.current, {
      x: -60, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => { fn(); if (i + 1 >= left.length) setStep(2); else setI(i + 1); },
    });
  };
  const t = S.tasks.find((x) => x.id === left[i]);
  const tmr = S.tasks.filter((x) => !x.done && x.date === tomorrow);
  const load = tmr.reduce((n, x) => n + (x.est || x.time ? taskDur(x, S) : 0), 0);

  return (
    <Sheet title="Fermer ma journée" sub={['Ce qui est fait aujourd’hui', 'Ce qui reste', 'Préparer demain'][step] + ` · ${step + 1}/3`} onClose={close}>
      <div ref={body}>
        {step === 0 && (
          <>
            <div className="mb-3 flex items-baseline gap-3">
              <b className="text-[48px] leading-none tracking-[-0.04em] tabular-nums" style={{ color: getColorForPercentage(s.p) }}>{scoreFmt(S)(s.p)}</b>
              <span className="text-[14px] text-mut">{s.c} / {s.n} tâche{s.n > 1 ? 's' : ''}{s.prt ? ` · priorités ${s.pr}/${s.prt}` : ''}</span>
            </div>
            <ul className="m-0 mb-3 max-h-[40vh] overflow-auto p-0">
              {done.length ? done.map((x) => <li key={x.id} className="rit-done">✓ {x.text}</li>) : <li className="rit-done text-mut">Rien de validé aujourd’hui — et c’est OK. Demain est un autre jour.</li>}
            </ul>
            <button className="b on w-full py-3!" onClick={() => setStep(left.length ? 1 : 2)}>{left.length ? `Trier ce qui reste (${left.length})` : 'Préparer demain'}</button>
          </>
        )}
        {step === 1 && t && (
          <>
            <div className="mb-3 text-center text-[12px] text-mut tabular-nums">{i + 1} / {left.length}</div>
            <div ref={card} className="mb-4 rounded-2xl border border-line bg-card p-5 text-center">
              <div className="text-xl font-semibold tracking-tight break-words">{t.prio && '★ '}{t.text}</div>
              <div className="meta mt-2 justify-center">
                {t.weight > 1 && <span className="chip">{t.weight} pts</span>}
                {t.tags.map((id) => S.tags.find((g) => g.id === id)).filter(Boolean).map((g) => <TagChip key={g.id} tag={g} small />)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="b on py-3!" onClick={() => next(() => setDate(t.id, tomorrow))}>Demain</button>
              <button className="b py-3!" onClick={() => next(() => setDate(t.id, null))}>Plus tard</button>
              <button className="b py-3!" onClick={() => next(() => deleteTask(t.id, true))}>Supprimer</button>
            </div>
            <button className="b mt-3 w-full py-3! text-mut" onClick={() => { left.slice(i).forEach((id) => setDate(id, tomorrow)); setStep(2); }}>Tout mettre à demain</button>
          </>
        )}
        {step === 1 && !t && <button className="b on w-full py-3!" onClick={() => setStep(2)}>Préparer demain</button>}
        {step === 2 && (
          <>
            <p className="mb-2 text-[13px] text-mut">Choisis jusqu’à 3 priorités ★ pour demain.{load ? ` Temps estimé : ${fmtMin(load)} pour ${fmtMin(S.set.capacity)} disponibles.` : ''}</p>
            <ul className="m-0 mb-3 max-h-[46vh] overflow-auto p-0">
              {tmr.length ? tmr.map((x) => (
                <li key={x.id} className={'task ' + (x.prio ? 'prio' : '')}>
                  <button className={'seg gold ' + (x.prio ? 'on' : '')} onClick={() => (x.prio || canPrio(x.date, x.id) ? togglePrio(x.id) : toast('3 priorités maximum.'))} aria-label="Priorité">★</button>
                  <span className="t"><span className="tt">{x.text}</span><span className="meta">{x.time && <span className="chip">🕑 {x.time}</span>}{(x.est || x.time) ? <span className="chip">{fmtMin(taskDur(x, S))}</span> : null}</span></span>
                </li>
              )) : <li className="py-4 text-center text-mut">Rien de prévu demain pour l’instant.</li>}
            </ul>
            <button className="b on w-full py-3!" onClick={finish}>Fermer ma journée</button>
          </>
        )}
        <button className="mt-3 w-full text-center text-[12.5px] text-mut underline-offset-4 hover:underline" onClick={() => { setSetting('evening', false); close(); }}>Ne plus proposer automatiquement</button>
      </div>
    </Sheet>
  );
}
