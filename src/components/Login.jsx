import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { GoogleButton } from './Account';
import { emailLogin, emailStart, emailVerify, googleLogin, useCloud } from '../lib/cloud';

/* =====================================================================
   ÉCRAN DE CONNEXION (connexion obligatoire, REQUIRE_LOGIN) — affiché à la place de l'app tant qu'on n'est pas connecté.
   « Continuer avec Google » et/ou code à 6 chiffres reçu par e-mail (sans mot de passe). Texte de présentation
   pour les nouveaux venus (et pour Google, qui lit cette page) + liens vers Découvrir / Pomodoro / Confidentialité.
   ===================================================================== */
/* Les moyens de connexion (Google, code e-mail) : écran de connexion et Réglages → Compte */
export function LoginMethods() {
  const c = useCloud();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('fokus_email') || ''; } catch { return ''; } });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [online, setOnline] = useState(navigator.onLine !== false);
  const codeIn = useRef(null);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => { // délai avant de pouvoir redemander un code
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      await emailStart(email.trim());
      try { localStorage.setItem('fokus_email', email.trim()); } catch { /* rien */ }
      setStep('code'); setCode(''); setWait(60);
      setTimeout(() => codeIn.current?.focus(), 50);
    } catch (x) {
      if (/attends une minute/.test(x.message) && step === 'email') { // code envoyé il y a moins d'une minute (autre appareil ?) : il est encore valable
        setStep('code'); setCode(''); setWait(60);
        setErr('Un code t’a déjà été envoyé il y a moins d’une minute : utilise le dernier reçu.');
        setTimeout(() => codeIn.current?.focus(), 50);
      } else setErr(x.message);
    }
    setBusy(false);
  };
  const verify = async (value = code) => {
    if (busy || value.length !== 6) return;
    setErr(''); setBusy(true);
    try { await emailVerify(email.trim(), value); } // connecté : l'app remplace cet écran
    catch (x) { setErr(x.message); setCode(''); codeIn.current?.focus(); setBusy(false); }
  };
  const typeCode = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 6);
    setCode(d);
    if (d.length === 6) verify(d); // collé depuis l'e-mail ou rempli automatiquement : connexion directe
  };

  return (
    <div className="login-methods">
        {!online && <p className="login-err">Pas de connexion internet : il en faut une pour te connecter la première fois.</p>}

        {googleLogin() && step === 'email' && <GoogleButton />}
        {googleLogin() && emailLogin() && step === 'email' && <div className="login-or"><span>ou</span></div>}

        {emailLogin() && step === 'email' && (
          <form onSubmit={send} className="login-form">
            <label htmlFor="login-mail">Ton adresse e-mail</label>
            <input id="login-mail" className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" spellCheck="false"
              placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="b on login-go" disabled={busy || !email.includes('@')}>{busy ? 'Envoi…' : 'Recevoir un code'}</button>
            <p className="login-note">Pas de mot de passe : on t'envoie un code à 6 chiffres.</p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="login-form">
            <label htmlFor="login-code">Code envoyé à <b>{email.trim()}</b></label>
            <input id="login-code" ref={codeIn} className="field login-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}"
              placeholder="••••••" value={code} onChange={(e) => typeCode(e.target.value)} aria-label="Code à 6 chiffres" />
            <button className="b on login-go" disabled={busy || code.length !== 6}>{busy ? 'Connexion…' : 'Se connecter'}</button>
            <p className="login-note">Pas reçu ? Regarde dans les courriers indésirables.</p>
            <div className="login-links">
              <button type="button" className="login-link" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}</button>
              <button type="button" className="login-link" onClick={() => { setStep('email'); setErr(''); }}>Changer d'adresse</button>
            </div>
          </form>
        )}

        {(err || c.error) && <p className="login-err" role="alert">{err || c.error}</p>}
        {c.busy && !busy && <p className="login-note">Connexion…</p>}
    </div>
  );
}

export default function Login() {
  const card = useRef(null);
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card" ref={card}>
        <FokusLogo />
        <h1>Bienvenue sur Fokus</h1>
        <p className="login-lead">Tes tâches du jour, un minuteur Pomodoro et ta progression, sauvegardés sur ton compte et retrouvés sur tous tes appareils.</p>
        <LoginMethods />
        <p className="login-foot">Gratuit, sans pub. Ton adresse sert uniquement à te connecter et à sauvegarder ta progression.</p>
        <nav className="login-nav" aria-label="En savoir plus">
          <a href="./decouvrir/">Découvrir Fokus</a> · <a href="./pomodoro/">Minuteur Pomodoro</a> · <a href="./confidentialite/">Confidentialité</a>
        </nav>
      </div>
    </main>
  );
}
