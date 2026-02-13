# AGENTS.md

## Быстрые команды
- Install: `npm ci` (fallback: `npm install`)
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Lint: `npm run lint` (если скрипт добавлен в `package.json`)
- Test: `npm test`

## Карта проекта
- `src/core` — доменная логика, модели, state/store, миграции, диагностика.
- `src/ui` — экраны, роутер, UI-компоненты и связка экранов.
- `src/islands` — вычислительные «острова» и аналитические модули.
- `src/workers` — web workers для тяжёлых вычислений.
- `src/styles` — стили приложения.
- `public` — статические ассеты (иконки, файлы для PWA).
- `.github/workflows` — CI/CD и деплой (включая GitHub Pages).

## Границы изменений без отдельного промта
Без отдельного явного запроса не изменять:
- расчётные формулы и алгоритмы в `src/core` / `src/islands`;
- storage/миграции/форматы данных пользователя;
- роутинг и URL-стратегию (hash/history, публичные пути);
- конфиги деплоя и публикации (GitHub Actions, Vite `base`, PWA конфиг);
- поведение офлайн/PWA/Service Worker.

## Git-правила
- Маленькие атомарные изменения.
- Один промт = один коммит/PR.
- Сообщения коммитов в формате: `chore(docs): ...` для документационных шагов.
