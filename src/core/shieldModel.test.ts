import { describe, expect, it } from 'vitest';
import { AppState, IslandId } from './types';
import { deriveShieldTiles } from './shieldModel';

const makeProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0,
  history: []
});

const makeState = (finance: AppState['inputData']['finance']): AppState => ({
  schemaVersion: 5,
  updatedAt: '2026-01-01T00:00:00.000Z',
  xp: 0,
  level: 1,
  streakDays: 0,
  flags: {
    onboarded: true,
    demoLoaded: false,
    homeScreen: 'shield',
    cosmosShowAllLabels: false,
    cosmosOnlyImportant: false,
    cosmosShowHalo: true,
    cosmosSoundFxEnabled: false,
    cosmosSfxVolume: 0.4,
    cosmosReduceMotionOverride: null
  },
  inputData: { finance },
  observations: { cashflowMonthly: [] },
  cosmosActivityLog: [],
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

const withPortfolio = (state: AppState, headline: string, topShare: number): AppState => ({
  ...state,
  islands: {
    ...state.islands,
    incomePortfolio: {
      ...state.islands.incomePortfolio,
      lastReport: {
        id: 'incomePortfolio' as IslandId,
        score: 60,
        confidence: 70,
        headline,
        summary: 'test',
        details: [`Top share: ${Math.round(topShare * 100)}%`]
      }
    }
  }
});

describe('deriveShieldTiles', () => {
  it('returns low money/income for weak finances', () => {
    const state = withPortfolio(
      makeState({ monthlyIncome: 70000, monthlyExpenses: 100000, reserveCash: 120000, monthlyDebtPayment: 35000, incomeSourcesCount: 1, top1Share: 0.9, top3Share: 1 }),
      'Портфель доходов: концентрация высокая',
      0.9
    );

    const tiles = deriveShieldTiles(state);
    expect(tiles).toHaveLength(6);
    expect(tiles.find((tile) => tile.id === 'money')?.score).toBeLessThan(55);
    expect(tiles.find((tile) => tile.id === 'income')?.score).toBeLessThan(40);
  });

  it('returns medium tile scores for average finances', () => {
    const state = withPortfolio(
      makeState({ monthlyIncome: 160000, monthlyExpenses: 130000, reserveCash: 390000, monthlyDebtPayment: 35000, incomeSourcesCount: 2, top1Share: 0.7, top3Share: 1 }),
      'Портфель доходов: концентрация средняя',
      0.7
    );

    const tiles = deriveShieldTiles(state);
    expect(tiles.find((tile) => tile.id === 'money')?.score).toBeGreaterThanOrEqual(55);
    expect(tiles.find((tile) => tile.id === 'money')?.score).toBeLessThanOrEqual(80);
    expect(tiles.find((tile) => tile.id === 'obligations')?.score).toBeGreaterThan(0);
  });

  it('returns high tiles for strong finances', () => {
    const state = withPortfolio(
      makeState({ monthlyIncome: 260000, monthlyExpenses: 120000, reserveCash: 900000, monthlyDebtPayment: 15000, incomeSourcesCount: 4, top1Share: 0.42, top3Share: 0.88 }),
      'Портфель доходов: концентрация низкая',
      0.42
    );

    const tiles = deriveShieldTiles(state);
    expect(tiles.find((tile) => tile.id === 'money')?.score).toBeGreaterThan(85);
    expect(tiles.find((tile) => tile.id === 'income')?.score).toBeGreaterThan(65);
  });
});
