import QuickAdd from './QuickAdd';
import TaskList from './TaskList';
import { addDays, dayLabel } from '../lib/dates';
import { sortTasks, todayKey, useStore } from '../store';

/* Onglet « À venir » : demain, cette semaine, plus loin, puis « Plus tard », groupés par date (ordre choisi conservé) */
export default function Upcoming() {
  const { S, UI } = useStore();
  const today = todayKey();
  const tomorrow = addDays(today, 1), week = addDays(today, 7);
  const future = S.tasks.filter((t) => !t.done && t.date && t.date > today);
  const later = S.tasks.filter((t) => !t.done && t.date === null);
  const dates = [...new Set(future.map((t) => t.date))].sort();
  const sections = [
    ['Demain', dates.filter((d) => d === tomorrow)],
    ['Cette semaine', dates.filter((d) => d > tomorrow && d <= week)],
    ['Plus loin', dates.filter((d) => d > week)],
  ];
  return (
    <section>
      <QuickAdd defaultDate={tomorrow} placeholder="Ajouter pour demain… (ou « vendredi », « 25/10 »)" />
      {!future.length && !later.length && <div className="card py-10 text-center text-mut">Rien de prévu. Ajoute une tâche ou choisis une date depuis le panneau d’une tâche.</div>}
      {sections.map(([title, ds]) => ds.length > 0 && (
        <div key={title} className="mb-5">
          <h2 className="sec">{title}</h2>
          {ds.map((d) => (
            <div key={d} className="mb-2">
              {title !== 'Demain' && <div className="dhead">{dayLabel(d, today)}</div>}
              <TaskList tasks={sortTasks(future.filter((t) => t.date === d))} sel={UI.sel} busy={UI.busy} mode="upcoming-day" />
            </div>
          ))}
        </div>
      ))}
      {later.length > 0 && (
        <div className="mb-5">
          <h2 className="sec">Plus tard</h2>
          <TaskList tasks={sortTasks(later)} sel={UI.sel} busy={UI.busy} mode="upcoming-day" />
        </div>
      )}
    </section>
  );
}
