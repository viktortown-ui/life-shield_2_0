import { IslandReport, ActionItem } from '../core/types';
import { reportCaughtError } from '../core/reportError';

export interface DecisionTreeOutcomeInput {
  probability: number | null;
  payoff: number | null;
  riskTag: string;
}

export interface DecisionTreeActionInput {
  name: string;
  outcomes: DecisionTreeOutcomeInput[];
}

export interface DecisionTreeInput {
  actions: DecisionTreeActionInput[];
}

export interface DecisionTreeActionMetrics {
  name: string;
  ev: number;
  variance: number;
  probLoss: number;
  expectedLoss: number;
  minPayoff: number;
  maxPayoff: number;
  sumProb: number;
  outcomesCount: number;
  hasEmptyFields: boolean;
}

export interface DecisionTreeMetricsSummary {
  actions: DecisionTreeActionMetrics[];
  bestByEV: DecisionTreeActionMetrics | null;
  robustChoice: DecisionTreeActionMetrics | null;
  maxAbsPayoff: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—';

const defaultDecisionTreeInput: DecisionTreeInput = {
  actions: [
    {
      name: 'A',
      outcomes: [
        { probability: 0.6, payoff: 12, riskTag: 'low' },
        { probability: 0.4, payoff: -4, riskTag: 'high' }
      ]
    },
    {
      name: 'B',
      outcomes: [
        { probability: 0.5, payoff: 8, riskTag: 'med' },
        { probability: 0.5, payoff: 2, riskTag: 'low' }
      ]
    },
    {
      name: 'C',
      outcomes: [
        { probability: 0.3, payoff: 18, riskTag: 'high' },
        { probability: 0.7, payoff: -2, riskTag: 'med' }
      ]
    }
  ]
};

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeOutcome = (raw: Partial<DecisionTreeOutcomeInput>) => ({
  probability: normalizeNumber(raw.probability),
  payoff: normalizeNumber(raw.payoff),
  riskTag: normalizeString(raw.riskTag) || 'med'
});

const normalizeAction = (raw: Partial<DecisionTreeActionInput>) => ({
  name: normalizeString(raw.name),
  outcomes: Array.isArray(raw.outcomes)
    ? raw.outcomes.map((outcome) => normalizeOutcome(outcome))
    : []
});

export const parseDecisionTreeInput = (raw: string): DecisionTreeInput => {
  if (!raw.trim()) return { ...defaultDecisionTreeInput };

  try {
    const parsed = JSON.parse(raw) as Partial<DecisionTreeInput>;
    if (Array.isArray(parsed.actions) && parsed.actions.length) {
      const actions = parsed.actions.map((action) => normalizeAction(action));
      return {
        actions: actions.length ? actions : defaultDecisionTreeInput.actions
      };
    }
  } catch (error) {
    reportCaughtError(error);
    return { ...defaultDecisionTreeInput };
  }

  return { ...defaultDecisionTreeInput };
};

export const serializeDecisionTreeInput = (input: DecisionTreeInput) =>
  JSON.stringify(input, null, 2);

export const computeDecisionTreeMetrics = (
  input: DecisionTreeInput
): DecisionTreeMetricsSummary => {
  let maxAbsPayoff = 0;

  const actions = input.actions.map((action, index) => {
    const outcomes = action.outcomes ?? [];
    const outcomesCount = outcomes.length;
    let ev = 0;
    let sumProb = 0;
    let probLoss = 0;
    let expectedLoss = 0;
    let minPayoff = Number.POSITIVE_INFINITY;
    let maxPayoff = Number.NEGATIVE_INFINITY;

    const hasEmptyFields =
      !action.name ||
      outcomes.some(
        (outcome) =>
          outcome.probability == null ||
          outcome.payoff == null ||
          !normalizeString(outcome.riskTag)
      );

    outcomes.forEach((outcome) => {
      const probability = outcome.probability ?? 0;
      const payoff = outcome.payoff ?? 0;
      sumProb += probability;
      ev += probability * payoff;
      maxAbsPayoff = Math.max(maxAbsPayoff, Math.abs(payoff));
      minPayoff = Math.min(minPayoff, payoff);
      maxPayoff = Math.max(maxPayoff, payoff);
      if (payoff < 0) {
        probLoss += probability;
        expectedLoss += probability * payoff;
      }
    });

    if (!Number.isFinite(minPayoff)) minPayoff = 0;
    if (!Number.isFinite(maxPayoff)) maxPayoff = 0;

    const variance = outcomes.reduce((sum, outcome) => {
      const probability = outcome.probability ?? 0;
      const payoff = outcome.payoff ?? 0;
      const diff = payoff - ev;
      return sum + probability * diff * diff;
    }, 0);

    return {
      name: action.name || `Ход ${index + 1}`,
      ev,
      variance,
      probLoss,
      expectedLoss,
      minPayoff,
      maxPayoff,
      sumProb,
      outcomesCount,
      hasEmptyFields
    };
  });

  const bestByEV = actions.reduce<DecisionTreeActionMetrics | null>(
    (best, current) => {
      if (!best) return current;
      if (current.ev === best.ev) {
        return current.minPayoff > best.minPayoff ? current : best;
      }
      return current.ev > best.ev ? current : best;
    },
    null
  );

  const robustChoice = actions.reduce<DecisionTreeActionMetrics | null>(
    (best, current) => {
      if (!best) return current;
      if (current.minPayoff === best.minPayoff) {
        return current.ev > best.ev ? current : best;
      }
      return current.minPayoff > best.minPayoff ? current : best;
    },
    null
  );

  return {
    actions,
    bestByEV,
    robustChoice,
    maxAbsPayoff
  };
};

const buildActionItems = (options: {
  probabilityMismatch: boolean;
  singleOutcome: boolean;
}): ActionItem[] => {
  const suggestions: ActionItem[] = [];

  if (options.singleOutcome) {
    suggestions.push({
      title: 'разбей награду на диапазон',
      impact: 70,
      effort: 30,
      description: 'Добавьте вариативность исходов, чтобы учесть разброс.'
    });
  }

  if (options.probabilityMismatch) {
    suggestions.push({
      title: 'уточни шансы так, чтобы сумма = 1',
      impact: 80,
      effort: 20,
      description: 'Проверьте, что сумма шансов у каждого хода равна 1.0.'
    });
  }

  if (suggestions.length < 2) {
    suggestions.push({
      title: 'добавь редкие негативные исходы',
      impact: 60,
      effort: 25,
      description: 'Оцените хвостовые риски и редкие потери.'
    });
  }

  if (suggestions.length < 2) {
    suggestions.push({
      title: 'разбей награду на диапазон',
      impact: 70,
      effort: 30,
      description: 'Добавьте вариативность исходов, чтобы учесть разброс.'
    });
  }

  return suggestions.slice(0, 2);
};

export const getDecisionTreeReport = (rawInput: string): IslandReport => {
  const input = parseDecisionTreeInput(rawInput);
  const summary = computeDecisionTreeMetrics(input);

  if (!summary.actions.length) {
    return {
      id: 'decisionTree',
      score: 0,
      confidence: 70,
      headline: 'Добавьте хотя бы одно действие',
      summary: 'Нужно задать набор действий и исходов, чтобы оценить дерево.',
      details: ['Добавьте действия A/B/C и заполните вероятности исходов.'],
      actions: buildActionItems({
        probabilityMismatch: true,
        singleOutcome: true
      })
    };
  }

  const bestByEV = summary.bestByEV ?? summary.actions[0];
  const robustChoice = summary.robustChoice ?? summary.actions[0];
  const probabilityMismatch = summary.actions.some(
    (action) => Math.abs(action.sumProb - 1) > 0.05
  );
  const singleOutcome = summary.actions.some(
    (action) => action.outcomesCount <= 1
  );
  const emptyFields = summary.actions.some((action) => action.hasEmptyFields);

  const baseConfidence = 0.95;
  const confidencePenalty =
    (probabilityMismatch ? 0.12 : 0) +
    (singleOutcome ? 0.08 : 0) +
    (emptyFields ? 0.1 : 0);
  const confidence = clamp(baseConfidence - confidencePenalty, 0.7, 0.95);

  const evScore =
    summary.maxAbsPayoff > 0
      ? clamp(((bestByEV.ev / summary.maxAbsPayoff + 1) / 2) * 100, 0, 100)
      : 50;
  const downsidePenalty = clamp(
    bestByEV.probLoss * 20 +
      (summary.maxAbsPayoff > 0
        ? (Math.abs(bestByEV.expectedLoss) / summary.maxAbsPayoff) * 20
        : 0),
    0,
    40
  );
  const score = clamp(evScore - downsidePenalty, 0, 100);

  const details = summary.actions.map(
    (action) =>
      `${action.name}: EV=${formatNumber(action.ev)}, ` +
      `σ²=${formatNumber(action.variance)}, ` +
      `downside p=${formatNumber(action.probLoss, 2)}, ` +
      `EL=${formatNumber(action.expectedLoss, 2)}, ` +
      `min=${formatNumber(action.minPayoff, 2)}.`
  );

  details.push(
    `Лучший по среднему результату: ${bestByEV.name}. Осторожный выбор: ${robustChoice.name}.`
  );

  const why = probabilityMismatch
    ? 'шансы сейчас не сходятся до 1.0, поэтому вывод ненадёжен'
    : bestByEV.probLoss <= robustChoice.probLoss
      ? 'у этого хода риск потери ниже при хорошем среднем результате'
      : 'у этого хода выше средний результат';

  const nextStep = probabilityMismatch
    ? 'проверь и поправь шансы у каждого хода до суммы 1.0'
    : `сравни его с ${robustChoice.name} на худший сценарий и размер потерь`;

  return {
    id: 'decisionTree',
    score: Math.round(score),
    confidence: Math.round(confidence * 100),
    headline: `Лучший ход: ${bestByEV.name}`,
    summary: `Почему: ${why}. Что дальше: ${nextStep}.`,
    reasons: [
      `Шанс потери у ${bestByEV.name}: ${formatPercent(bestByEV.probLoss, 0)}.`,
      probabilityMismatch
        ? 'Сумма шансов в одном или нескольких ходах не равна 1.0.'
        : `По среднему результату лидирует ${bestByEV.name}.`
    ],
    nextSteps: [
      probabilityMismatch
        ? 'Исправьте значения в «Шанс», чтобы у каждого хода сумма была 1.0.'
        : `Проверьте худший исход для ${bestByEV.name} и ${robustChoice.name}.`,
      `Проверьте ещё один запасной ход рядом с ${bestByEV.name}.`
    ],
    details,
    actions: buildActionItems({ probabilityMismatch, singleOutcome }),
    insights: [
      {
        title: probabilityMismatch
          ? 'Сумма вероятностей расходится с 1.0'
          : 'Вероятности нормированы',
        severity: probabilityMismatch ? 'warning' : 'info'
      },
      {
        title: singleOutcome
          ? 'Слишком мало исходов для части действий'
          : 'Достаточно исходов для сравнения',
        severity: singleOutcome ? 'warning' : 'info'
      }
    ]
  };
};
