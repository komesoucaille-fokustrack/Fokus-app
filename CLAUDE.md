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
- Toute la Page 1 bascule en perspective 3D fluide (GSAP) : les tâches/en-tête s'enfoncent (translateZ négatif + flou de profondeur de champ)
  pendant que la caméra plonge en rase-motte le long de la barre de progression.
- La scène WebGL (`src/cinematic/Scene3D.jsx`) est une surcouche transparente **alignée au pixel près** sur la carte DOM :
  la caméra Three reproduit `perspective(1100px)` et le groupe 3D reçoit la même matrice que la carte (voir `src/cinematic/engine.js`).
- **Arche d'arrivée « FOKUS 100% »** en vrai volume 3D au bout droit de la barre : `RoundedBox` biseautés, matériaux physiques
  (`meshPhysicalMaterial`, clearcoat, reflets d'environnement), texte « 100% » extrudé (`Text3D`), emplacement `.fokus-logo`,
  néons via `Bloom` (postprocessing, flou mipmap = équivalent `UnrealBloomPass`).
- Pendant que la barre avance en **bleu électrique luminescent**, de vraies étincelles 3D lumineuses jaillissent de son bord avant
  (rebond sur la piste). À 100 % : flash de l'arche, onde de choc, gerbe d'étincelles et confettis.
- Fin : la caméra revient en 2D **sans coupure**, la barre reprend sa couleur pastel de repos.
- Respecter `prefers-reduced-motion` et l'interrupteur « Animation » (sinon simple flash bleu de la barre). Bouton « Passer l'animation ».

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
- `src/cinematic/engine.js` — timeline GSAP + synchronisation DOM ↔ WebGL ; `Scene3D.jsx`, `Arch.jsx`, `Sparks.jsx` — scène 3D.
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-typeface.mjs` — régénère la police 3D `src/assets/inter-black.typeface.json`.

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
