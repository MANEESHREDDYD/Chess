import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// The `stockfish` npm package has restructured its layout multiple times.
// Files we want (stockfish.js, stockfish.wasm) might be in `src/`, `lib/`, or the root.
// We copy from any/all that exist; viteStaticCopy silently skips missing sources.
const STOCKFISH_SOURCES = [
  'node_modules/stockfish/src/*.js',
  'node_modules/stockfish/src/*.wasm',
  'node_modules/stockfish/src/*.worker.js',
  'node_modules/stockfish/lib/*.js',
  'node_modules/stockfish/lib/*.wasm',
  'node_modules/stockfish/*.js',
  'node_modules/stockfish/*.wasm',
];

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: STOCKFISH_SOURCES.map((src) => ({
        src,
        dest: 'stockfish',
      })),
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'MIRROR — The Apprentice',
        short_name: 'MIRROR',
        description:
          'A chess prototype where the final opponent is built from how you play.',
        theme_color: '#1e3a5f',
        background_color: '#f5f0e6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,wasm}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
