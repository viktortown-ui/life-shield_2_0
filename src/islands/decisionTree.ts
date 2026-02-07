import { IslandReport } from '../core/types';

export type DecisionTreeNode = DecisionNode | ChanceNode | TerminalNode;

export interface DecisionNode {
  id: string;
  type: 'decision';
  label: string;
  options: DecisionOption[];
}

export interface DecisionOption {
  label: string;
  child: DecisionTreeNode;
}

export interface ChanceNode {
  id: string;
  type: 'chance';
  label: string;
  outcomes: ChanceOutcome[];
}

export interface ChanceOutcome {
  label: string;
  probability: number;
  child: DecisionTreeNode;
}

export interface TerminalNode {
  id: string;
  type: 'terminal';
  label: string;
  payoff: {
    money: number;
    energy: number;
    stress: number;
  };
  utility: number;
}

export interface DecisionTreeSettings {
  riskAversion: number;
  sensitivity: {
    deltaPercent: number;
    chanceId: string;
    outcomeLabel: string;
  };
}

interface StoredDecisionTreeInput {
  tree?: DecisionTreeNode;
  treeText?: string;
  settings?: Partial<DecisionTreeSettings>;
}

interface ParsedDecisionTreeInput {
  treeText: string;
  settings: DecisionTreeSettings;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—';

const defaultDecisionTree: DecisionTreeNode = {
  id: 'root',
  type: 'decision',
  label: 'Стратегия запуска',
  options: [
    {
      label: 'Запуск сейчас',
      child: {
        id: 'market',
        type: 'chance',
        label: 'Реакция рынка',
        outcomes: [
          {
            label: 'Спрос растёт',
            probability: 0.6,
            child: {
              id: 'win',
              type: 'terminal',
              label: 'Успех',
              payoff: { money: 120, energy: -20, stress: 40 },
              utility: 85
            }
          },
          {
            label: 'Спрос слабый',
            probability: 0.4,
            child: {
              id: 'meh',
              type: 'terminal',
              label: 'Сдержанный результат',
              payoff: { money: 40, energy: -10, stress: 20 },
              utility: 35
            }
          }
        ]
      }
    },
    {
      label: 'Подождать квартал',
      child: {
        id: 'delay',
        type: 'chance',
        label: 'Эффект ожидания',
        outcomes: [
          {
            label: 'Уточняем продукт',
            probability: 0.5,
            child: {
              id: 'refine',
              type: 'terminal',
              label: 'Улучшенный запуск',
              payoff: { money: 90, energy: -15, stress: 25 },
              utility: 65
            }
          },
          {
            label: 'Окно упущено',
            probability: 0.5,
            child: {
              id: 'missed',
              type: 'terminal',
              label: 'Потеря темпа',
              payoff: { money: 10, energy: 5, stress: 35 },
              utility: 5
            }
          }
        ]
      }
    }
  ]
};

const defaultSettings: DecisionTreeSettings = {
  riskAversion: 0.3,
  sensitivity: {
    deltaPercent: 10,
    chanceId: 'market',
    outcomeLabel: 'Спрос растёт'
  }
};

export const serializeDecisionTreeInput = (
  treeText: string,
  settings: DecisionTreeSettings
) => JSON.stringify({ treeText, settings }, null, 2);

export const parseDecisionTreeInput = (input: string): ParsedDecisionTreeInput => {
  if (!input.trim()) {
    return {
      treeText: JSON.stringify(defaultDecisionTree, null, 2),
      settings: defaultSettings
    };
  }

  try {
    const parsed = JSON.parse(input) as StoredDecisionTreeInput;
    if (parsed && (parsed.tree || parsed.treeText)) {
      const treeText = parsed.tree
        ? JSON.stringify(parsed.tree, null, 2)
        : parsed.treeText ?? '';
      return {
        treeText,
        settings: {
          riskAversion: clamp(
            parsed.settings?.riskAversion ?? defaultSettings.riskAversion,
            0,
            1
          ),
          sensitivity: {
            deltaPercent: clamp(
              parsed.settings?.sensitivity?.deltaPercent ??
                defaultSettings.sensitivity.deltaPercent,
              0,
              100
            ),
            chanceId:
              parsed.settings?.sensitivity?.chanceId ??
              defaultSettings.sensitivity.chanceId,
            outcomeLabel:
              parsed.settings?.sensitivity?.outcomeLabel ??
              defaultSettings.sensitivity.outcomeLabel
          }
        }
      };
    }

    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return {
        treeText: JSON.stringify(parsed, null, 2),
        settings: defaultSettings
      };
    }
  } catch {
    return {
      treeText: input,
      settings: defaultSettings
    };
  }

  return {
    treeText: input,
    settings: defaultSettings
  };
};

const parseTreeFromText = (treeText: string) => {
  try {
    return {
      tree: JSON.parse(treeText) as DecisionTreeNode,
      errors: [] as string[]
    };
  } catch (error) {
    return {
      tree: null,
      errors: ['Дерево должно быть валидным JSON.']
    };
  }
};

const validateTree = (tree: DecisionTreeNode | null) => {
  const errors: string[] = [];
  const ids = new Set<string>();

  const visit = (node: DecisionTreeNode | null, path: string[]) => {
    if (!node) return;
    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Узлу ${path.join(' → ')} нужен уникальный id.`);
    } else if (ids.has(node.id)) {
      errors.push(`id «${node.id}» повторяется в дереве.`);
    } else {
      ids.add(node.id);
    }

    if (!node.label) {
      errors.push(`Узел ${node.id || path.join(' → ')} должен иметь label.`);
    }

    if (node.type === 'decision') {
      if (!node.options?.length) {
        errors.push(`Decision ${node.label} должен иметь options.`);
      }
      node.options?.forEach((option, index) => {
        if (!option.label) {
          errors.push(`Option ${index + 1} в ${node.label} без label.`);
        }
        visit(option.child, [...path, option.label || `option ${index + 1}`]);
      });
    }

    if (node.type === 'chance') {
      if (!node.outcomes?.length) {
        errors.push(`Chance ${node.label} должен иметь outcomes.`);
      }
      const probabilities = node.outcomes?.map((outcome) => outcome.probability);
      if (probabilities?.some((value) => value == null || value < 0)) {
        errors.push(`Вероятности в ${node.label} должны быть >= 0.`);
      }
      const total = probabilities?.reduce((sum, value) => sum + value, 0) ?? 0;
      if (Math.abs(total - 1) > 0.01) {
        errors.push(
          `Сумма вероятностей в ${node.label} должна быть 1 (сейчас ${formatNumber(
            total,
            3
          )}).`
        );
      }
      node.outcomes?.forEach((outcome, index) => {
        if (!outcome.label) {
          errors.push(`Outcome ${index + 1} в ${node.label} без label.`);
        }
        visit(outcome.child, [...path, outcome.label || `outcome ${index + 1}`]);
      });
    }

    if (node.type === 'terminal') {
      if (!node.payoff) {
        errors.push(`Terminal ${node.label} должен иметь payoff.`);
      } else {
        const { money, energy, stress } = node.payoff;
        if (![money, energy, stress].every(Number.isFinite)) {
          errors.push(`Payoff ${node.label} должен быть числовым.`);
        }
      }
      if (!Number.isFinite(node.utility)) {
        errors.push(`Terminal ${node.label} должен иметь utility.`);
      }
    }
  };

  visit(tree, ['root']);
  return errors;
};

const adjustUtility = (utility: number, riskAversion: number) => {
  const exponent = 1 - riskAversion * 0.7;
  const magnitude = Math.pow(Math.abs(utility), exponent);
  return Math.sign(utility) * magnitude;
};

interface EvaluationResult {
  ev: number;
  eu: number;
  minUtility: number;
  maxUtility: number;
  maxVariance: number;
  maxVarianceNode: string;
  bestPath: string[];
}

const evaluateNode = (
  node: DecisionTreeNode,
  riskAversion: number
): EvaluationResult => {
  if (node.type === 'terminal') {
    return {
      ev: node.utility,
      eu: adjustUtility(node.utility, riskAversion),
      minUtility: node.utility,
      maxUtility: node.utility,
      maxVariance: 0,
      maxVarianceNode: node.label,
      bestPath: [node.label]
    };
  }

  if (node.type === 'chance') {
    const evaluated = node.outcomes.map((outcome) =>
      evaluateNode(outcome.child, riskAversion)
    );
    const ev = node.outcomes.reduce(
      (sum, outcome, index) => sum + outcome.probability * evaluated[index].ev,
      0
    );
    const eu = node.outcomes.reduce(
      (sum, outcome, index) => sum + outcome.probability * evaluated[index].eu,
      0
    );
    const variance = node.outcomes.reduce((sum, outcome, index) => {
      const diff = evaluated[index].ev - ev;
      return sum + outcome.probability * diff * diff;
    }, 0);

    let maxVariance = variance;
    let maxVarianceNode = node.label;
    evaluated.forEach((result) => {
      if (result.maxVariance > maxVariance) {
        maxVariance = result.maxVariance;
        maxVarianceNode = result.maxVarianceNode;
      }
    });

    return {
      ev,
      eu,
      minUtility: Math.min(...evaluated.map((item) => item.minUtility)),
      maxUtility: Math.max(...evaluated.map((item) => item.maxUtility)),
      maxVariance,
      maxVarianceNode,
      bestPath: [node.label]
    };
  }

  const evaluated = node.options.map((option) =>
    evaluateNode(option.child, riskAversion)
  );

  const ranked = node.options
    .map((option, index) => ({ option, metrics: evaluated[index] }))
    .sort((a, b) => {
      if (b.metrics.eu !== a.metrics.eu) {
        return b.metrics.eu - a.metrics.eu;
      }
      return b.metrics.ev - a.metrics.ev;
    });

  const best = ranked[0];
  const bestPath = [node.label, best.option.label, ...best.metrics.bestPath];
  const maxVarianceEntry = ranked.reduce(
    (acc, entry) =>
      entry.metrics.maxVariance > acc.maxVariance ? entry.metrics : acc,
    ranked[0].metrics
  );

  return {
    ev: best.metrics.ev,
    eu: best.metrics.eu,
    minUtility: Math.min(...evaluated.map((item) => item.minUtility)),
    maxUtility: Math.max(...evaluated.map((item) => item.maxUtility)),
    maxVariance: maxVarianceEntry.maxVariance,
    maxVarianceNode: maxVarianceEntry.maxVarianceNode,
    bestPath
  };
};

const listChanceNodes = (node: DecisionTreeNode): ChanceNode[] => {
  if (node.type === 'chance') {
    return [node, ...node.outcomes.flatMap((outcome) => listChanceNodes(outcome.child))];
  }
  if (node.type === 'decision') {
    return node.options.flatMap((option) => listChanceNodes(option.child));
  }
  return [];
};

const cloneTree = (tree: DecisionTreeNode) =>
  JSON.parse(JSON.stringify(tree)) as DecisionTreeNode;

const adjustChanceProbability = (
  tree: DecisionTreeNode,
  chanceId: string,
  outcomeLabel: string,
  deltaPercent: number
) => {
  const target = listChanceNodes(tree).find((node) => node.id === chanceId);
  if (!target) {
    return { tree, error: `Шанс-узел «${chanceId}» не найден.` };
  }
  const outcome = target.outcomes.find((entry) => entry.label === outcomeLabel);
  if (!outcome) {
    return {
      tree,
      error: `Outcome «${outcomeLabel}» не найден в ${target.label}.`
    };
  }

  const original = outcome.probability;
  const delta = deltaPercent / 100;
  const updated = clamp(original * (1 + delta), 0, 1);
  const remaining = 1 - updated;
  const others = target.outcomes.filter((entry) => entry !== outcome);
  const othersTotal = others.reduce((sum, entry) => sum + entry.probability, 0);

  if (others.length === 0) {
    return { tree, error: 'В узле только один исход, чувствительность не применима.' };
  }

  others.forEach((entry) => {
    entry.probability = othersTotal > 0 ? (entry.probability / othersTotal) * remaining : remaining / others.length;
  });
  outcome.probability = updated;

  return { tree, error: '' };
};

const summarizeSensitivity = (
  tree: DecisionTreeNode,
  settings: DecisionTreeSettings
) => {
  const { chanceId, outcomeLabel, deltaPercent } = settings.sensitivity;
  if (!chanceId || !outcomeLabel || deltaPercent === 0) {
    return {
      text: 'Чувствительность: не задана цель вариации вероятности.',
      critical: [] as string[]
    };
  }

  const baselineEval = evaluateNode(tree, settings.riskAversion);
  const baseline = baselineEval.bestPath[1] ?? baselineEval.bestPath[0] ?? '';

  const bumpedTree = cloneTree(tree);
  const bumpedResult = adjustChanceProbability(
    bumpedTree,
    chanceId,
    outcomeLabel,
    deltaPercent
  );

  if (bumpedResult.error) {
    return { text: `Чувствительность: ${bumpedResult.error}`, critical: [] };
  }

  const decreasedTree = cloneTree(tree);
  const decreasedResult = adjustChanceProbability(
    decreasedTree,
    chanceId,
    outcomeLabel,
    -deltaPercent
  );

  if (decreasedResult.error) {
    return { text: `Чувствительность: ${decreasedResult.error}`, critical: [] };
  }

  const upEval = evaluateNode(bumpedTree, settings.riskAversion);
  const downEval = evaluateNode(decreasedTree, settings.riskAversion);

  const upChoice = upEval.bestPath[1] ?? upEval.bestPath[0] ?? '';
  const downChoice = downEval.bestPath[1] ?? downEval.bestPath[0] ?? '';
  const critical: string[] = [];

  if (baseline !== upChoice) {
    critical.push(
      `При +${deltaPercent}% по «${outcomeLabel}» выбор меняется на «${upChoice}».`
    );
  }
  if (baseline !== downChoice) {
    critical.push(
      `При -${deltaPercent}% по «${outcomeLabel}» выбор меняется на «${downChoice}».`
    );
  }

  if (critical.length === 0) {
    return {
      text: `Чувствительность: ±${deltaPercent}% не меняет рекомендацию.`,
      critical
    };
  }

  return {
    text: `Чувствительность: ${critical.join(' ')}`,
    critical
  };
};

const buildErrorReport = (input: string, errors: string[]): IslandReport => ({
  id: 'decisionTree',
  score: 15,
  confidence: 20,
  headline: 'Нужно поправить дерево решений',
  summary: input.trim()
    ? 'Проверьте структуру дерева: найдены ошибки в описании.'
    : 'Добавьте JSON-описание дерева решений.',
  details: errors.length ? errors : ['Не удалось прочитать дерево решений.'],
  insights: [
    { title: 'Без корректного дерева расчёт невозможен', severity: 'risk' }
  ],
  actions: [
    {
      title: 'Исправить структуру дерева и вероятности',
      impact: 70,
      effort: 35
    }
  ]
});

export const getDecisionTreeReport = (input: string): IslandReport => {
  const parsed = parseDecisionTreeInput(input);
  const { tree, errors: parseErrors } = parseTreeFromText(parsed.treeText);
  if (!tree) {
    return buildErrorReport(input, parseErrors);
  }
  const validationErrors = validateTree(tree);
  if (validationErrors.length) {
    return buildErrorReport(input, validationErrors);
  }

  const evaluation = evaluateNode(tree, parsed.settings.riskAversion);
  const range = evaluation.maxUtility - evaluation.minUtility;
  const uncertainty =
    range > 0 ? clamp(Math.sqrt(evaluation.maxVariance) / range, 0, 1) : 0;
  const score =
    range > 0
      ? clamp(((evaluation.eu - evaluation.minUtility) / range) * 100, 0, 100)
      : 50;
  const confidence = clamp(90 - uncertainty * 50, 30, 95);
  const bestBranch = evaluation.bestPath.slice(1, 3).join(' → ');
  const sensitivity = summarizeSensitivity(tree, parsed.settings);

  const details = [
    `EV (utility): ${formatNumber(evaluation.ev)}; Expected Utility: ${formatNumber(
      evaluation.eu
    )} при risk_aversion=${parsed.settings.riskAversion}.`,
    `Лучшая ветка: ${bestBranch || evaluation.bestPath[0]}.`,
    `Максимальная неопределённость: ${evaluation.maxVarianceNode} (σ²=${formatNumber(
      evaluation.maxVariance
    )}).`,
    sensitivity.text
  ];

  return {
    id: 'decisionTree',
    score: Math.round(score),
    confidence: Math.round(confidence),
    headline: bestBranch
      ? `Рекомендация: ${bestBranch}`
      : 'Рекомендация построена по ожиданиям',
    summary: `EV=${formatNumber(evaluation.ev)}, EU=${formatNumber(
      evaluation.eu
    )}, неопределённость=${Math.round(uncertainty * 100)}%.`,
    details,
    actions: [
      {
        title: 'Проверьте ключевые вероятности',
        impact: clamp(60 + uncertainty * 30, 40, 90),
        effort: 25,
        description: 'Уточните вероятность в узлах с максимальной неопределённостью.'
      }
    ],
    insights: [
      {
        title:
          uncertainty > 0.4
            ? 'Высокая неопределённость требует дополнительных данных'
            : 'Риск контролируем, но следите за шансами',
        severity: uncertainty > 0.5 ? 'risk' : 'warning'
      },
      ...(sensitivity.critical.length
        ? [
            {
              title: 'Есть критичные вероятности, меняющие рекомендацию',
              severity: 'warning'
            }
          ]
        : [])
    ]
  };
};
