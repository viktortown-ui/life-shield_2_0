import { migrate, schemaVersion } from './migrations';
import { AppState, IslandId, IslandReport, ValidationResult } from './types';
import { safeGetItem, safeRemoveItem, safeSetItem } from './storage';

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
    const parsed = JSON.parse(stored) as AppState;
    cachedState = migrate(parsed);
    persistState(cachedState);
    return cachedState;
  } catch {
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
