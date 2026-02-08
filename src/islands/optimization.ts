import { ActionItem, IslandReport } from '../core/types';
import { reportCaughtError } from '../core/reportError';

export interface OptimizationActionInput {
  name: string;
  hoursCost: number;
  moneyCost: number;
  impactScore: number;
  mandatory: boolean;
}

export interface OptimizationInput {
  weeklyBudgetHours: number;
  maxHours: number;
  maxMoney: number;
  actions: OptimizationActionInput[];
}

export interface OptimizationSolution {
  status: 'optimal' | 'infeasible' | 'error';
  selected: OptimizationActionInput[];
  totalImpact: number;
  totalHours: number;
  totalMoney: number;
  error?: string;
}

export interface OptimizationWorkerRequest {
  requestId: string;
  input: OptimizationInput;
}

export interface OptimizationWorkerResponse {
  requestId: string;
  solution: OptimizationSolution;
}

export const defaultOptimizationInput: OptimizationInput = {
  weeklyBudgetHours: 168,
  maxHours: 40,
  maxMoney: 25000,
  actions: [
    {
      name: 'Фокус-сессии',
      hoursCost: 6,
      moneyCost: 0,
      impactScore: 35,
      mandatory: true
    },
    {
      name: 'Спорт',
      hoursCost: 4,
      moneyCost: 2000,
      impactScore: 24,
      mandatory: false
    },
    {
      name: 'Обучение',
      hoursCost: 8,
      moneyCost: 6000,
      impactScore: 40,
      mandatory: false
    }
  ]
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeScore = (input: OptimizationInput, totalImpact: number) => {
  const maxImpact = input.actions
    .filter(
      (action) =>
        action.hoursCost <= input.maxHours &&
        action.moneyCost <= input.maxMoney
    )
    .reduce((sum, action) => sum + action.impactScore, 0);
  if (maxImpact <= 0) return 0;
  return clamp((totalImpact / maxImpact) * 100, 0, 100);
};

export const parseOptimizationInput = (raw: string): OptimizationInput => {
  if (!raw.trim()) {
    return defaultOptimizationInput;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OptimizationInput>;
    return {
      weeklyBudgetHours:
        typeof parsed.weeklyBudgetHours === 'number'
          ? parsed.weeklyBudgetHours
          : defaultOptimizationInput.weeklyBudgetHours,
      maxHours:
        typeof parsed.maxHours === 'number'
          ? parsed.maxHours
          : defaultOptimizationInput.maxHours,
      maxMoney:
        typeof parsed.maxMoney === 'number'
          ? parsed.maxMoney
          : defaultOptimizationInput.maxMoney,
      actions: Array.isArray(parsed.actions)
        ? parsed.actions.map((action) => ({
            name: String(action.name ?? 'Без названия'),
            hoursCost: Number(action.hoursCost ?? 0),
            moneyCost: Number(action.moneyCost ?? 0),
            impactScore: Number(action.impactScore ?? 0),
            mandatory: Boolean(action.mandatory)
          }))
        : defaultOptimizationInput.actions
    };
  } catch (error) {
    reportCaughtError(error);
    return defaultOptimizationInput;
  }
};

export const serializeOptimizationInput = (input: OptimizationInput) =>
  JSON.stringify(input);

const buildActionItems = (
  actions: OptimizationActionInput[]
): ActionItem[] =>
  actions.map((action) => ({
    title: action.name,
    impact: action.impactScore,
    effort: Math.max(1, action.hoursCost),
    description: `Время: ${action.hoursCost}ч, бюджет: ${action.moneyCost}`
  }));

export const buildOptimizationPendingReport = (
  input: OptimizationInput
): IslandReport => ({
  id: 'optimization',
  score: 0,
  confidence: 45,
  headline: 'Решаю…',
  summary:
    'Собираем оптимальный план. Это может занять несколько секунд.',
  details: [
    `Планируемые часы: ${input.maxHours}`,
    `Бюджет: ${input.maxMoney}`,
    `Кандидаты: ${input.actions.length}`
  ]
});

export const buildOptimizationReport = (
  input: OptimizationInput,
  solution: OptimizationSolution
): IslandReport => {
  if (solution.status === 'optimal') {
    const score = normalizeScore(input, solution.totalImpact);
    return {
      id: 'optimization',
      score,
      confidence: 90,
      headline: 'Оптимальный план найден',
      summary: `Подборка из ${solution.selected.length} действий даёт ${solution.totalImpact} баллов.`,
      details: [
        `Часы: ${solution.totalHours} / ${input.maxHours}`,
        `Бюджет: ${solution.totalMoney} / ${input.maxMoney}`,
        `Обязательных действий: ${
          input.actions.filter((action) => action.mandatory).length
        }`
      ],
      actions: buildActionItems(
        [...solution.selected].sort(
          (a, b) => b.impactScore - a.impactScore
        )
      ).slice(0, 3),
      insights: [
        {
          title: 'Баланс ресурсов соблюдён',
          severity: 'info'
        }
      ]
    };
  }

  if (solution.status === 'infeasible') {
    return {
      id: 'optimization',
      score: 5,
      confidence: 55,
      headline: 'Ограничения конфликтуют',
      summary:
        'Невозможно выполнить обязательные действия в заданных лимитах.',
      details: [
        `Часы: ${input.maxHours}`,
        `Бюджет: ${input.maxMoney}`,
        solution.error ?? 'Проверьте вводимые ограничения.'
      ],
      insights: [
        {
          title: 'Нужно ослабить ограничения или пересмотреть обязательные задачи',
          severity: 'risk'
        }
      ]
    };
  }

  return {
    id: 'optimization',
    score: 0,
    confidence: 35,
    headline: 'Ошибка оптимизации',
    summary: solution.error ?? 'Не удалось вычислить план.',
    details: [
      'Проверьте корректность входных данных.',
      'Повторите попытку после правки ограничений.'
    ],
    insights: [
      {
        title: 'Нужна повторная проверка параметров',
        severity: 'warning'
      }
    ]
  };
};

export const getOptimizationReport = (input: string): IslandReport => {
  const parsed = parseOptimizationInput(input);
  return {
    id: 'optimization',
    score: 0,
    confidence: 40,
    headline: 'Готово к оптимизации',
    summary:
      'Заполните параметры и нажмите «Решить», чтобы получить оптимальный план.',
    details: [
      `Планируемые часы: ${parsed.maxHours}`,
      `Бюджет: ${parsed.maxMoney}`,
      `Кандидатов: ${parsed.actions.length}`
    ]
  };
};
