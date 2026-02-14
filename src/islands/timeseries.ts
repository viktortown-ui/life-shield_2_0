import { ActionItem, Insight, IslandReport } from '../core/types';
import { reportCaughtError } from '../core/reportError';
import { formatNumber } from '../ui/format';

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

import { formatNumber } from '../ui/format';

const parseNumberList = (value: string) =>
  value
    .split(/[^-\d.,]+/)
    .map((token) => token.replace(',', '.'))
    .map((token) => Number(token))
    .filter((num) => Number.isFinite(num));

export const parseTimeseriesSeries = (value: string) => parseNumberList(value);

export const mergeSeries = (series?: number[]) =>
  (series ?? []).map((value) => Number(value)).filter(Number.isFinite);

export const parseTimeseriesInput = (raw: string): TimeseriesInput => {
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
  } catch (error) {
    reportCaughtError(error);
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

export const serializeTimeseriesInput = (input: TimeseriesInput): string => {
  const normalized: TimeseriesInput = {
    series: input.series?.length ? input.series : undefined,
    income: input.income?.length ? input.income : undefined,
    expenses: input.expenses?.length ? input.expenses : undefined,
    horizon: input.horizon,
    seasonLength: input.seasonLength,
    testSize: input.testSize,
    auto: input.auto
  };
  return JSON.stringify(normalized, null, 2);
};

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const formatSeries = (values: number[]) => values.map((value) => formatNumber(value)).join(', ');

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
        'Можно задать доходы и расходы для расчёта покрытия.'
      ],
      actions: buildActions(null),
      insights: [{ title: 'Недостаточно данных', severity: 'warning' }]
    };
  }

  const details: string[] = [];
  const modelLabel = primary.model.auto ? 'AutoARIMA' : 'Grid-search ARIMA';
  const seasonalLabel = primary.model.s > 0 ? `SARIMA (s=${primary.model.s})` : 'ARIMA';
  details.push(`Модель: ${modelLabel}, ${seasonalLabel}.`);
  details.push(`Горизонт: ${primary.horizon}, обучение: ${primary.trainSize}, тест: ${primary.testSize}.`);
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

  details.push(
    `Тренд (наклон): ${formatNumber(primary.trendSlope)}, волатильность: ${formatNumber(
      primary.volatilityChange
    )}.`
  );

  if (income && expenses) {
    appendForecast('Доходы', income);
    appendForecast('Расходы', expenses);
    details.push(
      `Покрытие (доходы-расходы): ${formatNumber(coverage ?? 0)} на период.`
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
  const details = [
    'Нажмите «Запустить», чтобы рассчитать прогноз в отдельном воркере.',
    'Формат JSON: { "series": [120, 130, 110], "horizon": 12 }',
    'Можно указать доходы и расходы для оценки покрытия.'
  ];

  return {
    id: 'timeseries',
    score: 0,
    confidence: 20,
    headline: 'Прогноз готовится в воркере',
    summary:
      'Расчёт ARIMA выполняется асинхронно, чтобы не блокировать интерфейс.',
    details,
    actions: [
      {
        title: 'Запустить расчёт в воркере',
        impact: 70,
        effort: 10,
        description: 'Заполните данные и нажмите «Запустить».'
      }
    ],
    insights: [
      {
        title: 'Пока нет расчёта — запустите воркер',
        severity: 'info'
      }
    ]
  };
};
