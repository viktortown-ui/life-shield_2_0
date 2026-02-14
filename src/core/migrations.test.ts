import { describe, expect, it } from 'vitest';
import type { AppState } from './types';
import { migrate, schemaVersion } from './migrations';

const legacyState = {
  schemaVersion: 4,
  updatedAt: '2025-01-01T00:00:00.000Z',
  xp: 0,
  level: 1,
  streakDays: 0,
  flags: { onboarded: false, demoLoaded: false },
  observations: { cashflowMonthly: [] },
  cosmosActivityLog: [],
  islands: {}
} as unknown as AppState;

describe('schema migrations', () => {
  it('adds typed finance input block and latest schema version', () => {
    const migrated = migrate(legacyState);
    expect(migrated.schemaVersion).toBe(schemaVersion);
    expect(migrated.inputData.finance.monthlyIncome).toBeGreaterThan(0);
    expect(migrated.inputData.finance.monthlyExpenses).toBeGreaterThan(0);
  });
});
