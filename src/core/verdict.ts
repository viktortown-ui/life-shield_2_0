import {
  ActionItem,
  GlobalVerdict,
  IslandId,
  IslandReport,
  Quest
} from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

export const weightedMedian = (scores: number[], weights: number[]) => {
  if (scores.length === 0) return 0;
  const entries = scores.map((score, index) => ({
    score,
    weight: Math.max(0, weights[index] ?? 0)
  }));
  entries.sort((a, b) => a.score - b.score);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    return median(entries.map((entry) => entry.score));
  }
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.weight;
    if (cumulative >= totalWeight / 2) {
      return entry.score;
    }
  }
  return entries[entries.length - 1]?.score ?? 0;
};

export const calculateChaos = (scores: number[]) => {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const variance =
    scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    scores.length;
  const stddev = Math.sqrt(variance);
  return clamp(stddev / 50, 0, 1);
};

const getRank = (score: number): GlobalVerdict['rank'] => {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
};

const getMood = (
  score: number,
  chaos: number
): GlobalVerdict['mood'] => {
  if (chaos >= 0.7 || (score < 50 && chaos >= 0.45)) {
    return 'шторм';
  }
  if (chaos >= 0.4 || score < 70) {
    return 'напряжение';
  }
  return 'штиль';
};

const scoreAction = (action: ActionItem, hasRisk: boolean) => {
  const effort = Math.max(1, action.effort);
  const base = action.impact / effort;
  return hasRisk ? base * 1.5 : base;
};

const pickQuests = (reports: IslandReport[]): Quest[] => {
  const actions: Array<{ action: ActionItem; sourceId: IslandId; score: number }> =
    [];
  reports.forEach((report) => {
    const hasRisk =
      report.insights?.some((insight) => insight.severity === 'risk') ?? false;
    report.actions?.forEach((action) => {
      actions.push({
        action,
        sourceId: report.id,
        score: scoreAction(action, hasRisk)
      });
    });
  });
  actions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.action.impact !== a.action.impact) {
      return b.action.impact - a.action.impact;
    }
    return a.action.effort - b.action.effort;
  });
  return actions.slice(0, 2).map(({ action, sourceId }) => ({
    title: action.title,
    impact: action.impact,
    effort: action.effort,
    sourceId
  }));
};

export const buildGlobalVerdict = (reports: IslandReport[]): GlobalVerdict => {
  const scores = reports.map((report) => report.score);
  const weights = reports.map((report) => report.confidence);
  const globalScore = weightedMedian(scores, weights);
  const chaos = calculateChaos(scores);
  return {
    globalScore,
    chaos,
    rank: getRank(globalScore),
    mood: getMood(globalScore, chaos),
    quests: pickQuests(reports)
  };
};

export const buildStubReport = (
  id: IslandId,
  input: string,
  hint: string
): IslandReport => {
  const trimmed = input.trim();
  const score = Math.min(100, Math.max(15, trimmed.length * 2));
  const confidence = Math.min(100, Math.max(25, 60 + trimmed.length));

  return {
    id,
    score,
    confidence,
    headline: hint,
    summary: trimmed
      ? `Получено ${trimmed.length} символов входных данных.`
      : 'Данных пока нет — используйте форму ниже.',
    details: [
      'Расчёты пока заглушка: подключите воркер для тяжёлой математики.',
      'Результат сохранится после нажатия «Сохранить».',
      'Контракт IslandReport остаётся единым для всех островов.'
    ],
    actions: [
      {
        title: 'Обновить наблюдения',
        impact: Math.min(90, score + 10),
        effort: 30
      }
    ],
    insights: [
      {
        title: 'Нужны новые данные для устойчивости',
        severity: score < 45 ? 'risk' : 'warning'
      }
    ]
  };
};
