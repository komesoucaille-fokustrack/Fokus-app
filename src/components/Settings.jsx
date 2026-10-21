import { useRef, useState } from 'react';
import Sheet from './Sheet';
import {
  PASTELS, addTag, deleteTag, exportJSON, importJSON, jokersLeft, recolorTag, renameTag, resetAll, setAnim, setConfetti, setModal,
  setSetting, toast, todayKey, useStore,
} from '../store';
import { askPermission, canNotify } from '../lib/notify';
import { daysBetween } from '../lib/dates';

/* Rouage (icône paramètres) */
export function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Row({ title, desc, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:bg-hov">
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        {desc && <span className="block text-[13px] text-mut">{desc}</span>}
      </span>
      <span className="sw shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <i />
      </span>
    </label>
  );
}

function Line({ title, desc, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        {desc && <span className="block text-[13px] text-mut">{desc}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );
}

function Stepper({ value, min, max, step = 1, unit, onChange }) {
  const c = (v) => Math.min(max, Math.max(min, v));
  return (
    <span className="flex items-center gap-1.5">
      <button type="button" className="seg w-11" onClick={() => onChange(c(value - step))} aria-label="Moins" disabled={value <= min}>−</button>
      <b className="min-w-[64px] text-center tabular-nums">{value}{unit}</b>
      <button type="button" className="seg w-11" onClick={() => onChange(c(value + step))} aria-label="Plus" disabled={value >= max}>+</button>
    </span>
  );
}

const H = ({ children }) => <div className="px-1 pt-5 pb-2 text-[13px] font-semibold tracking-wide text-mut uppercase first:pt-1">{children}</div>;

/* Panneau « Réglages » complet */
export default function Settings() {
  const { S } = useStore();
  const st = S.set;
  const file = useRef(null);
  const [tag, setTag] = useState('');
  const [reset, setReset] = useState(0);
  const close = () => setModal(null);
  const today = todayKey();
  const since = S.lastExport ? daysBetween(S.lastExport, today) : null;

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { importJSON(r.result); toast('Données importées.'); close(); }
      catch { toast('Fichier invalide : ce n’est pas une sauvegarde Fokus.'); }
    };
    r.readAsText(f);
    e.target.value = '';
  };
  const remind = async (on) => {
    if (on) {
      const p = await askPermission();
      if (p !== 'granted') toast(p === 'unsupported' ? 'Notifications non disponibles ici (sur iPhone : ajoute Fokus à l’écran d’accueil).' : 'Notifications refusées : autorise-les dans les réglages du navigateur.', null, 5000);
    }
    return on;
  };

  return (
    <Sheet title="Réglages" onClose={close} wide>
      <H>Série et motivation</H>
      <div className="flex flex-col gap-2">
        <Line title="Seuil d’un jour réussi" desc="Un jour compte dans la série à partir de ce score.">
          <Stepper value={st.threshold} min={50} max={100} step={5} unit=" %" onChange={(v) => setSetting('threshold', v)} />
        </Line>
        <Line title="Jokers par mois" desc={`Sauvent la série un jour raté, automatiquement. Restants ce mois-ci : ${jokersLeft(S)}.`}>
          <Stepper value={st.jokers} min={0} max={10} onChange={(v) => setSetting('jokers', v)} />
        </Line>
        <Row title="Afficher la série" desc="🔥 série et record dans la carte du jour" checked={st.showStreak} onChange={(v) => setSetting('showStreak', v)} />
        <Row title="Afficher les badges" desc="Vitrine sur « Ma Progression » et message à l’obtention" checked={st.showBadges} onChange={(v) => setSetting('showBadges', v)} />
        <Row title="Tri du matin" desc="Propose de trier les tâches reportées à la première ouverture du jour" checked={st.morning} onChange={(v) => setSetting('morning', v)} />
      </div>

      <H>Score</H>
      <Line title="Poids par défaut" desc="Le score du jour = points faits / points totaux.">
        {[[1, 'Petite'], [2, 'Moyenne'], [3, 'Grosse']].map(([w, l]) => (
          <button type="button" key={w} className={'seg ' + (st.defWeight === w ? 'on' : '')} onClick={() => setSetting('defWeight', w)}>{w} · {l}</button>
        ))}
      </Line>

      <H>Minuteur de concentration</H>
      <div className="flex flex-col gap-2">
        <Line title="Concentration"><Stepper value={st.pomo} min={5} max={90} step={5} unit=" min" onChange={(v) => setSetting('pomo', v)} /></Line>
        <Line title="Pause"><Stepper value={st.pause} min={1} max={30} unit=" min" onChange={(v) => setSetting('pause', v)} /></Line>
      </div>

      <H>Rappels et notifications</H>
      <div className="flex flex-col gap-2">
        <Row title="Rappel du soir" desc="« Il te reste 3 tâches, 60 % aujourd’hui »" checked={st.remind} onChange={async (v) => setSetting('remind', await remind(v))} />
        {st.remind && (
          <Line title="Heure du rappel">
            <input type="time" className="field mini w-[120px]! flex-none!" value={st.remindAt} onChange={(e) => e.target.value && setSetting('remindAt', e.target.value)} />
          </Line>
        )}
        <Row title="Fin de session du minuteur" desc="Une notification quand la concentration ou la pause se termine" checked={st.pomoNotif} onChange={async (v) => setSetting('pomoNotif', await remind(v))} />
        <p className="px-1 text-[12.5px] leading-relaxed text-mut">
          Sur iPhone, les notifications ne fonctionnent que si Fokus est ajouté à l’écran d’accueil (Partager → « Sur l’écran d’accueil », iOS 16.4 ou plus).
          Fokus n’a pas de serveur d’envoi : les rappels partent de l’app elle-même, ils ne sont donc fiables que si elle a été ouverte récemment.
          {!canNotify() && ' Ce navigateur ne propose pas les notifications.'} La pastille sur l’icône indique les tâches restantes quand c’est disponible.
        </p>
      </div>

      <H>Animations</H>
      <div className="flex flex-col gap-2">
        <Row title="Animation de la barre" desc="Cinématique 3D à chaque validation de tâches" checked={S.anim} onChange={setAnim} />
        <Row title="Confettis à 100 %" desc="Pluie de confettis multicolores quand la journée est complétée" checked={S.confetti} onChange={setConfetti} />
      </div>

      <H>Étiquettes</H>
      <div className="flex flex-col gap-2">
        {S.tags.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2">
            <input
              className="field mini min-w-[120px] flex-1" defaultValue={g.name} maxLength={24} aria-label="Nom de l’étiquette"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) renameTag(g.id, v); else e.target.value = g.name; }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span className="flex flex-wrap gap-1">
              {PASTELS.map((c) => (
                <button type="button" key={c} className={'swatch ' + (g.color === c ? 'on' : '')} style={{ background: c }} onClick={() => recolorTag(g.id, c)} aria-label={'Couleur ' + c} />
              ))}
            </span>
            <button type="button" className="ic" onClick={() => deleteTag(g.id)} aria-label="Supprimer l’étiquette">🗑</button>
          </div>
        ))}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (addTag(tag)) setTag(''); }}>
          <input className="field" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nouvelle étiquette (ou #nom dans la saisie)" maxLength={24} />
          <button className="b on">Créer</button>
        </form>
      </div>

      <H>Données</H>
      <div className="flex flex-col gap-2">
        <Line title="Sauvegarde" desc={S.lastExport ? `Dernier export : ${since === 0 ? 'aujourd’hui' : `il y a ${since} jour${since > 1 ? 's' : ''}`}` : 'Aucun export pour l’instant'}>
          <button type="button" className="b" onClick={exportJSON}>Exporter (JSON)</button>
          <button type="button" className="b" onClick={() => file.current.click()}>Importer (JSON)</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
        </Line>
        <p className="px-1 text-[12.5px] text-mut">Une copie de secours est aussi gardée automatiquement dans le navigateur (IndexedDB).</p>
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <span className="block text-[15px] font-semibold">Réinitialiser</span>
          <span className="mb-2 block text-[13px] text-mut">Efface toutes les tâches, l’historique, les badges et les réglages. Pense à exporter avant.</span>
          {reset === 0 && <button type="button" className="b" onClick={() => setReset(1)}>Tout effacer…</button>}
          {reset === 1 && (
            <span className="flex flex-wrap gap-2">
              <button type="button" className="b" onClick={() => setReset(2)}>Oui, je veux tout effacer</button>
              <button type="button" className="b on" onClick={() => setReset(0)}>Annuler</button>
            </span>
          )}
          {reset === 2 && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[13px]">Dernière confirmation : c’est définitif.</span>
              <button type="button" className="b border-[#fca5a5]! text-[#fca5a5]" onClick={() => { resetAll(); setReset(0); }}>Effacer définitivement</button>
              <button type="button" className="b on" onClick={() => setReset(0)}>Annuler</button>
            </span>
          )}
        </div>
      </div>
    </Sheet>
  );
}
