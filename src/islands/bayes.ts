import { ActionItem, IslandReport } from '../core/types';

export type BayesDistribution = 'normal' | 'lognormal';

export interface BayesInput {
  months: number;
  incomeMean: number;
  incomeSd: number;
  incomeDistribution: BayesDistribution;
  expensesMean: number;
  expensesSd: number;
  expensesDistribution: BayesDistribution;
  reserve: number;
  shockSeverity: number;
  priorA: number;
  priorB: number;
  observationMonths: number;
  observationFailures: number;
  mcmcSamples: number;
  mcmcBurnIn: number;
  mcmcStep: number;
  simulationRuns: number;
}

export interface BayesPosteriorSummary {
  mean: number;
  ciLow: number;
  ciHigh: number;
  quantiles: [number, number, number];
}

export interface BayesWorkerResult {
  posterior: BayesPosteriorSummary;
  riskProbability: number;
  reserveQuantiles: [number, number, number];
  posteriorSvg: string;
  effectiveSampleSize: number;
  acceptanceRate: number;
  sampleCount: number;
  observationMonths: number;
  observationFailures: number;
}

export interface BayesWorkerRequest {
  type: 'run' | 'stop';
  requestId: string;
  input?: BayesInput;
}

export interface BayesWorkerResponse {
  type: 'success' | 'error' | 'cancelled';
  requestId: string;
  result?: BayesWorkerResult;
  error?: string;
}

export const defaultBayesInput: BayesInput = {
  months: 12,
  incomeMean: 180000,
  incomeSd: 35000,
  incomeDistribution: 'lognormal',
  expensesMean: 120000,
  expensesSd: 25000,
  expensesDistribution: 'lognormal',
  reserve: 240000,
  shockSeverity: 0.6,
  priorA: 2,
  priorB: 8,
  observationMonths: 12,
  observationFailures: 2,
  mcmcSamples: 2000,
  mcmcBurnIn: 500,
  mcmcStep: 0.35,
  simulationRuns: 2000
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatPercent = (value: number) =>
  `${Math.round(value * 100)}%`;

const formatNumber = (value: number) =>
  Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);

export const parseBayesInput = (raw: string): BayesInput => {
  if (!raw.trim()) {
    return defaultBayesInput;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BayesInput>;
    return {
      months:
        typeof parsed.months === 'number' ? parsed.months : defaultBayesInput.months,
      incomeMean:
        typeof parsed.incomeMean === 'number'
          ? parsed.incomeMean
          : defaultBayesInput.incomeMean,
      incomeSd:
        typeof parsed.incomeSd === 'number'
          ? parsed.incomeSd
          : defaultBayesInput.incomeSd,
      incomeDistribution:
        parsed.incomeDistribution === 'normal' || parsed.incomeDistribution === 'lognormal'
          ? parsed.incomeDistribution
          : defaultBayesInput.incomeDistribution,
      expensesMean:
        typeof parsed.expensesMean === 'number'
          ? parsed.expensesMean
          : defaultBayesInput.expensesMean,
      expensesSd:
        typeof parsed.expensesSd === 'number'
          ? parsed.expensesSd
          : defaultBayesInput.expensesSd,
      expensesDistribution:
        parsed.expensesDistribution === 'normal' || parsed.expensesDistribution === 'lognormal'
          ? parsed.expensesDistribution
          : defaultBayesInput.expensesDistribution,
      reserve:
        typeof parsed.reserve === 'number'
          ? parsed.reserve
          : defaultBayesInput.reserve,
      shockSeverity:
        typeof parsed.shockSeverity === 'number'
          ? parsed.shockSeverity
          : defaultBayesInput.shockSeverity,
      priorA:
        typeof parsed.priorA === 'number'
          ? parsed.priorA
          : defaultBayesInput.priorA,
      priorB:
        typeof parsed.priorB === 'number'
          ? parsed.priorB
          : defaultBayesInput.priorB,
      observationMonths:
        typeof parsed.observationMonths === 'number'
          ? parsed.observationMonths
          : defaultBayesInput.observationMonths,
      observationFailures:
        typeof parsed.observationFailures === 'number'
          ? parsed.observationFailures
          : defaultBayesInput.observationFailures,
      mcmcSamples:
        typeof parsed.mcmcSamples === 'number'
          ? parsed.mcmcSamples
          : defaultBayesInput.mcmcSamples,
      mcmcBurnIn:
        typeof parsed.mcmcBurnIn === 'number'
          ? parsed.mcmcBurnIn
          : defaultBayesInput.mcmcBurnIn,
      mcmcStep:
        typeof parsed.mcmcStep === 'number'
          ? parsed.mcmcStep
          : defaultBayesInput.mcmcStep,
      simulationRuns:
        typeof parsed.simulationRuns === 'number'
          ? parsed.simulationRuns
          : defaultBayesInput.simulationRuns
    };
  } catch {
    return defaultBayesInput;
  }
};

export const serializeBayesInput = (input: BayesInput) =>
  JSON.stringify(input);

const buildActions = (): ActionItem[] => [
  {
    title: 'Увеличить резерв на 2-3 месяца',
    impact: 80,
    effort: 45,
    description: 'Буфер сгладит временные провалы дохода.'
  },
  {
    title: 'Снизить фиксированные расходы на 10%',
    impact: 70,
    effort: 35,
    description: 'Снижение burn rate напрямую уменьшит риск.'
  },
  {
    title: 'Поднять средний доход через диверсификацию',
    impact: 85,
    effort: 60,
    description: 'Дополнительный источник снижает зависимость от шоков.'
  }
];

export const buildBayesPendingReport = (input: BayesInput): IslandReport => ({
  id: 'bayes',
  score: 0,
  confidence: 45,
  headline: 'Считаю апостериор…',
  summary: 'Запускаем MCMC и симуляции риска. Это займёт несколько секунд.',
  details: [
    `Горизонт: ${input.months} мес`,
    `Наблюдений: ${input.observationFailures} / ${input.observationMonths}`,
    `Симуляций: ${input.simulationRuns}`
  ]
});

export const buildBayesCancelledReport = (): IslandReport => ({
  id: 'bayes',
  score: 0,
  confidence: 20,
  headline: 'Расчёт остановлен',
  summary: 'Оценка была остановлена пользователем.',
  details: ['Нажмите «Запустить», чтобы пересчитать риск.']
});

export const buildBayesErrorReport = (error: string): IslandReport => ({
  id: 'bayes',
  score: 0,
  confidence: 20,
  headline: 'Ошибка расчёта',
  summary: error,
  details: ['Проверьте параметры и повторите запуск.']
});

export const buildBayesReport = (
  input: BayesInput,
  result: BayesWorkerResult
): IslandReport => {
  const risk = clamp(result.riskProbability, 0, 1);
  const score = clamp((1 - risk) * 100, 0, 100);
  const dataFactor = clamp(result.observationMonths / 24, 0.2, 1);
  const chainFactor = clamp(result.effectiveSampleSize / 1200, 0.2, 1);
  const confidence = clamp(Math.round((0.2 + dataFactor * chainFactor) * 100), 15, 100);

  const reserveP10 = formatNumber(result.reserveQuantiles[0]);
  const reserveP50 = formatNumber(result.reserveQuantiles[1]);
  const reserveP90 = formatNumber(result.reserveQuantiles[2]);
  const pMean = formatPercent(result.posterior.mean);
  const pLow = formatPercent(result.posterior.ciLow);
  const pHigh = formatPercent(result.posterior.ciHigh);

  return {
    id: 'bayes',
    score: Math.round(score),
    confidence,
    headline: `Риск ${formatPercent(risk)} на ${input.months} мес`,
    summary: `
      <div class="bayes-summary">
        <div>
          <strong>Апостериор p(провала)</strong>: ${pMean} (90% ДИ ${pLow}–${pHigh})
        </div>
        <div>
          <strong>Вероятность ухода резерва &lt; 0</strong>: ${formatPercent(risk)}
        </div>
        ${result.posteriorSvg}
      </div>
    `.trim(),
    details: [
      `Наблюдения: ${result.observationFailures} провалов за ${result.observationMonths} мес`,
      `Квантили минимального резерва: P10 ${reserveP10}, P50 ${reserveP50}, P90 ${reserveP90}`,
      `Эффективная длина цепи: ${Math.round(result.effectiveSampleSize)} (accept ${Math.round(
        result.acceptanceRate * 100
      )}%)`
    ],
    actions: buildActions(),
    insights: [
      {
        title:
          risk >= 0.45
            ? 'Высокий риск в горизонте планирования'
            : risk >= 0.25
              ? 'Средний риск — держите буфер'
              : 'Риск умеренный, но следите за доходом',
        severity: risk >= 0.45 ? 'risk' : risk >= 0.25 ? 'warning' : 'info'
      }
    ]
  };
};

export const getBayesReport = (input: string): IslandReport => {
  const parsed = parseBayesInput(input);
  return {
    id: 'bayes',
    score: 0,
    confidence: 40,
    headline: 'Готово к байесовской оценке',
    summary:
      'Заполните параметры доходов, расходов и наблюдений, затем нажмите «Запустить».',
    details: [
      `Горизонт: ${parsed.months} мес`,
      `Резерв: ${formatNumber(parsed.reserve)}`,
      `Prior Beta(${parsed.priorA}, ${parsed.priorB})`
    ]
  };
};
