import { FinanceInputData } from '../core/types';
import { getState, runBaseFinanceAnalysis, saveFinanceInput } from '../core/store';

const toNonNegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

const readFinanceForm = (form: HTMLFormElement): FinanceInputData => {
  const data = new FormData(form);
  const read = (name: string) => Number(data.get(name));

  return {
    monthlyIncome: toNonNegative(read('monthlyIncome')),
    monthlyExpenses: toNonNegative(read('monthlyExpenses')),
    reserveCash: toNonNegative(read('reserveCash')),
    monthlyDebtPayment: toNonNegative(read('monthlyDebtPayment')),
    incomeSourcesCount: Math.max(1, Math.round(toNonNegative(read('incomeSourcesCount'))))
  };
};

const renderFinanceWarnings = (target: HTMLElement, finance: FinanceInputData) => {
  const warnings: string[] = [];
  if (finance.monthlyExpenses === 0) {
    warnings.push('Расходы равны 0. Это допустимо, но расчёты устойчивости будут условными.');
  }

  if (warnings.length === 0) {
    target.innerHTML = '';
    return;
  }

  target.innerHTML = warnings.map((warning) => `<p>${warning}</p>`).join('');
};

export const createFinanceScreen = () => {
  const state = getState();
  const finance = state.inputData.finance;

  const container = document.createElement('div');
  container.className = 'screen finance-screen';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Финансы</h1>
      <p>Один ввод для трёх базовых островов: Снимок, Стресс-тест и Портфель доходов.</p>
    </div>
  `;

  const form = document.createElement('form');
  form.className = 'island-form';
  form.innerHTML = `
    <label>
      Доход в месяц
      <input name="monthlyIncome" type="number" min="0" step="1000" value="${finance.monthlyIncome}" required />
    </label>
    <label>
      Расходы в месяц
      <input name="monthlyExpenses" type="number" min="0" step="1000" value="${finance.monthlyExpenses}" required />
    </label>
    <label>
      Резерв (кэш)
      <input name="reserveCash" type="number" min="0" step="1000" value="${finance.reserveCash}" required />
    </label>
    <label>
      Платежи по долгам в месяц
      <input name="monthlyDebtPayment" type="number" min="0" step="1000" value="${finance.monthlyDebtPayment}" required />
    </label>
    <label>
      Кол-во источников дохода
      <input name="incomeSourcesCount" type="number" min="1" step="1" value="${finance.incomeSourcesCount}" required />
    </label>
    <div class="screen-actions">
      <button class="button ghost" type="button" data-action="save">Сохранить</button>
      <button class="button" type="submit">Запустить анализ</button>
    </div>
    <div class="report-status" data-status></div>
    <div class="quest-card" data-warnings></div>
  `;

  const status = form.querySelector<HTMLElement>('[data-status]');
  const warnings = form.querySelector<HTMLElement>('[data-warnings]');
  const saveButton = form.querySelector<HTMLButtonElement>('[data-action="save"]');

  if (warnings) {
    renderFinanceWarnings(warnings, finance);
  }

  saveButton?.addEventListener('click', () => {
    const nextFinance = readFinanceForm(form);
    saveFinanceInput(nextFinance);
    if (warnings) {
      renderFinanceWarnings(warnings, nextFinance);
    }
    if (status) {
      status.textContent = 'Данные сохранены.';
      window.setTimeout(() => {
        if (status.textContent === 'Данные сохранены.') {
          status.textContent = '';
        }
      }, 1400);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextFinance = readFinanceForm(form);
    runBaseFinanceAnalysis(nextFinance);
    if (warnings) {
      renderFinanceWarnings(warnings, nextFinance);
    }
    window.location.hash = '#/report';
  });

  container.append(header, form);
  return container;
};
