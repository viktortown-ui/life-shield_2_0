import { describe, expect, it } from 'vitest';
import { AppState, IslandId } from '../types';
import { computeTurbulence, normalizeWeights, TURBULENCE_SOURCE_WEIGHTS } from './index';

const makeProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0,
  history: []
});

const makeState = (): AppState => ({
  schemaVersion: 1,
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
    finance: {
      monthlyIncome: 180000,
      monthlyExpenses: 120000,
      reserveCash: 360000,
      monthlyDebtPayment: 25000,
      incomeSourcesCount: 1
    }
  },
  observations: {
    cashflowMonthly: [],
    cashflowDriftLast: undefined,
    cashflowForecastLast: undefined
  },
  cosmosActivityLog: [],
  islands: {
    snapshot: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    stressTest: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    incomePortfolio: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    bayes: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    hmm: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    timeseries: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    optimization: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    decisionTree: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] },
    causalDag: { input: '', lastReport: null, progress: makeProgress(), mcLast: null, mcHistory: [] }
  } as Record<IslandId, AppState['islands'][IslandId]>
});

describe('turbulence normalizeWeights', () => {
  it('renormalizes only available weights', () => {
    const normalized = normalizeWeights(TURBULENCE_SOURCE_WEIGHTS, ['cashflowForecast', 'freshness']);
    expect(normalized.get('cashflowForecast')).toBeCloseTo(0.75);
    expect(normalized.get('freshness')).toBeCloseTo(0.25);
    expect(normalized.get('cashflowDrift')).toBeUndefined();
  });
});

describe('computeTurbulence', () => {
  it('ignores null sources and does not return NaN/Infinity', () => {
    const state = makeState();
    state.observations.cashflowForecastLast = {
      ts: new Date().toISOString(),
      horizonMonths: 6,
      paramsUsed: { iterations: 2000, sourceMonths: 12, seed: 1, mode: 'ensemble' },
      probNetNegative: Number.NaN,
      quantiles: { p10: 0, p50: 0, p90: 0 },
      uncertainty: Infinity,
      methodsUsed: ['iid_bootstrap'],
      disagreementScore: Number.NaN,
      perMethodSummary: [],
      monthly: []
    };

    const result = computeTurbulence(state);

    expect(Number.isFinite(result.overallScore)).toBe(true);
    expect(Number.isFinite(result.overallConfidence)).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('returns zeroes when there are no available signals', () => {
    const result = computeTurbulence(makeState());

    expect(result.overallScore).toBe(0);
    expect(result.overallConfidence).toBe(0);
    expect(result.signals).toHaveLength(0);
  });
});
