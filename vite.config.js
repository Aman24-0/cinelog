import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      // ============================================
      // FIX #17: PWA Manifest Now Enabled
      // ============================================
      // Previously disabled, breaking PWA installability
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'CineLog',
        short_name: 'CineLog',
        description: 'Personal movie & TV show tracker with AI recommendations',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache core assets + media formats for offline support
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2,mp4,m3u8}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024 // 50MB limit for media files
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    // Proxy tRPC requests to backend during development to avoid CORS issues
    proxy: {
      '/trpc': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: 'terser',
    chunkSizeWarningLimit: 1000, // Suppress warning for large video.js/firebase chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['solid-js', '@solidjs/router'],
          ui: ['video.js', 'firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    }
  }
});
