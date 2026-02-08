import type {
  TimeseriesAnalysis,
  TimeseriesAnalysisBundle,
  TimeseriesInput,
  TimeseriesMetric,
  TimeseriesModelParams
} from '../islands/timeseries';
import { mergeSeries } from '../islands/timeseries';
import { reportCaughtError } from '../core/reportError';

interface ArimaOptions {
  auto?: boolean;
  p?: number;
  d?: number;
  q?: number;
  P?: number;
  D?: number;
  Q?: number;
  s?: number;
  verbose?: boolean;
  approximation?: number;
  search?: number;
}

interface ArimaModel {
  train: (series: number[]) => ArimaModel;
  predict: (steps: number) => [number[], number[]];
}

type ArimaConstructor = new (options: ArimaOptions) => ArimaModel;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stddev = (values: number[]) => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const safeSeries = (series: number[]) =>
  series.filter((value) => Number.isFinite(value));

const buildTrendSlope = (values: number[]) => {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, index) => index + 1);
  const sumX = xs.reduce((sum, value) => sum + value, 0);
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + value * xs[index], 0);
  const sumXX = xs.reduce((sum, value) => sum + value ** 2, 0);
  const denominator = n * sumXX - sumX ** 2;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
};

const buildVolatilityChange = (values: number[]) => {
  if (values.length < 8) return 0;
  const midpoint = Math.floor(values.length / 2);
  const first = values.slice(0, midpoint);
  const second = values.slice(midpoint);
  const firstStd = stddev(first);
  const secondStd = stddev(second);
  if (firstStd === 0) return 0;
  return (secondStd - firstStd) / firstStd;
};

const evaluateForecast = (actual: number[], predicted: number[]): TimeseriesMetric | null => {
  if (!actual.length || actual.length !== predicted.length) return null;
  const absErrors = actual.map((value, index) => Math.abs(value - predicted[index]));
  const mae = mean(absErrors);
  const nonZero = actual.some((value) => value !== 0);
  if (!nonZero) {
    return { name: 'MAE', value: mae };
  }
  const mape =
    mean(
      actual.map((value, index) =>
        value === 0 ? 0 : Math.abs((value - predicted[index]) / value)
      )
    ) * 100;
  return { name: 'MAPE', value: mape };
};

const buildIntervals = (
  forecast: number[],
  errors: number[],
  fallbackSigma: number
) => {
  const lower: number[] = [];
  const upper: number[] = [];
  forecast.forEach((value, index) => {
    const error = errors[index];
    const sigma = Number.isFinite(error) ? Math.sqrt(Math.abs(error)) : fallbackSigma;
    const delta = 1.96 * (sigma || fallbackSigma || 0);
    lower.push(value - delta);
    upper.push(value + delta);
  });
  return { lower, upper };
};

const runGridSearch = (
  series: number[],
  horizon: number,
  testSize: number,
  seasonal: boolean,
  params: {
    maxP: number;
    maxD: number;
    maxQ: number;
    maxPSeasonal: number;
    maxDSeasonal: number;
    maxQSeasonal: number;
    seasonLength: number;
  },
  Arima: ArimaConstructor
) => {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestParams: TimeseriesModelParams | null = null;
  let bestModel: ArimaModel | null = null;
  let bestMetric: TimeseriesMetric | null = null;

  const trainSize = Math.max(1, series.length - testSize);
  const trainSeries = series.slice(0, trainSize);
  const testSeries = series.slice(trainSize);

  for (let p = 0; p <= params.maxP; p += 1) {
    for (let d = 0; d <= params.maxD; d += 1) {
      for (let q = 0; q <= params.maxQ; q += 1) {
        const seasonalPs = seasonal ? params.maxPSeasonal : 0;
        const seasonalDs = seasonal ? params.maxDSeasonal : 0;
        const seasonalQs = seasonal ? params.maxQSeasonal : 0;
        for (let P = 0; P <= seasonalPs; P += 1) {
          for (let D = 0; D <= seasonalDs; D += 1) {
            for (let Q = 0; Q <= seasonalQs; Q += 1) {
              try {
                const model = new Arima({
                  p,
                  d,
                  q,
                  P,
                  D,
                  Q,
                  s: seasonal ? params.seasonLength : 0,
                  verbose: false
                }).train(trainSeries);

                const [prediction] = model.predict(testSize || horizon);
                const candidateMetric = testSize
                  ? evaluateForecast(testSeries, prediction.slice(0, testSize))
                  : null;
                const score = candidateMetric
                  ? candidateMetric.value
                  : p + d + q + P + D + Q;

                if (score < bestScore) {
                  bestScore = score;
                  bestParams = { p, d, q, P, D, Q, s: seasonal ? params.seasonLength : 0, auto: false };
                  bestModel = model;
                  bestMetric = candidateMetric;
                }
              } catch (error) {
                reportCaughtError(error);
                // ignore failed config
              }
            }
          }
        }
      }
    }
  }

  return {
    model: bestModel,
    params: bestParams ?? {
      p: 1,
      d: 0,
      q: 1,
      P: 0,
      D: 0,
      Q: 0,
      s: 0,
      auto: false
    },
    metric: bestMetric
  };
};

const analyzeSeries = (
  seriesRaw: number[],
  options: {
    horizon: number;
    seasonLength?: number;
    testSize?: number;
    auto?: boolean;
    maxP?: number;
    maxD?: number;
    maxQ?: number;
    maxPSeasonal?: number;
    maxDSeasonal?: number;
    maxQSeasonal?: number;
  },
  Arima: ArimaConstructor
): TimeseriesAnalysis | null => {
  const series = safeSeries(seriesRaw);
  if (series.length < 4) return null;

  const horizon = Math.max(1, Math.floor(options.horizon));
  const seasonLength = Math.max(0, Math.floor(options.seasonLength ?? 0));
  const seasonal = seasonLength > 1;

  const rawTestSize = options.testSize ?? Math.min(4, Math.floor(series.length * 0.2));
  const testSize = clamp(Math.floor(rawTestSize), 0, Math.floor(series.length / 2));

  const maxP = options.maxP ?? 3;
  const maxD = options.maxD ?? 2;
  const maxQ = options.maxQ ?? 3;
  const maxPSeasonal = options.maxPSeasonal ?? 1;
  const maxDSeasonal = options.maxDSeasonal ?? 1;
  const maxQSeasonal = options.maxQSeasonal ?? 1;

  let modelParams: TimeseriesModelParams | null = null;
  let model: ArimaModel | null = null;
  let metric: TimeseriesMetric | null = null;

  const trainSize = Math.max(1, series.length - testSize);
  const trainSeries = series.slice(0, trainSize);
  const testSeries = series.slice(trainSize);

  if (options.auto !== false) {
    try {
      model = new Arima({
        auto: true,
        p: maxP,
        d: maxD,
        q: maxQ,
        P: seasonal ? maxPSeasonal : 0,
        D: seasonal ? maxDSeasonal : 0,
        Q: seasonal ? maxQSeasonal : 0,
        s: seasonal ? seasonLength : 0,
        verbose: false
      }).train(trainSeries);
      modelParams = {
        p: maxP,
        d: maxD,
        q: maxQ,
        P: seasonal ? maxPSeasonal : 0,
        D: seasonal ? maxDSeasonal : 0,
        Q: seasonal ? maxQSeasonal : 0,
        s: seasonal ? seasonLength : 0,
        auto: true
      };
      if (testSize) {
        const [prediction] = model.predict(testSize);
        metric = evaluateForecast(testSeries, prediction.slice(0, testSize));
      }
    } catch (error) {
      reportCaughtError(error);
      model = null;
      modelParams = null;
    }
  }

  if (!model || !modelParams) {
    const search = runGridSearch(
      series,
      horizon,
      testSize,
      seasonal,
      {
        maxP,
        maxD,
        maxQ,
        maxPSeasonal,
        maxDSeasonal,
        maxQSeasonal,
        seasonLength
      },
      Arima
    );
    model = search.model;
    modelParams = search.params;
    metric = search.metric;
  }

  if (!model || !modelParams) return null;

  const [forecast, errors] = model.predict(horizon);
  const fallbackSigma = testSize
    ? stddev(testSeries.map((value, index) => value - (forecast[index] ?? value)))
    : stddev(trainSeries);
  const { lower, upper } = buildIntervals(forecast, errors ?? [], fallbackSigma);

  const recentWindow = series.slice(-Math.min(series.length, 12));
  const trendSlope = buildTrendSlope(recentWindow);
  const volatilityChange = buildVolatilityChange(series);

  return {
    label: 'net',
    horizon,
    trainSize,
    testSize,
    model: modelParams,
    forecast,
    lower,
    upper,
    metric,
    trendSlope,
    volatilityChange,
    mean: mean(series)
  };
};

export const runTimeseriesAnalysis = (
  input: TimeseriesInput,
  Arima: ArimaConstructor
): TimeseriesAnalysisBundle => {
  const horizon = input.horizon ?? 12;
  const seasonLength = input.seasonLength;
  const commonOptions = {
    horizon,
    seasonLength,
    testSize: input.testSize,
    auto: input.auto,
    maxP: input.maxP,
    maxD: input.maxD,
    maxQ: input.maxQ,
    maxPSeasonal: input.maxPSeasonal,
    maxDSeasonal: input.maxDSeasonal,
    maxQSeasonal: input.maxQSeasonal
  };

  const incomeSeries = input.income ? mergeSeries(input.income) : undefined;
  const expensesSeries = input.expenses ? mergeSeries(input.expenses) : undefined;
  const fallbackSeries = input.series ? mergeSeries(input.series) : undefined;

  const income = incomeSeries ? analyzeSeries(incomeSeries, commonOptions, Arima) : null;
  const expenses = expensesSeries ? analyzeSeries(expensesSeries, commonOptions, Arima) : null;

  let primary: TimeseriesAnalysis | null = null;
  let coverage: number | undefined;

  if (income || expenses) {
    if (income) income.label = 'income';
    if (expenses) expenses.label = 'expenses';
    primary = income ?? expenses ?? null;
    const incomeForecast = income ? mean(income.forecast) : 0;
    const expensesForecast = expenses ? mean(expenses.forecast) : 0;
    coverage = incomeForecast - expensesForecast;
  } else if (fallbackSeries) {
    primary = analyzeSeries(fallbackSeries, commonOptions, Arima);
    if (primary) {
      primary.label = input.label ?? 'net';
      if (primary.label === 'expenses') {
        coverage = -mean(primary.forecast);
      } else {
        coverage = mean(primary.forecast);
      }
    }
  }

  return {
    primary,
    income,
    expenses,
    coverage
  };
};
