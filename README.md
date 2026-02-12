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

## PWA / Lighthouse quick check

Run an automated local check (build + preview + Lighthouse PWA/performance categories):

```bash
npm run lighthouse:pwa
```

Artifacts will be written to:
- `./lighthouse-pwa-report.html`
- `./lighthouse-pwa-report.json`

Manual fallback via Chrome DevTools:
1. Open app in preview mode (`npm run preview`).
2. Open **DevTools → Lighthouse**.
3. Select categories **Progressive Web App** and **Performance**.
4. Run audit against `http://127.0.0.1:4173/life-shield_2_0/#/`.

## Как добавить иконки (бинарь)

PWA ожидает PNG-иконки в следующих путях:
- `public/icons/icon-192.png` (192x192)
- `public/icons/icon-512.png` (512x512)
- `public/icons/icon-512-maskable.png` (512x512, maskable)

В manifest они публикуются как:
- `/icons/icon-192.png`
- `/icons/icon-512.png`
- `/icons/icon-512-maskable.png`

### Вариант 1: загрузить файлы прямо в ветку PR через GitHub UI
1. Откройте ветку PR на GitHub.
2. Перейдите в папку `public/icons/` (создайте её, если ещё нет).
3. Нажмите **Add file → Upload files**.
4. Перетащите три PNG-файла с именами выше.
5. Внизу страницы выберите **Commit directly to the <branch>** и сделайте commit.

### Вариант 2: локальный commit
```bash
# находясь в корне репозитория
mkdir -p public/icons
cp /path/to/icon-192.png public/icons/icon-192.png
cp /path/to/icon-512.png public/icons/icon-512.png
cp /path/to/icon-512-maskable.png public/icons/icon-512-maskable.png

git add public/icons/icon-192.png public/icons/icon-512.png public/icons/icon-512-maskable.png
git commit -m "Add PWA PNG icons (192/512/maskable)"
git push
```

После загрузки иконок достаточно выполнить сборку — дополнительных правок в конфиге не нужно.

