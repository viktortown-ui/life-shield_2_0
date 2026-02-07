import { defineConfig } from 'vite';
import { VitePWA, cachePreset } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
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
        runtimeCaching: cachePreset
      }
    })
  ],
  test: {
    environment: 'jsdom'
  }
});
