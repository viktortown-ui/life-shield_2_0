import { defineConfig } from 'vite';
import { VitePWA, cachePreset } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE ?? '/life-shield_2_0/',
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
