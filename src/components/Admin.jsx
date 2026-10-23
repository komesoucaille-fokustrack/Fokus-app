import { useEffect, useMemo, useState } from 'react';
import { adminApi, adminUnblock } from '../lib/cloud';
import { toast } from '../store';

/* =====================================================================
   TABLEAU DE BORD DU PROPRIÉTAIRE (Réglages → Administration, visible seulement pour ADMIN_EMAILS)
   En ligne en direct (rafraîchi toutes les 10 s), récap Aujourd'hui / Semaine / Mois / Année / Total,
   30 derniers jours, liste des comptes (recherche, copie des e-mails, export CSV).
   ===================================================================== */
const PERIODS = [['today', 'Aujourd’hui'], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['year', 'Cette année'], ['all', 'Depuis le début']];
const nf = new Intl.NumberFormat('fr-FR');
export const dur = (s) => {
  s = Math.round(s || 0);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${nf.format(h)} h ${String(m).padStart(2, '0')}` : `${m} min`;
};
const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  return s < 120 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : s < 86400 ? `il y a ${Math.round(s / 3600)} h` : `il y a ${Math.round(s / 86400)} j`;
};

function Stat({ icon, label, value, sub }) {
  return (
    <div className="adm-stat">
      <span className="adm-stat-l"><span aria-hidden="true">{icon}</span> {label}</span>
      <b>{value}</b>
      {sub && <span className="adm-stat-s">{sub}</span>}
    </div>
  );
}

function Bars({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const W = 300, H = 90, bw = W / daily.length;
  return (
    <figure className="adm-chart">
      <svg viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label="Visiteurs par jour sur 30 jours">
        {daily.map((d, i) => {
          const h = Math.max(d.visitors ? 3 : 1, (d.visitors / max) * H);
          return (
            <rect key={d.day} x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx="2" fill={i === daily.length - 1 ? '#86efac' : '#3b6d55'}>
              <title>{`${date(d.day + 'T12:00')} : ${d.visitors} visiteur${d.visitors > 1 ? 's' : ''} · ${dur(d.secs)}`}</title>
            </rect>
          );
        })}
        <text x="0" y={H + 13} className="adm-ax">{date(daily[0].day + 'T12:00').replace(/ \d{4}$/, '')}</text>
        <text x={W} y={H + 13} textAnchor="end" className="adm-ax">aujourd’hui</text>
      </svg>
      <figcaption>Visiteurs par jour (30 jours) · record : {max}</figcaption>
    </figure>
  );
}

export default function AdminDashboard() {
  const [sum, setSum] = useState(null);
  const [acc, setAcc] = useState(null);
  const [per, setPer] = useState('week');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () => !document.hidden && adminApi('summary').then((r) => { if (alive) { setSum(r); setErr(''); } }).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 10000);
    adminApi('accounts').then((r) => alive && setAcc(r.accounts)).catch((e) => alive && setErr(e.message));
    return () => { alive = false; clearInterval(t); };
  }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (acc || []).filter((a) => [a.email, a.pseudo, a.first, a.last].some((x) => (x || '').toLowerCase().includes(k)));
  }, [acc, q]);
  const ages = (acc || []).map((a) => a.age).filter(Boolean);
  const avgAge = ages.length ? Math.round(ages.reduce((x, y) => x + y, 0) / ages.length) : 0;
  // comptes revenus récemment (dernière visite) : les inscrits qui utilisent vraiment Fokus
  const activeIn = (days) => (acc || []).filter((a) => Date.now() - a.seen < days * 864e5).length;
  // compte bloqué par erreur (âge mal saisi) : débloquer → l'âge lui sera redemandé à sa prochaine ouverture
  const unblock = async (email) => {
    if (!confirm(`Débloquer ${email} ? Son âge lui sera redemandé à la prochaine ouverture.`)) return;
    try { await adminUnblock(email); setAcc((l) => l.map((x) => (x.email === email ? { ...x, blocked: '', age: 0 } : x))); toast('Compte débloqué ✓'); }
    catch (e) { toast(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shown.map((a) => a.email).join('\n')); toast(`${shown.length} adresse${shown.length > 1 ? 's' : ''} copiée${shown.length > 1 ? 's' : ''}.`); }
    catch { toast('Copie impossible.'); }
  };
  const csv = () => {
    const rows = [['email', 'prenom', 'nom', 'pseudo', 'age', 'inscription', 'derniere_visite', 'connexion'], ...shown.map((a) => [a.email, a.first || '', a.last || '', a.pseudo || '', a.age || '', new Date(a.created).toISOString(), new Date(a.seen).toISOString(), a.via])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv' }));
    a.download = 'fokus-comptes-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (err && !sum) return <p className="cloud-err">{err}</p>;
  if (!sum) return <p className="si-d">Chargement du tableau de bord…</p>;
  const p = sum.periods[per];
  return (
    <div className="adm">
      <div className="adm-live">
        <span className="adm-dot" aria-hidden="true" />
        <div>
          <b className="adm-live-n">{nf.format(sum.online)}</b>
          <span> {sum.online > 1 ? 'personnes en ligne' : 'personne en ligne'} en ce moment</span>
          <span className="adm-live-s">dont {sum.onlineAccounts} connectée{sum.onlineAccounts > 1 ? 's' : ''} à un compte · {nf.format(sum.accounts)} compte{sum.accounts > 1 ? 's' : ''} au total</span>
        </div>
      </div>

      <div className="viewseg adm-per" role="group" aria-label="Période">
        {PERIODS.map(([k, l]) => <button key={k} type="button" className={per === k ? 'on' : ''} onClick={() => setPer(k)}>{l}</button>)}
      </div>
      <div className="adm-grid">
        <Stat icon="👥" label="Visiteurs" value={nf.format(p.visitors)} sub="appareils différents" />
        <Stat icon="🕑" label="Temps passé" value={dur(p.secs)} sub={p.visitors ? `≈ ${dur(p.secs / p.visitors)} par visiteur` : 'cumulé, tous utilisateurs'} />
        <Stat icon="⏱️" label="Concentration" value={dur(p.focus)} sub="minuteur Pomodoro, cumulé" />
        <Stat icon="✅" label="Tâches validées" value={nf.format(p.done)} />
        <Stat icon="✨" label="Nouveaux comptes" value={nf.format(p.signups)} />
      </div>
      <Bars daily={sum.daily} />

      <div className="adm-acc-h">
        <b>📧 Comptes ({nf.format(acc ? acc.length : sum.accounts)}){avgAge ? <span className="adm-name"> · âge moyen {avgAge} ans</span> : null}</b>
        <span className="flex flex-wrap gap-2">
          <button type="button" className="b" onClick={copy} disabled={!shown.length}>Copier les e-mails</button>
          <button type="button" className="b" onClick={csv} disabled={!shown.length}>Exporter (CSV)</button>
        </span>
      </div>
      {acc && acc.length > 0 && (
        <p className="adm-active">{acc.some((a) => a.blocked) ? <>🔒 <b>{acc.filter((a) => a.blocked).length}</b> bloqué(s) (moins de 15 ans) · </> : null}🔁 Comptes actifs : <b>{nf.format(activeIn(1))}</b> aujourd’hui · <b>{nf.format(activeIn(7))}</b> sur 7 jours · <b>{nf.format(activeIn(30))}</b> sur 30 jours</p>
      )}
      <input className="field adm-search" type="search" placeholder="Rechercher (e-mail, pseudo, nom)…" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="off" />
      {!acc ? <p className="si-d">Chargement des comptes…</p> : !shown.length ? <p className="si-d">Aucun compte{q ? ' pour cette recherche' : ' pour l’instant'}.</p> : (
        <ul className="adm-list">
          {shown.slice(0, 300).map((a) => (
            <li key={a.email}>
              <b>{a.pseudo ? <>{a.pseudo} <span className="adm-name">· {a.first} {a.last}{a.age ? ` · ${a.age} ans` : ''}</span></> : a.email}</b>
              {a.pseudo && <span>{a.email}</span>}
              <span>Inscrit le {date(a.created)} · vu {ago(a.seen)} · {a.via === 'google' ? 'Google' : 'code e-mail'}</span>
              {a.blocked && (
                <span className="adm-blocked">🔒 Bloqué (âge indiqué : {a.age} ans)
                  <button type="button" className="b" onClick={() => unblock(a.email)}>Débloquer</button>
                </span>
              )}
            </li>
          ))}
          {shown.length > 300 && <li className="si-d">… et {shown.length - 300} autres (utilise la recherche ou l’export).</li>}
        </ul>
      )}
      <p className="adm-note">Les adresses servent à la connexion. Pour envoyer des nouvelles (newsletter), il faut d’abord l’accord de chaque personne (RGPD).</p>
    </div>
  );
}
