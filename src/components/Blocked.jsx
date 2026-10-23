import FokusLogo from './FokusLogo';
import ContactForm from './Contact';
import { CONTACT_EMAIL, MIN_AGE } from '../cloud-config';
import { logout } from '../lib/cloud';

/* =====================================================================
   COMPTE BLOQUÉ — âge inférieur à 15 ans indiqué à l'inscription. Pas de nouvel essai possible avec cette adresse :
   en cas d'erreur de saisie, l'utilisateur écrit au propriétaire (formulaire ou adresse pro), qui débloque depuis le tableau de bord.
   ===================================================================== */
export default function Blocked() {
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card">
        <FokusLogo />
        <h1>Compte en pause 🔒</h1>
        <p className="login-lead">Fokus est réservé aux personnes de <b>{MIN_AGE} ans et plus</b>. D’après l’âge indiqué à l’inscription, ton compte ne peut donc pas être utilisé.</p>
        <div className="blocked-help">
          <b>Tu t’es trompé en tapant ton âge ?</b>
          <span>Pas de souci : écris-nous ci-dessous ou à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> en indiquant ton vrai âge. On vérifie et on débloque ton compte rapidement.</span>
        </div>
        <ContactForm topic="age" />
        <button type="button" className="login-link blocked-out" onClick={() => logout(true)}>Se déconnecter</button>
      </div>
    </main>
  );
}
