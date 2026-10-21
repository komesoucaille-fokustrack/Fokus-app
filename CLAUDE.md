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
- **Caméra de poursuite à la 3e personne** (`src/cinematic/engine.js`, constantes `CHASE`) :
  1. Le bloc de progression **se détache** de la carte (relais instantané barre DOM → piste 3D alignée au pixel près) ;
     le reste de la page s'enfonce (translateZ négatif + flou de profondeur de champ).
  2. La caméra plonge et **zoome sur le 0 %** : vue rasante derrière la barre, inclinée pour voir la **ligne d'arrivée au fond**.
  3. La piste s'illumine (rails néon, repères 10 %…90 %), puis la barre **bleu électrique** avance jusqu'au **pourcentage exact** ;
     le bloc glisse en sens inverse pour que la caméra **suive le front de près, zoom constant**. Compteur (HUD) qui accompagne le front.
  4. Retour en 2D **sans coupure** : la piste 3D se repose exactement sur la barre DOM, qui reprend sa couleur pastel.
- La scène WebGL (`src/cinematic/Scene3D.jsx`) est une surcouche transparente : la caméra Three reproduit `perspective(1100px)`
  (œil au centre de l'écran) et le groupe 3D reçoit la même matrice CSS que le bloc. Utiliser `scale3d` (jamais `scale`, qui n'agrandit pas z).
- **Piste** (`Track.jsx`) : piste extrudée, sol à grille avec fondu vers le noir, reflet bleu sous la tête, rails et repères qui s'allument.
- **Arche d'arrivée « FOKUS 100% »** (`Arch.jsx`) en vrai volume 3D au bout de la piste, face à la caméra : `RoundedBox` biseautés,
  matériaux physiques (`meshPhysicalMaterial`, clearcoat, reflets d'environnement), texte « 100% » extrudé (`Text3D`), logo `.fokus-logo`,
  néons via `Bloom` (postprocessing, flou mipmap = équivalent `UnrealBloomPass`).
- **Étincelles 3D** (`Sparks.jsx`) jaillissant du front de la barre (rebond sur la piste). À 100 % : passage sous l'arche,
  flash, onde de choc, gerbe d'étincelles et confettis.
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
- `src/cinematic/engine.js` — timeline GSAP + caméra de poursuite ; `Scene3D.jsx`, `Track.jsx`, `Arch.jsx`, `Sparks.jsx` — scène 3D.
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-typeface.mjs` — régénère la police 3D `src/assets/inter-black.typeface.json`.

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
