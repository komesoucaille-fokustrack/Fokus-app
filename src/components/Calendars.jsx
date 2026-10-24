import { useState } from 'react';
import { calLink, cloudEnabled, useCloud } from '../lib/cloud';
import { CAL_COLORS, forgetCal, refreshAll, refreshCal, useCalendars } from '../lib/calendars';
import { setSetting, toast, uid } from '../store';

/* =====================================================================
   RÉGLAGES → AGENDAS
   1. « Fokus dans ton agenda » : lien d'abonnement (Apple Calendrier, Google Agenda, Outlook). Les tâches y apparaissent ;
      une tâche validée devient « ✅ b̶a̶r̶r̶é̶e̶ » à l'heure où elle a été faite.
   2. « Tes agendas dans Fokus » : coller le lien iCal d'un agenda → ses événements s'affichent dans la Chronologie.
   ===================================================================== */
const HOWTO = {
  apple: ['Apple (iPhone / iPad)', 'Touche « Ajouter à Apple Calendrier » puis « S’abonner ». Pour une mise à jour rapide : Réglages de l’iPad → Calendrier → Comptes → Récupérer les données → « Toutes les 15 minutes ».'],
  google: ['Google Agenda', 'Copie le lien, puis sur ordinateur : calendar.google.com → « Autres agendas » + → « À partir de l’URL » → colle le lien. (Google met à jour ces agendas toutes les quelques heures.)'],
  outlook: ['Outlook', 'outlook.com → Agenda → « Ajouter un calendrier » → « S’abonner à partir du web » → colle le lien.'],
};
const SOURCES = [
  ['Google Agenda', 'Sur ordinateur : calendar.google.com → ⚙️ Paramètres → clique ton agenda → « Intégrer l’agenda » → copie l’« Adresse secrète au format iCal ».'],
  ['iCloud (Apple)', 'App Calendrier → touche ⓘ à côté de l’agenda → active « Calendrier public » → « Partager le lien » → Copier.'],
  ['Outlook', 'outlook.com → ⚙️ → Calendrier → Calendriers partagés → « Publier un calendrier » → copie le lien ICS.'],
  ['École / club / Pronote', 'Cherche « Exporter », « S’abonner » ou « iCal » : copie le lien qui finit souvent par .ics.'],
];

function FeedLink() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const get = async (reset) => {
    if (reset && !confirm('Créer un nouveau lien ? L’ancien cessera de fonctionner (à refaire dans tes agendas).')) return;
    setBusy(true);
    try { setUrl((await calLink(reset)).url); if (reset) toast('Nouveau lien créé ✓'); } catch (e) { toast(e.message); }
    setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié ✓'); } catch { toast('Copie impossible : sélectionne le lien.'); } };
  if (!url) return <button type="button" className="b on" onClick={() => get(false)} disabled={busy}>{busy ? 'Création…' : '📅 Créer mon lien d’agenda'}</button>;
  return (
    <div className="cal-feed">
      <input className="field" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien de l’agenda Fokus" />
      <div className="flex flex-wrap gap-2">
        <a className="b on" href={url.replace(/^https:/, 'webcal:')}>Ajouter à Apple Calendrier</a>
        <button type="button" className="b" onClick={copy}>Copier le lien</button>
        <button type="button" className="b" onClick={() => get(true)} disabled={busy}>Nouveau lien</button>
      </div>
      <ul className="cal-how">{Object.values(HOWTO).map(([t, d]) => <li key={t}><b>{t}</b> : {d}</li>)}</ul>
      <p className="si-d">Garde ce lien pour toi : il permet de voir tes tâches. « Nouveau lien » désactive l’ancien.</p>
    </div>
  );
}

function AddCal({ S }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^(https|webcals?):\/\//i.test(u)) { toast('Colle un lien qui commence par https:// ou webcal://'); return; }
    const cals = S.set.cals || [];
    const cal = { id: 'cal-' + uid(), name: name.trim().slice(0, 30) || 'Mon agenda', url: u, color: CAL_COLORS[cals.length % CAL_COLORS.length], on: true };
    setBusy(true);
    setSetting('cals', [...cals, cal]);
    await refreshCal(cal, true);
    setBusy(false);
    setName(''); setUrl('');
    toast('Agenda ajouté ✓ Ses événements apparaissent dans la Chronologie.');
  };
  return (
    <form className="cal-add" onSubmit={add}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Cours, Perso, Club)" maxLength={30} aria-label="Nom de l’agenda" />
      <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien iCal (https://… ou webcal://…)" inputMode="url" autoCapitalize="off" autoCorrect="off" aria-label="Lien iCal de l’agenda" />
      <div className="flex flex-wrap gap-2">
        <button className="b on" disabled={busy || !url.trim()}>{busy ? 'Lecture…' : 'Ajouter l’agenda'}</button>
        <button type="button" className="b" onClick={() => setHelp((h) => !h)} aria-expanded={help}>Où trouver le lien ?</button>
      </div>
      {help && <ul className="cal-how">{SOURCES.map(([t, d]) => <li key={t}><b>{t}</b> : {d}</li>)}</ul>}
    </form>
  );
}

export function CalendarsSettings({ S, Group, Item, Switch }) {
  const { session } = useCloud();
  const { cache, loading } = useCalendars();
  const cals = S.set.cals || [];
  if (!cloudEnabled() || !session) return <Group title="Agendas"><p className="si-d p-3">Connecte-toi à ton compte pour relier tes agendas.</p></Group>;
  const edit = (id, f) => setSetting('cals', cals.map((c) => (c.id === id ? { ...c, ...f } : c)));
  const del = (c) => { if (!confirm(`Retirer « ${c.name} » de Fokus ?`)) return; setSetting('cals', cals.filter((x) => x.id !== c.id)); forgetCal(c.id); };
  return (
    <>
      <Group title="Fokus dans ton agenda" foot="Tes tâches apparaissent dans Apple Calendrier, Google Agenda ou Outlook. Quand tu valides une tâche dans Fokus, elle s’y affiche ✅ barrée, à l’heure où tu l’as vraiment faite (ex. prévue à 17 h, faite à 14 h → déplacée à 14 h).">
        <div className="si col"><FeedLink /></div>
        <Item title="Tâches sans heure" desc="Affichées en « toute la journée »">
          <Switch label="Tâches sans heure dans l’agenda" checked={S.set.calAllDay !== false} onChange={(v) => setSetting('calAllDay', v)} />
        </Item>
      </Group>
      <Group title="Tes agendas dans Fokus" foot="Les événements (cours, rendez-vous…) s’affichent dans « Ma journée » → Chronologie, à côté de tes tâches. Lecture seule : Fokus ne modifie jamais tes agendas. Mis à jour toutes les 15 minutes.">
        {cals.map((c) => {
          const st = cache[c.id];
          return (
            <Item key={c.id} title={<span className="flex items-center gap-2"><i className="cal-dot" style={{ background: c.color }} />{c.name}</span>}
              desc={st?.err ? '⚠️ ' + st.err : st ? `${st.events.length} événement${st.events.length > 1 ? 's' : ''} sur 30 jours · lu ${new Date(st.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Pas encore lu'}>
              <Switch label={'Afficher ' + c.name} checked={c.on !== false} onChange={(v) => edit(c.id, { on: v })} />
              <button type="button" className="ic" onClick={() => del(c)} aria-label={'Retirer ' + c.name}>🗑</button>
            </Item>
          );
        })}
        {cals.length > 0 && (
          <div className="si"><button type="button" className="b" onClick={() => refreshAll(true)} disabled={loading}>{loading ? 'Lecture…' : '↻ Relire mes agendas'}</button></div>
        )}
        <div className="si col"><AddCal S={S} /></div>
      </Group>
    </>
  );
}
