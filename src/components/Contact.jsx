import { useState } from 'react';
import { CONTACT_EMAIL } from '../cloud-config';
import { sendContact, useCloud } from '../lib/cloud';

/* =====================================================================
   CONTACT — formulaire (Réglages → Contact, écran de connexion, compte bloqué) : le message part dans la boîte
   du propriétaire (serveur /contact), qui répond directement à l'adresse de l'utilisateur. + adresse pro affichée.
   ===================================================================== */
export const TOPICS = [['compte', 'Problème de compte / connexion'], ['age', 'Âge saisi par erreur'], ['bug', 'Un bug'], ['idee', 'Une idée, une suggestion'], ['autre', 'Autre chose']];

export default function ContactForm({ topic: t0 = 'compte', compact }) {
  const { session, user } = useCloud();
  const [topic, setTopic] = useState(t0);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try { await sendContact({ topic, message, email: email.trim() }); setSent(true); setMessage(''); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (sent) {
    return (
      <div className="contact-ok" role="status">
        <b>Message envoyé ✓</b>
        <span>Merci ! On te répond par e-mail{session && user?.email ? ` (${user.email})` : ''}, en général sous 48 h.</span>
        <button type="button" className="login-link" onClick={() => setSent(false)}>Envoyer un autre message</button>
      </div>
    );
  }
  return (
    <form onSubmit={send} className={'login-form contact ' + (compact ? 'prof-compact' : '')}>
      <label>Sujet
        <select className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {!session && (
        <label>Ton adresse e-mail (pour te répondre)
          <input className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      )}
      <label>Ton message
        <textarea className="field contact-msg" rows={compact ? 4 : 5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder={topic === 'age' ? 'Ex. : j’ai tapé 2 au lieu de 20, mon vrai âge est 20 ans.' : 'Explique-nous en quelques mots…'} required />
      </label>
      {err && <p className="login-err" role="alert">{err}</p>}
      <button className="b on login-go" disabled={busy || message.trim().length < 5 || (!session && !email.includes('@'))}>{busy ? 'Envoi…' : 'Envoyer le message'}</button>
      <p className="login-note">Tu peux aussi écrire directement à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </form>
  );
}
