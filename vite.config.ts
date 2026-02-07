import { defineConfig } from 'vite';
import { VitePWA, cachePreset } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'LifeShieldV2',
        short_name: 'LifeShield',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
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
          }
        ]
      },
      workbox: {
        runtimeCaching: cachePreset
      }
    })
  ],
  test: {
    environment: 'jsdom'
  }
});
