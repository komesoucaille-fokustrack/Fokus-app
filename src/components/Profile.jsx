import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { setProfile, useCloud } from '../lib/cloud';
import { MIN_AGE } from '../cloud-config';

/* =====================================================================
   PROFIL — prénom, nom, pseudo et âge. Écran plein à la première connexion (avant l'app), et formulaire
   réutilisé dans Réglages → Compte pour modifier ensuite. Le pseudo s'affiche dans la salutation.
   Âge : engagement à dire la vérité (inscription) ; moins de 15 ans → confirmation explicite (faute de frappe ?)
   puis compte bloqué côté serveur (Blocked.jsx).
   ===================================================================== */
export function ProfileForm({ onDone, submit = 'Enregistrer', compact }) {
  const { user = {} } = useCloud();
  const guess = (user.name || '').split(' ')[0];
  const [first, setFirst] = useState(user.first || guess);
  const [last, setLast] = useState(user.last || '');
  const [pseudo, setPseudo] = useState(user.pseudo || '');
  const [age, setAgeRaw] = useState(user.age ? String(user.age) : '');
  const [certify, setCertify] = useState(!!compact);
  const [minor, setMinor] = useState(false); // confirmation demandée pour un âge < 15 ans
  const ageIn = useRef(null);
  const setAge = (v) => { setAgeRaw(v); setMinor(false); };
  const ageOk = /^\d{1,3}$/.test(age) && +age >= 7 && +age <= 120;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const changed = first !== (user.first || '') || last !== (user.last || '') || pseudo !== (user.pseudo || '') || age !== (user.age ? String(user.age) : '');
  const save = async (e, confirmed) => {
    e?.preventDefault();
    if (busy) return;
    if (+age < MIN_AGE && !confirmed) { setMinor(true); return; } // on demande confirmation avant de bloquer
    setErr(''); setOk(false); setBusy(true);
    try { await setProfile({ first, last, pseudo, age: +age }); setOk(true); onDone?.(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} className={'login-form ' + (compact ? 'prof-compact' : '')}>
      <div className="prof-row">
        <label>Prénom<input className="field" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={40} required /></label>
        <label>Nom<input className="field" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={40} required /></label>
      </div>
      <div className="prof-row prof-row-2">
        <label>Pseudo
          <input className="field" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder={first ? first.toLowerCase().replace(/\s+/g, '') : 'ex. lea_42'}
            autoComplete="nickname" autoCapitalize="off" spellCheck="false" maxLength={20} required />
        </label>
        <label>Âge
          <input ref={ageIn} className="field" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" pattern="\d*"
            placeholder="ex. 17" aria-label="Âge (en années)" required />
        </label>
      </div>
      <p className="login-note">Ton pseudo s’affiche dans l’app (« Bonjour, {pseudo || '…'} ») et reste modifiable à tout moment dans Réglages → Compte.
        Fokus est réservé aux {MIN_AGE} ans et plus.</p>
      {!compact && (
        <label className="prof-certify">
          <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} required />
          <span>Je certifie que ces informations, et en particulier mon âge, sont exactes. Indiquer un faux âge est interdit : un âge inférieur à {MIN_AGE} ans bloque le compte.</span>
        </label>
      )}
      {minor && (
        <div className="prof-minor" role="alert">
          <span><b>⚠️ Tu as indiqué {age} ans.</b> Fokus est réservé aux {MIN_AGE} ans et plus : si tu confirmes, ton compte sera bloqué. S’il s’agit d’une faute de frappe, corrige ton âge.</span>
          <span className="prof-minor-b">
            <button type="button" className="b on" onClick={() => { setMinor(false); ageIn.current?.focus(); }}>Corriger mon âge</button>
            <button type="button" className="b danger" onClick={() => save(null, true)}>Je confirme : {age} ans</button>
          </span>
        </div>
      )}
      {err && <p className="login-err" role="alert">{err}</p>}
      {ok && compact && <p className="login-note">✓ Enregistré</p>}
      <button className="b on login-go" disabled={busy || minor || !certify || !first.trim() || !last.trim() || pseudo.trim().length < 2 || !ageOk || (compact && !changed)}>{busy ? 'Enregistrement…' : submit}</button>
    </form>
  );
}

/* Écran de première connexion */
export default function Profile() {
  const isNew = !useCloud().user?.pseudo;
  const card = useRef(null);
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card" ref={card}>
        <FokusLogo />
        {isNew ? <h1>Faisons connaissance 👋</h1> : <h1>Un dernier détail ✨</h1>}
        <p className="login-lead">{isNew
          ? 'Dernière étape avant d’entrer : ton prénom, ton nom, le pseudo de ton choix et ton âge.'
          : 'Ajoute ton âge pour compléter ton profil, et c’est reparti !'}</p>
        <ProfileForm submit={isNew ? 'Continuer' : 'Entrer dans Fokus'} />
      </div>
    </main>
  );
}
