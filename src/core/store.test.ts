import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppState, IslandId } from './types';
import { migrate, schemaVersion } from './migrations';

const makeProgress = () => ({
  lastRunAt: null,
  runsCount: 0,
  bestScore: 0,
  history: []
});

const makeIslands = () =>
  ({
    bayes: { input: '', lastReport: null, progress: makeProgress() },
    hmm: { input: '', lastReport: null, progress: makeProgress() },
    timeseries: { input: '', lastReport: null, progress: makeProgress() },
    optimization: { input: '', lastReport: null, progress: makeProgress() },
    decisionTree: { input: '', lastReport: null, progress: makeProgress() },
    causalDag: { input: '', lastReport: null, progress: makeProgress() }
  }) satisfies Record<IslandId, AppState['islands'][IslandId]>;

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  schemaVersion: 0,
  updatedAt: '2024-01-01T00:00:00.000Z',
  xp: 0,
  level: 1,
  streakDays: 0,
  flags: { onboarded: false, demoLoaded: false },
  islands: makeIslands(),
  ...overrides
});

const loadStore = async () => {
  vi.resetModules();
  return await import('./store');
};

beforeEach(() => {
  localStorage.clear();
});

describe('migrations', () => {
  it('migrates to the latest schema version', () => {
    const migrated = migrate(makeState({ schemaVersion: 0 }));
    expect(migrated.schemaVersion).toBe(schemaVersion);
  });
});

describe('store persistence', () => {
  it('saves state changes and loads them back', async () => {
    const store = await loadStore();
    store.updateIslandInput('bayes', 'test-input');

    const stored = localStorage.getItem('lifeShieldV2');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string) as AppState;
    expect(parsed.islands.bayes.input).toBe('test-input');

    const storeReloaded = await loadStore();
    const state = storeReloaded.getState();
    expect(state.islands.bayes.input).toBe('test-input');
  });
});

describe('import/export', () => {
  it('round-trips state via export/import JSON', async () => {
    const store = await loadStore();
    store.updateIslandInput('hmm', 'roundtrip');

    const exported = store.exportState();
    const parsed = JSON.parse(exported) as {
      schemaVersion: number;
      exportedAt: string;
      state: AppState;
    };

    expect(parsed.schemaVersion).toBe(schemaVersion);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.state.islands.hmm.input).toBe('roundtrip');

    localStorage.clear();

    const storeReloaded = await loadStore();
    const result = storeReloaded.importState(parsed);
    expect(result.ok).toBe(true);

    const state = storeReloaded.getState();
    expect(state.islands.hmm.input).toBe('roundtrip');
  });
});


describe('onboarding flags', () => {
  it('loads demo and sets onboarding flags', async () => {
    const store = await loadStore();
    store.loadDemoData();

    const state = store.getState();
    expect(state.flags.onboarded).toBe(true);
    expect(state.flags.demoLoaded).toBe(true);
    expect(state.islands.bayes.lastReport?.score).toBeGreaterThan(0);
    expect(state.islands.hmm.lastReport?.score).toBeGreaterThan(0);
    expect(state.islands.timeseries.lastReport?.score).toBeGreaterThan(0);
  });
});


describe('history tracking', () => {
  it('stores only the last 10 runs for each island', async () => {
    const store = await loadStore();
    for (let index = 0; index < 12; index += 1) {
      store.updateIslandReport('bayes', {
        id: 'bayes',
        score: 40 + index,
        confidence: 60,
        headline: 'test',
        summary: 'test',
        details: []
      });
    }

    const state = store.getState();
    const history = state.islands.bayes.progress.history;
    expect(history).toHaveLength(10);
    expect(history[0]?.score).toBe(42);
    expect(history.at(-1)?.score).toBe(51);
  });
});
