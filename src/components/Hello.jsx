import { forwardRef } from 'react';
import { fmtMin } from './TaskList';
import { focusToday, now, stats, streaks } from '../store';
import { getColorForPercentage } from '../lib/colors';

/* En-tête éditorial de « Mes Tâches » : date, salutation selon l'heure, résumé du jour */
const Hello = forwardRef(function Hello({ S }, ref) {
  const d = now(), h = new Date().getHours();
  const hi = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bel après-midi' : h < 22 ? 'Bonsoir' : 'Bonne nuit';
  const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const s = stats(S.tasks), left = s.n - s.c, fm = focusToday(S), z = streaks(S);
  const bits = [];
  if (s.n) bits.push(left ? `${left} tâche${left > 1 ? 's' : ''} à faire` : 'Tout est fait ✓');
  if (s.prt && s.pr < s.prt) bits.push(`${s.prt - s.pr} priorité${s.prt - s.pr > 1 ? 's' : ''}`);
  if (fm >= 1) bits.push(`${fmtMin(fm)} de concentration`);
  if (S.set.showStreak && z.cur > 1) bits.push(`série de ${z.cur} jours`);
  return (
    <div ref={ref} className="hello">
      <div className="hello-d">{date}</div>
      <h1 className="hello-t">{hi}<span style={{ color: s.n ? getColorForPercentage(s.p) : '#86efac' }}>.</span></h1>
      {bits.length > 0 && <div className="hello-s">{bits.join('  ·  ')}</div>}
    </div>
  );
});
export default Hello;
