import {
  addCashflowObservationMonth,
  clearCashflowObservations,
  getState,
  removeCashflowObservationMonth,
  setCashflowForecastLast,
  upsertCashflowObservation
} from '../core/store';
import {
  CashflowForecastResult,
  CashflowForecastWorkerResponse
} from '../workers/cashflowForecast';
import { computeTurbulence } from '../core/turbulence';

const FORECAST_MIN_MONTHS = 6;
const FORECAST_ITERATIONS = 2000;
const FORECAST_SEED = 42;

const getDisagreementLabel = (score: number) => {
  if (score >= 0.66) return 'низкое';
  if (score >= 0.33) return 'среднее';
  return 'высокое';
};

const toAmount = (value: string): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, num);
};

const getDriftLevelLabel = (score: number) => {
  if (score >= 0.75) return 'высокий';
  if (score >= 0.5) return 'средний';
  return 'низкий';
};

const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString('ru-RU')}`;

const buildNetSparkline = (values: number[], ariaLabel: string, className = 'history-sparkline') => {
  if (!values.length) {
    return '<p class="muted">Нет данных для мини-графика.</p>';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return `
    <svg viewBox="0 0 100 100" class="${className}" role="img" aria-label="${ariaLabel}">
      <polyline points="${points}"></polyline>
    </svg>
  `;
};

const buildIntervalBar = (p10: number, p50: number, p90: number, className = 'cosmos-interval') => {
  const span = Math.max(1, p90 - p10);
  const medianPos = Math.max(0, Math.min(100, ((p50 - p10) / span) * 100));
  return `<div class="${className}" role="img" aria-label="Интервал p10-p90 и медиана p50"><span class="cosmos-interval-range" style="left:0%;width:100%"></span><span class="cosmos-interval-median" style="left:${medianPos}%"></span></div>`;
};

export const createHistoryScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen history-screen';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>История</h1>
      <p>Доход/расход по месяцам. Основа для будущих прогнозов по данным наблюдений.</p>
    </div>
  `;

  const quickForm = document.createElement('form');
  quickForm.className = 'island-form history-quick-form';

  const tableWrap = document.createElement('section');
  tableWrap.className = 'history-table-wrap';

  const summary = document.createElement('section');
  summary.className = 'quest-card';

  const forecastCard = document.createElement('section');
  forecastCard.className = 'quest-card history-forecast-card';

  let selectedHorizon = 3;
  let forecastMode: 'single' | 'ensemble' = 'ensemble';
  let isRunning = false;

  const render = () => {
    const state = getState();
    const rows = state.observations.cashflowMonthly;
    const latest = rows.at(-1);

    quickForm.innerHTML = `
      <div class="bayes-grid">
        <label>
          Месяц
          <input name="ym" type="month" value="${latest?.ym ?? ''}" required />
        </label>
        <label>
          Доход
          <input name="income" type="number" min="0" step="1000" value="${latest?.income ?? 0}" />
        </label>
        <label>
          Расход
          <input name="expense" type="number" min="0" step="1000" value="${latest?.expense ?? 0}" />
        </label>
        <label>
          Net
          <input name="net" type="number" value="${(latest?.income ?? 0) - (latest?.expense ?? 0)}" readonly />
        </label>
      </div>
      <div class="screen-actions">
        <button class="button" type="submit">Сохранить месяц</button>
        <button class="button ghost" type="button" data-action="add-month">+ месяц</button>
        <button class="button ghost" type="button" data-action="clear">очистить</button>
      </div>
    `;

    const recentRows = rows.slice(-24).slice().reverse();
    tableWrap.innerHTML = `
      <table class="history-table">
        <thead>
          <tr><th>Месяц</th><th>Доход</th><th>Расход</th><th>Net</th><th></th></tr>
        </thead>
        <tbody>
          ${
            recentRows.length
              ? recentRows
                  .map(
                    (row) => `<tr>
                      <td>${row.ym}</td>
                      <td>${row.income.toLocaleString('ru-RU')}</td>
                      <td>${row.expense.toLocaleString('ru-RU')}</td>
                      <td>${(row.income - row.expense).toLocaleString('ru-RU')}</td>
                      <td><button class="button ghost" type="button" data-remove="${row.ym}">удалить</button></td>
                    </tr>`
                  )
                  .join('')
              : '<tr><td colspan="5" class="muted">Пока нет данных.</td></tr>'
          }
        </tbody>
      </table>
    `;

    const recentForSpark = rows.slice(-12);
    const sparkValues = recentForSpark.map((row) => row.income - row.expense);
    const turbulence = computeTurbulence(state);
    const keySignals = turbulence.signals
      .filter((signal) => signal.id === 'cashflowDrift' || signal.id === 'cashflowForecast' || signal.id === 'freshness')
      .slice(0, 3);
    const turbulenceBlock = `<div class="history-turbulence"><p><strong>Индекс турбулентности:</strong> ${(
      turbulence.overallScore * 100
    ).toFixed(0)}% · confidence ${(turbulence.overallConfidence * 100).toFixed(0)}%</p>${
      keySignals.length
        ? `<ul>${keySignals
            .map((signal) => `<li>${signal.label}: ${(signal.score * 100).toFixed(0)}% — ${signal.explanation}</li>`)
            .join('')}</ul>`
        : '<p class="muted">Сигналы пока недоступны.</p>'
    }</div>`;
    const drift = state.observations.cashflowDriftLast;
    const driftAlert =
      drift?.detected
        ? `<div class="history-drift-alert"><strong>Смена режима net cashflow обнаружена.</strong><p>Месяц: ${drift.ym ?? '—'} · уровень: ${getDriftLevelLabel(
            drift.score
          )} (${(drift.score * 100).toFixed(0)}%)</p></div>`
        : '';
    summary.innerHTML = `
      <h3>Net за 12 месяцев</h3>
      ${buildNetSparkline(sparkValues, 'Динамика net за 12 месяцев')}
      ${driftAlert}
      ${turbulenceBlock}
      <p class="muted">данных: ${rows.length} месяцев</p>
    `;

    const forecast = state.observations.cashflowForecastLast;
    const netSeries = rows.slice(-24).map((row) => row.income - row.expense).filter((item) => Number.isFinite(item));
    const enoughData = netSeries.length >= FORECAST_MIN_MONTHS;
    const horizonControls = [3, 6, 12]
      .map((value) => `<button type="button" class="button ghost small ${selectedHorizon === value ? 'is-selected' : ''}" data-horizon="${value}">${value}м</button>`)
      .join('');
    const modeControls = [
      { id: 'single', label: 'Быстрый (1 метод)' },
      { id: 'ensemble', label: 'Надёжный (ансамбль)' }
    ]
      .map((item) => `<button type="button" class="button ghost small ${forecastMode === item.id ? 'is-selected' : ''}" data-mode="${item.id}">${item.label}</button>`)
      .join('');
    const forecastBody =
      forecast && forecast.horizonMonths === selectedHorizon && (forecast.paramsUsed.mode ?? 'single') === forecastMode
        ? `<p>Риск отрицательного net на горизонте: <strong>${(forecast.probNetNegative * 100).toFixed(1)}%</strong></p>
           <p>p10/p50/p90: <strong>${formatSigned(forecast.quantiles.p10)} / ${formatSigned(forecast.quantiles.p50)} / ${formatSigned(forecast.quantiles.p90)}</strong></p>
           <p>Uncertainty (норм.): <strong>${forecast.uncertainty.toFixed(2)}</strong></p>
           <p>Согласие моделей: <strong>${getDisagreementLabel(forecast.disagreementScore ?? 0)}</strong> (${Math.round((forecast.disagreementScore ?? 0) * 100)}%)</p>
           <p class="muted">Когда модели спорят, доверие к медиане ниже.</p>
           ${buildIntervalBar(forecast.quantiles.p10, forecast.quantiles.p50, forecast.quantiles.p90, 'history-interval')}
           <div class="history-forecast-spark">${buildNetSparkline(
             forecast.monthly.map((row) => row.p50),
             'Медианный прогноз net по месяцам',
             'history-sparkline history-sparkline--forecast'
           )}</div>`
        : `<p class="muted">${
            enoughData
              ? 'Запустите прогноз, чтобы получить p10/p50/p90.'
              : 'Для прогноза нужно >=6 месяцев наблюдений.'
          }</p>`;

    forecastCard.innerHTML = `
      <h3>Прогноз net cashflow</h3>
      <div class="history-forecast-actions">
        <div class="history-horizon-switch">${horizonControls}</div>
        <div class="history-horizon-switch">${modeControls}</div>
        <button class="button" type="button" data-action="run-forecast" ${!enoughData || isRunning ? 'disabled' : ''}>${
          isRunning ? 'Считаем…' : 'Запустить прогноз'
        }</button>
      </div>
      ${forecastBody}
      <p class="muted">Bootstrap sampling, ${FORECAST_ITERATIONS} траекторий. Режим: ${forecastMode === 'ensemble' ? 'ensemble' : 'single'}.</p>
    `;

    const incomeEl = quickForm.querySelector<HTMLInputElement>('input[name="income"]');
    const expenseEl = quickForm.querySelector<HTMLInputElement>('input[name="expense"]');
    const netEl = quickForm.querySelector<HTMLInputElement>('input[name="net"]');
    const syncNet = () => {
      if (!incomeEl || !expenseEl || !netEl) return;
      netEl.value = String(toAmount(incomeEl.value) - toAmount(expenseEl.value));
    };
    incomeEl?.addEventListener('input', syncNet);
    expenseEl?.addEventListener('input', syncNet);

    quickForm.querySelector<HTMLButtonElement>('[data-action="add-month"]')?.addEventListener('click', () => {
      addCashflowObservationMonth();
      render();
    });

    quickForm.querySelector<HTMLButtonElement>('[data-action="clear"]')?.addEventListener('click', () => {
      clearCashflowObservations();
      render();
    });

    tableWrap.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        removeCashflowObservationMonth(button.dataset.remove ?? '');
        render();
      });
    });

    forecastCard.querySelectorAll<HTMLButtonElement>('[data-horizon]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedHorizon = Number(button.dataset.horizon) || 3;
        render();
      });
    });

    forecastCard.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        forecastMode = (button.dataset.mode === 'single' ? 'single' : 'ensemble');
        render();
      });
    });

    forecastCard.querySelector<HTMLButtonElement>('[data-action="run-forecast"]')?.addEventListener('click', async () => {
      const currentRows = getState().observations.cashflowMonthly;
      const series = currentRows.slice(-24).map((row) => row.income - row.expense).filter((item) => Number.isFinite(item));
      if (series.length < FORECAST_MIN_MONTHS) return;

      isRunning = true;
      render();

      const worker = new Worker(new URL('../workers/cashflowForecast.worker.ts', import.meta.url), { type: 'module' });
      const requestId = `${Date.now()}-${Math.random()}`;
      const result = await new Promise<CashflowForecastResult>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<CashflowForecastWorkerResponse>) => {
          if (event.data.requestId !== requestId) return;
          if (event.data.error || !event.data.result) {
            reject(new Error(event.data.error ?? 'Не удалось построить прогноз.'));
            return;
          }
          resolve(event.data.result);
        };
        worker.onerror = () => reject(new Error('Ошибка worker прогноза cashflow.'));
        worker.postMessage({ requestId, input: { netSeries: series, horizonMonths: selectedHorizon, iterations: FORECAST_ITERATIONS, seed: FORECAST_SEED, mode: forecastMode } });
      }).finally(() => {
        worker.terminate();
      });

      setCashflowForecastLast({
        ts: new Date().toISOString(),
        horizonMonths: result.horizonMonths,
        paramsUsed: { iterations: result.iterations, seed: FORECAST_SEED, sourceMonths: result.sourceMonths, mode: forecastMode },
        probNetNegative: result.probNetNegative,
        quantiles: result.quantiles,
        uncertainty: result.uncertainty,
        methodsUsed: result.methodsUsed,
        disagreementScore: result.disagreementScore,
        perMethodSummary: result.perMethodSummary,
        monthly: result.monthly
      });

      isRunning = false;
      render();
    });
  };

  quickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(quickForm);
    const ym = String(data.get('ym') ?? '').trim();
    if (!ym) return;
    upsertCashflowObservation({
      ym,
      income: toAmount(String(data.get('income') ?? '0')),
      expense: toAmount(String(data.get('expense') ?? '0'))
    });
    render();
  });

  render();
  container.append(header, quickForm, tableWrap, summary, forecastCard);
  return container;
};
