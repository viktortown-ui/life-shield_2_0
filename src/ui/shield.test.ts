import { describe, expect, it } from 'vitest';
import { AppState, IslandId } from '../core/types';
import { resolvePrimaryPath } from './shield';

const makeProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0,
  history: []
});

const makeState = (): AppState => ({
  schemaVersion: 5,
  updatedAt: '2026-01-01T00:00:00.000Z',
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
  cosmosActivityLog: [],
  inputData: {
    finance: {
      monthlyIncome: 180000,
      monthlyExpenses: 120000,
      reserveCash: 360000,
      monthlyDebtPayment: 25000,
      incomeSourcesCount: 1
    }
  },
  islands: {
    snapshot: { input: '', lastReport: null, progress: makeProgress() },
    stressTest: { input: '', lastReport: null, progress: makeProgress() },
    incomePortfolio: { input: '', lastReport: null, progress: makeProgress() },
    bayes: { input: '', lastReport: null, progress: makeProgress() },
    hmm: { input: '', lastReport: null, progress: makeProgress() },
    timeseries: { input: '', lastReport: null, progress: makeProgress() },
    optimization: { input: '', lastReport: null, progress: makeProgress() },
    decisionTree: { input: '', lastReport: null, progress: makeProgress() },
    causalDag: { input: '', lastReport: null, progress: makeProgress() }
  }
});

const withRuns = (state: AppState, islandId: IslandId, runsCount: number): AppState => ({
  ...state,
  islands: {
    ...state.islands,
    [islandId]: {
      ...state.islands[islandId],
      progress: {
        ...state.islands[islandId].progress,
        runsCount
      }
    }
  }
});

describe('resolvePrimaryPath', () => {
  it('returns "Заполнить данные" when there is no input and no runs', () => {
    const path = resolvePrimaryPath(makeState());
    expect(path.label).toBe('Заполнить данные');
    expect(path.href).toBe('#/finance');
  });

  it('returns "Запустить анализ" when onboarded but runs are missing', () => {
    const state = makeState();
    state.flags.onboarded = true;
    const path = resolvePrimaryPath(state);
    expect(path.label).toBe('Запустить анализ');
    expect(path.href).toBe('#/islands');
  });

  it('returns "Запустить анализ" when demo is loaded but runs are missing', () => {
    const state = makeState();
    state.flags.demoLoaded = true;
    const path = resolvePrimaryPath(state);
    expect(path.label).toBe('Запустить анализ');
    expect(path.href).toBe('#/islands');
  });

  it('returns "Открыть отчёт" when at least one run exists', () => {
    const state = withRuns(makeState(), 'hmm', 1);
    const path = resolvePrimaryPath(state);
    expect(path.label).toBe('Открыть отчёт');
    expect(path.href).toBe('#/report');
  });
});
