# Fokus

Application de tâches quotidiennes et de suivi de performance — design noir & blanc premium, animation 3D cinématographique
à chaque validation (arche d'arrivée « FOKUS 100% », néon bleu électrique, étincelles 3D).

**Ouvrir l'application :** https://komesoucaille-fokustrack.github.io/Fokus-app/

Astuce iPad : dans Safari, bouton Partager → « Sur l'écran d'accueil » pour l'ouvrir comme une app en plein écran.

## Fonctionnalités

- Tâches : ajout, modification (✎ ou double-clic), suppression, sélection multiple + validation via le bouton flottant,
  réorganisation ⏫ ▲ ▼ ⏬ et glisser-déposer, tâches récurrentes.
- Changement de jour automatique à minuit : score archivé, tâches réalisées retirées, tâches restantes reportées,
  tâches récurrentes ajoutées. Boutons de test « Simuler minuit » et « Générer données test ».
- Ma Progression : courbe continue Chart.js (Semaine / Mois / Année) colorée selon la moyenne de la période.
- Export / Import JSON (compatible avec l'ancienne version `index.html`).

## Technique

Vite + React + Tailwind CSS · Three.js (`@react-three/fiber`, `drei`, `postprocessing`) · GSAP · Chart.js · canvas-confetti.
Chaque push sur `main` est compilé et publié automatiquement sur GitHub Pages (`.github/workflows/deploy.yml`).
Règles du projet : voir [`CLAUDE.md`](CLAUDE.md).

```bash
npm install
npm run dev     # développement
npm run build   # production (dist/)
```
