# Fokus

Application de tâches quotidiennes, de concentration et de suivi de performance : design noir et blanc premium, animation 3D
cinématographique à chaque validation (arche gonflable « FINISH 100% », gel bleu électrique, étincelles 3D).
Gratuite, sans limite, sans publicité, sans fonction bloquée.

**Ouvrir l'application :** https://komesoucaille-fokustrack.github.io/Fokus-app/

Sur iPad / iPhone : dans Safari, bouton Partager → « Sur l'écran d'accueil ». Fokus s'ouvre alors en plein écran comme une app,
fonctionne hors ligne et peut recevoir des notifications.

## Fonctionnalités

- **Tâches** : saisie rapide intelligente (« Sport demain 18h30 #santé !! * ~45 »), points 1/2/3, 3 priorités ★ (or),
  étiquettes, sous-tâches, temps estimé modifiable d'un tap (⌛), heure facultative, récurrences fines (tous les jours, tous les X jours,
  certains jours, un jour du mois), ordre manuel ou automatique, glisser-déposer, annulation après validation ou suppression.
- **Ma journée** : vue Liste ou Chronologie (6 h → 24 h, blocs à glisser et redimensionner au doigt, « À caser »),
  alerte douce de surcharge, rituel du soir « Fermer ma journée », tri du matin, bilan de la semaine.
- **Pomodoro** : classique (pauses courtes/longues, cycles) ou chrono Libre (Flowtime), tâche liée, sons d'ambiance
  (pluie, café, forêt, bruits brun et blanc), bloc-notes de distractions, plein écran avec chronos Classique / Flip /
  Anneau / Minimal, fonds Concepts (vectoriels) et photos HD. Aucune punition : le temps fait est toujours compté.
- **Ma Progression** : courbe de réussite, séries et jokers, calendrier de l'année, badges, statistiques de concentration
  (par jour, par heure, par étiquette, par tâche, tendance 4/12 semaines, précision des estimations).
- **Fiabilité** : copie de secours automatique (IndexedDB), export/import JSON (compatible avec l'ancien `index.html`),
  fonctionnement hors ligne, mises à jour signalées par un bandeau.
- **Design** : thème « Obsidienne » (noir profond aux reflets bleu nuit, émeraude et ambre), cartes en verre fumé, lumière
  colorée par la progression derrière la carte du jour ; fonds pré-calculés pour rester parfaitement fluide (60 i/s).
  Autres ambiances au choix (Graphite lunaire, Ambre fumé, photos, dégradés).
- **Motivation** : 51 badges en 5 rubriques avec progression, séries et jokers, bilan de la semaine.
- **Notifications** même app fermée : fin de phase du Pomodoro et rappel du soir (voir ci-dessous).

## Notifications

**En service** : serveur `https://fokus-push.kome-soucaille.workers.dev` (Cloudflare Workers, déployé par GitHub Actions).
Sur l'iPad : ouvrir Fokus depuis l'icône de l'écran d'accueil → Réglages → Rappels → activer → « Envoyer une notification de test ».
En cas de souci : Réglages → Rappels → **Diagnostic** (vérifie chaque étape).

### Mise en place (déjà faite — pour mémoire, depuis l'iPad, sans terminal)

Les notifications sont envoyées par un petit serveur gratuit (Cloudflare Workers, dossier [`server/`](server/)).
Il ne garde que l'abonnement de l'appareil, l'heure et le texte des notifications — aucune tâche, aucun historique.

1. **Créer le compte Cloudflare** : dans Safari, ouvre https://dash.cloudflare.com/sign-up, inscris-toi (gratuit) et
   confirme l'e-mail.
2. **Activer Workers** : dans le tableau de bord, menu ☰ → **Compute (Workers)** → **Workers & Pages**. À la première
   visite, Cloudflare propose un sous-domaine `….workers.dev` : accepte-le (ou choisis un nom), c'est l'adresse du serveur.
3. **Récupérer l'identifiant de compte** : sur la page **Workers & Pages**, l'**Account ID** est affiché dans la colonne de
   droite (ou menu ⋯ du compte → *Copy account ID*). Copie-le.
4. **Créer le jeton** : icône du profil (en haut à droite) → **My Profile** → **API Tokens** → **Create Token** →
   modèle **Edit Cloudflare Workers** → **Use template**. Dans *Account Resources*, choisis ton compte ; dans
   *Zone Resources*, laisse *All zones*. → **Continue to summary** → **Create Token**. Copie le jeton (il ne s'affiche qu'une fois).
5. **Donner les deux valeurs à GitHub** : sur https://github.com/komesoucaille-fokustrack/Fokus-app → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**, deux fois :
   - nom `CLOUDFLARE_API_TOKEN`, valeur : le jeton ;
   - nom `CLOUDFLARE_ACCOUNT_ID`, valeur : l'identifiant de compte.
6. **Déployer** : onglet **Actions** → **Serveur de notifications** → **Run workflow** (ou demande-le à Claude). Ensuite,
   chaque modification de `server/` est redéployée toute seule.
7. **Brancher l'app** : l'adresse du serveur (`https://fokus-push.<sous-domaine>.workers.dev`) est inscrite dans
   `src/push-config.js` (Claude s'en charge) ou dans Fokus : Réglages → Rappels → Avancé.
8. **Activer sur l'iPad** : ouvre Fokus **depuis son icône de l'écran d'accueil** → Réglages → Rappels → active
   « Notifications (même app fermée) » → autorise → « Envoyer une notification de test ».

Si le serveur est injoignable ou la permission refusée, Fokus continue de fonctionner normalement.

## Technique

Vite + React + Tailwind CSS v4 · Three.js (`@react-three/fiber`, `drei`, `postprocessing`) · GSAP · Chart.js ·
canvas-confetti · Web Audio · Web Push (Cloudflare Workers + Durable Objects, chiffrement `aes128gcm` + VAPID sans dépendance).

- Chaque push sur `main` est compilé et publié sur GitHub Pages (`.github/workflows/deploy.yml`).
- Le serveur de notifications est déployé par `.github/workflows/push-server.yml` (secrets Cloudflare ci-dessus).
- Règles du projet, modèle de données et choix techniques : voir [`CLAUDE.md`](CLAUDE.md).

```bash
npm install
npm run dev       # développement
npm run build     # production (dist/)
cd server && npm install && npm test   # test du chiffrement Web Push
```

## Crédits

- Logo et icônes : kit Fokus (`brand/`).

- Photos des fonds du Pomodoro : Unsplash (licence Unsplash), noms des photographes affichés dans l'app.
- Sons d'ambiance (via le projet [Blanket](https://github.com/rafaelmardojai/blanket)) : pluie — alex36917 (CC BY 3.0) ;
  café — « Restaurant Ambiance », stephan (domaine public) ; forêt — kvgarlic (CC0). Bruits brun et blanc générés en Web Audio.
