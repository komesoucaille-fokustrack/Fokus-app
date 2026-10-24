import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import { exportJSON, getState } from '../store';
import { deleteAccount, loginRequired, logout, pull, push, renderGoogleButton, resolveChoice, setPassword, useCloud } from '../lib/cloud';
import { LoginMethods } from './Login';
import { ProfileForm } from './Profile';

/* =====================================================================
   COMPTE — rubrique des Réglages (connexion, état de la sauvegarde) + choix à la première connexion
   ===================================================================== */
const ago = (t) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 45 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : new Date(t).toLocaleDateString('fr-FR');
};
const count = (o) => `${(o.tasks || []).length} tâche${(o.tasks || []).length > 1 ? 's' : ''} · ${Object.keys(o.hist || {}).length} jour${Object.keys(o.hist || {}).length > 1 ? 's' : ''} d’historique`;

export function GoogleButton() {
  const el = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    renderGoogleButton(el.current, el.current.offsetWidth).catch((e) => setErr(e.message));
  }, []);
  return (
    <>
      <div ref={el} className="gbtn" />
      {err && <p className="cloud-err">{err}</p>}
    </>
  );
}

/* Mot de passe : créer, changer ou retirer (8 caractères minimum, vérifié aussi par le serveur) */
function PasswordForm({ has, email }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setMsg('Au moins 8 caractères.'); return; }
    if (pw !== pw2) { setMsg('Les deux mots de passe ne sont pas identiques.'); return; }
    setBusy(true); setMsg('');
    try { await setPassword(pw); setPw(''); setPw2(''); setMsg('✓ Mot de passe enregistré.'); } catch (x) { setMsg(x.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm('Retirer ton mot de passe ? Tu te connecteras avec un code par e-mail.')) return;
    setBusy(true);
    try { await setPassword(''); setMsg('Mot de passe retiré.'); } catch (x) { setMsg(x.message); }
    setBusy(false);
  };
  return (
    <form className="login-form prof-compact" onSubmit={save}>
      <input type="email" autoComplete="username" value={email || ''} readOnly hidden />
      <span className="si-d">{has ? 'Un mot de passe est défini. Tu peux le changer :' : 'Aucun mot de passe : tu te connectes avec un code par e-mail.'}</span>
      <input className="field" type="password" autoComplete="new-password" placeholder={has ? 'Nouveau mot de passe' : 'Mot de passe (8 caractères min.)'} value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Mot de passe" />
      <input className="field" type="password" autoComplete="new-password" placeholder="Confirme le mot de passe" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Confirmation du mot de passe" />
      <span className="flex flex-wrap gap-2">
        <button className="b on login-go" disabled={busy || !pw}>{has ? 'Changer' : 'Créer mon mot de passe'}</button>
        {has && <button type="button" className="b" onClick={remove} disabled={busy}>Retirer</button>}
      </span>
      {msg && <span className={'si-d ' + (msg.startsWith('✓') ? '' : 'cloud-err')} role="status">{msg}</span>}
    </form>
  );
}

export function AccountSettings({ Group }) {
  const c = useCloud();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  if (!c.session) {
    return (
      <Group title="Compte" foot="Facultatif : sans compte, tes données restent uniquement sur cet appareil.">
        <div className="si col">
          <span className="si-l">
            <span className="si-t">Sauvegarde ta progression</span>
            <span className="si-d">Connecte-toi pour ne jamais perdre tes tâches, ta série et tes badges, et les retrouver sur ton iPad, ton iPhone ou un ordinateur.</span>
          </span>
          <LoginMethods />
          <a className="cloud-link" href="./confidentialite/">Ce qui est enregistré (confidentialité)</a>
        </div>
      </Group>
    );
  }
  const u = c.user || {};
  const status = c.busy ? 'Synchronisation…' : c.error ? c.error : c.dirty ? 'Modifications en attente d’envoi…' : `Sauvegardé ${ago(c.syncedAt)}`;
  const req = loginRequired();
  const del = async () => {
    if (!confirm(req ? 'Supprimer définitivement ton compte et toutes tes données ?' : 'Supprimer ton compte et toutes tes données du serveur ? Elles restent sur cet appareil.')) return;
    try { await deleteAccount(); } catch (e) { alert(e.message); }
  };
  const out = async () => {
    if (await logout()) return;
    if (confirm('Tes dernières modifications n’ont pas pu être envoyées (pas de réseau ?). Te déconnecter quand même ? Elles seront perdues.')) logout(true);
  };
  return (
    <>
      <Group title="Compte">
        <div className="si">
          <span className="acc">
            {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" width="44" height="44" /> : <span className="acc-i">{(u.pseudo || u.first || u.email || '?')[0].toUpperCase()}</span>}
            <span className="si-l">
              <span className="si-t">{u.pseudo || u.name || 'Mon compte'}{u.first ? <span className="si-d"> · {u.first} {u.last}</span> : null}</span>
              <span className="si-d">{u.email}</span>
            </span>
          </span>
        </div>
        <div className="si">
          <span className="si-l">
            <span className="si-t">Sauvegarde</span>
            <span className={'si-d ' + (c.error ? 'cloud-err' : '')}>{status}</span>
          </span>
          <span className="si-r"><button type="button" className="b" disabled={c.busy} onClick={() => (c.dirty ? push() : pull())}>Synchroniser</button></span>
        </div>
      </Group>
      <Group title="Mon profil">
        <div className="si col"><ProfileForm compact /></div>
      </Group>
      <Group title="Mot de passe" foot="Facultatif : pour te connecter sans attendre de code. Oublié ? Le code par e-mail marche toujours.">
        <div className="si col"><PasswordForm has={!!u.hasPw} email={u.email} /></div>
      </Group>
      <Group foot="Chaque modification est sauvegardée en quelques secondes. Connecte-toi avec la même adresse sur un autre appareil pour tout y retrouver.">
        <div className="si"><span className="si-l"><span className="si-t">Se déconnecter</span>
          <span className="si-d">{req ? 'Tes données restent sur ton compte et quittent cet appareil.' : 'Tes données restent sur cet appareil.'}</span></span>
          <span className="si-r"><button type="button" className="b" onClick={out}>Déconnexion</button></span></div>
        <div className="si"><span className="si-l"><span className="si-t">Supprimer mon compte</span><span className="si-d">{req ? 'Efface ton compte et toutes tes données.' : 'Efface tes données du serveur.'}</span></span>
          <span className="si-r"><button type="button" className="b danger" onClick={del}>Supprimer</button></span></div>
      </Group>
      <a className="cloud-link" href="./confidentialite/">Ce qui est enregistré (confidentialité)</a>
    </>
  );
}

/* Première connexion sur un appareil qui a déjà des données, alors que le compte en a aussi */
export function CloudChoice() {
  const c = useCloud();
  if (!c.choice) return null;
  const acc = c.choice.data, dev = getState();
  return (
    <Sheet title="Quelles données garder ?" sub="Ton compte et cet appareil ont chacun leurs données. Choisis celles à conserver : l’autre version sera remplacée." onClose={() => resolveChoice('later')}>
      <div className="grid gap-2.5">
        <button type="button" className="choice" onClick={() => resolveChoice('account')}>
          <b>☁️ Celles de mon compte</b>
          <span>Sauvegardées le {new Date(c.choice.at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · {count(acc)}</span>
        </button>
        <button type="button" className="choice" onClick={() => resolveChoice('device')}>
          <b>📱 Celles de cet appareil</b>
          <span>{count(dev)}</span>
        </button>
        <button type="button" className="cloud-link text-left" onClick={exportJSON}>Exporter d’abord les données de cet appareil (copie de sécurité)</button>
      </div>
    </Sheet>
  );
}
