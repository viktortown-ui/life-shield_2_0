# LifeShieldV2

LifeShieldV2 is a mobile-first (Vite + TypeScript) single-page app with modular “islands” for different analytical approaches.

Settings include JSON export/import to back up or restore user data (with migrations).

## Local development

```bash
npm install
npm run dev
```

## Build & preview

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Go to **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` (or run the workflow manually) to build and deploy.
3. The workflow sets `BASE="/<repo-name>/"` so assets resolve correctly on Pages.

Notes:
- GitHub Pages has build limits for the legacy “Build from a branch” flow. This custom workflow uses **GitHub Actions**, so it does not count against the “10 builds per hour” Pages limit.

## Если белый экран

- Откройте **View Source** и убедитесь, что в HTML нет `/src/main.ts` (должны быть production assets из `dist`).
- В **Network** проверьте, что `sw.js` загрузился без ошибок.
- Убедитесь, что последний **Actions run** завершился успешно и выкатил свежий `dist`.

## Replacing the SVG app icon later

The PWA is currently configured to use a text-only `public/icon.svg`. If you want to swap in PNGs later:

1. Create PNGs (for example `icon-192.png` and `icon-512.png`).
2. Upload them via **GitHub Desktop** or **Upload files** in the GitHub web UI (no binary patches required here).
3. Update `vite.config.ts` to point `includeAssets` and `manifest.icons` at the PNGs and adjust the `type` to `image/png`.
