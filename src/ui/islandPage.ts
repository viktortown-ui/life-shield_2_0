import { findIsland } from '../core/registry';
import { getState, updateIslandInput, updateIslandReport } from '../core/store';
import { IslandId } from '../core/types';
import {
  OptimizationActionInput,
  OptimizationInput,
  OptimizationWorkerResponse,
  buildOptimizationPendingReport,
  buildOptimizationReport,
  defaultOptimizationInput,
  parseOptimizationInput,
  serializeOptimizationInput
} from '../islands/optimization';

export const createIslandPage = (id: IslandId) => {
  const island = findIsland(id);
  const state = getState();
  const islandState = state.islands[id];

  const container = document.createElement('div');
  container.className = 'screen island';

  if (!island) {
    container.innerHTML = '<p>Остров не найден.</p>';
    return container;
  }

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>${island.title}</h1>
      <p>${island.description}</p>
    </div>
  `;

  const form = document.createElement('form');
  form.className = 'island-form';

  if (id === 'optimization') {
    const parsedInput = parseOptimizationInput(islandState.input);
    const initialInput: OptimizationInput = {
      ...defaultOptimizationInput,
      ...parsedInput
    };
    const actionRows = document.createElement('div');
    actionRows.className = 'optimization-actions';

    const renderActions = (actions: OptimizationActionInput[]) => {
      actionRows.innerHTML = actions
        .map(
          (action, index) => `
          <div class="optimization-row" data-index="${index}">
            <input name="action-name-${index}" type="text" value="${action.name}" placeholder="Действие" />
            <input name="action-hours-${index}" type="number" min="0" step="1" value="${action.hoursCost}" />
            <input name="action-money-${index}" type="number" min="0" step="1" value="${action.moneyCost}" />
            <input name="action-impact-${index}" type="number" min="0" step="1" value="${action.impactScore}" />
            <label class="optimization-mandatory">
              <input name="action-mandatory-${index}" type="checkbox" ${
                action.mandatory ? 'checked' : ''
              } />
              mandatory
            </label>
            <button class="button ghost" type="button" data-remove="${index}">Удалить</button>
          </div>
        `
        )
        .join('');
    };

    renderActions(initialInput.actions);

    form.innerHTML = `
      <div class="optimization-grid">
        <label>
          weeklyBudgetHours
          <input name="weeklyBudgetHours" type="number" min="1" step="1" value="${initialInput.weeklyBudgetHours}" />
        </label>
        <label>
          maxHours
          <input name="maxHours" type="number" min="0" step="1" value="${initialInput.maxHours}" />
        </label>
        <label>
          maxMoney
          <input name="maxMoney" type="number" min="0" step="1" value="${initialInput.maxMoney}" />
        </label>
      </div>
      <div class="optimization-header">
        <span>Действия</span>
        <span class="optimization-columns">hoursCost / moneyCost / impactScore</span>
      </div>
    `;

    form.appendChild(actionRows);

    const controls = document.createElement('div');
    controls.className = 'optimization-controls';
    controls.innerHTML = `
      <button class="button ghost" type="button" data-add-action>Добавить действие</button>
      <button class="button" type="submit">Решить</button>
      <span class="optimization-status" data-status></span>
    `;
    form.appendChild(controls);

    const collectActions = (): OptimizationActionInput[] => {
      const rows = Array.from(
        actionRows.querySelectorAll<HTMLDivElement>('.optimization-row')
      );
      return rows.map((row, index) => {
        const name = row.querySelector<HTMLInputElement>(
          `[name="action-name-${index}"]`
        );
        const hours = row.querySelector<HTMLInputElement>(
          `[name="action-hours-${index}"]`
        );
        const money = row.querySelector<HTMLInputElement>(
          `[name="action-money-${index}"]`
        );
        const impact = row.querySelector<HTMLInputElement>(
          `[name="action-impact-${index}"]`
        );
        const mandatory = row.querySelector<HTMLInputElement>(
          `[name="action-mandatory-${index}"]`
        );

        return {
          name: name?.value.trim() || 'Без названия',
          hoursCost: Number(hours?.value ?? 0),
          moneyCost: Number(money?.value ?? 0),
          impactScore: Number(impact?.value ?? 0),
          mandatory: Boolean(mandatory?.checked)
        };
      });
    };

    const statusLabel = controls.querySelector<HTMLSpanElement>(
      '[data-status]'
    );

    const worker = new Worker(
      new URL('../workers/opt.worker.ts', import.meta.url),
      { type: 'module' }
    );
    let pendingRequestId = '';

    form.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('[data-add-action]')) {
        const actions = collectActions();
        actions.push({
          name: '',
          hoursCost: 0,
          moneyCost: 0,
          impactScore: 0,
          mandatory: false
        });
        renderActions(actions);
      }
      if (target.matches('[data-remove]')) {
        const index = Number(target.getAttribute('data-remove'));
        const actions = collectActions().filter((_, idx) => idx !== index);
        renderActions(actions.length ? actions : initialInput.actions);
      }
    });

    worker.addEventListener('message', (event) => {
      const data = event.data as OptimizationWorkerResponse;
      if (data.requestId !== pendingRequestId) return;
      const report = buildOptimizationReport(
        parseOptimizationInput(islandState.input),
        data.solution
      );
      updateIslandReport(id, report);
      islandState.lastReport = report;
      pendingRequestId = '';
      if (statusLabel) statusLabel.textContent = '';
      renderReport();
    });

    worker.addEventListener('error', () => {
      const report = buildOptimizationReport(
        parseOptimizationInput(islandState.input),
        {
          status: 'error',
          selected: [],
          totalImpact: 0,
          totalHours: 0,
          totalMoney: 0,
          error: 'Ошибка воркера при расчёте.'
        }
      );
      updateIslandReport(id, report);
      islandState.lastReport = report;
      pendingRequestId = '';
      if (statusLabel) statusLabel.textContent = '';
      renderReport();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const weeklyBudgetHours = Number(
        data.get('weeklyBudgetHours') ?? defaultOptimizationInput.weeklyBudgetHours
      );
      const maxHours = Number(
        data.get('maxHours') ?? defaultOptimizationInput.maxHours
      );
      const maxMoney = Number(
        data.get('maxMoney') ?? defaultOptimizationInput.maxMoney
      );
      const actions = collectActions();

      const input: OptimizationInput = {
        weeklyBudgetHours,
        maxHours,
        maxMoney,
        actions
      };

      updateIslandInput(id, serializeOptimizationInput(input));
      islandState.input = serializeOptimizationInput(input);
      const pending = buildOptimizationPendingReport(input);
      updateIslandReport(id, pending);
      islandState.lastReport = pending;
      renderReport();

      pendingRequestId = `${Date.now()}-${Math.random()}`;
      if (statusLabel) statusLabel.textContent = 'Решаю…';
      worker.postMessage({ requestId: pendingRequestId, input });
    });
  } else {
    form.innerHTML = `
      <label>
        ${island.inputLabel}
        <textarea name="input" rows="6" placeholder="${island.placeholder}">${islandState.input}</textarea>
      </label>
      <button class="button" type="submit">Сохранить</button>
    `;
  }

  const result = document.createElement('section');
  result.className = 'island-result';

  const renderReport = () => {
    const report = islandState.lastReport ?? island.getReport(islandState.input);
    result.innerHTML = `
      <div class="result-metrics">
        <div><span>Score</span><strong>${report.score}</strong></div>
        <div><span>Confidence</span><strong>${report.confidence}%</strong></div>
      </div>
      <h2>${report.headline}</h2>
      <p>${report.summary}</p>
      <ul>${report.details.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;
  };

  renderReport();

  if (id !== 'optimization') {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const input = String(data.get('input') ?? '');
      updateIslandInput(id, input);
      const report = island.getReport(input);
      updateIslandReport(id, report);
      islandState.input = input;
      islandState.lastReport = report;
      renderReport();
    });
  }

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/">К щиту</a>
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(header, form, result, actions);
  return container;
};
