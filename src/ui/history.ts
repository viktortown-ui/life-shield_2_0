import {
  addCashflowObservationMonth,
  clearCashflowObservations,
  getState,
  removeCashflowObservationMonth,
  upsertCashflowObservation
} from '../core/store';

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

const buildNetSparkline = (values: number[], driftIndex: number | null) => {
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

  const marker =
    driftIndex !== null && driftIndex >= 0 && driftIndex < values.length
      ? (() => {
          const x = values.length === 1 ? 0 : (driftIndex / (values.length - 1)) * 100;
          return `<line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="100" class="history-sparkline-marker"></line>`;
        })()
      : '';

  return `
    <svg viewBox="0 0 100 100" class="history-sparkline" role="img" aria-label="Динамика net за 12 месяцев">
      <polyline points="${points}"></polyline>
      ${marker}
    </svg>
  `;
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
    const drift = state.observations.cashflowDriftLast;
    const driftIndex = drift?.ym ? recentForSpark.findIndex((row) => row.ym === drift.ym) : -1;
    const driftAlert =
      drift?.detected
        ? `<div class="history-drift-alert"><strong>Смена режима net cashflow обнаружена.</strong><p>Месяц: ${drift.ym ?? '—'} · уровень: ${getDriftLevelLabel(
            drift.score
          )} (${(drift.score * 100).toFixed(0)}%)</p></div>`
        : '';
    summary.innerHTML = `
      <h3>Net за 12 месяцев</h3>
      ${buildNetSparkline(sparkValues, driftIndex >= 0 ? driftIndex : null)}
      ${driftAlert}
      <p class="muted">данных: ${rows.length} месяцев</p>
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
  container.append(header, quickForm, tableWrap, summary);
  return container;
};
