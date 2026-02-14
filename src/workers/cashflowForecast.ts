export interface CashflowForecastInput {
  netSeries: number[];
  horizonMonths: number;
  iterations?: number;
  seed?: number;
  noiseStd?: number;
}

export interface CashflowForecastMonthQuantile {
  month: number;
  p10: number;
  p50: number;
  p90: number;
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

export const runCashflowForecast = (input: CashflowForecastInput): CashflowForecastResult => {
  const netSeries = sanitizeSeries(input.netSeries);
  if (netSeries.length < MIN_REQUIRED_MONTHS) {
    throw new Error('Недостаточно наблюдений: нужно >=6 месяцев.');
  }

  const horizonMonths = Math.max(1, Math.floor(Number(input.horizonMonths) || 1));
  const iterations = sanitizeIterations(input.iterations);
  const random = mulberry32(Number.isFinite(input.seed) ? Number(input.seed) : Date.now());
  const noiseStd = Number.isFinite(input.noiseStd) ? Math.max(0, Number(input.noiseStd)) : 0;

  const horizonTotals: number[] = [];
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
    horizonTotals.push(total);
  }

  const sortedTotals = horizonTotals.slice().sort((a, b) => a - b);
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
    horizonMonths,
    iterations,
    sourceMonths: netSeries.length,
    probNetNegative: horizonTotals.filter((value) => value < 0).length / iterations,
    quantiles: { p10, p50, p90 },
    uncertainty: p90 - p10,
    monthly
  };
};
