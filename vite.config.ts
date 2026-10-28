import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { devApi } from './vite-dev-api';

// PREVIEW_BUILD=1 → relative asset paths, hash routing, no service worker (for hosted previews).
const previewBuild = process.env.PREVIEW_BUILD === '1';

export default defineConfig({
  // Build label shown at the bottom of 關於 (Vercel provides the commit SHA at build time;
  // CLI deploys without git metadata pass it as BUILD_SHA, e.g. `vercel deploy --build-env BUILD_SHA=<sha>`).
  define: { __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_SHA || 'dev').slice(0, 7)) },
  base: previewBuild ? './' : '/',
  plugins: [
    react(),
    devApi(),
    VitePWA({
      disable: previewBuild,
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png', 'brand/logo-128.png', 'brand/logo-256.png'],
      manifest: {
        name: 'TKU Campus OS 淡江智慧校園',
        short_name: '淡江校園',
        description: '淡江學生的課表、待辦、校園探索與 AI 校園助理。學生自主開發，非淡江大學官方 App。',
        lang: 'zh-Hant-TW',
        theme_color: '#B3262D',
        background_color: '#B3262D', // matches the boot splash, so the system launch screen doesn't flash off-white
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['/push-sw.js'],
        // On-device OCR (~5.5 MB per device) is downloaded only when a screenshot is imported, then kept.
        globIgnores: ['ocr/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
          handler: 'CacheFirst',
          options: { cacheName: 'ocr-engine', expiration: { maxEntries: 8 } },
        }],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // Hermetic: never pick up a developer's .env.local Supabase project in unit tests.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
