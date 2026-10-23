import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { setProfile, useCloud } from '../lib/cloud';

/* =====================================================================
   PROFIL — prénom, nom et pseudo. Écran plein à la première connexion (avant l'app), et formulaire
   réutilisé dans Réglages → Compte pour modifier ensuite. Le pseudo s'affiche dans la salutation.
   ===================================================================== */
export function ProfileForm({ onDone, submit = 'Enregistrer', compact }) {
  const { user = {} } = useCloud();
  const guess = (user.name || '').split(' ')[0];
  const [first, setFirst] = useState(user.first || guess);
  const [last, setLast] = useState(user.last || '');
  const [pseudo, setPseudo] = useState(user.pseudo || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const changed = first !== (user.first || '') || last !== (user.last || '') || pseudo !== (user.pseudo || '');
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setOk(false); setBusy(true);
    try { await setProfile({ first, last, pseudo }); setOk(true); onDone?.(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} className={'login-form ' + (compact ? 'prof-compact' : '')}>
      <div className="prof-row">
        <label>Prénom<input className="field" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={40} required /></label>
        <label>Nom<input className="field" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={40} required /></label>
      </div>
      <label>Pseudo
        <input className="field" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder={first ? first.toLowerCase().replace(/\s+/g, '') : 'ex. lea_42'}
          autoComplete="nickname" autoCapitalize="off" spellCheck="false" maxLength={20} required />
      </label>
      <p className="login-note">Ton pseudo s’affiche dans l’app (« Bonjour, {pseudo || '…'} ») et reste modifiable à tout moment dans Réglages → Compte.</p>
      {err && <p className="login-err" role="alert">{err}</p>}
      {ok && compact && <p className="login-note">✓ Enregistré</p>}
      <button className="b on login-go" disabled={busy || !first.trim() || !last.trim() || pseudo.trim().length < 2 || (compact && !changed)}>{busy ? 'Enregistrement…' : submit}</button>
    </form>
  );
}

/* Écran de première connexion */
export default function Profile() {
  const card = useRef(null);
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card" ref={card}>
        <FokusLogo />
        <h1>Faisons connaissance 👋</h1>
        <p className="login-lead">Dernière étape avant d’entrer : ton prénom, ton nom et le pseudo de ton choix.</p>
        <ProfileForm submit="Entrer dans Fokus" />
      </div>
    </main>
  );
}
