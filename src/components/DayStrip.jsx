import { forwardRef } from 'react';
import { fmtMin } from './TaskList';
import { dayLoad, setModal, todayKey, todayTasks, taskDur } from '../store';

/* Bandeau sous la carte du jour : « Estimé · Fait » et alerte douce de surcharge (comme Sunsama).
   Hors de #pcard pour ne pas toucher au relais de l'animation 3D. */
export function planned(S) {
  // temps prévu : tâches restantes estimées ou placées à une heure
  return todayTasks(S.tasks, todayKey()).filter((t) => !t.done && (t.est || t.time)).reduce((n, t) => n + taskDur(t, S), 0);
}
const DayStrip = forwardRef(function DayStrip({ S }, ref) {
  const l = dayLoad(S), plan = planned(S), cap = S.set.capacity, over = plan > cap;
  if (!l.any && !over && l.done < 1) return <div ref={ref} />;
  return (
    <div ref={ref} className={'daystrip ' + (over ? 'over' : '')}>
      <span className="tabular-nums">
        {l.any && <>Estimé : <b>{fmtMin(l.est)}</b> · </>}Fait : <b>{fmtMin(l.done)}</b>
      </span>
      {over && (
        <span className="ds-over">
          <span>⚠︎ {fmtMin(plan)} prévues pour {fmtMin(cap)} disponibles</span>
          <button className="seg" onClick={() => setModal('overload')}>Déplacer des tâches à demain</button>
        </span>
      )}
    </div>
  );
});
export default DayStrip;
