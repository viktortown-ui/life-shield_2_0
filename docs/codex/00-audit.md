# 00 Audit — Life-Shield 2.0

## Summary
- Подтверждён контекст репозитория: текущая ветка `work`, последний коммит `d75286b` (merge), настроенных remotes в локальной копии нет.
- Проверены npm-скрипты проекта из `package.json`: `dev`, `build`, `preview`, `test` присутствуют; `lint` отсутствует.
- Выполнены `npm ci`, `npm run build`, `npm test`; критических ошибок сборки/тестов нет.
- Сборка Vite успешна, артефакты сформированы в `dist/`, PWA service worker сгенерирован.
- Роутинг реализован через hash (`#/...`), что совместимо с GitHub Pages без server-side rewrite.
- В `vite.config.ts` задан `base` через `BASE` env с дефолтом `/life-shield_2_0/`, что снижает риск битых путей ассетов на Pages.
- Найден потенциальный риск в PWA manifest: пути `icons` заданы абсолютными (`/icons/...`) и могут не учитывать префикс репозитория на Pages.
- Код приложения не менялся; изменения этого шага ограничены документацией и guardrails.

## Commands
```bash
# 1) Проверка Git-контекста
git remote -v
git branch --show-current
git log -1 --oneline

# 2) Проверка scripts
cat package.json
npm run

# 3) Установка и проверки
npm ci
npm run build
npm test

# 4) Проверка Pages-конфига и роутера
cat vite.config.ts
cat src/ui/router.ts
cat dist/index.html
cat .github/workflows/deploy.yml
```

## Project Map
- `src/main.ts` — bootstrap приложения, инициализация diagnostics/PWA/router.
- `src/core/*` — состояние, диагностика, миграции, доменная логика.
- `src/ui/*` — экраны (`shield`, `settings`, `report`, `finance`, `islandsHub`) и роутер.
- `src/islands/*` — аналитические модули (bayes, stress, snapshot, optimization, timeseries и др.).
- `src/workers/*` — workers для bayes/hmm/optimization/time-series.
- `src/styles/main.css` — основной stylesheet.
- `public/icons/*` — иконки PWA.
- `.github/workflows/deploy.yml` — сборка и публикация на GitHub Pages.

## Build/Lint/Test results
- `npm ci`: завершился успешно, установлены зависимости; есть предупреждения npm о deprecated-пакетах и 5 moderate vulnerabilities (без блокировки сборки).
- `npm run build`: успешно (`vite build`), сформированы assets и PWA (`dist/sw.js`, `dist/workbox-*.js`).
- `npm test`: успешно, `16 passed` test files, `39 passed` tests.
- `npm run lint`: не запускался, так как скрипт `lint` отсутствует в `package.json`.

Ключевые выдержки из логов:
- Build: `✓ built in 1.43s`, `PWA ... files generated dist/sw.js`.
- Test: `Test Files 16 passed (16)`, `Tests 39 passed (39)`.

## GitHub Pages risks (base, router, asset paths)
1. **`base` в Vite**
   - Сейчас: `const base = process.env.BASE ?? '/life-shield_2_0/';`.
   - Риск: при публикации форка/другого имени репозитория без переменной `BASE` ассеты могут запрашиваться по неверному префиксу.
   - Симптом: белый экран + 404 на `/<old-repo>/assets/...`.
   - Решение: всегда передавать `BASE="/${repo}/"` в CI/локальном release-процессе (в workflow это уже сделано).

2. **Router mode**
   - Сейчас: hash router (`window.location.hash`, ссылки формата `#/...`).
   - Риск: низкий для Pages; hash-роутинг корректен без rewrite.
   - Потенциальный симптом только при ручной смене на history-router: 404 на deep-link.
   - Решение: сохранять hash-стратегию для Pages или настраивать fallback/rewrite при смене режима.

3. **Asset paths + PWA manifest icons**
   - Сейчас: HTML-ассеты в build учитывают `base` (`/life-shield_2_0/assets/...`), это корректно.
   - Риск: в `manifest.icons[].src` используются абсолютные пути `/icons/...`; на Pages это может указывать на корень домена вместо `/<repo>/icons/...`.
   - Симптом: приложение открывается, но иконки/PWA install metadata частично ломаются (404 для icon URLs).
   - Решение: сделать пути иконок base-aware (например, через `${base}icons/...`) в отдельном техническом промте.

## Next step checklist for Prompt 1
- [ ] Подтвердить целевое имя репозитория для Pages и политику передачи `BASE` во всех окружениях.
- [ ] Отдельно решить, нужно ли править `manifest.icons` на base-aware пути.
- [ ] Согласовать, нужен ли `lint`-скрипт в `package.json` (и какой линтер/конфиг).
- [ ] Если будет работа с роутингом — зафиксировать запрет на смену hash→history без rewrite-плана.
- [ ] Любые изменения в `src/core`, `src/islands`, `src/ui/router.ts`, `vite.config.ts`, `.github/workflows/*` делать только отдельным промтом с тест-планом.
