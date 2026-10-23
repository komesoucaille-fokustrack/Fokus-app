import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import FokusLogo from './FokusLogo';
import { dismissIntro, useCloud } from '../lib/cloud';

/* =====================================================================
   BIENVENUE — juste après l'inscription (prénom, nom, pseudo, âge), avant d'entrer dans l'app :
   message d'encouragement + le principe de Fokus en 5 étapes. Une seule fois par compte (m.intro).
   ===================================================================== */
const STEPS = [
  ['✍️', 'Écris tes tâches du jour', 'Donne-leur 1, 2 ou 3 points selon leur importance, et marque jusqu’à 3 priorités ★. Une tâche, même petite, c’est déjà un pas.'],
  ['✅', 'Coche, puis touche «\u00a0Valider\u00a0»', 'Ta barre de progression avance en 3D sous tes yeux. À 100 %, tu passes l’arche d’arrivée sous les confettis 🎊'],
  ['⏱️', 'Concentre-toi', 'Le minuteur Pomodoro t’aide à rester focus : une session à la fois, sans pression, et chaque minute compte.'],
  ['🔥', 'Construis ta série', 'Chaque journée réussie allonge ta série. 90 badges t’attendent, du premier pas jusqu’aux records.'],
  ['🌙', 'Le soir, fais le point', 'En une minute, regarde ce que tu as accompli et prépare demain l’esprit léger.'],
];

export default function Intro() {
  const { user = {} } = useCloud();
  const card = useRef(null);
  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(card.current, { y: 18, opacity: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
      gsap.from('.intro-step', { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.09, delay: 0.25, clearProps: 'transform,opacity' });
    }, card);
    return () => ctx.revert();
  }, []);
  return (
    <main className="login" style={{ backgroundImage: `url(theme/obsidienne-${innerWidth > innerHeight ? 'L' : 'P'}.webp)` }}>
      <div className="login-card intro" ref={card}>
        <FokusLogo />
        <h1>Bienvenue dans l’équipe, {user.pseudo || user.first} 🎉</h1>
        <p className="login-lead">Tu viens de faire le premier pas, et c’est souvent le plus dur. <b>Bravo&nbsp;!</b> Fokus est là pour t’aider à avancer un peu chaque jour… et surtout à le voir.</p>
        <ol className="intro-steps">
          {STEPS.map(([e, t, d]) => (
            <li key={t} className="intro-step">
              <span className="intro-e" aria-hidden="true">{e}</span>
              <span><b>{t}</b><span>{d}</span></span>
            </li>
          ))}
        </ol>
        <p className="intro-quote">Pas besoin d’être parfait : vise juste un peu mieux qu’hier. Les petits pas, répétés chaque jour, mènent très loin. 💚</p>
        <button type="button" className="b on login-go intro-go" onClick={dismissIntro}>C’est parti ! 🚀</button>
      </div>
    </main>
  );
}
