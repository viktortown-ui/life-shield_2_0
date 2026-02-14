import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { VitePWA, cachePreset } from 'vite-plugin-pwa';

const base = process.env.BASE ?? '/life-shield_2_0/';

const buildId = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8'
    }).trim();
  } catch {
    return 'unknown';
  }
})();
const builtAt = new Date().toISOString();

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_TIME__: JSON.stringify(builtAt)
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        id: `${base}#/`,
        name: 'LifeShield 2.0',
        short_name: 'LifeShield',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        scope: base,
        start_url: `${base}#/`,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Щит',
            short_name: 'Щит',
            url: `${base}#/`
          },
          {
            name: 'Острова',
            short_name: 'Острова',
            url: `${base}#/islands`
          },
          {
            name: 'Настройки',
            short_name: 'Настройки',
            url: `${base}#/settings`
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: 'index.html',
        runtimeCaching: [...cachePreset]
      }
    })
  ],
  test: {
    environment: 'jsdom'
  }
});
