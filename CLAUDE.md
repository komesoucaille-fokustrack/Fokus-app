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
- Séquence (~10 s, lente et lisible ; `src/cinematic/engine.js`, constantes `POSE_A`, `POSE_B`, `CAM`) :
  1. **Détourage lumineux** (`Outline.jsx`, ~0,75 s, **blanc pur très lumineux**) : deux traits de lumière font vite le tour de la carte
     (pas de laser), puis elle **se décolle** de la page (relais instantané carte DOM → carte 3D identique au pixel près).
  2. Le gel s'allume en **bleu électrique** de 0 jusqu'à l'**ancien score** (aucune couleur pastel/rouge pendant l'animation ;
     à 0 % un point bleu marque le départ de la barre).
  3. **Pose A** (visuel 1) : la carte flotte, inclinée, monte vers la droite ; la page s'enfonce et se floute ;
     l'arche gonflable se gonfle au bout de la barre ; puis **gros plan** sur le front de la barre (visuel 2).
  4. **Course** de l'ancien au nouveau score : la caméra **reste en gros plan sur le front** pendant quasiment toute la course
     (`frame` ne recule sur la carte entière qu'après 80 % du trajet). **Au fil de la progression, la carte se désincline** (`lay`)
     jusqu'à se poser à plat sur un sol mat (**pose B**, visuel 3), toujours en perspective, profondeur et arche conservées.
     **Dosage proportionnel au pourcentage validé** (table `DOSE` d'engine.js) : durée `1,6 + 4,9·√(écart)`
     (+10 % ≈ 3 s, +25 % ≈ 4 s, +50 % ≈ 5 s, +100 % ≈ 6,5 s) ; effet de vitesse très faible à +10 %, un peu à +25 %,
     légèrement plus à +50 %, plus marqué (sans excès) à +100 % ; étincelles très rares (un peu plus seulement à +100 %).
     **Effets volontairement très discrets** : ne jamais surcharger (pas de tremblement ni de recul caméra).
  5. À 100 % : passage sous l'arche, flash, petite gerbe. Puis retour en 2D **rapide (~1 s) et sans coupure** : l'arche se range,
     la carte 3D se repose exactement sur la carte DOM et la barre reprend sa couleur pastel.
- **Confettis à 100 %** (`src/lib/celebrate.js`) : pluie de confettis multicolores sur **tout l'écran** (gerbe centrale,
  canons latéraux, pluie depuis le haut), déclenchée au passage de l'arche ou directement si l'animation de la barre est coupée.
- **Paramètres** (`src/components/Settings.jsx`, icône rouage dans l'en-tête) : deux interrupteurs indépendants et persistés —
  « Animation de la barre » (`S.anim`) et « Confettis à 100 % » (`S.confetti`) : les deux, un seul ou aucun.
- **Fluidité** : gel bleu construit une seule fois et coupé par un plan de découpe (jamais de géométrie recréée par image),
  compteur sur une petite texture dédiée (la face n'est dessinée qu'une fois), flou CSS appliqué à 4 blocs seulement.
- **Légèreté** : peu de particules (max 260 étincelles, 14 traînées), `dpr` ≤ 1,5, multisampling 2 — l'animation doit rester ultra fluide sur iPad.
- La scène WebGL (`src/cinematic/Scene3D.jsx`) est une surcouche transparente : la caméra Three reproduit `perspective(1100px)`
  (œil au centre de l'écran) et le groupe 3D reçoit la même matrice CSS que la carte. Utiliser `scale3d` (jamais `scale`, qui n'agrandit pas z).
  Pas d'effet de profondeur de champ WebGL (il rend le canevas opaque) : le flou d'arrière-plan est fait en CSS sur la page.
- **Carte** (`Card3D.jsx`) : dalle extrudée biseautée, face en texture haute définition, gel bleu, halo, ombre et sol mat (pose B).
- **Arche d'arrivée gonflable** (`Arch.jsx`) réaliste, comme sur une vraie course (pas de néon) : boudin en toile à coussins
  (tube déformé entre les coutures, matériau `sheen`), socles lestés, bannière imprimée « FOKUS · FINISH 100% » (logo `.fokus-logo`),
  cordes d'ancrage ; elle se gonfle avec un rebond élastique. `Bloom` (postprocessing) réservé au gel bleu et aux étincelles.
- **Étincelles 3D** (`Sparks.jsx`) jaillissant du front de la barre. À 100 % : flash, onde de choc, gerbe d'étincelles et confettis.
- Éléments additifs : toujours le mélange `additive` de `textures.js` (n'écrit pas d'alpha → pas de traînées noires sur le canevas transparent).
- Respecter `prefers-reduced-motion` et les paramètres (barre coupée → simple flash bleu de la barre). Bouton « Passer l'animation ».
- Test visuel : `?slow=0.3` ralentit toute l'animation.

## Logique métier v2 (à préserver)

- **Modèle de données** (`src/store.js`, `version: 2`, fonction `migrate()` appliquée au chargement **et** à l'import JSON ;
  les sauvegardes de l'ancien `index.html` restent compatibles) :
  - tâche `{ id, text, done, date ('YYYY-MM-DD' | null = Plus tard), weight 1|2|3, prio, tags[], subs[{id,text,done}], carried, focus (min), rid? }` ;
  - récurrence `{ id, text, rule {type: daily|weekdays(days)|interval(every)|monthday(day)}, start, weight, tags, prio, last }` —
    `last` + « pas de nouvelle occurrence tant que la précédente n'est pas faite » = jamais de doublon ;
  - historique `hist[jour] = { p, d, t, pd, pt, pr, prt, fm, tg, jk? }` ; réglages `S.set` (`DEF_SET`) ; `badges`, `doneTotal`, `fmDay`,
    `lastExport`, `since`, `seen` (tri du matin, bilan, rappels), `pomo` (minuteur en cours, calculé par horodatages).
- **Score par points** : % du jour = points faits / points totaux des tâches du jour (date ≤ aujourd'hui). La Page 1 n'affiche que ces tâches :
  priorités ★ (3 max par jour) en tête avec liseré blanc, puis l'ordre choisi (ordre du tableau, respecté partout ; le glisser-déposer
  déplace relativement à la tâche visée). Filtre par étiquette au-dessus de la liste.
- Validation : gros bouton flottant (gain par points en vert pastel `#86efac`), puis toast « X tâche(s) validée(s) — Annuler » (6 s, après
  l'animation) ; ↺ décoche une tâche terminée ; « Annuler » après suppression. Textes de la carte : `cardText()` (partagé avec la face 3D :
  `subText` + mise à jour du nœud texte du libellé avant `race`). Si la carte est hors écran, la page remonte avant l'animation.
- Panneau d'options au tap sur une tâche : date (Aujourd'hui / Demain / Choisir / Plus tard), poids, priorité, étiquettes, sous-tâches,
  minuteur ▶. Saisie rapide (`src/lib/quickAdd.js`) : demain, lundi…, 25/10, #tag, !/!!/!!!, * — surlignés pendant la frappe.
- Minuit (00:00) : entrée d'historique complète ; tâches faites retirées ; non faites reportées (`carried` + 1, badge « reportée N× » dès 2) ;
  tâches datées du jour affichées ; récurrences du jour ; jokers (2/mois, réglable) ; badges. Tri du matin à la 1re ouverture s'il y a des
  reports ; bilan de la semaine à la 1re ouverture de la semaine. Jours sans tâche = neutres pour la série ; série hebdo = ≥ 5 jours réussis.
- Fiabilité : `navigator.storage.persist()`, copie IndexedDB restaurée si le localStorage est vide (`src/lib/backup.js`, démarrage
  asynchrone dans `main.jsx`), rappel d'export tous les 7 jours. Notifications locales / pastille / vibration : `src/lib/notify.js`.
- Page 2 « Ma Progression » : Chart.js, vraie courbe continue (`spanGaps: true`, `tension: 0.4`, `fill: true`) + points, couleur de la moyenne
  de la période (Semaine / Mois / Année) ; concentration et série ; répartition par étiquette ; calendrier de chaleur 12 mois ; vitrine de badges.
- PWA : `pwa/sw.js` → `dist/sw.js` généré au build (liste des fichiers + version) par le plugin de `vite.config.js` ; bandeau « Nouvelle version ».
- Mode test : « Simuler minuit » (dates, reports, récurrences, séries, jokers, tri du matin) et « Générer données test » (365 jours complets
  + tâches d'exemple).
- Raccourcis : N, /, Entrée, Échap. Interface en français, mobile d'abord (cibles ≥ 44 px, pas de défilement horizontal).

## Arborescence

- `src/store.js` — état, migration, persistance, changement de jour, séries, jokers, badges, minuteur, actions.
- `src/components/` — `Header`, `ProgressCard`, `QuickAdd`, `TaskList` (+ panneau d'options), `Upcoming` (À venir), `ValidateButton`,
  `RecurringModal`, `Settings` (réglages complets), `Search`, `MorningTriage`, `WeeklyReview`, `FocusMode`, `StatsPage`, `Sheet` (modale).
- `src/lib/` — `colors`, `celebrate`, `dates`, `quickAdd`, `backup`, `notify`.
- `src/cinematic/engine.js` — timeline GSAP + caméra de poursuite ; `Scene3D.jsx`, `Card3D.jsx`, `Outline.jsx`, `Arch.jsx`, `Sparks.jsx`,
  `SpeedLines.jsx` — scène 3D (**l'utilisateur a validé l'animation : ne plus la modifier**).
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-typeface.mjs` — régénère la police 3D `src/assets/inter-black.typeface.json`.

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
