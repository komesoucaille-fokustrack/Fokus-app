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
- **Photo nette** (`set.ambSharp`, défaut) : la vraie photo HD derrière l'app, voile uniforme selon l'intensité (Intense = aucun),
  jamais de dégradé ni de flou ; textes posés sur le fond ombrés (`body.amb-photo`). Photos classées (`sub`, `PHOTO_SUBS` : Rose & doux,
  Ville, Mer & plages, Nature, Cosy, Rétro & voitures ; 35 nouvelles `q01`…`q35`) ; dégradés « Rose baddie », Pêche, Lilas, Nuit rose.
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
- **Fenêtres** (`Sheet.jsx`) : la page derrière est figée (corps en position fixe, en-tête gardé en place, retour au même endroit).
- **Seule zone « wow »** : la lumière `.aura` derrière la carte du jour, dégradé radial (sans filtre) de la couleur de la progression.
- **Logo** (kit source dans `brand/`) : anneau de progression vert (`#059669 → #10b981 → #86efac`) + logotype « FOKUS » dont le O est
  l'anneau ; `FokusLogo.jsx` (en-tête) et bannière de l'arche (mêmes tracés `LOGO_SVG`) ; icônes `public/icon*.png`, `favicon*`.
  `theme_color` / `background_color` `#050608` ; écrans de démarrage iPad/iPhone `public/splash/` (`scripts/make-splash.py`).
- Typographie Inter, `tabular-nums` sur tous les chiffres ; le trait d'union vient d'une police système (`'Fokus Trait'`, `unicode-range`
  U+2D, en tête de `--font-sans`) car `tnum` élargit celui d'Inter (« après - midi »). Accents de couleur : progression (pastels), animation (bleu électrique),
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
     à 0 % un point bleu marque le départ de la barre : posé **dans** le départ, au ras de la carte, il ne monte au sommet du gel
     qu'à mesure que le gel s'allonge ; halo immobile hors course, pulsation légère seulement pendant la course).
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
  Halo pastel sous la barre = copie douce du `#glow` DOM, à z = 1,5 au-dessus de la face (jamais au ras : scintillement de profondeur),
  effacé en fondu pendant l'allumage du bleu ; le gel pastel devient mat pendant ce fondu (pas de reflet ponctuel de la lumière du front).
- **Arche d'arrivée gonflable** (`Arch.jsx`) sur le modèle de la photo fournie par l'utilisateur (arche de course classique) :
  jambes droites, **angles coupés à 45°**, poutre plate (axe = polyligne à raccords arrondis, `TubeGeometry`), gros boudin brillant
  **violet** qui fonce jusqu'au **noir** vers les pieds, **rayures diagonales** sur le bas des jambes (texture canvas), pieds noirs arrondis,
  **« FINISH 100% » vert fluo** (Oswald) imprimé sur la poutre entre **deux emblèmes** (anneau Fokus dans un cercle pointillé blanc),
  cordes d'ancrage ; elle se gonfle avec un rebond élastique. `Bloom` (postprocessing) réservé au gel bleu et aux étincelles.
  Aperçu isolé pour le développement : `.preview/arch.html` (non versionné).
- **Étincelles 3D** (`Sparks.jsx`) jaillissant du front de la barre. À 100 % : flash, onde de choc, gerbe d'étincelles et confettis.
- Éléments additifs : toujours le mélange `additive` de `textures.js` (n'écrit pas d'alpha → pas de traînées noires sur le canevas transparent).
- Respecter `prefers-reduced-motion` et les paramètres (barre coupée → simple flash bleu de la barre). Bouton « Passer l'animation ».
- Test visuel : `?slow=0.3` ralentit toute l'animation.

## Logique métier v3 (à préserver)

- **Modèle de données** (`src/store.js`, `version: 5`, fonction `migrate()` appliquée au chargement **et** à l'import JSON ;
  les sauvegardes v2/v3/v4 et de l'ancien `index.html` restent compatibles ; toute évolution passe par `migrate()`) :
  - tâche `{ id, text, done, date ('YYYY-MM-DD' | null = Plus tard), weight 1|2|3, prio, tags[], subs[{id,text,done}], carried, focus (min),
    est (temps estimé en **minutes**, 0 = aucun ; sert aussi de durée en chronologie), time ('HH:MM' | null), cat (id de catégorie | null), rid? }` ;
  - v5 : `cats = [{ id, name, emoji, color }]` (8 par défaut : 💼 Travail, 📚 Devoirs, 🏃 Sport, ❤️ Santé, 🏠 Maison, 🛒 Courses, ✨ Perso, 👥 Social),
    `rec.cat`, `hist[jour].cg = { catId: n }`, `session[7]` = catégorie ;
    v4 : `migrate()` convertit l'ancienne estimation en pomodoros (× `set.pomo`) et l'ancienne durée ajustée `dur` en `est` ;
  - `sessions` = journal compact `[début s, durée s, tâche, 'c'|'f', terminée, [étiquettes], titre]` (purge > 2 ans) ;
    `ideas` = bloc-notes de distractions ; `pushId` = identifiant aléatoire de l'appareil pour le serveur de notifications ;
  - récurrence `{ id, text, rule {type: daily|weekdays(days)|interval(every)|monthday(day)}, start, weight, tags, prio, last }` —
    `last` + « pas de nouvelle occurrence tant que la précédente n'est pas faite » = jamais de doublon ;
  - historique `hist[jour] = { p, d, t, pd, pt, pr, prt, fm, ps, tg, jk?, ea? }` (ea = [min estimées, min réelles]) ; réglages `S.set` (`DEF_SET`) ; `badges`, `doneTotal`, `fmDay`,
    `lastExport`, `since`, `seen` (tri du matin, bilan, rappels), `pomo` (minuteur en cours, calculé par horodatages).
- **Catégories** (`Categories.jsx`, séparées des étiquettes, choix de l'utilisateur) : **une par tâche** (le grand domaine), emoji + couleur ;
  puce pleine teintée sur la tâche (les étiquettes restent au contour) ; choix à l'ajout (sélecteur natif « 📂 Catégorie ») ou « @sport »
  dans la saisie rapide (nom sans accents, début du nom accepté ; mot inconnu = texte) ; ligne « Catégorie » du panneau d'options ;
  filtre par catégorie au-dessus de la liste (avec les étiquettes) ; couleur des blocs de la chronologie ; carte « Par catégorie »
  (tâches validées + temps de concentration) sur la Page 2 ; rubrique Réglages → Catégories (créer, renommer, emoji, couleur, supprimer) ;
  badges Polyvalent / Touche-à-tout / Spécialiste.
- **Mon style** (`Style.jsx`, `set.style`, `applyStyle`) : « À fond » (`fokus`, suivi complet) ou « Tranquille » (`zen`, demandé
  par les premiers retours : « que les plus chill trouvent leur compte ») : chaque tâche vaut 1, compteur « 3 faites » au lieu du %,
  **tout en bleu** (ni rouge ni vert : `setPalette` de `colors.js`, suivie par la cinématique ; `ZEN_BLUE`), Page 2 simplifiée
  (tâches faites par jour au lieu du %, calendrier en intensité de bleu, « Ma semaine » = juste ce qui a été fait), ni points, ni série, ni « reportée N× », ni
  surcharge, ni tri du matin / bilan / rituel imposés, bouton Valider « 🌿 ». Choisi à l'inscription (`Intro.jsx`), par la carte
  unique `StyleCard` (comptes existants, `seen.style`) ou Réglages → Mon style.
- **Météo du jour** (idée originale de Fokus, `METEO`, `S.mood`, `hist.mt`) : ☀️ 100 % · ⛅ 80 % · 🌧️ 60 % · 🌙 40 % — l'objectif du jour
  (`stats().goal`) s'adapte à l'énergie ; au-delà = bonus ✨ ; la série suit l'objectif ajusté. Question sous la salutation (`Meteo`),
  carte « Ta météo et toi » sur la Page 2, réglage `set.meteo`.
- **Agendas** (`Calendars.jsx`, `lib/calendars.js`, serveur `src/ical.js`) : 1) flux iCal signé et révocable du compte
  (`/cal/link`, `GET /cal/<lien>.ics`) pour Apple / Google / Outlook — tâche validée « ✅ b̶a̶r̶r̶é̶e̶ » (U+0336) déplacée à l'heure
  de validation (`doneAt`, tâches faites archivées 60 j dans `arch`), fuseau `S.tz`, `set.calAllDay` ; 2) agendas externes
  (`set.cals`, lien iCal lu par `/cal/fetch`, https seulement, adresses locales refusées) affichés dans la Chronologie (colonne
  de droite hachurée, tap = « En faire une tâche »), RRULE / EXDATE / RECURRENCE-ID / TZID gérés, cache local `fokus_cal` (15 min).
  Synchronisation dans l'autre sens impossible pour une web app (Apple n'expose pas son agenda).
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
  **Verrou de concentration** (`set.lock`, `pomoLocked`, `lib/lock.js`) : pendant une concentration, pause / réinitialisation /
  phase suivante / fin = appui maintenu 5 s (`HoldButton`) ; espace, mini-fenêtre et onglets bloqués ; sorties de l'app comptées
  (`pomo.out`) + rappel push « reviens » à 20 s et 3 min (clés `lock`, `lock2`) ; mode Concentration iOS lancé par un raccourci
  (`set.lockShortcut`, `shortcuts://run-shortcut`) — bloquer les autres apps est réservé aux apps de l'App Store.
  Chrono **Aesthetic** (façon Flocus : salutation en minuscules, grands chiffres lumineux, phrase douce) ; bouton **Heure** partout.
  v3 : mode **Libre** (Flowtime, `set.pomoMode`, pause = 1/`flowRatio` du temps fait), **aucune punition** (pause, réinitialisation,
  fermeture : le temps fait est toujours crédité), **temps estimé** en minutes (`Estimate.jsx` : puce sablier sur la tâche = estimation seule, jamais le temps déjà fait ;
  un tap ouvre un petit panneau avec heures + minutes **saisies librement** (aucun pas imposé) et préréglages 15 min → 4 h ;
  même éditeur dans le panneau d'options), **sons d'ambiance** (`lib/ambient.js` :
  bruits brun/blanc générés, pluie/café/forêt en boucles libres `public/sounds/*.m4a` + copie `*.mp3` de secours si le
  navigateur ne décode pas l'AAC, fondus, coupure en pause ; aperçu de 6 s au choix d'un son minuteur arrêté ; contexte audio relancé à
  chaque geste (touchend/click : déblocage iPad, reprise après arrière-plan) par `lib/sound.js`), **idées notées**
  pendant la session (revues à la pause), statistiques de concentration (`FocusStats.jsx`).
- **Mini-fenêtre** (`lib/pip.js`, Picture-in-Picture) : bouton en-tête + bouton sous le chrono ; le contenu (minuteur avec anneau qui se vide,
  ou progression du jour) est dessiné sur un canevas diffusé en vidéo (`captureStream`) → fenêtre flottante qui reste à l'écran hors de l'app,
  déplaçable et redimensionnable ; lecture/pause de la fenêtre = pause/reprise du minuteur ; réglage `set.pipMode` (auto / timer / day).
  Les vrais widgets d'écran d'accueil iOS sont réservés aux apps de l'App Store (impossible pour une web app).
- **Ma journée** (phase 3) : bascule Liste / **Chronologie** (`Timeline.jsx`, 6 h → 24 h, ligne « maintenant », blocs glissables par appui
  long, redimensionnables, « À caser » (défilement automatique près des bords pendant le glisser ; ou toucher la poignée puis l'heure),
  chevauchements, événements des agendas reliés), bandeau `DayStrip` « Estimé · Fait » + alerte de surcharge (`set.capacity`,
  `Overload.jsx`), **rituel du soir** `EveningRitual.jsx` (3 écrans ; tri du matin sauté si tout est trié ; `set.evening`, `eveningAt`).
- **Saisie rapide** v3 : « de demain », « le lundi » et les fractions (1/2, 3/4) ne sont pas des dates ; `~45`, `~1h30`, `~2h` = temps estimé (`~2` sans unité ≤ 9 = heures) ;
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
- **Badges** (`BADGES` / `badgeCtx()` de `store.js`, 90 badges) en 6 rubriques (`BADGE_CATS` : Régularité, Journées parfaites, Tâches,
  Concentration, Habitudes, Collection Fokus = badges « méta » comptant les autres) ; chaque badge : `icon` (nom d'icône), `goal`, `v(c)`,
  `tier` (1 bronze, 2 argent, 3 or, 4 émeraude Fokus). Affichés en **médailles Fokus** (`Medal.jsx` : anneau du logo autour d'une icône ;
  verrouillé = l'anneau se remplit avec la progression ; obtenu = anneau fermé aux couleurs du palier) ; tap = détail en toast.
  Les `id` ne changent jamais (badges déjà obtenus conservés). Plus de 2 badges d'un coup → un seul toast récapitulatif.
- **Emojis** : l'interface garde ses emojis (📅 🕑 🌙 💡 🔊 🔥 🏅 🃏 🗑 ⚠️…) **sauf la tomate 🍅, bannie** (⏱️ à la place, ⌛ pour l'estimation).
  `Icons.jsx` (icônes au trait) sert aux médailles, à la mini-fenêtre et aux boutons sans emoji ; `toast(msg, action, ms, icon)` accepte une icône.
- PWA : `pwa/sw.js` → `dist/sw.js` généré au build par le plugin de `vite.config.js` (injecte `const VERSION` / `const ASSETS` ;
  le build **échoue** si un nom reste non remplacé — sinon le service worker plante : plus de hors ligne ni de notifications) ;
  cache consulté avec `ignoreVary` ; rechargement automatique seulement lors d'une mise à jour ; bandeau « Nouvelle version ».
- Mode test (à garder tel quel, en bas de la page Tâches ; masquable par l'utilisateur : Réglages → Données → « Afficher les outils de test », `set.testTools` : masqué pour un nouvel utilisateur, visible si des données existaient déjà) : « Simuler minuit » (dates, reports, récurrences, séries, jokers, tri du matin) et « Générer données test » (365 jours complets
  + sessions, estimations, heures, idées notées et tâches d'exemple).
- Réglages (`Settings.jsx`) : rubriques (Compte si activé, Apparence, Score et affichage, Ma journée, Série et motivation, Pomodoro, Animations, Rappels,
  Étiquettes, Données)
  en colonne à gauche (iPad) ou en puces (téléphone), listes groupées façon iOS (`.sg`, `.si`).
- Fluidité : grain = petite texture `public/noise.png` en mosaïque (jamais de filtre SVG plein écran), animations des décors
  par `transform` (composité), pas de transition sur les tracés SVG.
- **Ouverture rapide** (`App.jsx`) : écrans secondaires chargés à la demande (`React.lazy` + `Suspense` : Pomodoro, Réglages, Recherche,
  Tri du matin, Bilan, Surcharge, Chronologie, Rituel du soir, Progrès) ; scène 3D (`Scene3D`) chargée au repos (`requestIdleCallback`)
  ou dès qu'une tâche est cochée, puis préchargement des autres écrans. Mesuré (4G lente, processeur ×4) : utilisable en ≈ 1,4 s.
- **Amis / nouveaux utilisateurs** : carte `Welcome.jsx` (1re ouverture sans données ; connecté : « À toi de jouer, {pseudo} 👇 » + astuce
  de saisie rapide, le principe étant déjà dans `Intro.jsx` ; sinon 3 points clés ; installation sur l'écran d'accueil,
  « Inviter des amis » via `shareFokus()` = partage natif ou copie du lien) ; bouton « Partager Fokus » dans Réglages → Données.
- **Référencement Google** : `index.html` porte titre « Fokus Track — … », description, `canonical`, Open Graph (`public/og.png`
  1200×630) et JSON-LD `WebApplication` (alternateName « Fokus Track ») ; pages statiques indexables `public/pomodoro/` (minuteur
  Pomodoro, lien `../?page=4`) et `public/decouvrir/` (présentation), style commun `public/site.css` ; `public/sitemap.xml` ;
  pied de page `.site-foot` de la page Tâches avec liens vers ces pages. Le service worker ne met en cache que l'app (`./`),
  jamais ces pages. Adresse officielle **https://fokus-track.com/** (DNS Cloudflare : 4 enregistrements A GitHub + CNAME www, nuage gris ; GitHub Settings → Pages → Custom domain ; l'ancienne adresse github.io y redirige) : URL absolues dans index.html, pages, sitemap, `server/wrangler.toml` (ALLOWED_ORIGIN, APP_URL).
- **Compte / connexion** (`lib/cloud.js`, `Login.jsx`, `Account.jsx`, `src/cloud-config.js`) : **connexion obligatoire** voulue par
  l'utilisateur (`REQUIRE_LOGIN`, ouverte à tous) dès qu'une méthode est active : `GOOGLE_CLIENT_ID` (bouton officiel Google Identity
  Services : fenêtre dans Safari, redirection dans l'app installée, retour `#fokus-session=…&n=<nonce>` vérifié) et/ou `EMAIL_LOGIN`
  (code à 6 chiffres envoyé par Resend, serveur : secret `RESEND_API_KEY`, `MAIL_FROM`). Toutes deux vides/false = app 100 % sans compte.
  **Écran d'arrivée en deux onglets** (`Login.jsx`) : « Se connecter » (e-mail + mot de passe, ou code) et « Créer un compte »
  (prénom, nom, pseudo, âge, e-mail, mot de passe, case de certification → code de vérification de l'adresse → `signupVerify` :
  profil + mot de passe enregistrés d'un coup, puis `Intro`) ; onglet par défaut = « Créer un compte » sauf si une adresse a déjà
  servi sur l'appareil ; champs `autocomplete` (username / new-password / current-password) pour le trousseau iCloud.
  Un compte = une adresse e-mail (Google, code et **mot de passe** mènent au même compte). Mot de passe facultatif
  (Réglages → Compte, `/auth/password/set` ; PBKDF2 100 000 itérations ; 5 essais ratés → 15 min ; « Mot de passe oublié » = code). `main.jsx` affiche `Login` tant qu'il n'y a pas de session.
  Synchronisation : envoi ~2,5 s après chaque `save()` (`onSave`), récupération à l'ouverture / au retour ; `rev` serveur (409 si un autre
  appareil a écrit) ; conflit = la plus récente gagne + toast « Annuler » ; première connexion avec des données des deux côtés → `CloudChoice`.
  `applyRemote()` garde `pushId` et `LOCAL_SET` (push, pushUrl). Déconnexion (connexion obligatoire) : envoi des dernières modifications
  puis effacement des données de l'appareil (`resetAll(true)`). Méta locale `fokus_cloud`. Page `public/confidentialite/`.
  **Activé** (connexion par code e-mail, obligatoire dès la 1re ouverture) ; textes publics, JSON-LD, FAQ et `public/og.png` mis à jour.
  **Profil** (`Profile.jsx`) : à la 1re connexion, écran « Faisons connaissance » (prénom, nom, pseudo, **âge** 7–120 ans) avant l'app
  (`needsProfile` : `user.pseudo` ou `user.age` vide renvoyé par le serveur ; compte existant sans âge → « Un dernier détail ✨ ») ;
  puis **écran de bienvenue** `Intro.jsx` (une seule fois, `m.intro` posé par `setProfile` à l'inscription) : message d'encouragement +
  principe de l'app en 5 étapes + « C'est parti ! » ; modifiable dans Réglages → Compte (`ProfileForm compact`) ; pseudo dans la salutation
  (`Hello.jsx` : « Bonsoir, Lili. ») ; serveur `POST /profile/set` (validation `checkProfile` : lettres / espaces / tirets, pseudo 2–20
  caractères, balises refusées ; âge stocké avec sa date `ageAt` et vieillissant tout seul, `ageNow`), stocké dans `Account` (meta) et
  `Stats.accounts` (colonnes first, last, pseudo, age, ageAt) → tableau de bord (âge moyen) + export CSV.
  **Âge minimum 15 ans** (`MIN_AGE`, client `cloud-config.js` + serveur `account.js`, loi Informatique et Libertés art. 45) : case « Je certifie
  que ces informations sont exactes » à l'inscription ; âge < 15 → confirmation (« Corriger mon âge » / « Je confirme ») puis compte **bloqué**
  côté serveur (`meta.blocked = 'age'` : plus de profil ni de sauvegarde ni de données renvoyées, nouvel essai impossible avec cette adresse) →
  écran `Blocked.jsx` (« Compte en pause 🔒 » + formulaire de contact + `CONTACT_EMAIL`). Le propriétaire débloque depuis le tableau de bord
  (`/admin/unblock` : âge remis à zéro, redemandé à la prochaine ouverture).
  **Contact** (`Contact.jsx`) : formulaire (sujet, message ; adresse demandée seulement hors connexion) dans Réglages → Contact, sur l'écran de
  connexion (lien « Contact »), l'écran bloqué et le pied de page ; serveur `POST /contact` → e-mail Resend aux adresses `ADMIN_EMAILS`
  (ou `CONTACT_TO`) avec `reply_to` = l'utilisateur (adresse du compte si connecté), texte échappé, plafond quotidien partagé avec les codes.
  Adresse affichée `contact@fokus-track.com` (routage Cloudflare Email → boîte du propriétaire, à activer dans Cloudflare).
  **E-mail du code** (`codeMail` de `server/src/index.js`) : code en grand d'abord, puis inscription = « Bienvenue dans Fokus 💚 » + principe
  en 4 étapes + encouragement (sujet « … — bienvenue ! ») ; connexion suivante = « Content de te revoir 👋 » (drapeau `isNew` de `/code`).
- **Statistiques de visites** : Cloudflare Web Analytics (sans cookie), jeton `ANALYTICS_TOKEN` renseigné (`main.jsx`, chargé au repos) + balise dans les pages statiques (Pomodoro, Découvrir, Confidentialité). Configuré dans Cloudflare en « extrait JS » (le site est en DNS uniquement, nuage gris).
- **Tableau de bord du propriétaire** (Réglages → Administration, `Admin.jsx`, visible seulement si l'adresse du compte est dans le secret
  serveur `ADMIN_EMAILS` ; drapeau `user.admin` à la connexion ou en-tête `X-Fokus-Admin` sur `/sync/get`) : personnes en ligne en direct
  (rafraîchi toutes les 10 s), récap Aujourd'hui / Semaine / Mois / Année / Depuis le début (visiteurs uniques, temps passé cumulé,
  concentration, tâches validées, nouveaux comptes), barres des 30 derniers jours, comptes actifs (aujourd'hui / 7 j / 30 j, d'après la
  dernière visite), liste des comptes (recherche, copie, export CSV).
  Données : signal anonyme `lib/presence.js` (`/ping` toutes les 60 s, app visible : numéro d'appareil `fokus_vid`, secondes, secondes de
  concentration et tâches validées depuis le signal précédent, « bye » au départ ; base remise à zéro sur les données reçues d'un autre appareil).
- **Images / seconde** : tout est piloté par le temps (aucune hypothèse de 60 Hz) ; défilement et CSS à 120 Hz sur écran ProMotion ;
  Safari limite les animations JS (GSAP, 3D) à 60 i/s par défaut. Compteur de contrôle : ajouter `?fps` à l'adresse.
- Raccourcis : N, /, Entrée, Échap. Interface en français, mobile d'abord (cibles ≥ 44 px, pas de défilement horizontal).

## Arborescence

- `src/store.js` — état, migration, persistance, changement de jour, séries, jokers, badges, minuteur, actions.
- `src/components/` — `Header`, `ProgressCard`, `QuickAdd`, `TaskList` (+ panneau d'options), `Upcoming` (À venir), `ValidateButton`,
  `Settings` (réglages complets), `Search`, `MorningTriage`, `WeeklyReview`, `Pomodoro` + `Clocks` + `Concepts`, `StatsPage` + `FocusStats`,
  `Timeline`, `DayStrip`, `Overload`, `EveningRitual`, `Hello`, `Ambiance`, `Estimate` (temps estimé), `Categories`, `Icons`, `Medal`, `Sheet` (modale), `Welcome` (bienvenue + partage), `Login` (écran de connexion), `Profile` (prénom / nom / pseudo / âge), `Intro` (bienvenue après l'inscription), `Blocked` (compte bloqué), `Contact` (formulaire), `Account` (compte + choix des données + mot de passe), `Admin` (tableau de bord), `Style` (mon style + météo du jour), `Calendars` (Réglages → Agendas).
- `src/lib/` — `colors`, `celebrate`, `dates`, `quickAdd`, `backup`, `notify`, `sound`, `ambient`, `backgrounds`, `push`, `pushSync`, `pip`, `cloud` (compte + synchronisation), `presence` (signal « en ligne »), `lock` (verrou de concentration), `calendars` (agendas externes, lecture iCal).
- `server/` — Worker Cloudflare `fokus-push` (Durable Objects `User` = une alarme par notification, `Keys` = clés VAPID + secret des
  sessions + compteur de comptes, `Account` = un compte : données découpées en morceaux de 32 000 caractères, `rev` ;
  `Stats` = base SQLite unique : présence en mémoire, `visits(day, vid)`, `days(secs, focus, done, signups)`, `accounts(email, created, seen, via)`,
  jours au fuseau Europe/Paris) ;
  chiffrement Web Push sans dépendance (`src/webpush.js`, testé contre `http_ece`) et comptes (`src/account.js` : jeton Google RS256
  (e-mail vérifié), codes e-mail (empreinte salée, 10 min, 5 essais, 1/min, 5/h, ≤ 95 e-mails/jour), sessions HMAC `v2.<empreinte de
  l'adresse>`, conflits, suppression) : `npm test` (dont `test/worker.test.mjs` = Worker complet simulé). Variables `ALLOWED_ORIGIN` (liste),
  `APP_URL`, `GOOGLE_CLIENT_ID`, `MAIL_FROM` ; secrets `RESEND_API_KEY`, `ADMIN_EMAILS` (GitHub → Actions, transmis par le workflow).
  Déployé par `.github/workflows/push-server.yml` (secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
  Adresse dans `src/push-config.js` (ou Réglages → Rappels → Avancé). Stocke l'abonnement, l'heure et le texte des rappels ;
  les données de l'app seulement pour les comptes Google connectés.
- `src/cinematic/engine.js` — timeline GSAP + caméra de poursuite ; `Scene3D.jsx`, `Card3D.jsx`, `Outline.jsx`, `Arch.jsx`, `Sparks.jsx`,
  `SpeedLines.jsx` — scène 3D (**l'utilisateur a validé l'animation : ne plus la modifier**).
- `src/brand.js` — logo : mettre `LOGO_URL` (ex. `'logo.png'` dans `public/`) pour remplacer le logo par défaut (en-tête + arche).
- `scripts/make-themes.py` (fonds des thèmes), `scripts/make-splash.py` (écrans de démarrage), `brand/` (kit du logo).

- **Gratuit et sans limite** : aucune durée maximale, aucune fonction bloquée, aucune publicité.

## Idées pour plus tard (à rediscuter avec l'utilisateur)

- Raccourcis Siri, récap de l'année. (Synchronisation : validée par l'utilisateur → compte Google, voir plus haut.)

## Labo (prototypes, demandé par l'utilisateur)

- **Toute nouvelle idée se teste d'abord dans le labo**, jamais directement dans l'app : branche **`labo`** → publiée sur
  **https://fokus-track.com/labo/** (même déploiement : `deploy.yml` construit main à la racine et `labo` avec `VITE_LABO=1`
  dans `/labo/` ; un envoi sur `labo` relance le déploiement via `labo.yml`). Les utilisateurs ne voient rien tant que ce n'est pas validé.
- Labo (`src/env.js` `LABO`, `src/lib/labo.js` importé en premier) : clés du stockage préfixées `labo:` (données séparées de l'app),
  copie IndexedDB `labo-backup`, caches du service worker `labo-`, pas de compte ni de synchronisation, pas de statistiques,
  pastille « 🧪 Labo », `noindex` + `robots.txt` `Disallow: /labo/`.
- **La mine** (jeu dans le labo, page 5 = **onglet « ⛏️ La mine » entre Pomodoro et Progression** dans l'en-tête, seulement dans le labo,
  pour regarder le mineur creuser pendant la concentration ; carte aussi dans l'onglet Pomodoro) :
  **Mondes** : monde 1 « La mine de ta ville » (vélo, ≈ 12,5 h) puis **monde 2 « Les volcans d'Auvergne »** (`theme 'volcans'`,
  `mul` 6 = valeurs et missions ×6, `tough` 5 = roche 5× plus dure ; cendre, pouzzolane, soufre, obsidienne, olivine, zircon, grenat,
  saphir du Velay, cœur de lave ; objectif la voiture 120 000 Fk ≈ 20 h). Départ depuis l'Atelier une fois le véhicule construit :
  chapitre 2 raconté (`STORY2`), `travel()` vend le coffre et ouvre une nouvelle mine (Fokoins, améliorations, collection gardés) ;
  bouton de test « Débloquer » réservé au labo. Missions par indice de minerai (`ore#i`), récompenses × `mul`.
  Personnage complet dans `hero.js` (bras, jambes, salopette à l'anneau Fokus, foulard, casque à pastille Fokus) ; `src/game/` (`data.js` mondes / minerais / améliorations,
  `sim.js` mine générée par graine + simulation pure, `render.js` + `art.js` dessins Canvas 2D vectoriels « à la Rayman »),
  **DA « Fokus Mine » (v4, choisie par l'utilisateur d'après Idle Miner Tycoon, mais avec notre identité)** : dessin animé net et
  coloré, contours épais `OUT`, aplats + une ombre et un reflet ; coupe du sol en **couches** colorées (`W.layers`, `W.layerAt`,
  `layerEdge`/`layerOf` de render.js : terre caramel → argile → schiste prune → granit indigo → cristal turquoise, limites ondulées
  cernées) ; galeries sombres aux bords arrondis (contour épais), rails, boisages, échelles, stalactites, racines, cristaux ;
  le sol reste visible mais l'intérieur des galeries s'assombrit loin des lumières et **un minerai n'apparaît que s'il est éclairé** ;
  surface : puys d'Auvergne, montagnes enneigées, petite ville française, arbres en boule, panneaux en bois à lettres blanches,
  Boutique émeraude Fokus ; personnage `hero.js` grosse tête, contours épais (manteau émeraude ou bleu roi, écharpe, sac à dos).
  **v2 premium** : matières peintes sans raccord (`makeTiles`, textures 4 × 4 cases remplies en motif, îlots de terre arrondis dans
  la roche, coins des galeries arrondis), minerais facettés, bâtiments à plaques dorées, ciel en perspective atmosphérique, vignette ;
  **galeries aléatoires** (`plan()` : tronçons de longueur variable, marches, montées, demi-tours, niveau du chantier `DESCENT`,
  minerais repérés par la lampe `seeRange`, relance ailleurs si bloqué = `act 'move'`) ; **lumière** : tout est noir sous terre sauf
  autour des **lanternes** posées par le mineur (`g.lamps`, `lampGap`, amélioration « Lanternes ») et de la lampe frontale ;
  la lumière suit les galeries (`computeLight`) et n'éclaire qu'une case de paroi (image d'obscurité à 2 points par case) ;
  monde 1 large de 240 cases (`fixGame` convertit les anciennes parties : `g.ww`),
  `components/Mine.jsx` (intro + histoire, jeu, lieux, collection, missions), partie dans `S.mine` (`setMine`), temps de jeu =
  `focusSecs()` (concentration Pomodoro depuis le début de l'aventure, impossible d'accélérer), monnaie **Fokoin** (Fk) ;
  équilibrage : `node scripts/mine-sim.mjs` (monde 1 ≈ 12 h, actuellement 12,5 h). Boutons de test « +1 h » réservés au labo.
  **Histoire** (`STORY`, 7 scènes racontées comme un récit, accords `{féminin|masculin}`) : le personnage n'a **jamais de pioche**
  pendant le récit (`drawMiner(..., { tool: false })`, sans casque à la maison : `helmet: false`) ; il la trouve dans la mine.
  **Surface** : Atelier (objectif du monde en 3 étapes : livre → pièces → départ), Boutique (rayons `SHOP_CATS`, niveaux, toutes
  les pioches), chevalement, Marché (le personnage dépose au **coffre** `g.stock` ; cours du jour ±25 % `priceMul`, même pour tous ;
  vente à la main ou « Contrat avec le marché » = vente auto) ; on y entre en touchant le bâtiment (`hitBuilding`) ou par les boutons.
  **Missions** (3 à la fois, `MISSIONS`) ; **badges Fokus → Fokoins** selon le palier (`BADGE_FK` : 40 / 120 / 300 / 800 ;
  badges déjà obtenus avant la mine : prime plafonnée à `WELCOME_FK` 1 500) ; tâche validée +5 Fk.
- Idée validée par l'utilisateur → fusion de `labo` dans `main` (le labo suit main : fusionner main dans labo après chaque publication).

## Workflow

- `npm run dev` (local), `npm run build` (vérification obligatoire avant push), push sur `main` → déploiement Pages automatique.
- Messages de commit en français, clairs et courts.
