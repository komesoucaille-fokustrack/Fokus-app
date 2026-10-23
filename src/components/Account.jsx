import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import { exportJSON, getState } from '../store';
import { deleteAccount, pull, push, renderGoogleButton, resolveChoice, signOut, useCloud } from '../lib/cloud';

/* =====================================================================
   COMPTE — rubrique des Réglages (connexion Google, état de la sauvegarde) + choix à la première connexion
   ===================================================================== */
const ago = (t) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 45 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : new Date(t).toLocaleDateString('fr-FR');
};
const count = (o) => `${(o.tasks || []).length} tâche${(o.tasks || []).length > 1 ? 's' : ''} · ${Object.keys(o.hist || {}).length} jour${Object.keys(o.hist || {}).length > 1 ? 's' : ''} d’historique`;

function GoogleButton() {
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
            <span className="si-d">Connecte-toi avec Google pour ne jamais perdre tes tâches, ta série et tes badges, et les retrouver sur ton iPad, ton iPhone ou un ordinateur.</span>
          </span>
          <GoogleButton />
          {c.busy && <p className="si-d">Connexion…</p>}
          {c.error && <p className="cloud-err">{c.error}</p>}
          <a className="cloud-link" href="./confidentialite/">Ce qui est enregistré (confidentialité)</a>
        </div>
      </Group>
    );
  }
  const u = c.user || {};
  const status = c.busy ? 'Synchronisation…' : c.error ? c.error : c.dirty ? 'Modifications en attente d’envoi…' : `Sauvegardé ${ago(c.syncedAt)}`;
  const del = async () => {
    if (!confirm('Supprimer ton compte et toutes tes données du serveur ? Elles restent sur cet appareil.')) return;
    try { await deleteAccount(); } catch (e) { alert(e.message); }
  };
  return (
    <>
      <Group title="Compte">
        <div className="si">
          <span className="acc">
            {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" width="44" height="44" /> : <span className="acc-i">{(u.name || u.email || '?')[0].toUpperCase()}</span>}
            <span className="si-l">
              <span className="si-t">{u.name || 'Compte Google'}</span>
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
      <Group foot="Chaque modification est sauvegardée en quelques secondes. Ouvre Fokus sur un autre appareil avec le même compte Google pour tout y retrouver.">
        <div className="si"><span className="si-l"><span className="si-t">Se déconnecter</span><span className="si-d">Tes données restent sur cet appareil.</span></span>
          <span className="si-r"><button type="button" className="b" onClick={signOut}>Déconnexion</button></span></div>
        <div className="si"><span className="si-l"><span className="si-t">Supprimer mon compte</span><span className="si-d">Efface tes données du serveur.</span></span>
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
