import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      // Disable generating a new service worker since we have a custom one
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        // Don't inject workbox, use our custom SW
        globPatterns: [],
      },
      includeAssets: ['icons/*.png', 'icons/*.ico'],
    })
  ],
  build: {
    target: 'esnext',
  },
});
