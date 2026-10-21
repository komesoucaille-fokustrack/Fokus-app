import { useEffect } from 'react';
import { cancel, configurePush, schedule } from './push';
import { getState, stats, useStore } from '../store';

/* =====================================================================
   SYNCHRONISATION DES NOTIFICATIONS PROGRAMMÉES AVEC LE SERVEUR
   - Pomodoro : la fin de la phase en cours (et de la suivante si elle s'enchaîne seule) est programmée quand
     l'app passe en arrière-plan ; elle est annulée dès que l'app revient à l'écran (le carillon et le toast
     suffisent alors : jamais de doublon). Pause, réinitialisation, phase suivante, durée modifiée → reprogrammé.
   - Rappel du soir : programmé chaque jour à l'heure choisie, texte mis à jour à chaque changement de la liste ;
     rien n'est envoyé s'il ne reste aucune tâche.
   ===================================================================== */
const mn = (n) => `${n} min`;

function pomoJobs(S) {
  const p = S.pomo;
  if (!p || p.paused != null || !p.dur || p.flow) return [];
  const st = S.set, end = p.start + p.dur * 1000, url = './?page=4';
  const jobs = [];
  if (p.phase === 'work') {
    const long = (p.done + 1) % st.cycle === 0, br = long ? st.longPause : st.pause;
    jobs.push({ at: end, title: 'Session terminée 🍅', body: st.autoBreak ? `Pause ${long ? 'longue ' : ''}de ${mn(br)} lancée. Bravo !` : `Place à une pause de ${mn(br)}.`, url });
    if (st.autoBreak) jobs.push({ at: end + br * 60000, title: 'Pause terminée ☕', body: st.autoWork ? 'Nouvelle session lancée.' : 'On s’y remet ? Touche pour relancer.', url });
  } else {
    jobs.push({ at: end, title: 'Pause terminée ☕', body: st.autoWork ? 'Nouvelle session lancée.' : 'On s’y remet ? Touche pour relancer.', url });
    if (st.autoWork) jobs.push({ at: end + st.pomo * 60000, title: 'Session terminée 🍅', body: 'Prends une pause, tu l’as méritée.', url });
  }
  return jobs;
}

function eveningJob(S) {
  const [h, m] = S.set.remindAt.split(':').map(Number);
  const now = new Date(Date.now() + S.off * 864e5);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime() - S.off * 864e5;
  const s = stats(), left = s.n - s.c;
  const ritual = S.set.evening ? ' Ferme ta journée ?' : '';
  const next = 'Fais le point sur ta journée dans Fokus.';
  const url = S.set.evening ? './?ritual=evening' : './?page=1';
  if (at > Date.now() && left > 0) {
    return { at, title: 'Fokus — ce soir', body: `Il te reste ${left} tâche${left > 1 ? 's' : ''}, ${s.p} % aujourd’hui.${ritual}`, url, repeat: 'daily', next };
  }
  // déjà passé, ou plus rien à faire aujourd'hui : prochain rappel demain (texte générique, mis à jour à la prochaine ouverture)
  return { at: at + 864e5 * Math.max(1, Math.ceil((Date.now() - at + 1) / 864e5)), title: 'Fokus — ce soir', body: next, url, repeat: 'daily', next };
}

export function usePushSync() {
  const { S } = useStore();
  const on = S.set.push && !!S.pushId;
  useEffect(() => { configurePush(S.set.pushUrl, S.pushId); }, [S.set.pushUrl, S.pushId]);

  useEffect(() => {
    if (!on) return;
    const sync = (beacon) => {
      const St = getState();
      const jobs = St.set.pomoNotif && document.hidden ? pomoJobs(St) : [];
      ['pomo', 'pomo2'].forEach((k, i) => (jobs[i] ? schedule(k, jobs[i], beacon) : cancel(k, beacon)));
    };
    sync(false);
    const vis = () => sync(document.hidden);
    const hide = () => sync(true);
    document.addEventListener('visibilitychange', vis);
    addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', hide); };
  }, [on, S.pomo, S.set.pomoNotif, S.set.autoBreak, S.set.autoWork, S.set.pause, S.set.longPause, S.set.pomo, S.set.cycle]);

  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => {
      const St = getState();
      if (St.set.remind) schedule('evening', eveningJob(St)); else cancel('evening');
    }, 1500);
    return () => clearTimeout(t);
  }, [on, S.tasks, S.set.remind, S.set.remindAt, S.set.evening, S.last]);
}
