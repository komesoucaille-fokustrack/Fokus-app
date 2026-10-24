import { useEffect } from 'react';
import { getState, pomoElapsed, pomoLocked, pomoOut, toast } from '../store';
import { cancel, schedule } from './push';

/* =====================================================================
   VERROU DE CONCENTRATION — ce qu'une web app peut faire (bloquer les autres apps est réservé aux apps de l'App Store) :
   - pendant une concentration verrouillée, quitter Fokus est compté (pomo.out) et signalé au retour ;
   - si les notifications sont activées, un rappel « reviens » part 20 s puis 3 min après la sortie
     (programmé sur le serveur au passage en arrière-plan, annulé dès le retour : jamais reçu si l'on revient vite) ;
   - le mode Concentration d'iOS peut être lancé par un raccourci (Réglages → Pomodoro → Verrou de concentration).
   ===================================================================== */
let away = 0, armed = false;
const fmt = (s) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

export function useFocusLock() {
  useEffect(() => {
    const vis = () => {
      const S = getState();
      if (document.hidden) {
        if (!pomoLocked(S)) return;
        away = Date.now();
        if (S.set.push && S.pushId) {
          const p = S.pomo, left = p.flow ? 0 : Math.max(1, Math.round((p.dur - pomoElapsed(p)) / 60)), url = './?page=4';
          const body = left ? `Encore ${left} min de concentration. Reviens sur Fokus, tu peux le faire 💪` : 'Ta session libre continue. Reviens sur Fokus 💪';
          schedule('lock', { at: away + 20e3, title: '🔒 Ta session continue', body, url }, true);
          schedule('lock2', { at: away + 180e3, title: '🔒 Toujours là ?', body: 'Ton minuteur tourne encore. Un dernier effort, puis la pause ☕', url }, true);
          armed = true;
        }
      } else {
        if (armed) { cancel('lock'); cancel('lock2'); armed = false; }
        if (!away) return;
        const s = Math.round((Date.now() - away) / 1000);
        away = 0;
        if (pomoLocked() && s >= 3) {
          pomoOut();
          toast(`🔒 Tu es sorti·e de Fokus ${fmt(s)}. On reste concentré·e 💪`, null, 5000);
        }
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
}
