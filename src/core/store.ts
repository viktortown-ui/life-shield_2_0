import { migrate, schemaVersion } from './migrations';
import { AppState, IslandId, IslandReport, ValidationResult } from './types';

const STORAGE_KEY = 'lifeShieldV2';

interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  state: AppState;
}

const makeEmptyState = (): AppState => ({
  schemaVersion,
  updatedAt: new Date().toISOString(),
  islands: {
    bayes: { input: '', lastReport: null },
    hmm: { input: '', lastReport: null },
    timeseries: { input: '', lastReport: null },
    optimization: { input: '', lastReport: null },
    decisionTree: { input: '', lastReport: null },
    causalDag: { input: '', lastReport: null }
  }
});

let cachedState: AppState | null = null;

export const ensureState = (): AppState => {
  if (cachedState) {
    return cachedState;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
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
    cachedState = makeEmptyState();
    persistState(cachedState);
    return cachedState;
  }
};

export const getState = (): AppState => {
  return ensureState();
};

const persistState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const updateState = (nextState: AppState) => {
  cachedState = { ...nextState, updatedAt: new Date().toISOString() };
  persistState(cachedState);
};

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
  updateState({
    ...state,
    islands: {
      ...state.islands,
      [id]: {
        ...state.islands[id],
        lastReport: report
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
