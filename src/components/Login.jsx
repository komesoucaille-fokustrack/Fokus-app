import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { GoogleButton } from './Account';
import { emailLogin, emailStart, emailVerify, googleLogin, passwordLogin, signupVerify, useCloud } from '../lib/cloud';
import { MIN_AGE } from '../cloud-config';
import ContactForm from './Contact';

/* =====================================================================
   ÉCRAN DE CONNEXION (connexion obligatoire, REQUIRE_LOGIN) — affiché à la place de l'app tant qu'on n'est pas connecté.
   Deux onglets : « Se connecter » (e-mail + mot de passe, ou code à 6 chiffres reçu par e-mail) et « Créer un compte »
   (prénom, nom, pseudo, âge, e-mail, mot de passe en une fois ; l'adresse est vérifiée par un code). Les champs portent les
   bons « autocomplete » : Safari / le trousseau iCloud proposent d'enregistrer l'identifiant et le mot de passe, puis les remplissent.
   La session reste ouverte (400 jours) : pas besoin de se reconnecter à chaque ouverture. Texte de présentation
   pour les nouveaux venus (et pour Google, qui lit cette page) + liens vers Découvrir / Pomodoro / Confidentialité.
   ===================================================================== */
/* Les moyens de connexion (Google, code e-mail) : écran de connexion et Réglages → Compte */
export function LoginMethods({ initial = 'email' }) {
  const c = useCloud();
  const [step, setStep] = useState(initial);
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('fokus_email') || ''; } catch { return ''; } });
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
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
  const pwLogin = async (e) => {
    e.preventDefault();
    if (busy || !pw) return;
    setErr(''); setBusy(true);
    try { await passwordLogin(email.trim(), pw); try { localStorage.setItem('fokus_email', email.trim()); } catch { /* rien */ } }
    catch (x) { setErr(x.message); setPw(''); setBusy(false); }
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
            <p className="login-note">On t'envoie un code à 6 chiffres. <button type="button" className="login-link" onClick={() => { setStep('pw'); setErr(''); }}>J’ai un mot de passe</button></p>
          </form>
        )}

        {emailLogin() && step === 'pw' && (
          <form onSubmit={pwLogin} className="login-form">
            <label htmlFor="login-mail2">Ton adresse e-mail</label>
            <input id="login-mail2" className="field" type="email" inputMode="email" autoComplete="username" autoCapitalize="off" spellCheck="false"
              placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="login-pw">Mot de passe</label>
            <input id="login-pw" className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            <button className="b on login-go" disabled={busy || !email.includes('@') || !pw}>{busy ? 'Connexion…' : 'Se connecter'}</button>
            <div className="login-links">
              <button type="button" className="login-link" onClick={() => { setStep('email'); setErr(''); }}>Recevoir un code à la place</button>
              <button type="button" className="login-link" onClick={() => { setErr(''); send(); }} disabled={!email.includes('@')}>Mot de passe oublié ?</button>
            </div>
            <p className="login-note">Pas encore de mot de passe ? Connecte-toi avec un code, puis crée-le dans Réglages → Compte.</p>
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

/* Onglet « Créer un compte » : tout en une fois, puis vérification de l'adresse par un code (anti-faux comptes) */
const NAME = /^[\p{L}][\p{L}\p{M} '’.-]{0,39}$/u, PSEUDO = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]{1,19}$/u;
const pwIssue = (pw) => (pw.length < 8 ? 'au moins 8 caractères' : /^(.)\1+$/.test(pw) || /^(?:12345678|motdepasse|password|azertyui|qwertyui)/i.test(pw) ? 'trop facile à deviner' : '');
function Signup({ onSwitch }) {
  const [f, setF] = useState({ first: '', last: '', pseudo: '', age: '', email: '', pw: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'age' ? e.target.value.replace(/\D/g, '').slice(0, 3) : e.target.value }));
  const [show, setShow] = useState(false);
  const [certify, setCertify] = useState(false);
  const [minor, setMinor] = useState(false);
  const [step, setStep] = useState('form');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const codeIn = useRef(null), ageIn = useRef(null);
  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const email = f.email.trim(), age = +f.age;
  const problem = !NAME.test(f.first.trim()) ? 'Prénom : lettres, espaces et tirets.' : !NAME.test(f.last.trim()) ? 'Nom : lettres, espaces et tirets.'
    : !PSEUDO.test(f.pseudo.trim()) ? 'Pseudo : 2 à 20 caractères (lettres, chiffres, _ . -).' : !(age >= 7 && age <= 120) ? 'Indique ton âge.'
      : !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? 'Adresse e-mail invalide.' : pwIssue(f.pw) ? `Mot de passe : ${pwIssue(f.pw)}.` : '';
  const send = async (e, confirmed) => {
    e?.preventDefault();
    if (busy) return;
    if (problem) { setErr(problem); return; }
    if (age < MIN_AGE && !confirmed) { setMinor(true); return; }
    setErr(''); setBusy(true);
    try {
      await emailStart(email);
      try { localStorage.setItem('fokus_email', email); } catch { /* rien */ }
      setStep('code'); setCode(''); setWait(60);
      setTimeout(() => codeIn.current?.focus(), 50);
    } catch (x) {
      if (/attends une minute/.test(x.message)) { setStep('code'); setWait(60); setErr('Un code t’a déjà été envoyé il y a moins d’une minute : utilise le dernier reçu.'); } else setErr(x.message);
    }
    setBusy(false);
  };
  const verify = async (value = code) => {
    if (busy || value.length !== 6) return;
    setErr(''); setBusy(true);
    try {
      const r = await signupVerify(email, value, { first: f.first.trim(), last: f.last.trim(), pseudo: f.pseudo.trim(), age }, f.pw);
      if (!r.fresh) alert('Cette adresse avait déjà un compte : te voilà connecté·e dessus (ton profil existant est conservé).');
    } catch (x) { setErr(x.message); setCode(''); codeIn.current?.focus(); setBusy(false); }
  };
  if (step === 'code') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="login-form">
        <p className="login-lead m-0!">Dernière étape : vérifie ton adresse. On vient d’envoyer un code à 6 chiffres à <b>{email}</b>.</p>
        <input ref={codeIn} className="field login-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" placeholder="••••••" value={code}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) verify(d); }} aria-label="Code à 6 chiffres" />
        <button className="b on login-go" disabled={busy || code.length !== 6}>{busy ? 'Création du compte…' : 'Valider et créer mon compte'}</button>
        <p className="login-note">Pas reçu ? Regarde dans les courriers indésirables.</p>
        <div className="login-links">
          <button type="button" className="login-link" disabled={wait > 0 || busy} onClick={() => send(null, true)}>{wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}</button>
          <button type="button" className="login-link" onClick={() => { setStep('form'); setErr(''); }}>Modifier mes infos</button>
        </div>
        {err && <p className="login-err" role="alert">{err}</p>}
      </form>
    );
  }
  return (
    <form onSubmit={send} className="login-form" autoComplete="on">
      <div className="prof-row">
        <label>Prénom<input className="field" value={f.first} onChange={set('first')} autoComplete="given-name" maxLength={40} required /></label>
        <label>Nom<input className="field" value={f.last} onChange={set('last')} autoComplete="family-name" maxLength={40} required /></label>
      </div>
      <div className="prof-row prof-row-2">
        <label>Pseudo<input className="field" value={f.pseudo} onChange={set('pseudo')} placeholder="ex. lea_42" autoComplete="nickname" autoCapitalize="off" spellCheck="false" maxLength={20} required /></label>
        <label>Âge<input ref={ageIn} className="field" value={f.age} onChange={(e) => { set('age')(e); setMinor(false); }} inputMode="numeric" pattern="\d*" placeholder="ex. 17" aria-label="Âge (en années)" required /></label>
      </div>
      <label>Adresse e-mail<input className="field" type="email" inputMode="email" value={f.email} onChange={set('email')} autoComplete="username" autoCapitalize="off" spellCheck="false" placeholder="prenom@exemple.fr" required /></label>
      <label>Mot de passe
        <span className="pw-wrap">
          <input className="field" type={show ? 'text' : 'password'} value={f.pw} onChange={set('pw')} autoComplete="new-password" placeholder="8 caractères minimum" required />
          <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{show ? '🙈' : '👁'}</button>
        </span>
      </label>
      <label className="prof-certify">
        <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} required />
        <span>Je certifie que ces informations, et en particulier mon âge, sont exactes. Fokus est réservé aux {MIN_AGE} ans et plus : un âge inférieur bloque le compte.</span>
      </label>
      {minor && (
        <div className="prof-minor" role="alert">
          <span><b>⚠️ Tu as indiqué {f.age} ans.</b> Fokus est réservé aux {MIN_AGE} ans et plus : si tu confirmes, ton compte sera bloqué. S’il s’agit d’une faute de frappe, corrige ton âge.</span>
          <span className="prof-minor-b">
            <button type="button" className="b on" onClick={() => { setMinor(false); ageIn.current?.focus(); }}>Corriger mon âge</button>
            <button type="button" className="b danger" onClick={() => send(null, true)}>Je confirme : {f.age} ans</button>
          </span>
        </div>
      )}
      <button className="b on login-go" disabled={busy || minor || !certify}>{busy ? 'Envoi du code…' : 'Créer mon compte'}</button>
      <p className="login-note">On t’envoie un code pour vérifier ton adresse. Ton iPad / iPhone te proposera d’enregistrer le mot de passe : plus besoin de le retaper.</p>
      {err && <p className="login-err" role="alert">{err}</p>}
      <p className="login-note">Déjà un compte ? <button type="button" className="login-link" onClick={onSwitch}>Se connecter</button></p>
    </form>
  );
}

export default function Login() {
  const card = useRef(null);
  const [contact, setContact] = useState(false);
  // « Créer un compte » au premier passage, « Se connecter » si une adresse a déjà servi sur cet appareil
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('fokus_email') ? 'in' : 'up'; } catch { return 'up'; } });
  useLayoutEffect(() => {
    gsap.from(card.current, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card" ref={card}>
        <FokusLogo />
        <h1>{tab === 'up' ? 'Bienvenue sur Fokus' : 'Content de te revoir'}</h1>
        <p className="login-lead">Tes tâches du jour, un minuteur Pomodoro et ta progression, sauvegardés sur ton compte et retrouvés sur tous tes appareils.</p>
        {emailLogin() && (
          <div className="login-tabs" role="tablist" aria-label="Connexion ou inscription">
            <button type="button" role="tab" aria-selected={tab === 'in'} className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Se connecter</button>
            <button type="button" role="tab" aria-selected={tab === 'up'} className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>Créer un compte</button>
          </div>
        )}
        {emailLogin() && tab === 'up' ? <Signup onSwitch={() => setTab('in')} /> : <LoginMethods key="in" initial={emailLogin() ? 'pw' : 'email'} />}
        <p className="login-foot">Gratuit, sans pub. Ton adresse sert uniquement à te connecter et à sauvegarder ta progression.</p>
        <nav className="login-nav" aria-label="En savoir plus">
          <a href="./decouvrir/">Découvrir Fokus</a> · <a href="./pomodoro/">Minuteur Pomodoro</a> · <a href="./confidentialite/">Confidentialité</a>
          {' · '}<button type="button" className="login-link login-contact" onClick={() => setContact((v) => !v)} aria-expanded={contact}>Contact</button>
        </nav>
        {contact && <div className="login-contact-box"><b>Une question, un problème ?</b><ContactForm /></div>}
      </div>
    </main>
  );
}
