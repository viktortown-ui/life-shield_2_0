import { FinanceInputData } from '../core/types';

export interface MonteCarloShockSettings {
  enabled: boolean;
  probability: number;
  dropPercent: number;
}

export interface MonteCarloRunwayInput {
  horizonMonths: number;
  iterations: number;
  incomeVolatility: number;
  expensesVolatility: number;
  seed: number;
  shock: MonteCarloShockSettings;
}

export interface MonteCarloHistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface MonteCarloQuantiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloRunwayResult {
  config: MonteCarloRunwayInput;
  horizonMonths: number;
  iterations: number;
  ruinProb: number;
  runwayDist: number[];
  quantiles: MonteCarloQuantiles;
  histogram: MonteCarloHistogramBin[];
}

export interface MonteCarloWorkerRequest {
  requestId: string;
  input: MonteCarloRunwayInput;
  finance: FinanceInputData;
}

export interface MonteCarloWorkerResponse {
  requestId: string;
  result?: MonteCarloRunwayResult;
  error?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toSigma = (percent: number) => clamp(percent / 100, 0, 3);

const round2 = (value: number) => Math.round(value * 100) / 100;

const normalizeSeed = (seed: number) => {
  const base = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 1;
  return (base % 0x7fffffff) + 1;
};

const createRng = (seed: number) => {
  let state = normalizeSeed(seed);
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
};

const randomNormal = (rng: () => number) => {
  let u1 = rng();
  let u2 = rng();
  if (u1 <= Number.EPSILON) u1 = Number.EPSILON;
  if (u2 <= Number.EPSILON) u2 = Number.EPSILON;
  const magnitude = Math.sqrt(-2 * Math.log(u1));
  return magnitude * Math.cos(2 * Math.PI * u2);
};

const quantile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const buildHistogram = (values: number[], binsCount: number) => {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ start: min, end: max, count: values.length }];
  }

  const width = (max - min) / binsCount;
  const bins = Array.from({ length: binsCount }, (_, index) => ({
    start: min + width * index,
    end: index === binsCount - 1 ? max : min + width * (index + 1),
    count: 0
  }));

  values.forEach((value) => {
    const rawIndex = Math.floor((value - min) / width);
    const index = clamp(rawIndex, 0, binsCount - 1);
    bins[index].count += 1;
  });

  return bins;
};

export const getDeterministicRunwayMonths = (params: {
  reserveCash: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  horizonMonths: number;
}) => {
  const reserve = Math.max(0, params.reserveCash);
  const delta = params.monthlyIncome - params.monthlyExpenses;
  const horizon = Math.max(1, Math.round(params.horizonMonths));

  if (delta >= 0) {
    return horizon + 1;
  }

  const monthsToRuin = Math.floor(reserve / Math.abs(delta)) + 1;
  return Math.min(monthsToRuin, horizon + 1);
};

export const runMonteCarloRunway = (
  finance: FinanceInputData,
  rawInput: MonteCarloRunwayInput
): MonteCarloRunwayResult => {
  const horizonMonths = clamp(Math.round(rawInput.horizonMonths), 1, 120);
  const iterations = clamp(Math.round(rawInput.iterations), 100, 20000);
  const incomeSigma = toSigma(rawInput.incomeVolatility);
  const expensesSigma = toSigma(rawInput.expensesVolatility);
  const seed = normalizeSeed(rawInput.seed);
  const shock: MonteCarloShockSettings = {
    enabled: rawInput.shock.enabled,
    probability: clamp(rawInput.shock.probability, 0, 1),
    dropPercent: clamp(rawInput.shock.dropPercent, 0, 100)
  };

  const rng = createRng(seed);
  const runwayDist: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    let reserve = Math.max(0, finance.reserveCash);
    let runwayMonths = horizonMonths + 1;
    let shockConsumed = false;

    for (let month = 1; month <= horizonMonths; month += 1) {
      let income = Math.max(
        0,
        finance.monthlyIncome * (1 + randomNormal(rng) * incomeSigma)
      );
      const expense = Math.max(
        0,
        finance.monthlyExpenses * (1 + randomNormal(rng) * expensesSigma)
      );

      if (shock.enabled && !shockConsumed && rng() < shock.probability) {
        income *= 1 - shock.dropPercent / 100;
        income = Math.max(0, income);
        shockConsumed = true;
      }

      reserve += income - expense;

      if (reserve < 0) {
        runwayMonths = month;
        break;
      }
    }

    runwayDist.push(runwayMonths);
  }

  const sorted = [...runwayDist].sort((a, b) => a - b);
  const ruinCount = runwayDist.filter((month) => month <= horizonMonths).length;

  return {
    config: {
      horizonMonths,
      iterations,
      incomeVolatility: rawInput.incomeVolatility,
      expensesVolatility: rawInput.expensesVolatility,
      seed,
      shock
    },
    horizonMonths,
    iterations,
    ruinProb: round2((ruinCount / iterations) * 100),
    runwayDist,
    quantiles: {
      p10: round2(quantile(sorted, 0.1)),
      p50: round2(quantile(sorted, 0.5)),
      p90: round2(quantile(sorted, 0.9))
    },
    histogram: buildHistogram(runwayDist, 16)
  };
};
