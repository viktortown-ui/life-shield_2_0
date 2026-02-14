export interface CashflowForecastInput {
  netSeries: number[];
  horizonMonths: number;
  iterations?: number;
  seed?: number;
  noiseStd?: number;
  mode?: 'single' | 'ensemble';
}

export interface CashflowForecastMonthQuantile {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export type CashflowForecastMethodId = 'iid_bootstrap' | 'moving_block_bootstrap' | 'linear_trend_bootstrap';

export interface CashflowForecastMethodSummary {
  method: CashflowForecastMethodId;
  probNetNegative: number;
  uncertainty: number;
  quantiles: {
    p10: number;
    p50: number;
    p90: number;
  };
}

export interface CashflowForecastResult {
  horizonMonths: number;
  iterations: number;
  sourceMonths: number;
  probNetNegative: number;
  quantiles: {
    p10: number;
    p50: number;
    p90: number;
  };
  uncertainty: number;
  monthly: CashflowForecastMonthQuantile[];
  methodsUsed: CashflowForecastMethodId[];
  disagreementScore: number;
  perMethodSummary: CashflowForecastMethodSummary[];
}

export interface CashflowForecastWorkerRequest {
  requestId: string;
  input: CashflowForecastInput;
}

export interface CashflowForecastWorkerResponse {
  requestId: string;
  result?: CashflowForecastResult;
  error?: string;
}

const DEFAULT_ITERATIONS = 2000;
const MAX_ITERATIONS = 20000;
const MIN_REQUIRED_MONTHS = 6;
const TREND_RESIDUAL_STD_FLOOR = 1e-9;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sanitizeIterations = (value: number | undefined) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_ITERATIONS;
  }
  return Math.floor(clamp(Number(value), 1, MAX_ITERATIONS));
};

const sanitizeSeries = (series: number[]) =>
  series
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .slice(-24);

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const gaussian = (random: () => number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const position = clamp(q, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return low + (high - low) * weight;
};

const buildUncertainty = (p10: number, p50: number, p90: number) => {
  const denom = Math.max(1, Math.abs(p50));
  return Math.max(0, (p90 - p10) / denom);
};

interface MethodSimulation {
  method: CashflowForecastMethodId;
  totals: number[];
  monthlyByStep: number[][];
}

const createMethodSimulation = (
  method: CashflowForecastMethodId,
  totals: number[],
  monthlyByStep: number[][]
): MethodSimulation => ({ method, totals, monthlyByStep });

const runIidBootstrap = (
  netSeries: number[],
  horizonMonths: number,
  iterations: number,
  random: () => number,
  noiseStd: number
): MethodSimulation => {
  const totals: number[] = [];
  const monthlyByStep = Array.from({ length: horizonMonths }, () => [] as number[]);
  for (let trajectory = 0; trajectory < iterations; trajectory += 1) {
    let total = 0;
    for (let monthIndex = 0; monthIndex < horizonMonths; monthIndex += 1) {
      const sourceIndex = Math.floor(random() * netSeries.length);
      const baseNet = netSeries[sourceIndex] ?? 0;
      const noise = noiseStd > 0 ? gaussian(random) * noiseStd : 0;
      const sampled = baseNet + noise;
      total += sampled;
      monthlyByStep[monthIndex]?.push(sampled);
    }
    totals.push(total);
  }
  return createMethodSimulation('iid_bootstrap', totals, monthlyByStep);
};

const runMovingBlockBootstrap = (
  netSeries: number[],
  horizonMonths: number,
  iterations: number,
  random: () => number
): MethodSimulation => {
  const totals: number[] = [];
  const monthlyByStep = Array.from({ length: horizonMonths }, () => [] as number[]);
  const blockLength = clamp(Math.round(Math.sqrt(netSeries.length)), 2, 4);

  for (let trajectory = 0; trajectory < iterations; trajectory += 1) {
    let total = 0;
    let step = 0;
    while (step < horizonMonths) {
      const start = Math.floor(random() * netSeries.length);
      for (let offset = 0; offset < blockLength && step < horizonMonths; offset += 1) {
        const value = netSeries[(start + offset) % netSeries.length] ?? 0;
        total += value;
        monthlyByStep[step]?.push(value);
        step += 1;
      }
    }
    totals.push(total);
  }

  return createMethodSimulation('moving_block_bootstrap', totals, monthlyByStep);
};

const runLinearTrendBootstrap = (
  netSeries: number[],
  horizonMonths: number,
  iterations: number,
  random: () => number
): MethodSimulation => {
  const n = netSeries.length;
  const meanX = (n - 1) / 2;
  const meanY = netSeries.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    const centeredX = index - meanX;
    numerator += centeredX * ((netSeries[index] ?? meanY) - meanY);
    denominator += centeredX * centeredX;
  }

  const slope = denominator > 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const residuals = netSeries.map((value, index) => value - (intercept + slope * index));
  const residualStd = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length));
  const safeResiduals = residualStd > TREND_RESIDUAL_STD_FLOOR ? residuals : [0];

  const totals: number[] = [];
  const monthlyByStep = Array.from({ length: horizonMonths }, () => [] as number[]);

  for (let trajectory = 0; trajectory < iterations; trajectory += 1) {
    let total = 0;
    for (let step = 0; step < horizonMonths; step += 1) {
      const t = n + step;
      const trend = intercept + slope * t;
      const residualSample = safeResiduals[Math.floor(random() * safeResiduals.length)] ?? 0;
      const sampled = trend + residualSample;
      total += sampled;
      monthlyByStep[step]?.push(sampled);
    }
    totals.push(total);
  }

  return createMethodSimulation('linear_trend_bootstrap', totals, monthlyByStep);
};

interface DistributionSummary {
  probNetNegative: number;
  quantiles: CashflowForecastResult['quantiles'];
  uncertainty: number;
  monthly: CashflowForecastMonthQuantile[];
}

const summarizeDistribution = (totals: number[], monthlyByStep: number[][]): DistributionSummary => {
  const sortedTotals = totals.slice().sort((a, b) => a - b);
  const p10 = quantile(sortedTotals, 0.1);
  const p50 = quantile(sortedTotals, 0.5);
  const p90 = quantile(sortedTotals, 0.9);

  const monthly = monthlyByStep.map((values, index) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return {
      month: index + 1,
      p10: quantile(sorted, 0.1),
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9)
    };
  });

  return {
    probNetNegative: totals.filter((value) => value < 0).length / Math.max(1, totals.length),
    quantiles: { p10, p50, p90 },
    uncertainty: buildUncertainty(p10, p50, p90),
    monthly
  };
};

export const calculateDisagreementScore = (methodP50: number[]) => {
  if (methodP50.length <= 1) return 0;
  const meanValue = methodP50.reduce((sum, value) => sum + value, 0) / methodP50.length;
  const variance =
    methodP50.reduce((sum, value) => {
      const diff = value - meanValue;
      return sum + diff * diff;
    }, 0) / methodP50.length;
  const std = Math.sqrt(Math.max(0, variance));
  const scale = Math.max(1000, Math.abs(meanValue));
  return clamp(std / scale, 0, 1);
};

const toMethodSummary = (simulation: MethodSimulation): CashflowForecastMethodSummary => {
  const summary = summarizeDistribution(simulation.totals, simulation.monthlyByStep);
  return {
    method: simulation.method,
    probNetNegative: summary.probNetNegative,
    uncertainty: summary.uncertainty,
    quantiles: summary.quantiles
  };
};

export const runCashflowForecast = (input: CashflowForecastInput): CashflowForecastResult => {
  const netSeries = sanitizeSeries(input.netSeries);
  if (netSeries.length < MIN_REQUIRED_MONTHS) {
    throw new Error('Недостаточно наблюдений: нужно >=6 месяцев.');
  }

  const horizonMonths = Math.max(1, Math.floor(Number(input.horizonMonths) || 1));
  const iterations = sanitizeIterations(input.iterations);
  const random = mulberry32(Number.isFinite(input.seed) ? Number(input.seed) : Date.now());
  const noiseStd = Number.isFinite(input.noiseStd) ? Math.max(0, Number(input.noiseStd)) : 0;
  const mode = input.mode === 'single' ? 'single' : 'ensemble';

  const methods = [
    runIidBootstrap(netSeries, horizonMonths, iterations, random, noiseStd),
    ...(mode === 'ensemble'
      ? [
          runMovingBlockBootstrap(netSeries, horizonMonths, iterations, random),
          runLinearTrendBootstrap(netSeries, horizonMonths, iterations, random)
        ]
      : [])
  ];

  const perMethodSummary = methods.map(toMethodSummary);
  const methodsUsed = methods.map((item) => item.method);
  const disagreementScore = calculateDisagreementScore(perMethodSummary.map((item) => item.quantiles.p50));

  const combinedTotals = methods.flatMap((method) => method.totals);
  const combinedMonthly = Array.from({ length: horizonMonths }, (_, monthIndex) =>
    methods.flatMap((method) => method.monthlyByStep[monthIndex] ?? [])
  );
  const combined = summarizeDistribution(combinedTotals, combinedMonthly);

  return {
    horizonMonths,
    iterations,
    sourceMonths: netSeries.length,
    probNetNegative: combined.probNetNegative,
    quantiles: combined.quantiles,
    uncertainty: combined.uncertainty,
    monthly: combined.monthly,
    methodsUsed,
    disagreementScore,
    perMethodSummary
  };
};
