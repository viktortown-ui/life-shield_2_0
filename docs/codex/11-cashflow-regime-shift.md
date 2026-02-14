# Prompt 11 — Cashflow regime shift (History + Cosmos)

## Что это
Сигнал смены режима строится по **реальной истории observations.cashflowMonthly** через серию:

- `net = income - expense`
- сортировка по `ym`
- берутся последние N наблюдений (до 36)

Далее применяется лёгкий Page-Hinkley/CUSUM-style детектор к нормализованной серии `net`.

## Что сохраняется
В `observations` сохраняется последний расчёт:

- `cashflowDriftLast.detected` — найдена ли смена режима
- `cashflowDriftLast.score` — сила сигнала `0..1`
- `cashflowDriftLast.ym` — месяц срабатывания
- `cashflowDriftLast.ts` — время расчёта
- `cashflowDriftLast.paramsUsed` — параметры детектора

## Параметры MVP
- `delta = 0.03`
- `lambda = 4.2`
- `minN = 8`

Если наблюдений меньше `minN`, сигнал не генерируется.

## Интерпретация
- Это **сигнал**, а не доказанная причина.
- Он показывает, что распределение net cashflow статистически сместилось.
- Требует доменной проверки: что изменилось (доход, расходы, сезонность, разовые события).

## UI-использование
- `#/history`: предупреждение «Смена режима net cashflow обнаружена», месяц и уровень (низкий/средний/высокий), плюс маркер месяца на sparkline.
- `Cosmos/history`: badge `RISK`, если `detected=true` и `score >= 0.5`; halo history учитывает drift score как источник турбулентности.
