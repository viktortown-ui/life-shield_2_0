# Prompt 6 — Cosmos history, event signals, SFX power save

## Activity log
- Добавлен persisted `cosmosActivityLog` (FIFO, максимум 200 записей).
- Формат события: `{ ts, islandId, action, meta? }`.
- `action`: `open`, `data`, `report`, `confirm`, `cancel`.
- Лог пишется при переходах из Cosmos (open/data/report), подтверждениях в radial/marking-menu (confirm) и отменах (cancel).
- Добавлена мягкая миграция `schemaVersion: 8`: если лог отсутствует — создаётся пустой.

## Constellation trails
- У каждой планеты рисуется 0–5 точек истории (`clamp 0..5`) по орбитальному направлению.
- Количество точек = число событий за последние 7 дней.
- Прозрачность трейла зависит от свежести последнего события: чем новее — тем ярче.
- Для выбранной планеты показывается панель «Последние действия» (до 5 строк).

## Event comets
- Для планет со статусом `RISK` и плохой свежестью (давно не трогали) запускается редкая комета.
- Частота ограничена (`setInterval`, раз в N секунд), одновременно максимум 1 комета.
- Длительность пролёта ~600–900ms (в реализации ~820ms).

## SFX power save
- Если `Sound FX` выключен — `AudioContext` переводится в `suspend`.
- При `visibilitychange` (скрытая вкладка) — `suspend`.
- При следующем user gesture и включенном SFX — `resume/unlock`.

## Reduced motion
- При `prefers-reduced-motion` (или override) отключаются анимированные кометы.
- Частицы/трейлы остаются статичными без анимации.
