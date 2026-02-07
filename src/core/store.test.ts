import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppState, IslandId } from './types';
import { migrate, schemaVersion } from './migrations';

const makeIslands = () =>
  ({
    bayes: { input: '', lastReport: null },
    hmm: { input: '', lastReport: null },
    timeseries: { input: '', lastReport: null },
    optimization: { input: '', lastReport: null },
    decisionTree: { input: '', lastReport: null },
    causalDag: { input: '', lastReport: null }
  }) satisfies Record<IslandId, AppState['islands'][IslandId]>;

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  schemaVersion: 0,
  updatedAt: '2024-01-01T00:00:00.000Z',
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
