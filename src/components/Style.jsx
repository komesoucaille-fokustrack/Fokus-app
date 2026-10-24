import { useState } from 'react';
import { METEO, applyStyle, markSeen, meteoOf, setMood, setSetting, toast, useStore } from '../store';

/* =====================================================================
   MON STYLE — « À fond » (suivi complet qui pousse) ou « Tranquille » (sans pression, à son rythme)
   + MÉTÉO DU JOUR : l'objectif du jour s'adapte à l'énergie (☀️ 100 %, ⛅ 80 %, 🌧️ 60 %, 🌙 40 %).
   Choisi à l'inscription (Intro), par une carte unique sur la page Tâches (seen.style), ou dans Réglages → Mon style.
   ===================================================================== */
export const STYLES = [
  ['fokus', '🎯', 'À fond', 'Pour te pousser : points, pourcentage du jour, série 🔥, jokers, tri du matin et bilan du soir.'],
  ['zen', '🌿', 'Tranquille', 'Sans pression : pas de pourcentage, pas de série, aucun écran imposé. Juste ce que tu as fait, à ton rythme, en couleurs douces.'],
];

export function StylePicker({ value, onPick }) {
  return (
    <div className="style-pick" role="radiogroup" aria-label="Mon style">
      {STYLES.map(([id, e, name, desc]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={'style-b ' + id + (value === id ? ' on' : '')} onClick={() => onPick(id)}>
          <span className="style-e" aria-hidden="true">{e}</span>
          <b>{name}</b>
          <span>{desc}</span>
        </button>
      ))}
    </div>
  );
}

/* Carte unique sur la page Tâches pour les comptes existants (une seule fois) */
export function StyleCard() {
  const { S } = useStore();
  if (S.seen.style) return null;
  const pick = (id) => {
    applyStyle(id);
    toast(id === 'zen' ? 'Mode Tranquille 🌿 : à ton rythme, sans pression.' : 'Mode À fond 🎯 : on garde le suivi complet.', null, 4000);
  };
  return (
    <div className="card style-card">
      <b className="style-card-t">Nouveau ✨ Choisis ton style</b>
      <p>Chacun avance à sa façon. Tu pourras changer quand tu veux dans Réglages → Mon style.</p>
      <StylePicker value={null} onPick={pick} />
      <p className="style-meteo">Et chaque matin, dis-nous ta <b>météo du jour</b> ☀️⛅🌧️🌙 : ton objectif s’adapte à ton énergie.</p>
      <button type="button" className="style-later" onClick={() => markSeen('style', 1)}>Garder comme avant</button>
    </div>
  );
}

const TOASTS = {
  sun: 'Pleine forme ☀️ Objectif plein, à fond !',
  cloud: 'Objectif ajusté à 80 % ⛅ Ce qui dépasse, c’est du bonus ✨',
  rain: 'Objectif ajusté à 60 % 🌧️ Doucement mais sûrement.',
  moon: 'Journée douce 🌙 40 % suffisent pour réussir ta journée. Prends soin de toi.',
};
/* Météo du jour (page Tâches, sous la salutation) : question tant qu'elle n'est pas choisie, puis une pastille */
export function Meteo({ S }) {
  const m = meteoOf(S);
  const [open, setOpen] = useState(false);
  if (S.set.meteo === false) return null;
  if (m && !open) {
    return (
      <button type="button" className="meteo-chip" onClick={() => setOpen(true)} title="Changer la météo du jour">
        <span aria-hidden="true">{m[1]}</span> {m[2]}{m[3] < 1 ? ` · objectif ${Math.round(m[3] * 100)} %` : ' · objectif plein'}
      </button>
    );
  }
  const pick = (id) => { setMood(id); setOpen(false); toast(TOASTS[id], null, 4200); };
  return (
    <div className="meteo">
      <span className="meteo-q">{m ? 'Ta météo du jour' : 'Comment tu te sens aujourd’hui ?'} <i>ton objectif s’adapte à ton énergie</i></span>
      <div className="meteo-row">
        {METEO.map(([id, e, l, f]) => (
          <button key={id} type="button" className={'meteo-b' + (m?.[0] === id ? ' on' : '')} onClick={() => pick(id)} aria-pressed={m?.[0] === id}>
            <span aria-hidden="true">{e}</span><b>{l}</b><i>{f < 1 ? `objectif ${Math.round(f * 100)} %` : 'objectif plein'}</i>
          </button>
        ))}
      </div>
      {m && <button type="button" className="meteo-x" onClick={() => setOpen(false)}>Fermer</button>}
    </div>
  );
}

/* Réglages → Mon style */
export function StyleSettings({ S, Group, Item, Switch }) {
  const st = S.set;
  return (
    <>
      <Group title="Mon style" foot="Changer de style règle les écrans qui vont avec (série, tri du matin, bilan du soir) ; tu peux ensuite ajuster chaque réglage dans les autres rubriques.">
        <div className="si col">
          <StylePicker value={st.style === 'zen' ? 'zen' : 'fokus'} onPick={(id) => { applyStyle(id); toast(id === 'zen' ? 'Mode Tranquille 🌿' : 'Mode À fond 🎯'); }} />
        </div>
      </Group>
      <Group title="Météo du jour" foot="☀️ En forme = objectif plein · ⛅ Ça va = 80 % · 🌧️ Fatigué·e = 60 % · 🌙 Besoin de repos = 40 %. Au-delà de l’objectif, chaque tâche compte en bonus ✨. La série suit l’objectif ajusté : un jour sans énergie ne casse rien.">
        <Item title="Demander ma météo chaque jour" desc="Une question rapide en haut de la page Tâches">
          <Switch label="Météo du jour" checked={st.meteo !== false} onChange={(v) => setSetting('meteo', v)} />
        </Item>
      </Group>
    </>
  );
}
