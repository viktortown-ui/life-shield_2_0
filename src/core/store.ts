import { migrate, schemaVersion } from './migrations';
import { AppState, IslandId, IslandReport, ValidationResult } from './types';
import { safeGetItem, safeRemoveItem, safeSetItem } from './storage';
import { reportCaughtError } from './reportError';
import {
  BayesInput,
  buildBayesReport,
  defaultBayesInput,
  serializeBayesInput
} from '../islands/bayes';

const STORAGE_KEY = 'lifeShieldV2';
const XP_PER_LEVEL = 120;

interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  state: AppState;
}

const makeIslandProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0
});

const makeEmptyState = (): AppState => ({
  schemaVersion,
  updatedAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streakDays: 0,
  flags: {
    onboarded: false,
    demoLoaded: false
  },
  islands: {
    bayes: { input: '', lastReport: null, progress: makeIslandProgress() },
    hmm: { input: '', lastReport: null, progress: makeIslandProgress() },
    timeseries: { input: '', lastReport: null, progress: makeIslandProgress() },
    optimization: {
      input: '',
      lastReport: null,
      progress: makeIslandProgress()
    },
    decisionTree: {
      input: '',
      lastReport: null,
      progress: makeIslandProgress()
    },
    causalDag: { input: '', lastReport: null, progress: makeIslandProgress() }
  }
});

let cachedState: AppState | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const safeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const safeString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const mergeProgress = (
  base: AppState['islands'][IslandId]['progress'],
  incoming: unknown
) => {
  if (!isRecord(incoming)) {
    return base;
  }
  return {
    lastRunAt:
      incoming.lastRunAt === null || typeof incoming.lastRunAt === 'string'
        ? incoming.lastRunAt
        : base.lastRunAt,
    runsCount: safeNumber(incoming.runsCount, base.runsCount),
    bestScore: safeNumber(incoming.bestScore, base.bestScore)
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
    progress: mergeProgress(base.progress, incoming.progress)
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
          : base.flags.demoLoaded
    },
    islands: {
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
  updateState({
    ...state,
    islands: {
      ...state.islands,
      [id]: {
        ...state.islands[id],
        input
      }
    }
  });
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
    bestScore: updatedBestScore
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

export const loadDemoData = () => {
  const state = getState();
  const demoInput: BayesInput = {
    ...defaultBayesInput,
    months: 6,
    reserve: 420000,
    incomeMean: 210000,
    incomeSd: 25000,
    expensesMean: 130000,
    expensesSd: 18000,
    observationMonths: 9,
    observationFailures: 1,
    simulationRuns: 1500,
    mcmcSamples: 1500
  };
  const serialized = serializeBayesInput(demoInput);
  const report = buildBayesReport(demoInput, {
    posterior: {
      mean: 0.17,
      ciLow: 0.09,
      ciHigh: 0.26,
      quantiles: [0.1, 0.16, 0.24]
    },
    riskProbability: 0.18,
    reserveQuantiles: [140000, 300000, 470000],
    posteriorSvg: '<div class="muted">Демо-результат: риск в контролируемой зоне.</div>',
    effectiveSampleSize: 980,
    acceptanceRate: 0.34,
    sampleCount: 1500,
    observationMonths: demoInput.observationMonths,
    observationFailures: demoInput.observationFailures
  });

  updateState({
    ...state,
    flags: {
      ...state.flags,
      onboarded: true,
      demoLoaded: true
    },
    islands: {
      ...state.islands,
      bayes: {
        ...state.islands.bayes,
        input: serialized,
        lastReport: report,
        progress: {
          ...state.islands.bayes.progress,
          lastRunAt: new Date().toISOString(),
          runsCount: Math.max(1, state.islands.bayes.progress.runsCount),
          bestScore: Math.max(state.islands.bayes.progress.bestScore, report.score)
        }
      }
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
