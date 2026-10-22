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

## Design Ultra-Premium Noir & Blanc — thème « Obsidienne » (v3)

- **Palette en jetons** dans `@theme` (`src/index.css`) : fonds `--color-bg-1` `#050608` (page) → `bg-2` `#0b0c10` (conteneurs) →
  `bg-3` `#121318` (cartes opaques) → `bg-4` `#1a1b21` (survol) ; verre `--color-glass` `rgba(14,15,19,.64)` / `glass-hi` ;
  bordures `--color-edge` (`rgba(255,255,255,.09)`) / `edge-hi` ; texte `--color-text` `#f5f6f8` et `--color-text-2` `#a7abb4`
  (= `--color-mut`) ; accents `#93c5fd` / `#86efac` ; or des priorités `--color-gold`. Les anciens jetons (`ink`, `cont`, `card`, `hov`, `mut`)
  pointent sur ces valeurs. **Contraste du texte ≥ 4,5:1 partout** (mesuré : ≥ 6,9:1 au point le plus clair du fond).
- **Ambiance par défaut « Obsidienne »** (`t-obsidienne`, `Ambiance.jsx`) : noir profond aux reflets bleu nuit, émeraude et ambre.
  `migrate()` bascule une seule fois l'ancien défaut `p12` vers Obsidienne (`seen.thm`). Graphite lunaire et Ambre fumé + toutes les
  ambiances photo / dégradé restent au choix (Réglages → Apparence). Pomodoro : fond par défaut Obsidienne aussi.
- **Règle d'or « rien ne bouge »** : fonds = images **pré-calculées** (`public/theme/*-L.webp` / `-P.webp`, lumière diffuse et grain
  rendus à l'avance par `scripts/make-themes.py` ; photos = vignettes déjà floutées `-amb.webp`). Calque `.amb` fixe,
  `transform: translateZ(0)`, `contain: strict`, couleur moyenne posée en attendant l'image. **Jamais** de `filter: blur()`, de
  `backdrop-filter` plein écran (voile des feuilles = simple noir 75 %), de dégradé animé, de parallaxe. `backdrop-filter` réservé à
  l'en-tête, aux toasts et aux boutons du minuteur ; coupé sous `prefers-reduced-transparency` / `prefers-reduced-motion`.
- **Cartes en verre fumé** (`.task`, `.card`, `.daystrip`…) : reflet en haut + liseré spéculaire `inset 0 1px 0 rgba(255,255,255,.13)`
  + ombre fixe ; priorités : filet or à gauche. Carte du jour `#pcard` **toujours opaque `#121215`** (= face 3D de `Card3D.jsx`, relais pixel).
- **Seule zone « wow »** : la lumière `.aura` derrière la carte du jour, dégradé radial (sans filtre) de la couleur de la progression.
- **Logo** (kit source dans `brand/`) : anneau de progression vert (`#059669 → #10b981 → #86efac`) + logotype « FOKUS » dont le O est
  l'anneau ; `FokusLogo.jsx` (en-tête) et bannière de l'arche (mêmes tracés `LOGO_SVG`) ; icônes `public/icon*.png`, `favicon*`.
  `theme_color` / `background_color` `#050608` ; écrans de démarrage iPad/iPhone `public/splash/` (`scripts/make-splash.py`).
- Typographie Inter, `tabular-nums` sur tous les chiffres. Accents de couleur : progression (pastels), animation (bleu électrique),
  priorités (or), points (pastels discrets). En-tête éditorial `Hello.jsx` (date, salutation, résumé), navigation en pastille glissante (`.navseg`/`.navind`).
- Courbes d'animation « spring » : `cubic-bezier(.22,1,.36,1)`. Tout doit rester fluide sur iPad (Safari, tactile, 60 fps) — mesuré :
  30 tâches, profil iPad Retina, processeur ×4 plus lent : 60 i/s, aucune image > 25 ms, CLS 0.

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

## Logique métier v3 (à préserver)

- **Modèle de données** (`src/store.js`, `version: 3`, fonction `migrate()` appliquée au chargement **et** à l'import JSON ;
  les sauvegardes v2 et de l'ancien `index.html` restent compatibles ; toute évolution passe par `migrate()`) :
  - tâche `{ id, text, done, date ('YYYY-MM-DD' | null = Plus tard), weight 1|2|3, prio, tags[], subs[{id,text,done}], carried, focus (min),
    est (pomodoros), time ('HH:MM' | null), dur (min | null), rid? }` ;
  - `sessions` = journal compact `[début s, durée s, tâche, 'c'|'f', terminée, [étiquettes], titre]` (purge > 2 ans) ;
    `ideas` = bloc-notes de distractions ; `pushId` = identifiant aléatoire de l'appareil pour le serveur de notifications ;
  - récurrence `{ id, text, rule {type: daily|weekdays(days)|interval(every)|monthday(day)}, start, weight, tags, prio, last }` —
    `last` + « pas de nouvelle occurrence tant que la précédente n'est pas faite » = jamais de doublon ;
  - historique `hist[jour] = { p, d, t, pd, pt, pr, prt, fm, ps, tg, jk?, ea? }` (ea = [min estimées, min réelles]) ; réglages `S.set` (`DEF_SET`) ; `badges`, `doneTotal`, `fmDay`,
    `lastExport`, `since`, `seen` (tri du matin, bilan, rappels), `pomo` (minuteur en cours, calculé par horodatages).
- **Ordre des tâches** : réglage `set.order` « Manuel » (défaut : seul l'ordre choisi compte, partout ; ★ propose « Remonter en tête »)
  ou « Automatique » (`sortTasks` : priorités puis 3 > 2 > 1 pt ; poignée désactivée avec explication).
- **Score par points** : % du jour = points faits / points totaux des tâches du jour (date ≤ aujourd'hui). Réglage `set.scoreMode` :
  `'pct'` (pourcentage, défaut) ou `'pts'` (« 7 pts », sous-titre « sur 10 pts », bouton « +3 pts ») — `scoreFmt()` sert aussi au compteur
  de l'animation (`race(..., { fmt })`, seul ajout fait au moteur, visuel inchangé). La Page 1 n'affiche que les tâches du jour, triées par
  `sortTasks` : priorités ★ en **or** (`--gold`, 3 max par jour) en tête, puis 3 pts > 2 pts > 1 pt, puis l'ordre choisi (tri stable ;
  même tri dans « À venir », en mode Automatique). Filtre par étiquette au-dessus de la liste.
- **Ajout** (`QuickAdd`) : points 1/2/3 et ★ Priorité choisis directement sous le champ ; bouton « ↻ Récurrence » à côté d'« Ajouter »
  (tous les jours / tous les X jours / certains jours / un jour du mois + liste des récurrences). Plus d'onglet « Récurrentes » dans l'en-tête.
- **Onglet Pomodoro** (`Pomodoro.jsx`, page 4) : concentration / pause courte / pause longue (tous les N cycles), démarrage auto,
  carillon (`lib/sound.js`), tâche liée (temps crédité à la tâche et au jour), sessions du jour (`pomoDay`, `hist.ps`), écran gardé allumé
  (Wake Lock), plein écran (commandes masquées après 3 s, mode « Heure »). Chronos (`Clocks.jsx`) : Classique, Flip (palettes qui tournent),
  Anneau, Minimal. Fonds (`lib/backgrounds.js`, groupes Concepts / Photos / Dégradés) choisis dans l'onglet ou les Réglages :
  **Concepts** (`Concepts.jsx`, 100 % vectoriels donc nets en 4K, le temps fait partie du décor) : Affiche GT (le « 911 » remplacé par le
  chrono en Oswald ton sur ton, voiture détourée `public/bg/gt-car.webp`), Bauhaus, Horizon (soleil qui se couche avec la session),
  Marée (niveau qui monte, chrono en `mix-blend-mode: difference`), Topographie. **Photos** : uniquement en haute définition —
  22 photos (Salon orange, GT verte + 20 photos Unsplash `p01`…`p20`, licence libre, crédit affiché) en WebP : paysage 2560 px (`-L`),
  portrait 1290×2796 recadré (`-P`, via `<picture>`), vignette `-mini.jpg` ; même DA (intérieurs mid-century chauds, vert profond,
  noir et blanc, brume, voitures, horloges à palettes). Jamais de captures d'écran floues. Durées en minutes libres (`MinuteField`) + préréglages.
  Le minuteur avance partout dans l'app (`usePomodoro` dans App, temps restant dans l'onglet et le titre).
  v3 : mode **Libre** (Flowtime, `set.pomoMode`, pause = 1/`flowRatio` du temps fait), **aucune punition** (pause, réinitialisation,
  fermeture : le temps fait est toujours crédité), estimation en pomodoros (« ~3 », « 🍅 2/3 »), **sons d'ambiance** (`lib/ambient.js` :
  bruits brun/blanc générés, pluie/café/forêt en boucles libres `public/sounds/*.m4a`, fondus, coupure en pause), **idées notées**
  pendant la session (revues à la pause), statistiques de concentration (`FocusStats.jsx`).
- **Ma journée** (phase 3) : bascule Liste / **Chronologie** (`Timeline.jsx`, 6 h → 24 h, ligne « maintenant », blocs glissables par appui
  long, redimensionnables, « À caser », chevauchements), bandeau `DayStrip` « Estimé · Fait » + alerte de surcharge (`set.capacity`,
  `Overload.jsx`), **rituel du soir** `EveningRitual.jsx` (3 écrans ; tri du matin sauté si tout est trié ; `set.evening`, `eveningAt`).
- **Saisie rapide** v3 : « de demain », « le lundi » et les fractions (1/2, 3/4) ne sont pas des dates ; `~3` = estimation ;
  `14h30`, `14:30`, `à 9h` = heure ; un tap sur un mot surligné annule sa détection.
- **Notifications Web Push** (`lib/push.js`, `lib/pushSync.js`, `pwa/sw.js`) : fin de phase programmée quand l'app passe en arrière-plan
  et annulée à son retour (jamais de doublon), rappel du soir quotidien mis à jour à chaque changement de liste ; serveur `server/`.
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
- Mode test (à garder tel quel, en bas de la page Tâches) : « Simuler minuit » (dates, reports, récurrences, séries, jokers, tri du matin) et « Générer données test » (365 jours complets
  + sessions, estimations, heures, idées notées et tâches d'exemple).
- Réglages (`Settings.jsx`) : rubriques (Apparence, Score et affichage, Ma journée, Série et motivation, Pomodoro, Animations, Rappels,
  Étiquettes, Données)
  en colonne à gauche (iPad) ou en puces (téléphone), listes groupées façon iOS (`.sg`, `.si`).
- Fluidité : grain = petite texture `public/noise.png` en mosaïque (jamais de filtre SVG plein écran), animations des décors
  par `transform` (composité), pas de transition sur les tracés SVG.
- Raccourcis : N, /, Entrée, Échap. Interface en français, mobile d'abord (cibles ≥ 44 px, pas de défilement horizontal).

## Arborescence

- `src/store.js` — état, migration, persistance, changement de jour, séries, jokers, badges, minuteur, actions.
- `src/components/` — `Header`, `ProgressCard`, `QuickAdd`, `TaskList` (+ panneau d'options), `Upcoming` (À venir), `ValidateButton`,
  `Settings` (réglages complets), `Search`, `MorningTriage`, `WeeklyReview`, `Pomodoro` + `Clocks` + `Concepts`, `StatsPage` + `FocusStats`,
  `Timeline`, `DayStrip`, `Overload`, `EveningRitual`, `Hello`, `Ambiance`, `Sheet` (modale).
- `src/lib/` — `colors`, `celebrate`, `dates`, `quickAdd`, `backup`, `notify`, `sound`, `ambient`, `backgrounds`, `push`, `pushSync`.
- `server/` — Worker Cloudflare `fokus-push` (Durable Objects `User` = une alarme par notification, `Keys` = clés VAPID générées
  au premier appel) ; chiffrement Web Push sans dépendance (`src/webpush.js`, testé contre `http_ece` : `npm test`).
  Déployé par `.github/workflows/push-server.yml` (secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
  Adresse dans `src/push-config.js` (ou Réglages → Rappels → Avancé). Ne stocke que l'abonnement, l'heure et le texte.
- `src/cinematic/engine.js` — timeline GSAP + caméra de poursuite ; `Scene3D.jsx`, `Card3D.jsx`, `Outline.jsx`, `Arch.jsx`, `Sparks.jsx`,
  `SpeedLines.jsx` — scène 3D (**l'utilisateur a validé l'animation : ne plus la modifier**).
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-themes.py` (fonds des thèmes), `scripts/make-splash.py` (écrans de démarrage), `brand/` (kit du logo).

- **Gratuit et sans limite** : aucune durée maximale, aucune fonction bloquée, aucune publicité.

## Idées pour plus tard (à rediscuter avec l'utilisateur)

- Catégories de tâches (sport, travail, devoirs…), distinctes ou évoluées à partir des étiquettes.

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
