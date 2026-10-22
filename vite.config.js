import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* PWA : génère dist/sw.js à partir de pwa/sw.js avec la liste des fichiers à mettre en cache
   et un numéro de version unique (le navigateur détecte ainsi chaque nouvelle version). */
function serviceWorker() {
  return {
    name: 'fokus-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      // polices : seuls les alphabets latins sont préchargés (les autres ne sont téléchargés qu'en cas de besoin)
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !/(cyrillic|greek|vietnamese)/.test(f));
      const extra = ['index.html', 'manifest.webmanifest', 'icon.svg', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'noise.png', 'bg/gt-car.webp'];
      const src = readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8')
        .replace('const VERSION = __VERSION__;', `const VERSION = ${JSON.stringify(Date.now().toString(36))};`)
        .replace('const ASSETS = __ASSETS__;', `const ASSETS = ${JSON.stringify([...new Set([...extra, ...files])].map((f) => './' + f))};`);
      // garde-fou : un nom non remplacé ferait planter le service worker (plus de hors ligne ni de notifications)
      if (/__VERSION__|__ASSETS__/.test(src)) this.error('sw.js : VERSION ou ASSETS non injecté');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

// base './' : chemins relatifs → fonctionne tel quel sur GitHub Pages (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
