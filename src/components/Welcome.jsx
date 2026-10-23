import { useEffect, useState } from 'react';
import { markSeen, toast, useStore } from '../store';
import { isStandalone } from '../lib/push';

/* =====================================================================
   BIENVENUE (première ouverture d'un nouvel utilisateur) + partage du lien
   Carte discrète en haut de la page Tâches : l'essentiel en 3 points, comment installer Fokus
   sur l'écran d'accueil, et un bouton pour inviter des amis. Disparaît dès qu'on la ferme.
   ===================================================================== */
export async function shareFokus() {
  const url = location.origin + location.pathname;
  const data = { title: 'Fokus', text: 'Fokus : mes tâches du jour, un minuteur de concentration et ma progression. Gratuit, sans pub.', url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Lien copié : colle-le dans un message 👍'); }
  catch { toast(url, null, 8000); }
}

const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function Welcome() {
  const { S } = useStore();
  const [canInstall, setCanInstall] = useState(!!window.__fokusInstall);
  useEffect(() => { const f = () => setCanInstall(true); addEventListener('fokusinstall', f); return () => removeEventListener('fokusinstall', f); }, []);
  if (S.seen.welcome || S.tasks.length || Object.keys(S.hist).length) return null;
  const install = async () => { const e = window.__fokusInstall; if (!e) return; e.prompt(); await e.userChoice.catch(() => {}); window.__fokusInstall = null; setCanInstall(false); };
  return (
    <div className="card welcome">
      <div className="flex items-start justify-between gap-3">
        <b className="text-[17px]">Bienvenue sur Fokus 👋</b>
        <button type="button" className="ic close" onClick={() => markSeen('welcome')} aria-label="Fermer">✕</button>
      </div>
      <ul className="welcome-l">
        <li><span>✍️</span><span>Ajoute tes tâches du jour : « Sport demain 18h30 @sport ~45 » marche aussi.</span></li>
        <li><span>✅</span><span>Coche ce que tu as fait puis touche <b>Valider</b> : ta barre avance (et ça se voit !).</span></li>
        <li><span>⏱️</span><span>Concentre-toi avec l'onglet <b>Pomodoro</b>, suis ta série et gagne des badges.</span></li>
      </ul>
      {!isStandalone() && (
        <p className="welcome-i">
          📲 <b>Installe Fokus comme une app</b> (plein écran, hors ligne, notifications) :{' '}
          {ios() ? <>dans Safari, bouton <b>Partager</b> puis <b>«&nbsp;Sur l'écran d'accueil&nbsp;»</b>.</> : canInstall ? 'un tap suffit.' : <>menu du navigateur → <b>«&nbsp;Installer l'application&nbsp;»</b>.</>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canInstall && !isStandalone() && <button type="button" className="b on" onClick={install}>Installer Fokus</button>}
        <button type="button" className={'b ' + (canInstall && !isStandalone() ? '' : 'on')} onClick={() => markSeen('welcome')}>C'est parti</button>
        <button type="button" className="b" onClick={shareFokus}>Inviter des amis</button>
      </div>
      <p className="mt-2.5 text-[12px] text-mut">Tes données restent sur ton appareil : pas de compte, pas de pub, rien n'est envoyé ailleurs.</p>
    </div>
  );
}
