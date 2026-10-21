import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Sheet from './Sheet';
import { BgPicker, Durations } from './Pomodoro';
import { CLOCKS } from './Clocks';
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

/* Icônes de rubrique (trait fin, cohérentes avec le reste de l'interface) */
const ICONS = {
  look: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.4-4-7.6-9-7.6z M7.5 11h.01 M10.5 7.5h.01 M15 7.5h.01',
  score: 'M4 19V9 M10 19V5 M16 19v-7 M22 19H2',
  motiv: 'M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z',
  pomo: 'M12 8v5l3 2 M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M9 2h6',
  anim: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  notif: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  tags: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  data: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
};
const SECTIONS = [
  ['look', 'Apparence'], ['score', 'Score et affichage'], ['motiv', 'Série et motivation'], ['pomo', 'Pomodoro'], ['anim', 'Animations'],
  ['notif', 'Rappels'], ['tags', 'Étiquettes'], ['data', 'Données'],
];
const Ico = ({ k }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[k]} /></svg>
);

/* Liste groupée : un bloc arrondi, des lignes séparées par un filet */
function Group({ title, foot, children }) {
  return (
    <section className="sg">
      {title && <h3 className="sg-t">{title}</h3>}
      <div className="sg-box">{children}</div>
      {foot && <p className="sg-foot">{foot}</p>}
    </section>
  );
}
function Item({ title, desc, children, col }) {
  return (
    <div className={'si ' + (col ? 'col' : '')}>
      <span className="si-l">
        <span className="si-t">{title}</span>
        {desc && <span className="si-d">{desc}</span>}
      </span>
      <span className="si-r">{children}</span>
    </div>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <label className="sw" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}
function Stepper({ value, min, max, step = 1, unit, onChange }) {
  const c = (v) => Math.min(max, Math.max(min, v));
  return (
    <span className="minf">
      <button type="button" onClick={() => onChange(c(value - step))} aria-label="Moins" disabled={value <= min}>−</button>
      <b className="grid min-w-[58px] place-items-center text-[16px] tabular-nums">{value}{unit}</b>
      <button type="button" onClick={() => onChange(c(value + step))} aria-label="Plus" disabled={value >= max}>+</button>
    </span>
  );
}
const Seg = ({ on, onClick, children }) => <button type="button" className={'seg ' + (on ? 'on' : '')} onClick={onClick}>{children}</button>;

function Score({ S }) {
  const st = S.set;
  return (
    <>
      <Group title="Score du jour" foot="Les points (1 petite, 2 moyenne, 3 grosse) font le score ; tu choisis comment il s’affiche.">
        <Item title="Affichage" desc={st.scoreMode === 'pts' ? 'Exemple : 7 pts sur 10' : 'Exemple : 70 %'}>
          <Seg on={st.scoreMode !== 'pts'} onClick={() => setSetting('scoreMode', 'pct')}>Pourcentage</Seg>
          <Seg on={st.scoreMode === 'pts'} onClick={() => setSetting('scoreMode', 'pts')}>Points</Seg>
        </Item>
        <Item title="Points par défaut" desc="Présélectionnés à l’ajout d’une tâche">
          {[1, 2, 3].map((w) => <Seg key={w} on={st.defWeight === w} onClick={() => setSetting('defWeight', w)}>{w} pt{w > 1 ? 's' : ''}</Seg>)}
        </Item>
      </Group>
      <Group title="Ordre des tâches" foot={st.order === 'auto' ? 'Automatique : priorités ★ en tête, puis 3 > 2 > 1 pt. Le glisser-déposer est désactivé.' : 'Manuel : seul l’ordre que tu choisis compte, partout. Les priorités restent signalées en or sans bouger.'}>
        <Item title="Ordre" desc="Tâches, À venir et liste du minuteur">
          <Seg on={st.order !== 'auto'} onClick={() => setSetting('order', 'manual')}>Manuel</Seg>
          <Seg on={st.order === 'auto'} onClick={() => setSetting('order', 'auto')}>Automatique</Seg>
        </Item>
      </Group>
      <Group title="Carte « Aujourd’hui » et Progression">
        <Item title="Série 🔥" desc="Série et record dans la carte du jour"><Switch label="Afficher la série" checked={st.showStreak} onChange={(v) => setSetting('showStreak', v)} /></Item>
        <Item title="Badges" desc="Vitrine sur « Ma Progression » et message à l’obtention"><Switch label="Afficher les badges" checked={st.showBadges} onChange={(v) => setSetting('showBadges', v)} /></Item>
      </Group>
    </>
  );
}

function Motiv({ S }) {
  const st = S.set;
  return (
    <>
      <Group title="Série" foot="Aucune punition : un jour sans tâche ne casse jamais la série.">
        <Item title="Jour réussi à partir de" desc="Score minimum pour compter dans la série">
          <Stepper value={st.threshold} min={50} max={100} step={5} unit=" %" onChange={(v) => setSetting('threshold', v)} />
        </Item>
        <Item title="Jokers par mois" desc={`Sauvent la série un jour raté, automatiquement · ${jokersLeft(S)} restant${jokersLeft(S) > 1 ? 's' : ''} ce mois-ci`}>
          <Stepper value={st.jokers} min={0} max={10} onChange={(v) => setSetting('jokers', v)} />
        </Item>
      </Group>
      <Group title="Rituels">
        <Item title="Tri du matin" desc="Trier les tâches reportées à la première ouverture du jour"><Switch label="Tri du matin" checked={st.morning} onChange={(v) => setSetting('morning', v)} /></Item>
      </Group>
    </>
  );
}

function Pomo({ S }) {
  const st = S.set;
  return (
    <>
      <Group title="Durées" foot="Choisis tes minutes librement, ou pars d’un préréglage.">
        <div className="si col"><Durations /></div>
        <Item title="Sessions avant la pause longue"><Stepper value={st.cycle} min={2} max={8} onChange={(v) => setSetting('cycle', v)} /></Item>
      </Group>
      <Group title="Enchaînement">
        <Item title="Lancer les pauses automatiquement"><Switch label="Pauses automatiques" checked={st.autoBreak} onChange={(v) => setSetting('autoBreak', v)} /></Item>
        <Item title="Relancer la concentration après la pause"><Switch label="Concentration automatique" checked={st.autoWork} onChange={(v) => setSetting('autoWork', v)} /></Item>
        <Item title="Son de fin" desc="Un carillon doux à la fin de chaque phase"><Switch label="Son de fin" checked={st.sound} onChange={(v) => setSetting('sound', v)} /></Item>
      </Group>
      <Group title="Apparence">
        <Item title="Style du chrono" desc="Ignoré par les fonds « Concepts », qui ont leur propre chrono">
          {CLOCKS.map(([k, l]) => <Seg key={k} on={st.clock === k} onClick={() => setSetting('clock', k)}>{l}</Seg>)}
        </Item>
        <div className="si col"><BgPicker /></div>
      </Group>
    </>
  );
}

function Anim({ S }) {
  return (
    <Group title="Validation" foot="Les deux réglages sont indépendants : les deux, un seul ou aucun.">
      <Item title="Animation de la barre" desc="Cinématique 3D à chaque validation de tâches"><Switch label="Animation de la barre" checked={S.anim} onChange={setAnim} /></Item>
      <Item title="Confettis à 100 %" desc="Pluie de confettis quand la journée est complétée"><Switch label="Confettis" checked={S.confetti} onChange={setConfetti} /></Item>
    </Group>
  );
}

function Notif({ S }) {
  const st = S.set;
  const ask = async (on) => {
    if (on) {
      const p = await askPermission();
      if (p !== 'granted') toast(p === 'unsupported' ? 'Notifications non disponibles ici (sur iPhone : ajoute Fokus à l’écran d’accueil).' : 'Notifications refusées : autorise-les dans les réglages du navigateur.', null, 5000);
    }
    return on;
  };
  return (
    <Group
      title="Notifications"
      foot={'Sur iPhone et iPad, les notifications ne fonctionnent que si Fokus est ajouté à l’écran d’accueil (Partager → « Sur l’écran d’accueil », iOS 16.4 ou plus). '
        + 'Fokus n’a pas de serveur d’envoi : les rappels partent de l’app elle-même, ils ne sont fiables que si elle a été ouverte récemment.'
        + (canNotify() ? '' : ' Ce navigateur ne propose pas les notifications.')}
    >
      <Item title="Rappel du soir" desc="« Il te reste 3 tâches, 60 % aujourd’hui »"><Switch label="Rappel du soir" checked={st.remind} onChange={async (v) => setSetting('remind', await ask(v))} /></Item>
      {st.remind && (
        <Item title="Heure du rappel">
          <input type="time" className="field mini w-[120px]! flex-none!" value={st.remindAt} onChange={(e) => e.target.value && setSetting('remindAt', e.target.value)} />
        </Item>
      )}
      <Item title="Fin de phase du Pomodoro" desc="Quand l’app est en arrière-plan"><Switch label="Notification de fin de phase" checked={st.pomoNotif} onChange={async (v) => setSetting('pomoNotif', await ask(v))} /></Item>
    </Group>
  );
}

function Tags({ S }) {
  const [tag, setTag] = useState('');
  return (
    <Group title="Mes étiquettes" foot="Astuce : tape « #nom » en ajoutant une tâche pour créer une étiquette à la volée.">
      {S.tags.map((g) => (
        <div key={g.id} className="si">
          <input
            className="field mini min-w-[120px] flex-1" defaultValue={g.name} maxLength={24} aria-label="Nom de l’étiquette" style={{ color: g.color }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) renameTag(g.id, v); else e.target.value = g.name; }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
          <span className="flex flex-wrap items-center gap-1">
            {PASTELS.map((c) => (
              <button type="button" key={c} className={'swatch ' + (g.color === c ? 'on' : '')} style={{ background: c }} onClick={() => recolorTag(g.id, c)} aria-label={'Couleur ' + c} />
            ))}
            <button type="button" className="ic" onClick={() => deleteTag(g.id)} aria-label="Supprimer l’étiquette">🗑</button>
          </span>
        </div>
      ))}
      <form className="si" onSubmit={(e) => { e.preventDefault(); if (addTag(tag)) setTag(''); }}>
        <input className="field mini flex-1" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nouvelle étiquette" maxLength={24} />
        <button className="b on">Créer</button>
      </form>
    </Group>
  );
}

function Data({ S, close }) {
  const file = useRef(null);
  const [reset, setReset] = useState(0);
  const since = S.lastExport ? daysBetween(S.lastExport, todayKey()) : null;
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
  return (
    <>
      <Group title="Sauvegarde" foot="Une copie de secours est aussi gardée automatiquement dans le navigateur (IndexedDB).">
        <Item title="Dernier export" desc={S.lastExport ? (since === 0 ? 'Aujourd’hui' : `Il y a ${since} jour${since > 1 ? 's' : ''}`) : 'Jamais'}>
          <button type="button" className="b on" onClick={exportJSON}>Exporter</button>
          <button type="button" className="b" onClick={() => file.current.click()}>Importer</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={onFile} />
        </Item>
      </Group>
      <Group title="Zone sensible">
        <Item title="Tout effacer" desc="Tâches, historique, badges et réglages. Pense à exporter avant.">
          {reset === 0 && <button type="button" className="b" onClick={() => setReset(1)}>Réinitialiser…</button>}
          {reset === 1 && (
            <>
              <button type="button" className="b" onClick={() => setReset(2)}>Oui, tout effacer</button>
              <button type="button" className="b on" onClick={() => setReset(0)}>Annuler</button>
            </>
          )}
          {reset === 2 && (
            <>
              <button type="button" className="b border-[#fca5a5]! text-[#fca5a5]" onClick={() => { resetAll(); setReset(0); }}>Effacer définitivement</button>
              <button type="button" className="b on" onClick={() => setReset(0)}>Annuler</button>
            </>
          )}
        </Item>
      </Group>
    </>
  );
}

function Look({ S }) {
  const st = S.set;
  return (
    <>
      <Group title="Ambiance de l’app" foot="Une photo ou une couleur, très floutée et assombrie, derrière toute l’interface. Elle ne ralentit pas l’app.">
        <Item title="Intensité">
          {[[1, 'Subtile'], [2, 'Moyenne'], [3, 'Intense']].map(([v, l]) => <Seg key={v} on={(st.ambLevel ?? 2) === v} onClick={() => setSetting('ambLevel', v)}>{l}</Seg>)}
        </Item>
        <div className="si col">
          <BgPicker value={st.amb} onChange={(v) => setSetting('amb', v)} extra={[['pomo', 'Comme le Pomodoro', 'linear-gradient(135deg,#2a2a30,#0c0c0e)'], ['none', 'Aucune (noir)', '#050505']]} />
        </div>
      </Group>
    </>
  );
}

const BODY = { look: Look, score: Score, motiv: Motiv, pomo: Pomo, anim: Anim, notif: Notif, tags: Tags, data: Data };

/* Panneau « Réglages » : rubriques à gauche (iPad, ordinateur) ou en haut (téléphone) */
export default function Settings() {
  const { S } = useStore();
  const [sec, setSec] = useState('look');
  const body = useRef(null);
  const close = () => setModal(null);
  useLayoutEffect(() => {
    body.current.scrollTop = 0;
    gsap.fromTo(body.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [sec]);
  const Body = BODY[sec];
  return (
    <Sheet title="Réglages" onClose={close} xl>
      <div className="set-layout">
        <nav className="set-nav" aria-label="Rubriques">
          {SECTIONS.map(([k, l]) => (
            <button key={k} type="button" className={sec === k ? 'on' : ''} onClick={() => setSec(k)} aria-current={sec === k}>
              <Ico k={k} /><span>{l}</span>
            </button>
          ))}
        </nav>
        <div className="set-body" ref={body}><Body S={S} close={close} /></div>
      </div>
    </Sheet>
  );
}
