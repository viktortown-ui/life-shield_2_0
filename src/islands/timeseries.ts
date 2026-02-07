import ARIMA from 'arima';
import { ActionItem, Insight, IslandReport } from '../core/types';

export interface TimeseriesInput {
  series?: number[];
  income?: number[];
  expenses?: number[];
  horizon?: number;
  seasonLength?: number;
  testSize?: number;
  auto?: boolean;
  maxP?: number;
  maxD?: number;
  maxQ?: number;
  maxPSeasonal?: number;
  maxDSeasonal?: number;
  maxQSeasonal?: number;
  label?: 'income' | 'expenses' | 'net';
  granularity?: 'weekly' | 'monthly' | 'custom';
}

export interface TimeseriesMetric {
  name: 'MAE' | 'MAPE';
  value: number;
}

export interface TimeseriesModelParams {
  p: number;
  d: number;
  q: number;
  P: number;
  D: number;
  Q: number;
  s: number;
  auto: boolean;
}

export interface TimeseriesAnalysis {
  label: 'income' | 'expenses' | 'net';
  horizon: number;
  trainSize: number;
  testSize: number;
  model: TimeseriesModelParams;
  forecast: number[];
  lower: number[];
  upper: number[];
  metric: TimeseriesMetric | null;
  trendSlope: number;
  volatilityChange: number;
  mean: number;
}

export interface TimeseriesWorkerRequest {
  requestId: string;
  input: TimeseriesInput;
}

export interface TimeseriesWorkerResponse {
  requestId: string;
  analysis?: TimeseriesAnalysisBundle;
  error?: string;
}

export interface TimeseriesAnalysisBundle {
  primary: TimeseriesAnalysis | null;
  income?: TimeseriesAnalysis | null;
  expenses?: TimeseriesAnalysis | null;
  coverage?: number;
}

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

const DefaultArima = ARIMA as unknown as ArimaConstructor;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number) => {
  const formatter = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2
  });
  return formatter.format(value);
};

const parseNumberList = (value: string) =>
  value
    .split(/[^-\d.,]+/)
    .map((token) => token.replace(',', '.'))
    .map((token) => Number(token))
    .filter((num) => Number.isFinite(num));

const mergeSeries = (series?: number[]) =>
  (series ?? []).map((value) => Number(value)).filter(Number.isFinite);

const safeSeries = (series: number[]) =>
  series.filter((value) => Number.isFinite(value));

const parseTimeseriesInput = (raw: string): TimeseriesInput => {
  const trimmed = raw.trim();
  if (!trimmed) return { horizon: 12 };

  try {
    const parsed = JSON.parse(trimmed) as TimeseriesInput;
    return {
      ...parsed,
      series: parsed.series ? mergeSeries(parsed.series) : undefined,
      income: parsed.income ? mergeSeries(parsed.income) : undefined,
      expenses: parsed.expenses ? mergeSeries(parsed.expenses) : undefined,
      horizon: parsed.horizon ?? 12
    };
  } catch {
    // fallback to text parsing
  }

  const lines = trimmed.split(/\n+/).map((line) => line.trim());
  const input: TimeseriesInput = { horizon: 12 };
  const rawSeries: number[] = [];

  lines.forEach((line) => {
    if (!line) return;
    const lower = line.toLowerCase();
    if (lower.startsWith('horizon') || lower.startsWith('горизонт')) {
      const numbers = parseNumberList(line);
      if (numbers[0] !== undefined) input.horizon = Math.max(1, numbers[0]);
      return;
    }
    if (lower.startsWith('test') || lower.startsWith('тест')) {
      const numbers = parseNumberList(line);
      if (numbers[0] !== undefined) input.testSize = Math.max(0, numbers[0]);
      return;
    }
    if (lower.startsWith('season') || lower.startsWith('сезон')) {
      const numbers = parseNumberList(line);
      if (numbers[0] !== undefined) input.seasonLength = Math.max(1, numbers[0]);
      return;
    }
    if (lower.startsWith('income') || lower.startsWith('доход')) {
      input.income = parseNumberList(line);
      return;
    }
    if (lower.startsWith('expenses') || lower.startsWith('расход')) {
      input.expenses = parseNumberList(line);
      return;
    }
    if (lower.startsWith('type') || lower.startsWith('тип')) {
      if (lower.includes('expense') || lower.includes('расход')) {
        input.label = 'expenses';
      } else if (lower.includes('income') || lower.includes('доход')) {
        input.label = 'income';
      } else if (lower.includes('net') || lower.includes('баланс')) {
        input.label = 'net';
      }
      return;
    }
    if (lower.startsWith('auto')) {
      input.auto = !lower.includes('false');
      return;
    }
    rawSeries.push(...parseNumberList(line));
  });

  if (rawSeries.length) input.series = rawSeries;
  return input;
};

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stddev = (values: number[]) => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

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

const formatSeries = (values: number[]) => values.map((value) => formatNumber(value)).join(', ');

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
              } catch {
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

export const analyzeSeries = (
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
  Arima: ArimaConstructor = DefaultArima
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
    } catch {
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
  Arima: ArimaConstructor = DefaultArima
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

const buildScore = (coverage: number | undefined, baseScale: number) => {
  if (coverage === undefined) return 35;
  const scale = Math.max(1, baseScale);
  const normalized = coverage / scale;
  return clamp(50 + normalized * 25, 0, 100);
};

const buildConfidence = (
  analysis: TimeseriesAnalysis | null,
  coverageQuality: number
) => {
  if (!analysis) return 25;
  const lengthScore = clamp((analysis.trainSize / 24) * 40, 0, 40);
  const metricScore = analysis.metric
    ? clamp(40 - analysis.metric.value, 0, 40)
    : 20;
  const qualityScore = clamp(coverageQuality * 10, 0, 10);
  const volatilityPenalty = analysis.volatilityChange > 0.25 ? -8 : 0;
  return clamp(30 + lengthScore + metricScore + qualityScore + volatilityPenalty, 25, 100);
};

const buildWarnings = (analysis: TimeseriesAnalysis | null) => {
  const insights: Insight[] = [];
  if (!analysis) return insights;
  if (analysis.trendSlope < 0) {
    insights.push({
      title: 'Тренд идёт вниз — подумайте о защитной стратегии',
      severity: 'warning'
    });
  }
  if (analysis.volatilityChange > 0.25) {
    insights.push({
      title: 'Волатильность растёт — держите больше подушки',
      severity: 'warning'
    });
  }
  return insights;
};

const buildActions = (analysis: TimeseriesAnalysis | null): ActionItem[] => {
  if (!analysis) {
    return [
      {
        title: 'Добавить хотя бы 6 точек ряда',
        impact: 60,
        effort: 20,
        description: 'Нужна история, чтобы оценить тренд и сезонность.'
      }
    ];
  }
  const actions: ActionItem[] = [
    {
      title: 'Проверьте план на горизонте прогноза',
      impact: clamp(60 + analysis.horizon * 2, 60, 90),
      effort: 30,
      description: 'Сверьте бюджет и обязательства с будущими значениями.'
    }
  ];
  if (analysis.trendSlope < 0) {
    actions.push({
      title: 'Заложить запас на снижение',
      impact: 80,
      effort: 40,
      description: 'Сократите фиксированные траты на ближайшие периоды.'
    });
  }
  return actions;
};

export const buildTimeseriesReport = (
  input: TimeseriesInput,
  analysisBundle: TimeseriesAnalysisBundle
): IslandReport => {
  const { primary, income, expenses, coverage } = analysisBundle;

  if (!primary) {
    return {
      id: 'timeseries',
      score: 0,
      confidence: 25,
      headline: 'Нужно больше данных для прогноза',
      summary: 'Добавьте ряд хотя бы из 4-6 значений (недели или месяцы).',
      details: [
        'Формат JSON: { "series": [120, 130, 110], "horizon": 12 }',
        'Или текстом: horizon: 12, season: 12, затем значения по строкам.',
        'Можно задать income и expenses для расчёта покрытия.'
      ],
      actions: buildActions(null),
      insights: [{ title: 'Недостаточно данных', severity: 'warning' }]
    };
  }

  const details: string[] = [];
  const modelLabel = primary.model.auto ? 'AutoARIMA' : 'Grid-search ARIMA';
  const seasonalLabel = primary.model.s > 0 ? `SARIMA (s=${primary.model.s})` : 'ARIMA';
  details.push(`Модель: ${modelLabel}, ${seasonalLabel}.`);
  details.push(`Горизонт: ${primary.horizon}, train: ${primary.trainSize}, test: ${primary.testSize}.`);
  const appendForecast = (label: string, analysis: TimeseriesAnalysis) => {
    details.push(`${label}: ${formatSeries(analysis.forecast)}.`);
    details.push(
      `Интервал 95% (${label}): ${formatSeries(analysis.lower)} … ${formatSeries(analysis.upper)}.`
    );
    if (analysis.metric) {
      details.push(
        `Качество (${label}): ${analysis.metric.name} = ${formatNumber(analysis.metric.value)}.`
      );
    }
  };

  if (income && expenses) {
    appendForecast('Доходы', income);
    appendForecast('Расходы', expenses);
    details.push(
      `Покрытие (income-expenses): ${formatNumber(coverage ?? 0)} на период.`
    );
  } else {
    appendForecast('Прогноз', primary);
    if (coverage !== undefined) {
      details.push(`Прогнозируемый баланс: ${formatNumber(coverage)}.`);
    }
  }

  const direction = primary.trendSlope > 0 ? 'рост' : primary.trendSlope < 0 ? 'снижение' : 'стабильность';
  const summary = `Динамика: ${direction}, среднее ${formatNumber(primary.mean)}.`;

  const baseScale = Math.max(1, Math.abs(primary.mean));
  const score = buildScore(coverage, baseScale);
  const confidence = buildConfidence(primary, primary.metric ? 1 : 0.4);

  const insights = buildWarnings(primary);

  return {
    id: 'timeseries',
    score,
    confidence,
    headline: `Прогноз на ${primary.horizon} шагов: ${direction}`,
    summary,
    details,
    actions: buildActions(primary),
    insights
  };
};

export const getTimeseriesReport = (rawInput: string): IslandReport => {
  const input = parseTimeseriesInput(rawInput);
  const analysisBundle = runTimeseriesAnalysis(input);
  return buildTimeseriesReport(input, analysisBundle);
};
