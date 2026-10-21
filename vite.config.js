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
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['index.html', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png', 'icon-512.png'];
      const src = readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', JSON.stringify(Date.now().toString(36)))
        .replace('__ASSETS__', JSON.stringify([...new Set([...extra, ...files])].map((f) => './' + f)));
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
