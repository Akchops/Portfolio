import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Relative base: the build works at a domain root or under a sub-path
  // (e.g. GitHub Pages /Portfolio/) without changes.
  base: './',
  build: {
    target: 'es2020',
    modulePreload: { polyfill: false },
    // The Three.js chunk (~190 kB gzip) is intentionally large and only ever
    // loaded lazily on desktop, after the WebGL probe. It is not first load.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        matchday: resolve(import.meta.dirname, 'matchday/index.html'),
      },
    },
  },
});
