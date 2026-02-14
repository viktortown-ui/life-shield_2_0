import { migrate, schemaVersion } from './migrations';
import {
  AppState,
  CosmosActivityAction,
  CosmosActivityEvent,
  FinanceInputData,
  IslandId,
  IslandReport,
  IslandRunHistoryEntry,
  ValidationResult
} from './types';
import { safeGetItem, safeRemoveItem, safeSetItem } from './storage';
import { reportCaughtError } from './reportError';
import {
  defaultFinanceInput,
  parseFinanceInput,
  serializeFinanceInput
} from '../islands/finance';
import { getSnapshotReport } from '../islands/snapshot';
import { getStressTestReport } from '../islands/stressTest';
import { getIncomePortfolioReport } from '../islands/incomePortfolio';

const STORAGE_KEY = 'lifeShieldV2';
const XP_PER_LEVEL = 120;
const RUN_HISTORY_LIMIT = 10;
const COSMOS_ACTIVITY_LIMIT = 200;
const MC_HISTORY_LIMIT = 50;

interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  state: AppState;
}

const makeIslandProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0,
  history: []
});

const makeMonteCarloHistoryEntry = (
  mcLast: NonNullable<AppState['islands'][IslandId]['mcLast']>
) => ({
  ts: new Date().toISOString(),
  horizonMonths: mcLast.horizonMonths,
  iterations: mcLast.iterations,
  sigmaIncome: mcLast.config.incomeVolatility,
  sigmaExpense: mcLast.config.expensesVolatility,
  shock: mcLast.config.shock,
  ruinProb: mcLast.ruinProb,
  p10: mcLast.quantiles.p10,
  p50: mcLast.quantiles.p50,
  p90: mcLast.quantiles.p90
});

const makeEmptyState = (): AppState => ({
  schemaVersion,
  updatedAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streakDays: 0,
  flags: {
    onboarded: false,
    demoLoaded: false,
    homeScreen: 'shield',
    cosmosShowAllLabels: false,
    cosmosOnlyImportant: false,
    cosmosShowHalo: true,
    cosmosSoundFxEnabled: false,
    cosmosSfxVolume: 0.4,
    cosmosReduceMotionOverride: null
  },
  inputData: {
    finance: { ...defaultFinanceInput }
  },
  cosmosActivityLog: [],
  islands: {
    snapshot: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    stressTest: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    incomePortfolio: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    bayes: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    hmm: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    timeseries: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] },
    optimization: {
      input: '',
      lastReport: null,
      progress: makeIslandProgress(),
      mcLast: null,
      mcHistory: []
    },
    decisionTree: {
      input: '',
      lastReport: null,
      progress: makeIslandProgress(),
      mcLast: null,
      mcHistory: []
    },
    causalDag: { input: '', lastReport: null, progress: makeIslandProgress(), mcLast: null, mcHistory: [] }
  }
});

let cachedState: AppState | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const safeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const safeString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const safeHistoryEntry = (
  value: unknown
): IslandRunHistoryEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.at !== 'string') {
    return null;
  }
  return {
    at: value.at,
    score: safeNumber(value.score, 0),
    confidence: safeNumber(value.confidence, 0)
  };
};

const safeMcHistoryEntry = (
  value: unknown
): NonNullable<AppState['islands'][IslandId]['mcHistory']>[number] | null => {
  if (!isRecord(value) || typeof value.ts !== 'string') {
    return null;
  }
  return {
    ts: value.ts,
    horizonMonths: safeNumber(value.horizonMonths, 0),
    iterations: safeNumber(value.iterations, 0),
    sigmaIncome: safeNumber(value.sigmaIncome, 0),
    sigmaExpense: safeNumber(value.sigmaExpense, 0),
    shock: isRecord(value.shock)
      ? {
          enabled: Boolean(value.shock.enabled),
          probability: safeNumber(value.shock.probability, 0),
          dropPercent: safeNumber(value.shock.dropPercent, 0)
        }
      : undefined,
    ruinProb: safeNumber(value.ruinProb, 0),
    p10: safeNumber(value.p10, 0),
    p50: safeNumber(value.p50, 0),
    p90: safeNumber(value.p90, 0)
  };
};

const appendHistory = (
  history: IslandRunHistoryEntry[],
  entry: IslandRunHistoryEntry
) => {
  const next = [...history, entry];
  if (next.length <= RUN_HISTORY_LIMIT) {
    return next;
  }
  return next.slice(next.length - RUN_HISTORY_LIMIT);
};

const appendMcHistory = (
  history: NonNullable<AppState['islands'][IslandId]['mcHistory']>,
  entry: NonNullable<AppState['islands'][IslandId]['mcHistory']>[number]
) => {
  const next = [...history, entry];
  if (next.length <= MC_HISTORY_LIMIT) {
    return next;
  }
  return next.slice(next.length - MC_HISTORY_LIMIT);
};


const isIslandId = (value: string): value is IslandId => {
  return (
    value === 'snapshot' ||
    value === 'stressTest' ||
    value === 'incomePortfolio' ||
    value === 'bayes' ||
    value === 'hmm' ||
    value === 'timeseries' ||
    value === 'optimization' ||
    value === 'decisionTree' ||
    value === 'causalDag'
  );
};

const safeCosmosActivityAction = (value: unknown): CosmosActivityAction | null => {
  if (value === 'open' || value === 'data' || value === 'report' || value === 'confirm' || value === 'cancel') {
    return value;
  }
  return null;
};

const safeCosmosActivityEvent = (value: unknown): CosmosActivityEvent | null => {
  if (!isRecord(value) || typeof value.ts !== 'string') {
    return null;
  }
  const action = safeCosmosActivityAction(value.action);
  if (!action) {
    return null;
  }
  const islandIdRaw = safeString(value.islandId, '').trim();
  if (!isIslandId(islandIdRaw)) {
    return null;
  }
  return {
    ts: value.ts,
    islandId: islandIdRaw,
    action,
    ...(typeof value.meta === 'string' && value.meta.trim() ? { meta: value.meta.trim() } : {})
  };
};

const appendCosmosActivity = (
  history: CosmosActivityEvent[],
  entry: CosmosActivityEvent
) => {
  const next = [...history, entry];
  if (next.length <= COSMOS_ACTIVITY_LIMIT) {
    return next;
  }
  return next.slice(next.length - COSMOS_ACTIVITY_LIMIT);
};

const mergeProgress = (
  base: AppState['islands'][IslandId]['progress'],
  incoming: unknown
) => {
  if (!isRecord(incoming)) {
    return base;
  }
  const incomingHistory = Array.isArray(incoming.history)
    ? incoming.history.map(safeHistoryEntry).filter(Boolean)
    : [];

  return {
    lastRunAt:
      incoming.lastRunAt === null || typeof incoming.lastRunAt === 'string'
        ? incoming.lastRunAt
        : base.lastRunAt,
    runsCount: safeNumber(incoming.runsCount, base.runsCount),
    bestScore: safeNumber(incoming.bestScore, base.bestScore),
    history: incomingHistory.slice(-RUN_HISTORY_LIMIT) as IslandRunHistoryEntry[]
  };
};

const mergeIslandState = (
  base: AppState['islands'][IslandId],
  incoming: unknown
): AppState['islands'][IslandId] => {
  if (!isRecord(incoming)) {
    return base;
  }
  return {
    input: safeString(incoming.input, base.input),
    lastReport: incoming.lastReport ?? base.lastReport,
    progress: mergeProgress(base.progress, incoming.progress),
    mcLast: incoming.mcLast ?? base.mcLast ?? null,
    mcHistory: Array.isArray(incoming.mcHistory)
      ? (incoming.mcHistory
          .map(safeMcHistoryEntry)
          .filter(Boolean)
          .slice(-MC_HISTORY_LIMIT) as NonNullable<AppState['islands'][IslandId]['mcHistory']>)
      : base.mcHistory ?? []
  };
};

const mergeWithDefaults = (
  base: AppState,
  incoming: unknown
): AppState => {
  if (!isRecord(incoming)) {
    return base;
  }
  const islands = isRecord(incoming.islands) ? incoming.islands : {};
  const incomingFlags = isRecord(incoming.flags) ? incoming.flags : {};
  const incomingInputData = isRecord(incoming.inputData) ? incoming.inputData : {};
  return {
    ...base,
    schemaVersion: safeNumber(incoming.schemaVersion, base.schemaVersion),
    updatedAt: safeString(incoming.updatedAt, base.updatedAt),
    xp: safeNumber(incoming.xp, base.xp),
    level: safeNumber(incoming.level, base.level),
    streakDays: safeNumber(incoming.streakDays, base.streakDays),
    flags: {
      onboarded:
        typeof incomingFlags.onboarded === 'boolean'
          ? incomingFlags.onboarded
          : base.flags.onboarded,
      demoLoaded:
        typeof incomingFlags.demoLoaded === 'boolean'
          ? incomingFlags.demoLoaded
          : base.flags.demoLoaded,
      homeScreen:
        incomingFlags.homeScreen === 'cosmos' ? 'cosmos' : base.flags.homeScreen,
      cosmosShowAllLabels:
        typeof incomingFlags.cosmosShowAllLabels === 'boolean'
          ? incomingFlags.cosmosShowAllLabels
          : base.flags.cosmosShowAllLabels,
      cosmosOnlyImportant:
        typeof incomingFlags.cosmosOnlyImportant === 'boolean'
          ? incomingFlags.cosmosOnlyImportant
          : base.flags.cosmosOnlyImportant,
      cosmosShowHalo:
        typeof incomingFlags.cosmosShowHalo === 'boolean'
          ? incomingFlags.cosmosShowHalo
          : base.flags.cosmosShowHalo,
      cosmosSoundFxEnabled:
        typeof incomingFlags.cosmosSoundFxEnabled === 'boolean'
          ? incomingFlags.cosmosSoundFxEnabled
          : base.flags.cosmosSoundFxEnabled,
      cosmosSfxVolume:
        typeof incomingFlags.cosmosSfxVolume === 'number' && Number.isFinite(incomingFlags.cosmosSfxVolume)
          ? Math.max(0, Math.min(1, incomingFlags.cosmosSfxVolume))
          : base.flags.cosmosSfxVolume,
      cosmosReduceMotionOverride:
        incomingFlags.cosmosReduceMotionOverride === null || typeof incomingFlags.cosmosReduceMotionOverride === 'boolean'
          ? incomingFlags.cosmosReduceMotionOverride
          : base.flags.cosmosReduceMotionOverride
    },
    inputData: {
      finance: {
        ...base.inputData.finance,
        ...(isRecord(incomingInputData.finance)
          ? (incomingInputData.finance as Partial<FinanceInputData>)
          : {})
      }
    },
    cosmosActivityLog: Array.isArray(incoming.cosmosActivityLog)
      ? (incoming.cosmosActivityLog
          .map(safeCosmosActivityEvent)
          .filter(Boolean)
          .slice(-COSMOS_ACTIVITY_LIMIT) as CosmosActivityEvent[])
      : base.cosmosActivityLog,
    islands: {
      snapshot: mergeIslandState(base.islands.snapshot, islands.snapshot),
      stressTest: mergeIslandState(base.islands.stressTest, islands.stressTest),
      incomePortfolio: mergeIslandState(
        base.islands.incomePortfolio,
        islands.incomePortfolio
      ),
      bayes: mergeIslandState(base.islands.bayes, islands.bayes),
      hmm: mergeIslandState(base.islands.hmm, islands.hmm),
      timeseries: mergeIslandState(base.islands.timeseries, islands.timeseries),
      optimization: mergeIslandState(
        base.islands.optimization,
        islands.optimization
      ),
      decisionTree: mergeIslandState(
        base.islands.decisionTree,
        islands.decisionTree
      ),
      causalDag: mergeIslandState(
        base.islands.causalDag,
        islands.causalDag
      )
    }
  };
};

export const ensureState = (): AppState => {
  if (cachedState) {
    return cachedState;
  }

  const stored = safeGetItem(STORAGE_KEY);
  if (!stored) {
    cachedState = makeEmptyState();
    persistState(cachedState);
    return cachedState;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    const merged = mergeWithDefaults(makeEmptyState(), parsed);
    cachedState = migrate(merged);
    persistState(cachedState);
    return cachedState;
  } catch (error) {
    reportCaughtError(error);
    safeRemoveItem(STORAGE_KEY);
    cachedState = makeEmptyState();
    persistState(cachedState);
    return cachedState;
  }
};

export const getState = (): AppState => {
  return ensureState();
};

const persistState = (state: AppState) => {
  safeSetItem(STORAGE_KEY, JSON.stringify(state));
};

const updateState = (nextState: AppState) => {
  cachedState = { ...nextState, updatedAt: new Date().toISOString() };
  persistState(cachedState);
};

const getDayKey = (value: string | null) => {
  if (!value) return null;
  return value.slice(0, 10);
};

const getDayStamp = (dayKey: string | null) => {
  if (!dayKey) return null;
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
};

const computeLevel = (xp: number) =>
  Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);

export const updateIslandInput = (id: IslandId, input: string) => {
  const state = getState();
  const nextFinanceInput =
    id === 'snapshot' || id === 'stressTest' || id === 'incomePortfolio'
      ? parseFinanceInput(input)
      : state.inputData.finance;
  updateState({
    ...state,
    inputData: {
      ...state.inputData,
      finance: nextFinanceInput
    },
    islands: {
      ...state.islands,
      [id]: {
        ...state.islands[id],
        input
      }
    }
  });
};

export const saveFinanceInput = (finance: FinanceInputData) => {
  const state = getState();
  const serializedFinance = serializeFinanceInput(finance);

  updateState({
    ...state,
    inputData: {
      ...state.inputData,
      finance
    },
    islands: {
      ...state.islands,
      snapshot: {
        ...state.islands.snapshot,
        input: serializedFinance
      },
      stressTest: {
        ...state.islands.stressTest,
        input: serializedFinance
      },
      incomePortfolio: {
        ...state.islands.incomePortfolio,
        input: serializedFinance
      }
    }
  });
};

export const runBaseFinanceAnalysis = (finance: FinanceInputData) => {
  saveFinanceInput(finance);
  const serializedFinance = serializeFinanceInput(finance);

  updateIslandReport('snapshot', getSnapshotReport(serializedFinance));
  updateIslandReport('stressTest', getStressTestReport(serializedFinance));
  updateIslandReport('incomePortfolio', getIncomePortfolioReport(serializedFinance));
};

export const updateIslandReport = (id: IslandId, report: IslandReport) => {
  const state = getState();
  const now = new Date().toISOString();
  const islandState = state.islands[id];
  const previousProgress = islandState.progress;
  const updatedBestScore = Math.max(previousProgress.bestScore, report.score);
  const nextProgress = {
    lastRunAt: now,
    runsCount: previousProgress.runsCount + 1,
    bestScore: updatedBestScore,
    history: appendHistory(previousProgress.history, {
      at: now,
      score: report.score,
      confidence: report.confidence
    })
  };

  const previousRunDay = getDayKey(previousProgress.lastRunAt);
  const currentDay = getDayKey(now);
  let streakDays = state.streakDays;
  if (currentDay && currentDay !== previousRunDay) {
    if (!previousRunDay) {
      streakDays = 1;
    } else {
      const currentStamp = getDayStamp(currentDay);
      const previousStamp = getDayStamp(previousRunDay);
      const diffDays =
        currentStamp && previousStamp ? currentStamp - previousStamp : 0;
      streakDays = diffDays <= 1 ? streakDays + 1 : 1;
    }
  }

  const rewardXp = Math.max(5, Math.round(report.score / 4));
  const xp = state.xp + rewardXp;
  const level = computeLevel(xp);

  updateState({
    ...state,
    xp,
    level,
    streakDays,
    islands: {
      ...state.islands,
      [id]: {
        ...state.islands[id],
        lastReport: report,
        progress: nextProgress
      }
    }
  });
};


export const updateIslandMonteCarlo = (
  id: IslandId,
  mcLast: AppState['islands'][IslandId]['mcLast']
) => {
  const state = getState();
  const islandState = state.islands[id];
  const nextMcHistory =
    id === 'stressTest' && mcLast
      ? appendMcHistory(islandState.mcHistory ?? [], makeMonteCarloHistoryEntry(mcLast))
      : islandState.mcHistory ?? [];
  updateState({
    ...state,
    islands: {
      ...state.islands,
      [id]: {
        ...state.islands[id],
        mcLast,
        mcHistory: nextMcHistory
      }
    }
  });
};

export const setOnboarded = (value = true) => {
  const state = getState();
  updateState({
    ...state,
    flags: {
      ...state.flags,
      onboarded: value
    }
  });
};


export const setHomeScreen = (value: AppState['flags']['homeScreen']) => {
  const state = getState();
  updateState({
    ...state,
    flags: {
      ...state.flags,
      homeScreen: value
    }
  });
};


export const setCosmosUiFlags = (value: {
  cosmosShowAllLabels?: boolean;
  cosmosOnlyImportant?: boolean;
  cosmosShowHalo?: boolean;
  cosmosSoundFxEnabled?: boolean;
  cosmosSfxVolume?: number;
  cosmosReduceMotionOverride?: boolean | null;
}) => {
  const state = getState();
  updateState({
    ...state,
    flags: {
      ...state.flags,
      ...(typeof value.cosmosShowAllLabels === 'boolean'
        ? { cosmosShowAllLabels: value.cosmosShowAllLabels }
        : {}),
      ...(typeof value.cosmosOnlyImportant === 'boolean'
        ? { cosmosOnlyImportant: value.cosmosOnlyImportant }
        : {}),
      ...(typeof value.cosmosShowHalo === 'boolean'
        ? { cosmosShowHalo: value.cosmosShowHalo }
        : {}),
      ...(typeof value.cosmosSoundFxEnabled === 'boolean'
        ? { cosmosSoundFxEnabled: value.cosmosSoundFxEnabled }
        : {}),
      ...(typeof value.cosmosSfxVolume === 'number' && Number.isFinite(value.cosmosSfxVolume)
        ? { cosmosSfxVolume: Math.max(0, Math.min(1, value.cosmosSfxVolume)) }
        : {}),
      ...(value.cosmosReduceMotionOverride === null || typeof value.cosmosReduceMotionOverride === 'boolean'
        ? { cosmosReduceMotionOverride: value.cosmosReduceMotionOverride }
        : {})
    }
  });
};


export const recordCosmosEvent = (
  islandId: IslandId,
  action: CosmosActivityAction,
  meta?: string
) => {
  const state = getState();
  updateState({
    ...state,
    cosmosActivityLog: appendCosmosActivity(state.cosmosActivityLog, {
      ts: new Date().toISOString(),
      islandId,
      action,
      ...(meta?.trim() ? { meta: meta.trim() } : {})
    })
  });
};

export const loadDemoData = () => {
  const state = getState();
  const now = new Date().toISOString();
  const financeDemoInput = {
    monthlyIncome: 210000,
    monthlyExpenses: 130000,
    reserveCash: 420000,
    monthlyDebtPayment: 27000,
    incomeSourcesCount: 3,
    top1Share: 0.58,
    top3Share: 0.94,
    incomeSources: [
      { amount: 122000, stability: 5 },
      { amount: 52000, stability: 4 },
      { amount: 36000, stability: 3 }
    ]
  };
  const serializedFinance = serializeFinanceInput(financeDemoInput);
  const snapshotReport = getSnapshotReport(serializedFinance);
  const stressReport = getStressTestReport(serializedFinance);
  const portfolioReport = getIncomePortfolioReport(serializedFinance);

  const withHistory = (
    id: IslandId,
    report: IslandReport,
    input = state.islands[id].input
  ) => ({
    input,
    lastReport: report,
    progress: {
      ...state.islands[id].progress,
      lastRunAt: now,
      runsCount: Math.max(1, state.islands[id].progress.runsCount),
      bestScore: Math.max(state.islands[id].progress.bestScore, report.score),
      history: appendHistory(state.islands[id].progress.history, {
        at: now,
        score: report.score,
        confidence: report.confidence
      })
    }
  });

  const bayesReport: IslandReport = {
    id: 'bayes',
    score: 73,
    confidence: 69,
    headline: 'Bayes: риск в контролируемой зоне',
    summary: 'Лабораторная оценка риска подтверждает умеренный уровень неопределённости.',
    details: ['Апостериорный риск около 18%.', 'Нужно обновить наблюдения через месяц.']
  };

  const hmmReport: IslandReport = {
    id: 'hmm',
    score: 76,
    confidence: 71,
    headline: 'Состояние: стабильный рост',
    summary:
      'Модель оценивает вероятность удержания устойчивого режима на 68% в ближайшие 2 периода.',
    details: [
      'Вероятность перехода в стресс-режим: 22%.',
      'Ключевой сигнал — рост доли обязательных расходов.'
    ],
    actions: [
      {
        title: 'Поддерживать буфер на 5.5 месяцев',
        impact: 8,
        effort: 3,
        description: 'Пополняйте резерв до 560 000 ₽ в течение 2 месяцев.'
      }
    ]
  };

  const timeseriesReport: IslandReport = {
    id: 'timeseries',
    score: 81,
    confidence: 74,
    headline: 'Прогноз дохода: умеренный ап-тренд',
    summary:
      'Ожидаемый средний доход на 3 месяца: 214 000 ₽ с диапазоном 196 000–236 000 ₽.',
    details: [
      'Волатильность снизилась на 11% к прошлому кварталу.',
      'Пиковая просадка оценивается как управляемая.'
    ],
    actions: [
      {
        title: 'Обновить прогноз через 30 дней',
        impact: 6,
        effort: 2,
        description: 'Добавьте фактические данные по доходу за текущий месяц.'
      }
    ]
  };

  updateState({
    ...state,
    flags: {
      ...state.flags,
      onboarded: true,
      demoLoaded: true
    },
    inputData: {
      ...state.inputData,
      finance: financeDemoInput
    },
    islands: {
      ...state.islands,
      snapshot: withHistory('snapshot', snapshotReport, serializedFinance),
      stressTest: withHistory('stressTest', stressReport, serializedFinance),
      incomePortfolio: withHistory('incomePortfolio', portfolioReport, serializedFinance),
      bayes: withHistory('bayes', bayesReport),
      hmm: withHistory('hmm', hmmReport),
      timeseries: withHistory('timeseries', timeseriesReport)
    }
  });
};

export const resetState = () => {
  updateState(makeEmptyState());
};

export const exportState = (): string => {
  const payload: ExportPayload = {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    state: getState()
  };
  return JSON.stringify(payload, null, 2);
};

export const validateImport = (raw: unknown): ValidationResult => {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Некорректный формат JSON.'] };
  }
  const payload = raw as ExportPayload;
  if (typeof payload.schemaVersion !== 'number') {
    errors.push('Отсутствует schemaVersion.');
  }
  if (typeof payload.exportedAt !== 'string') {
    errors.push('Отсутствует дата экспорта.');
  }
  if (!payload.state?.islands) {
    errors.push('Отсутствуют данные островов.');
  }
  return { ok: errors.length === 0, errors };
};

export const importState = (raw: unknown): ValidationResult => {
  const validation = validateImport(raw);
  if (!validation.ok) {
    return validation;
  }
  const payload = raw as ExportPayload;
  const state = migrate(payload.state);
  updateState(state);
  return { ok: true, errors: [] };
};
