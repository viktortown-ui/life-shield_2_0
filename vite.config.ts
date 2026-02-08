import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { VitePWA, cachePreset } from 'vite-plugin-pwa';

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
  base: process.env.BASE ?? '/life-shield_2_0/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_TIME__: JSON.stringify(builtAt)
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'LifeShieldV2',
        short_name: 'LifeShield',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3
            }
          },
          ...cachePreset
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom'
  }
});
