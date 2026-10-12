import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// PREVIEW_BUILD=1 → relative asset paths, hash routing, no service worker (for hosted previews).
const previewBuild = process.env.PREVIEW_BUILD === '1';

export default defineConfig({
  base: previewBuild ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      disable: previewBuild,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'TKU Campus OS 淡江智慧校園',
        short_name: '淡江校園',
        description: '淡江學生的課表、待辦、校園探索與 AI 校園助理。學生自主開發，非淡江大學官方 App。',
        lang: 'zh-Hant-TW',
        theme_color: '#A84643',
        background_color: '#F8F6F1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
