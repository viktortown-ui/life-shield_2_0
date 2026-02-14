# Prompt 14 — Turbulence Engine

## Что добавлено

Единый архитектурный слой `src/core/turbulence/`, который агрегирует сигналы риска/неопределённости в общий индекс для Cosmos/экранов.

## Источники сигналов

- `stressTestMonteCarlo` (`sources/stressTestMonteCarlo.ts`)
  - Использует `ruinProb`, `p10/p50/p90`, и drift по `mcHistory`.
- `cashflowForecast` (`sources/cashflowForecast.ts`)
  - Использует `probNetNegative`, `uncertainty`, `disagreementScore`, `p10/p50/p90`.
- `cashflowDrift` (`sources/cashflowDrift.ts`)
  - Использует `cashflowDriftLast`.
- `freshness` (`sources/freshness.ts`)
  - Штраф за устаревание данных по времени последнего расчёта.

Каждый source получает `AppState` и возвращает `TurbulenceSignal | null`.

## Формат TurbulenceSignal

- `id`, `label`
- `score` (0..1)
- `confidence` (0..1)
- `ts` и/или `ym`
- `explanation`
- `evidence` (ключевые числовые факты для UI)

## Формула агрегации

`computeTurbulence(state)`:

1. Собирает все доступные сигналы.
2. Применяет веса из `config.ts`:
   - MC: 0.40
   - cashflow forecast: 0.30
   - cashflow drift: 0.20
   - freshness: 0.10
3. Если часть сигналов недоступна, веса **renormalize** на доступные.
4. `overallScore = Σ(score_i * weight_i)`.
5. `overallConfidence = average(confidence_i)`.
6. Если сигналов нет: `overallScore=0`, `overallConfidence=0`.

## Как читать score/confidence

- `score` — интенсивность турбулентности (0=штиль, 1=максимум).
- `confidence` — надёжность сигнала в зависимости от объёма данных/истории.
- `overallScore` в Cosmos используется для halo/intensity.

## Как добавить новый source

1. Создать `src/core/turbulence/sources/<newSource>.ts`.
2. Экспортировать функцию формата `(state: AppState) => TurbulenceSignal | null`.
3. Добавить вес в `TURBULENCE_SOURCE_WEIGHTS`.
4. Подключить source в `SIGNAL_GETTERS` в `src/core/turbulence/index.ts`.
5. Добавить/обновить unit-тесты на агрегацию и renormalize.
