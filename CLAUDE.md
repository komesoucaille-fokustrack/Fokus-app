# CLAUDE.md — Règles d'or du projet Fokus

Fokus est une application de tâches quotidiennes + suivi de performance. L'utilisateur travaille **uniquement depuis un iPad** :
Claude gère 100 % du code, des builds et du déploiement. Chaque push sur `main` est publié automatiquement sur GitHub Pages
(`.github/workflows/deploy.yml`). Ne jamais casser le build : lancer `npm run build` avant chaque push.

## Stack (obligatoire)

- **Vite + React** (JSX, pas de TypeScript), **Tailwind CSS v4** via `@tailwindcss/vite` (jetons dans `@theme` de `src/index.css`).
- **Three.js** : `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- **`gsap`** (toute la chorégraphie et les micro-interactions), **`chart.js`** (Page 2), **`canvas-confetti`**.
- Police **Inter** embarquée (`@fontsource-variable/inter`), chiffres toujours en `tabular-nums`.
- `vite.config.js` garde `base: './'` (chemins relatifs, indispensable pour GitHub Pages).

## Design Ultra-Premium Noir & Blanc

- Fonds multicouches : `#050505` (page) → `#0c0c0e` (conteneurs) → `#121215` (cartes) → `#1a1a1f` (survol).
- Bordures spéculaires brillantes : `rgba(255,255,255,0.1)` + reflet interne `inset 0 1px 0 rgba(255,255,255,.14)`.
- Typographie Inter, `tabular-nums` sur tous les chiffres. Accents de couleur uniquement pour la progression (pastels) et l'animation (bleu électrique).
- Courbes d'animation « spring » : `cubic-bezier(.22,1,.36,1)`. Tout doit rester fluide sur iPad (Safari, tactile, 60 fps).

## Barre de progression (Page 1) — dégradés pastel par palier

| Palier | Dégradé |
|---|---|
| 0–20 % | Rouge corail |
| 20–40 % | Rouge → Orange |
| 40–55 % | Orange doux |
| 55–75 % | Orange → Jaune |
| 75–90 % | Fond de jaune → Vert émeraude foncé |
| 90–100 % | Dégradé de verts → vert menthe lumineux |

Source unique : `src/lib/colors.js` (`gradFor`, `getColorForPercentage`).

## Animation 3D cinématographique « In-Place » (au clic sur « Valider »)

- **Interdit** : écran noir séparé, page dédiée, ou animation en Canvas 2D plat. L'interface de la Page 1 reste exactement la même.
- **Référence visuelle** : la carte « Aujourd'hui » devient une dalle 3D épaisse et flottante (tranche biseautée brillante, ombre portée),
  la barre est un **gel lumineux en relief** ; plan large incliné puis gros plan sur le début de la barre (cf. visuels fournis).
- Séquence (`src/cinematic/engine.js`, constantes `CAM`, `FLAT_AT`) :
  1. **Détourage lumineux** (`Outline.jsx`) : deux traits de lumière glissent en douceur le long du contour de la carte
     (pas de laser ni d'étincelles), puis elle **se décolle** de la page
     (relais instantané carte DOM → carte 3D identique au pixel près, la face est redessinée depuis les mesures du DOM).
  2. **Plan large** : la carte flotte, inclinée (monte vers la droite) ; la page s'enfonce et se floute ; l'arche gonflable se gonfle au bout de la barre.
  3. **Zoom progressif sur le front de la barre** (à l'ancien score).
  4. Le gel s'illumine en **bleu électrique** directement jusqu'à l'**ancien score** (ex. 50 %), puis avance jusqu'au **nouveau** ;
     la caméra suit le front de près (la carte glisse en sens inverse). **Effet de vitesse proportionnel à l'écart** :
     durée `0.85 + 1.5·√(écart)`, traînées (`SpeedLines.jsx`), étincelles plus nombreuses, léger tremblement/recul caméra.
     Plus la course avance, plus la carte **redescend** : à plat à `FLAT_AT` (62 % du trajet ancien → nouveau score),
     même perspective, puis on retrouve simplement la page et la barre finit sa course en place (flash à 100 %).
  5. Fin en 2D **sans coupure** : la carte 3D se repose exactement sur la carte DOM, la barre reprend sa couleur pastel.
- La scène WebGL (`src/cinematic/Scene3D.jsx`) est une surcouche transparente : la caméra Three reproduit `perspective(1100px)`
  (œil au centre de l'écran) et le groupe 3D reçoit la même matrice CSS que la carte. Utiliser `scale3d` (jamais `scale`, qui n'agrandit pas z).
  Pas d'effet de profondeur de champ WebGL (il rend le canevas opaque) : le flou d'arrière-plan est fait en CSS sur la page.
- **Carte** (`Card3D.jsx`) : dalle extrudée biseautée, face en texture haute définition, gels pastel puis bleu, halo et ombre.
- **Arche d'arrivée gonflable** (`Arch.jsx`) réaliste, comme sur une vraie course (pas de néon) : boudin en toile à coussins
  (tube déformé entre les coutures, matériau `sheen`), socles lestés, bannière imprimée « FOKUS · FINISH 100% » (logo `.fokus-logo`),
  cordes d'ancrage ; elle se gonfle avec un rebond élastique. `Bloom` (postprocessing) réservé au gel bleu et aux étincelles.
- **Étincelles 3D** (`Sparks.jsx`) jaillissant du front de la barre. À 100 % : flash, onde de choc, gerbe d'étincelles et confettis.
- Éléments additifs : toujours le mélange `additive` de `textures.js` (n'écrit pas d'alpha → pas de traînées noires sur le canevas transparent).
- Respecter `prefers-reduced-motion` et l'interrupteur « Animation » (sinon simple flash bleu de la barre). Bouton « Passer l'animation ».
- Test visuel : `?slow=0.3` ralentit toute l'animation.

## Logique métier (à préserver)

- Tâches : ajout, modification, suppression, sélection multiple + validation via le gros bouton flottant (Dynamic Island),
  réorganisation ⏫ ▲ ▼ ⏬ (+ glisser-déposer), tâches récurrentes.
- Minuit (00:00) : score du jour → historique ; tâches `done: true` retirées ; tâches `done: false` reportées au lendemain ;
  tâches récurrentes ajoutées. Boutons de test « Simuler minuit » et « Générer données test » conservés.
- Page 2 « Ma Progression » : Chart.js, vraie courbe continue (`spanGaps: true`, `tension: 0.4`, `fill: true`) + points,
  toute la courbe prend la couleur de la moyenne de la période (Semaine / Mois / Année).
- Persistance `localStorage` clé `focus_state` ; Export/Import JSON compatible avec l'ancien `index.html`.

## Arborescence

- `src/store.js` — état, persistance, changement de jour, actions.
- `src/components/` — UI (en-tête, carte de progression, liste, bouton flottant, modale, statistiques).
- `src/cinematic/engine.js` — timeline GSAP + caméra de poursuite ; `Scene3D.jsx`, `Card3D.jsx`, `Outline.jsx`, `Arch.jsx`, `Sparks.jsx`, `SpeedLines.jsx` — scène 3D.
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-typeface.mjs` — régénère la police 3D `src/assets/inter-black.typeface.json`.

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
