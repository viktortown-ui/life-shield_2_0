import { findIsland } from '../core/registry';
import { parseFinanceInput } from '../islands/finance';
import {
  getState,
  updateIslandInput,
  updateIslandMonteCarlo,
  updateIslandReport
} from '../core/store';
import { IslandId } from '../core/types';
import { reportCaughtError } from '../core/reportError';
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
  DecisionTreeActionInput,
  DecisionTreeInput,
  DecisionTreeOutcomeInput,
  parseDecisionTreeInput,
  serializeDecisionTreeInput
} from '../islands/decisionTree';
import {
  CausalDagInput,
  defaultCausalDagInput,
  parseCausalDagInput,
  serializeCausalDagInput
} from '../islands/causalDag';
import {
  TimeseriesAnalysisBundle,
  TimeseriesInput,
  TimeseriesWorkerResponse,
  buildTimeseriesReport,
  parseTimeseriesInput,
  parseTimeseriesSeries,
  serializeTimeseriesInput
} from '../islands/timeseries';

import {
  MonteCarloRunwayInput,
  MonteCarloWorkerResponse,
  getDeterministicRunwayMonths
} from '../islands/stressMonteCarlo';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const buildIslandErrorReport = (id: IslandId, error: unknown) => ({
  id,
  score: 0,
  confidence: 0,
  headline: 'Ошибка острова',
  summary:
    error instanceof Error
      ? error.message
      : 'Остров не смог сформировать отчёт.',
  details: ['Попробуйте обновить страницу или повторить ввод.']
});

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

  const safeGetReport = (input: string) => {
    try {
      return island.getReport(input);
    } catch (error) {
      reportCaughtError(error);
      return buildIslandErrorReport(id, error);
    }
  };

  if (id === 'bayes') {
    const parsedInput = parseBayesInput(islandState.input);
    const initialInput: BayesInput = { ...defaultBayesInput, ...parsedInput };

    form.innerHTML = `
      <div class="island-intro">
        <p>Быстрый ввод: только ключевые поля для первого результата.</p>
      </div>
      <div class="bayes-grid">
        <label>
          Доход в месяц
          <input name="incomeMean" type="number" min="0" step="1000" value="${initialInput.incomeMean}" />
        </label>
        <label>
          Расходы в месяц
          <input name="expensesMean" type="number" min="0" step="1000" value="${initialInput.expensesMean}" />
        </label>
        <label>
          Резерв
          <input name="reserve" type="number" min="0" step="1000" value="${initialInput.reserve}" />
        </label>
        <label>
          Горизонт, мес
          <input name="months" type="number" min="1" step="1" value="${initialInput.months}" />
        </label>
      </div>
      <details class="island-advanced">
        <summary>Расширенные настройки</summary>
        <div class="bayes-grid">
          <label>
            Провал дохода, %
            <input name="shockSeverity" type="number" min="0" max="1" step="0.05" value="${initialInput.shockSeverity}" />
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
            <input name="mcmcStep" type="number" min="0.05" max="1" step="0.01" value="${initialInput.mcmcStep}" />
          </label>
          <label>
            Симуляций
            <input name="simulationRuns" type="number" min="500" step="100" value="${initialInput.simulationRuns}" />
          </label>
        </div>
      </details>
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
    const initialInput = parseDecisionTreeInput(islandState.input);
    const actionRows = document.createElement('div');
    actionRows.className = 'decision-tree-actions';

    const formatProbability = (value: number) =>
      Number.isFinite(value) ? value.toFixed(2) : '0.00';

    const renderActions = (actions: DecisionTreeActionInput[]) => {
      actionRows.innerHTML = actions
        .map((action, actionIndex) => {
          const totalProb = action.outcomes.reduce(
            (sum, outcome) => sum + (outcome.probability ?? 0),
            0
          );
          return `
          <div class="decision-tree-action" data-action-index="${actionIndex}">
            <div class="decision-tree-action-header">
              <label>
                Action
                <input
                  name="action-name-${actionIndex}"
                  type="text"
                  value="${action.name}"
                  placeholder="A/B/C"
                />
              </label>
              <button class="button ghost" type="button" data-remove-action="${actionIndex}">
                Удалить действие
              </button>
            </div>
            <div class="decision-tree-outcomes">
              ${action.outcomes
                .map(
                  (outcome, outcomeIndex) => `
                <div class="decision-tree-outcome" data-outcome-index="${outcomeIndex}">
                  <label>
                    Probability
                    <input
                      name="outcome-prob-${actionIndex}-${outcomeIndex}"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value="${
                        outcome.probability == null ? '' : outcome.probability
                      }"
                    />
                  </label>
                  <label>
                    Payoff
                    <input
                      name="outcome-payoff-${actionIndex}-${outcomeIndex}"
                      type="number"
                      step="1"
                      value="${outcome.payoff == null ? '' : outcome.payoff}"
                    />
                  </label>
                  <label>
                    Risk tag
                    <input
                      name="outcome-risk-${actionIndex}-${outcomeIndex}"
                      type="text"
                      value="${outcome.riskTag}"
                      placeholder="low/med/high"
                    />
                  </label>
                  <button
                    class="button ghost"
                    type="button"
                    data-remove-outcome="${actionIndex}-${outcomeIndex}"
                  >
                    Удалить исход
                  </button>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="decision-tree-action-footer">
              <div class="decision-tree-hint">
                сумма вероятностей должна быть 1.0
              </div>
              <div class="decision-tree-total">
                Σp: <strong data-prob-total="${actionIndex}">${formatProbability(
                  totalProb
                )}</strong>
              </div>
              <button class="button ghost" type="button" data-add-outcome="${actionIndex}">
                Добавить исход
              </button>
            </div>
          </div>
        `;
        })
        .join('');
    };

    const nextActionName = (actions: DecisionTreeActionInput[]) => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const index = actions.length;
      if (index < alphabet.length) return alphabet[index];
      return `Action ${index + 1}`;
    };

    const readNumberInput = (input: HTMLInputElement | null) => {
      if (!input) return null;
      const raw = input.value.trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const collectActions = (): DecisionTreeActionInput[] => {
      const rows = Array.from(
        actionRows.querySelectorAll<HTMLDivElement>('.decision-tree-action')
      );
      return rows.map((row, actionIndex) => {
        const nameInput = row.querySelector<HTMLInputElement>(
          `[name="action-name-${actionIndex}"]`
        );
        const outcomeRows = Array.from(
          row.querySelectorAll<HTMLDivElement>('.decision-tree-outcome')
        );
        const outcomes = outcomeRows.map((outcomeRow, outcomeIndex) => {
          const probabilityInput = outcomeRow.querySelector<HTMLInputElement>(
            `[name="outcome-prob-${actionIndex}-${outcomeIndex}"]`
          );
          const payoffInput = outcomeRow.querySelector<HTMLInputElement>(
            `[name="outcome-payoff-${actionIndex}-${outcomeIndex}"]`
          );
          const riskInput = outcomeRow.querySelector<HTMLInputElement>(
            `[name="outcome-risk-${actionIndex}-${outcomeIndex}"]`
          );

          return {
            probability: readNumberInput(probabilityInput),
            payoff: readNumberInput(payoffInput),
            riskTag: riskInput?.value.trim() ?? ''
          } satisfies DecisionTreeOutcomeInput;
        });

        return {
          name: nameInput?.value.trim() ?? '',
          outcomes: outcomes.length
            ? outcomes
            : [{ probability: null, payoff: null, riskTag: '' }]
        };
      });
    };

    const updateProbabilityTotals = () => {
      const actions = collectActions();
      actions.forEach((action, actionIndex) => {
        const total = action.outcomes.reduce(
          (sum, outcome) => sum + (outcome.probability ?? 0),
          0
        );
        const totalNode = actionRows.querySelector<HTMLSpanElement>(
          `[data-prob-total="${actionIndex}"]`
        );
        if (totalNode) totalNode.textContent = formatProbability(total);
      });
    };

    form.innerHTML = `
      <div class="decision-tree-header">
        <h3>Actions</h3>
        <button class="button ghost" type="button" data-add-action>
          Добавить действие
        </button>
      </div>
    `;

    renderActions(initialInput.actions);
    updateProbabilityTotals();
    form.appendChild(actionRows);

    const controls = document.createElement('div');
    controls.className = 'decision-tree-controls';
    controls.innerHTML = `<button class="button" type="submit">Рассчитать</button>`;
    form.appendChild(controls);

    form.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('[data-add-action]')) {
        const actions = collectActions();
        actions.push({
          name: nextActionName(actions),
          outcomes: [{ probability: null, payoff: null, riskTag: '' }]
        });
        renderActions(actions);
        updateProbabilityTotals();
      }
      if (target.matches('[data-remove-action]')) {
        const index = Number(target.getAttribute('data-remove-action'));
        const actions = collectActions().filter((_, idx) => idx !== index);
        renderActions(actions.length ? actions : initialInput.actions);
        updateProbabilityTotals();
      }
      if (target.matches('[data-add-outcome]')) {
        const index = Number(target.getAttribute('data-add-outcome'));
        const actions = collectActions();
        if (actions[index]) {
          actions[index].outcomes.push({
            probability: null,
            payoff: null,
            riskTag: ''
          });
          renderActions(actions);
          updateProbabilityTotals();
        }
      }
      if (target.matches('[data-remove-outcome]')) {
        const [actionIndex, outcomeIndex] = String(
          target.getAttribute('data-remove-outcome')
        )
          .split('-')
          .map(Number);
        const actions = collectActions();
        if (actions[actionIndex]) {
          actions[actionIndex].outcomes = actions[actionIndex].outcomes.filter(
            (_, idx) => idx !== outcomeIndex
          );
          if (!actions[actionIndex].outcomes.length) {
            actions[actionIndex].outcomes = [
              { probability: null, payoff: null, riskTag: '' }
            ];
          }
          renderActions(actions);
          updateProbabilityTotals();
        }
      }
    });

    form.addEventListener('input', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('input[type=\"number\"]')) {
        updateProbabilityTotals();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const actions = collectActions();
      const input: DecisionTreeInput = { actions };
      const serialized = serializeDecisionTreeInput(input);
      updateIslandInput(id, serialized);
      islandState.input = serialized;
      const report = safeGetReport(serialized);
      updateIslandReport(id, report);
      islandState.lastReport = report;
      renderReport();
    });

  } else if (id === 'stressTest') {
    const modeKey = 'ls2.stressTest.mode';
    const paramsKey = 'ls2.stressTest.mc';
    const parsedFinance = parseFinanceInput(islandState.input);
    const readStoredMode = () =>
      localStorage.getItem(modeKey) === 'mc' ? 'mc' : 'det';
    const readStoredParams = (): MonteCarloRunwayInput => {
      const fallback: MonteCarloRunwayInput = {
        horizonMonths: 6,
        iterations: 2000,
        incomeVolatility: 15,
        expensesVolatility: 8,
        seed: 202501,
        shock: { enabled: false, probability: 0.1, dropPercent: 30 }
      };
      try {
        const raw = localStorage.getItem(paramsKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<MonteCarloRunwayInput>;
        return {
          horizonMonths: Number(parsed.horizonMonths ?? fallback.horizonMonths),
          iterations: Number(parsed.iterations ?? fallback.iterations),
          incomeVolatility: Number(
            parsed.incomeVolatility ?? fallback.incomeVolatility
          ),
          expensesVolatility: Number(
            parsed.expensesVolatility ?? fallback.expensesVolatility
          ),
          seed: Number(parsed.seed ?? fallback.seed),
          shock: {
            enabled: Boolean(parsed.shock?.enabled ?? fallback.shock.enabled),
            probability: Number(
              parsed.shock?.probability ?? fallback.shock.probability
            ),
            dropPercent: Number(
              parsed.shock?.dropPercent ?? fallback.shock.dropPercent
            )
          }
        };
      } catch {
        return fallback;
      }
    };

    form.innerHTML = `
      <fieldset class="stress-mode-toggle">
        <label><input type="radio" name="stressMode" value="det" ${
          readStoredMode() === 'det' ? 'checked' : ''
        } /> Детерминированный</label>
        <label><input type="radio" name="stressMode" value="mc" ${
          readStoredMode() === 'mc' ? 'checked' : ''
        } /> Вероятностный (Monte Carlo)</label>
      </fieldset>
      <div class="stress-mc-fields" data-mc-fields>
        <div class="bayes-grid">
          <label>Горизонт (мес)
            <select name="horizonMonths">
              <option value="3">3</option>
              <option value="6" selected>6</option>
              <option value="12">12</option>
            </select>
          </label>
          <label>Итерации
            <input name="iterations" type="number" min="200" max="20000" step="100" />
          </label>
          <label>Волатильность дохода (%)
            <input name="incomeVolatility" type="number" min="0" max="200" step="1" />
          </label>
          <label>Волатильность расходов (%)
            <input name="expensesVolatility" type="number" min="0" max="200" step="1" />
          </label>
          <label>Seed
            <input name="seed" type="number" step="1" />
          </label>
        </div>
        <label class="stress-shock-toggle">
          <input type="checkbox" name="shockEnabled" /> Шок дохода (разовый)
        </label>
        <div class="bayes-grid">
          <label>Вероятность шока (0..1)
            <input name="shockProbability" type="number" min="0" max="1" step="0.01" />
          </label>
          <label>Падение дохода при шоке (%)
            <input name="shockDropPercent" type="number" min="0" max="100" step="1" />
          </label>
        </div>
      </div>
      <button class="button" type="submit">Рассчитать</button>
    `;

    const saved = readStoredParams();
    const setValue = (name: string, value: string) => {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[name="${name}"]`
      );
      if (el) el.value = value;
    };
    setValue('horizonMonths', String(saved.horizonMonths));
    setValue('iterations', String(saved.iterations));
    setValue('incomeVolatility', String(saved.incomeVolatility));
    setValue('expensesVolatility', String(saved.expensesVolatility));
    setValue('seed', String(saved.seed));
    setValue('shockProbability', String(saved.shock.probability));
    setValue('shockDropPercent', String(saved.shock.dropPercent));
    const shockEnabled = form.querySelector<HTMLInputElement>('[name="shockEnabled"]');
    if (shockEnabled) shockEnabled.checked = saved.shock.enabled;

    const worker = new Worker(
      new URL('../workers/monteCarloRunway.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const mcFields = form.querySelector<HTMLElement>('[data-mc-fields]');
    const renderMode = () => {
      const mode = (form.querySelector<HTMLInputElement>('[name="stressMode"]:checked')?.value ?? 'det') as 'det' | 'mc';
      if (mcFields) mcFields.style.display = mode === 'mc' ? 'grid' : 'none';
      localStorage.setItem(modeKey, mode);
    };
    renderMode();

    form.addEventListener('change', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('[name="stressMode"]')) {
        renderMode();
      }
    });

    worker.addEventListener('message', (event) => {
      const data = event.data as MonteCarloWorkerResponse;
      if (!data.result) {
        renderReport();
        return;
      }
      updateIslandMonteCarlo(id, {
        horizonMonths: data.result.horizonMonths,
        iterations: data.result.iterations,
        ruinProb: data.result.ruinProb,
        quantiles: data.result.quantiles,
        histogram: data.result.histogram,
        config: data.result.config
      });
      islandState.mcLast = {
        horizonMonths: data.result.horizonMonths,
        iterations: data.result.iterations,
        ruinProb: data.result.ruinProb,
        quantiles: data.result.quantiles,
        histogram: data.result.histogram,
        config: data.result.config
      };
      renderReport();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const mode = (form.querySelector<HTMLInputElement>('[name="stressMode"]:checked')?.value ?? 'det') as 'det' | 'mc';
      const input = islandState.input;
      if (mode === 'det') {
        const report = safeGetReport(input);
        updateIslandReport(id, report);
        islandState.lastReport = report;
        renderReport();
        return;
      }

      const data = new FormData(form);
      const params: MonteCarloRunwayInput = {
        horizonMonths: Number(data.get('horizonMonths') ?? 6),
        iterations: Number(data.get('iterations') ?? 2000),
        incomeVolatility: Number(data.get('incomeVolatility') ?? 15),
        expensesVolatility: Number(data.get('expensesVolatility') ?? 8),
        seed: Number(data.get('seed') ?? 202501),
        shock: {
          enabled: data.get('shockEnabled') !== null,
          probability: Number(data.get('shockProbability') ?? 0.1),
          dropPercent: Number(data.get('shockDropPercent') ?? 30)
        }
      };

      localStorage.setItem(paramsKey, JSON.stringify(params));

      const deterministicRunway = getDeterministicRunwayMonths({
        reserveCash: parsedFinance.reserveCash,
        monthlyIncome: parsedFinance.monthlyIncome,
        monthlyExpenses: parsedFinance.monthlyExpenses,
        horizonMonths: params.horizonMonths
      });

      const base = safeGetReport(input);
      const pending = {
        ...base,
        details: [
          ...base.details,
          `Monte Carlo: считаю ${Math.min(20000, Math.max(200, Math.round(params.iterations)))} траекторий...`,
          `Сверка sigma=0: детерминированный runway на горизонте = ${deterministicRunway} мес`
        ]
      };
      updateIslandReport(id, pending);
      islandState.lastReport = pending;
      renderReport();

      worker.postMessage({
        requestId: `${Date.now()}-${Math.random()}`,
        input: params,
        finance: parsedFinance
      });
    });
  } else if (id === 'causalDag') {
    const parsed = parseCausalDagInput(islandState.input);
    const initialInput: CausalDagInput = { ...defaultCausalDagInput, ...parsed };

    const edgeRows = document.createElement('div');
    edgeRows.className = 'causal-edges';

    const nodesBox = document.createElement('div');
    nodesBox.className = 'causal-nodes';

    const controlsBox = document.createElement('div');
    controlsBox.className = 'causal-controls';

    const buildNodes = (edges: CausalDagInput['edges']) => {
      const nodes = new Set<string>();
      edges.forEach((edge) => {
        if (edge.from.trim()) nodes.add(edge.from.trim());
        if (edge.to.trim()) nodes.add(edge.to.trim());
      });
      return Array.from(nodes).sort();
    };

    const renderEdges = (edges: CausalDagInput['edges']) => {
      edgeRows.innerHTML = edges
        .map(
          (edge, index) => `
          <div class="causal-edge-row" data-index="${index}">
            <input name="edge-from-${index}" type="text" value="${edge.from}" placeholder="from" />
            <span>→</span>
            <input name="edge-to-${index}" type="text" value="${edge.to}" placeholder="to" />
            <button class="button ghost" type="button" data-remove-edge="${index}">Удалить</button>
          </div>
        `
        )
        .join('');
    };

    const renderNodes = (nodes: string[]) => {
      nodesBox.innerHTML = nodes.length
        ? `<div class="causal-node-list">${nodes
            .map((node) => `<span class="tag">${node}</span>`)
            .join('')}</div>`
        : '<p class="muted">Добавьте ребра, чтобы увидеть узлы.</p>';
    };

    const renderSelectOptions = (
      select: HTMLSelectElement,
      nodes: string[],
      selected: string
    ) => {
      select.innerHTML = nodes
        .map(
          (node) =>
            `<option value="${node}" ${node === selected ? 'selected' : ''}>${node}</option>`
        )
        .join('');
    };

    const renderControls = (
      nodes: string[],
      controls: string[],
      mediators: string[]
    ) => {
      controlsBox.innerHTML = nodes.length
        ? nodes
            .map(
              (node) => `
              <label class="causal-control-row">
                <span>${node}</span>
                <span>
                  <label>
                    <input type="checkbox" name="control-${node}" ${
                      controls.includes(node) ? 'checked' : ''
                    } />
                    control
                  </label>
                  <label>
                    <input type="checkbox" name="mediator-${node}" ${
                      mediators.includes(node) ? 'checked' : ''
                    } />
                    mediator
                  </label>
                </span>
              </label>
            `
            )
            .join('')
        : '<p class="muted">Нет узлов для выбора контролей.</p>';
    };

    renderEdges(initialInput.edges);
    const initialNodes = buildNodes(initialInput.edges);
    renderNodes(initialNodes);

    form.innerHTML = `
      <div class="causal-grid">
        <div>
          <h3>Узлы</h3>
          <div data-nodes></div>
        </div>
        <div>
          <h3>Рёбра</h3>
          <div data-edges></div>
          <button class="button ghost" type="button" data-add-edge>Добавить ребро</button>
        </div>
      </div>
      <div class="causal-grid">
        <label>
          Exposure
          <select name="exposure"></select>
        </label>
        <label>
          Outcome
          <select name="outcome"></select>
        </label>
      </div>
      <div>
        <h3>Контроли и медиаторы</h3>
        <div data-controls></div>
      </div>
      <div class="causal-controls-row">
        <button class="button" type="submit">Анализ</button>
        <span class="causal-status" data-status></span>
      </div>
    `;

    form.querySelector('[data-edges]')?.appendChild(edgeRows);
    form.querySelector('[data-nodes]')?.appendChild(nodesBox);
    form.querySelector('[data-controls]')?.appendChild(controlsBox);

    const exposureSelect = form.querySelector<HTMLSelectElement>('select[name="exposure"]');
    const outcomeSelect = form.querySelector<HTMLSelectElement>('select[name="outcome"]');
    const statusLabel = form.querySelector<HTMLSpanElement>('[data-status]');

    if (exposureSelect && outcomeSelect) {
      renderSelectOptions(exposureSelect, initialNodes, initialInput.exposure);
      renderSelectOptions(outcomeSelect, initialNodes, initialInput.outcome);
    }
    renderControls(initialNodes, initialInput.controls, initialInput.mediators);

    const collectEdges = (): CausalDagInput['edges'] => {
      const rows = Array.from(
        edgeRows.querySelectorAll<HTMLDivElement>('.causal-edge-row')
      );
      return rows
        .map((row, index) => {
          const from = row.querySelector<HTMLInputElement>(
            `[name="edge-from-${index}"]`
          );
          const to = row.querySelector<HTMLInputElement>(
            `[name="edge-to-${index}"]`
          );
          return {
            from: from?.value.trim() ?? '',
            to: to?.value.trim() ?? ''
          };
        })
        .filter((edge) => edge.from && edge.to);
    };

    const collectControls = (nodes: string[], prefix: string) =>
      nodes.filter((node) => {
        const checkbox = form.querySelector<HTMLInputElement>(
          `input[name="${prefix}-${node}"]`
        );
        return Boolean(checkbox?.checked);
      });

    const syncNodes = () => {
      const edges = collectEdges();
      const nodes = buildNodes(edges);
      renderNodes(nodes);

      const selectedExposure = exposureSelect?.value ?? '';
      const selectedOutcome = outcomeSelect?.value ?? '';

      if (exposureSelect) {
        renderSelectOptions(
          exposureSelect,
          nodes,
          nodes.includes(selectedExposure) ? selectedExposure : nodes[0] ?? ''
        );
      }
      if (outcomeSelect) {
        renderSelectOptions(
          outcomeSelect,
          nodes,
          nodes.includes(selectedOutcome) ? selectedOutcome : nodes[0] ?? ''
        );
      }

      const currentControls = collectControls(nodes, 'control');
      const currentMediators = collectControls(nodes, 'mediator');
      renderControls(nodes, currentControls, currentMediators);
    };

    form.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('[data-add-edge]')) {
        const edges = collectEdges();
        edges.push({ from: '', to: '' });
        renderEdges(edges);
        syncNodes();
      }
      if (target.matches('[data-remove-edge]')) {
        const index = Number(target.getAttribute('data-remove-edge'));
        const edges = collectEdges();
        edges.splice(index, 1);
        renderEdges(edges.length ? edges : [{ from: '', to: '' }]);
        syncNodes();
      }
    });

    form.addEventListener('change', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('input[name^="edge-"]')) {
        syncNodes();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const edges = collectEdges();
      const nodes = buildNodes(edges);
      const exposure = exposureSelect?.value ?? '';
      const outcome = outcomeSelect?.value ?? '';
      const controls = collectControls(nodes, 'control');
      const mediators = collectControls(nodes, 'mediator');

      const payload: CausalDagInput = {
        edges,
        exposure,
        outcome,
        controls,
        mediators
      };

      const serialized = serializeCausalDagInput(payload);
      updateIslandInput(id, serialized);
      islandState.input = serialized;
      const report = safeGetReport(serialized);
      updateIslandReport(id, report);
      islandState.lastReport = report;
      if (statusLabel) statusLabel.textContent = 'Готово';
      renderReport();
    });
  } else if (id === 'timeseries') {
    const parsedInput = parseTimeseriesInput(islandState.input);
    const textareaRows = 5;
    const formatSeriesInput = (values?: number[]) =>
      values && values.length ? values.join(', ') : '';
    const readNumber = (data: FormData, name: string) => {
      const raw = data.get(name);
      if (raw === null || raw === '') return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const readSeries = (data: FormData, name: string) => {
      const raw = String(data.get(name) ?? '');
      const parsed = parseTimeseriesSeries(raw);
      return parsed.length ? parsed : undefined;
    };

    form.innerHTML = `
      <div class="timeseries-grid">
        <label>
          Ряд чисел
          <textarea name="series" rows="${textareaRows}" placeholder="120, 130, 125">${formatSeriesInput(parsedInput.series)}</textarea>
        </label>
        <label>
          Доходы
          <textarea name="income" rows="${textareaRows}" placeholder="180000, 190000">${formatSeriesInput(parsedInput.income)}</textarea>
        </label>
        <label>
          Расходы
          <textarea name="expenses" rows="${textareaRows}" placeholder="120000, 135000">${formatSeriesInput(parsedInput.expenses)}</textarea>
        </label>
        <label>
          Horizon
          <input name="horizon" type="number" min="1" step="1" value="${parsedInput.horizon ?? 12}" />
        </label>
        <label>
          Season length
          <input name="seasonLength" type="number" min="0" step="1" value="${parsedInput.seasonLength ?? ''}" />
        </label>
        <label>
          Test size
          <input name="testSize" type="number" min="0" step="1" value="${parsedInput.testSize ?? ''}" />
        </label>
        <label>
          Auto
          <input name="auto" type="checkbox" ${parsedInput.auto === false ? '' : 'checked'} />
        </label>
      </div>
      <div class="island-controls">
        <button class="button" type="submit">Запустить анализ</button>
        <span class="island-status" data-status></span>
      </div>
      <div class="timeseries-output" data-output></div>
    `;

    const statusLabel = form.querySelector<HTMLSpanElement>('[data-status]');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const outputBlock = form.querySelector<HTMLDivElement>('[data-output]');
    const worker = new Worker(
      new URL('../workers/ts.worker.ts', import.meta.url),
      { type: 'module' }
    );
    let pendingRequestId = '';

    const setLoading = (loading: boolean, message = '') => {
      if (submitButton) submitButton.disabled = loading;
      if (statusLabel) statusLabel.textContent = message;
    };

    const formatNumber = (value: number) =>
      Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

    const renderOutput = (
      analysisBundle?: TimeseriesAnalysisBundle,
      reportConfidence?: number
    ) => {
      if (!outputBlock) return;
      if (!analysisBundle?.primary) {
        outputBlock.innerHTML = '';
        return;
      }
      const primary = analysisBundle.primary;
      const metricLabel = primary.metric
        ? `${primary.metric.name}: ${formatNumber(primary.metric.value)}`
        : 'нет метрики';
      const trendLabel = formatNumber(primary.trendSlope);
      const volatilityLabel = formatNumber(primary.volatilityChange);
      const forecastLabel = primary.forecast.map((value) => formatNumber(value)).join(', ');
      const confidenceLabel =
        reportConfidence !== undefined ? `${reportConfidence}%` : '—';

      outputBlock.innerHTML = `
        <div class="result-metrics">
          <div><span>Forecast</span><strong>${forecastLabel}</strong></div>
          <div><span>Metric</span><strong>${metricLabel}</strong></div>
          <div><span>Trend</span><strong>${trendLabel}</strong></div>
          <div><span>Volatility</span><strong>${volatilityLabel}</strong></div>
          <div><span>Confidence</span><strong>${confidenceLabel}</strong></div>
        </div>
      `;
    };

    const buildTimeseriesPendingReport = (
      input: TimeseriesInput
    ) => ({
      id: 'timeseries',
      score: 0,
      confidence: 0,
      headline: 'Расчёт запущен',
      summary: 'Прогноз считается в воркере.',
      details: [
        `Горизонт: ${input.horizon ?? 12}`,
        'Ожидайте, когда воркер вернёт результат.'
      ],
      insights: [{ title: 'Идёт расчёт', severity: 'info' }]
    });

    const buildTimeseriesWorkerErrorReport = (message: string) => ({
      id: 'timeseries',
      score: 0,
      confidence: 0,
      headline: 'Ошибка расчёта',
      summary: message,
      details: ['Попробуйте упростить ввод или повторить позже.'],
      insights: [{ title: 'Ошибка воркера', severity: 'warning' }]
    });

    const handleWorkerResponse = (
      input: TimeseriesInput,
      analysisBundle?: TimeseriesAnalysisBundle
    ) => {
      if (!analysisBundle) {
        const report = buildTimeseriesWorkerErrorReport('Нет данных от воркера.');
        updateIslandReport(id, report);
        islandState.lastReport = report;
        renderOutput();
        return;
      }
      const report = buildTimeseriesReport(input, analysisBundle);
      updateIslandReport(id, report);
      islandState.lastReport = report;
      renderOutput(analysisBundle, report.confidence);
    };

    worker.addEventListener('message', (event) => {
      const data = event.data as TimeseriesWorkerResponse;
      if (data.requestId !== pendingRequestId) return;
      pendingRequestId = '';
      setLoading(false, data.error ? 'error' : 'done');
      if (data.error) {
        const report = buildTimeseriesWorkerErrorReport(data.error);
        updateIslandReport(id, report);
        islandState.lastReport = report;
        renderOutput();
        renderReport();
        return;
      }
      const input = parseTimeseriesInput(islandState.input);
      handleWorkerResponse(input, data.analysis);
      renderReport();
    });

    worker.addEventListener('error', () => {
      const report = buildTimeseriesWorkerErrorReport(
        'Ошибка воркера при расчёте.'
      );
      updateIslandReport(id, report);
      islandState.lastReport = report;
      renderOutput();
      pendingRequestId = '';
      setLoading(false, 'error');
      renderReport();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const input: TimeseriesInput = {
        series: readSeries(data, 'series'),
        income: readSeries(data, 'income'),
        expenses: readSeries(data, 'expenses'),
        horizon: readNumber(data, 'horizon'),
        seasonLength: readNumber(data, 'seasonLength'),
        testSize: readNumber(data, 'testSize'),
        auto: data.get('auto') !== null
      };
      const serialized = serializeTimeseriesInput(input);
      updateIslandInput(id, serialized);
      islandState.input = serialized;
      const pending = buildTimeseriesPendingReport(input);
      islandState.lastReport = pending;
      renderReport();
      renderOutput();

      pendingRequestId = `${Date.now()}-${Math.random()}`;
      setLoading(true, 'pending');
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

  const renderHistogram = () => {
    if (id !== 'stressTest' || !islandState.mcLast?.histogram?.length) return '';
    const max = Math.max(...islandState.mcLast.histogram.map((bin) => bin.count), 1);
    return `
      <div class="stress-histogram">
        ${islandState.mcLast.histogram
          .map((bin) => {
            const height = Math.max(4, Math.round((bin.count / max) * 80));
            return `<div class="stress-bin" title="${bin.start.toFixed(1)}-${bin.end.toFixed(1)} мес: ${bin.count}"><span style="height:${height}px"></span></div>`;
          })
          .join('')}
      </div>
    `;
  };

  const renderReport = () => {
    const report = islandState.lastReport ?? safeGetReport(islandState.input);
    const mc = id === 'stressTest' ? islandState.mcLast : null;
    result.innerHTML = `
      <div class="result-metrics">
        <div><span>Score</span><strong>${report.score}</strong></div>
        <div><span>Confidence</span><strong>${report.confidence}%</strong></div>
      </div>
      <h2>${report.headline}</h2>
      <div class="result-summary">${report.summary}</div>
      <ul>${report.details.map((item) => `<li>${item}</li>`).join('')}</ul>
      ${
        mc
          ? `<section class="stress-mc-result"><h3>Monte Carlo</h3><p>Risk-of-ruin: <strong>${mc.ruinProb.toFixed(2)}%</strong> на горизонте ${mc.horizonMonths} мес (${mc.iterations} итераций)</p><p>Runway quantiles: p10 ${mc.quantiles.p10.toFixed(1)} мес / p50 ${mc.quantiles.p50.toFixed(1)} мес / p90 ${mc.quantiles.p90.toFixed(1)} мес</p>${renderHistogram()}</section>`
          : ''
      }
    `;
  };

  renderReport();

  if (
    id !== 'optimization' &&
    id !== 'causalDag' &&
    id !== 'decisionTree' &&
    id !== 'timeseries' &&
    id !== 'stressTest'
  ) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const input = String(data.get('input') ?? '');
      updateIslandInput(id, input);
      const report = safeGetReport(input);
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
