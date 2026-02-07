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
import {
  BayesInput,
  BayesWorkerResponse,
  buildBayesCancelledReport,
  buildBayesErrorReport,
  buildBayesPendingReport,
  buildBayesReport,
  defaultBayesInput,
  parseBayesInput,
  serializeBayesInput
} from '../islands/bayes';
import {
  parseDecisionTreeInput,
  serializeDecisionTreeInput
} from '../islands/decisionTree';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

  if (id === 'bayes') {
    const parsedInput = parseBayesInput(islandState.input);
    const initialInput: BayesInput = { ...defaultBayesInput, ...parsedInput };

    form.innerHTML = `
      <div class="bayes-grid">
        <label>
          Горизонт, мес
          <input name="months" type="number" min="1" step="1" value="${initialInput.months}" />
        </label>
        <label>
          Резерв
          <input name="reserve" type="number" min="0" step="1000" value="${initialInput.reserve}" />
        </label>
        <label>
          Провал дохода, %
          <input name="shockSeverity" type="number" min="0" max="1" step="0.05" value="${initialInput.shockSeverity}" />
        </label>
        <label>
          Income mean
          <input name="incomeMean" type="number" min="0" step="1000" value="${initialInput.incomeMean}" />
        </label>
        <label>
          Income sd
          <input name="incomeSd" type="number" min="0" step="1000" value="${initialInput.incomeSd}" />
        </label>
        <label>
          Income distribution
          <select name="incomeDistribution">
            <option value="lognormal" ${
              initialInput.incomeDistribution === 'lognormal' ? 'selected' : ''
            }>lognormal</option>
            <option value="normal" ${
              initialInput.incomeDistribution === 'normal' ? 'selected' : ''
            }>normal</option>
          </select>
        </label>
        <label>
          Expenses mean
          <input name="expensesMean" type="number" min="0" step="1000" value="${initialInput.expensesMean}" />
        </label>
        <label>
          Expenses sd
          <input name="expensesSd" type="number" min="0" step="1000" value="${initialInput.expensesSd}" />
        </label>
        <label>
          Expenses distribution
          <select name="expensesDistribution">
            <option value="lognormal" ${
              initialInput.expensesDistribution === 'lognormal' ? 'selected' : ''
            }>lognormal</option>
            <option value="normal" ${
              initialInput.expensesDistribution === 'normal' ? 'selected' : ''
            }>normal</option>
          </select>
        </label>
        <label>
          Prior a
          <input name="priorA" type="number" min="0.1" step="0.1" value="${initialInput.priorA}" />
        </label>
        <label>
          Prior b
          <input name="priorB" type="number" min="0.1" step="0.1" value="${initialInput.priorB}" />
        </label>
        <label>
          Наблюдений, мес
          <input name="observationMonths" type="number" min="1" step="1" value="${initialInput.observationMonths}" />
        </label>
        <label>
          Провалов в данных
          <input name="observationFailures" type="number" min="0" step="1" value="${initialInput.observationFailures}" />
        </label>
        <label>
          MCMC samples
          <input name="mcmcSamples" type="number" min="500" step="100" value="${initialInput.mcmcSamples}" />
        </label>
        <label>
          Burn-in
          <input name="mcmcBurnIn" type="number" min="100" step="50" value="${initialInput.mcmcBurnIn}" />
        </label>
        <label>
          Step size
          <input name="mcmcStep" type="number" min="0.1" step="0.05" value="${initialInput.mcmcStep}" />
        </label>
        <label>
          Симуляций
          <input name="simulationRuns" type="number" min="500" step="100" value="${initialInput.simulationRuns}" />
        </label>
      </div>
      <div class="bayes-controls">
        <button class="button" type="submit">Запустить</button>
        <button class="button ghost" type="button" data-stop>Stop</button>
        <span class="bayes-status" data-status></span>
      </div>
    `;

    const statusLabel = form.querySelector<HTMLSpanElement>('[data-status]');
    const stopButton = form.querySelector<HTMLButtonElement>('[data-stop]');

    const worker = new Worker(
      new URL('../workers/bayes.worker.ts', import.meta.url),
      { type: 'module' }
    );
    let pendingRequestId = '';

    const readNumber = (data: FormData, name: string, fallback: number) => {
      const value = Number(data.get(name));
      return Number.isFinite(value) ? value : fallback;
    };

    const collectInput = (): BayesInput => {
      const data = new FormData(form);
      return {
        months: readNumber(data, 'months', defaultBayesInput.months),
        reserve: readNumber(data, 'reserve', defaultBayesInput.reserve),
        shockSeverity: clamp(
          readNumber(data, 'shockSeverity', defaultBayesInput.shockSeverity),
          0,
          1
        ),
        incomeMean: readNumber(data, 'incomeMean', defaultBayesInput.incomeMean),
        incomeSd: readNumber(data, 'incomeSd', defaultBayesInput.incomeSd),
        incomeDistribution: (data.get('incomeDistribution') === 'normal'
          ? 'normal'
          : 'lognormal'),
        expensesMean: readNumber(
          data,
          'expensesMean',
          defaultBayesInput.expensesMean
        ),
        expensesSd: readNumber(
          data,
          'expensesSd',
          defaultBayesInput.expensesSd
        ),
        expensesDistribution: (data.get('expensesDistribution') === 'normal'
          ? 'normal'
          : 'lognormal'),
        priorA: readNumber(data, 'priorA', defaultBayesInput.priorA),
        priorB: readNumber(data, 'priorB', defaultBayesInput.priorB),
        observationMonths: readNumber(
          data,
          'observationMonths',
          defaultBayesInput.observationMonths
        ),
        observationFailures: readNumber(
          data,
          'observationFailures',
          defaultBayesInput.observationFailures
        ),
        mcmcSamples: readNumber(data, 'mcmcSamples', defaultBayesInput.mcmcSamples),
        mcmcBurnIn: readNumber(data, 'mcmcBurnIn', defaultBayesInput.mcmcBurnIn),
        mcmcStep: readNumber(data, 'mcmcStep', defaultBayesInput.mcmcStep),
        simulationRuns: readNumber(
          data,
          'simulationRuns',
          defaultBayesInput.simulationRuns
        )
      };
    };

    worker.addEventListener('message', (event) => {
      const data = event.data as BayesWorkerResponse;
      if (data.requestId !== pendingRequestId) return;
      pendingRequestId = '';
      if (statusLabel) statusLabel.textContent = '';
      if (data.type === 'success' && data.result) {
        const report = buildBayesReport(collectInput(), data.result);
        updateIslandReport(id, report);
        islandState.lastReport = report;
      } else if (data.type === 'cancelled') {
        const report = buildBayesCancelledReport();
        updateIslandReport(id, report);
        islandState.lastReport = report;
      } else if (data.type === 'error') {
        const report = buildBayesErrorReport(
          data.error ?? 'Ошибка воркера при расчёте.'
        );
        updateIslandReport(id, report);
        islandState.lastReport = report;
      }
      renderReport();
    });

    worker.addEventListener('error', () => {
      const report = buildBayesErrorReport('Ошибка воркера при расчёте.');
      updateIslandReport(id, report);
      islandState.lastReport = report;
      pendingRequestId = '';
      if (statusLabel) statusLabel.textContent = '';
      renderReport();
    });

    stopButton?.addEventListener('click', () => {
      if (!pendingRequestId) return;
      worker.postMessage({ type: 'stop', requestId: pendingRequestId });
      if (statusLabel) statusLabel.textContent = 'Останавливаю…';
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = collectInput();
      updateIslandInput(id, serializeBayesInput(input));
      islandState.input = serializeBayesInput(input);
      const pending = buildBayesPendingReport(input);
      updateIslandReport(id, pending);
      islandState.lastReport = pending;
      renderReport();

      pendingRequestId = `${Date.now()}-${Math.random()}`;
      if (statusLabel) statusLabel.textContent = 'Считаю…';
      worker.postMessage({ type: 'run', requestId: pendingRequestId, input });
    });
  } else if (id === 'optimization') {
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
  } else if (id === 'decisionTree') {
    const parsedInput = parseDecisionTreeInput(islandState.input);

    form.innerHTML = `
      <div class="decision-tree-grid">
        <label>
          DSL/JSON дерева решений
          <textarea name="tree" rows="12">${parsedInput.treeText}</textarea>
        </label>
        <label>
          Risk aversion: <span data-risk-value>${parsedInput.settings.riskAversion}</span>
          <input
            name="riskAversion"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value="${parsedInput.settings.riskAversion}"
          />
        </label>
        <label>
          Sensitivity target (chanceId)
          <input
            name="chanceId"
            type="text"
            value="${parsedInput.settings.sensitivity.chanceId}"
          />
        </label>
        <label>
          Sensitivity outcome label
          <input
            name="outcomeLabel"
            type="text"
            value="${parsedInput.settings.sensitivity.outcomeLabel}"
          />
        </label>
        <label>
          Sensitivity ±% по вероятности
          <input
            name="deltaPercent"
            type="number"
            min="0"
            max="100"
            step="1"
            value="${parsedInput.settings.sensitivity.deltaPercent}"
          />
        </label>
      </div>
      <button class="button" type="submit">Рассчитать</button>
    `;

    const riskValue = form.querySelector<HTMLSpanElement>('[data-risk-value]');
    const riskInput = form.querySelector<HTMLInputElement>('[name="riskAversion"]');

    riskInput?.addEventListener('input', () => {
      if (riskValue && riskInput) {
        riskValue.textContent = Number(riskInput.value).toFixed(2);
      }
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
      <div class="result-summary">${report.summary}</div>
      <ul>${report.details.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;
  };

  renderReport();

  if (id !== 'optimization') {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      if (id === 'decisionTree') {
        const treeText = String(data.get('tree') ?? '');
        const settings = {
          riskAversion: clamp(Number(data.get('riskAversion') ?? 0), 0, 1),
          sensitivity: {
            chanceId: String(data.get('chanceId') ?? '').trim(),
            outcomeLabel: String(data.get('outcomeLabel') ?? '').trim(),
            deltaPercent: clamp(
              Number(data.get('deltaPercent') ?? 0),
              0,
              100
            )
          }
        };
        const input = serializeDecisionTreeInput(treeText, settings);
        updateIslandInput(id, input);
        const report = island.getReport(input);
        updateIslandReport(id, report);
        islandState.input = input;
        islandState.lastReport = report;
        renderReport();
        return;
      }

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
