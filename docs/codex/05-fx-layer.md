# Prompt 5 — Cosmos FX Layer

## Добавленные визуальные эффекты
- **Twinkle/shine планет**: мягкая анимация opacity/scale с рандомной фазой, чтобы планеты не мерцали синхронно.
- **Halo pulse**: при включённом halo добавлена плавная пульсация интенсивности.
- **Spark burst**: при подтверждении действия в radial/marking-menu показывается короткий всплеск частиц (6–12 SVG circles, ~300–500ms) вокруг планеты.

## Sound FX (SFX)
- Добавлен лёгкий синтез звуков на **Web Audio API** (без внешних аудио-ассетов).
- Реализованы короткие сигналы:
  - select planet
  - open menu
  - confirm action
  - cancel/close
- **Unlock policy**:
  - пока не было user gesture, звук не воспроизводится;
  - на первом pointer/tap в Cosmos выполняется `audio.unlock()` (`AudioContext.resume()`), после этого SFX доступны.

## Настройки
- Добавлены флаги Cosmos FX:
  - `Sound FX` (on/off)
  - `Volume` (0..1)
  - `Reduce motion override` (ручной override)
- Значения сохраняются в существующем store-флагах Cosmos (`setCosmosUiFlags`).

## prefers-reduced-motion
- Если активен `prefers-reduced-motion` (или включён ручной override), тяжёлые эффекты сокращаются:
  - выключаются пульсации и всплески частиц;
  - остаются базовые статические подсветки и fade/outline.
